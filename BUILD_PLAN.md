# Build Plan — Cognitive Multi-Robot Search and Rescue Through Collaborative Perception and Reasoning

| | |
|---|---|
| **Project** | Cognitive Multi-Robot Search and Rescue (DA project) |
| **Team** | Aadavan Elavalagan (23BRS1268) · K S Vinoth (23BRS1209) · Shyam Sundar (23BRS1192) · Madhavan A Ramanujan (23BRS1227) |
| **Timeline** | 14 weeks (semester build) |
| **Runtime** | WSL2 on Windows (Ubuntu 24.04) |
| **Source abstract** | `DA1_Project_Abstract (4).docx` |
| **Status** | Planning — no code scaffolded yet |

---

## 1. Project Overview & Objectives

A team of simulated robots collaboratively explores a disaster environment, builds a **shared semantic map** (not just merged occupancy grids), and a **multi-agent RL policy (MAPPO)** learns — rather than hard-codes — how to allocate search regions and tasks across robots. The learned allocator is benchmarked against a **rule-based baseline**.

| # | Objective | Output |
|---|-----------|--------|
| O1 | Collaborative SLAM-based mapping | Fused global occupancy map from N robots |
| O2 | Semantic scene understanding | YOLO-based victim/object detections geo-tagged onto the map |
| O3 | Shared memory layer | A ROS2 semantic-map node queryable by every robot |
| O4 | Multi-agent RL task allocation | Trained MAPPO (CTDE) policy assigning regions/tasks per robot |
| O5 | Benchmark vs rule-based baseline | Experiment results on 6 defined metrics |

**Non-goals:** real hardware deployment, GPS-denied aerial drones, victim manipulation/rescue execution. We locate and report victims; we do not physically transport them.

---

## 2. System Architecture

```
                            ┌─────────────────────────────────────────────┐
                            │            REASONING LAYER                  │
                            │  MAPPO allocator (CTDE)                     │
                            │  in: shared state summary (frontiers,       │
                            │  victims, robot poses)                      │
                            │  out: region/task assignment per robot      │
                            │  ── baseline: rule-based allocator ──       │
                            └──────────────┬──────────────────────────────┘
                                           │ task/region goals
 ┌───────────────────┐          ┌──────────▼───────────┐         ┌──────────────────┐
 │  ROBOT i (×N)     │          │   SHARED STATE       │         │  EVALUATION      │
 │                   │  topics  │                      │         │  HARNESS         │
 │ slam_toolbox ─────┼─────────►│  • global map fusion │         │                  │
 │  local map        │          │  • semantic map node │◄────────│ metric collector │
 │ YOLO camera ──────┼─────────►│    (victims, hazards,│         │ rosbag logging   │
 │  detections       │          │     regions, poses)  │         │ plots / tables   │
 │ Nav2 (Smac/A*) ◄──┼──────────┤  query API for all   │         │                  │
 │  → drive to goal  │  goals   │  robots              │         │                  │
 └───────────────────┘          └──────────────────────┘         └──────────────────┘
        GAZEBO (gz-sim, Harmonic) — multi-robot SAR world, namespaced /robot_i/*
```

### Components

| Component | Package / tool | Responsibility |
|---|---|---|
| Simulator | **Gazebo Harmonic (gz-sim 8)** via `ros_gz` | SAR world, N diff-drive robots with lidar + RGB camera |
| Local SLAM | `slam_toolbox` (namespaced per robot) | Per-robot occupancy grid + pose |
| Map fusion | `multirobot_map_merge` *(or custom fallback, see §7)* | Stitch per-robot grids into a global map |
| Detection | **Ultralytics YOLO** (v8/11) on `/robot_i/camera` | Victim/person + hazard detections |
| Semantic memory | **Custom node `sar_memory`** | Shared semantic map store: victims, hazards, regions, robot states; ROS2 services + topics |
| Allocation (RL) | **Custom `sar_alloc_rl`** + PyTorch MAPPO | Publishes each robot's next region/task goal |
| Allocation (baseline) | **Custom `sar_alloc_rule`** | Nearest-frontier greedy (and/or Hungarian) assignment |
| Navigation | Nav2, **Smac planner (A\*)** | Autonomous navigation to assigned goals; D* Lite optional stretch |
| Evaluation | **Custom `sar_eval`** | Subscribes to everything; computes metrics; logs rosbags |

