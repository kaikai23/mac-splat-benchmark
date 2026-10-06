# Apple Silicon Mac Gaussian Splatting 复现实验

在目标 Mac 上重新运行 **Visionary 1.0.1、Spark.js 0.1.10 原生默认排序、SuperSplat Editor 2.1.0**。完整实验为 **13 场景 × 4 个模型规模 × 3 方法 = 156 配置**，输出阶段时间、端到端完成时间 P50/P95、完成吞吐 FPS，以及重新测量的 PSNR、SSIM、LPIPS。Windows 和之前 Spark 2.1 的结果均不参与本实验的统计。

本仓库保存源码、相机、模型哈希、依赖锁和运行脚本；不保存模型、GT 照片、VGG 权重、依赖安装目录或个人配置。各 Mac 的芯片、内存、macOS、Chrome 及 GPU 后端由运行时采集，不能把一台机器的报告作为另一台的测量。

## 固定实现与实验范围

| 方法 | 固定源码 | 实际排序 | 源码许可 |
|---|---|---|---|
| Visionary 1.0.1 | `e50f3f6c7200be0516567f0830e5240dfa26d27d` | WebGPU FP32 radix | [Apache-2.0](work/visionary/LICENSE) |
| Spark.js 0.1.10 | `792d6d193db8b79ed4d1f32ef65cca9ec93f0896` | 上游 Worker/WASM 默认 native16，`sort32=false` | [MIT](work/spark-v0.1.10/LICENSE) |
| SuperSplat Editor 2.1.0 | `2f23b4b2072da694172faa26ff44fc67f2a01ca2` | PlayCanvas 2.5.1 原生 Worker adaptive bucket | [MIT](work/supersplat-v2.1/LICENSE) |

PlayCanvas 固定提交为 `362a874c7149ee181ba68f4cc270fc7b664d7f0b`，附带其 [MIT 许可](work/supersplat-bench/vendor/playcanvas/LICENSE)。Spark bundle 只添加计时/完成确认所需插桩，保留官方 WASM payload；同步测量适配器还补偿上游 `prepare()` 未释放的临时 accumulator 引用，避免五槽耗尽，原生排序和 shader 不变；没有自制 FP16 分支。[Spark 变更说明](work/spark-v0.1.10/BENCHMARK.md)和 [集中来源声明](config/source-identities.json)保留版本、哈希和生命周期验证证据。Visionary 仅带渲染所需源码，SuperSplat 的测量入口是固定引擎渲染适配器，并非整个编辑器 UI。保留各上游许可和代码注释。

共同设置：官方 iteration 30000 PLY，固定每 8 张选一张的 378 个 heldout 相机；完整模型及每 2/4/8 行确定性抽样；SH degree 3、黑背景、关闭 LoD、1280×720 framebuffer、DPR 1。正式每配置 5 轮，每轮遍历相机 3 次，首轮预热至少 10 秒且至少 128 样本，轮间至少 1.5 秒且至少 32 样本。总计 **780 轮、68,040 个时间样本、4,536 张质量图像、234 张展示 PNG**。

## 1. 准备目标 Mac 与离线依赖

使用原生 arm64 的 macOS 14 或更新版本、Node.js 22/24 LTS、Python 3.12 和 Google Chrome。不要在 Rosetta 终端运行。Python wheel 锁针对 macOS arm64 / CPython 3.12；Chrome 版本不写死，但必须实际支持 Apple WebGPU timestamp-query 和 ANGLE Metal WebGL2 timer query。旧浏览器或无硬件时间查询的环境会在验证/试跑中失败，不替换成 CPU/软件结果。

所有外网依赖、模型和照片下载统一在 **`ecofde`** 进行，然后复制回测量 Mac。Node/Python/Chrome 安装程序也通过该联网节点或已有受管理安装包取得。`llm1` 不参与此 Mac 实验。以下命令从克隆后的仓库根目录执行；SSH 使用既有别名和各自的仓库访问权限，不把凭据写入文件或命令示例。

把轻量下载脚本和固定锁文件送到联网节点：

