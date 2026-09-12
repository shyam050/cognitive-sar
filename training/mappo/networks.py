"""Actor (decentralized) and centralized critic networks for MAPPO."""

import torch
import torch.nn as nn

try:
    from ..config import ENV, PPO, ObsSpec
except ImportError:
    from config import ENV, PPO, ObsSpec


def _init(module: nn.Module, gain: float = 1.4142) -> None:
    for m in module.modules():
        if isinstance(m, (nn.Conv2d, nn.Linear)):
            nn.init.orthogonal_(m.weight, gain)
            nn.init.zeros_(m.bias)


class ActorNet(nn.Module):
    """Shared across robots (homogeneous team). Input: local crop + extras."""

    def __init__(self, env_cfg=ENV, ppo_cfg=PPO):
        super().__init__()
        C = env_cfg.crop_size
        self.conv = nn.Sequential(
            nn.Conv2d(3, 16, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),   # 13 -> 6
            nn.Conv2d(16, 32, 3, padding=1), nn.ReLU(), nn.MaxPool2d(2),  # 6 -> 3
        )
        self.conv_out = 32 * (C // 4) * (C // 4)
        self.extras = nn.Sequential(nn.Linear(4, 16), nn.ReLU())
        self.trunk = nn.Sequential(nn.Linear(self.conv_out + 16, ppo_cfg.hidden), nn.ReLU())
        self.head = nn.Linear(ppo_cfg.hidden, ObsSpec.n_actions_from(env_cfg))
        _init(self, gain=1.4142)
        _init(self.head, gain=0.01)

    def forward(self, crop: torch.Tensor, extras: torch.Tensor) -> torch.Tensor:
        h = self.conv(crop).flatten(1)
        h = torch.cat([h, self.extras(extras)], dim=1)
        return self.trunk(h)  # features (logits applied in algo)


class CriticNet(nn.Module):
    """Centralized: sees the global map + all robot positions."""

    def __init__(self, env_cfg=ENV, ppo_cfg=PPO):
        super().__init__()
        in_ch = ObsSpec.critic_channels_n(env_cfg)
        self.conv = nn.Sequential(
            nn.Conv2d(in_ch, 32, 4, stride=2), nn.ReLU(),   # 64 -> 31
            nn.Conv2d(32, 64, 3, stride=2), nn.ReLU(),      # 31 -> 15
            nn.AdaptiveAvgPool2d((4, 4)),
        )
        self.fc_in = 64 * 16 + 16
        self.extras = nn.Sequential(nn.Linear(3, 16), nn.ReLU())
        self.trunk = nn.Sequential(nn.Linear(self.fc_in, ppo_cfg.hidden), nn.ReLU())
        self.v = nn.Linear(ppo_cfg.hidden, 1)
        _init(self)

    def forward(self, grid: torch.Tensor, extras: torch.Tensor) -> torch.Tensor:
        h = self.conv(grid).flatten(1)
        h = torch.cat([h, self.extras(extras)], dim=1)
        return self.v(self.trunk(h)).squeeze(-1)