### Interface contracts (agree on these first — they unblock parallel work)

1. **Semantic map entry** (JSON over ROS2 service/topic):
   `{ id, type: victim|hazard|region, pose_map: [x,y], confidence, source_robot, timestamp }`
2. **Allocation input** (shared state summary, published at fixed rate):
   `{ global_map_coverage, frontiers: [{id, centroid, size}], victims: [entries], robots: [{id, pose, current_task}] }`
3. **Allocation output**: `/robot_i/goal_region` (region id or frontier centroid) — Nav2 consumes it as a goal pose.
4. **Metrics topic**: every subsystem publishes timestamps needed by `sar_eval` (detection time, goal assignment time, arrival time).

---

## 3. Tech Stack (locked choices)

| Layer | Choice | Why |
|---|---|---|
| Host | **WSL2 (WSLg), Ubuntu 24.04** on Windows | GUI apps (Gazebo, RViz) run out-of-the-box via WSLg; CUDA works in WSL2 for PyTorch training |
| ROS 2 | **Jazzy Jalisco (LTS)** | Ubuntu 24.04 native pairing, supported to 2029 |
| Simulator | **Gazebo Harmonic (gz-sim 8)** | Gazebo Classic is EOL; Harmonic is the Jazzy-paired LTS |
| Robot | TurtleBot3 Waffle model (or minimal custom diff-drive if TB3 gz packages lag on Jazzy — verify in Phase 0) | Well-documented, light for multi-robot sim |
| SLAM | `slam_toolbox` | Multi-robot capable via namespaces |
| Nav | Nav2 + Smac 2D A\* planner | Standard, planner is literally A\* per the abstract |
| Detection | Ultralytics YOLO (pip) | Fastest path; COCO `person` class first, fine-tune later if needed |
| RL | PyTorch + Gymnasium (PettingZoo-style multi-agent API), **custom MAPPO** (centralized critic, decentralized actors) | Full control over reward/shapes; avoids heavyweight framework fights |
| Training env | **Abstracted grid env** sampled from real maps (see Phase 4) | Region-level decisions don't need real-time Gazebo steps → 100–1000× faster training |
| Viz / debug | RViz2, Foxglove (optional), rqt | Multi-robot map + detection overlay |
| Dev tooling | Git + GitHub (private repo), VS Code + WSL extension, `colcon`, pre-commit | Standard |

**Fallbacks:** if WSL2 sim performance or GPU accel disappoints → (a) Docker Desktop with NVIDIA container toolkit, or (b) dual-boot native Ubuntu 24.04 on one "sim host" machine used by the team.

---

## 4. Repository Structure

```
cognitive-sar/
├── BUILD_PLAN.md                 ← this file
├── README.md                     (created in Phase 0)
├── ros2_ws/
│   └── src/
│       ├── sar_bringup/          launch files: multi-robot bringup, world loading
│       ├── sar_worlds/           SAR worlds (SDF), victim/hazard models
│       ├── sar_robot/            robot description (URDF/xacro), sensors
│       ├── sar_slam/             per-robot SLAM + global map fusion configs
│       ├── sar_perception/       YOLO detection node (camera → semantic detections)
│       ├── sar_memory/           shared semantic map node + message/service defs
│       ├── sar_alloc_rl/         RL allocator runtime node (loads trained policy)
│       ├── sar_alloc_rule/       rule-based baseline allocator
│       ├── sar_nav/              Nav2 configs, frontier extraction node
│       └── sar_eval/             metric collection, experiment runner, plotting
├── training/
│   ├── sar_gym/                  Gymnasium multi-agent env (grid abstraction)
│   ├── mappo/                    MAPPO implementation + training scripts
│   └── runs/                     checkpoints, TensorBoard logs (git-ignored)
├── docs/                         design notes, interface specs, meeting logs
├── reports/                      DA2/DA3 material, figures, results CSVs
└── .github/workflows/            (optional) build + lint CI
```

---

## 5. Build Schedule (14 weeks)

