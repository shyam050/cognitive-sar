/* FINAL project report generator (~15 pages, submission version).
 * Structure: Cover | Certificate + Declaration + Team | Abstract | TOC (Roman) |
 * Body: Introduction, Related Study, Proposed Work (architecture + figure
 * slots), Results and Analysis (real data + screenshot slots), Conclusion and
 * Future work, References (Arabic from 1).
 * Real figures: architecture, training curve, benchmark charts.
 * Placeholder boxes: Gazebo/RViz screenshots the team must capture.
 * Run:  node scripts/make_final_report.js  ->  reports/Final_Project_Report.docx
 */
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  PageBreak, Header, Footer, PageNumber, NumberFormat, AlignmentType,
  HeadingLevel, WidthType, BorderStyle, ShadingType, SectionType,
  TableOfContents, TableLayoutType,
} = require("docx");
const fs = require("fs");
const path = require("path");
const _is = require("image-size");
const sizeOf = _is.imageSize || _is.default || _is;

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "reports", "Final_Project_Report.docx");

const FONT = { ascii: "Times New Roman", eastAsia: "SimSun" };
const HFONT = { ascii: "Times New Roman", eastAsia: "SimHei" };
const BLACK = "000000";
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { ...noBorders, insideHorizontal: NB, insideVertical: NB };
const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

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

// Bordered placeholder box for a screenshot the team must capture themselves.
const figSlot = (instructions, tip) => [
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: { top: { style: BorderStyle.DASHED, size: 6, color: "808080" },
               bottom: { style: BorderStyle.DASHED, size: 6, color: "808080" },
               left: { style: BorderStyle.DASHED, size: 6, color: "808080" },
               right: { style: BorderStyle.DASHED, size: 6, color: "808080" },
               insideHorizontal: NB, insideVertical: NB },
    rows: [new TableRow({
      height: { value: 1700, rule: "atLeast" },
      children: [new TableCell({
        verticalAlign: "center",
        shading: { type: ShadingType.CLEAR, fill: "FAFAFA" },
        margins: { top: 120, bottom: 120, left: 200, right: 200 },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80, line: 300 },
            children: [new TextRun({ text: "\u3010 Insert figure here \u3011", bold: true,
              size: 22, color: "808080", font: FONT })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { line: 280 },
            children: [new TextRun({ text: instructions, italics: true,
              size: 20, color: "808080", font: FONT })] }),
          ...(tip ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, line: 280 },
            children: [new TextRun({ text: "How: " + tip, italics: true,
              size: 18, color: "A0A0A0", font: FONT })] })] : []),
        ],
      })],
    })],
  }),
];

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

