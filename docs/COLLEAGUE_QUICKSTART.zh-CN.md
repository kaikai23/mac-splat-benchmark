# 同事在另一台 Apple Silicon Mac 上复测

这份指南从空目录开始，使用已经交接并校验过的离线数据。目标是用目标 Mac **重新测量** Visionary 1.0.1、原生 Spark.js 0.1.10 和 SuperSplat 2.1.0：13 场景 × stride 1/2/4/8 × 3 方法，共 **156 配置、780 轮、68,040 个计时样本、4,536 张质量图像**。源码与协议见 [主 README](../README.md) 和 [PROTOCOL.md](../PROTOCOL.md)。本文中的命令均从克隆后的仓库根目录执行。

## 先取得仓库和数据

仓库已公开，可直接通过 HTTPS 克隆，读取源码不需要 GitHub 账号、token 或维护者的 SSH 私钥。

```sh
git clone https://github.com/kaikai23/mac-splat-benchmark.git
cd mac-splat-benchmark
git rev-parse HEAD
```

记录该提交，并与维护者确认双方比较使用的提交。仓库包含渲染器源码、固定相机、哈希清单、依赖锁和脚本，**不包含以下数据**；仅克隆代码还不能运行实验。

请维护者通过外置盘或已有的授权文件通道交接以下目录。这里使用 `/Volumes/BenchmarkData/mac-splat` 作为示例；路径可替换，内部相对路径不能改：

```text
/Volumes/BenchmarkData/mac-splat/
├── asset-manifest.json             # 维护者组装后的文件 SHA 清单
├── models/                         # 52 个 PLY，合计约 18.5 GB
│   ├── bicycle/point_cloud.ply
│   ├── bicycle/point_cloud_stride_2.ply
│   └── …                           # 保持 config/data 清单中的全部路径
├── ground-truth/
│   ├── ground-truth-manifest.json
│   └── rgb1280/<scene>/<image>.png  # 378 张 prepared GT
└── offline-cache/
    ├── dependency-cache-receipt.json
    ├── npm-cache/
    ├── python-wheels/
    └── torch/hub/checkpoints/vgg16-397923af.pth
```

离线缓存必须对应当前仓库的两个 npm lock 和 Python wheel lock。模型、GT 和 VGG 可以复用，**其他 Mac 的渲染图、时间或质量分数不能作为本机结果复用**。另留依赖、数 GB 的新截图/结果及打包空间；磁盘空间不足时不要缩减协议或删除正在运行的检查点。

维护者可用[文末的资产组装步骤](#maintainer-assets)生成这一交接目录。同事复制整个目录、保留内部路径后，继续下面的安装与配置即可；无需访问维护者原来的缓存位置。

**没有 `ecofde` 账号也可以按本文离线执行。** `ecofde` 是原项目约定的联网节点，不是公共服务；恢复/下载脚本当前明确限定 `--network-node ecofde` 并拒绝在 macOS 上下载。缺文件时，请有访问权限的维护者按 [主 README 的恢复步骤](../README.md#2-配置已提供的模型与-gt) 准备并交接，不能假设同事也有这个 SSH 别名。安装好的 `node_modules` 或虚拟环境不适合跨机器直接复制；交接的是锁定缓存，再在本机安装。若 GitHub 暂不可达，也可由维护者提供同一提交的 Git bundle，再用 `git clone /absolute/path/source.bundle mac-splat-benchmark` 保留提交身份。

## 安装本机环境

准备 macOS 14 或更新版本、**原生 arm64 Node.js 22/24 LTS、Python 3.12、Google Chrome**。使用已有的受管理安装包或请维护者提供对应安装程序；不要在 Rosetta 终端中执行。先查看实际版本：

```sh
uname -m
node -p 'JSON.stringify({version:process.version,arch:process.arch})'
python3.12 -c 'import platform,sys; print(platform.machine(), sys.version)'
sw_vers
```

架构应为 `arm64`。安装锁定依赖，使用系统 Chrome，不运行 `playwright install`：

```sh
python3.12 scripts/install-offline.py \
  --cache /Volumes/BenchmarkData/mac-splat/offline-cache \
  --python python3.12
mkdir -p .cache/torch/hub/checkpoints
cp /Volumes/BenchmarkData/mac-splat/offline-cache/torch/hub/checkpoints/vgg16-397923af.pth \
  .cache/torch/hub/checkpoints/
```

脚本校验缓存身份，分别安装根目录及 `work/bench` 的 npm 依赖，并创建本仓库的 `.venv`。不联网补包，不依赖维护者的用户目录、Codex 安装或旧虚拟环境。缺项/哈希不符应回到数据交接步骤修复。

## 配置与输入校验

为这台 Mac 取一个新的结果目录；以下后续命令在同一终端继续使用 `BENCH_RUN`。不要指向维护者的旧 run。

```sh
BENCH_RUN=results/colleague-mac-001
python3.12 scripts/configure.py \
  --data-root /Volumes/BenchmarkData/mac-splat/models \
  --ground-truth-root /Volumes/BenchmarkData/mac-splat/ground-truth \
  --chrome '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  --output-root "$BENCH_RUN" \
  --python .venv/bin/python --torch-home .cache/torch
.venv/bin/python scripts/detect-environment.py \
  --output "$BENCH_RUN/setup/environment.json"
.venv/bin/python scripts/verify-ground-truth.py \
  --ground-truth-root /Volumes/BenchmarkData/mac-splat/ground-truth \
  --output "$BENCH_RUN/setup/ground-truth-verification.json"
```

`configure.py` 默认重新校验全部 52 个模型的字节长度和 SHA256。GT 校验使用仓库固定的 [378 张像素/来源白名单](../scripts/ground-truth-pixels-lock.json)，检查相机、原照片来源、文件及解码后 RGB8 像素 SHA，不能仅用交接目录自己的 manifest 代替。**GT 准备和校验必须使用 `.venv` 中的 Pillow 11.3.0**；不要更改白名单接纳其他图像。配置写入被 Git 忽略的 `config/local.json`，相对配置路径统一从仓库根目录解析。Chrome 安装位置不同就替换 `--chrome`；`detect-environment.py` 可同样传 `--chrome`。正式运行会独立记录实际芯片、GPU 核数、内存、macOS 和 Chrome 身份。

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
.venv/bin/python quality/validate_metrics.py --include-lpips \
  --torch-home .cache/torch \
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

脚本不联网，按仓库锁和来源回执检查 SHA，生成 `models/`、`ground-truth/`、`offline-cache/`、`asset-manifest.json` 和 GT 校验回执。输出是可独立交接的普通文件，不使用符号链接或硬链接。默认 APFS clone 可减少同卷组装开销；跨卷或文件系统不支持时，显式加 `--copy-method copy`，并预留全部文件所需空间。完成后交接整个输出目录，接收方仍按正文重新验证模型和固定 GT，再在自己的 Mac 上实测。
