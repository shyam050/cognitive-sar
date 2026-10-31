"""MAPPO training driver.

Usage (from training/):
    python train.py --steps 150000 --seed 0
Outputs runs/<run_name>/: metrics.csv, checkpoint_last.pt, checkpoint_best.pt
"""

import argparse
import csv
import json
import os
import sys
import time
from dataclasses import asdict

import numpy as np
import torch

# small models on CPU train faster with a thread cap (less per-op overhead)
torch.set_num_threads(max(1, (os.cpu_count() or 4) // 2))

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import ENV, PPO                      # noqa: E402
from sar_gym import MultiAgentSAREnv             # noqa: E402
from mappo import ActorNet, CriticNet, RolloutBuffer, MAPPO  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--steps", type=int, default=150_000)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--run-name", type=str, default=None)
    ap.add_argument("--map-size", type=int, default=ENV.map_size)
    ap.add_argument("--resume", action="store_true",
                    help="continue from runs/<run-name>/checkpoint_last.pt")
    args = ap.parse_args()

    env_cfg = ENV
    env_cfg.map_size = args.map_size
    ppo_cfg = PPO
    run_name = args.run_name or f"mappo_s{args.seed}_{args.steps//1000}k"
    run_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "runs", run_name)
    os.makedirs(run_dir, exist_ok=True)

    torch.manual_seed(args.seed)
    np.random.seed(args.seed)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    if device == "cuda":
        print(f"training on GPU: {torch.cuda.get_device_name(0)}")

    env = MultiAgentSAREnv(env_cfg, seed=args.seed)
    n_actions = env.n_actions
    actor = ActorNet(env_cfg, ppo_cfg).to(device)
    critic = CriticNet(env_cfg, ppo_cfg).to(device)
    algo = MAPPO(actor, critic, ppo_cfg, n_actions, device)

    with open(os.path.join(run_dir, "config.json"), "w") as f:
        json.dump({"env": asdict(env_cfg), "ppo": asdict(ppo_cfg),
                   "n_actions": n_actions, "seed": args.seed}, f, indent=2)
    csv_path = os.path.join(run_dir, "metrics.csv")
    append = args.resume and os.path.exists(csv_path)
    csv_f = open(csv_path, "a" if append else "w", newline="", buffering=1)
    writer = csv.writer(csv_f)
    if not append:
        writer.writerow(["episode", "steps", "reward_sum", "coverage", "victims",
                         "overlap_ratio", "entropy", "kl", "wall_s"])

    obs, _ = env.reset(seed=args.seed)
    total_steps, episode = 0, 0
    if args.resume:
        last = os.path.join(run_dir, "checkpoint_last.pt")
        if os.path.exists(last):
            ckpt = torch.load(last, map_location=device, weights_only=False)
            actor.load_state_dict(ckpt["actor"])
            critic.load_state_dict(ckpt["critic"])
            total_steps = ckpt.get("total_steps", 0)
            # episodes logged so far (csv is authoritative; log may be lost)
            with open(csv_path) as f:
                episode = max(0, sum(1 for _ in f) - 1)
            print(f"resumed {run_name} at step {total_steps} (episode {episode})")
        else:
            print("no checkpoint to resume from; starting fresh")

    buf = RolloutBuffer(ppo_cfg.rollout_steps, env_cfg.n_robots,
                        crop_shape=(3, env_cfg.crop_size, env_cfg.crop_size),
                        glob_shape=((4 + env_cfg.n_robots, env_cfg.map_size, env_cfg.map_size),),
                        device=device, n_actions=n_actions)
    buf.set_gae(ppo_cfg.gamma, ppo_cfg.gae_lambda)

    ep_reward, ep_start_time = 0.0, time.time()
    recent = []
    best_recent = -1e9
    t_train = time.time()

    while total_steps < args.steps:
        # linear entropy decay
        frac = min(1.0, total_steps / ppo_cfg.ent_decay_steps)
        ppo_cfg.ent_coef = ppo_cfg.ent_coef + (ppo_cfg.ent_coef_min - ppo_cfg.ent_coef) * frac

        for _ in range(ppo_cfg.rollout_steps):
            # invalid-action mask: regions without frontiers cannot be chosen
            rf = env.world.region_frontiers()
            action_mask = np.array(
                [1.0 if rf.get(a, (None, 0))[1] > 0 else 0.0
                 for a in range(n_actions)], dtype=np.float32)
            if action_mask.sum() == 0:
                action_mask = None  # map fully explored; fall back to unmasked
            actions_np, logp, value = algo.act(obs, action_mask=action_mask)
            obs_next, rewards, terminated, truncated, info = env.step(
                {i: int(actions_np[i]) for i in range(env_cfg.n_robots)})
            rvec = np.array([rewards[i] for i in range(env_cfg.n_robots)], dtype=np.float32)
            done = terminated or truncated
            buf.add(obs, actions_np, logp, np.full(env_cfg.n_robots, value, np.float32),
                    rvec, float(done), mask=None if action_mask is None
                    else np.repeat(action_mask[None, :], env_cfg.n_robots, axis=0))
            ep_reward += float(rvec.sum())
            total_steps += 1
            obs = obs_next
            if done:
                episode += 1
                row = [episode, info["steps"], round(ep_reward, 2),
                       round(info["coverage"], 4), info["victims"],
                       round(info["overlap_ratio"], 4),
                       round(ppo_cfg.ent_coef, 5), "", round(time.time() - ep_start_time, 2)]
                writer.writerow(row)
                recent.append((ep_reward, info["coverage"], info["victims"]))
                if len(recent) > 10:
                    recent.pop(0)
                if episode % 10 == 0:
                    mr = np.mean([r for r, _, _ in recent])
                    mc = np.mean([c for _, c, _ in recent])
                    mv = np.mean([v for _, _, v in recent])
                    sps = total_steps / (time.time() - t_train)
                    print(f"ep {episode:4d} | steps {total_steps:7d} | reward {mr:8.1f} | "
                          f"coverage {mc:5.1%} | victims {mv:4.1f}/{info['n_victims']} | "
                          f"{sps:5.0f} steps/s", flush=True)
                if len(recent) >= 10:
                    mr = np.mean([r for r, _, _ in recent])
                    if mr > best_recent:
                        best_recent = mr
                        save(run_dir, "checkpoint_best.pt", actor, critic,
                             env_cfg, total_steps)
                ep_reward = 0.0
                ep_start_time = time.time()
                obs, _ = env.reset()

        data = buf.finalize(obs, critic)
        stats = algo.update(data)
        buf.ptr = 0
        save(run_dir, "checkpoint_last.pt", actor, critic, env_cfg, total_steps)

    csv_f.close()
    print(f"Training done in {(time.time() - t_train)/60:.1f} min -> {run_dir}")

    # quick deterministic self-check against the rule baseline
    from policies import MAPPOPolicy, RulePolicy
    print("\nQuick self-check (5 unseen maps, deterministic):")
    rows = []
    for pol in (MAPPOPolicy(os.path.join(run_dir, "checkpoint_last.pt")),
                RulePolicy()):
        rs, cs, vs = [], [], []
        for s in range(5):
            e = MultiAgentSAREnv(env_cfg, seed=1000 + s)
            o, _ = e.reset(seed=1000 + s)
            done = trunc = False
            R = 0.0
            while not (done or trunc):
                a = pol.act(e, o)
                o, rw, done, trunc, inf = e.step(a)
                R += sum(rw.values())
            rs.append(R); cs.append(inf["coverage"]); vs.append(inf["victims"])
        rows.append((pol.name, np.mean(rs), np.mean(cs), np.mean(vs)))
        print(f"  {pol.name:12s} reward {np.mean(rs):8.1f} | coverage {np.mean(cs):5.1%} "
              f"| victims {np.mean(vs):.1f}")
    with open(os.path.join(run_dir, "selfcheck.json"), "w") as f:
        json.dump([{"policy": n, "reward": r, "coverage": c, "victims": v}
                   for n, r, c, v in rows], f, indent=2)


def save(run_dir, name, actor, critic, env_cfg, total_steps=0):
    torch.save({"actor": actor.state_dict(), "critic": critic.state_dict(),
                "env_cfg": env_cfg, "total_steps": total_steps},
               os.path.join(run_dir, name))


if __name__ == "__main__":
    main()
