# One semantic element in the shared cognitive map.
# Contract #1 in docs/interfaces.md - keep in sync with the training stack.
uint8 TYPE_UNKNOWN=0
uint8 TYPE_VICTIM=1
uint8 TYPE_HAZARD=2

builtin_interfaces/Time first_detected   # sim time the element first entered the map
builtin_interfaces/Time last_updated
geometry_msgs/Point point                # position in the shared `map` frame
float32 confidence                       # 0..1
string source_robot                      # e.g. "robot_1"
uint32 id                                # stable id assigned by sar_memory
