"""MAPPO allocation runtime node (O4) - decentralized execution half of CTDE.

Builds the SAME observations the policy was trained on (via obs_contract.py,
the frozen training<->deployment interface) and runs sequential region
selection: robots pick one at a time, each seeing the regions chosen before it
in this decision cycle (mirrors training/mappo/algo.py::sequential_select).

Inputs: /map_merged, /regions, /semantic_map, TF map-><robot>_base_link.
Publishes /robot_i/goal region targets that Nav2 executes.
"""

import math

import numpy as np
import rclpy
from rclpy.node import Node
from geometry_msgs.msg import PoseStamped
from nav_msgs.msg import OccupancyGrid
from sar_msgs.msg import RegionArray, SemanticMap, SemanticEntry
from tf2_ros import Buffer, TransformListener

from .obs_contract import (build_actor, downsample_to_grid, crop,
                           base_extras, sequential_select, pose_to_cell)

try:
    import torch
except ImportError:  # noqa: BLE001
    torch = None


class RLAllocatorNode(Node):
    def __init__(self):
        super().__init__("rl_allocator")
        self.declare_parameter("robots", ["robot_1", "robot_2", "robot_3"])
        self.declare_parameter("checkpoint", "")
        self.declare_parameter("decision_rate", 1.0)
        self.declare_parameter("goal_tolerance", 0.8)
        self.declare_parameter("sample_actions", False)   # argmax by default;
        # the v6 policy was trained under masking + sequential selection, so the
        # deterministic mode is now stable (verify with evaluate.py --deterministic 1)
        self.declare_parameter("map_grid_size", 64)
        self.declare_parameter("world_size", 32.0)      # metres, ground truth
        self.declare_parameter("mission_timeout", 600.0)

        self.robots = list(self.get_parameter("robots").value)
        self.S = int(self.get_parameter("map_grid_size").value)
        self.world = float(self.get_parameter("world_size").value)
        self.t0 = self.get_clock().now()

        ckpt_path = self.get_parameter("checkpoint").value
        if not ckpt_path:
            raise RuntimeError("parameter 'checkpoint' is required (path to a "
                               "training/runs/<run>/checkpoint_*.pt)")
        if torch is None:
            raise RuntimeError(
                "PyTorch is not installed in this environment. Install it "
                "inside WSL: pip install torch (see README section 5)")
        ckpt = torch.load(ckpt_path, map_location="cpu", weights_only=False)
        env_cfg = ckpt["env_cfg"]
        self.crop_size = env_cfg.crop_size
        self.n_victims = env_cfg.n_victims
        self.n_actions = env_cfg.region_grid[0] * env_cfg.region_grid[1]
        self.actor = build_actor({"crop_size": self.crop_size,
                                  "n_actions": self.n_actions,
                                  "extras_dim": 4 + 3 * self.n_actions})
        self.actor.load_state_dict(ckpt["actor"])
        self.actor.eval()
        self.get_logger().info(f"loaded policy {ckpt_path} "
                               f"({self.n_actions} region actions, "
                               f"sequential selection)")

        self.tf = Buffer()
        TransformListener(self.tf, self)
        self.grid = None          # merged OccupancyGrid
        self.regions = None
        self.victim_count = 0
        self.assignment = {}      # robot -> action (own-prev one-hot source)
        self.goals = {}

        self.create_subscription(OccupancyGrid, "/map_merged", self._on_map, 10)
        self.create_subscription(RegionArray, "/regions", self._on_regions, 10)
        self.create_subscription(SemanticMap, "/semantic_map", self._on_sem, 10)
        self.pubs = {r: self.create_publisher(PoseStamped, f"/{r}/goal", 10)
                     for r in self.robots}
        period = 1.0 / float(self.get_parameter("decision_rate").value)
        self.create_timer(period, self._decide)

    # ------------------------------------------------------------- callbacks
    def _on_map(self, msg):
        self.grid = msg

    def _on_regions(self, msg):
        self.regions = msg

    def _on_sem(self, msg):
        self.victim_count = sum(1 for e in msg.entries
                                if e.type == SemanticEntry.TYPE_VICTIM)

    # ---------------------------------------------------------------- policy
    def _decide(self):
        if self.grid is None or self.regions is None:
            return
        g = self.grid
        data = np.array(g.data, dtype=np.int8).reshape(g.info.height, g.info.width)
        wall, explored, frontier = downsample_to_grid(
            data, g.info.resolution, g.info.origin.position.x,
            g.info.origin.position.y, self.S, self.world)

        region_sizes = [float(r.size) for r in self.regions.regions]
        mask = np.array([1.0 if r.has_frontier and r.size > 0 else 0.0
                         for r in self.regions.regions], dtype=np.float32)
        if mask.sum() == 0:
            return  # nothing actionable anywhere; keep current goals

        tol = float(self.get_parameter("goal_tolerance").value)
        steps_frac = min((self.get_clock().now() - self.t0).nanosec / 1e9
                         / float(self.get_parameter("mission_timeout").value), 1.0)

        crops, extras, cells = [], [], {}
        for robot in self.robots:
            try:
                t = self.tf.lookup_transform("map", f"{robot}_base_link",
                                             rclpy.time.Time())
            except Exception:  # noqa: BLE001 - tf not ready yet
                # robot without TF keeps its previous assignment in the
                # sequential pass via the own-prev one-hot slot
                cells[robot] = None
                crops.append(None)
                extras.append(None)
                continue
            x, y = t.transform.translation.x, t.transform.translation.y
            r, c = pose_to_cell(x, y, self.S, self.world)
            crop_t = np.stack([crop(wall, r, c, self.crop_size, self.S),
                               crop(explored, r, c, self.crop_size, self.S),
                               crop(frontier, r, c, self.crop_size, self.S)])
            ex = base_extras(r, c,
                             self.victim_count / max(self.n_victims, 1),
                             steps_frac, region_sizes)
            prev = self.assignment.get(robot)
            if prev is not None:
                ex[4 + 2 * self.n_actions + prev] = 1.0   # own previous region
            crops.append(crop_t)
            extras.append(ex)
            cells[robot] = (x, y)

        actable = [i for i, c in enumerate(crops) if c is not None]
        if not actable:
            return

        actions, _ = sequential_select(
            self.actor, [crops[i] for i in actable],
            [extras[i] for i in actable], self.n_actions, mask=mask,
            deterministic=not bool(self.get_parameter("sample_actions").value))

        claims = dict(self.assignment)
        for k, i in enumerate(actable):
            robot = self.robots[i]
            a = actions[k]
            arrived = (robot in self.goals and cells[robot] is not None
                       and math.hypot(cells[robot][0] - self.goals[robot][0],
                                      cells[robot][1] - self.goals[robot][1]) < tol)
            changed = claims.get(robot) != a
            if not changed and not arrived:
                continue
            reg = self._region(a)
            if reg is None or not reg.has_frontier:
                continue  # nothing actionable there; keep the current goal
            claims[robot] = a
            self._send(robot, reg)

        self.assignment = claims

    def _region(self, rid):
        for r in self.regions.regions:
            if r.id == rid:
                return r
        return None

    def _send(self, robot, region):
        g = PoseStamped()
        g.header.stamp = self.get_clock().now().to_msg()
        g.header.frame_id = "map"
        g.pose.position.x = region.centroid.x
        g.pose.position.y = region.centroid.y
        g.pose.orientation.w = 1.0
        self.pubs[robot].publish(g)
        self.goals[robot] = (region.centroid.x, region.centroid.y)
        self.get_logger().info(f"{robot} -> region {region.id} "
                               f"(frontier size {region.size:.0f})")


def main(args=None):
    rclpy.init(args=args)
    node = RLAllocatorNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()
