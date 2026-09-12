#!/usr/bin/env bash
# Experiment matrix from BUILD_PLAN section 6 (config B vs C inside Gazebo).
# Each mission runs until timeout; sar_eval writes a metrics CSV per run.
#
# Usage:  bash scripts/run_experiments.sh <checkpoint.pt> [runs]
set -euo pipefail

CKPT="${1:?usage: run_experiments.sh <checkpoint.pt> [runs]}"
RUNS="${2:-10}"
OUT="$HOME/sar_results"
mkdir -p "$OUT"

echo "== Config B: rule-based allocator, 3 robots, $RUNS runs"
for i in $(seq 1 "$RUNS"); do
  echo "--- run $i/$RUNS"
  timeout 700 ros2 launch sar_bringup multi_sar.launch.py \
    robots:=3 allocator:=rule rviz:=false || true
  sleep 2
done

echo "== Config C: MAPPO allocator, 3 robots, $RUNS runs"
for i in $(seq 1 "$RUNS"); do
  echo "--- run $i/$RUNS"
  timeout 700 ros2 launch sar_bringup multi_sar.launch.py \
    robots:=3 allocator:=rl checkpoint:="$CKPT" rviz:=false || true
  sleep 2
done

echo "== Plotting results in $OUT"
python3 "$(dirname "$0")/../ros2_ws/src/sar_eval/scripts/plot_results.py" \
  "$OUT/metrics_*.csv" -o "$OUT/figs"
echo "Done. Summaries: $OUT"