> Roughly 2× the RL window is deliberate — training and reward shaping always overruns. Every phase ends with a **demo-able exit criterion**, so a slipped phase never leaves us with nothing.

### Phase 0 — Environment & scaffolding (Week 1)

**Goal:** everyone can run the same sim on their machine.

- [ ] Install WSL2 + Ubuntu 24.04 (`wsl --install -d Ubuntu-24.04`); verify WSLg GUI works
- [ ] Install ROS 2 Jazzy + Gazebo Harmonic (`ros-jazzy-ros-gz`); run the gz sim demo
- [ ] Spawn 2 diff-drive robots in one world, teleop both, see both in RViz2
- [ ] Verify TurtleBot3 sim packages on Jazzy; if broken, adopt minimal custom robot (decision logged in `docs/`)
- [ ] Create GitHub repo, protected `main`, branch-per-feature workflow, folder skeleton from §4
- [ ] Agree on interface contracts (§2) — write them into `docs/interfaces.md`

**Exit:** 2-robot teleop demo runs on ≥2 team machines; repo exists with contracts committed.

### Phase 1 — Single-robot autonomy in SAR world (Weeks 2–3)

**Goal:** one robot explores, maps, and navigates autonomously.

- [ ] Build SAR world SDF: indoor maze / collapsed-structure layout, N victim "person" models, hazard props (fire/smoke placeholders), known ground-truth victim pose list (for metrics later)
- [ ] Robot: lidar + RGB camera + diff drive, namespaced
- [ ] `slam_toolbox` online mapping; tune for indoor maze
- [ ] Nav2 with Smac A\* planner; navigate to clicked goals in RViz
- [ ] Frontier-extraction node (basis for both allocators)

**Exit:** robot autonomously explores ≥80% of the world and drives to any clicked point. **Demo 1 (DA2 material).**

### Phase 2 — Multi-robot collaborative SLAM [O1] (Weeks 3–5)

**Goal:** N robots → one fused global map.

- [ ] Generalize bringup to 3 robots via namespaces/launch args (configurable 1–4)
- [ ] Map merge into a global `/map_merged` (try `multirobot_map_merge`; known initial poses simplify alignment)
- [ ] If package unavailable/broken on Jazzy: **custom merge node** stitching grids using known spawn transforms (fallback pre-approved, see §7)
- [ ] Verify combined coverage: 3 robots, disjoint start positions, one coherent global map

**Exit:** fused global map from 3 robots in RViz; coverage % computed by `sar_eval` skeleton. **Demo 2.**

### Phase 3 — Semantic perception + shared memory [O2, O3] (Weeks 5–7)

**Goal:** detections from any robot are visible to all robots.

- [ ] YOLO node: `/robot_i/camera` → person/victim + hazard detections (COCO pretrained first)
- [ ] Project pixel detections to map frame (camera → base → map TF + depth or bearing-only estimate at detection range; log confidence)
- [ ] `sar_memory` node per §2 contract: store/update/query semantic entries; dedupe near-identical detections (distance + time threshold)
- [ ] Overlay semantic map in RViz (victim markers, confidence color-coding)
- [ ] (Stretch) fine-tune YOLO on rendered victim images from our world if COCO recall is poor

**Exit:** robot A detects a victim; robot B (and the allocator) sees it in the shared semantic map within one update cycle. **Demo 3.**

### Phase 4 — RL task allocation [O4] (Weeks 7–10) ⚠ critical path

**Goal:** a trained MAPPO policy assigns regions/tasks; robots execute them.

- [ ] `sar_gym`: multi-agent grid env. State = coarse grid of global map (explored/unexplored/frontier/victim cells) + robot poses. Action per robot = choose a frontier/region (discrete). This abstraction trains in seconds/episode instead of minutes
- [ ] Reward = w1·new area explored + w2·victims detected − w3·overlapping coverage − w4·time (weights in config, tuned deliberately)
- [ ] MAPPO: shared centralized critic over global state, per-robot actors over local+shared observations (CTDE); GAE, orthogonal init — follow the MAPPO paper's hyperparameter defaults as the starting point
- [ ] Train on a family of maze layouts (randomized per episode → generalization); log episodic reward, episodes-to-convergence, overlap ratio
- [ ] `sar_alloc_rl` runtime node: subscribes to the shared-state summary (§2 contract), runs policy inference, publishes `/robot_i/goal_region`; Nav2 executes
- [ ] Integration test in Gazebo with the trained checkpoint

