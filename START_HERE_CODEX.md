# Codex：在当前 Apple Silicon Mac 完整复现实验

本文件是可独立交接的任务入口。收到“按本文件完成复现”的请求后，从环境准备持续推进至完整报告与归档验收，不需要维护者的聊天记录、私人 SSH 账号或大资源包。仅收到仓库审计、文档修改或报告查看请求时，不启动实验；用户明确暂停时保留状态并暂停。

## 阅读与任务范围

先读本仓库 [AGENTS.md](AGENTS.md)、[README.md](README.md)、[同事复测指南](docs/COLLEAGUE_QUICKSTART.zh-CN.md)、[PROTOCOL.md](PROTOCOL.md)、[质量指标说明](quality/README.md) 和 [分析/报告说明](analysis/README.md)。所有命令在仓库根目录执行，具体参数以同事复测指南为准。

在**当前 Mac 的本地 GPU** 上重新实测 Visionary 1.0.1、Spark.js **0.1.10** 和 SuperSplat Editor 2.1.0。13 场景 × 4 个固定 stride（1/2/4/8）× 3 方法，共 **156 配置**。PLY 是官方公开的 iteration 30000 预训练模型；本任务下载并校验它们，再生成确定性子集，不重新训练。其他机器或 Windows 的数据只能作背景参考，不能填入本次结果。Spark 其他版本不运行。

输出包含端到端完成时间 P50/P95、completed FPS、阶段诊断、PSNR/SSIM/LPIPS、分辨率/DPR、浏览器/OS/芯片/内存/GPU 后端和供电记录，以及主报告、画面页、可审计原始数据和结果 ZIP。指标的边界、聚合和限制严格采用 PROTOCOL，不把 GPU 阶段倒数、rAF 回调或完成吞吐称为物理屏幕呈现 FPS。

## 执行顺序

以下步骤依次执行，**每步成功退出并检查其回执后才进入下一步**。长任务通过日志和检查点持续跟进，不因单次工具等待超时而误报失败或启动第二份进程。进展和持久状态保存到被忽略的 `results/`，并向用户说明阶段、实际覆盖与阻塞。

1. **准备环境。** 按 [Mac 基础环境准备](docs/MAC_SETUP.zh-CN.md) 检查原生 arm64、macOS、Node、Python、Chrome、磁盘与 AC 电源；安装确实缺少的依赖。优先复用合格版本。记录 `git rev-parse HEAD`。保持这次 run 的源码、浏览器和 OS 不变。
2. **准备输入。** 选尚未存在的 `results/<chip>-<date>-<id>` 作为 `BENCH_RUN`，本 run 的验证目录是 `$BENCH_RUN/setup/validation`。默认数据 `data/`、缓存 `.cache/online-setup/`，均被 Git 忽略；无需外置卷。执行指南的 `setup-online.py`，从公开来源直接下载并安装全部锁定依赖、模型、原照片和权重，验证 52 模型及 378 张固定 GT。首次配置用 `config/local.json`；若已有不同配置，使用新的 `config/local-<id>.json` 并在全部后续命令同步替换。不要覆盖旧配置。
3. **前置验证。** 创建本 run 的验证目录，依次执行三份 CPU 排序/生命周期验证、`--mode validate` 和本机 GPU probe。检查真实 Apple GPU、有效计时查询及清理；不能用软件后端或 CPU 渲染代替性能实验。
4. **试跑并审计。** 完成全部 12 个 pilot 配置、378 个计时样本，然后运行独立性能审计，明确传入本 run 的 `--validation-root`。**`pilot/validation/independent-pilot-qa.json` 必须 `passed=true` 且 `complete=true`，否则不得开始 full。** 只完成 pilot 不算交付。
5. **完整性能测量。** 串行执行 full；可用完全相同的命令恢复检查点。完整覆盖后等待 GPU 锁释放和自有进程退出，再运行独立正式性能审计，输出 `formal/validation/independent-formal-qa.json`。不要在 GPU 测量时并行安装、全量哈希、MPS 推理或另一份基准。
6. **质量指标。** 先运行包含 LPIPS 的合成数值验证；随后在本机 MPS 对全部新渲染图计算质量指标，PSNR 的 CPU float64 规则保持不变。等 MPS 进程退出后运行独立 CPU 质量审计：全部 PSNR 复算及 39 张 SSIM/LPIPS 复核，严格沿用既定误差阈值。
7. **生成并查看报告。** 执行完整分析器及报告浏览器 QA，实际查看 QA 回执列出的全部截图，检查主表、图表、GT/三方法画面和移动端布局。只有确实查看后才运行 `scripts/record-visual-review.py`，用 `--reviewer-type codex` 和真实观察记录；不得冒充人工审核。发现问题要保留失败记录并修复、重建、重审。
8. **归档交付。** 保持 Git 工作区干净，执行 `scripts/package-results.py`。交付 HTML 所在目录或结果 ZIP，不能只发依赖相对图片的单个 `index.html`。打包器会绑定当前报告、QA、截图和实际视觉审核，包含本 run 的安装/GT 校验、pilot、前置验证及提交源码；不打包 18.5 GB 输入模型和安装环境。

默认完整任务不调用历史 `analysis/preview.py`，不使用 `--allow-partial` 作为完成标准。历史 34 配置预览只对应旧的暂停点，不是本机目标。报告修复若涉及协议或冻结的测量/质量源，必须先解释影响，按新源重新建立 run；不能改旧 raw 或放宽校验使其通过。

## 完成标准

| 项目 | 本机完整要求 |
|---|---|
| 性能 | 156 配置、780 轮、68,040 个计时样本 |
| 质量图 | 4,536 张新渲染 lossless WebP，全部有 PSNR/SSIM/LPIPS |
| 展示/辅助速度 | 234 张 PNG；39 组完整模型原生 rAF 诊断，每组 360 个回调间隔 |
| 聚合 | 12 组（3 方法 × 4 strides），每组对 13 场景等权 |
| 独立验收 | pilot/formal 性能审计、质量数值验证、独立质量审计、分析 QA、浏览器报告 QA 均通过且覆盖完整 |
| 视觉与清理 | 实际图像审核通过，`humanVisualReview=false` 如实记录 Codex 审核；所有归属进程/端口退出，GPU 锁释放 |
| 交付 | `formal/analysis/index.html` 及配套画面/数据、源码和证据 ZIP、归档 SHA256 与 CRC 回读回执 |

最终回复给出仓库提交、本机芯片/OS/Chrome、覆盖计数、审计结果、报告和 ZIP 的可点击路径、SHA256，以及影响解释的实际限制。不能将准备完成、部分结果或没有执行的检查写成全部完成。

## 恢复与真实阻塞

下载失败、进程中断、遗留 `.part`/锁、权重缺失和配置冲突按 [故障恢复说明](docs/TROUBLESHOOTING.zh-CN.md) 处理。保存错误与失败回执，在证据支持的范围内修复可恢复问题并继续。只管理本 run 的进程；不盲删锁、模型或未完成原始证据，不更新哈希白名单接受未知输入。

系统确实要求用户密码/界面授权、磁盘不足、目标 GPU 缺少必需能力，或科学校验持续失败时，报告具体错误、日志位置和所需操作，不自行降低分辨率、轮数、stride 范围、质量指标或阈值。M1 Pro 已实际验证；M2/M3/M4/M5 等目标仍须在本机通过 probe/pilot。完整实验可能持续较长时间，以实际进度为准，不承诺未经测量的时长。
