# Visionary 原生 ONNX 动态实测

本实验只测 **Visionary 1.0.1** 的原生动态路径：`ONNXGenerator.generate()` 在 ONNX Runtime Web **1.22.0** 中推理，输出通过**同一 GPUDevice 上的共享 GPU buffer**交给 `DynamicPointCloud`，随后执行 Visionary 原生预处理、radix 排序和绘制。它不把模型导出成 PLY，也不逐帧加载静态文件。静态实验的 `work/` 源码保持不变，动态适配器、运行器和独立结果位于本目录及新的 run。

输入名称、公开链接、文件大小与完整 SHA256 由本目录 [model-lock.json](model-lock.json) 固定。下载器读取该锁并获取官方 ONNX 原文件；模型不提交 Git。不从模型外观猜测未确认的训练场景，也不把实验采样时间点当成源视频帧率或时长。

当前锁定官方具名的 **D-NeRF Bouncing Balls** 示例 `bouncingballs.onnx`，**28,630,191 字节**，SHA256 为 `e52f8bdeb4e7ab1c9be8f9c8e72bc3d5378d14b5a4172b2aafb8f86beb5a3d1f`。名称依据官方文件夹中的具名资产；不混用早先未具名的 `gaussians4d.onnx`。

## 1. 环境、依赖与官方模型

从仓库根目录执行。使用原生 arm64 Apple Silicon Mac、Python 3.12、Node.js 和 Google Chrome；基础工具见 [Mac 环境说明](../docs/MAC_SETUP.zh-CN.md)。可以复用已经完成的根目录锁定环境，不需要为本实验重新下载静态52模型、GT或VGG。新机器仍须在本机执行下面的 probe 和 pilot，不能把其他芯片的结果当作本机测量。

尚未安装根依赖时，可用公开网络下载锁定缓存再离线安装。此流程不需要私人 SSH 账号，也不启动 GPU：

```sh
NATIVE_RUN=results/visionary-native-my-mac
NATIVE_DATA=data/visionary-native-dynamic
python3.12 scripts/fetch-offline-dependencies.py \
  --network-node direct --output .cache/native-dependencies
python3.12 scripts/install-offline.py \
  --cache .cache/native-dependencies --python python3.12 \
  --receipt "$NATIVE_RUN/setup/dependency-installation.json"
```

然后安装本实验固定 ORT 依赖并获取公开模型：

```sh
npm ci --prefix dynamic-native
node dynamic-native/prepare-model.cjs --output "$NATIVE_DATA"
```

模型文件必须通过 `model-lock.json` 的字节数和 SHA256；不要修改锁接纳另一份模型。`package-lock.json` 固定 ORT 1.22.0 及其依赖。下载、安装、模型检查和静态构建必须在 GPU 测量之前完成；正式期间不更新源码、依赖、Chrome或模型。

为本次原生实验新建专用个人配置；若已有名称，换一个新的 `config/local-*.json`，不要覆盖原实验：

```sh
.venv/bin/python scripts/configure.py \
  --data-root "$NATIVE_DATA" --output-root "$NATIVE_RUN" \
  --config config/local-native.json --paths-only --no-overwrite
```

这里的 `--paths-only` 只建立个人路径，不把 ONNX 模型当作静态52模型验证。需要指定 Chrome 时增加 `--chrome '/path/to/Google Chrome.app/Contents/MacOS/Google Chrome'`。动态运行器随后自行检查官方模型、ORT载荷、源码和浏览器身份。个人配置、模型、依赖和结果均不提交 Git。

## 2. 可视 probe 与固定相机

接通 AC 电源，关闭当前 AC 低功耗模式，保持机器空闲。静态基准、动态基准、MPS计算、重型数据准备不能并行。本实验使用全局 `results/gpu-session.lock`，管理自己的 Chrome、Vite 8781 和 caffeinate；不要删除仍有归属进程存活的锁或终止其他人的浏览器。

