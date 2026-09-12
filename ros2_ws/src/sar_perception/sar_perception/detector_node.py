"""Victim / hazard detection node (O2).

Pipeline per camera frame:
  1. detect pixel blobs  -> YOLO (ultralytics) if available, else HSV orange
     mask + connected components (tuned for the bright victim models)
  2. pixel -> bearing    -> pinhole model from camera_info
  3. bearing -> range    -> nearest valid LaserScan return at that angle
  4. base -> map         -> TF lookup (map -> <robot>_base_link)
  5. publish SemanticEntry on /detections (sar_memory assigns ids, dedupes)

Runs one instance per robot; `robot` parameter distinguishes them.
"""

import math

import cv2
import numpy as np
import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, ReliabilityPolicy
from sensor_msgs.msg import Image, CameraInfo, LaserScan
from cv_bridge import CvBridge
from tf2_ros import Buffer, TransformListener
from geometry_msgs.msg import Point

try:
    from sar_msgs.msg import SemanticEntry
except ImportError:  # allows py_compile / docs builds outside a sourced ws
    SemanticEntry = None


def pixel_bearing(u, v, cx, cy, fx, fy):
    """Bearing angle (rad) right-of-forward in the optical horizontal plane."""
    return math.atan2((u - cx) / fx, 1.0), (v - cy) / fy


class DetectorNode(Node):
    def __init__(self):
        super().__init__("detector")
        self.declare_parameter("robot", "robot_1")
        self.declare_parameter("image_topic", "/robot_1/image_raw")
        self.declare_parameter("scan_topic", "/robot_1/scan")
        self.declare_parameter("base_frame", "robot_1_base_link")
        self.declare_parameter("map_frame", "map")
        self.declare_parameter("detections_topic", "/detections")
        self.declare_parameter("model_type", "color")   # "color" | "yolo"
        self.declare_parameter("yolo_weights", "yolov8n.pt")
        self.declare_parameter("yolo_conf", 0.35)
        self.declare_parameter("min_blob_area", 60)     # px at 640x480
        self.declare_parameter("max_detection_range", 5.0)

        self.robot = self.get_parameter("robot").value
        self.base_frame = self.get_parameter("base_frame").value
        self.map_frame = self.get_parameter("map_frame").value

        self.bridge = CvBridge()
        self.tf = Buffer()
        TransformListener(self.tf, self)
        self.cam = None     # CameraInfo cache
        self.scan = None    # latest LaserScan

        qos = QoSProfile(depth=5, reliability=ReliabilityPolicy.BEST_EFFORT)
        self.create_subscription(Image, self.get_parameter("image_topic").value,
                                 self._on_image, qos)
        self.create_subscription(CameraInfo, self.get_parameter("image_topic").value
                                 .replace("image_raw", "camera_info"), self._on_info, qos)
        self.create_subscription(LaserScan, self.get_parameter("scan_topic").value,
                                 self._on_scan, qos)
        self.pub = self.create_publisher(SemanticEntry,
                                         self.get_parameter("detections_topic").value, 10)

        self.yolo = None
        if self.get_parameter("model_type").value == "yolo":
            try:
                from ultralytics import YOLO
                self.yolo = YOLO(self.get_parameter("yolo_weights").value)
                self.get_logger().info("YOLO loaded")
            except Exception as e:  # noqa: BLE001 - degrade to color detector
                self.get_logger().warn(f"YOLO unavailable ({e}); using color detector")

        self.get_logger().info(f"detector up for {self.robot} ({self.get_parameter('model_type').value})")

    # ------------------------------------------------------------- callbacks
    def _on_info(self, msg):
        if self.cam is None:
            self.cam = msg

    def _on_scan(self, msg):
        self.scan = msg

    def _on_image(self, msg):
        if self.cam is None:
            return
        frame = self.bridge.imgmsg_to_cv2(msg, "bgr8")
        h, w = frame.shape[:2]
        cx, cy = self.cam.k[2], self.cam.k[5]
        fx, fy = self.cam.k[0], self.cam.k[4]

        blobs = self._detect(frame)
        for (bx, by, area) in blobs:
            conf = min(0.55 + area / 8000.0, 0.95)
            alpha, _ = pixel_bearing(bx, by, cx, cy, fx, fy)
            beta = -alpha  # optical x-right -> base y-left
            rng = self._range_at(beta)
            if rng is None or rng > self.get_parameter("max_detection_range").value:
                continue
            self._publish(msg.header.stamp, beta, rng, conf)

    # -------------------------------------------------------------- detection
    def _detect(self, frame):
        if self.yolo is not None:
            res = self.yolo.predict(frame, verbose=False,
                                    conf=self.get_parameter("yolo_conf").value)[0]
            out = []
            for b in res.boxes:
                x1, y1, x2, y2 = [int(v) for v in b.xyxy[0]]
                out.append(((x1 + x2) // 2, (y1 + y2) // 2, (x2 - x1) * (y2 - y1)))
            return out
        # HSV orange blob detector (victim models are 1.0/0.30/0.02 orange)
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        mask = cv2.inRange(hsv, (5, 120, 80), (25, 255, 255))
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
        n, labels, stats, _ = cv2.connectedComponentsWithStats(mask)
        min_area = self.get_parameter("min_blob_area").value
        return [(stats[i, 0] + stats[i, 2] // 2, stats[i, 1] + stats[i, 3] // 2,
                 stats[i, cv2.CC_STAT_AREA])
                for i in range(1, n) if stats[i, cv2.CC_STAT_AREA] >= min_area]

    def _range_at(self, beta):
        """Nearest valid scan return within +/-2 degrees of bearing beta."""
        s = self.scan
        if s is None:
            return None
        idx = int(round((beta - s.angle_min) / s.angle_increment))
        best = None
        for di in range(-6, 7):  # +/- 2 deg at 1 deg resolution
            j = idx + di
            if 0 <= j < len(s.ranges):
                r = s.ranges[j]
                if s.range_min < r < s.range_max and (best is None or r < best):
                    best = r
        return best

    def _publish(self, stamp, beta, rng, conf):
        try:
            t = self.tf.lookup_transform(self.map_frame, self.base_frame,
                                         rclpy.time.Time())
        except Exception:  # noqa: BLE001 - tf not ready yet
            return
        tr = t.transform.translation
        rot = t.transform.rotation
        yaw = math.atan2(2.0 * (rot.w * rot.z + rot.x * rot.y),
                         1.0 - 2.0 * (rot.y * rot.y + rot.z * rot.z))
        px = tr.x + rng * math.cos(yaw + beta)
        py = tr.y + rng * math.sin(yaw + beta)

        e = SemanticEntry()
        e.first_detected = stamp
        e.last_updated = self.get_clock().now().to_msg()
        e.point = Point(x=float(px), y=float(py), z=0.0)
        e.confidence = float(conf)
        e.source_robot = self.robot
        e.id = 0  # assigned by sar_memory
        self.pub.publish(e)


def main(args=None):
    rclpy.init(args=args)
    node = DetectorNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()
