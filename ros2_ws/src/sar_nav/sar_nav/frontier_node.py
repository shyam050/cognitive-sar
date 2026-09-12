"""Frontier extraction and region partitioning on the merged global map.

Frontier definition matches the training environment exactly:
    free (occupancy 0) cell with a 4-neighbour that is unknown (-1).

The map extent is partitioned into `region_grid` (default 4x4 = 16) regions —
the same discrete action space the MAPPO policy was trained on. Each region
becomes a Region message with the centroid of its frontier cells.
"""

import numpy as np
import rclpy
from rclpy.node import Node
from nav_msgs.msg import OccupancyGrid
from geometry_msgs.msg import Point
from visualization_msgs.msg import Marker, MarkerArray
from sar_msgs.msg import Region, RegionArray


class FrontierNode(Node):
    def __init__(self):
        super().__init__("frontier")
        self.declare_parameter("region_grid", [4, 4])
        self.declare_parameter("publish_rate", 1.0)
        self.pub = self.create_publisher(RegionArray, "/regions", 10)
        self.pub_mk = self.create_publisher(MarkerArray, "/regions/markers", 10)
        self.create_subscription(OccupancyGrid, "/map_merged", self._on_map, 10)
        period = 1.0 / float(self.get_parameter("publish_rate").value)
        self.create_timer(period, self._publish)
        self.latest = None
        self.get_logger().info("frontier node up")

    def _on_map(self, msg):
        self.latest = msg

    def _publish(self):
        if self.latest is None:
            return
        g = self.latest
        grid = np.array(g.data, dtype=np.int8).reshape(g.info.height, g.info.width)
        res, ox, oy = g.info.resolution, g.info.origin.position.x, g.info.origin.position.y

        free = grid == 0
        unknown = grid == -1
        nb_unknown = np.zeros_like(unknown)
        nb_unknown[1:, :] |= unknown[:-1, :]
        nb_unknown[:-1, :] |= unknown[1:, :]
        nb_unknown[:, 1:] |= unknown[:, :-1]
        nb_unknown[:, :-1] |= unknown[:, 1:]
        frontier = free & nb_unknown

        ry, rx = [int(v) for v in self.get_parameter("region_grid").value]
        h, w = grid.shape
        rh, rw = max(1, h // ry), max(1, w // rx)

        regions = RegionArray()
        regions.header.stamp = self.get_clock().now().to_msg()
        regions.header.frame_id = g.header.frame_id or "map"
        markers = MarkerArray()
        for rid in range(rx * ry):
            r0, r1 = (rid // rx) * rh, min(h, (rid // rx + 1) * rh)
            c0, c1 = (rid % rx) * rw, min(w, (rid % rx + 1) * rw)
            cells = np.argwhere(frontier[r0:r1, c0:c1])
            reg = Region()
            reg.id = rid
            if len(cells):
                rows, cols = cells[:, 0] + r0, cells[:, 1] + c0
                reg.centroid = Point(
                    x=float(ox + (cols.mean() + 0.5) * res),
                    y=float(oy + (rows.mean() + 0.5) * res), z=0.0)
                reg.size = float(len(cells))
                reg.has_frontier = True
            else:
                reg.centroid = Point(x=float(ox + ((rid % rx) + 0.5) * rw * res),
                                     y=float(oy + ((rid // rx) + 0.5) * rh * res), z=0.0)
                reg.size = 0.0
                reg.has_frontier = False
            regions.regions.append(reg)
            if reg.has_frontier:
                m = Marker()
                m.header = regions.header
                m.id = rid
                m.type = Marker.CUBE
                m.action = Marker.ADD
                m.pose.position = reg.centroid
                m.pose.orientation.w = 1.0
                s = max(0.3, min(reg.size / 50.0, 1.2))
                m.scale.x = m.scale.y = m.scale.z = s
                m.color.r, m.color.g, m.color.b, m.color.a = 0.1, 0.7, 1.0, 0.6
                markers.markers.append(m)
        self.pub.publish(regions)
        self.pub_mk.publish(markers)


def main(args=None):
    rclpy.init(args=args)
    node = FrontierNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()
