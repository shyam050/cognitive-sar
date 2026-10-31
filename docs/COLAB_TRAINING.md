# Training the SAR Policy on Google Colab (complete walkthrough)

The policy trains on a **free Colab T4 GPU** in a few hours. Checkpoints save
continuously to Google Drive, so a disconnect costs you almost nothing.

> **What you get at the end:** `checkpoint_best.pt` / `checkpoint_last.pt`
> (the trained allocator), `metrics.csv` (the training curve),
> `eval_results.json` (the benchmark table). Bring these back to the repo and
> the report/deck numbers get regenerated.

---

## Step 0 — Zip the training folder (on your laptop, 1 min)

Only the `training/` directory is needed. Zip it (right-click → Send to →
Compressed folder) **or** use the GitHub route in Step 2 Option B.

## Step 1 — Open Colab with a GPU

1. Go to [colab.research.google.com](https://colab.research.google.com), sign in.
2. New notebook → **Runtime → Change runtime type → T4 GPU → Save**.

## Step 2 — Get the code into Colab

**Option A — upload the zip (simplest):**

Click the 📁 Files icon on the left → Upload → pick `training.zip`, then in a cell:

```python
!unzip -o /content/training.zip -d /content/
%cd /content/training
```

**Option B — clone from GitHub (needs a token):**

Create a fine-grained read-only token (github.com → Settings → Developer
settings → Fine-grained tokens → repo `shyam050/cognitive-sar`, Contents: read-only),
then:

```python
!git clone https://<YOUR_TOKEN>@github.com/shyam050/cognitive-sar.git /content/cognitive-sar
%cd /content/cognitive-sar/training
```

**Option C — resume from the shipped checkpoint (recommended for round 2):**

Both A and B bring `runs/mappo_v1/checkpoint_last.pt` (~148k steps) with them,
so you can either start fresh (clean curve) or continue.

## Step 3 — Mount Drive so checkpoints survive disconnects

```python
from google.colab import drive
drive.mount('/content/drive')
import os
os.makedirs('/content/drive/MyDrive/sar_runs', exist_ok=True)
# make runs/ point at Drive (remove the shipped one first; it stays in git)
if not os.path.islink('runs') and os.path.exists('runs'):
    os.rename('runs', 'runs_local')
os.symlink('/content/drive/MyDrive/sar_runs', 'runs')
```

Now every checkpoint lands in **Drive → MyDrive → sar_runs** automatically.

## Step 4 — Install dependencies (torch is already on Colab)

```python
!pip install -q gymnasium pyyaml matplotlib
import torch
print(torch.__version__, "CUDA:", torch.cuda.is_available())   # want CUDA: True
```

## Step 5 — Train

**Fresh full run (recommended).** The executor and action-masking semantics
were corrected after the first training round, so a fresh run trains under the
final semantics and gives a clean curve for the report:

```python
!python train.py --steps 400000 --seed 0 --run-name mappo_v2
```

**Or continue from the shipped ~148k checkpoint** (it adapts to the corrected
semantics after a few thousand steps, but its curve mixes the old regime):

```python
!python train.py --steps 350000 --resume --run-name mappo_v1
```

Notes:
- Expect **2–5 hours** for 300–400k steps (env stepping is the bottleneck,
  not the GPU). The end-of-run self-check prints the mappo-vs-rule comparison.
- Checkpoints save every 1,000 steps. **If Colab disconnects:** reopen,
  redo Steps 1–4 (Drive still holds everything), then rerun the same
  `--resume` command — training continues where it stopped.
- Keep the tab in the foreground; background tabs idle out faster.
- `metrics.csv` in `runs/<name>/` grows live — you can plot progress anytime:

```python
import pandas as pd, matplotlib.pyplot as plt
df = pd.read_csv('runs/mappo_v2/metrics.csv')
df['reward_sum'].rolling(10).mean().plot(); plt.show()
```

## Step 6 — Benchmark the trained policy

```python
!python evaluate.py --checkpoint runs/mappo_v2/checkpoint_best.pt --maps 6 --episodes 4
!python evaluate.py --checkpoint runs/mappo_v2/checkpoint_best.pt --maps 6 --episodes 4 --deterministic 0
# single-robot comparison (the abstract's "outperform independent single-robot search"):
!python evaluate.py --checkpoint runs/mappo_v2/checkpoint_best.pt --maps 6 --episodes 4 --robots 1
```

The first run is deterministic (argmax) — the strict test of whether the
policy has converged. The second is stochastic sampling (the deployment
default). The third is the single-robot baseline row. Results land next to
the checkpoint as `eval_results_3r.json` / `eval_results_1r.json`.

**Good result to aim for:** 3-robot argmax MAPPO ≥ rule-based on victims and
mission steps, and both 3-robot configs beating every 1-robot config on
coverage and detection time.

## Step 7 — Get the results back

They are already in Drive (`MyDrive/sar_runs/<run_name>/`). On your laptop,
copy into the repo:

```
cognitive-sar/training/runs/<run_name>/checkpoint_best.pt
cognitive-sar/training/runs/<run_name>/checkpoint_last.pt
cognitive-sar/training/runs/<run_name>/metrics.csv
cognitive-sar/training/runs/<run_name>/eval_results.json
```

Then commit and push as usual. The report (`make_report.js`) and deck
(`make_deck.js`) regenerate with the new numbers once the CSV/JSON are in place.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `CUDA: False` in Step 4 | Runtime → Change runtime type → T4 GPU, then re-run the pip cell |
| "Disk full" on Drive | Free space or train to 250k steps instead |
| Session disconnected mid-run | Resume: Steps 1–4, then `--resume` with the same run name |
| `FileNotFoundError: runs/...` | The Drive symlink (Step 3) wasn't created — redo it |
| Slow episodes (<15 steps/s) | Normal variance on free tier; consider a shorter fresh run (200k) |
