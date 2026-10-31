"""Benchmark trained MAPPO vs rule-based vs random allocation (abstract env).

Usage (from training/):
    python evaluate.py --checkpoint runs/<run>/checkpoint_best.pt --maps 6 --episodes 4
Writes runs/eval_results.json and prints a mean±std table.
"""

import argparse
import json
import os
import sys
from dataclasses import replace

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import ENV                          # noqa: E402
from sar_gym import MultiAgentSAREnv            # noqa: E402
from policies import MAPPOPolicy, RulePolicy, RandomPolicy  # noqa: E402

METRICS = ("coverage", "victims", "mean_detection_step", "overlap_ratio", "steps")


def run_episode(env, policy, seed):
    obs, _ = env.reset(seed=seed)
    done = trunc = False
    while not (done or trunc):
        a = policy.act(env, obs)
        obs, _, done, trunc, info = env.step(a)
    det = info["detection_steps"]
    return {
        "coverage": info["coverage"],
        "victims": info["victims"],
        "mean_detection_step": float(np.mean(det)) if det else float("nan"),
        "overlap_ratio": info["overlap_ratio"],
        "steps": info["steps"],
    }


def eval_policy(pol, args):
    rows = []
    for m in range(args.maps):
        env = MultiAgentSAREnv(ENV, seed=10_000 + m * 100)
        for e in range(args.episodes):
            rows.append(run_episode(env, pol, seed=10_000 + m * 100 + e))
            print(f"  [{pol.name}] map {m + 1}/{args.maps} "
                  f"ep {e + 1}/{args.episodes} -> cov {rows[-1]['coverage']:.0%}, "
                  f"victims {rows[-1]['victims']}, {rows[-1]['steps']} steps",
                  flush=True)
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--checkpoint", type=str, required=True)
    ap.add_argument("--maps", type=int, default=6)
    ap.add_argument("--episodes", type=int, default=4)
    ap.add_argument("--deterministic", type=int, default=1)
    ap.add_argument("--robots", type=int, default=3,
                    help="team size for the benchmark (1 = single-robot baseline, "
                         "the config-A comparison from the build plan)")
    args = ap.parse_args()

    env_cfg = replace(ENV, n_robots=args.robots)
    tag = f"{args.robots}r"
    policies = [MAPPOPolicy(args.checkpoint, deterministic=bool(args.deterministic)),
                RulePolicy(), RandomPolicy()]
    results = {}
    for pol in policies:
        rows = []
        for m in range(args.maps):
            env = MultiAgentSAREnv(env_cfg, seed=10_000 + m * 100)
            for e in range(args.episodes):
                rows.append(run_episode(env, pol, seed=10_000 + m * 100 + e))
                print(f"  [{pol.name}|{tag}] map {m + 1}/{args.maps} "
                      f"ep {e + 1}/{args.episodes} -> cov {rows[-1]['coverage']:.0%}, "
                      f"victims {rows[-1]['victims']}, {rows[-1]['steps']} steps",
                      flush=True)
        results[f"{pol.name}_{tag}"] = rows
        print(f"\n{pol.name} ({len(rows)} episodes, {args.robots} robots)")
        for k in METRICS:
            vals = [r[k] for r in rows if not np.isnan(r[k])]
            if vals:
                print(f"  {k:20s} {np.mean(vals):8.2f} ± {np.std(vals):6.2f}")

    out = os.path.join(os.path.dirname(os.path.abspath(args.checkpoint)),
                       f"eval_results_{tag}.json")
    with open(out, "w") as f:
        json.dump({"robots": args.robots, "deterministic": bool(args.deterministic),
                   "maps": args.maps, "episodes": args.episodes, "results": results}, f,
                  indent=2)
    print(f"\nSaved {out}")


if __name__ == "__main__":
    main()
