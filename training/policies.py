"""Executable policies: trained MAPPO, rule-based allocator, random.

MAPPOPolicy consumes observations exactly as produced by GridWorld.actor_obs /
critic_obs — the same spec the ROS deployment node builds from live topics.
"""

import numpy as np
import torch

from config import ENV, PPO
from mappo import ActorNet, CriticNet
from mappo.algo import sequential_select


class RandomPolicy:
    name = "random"

    def act(self, env, obs):
        n = env.cfg.n_robots
        return {i: int(np.random.randint(env.n_actions)) for i in range(n)}


class RandomMaskedPolicy:
    """Random among regions that still have frontiers (fair baseline for masked MAPPO)."""
    name = "random_masked"

    def act(self, env, obs):
        fr = env.world.region_frontiers()
        valid = [k for k, (_, n) in fr.items() if n > 0] or list(range(env.n_actions))
        return {i: int(np.random.choice(valid)) for i in range(env.cfg.n_robots)}


class _StickyBase:
    """Hold each robot's region until it has no frontier left, then re-pick.

    Simple persistence baselines: they show how much of a learned policy's gain is
    just *commitment* (the executor now follows every assignment change at once).
    """
    avoid_claimed = False

    def __init__(self):
        self.cur = {}

    def act(self, env, obs):
        fr = env.world.region_frontiers()
        valid = [k for k, (_, n) in fr.items() if n > 0] or list(range(env.n_actions))
        n = env.cfg.n_robots
        if env.world.t == 0:
            self.cur = {}
        actions = {}
        for i in range(n):
            c = self.cur.get(i)
            if c is None or fr.get(c, (None, 0))[1] == 0:
                pool = valid
                if self.avoid_claimed:
                    taken = {self.cur[j] for j in range(n) if j != i and j in self.cur}
                    pool = [k for k in valid if k not in taken] or valid
                c = int(np.random.choice(pool))
            self.cur[i] = c
            actions[i] = c
        return actions


class StickyRandomPolicy(_StickyBase):
    name = "sticky_random"


class StickyUnclaimedPolicy(_StickyBase):
    """Sticky + never re-pick a region another robot currently holds."""
    name = "sticky_unclaimed"
    avoid_claimed = True


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

    def __init__(self, checkpoint_path: str, device="cpu", deterministic=True,
                 mask_invalid=True):
        ckpt = torch.load(checkpoint_path, map_location=device, weights_only=False)
        self.env_cfg = ckpt["env_cfg"]
        self.deterministic = deterministic
        self.mask_invalid = mask_invalid
        self.device = device
        self.actor = ActorNet(self.env_cfg, PPO).to(device)
        self.actor.load_state_dict(ckpt["actor"])
        self.actor.eval()
        self.n_actions = self.env_cfg.region_grid[0] * self.env_cfg.region_grid[1]

    def act(self, env, obs):
        mask = None
        if self.mask_invalid:
            # invalid-action masking: regions with no frontier left cannot be chosen
            rf = env.world.region_frontiers()
            mask = np.array([1.0 if rf.get(a, (None, 0))[1] > 0 else 0.0
                             for a in range(self.n_actions)], dtype=np.float32)
            if mask.sum() == 0:
                mask = None
        # sequential selection: each robot sees the regions chosen before it this step
        actions, _, _ = sequential_select(
            self.actor, obs["actor"], self.n_actions, mask=mask,
            deterministic=self.deterministic, device=self.device)
        return {i: int(a) for i, a in enumerate(actions)}
