"""Offline unit test for the multi-robot map fusion core (no ROS required).

Run:  python -m pytest sar_slam/test/test_merge.py -q
"""

import numpy as np

from sar_slam.merge_core import merge_maps


def _grid(size, res, ox, oy, occ):
    """Build a small known/occupied/unknown grid."""
    data = np.full((size, size), -1, dtype=np.int8)
    data[occ] = 100
    known_free = data == -1
    known_free[occ] = False
    data[known_free] = 0
    # mark a small known-free region
    data[1:4, 1:4] = 0
    return {"data": data, "origin": (ox, oy), "resolution": res}


def test_same_pose_union():
    a = _grid(10, 0.5, 0.0, 0.0, occ=(np.array([5, 5]), np.array([2, 7])))
    b = _grid(10, 0.5, 0.0, 0.0, occ=(np.array([6]), np.array([6])))
    out = merge_maps([a, b], [(0.0, 0.0, 0.0), (0.0, 0.0, 0.0)])
    assert out["data"].shape[0] >= 10
    # occupied cell from b must be occupied in the merge
    assert (out["data"] == 100).sum() >= 3


def test_offset_pose_alignment():
    """Robot B started 5 m east of A: its wall lands east of A's wall."""
    a = _grid(10, 0.5, 0.0, 0.0, occ=(np.array([5]), np.array([2])))
    b = _grid(10, 0.5, 0.0, 0.0, occ=(np.array([5]), np.array([2])))
    out = merge_maps([a, b], [(0.0, 0.0, 0.0), (5.0, 0.0, 0.0)])
    cols = np.argwhere(out["data"] == 100)[:, 1]
    assert cols.min() <= 3   # A's wall: local x=1.25 m -> col 2
    assert cols.max() >= 10  # B's wall: 5 m east of A's


def test_unknown_stays_unknown():
    a = _grid(8, 0.5, 0.0, 0.0, occ=(np.empty(0, int), np.empty(0, int)))
    out = merge_maps([a], [(0.0, 0.0, 0.0)])
    assert (out["data"] == -1).sum() > 0


def test_yaw_rotation():
    """Robot B started at origin with yaw=+90 deg.

    Its local wall at (r=5, c=2) is local (x=1.25, y=2.75); rotated +90 deg
    about the spawn: world = (-2.75, 1.25). Global bounds extend to x=-5
    (B's rotated extent), so the wall lands near col 4, row 2.
    """
    a = _grid(10, 0.5, 0.0, 0.0, occ=(np.empty(0, int), np.empty(0, int)))
    b = _grid(10, 0.5, 0.0, 0.0, occ=(np.array([5]), np.array([2])))
    out = merge_maps([a, b], [(0.0, 0.0, 0.0), (0.0, 0.0, np.pi / 2)])
    occ = np.argwhere(out["data"] == 100)
    assert len(occ) == 1
    r, c = occ[0]
    assert abs(r - 2) <= 1 and abs(c - 4) <= 1
