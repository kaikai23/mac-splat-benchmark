# 故障定位与安全恢复

本页命令从仓库根目录执行。`BENCH_RUN=results/my-mac-run` 是外层 run，正式数据在 `$BENCH_RUN/formal`；使用自定义配置/run 时同步替换示例。先保存报错、当前 Git 提交、执行命令及对应回执，**失败不代表实验完成**。恢复时保留原数据、固定哈希和协议，不用其他 Mac 的结果填缺。

## 基础环境或路径错误

`command not found`、Rosetta/x86_64、Python 版本错误、找不到 Chrome：先按 [Mac 环境准备](MAC_SETUP.zh-CN.md) 安装/选择原生 Node22/24、Python3.12、Chrome，再重试。依赖及 GT 验证使用本仓库 `.venv`，不借用别人的虚拟环境。

默认 `--data-root data` 不依赖外置盘。改用外置盘前确认该卷存在、可写且空间足够。配置路径相对仓库根目录解析。setup 拒绝已有不同配置或含 pilot/formal 测量的输出目录时，使用新 `--config config/local-NAME.json` 和新结果目录；后续命令也必须使用这个配置。**已有测量需要恢复时直接恢复测量命令，不重跑 setup 去覆盖旧实验。**

## 下载、安装或模型生成失败

setup 的每次尝试在 `$BENCH_RUN/setup/online-*/` 保存 `setup.json` 和分步骤日志。先读取本次失败回执里的 `steps`，找到最后一个未完成步骤及对应 `.log`。网络超时/断线不应通过关闭 TLS 验证、改哈希、接受整包替代 Range 或更换未知镜像来绕过。

1. 确认本次 setup 及它启动的 npm、Python、curl 等进程均已退出。正常 Ctrl+C/SIGTERM 会清理归属进程与 setup 锁；未退出时先等其清理。
2. 对仅网络失败的情况，保留已验证下载和 `.mac-download.compressed.part`，按**相同参数**重跑 setup；脚本重新校验完成文件并续用可验证的压缩下载进度。GT 单图中断可能重新下载该图。
3. 若日志明确拒绝已有 `.mac-extracting.part` 或 `.mac-subset.part`，说明解压/子集写入曾中断。核实路径来自本次错误、位于本次 `dataRoot/models` 且进程已退出后，只将这个临时文件保留改名，再原命令重试。例如：

```sh
# 只在已核实本次归属、路径及进程退出后执行；替换为报错中的确切文件。
BENCH_SCRATCH=data/models/bicycle/point_cloud.ply.mac-extracting.part
BENCH_RECOVERY_TAG=$(date -u +%Y%m%dT%H%M%SZ)
mv -n "$BENCH_SCRATCH" "$BENCH_SCRATCH.interrupted-$BENCH_RECOVERY_TAG"
```

不要用通配符批量删除 `.part`，不要改名覆盖正式 PLY、GT 或已有日志。若正式文件 SHA/CRC 与固定清单不符，保留原文件和错误，单独定位来源或磁盘问题；不得通过修改清单让它通过。磁盘不足先腾出与本实验无关且可安全移动的空间，不能删仍在使用的数据来完成测量。

## 遗留锁或端口被占用

setup 锁是 `results/setup/online-setup.lock`，GPU 收集锁是 `results/gpu-session.lock`。强制结束、断电或崩溃可能留下锁；“锁存在”本身不能证明进程已死。先读取实际报错对应的锁，检查其 owner PID：

```sh
BENCH_LOCK=results/setup/online-setup.lock
python3.12 -m json.tool "$BENCH_LOCK"
BENCH_OWNER_PID=$(python3.12 -c 'import json,sys; print(json.load(open(sys.argv[1]))["pid"])' "$BENCH_LOCK")
ps -p "$BENCH_OWNER_PID" -o pid,ppid,pgid,lstart,command
pgrep -P "$BENCH_OWNER_PID"
```

对子 PID 继续检查子进程，直到覆盖全部后代；GPU 收集还要核对该 run 的 `runtime-cleanup.json` 中 `ownedPids`/`children`、session token、日志时间和命令行。PID 可能复用，不能仅凭 PID 数字判断归属。父进程消失也不保证子进程全已退出；必要时按记录的 PID、进程组、命令与启动时间核查。端口8770/8771/8772被占用时查明拥有者，不关闭其他用户/任务的服务。

**只有确认锁属于本次已退出的任务，且所有归属子进程均已退出后**，才可保留改名该锁，再重试原命令：

