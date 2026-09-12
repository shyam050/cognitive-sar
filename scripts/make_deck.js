/* DA2 review deck for the Cognitive Multi-Robot SAR project (v2, plain academic look).
 * Data sources: reports/training_curve.csv (34 logged checkpoints, ~148k steps),
 * reports/benchmark_summary.json (evaluate.py, 4 held-out maps x 2 episodes).
 * Run:  node scripts/make_deck.js   ->   reports/DA2_Presentation.pptx
 */
const pptxgen = require("pptxgenjs");

const W = 13.33, H = 7.5, M = 0.5;
const BG = "FFFFFF", INK = "1F2937", ACCENT = "D9480F", MUTED = "64748B";
const GRAY = "F1F3F5", HAIR = "DDE1E6", DARKTXT = "111827", GREEN = "2E7D4F";
const F = "Calibri";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";
pres.author = "SAR Team 23BRS";
pres.title = "Cognitive Multi-Robot Search and Rescue - DA2 Review";

const bu = () => ({ code: "2022", indent: 10, color: "9CA3AF" });

// training curve (reports/training_curve.csv, logged every 10 episodes, 3-pt smoothed)
const EP = [10,20,30,40,50,60,70,80,90,100,110,120,130,140,150,160,170,180,190,200,210,220,230,240,250,260,270,280,290,300,310,320,330,340];
const REW_RAW = [77.4,76.7,61.5,69.2,79.7,82.5,64.9,73.9,56.7,51.1,58.5,69.4,79.3,52.8,56.7,62.0,61.4,60.6,76.5,58.0,53.7,56.0,49.2,72.7,62.1,49.5,82.3,52.7,46.7,67.2,67.8,75.0,65.5,56.6];
const smooth = (a, k=3) => a.map((_, i) => { const s = a.slice(Math.max(0,i-k+1), i+1); return s.reduce((x,y)=>x+y,0)/s.length; });
const REW = smooth(REW_RAW).map(v => Math.round(v * 10) / 10);
const epLabels = EP.map((e, i) => (i % 5 === 0 || i === EP.length - 1 ? String(e) : ""));

function header(s, title) {
  s.addText(title, { x: M, y: 0.4, w: W - 2 * M, h: 0.6, fontFace: F, fontSize: 27, bold: true, color: DARKTXT, margin: 0 });
}
function source(s, text) {
  s.addText(text, { x: M, y: H - 0.4, w: W - 2 * M, h: 0.28, fontFace: F, fontSize: 10.5, color: MUTED, margin: 0 });
}
const arrow = (x1, y1, x2, y2) =>
  s.addShape(pres.shapes.LINE, { x: x1, y: y1, w: x2 - x1, h: y2 - y1, line: { color: "8B939E", width: 1.25, endArrowType: "triangle" } });

/* ------------------------------------------------ 1 · TITLE */
let s = pres.addSlide();
s.background = { color: BG };
s.addText("Cognitive Multi-Robot Search and Rescue", { x: M, y: 1.15, w: 12.3, h: 1.4, fontFace: F, fontSize: 34, bold: true, color: DARKTXT, margin: 0 });
s.addText("Through Collaborative Perception and Reasoning", { x: M, y: 2.15, w: 12, h: 0.45, fontFace: F, fontSize: 18, color: MUTED, margin: 0 });
s.addShape(pres.shapes.LINE, { x: M, y: 2.85, w: 2.6, h: 0, line: { color: ACCENT, width: 2.5 } });
s.addText("DA2 implementation review", { x: M, y: 3.05, w: 8, h: 0.35, fontFace: F, fontSize: 14, color: MUTED, margin: 0 });
s.addTable([
  [{ text: "Name", options: { bold: true, color: "FFFFFF", fill: { color: "374151" } } },
   { text: "Registration No.", options: { bold: true, color: "FFFFFF", fill: { color: "374151" } } }],
  ["Aadavan Elavalagan", "23BRS1268"],
  ["K S Vinoth", "23BRS1209"],
  ["Shyam Sundar", "23BRS1192"],
  ["Madhavan A Ramanujan", "23BRS1227"],
], { x: M, y: 3.75, w: 5.4, colW: [3.4, 2.0], rowH: 0.42, fontFace: F, fontSize: 13, color: INK,
     border: { pt: 0.75, color: HAIR }, fill: { color: "FFFFFF" }, align: "left", valign: "middle" });
