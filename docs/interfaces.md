# Frozen interface contracts — training <-> deployment

Any change here must be applied on BOTH sides and re-validated with
`ros2_ws/src/sar_alloc_rl/test/test_obs_contract.py` before deploying a new
checkpoint. Update this file in the same PR.

## 1. Topics

| Topic | Type | Publisher → Consumer |
|---|---|---|
| `/robot_i/map` | `nav_msgs/OccupancyGrid` | slam_toolbox → map_merge |
| `/map_merged` | `nav_msgs/OccupancyGrid` | map_merge → frontier, allocators, eval |
| `/regions` | `sar_msgs/RegionArray` | frontier → allocators |
| `/detections` | `sar_msgs/SemanticEntry` | detectors → sar_memory |
| `/semantic_map` | `sar_msgs/SemanticMap` | sar_memory → allocators, eval, RViz |
| `/robot_i/goal` | `geometry_msgs/PoseStamped` (frame `map`) | allocators → Nav2 |
| `/mission_metrics` | `sar_msgs/MissionMetrics` | sar_eval → logging |

`Region.id` ∈ `[0, n_actions)` is the RL action space index (default 16 = 4×4
partition of the 32 m × 32 m world). Region centroids come from frontier cells
in that region; `has_frontier=false` regions are not actionable.

## 2. World / grid conventions

- World: 32 m × 32 m, origin (0,0) corner, wall height 2 m.
- Training grid: 64 × 64 cells at 0.5 m. **cell (row r, col c) → world
  x = c·0.5, y = r·0.5** (row = y axis). Deployment inverts this:
  `pose_to_cell(x, y) → (r = y/0.5, c = x/0.5)`.
- Occupancy: -1 unknown, 0 free, ≥65 occupied (ROS convention).
- Frontier: **known free cell with a 4-neighbour unknown cell** (training
  semantics — *not* the inverted definition).

## 3. Actor observation spec (decentralized execution)

Per robot, from the merged map downsampled to the 64×64 training grid:

- **crop** `(3, 13, 13) float32`, centred on the robot cell, zero-padded:
  ch0 `wall`, ch1 `explored`, ch2 `frontier` (all 0/1).
- **extras** `(4,) float32`: `[r/63, c/63, victims_found/n_victims, steps_frac]`
  where `steps_frac = min(mission_time_s / 600, 1)` on the deployed side
  (training uses `env.t / max_steps`).

Implemented in `sar_alloc_rl/obs_contract.py::actor_obs`; mirrored from
`training/sar_gym/world.py::actor_obs`.

## 4. Actor network

Must match `training/mappo/networks.py::ActorNet` exactly: conv
3→16→32 (3×3, ReLU, 2×2 max-pool) → flatten (32·3·3) + extras-MLP(4→16) →
fc 304→128 (ReLU) → head 128→16. Verified by state-dict round-trip test:
a checkpoint saved in training loads into the replica with identical logits.

## 6. Action semantics (added after the first benchmark round)

- **Invalid-action masking**: regions with no frontier cells are masked out of
  the actor's logits (`-1e9`) before sampling/argmax, identically in training
  (`train.py` + `mappo/algo.py`), evaluation (`policies.py`) and deployment
  (`sar_alloc_rl`). The stored log-probs therefore already reflect the mask,
  keeping the PPO ratio consistent (Huang et al. 2022, invalid action masking).
- **Executor follows the latest assignment**: when the allocator changes a
  robot's region, the A* executor re-targets immediately (no 8-step grace
  period). Adaptive policies get their decisions honored.

## 7. Semantic entry lifecycle

Detector publishes `SemanticEntry(id=0)`; `sar_memory` assigns stable ids and
deduplicates entries of the same type within `dedup_radius` (1.0 m), keeping
`first_detected` (this is the time-to-detection metric) and the max
confidence. Victim matching in `sar_eval` gates at 1.5 m against
`ground_truth.yaml` and `confidence ≥ 0.30`.
