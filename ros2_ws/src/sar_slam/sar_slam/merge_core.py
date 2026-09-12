"""Pure-numpy multi-robot occupancy-grid fusion (no ROS imports).

Used by sar_slam.map_merge_node and unit-tested offline (tests/test_merge.py).

Merge rule per global cell:
  unknown if no robot knows it; occupied (100) wins over free; otherwise the
  known value. This is adequate for known-start multi-robot SLAM where local
  grids are consistent up to the fixed spawn transform.
"""

import numpy as np


def merge_maps(robot_maps, spawn_poses):
    """Fuse per-robot OccupancyGrid payloads into one global grid.

    robot_maps : list of dicts {data (H,W) int8 in {-1,0..100}, origin (x,y),
                 resolution}
    spawn_poses: list of (x, y, yaw) per robot, pose of the robot map origin's
                 WORLD->ROBOT transform (i.e. where the robot started in map).

    NOTE: slam_toolbox local grids have origin at the robot's initial pose with
    identity rotation, so `local grid cell -> world` is:
        world = R(yaw) @ ((origin_local) + cell*res) + (spawn_x, spawn_y)
    where origin_local is the local grid origin (typically ~0 or small).

    Returns dict {data, origin, resolution, width, height}.
    """
    assert len(robot_maps) == len(spawn_poses)
    res = robot_maps[0]["resolution"]
    for m in robot_maps:
        assert abs(m["resolution"] - res) < 1e-6, "grid resolutions differ"

    # global bounds from transformed corners of every local grid
    corners_world = []
    for m, (sx, sy, yaw) in zip(robot_maps, spawn_poses):
        h, w = m["data"].shape
        ox, oy = m["origin"]
        for lx, ly in ((ox, oy), (ox + w * res, oy),
                       (ox, oy + h * res), (ox + w * res, oy + h * res)):
            wx = np.cos(yaw) * lx - np.sin(yaw) * ly + sx
            wy = np.sin(yaw) * lx + np.cos(yaw) * ly + sy
            corners_world.append((wx, wy))
    cmin_x = min(c[0] for c in corners_world)
    cmin_y = min(c[1] for c in corners_world)
    cmax_x = max(c[0] for c in corners_world)
    cmax_y = max(c[1] for c in corners_world)

    gw = int(np.ceil((cmax_x - cmin_x) / res)) + 1
    gh = int(np.ceil((cmax_y - cmin_y) / res)) + 1
    glob = np.full((gh, gw), -1, dtype=np.int8)

    for m, (sx, sy, yaw) in zip(robot_maps, spawn_poses):
        data = m["data"]
        h, w = data.shape
        ox, oy = m["origin"]
        known = data != -1
        rr, cc = np.nonzero(known)
        lx = ox + (cc + 0.5) * res
        ly = oy + (rr + 0.5) * res
        wx = np.cos(yaw) * lx - np.sin(yaw) * ly + sx
        wy = np.sin(yaw) * lx + np.cos(yaw) * ly + sy
        gc = ((wx - cmin_x) / res).astype(int)
        gr = ((wy - cmin_y) / res).astype(int)
        ok = (gr >= 0) & (gr < gh) & (gc >= 0) & (gc < gw)
        vals = data[rr, cc]
        target = glob[gr[ok], gc[ok]]
        newval = np.where(target == -1, vals[ok], np.maximum(target, vals[ok]))
        glob[gr[ok], gc[ok]] = newval

    return {"data": glob, "origin": (float(cmin_x), float(cmin_y)),
            "resolution": res, "width": gw, "height": gh}