```sh
BENCH_RECOVERY_TAG=$(date -u +%Y%m%dT%H%M%SZ)
mv -n "$BENCH_LOCK" "$BENCH_LOCK.confirmed-stale-$BENCH_RECOVERY_TAG"
```

不能确认时停止恢复并报告现有证据；不要盲删锁，不运行按名称匹配的 `killall Chrome`/`pkill`，不结束其他实验进程。仍属本次且正在工作的进程应正常等待或按用户要求正常中断，不能靠删除锁启动第二份任务。

## GPU probe、pilot 或正式运行中断

先确认 AC 电源、当前 AC 配置的低功耗模式已关闭、GPU 没有其他负载、使用配置中的真实 Chrome。probe/CPU 回执属于本机本 run 的 `config.validationRoot`，新配置默认 `$BENCH_RUN/setup/validation`；不能拿另一个 run 的回执补齐。

能力缺失、timer disjoint、相机/源码/SHA 或图像验证失败时保留回执和日志。不要替换成软件后端、缩减相机/轮数、删除异常样本或放宽审计阈值。若必须改变源码、Chrome/OS或方法参数，应另建 run 并重新做 probe/pilot；不能拼接为同一协议结果。

正常中断后先检查 `runtime-cleanup.json` 的结束记录、全部归属进程退出及锁释放，再用原来的 pilot/full 命令恢复。完整配置经身份检查后会复用，未完整写出的配置重新执行。进度查看 `progress.json`、`run.log`；检查点文件不能当作完成 raw。重新打开终端时重新设置 `BENCH_RUN`/`BENCH_VALIDATION`，避免空变量指向错误目录。

<a id="missing-vgg"></a>

## 缺少 VGG 权重或质量依赖

旧版报错中的 “download through ecofde first” 是历史提示，**同事不需要该账号**。先停止任何性能/GPU/MPS任务，从本机配置读取真实权重位置：

```sh
BENCH_TORCH_HOME=$(.venv/bin/python -c 'import json,pathlib; p=pathlib.Path(json.load(open("config/local.json"))["torchHome"]); print(p.resolve())')
```

在线 setup 默认把它设为 `.cache/online-setup/torch`。若配置仍指向此缓存的 `torch/`，可从它的父目录恢复锁定依赖与 VGG，无需重新运行已经含测量的 setup：

```sh
BENCH_DEP_CACHE=$(.venv/bin/python -c 'import pathlib,sys; p=pathlib.Path(sys.argv[1]); assert p.name == "torch", "Custom torchHome: inspect destination before copying"; print(p.parent)' "$BENCH_TORCH_HOME")
python3.12 scripts/fetch-offline-dependencies.py \
  --network-node direct --output "$BENCH_DEP_CACHE" --with-vgg
```

若自定义 `torchHome` 并非下载缓存内的 `torch/`，先检查原 `dependency-cache-receipt.json`/setup回执所记录的缓存，恢复到独立缓存后仅把已验证的 `vgg16-397923af.pth` 复制到配置路径的 `hub/checkpoints/`；不改测量协议或复用未知权重。若目标已存在但不匹配，先保留并查明原因，不能覆盖证据。期望 SHA256 为 `397923af8e79cdbb6a7127f12361acd7a2f83e06b05044ddf496e83de57a5bf0`。之后重跑该 formal run 的数值自检，再恢复原质量命令。

质量JSONL可以断点复用，但只有 raw、render、GT、协议和权重身份都一致的分数才有效。MPS不可用或CPU独立复核超阈值时保留失败证据，不自动切换设备后宣称原协议完成，也不放宽阈值。

## 报告、视觉检查或打包未通过

先阅读 `formal/analysis/STATUS.md`、`analysis-qa.json` 及失败的 `formal/validation/*qa.json`。修复缺失输入、未完成审计或报告排版后重新生成相应报告/QA，保持源结果不变。报告字节改变会使之前的视觉检查失效，应重新验证并检查新截图。

打包前遵循 [同事指南](COLLEAGUE_QUICKSTART.zh-CN.md) 的视觉审核与验收步骤。Git未提交修改、缺验收回执、输入/结果哈希变化、同名ZIP已存在都不应直接绕过：保留失败信息，完成所需审核或选择新归档名称。`analysis/preview.py` 仅保留历史34配置预览，不是任意暂停 run 的通用入口；不伪造 scope manifest，也不以部分结果冒充156配置完成。
