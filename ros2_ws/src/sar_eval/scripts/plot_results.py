"""Plot sar_eval metrics CSVs into the report figures.

Usage:
    python plot_results.py ~/sar_results/metrics_*.csv -o ~/sar_results/figs
Produces: coverage_vs_time.png, victims_vs_time.png, overlap_vs_time.png
"""

import argparse
import glob
import os

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csvs", nargs="+")
    ap.add_argument("-o", "--out", default="figs")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)

    series = []
    for pattern in args.csvs:
        for path in sorted(glob.glob(pattern)):
            t, cov, vic, ovl = [], [], [], []
            with open(path) as f:
                next(f)
                for line in f:
                    parts = line.strip().split(",")
                    if len(parts) < 5:
                        continue
                    t.append(float(parts[0]))
                    cov.append(float(parts[1]))
                    vic.append(int(parts[2]))
                    ovl.append(float(parts[4]))
            series.append((os.path.basename(path), t, cov, vic, ovl))

    def plot(yfn, ylabel, name):
        plt.figure(figsize=(7, 4.5))
        for label, t, *_rest in series:
            ys = yfn(label, t)
            plt.plot(t, ys, label=label, alpha=0.8)
        plt.xlabel("mission time (s)")
        plt.ylabel(ylabel)
        plt.grid(alpha=0.3)
        plt.legend(fontsize=7)
        plt.tight_layout()
        out = os.path.join(args.out, name)
        plt.savefig(out, dpi=150)
        plt.close()
        print("wrote", out)

    plot(lambda _l, t, c, *_: c, "map coverage", "coverage_vs_time.png")
    plot(lambda _l, t, _c, v, _o: v, "victims found", "victims_vs_time.png")
    plot(lambda _l, t, _c, _v, o: o, "redundant coverage ratio", "overlap_vs_time.png")


if __name__ == "__main__":
    main()
