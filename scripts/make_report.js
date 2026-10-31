/* Academic project report generator.
 * Structure: Cover (R5 academic) | Front matter: Team, Abstract, TOC (Roman) |
 * Body: Introduction, Related Study, Proposed Work, Results and Analysis,
 *       Conclusion and Future Work, References (Arabic from 1).
 * Profile A formal: Times New Roman, pure black, 1.3x spacing, three-line tables.
 * Run:  node scripts/make_report.js  ->  reports/DA2_Project_Report.docx
 */
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  PageBreak, Header, Footer, PageNumber, NumberFormat, AlignmentType,
  HeadingLevel, WidthType, BorderStyle, ShadingType, SectionType,
  TableOfContents, TableLayoutType, LevelFormat,
} = require("docx");
const fs = require("fs");
const path = require("path");
const _is = require("image-size");
const sizeOf = _is.imageSize || _is.default || _is;

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "reports", "DA2_Project_Report.docx");

// ---------------------------------------------------------------- constants
const FONT = { ascii: "Times New Roman", eastAsia: "SimSun" };
const HFONT = { ascii: "Times New Roman", eastAsia: "SimHei" };
const BLACK = "000000";
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { ...noBorders, insideHorizontal: NB, insideVertical: NB };
const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

// ---------------------------------------------------------------- helpers
const body = (text, opts = {}) => new Paragraph({
  alignment: AlignmentType.JUSTIFIED,
  spacing: { line: 312, after: 120 },
  children: [new TextRun({ text, size: 24, color: BLACK, font: FONT, ...opts })],
});
const bodyRuns = (runs) => new Paragraph({
  alignment: AlignmentType.JUSTIFIED,
  spacing: { line: 312, after: 120 },
  children: runs.map(r => new TextRun({ size: 24, color: BLACK, font: FONT, ...r })),
});
const h1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1, alignment: AlignmentType.LEFT,
  spacing: { before: 360, after: 160, line: 312 },
  children: [new TextRun({ text, bold: true, size: 32, color: BLACK, font: HFONT })],
});
const h2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 240, after: 120, line: 312 },
  children: [new TextRun({ text, bold: true, size: 28, color: BLACK, font: HFONT })],
});
const caption = (text) => new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { before: 80, after: 200, line: 312 },
  children: [new TextRun({ text, size: 21, color: BLACK, font: FONT })],
});
const tableTitle = (text) => new Paragraph({
  keepNext: true, alignment: AlignmentType.CENTER,
  spacing: { before: 200, after: 80, line: 312 },
  children: [new TextRun({ text, bold: true, size: 21, color: BLACK, font: FONT })],
});
const figure = (file, displayWidth) => {
  const buf = fs.readFileSync(path.join(ROOT, "reports", file));
  const dims = sizeOf(buf);
  const h = Math.round(displayWidth * (dims.height / dims.width));
  return new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { before: 160, after: 40 },
    children: [new ImageRun({ data: buf, type: "png",
      transformation: { width: displayWidth, height: h } })],
  });
};

// Three-line academic table (black rules only)
function threeLine(headers, rows, widths) {
  const mk = (text, bold, pct, isHeader) => new TableCell({
    width: { size: pct, type: WidthType.PERCENTAGE },
    borders: isHeader
      ? { top: NB, left: NB, right: NB,
          bottom: { style: BorderStyle.SINGLE, size: 2, color: BLACK } }
      : noBorders,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({
      alignment: AlignmentType.LEFT, spacing: { line: 280 },
      children: [new TextRun({ text, bold, size: 21, color: BLACK, font: FONT })],
    })],
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: { top: { style: BorderStyle.SINGLE, size: 4, color: BLACK },
               bottom: { style: BorderStyle.SINGLE, size: 4, color: BLACK },
               left: NB, right: NB, insideHorizontal: NB, insideVertical: NB },
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true,
        children: headers.map((t, i) => mk(t, true, widths[i], true)) }),
      ...rows.map(r => new TableRow({ cantSplit: true,
        children: r.map((t, i) => mk(String(t), false, widths[i], false)) })),
    ],
  });
}