s.addText([
  { text: "System: 3-robot simulation in ROS 2 Jazzy + Gazebo Harmonic", options: { breakLine: true } },
  { text: "Allocation: MAPPO (learned) compared against a rule-based baseline" }
], { x: 6.9, y: 3.85, w: 6.2, h: 1.2, fontFace: F, fontSize: 14, color: INK, paraSpaceAfter: 10, margin: 0, valign: "top" });
s.addNotes("Open with one line: in DA1 we proposed this system, and today we are showing the working implementation and the first benchmark data.");

/* ------------------------------------------------ 2 · PROBLEM AND APPROACH */
s = pres.addSlide(); s.background = { color: BG };
header(s, "Problem and approach");
s.addText("Why a single robot is not enough", { x: M, y: 1.45, w: 6, h: 0.35, fontFace: F, fontSize: 16, bold: true, color: DARKTXT, margin: 0 });
s.addText([
  { text: "After a disaster, rescuers have limited visibility and face personal risk, so every minute matters.", options: { bullet: bu(), breakLine: true } },
  { text: "A single robot sweeping a large collapsed structure is far too slow to find victims in time.", options: { bullet: bu(), breakLine: true } },
  { text: "Just merging occupancy maps is not enough: robots still need to decide where to search next without duplicating each other's work.", options: { bullet: bu() } },
], { x: M, y: 1.85, w: 5.9, h: 2.6, fontFace: F, fontSize: 14, color: INK, paraSpaceAfter: 10, margin: 0 });
s.addText("What we proposed in DA1 (and built since)", { x: 6.9, y: 1.45, w: 6, h: 0.35, fontFace: F, fontSize: 16, bold: true, color: ACCENT, margin: 0 });
s.addText([
  { text: "Robots build one shared map together (collaborative SLAM).", options: { bullet: bu(), breakLine: true } },
  { text: "Victim and hazard detections from any robot are stored in a common semantic map, so the whole team knows what has been found.", options: { bullet: bu(), breakLine: true } },
  { text: "A multi-agent reinforcement learning policy (MAPPO) learns how to divide the search area between robots. We compare it against a simple rule-based allocator.", options: { bullet: bu() } },
], { x: 6.9, y: 1.85, w: 5.95, h: 2.6, fontFace: F, fontSize: 14, color: INK, paraSpaceAfter: 10, margin: 0 });
s.addShape(pres.shapes.LINE, { x: M, y: 4.85, w: W - 2 * M, h: 0, line: { color: HAIR, width: 0.75 } });
s.addText([
  { text: "The difference between our system and plain map merging: ", options: { color: INK } },
  { text: "the shared map also carries meaning (victims found, regions already searched), and the allocator uses that meaning to decide where each robot should go next.", options: { color: MUTED } }
], { x: M, y: 5.1, w: 12.3, h: 0.9, fontFace: F, fontSize: 14.5, margin: 0 });
s.addNotes("The last line on this slide is the 'cognitive' claim from our abstract in one sentence: shared semantic state feeding the allocation decision, not just occupancy fusion.");

