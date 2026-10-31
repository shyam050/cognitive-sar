"""On-policy rollout storage with per-agent GAE."""

import numpy as np
import torch


class RolloutBuffer:
    def __init__(self, steps: int, n_robots: int, crop_shape, glob_shape, device,
                 n_actions: int = 0):
        self.T, self.n, self.device = steps, n_robots, device
        self.A = n_actions
        self.crops = np.zeros((steps, n_robots) + crop_shape, dtype=np.float32)
        self.aextras = np.zeros((steps, n_robots, 4), dtype=np.float32)
        self.ggrid = np.zeros((steps,) + glob_shape[0], dtype=np.float32)
        self.gextras = np.zeros((steps, 3), dtype=np.float32)
        self.actions = np.zeros((steps, n_robots), dtype=np.int64)
        self.logp = np.zeros((steps, n_robots), dtype=np.float32)
        self.values = np.zeros((steps, n_robots), dtype=np.float32)
        self.rewards = np.zeros((steps, n_robots), dtype=np.float32)
        self.dones = np.zeros(steps, dtype=np.float32)
        self.mask = (np.zeros((steps, n_robots, n_actions), dtype=np.float32)
                     if n_actions else None)
        self.ptr = 0

    def add(self, obs, actions, logp, values, rewards, done, mask=None):
        t = self.ptr
        for i in range(self.n):
            self.crops[t, i] = obs["actor"][i][0]
            self.aextras[t, i] = obs["actor"][i][1]
        self.ggrid[t] = obs["critic"][0]
        self.gextras[t] = obs["critic"][1]
        self.actions[t] = actions
        self.logp[t] = logp
        self.values[t] = values
        self.rewards[t] = rewards
        self.dones[t] = done
        if self.mask is not None and mask is not None:
            self.mask[t] = mask
        self.ptr += 1

    def finalize(self, last_obs, critic):
        """Bootstrap + GAE. Returns dict of torch tensors flattened over (T, n)."""
        with torch.no_grad():
            if self.dones[-1] > 0:
                next_value = np.zeros(self.n, dtype=np.float32)
            else:
                g = torch.as_tensor(last_obs["critic"][0], device=self.device).unsqueeze(0)
                e = torch.as_tensor(last_obs["critic"][1], device=self.device).unsqueeze(0)
                next_value = np.broadcast_to(
                    critic(g, e).cpu().numpy(), (self.n,)).astype(np.float32)
        adv = np.zeros_like(self.rewards)
        lastgaelam = np.zeros(self.n, dtype=np.float32)
        for t in reversed(range(self.T)):
            nv = next_value if t == self.T - 1 else self.values[t + 1]
            mask = 1.0 - self.dones[t]
            delta = self.rewards[t] + self.gamma * nv * mask - self.values[t]
            lastgaelam = delta + self.gamma * self.lam * mask * lastgaelam
            adv[t] = lastgaelam
        returns = adv + self.values
        T, n = self.T, self.n
        out = {
            "crops": torch.as_tensor(self.crops.reshape(T * n, *self.crops.shape[2:]), device=self.device),
            "aextras": torch.as_tensor(self.aextras.reshape(T * n, -1), device=self.device),
            "ggrid": torch.as_tensor(np.repeat(self.ggrid, n, axis=0), device=self.device),
            "gextras": torch.as_tensor(np.repeat(self.gextras, n, axis=0), device=self.device),
            "actions": torch.as_tensor(self.actions.reshape(-1), device=self.device),
            "logp": torch.as_tensor(self.logp.reshape(-1), device=self.device),
            "values": torch.as_tensor(self.values.reshape(-1), device=self.device),
            "adv": torch.as_tensor(adv.reshape(-1), device=self.device),
            "returns": torch.as_tensor(returns.reshape(-1), device=self.device),
        }
        if self.mask is not None:
            out["mask"] = torch.as_tensor(self.mask.reshape(T * n, -1), device=self.device)
        return out

    gamma = 0.99
    lam = 0.95

    def set_gae(self, gamma: float, lam: float) -> None:
        self.gamma, self.lam = gamma, lam