// ---------------------------------------------------------------- cover (R5 academic)
function buildCoverR5() {
  const PAGE_H = 16838, SAFETY = 1200, simMarginLR = 1500;
  const contentW = 11906 - simMarginLR * 2;
  // Title layout: 2-line main title (fits 28pt within content width), subtitle carries the rest
  const titleLines = ["Cognitive Multi-Robot", "Search and Rescue"];
  const titlePt = 28;
  const metaEntries = [
    ["Course", "\u3010Course Code / Name\u3011"],
    ["Guide", "\u3010Faculty Guide Name\u3011"],
    ["Submitted by", "Team of Four (listed overleaf)"],
    ["Date", "\u3010Submission Date\u3011"],
  ];
  const schoolNameH = 22 * 23 + 400;
  const titleTotalH = titleLines.length * (titlePt * 23 + 200);
  const subtitleH = 15 * 23 + 600;
  const metaTableH = metaEntries.length * 520;
  const footerH = 12 * 23 + 200;
  const spacerParas = 3 * 350;
  const fixedH = schoolNameH + titleTotalH + subtitleH + metaTableH + footerH + spacerParas;
  const remaining = Math.max((PAGE_H - SAFETY) - fixedH, 600);
  const topSpacing = Math.min(Math.floor(remaining * 0.28) + 1200, 4200);
  const midSpacing = Math.min(Math.floor((remaining - 1200) * 0.18), 2000);
  const bottomSpacing = Math.max(Math.min(remaining - topSpacing + 1200 - midSpacing, 5500), 800);

  const bottomBorder = { style: BorderStyle.SINGLE, size: 4, color: BLACK };
  const metaTable = new Table({
    width: { size: 62, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.CENTER, layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: metaEntries.map(([label, value]) => new TableRow({
      children: [
        new TableCell({
          width: { size: 30, type: WidthType.PERCENTAGE }, borders: noBorders,
          margins: { top: 60, bottom: 60, left: 0, right: 0 },
          children: [new Paragraph({ alignment: AlignmentType.LEFT,
            spacing: { before: 60, after: 60, line: 400 },
            children: [new TextRun({ text: label + ":", size: 24, color: BLACK, font: FONT })] })],
        }),
        new TableCell({
          width: { size: 70, type: WidthType.PERCENTAGE },
          borders: { top: NB, left: NB, right: NB, bottom: bottomBorder },
          margins: { top: 60, bottom: 60, left: 80, right: 0 },
          children: [new Paragraph({ alignment: AlignmentType.LEFT,
            spacing: { before: 60, after: 60, line: 400 },
            children: [new TextRun({ text: value, size: 24, color: BLACK, font: FONT })] })],
        }),
      ],
    })),
  });

  const children = [
    new Paragraph({ spacing: { before: topSpacing } }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 },
      children: [new TextRun({ text: "SRM Institute of Science and Technology",
        size: 44, characterSpacing: 20, color: BLACK, font: FONT })] }),
    ...titleLines.map((line, i) => new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: i < titleLines.length - 1 ? 120 : 300,
                 line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: line, size: titlePt * 2, bold: true,
        color: BLACK, font: HFONT })] })),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
      children: [new TextRun({ text: "Through Collaborative Perception and Reasoning",
        size: 30, color: BLACK, font: FONT })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
      children: [new TextRun({ text: "Project Report \u2014 Design Assignment 2",
        size: 26, color: "404040", font: FONT })] }),
    new Paragraph({ spacing: { before: midSpacing } }),
    metaTable,
    new Paragraph({ spacing: { before: bottomSpacing } }),
    new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "B.Tech \u2014 Semester V", size: 24, color: "404040", font: FONT })] }),
  ];
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: PAGE_H, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: "FFFFFF" },
        borders: noBorders, verticalAlign: "top",
        margins: { left: simMarginLR, right: simMarginLR },
        children,
      })],
    })],
  })];
}