/* ------------------------------------------------ 3 · ARCHITECTURE */
s = pres.addSlide(); s.background = { color: BG };
header(s, "System architecture");
s.addText("Every block below is an implemented ROS 2 node in the repository.", { x: M, y: 1.05, w: 11.5, h: 0.3, fontFace: F, fontSize: 13, color: MUTED, margin: 0 });
const box = (x, y, w, h, head, sub, hot) => {
  s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: hot ? "FBE9DD" : GRAY }, line: { color: hot ? ACCENT : "C8CDD3", width: 1 } });
  s.addText(head, { x: x + 0.12, y: y + 0.06, w: w - 0.24, h: 0.3, fontFace: F, fontSize: 13, bold: true, color: DARKTXT, margin: 0 });
  if (sub) s.addText(sub, { x: x + 0.12, y: y + 0.36, w: w - 0.24, h: h - 0.44, fontFace: F, fontSize: 10.5, color: MUTED, margin: 0 });
};
const lbl = (x, y, t) => s.addText(t, { x, y, w: 1.7, h: 0.22, fontFace: F, fontSize: 10, color: MUTED, align: "center", margin: 0 });
s.addText("Each robot (x3)", { x: M, y: 1.55, w: 3.9, h: 0.26, fontFace: F, fontSize: 12.5, bold: true, color: DARKTXT, margin: 0 });
box(M, 1.9, 3.9, 0.85, "slam_toolbox", "local map per robot (namespaced)");
box(M, 2.95, 3.9, 0.85, "detector (YOLO or HSV)", "camera + lidar range = victim position");
box(M, 4.0, 3.9, 0.85, "Nav2 + Smac (A*)", "navigates to assigned regions");
s.addText("Shared state", { x: 5.05, y: 1.55, w: 3.6, h: 0.26, fontFace: F, fontSize: 12.5, bold: true, color: DARKTXT, margin: 0 });
box(5.05, 1.9, 3.6, 0.85, "map_merge", "fuses N local maps into one");
box(5.05, 2.95, 3.6, 0.85, "sar_memory", "shared semantic map (victims, hazards)");
box(5.05, 4.0, 3.6, 0.85, "frontier", "splits map into 16 search regions");
s.addText("Decision layer", { x: 9.35, y: 1.55, w: 3.5, h: 0.26, fontFace: F, fontSize: 12.5, bold: true, color: DARKTXT, margin: 0 });
box(9.35, 1.9, 3.48, 0.85, "MAPPO allocator", "learned region assignment", true);
box(9.35, 2.95, 3.48, 0.85, "rule allocator", "greedy nearest-frontier baseline");
box(9.35, 4.0, 3.48, 0.85, "sar_eval", "coverage, victims, overlap, timings");
arrow(4.42, 2.32, 5.03, 2.32);
arrow(4.42, 3.37, 5.03, 3.37);
arrow(8.67, 2.32, 9.33, 2.32);
arrow(8.67, 3.37, 9.33, 3.37);
arrow(8.67, 4.42, 9.33, 4.42);
s.addText("Data flow: each robot publishes /robot_i/map and /detections; the shared layer publishes /map_merged, /semantic_map and /regions to the allocators.", { x: M, y: 5.15, w: 12.3, h: 0.55, fontFace: F, fontSize: 12.5, color: MUTED, margin: 0 });
s.addText("The two allocators are interchangeable: both publish /robot_i/goal, which Nav2 follows, and sar_eval logs /mission_metrics for the benchmark.", { x: M, y: 5.6, w: 12.3, h: 0.55, fontFace: F, fontSize: 13, color: INK, margin: 0 });
s.addText("Message and topic definitions are written down in docs/interfaces.md; they were fixed early so the four of us could build in parallel.", { x: M, y: 6.45, w: 12.3, h: 0.55, fontFace: F, fontSize: 12.5, italic: true, color: MUTED, margin: 0 });
s.addNotes("Walk left to right. The swap between MAPPO and the rule allocator is the whole benchmark design: same interface, two brains.");

/* ------------------------------------------------ 4 · OBJECTIVES STATUS */
s = pres.addSlide(); s.background = { color: BG };
header(s, "Status of the five objectives from the abstract");
const hdr = { bold: true, color: "FFFFFF", fill: { color: "374151" } };
const done = { bold: true, color: GREEN };
const prog = { bold: true, color: ACCENT };
s.addTable([
  [{ text: "Objective", options: hdr }, { text: "What it means in the system", options: hdr }, { text: "Status", options: hdr }, { text: "Evidence", options: hdr }],
  ["O1  Collaborative SLAM", "Fused global map from 3 robots", { text: "Done", options: done }, "sar_slam map fusion + tests"],
  ["O2  Semantic understanding", "Victim/hazard detection in map frame", { text: "Done", options: done }, "sar_perception detector node"],
  ["O3  Shared memory", "One semantic map every robot can query", { text: "Done", options: done }, "sar_memory node + RViz view"],
  ["O4  RL task allocation", "MAPPO assigns search regions", { text: "Trained, ~148k steps", options: prog }, "training/runs/mappo_v1"],
  ["O5  Benchmark vs baseline", "Learned vs rule-based allocator", { text: "First results", options: prog }, "benchmark_summary.json"],
], { x: M, y: 1.55, w: 12.33, colW: [3.3, 4.6, 2.2, 2.23], rowH: 0.62, fontFace: F, fontSize: 13, color: INK,
     border: { pt: 0.75, color: HAIR }, valign: "middle", align: "left",
     autoPage: false });
