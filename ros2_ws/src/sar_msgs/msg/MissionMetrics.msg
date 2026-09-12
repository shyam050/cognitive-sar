# Live mission metrics (contract: sar_eval computes, README section 6 defines).
std_msgs/Header header
float32 coverage                # explored free fraction 0..1
uint32 victims_found
uint32 victims_total
float32[] detection_times       # sim time of each detection (seconds)
float32 overlap_ratio           # cells seen by >1 robot / cells seen
float32 mission_time            # seconds since mission start
