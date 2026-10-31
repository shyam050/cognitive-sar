"""MAPPO update: clipped surrogate actor + clipped-value centralized critic."""

import numpy as np
import torch
import torch.nn.functional as F


class MAPPO:
    def __init__(self, actor, critic, cfg, n_actions: int, device):
        self.actor, self.critic, self.cfg = actor, critic, cfg
        self.n_actions = n_actions
        self.device = device
        self.opt_actor = torch.optim.Adam(actor.parameters(), lr=cfg.actor_lr)
        self.opt_critic = torch.optim.Adam(critic.parameters(), lr=cfg.critic_lr)

    def act(self, obs, deterministic: bool = False, action_mask=None):
        """Sample actions for all robots. Returns (actions np(n,), logp, value).

        action_mask: optional per-team validity vector (n_actions,) with 1 for
        legal actions. Applied identically here and in update(), so log-probs
        stay consistent for the PPO ratio.
        """
        with torch.no_grad():
            crops = torch.as_tensor(
                np.stack([o[0] for o in obs["actor"]]), device=self.device)
            aex = torch.as_tensor(
                np.stack([o[1] for o in obs["actor"]]), device=self.device)
            feats = self.actor(crops, aex)
            logits = self._actor_logits(feats)
            if action_mask is not None:
                m = torch.as_tensor(action_mask, dtype=logits.dtype,
                                    device=logits.device)
                if m.sum() > 0:
                    logits = logits.masked_fill(m == 0.0, -1e9)
            dist = torch.distributions.Categorical(logits=logits)
            actions = torch.argmax(logits, dim=-1) if deterministic else dist.sample()
            logp = dist.log_prob(actions)
            g = torch.as_tensor(obs["critic"][0], device=self.device).unsqueeze(0)
            e = torch.as_tensor(obs["critic"][1], device=self.device).unsqueeze(0)
            value = self.critic(g, e).expand(-1) if g.dim() == 5 else self.critic(g, e)
        return (actions.cpu().numpy(), logp.cpu().numpy(),
                float(value.mean()) if value.numel() > 1 else float(value))

    def act_values_all(self, obs):
        """Per-robot values (used by buffer bootstrap path)."""
        with torch.no_grad():
            g = torch.as_tensor(obs["critic"][0], device=self.device).unsqueeze(0)
            e = torch.as_tensor(obs["critic"][1], device=self.device).unsqueeze(0)
            v = self.critic(g, e)
        return float(v.item())

    def _actor_logits(self, feats: torch.Tensor) -> torch.Tensor:
        return self.actor.head(feats)

    def update(self, data: dict) -> dict:
        cfg = self.cfg
        adv = data["adv"]
        adv = (adv - adv.mean()) / (adv.std() + 1e-8)
        n = adv.numel()
        idx = np.arange(n)
        stats = {"pi_loss": 0.0, "v_loss": 0.0, "entropy": 0.0, "kl": 0.0, "clipfrac": 0.0}
        stop = False
        for _ in range(cfg.epochs):
            if stop:
                break
            np.random.shuffle(idx)
            mb = n // cfg.minibatches
            for k in range(cfg.minibatches):
                b = idx[k * mb:(k + 1) * mb] if k < cfg.minibatches - 1 else idx[k * mb:]
                bt = torch.as_tensor(b, device=self.device)
                crops = data["crops"][bt]
                aex = data["aextras"][bt]
                feats = self.actor(crops, aex)
                logits = self._actor_logits(feats)
                if "mask" in data:
                    logits = logits.masked_fill(data["mask"][bt] == 0.0, -1e9)
                dist = torch.distributions.Categorical(logits=logits)
                logp = dist.log_prob(data["actions"][bt])
                ratio = torch.exp(logp - data["logp"][bt])
                a = adv[bt]
                s1 = -a * ratio
                s2 = -a * torch.clamp(ratio, 1 - cfg.clip, 1 + cfg.clip)
                pi_loss = torch.max(s1, s2).mean()
                entropy = dist.entropy().mean()

                v = self.critic(data["ggrid"][bt], data["gextras"][bt])
                v_clipped = data["values"][bt] + torch.clamp(
                    v - data["values"][bt], -cfg.clip, cfg.clip)
                v_loss = 0.5 * torch.max(
                    (v - data["returns"][bt]) ** 2,
                    (v_clipped - data["returns"][bt]) ** 2).mean()

                self.opt_actor.zero_grad(set_to_none=True)
                self.opt_critic.zero_grad(set_to_none=True)
                (pi_loss - cfg.ent_coef * entropy + cfg.value_coef * v_loss).backward()
                nn_utils_clip(self.actor, self.critic, cfg.max_grad_norm)
                self.opt_actor.step()
                self.opt_critic.step()

                with torch.no_grad():
                    kl = (data["logp"][bt] - logp).mean().item()
                stats["pi_loss"] += pi_loss.item()
                stats["v_loss"] += v_loss.item()
                stats["entropy"] += entropy.item()
                stats["kl"] += kl
                stats["clipfrac"] += ((ratio - 1).abs() > cfg.clip).float().mean().item()
                if kl > cfg.target_kl:
                    stop = True
                    break
        div = max(1, len(idx) // (n // cfg.minibatches))
        for k in stats:
            stats[k] /= div
        return stats


def nn_utils_clip(actor, critic, max_norm: float) -> None:
    torch.nn.utils.clip_grad_norm_(actor.parameters(), max_norm)
    torch.nn.utils.clip_grad_norm_(critic.parameters(), max_norm)