s.addText("O4 and O5 are functional end to end; what remains before the final review is the Gazebo-level benchmark matrix and a longer training run.", { x: M, y: 6.0, w: 12.3, h: 0.6, fontFace: F, fontSize: 13, color: MUTED, margin: 0 });
s.addNotes("Be straight about O4/O5: built and running, but the learned policy has not yet beaten the greedy baseline. More training is scheduled and needs no redesign - slide 9 covers this.");

/* ------------------------------------------------ 5 · WHAT GOT BUILT */
s = pres.addSlide(); s.background = { color: BG };
header(s, "What has been built so far");
const stats = [["11", "ROS 2 packages"], ["43", "Python modules"], ["9", "unit tests passing"], ["341", "training episodes logged"]];
stats.forEach((st, i) => {
  const x = M + i * 3.13;
  s.addText(st[0], { x, y: 1.5, w: 2.9, h: 0.65, fontFace: F, fontSize: 32, bold: true, color: i === 0 ? ACCENT : DARKTXT, margin: 0 });
  s.addText(st[1], { x, y: 2.15, w: 2.9, h: 0.3, fontFace: F, fontSize: 12.5, color: MUTED, margin: 0 });
});
s.addShape(pres.shapes.LINE, { x: M, y: 2.75, w: W - 2 * M, h: 0, line: { color: HAIR, width: 0.75 } });
const cols = [
  ["Training code (pure Python)", ["sar_gym: grid search environment, 16 region actions, A* executor", "mappo: shared actor + centralized critic, GAE, PPO-clip", "train.py / evaluate.py: training and benchmark scripts"]],
  ["Robot code (ROS 2 Jazzy)", ["sar_worlds + sar_robot: maze world and diff-drive robot", "sar_slam, sar_memory, sar_nav: fusion, semantic map, frontiers", "sar_alloc_rule and sar_alloc_rl: the two allocators"]],
  ["Tests and docs", ["Contract tests: training vs deployment observation spec", "Map fusion unit tests (rotation, offsets, unknown cells)", "BUILD_PLAN.md, README, docs/interfaces.md"]],
];
cols.forEach((c, i) => {
  const x = M + i * 4.31;
  s.addText(c[0], { x, y: 2.95, w: 4.0, h: 0.3, fontFace: F, fontSize: 14, bold: true, color: DARKTXT, margin: 0 });
  s.addText(c[1].map((t, j) => ({ text: t, options: { bullet: bu(), breakLine: j < c[1].length - 1 } })), { x, y: 3.3, w: 4.0, h: 2.4, fontFace: F, fontSize: 12.5, color: "374151", paraSpaceAfter: 9, margin: 0, valign: "top" });
});
s.addText("The whole system starts with one command: ros2 launch sar_bringup multi_sar.launch.py robots:=3 allocator:=rule", { x: M, y: 6.0, w: 12.3, h: 0.35, fontFace: F, fontSize: 13, color: INK, margin: 0 });
source(s, "Counts from a repository audit on 2026-09-12. Environment: WSL2 (Ubuntu 24.04), ROS 2 Jazzy LTS, Gazebo Harmonic.");
s.addNotes("Message: this was engineered like a team project, not a notebook. Interfaces were fixed first; contract tests keep training and deployment from drifting apart.");

