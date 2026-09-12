"""Broadcast odom -> base_link TF from the bridged Gazebo odometry.

Gazebo's DiffDrive system publishes an odometry topic but no ROS TF; slam_toolbox
and Nav2 both need the odom->base transform, so each robot runs one instance of
this node with its own frame names.
"""

import rclpy
from rclpy.node import Node
from nav_msgs.msg import Odometry
from tf2_ros import TransformBroadcaster
from geometry_msgs.msg import TransformStamped


class OdomTFNode(Node):
    def __init__(self):
        super().__init__("odom_tf")
        self.declare_parameter("robot", "robot_1")
        self.declare_parameter("odom_topic", "")
        robot = self.get_parameter("robot").value
        topic = self.get_parameter("odom_topic").value or f"/{robot}/odom"
        self.odom_frame = f"{robot}_odom"
        self.base_frame = f"{robot}_base_link"
        self.br = TransformBroadcaster(self)
        self.create_subscription(Odometry, topic, self._on_odom, 20)
        self.get_logger().info(f"odom_tf {self.odom_frame} -> {self.base_frame} on {topic}")

    def _on_odom(self, msg):
        t = TransformStamped()
        t.header.stamp = msg.header.stamp
        t.header.frame_id = self.odom_frame
        t.child_frame_id = self.base_frame
        t.transform.translation.x = msg.pose.pose.position.x
        t.transform.translation.y = msg.pose.pose.position.y
        t.transform.translation.z = 0.0
        t.transform.rotation = msg.pose.pose.orientation
        self.br.sendTransform(t)


def main(args=None):
    rclpy.init(args=args)
    node = OdomTFNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()
