# Apple Silicon Mac Gaussian Splatting 复现实验

**第一次在同事的 Mac 上运行，请从 [同事复测指南](docs/COLLEAGUE_QUICKSTART.zh-CN.md) 开始。** [GitHub 仓库](https://github.com/kaikai23/mac-splat-benchmark) 已公开，HTTPS 克隆不需要 GitHub 账号；同事可在自己的 Mac 上直接下载并准备全部依赖、模型与 GT，无需 SSH 账号或大资产包。

在目标 Mac 上重新运行 **Visionary 1.0.1、Spark.js 0.1.10 原生默认排序、SuperSplat Editor 2.1.0**。完整实验为 **13 场景 × 4 个模型规模 × 3 方法 = 156 配置**，输出阶段时间、端到端完成时间 P50/P95、完成吞吐 FPS，以及重新测量的 PSNR、SSIM、LPIPS。Windows 和之前 Spark 2.1 的结果均不参与本实验的统计。

本仓库保存源码、相机、模型哈希、依赖锁和运行脚本；不保存模型、GT 照片、VGG 权重、依赖安装目录或个人配置。各 Mac 的芯片、内存、macOS、Chrome 及 GPU 后端由运行时采集，不能把一台机器的报告作为另一台的测量。

目标为 Apple Silicon **M1/M2/M3/M4/M5 系列**，按目标机的实际 GPU 能力检测，不写死 M1。当前本地实测验证的是 **M1 Pro**；其他芯片必须在本机通过 probe 和 pilot，不能视为已经验证。跨机器比较应同时记录 CPU、内存、OS、Chrome 和供电条件，不能把全部差异仅归因于 GPU 芯片。

## 固定实现与实验范围

| 方法 | 固定源码 | 实际排序 | 源码许可 |
|---|---|---|---|
| Visionary 1.0.1 | `e50f3f6c7200be0516567f0830e5240dfa26d27d` | WebGPU FP32 radix | [Apache-2.0](work/visionary/LICENSE) |
| Spark.js 0.1.10 | `792d6d193db8b79ed4d1f32ef65cca9ec93f0896` | 上游 Worker/WASM 默认 native16，`sort32=false` | [MIT](work/spark-v0.1.10/LICENSE) |
| SuperSplat Editor 2.1.0 | `2f23b4b2072da694172faa26ff44fc67f2a01ca2` | PlayCanvas 2.5.1 原生 Worker adaptive bucket | [MIT](work/supersplat-v2.1/LICENSE) |

PlayCanvas 固定提交为 `362a874c7149ee181ba68f4cc270fc7b664d7f0b`，附带其 [MIT 许可](work/supersplat-bench/vendor/playcanvas/LICENSE)。Spark bundle 只添加计时/完成确认所需插桩，保留官方 WASM payload；同步测量适配器还补偿上游 `prepare()` 未释放的临时 accumulator 引用，避免五槽耗尽，原生排序和 shader 不变；没有自制 FP16 分支。[Spark 变更说明](work/spark-v0.1.10/BENCHMARK.md)和 [集中来源声明](config/source-identities.json)保留版本、哈希和生命周期验证证据。Visionary 仅带渲染所需源码，SuperSplat 的测量入口是固定引擎渲染适配器，并非整个编辑器 UI。保留各上游许可和代码注释。

共同设置：官方 iteration 30000 PLY，固定每 8 张选一张的 378 个 heldout 相机；完整模型及每 2/4/8 行确定性抽样；SH degree 3、黑背景、关闭 LoD、1280×720 framebuffer、DPR 1。正式每配置 5 轮，每轮遍历相机 3 次，首轮预热至少 10 秒且至少 128 样本，轮间至少 1.5 秒且至少 32 样本。总计 **780 轮、68,040 个时间样本、4,536 张质量图像、234 张展示 PNG**。

## 1. 在目标 Mac 上自助安装与下载

准备原生 arm64 的 macOS 14 或更新版本、Node.js 22/24 LTS、Python 3.12 和 Google Chrome。不要在 Rosetta 终端运行。Python wheel 锁针对 macOS arm64 / CPython 3.12；Chrome 必须支持 Apple WebGPU timestamp-query 和 ANGLE Metal WebGL2 timer query，后续 probe/pilot 会在实际硬件验证。

从克隆后的仓库根目录执行：

```sh
python3.12 scripts/setup-online.py \
  --data-root /Volumes/BenchmarkData/mac-splat \
  --output-root results/my-mac-run --python python3.12
```

同事直接使用本机网络，不需要 `ecofde` 或其他 SSH 账号。该入口下载锁定 npm/Python 依赖和 VGG 权重，在本仓库安装 `.venv`，下载 13 个官方 iteration 30000 PLY，在本机生成 39 个确定性子集，再获取 378 张指定原照片、准备并验证固定 GT，最后生成 `config/local.json`。它**不会自动开始 GPU 测量**。所有下载、解压、子集生成和哈希校验必须结束后，才执行第 3 节。

首次联网传输约 **10 GB**：锁定模型归档成员约 8.68 GB、指定照片约 312 MB、依赖和 VGG 约 0.83 GB，另有少量归档元数据。39 个子集由本机生成，**最终 52 模型仍占约 18.5 GB**，不能把下载量当成磁盘用量。建议至少 **30 GB** 可用空间，供临时解压、依赖、GT 和新结果使用；完整归档另留余量。数据与仓库分属不同卷时分别检查空间，准备脚本也会按实际文件动态检查。缓存默认为仓库 `.cache/online-setup`；安装时使用缓存执行固定 `npm ci --offline` 和 pip `--no-index`，不运行 `playwright install`，直接使用系统 Chrome。

默认结果根是 `results/my-mac-run`，可通过 `--output-root` 改成新的 run。自定义 Chrome 可加 `--chrome '/path/to/Google Chrome.app/Contents/MacOS/Google Chrome'`；`--python` 必须指向原生 arm64 Python 3.12。生成的个人路径、依赖和结果均被 Git 忽略。已具备完整离线资产时可选用 [指南中的离线路线](docs/COLLEAGUE_QUICKSTART.zh-CN.md#offline-optional)，不需要重复下载。

可先加 `--plan` 查看准备计划，不下载、不安装、不写文件；用 `--cache` 指定缓存位置。`--output-root` 必须是仓库 `results/` 下专用子目录，若已有 pilot/formal 测量则拒绝复用。已有不同的本机配置也会在下载前拒绝覆盖；使用新的 `--config config/local-other.json`，并在后续所有命令中同步该配置路径。完成后保存各步日志、输入校验和环境回执至 `RUN/setup/online-*/`，不改变原先暂停或完成的实验。

## 2. 数据布局与完整性

在线入口的数据根布局为：

```text
/Volumes/BenchmarkData/mac-splat/
├── models/        # 13 个原模型 + 39 个 stride 子集
├── gt-source/     # 378 张指定原照片及来源回执
└── ground-truth/  # ground-truth-manifest.json + rgb1280/
```

配置中的 `dataRoot` 指向上面的 `models/`，相机固定使用仓库 `config/cameras`；`groundTruthRoot` 指向 `ground-truth/`，`torchHome` 默认指向仓库 `.cache/online-setup/torch`。路径统一相对仓库根目录解析，也支持绝对路径；不要提交 `config/local*.json`。示例字段见 [config/example.json](config/example.json)。

52 个模型必须匹配 `config/data/manifest.json`、`subsets-manifest.json` 与 `config/data-lock.json` 的 bytes/SHA256。下载器使用官方归档的锁定成员、受限 HTTP Range、CRC、字节长度和最终 SHA；已有不匹配文件会报错，不能更新清单将未知数据当作基线。

GT 验证依据仓库内固定的 [378 张 GT 像素/来源白名单](scripts/ground-truth-pixels-lock.json)，检查文件 SHA、解码后的 RGB8 像素 SHA、原照片来源、相机与图像名及变换。**GT 准备和校验使用本仓库 `.venv` 中的 Pillow 11.3.0**，固定输出为 1280×720 RGB8、bicubic 缩放，不能修改白名单接纳其他像素。VGG SHA 固定为 `397923af8e79cdbb6a7127f12361acd7a2f83e06b05044ddf496e83de57a5bf0`。质量测量本身不会下载缺失权重；须先完成 setup。原模型、原照片和合格 GT 可复用，所有渲染图和分数必须来自本次新测量。

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
.venv/bin/python analysis/independent_audit.py \
  --run-dir results/my-mac-run/formal \
  --output results/my-mac-run/formal/validation/independent-formal-qa.json
```

三个 CPU 验证与 GPU probe 的规范回执保存到 `results/setup`（可通过 `config.validationRoot` 配置）。`validate` 校验 52 模型和 378 相机，不启动 GPU。独立 probe 在实际 GPU 验证时间查询。`pilot` 在 train/bicycle、stride 1/8、全部三方法共 12 配置上实际检验 GPU、时间查询、当前相机、图像与清理；试跑为 1 轮/1 遍且首预热至少 1 秒/128 样本，不能混入正式统计。`full` 执行全部 156 配置，每配置新建浏览器，三方法轮换顺序，且所有方法使用同一相机矩阵。`config.pilotOutput` 指向成功的 12 配置试跑，默认是 `config.outputRoot/pilot`；修改 `--output` 自定义试跑目录时同步配置它。正式运行前强制校验三份 CPU 回执、目标 GPU probe、12 配置试跑的来源、浏览器/系统和完整清理。

运行器独占 `results/gpu-session.lock`，管理自己的 Chrome、Vite（8770/8771/8772）与 `caffeinate` 进程。不要手动删除仍有存活进程的锁，不终止其它用户的 Chrome。中断后保留检查点；以完全相同命令恢复，只复用协议/源码/浏览器/输入一致且完整的配置。更换代码、浏览器或硬件时使用新的输出目录。待 `runtime-cleanup.json` 表示完成且所有自有进程退出后，才运行质量度量。

独立审计不调用运行器或报告模块的统计公式，重新检查全部相机/顺序、时钟、阶段算术、P50/P95/FPS、供电、源码 SHA、截图哈希及 PNG/WebP RGB 一致性，也确认归属进程和端口退出。只在 GPU 锁释放后执行。正式审计须使用上述明确的 `--output .../validation/independent-formal-qa.json`，与结果打包器要求一致；不要依赖审计器默认的其他文件名。阶段查询和超过 E2E 的现象会保留为诊断，不删除原始样本或把查询和当成物理可加和时间。

## 4. 新质量度量与报告

```sh
BENCH_TORCH_HOME=$(.venv/bin/python -c 'import json; print(json.load(open("config/local.json"))["torchHome"])')
.venv/bin/python quality/validate_metrics.py --include-lpips \
  --torch-home "$BENCH_TORCH_HOME" \
  --output results/my-mac-run/formal/validation/quality-numerical-validation.json
.venv/bin/python quality/measure_quality.py \
  --config config/local.json --run-dir results/my-mac-run/formal --device mps
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
