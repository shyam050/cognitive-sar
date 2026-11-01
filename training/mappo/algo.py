"""MAPPO update: clipped surrogate actor + centralized critic.

Sequential region selection lives here too (shared by training, evaluation and
deployment): robots choose one at a time in random order, each seeing the
regions chosen before it this step, so duplicate assignments are avoided
structurally rather than only penalized.
"""

import numpy as np
import torch
import torch.nn.functional as F


def sequential_select(actor, obs_actor, n_actions, mask=None, deterministic=False,
                      device="cpu"):
    """Choose one region per robot, one robot at a time, in random order.

    Each robot sees what the robots before it chose *this step* (and the previous
    assignment of robots that have not chosen yet) in the "others_claimed" slot
    of its actor extras. Returns (actions (n,), logp (n,), extras_used (n, D));
    store extras_used for PPO so update() replays exactly what the actor saw.

    Actor-extras layout: [0:4] base | front[A] | claimed[A] | own_prev[A].
    """
    A = n_actions
    n = len(obs_actor)
    crops = torch.as_tensor(np.stack([o[0] for o in obs_actor]),
                            dtype=torch.float32, device=device)
    extras = np.stack([o[1] for o in obs_actor]).astype(np.float32)  # astype copies
    own = extras[:, 4 + 2 * A: 4 + 3 * A]
    prev = [int(own[j].argmax()) if own[j].sum() > 0 else None for j in range(n)]
    chosen = [None] * n
    actions = np.zeros(n, dtype=np.int64)
    logps = np.zeros(n, dtype=np.float32)
    m = None if mask is None else torch.as_tensor(mask, dtype=torch.float32, device=device)
    with torch.no_grad():
        for i in np.random.permutation(n):
            i = int(i)
            claimed = np.zeros(A, dtype=np.float32)
            for j in range(n):
                if j == i:
                    continue
                r = chosen[j] if chosen[j] is not None else prev[j]
                if r is not None:
                    claimed[r] = 1.0
            extras[i, 4 + A: 4 + 2 * A] = claimed
            ex = torch.as_tensor(extras[i:i + 1], device=device)
            logits = actor.head(actor(crops[i:i + 1], ex))
            if m is not None and m.sum() > 0:
                logits = logits.masked_fill(m == 0.0, -1e9)
            dist = torch.distributions.Categorical(logits=logits)
            a = torch.argmax(logits, dim=-1) if deterministic else dist.sample()
            actions[i] = int(a.item())
            logps[i] = float(dist.log_prob(a).item())
            chosen[i] = actions[i]
    return actions, logps, extras


class MAPPO:
    def __init__(self, actor, critic, cfg, n_actions: int, device):
        self.actor, self.critic, self.cfg = actor, critic, cfg
        self.n_actions = n_actions
        self.device = device
        self.opt_actor = torch.optim.Adam(actor.parameters(), lr=cfg.actor_lr)
        self.opt_critic = torch.optim.Adam(critic.parameters(), lr=cfg.critic_lr)

    def act(self, obs, deterministic: bool = False, action_mask=None):
        """Sample actions for all robots via sequential selection.

        action_mask: optional per-team validity vector (n_actions,) with 1 for
        legal actions. Applied identically here and in update(), so log-probs
        stay consistent for the PPO ratio.
        """
        actions, logps, self.last_extras = sequential_select(
            self.actor, obs["actor"], self.n_actions, mask=action_mask,
            deterministic=deterministic, device=self.device)
        with torch.no_grad():
            g = torch.as_tensor(obs["critic"][0], device=self.device).unsqueeze(0)
            e = torch.as_tensor(obs["critic"][1], device=self.device).unsqueeze(0)
            value = self.critic(g, e).expand(-1) if g.dim() == 5 else self.critic(g, e)
        return (actions, logps,
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
        count = 0
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
                # plain MSE: the old +/-0.2 value clip assumes normalized returns; ours were
                # std~10, so the critic could barely move and advantages were mostly noise
                v_loss = 0.5 * ((v - data["returns"][bt]) ** 2).mean()

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
                count += 1
                if kl > cfg.target_kl:
                    stop = True
                    break
        for k in stats:
            stats[k] /= max(count, 1)
        return stats


def nn_utils_clip(actor, critic, max_norm: float) -> None:
    torch.nn.utils.clip_grad_norm_(actor.parameters(), max_norm)
    torch.nn.utils.clip_grad_norm_(critic.parameters(), max_norm)
