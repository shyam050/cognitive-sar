"""Multi-robot global map fusion node (O1).

Subscribes to each robot's local SLAM grid (/robot_i/map), fuses them with the
known spawn transforms and publishes the shared /map_merged grid that the
frontier extractor, allocators and evaluator build on.

This is the pre-approved fallback from BUILD_PLAN section 7: a custom fusion
node keyed on known start poses, used when multirobot_map_merge is not
available on the ROS distro.
"""

import rclpy
from rclpy.node import Node
from nav_msgs.msg import OccupancyGrid

from .merge_core import merge_maps


class MapMergeNode(Node):
    def __init__(self):
        super().__init__("map_merge")
        self.declare_parameter("robots", ["robot_1", "robot_2", "robot_3"])
        # flat list [x1, y1, yaw1, x2, y2, yaw2, ...] in the map frame
        self.declare_parameter("spawn_poses", [0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
                                               0.0, 0.0, 0.0])
        self.declare_parameter("publish_rate", 1.0)

        self.robots = list(self.get_parameter("robots").value)
        poses = list(self.get_parameter("spawn_poses").value)
        assert len(poses) == 3 * len(self.robots), \
            "spawn_poses must be x,y,yaw triplets, one per robot"
        self.spawn_poses = [tuple(poses[3 * i:3 * i + 3]) for i in range(len(self.robots))]

        self.latest = {}  # robot -> OccupancyGrid
        for i, r in enumerate(self.robots):
            self.create_subscription(OccupancyGrid, f"/{r}/map",
                                     (lambda msg, idx=i: self._on_map(msg, idx)), 10)
        self.pub = self.create_publisher(OccupancyGrid, "/map_merged", 10)
        period = 1.0 / float(self.get_parameter("publish_rate").value)
        self.create_timer(period, self._publish_merged)
        self.get_logger().info(f"map_merge: fusing {self.robots}")

    def _on_map(self, msg, idx):
        self.latest[idx] = msg

    def _publish_merged(self):
        if len(self.latest) < len(self.robots):
            return
        maps, poses = [], []
        for idx, msg in self.latest.items():
            data = np_from_grid(msg)
            maps.append({"data": data,
                         "origin": (msg.info.origin.position.x,
                                    msg.info.origin.position.y),
                         "resolution": msg.info.resolution})
            poses.append(self.spawn_poses[idx])
        merged = merge_maps(maps, poses)

        out = OccupancyGrid()
        out.header.stamp = self.get_clock().now().to_msg()
        out.header.frame_id = "map"
        out.info.resolution = merged["resolution"]
        out.info.width = merged["width"]
        out.info.height = merged["height"]
        out.info.origin.position.x = merged["origin"][0]
        out.info.origin.position.y = merged["origin"][1]
        out.info.origin.orientation.w = 1.0
        out.data = [int(v) for v in merged["data"].flatten()]
        self.pub.publish(out)


def np_from_grid(msg):
    import numpy as np
    w, h = msg.info.width, msg.info.height
    return np.array(msg.data, dtype=np.int8).reshape(h, w)


def main(args=None):
    rclpy.init(args=args)
    node = MapMergeNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()
