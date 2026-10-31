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
  body("Robots are increasingly used to look for survivors after earthquakes and building collapses, but almost always one robot at a time. That is slow. The search area after a disaster is large, the window in which survivors can be saved is short, and a single robot covering one corridor at a time wastes most of it. Simply adding more robots does not fix things either, because without proper coordination the robots crowd into the same half-explored rooms and re-search each other's ground. This report presents a three-robot search and rescue system that we designed, built and tested completely in simulation on ROS 2 Jazzy with the Gazebo Harmonic simulator. Each robot maps its surroundings with lidar SLAM, the individual maps are fused into one global map, and a camera based detector reports the map position of any victim it sees. All of these findings land in a shared semantic map that every robot can read, so nothing gets located twice. To decide who searches where, we built two allocators behind the same interface: a plain greedy nearest-frontier rule, and a task allocation policy learned with multi-agent reinforcement learning (MAPPO, centralized training with decentralized execution). The learned policy trains in minutes on a CPU in a simplified grid version of the world. On held-out test maps it matched the greedy rule on map coverage (85% against 86%) and found its first victims faster (43 steps against 49), though at the training budget we managed (~148k steps) it still trails the rule on total victims per mission (3.25 against 4.25 of 5). We believe the gap comes from training time rather than the design, and the next steps (a longer GPU run, benchmarks inside Gazebo itself, and an ablation without the semantic map) are already set up."),
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
bodyChildren.push(body("The learned allocator is a MAPPO policy trained on a grid abstraction of the same world. Each robot's observation is a 13 by 13 cell crop (walls, explored space, frontiers) centred on its own position, plus four scalars; the centralized critic sees the whole 64 by 64 grid with every robot marked on it. An action selects one of the sixteen regions, and a built-in A* executor walks the robot there. The reward gives +0.10 per newly explored cell and +10 per victim, and takes away 0.02 for every cell a teammate explored first, 0.01 per time step, and 0.05 for picking a finished region. That last penalty matters more than it looks: early versions of the policy kept sending robots to exhausted regions until we priced it in. We used the hyperparameters from the MAPPO paper directly rather than tuning our own. Two practical points drove this design. First, a policy that chooses regions does not need physics-rate simulation, so training runs against the cheap grid world in minutes on an ordinary CPU (we trained on a laptop with no GPU at all). Second, whatever the policy learned must survive the trip into ROS 2, so the deployed node rebuilds the same observation from live topics, and a contract test verifies that the two implementations agree numerically and that the trained network loads into the deployment copy with identical outputs."));
bodyChildren.push(h2("3.6 Navigation and execution"));
bodyChildren.push(body("Region goals are plain map-frame poses, and Nav2 does the rest: the Smac 2D planner (A* over the merged map) produces the global path and a DWB controller follows it. Costmaps, inflation and recovery behaviours are configured once in a template and stamped out per robot by the launcher, since the three robots differ only in name."));
bodyChildren.push(h2("3.7 Evaluation harness and metrics (O5)"));
bodyChildren.push(body("A dedicated evaluation node watches the merged map, the semantic map and each robot's individual map, and computes the six metrics we fixed in the build plan: map coverage against the known world footprint, victim detection accuracy against the ground-truth file, time-to-detection, a redundant-coverage ratio (cells seen by two or more robots over all cells seen), and on the training side, average episodic reward and episodes to convergence. Everything is appended to a CSV while the mission runs, and a plotting script turns those CSVs into the figures in this report."));

