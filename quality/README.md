# Ground-truth quality on a target Mac

The current experiment has **three methods**: Visionary1.0.1, official native
Spark.js0.1.10, and SuperSplat Editor2.1.0. The native Spark sorting width is read
from the run protocol; the currently selected upstream runtime default is16-bit.
There is no modified FP16 comparison configuration and no Spark2.1 result input.
The adapter contains timing/diagnostic instrumentation and compensates the native
synchronous `prepare` temporary-reference lifecycle; renderer algorithms,
shaders and WASM are unchanged. This is recorded in the run metadata.
Only the native 16-bit sorting-key choice matches the upstream runtime default.
The benchmark explicitly uses `sortRadial=false`, `preBlurAmount=0.3` and
`blurAmount=0`; their upstream defaults are `true`, `0` and `0.3` respectively.

The immutable `selection.json` contains13 scenes and378 heldout camera dictionaries.
Three methods × four strides ×378 views gives **4,536 newly rendered images**.
The original photographs and prepared GT may be reused after identity verification;
every renderer capture and every quality metric must belong to the new run.

## Setup and metric execution

On the target Mac, prepare native arm64 Node.js22/24, Python3.12 and system
Chrome, then run the repository's online setup from its root:

```sh
python3.12 scripts/setup-online.py \
  --data-root data --output-root results/my-mac-run
```

It downloads pinned dependencies and VGG, installs `.venv`, obtains the fixed
models and378 source photographs, prepares/verifies GT, and creates local
configuration. No SSH account, `ecofde` access or large asset handoff is required.
Setup must finish before performance collection; it does not launch a GPU probe
or measurement. Prepared GT is `DATA_ROOT/ground-truth`, and default `torchHome`
is `.cache/online-setup/torch`. See the [colleague guide](../docs/COLLEAGUE_QUICKSTART.zh-CN.md)
for the complete order and optional offline preparation.