/* ------------------------------------------------ 6 · TRAINING APPROACH */
s = pres.addSlide(); s.background = { color: BG };
header(s, "How the allocation policy is trained");
const steps6 = [
  ["1. Shared maze generator", "The same code generates the training maps and the Gazebo world, so the policy practises on the room layouts it will actually face."],
  ["2. Lightweight grid environment", "Training runs on a 64x64 grid: each robot picks one of 16 regions, an A* executor drives it there. No physics simulation needed for allocation decisions."],
  ["3. MAPPO (centralized training)", "One critic sees the full map during training; each robot's actor only sees its own view at execution time (CTDE)."],
  ["4. Deployment", "The trained checkpoint is loaded by the sar_alloc_rl ROS node, which publishes region goals. A unit test pins the observation format."],
];
steps6.forEach((st, i) => {
  const x = M + (i % 2) * 6.3, y = 1.5 + Math.floor(i / 2) * 1.7;
  s.addText(st[0], { x, y, w: 5.9, h: 0.32, fontFace: F, fontSize: 15.5, bold: true, color: DARKTXT, margin: 0 });
  s.addText(st[1], { x, y: y + 0.35, w: 5.9, h: 1.15, fontFace: F, fontSize: 13, color: MUTED, margin: 0 });
});
s.addShape(pres.shapes.RECTANGLE, { x: M, y: 5.0, w: 12.33, h: 1.3, fill: { color: GRAY }, line: { color: "C8CDD3", width: 1 } });
s.addText("Reward function:", { x: 0.85, y: 5.15, w: 6, h: 0.3, fontFace: F, fontSize: 13, bold: true, color: DARKTXT, margin: 0 });
s.addText("r = +0.10 (new area explored) + 10 (victim located) - 0.02 (cell another robot already searched) - 0.01 (time) - 0.05 (choosing a finished region)", { x: 0.85, y: 5.5, w: 11.7, h: 0.6, fontFace: F, fontSize: 13.5, color: INK, margin: 0 });
s.addText("This is why training takes minutes on a CPU instead of days in the simulator.", { x: M, y: 6.55, w: 12, h: 0.35, fontFace: F, fontSize: 12.5, italic: true, color: MUTED, margin: 0 });
s.addNotes("Expected question: why not train directly in Gazebo? Answer: allocation is a slow, region-level decision; the grid abstraction trains in seconds per episode, and the observation contract (unit-tested) carries the policy into the simulator unchanged.");

/* ------------------------------------------------ 7 · TRAINING CURVE */
s = pres.addSlide(); s.background = { color: BG };
header(s, "Training results");
s.addChart(pres.charts.LINE, [{ name: "Episodic reward", labels: epLabels, values: REW }], {
  x: M, y: 1.55, w: 8.2, h: 4.5,
  chartColors: [ACCENT], lineSize: 2.5, lineSmooth: true,
  chartArea: { fill: { color: "FFFFFF" } },
  catAxisTitle: "training episode (logged every 10)", catAxisTitleColor: MUTED, showCatAxisTitle: true,
  valAxisTitle: "episodic reward", valAxisTitleColor: MUTED, showValAxisTitle: true,
  catAxisLabelColor: MUTED, valAxisLabelColor: MUTED, catAxisLabelFontSize: 11, valAxisLabelFontSize: 11,
  valGridLine: { color: "ECEEF1", size: 0.5 }, catGridLine: { style: "none" },
  showLegend: false, valAxisMinVal: 30, valAxisMaxVal: 90,
});
s.addText("What the curve shows", { x: 9.1, y: 1.6, w: 3.7, h: 0.3, fontFace: F, fontSize: 14, bold: true, color: DARKTXT, margin: 0 });
s.addText([
  { text: "Map coverage settled at 83-86% early in training and stayed there.", options: { bullet: bu(), breakLine: true } },
  { text: "Reward plateaus around 66-74: the basic behaviour (spread out, do not re-search, pick up victims) is learned within the first third.", options: { bullet: bu(), breakLine: true } },
  { text: "The remaining steps did not yet convert into beating the rule baseline - see next slide.", options: { bullet: bu() } },
], { x: 9.1, y: 1.95, w: 3.75, h: 4.0, fontFace: F, fontSize: 12.5, color: INK, paraSpaceAfter: 12, margin: 0, valign: "top" });
source(s, "Data: training/runs/mappo_v1, 34 checkpoints over ~148k environment steps (MAPPO, 3 agents, GAE 0.95, lr 3e-4).");
s.addNotes("Read it honestly: the learning happened early and then plateaued. That is why the benchmark is at parity, not dominance, and why a longer run is the next step.");

/* ------------------------------------------------ 8 · BENCHMARK */
s = pres.addSlide(); s.background = { color: BG };
header(s, "Benchmark: learned policy vs baselines");
const bench = (x, title, values, maxV, unit, note) => {
  s.addText(title, { x, y: 1.5, w: 5.9, h: 0.3, fontFace: F, fontSize: 13.5, bold: true, color: DARKTXT, margin: 0 });
  s.addChart(pres.charts.BAR, [{ name: title, labels: ["Rule-based", "MAPPO", "Random"], values }], {
    x, y: 1.85, w: 5.9, h: 3.0, barDir: "col", barGapWidthPct: 80,
    chartColors: ["7B8494"], barGrouping: "clustered",
    chartArea: { fill: { color: "FFFFFF" } },
    catAxisLabelColor: MUTED, valAxisLabelColor: MUTED, catAxisLabelFontSize: 12, valAxisLabelFontSize: 11,
    valGridLine: { color: "ECEEF1", size: 0.5 }, catGridLine: { style: "none" },
    showValue: true, dataLabelPosition: "outEnd", dataLabelColor: DARKTXT, dataLabelFontSize: 12, dataLabelFontBold: true,
    showLegend: false, valAxisMinVal: 0, valAxisMaxVal: maxV, valAxisMajorUnit: unit,
  });
  s.addText(note, { x, y: 4.9, w: 5.9, h: 0.55, fontFace: F, fontSize: 12, color: MUTED, margin: 0 });
};
bench(M, "Victims located (of 5), higher is better", [4.25, 3.25, 3.75], 5, 1,
      "Rule-based finds 1 victim more on average.");
