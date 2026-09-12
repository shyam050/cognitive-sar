# A search region (grid partition of the global map). Regions with
# has_frontier=true are actionable exploration targets.
uint32 id
geometry_msgs/Point centroid
float32 size                    # number of frontier cells in the region
bool has_frontier
