"""Rule-based allocation baseline (O5 comparator).

Greedy nearest-frontier: each robot that is idle (arrived, or its assigned
region lost its frontier) claims the nearest region with frontier cells that
no other robot currently holds. Publishes /robot_i/goal PoseStamped targets
consumed by Nav2.
"""

import math
import rclpy
from rclpy.node import Node
from geometry_msgs.msg import PoseStamped
from sar_msgs.msg import RegionArray
from tf2_ros import Buffer, TransformListener


class RuleAllocatorNode(Node):
    def __init__(self):
        super().__init__("rule_allocator")
        self.declare_parameter("robots", ["robot_1", "robot_2", "robot_3"])
        self.declare_parameter("goal_tolerance", 0.6)     # metres
        self.declare_parameter("decision_rate", 1.0)

        self.robots = list(self.get_parameter("robots").value)
        self.tf = Buffer()
        TransformListener(self.tf, self)
        self.regions = None
        self.assignment = {}      # robot -> region id
        self.goals = {}           # robot -> (x, y)

        self.create_subscription(RegionArray, "/regions", self._on_regions, 10)
        self.pubs = {r: self.create_publisher(PoseStamped, f"/{r}/goal", 10)
                     for r in self.robots}
        period = 1.0 / float(self.get_parameter("decision_rate").value)
        self.create_timer(period, self._decide)
        self.get_logger().info(f"rule allocator for {self.robots}")

    def _on_regions(self, msg):
        self.regions = msg

    def _pose(self, robot):
        try:
            t = self.tf.lookup_transform("map", f"{robot}_base_link",
                                         rclpy.time.Time())
            return (t.transform.translation.x, t.transform.translation.y)
        except Exception:  # noqa: BLE001 - tf not ready
            return None

    def _decide(self):
        if self.regions is None:
            return
        tol = float(self.get_parameter("goal_tolerance").value)
        claims = dict(self.assignment)

        for robot in self.robots:
            pos = self._pose(robot)
            if pos is None:
                continue
            assigned = claims.get(robot)
            reg = self._region(assigned)
            arrived = (robot in self.goals
                       and math.hypot(pos[0] - self.goals[robot][0],
                                      pos[1] - self.goals[robot][1]) < tol)
            stale = reg is None or not reg.has_frontier
            if assigned is not None and not arrived and not stale:
                continue  # keep working

            # pick nearest unclaimed region with frontier work
            best, best_cost = None, float("inf")
            for r in self.regions.regions:
                if not r.has_frontier or r.id in claims.values():
                    continue
                d = math.hypot(pos[0] - r.centroid.x, pos[1] - r.centroid.y)
                if d < best_cost:
                    best, best_cost = r, d
            if best is None:
                continue  # nothing left to claim
            claims[robot] = best.id
            self._send(robot, best)

        self.assignment = claims

    def _region(self, rid):
        if rid is None or self.regions is None:
            return None
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
        self.get_logger().info(f"{robot} -> region {region.id}")


def main(args=None):
    rclpy.init(args=args)
    node = RuleAllocatorNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()
