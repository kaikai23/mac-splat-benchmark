# 同事在另一台 Apple Silicon Mac 上复测

从公开仓库克隆，在自己的 Mac 上联网下载并准备数据，然后按同一协议实测。**不需要维护者传大资产包，也不需要 `ecofde` 或其他 SSH 账号。** 目标为 Visionary 1.0.1、原生 Spark.js 0.1.10、SuperSplat 2.1.0，共 13 场景 × stride 1/2/4/8 × 3 方法，合计 **156 配置、780 轮、68,040 个计时样本、4,536 张质量图像**。源码与协议见 [主 README](../README.md) 和 [PROTOCOL.md](../PROTOCOL.md)。命令均从仓库根目录执行。

## 克隆并准备基本环境

仓库已公开，HTTPS 读取不需要 GitHub 账号或 token：

```sh
git clone https://github.com/kaikai23/mac-splat-benchmark.git
cd mac-splat-benchmark
git rev-parse HEAD
```

记录提交，并与比较对象使用相同源码。Git 仅保存源码、固定相机、哈希清单、锁和脚本；大模型、GT、依赖及结果不会进入 Git。

准备 macOS 14 或更新版本、**原生 arm64 Node.js 22/24 LTS、Python 3.12、Google Chrome**。可使用各官方安装程序或已有受管理安装；不要在 Rosetta 终端运行。检查：

```sh
uname -m
node -p 'JSON.stringify({version:process.version,arch:process.arch})'
python3.12 -c 'import platform,sys; print(platform.machine(), sys.version)'
sw_vers
```

架构应为 `arm64`。首次官网下载约 **10 GB**，但解压并生成子集后的 **52 个最终模型约 18.5 GB**；建议至少 **30 GB** 可用空间，供临时文件、依赖、GT 和本机结果使用，大型归档另留余量。数据和仓库位于不同卷时分别检查空间。示例外置卷 `/Volumes/BenchmarkData` 必须存在且可写，也可换成本机磁盘上的目录。

## 一次命令准备数据和依赖

为本机指定新的 run；以下命令在同一终端继续使用 `BENCH_RUN`：

```sh
BENCH_RUN=results/my-mac-run
python3.12 scripts/setup-online.py \
  --data-root /Volumes/BenchmarkData/mac-splat \
  --output-root "$BENCH_RUN" --python python3.12
```

入口依次完成：下载锁定依赖/VGG、在仓库安装 `.venv`、下载 13 个官方 iteration 30000 PLY、本机生成 39 个 stride 子集、下载 378 张指定照片、用 Pillow 11.3.0 准备 GT 并验证固定像素，最后配置 `config/local.json` 并记录本机环境。**不自动启动测量**；等该命令全部成功退出后再继续。模型归档仅按 Range 获取锁定的 30000 迭代成员，约 8.68 GB；指定照片约 312 MB，依赖/VGG 约 0.83 GB，另有少量归档元数据。

生成目录如下；仓库与数据根可分别位于不同磁盘：

```text
/Volumes/BenchmarkData/mac-splat/
├── models/                         # 52 个 PLY，固定相对路径
├── gt-source/                      # 378 张原照片与来源回执
└── ground-truth/
    ├── ground-truth-manifest.json
    └── rgb1280/<scene>/<image>.png

<仓库>/.cache/online-setup/           # 下载缓存
<仓库>/.cache/online-setup/torch/     # VGG 权重；写入 config.torchHome
<仓库>/.venv/                       # 本机安装的固定 Python 依赖
```

`--output-root` 默认是 `results/my-mac-run`。Chrome 不在标准位置时给 setup 加 `--chrome '/absolute/path/to/Google Chrome.app/Contents/MacOS/Google Chrome'`；`--python` 可指定另一处原生 Python 3.12。配置路径统一从仓库根目录解析，个人配置被 Git 忽略。使用系统 Chrome，不需要 `playwright install`。

想先查看准备步骤可加 `--plan`，不会下载、安装或写文件；缓存位置可用 `--cache` 指定。`--output-root` 必须为仓库 `results/` 下专用子目录，已有 pilot/formal 测量时不能用于 setup。已有不同配置时也会在下载前拒绝覆盖，应使用新的 `--config config/local-other.json`，并把本文后续所有 `config/local.json` 同步替换为它。各步日志、校验与环境记录位于 `RUN/setup/online-*/`；不要把 setup 成功当作156配置实验已完成。

