"""Shared semantic memory node (O3) - the robots' cognitive map.

Collects SemanticEntry detections from every robot, deduplicates
(same type within `dedup_radius` metres -> same element, first detection time
preserved), assigns stable ids and publishes the SemanticMap at a fixed rate.
Also serves QuerySemanticMap and RViz MarkerArray visualization.
"""

from collections import defaultdict

import rclpy
from rclpy.node import Node

from sar_msgs.msg import SemanticEntry, SemanticMap
from sar_msgs.srv import QuerySemanticMap
from geometry_msgs.msg import Point
from visualization_msgs.msg import Marker, MarkerArray


class SemanticMemoryNode(Node):
    def __init__(self):
        super().__init__("semantic_memory")
        self.declare_parameter("dedup_radius", 1.0)      # metres
        self.declare_parameter("publish_rate", 2.0)
        self.declare_parameter("map_frame", "map")

        self.entries = {}                                # id -> dict
        self.next_id = 1
        self.spatial = defaultdict(list)                 # coarse cell -> [ids]

        self.create_subscription(SemanticEntry, "/detections", self._on_detection, 50)
        self.pub_map = self.create_publisher(SemanticMap, "/semantic_map", 10)
        self.pub_mk = self.create_publisher(MarkerArray, "/semantic_map/markers", 10)
        self.create_service(QuerySemanticMap, "/query_semantic_map", self._on_query)
        rate = float(self.get_parameter("publish_rate").value)
        self.create_timer(1.0 / rate, self._publish)
        self.get_logger().info("semantic memory up")

    # ------------------------------------------------------------- ingestion
    def _on_detection(self, msg):
        r = float(self.get_parameter("dedup_radius").value)
        cell = (int(msg.point.x // (2 * r)), int(msg.point.y // (2 * r)))
        for dcx in (-1, 0, 1):
            for dcy in (-1, 0, 1):
                for eid in self.spatial.get((cell[0] + dcx, cell[1] + dcy), []):
                    e = self.entries[eid]
                    if (e["type"] == msg.type
                            and _dist(e["point"], msg.point) <= r):
                        # merge: keep first detection, best confidence, newest stamp
                        e["last_updated"] = msg.last_updated
                        e["confidence"] = max(e["confidence"], msg.confidence)
                        e["sources"].add(msg.source_robot)
                        return
        # new element
        eid = self.next_id
        self.next_id += 1
        self.entries[eid] = {
            "id": eid, "type": msg.type, "point": msg.point,
            "first_detected": msg.first_detected, "last_updated": msg.last_updated,
            "confidence": msg.confidence, "sources": {msg.source_robot},
        }
        self.spatial[cell].append(eid)

    # ------------------------------------------------------------- publishing
    def _publish(self):
        now = self.get_clock().now().to_msg()
        sm = SemanticMap()
        sm.header.stamp = now
        sm.header.frame_id = self.get_parameter("map_frame").value
        markers = MarkerArray()
        for e in self.entries.values():
            ent = SemanticEntry()
            ent.id = e["id"]
            ent.type = e["type"]
            ent.point = e["point"]
            ent.first_detected = e["first_detected"]
            ent.last_updated = e["last_updated"]
            ent.confidence = e["confidence"]
            ent.source_robot = ",".join(sorted(e["sources"]))
            sm.entries.append(ent)
            markers.markers.append(self._marker(e, now))
        self.pub_map.publish(sm)
        self.pub_mk.publish(markers)

    def _marker(self, e, now):
        m = Marker()
        m.header.frame_id = self.get_parameter("map_frame").value
        m.header.stamp = now
        m.id = e["id"]
        m.type = Marker.SPHERE
        m.action = Marker.ADD
        m.pose.position = Point(x=e["point"].x, y=e["point"].y, z=0.4)
        m.pose.orientation.w = 1.0
        scale = 0.6 if e["type"] == SemanticEntry.TYPE_VICTIM else 0.4
        m.scale.x = m.scale.y = m.scale.z = scale
        if e["type"] == SemanticEntry.TYPE_VICTIM:
            m.color.r, m.color.g, m.color.b, m.color.a = 1.0, 0.3, 0.0, 0.9
        else:
            m.color.r, m.color.g, m.color.b, m.color.a = 0.9, 0.05, 0.05, 0.8
        m.lifetime.sec = 0
        return m

    def _on_query(self, request, response):
        response.map.header.stamp = self.get_clock().now().to_msg()
        response.map.header.frame_id = self.get_parameter("map_frame").value
        for e in self.entries.values():
            ent = SemanticEntry()
            ent.id = e["id"]
            ent.type = e["type"]
            ent.point = e["point"]
            ent.first_detected = e["first_detected"]
            ent.last_updated = e["last_updated"]
            ent.confidence = e["confidence"]
            ent.source_robot = ",".join(sorted(e["sources"]))
            response.map.entries.append(ent)
        return response


def _dist(a, b):
    return ((a.x - b.x) ** 2 + (a.y - b.y) ** 2) ** 0.5


def main(args=None):
    rclpy.init(args=args)
    node = SemanticMemoryNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()