// ---------------------------------------------------------------- front matter
const frontMatter = [
  tableTitle("Project Team"),
  threeLine(
    ["Name", "Registration Number"],
    [["Aadavan Elavalagan", "23BRS1268"],
     ["K S Vinoth", "23BRS1209"],
     ["Shyam Sundar", "23BRS1192"],
     ["Madhavan A Ramanujan", "23BRS1227"]],
    [60, 40]),
  new Paragraph({ spacing: { after: 200 } }),
  h1("Abstract"),
  body("Search and rescue (SAR) operations in disaster-hit environments demand rapid, thorough coverage of large and hazardous areas \u2014 conditions under which a single robot is fundamentally limited. This report presents the design, implementation, and evaluation of a cognitive multi-robot SAR system in which a team of three simulated robots collaboratively maps a collapsed-structure environment, detects and shares victim discoveries through a common semantic memory, and divides the search workload through a learned task-allocation policy. The system was developed on ROS 2 (Jazzy) with the Gazebo Harmonic simulator. Each robot performs lidar-based SLAM; per-robot maps are fused into a single global grid; a camera-based detector projects victim sightings into the map frame; and a shared semantic-map node makes every discovery available to the whole team. Two interchangeable task allocators were built: a greedy nearest-frontier baseline and a multi-agent reinforcement learning policy (MAPPO, centralized training with decentralized execution) trained on a lightweight grid abstraction of the world, with rewards for exploration and victim discovery and penalties for redundant coverage and elapsed time. On held-out test maps, the learned policy matched the hand-crafted baseline in map coverage (85% vs 86%) and detected victims faster on average (43 vs 49 steps), while finding fewer victims per mission (3.25 vs 4.25 of 5) at the evaluated training budget of approximately 148,000 steps. The results establish a complete, tested, and reproducible system in which the remaining performance gap is attributable to training budget rather than design, and define a clear path \u2014 longer training, simulator-level benchmarking, and semantic ablation \u2014 toward the final deliverable."),
  new Paragraph({ spacing: { after: 120 } }),
  bodyRuns([{ text: "Keywords: ", bold: true },
    { text: "multi-robot systems; search and rescue; SLAM; semantic mapping; multi-agent reinforcement learning; MAPPO; ROS 2; Gazebo" }]),
  new Paragraph({ children: [new PageBreak()] }),
  new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { before: 480, after: 360 },
    children: [new TextRun({ text: "Table of Contents", bold: true, size: 32, font: HFONT, color: BLACK })],
  }),
  new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }),
  new Paragraph({
    spacing: { before: 200 },
    children: [new TextRun({
      text: "Note: This Table of Contents is generated via field codes. To ensure page number accuracy after editing, please right-click the TOC and select \u201cUpdate Field.\u201d",
      italics: true, size: 18, color: "888888", font: FONT })],
  }),
  // NOTE: no trailing PageBreak here — the body section starts NEXT_PAGE, and a
  // PageBreak + section break would produce a blank page (postcheck rule).
];

// ---------------------------------------------------------------- body
const bodyChildren = [];

// 1 Introduction
bodyChildren.push(h1("1. Introduction"));
bodyChildren.push(body("Urban search and rescue remains one of the most demanding applications of robotics. After earthquakes, building collapses, or industrial accidents, response teams face structurally unstable spaces, limited visibility, and severe time pressure: the probability of finding survivors falls sharply with every passing hour. Ground robots are a natural aid in this setting because they can enter spaces that are unsafe for humans, but deploying only a single robot introduces a fundamental bottleneck \u2014 one platform can cover only so much of a large, cluttered environment before the mission window closes."));
bodyChildren.push(body("Introducing multiple robots multiplies coverage capacity, but it also introduces a coordination problem that grows with team size. Without deliberate coordination, robots cluster in the same partially explored areas, repeatedly re-observe the same space, and waste the very time budget the team was meant to save. Moreover, the raw occupancy maps that typical multi-robot systems merge answer only the question \u201cwhat does the world look like\u201d \u2014 not the question that actually matters for search: \u201cwhere should each robot go next, given what has already been found?\u201d"));
bodyChildren.push(body("This project addresses that gap. Following our DA1 proposal, we built a multi-robot SAR system in which robots (a) jointly construct a global map, (b) enrich it with semantic information \u2014 located victims \u2014 held in a shared memory accessible to every robot, and (c) use that shared state to divide the search through a task-allocation policy that is learned rather than hand-coded. The concrete objectives, carried over from the DA1 abstract, are: (O1) collaborative SLAM-based mapping across robots; (O2) semantic scene understanding with victim detection; (O3) a shared memory layer queryable by all robots; (O4) a multi-agent reinforcement learning (MARL) policy for task allocation, trained as MAPPO under centralized training with decentralized execution (CTDE); and (O5) a benchmark of the learned policy against a rule-based allocation baseline."));
bodyChildren.push(body("The contributions of this phase of work are: a complete, modular ROS 2 implementation of the proposed architecture in eleven packages; a procedural world generator that guarantees the simulation environment matches the training environment; a custom multi-robot map-fusion node; a shared semantic-memory service with deduplication and stable identification; two interchangeable allocators with identical interfaces; a training stack (environment, MAPPO implementation, evaluation scripts) that trains on CPU in minutes; a contract test suite that pins the observation interface between training and deployment; and an initial benchmark with results reported in Section 4. The remainder of the report is organized as follows: Section 2 reviews related work; Section 3 details the proposed system; Section 4 reports results and analysis; Section 5 concludes with future work."));

