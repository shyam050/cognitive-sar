"""Generate the Gazebo SAR world + ground truth from the training maze code.

The wall layout, robot spawn points and victim positions come from the SAME
generator used by the RL environment (training/sar_gym), so the simulated
world is consistent with what the policy was trained on.

Usage (repo root or anywhere):
    python scripts/gen_world.py [--seed 0] [--rooms 9]

Outputs:
    ros2_ws/src/sar_worlds/worlds/sar_world.sdf
    ros2_ws/src/sar_eval/config/ground_truth.yaml
"""

import argparse
import os
import sys
from dataclasses import replace

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(REPO, "training"))

from config import ENV                          # noqa: E402
from sar_gym.world import GridWorld             # noqa: E402

CELL = ENV.cell_size                            # 0.5 m
SIZE = ENV.map_size                             # 64 cells -> 32 m
WORLD_SIZE = SIZE * CELL


def mesh_walls(walls):
    """Greedy-mesh wall cells into maximal rectangles [(r0,c0,r1,c1)]."""
    visited = [[False] * SIZE for _ in range(SIZE)]
    rects = []
    for r in range(SIZE):
        for c in range(SIZE):
            if not walls[r, c] or visited[r][c]:
                continue
            c2 = c
            while c2 + 1 < SIZE and walls[r, c2 + 1] and not visited[r][c2 + 1]:
                c2 += 1
            r2 = r
            while r2 + 1 < SIZE and all(
                    walls[r2 + 1, cc] and not visited[r2 + 1][cc]
                    for cc in range(c, c2 + 1)):
                r2 += 1
            for rr in range(r, r2 + 1):
                for cc in range(c, c2 + 1):
                    visited[rr][cc] = True
            rects.append((r, c, r2, c2))
    return rects


def cell_to_xy(r, c):
    return (c + 0.5) * CELL, (r + 0.5) * CELL


def rect_center(r0, c0, r1, c1):
    return ((c0 + c1 + 1) / 2.0 * CELL, (r0 + r1 + 1) / 2.0 * CELL)


def box_link(name, x, y, sx, sy, z=1.0, color=None):
    material = ""
    if color:
        material = f"""
        <visual name="vis">
          <geometry><box><size>{sx} {sy} {2 * z}</size></box></geometry>
          <material>
            <ambient>{color}</ambient>
            <diffuse>{color}</diffuse>
          </material>
        </visual>"""
    return f"""
    <link name="{name}">
      <pose>{x:.3f} {y:.3f} {z} 0 0 0</pose>
      <collision name="col">
        <geometry><box><size>{sx} {sy} {2 * z}</size></box></geometry>
      </collision>{material}
    </link>"""


def victim_model(x, y):
    return f"""
  <model name="victim_{x:.1f}_{y:.1f}">
    <pose>{x:.3f} {y:.3f} 0 0 0 0</pose>
    <static>true</static>
    <link name="torso">
      <pose>0 0 0.45 0 0 0</pose>
      <collision name="col">
        <geometry><cylinder><radius>0.16</radius><length>0.75</length></cylinder></geometry>
      </collision>
      <visual name="vis">
        <geometry><cylinder><radius>0.16</radius><length>0.75</length></cylinder></geometry>
        <material><ambient>1.0 0.30 0.02 1</ambient><diffuse>1.0 0.30 0.02 1</diffuse></material>
      </visual>
    </link>
    <link name="head">
      <pose>0 0 0.98 0 0 0</pose>
      <collision name="col">
        <geometry><sphere><radius>0.13</radius></sphere></geometry>
      </collision>
      <visual name="vis">
        <geometry><sphere><radius>0.13</radius></sphere></geometry>
        <material><ambient>1.0 0.45 0.10 1</ambient><diffuse>1.0 0.45 0.10 1</diffuse></material>
      </visual>
    </link>
  </model>"""


def hazard_model(x, y):
    return f"""
  <model name="hazard_{x:.1f}_{y:.1f}">
    <pose>{x:.3f} {y:.3f} 0.3 0 0 0</pose>
    <static>true</static>
    <link name="barrel">
      <collision name="col">
        <geometry><cylinder><radius>0.25</radius><length>0.6</length></cylinder></geometry>
      </collision>
      <visual name="vis">
        <geometry><cylinder><radius>0.25</radius><length>0.6</length></cylinder></geometry>
        <material><ambient>0.9 0.02 0.02 1</ambient><diffuse>0.9 0.02 0.02 1</diffuse></material>
      </visual>
    </link>
  </model>"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--rooms", type=int, default=ENV.n_rooms)
    ap.add_argument("--n-robots", type=int, default=ENV.n_robots)
    ap.add_argument("--hazards", type=int, default=3)
    args = ap.parse_args()

    cfg = replace(ENV, n_rooms=args.rooms, n_robots=args.n_robots)
    world = GridWorld(cfg, args.seed)

    walls_sdf, links = [], []
    for i, (r0, c0, r1, c1) in enumerate(mesh_walls(world.walls)):
        x, y = rect_center(r0, c0, r1, c1)
        sx = (c1 - c0 + 1) * CELL
        sy = (r1 - r0 + 1) * CELL
        links.append(box_link(f"wall_{i}", x, y, sx, sy, z=1.0, color="0.35 0.35 0.38 1"))

    victim_xy = [cell_to_xy(*c) for c in world.victim_cells]
    spawns = [cell_to_xy(*s) for s in world.robot_starts]

    sdf = f"""<?xml version="1.0"?>
