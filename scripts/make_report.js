/* Academic project report generator (human-voice revision).
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
const body = (text) => new Paragraph({
  alignment: AlignmentType.JUSTIFIED,
  spacing: { line: 312, after: 120 },
  children: [new TextRun({ text, size: 24, color: BLACK, font: FONT })],
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
      children: [new TextRun({ text: "Project Report (Design Assignment 2)",
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
  body("Robots are increasingly used to look for survivors after earthquakes and building collapses, but almost always one robot at a time. That is slow. The search area after a disaster is large, the window in which survivors can be saved is short, and a single robot covering one corridor at a time wastes most of it. Simply adding more robots does not fix things either, because without proper coordination the robots crowd into the same half-explored rooms and re-search each other's ground. This report presents a three-robot search and rescue system that we designed, built and tested completely in simulation on ROS 2 Jazzy with the Gazebo Harmonic simulator. Each robot maps its surroundings with lidar SLAM, the individual maps are fused into one global map, and a camera based detector reports the map position of any victim it sees. All of these findings land in a shared semantic map that every robot can read, so nothing gets located twice. To decide who searches where, we built two allocators behind the same interface: a plain greedy nearest-frontier rule, and a task allocation policy learned with multi-agent reinforcement learning (MAPPO, centralized training with decentralized execution). The learned policy trains in minutes on a CPU in a simplified grid version of the world, and the reported run took 46 minutes on a free Colab GPU. On held-out test maps the learned policy, run in its deployment mode, matched the greedy rule on map coverage (86% against 83%) and came within noise on victims per mission (3.75 against 3.92 of 5), while the greedy rule still completes missions faster (196 against 357 steps). Two further results shape the story. The three-robot team decisively outperforms single-robot search (83 to 89% coverage against 27 to 42%), which is the multi-robot claim from the abstract. And two deliberately simple commitment heuristics we added as honesty baselines \u2014 keep your region until it is exhausted, and do not poach a teammate's \u2014 set the mission-time bar (139 to 187 steps); we report and analyse them rather than hide them. The remaining work (a still longer GPU run, benchmarks inside Gazebo itself, and an ablation without the semantic map) is already set up."),
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
];

// ---------------------------------------------------------------- body
const bodyChildren = [];

// 1 Introduction
bodyChildren.push(h1("1. Introduction"));
bodyChildren.push(body("After an earthquake or a building collapse, the first couple of days decide almost everything. Rescue teams have to search a large, unstable, poorly lit area, and every hour spent walking down a corridor that has already been checked is an hour not spent somewhere else. Ground robots can help here because they can go where it is unsafe for humans, but in practice they are still mostly used one at a time. One robot maps one corridor at a time, and the maths simply does not work for a large site."));
bodyChildren.push(body("The obvious answer is to use several robots at once. The catch is that several robots, each naively exploring on its own, tend to behave like several people searching a building without talking to each other: they drift toward the same open areas, cover the same ground twice, and leave whole wings unchecked. We saw exactly this behaviour in early tests of our own simulator before any coordination was added. So the real problem is not mapping, and it is not driving; it is deciding, continuously and collectively, which parts of the building still need attention."));
bodyChildren.push(body("That is the problem this project takes on. Following our DA1 proposal, we built a multi-robot search and rescue system in simulation with five concrete goals: (O1) the robots should build one shared map from their individual SLAM maps; (O2) they should recognize victims with a camera and work out where those victims are on the map; (O3) all of these discoveries should live in a shared memory that every robot can query; (O4) the choice of which region each robot searches next should be made by a policy that is learned with multi-agent reinforcement learning rather than written by hand; and (O5) that learned policy should be benchmarked against a hand-written rule to find out whether the learning actually pays."));
bodyChildren.push(body("What has come out of this phase so far: eleven ROS 2 packages and a standalone training stack, all in one repository; a world generator that keeps the simulator and the training environment consistent by construction; our own map fusion node after the available package turned out not to fit our setup; a shared semantic memory with deduplication; two interchangeable allocators; a contract test suite that stops the trained policy and the deployed one from drifting apart; and a first round of benchmark results, reported in Section 4. The report is arranged as follows: Section 2 covers earlier work, Section 3 explains what we built and why, Section 4 gives results and an honest analysis of them, and Section 5 concludes."));

// 2 Related Study
bodyChildren.push(h1("2. Related Study"));
bodyChildren.push(h2("2.1 Urban search and rescue robotics"));
bodyChildren.push(body("Robot assisted rescue has a longer history than most people assume. Casper and Murphy studied the robots that were actually sent into the World Trade Center rubble in 2001 and wrote up what worked and what did not [1]. Their conclusions shaped our metric choices more than anything else we read: what matters in a rescue is not elegance but time, so we measure time-to-detection and total mission time, not just coverage percentages."));
bodyChildren.push(h2("2.2 Multi-robot exploration and mapping"));
bodyChildren.push(body("For the exploration itself, the idea that still underpins nearly everything is Yamauchi's frontier based approach from 1997 [2]: keep driving toward the boundary between what the robot has seen and what it has not. Both of our allocators, learned and hand-written, work on top of frontier information extracted from the merged map. For the mapping we followed the occupancy grid and SLAM treatment in Thrun, Burgard and Fox's book [3], using the open source slam_toolbox package on each robot and fusing the resulting grids ourselves (Section 3.3 explains why we did not use the existing multi-robot merge package)."));
bodyChildren.push(h2("2.3 Multi-agent reinforcement learning"));
bodyChildren.push(body("The standard recipe for cooperative multi-agent learning these days is centralized training with decentralized execution: let a critic see everything while the policy is being learned, but let each agent act on only its own view once deployed. MADDPG established the pattern for continuous actions [4], QMIX factors the joint value function under a monotonicity constraint [5], and COMA attacks the credit assignment problem with counterfactual baselines [6]. Then Yu et al. showed something almost embarrassing: plain PPO, run on each agent with a centralized value critic, matches or beats these purpose-built methods on most cooperative benchmarks [7]. We took them at their word and built our allocator as MAPPO, with hyperparameters from their paper, on top of the standard PPO objective [8]."));
bodyChildren.push(h2("2.4 Tools and platforms"));
bodyChildren.push(body("Everything runs on ROS 2 Jazzy [9], which we picked mainly for its long support window and its clean handling of multiple robots in one namespace, and Gazebo Harmonic [10] for physics and sensors. Victim detection follows the YOLO line of work [11]; we use the Ultralytics implementation [12] when weights are available, with a tuned HSV blob detector as a fallback because our simulated victims have a very strong colour signature. Navigation is Nav2 [13] with the Smac 2D planner, which is an A* planner and therefore matches what we wrote in the DA1 abstract."));

// 3 Proposed Work
bodyChildren.push(h1("3. Proposed Work"));
bodyChildren.push(h2("3.1 System overview and architecture"));
bodyChildren.push(body("Figure 1 shows how the system fits together. There are three layers. Everything that must exist once per robot (SLAM, camera detection, navigation) lives in a namespaced copy on each of the three robots. Everything that should exist once for the team (the fused map, the region decomposition, the semantic memory of found victims) sits in the middle, published on topics any robot can read. The decision layer holds the two allocators and the evaluation node. The important design decision is at the bottom of the diagram: both allocators publish exactly the same goal message type on the same topics. Swapping one brain for the other is a launch option, nothing more, and that is what makes the comparison in Section 4 fair."));
bodyChildren.push(figure("fig_architecture.png", 560));
bodyChildren.push(caption("Figure 1: System architecture. Each block is an implemented ROS 2 node; arrows are actual topics."));
bodyChildren.push(h2("3.2 Simulation environment and world generation"));
bodyChildren.push(body("The test world is a 32 m by 32 m indoor maze with rooms, corridors, five victim figures and some hazard props. We did not draw it by hand. A generator script produces the floor plan procedurally, places the robots in separated corners and the victims well away from the spawns, and writes out both the Gazebo world file and a ground-truth file with the exact victim coordinates. Because the training environment is generated from the very same code, what the policy practises on and what it gets deployed against cannot silently diverge. This part took a few attempts to get right, incidentally: our first generated world did not even load, because Gazebo 8 refuses visual elements without a name attribute, which is the kind of strictness you only discover by running it."));
bodyChildren.push(h2("3.3 Collaborative mapping (O1)"));
bodyChildren.push(body("Each robot runs slam_toolbox in its own namespace and produces its own occupancy grid. Joining three grids into one is the job of the merge node. There is an existing package for this (multirobot_map_merge), but it makes assumptions about pose graphs that did not match our setup, where the robots' start poses are known and fixed by the launcher. So we wrote a small fusion node of our own: since the start poses are known, each local grid is consistent up to one rigid transform, and the merge becomes a coordinate transformation plus a per-cell rule (unknown if nobody has seen it, occupied beats free otherwise). It is unit tested against translation offsets, rotation, and unknown-preservation, which caught two real bugs during development."));
bodyChildren.push(h2("3.4 Semantic perception and shared memory (O2, O3)"));
bodyChildren.push(body("Each robot carries an RGB camera and a 360 degree lidar. When the detector sees something victim-shaped in an image, it needs to answer a second question: where is that thing on the map? We combine the pinhole camera model (which gives a bearing) with the nearest valid lidar return along that bearing (which gives a range), then transform into the map frame using the robot's pose. Detections are published as semantic entries and flow into the shared memory node, which does three small but important jobs: it merges repeat sightings of the same victim within a one metre radius, it remembers the time of the first sighting (this is our time-to-detection metric), and it assigns every victim a stable ID. After that, every robot and both allocators simply know what the team has found."));
bodyChildren.push(h2("3.5 Task allocation: baseline and learned policy (O4)"));
bodyChildren.push(body("The global map is cut into a 4 by 4 grid of sixteen regions, and a region counts as actionable while it still contains frontier cells. The baseline allocator is deliberately simple: each idle robot takes the nearest actionable region nobody has claimed. It is deterministic, needed no training, and turns out to be annoyingly hard to beat, which Section 4 discusses."));
bodyChildren.push(body("The learned allocator is a MAPPO policy trained on a grid abstraction of the same world. Each robot's observation is a 13 by 13 cell crop (walls, explored space, frontiers) centred on its own position, plus a 52-value vector: the robot's position, victims found so far and elapsed mission fraction, the relative frontier mass of each of the sixteen regions, the regions its teammates have claimed this decision round, and its own previous assignment. The centralized critic sees the whole 64 by 64 grid with every robot marked on it. An action selects one of the sixteen regions, and a built-in A* executor walks the robot there, re-targeting immediately whenever the allocator changes a robot's assignment. Two details make the coordination real rather than nominal. Robots choose regions one at a time in random order, and each robot sees the regions chosen before it in the same round, so duplicate assignments are prevented structurally instead of merely penalised. And actions on exhausted regions are masked out before selection, in training and deployment alike. The reward gives +0.10 per newly explored cell and +10 per victim, and takes away 0.002 for every cell sensed simultaneously by a teammate, 0.2 for sending two robots to the same region in one round, 0.05 per time step, and 0.05 for picking a finished region (which masking makes rare); rewards are scaled by 0.1 before PPO sees them. We used the hyperparameters from the MAPPO paper directly rather than tuning our own, with one deliberate deviation: the critic's value loss is a plain squared error, because the usual clipped variant assumes normalised returns and quietly paralysed our critic. Two practical points drove the overall design. First, a policy that chooses regions does not need physics-rate simulation, so training runs against the cheap grid world in minutes (our first runs were on a laptop with no GPU at all; the reported run took 46 minutes on a free Colab GPU). Second, whatever the policy learned must survive the trip into ROS 2, so the deployed node rebuilds the same observation from live topics and runs the same sequential selection, and a contract test verifies that the two implementations agree numerically and that the trained network loads into the deployment copy with identical outputs."));
bodyChildren.push(h2("3.6 Navigation and execution"));
bodyChildren.push(body("Region goals are plain map-frame poses, and Nav2 does the rest: the Smac 2D planner (A* over the merged map) produces the global path and a DWB controller follows it. Costmaps, inflation and recovery behaviours are configured once in a template and stamped out per robot by the launcher, since the three robots differ only in name."));
bodyChildren.push(h2("3.7 Evaluation harness and metrics (O5)"));
bodyChildren.push(body("A dedicated evaluation node watches the merged map, the semantic map and each robot's individual map, and computes the six metrics we fixed in the build plan: map coverage against the known world footprint, victim detection accuracy against the ground-truth file, time-to-detection, a redundant-coverage ratio (cells seen by two or more robots over all cells seen), and on the training side, average episodic reward and episodes to convergence. Everything is appended to a CSV while the mission runs, and a plotting script turns those CSVs into the figures in this report."));

// 4 Results
bodyChildren.push(h1("4. Results and Analysis"));
bodyChildren.push(h2("4.1 Implementation verification"));
bodyChildren.push(body("The final repository holds eleven ROS 2 packages, the training stack (43 Python modules in total), and ten passing unit tests. Six of those tests pin the training-to-deployment interface (identical crops, the 52-value observation layout, the sequential selection mechanism, and a network checkpoint that produces identical outputs on both sides), and four test the map fusion maths. The workspace builds with colcon, and the whole mission comes up from one launch command. Getting three robots up simultaneously took several rounds of debugging; the memorable failures were a slam_toolbox executable that changed names between versions and Gazebo 8's strict SDF naming, and those experiences are the reason the contract tests exist."));
bodyChildren.push(h2("4.2 Training dynamics"));
bodyChildren.push(body("Figure 2 shows the final training run: 200,000 steps on a free Colab GPU (48 logged checkpoints), trained under the corrected executor and reward semantics described in Section 3.5. Two honest notes on how to read it. First, the raw episodic reward is negative throughout, which looks alarming but is just arithmetic: the corrected reward weights charge 0.05 per step and add duplicate-allocation penalties, so a slow mission accumulates a large negative sum even while doing good work; the informative series is the coverage trace underneath. Second, that coverage trace settled into the 80 to 87 percent band after a noisy first quarter, and the policy's entropy declined steadily from about 2.1 to below 0.5, meaning the policy was still sharpening when the run ended \u2014 it had not finished converging. The learning-curve story we can defend is therefore: the core exploration behaviour (spread out, avoid teammates, collect victims) is learned and stable, and the policy was still improving at the budget we stopped."));
bodyChildren.push(figure("fig_training.png", 520));
bodyChildren.push(caption("Figure 2: Final training run (200k steps, corrected semantics) \u2014 episodic team reward and map coverage per logged checkpoint. Data: runs/mappo_v6."));
bodyChildren.push(h2("4.3 Benchmark against baselines"));
bodyChildren.push(body("Table 1 and Figure 3 give the allocation benchmark: six held-out maps, four episodes each, three robots, five victims, a 600 step cap \u2014 24 episodes per policy. The MAPPO row uses stochastic sampling, the mode the deployed node actually runs; the deterministic (argmax) mode is listed separately because it behaves very differently. Alongside the original baselines we evaluated two deliberately simple commitment heuristics (sticky-unclaimed keeps a region until it is exhausted and never takes one a teammate holds), because our first benchmark round showed how much a policy can gain from mere persistence."));
bodyChildren.push(tableTitle("Table 1: Three-robot benchmark, mean \u00b1 std over 6 held-out maps \u00d7 4 episodes"));
bodyChildren.push(threeLine(
  ["Policy (3 robots)", "Coverage", "Victims (of 5)", "Detect step", "Mission steps"],
  [["MAPPO (sampled)", "0.86 \u00b1 0.06", "3.75 \u00b1 0.66", "56.5 \u00b1 59.0", "357 \u00b1 200"],
   ["MAPPO (argmax)", "0.76 \u00b1 0.12", "3.33 \u00b1 0.80", "22.5 \u00b1 20.6", "507 \u00b1 183"],
   ["Rule-based (greedy)", "0.83 \u00b1 0.12", "3.92 \u00b1 0.95", "29.4 \u00b1 19.1", "196 \u00b1 184"],
   ["Sticky-unclaimed", "0.89 \u00b1 0.04", "4.08 \u00b1 0.64", "31.4 \u00b1 17.3", "139 \u00b1 101"],
   ["Sticky-random", "0.89 \u00b1 0.03", "4.00 \u00b1 0.71", "41.7 \u00b1 24.1", "187 \u00b1 161"],
   ["Random (masked)", "0.71 \u00b1 0.10", "3.04 \u00b1 1.06", "35.8 \u00b1 41.1", "581 \u00b1 63"],
   ["Random", "0.68 \u00b1 0.08", "2.79 \u00b1 0.82", "22.2 \u00b1 40.9", "600 \u00b1 0"]],
  [24, 19, 19, 19, 19]));
bodyChildren.push(figure("fig_benchmark.png", 560));
bodyChildren.push(caption("Figure 3: Victims located and mission duration for the six allocators (error bars are one standard deviation)."));
bodyChildren.push(body("Table 2 isolates the multi-robot claim from the abstract: the same allocators run with one robot instead of three. Every three-robot configuration outperformed every single-robot configuration \u2014 the weakest three-robot result (MAPPO in argmax mode, 76% coverage) still beats the strongest single-robot result (sticky-unclaimed, 42%)."));
bodyChildren.push(tableTitle("Table 2: Single-robot vs three-robot teams (sampled mode), coverage and victims"));
bodyChildren.push(threeLine(
  ["Policy", "1 robot: cov / victims", "3 robots: cov / victims"],
  [["MAPPO", "0.27 \u00b1 0.18 / 0.96 \u00b1 0.73", "0.86 \u00b1 0.06 / 3.75 \u00b1 0.66"],
   ["Rule-based (greedy)", "0.29 \u00b1 0.23 / 1.21 \u00b1 1.12", "0.83 \u00b1 0.12 / 3.92 \u00b1 0.95"],
   ["Sticky-unclaimed", "0.42 \u00b1 0.28 / 1.58 \u00b1 1.29", "0.89 \u00b1 0.04 / 4.08 \u00b1 0.64"],
   ["Random", "0.35 \u00b1 0.10 / 0.96 \u00b1 0.54", "0.68 \u00b1 0.08 / 2.79 \u00b1 0.82"]],
  [28, 36, 36]));
bodyChildren.push(h2("4.4 Analysis"));
bodyChildren.push(body("Four findings are worth dwelling on. First, the multi-robot claim from our abstract holds without qualification: three robots cover 83 to 89 percent of the maze where one robot manages 27 to 42 percent, and locate three to four victims where one locates about one. No configuration choice changes this conclusion. Second, the learned policy, run the way we actually deploy it, has caught up with the hand-crafted rule: coverage 86 against 83 percent and victims 3.75 against 3.92, differences well inside one standard deviation. The classic claim from our abstract \u2014 that a learned policy should beat a hand-coded one \u2014 is therefore supported at the level of parity, not dominance. Third, the surprise of the benchmark is the sticky baselines: keep your region until it is exhausted, never poach a teammate's, and you finish missions in 139 steps where the rule needs 196 and the learned policy 357, while also covering the most ground. Commitment plus mutual exclusion, neither of which the classic greedy rule has, matters more than clever region choice at this map size. Our sequential-selection mechanism already builds commitment into the learned policy's decision structure; the benchmark suggests the next iteration should keep that structure and learn only when to break commitment. Fourth, the learned policy in deterministic mode still trails its sampled self (76 against 86 percent coverage, and half the episodes hitting the step cap), so the argmax mode had not fully sharpened at 200k steps \u2014 consistent with the entropy still declining at the end of training."));
bodyChildren.push(body("We should also be candid about what this benchmark is not. It runs in the abstract grid environment, not inside Gazebo; the simulator-level experiment matrix is written down and scripted but not yet executed. Twenty-four episodes per configuration is adequate for these effect sizes but should be extended for the final report. And the reward weights were set once by hand, not searched. None of these change the qualitative picture, but all of them will be addressed in the remaining time."));

// 5 Conclusion
bodyChildren.push(h1("5. Conclusion and Future Work"));
bodyChildren.push(body("The system we proposed in DA1 now exists. Three robots map together (O1), detect victims and share the findings through one semantic memory (O2, O3), and divide the search using a policy that learned the job from rewards rather than rules (O4), all behind a single launch command with the benchmark harness (O5) running beside it. Where the learned allocator stands today: level with or slightly ahead of the hand-crafted rule on coverage, within noise on victims found, behind on mission time \u2014 and behind the simple commitment heuristics our own benchmark surfaced, which is a finding we report proudly rather than bury. We consider the remaining gap a training-budget and commitment-integration problem, not a design problem: the policy was still sharpening when the run ended, the infrastructure to continue it (resumable training, scripted evaluation, swappable allocators) is already built and tested, and the sequential-selection mechanism that prevents duplicate assignment is exactly the structure a commitment-aware policy needs."));
bodyChildren.push(body("Four things come next, roughly in order. A GPU training run of 300 to 500 thousand steps (Google Colab or a lab machine; the checkpoint resume path is already in place), re-benchmarked in both sampled and deterministic modes. The same benchmark executed inside Gazebo rather than the grid world. An ablation that removes the shared semantic memory from the learned allocator's inputs, which is the direct test of whether shared understanding actually improves allocation; if it does, that single result supports the title of this project better than anything else we could measure. And finally, robustness work: fine-tuning the YOLO detector on rendered victims and testing generalization on worlds the policy has never seen. Because both allocators share one interface, every improvement drops into the same benchmark with no further integration work."));

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