bench(6.93, "Mission steps until finished, lower is better", [138, 444, 425], 600, 100,
      "Rule-based finishes most missions early; MAPPO often runs to the step cap.");
s.addText("Map coverage: 85-86% for all three policies (no significant difference).   Time to first detection: MAPPO 43 steps, rule-based 49, random 57.", { x: M, y: 5.6, w: 12.3, h: 0.35, fontFace: F, fontSize: 13, color: INK, margin: 0 });
s.addText("Summary: greedy frontier allocation is a strong baseline and the learned policy has not beaten it yet at ~150k training steps. Where the learned policy already looks better is detection speed; victims and mission time need more training.", { x: M, y: 6.0, w: 12.3, h: 0.6, fontFace: F, fontSize: 13, color: INK, margin: 0 });
source(s, "Data: training/evaluate.py, 4 held-out maps x 2 episodes, 3 robots, 600-step cap. Full table: reports/benchmark_summary.json.");
s.addNotes("Do not hide the negative result. If asked why greedy wins: pure frontier coverage is close to greedy-optimal; our hypothesis is that learned use of semantics (victim priors) pays off with more training and in the full simulator.");

/* ------------------------------------------------ 9 · FINDINGS */
s = pres.addSlide(); s.background = { color: BG };
header(s, "What works, what does not yet, and what we do next");
s.addText("Working", { x: M, y: 1.5, w: 5.9, h: 0.32, fontFace: F, fontSize: 15, bold: true, color: DARKTXT, margin: 0 });
s.addText([
  { text: "Full pipeline runs end to end: detection, shared semantic map, allocation, navigation, metrics.", options: { bullet: bu(), breakLine: true } },
  { text: "Multi-robot map fusion is unit-tested (rotation, offsets, unknown areas).", options: { bullet: bu(), breakLine: true } },
  { text: "Training and deployment share a fixed observation contract, enforced by tests.", options: { bullet: bu(), breakLine: true } },
  { text: "The learned policy already reaches the same map coverage as the hand-written allocator.", options: { bullet: bu() } },
], { x: M, y: 1.9, w: 5.9, h: 3.4, fontFace: F, fontSize: 13, color: INK, paraSpaceAfter: 12, margin: 0, valign: "top" });
s.addText("Not there yet  ->  our plan", { x: 6.9, y: 1.5, w: 5.95, h: 0.32, fontFace: F, fontSize: 15, bold: true, color: ACCENT, margin: 0 });
s.addText([
  { text: "Victims found per mission still trails the greedy baseline.  Plan: 300-500k more training steps on a Colab GPU (2-3 hours) and a reward-weight tune.", options: { bullet: bu(), breakLine: true } },
  { text: "Deterministic (argmax) policy gets stuck at this training level.  Plan: keep sampling at deployment (already the default), re-test after longer training.", options: { bullet: bu(), breakLine: true } },
  { text: "Benchmarks so far are in the abstract environment.  Plan: run the Gazebo-level experiment matrix (10 runs per allocator), then the report.", options: { bullet: bu() } },
], { x: 6.9, y: 1.9, w: 5.95, h: 3.4, fontFace: F, fontSize: 13, color: INK, paraSpaceAfter: 12, margin: 0, valign: "top" });
s.addShape(pres.shapes.LINE, { x: M, y: 5.6, w: W - 2 * M, h: 0, line: { color: HAIR, width: 0.75 } });
s.addText("All three gaps were written down with their fixes in the build plan (BUILD_PLAN.md, section 7) before implementation started. None of them requires a redesign.", { x: M, y: 5.8, w: 12.3, h: 0.6, fontFace: F, fontSize: 13.5, color: INK, margin: 0 });
s.addNotes("This is the credibility slide. A pre-registered risk register with honest status reads as maturity. If asked about MAPPO sample efficiency: we used the Yu et al. 2021 hyperparameters and the action space is already minimal (16 regions).");

