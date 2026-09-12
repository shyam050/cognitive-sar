"""Contract tests: the deployment observation builders must match training.

Run from ros2_ws/src/sar_alloc_rl:
    python -m pytest test/test_obs_contract.py -q
The state-dict round-trip test needs the training tree (repo-relative path).
"""

import os
import sys

import numpy as np
import pytest

from sar_alloc_rl.obs_contract import build_actor, crop, downsample_to_grid, \
    actor_obs, pose_to_cell

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.."))


def _identity_map():
    """32 m world at 0.5 m/cell -> the merged grid IS the training grid."""
    S = 64
    data = np.full((S, S), -1, dtype=np.int8)
    free = np.zeros((S, S), bool)
    free[5:20, 5:30] = True          # a known free room
    data[free] = 0
    wall = np.zeros((S, S), bool)
    wall[10:12, 8:26] = True         # a wall inside the known area
    data[wall] = 100
    return data, wall, free


def test_downsample_identity():
    """0.5 m merged grid == training grid -> channels must match exactly."""
    data, wall, _ = _identity_map()
    known = data != -1
    true_free = known & (data != 100)
    w2, e2, f2 = downsample_to_grid(data, 0.5, 0.0, 0.0, 64, 32.0)
    assert np.allclose(w2, wall.astype(np.float32))
    assert np.allclose(e2, known.astype(np.float32))
    # frontier: known free cells with an unknown 4-neighbour (training def)
    unknown = data == -1
    nb = np.zeros_like(unknown)
    nb[1:, :] |= unknown[:-1, :]
    nb[:-1, :] |= unknown[1:, :]
    nb[:, 1:] |= unknown[:, :-1]
    nb[:, :-1] |= unknown[:, 1:]
    frontier = true_free & nb
    assert np.allclose(f2, frontier.astype(np.float32))


def test_crop_matches_training():
    sys.path.insert(0, os.path.join(REPO, "training"))
    from sar_gym.world import _crop as train_crop
    rng = np.random.default_rng(0)
    a = rng.random((64, 64)).astype(np.float32)
    for (r, c) in [(0, 0), (10, 40), (63, 63), (32, 32)]:
        assert np.allclose(crop(a, r, c, 13, 64), train_crop(a, r, c, 6, 13))


def test_actor_state_dict_roundtrip():
    """A checkpoint saved by the training ActorNet must load into the replica
    and produce identical logits."""
    pytest.importorskip("torch")
    sys.path.insert(0, os.path.join(REPO, "training"))
    torch = pytest.importorskip("torch")
    from mappo.networks import ActorNet as TrainActor
    from config import PPO

    class Cfg:
        crop_size = 13
        n_actions = 16
        region_grid = (4, 4)   # training ActorNet derives n_actions from this

    train_actor = TrainActor(Cfg(), PPO)
    replica = build_actor({"crop_size": 13, "n_actions": 16}, PPO.hidden)
    replica.load_state_dict(train_actor.state_dict())
    replica.eval()

    crop_t = torch.randn(2, 3, 13, 13)
    ex = torch.randn(2, 4)
    with torch.no_grad():
        lt = train_actor.head(train_actor(crop_t, ex))
        lr = replica.head(replica(crop_t, ex))
    assert torch.allclose(lt, lr, atol=1e-6)


def test_pose_to_cell():
    assert pose_to_cell(0.0, 0.0, 64, 32.0) == (0, 0)
    assert pose_to_cell(31.9, 31.9, 64, 32.0) == (63, 63)
    assert pose_to_cell(16.0, 8.0, 64, 32.0) == (16, 32)


def test_actor_obs_shapes():
    wall = np.zeros((64, 64), np.float32)
    expl = np.ones((64, 64), np.float32)
    front = np.zeros((64, 64), np.float32)
    c, e = actor_obs(wall, expl, front, 10, 20, 0.4, 0.5, 13)
    assert c.shape == (3, 13, 13) and e.shape == (4,)
    assert abs(e[0] - 10 / 63) < 1e-6 and abs(e[3] - 0.5) < 1e-6