<sdf version="1.8">
  <world name="sar_world">
    <physics name="1ms" type="ignored">
      <max_step_size>0.002</max_step_size>
      <real_time_factor>1.0</real_time_factor>
    </physics>
    <plugin name="gz::sim::systems::Physics" filename="gz-sim-physics-system"/>
    <plugin name="gz::sim::systems::UserCommands" filename="gz-sim-user-commands-system"/>
    <plugin name="gz::sim::systems::SceneBroadcaster" filename="gz-sim-scene-broadcaster-system"/>
    <plugin name="gz::sim::systems::Contact" filename="gz-sim-contact-system"/>

    <scene><ambient>0.7 0.7 0.7 1</ambient><background>0.55 0.6 0.65 1</background></scene>

    <light type="directional" name="sun">
      <cast_shadows>true</cast_shadows>
      <pose>0 0 10 0 0 0</pose>
      <diffuse>0.9 0.9 0.9 1</diffuse>
      <specular>0.2 0.2 0.2 1</specular>
      <direction>-0.4 0.3 -1</direction>
    </light>

    <model name="ground_plane">
      <static>true</static>
      <link name="link">
        <collision name="col"><geometry><plane><normal>0 0 1</normal><size>{WORLD_SIZE + 20} {WORLD_SIZE + 20}</size></plane></geometry></collision>
        <visual name="vis">
          <geometry><plane><normal>0 0 1</normal><size>{WORLD_SIZE + 20} {WORLD_SIZE + 20}</size></plane></geometry>
          <material><ambient>0.55 0.52 0.48 1</ambient><diffuse>0.55 0.52 0.48 1</diffuse></material>
        </visual>
      </link>
    </model>

    <model name="walls">
      <static>true</static>{''.join(links)}
    </model>
{chr(10).join(victim_model(x, y) for x, y in victim_xy)}
{{HAZARDS}}
  </world>
</sdf>
"""

    # place hazards in free cells far from victims/spawns
    import numpy as np
    free = np.argwhere(~world.walls)
    rng = np.random.default_rng(args.seed + 7)
    hazards = []
    for r, c in rng.permutation(free)[:200]:
        x, y = cell_to_xy(int(r), int(c))
        if all((x - vx) ** 2 + (y - vy) ** 2 > 16 for vx, vy in victim_xy + spawns):
            hazards.append((x, y))
        if len(hazards) >= args.hazards:
            break
    sdf = sdf.replace("{HAZARDS}", "\n".join(hazard_model(x, y) for x, y in hazards))

    ws_dir = os.path.join(REPO, "ros2_ws", "src")
    os.makedirs(os.path.join(ws_dir, "sar_worlds", "worlds"), exist_ok=True)
    os.makedirs(os.path.join(ws_dir, "sar_eval", "config"), exist_ok=True)
    with open(os.path.join(ws_dir, "sar_worlds", "worlds", "sar_world.sdf"), "w") as f:
        f.write(sdf)

    free_cells = int((~world.walls).sum())
    yaml = (f"# Auto-generated by scripts/gen_world.py --seed {args.seed}. Do not edit.\n"
            "world:\n"
            f"  size_m: {WORLD_SIZE}\n"
            f"  cell_m: {CELL}\n"
            f"  free_cells: {free_cells}\n"
            f"  n_victims: {len(victim_xy)}\n"
            "victims:  # [x_m, y_m] in the map frame\n"
            + "".join(f"  - [{x:.3f}, {y:.3f}]\n" for x, y in victim_xy)
            + "robot_spawns:  # [x_m, y_m, yaw]\n"
            + "".join(f"  - [{x:.3f}, {y:.3f}, 0.0]\n" for x, y in spawns))
    with open(os.path.join(ws_dir, "sar_eval", "config", "ground_truth.yaml"), "w") as f:
        f.write(yaml)

    print(f"world: {WORLD_SIZE} m x {WORLD_SIZE} m, {len(links)} wall boxes, "
          f"{len(victim_xy)} victims, {len(hazards)} hazards, {free_cells} free cells")
    print(f"spawns: {[f'({x:.1f},{y:.1f})' for x, y in spawns]}")
    print(f"victims: {[f'({x:.1f},{y:.1f})' for x, y in victim_xy]}")


if __name__ == "__main__":
    main()