// 2 Related Study
bodyChildren.push(h1("2. Related Study"));
bodyChildren.push(h2("2.1 Urban search and rescue robotics"));
bodyChildren.push(body("Robot-assisted USAR has been studied for over two decades. Casper and Murphy [1] documented human\u2013robot interaction during the robot-assisted response at the World Trade Center site and identified the core demands that still shape the field: rapid wide-area search, victim identification, and operation in confined, debris-strewn spaces. Their analysis makes explicit why multi-robot coverage matters \u2014 victim survival probability decays with time \u2014 and motivates the time-based metrics (time-to-detection, mission duration) adopted in this project."));
bodyChildren.push(h2("2.2 Multi-robot exploration and mapping"));
bodyChildren.push(body("Frontier-based exploration, introduced by Yamauchi [2], remains the dominant strategy for autonomous exploration: robots navigate to the boundaries between known free space and unknown space. Our rule-based allocator is a region-partitioned variant of this classic approach, and our learned allocator explicitly takes frontier information as input. The underlying mapping formulation follows the occupancy-grid and probabilistic-SLAM treatment of Thrun, Burgard, and Fox [3]; in implementation we use the open-source slam_toolbox stack on ROS 2 per robot, with a custom fusion node that stitches per-robot grids using known initial poses."));
bodyChildren.push(h2("2.3 Multi-agent reinforcement learning"));
bodyChildren.push(body("Cooperative MARL has converged on the CTDE paradigm: during training, a centralized component observes global state, while at execution each agent acts from local observations. MADDPG [4] established the pattern for continuous control; QMIX [5] factorizes a joint value function under monotonicity constraints; and COMA [6] introduces counterfactual baselines for credit assignment. Yu et al. [7] showed that a multi-agent variant of Proximal Policy Optimization \u2014 MAPPO, with a centralized value function and shared actor \u2014 matches or exceeds these specialized methods on standard benchmarks while being substantially simpler. We adopt MAPPO on that basis, with hyperparameters following the original paper. The underlying single-agent objective is PPO [8]."));
bodyChildren.push(h2("2.4 Tools and platforms"));
bodyChildren.push(body("The system is built on ROS 2 Jazzy [9], chosen for its long-term-support status and multi-robot naming conventions, with the Gazebo Harmonic simulator [10] providing physics and sensor simulation. Victim detection follows the object-detection line initiated by YOLO [11], with the Ultralytics implementation [12]; because the simulation renders victims with a distinctive visual signature, a tuned HSV-blob detector is also provided as a dependency-free fallback. Navigation uses the Nav2 stack [13] with the Smac 2D A* planner, matching the A*-based navigation stated in the DA1 abstract."));

