"""Generate the three report figures (200 DPI PNG) from real project data."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import csv, os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "reports")
os.makedirs(OUT, exist_ok=True)

# palette: low-saturation academic (Morandi) + near-black text
INK = "#1C2A3D"; MUTED = "#5B6B7D"; GRID = "#E3E7EC"
C_RULE = "#6B9DAD"; C_MAPPO = "#B87472"; C_RAND = "#C49B72"
BOX = "#F2F4F6"; BOX_EDGE = "#C9D2DB"; ACC = "#8B7E5A"

plt.rcParams.update({"font.size": 11, "axes.edgecolor": MUTED,
                     "axes.labelcolor": INK, "text.color": INK,
                     "xtick.color": MUTED, "ytick.color": MUTED})

# ---------------------------------------------------------------- Fig 1: architecture
fig, ax = plt.subplots(figsize=(10.5, 6.2))
ax.set_xlim(0, 10.5); ax.set_ylim(0, 6.2); ax.axis("off")

def box(x, y, w, h, title, sub, fill=BOX, edge=BOX_EDGE, tcolor=INK):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.03",
                                fc=fill, ec=edge, lw=1.2))
    ax.text(x + w/2, y + h - 0.34, title, ha="center", va="center",
            fontsize=10.5, fontweight="bold", color=tcolor)
    if sub:
        ax.text(x + w/2, y + h/2 - 0.18, sub, ha="center", va="center",
                fontsize=8.6, color=MUTED)

def arrow(x1, y1, x2, y2):
    ax.add_patch(FancyArrowPatch((x1, y1), (x2, y2), arrowstyle="-|>",
                 mutation_scale=13, color=ACC, lw=1.4))

def col_header(x, w, t):
    ax.text(x + w/2, 5.92, t, ha="center", fontsize=10, fontweight="bold", color=MUTED)

W1, W2, W3 = 2.9, 2.9, 2.9
X1, X2, X3 = 0.25, 3.8, 7.35
col_header(X1, W1, "PER-ROBOT  (x3)")
col_header(X2, W2, "SHARED STATE")
col_header(X3, W3, "DECISION / EVAL")

box(X1, 4.35, W1, 1.15, "slam_toolbox", "local occupancy map")
box(X1, 2.90, W1, 1.15, "detector (YOLO / HSV)", "camera + lidar range")
box(X1, 1.45, W1, 1.15, "Nav2 + Smac (A*)", "executes region goals")
box(X2, 4.35, W2, 1.15, "map_merge", "fuses N local maps")
box(X2, 2.90, W2, 1.15, "sar_memory", "shared semantic map")
box(X2, 1.45, W2, 1.15, "frontier", "16 search regions")
box(X3, 4.35, W3, 1.15, "MAPPO allocator", "learned region choice",
    fill="#F5EFE6", edge=ACC)
box(X3, 2.90, W3, 1.15, "rule allocator", "greedy baseline")
box(X3, 1.45, W3, 1.15, "sar_eval", "metrics, CSV logs")

arrow(X1+W1+0.06, 4.92, X2-0.06, 4.92)
arrow(X1+W1+0.06, 3.47, X2-0.06, 3.47)
arrow(X2+W2+0.06, 4.92, X3-0.06, 4.92)
arrow(X2+W2+0.06, 3.47, X3-0.06, 3.47)
arrow(X2+W2+0.06, 2.02, X3-0.06, 2.02)
ax.text(3.51, 5.12, "/robot_i/map", ha="center", fontsize=7.8, color=MUTED)
ax.text(3.51, 3.67, "/detections", ha="center", fontsize=7.8, color=MUTED)
ax.text(7.06, 5.12, "/map_merged", ha="center", fontsize=7.8, color=MUTED)
ax.text(7.06, 3.67, "/semantic_map", ha="center", fontsize=7.8, color=MUTED)
ax.text(7.06, 2.22, "/regions", ha="center", fontsize=7.8, color=MUTED)
ax.text(5.25, 0.85, "Allocators publish /robot_i/goal  ->  Nav2 executes;  sar_eval logs /mission_metrics",
        ha="center", fontsize=9, color=INK)
plt.tight_layout()
plt.savefig(os.path.join(OUT, "fig_architecture.png"), dpi=200, bbox_inches="tight")
plt.close()

# ---------------------------------------------------------------- Fig 2: training curve
eps, rews = [], []
with open(os.path.join(OUT, "training_curve.csv")) as f:
    for row in csv.DictReader(f):
        eps.append(int(row["episode"])); rews.append(float(row["reward"]))
def smooth(a, k=3):
    return [sum(a[max(0, i-k+1):i+1])/len(a[max(0, i-k+1):i+1]) for i in range(len(a))]
fig, ax = plt.subplots(figsize=(9, 4.6))
ax.plot(eps, rews, color=C_MAPPO, alpha=0.30, lw=1.2, label="per-episode reward")
ax.plot(eps, smooth(rews), color=C_MAPPO, lw=2.4, label="smoothed (3-pt)")
ax.set_xlabel("training episode (logged every 10)")
ax.set_ylabel("episodic reward")
ax.set_ylim(30, 90)
ax.grid(True, alpha=0.3, color=GRID)
ax.legend(frameon=False, loc="lower right")
plt.tight_layout()
plt.savefig(os.path.join(OUT, "fig_training.png"), dpi=200, bbox_inches="tight")
plt.close()

# ---------------------------------------------------------------- Fig 3: benchmark
labels = ["Rule-based", "MAPPO", "Random"]
victims = [4.25, 3.25, 3.75]; victims_err = [0.83, 0.43, 1.09]
steps = [138, 444, 425]; steps_err = [47, 176, 189]
colors = [C_RULE, C_MAPPO, C_RAND]
fig, axes = plt.subplots(1, 2, figsize=(9.6, 4.2))
axes[0].bar(labels, victims, yerr=victims_err, capsize=4, color=colors, width=0.55)
axes[0].set_ylabel("victims located (of 5)")
axes[0].set_title("Victims found (higher is better)", fontsize=11)
axes[0].set_ylim(0, 5.6); axes[0].grid(True, axis="y", alpha=0.3, color=GRID)
for i, v in enumerate(victims):
    axes[0].text(i, v + victims_err[i] + 0.15, f"{v:.2f}", ha="center", fontsize=9.5)
axes[1].bar(labels, steps, yerr=steps_err, capsize=4, color=colors, width=0.55)
axes[1].set_ylabel("mission steps until finish")
axes[1].set_title("Mission duration (lower is better)", fontsize=11)
axes[1].set_ylim(0, 720); axes[1].grid(True, axis="y", alpha=0.3, color=GRID)
for i, v in enumerate(steps):
    axes[1].text(i, v + steps_err[i] + 18, str(v), ha="center", fontsize=9.5)
plt.tight_layout()
plt.savefig(os.path.join(OUT, "fig_benchmark.png"), dpi=200, bbox_inches="tight")
plt.close()

print("figures written:", os.listdir(OUT))