```sh
tar -czf /tmp/mac-splat-setup.tgz scripts package.json package-lock.json \
  work/bench/package-lock.json config/python-wheels.lock.json
scp /tmp/mac-splat-setup.tgz ecofde:mac-splat-setup.tgz
ssh ecofde 'mkdir -p mac-splat-setup && tar -xzf mac-splat-setup.tgz -C mac-splat-setup'
ssh ecofde 'cd mac-splat-setup && python3 scripts/fetch-offline-dependencies.py \
  --network-node ecofde --output ../mac-splat-offline-cache --with-vgg'
rsync -a ecofde:mac-splat-offline-cache/ ../mac-splat-offline-cache/
```

若该节点需要代理，给远程下载命令使用节点已经配置的 `HTTPS_PROXY`；不要把代理凭据提交到仓库。下载器只接受锁定 npm integrity 和 PyPI wheel SHA，VGG 也按固定 SHA 校验。缓存同时包含其它平台的 npm 可选包，以便目标 Mac 的 `npm ci --offline` 选择 arm64 原生包。联网节点的 Node 只用于缓存 tarball；实际运行 Node 必须满足 Mac 端要求。

在 Mac 离线安装，不执行 `playwright install`，直接使用系统 Chrome：

```sh
python3.12 scripts/install-offline.py --cache ../mac-splat-offline-cache --python python3.12
mkdir -p .cache/torch/hub/checkpoints
cp ../mac-splat-offline-cache/torch/hub/checkpoints/vgg16-397923af.pth \
  .cache/torch/hub/checkpoints/
```

安装脚本分别在根目录和 `work/bench` 执行固定 `npm ci --offline`，创建 `.venv` 并用 `--no-index` 安装锁定 wheels。实际 host 共享 `work/bench/node_modules`；无需给每个 vendored 上游项目安装开发环境。缺失/哈希不符会失败，不会偷偷联网补齐。`.cache`、`.venv`、`node_modules` 都被 Git 忽略。

## 2. 配置已提供的模型与 GT

优先复用同事已经提供的完整数据目录。模型约 18.5 GB，**保留模型相对路径**，可放外置盘，仓库不复制它们。权威身份来自 `config/data/manifest.json`、`subsets-manifest.json` 与 `config/data-lock.json`；`dataRoot` 只需含 52 个模型路径，相机使用仓库的 `config/cameras`。

```sh
python3.12 scripts/configure.py \
  --data-root /Volumes/Experiments/splat-models \
  --ground-truth-root /Volumes/Experiments/splat-ground-truth \
  --output-root results/my-mac-run
.venv/bin/python scripts/detect-environment.py --output results/setup/environment.json
.venv/bin/python scripts/verify-ground-truth.py \
  --ground-truth-root /Volumes/Experiments/splat-ground-truth \
  --output results/setup/ground-truth-verification.json
```

`configure.py` 默认重新读取并核对全部 52 个模型的 bytes/SHA256，生成忽略的 `config/local.json` 和校验回执。仅配置路径时可加 `--paths-only`，但运行器仍在启动 GPU 前完整校验。自定义 Chrome 用 `--chrome '/path/to/Google Chrome.app/Contents/MacOS/Google Chrome'`。配置路径统一相对仓库根目录解析；也支持绝对路径。示例字段见 [config/example.json](config/example.json)，不得提交实际的 `config/local*.json`。

准备好的 GT 目录须含 `ground-truth-manifest.json` 和 `rgb1280/`。验证器检查 378 张图像的 SHA、相机与图像名、RGB8/1280×720 格式和固定 Pillow 11.3.0 bicubic 变换。可复用经过验证的原照片和 GT；所有渲染图与质量指标必须出自本次新测量。VGG checkpoint SHA 固定为 `397923af8e79cdbb6a7127f12361acd7a2f83e06b05044ddf496e83de57a5bf0`，缺少权重会失败而非自动下载。

缺少模型时，先看恢复计划；不会读完整模型或联网：

```sh
python3.12 scripts/restore-models.py plan \
  --manifest-dir config/data --data-dir /Volumes/Experiments/splat-models
```

若已有原始 13 模型但缺子集，在 Mac 空闲时运行 `rebuild-subsets`；若原始模型也缺失，把 `scripts/restore-models.py` 和完整 `config/data/` 复制至 `ecofde`，在该节点执行以下恢复，再把模型目录复制回 Mac：