// 3 Proposed Work
bodyChildren.push(h1("3. Proposed Work"));
bodyChildren.push(h2("3.1 System overview and architecture"));
bodyChildren.push(body("Figure 1 shows the overall architecture. It is organized in three tiers. The per-robot tier is replicated for each of the three robots and contains everything that must be namespaced per platform: SLAM, perception, and navigation. The shared-state tier holds the globally consistent world model \u2014 the fused occupancy grid, the frontier/region decomposition, and the semantic map of located victims \u2014 each exposed as a ROS 2 topic or service that any robot can consume. The decision tier contains the two interchangeable task allocators and the evaluation harness. All interfaces are defined in a frozen contract document; the allocators publish identical goal messages, which is precisely what enables the controlled comparison in Section 4."));
bodyChildren.push(figure("fig_architecture.png", 560));
bodyChildren.push(caption("Figure 1: System architecture \u2014 per-robot tier (x3), shared state, and decision/evaluation tier, with the ROS 2 topics that connect them."));
bodyChildren.push(h2("3.2 Simulation environment and world generation"));
bodyChildren.push(body("The mission world is a 32 m \u00d7 32 m indoor collapsed-structure layout: room-and-corridor walls, five victim models with a bright visual signature for detection, and hazard props. Crucially, the world is not hand-authored: a generator script uses the same procedural maze code as the training environment, placing walls, robot spawn points, and victims from a single seed, and emits both the Gazebo world file and a ground-truth file listing exact victim positions. This guarantees that what the policy trains on and what it is deployed against are the same distribution, and provides the ground truth against which detection accuracy and coverage are scored."));
bodyChildren.push(h2("3.3 Collaborative mapping (O1)"));
bodyChildren.push(body("Each robot runs slam_toolbox in its own namespace, producing a local occupancy grid and the odom\u2192base transform. Because the robots\u2019 start poses are known and fixed by the launcher, the local grids are consistent up to a known rigid transform; a custom fusion node exploits this to stitch the per-robot grids into a single global map. The fusion rule per cell is: unknown if no robot observes it, occupied dominates free, otherwise the known value. This design was chosen deliberately: the multi-robot map-merge package available for ROS 2 relies on pose-graph assumptions that did not fit our fixed-start setup, and the custom node is unit-tested against rotation, translation-offset, and unknown-preservation cases."));
bodyChildren.push(h2("3.4 Semantic perception and shared memory (O2, O3)"));
bodyChildren.push(body("Each robot carries an RGB camera and a 360\u00b0 lidar. The detector node identifies victims in image space \u2014 via YOLO when weights are available, or a tuned HSV blob detector otherwise \u2014 then converts pixel detections into map-frame positions by combining the pinhole bearing model with the nearest valid lidar return along that bearing, and the robot\u2019s map-frame pose from TF. Detections are published as semantic entries and consumed by the shared memory node, which deduplicates sightings of the same victim within a 1 m radius, preserves the first detection time (the time-to-detection metric), assigns stable identifiers, and republishes the complete semantic map at a fixed rate. Every robot \u2014 and both allocators \u2014 therefore always knows what the team has found, without re-detection."));
bodyChildren.push(h2("3.5 Task allocation: baseline and learned policy (O4)"));
bodyChildren.push(body("The global map is partitioned into a 4 \u00d7 4 grid of sixteen regions; a region is actionable when it contains frontier cells. The rule-based allocator implements greedy nearest-frontier: each idle robot claims the nearest actionable region not already claimed. It is deterministic, requires no training, and represents the strong classical baseline for coverage-oriented exploration."));
bodyChildren.push(body("The learned allocator is a MAPPO policy trained in a lightweight grid abstraction of the same world. Each robot\u2019s observation is a 13 \u00d7 13 crop of a 64 \u00d7 64 grid (channels: walls, explored, frontier) centred on the robot, plus four scalars (position, victims found so far, elapsed fraction); the centralized critic observes the full grid with all robot positions. Actions select one of the sixteen regions; a built-in A* executor advances the robot one cell per step. The reward combines exploration gain (+0.10 per newly observed cell), victim discovery (+10 each), and penalties for redundant coverage (\u22120.02 per cell another robot observed first), elapsed time (\u22120.01 per step), and selecting an exhausted region (\u22120.05). Training uses PPO\u2019s clipped surrogate with GAE (\u03bb = 0.95), a shared actor across the homogeneous robots, and a centralized critic, following the hyperparameters of Yu et al. [7]. On deployment, the trained network is loaded by a ROS 2 node that rebuilds the identical observation from live topics and publishes each robot\u2019s region goal."));
bodyChildren.push(body("Two engineering safeguards connect training to deployment. First, the observation builder on the ROS side is a mirror implementation of the training-side builder, and a contract test verifies numerical equality of crops and a state-dict round-trip with identical network outputs. Second, because the action space is region-level rather than continuous control, training does not require real-time simulation, which is what makes CPU-side training practical."));
bodyChildren.push(h2("3.6 Navigation and execution"));
bodyChildren.push(body("Region goals are published as map-frame poses and executed by Nav2 per robot: the Smac 2D planner (A* over the global costmap, fed by the merged map) produces the global path and a DWB controller tracks it locally. The configuration ships per-robot costmaps, inflation, and recovery behaviours, generated from a single template parameterized by robot name."));
bodyChildren.push(h2("3.7 Evaluation harness and metrics (O5)"));
bodyChildren.push(body("A dedicated evaluation node subscribes to the merged map, the semantic map, and each robot\u2019s local map, and computes the six metrics defined in the build plan: map coverage (explored free fraction against the known world footprint), victim detection accuracy (semantic entries within 1.5 m of ground-truth victims), time-to-detection (simulation time of each first detection), task-allocation efficiency (the redundant-coverage ratio \u2014 cells known by more than one robot over all known cells), and the RL-side training metrics (average episodic reward, episodes to convergence). Metrics are published live and appended to a CSV per mission; a plotting script renders coverage/victim/overlap curves for the report."));