```sh
node dynamic-native/run.cjs --config config/local-native.json \
  --data "$NATIVE_DATA" --mode probe --out "$NATIVE_RUN/probe"
```

probe 读取 t=0、0.5、1 三个时刻实际 GPU 输出的有效点，以其全量中心边界的并集生成候选诊断视图，再检查三个时刻的画面与动态内容。中心边界不包含高斯协方差的完整投影范围，仍须目视检查边缘。**probe 不产生正式FPS，也不自动改写已锁定的 `camera.json`。** 维护者在首次建立协议时一次性选择并锁定相机；同事使用仓库已锁相机，不根据快慢重新调参或选择视角。实际查看输出 PNG，确认内容可见、不是黑图、没有明显严重裁剪；若异常，停止后续测量并保留证据，先检查设备/浏览器/模型身份，不能悄悄改锁定相机使结果通过。

候选 probe 只用于可视诊断，正式时仍固定使用 `camera.json`，所有时间点和重复轮次相机一致。probe 的 GPU 进程必须全部退出、锁释放，才能进行 pilot。

## 3. Pilot、正式采集与独立审计

逐条执行并确认成功：

```sh
.venv/bin/python dynamic-native/audit.py --self-test
node dynamic-native/run.cjs --config config/local-native.json \
  --data "$NATIVE_DATA" --mode pilot --out "$NATIVE_RUN/pilot"
.venv/bin/python dynamic-native/audit.py --run "$NATIVE_RUN/pilot"
```

检查 pilot 的 `audit.json` 同时为 `passed=true`、`complete=true`，并实际查看4张不同时刻截图。审计检查请求时间、推理/渲染代次、共享设备与buffer、有效点数、内容变化、真实GPU查询、时钟/统计、供电与归属资源清理；自动解码/数值检查不能代替实际目视检查。pilot失败不能继续formal，也不能修改失败回执或放宽阈值。

```sh
node dynamic-native/run.cjs --config config/local-native.json \
  --data "$NATIVE_DATA" --mode formal --out "$NATIVE_RUN/formal" \
  --pilot "$NATIVE_RUN/pilot"
.venv/bin/python dynamic-native/audit.py --run "$NATIVE_RUN/formal"
.venv/bin/python dynamic-native/report.py --run "$NATIVE_RUN/formal"
```

formal 会核对成功 pilot 的审计来源、源码、模型锁、相机和浏览器身份。每个输出目录须为新的专用路径；当前运行器不恢复半轮，中断后保留原目录，在自有进程退出和锁释放后使用新目录重跑。源码、ORT或浏览器发生变更时必须重做pilot，不能拼接不同条件的样本。独立审计和报告只能在 GPU 采集完整收尾后运行。

## 4. 本实验定义的时间轴和指标