**Risk valve:** if MAPPO fails to beat random/greedy allocation by Week 9, fall back to imitation warm-start (behavioral clone of the rule-based allocator) and continue improving — the RL story survives either way.

**Exit:** trained policy drives 3-robot allocation in Gazebo measurably better than random assignment. **Demo 4 (checkpoint!).**

### Phase 5 — Baseline & benchmarking [O5] (Weeks 10–12)

**Goal:** the comparison table that justifies the whole project.

- [ ] `sar_alloc_rule`: nearest-frontier greedy allocator (optionally Hungarian on cost = distance × region value)
- [ ] Experiment matrix (below, §6): ≥10 seeded runs per configuration
- [ ] `sar_eval` produces: results CSV → plots (coverage-vs-time, time-to-detection CDF, reward curves) matching the three figures in the abstract
- [ ] Statistical sanity: report mean ± std across seeds

**Exit:** full results tables for all 6 metrics across all configurations. **Demo 5.**

### Phase 6 — Hardening, docs, delivery (Weeks 12–14)

- [ ] Fix flaky integrations; freeze config
- [ ] Demo video: full mission end-to-end (spawn → explore → detect → RL allocation → victims located)
- [ ] Final report: architecture, methods, results vs abstract's expected figures, honest limitations
- [ ] Retraining buffer (there *will* be a "we changed the world and the policy broke" moment)
- [ ] Clean repo: README quick-start, install script, tagged release

**Exit:** submission-ready report + video + reproducible repo.

### Schedule at a glance

| Week | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Phase | **0** | **1** | 1→2 | **2** | 2 | **3** | 3→4 | **4** | 4 | 4→5 | **5** | 5 | **6** | 6 |
| Demo | setup | — | Demo1 | — | Demo2 | — | Demo3 | — | Demo4 | — | Demo5 | — | — | submit |

---

## 6. Metrics & Evaluation Protocol

| Metric | Operational definition | Source |
|---|---|---|
| Victim detection accuracy | Precision & recall of semantic-map victim entries vs ground-truth victim pose list, within radius r = 0.5 m | `sar_worlds` ground truth × `sar_memory` |
| Map coverage % | explored free cells / total free cells of ground-truth grid, at episode end and vs time | `sar_eval` on merged map |
| Time-to-detection | sim time from mission start until each victim first enters the semantic map (report per-victim + mean) | timestamps via §2 contract |
| Task allocation efficiency | redundant-coverage ratio (area re-searched by >1 robot / total searched) + victim discoveries per robot-hour | `sar_eval` |
| Average episodic reward | training-time metric, per episode, plotted with smoothing | TensorBoard / training logs |
| Episodes-to-convergence | episodes until mean reward ≥ 90% of plateau for 20 consecutive episodes | training logs |

### Experiment matrix

| Config | Allocator | Robots | Runs |
|---|---|---|---|
| A (baseline-of-baselines) | — (manual single-robot frontier search) | 1 | ≥10 seeds |
| B (rule baseline) | `sar_alloc_rule` | 3 | ≥10 seeds |
| C (ours) | `sar_alloc_rl` (MAPPO) | 3 | ≥10 seeds |

Same world family, same victim placements per seed, same sim time budget per episode. Optional ablation if time allows: C2 = our RL with the shared *semantic* memory ablated (raw map only) — directly evidences the "cognitive" claim.

---