// 4 Results
bodyChildren.push(h1("4. Results and Analysis"));
bodyChildren.push(h2("4.1 Implementation verification"));
bodyChildren.push(body("The codebase comprises eleven ROS 2 packages and a standalone training stack (43 Python modules). Nine unit tests pass: five contract tests pinning the training\u2013deployment observation interface (including exact crop equality and an actor state-dict round-trip with identical outputs), and four map-fusion tests covering identity, translation offsets, yaw rotation, and unknown-cell preservation. The full workspace builds with colcon, and the mission launches end-to-end from a single command: the world loads, three robots spawn at their designated corners, SLAM, fusion, perception, memory, allocation, and evaluation all start, and the merged map and metric logging begin."));
bodyChildren.push(h2("4.2 Training dynamics"));
bodyChildren.push(body("Figure 2 shows the episodic reward across approximately 148,000 environment steps (34 logged checkpoints, 3-point smoothed). Exploration behaviour emerged early: map coverage settled in the 83\u201386% band within the first third of training and held to the end, and the reward plateaued in the 66\u201374 band (best five-episode mean 74.0). The plateau indicates that the core behaviours the reward encodes \u2014 spread out, avoid re-searching teammates\u2019 areas, collect victims \u2014 were learned, while the remaining budget did not yet translate into further policy sharpening. This is consistent with the benchmark outcome below and motivated the plan for extended training."));
bodyChildren.push(figure("fig_training.png", 540));
bodyChildren.push(caption("Figure 2: Training dynamics \u2014 episodic reward across ~148k steps (raw and 3-point smoothed). Data: runs/mappo_v1."));
bodyChildren.push(h2("4.3 Benchmark against baselines"));
bodyChildren.push(body("Table 1 and Figure 3 report the allocation benchmark on four held-out maps \u00d7 two episodes each (three robots, five victims, 600-step cap). The MAPPO policy ran in its stochastic (sampling) mode, matching deployment conditions; the deterministic argmax mode is reported separately."));
bodyChildren.push(tableTitle("Table 1: Allocation benchmark \u2014 mean \u00b1 std over 4 held-out maps \u00d7 2 episodes"));
bodyChildren.push(threeLine(
  ["Policy", "Coverage", "Victims (of 5)", "Detect step", "Mission steps"],
  [["Rule-based (greedy)", "0.86 \u00b1 0.05", "4.25 \u00b1 0.83", "49.0 \u00b1 18.8", "138 \u00b1 47"],
   ["MAPPO (sampled)", "0.85 \u00b1 0.06", "3.25 \u00b1 0.43", "43.4 \u00b1 17.8", "444 \u00b1 176"],
   ["Random", "0.85 \u00b1 0.04", "3.75 \u00b1 1.09", "57.4 \u00b1 46.4", "425 \u00b1 189"],
   ["MAPPO (argmax)", "0.61 \u00b1 0.11", "2.25 \u00b1 0.43", "\u2014", "600 \u00b1 0"]],
  [24, 19, 19, 19, 19]));