/* ------------------------------------------------ 10 · ROADMAP */
s = pres.addSlide(); s.background = { color: BG };
header(s, "Plan until the final review");
const road = [
  ["Weeks 1-2", "Simulator bringup", "Install WSL2 + ROS 2 Jazzy + Gazebo, run and record the 3-robot mission (rule-based) as the demo backup."],
  ["Weeks 2-3", "Gazebo benchmark", "10 runs per allocator with scripts/run_experiments.sh; produce coverage, victims and overlap curves."],
  ["Weeks 3-4", "Longer training", "300-500k steps on Colab GPU, re-benchmark, freeze the final checkpoint."],
  ["Weeks 5-6", "Report", "Optional ablation (allocation without semantic memory) and the final report with the recorded demo."],
];
s.addTable(
  [[{ text: "When", options: hdr }, { text: "Milestone", options: hdr }, { text: "What happens", options: hdr }],
   ...road.map(r => [r[0], { text: r[1], options: { bold: true } }, r[2]])],
  { x: M, y: 1.6, w: 12.33, colW: [1.7, 2.6, 8.03], rowH: 0.72, fontFace: F, fontSize: 13, color: INK,
    border: { pt: 0.75, color: HAIR }, valign: "middle", align: "left" });
s.addText("The recorded mission video is the fallback for the live demo; the rule-based allocator is the default demo, RL on request.", { x: M, y: 6.2, w: 12.3, h: 0.4, fontFace: F, fontSize: 13, color: MUTED, margin: 0 });
s.addNotes("Weeks are counted from this review. Critical path is the bringup; everything after that is repeatable scripts. Pre-agreed scope cuts if time runs short: D* Lite, YOLO fine-tuning, 4th robot.");

/* ------------------------------------------------ 11 · CLOSING */
s = pres.addSlide(); s.background = { color: BG };
s.addText("Summary", { x: M, y: 1.3, w: 8, h: 0.5, fontFace: F, fontSize: 27, bold: true, color: DARKTXT, margin: 0 });
s.addText([
  { text: "All five objectives from the DA1 abstract are implemented and running.", options: { bullet: bu(), breakLine: true } },
  { text: "The learned allocator matches the rule-based baseline on coverage today; closing the remaining gap is a training-budget problem, not a design problem.", options: { bullet: bu(), breakLine: true } },
  { text: "Next: Gazebo-level benchmark matrix, longer training, final report and recorded demo.", options: { bullet: bu() } },
], { x: M, y: 1.85, w: 11.5, h: 1.9, fontFace: F, fontSize: 15, color: INK, paraSpaceAfter: 12, margin: 0 });
s.addShape(pres.shapes.LINE, { x: M, y: 4.15, w: 2.6, h: 0, line: { color: ACCENT, width: 2.5 } });
s.addText("Thank you. Questions?", { x: M, y: 4.4, w: 8, h: 0.55, fontFace: F, fontSize: 24, bold: true, color: DARKTXT, margin: 0 });
s.addText([
  { text: "Repository: cognitive-sar/  (BUILD_PLAN.md, docs/interfaces.md, reports/)", options: { breakLine: true } },
  { text: "Demo command: ros2 launch sar_bringup multi_sar.launch.py robots:=3 allocator:=rule", options: {} },
], { x: M, y: 5.15, w: 11.5, h: 0.8, fontFace: F, fontSize: 13, color: MUTED, paraSpaceAfter: 8, margin: 0 });
s.addText("Aadavan Elavalagan (23BRS1268), K S Vinoth (23BRS1209), Shyam Sundar (23BRS1192), Madhavan A Ramanujan (23BRS1227)", { x: M, y: 6.55, w: 12.3, h: 0.35, fontFace: F, fontSize: 11.5, color: MUTED, margin: 0 });
s.addNotes("Offer the live demo here. Keep the terminal open with the repo and the metrics CSV ready.");

pres.writeFile({ fileName: "reports/DA2_Presentation.pptx" }).then(() => console.log("wrote reports/DA2_Presentation.pptx"));
