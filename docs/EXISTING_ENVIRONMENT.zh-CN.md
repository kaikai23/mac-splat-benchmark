# 已安装环境的验证回执

新机器仍按 `setup-online.py` 或 `install-offline.py` 正常准备环境，保留该次安装回执。
对于已经开始、依赖安装早于标准安装器的本地实验，不能拿另一个隔离 checkout 的安装回执冒充其原始安装。
`scripts/verify-existing-environment.py` 提供独立的已有环境验证路径，不安装、不下载、不修改配置或实验源。

只在正式性能采集结束、且没有质量 GPU 任务运行的空档执行。脚本拒绝活动 GPU 锁，并要求正式采集和归属进程清理完成。
检查会读取较多依赖文件，不能与测量并行。它通过配置中的实际 Python 执行标准库 metadata 查询，不导入 Torch；
检查实际 Node 路径与版本，核对固定 wheel、npm tarball 和已安装文件。npm 缓存参数指含 `_cacache/` 的目录。

```sh
python3.12 scripts/verify-existing-environment.py \
  --config config/local.json --run-dir results/RUN/formal \
  --python-install-receipt /path/to/original-python-installation.json \
  --npm-install-receipt /path/to/original-bench-npm-installation.json \
  --node-identities /path/to/original-installed-node-identities.json \
  --wheels /path/to/locked-wheels \
  --npm-cache /path/to/npm-cache
```

这条兼容路径支持仓库维护过程中保存的原始 Python 安装回执（`installed_offline`、`versions`、25 个 `wheels` 身份）、
原始 bench npm 安装回执（`platform`、`arch`、`lockSha256`、`packages`、`nodeExecutable`、`nodeVersion`）和
Node 已安装包检查回执（`passed`、`checkedInstalledPackages`）。若真实历史证据缺失或格式不同，停止并报告缺口；
不要手工编造这些字段，也不要把别的环境的回执用于通过检查。

成功后写入 `RUN/setup/existing-environment-verification.json`，其 schema 为
`portable-existing-environment-verification-v1`，明确 `verificationOnly=true`、`installationPerformed=false`。
同时写入文件身份清单，并将三份原始回执原字节保存在 `existing-environment-provenance/`。
回执绑定当前正式协议、配置、实际可执行文件和依赖锁；它只证明检查时的环境身份，不声称重新安装，也不追溯证明历史进程内存。
wheel 的 pip 生成文件与 npm 的额外安装文件不属于原始负载比对范围，例外会明确记录。
esbuild 安装器生成的启动二进制必须与锁定的原生 esbuild 包完全一致。

打包器接受这份验证作为正常安装回执的替代证据，重新核对其文件身份，并保留验证和原始来源回执。
缓存、wheel、安装目录和机器配置内容不会打入结果包。已有输出会被拒绝覆盖；失败后保留证据并排查原因，不修改锁或原始回执来绕过检查。
