"""The frozen deployment contract between training and deployment.

Contains the actor-network replica and the live observation builders. This
module imports ONLY numpy/torch (no rclpy) so it is unit-testable outside the
ROS workspace (test/test_obs_contract.py) and trivially comparable with the
training code:

  build_actor()        <-> training/mappo/networks.py::ActorNet   (same layers)
  downsample_to_grid() <-> training/sar_gym/world.py grid semantics
  crop()               <-> training/sar_gym/world.py::_crop
  actor_obs()          <-> training/sar_gym/world.py::actor_obs

ANY change here must be mirrored in the training stack and re-validated with
test_obs_contract.py (see docs/interfaces.md).
"""

import numpy as np

try:
    import torch
    import torch.nn as nn
except ImportError:  # noqa: BLE001 - callers report a clear error
    torch = None


def build_actor(env_cfg, hidden=128):
    """Actor replica: layers/names must match training ActorNet exactly."""
    if torch is None:
        raise RuntimeError(
            "PyTorch is not installed. Inside WSL:  pip install torch "
            "(CPU) or the CUDA wheel - see README section 5.")
    crop = env_cfg["crop_size"]

    class ActorNet(nn.Module):
        def __init__(self):
            super().__init__()
            self.conv = nn.Sequential(
                nn.Conv2d(3, 16, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
                nn.Conv2d(16, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),
            )
            self.conv_out = 32 * (crop // 4) * (crop // 4)
            self.extras = nn.Sequential(nn.Linear(4, 16), nn.ReLU())
            self.trunk = nn.Sequential(nn.Linear(self.conv_out + 16, hidden), nn.ReLU())
            self.head = nn.Linear(hidden, env_cfg["n_actions"])

        def forward(self, crop_t, extras_t):
            h = self.conv(crop_t).flatten(1)
            h = torch.cat([h, self.extras(extras_t)], dim=1)
            return self.trunk(h)

    return ActorNet()


def downsample_to_grid(data, res, ox, oy, grid_size, world_size):
    """Merged OccupancyGrid payload -> (wall, explored, frontier) on the
    S x S training grid. Channels follow the training env semantics:
      wall     - any cell in the block occupied (>=65)
      explored - any known cell in the block
      frontier - known free cell with a 4-neighbour unknown block
    """
    S, cell = grid_size, world_size / grid_size
    h, w = data.shape
    wall = np.zeros((S, S), bool)
    explored = np.zeros((S, S), bool)
    for r in range(S):
        gr0 = max(0, int((r * cell - oy) / res))
        gr1 = int(((r + 1) * cell - oy) / res)
        for c in range(S):
            gc0 = max(0, int((c * cell - ox) / res))
            gc1 = int(((c + 1) * cell - ox) / res)
            block = data[gr0:max(gr1, gr0 + 1), gc0:max(gc1, gc0 + 1)]
            if block.size == 0:
                continue
            explored[r, c] = bool((block != -1).any())
            wall[r, c] = bool((block >= 65).any())
    unknown = ~explored
    nb_unknown = np.zeros_like(unknown)
    nb_unknown[1:, :] |= unknown[:-1, :]
    nb_unknown[:-1, :] |= unknown[1:, :]
    nb_unknown[:, 1:] |= unknown[:, :-1]
    nb_unknown[:, :-1] |= unknown[:, 1:]
    # frontier = known free cell adjacent to an unknown cell (training def)
    frontier = explored & ~wall & nb_unknown
    return wall.astype(np.float32), explored.astype(np.float32), \
        frontier.astype(np.float32)


def crop(a, r, c, size, grid_extent):
    """size x size crop centred on (r, c), zero padded - mirrors training."""
    half = size // 2
    out = np.zeros((size, size), np.float32)
    r_lo, r_hi = max(0, r - half), min(grid_extent, r + half + 1)
    c_lo, c_hi = max(0, c - half), min(grid_extent, c + half + 1)
    out[r_lo - (r - half):r_hi - (r - half), c_lo - (c - half):c_hi - (c - half)] = \
        a[r_lo:r_hi, c_lo:c_hi]
    return out


def actor_obs(wall, explored, frontier, cell_r, cell_c, victims_frac, steps_frac,
              crop_size):
    """(crop (3,C,C) float32, extras (4,) float32) - the exact training spec."""
    crop_t = np.stack([
        crop(wall, cell_r, cell_c, crop_size, wall.shape[0]),
        crop(explored, cell_r, cell_c, crop_size, wall.shape[0]),
        crop(frontier, cell_r, cell_c, crop_size, wall.shape[0]),
    ]).astype(np.float32)
    S = wall.shape[0]
    extras = np.array([cell_r / (S - 1), cell_c / (S - 1),
                       victims_frac, steps_frac], dtype=np.float32)
    return crop_t, extras


def pose_to_cell(x_m, y_m, grid_size, world_size):
    r = int(np.clip(y_m / (world_size / grid_size), 0, grid_size - 1))
    c = int(np.clip(x_m / (world_size / grid_size), 0, grid_size - 1))
    return r, c