Use Python3.12 and the pinned repository virtualenv. Root `requirements.txt` includes
this directory's `requirements.txt`; dependencies, wheels and model weights do not
belong in Git. `config/local.json` supplies `groundTruthRoot` and `torchHome`.
Relative configuration paths resolve from the repository root, independently of
the working directory. The VGG checkpoint is
`TORCH_HOME/hub/checkpoints/vgg16-397923af.pth`, with SHA256
`397923af8e79cdbb6a7127f12361acd7a2f83e06b05044ddf496e83de57a5bf0`.
The metric script refuses to download missing weights. If an older error message
mentions downloading through `ecofde`, it does not require that account; follow
the [configured local-cache recovery instructions](../docs/TROUBLESHOOTING.zh-CN.md#missing-vgg).

For a complete report, run quality only after the performance runner reports
complete, stops its owned browser/server processes, and releases
`results/gpu-session.lock`. An explicitly requested partial preview may use
`--allow-partial` after the collector has safely stopped, with every owned process
exited and the GPU lock released. MPS quality must never overlap performance
collection. PSNR uses CPU float64 pixel MSE;
SSIM/LPIPS use the explicitly selected `cpu` or `mps` device. MPS availability is
checked on the actual target Mac, without assuming a particular M-series chip.

From the repository root, with paths in your configuration: `results/RUN` is
the outer run directory; the measured collection is `results/RUN/formal`.

```sh
BENCH_TORCH_HOME=$(.venv/bin/python -c 'import json; print(json.load(open("config/local.json"))["torchHome"])')
.venv/bin/python quality/validate_metrics.py \
  --include-lpips --torch-home "$BENCH_TORCH_HOME" \
  --output results/RUN/formal/validation/quality-numerical-validation.json

.venv/bin/python quality/measure_quality.py \
  --config config/local.json --run-dir results/RUN/formal --device mps
```

The default output is `results/RUN/formal/quality/metrics`. Explicit `--gt`,
`--torch-home`, `--selection` and `--output` overrides are also available.

The script reads canonical `method=visionary|spark|supersplat` from one run's
`raw/*.json`, checks version/commit and protocol identity, and consumes every
`qualityCaptures` entry. Image paths are relative to that run root. It refuses
to combine old collections or a separately supplied render manifest. Formal
completion requires156 configurations and exactly4,536 unique views.
`--allow-partial` supports an explicitly labeled preview of a safely stopped
collection. It accepts only complete configurations with all their selected
captures, and never sets full-matrix completion true. Put its output in a separate
preview directory. `collection-scope.json` binds the observed raw inventory and
cleanup receipt; `requestedSubsetComplete=true` means only that declared subset
has all quality scores. The full 156-configuration analysis still requires full
coverage. The historical `analysis/preview.py` is not a generic report generator
for arbitrary subsets and is not part of the default workflow. Checkpoints bind
raw, renderer image and GT hashes; changed inputs are
rejected rather than silently reusing stale scores.

The final analysis requires `results/RUN/formal/validation/quality-numerical-validation.json`
with `complete=true`; its metric and validation script hashes must match this
repository, and its VGG hash must match the actual metric protocol. Run the
synthetic CPU validation on this code after timing has finished. A previous
experiment's receipt does not validate the new script identity. Actual-image
CPU/MPS spot checks and independent full-view PSNR recomputation additionally
check the measured quality results; synthetic identities alone do not establish
the correctness of all rendered-view scores.

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

Use the repository virtualenv with **Pillow11.3.0** both when preparing GT and
when running `scripts/verify-ground-truth.py`. The committed
[`scripts/ground-truth-pixels-lock.json`](../scripts/ground-truth-pixels-lock.json)
is the fixed whitelist for all378 selected source/camera identities and decoded
RGB8 pixel hashes. Verification checks this independent whitelist as well as
the supplied manifest and PNG file hashes; changing a supplied manifest cannot
authorize different photographs or pixels. Do not edit the whitelist to accept
different GT. Existing verified GT may be copied without resizing or re-encoding.

`prepare_ground_truth.py` verifies every source SHA, dimension and camera before
RGB conversion and fixed1280×720 Pillow bicubic resizing. No EXIF rotation,
crop, padding, color linearization or exposure matching is performed. Official
truck/train photos are979×546/980×545, about half their calibration dimensions;
those70 views are upsampled. The source-resolution policy records this explicitly.
Fixed-framebuffer scores must not be presented as original-paper native-resolution
scores, and differing renderer quality must not be attributed solely to key width.
The shared camera centers and GT resize use independent effective `fx`/`fy`.
SuperSplat retains its native single-focal covariance Jacobian, which uses the
horizontal focal value for both axes. Effective `fx/fy` across the 378 cameras
ranges from 0.984859 to 1.186780, with constant intrinsics within each scene.
This can affect Gaussian footprints, quality and rendering workload. It does
not imply the full ellipse height changes by that exact ratio; covariance,
rotation, blur and radius caps remain relevant.

`scripts/setup-online.py` performs source acquisition directly on the colleague's
Mac before measurement. Its data root contains `gt-source/` with the original
photographs and provenance, plus `ground-truth/` with fixed prepared pixels.
Source URLs and exact selected image names are archived in `selection.json`.
Acquisition uses bounded ZIP ranges, HTTP206/Content-Range checks, CRC32, length
and SHA receipts rather than accepting a partial/full response blindly.

For an optional offline route with already verified original photographs, prepare
and verify them using the pinned local environment:

```sh
.venv/bin/python quality/prepare_ground_truth.py \
  --source data/gt-source \
  --selection quality/selection.json \
  --output data/ground-truth
.venv/bin/python scripts/verify-ground-truth.py \
  --ground-truth-root data/ground-truth \
  --output results/RUN/setup/ground-truth-verification.json
```

The original maintainer may continue using its designated `ecofde` download node;
that infrastructure convention is not a prerequisite for colleagues running the
public repository on their own Macs.