准备过程重新校验全部 52 模型的 SHA256，并依据仓库 [378 张像素/来源白名单](../scripts/ground-truth-pixels-lock.json)检查 GT；不能只相信下载目录自己的 manifest。**GT 准备和校验必须使用 `.venv` 中的 Pillow 11.3.0**。来源不符应修复输入，不能改白名单接受其他模型或照片。已有合格数据可以复用，其他 Mac 的截图、时间和质量分数不复用。若采用离线缓存，见[可选离线路线](#offline-optional)。

目标覆盖 M1/M2/M3/M4/M5 系列，程序按实际硬件和功能检测，不写死 M1。**目前本地实测验证的是 M1 Pro；其他芯片仍须在自己的 Mac 上通过 GPU probe 和试跑，不能视为已验证。** 比较不同 Mac 时尽量使用相同 Chrome 版本；跨机器的 OS/浏览器差异须随报告披露，不能把所有差异只归因于芯片。**同一次 run 的 probe、pilot、formal 必须使用匹配的 Chrome；浏览器/OS/源码变化后使用新 run，并重新做前置验证。** 不要将另一台机器的 `results/setup`、pilot 或验证回执复制来冒充本机前置检查。

## 先验证，再串行完成性能测量

接通 AC 电源，在系统设置中关闭当前 AC 配置的低功耗模式。关闭其他 GPU/MPS 工作和大型后台任务。下面各命令逐条执行并确认成功退出；不要把安装、全量哈希、质量推理或另一份基准与性能测量并行。

```sh
node work/supersplat-bench/verify-worker.mjs \
  --output=results/setup/supersplat-worker.json
node work/spark-v0.1.10/validate-native-sort.mjs \
  --output=results/setup/spark-native-sort-cpu-validation.json
node work/spark-v0.1.10/validate-native-prepare.mjs \
  --output=results/setup/native-prepare-lifecycle-review.json
node run-experiment.cjs --config config/local.json --mode validate \
  --output "$BENCH_RUN/preflight"
node validation/probe-gpu.cjs config/local.json results/setup/gpu-probe
node run-experiment.cjs --config config/local.json --mode pilot \
  --output "$BENCH_RUN/pilot"
.venv/bin/python analysis/independent_audit.py \
  --run-dir "$BENCH_RUN/pilot" \
  --output "$BENCH_RUN/pilot/validation/independent-pilot-qa.json"
node run-experiment.cjs --config config/local.json --mode full \
  --output "$BENCH_RUN/formal"
.venv/bin/python analysis/independent_audit.py \
  --run-dir "$BENCH_RUN/formal" \
  --output "$BENCH_RUN/formal/validation/independent-formal-qa.json"
```

这里 `config.pilotOutput` 自动指向 `$BENCH_RUN/pilot`，三份 CPU 回执及 GPU probe 使用默认 `results/setup`。试跑共 12 配置/378 样本；正式运行才是 156 配置/68,040 样本。GPU timer 能力缺失或试跑失败时先保存错误给维护者，不换成软件后端或沿用旧结果。

渲染分辨率固定为 **1280×720 framebuffer、DPR 1**，浏览器 viewport 1280×760，SH3、黑底、LoD off。每配置 5 轮，每轮将全部选定视角遍历 3 次；stride 1 是完整模型，2/4/8 是锁定索引步长子集，不是训练新模型。Spark 只在 native16 排序键这一项采用上游默认，其他明确参数及插桩见协议。

运行器只管理自己的 Chrome、Vite 和防休眠进程，独占 `results/gpu-session.lock`。中断后保留所有文件；确认自有进程退出、锁释放后，使用**完全相同的 full 命令**恢复，程序会验证并复用完整配置。尚未完整写出的配置会重新执行。不要删仍有存活进程的锁、杀其他人的 Chrome、修改 raw JSON，或把检查点改名成完成结果。

## 补齐质量指标与报告

等性能和独立性能审计退出后，再按顺序执行。质量阶段会在本机重新计算全部 4,536 张渲染图：PSNR 使用 CPU float64 MSE，SSIM/LPIPS 使用本机 MPS。随后等待 MPS 进程结束，才运行独立 CPU 质量复核。

```sh
BENCH_TORCH_HOME=$(.venv/bin/python -c 'import json; print(json.load(open("config/local.json"))["torchHome"])')
.venv/bin/python quality/validate_metrics.py --include-lpips \
  --torch-home "$BENCH_TORCH_HOME" \
  --output "$BENCH_RUN/formal/validation/quality-numerical-validation.json"
.venv/bin/python quality/measure_quality.py \
  --config config/local.json --run-dir "$BENCH_RUN/formal" --device mps
.venv/bin/python quality/independent_audit.py \
  --config config/local.json --run-dir "$BENCH_RUN/formal" --threads 2
.venv/bin/python analysis/analyze.py \
  --config config/local.json --run-dir "$BENCH_RUN/formal"
node analysis/validate_report.cjs \
  --config config/local.json --run-dir "$BENCH_RUN/formal"
open "$BENCH_RUN/formal/analysis/index.html"
```

质量程序使用 JSONL 检查点；同一命令重跑只复用来源 SHA 一致的分数。完整分析器要求精确覆盖 156 配置和 4,536 视角，不会为缺失值填零或生成伪完整报告。主动暂停后需要部分预览时，按 [分析说明](../analysis/README.md#fixed-scope-partial-preview) 建立单独的固定范围；不能用 `--allow-partial` 绕过完整交付。

报告主速度为包含当前相机更新、新排序、GPU 完成和计时读回的 E2E P50/P95，以及完整浏览器采样窗口计算的 completed FPS；它不是屏幕呈现 FPS。CPU/GPU 阶段累计是分项诊断，不能倒数成 FPS。质量定义、GT 上采样和原生投影差异见 [质量说明](../quality/README.md)。

`analysis/index.html` 是主报告，`captures.html` 是 GT/三方法画面页，旁边有中英文 Markdown、CSV、JSON、PNG/SVG 和 LaTeX 表。浏览器 QA 截图在 `formal/validation/report-preview/`；**请实际打开检查**主表、图表和画面，并在交付说明中记录检查人、日期和发现。自动 QA 回执不等于人已看过截图。

## 打包交付

确认全部审计通过、所有进程退出、Git 工作区干净。更改过代码时先由维护者审核并提交；不要提交个人路径、凭据、模型或结果。完整打包命令：

```sh
git status --short
.venv/bin/python scripts/package-results.py \
  --run-dir "$BENCH_RUN/formal" \
  --output "$BENCH_RUN/colleague-mac-results.zip"
```

归档必须在 formal 目录之外，且同名文件不能已存在。它打包该提交的源码、完整 run、试跑和前置证据，并生成文件清单/归档 SHA/CRC 回读回执；不包含 18.5 GB 模型、完整 GT、依赖或 VGG。仅分享可浏览报告时可以复制整个 `formal/analysis/`，其图库和必要证据均为相对链接，但这不等于包含全部 raw 的复核归档。公开源码与本机结果包分别交接，不能把结果包的存在当作完整实验通过。

<a id="offline-optional"></a>

## 可选：已有离线资产时

在线自助是默认流程。已经有完整且与锁匹配的 `models/`、`ground-truth/`、`offline-cache/` 时，可以复制整个资产目录再执行下面步骤，替代上面的 setup。此路线不需要重新下载，也不会复制其他机器的安装环境或结果。

```sh
BENCH_RUN=results/my-mac-run
python3.12 scripts/install-offline.py \
  --cache /Volumes/BenchmarkData/mac-splat/offline-cache --python python3.12
python3.12 scripts/configure.py \
  --data-root /Volumes/BenchmarkData/mac-splat/models \
  --ground-truth-root /Volumes/BenchmarkData/mac-splat/ground-truth \
  --torch-home /Volumes/BenchmarkData/mac-splat/offline-cache/torch \
  --python .venv/bin/python --output-root "$BENCH_RUN"
.venv/bin/python scripts/verify-ground-truth.py \
  --ground-truth-root /Volumes/BenchmarkData/mac-splat/ground-truth \
  --output "$BENCH_RUN/setup/ground-truth-verification.json"
```

完成后回到本文“先验证，再串行完成性能测量”。原项目维护者可以继续在自己的 `ecofde` 联网节点准备缓存，但同事自助流程没有这项依赖。下面资产组装仅供确实需要离线交接时选用。

<a id="maintainer-assets"></a>

## 附录：维护者组装离线资产

使用已经验证的本地输入，先安装本仓库 `.venv`。下面示例将输入与输出放在同一 APFS 卷；`--npm-cacache` 直接指向 npm 的 `_cacache` 目录，`--npm-receipt` 指向原下载缓存的回执，`--vgg` 指向权重文件，`--output` 必须是**尚不存在**的目标目录。

```sh
.venv/bin/python scripts/prepare-colleague-assets.py \
  --models /Volumes/BenchmarkData/verified-inputs/mac-splat/models \
  --ground-truth /Volumes/BenchmarkData/verified-inputs/mac-splat/ground-truth \
  --npm-cacache /Volumes/BenchmarkData/verified-inputs/mac-splat/npm-cache/_cacache \
  --npm-receipt /Volumes/BenchmarkData/verified-inputs/mac-splat/dependency-cache-receipt.json \
  --wheels /Volumes/BenchmarkData/verified-inputs/mac-splat/python-wheels \
  --vgg /Volumes/BenchmarkData/verified-inputs/mac-splat/vgg16-397923af.pth \
  --python .venv/bin/python \
  --output /Volumes/BenchmarkData/mac-splat
```

脚本不联网，按仓库锁和来源回执检查 SHA，生成 `models/`、`ground-truth/`、`offline-cache/`、`asset-manifest.json` 和 GT 校验回执。输出是可独立交接的普通文件，不使用符号链接或硬链接。默认 APFS clone 可减少同卷组装开销；跨卷或文件系统不支持时，显式加 `--copy-method copy`，并预留全部文件所需空间。完成后交接整个输出目录，接收方按上面的可选离线路线重新验证模型和固定 GT，再在自己的 Mac 上实测。