```sh
# 在 ecofde 上，Python >=3.10，当前目录含 scripts/ 与 config/data/。
python3 scripts/restore-models.py fetch-originals --network-node ecofde \
  --manifest-dir config/data --data-dir ../splat-models --receipt ../fetch-models.json
python3 scripts/restore-models.py rebuild-subsets \
  --manifest-dir config/data --data-dir ../splat-models --receipt ../rebuild-subsets.json
python3 scripts/restore-models.py verify \
  --manifest-dir config/data --data-dir ../splat-models --receipt ../verify-52-models.json
```

恢复脚本使用官方模型归档的锁定成员偏移、受限 HTTP Range、CRC、字节长度和最终 SHA。原模型仅取 iteration 30000；子集必须恢复成锁定 SHA。已有不匹配文件会保留并报错，不能通过更新清单把未知数据当基线。预留完整模型约 18.5 GB、当前压缩成员/解压临时空间、依赖与结果空间；不要把大数据写进 Git。若缺 GT，按 [quality/README.md](quality/README.md) 在 `ecofde` 获取选定原照片，在 Mac 用固定 Pillow 变换准备 GT。

## 3. 输入验证、试跑与正式测量

接通 AC 电源，关闭当前 AC 电源配置的低功耗模式，保持机器空闲；运行器记录观察到的供电状态，不会修改系统设置。不要同时跑另一份基准、MPS 质量指标或大型安装/哈希任务。

```sh
node work/supersplat-bench/verify-worker.mjs \
  --output=results/setup/supersplat-worker.json
node work/spark-v0.1.10/validate-native-sort.mjs \
  --output=results/setup/spark-native-sort-cpu-validation.json
node work/spark-v0.1.10/validate-native-prepare.mjs \
  --output=results/setup/native-prepare-lifecycle-review.json
node run-experiment.cjs --config config/local.json --mode validate \
  --output results/my-mac-run/preflight
node validation/probe-gpu.cjs config/local.json results/setup/gpu-probe
node run-experiment.cjs --config config/local.json --mode pilot \
  --output results/my-mac-run/pilot
.venv/bin/python analysis/independent_audit.py \
  --run-dir results/my-mac-run/pilot \
  --output results/my-mac-run/pilot/validation/independent-pilot-qa.json
node run-experiment.cjs --config config/local.json --mode full \
  --output results/my-mac-run/formal
```

三个 CPU 验证与 GPU probe 的规范回执保存到 `results/setup`（可通过 `config.validationRoot` 配置）。`validate` 校验 52 模型和 378 相机，不启动 GPU。独立 probe 在实际 GPU 验证时间查询。`pilot` 在 train/bicycle、stride 1/8、全部三方法共 12 配置上实际检验 GPU、时间查询、当前相机、图像与清理；试跑为 1 轮/1 遍且首预热至少 1 秒/128 样本，不能混入正式统计。`full` 执行全部 156 配置，每配置新建浏览器，三方法轮换顺序，且所有方法使用同一相机矩阵。`config.pilotOutput` 指向成功的 12 配置试跑，默认是 `config.outputRoot/pilot`；修改 `--output` 自定义试跑目录时同步配置它。正式运行前强制校验三份 CPU 回执、目标 GPU probe、12 配置试跑的来源、浏览器/系统和完整清理。

运行器独占 `results/gpu-session.lock`，管理自己的 Chrome、Vite（8770/8771/8772）与 `caffeinate` 进程。不要手动删除仍有存活进程的锁，不终止其它用户的 Chrome。中断后保留检查点；以完全相同命令恢复，只复用协议/源码/浏览器/输入一致且完整的配置。更换代码、浏览器或硬件时使用新的输出目录。待 `runtime-cleanup.json` 表示完成且所有自有进程退出后，才运行质量度量。

独立审计不调用运行器或报告模块的统计公式，重新检查全部相机/顺序、时钟、阶段算术、P50/P95/FPS、供电、源码 SHA、截图哈希及 PNG/WebP RGB 一致性，也确认归属进程和端口退出。只在 GPU 锁释放后执行；正式性能结束后用同一命令替换 `--run-dir` 为 formal 目录。阶段查询和超过 E2E 的现象会保留为诊断，不删除原始样本或把查询和当成物理可加和时间。