## 7. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| WSL2 GPU / sim perf issues (Gazebo rendering, real-time factor) | Med | Med | Verify in Week 1 (that's why Phase 0 exists); fallbacks: Docker + NVIDIA toolkit, or one dual-boot "sim host" machine |
| `multirobot_map_merge` broken/absent on Jazzy | Med | High | Pre-approved custom merge node using known spawn transforms (grids stitched in map frame — adequate for known-start multi-robot SLAM) |
| MAPPO doesn't converge / beats baseline | Med | High | Region-level action space (tiny, not continuous); randomized maze curriculum; MAPPO paper hyperparams; **imitation warm-start from rule baseline as fallback**; Phase 4 has 4 weeks and a Week-9 go/no-go |
| TB3 sim packages lag Jazzy/gz-Harmonic | Med | Low | Minimal custom diff-drive robot (a day of work); decided in Phase 0 |
| YOLO poor recall on sim-rendered victims | Low | Med | Bright/distinctive victim models in world; fine-tune on rendered frames; detection range gating |
| Map merge misalignment drift | Low | Med | Known initial poses (we control spawn); periodic re-merge |
| Team availability / exam weeks | High | Med | Interfaces frozen early (§2) so streams stall independently, not serially; every phase demo-able so slippage is visible |
| Scope creep (D* Lite, aerial robots, fine-tuning…) | High | Med | Stretch items explicitly labeled; cut order defined below |

**Scope-cut order (if time runs out):** D* Lite → YOLO fine-tuning → 4th robot → Hungarian baseline variant (greedy suffices) → RL ablation C2. **Never cut:** the 6-metric benchmark of B vs C.

---

## 8. Suggested Team Split (4 members)

Streams are horizontal; everyone shares integration duty in Weeks 11–14.

| Member | Stream | Owns |
|---|---|---|
| A | **Simulation & Navigation** | `sar_worlds`, `sar_robot`, `sar_nav`, frontier extraction, bringup/launch |
| B | **Perception & Memory** | `sar_perception` (YOLO), `sar_memory`, RViz overlays |
| C | **Reinforcement Learning** | `training/` (sar_gym, MAPPO), `sar_alloc_rl`, training dashboards |
| D | **Integration & Evaluation** | `sar_eval`, `sar_alloc_rule`, experiment automation, docs/reports, repo hygiene |

**Standing sync:** weekly 1-hour demo meeting (screen-share whatever runs) + shared `docs/meeting-log.md`. Interfaces in `docs/interfaces.md` change only by unanimous agreement.

---

## 9. Milestone Tracker

- [ ] **M0 (Wk 1):** environment live on all machines, repo + contracts committed
- [ ] **M1 (Wk 3):** single-robot autonomous exploration (DA2-ready demo)
- [ ] **M2 (Wk 5):** 3-robot fused global map [O1 ✔]
- [ ] **M3 (Wk 7):** shared semantic map across robots [O2 ✔ O3 ✔]
- [ ] **M4 (Wk 10):** trained MAPPO allocation running in sim [O4 ✔]
- [ ] **M5 (Wk 12):** full benchmark results RL vs rule vs single-robot [O5 ✔]
- [ ] **M6 (Wk 14):** final report, video, tagged release

---

## Appendix A — Phase 0 quick-start commands

```powershell
# Windows (PowerShell, admin)
wsl --install -d Ubuntu-24.04
```

```bash
# Inside WSL Ubuntu 24.04
sudo apt update && sudo apt install -y curl git build-essential
sudo curl -sSL https://raw.githubusercontent.com/ros/rosdistro/master/ros.key \
  -o /usr/share/keyrings/ros-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/ros-archive-keyring.gpg] http://packages.ros.org/ros2/ubuntu $(. /etc/os-release && echo $UBUNTU_CODENAME) main" | sudo tee /etc/apt/sources.list.d/ros2.list
sudo apt update
sudo apt install -y ros-jazzy-desktop ros-jazzy-ros-gz ros-jazzy-slam-toolbox ros-jazzy-navigation2 ros-jazzy-nav2-bringup ros-dev-tools
# Gazebo Harmonic arrives via ros-jazzy-ros-gz pairing; verify:
gz sim --version   # expect gz-sim 8.x
# Python side (in a venv):
pip install torch gymnasium pettingzoo ultralytics tensorboard
```

## Appendix B — Key references

- MAPPO: Yu et al., *"The Surprising Effectiveness of PPO in Cooperative Multi-Agent Games"* (2021) — hyperparameters + CTDE recipe
- ROS 2 Jazzy docs · Nav2 docs (Smac planners) · `slam_toolbox` wiki
- Gazebo Harmonic (gz-sim) docs · `ros_gz` bridge reference
- Ultralytics YOLO docs · Gymnasium / PettingZoo API docs