- 只包含 Visionary，一个官方 ONNX 模型，一个锁定相机。分辨率固定1280×720，DPR1。
- 每轮150个归一化时间点：`t=i/149, i=0…149`。这是本实验定义的采样，不代表源视频150帧、30Hz或5秒，也不声明上游源时长。采样顺序固定，不跳点，不靠自由运行墙钟动画决定内容。
- pilot为1轮，共150个计时样本；formal为5轮，共750个计时样本。首次预热至少10秒且至少150帧，轮间至少1.5秒且至少30帧。模型下载、ONNX session初始化、预热、GPU内容检查和截图均不计入正式窗口。
- 完整E2E从外层相机设置和该时间点推理之前，到原生生成、共享输出更新、新预处理/排序/绘制、GPU完成等待和读回之后。它是串行完成墙钟，不是物理屏幕显示延迟。
- **主FPS = `1000 × 全部完成样本数 / Σ各轮浏览器窗口毫秒`**。轮窗口包含循环记账，排除预热。P50/P95从全部单帧E2E样本按Type7计算，不平均各轮分位数。轮FPS均值/样本SD另作重复性诊断。
- `inferenceWallMs` 是 await 原生 `ONNXGenerator.generate` 的墙钟，包含其count-buffer读回；`renderCompletionMs` 是随后渲染完成区间。推理后额外queue等待、严格count检查和共享buffer绑定、外层相机/调用/validation开销也在完整E2E内，但不在这两个窄分项内。原始记录另存`inferenceAndBindingWallMs`。不强行把两个分项相加当作完整E2E，不把某一分项耗时的倒数宣传成播放FPS。
- GPU prep/sort/draw是实际WebGPU timestamp-query诊断，total是预处理开始至绘制结束跨度，不包含完整ONNX推理；不能取代E2E，也不能与所有CPU/推理跨度视为互斥耗时相加。
- 官方ONNX输出可能具有填充容量，实际shape由`model-info.json`与本次协议记录。**输出槽位容量不是有效高斯数**。实际有效数量以GPU `num_points`及审计读取值为准。模型静态参数行数也不能代替运行时有效数量。
- t=0、50/149、100/149、1的4张原始PNG用于画面检查，截图发生在计时窗口之外。`inspectCurrent`只读刚渲染的同一代GPU输出，不额外推理；审计绑定截图metric与检查的推理/渲染代次、buffer身份和有效点数。没有与固定视点匹配的GT，因此不计算PSNR、SSIM、LPIPS；本次交付为原生动态速度、时序与内容变化验收。

模型推理和渲染共享同一设备与原生输出buffer，不使用逐帧CPU高斯拷回再上传或PLY替换来伪装原生路径；有效数量的少量读回保留。会话请求WebGPU execution provider，检查同GPUDevice及GPU输出，但`ortNodePlacementVerified=false`，没有逐节点执行位置证据，不能宣称ONNX图每个节点都在GPU运行。测试适配器显式请求时间并记录完成/身份；它不代表完整交互UI的自由运行帧调度。单场景与固定视角也不能代表所有动态模型或所有Mac；跨机器比较同时考虑CPU、内存、OS、Chrome和供电。

## 5. 报告与分享

打开 `FORMAL/analysis/index.html`，实际检查桌面和移动宽度的表格，以及全部4张动态图片。报告包含完整FPS/mean/P50/P95、推理/渲染分项、GPU阶段诊断、每轮和全部逐帧样本、模型有效数/填充容量区别、时序/共享资源/内容变化验收和本机环境。

生成器只接受当前完整独立审计，重新检查所有来源SHA，核对协议/raw/遥测/清理/截图并独立复算统计，不执行GPU。报告生成成功不等于目视审核通过；必须实际打开后记录看到的情况，不提前填写“画面正常”。

`index.html` 内嵌全部4张原始PNG、CSS和可下载汇总CSV，**可以单文件离线分享**。同时保留 `summary.json`、`summary.csv`、`samples.csv`、`REPORT.txt`、`build-receipt.json`；完整科学证据仍为父目录协议、模型身份、原始时钟/阶段/资源/供电、审计和清理记录。轻量HTML不代替完整证据目录。

## 来源与许可

[Visionary官方项目](https://github.com/Visionary-Laboratory/visionary)和[官方模型文件夹](https://drive.google.com/drive/folders/1nk5slXl-_-jRyDggXoBpRwz2VajmQizQ)提供原生路径与模型；[ONNX Runtime](https://github.com/microsoft/onnxruntime)提供固定1.22.0运行时。Visionary的[代码许可](../work/visionary/LICENSE)和ORT随包许可继续适用。公开模型入口不等于模型另获代码许可证授权；不把没有单独说明的模型许可称为Apache或MIT。模型和结果数据不上传到代码仓库，同事通过官方入口下载并依据锁文件校验。

采集器只把精确匹配的已知ORT常量折叠警告分类到`warnings[]`并保留原文；其他错误仍导致失败。报告在折叠的原始诊断中保留这些警告，不将已知警告当成图所有节点均GPU执行的证据。