## 4. 新质量度量与报告

```sh
.venv/bin/python quality/validate_metrics.py --include-lpips \
  --torch-home .cache/torch \
  --output results/my-mac-run/formal/validation/quality-numerical-validation.json
.venv/bin/python quality/measure_quality.py \
  --run-dir results/my-mac-run/formal \
  --gt /Volumes/Experiments/splat-ground-truth \
  --selection quality/selection.json --torch-home .cache/torch \
  --output results/my-mac-run/formal/quality/metrics --device mps
.venv/bin/python quality/independent_audit.py --config config/local.json \
  --run-dir results/my-mac-run/formal --threads 2
.venv/bin/python analysis/analyze.py --config config/local.json \
  --run-dir results/my-mac-run/formal
```

Torch/MPS 在实际 Mac 重新计算全部 4,536 张新渲染图的指标；PSNR 使用 RGB8 的 CPU float64 MSE，SSIM 使用固定 11×11 Gaussian，LPIPS 使用官方 VGG v0.1 权重。[质量定义](quality/README.md)记录归一化、边界填充及 GT 缩放限制。不要把这些固定分辨率结果称为原论文原生分辨率分数。

等 MPS 进程退出后，再执行独立 CPU 质量审计。它重新校验全部图像与来源哈希，以精确 RGB8 整数平方误差和 float64 MSE 独立复算全部 4,536 个 PSNR，并核对 156 配置均值和 12 个场景等权聚合。每个场景/方法选完整模型的第 0 个相机，共 39 张，用 SciPy float64 可分离卷积复算 SSIM、官方 CPU LPIPS 复核 MPS 值。先验允许误差为 PSNR `1e-10 dB`、SSIM `5e-5`、LPIPS `1e-4 + 1e-4×|CPU值|`；保留全部原值与差异，失败不会自动放宽阈值。其余视图的 SSIM/LPIPS 检查涵盖完整来源、数值范围和聚合，不声称逐图 CPU 重算。通过回执为 `validation/independent-quality-qa.json`。

若用户在配置边界暂停正式运行，可显式给两个独立审计程序传入 `--allow-partial`，只审计已完整落盘的配置；逐配置验证保持不变，并要求归属进程退出和 GPU 锁释放。质量审计支持 `--metrics-dir`、`--numerical-validation` 和 `--output`，可将预览指标与回执放在单独的 `results/<run-id>/preview/` 目录。部分结果即使审计通过也保持 `complete=false`、`partial=true`，报告必须列出实际覆盖，跨方法摘要只比较共同完成的场景；CPU SSIM/LPIPS 抽查覆盖每个已完成完整模型配置的第 0 个相机。默认审计仍要求全部 156 配置和 4,536 张质量图像。

结果目录包含 `protocol.json`、环境/源哈希、`raw/*.json`、逐配置供电记录、PNG/WebP、新质量 JSONL 和覆盖校验，以及 `analysis/` 下中英报告、CSV、图、LaTeX 表。只有精确的 156 配置/4,536 质量图完整通过，分析器才产出完整报告。详细结构见 [analysis/README.md](analysis/README.md)。

主要 E2E 从浏览器 `await bench.sample(camera)` 前到 Promise 返回，包含当前相机设置、新排序、GPU 完成确认、查询读回/轮询和插桩；**不表示物理屏幕显示延迟**。P50/P95 为全部逐帧完成样本的 Type7 分位数。FPS 为 `1000 × 完成样本数 / Σ轮次浏览器窗口毫秒`，是串行完成吞吐；原生 rAF callback 吞吐另列。阶段时间保持各引擎原来的边界，不将阶段倒数冒充 FPS。跨场景等权平均每场景统计，不能与池化分位数或延迟倒数混淆。

## 可复核的 CPU 检查

第 3 步中的 SuperSplat 检查官方源码、发行 Worker 与计时版的完整输出顺序/计数一致性。Spark 检查官方 Worker/WASM 的全 65,536 种 half 位模式、随机与平局排序，以及原生同步准备的临时引用补偿。原生排序验证、host 构建回执及插桩证据见其 [BENCHMARK.md](work/spark-v0.1.10/BENCHMARK.md)。这些 CPU 检查不代替目标 Mac 的 GPU 试跑。