// 4 Results
bodyChildren.push(h1("4. Results and Analysis"));
bodyChildren.push(h2("4.1 Implementation verification"));
bodyChildren.push(body("The final repository holds eleven ROS 2 packages, the training stack (43 Python modules in total), and nine passing unit tests. Five of those tests pin the training-to-deployment interface (identical crops, and a network checkpoint that produces identical outputs on both sides), and four test the map fusion maths. The workspace builds with colcon, and the whole mission comes up from one launch command. Getting three robots up simultaneously took several rounds of debugging; the memorable failures were a slam_toolbox executable that changed names between versions and Gazebo 8's strict SDF naming, and those experiences are the reason the contract tests exist."));
bodyChildren.push(h2("4.2 Training dynamics"));
bodyChildren.push(body("Figure 2 shows episodic reward over roughly 148,000 training steps, logged at 34 checkpoints and smoothed. The shape is the one we have come to expect from this kind of task: most of the learning happens early. Map coverage settled into the 83 to 86 percent band within the first third of training and stayed there, and reward flattened out in the mid-to-high sixties with a best five-episode average of 74. A note on process: our first long run died at about 130k steps when the laptop (no GPU, thermally throttled) ground to a halt. We added checkpoint saving and a resume flag afterwards, and the second attempt picked up almost exactly where the first one stopped, losing only the metrics CSV rows of the killed run. The plateau is why we judge that the policy has learned the basics (spread out, do not duplicate work, collect victims) but has not yet sharpened into something decisively better than a rule."));
bodyChildren.push(figure("fig_training.png", 540));
bodyChildren.push(caption("Figure 2: Episodic reward across the training run (~148k steps; raw and smoothed). Data from runs/mappo_v1."));
bodyChildren.push(h2("4.3 Benchmark against baselines"));
bodyChildren.push(body("Table 1 and Figure 3 give the allocation benchmark: four held-out maps, two episodes each, three robots, five victims, a 600 step cap. The MAPPO numbers use stochastic sampling, the same mode the deployed node uses. The deterministic (argmax) mode is listed separately because it behaves very differently."));
bodyChildren.push(tableTitle("Table 1: Allocation benchmark, mean \u00b1 std over 4 held-out maps \u00d7 2 episodes"));
bodyChildren.push(threeLine(
  ["Policy", "Coverage", "Victims (of 5)", "Detect step", "Mission steps"],
  [["Rule-based (greedy)", "0.86 \u00b1 0.05", "4.25 \u00b1 0.83", "49.0 \u00b1 18.8", "138 \u00b1 47"],
   ["MAPPO (sampled)", "0.85 \u00b1 0.06", "3.25 \u00b1 0.43", "43.4 \u00b1 17.8", "444 \u00b1 176"],
   ["Random", "0.85 \u00b1 0.04", "3.75 \u00b1 1.09", "57.4 \u00b1 46.4", "425 \u00b1 189"],
   ["MAPPO (argmax)", "0.61 \u00b1 0.11", "2.25 \u00b1 0.43", "\u2014", "600 \u00b1 0"]],
  [24, 19, 19, 19, 19]));
bodyChildren.push(figure("fig_benchmark.png", 540));
bodyChildren.push(caption("Figure 3: Victims located and mission duration for the three allocators (error bars are one standard deviation)."));
bodyChildren.push(h2("4.4 Analysis"));
bodyChildren.push(body("Three things in this data are worth dwelling on. First, coverage barely separates anyone: all three policies land at 85 to 86 percent. With three robots sweeping a maze full of frontiers, even a random region choice covers a lot of ground, and a greedy rule covers it slightly more neatly. We did not expect the random baseline to look this respectable, and it is a useful corrective to the assumption that any learned policy must beat any rule on raw coverage. Second, the learned policy is already ahead where we hoped it would be: its mean time to the first victim (43 steps) is the best of the three, which suggests it has started weighting victim-bearing regions by more than distance. Third, it loses on the bottom line, victims per mission (3.25 against 4.25) and mission duration, and we can point to two causes. Sampling actions stochastically during missions costs efficiency, and the policy is simply not finished learning: run deterministically, it still falls into loops (61 percent coverage, every episode hitting the step cap), a classic signature of an under-trained policy rather than a broken one."));
bodyChildren.push(body("We should also be candid about what this benchmark is not. It runs in the abstract grid environment, not inside Gazebo; the simulator-level experiment matrix is written down and scripted but not yet executed. Four maps with two episodes each is thin for a final claim, though acceptable for a progress review; the plan calls for at least ten runs per configuration. And the reward weights were set once by hand, not searched. None of these change the qualitative picture, but all of them will be addressed before the final submission."));

// 5 Conclusion
bodyChildren.push(h1("5. Conclusion and Future Work"));
bodyChildren.push(body("The system we proposed in DA1 now exists. Three robots map together (O1), detect victims and share the findings through one semantic memory (O2, O3), and divide the search using a policy that learned the job from rewards rather than rules (O4), all behind a single launch command with the benchmark harness (O5) running beside it. Where the learned allocator stands today is a little ahead on detection speed, level on coverage, and a little behind on victims found and mission time. We consider this a training budget problem, not a design problem: the reward is still on its plateau, the deterministic mode has not sharpened, and the infrastructure to fix both (resumable training, scripted evaluation, swappable allocators) is already built and tested."));
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
