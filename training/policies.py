"""Executable policies: trained MAPPO, rule-based allocator, random.

MAPPOPolicy consumes observations exactly as produced by GridWorld.actor_obs /
critic_obs — the same spec the ROS deployment node builds from live topics.
"""

import numpy as np
import torch

from config import ENV, PPO
from mappo import ActorNet, CriticNet


class RandomPolicy:
    name = "random"

    def act(self, env, obs):
        n = env.cfg.n_robots
        return {i: int(np.random.randint(env.n_actions)) for i in range(n)}


class RulePolicy:
    """Greedy nearest-frontier-region allocator (the O5 baseline)."""
    name = "rule_based"

    def act(self, env, obs):
        w = env.world
        frontiers = w.region_frontiers()
        claimed = set()
        actions = {}
        for i in range(env.cfg.n_robots):
            r, c = w.robots[i]
            best, best_cost = None, float("inf")
            for rid, (cent, n) in frontiers.items():
                if n == 0 or rid in claimed:
                    continue
                # distance to region frontier centroid (approx: region center if unknown)
                ry, rx = env.cfg.region_grid
                rh, rw = w.size // ry, w.size // rx
                rr, cc = (rid // rx * rh + rh // 2, rid % rx * rw + rw // 2)
                if cent is not None:
                    rr, cc = int(cent[0]), int(cent[1])
                d = (rr - r) ** 2 + (cc - c) ** 2
                if d < best_cost:
                    best, best_cost = rid, d
            if best is None:  # no frontier left anywhere
                best = int(np.random.randint(env.n_actions))
            claimed.add(best)
            actions[i] = best
        return actions


class MAPPOPolicy:
    name = "mappo"

    def __init__(self, checkpoint_path: str, device="cpu", deterministic=True):
        ckpt = torch.load(checkpoint_path, map_location=device, weights_only=False)
        self.env_cfg = ckpt["env_cfg"]
        self.deterministic = deterministic
        self.device = device
        self.actor = ActorNet(self.env_cfg, PPO).to(device)
        self.actor.load_state_dict(ckpt["actor"])
        self.actor.eval()
        self.n_actions = self.env_cfg.region_grid[0] * self.env_cfg.region_grid[1]

    def act(self, env, obs):
        with torch.no_grad():
            crops = torch.as_tensor(np.stack([o[0] for o in obs["actor"]]),
                                    dtype=torch.float32, device=self.device)
            aex = torch.as_tensor(np.stack([o[1] for o in obs["actor"]]),
                                  dtype=torch.float32, device=self.device)
            feats = self.actor(crops, aex)
            logits = self.actor.head(feats)
            if self.deterministic:
                actions = torch.argmax(logits, dim=-1)
            else:
                actions = torch.distributions.Categorical(logits=logits).sample()
        return {i: int(a) for i, a in enumerate(actions.cpu().numpy())}
