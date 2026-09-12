"""Mission metrics node (O5).

Computes the six metrics from BUILD_PLAN section 6 live during a mission:
  coverage            - known cells / (known + unknown inside world bounds)
  victims_found       - semantic entries matching ground truth (1.5 m gate)
  detection_times     - sim time of each first detection
  overlap_ratio       - cells known by >1 robot / cells known by >=1
  mission_time        - since first merged map
RL training metrics (episodic reward, episodes-to-convergence) come from the
training run's metrics.csv (see scripts/plot_results.py).

Publishes MissionMetrics at 1 Hz and appends CSV rows every `log_period` s.
On shutdown writes a final row: output_dir/metrics_<stamp>.csv
"""

import os
import time as pytime

import numpy as np
import rclpy
import yaml
from rclpy.node import Node
from nav_msgs.msg import OccupancyGrid
from tf2_ros import Buffer, TransformListener
from sar_msgs.msg import MissionMetrics, SemanticMap, SemanticEntry


class EvalNode(Node):
    def __init__(self):
        super().__init__("eval")
        self.declare_parameter("robots", ["robot_1", "robot_2", "robot_3"])
        self.declare_parameter("ground_truth", "")
        self.declare_parameter("output_dir", os.path.expanduser("~/sar_results"))
        self.declare_parameter("log_period", 10.0)
        self.declare_parameter("world_size", 32.0)
        self.declare_parameter("detect_conf_min", 0.30)

        self.robots = list(self.get_parameter("robots").value)
        self.world = float(self.get_parameter("world_size").value)

        gt_path = self.get_parameter("ground_truth").value
        self.gt_victims = []
        if gt_path:
            with open(gt_path) as f:
                gt = yaml.safe_load(f)
            self.gt_victims = [tuple(v) for v in gt["victims"]]
            self.n_victims = gt["world"]["n_victims"]
        else:
            self.n_victims = 0

        self.tf = Buffer()
        TransformListener(self.tf, self)

        self.start = None
        self.grid = None
        self.detected = {}        # gt index -> first sim time
        self.robot_known = {r: None for r in self.robots}   # bool masks for overlap
        self.rows = []

        self.create_subscription(OccupancyGrid, "/map_merged", self._on_map, 10)
        self.create_subscription(SemanticMap, "/semantic_map", self._on_sem, 10)
        for i, r in enumerate(self.robots):
            self.create_subscription(OccupancyGrid, f"/{r}/map",
                                     (lambda m, idx=i: self._on_robot_map(m, idx)), 5)
        self.pub = self.create_publisher(MissionMetrics, "/mission_metrics", 10)
        period = float(self.get_parameter("log_period").value)
        self.create_timer(period, self._log_row)

        out = self.get_parameter("output_dir").value
        os.makedirs(out, exist_ok=True)
        self.csv = os.path.join(out, f"metrics_{pytime.strftime('%Y%m%d_%H%M%S')}.csv")
        with open(self.csv, "w") as f:
            f.write("t,coverage,victims_found,victims_total,overlap_ratio\n")
        self.get_logger().info(f"eval -> {self.csv} (gt: {gt_path or 'none'})")

    # ------------------------------------------------------------- callbacks
    def _on_map(self, msg):
        if self.start is None:
            self.start = self.get_clock().now()
        self.grid = msg

    def _on_robot_map(self, msg, idx):
        data = np.array(msg.data, dtype=np.int8).reshape(msg.info.height,
                                                         msg.info.width)
        self.robot_known[self.robots[idx]] = data != -1

    def _on_sem(self, msg):
        now = (self.get_clock().now() - self.start).nanosec / 1e9 \
            if self.start else 0.0
        conf_min = float(self.get_parameter("detect_conf_min").value)
        for e in msg.entries:
            if e.type != SemanticEntry.TYPE_VICTIM or e.confidence < conf_min:
                continue
            for i, (vx, vy) in enumerate(self.gt_victims):
                if i in self.detected:
                    continue
                if ((e.point.x - vx) ** 2 + (e.point.y - vy) ** 2) ** 0.5 <= 1.5:
                    self.detected[i] = now

    # ---------------------------------------------------------------- metrics
    def _coverage(self):
        if self.grid is None:
            return 0.0
        g = self.grid
        data = np.array(g.data, dtype=np.int8).reshape(g.info.height, g.info.width)
        res, ox, oy = g.info.resolution, g.info.origin.position.x, g.info.origin.position.y
        known = data != -1
        # unknown cells inside the world footprint
        rr, cc = np.nonzero(data == -1)
        wx = ox + (cc + 0.5) * res
        wy = oy + (rr + 0.5) * res
        inside = (wx >= 0) & (wx <= self.world) & (wy >= 0) & (wy <= self.world)
        return float(known.sum() / (known.sum() + inside.sum()))

    def _overlap(self):
        masks = [m for m in self.robot_known.values() if m is not None]
        if not masks:
            return 0.0
        shape = masks[0].shape
        for m in masks:
            if m.shape != shape:   # robot maps may have different extents
                return 0.0
        stack = np.stack(masks)
        anyk = stack.any(axis=0).sum()
        multi = (stack.sum(axis=0) >= 2).sum()
        return float(multi / max(anyk, 1))

    def _metrics(self):
        now = (self.get_clock().now() - self.start).nanosec / 1e9 if self.start else 0.0
        return {
            "t": round(now, 1),
            "coverage": self._coverage(),
            "victims_found": len(self.detected),
            "victims_total": self.n_victims,
            "overlap_ratio": self._overlap(),
        }

    def _log_row(self):
        m = self._metrics()
        self.rows.append(m)
        with open(self.csv, "a") as f:
            f.write(f"{m['t']},{m['coverage']:.4f},{m['victims_found']},"
                    f"{m['victims_total']},{m['overlap_ratio']:.4f}\n")
        out = MissionMetrics()
        out.header.stamp = self.get_clock().now().to_msg()
        out.coverage = m["coverage"]
        out.victims_found = m["victims_found"]
        out.victims_total = m["victims_total"]
        out.detection_times = [self.detected[i] for i in sorted(self.detected)]
        out.overlap_ratio = m["overlap_ratio"]
        out.mission_time = m["t"]
        self.pub.publish(out)


def main(args=None):
    rclpy.init(args=args)
    node = EvalNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()
