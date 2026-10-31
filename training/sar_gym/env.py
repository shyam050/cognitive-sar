"""Multi-agent SAR search environment (region-level task allocation)."""

import numpy as np

try:
    from ..config import ENV          # imported as training.sar_gym
except ImportError:
    from config import ENV            # training/ on sys.path (train.py, evaluate.py)
from .world import GridWorld


class MultiAgentSAREnv:
    """N robots allocate regions (discrete actions); an A* executor drives them.

    API (dict-based, PettingZoo-flavoured):
        obs, _ = env.reset(seed)
        obs, rewards, terminated, truncated, info = env.step({robot_id: action})
    """

    def __init__(self, cfg=ENV, seed: int = 0):
        self.cfg = cfg
        self.n_actions = cfg.region_grid[0] * cfg.region_grid[1]
        self.seed_base = seed
        self._episode = 0

    def reset(self, seed: int | None = None):
        if seed is None:
            seed = self.seed_base + self._episode
            self._episode += 1
        self.world = GridWorld(self.cfg, seed)
        self.paths = {i: [] for i in range(self.cfg.n_robots)}
        self.prev_actions = {i: None for i in range(self.cfg.n_robots)}
        self.target_cell = {i: None for i in range(self.cfg.n_robots)}
        self.target_age = {i: 99 for i in range(self.cfg.n_robots)}
        return self._observations(), {}

    def step(self, actions: dict):
        w = self.world
        w.invalidate()
        frontiers = w.region_frontiers()
        rewards = {}
        for i in range(self.cfg.n_robots):
            a = int(actions[i]) % self.n_actions
            rewards[i] = self._act(i, a, frontiers)

        w.t += 1
        # second sense pass: robots observe from their new cell
        for i in range(self.cfg.n_robots):
            new_cells, overlap = w._sense(i)
            rewards[i] += self.cfg.w_explore * len(new_cells)
            rewards[i] -= self.cfg.w_overlap * overlap
            w.overlap_cells += overlap
        w.invalidate()

        terminated = (w.coverage() >= self.cfg.coverage_target
                      or bool(w.victim_found.all()))
        truncated = w.t >= self.cfg.max_steps
        return self._observations(), rewards, terminated, truncated, self._info()

    def _act(self, i: int, action: int, frontiers: dict) -> float:
        w = self.world
        cfg = self.cfg
        reward = -cfg.w_step

        _, n = frontiers[action]
        if n == 0:
            reward -= cfg.w_stale_region
        region_changed = (w.assigned_region[i] != action)
        w.assigned_region[i] = action
        self.prev_actions[i] = action

        # re-target when the assignment changes or the target ages out: the
        # executor must follow the allocator's latest decision, or adaptive
        # policies get their choices silently vetoed for up to 8 steps
        self.target_age[i] += 1
        if (self.target_cell[i] is None or self.target_age[i] >= 8
                or region_changed or self.paths[i] == []):
            self.target_cell[i] = w.region_target_cell(action)
            self.target_age[i] = 0
            self.paths[i] = []
        target = self.target_cell[i]

        pos = tuple(w.robots[i])
        path = self.paths[i]
        if not path or tuple(path[-1]) != target:
            path = w.astar(pos, target)
            self.paths[i] = path
        if len(path) > 1:
            w.robots[i] = list(path[1])
            self.paths[i] = path[1:]
        return reward

    def _observations(self) -> dict:
        actor = [self.world.actor_obs(i) for i in range(self.cfg.n_robots)]
        critic = self.world.critic_obs()
        return {"actor": actor, "critic": critic}

    def _info(self) -> dict:
        w = self.world
        det = [int(s) for s in w.victim_detect_step if s >= 0]
        return {
            "coverage": w.coverage(),
            "victims": int(w.victim_found.sum()),
            "n_victims": w.n_victims,
            "detection_steps": det,
            "overlap_ratio": w.overlap_ratio(),
            "steps": w.t,
        }