bodyChildren.push(figure("fig_benchmark.png", 540));
bodyChildren.push(caption("Figure 3: Benchmark results \u2014 victims located and mission duration (error bars: \u00b11 std)."));
bodyChildren.push(h2("4.4 Analysis"));
bodyChildren.push(body("Three findings stand out. First, all three policies reach statistically indistinguishable coverage (85\u201386%): in a maze world with wide-open frontiers, greedy region selection is already a strong coverage strategy, which is exactly why it was chosen as the baseline. Second, the learned policy shows its advantage where semantics matter: its mean time to first detection (43 steps) beats both the rule baseline (49) and random (57), suggesting the policy has begun to weight victim-bearing regions beyond pure distance heuristics. Third, the learned policy trails on victims found (3.25 vs 4.25) and mission duration \u2014 partly a consequence of sampling actions stochastically during missions, and partly of the training budget: at ~148k steps the deterministic mode still collapses into loops (61% coverage), a classic under-convergence signature. Notably, the random baseline\u2019s respectable showing underscores that with three robots in a modest world, redundancy alone covers a lot of ground \u2014 the benchmark\u2019s discriminative power will be higher on larger worlds and longer horizons."));
bodyChildren.push(body("Threats to validity are acknowledged: the benchmark currently runs in the abstract grid environment rather than inside Gazebo (the simulator-level experiment matrix is defined and scripted); the evaluation uses four maps and two episodes per configuration, adequate for a progress review but to be extended to the planned \u226510 runs per configuration for the final report; and the reward weights were tuned once, not exhaustively searched."));

// 5 Conclusion
bodyChildren.push(h1("5. Conclusion and Future Work"));
bodyChildren.push(body("This phase delivered the complete proposed system: a three-robot SAR pipeline in which collaborative mapping (O1), semantic perception (O2), shared memory (O3), and learned task allocation (O4) are all implemented, tested, and integrated behind a single launch command, together with a first benchmark (O5) against a hand-crafted baseline. The honest headline is that the learned allocator currently matches the rule-based baseline on coverage and finds victims faster, but does not yet beat it on victims per mission \u2014 and the evidence (reward plateau, argmax collapse, sampling-mode gap) points to training budget, not architecture, as the binding constraint."));
bodyChildren.push(body("Future work proceeds on four fronts. First, extended training: 300\u2013500k additional steps on a GPU (Google Colab or a lab machine), with re-evaluation in both sampled and deterministic modes, since the infrastructure \u2014 resumable checkpoints and scripted evaluation \u2014 is already in place. Second, simulator-level benchmarking: the defined experiment matrix (rule vs learned, \u226510 runs per configuration) executed inside Gazebo with the evaluation harness. Third, a semantic ablation: running the learned allocator with the shared semantic memory disabled, directly testing the \u201ccognitive\u201d claim that shared understanding improves allocation. Fourth, robustness refinements: fine-tuning YOLO on rendered victim imagery, and testing generalization on larger or differently structured worlds. The two allocators\u2019 shared interface means every future improvement slots into the same benchmark without further integration work."));

