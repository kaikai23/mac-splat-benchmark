# Ground-truth quality on a target Mac

The current experiment has **three methods**: Visionary1.0.1, official native
Spark.js0.1.10, and SuperSplat Editor2.1.0. The native Spark sorting width is read
from the run protocol; the currently selected upstream runtime default is16-bit.
There is no modified FP16 comparison configuration and no Spark2.1 result input.
The adapter contains timing/diagnostic instrumentation and compensates the native
synchronous `prepare` temporary-reference lifecycle; renderer algorithms,
shaders and WASM are unchanged. This is recorded in the run metadata.

The immutable `selection.json` contains13 scenes and378 heldout camera dictionaries.
Three methods × four strides ×378 views gives **4,536 newly rendered images**.
The original photographs and prepared GT may be reused after identity verification;
every renderer capture and every quality metric must belong to the new run.

## Environment and offline execution

Use Python3.12 and the pinned repository virtualenv. Root `requirements.txt` includes
this directory's `requirements.txt`; dependencies, wheels and model weights do not
belong in Git. `config/local.json` supplies `groundTruthRoot` and `torchHome`.
Relative configuration paths resolve from the repository root, independently of
the working directory. The VGG checkpoint is
`TORCH_HOME/hub/checkpoints/vgg16-397923af.pth`, with SHA256
`397923af8e79cdbb6a7127f12361acd7a2f83e06b05044ddf496e83de57a5bf0`.
The metric script refuses to download missing weights.

Run quality only after the performance runner reports complete, stops its owned
browser/server processes, and releases `results/gpu-session.lock`. MPS quality
must never overlap performance collection. PSNR uses CPU float64 pixel MSE;
SSIM/LPIPS use the explicitly selected `cpu` or `mps` device. MPS availability is
checked on the actual target Mac, without assuming a particular M-series chip.

From the repository root, with external paths in your configuration:

```sh
.venv/bin/python quality/validate_metrics.py \
  --include-lpips --torch-home /absolute/torch-home \
  --output results/RUN/validation/quality-numerical-validation.json

.venv/bin/python quality/measure_quality.py \
  --config config/local.json --run-dir results/RUN --device mps
```

The default output is `results/RUN/quality/metrics`. Explicit `--gt`,
`--torch-home`, `--selection` and `--output` overrides are also available.

The script reads canonical `method=visionary|spark|supersplat` from one run's
`raw/*.json`, checks version/commit and protocol identity, and consumes every
`qualityCaptures` entry. Image paths are relative to that run root. It refuses
to combine old collections or a separately supplied render manifest. Formal
completion requires156 configurations and exactly4,536 unique views.
`--allow-partial` is reserved for explicitly labeled pilots; it cannot set full
matrix completion true. Checkpoints bind raw, renderer image and GT hashes;
changed inputs are rejected rather than silently reusing stale scores.

## Metric definitions

- **PSNR**: encoded RGB8 divided by255; float64 MSE over every channel/pixel;
  `−10 log10(MSE)`. Perfect agreement is `null` plus an explicit infinity flag.
  Configuration scores average per-image dB; they are not PSNR of a pooled MSE.
- **SSIM**:11×11 Gaussian window, sigma1.5, C1=.01², C2=.03², zero padding5,
  RGB/pixel average. Negative values are valid and are retained.
- **LPIPS**: official lpips0.1.4, v0.1 VGG/ImageNet trunk and learned calibration,
  eval mode, float32 `[0,1]` tensors with `normalize=True`.

Each scene averages its selected views. Cross-scene results give equal weight to
the13 scene means, separately for each of strides1/2/4/8. Source/GT/capture hashes,
package versions, model-weight hashes, script identity, and actual computation
device are retained in the metric protocol and JSONL outputs.

## Ground truth and source recovery

`prepare_ground_truth.py` verifies every source SHA, dimension and camera before
RGB conversion and fixed1280×720 Pillow bicubic resizing. No EXIF rotation,
crop, padding, color linearization or exposure matching is performed. Official
truck/train photos are979×546/980×545, about half their calibration dimensions;
those70 views are upsampled. The source-resolution policy records this explicitly.
Fixed-framebuffer scores must not be presented as original-paper native-resolution
scores, and differing renderer quality must not be attributed solely to key width.

All network acquisition runs on the designated **ecofde** node. Transfer only the
selected source photos, receipts, pinned wheels and checkpoint to the Mac.
Scripts require an explicit network-node flag and reject running retrieval on macOS.

```sh
# On ecofde, from a staged copy of quality/:
python3 acquire_ground_truth.py --network-node ecofde \
  --selection selection.json --output gt-source --download --max-bytes 400000000
python3 fetch_primary_evidence.py --network-node ecofde --output primary-evidence

# On the target Mac, after copying the verified source directory:
.venv/bin/python quality/prepare_ground_truth.py \
  --source /absolute/gt-source --selection quality/selection.json \
  --output /absolute/prepared-ground-truth
```

Source URLs and exact selected image names are archived in `selection.json`.
The acquisition path uses bounded ZIP ranges, HTTP206/Content-Range checks,
CRC32, length and SHA receipts instead of accepting a partial/full response blindly.
