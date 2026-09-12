"""Central configuration for the SAR training stack.

The observation spec defined here is the single source of truth shared with the
ROS-side deployment node (sar_alloc_rl). Any change must be mirrored there and
in docs/interfaces.md.
"""

from dataclasses import dataclass, field


@dataclass
class EnvConfig:
    map_size: int = 64            # grid cells per side
    cell_size: float = 0.5        # metres per cell (world is 32 m x 32 m)
    n_rooms: int = 9              # rooms carved per maze
    n_robots: int = 3
    n_victims: int = 5
    fov_range: int = 9            # lidar/camera sensing radius in cells
    fov_rays: int = 36            # rays per sweep (10 degrees apart)
    max_steps: int = 600
    coverage_target: float = 0.90
    region_grid: tuple = (4, 4)   # region partition -> 16 discrete actions
    crop_size: int = 13           # local observation crop (cells)

    # reward weights
    w_explore: float = 0.10       # per newly explored cell (first observer)
    w_victim: float = 10.0        # per victim newly located
    w_overlap: float = 0.02       # per cell re-observed that another robot explored first
    w_step: float = 0.01          # per-step time penalty
    w_stale_region: float = 0.05  # chosen a region that currently has no frontier


@dataclass
class PPOConfig:
    rollout_steps: int = 1000     # env steps per rollout (x n_robots agent samples)
    gamma: float = 0.99
    gae_lambda: float = 0.95
    clip: float = 0.2
    ent_coef: float = 0.01
    ent_coef_min: float = 0.003
    ent_decay_steps: int = 120_000
    value_coef: float = 0.5
    epochs: int = 4
    minibatches: int = 4
    actor_lr: float = 3e-4
    critic_lr: float = 1e-3
    max_grad_norm: float = 0.5
    target_kl: float = 0.03
    hidden: int = 128


@dataclass
class ObsSpec:
    """Exact observation contract (mirrored by sar_alloc_rl on the ROS side)."""
    crop_size: int = 13
    crop_channels: tuple = ("wall", "explored", "frontier")
    actor_extras: tuple = ("x_norm", "y_norm", "victims_frac", "steps_frac")
    critic_channels: tuple = ("wall", "explored", "frontier", "victims_found",
                              "robot_onehot_x n_robots")
    critic_extras: tuple = ("coverage", "victims_frac", "steps_frac")
    n_actions: int = 16           # region_grid product

    @staticmethod
    def n_actions_from(env: EnvConfig) -> int:
        return env.region_grid[0] * env.region_grid[1]

    @staticmethod
    def critic_channels_n(env: EnvConfig) -> int:
        return 4 + env.n_robots


ENV = EnvConfig()
PPO = PPOConfig()