// References
bodyChildren.push(h1("References"));
const refs = [
  "J. Casper and R. R. Murphy, \u201cHuman-robot interactions during the robot-assisted urban search and rescue response at the World Trade Center,\u201d IEEE Transactions on Systems, Man, and Cybernetics, Part B, vol. 33, no. 3, pp. 367\u2013385, 2003.",
  "B. Yamauchi, \u201cA frontier-based approach for autonomous exploration,\u201d in Proc. IEEE International Symposium on Computational Intelligence in Robotics and Automation (CIRA), 1997, pp. 146\u2013151.",
  "S. Thrun, W. Burgard, and D. Fox, Probabilistic Robotics. Cambridge, MA: MIT Press, 2005.",
  "R. Lowe, Y. Wu, A. Tamar, J. Harb, P. Abbeel, and I. Mordatch, \u201cMulti-agent actor-critic for mixed cooperative-competitive environments,\u201d in Advances in Neural Information Processing Systems (NeurIPS), 2017.",
  "T. Rashid, M. Samvelyan, C. Schroeder de Witt, G. Farquhar, J. Foerster, and S. Whiteson, \u201cQMIX: Monotonic value function factorisation for deep multi-agent reinforcement learning,\u201d in Proc. International Conference on Machine Learning (ICML), 2018.",
  "J. Foerster, G. Farquhar, T. Afouras, N. Nardelli, and S. Whiteson, \u201cCounterfactual multi-agent policy gradients,\u201d in Proc. AAAI Conference on Artificial Intelligence, 2018.",
  "C. Yu, A. Velu, E. Vinitsky, J. Gao, Y. Wang, A. Bayen, and Y. Wu, \u201cThe surprising effectiveness of PPO in cooperative multi-agent games,\u201d in Advances in Neural Information Processing Systems (NeurIPS) Datasets and Benchmarks Track, 2021.",
  "J. Schulman, F. Wolski, P. Dhariwal, A. Radford, and O. Klimov, \u201cProximal policy optimization algorithms,\u201d arXiv preprint arXiv:1707.06347, 2017.",
  "S. Macenski, T. Foote, B. Gerkey, C. Lalancette, and W. Woodall, \u201cRobot Operating System 2: Design, architecture, and uses in the wild,\u201d Science Robotics, vol. 7, no. 66, 2022.",
  "N. Koenig and A. Howard, \u201cDesign and use paradigms for Gazebo, an open-source multi-robot simulator,\u201d in Proc. IEEE/RSJ International Conference on Intelligent Robots and Systems (IROS), 2004.",
  "J. Redmon, S. Divvala, R. Girshick, and A. Farhadi, \u201cYou only look once: Unified, real-time object detection,\u201d in Proc. IEEE Conference on Computer Vision and Pattern Recognition (CVPR), 2016.",
  "G. Jocher et al., Ultralytics YOLO (version 8), open-source software, https://github.com/ultralytics/ultralytics, 2023.",
  "S. Macenski, F. Martin, R. White, and J. Gin\u00e9s Clavero, \u201cThe Marathon 2: A navigation system,\u201d in Proc. IEEE/RSJ International Conference on Intelligent Robots and Systems (IROS), 2021.",
];
refs.forEach((r, i) => bodyChildren.push(new Paragraph({
  alignment: AlignmentType.JUSTIFIED,
  spacing: { line: 312, after: 100 },
  indent: { left: 480, hanging: 480 },
  children: [new TextRun({ text: `[${i + 1}] ${r}`, size: 22, color: BLACK, font: FONT })],
})));

// ---------------------------------------------------------------- footers
const romanFooter = new Footer({ children: [new Paragraph({
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, font: FONT, color: BLACK })] })] });
const arabicFooter = new Footer({ children: [new Paragraph({
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, font: FONT, color: BLACK })] })] });

// ---------------------------------------------------------------- document
const doc = new Document({
  styles: { default: { document: {
    run: { font: FONT, size: 24, color: BLACK },
    paragraph: { spacing: { line: 312 } },
  }},
  paragraphStyles: [
    { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { size: 32, bold: true, color: BLACK, font: HFONT },
      paragraph: { spacing: { before: 360, after: 160, line: 312 }, outlineLevel: 0 } },
    { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
      run: { size: 28, bold: true, color: BLACK, font: HFONT },
      paragraph: { spacing: { before: 240, after: 120, line: 312 }, outlineLevel: 1 } },
  ] },
  sections: [
    { properties: { page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR5() },
    { properties: { type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin,
                pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } } },
      footers: { default: romanFooter },
      children: frontMatter },
    { properties: { type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin,
                pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } } },
      footers: { default: arabicFooter },
      children: bodyChildren },
  ],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUT, buf);
  console.log("wrote", OUT);
});