// ---------------------------------------------------------------- cover
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
  const fixedH = (22 * 23 + 400) + titleLines.length * (titlePt * 23 + 200)
    + (15 * 23 + 600) + metaEntries.length * 520 + (12 * 23 + 200) + 3 * 350;
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
      children: [new TextRun({ text: "Final Project Report",
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

const centered = (text, opts = {}) => new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { line: 312, after: 120 },
  children: [new TextRun({ text, size: 24, color: BLACK, font: FONT, ...opts })],
});
const sigLine = (left, right) => new Paragraph({
  spacing: { before: 240, after: 0, line: 312 },
  tabStops: [{ type: "right", position: 9200 }],
  children: [new TextRun({ text: left + "\t" + right, size: 24, color: BLACK, font: FONT })],
});

// ---------------------------------------------------------------- front matter
const frontMatter = [
  h1("Certificate"),
  body("This is to certify that the project entitled \u201cCognitive Multi-Robot Search and Rescue Through Collaborative Perception and Reasoning\u201d is a bona fide record of the work carried out by \u3010team member names\u3011 (registration numbers 23BRS1268, 23BRS1209, 23BRS1192 and 23BRS1227) under my supervision and guidance, in partial fulfilment of the requirements for the award of the degree of Bachelor of Technology during the academic year \u3010academic year\u3011."),
  body("The work presented in this report is complete to our satisfaction and has been approved for submission."),
  sigLine("Date: \u3010date\u3011", "Place: \u3010city\u3011"),
  sigLine("Signature of Guide", "Signature of HOD"),
  sigLine("\u3010Guide name\u3011", "\u3010HOD name\u3011"),
  h1("Declaration"),
  body("We hereby declare that the work presented in this report, entitled \u201cCognitive Multi-Robot Search and Rescue Through Collaborative Perception and Reasoning\u201d, is original work carried out by us as a team under the guidance of \u3010Guide name\u3011. All external sources used in this report, including software libraries and prior publications, have been duly acknowledged, and this report has not been submitted, in whole or in part, to any other institution or university for the award of any degree or diploma."),
  sigLine("Date: \u3010date\u3011", "Place: \u3010city\u3011"),
  sigLine("1. Aadavan Elavalagan (23BRS1268)", "Signature: \u3010sign\u3011"),
  sigLine("2. K S Vinoth (23BRS1209)", "Signature: \u3010sign\u3011"),
  sigLine("3. Shyam Sundar (23BRS1192)", "Signature: \u3010sign\u3011"),
  sigLine("4. Madhavan A Ramanujan (23BRS1227)", "Signature: \u3010sign\u3011"),
  new Paragraph({ children: [new PageBreak()] }),
  h1("Abstract"),
  body("Robots are increasingly used to look for survivors after earthquakes and building collapses, but almost always one robot at a time, and that is slow. Adding more robots does not by itself fix the problem, because without coordination they crowd into the same half-explored rooms and re-search each other's ground. This report presents the final version of a three-robot search and rescue system that we designed, built and tested completely in simulation on ROS 2 Jazzy with the Gazebo Harmonic simulator. Each robot maps its surroundings with lidar SLAM; the individual maps are fused into one global map; a camera based detector reports the map position of any victim it sees; and all discoveries land in a shared semantic map that every robot can read. Region assignments are made by two interchangeable allocators behind one interface: a greedy nearest-frontier rule, and a policy learned with multi-agent reinforcement learning (MAPPO, centralized training with decentralized execution) that sees the frontier mass of every region, its teammates' current claims and its own previous assignment, picks regions sequentially so that duplicate assignments are impossible, and masks out exhausted regions. The learned policy trains in under an hour on a free cloud GPU. On six held-out test maps the deployed policy matched the greedy rule on map coverage (86% against 83%) and came within noise on victims per mission (3.75 against 3.92 of 5), while every three-robot configuration decisively outperformed every single-robot configuration (83 to 89% coverage against 27 to 42%). Simple commitment heuristics we added as honesty baselines set the mission-time bar, and we report and analyse them openly. The complete system \u2014 eleven ROS 2 packages, the training stack, ten passing unit tests including contract tests between training and deployment \u2014 is reproducible from a single repository with one launch command."),
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
const B = [];

// 1 Introduction
B.push(h1("1. Introduction"));
B.push(body("After an earthquake or a building collapse, the first couple of days decide almost everything. Rescue teams have to search a large, unstable and poorly lit area, and every hour spent walking down a corridor that has already been checked is an hour not spent somewhere else. Ground robots can help because they can go where it is unsafe for humans, but they are still mostly used one at a time, and one robot covering one corridor at a time wastes most of the window in which survivors can be saved."));
B.push(body("The obvious answer is to use several robots at once. The catch is that several robots, each naively exploring on its own, behave like several people searching a building without talking to each other: they drift toward the same open areas, cover the same ground twice, and leave whole wings unchecked. The real problem is not mapping and not driving; it is deciding, continuously and collectively, which parts of the environment still need attention."));
B.push(body("This report documents the final version of the system we proposed in our DA1 abstract. The five objectives carried over from that proposal are: (O1) build a collaborative SLAM-based map across robots; (O2) enable semantic scene understanding with victim detection; (O3) implement a shared memory layer queryable by all robots; (O4) train a multi-agent reinforcement learning policy (MAPPO, centralized training with decentralized execution) that adaptively allocates search regions; and (O5) benchmark the learned policy against a rule-based allocation baseline. All five objectives are implemented, tested and evaluated in simulation."));
B.push(body("The deliverables described here are: eleven ROS 2 packages and a standalone training stack, all in one repository; a procedural world generator that keeps the simulator and the training environment consistent by construction; a custom multi-robot map-fusion node; a shared semantic memory with deduplication and stable identifiers; two interchangeable allocators behind an identical interface; a contract test suite that pins the observation interface between training and deployment; a full benchmark over six allocators in two team sizes; and a working multi-robot bringup in Gazebo. The report is arranged as follows: Section 2 reviews related work, Section 3 details the proposed system, Section 4 presents results and analysis, and Section 5 concludes with future work."));

// 2 Related Study
B.push(h1("2. Related Study"));
B.push(h2("2.1 Urban search and rescue robotics"));
B.push(body("Robot-assisted rescue has a longer history than most people assume. Casper and Murphy studied the robots that were actually sent into the World Trade Center rubble in 2001 and documented what worked and what did not [1]. Their conclusions shaped our metric choices more than anything else we read: what matters in a rescue is time, so we measure time-to-detection and total mission duration, not only coverage percentages."));
B.push(h2("2.2 Multi-robot exploration and mapping"));
B.push(body("For exploration, the idea that still underpins nearly everything is Yamauchi's frontier-based approach from 1997 [2]: keep driving toward the boundary between what the robot has seen and what it has not. Both of our allocators, learned and hand-written, operate on frontier information extracted from the merged map. The mapping formulation follows the occupancy-grid and probabilistic-SLAM treatment of Thrun, Burgard and Fox [3], with the open-source slam_toolbox stack running per robot on ROS 2 and our own fusion node joining the grids (Section 3.4 explains why we did not use the existing multi-robot merge package)."));
B.push(h2("2.3 Multi-agent reinforcement learning"));
B.push(body("Cooperative multi-agent learning has converged on centralized training with decentralized execution: a critic may see everything while the policy is learned, but each agent acts on only its own view once deployed. MADDPG established the pattern for continuous control [4], QMIX factorizes the joint value function under a monotonicity constraint [5], and COMA attacks credit assignment with counterfactual baselines [6]. Yu et al. then showed that a multi-agent version of plain PPO, with a centralized value function and a shared actor, matches or beats these purpose-built methods on most cooperative benchmarks [7]; we built our allocator as MAPPO on that basis, with hyperparameters from their paper and the standard PPO objective [8]. For the action space we additionally use invalid-action masking [9], which prevents the policy from selecting regions that no longer contain unexplored space, consistently in training and deployment."));
B.push(h2("2.4 Tools and platforms"));
B.push(body("Everything runs on ROS 2 Jazzy [10] with the Gazebo Harmonic simulator [11] for physics and sensors. Victim detection follows the YOLO line of work [12] through the Ultralytics implementation [13], with a tuned HSV blob detector as a fallback because our simulated victims have a strong colour signature. Navigation is Nav2 [14] with the Smac 2D planner, an A* planner, matching what we wrote in the DA1 abstract."));

// 3 Proposed Work
B.push(h1("3. Proposed Work"));
B.push(h2("3.1 System overview and architecture"));
B.push(body("Figure 1 shows the overall architecture. There are three layers. Everything that must exist once per robot (SLAM, camera detection, navigation) runs as a namespaced copy on each of the three robots. Everything that should exist once for the team (the fused occupancy grid, the sixteen-region decomposition, the semantic memory of located victims) sits in the middle layer, published on topics any robot can read. The decision layer holds the two interchangeable allocators and the evaluation node. The key design decision is at the bottom of the diagram: both allocators publish exactly the same goal message type on the same topics, so swapping one brain for the other is a launch option, which is what makes the comparison in Section 4 fair."));
B.push(figure("fig_architecture.png", 560));
B.push(caption("Figure 1: System architecture. Each block is an implemented ROS 2 node; arrows are actual topics."));
B.push(h2("3.2 Simulation environment and world generation"));
B.push(body("The mission world is a 32 m by 32 m indoor maze with rooms, corridors, five victim figures and hazard props. We did not draw it by hand: a generator script produces the floor plan procedurally, places the robots in separated corners and the victims well away from the spawns, and writes out both the Gazebo world file and a ground-truth file with the exact victim coordinates. Because the training environment is generated from the same code as the simulator world, what the policy practises on and what it is deployed against cannot silently diverge. Getting this right took a few attempts; our first generated world did not even load, because Gazebo 8 refuses visual elements without a name attribute."));
B.push(...figSlot(
  "Screenshot of the SAR world in Gazebo (top or angled view) showing the maze walls, the three robots at their spawn corners and at least two orange victim figures.",
  "run the mission, open the Gazebo GUI, frame the whole world and screenshot; crop to the walls"));
B.push(caption("Figure 2: The generated SAR world in Gazebo \u2013 walls, robots at their spawns, victim figures."));
B.push(h2("3.3 Robot platform"));
B.push(body("Each robot is a two-wheeled differential-drive platform with two passive casters, a 360-degree planar lidar (5 m range, 360 samples) and an RGB camera (640 by 480, about 86 degrees horizontal field of view). The description is defined once as an xacro macro and stamped out three times with different names, so every frame, topic and sensor identifier is unique per robot. Wheel odometry comes from the diff-drive plugin, bridged into ROS 2 together with the scan and camera topics."));
B.push(...figSlot(
  "Close-up screenshot of one robot \u2013 in the Gazebo GUI zoomed onto robot_1, or an RViz TF/robot-model view \u2013 showing the body, wheels, lidar puck and camera.",
  "xacro the model or zoom in Gazebo; keep the sensor layout visible"));
B.push(caption("Figure 3: The SAR robot platform (differential drive, lidar, camera)."));
B.push(h2("3.4 Collaborative mapping (O1)"));
B.push(body("Each robot runs slam_toolbox in its own namespace and produces its own occupancy grid. Joining three grids into one is the job of the merge node. An existing package (multirobot_map_merge) makes pose-graph assumptions that did not match our setup, where the start poses are known and fixed by the launcher, so we wrote a small fusion node ourselves: each local grid is consistent up to one known rigid transform, and the merge reduces to a coordinate transformation plus a per-cell rule (unknown if nobody has seen the cell, occupied dominates free otherwise). The node is unit-tested against translation offsets, yaw rotation and unknown-preservation, which caught two real bugs during development. Figure 4 should show the result: three partial maps joined into one coherent global grid."));
B.push(...figSlot(
  "RViz screenshot mid-mission with the /map_merged topic displayed: one grey global map with the three laser scans and robot TF frames visible on top.",
  "run the mission, add a Map display on /map_merged plus TF and LaserScan displays, screenshot once all three maps overlap"));
B.push(caption("Figure 4: Collaborative mapping \u2013 three local SLAM maps fused into one global grid (RViz)."));
B.push(h2("3.5 Semantic perception and shared memory (O2, O3)"));
B.push(body("Each robot carries an RGB camera and the lidar. When the detector sees something victim-shaped in an image it must answer a second question: where is that thing on the map? We combine the pinhole camera model, which gives a bearing, with the nearest valid lidar return along that bearing, which gives a range, and transform into the map frame using the robot's pose. Detections are published as semantic entries and consumed by the shared memory node, which merges repeat sightings of the same victim within a one-metre radius, records the time of the first sighting (this is the time-to-detection metric), assigns every victim a stable identifier, and republishes the complete semantic map at a fixed rate. After that, every robot and both allocators simply know what the team has found."));
B.push(...figSlot(
  "Two-panel or single screenshot: (a) the raw camera image from a robot with a victim visible, and (b) the same moment in RViz with the orange victim sphere appearing in the semantic map.",
  "camera image from /robot_i/image_raw in rqt or Foxglove; RViz with the /semantic_map/markers display enabled"));
B.push(caption("Figure 5: Victim detection \u2013 camera view and the corresponding semantic-map marker."));
B.push(h2("3.6 Task allocation: baseline and learned policy (O4)"));
B.push(body("The global map is cut into a 4 by 4 grid of sixteen regions, and a region counts as actionable while it still contains frontier cells. The baseline allocator is deliberately simple: each idle robot takes the nearest actionable region nobody has claimed. It is deterministic, needed no training, and turned out to be hard to beat, which Section 4 discusses."));
B.push(body("The learned allocator is a MAPPO policy trained on a grid abstraction of the same world. Each robot's observation is a 13 by 13 cell crop (walls, explored space, frontiers) centred on its own position, plus a 52-value vector: the robot's position, victims found so far and elapsed mission fraction, the relative frontier mass of each region, the regions its teammates have claimed this decision round, and its own previous assignment. The centralized critic sees the whole 64 by 64 grid with every robot marked on it. An action selects one of the sixteen regions, and a built-in A* executor walks the robot there, re-targeting immediately whenever the allocator changes a robot's assignment. Two details make the coordination real rather than nominal. Robots choose regions one at a time in random order, and each robot sees the regions chosen before it in the same round, so duplicate assignments are prevented structurally instead of merely penalised. And actions on exhausted regions are masked out before selection, in training and deployment alike."));
B.push(body("The reward adds +0.10 per newly explored cell and +10 per victim located, and subtracts 0.002 for every cell sensed simultaneously by a teammate, 0.2 for sending two robots to the same region in one round, 0.05 per time step and 0.05 for picking a finished region (which masking makes rare); rewards are scaled by 0.1 before PPO sees them. Training uses PPO's clipped surrogate with GAE (\u03bb = 0.95), a shared actor across the homogeneous robots, a centralized critic with an unclipped value loss, and the hyperparameters of Yu et al. [7], with one deliberate deviation: the usual clipped value-loss variant assumes normalised returns and quietly paralysed our critic. On deployment, the trained network is loaded by a ROS 2 node that rebuilds the identical observation from live topics and runs the same sequential selection before publishing region goals. A contract test suite verifies that the two implementations agree numerically and that the trained network loads into the deployment copy with identical outputs."));
B.push(h2("3.7 Navigation and execution"));
B.push(body("Region goals are plain map-frame poses, and Nav2 does the rest: the Smac 2D planner (A* over the merged map) produces the global path and a DWB controller follows it. Costmaps, inflation and recovery behaviours are configured once in a template and stamped out per robot by the launcher, since the three robots differ only in name."));
B.push(h2("3.8 Evaluation harness and metrics (O5)"));
B.push(body("A dedicated evaluation node watches the merged map, the semantic map and each robot's individual map, and computes the metrics fixed in the build plan: map coverage against the known world footprint, victim detection accuracy against the ground-truth file, time-to-detection, a redundant-coverage ratio (cells re-observed by a non-owner over all known cells), and on the training side, average episodic reward and the entropy/KL diagnostics of PPO. Everything is appended to a CSV while the mission runs, and a plotting script turns those CSVs into the figures in this report."));

// 4 Results
B.push(h1("4. Results and Analysis"));
B.push(h2("4.1 Implementation verification"));
B.push(body("The final repository holds eleven ROS 2 packages, the training stack (43 Python modules in total), and ten passing unit tests. Six of those tests pin the training-to-deployment interface (identical crops, the 52-value observation layout, the sequential selection mechanism, and a checkpoint that produces identical outputs on both sides), and four test the map fusion maths. The workspace builds with colcon, and the whole mission comes up from one launch command. Getting three robots up simultaneously took several rounds of debugging; the memorable failures were a slam_toolbox executable that changed names between versions and Gazebo 8's strict SDF naming, and those experiences are the reason the contract tests exist."));
B.push(h2("4.2 Training dynamics"));
B.push(body("Figure 6 shows the final training run: 200,000 steps on a free Colab GPU (48 logged checkpoints), trained under the corrected executor and reward semantics of Section 3.6. One honest note on how to read it: the raw episodic reward is negative by design, because the weights charge 0.05 per step and add duplicate-allocation penalties; the informative series is the coverage trace underneath, which settled into the 80 to 87 percent band while the policy's entropy fell from about 2.1 to below 0.5, meaning the policy was still sharpening when the run ended."));
B.push(figure("fig_training.png", 520));
B.push(caption("Figure 6: Final training run (200k steps, corrected semantics) \u2013 episodic team reward and map coverage per logged checkpoint. Data: runs/mappo_v6."));
B.push(h2("4.3 Allocation benchmark"));
B.push(body("Table 1 and Figure 7 give the allocation benchmark: six held-out maps, four episodes each, three robots, five victims, a 600 step cap \u2014 24 episodes per policy. The MAPPO row uses stochastic sampling, the mode the deployed node actually runs; the deterministic (argmax) mode is listed separately because it behaves very differently. Alongside the original baselines we evaluated two deliberately simple commitment heuristics (sticky-unclaimed keeps a region until it is exhausted and never takes one a teammate holds), because our first benchmark round showed how much a policy can gain from mere persistence."));
B.push(tableTitle("Table 1: Three-robot benchmark, mean \u00b1 std over 6 held-out maps \u00d7 4 episodes"));
B.push(threeLine(
  ["Policy (3 robots)", "Coverage", "Victims (of 5)", "Detect step", "Mission steps"],
  [["MAPPO (sampled)", "0.86 \u00b1 0.06", "3.75 \u00b1 0.66", "56.5 \u00b1 59.0", "357 \u00b1 200"],
   ["MAPPO (argmax)", "0.76 \u00b1 0.12", "3.33 \u00b1 0.80", "22.5 \u00b1 20.6", "507 \u00b1 183"],
   ["Rule-based (greedy)", "0.83 \u00b1 0.12", "3.92 \u00b1 0.95", "29.4 \u00b1 19.1", "196 \u00b1 184"],
   ["Sticky-unclaimed", "0.89 \u00b1 0.04", "4.08 \u00b1 0.64", "31.4 \u00b1 17.3", "139 \u00b1 101"],
   ["Sticky-random", "0.89 \u00b1 0.03", "4.00 \u00b1 0.71", "41.7 \u00b1 24.1", "187 \u00b1 161"],
   ["Random (masked)", "0.71 \u00b1 0.10", "3.04 \u00b1 1.06", "35.8 \u00b1 41.1", "581 \u00b1 63"],
   ["Random", "0.68 \u00b1 0.08", "2.79 \u00b1 0.82", "22.2 \u00b1 40.9", "600 \u00b1 0"]],
  [24, 19, 19, 19, 19]));
B.push(figure("fig_benchmark.png", 560));
B.push(caption("Figure 7: Victims located and mission duration for the six allocators (error bars are one standard deviation)."));
B.push(body("Table 2 isolates the multi-robot claim from the abstract: the same allocators run with one robot instead of three. Every three-robot configuration outperformed every single-robot configuration \u2014 the weakest three-robot result (MAPPO in argmax mode, 76% coverage) still beats the strongest single-robot result (sticky-unclaimed, 42%)."));
B.push(tableTitle("Table 2: Single-robot vs three-robot teams (sampled mode), coverage and victims"));
B.push(threeLine(
  ["Policy", "1 robot: cov / victims", "3 robots: cov / victims"],
  [["MAPPO", "0.27 \u00b1 0.18 / 0.96 \u00b1 0.73", "0.86 \u00b1 0.06 / 3.75 \u00b1 0.66"],
   ["Rule-based (greedy)", "0.29 \u00b1 0.23 / 1.21 \u00b1 1.12", "0.83 \u00b1 0.12 / 3.92 \u00b1 0.95"],
   ["Sticky-unclaimed", "0.42 \u00b1 0.28 / 1.58 \u00b1 1.29", "0.89 \u00b1 0.04 / 4.08 \u00b1 0.64"],
   ["Random", "0.35 \u00b1 0.10 / 0.96 \u00b1 0.54", "0.68 \u00b1 0.08 / 2.79 \u00b1 0.82"]],
  [28, 36, 36]));
B.push(h2("4.4 Deployment and mission demonstration"));
B.push(body("The full mission runs in Gazebo from a single launch command: the world loads, three robots spawn at their corners, SLAM, fusion, detection, shared memory, the allocator and the evaluator all start, and the merged map grows in RViz while robots drive to their assigned regions. Figures 8 and 9 should show this mission as it looked on screen. The simulator-level benchmark matrix (repeated timed runs of both allocators inside Gazebo) is scripted but not yet fully executed; the abstract-environment benchmark of Section 4.3 is the quantitative evidence for now, and bringing the same evaluation inside the simulator is the first item of future work."));
B.push(...figSlot(
  "RViz screenshot late in a mission: merged map nearly complete, orange victim markers visible, region markers (cyan cubes) and at least one robot mid-transit to its goal.",
  "RViz with /map_merged, /semantic_map/markers and /regions/markers enabled; screenshot around the 2-3 minute mark"));
B.push(caption("Figure 8: Mission snapshot \u2013 merged map, located victims and region assignments in RViz."));
B.push(...figSlot(
  "Screenshot or video still from the Gazebo GUI during the same mission, showing the three robots at different locations in the maze.",
  "Gazebo GUI, top-down or angled camera; the demo video frame works too"));
B.push(caption("Figure 9: The three-robot mission in the Gazebo simulator."));
B.push(h2("4.5 Analysis"));
B.push(body("Four findings are worth dwelling on. First, the multi-robot claim from our abstract holds without qualification: three robots cover 83 to 89 percent of the maze where one robot manages 27 to 42 percent, and locate three to four victims where one locates about one. No configuration choice changes this conclusion. Second, the learned policy, run the way we actually deploy it, has caught up with the hand-crafted rule: coverage 86 against 83 percent and victims 3.75 against 3.92, differences well inside one standard deviation. The claim from our abstract \u2014 that a learned policy should beat a hand-coded one \u2014 is therefore supported at the level of parity, not dominance. Third, the surprise of the benchmark is the sticky baselines: keep your region until it is exhausted, never poach a teammate's, and you finish missions in 139 steps where the rule needs 196 and the learned policy 357, while also covering the most ground. Commitment plus mutual exclusion, neither of which the classic greedy rule has, matters more than clever region choice at this map size. Our sequential-selection mechanism already builds commitment into the learned policy's decision structure; the benchmark suggests the next iteration should keep that structure and learn only when to break commitment. Fourth, the learned policy in deterministic mode still trails its sampled self (76 against 86 percent coverage, and half the episodes hitting the step cap), so the argmax mode had not fully sharpened at 200k steps \u2014 consistent with the entropy still declining at the end of training."));
B.push(body("We should also be candid about what this benchmark is not: it runs in the abstract grid environment rather than inside Gazebo, twenty-four episodes per configuration should be extended, and the reward weights were set once by hand rather than searched. None of these change the qualitative picture, but all of them define the remaining work."));

// 5 Conclusion
B.push(h1("5. Conclusion and Future Work"));
B.push(body("The system we proposed in DA1 now exists in full. Three robots map together (O1), detect victims and share the findings through one semantic memory (O2, O3), and divide the search using a policy that learned the job from rewards rather than rules (O4), all behind a single launch command with the benchmark harness (O5) running beside it. In the deployment configuration the learned allocator matches the hand-crafted greedy rule on coverage and victims; the three-robot team decisively outperforms single-robot search; and the benchmark surfaced a simple commitment heuristic that sets the mission-time bar \u2014 a finding we report proudly rather than bury. We consider the remaining gap a training-budget and commitment-integration problem, not a design problem: the policy was still sharpening when the run ended, and the infrastructure to continue it is built, tested and documented."));
B.push(body("Five lines of future work follow directly from the results. First, continued training with periodic argmax evaluation until the deterministic mode converges, which the resumable checkpoint pipeline makes cheap. Second, executing the Gazebo-level benchmark matrix, so the headline numbers come from the full simulator rather than the grid abstraction. Third, an ablation that removes the shared semantic memory from the learned policy's inputs \u2014 the direct test of whether shared understanding, the \u201ccognitive\u201d in our title, actually improves allocation. Fourth, a commitment-aware variant of the learned policy that treats region commitment as a learnable decision, which the sticky baselines suggest is where the remaining mission-time gain lives. Fifth, porting the evaluation to larger or differently structured worlds to test generalization, and fine-tuning the YOLO detector on rendered victim imagery. Because both allocators share one interface and the whole benchmark is scripted, each of these drops into the existing pipeline without further integration work."));

// References
B.push(h1("References"));
const refs = [
  "J. Casper and R. R. Murphy, \u201cHuman-robot interactions during the robot-assisted urban search and rescue response at the World Trade Center,\u201d IEEE Transactions on Systems, Man, and Cybernetics, Part B, vol. 33, no. 3, pp. 367\u2013385, 2003.",
  "B. Yamauchi, \u201cA frontier-based approach for autonomous exploration,\u201d in Proc. IEEE International Symposium on Computational Intelligence in Robotics and Automation (CIRA), 1997, pp. 146\u2013151.",
  "S. Thrun, W. Burgard, and D. Fox, Probabilistic Robotics. Cambridge, MA: MIT Press, 2005.",
  "R. Lowe, Y. Wu, A. Tamar, J. Harb, P. Abbeel, and I. Mordatch, \u201cMulti-agent actor-critic for mixed cooperative-competitive environments,\u201d in Advances in Neural Information Processing Systems (NeurIPS), 2017.",
  "T. Rashid, M. Samvelyan, C. Schroeder de Witt, G. Farquhar, J. Foerster, and S. Whiteson, \u201cQMIX: Monotonic value function factorisation for deep multi-agent reinforcement learning,\u201d in Proc. International Conference on Machine Learning (ICML), 2018.",
  "J. Foerster, G. Farquhar, T. Afouras, N. Nardelli, and S. Whiteson, \u201cCounterfactual multi-agent policy gradients,\u201d in Proc. AAAI Conference on Artificial Intelligence, 2018.",
  "C. Yu, A. Velu, E. Vinitsky, J. Gao, Y. Wang, A. Bayen, and Y. Wu, \u201cThe surprising effectiveness of PPO in cooperative multi-agent games,\u201d in Advances in Neural Information Processing Systems (NeurIPS) Datasets and Benchmarks Track, 2021.",
  "J. Schulman, F. Wolski, P. Dhariwal, A. Radford, and O. Klimov, \u201cProximal policy optimization algorithms,\u201d arXiv preprint arXiv:1707.06347, 2017.",
  "S. Huang and S. Onta\u00f1\u00f3n, \u201cA closer look at invalid action masking in policy optimization algorithms,\u201d arXiv preprint arXiv:2207.00223, 2022.",
  "S. Macenski, T. Foote, B. Gerkey, C. Lalancette, and W. Woodall, \u201cRobot Operating System 2: Design, architecture, and uses in the wild,\u201d Science Robotics, vol. 7, no. 66, 2022.",
  "N. Koenig and A. Howard, \u201cDesign and use paradigms for Gazebo, an open-source multi-robot simulator,\u201d in Proc. IEEE/RSJ International Conference on Intelligent Robots and Systems (IROS), 2004.",
  "J. Redmon, S. Divvala, R. Girshick, and A. Farhadi, \u201cYou only look once: Unified, real-time object detection,\u201d in Proc. IEEE Conference on Computer Vision and Pattern Recognition (CVPR), 2016.",
  "G. Jocher et al., Ultralytics YOLO (version 8), open-source software, https://github.com/ultralytics/ultralytics, 2023.",
  "S. Macenski, F. Martin, R. White, and J. Gin\u00e9s Clavero, \u201cThe Marathon 2: A navigation system,\u201d in Proc. IEEE/RSJ International Conference on Intelligent Robots and Systems (IROS), 2021.",
];
refs.forEach((r, i) => B.push(new Paragraph({
  alignment: AlignmentType.JUSTIFIED,
  spacing: { line: 312, after: 100 },
  indent: { left: 480, hanging: 480 },
  children: [new TextRun({ text: `[${i + 1}] ${r}`, size: 22, color: BLACK, font: FONT })],
})));

// ---------------------------------------------------------------- footers/sections
const romanFooter = new Footer({ children: [new Paragraph({
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, font: FONT, color: BLACK })] })] });
const arabicFooter = new Footer({ children: [new Paragraph({
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, font: FONT, color: BLACK })] })] });

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
      children: B },
  ],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUT, buf);
  console.log("wrote", OUT);
});
