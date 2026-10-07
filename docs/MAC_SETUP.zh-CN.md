# 全新 Mac 的基础环境准备

需要 Apple Silicon、macOS 14+、原生 arm64 Node.js 22 或 24、Python 3.12 和 Google Chrome。实验用的 npm/Python 包随后由仓库锁定安装。已经有合格工具时直接检查并复用，不必升级；**开始 probe 后不要更换本次 run 的浏览器、OS 或依赖**。

本页只安装基础工具，不启动实验。接通 AC 电源，关闭当前 AC 配置的低功耗模式；至少准备 30 GB 可用空间，最终结果归档另留余量。所有下载都能在同事本机直接进行，无需维护者 SSH 账号。

## 先检查

```sh
uname -m
sw_vers
git --version
command -v node npm python3.12
df -h .
```

`uname -m` 应为 `arm64`；如果是 `x86_64`，关闭终端应用的“使用 Rosetta 打开”，重新开原生终端。Git 不可用时执行 `xcode-select --install` 并完成系统的 Command Line Tools 安装，再重试 Git。系统弹窗、密码或组织管理权限需要设备用户实际完成，不能在日志中假装已授权。之后克隆仓库并进入根目录：

```sh
git clone https://github.com/kaikai23/mac-splat-benchmark.git
cd mac-splat-benchmark
```

## 路线 A：已有 Homebrew 的 macOS 15+

只安装缺少的项目：

```sh
brew install node@24 python@3.12
brew install --cask google-chrome
export PATH="$(brew --prefix node@24)/bin:$(brew --prefix)/bin:$PATH"
```

`node@24` 是 keg-only，必须使该版本的 bin 位于 PATH 前面。原生 Apple Silicon 的 Homebrew 默认前缀是 `/opt/homebrew`。截至本说明核对时，Homebrew 的官方支持条件为 macOS 15+；本实验 macOS 14 的依赖下限不等于当前 Homebrew 支持下限。没有 Homebrew 或使用 macOS 14 时可用下面的独立安装路线，不必为了实验安装包管理器。来源：[Homebrew 安装条件](https://docs.brew.sh/Installation)、[Node 24 formula](https://formulae.brew.sh/formula/node@24)、[Python 3.12 formula](https://formulae.brew.sh/formula/python@3.12)。

## 路线 B：不依赖 Homebrew

以下命令从仓库根目录执行。基础工具用独立目录，不修改系统 Python。

### Node.js 24 arm64

从官方最新 24.x 的 SHA256 清单选择 arm64 发行包，使用固定版本 URL 下载，再验证同一清单中的哈希。`BENCH_NODE_ARCHIVE` 留在当前 shell，随后 PATH 设置会使用它：

```sh
mkdir -p .cache/bootstrap
curl -fL --retry 3 https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt \
  -o .cache/bootstrap/node-SHASUMS256.txt
BENCH_NODE_ARCHIVE=$(awk '$2 ~ /^node-v24\.[0-9]+\.[0-9]+-darwin-arm64\.tar\.gz$/ {print $2}' .cache/bootstrap/node-SHASUMS256.txt)
test -n "$BENCH_NODE_ARCHIVE"
BENCH_NODE_VERSION=${BENCH_NODE_ARCHIVE#node-}
BENCH_NODE_VERSION=${BENCH_NODE_VERSION%-darwin-arm64.tar.gz}
curl -fL --retry 3 "https://nodejs.org/dist/$BENCH_NODE_VERSION/$BENCH_NODE_ARCHIVE" \
  -o ".cache/bootstrap/$BENCH_NODE_ARCHIVE"
awk -v name="$BENCH_NODE_ARCHIVE" '$2 == name {print}' .cache/bootstrap/node-SHASUMS256.txt \
  > .cache/bootstrap/node-selected.sha256
(cd .cache/bootstrap && shasum -a 256 -c node-selected.sha256)
tar -xzf ".cache/bootstrap/$BENCH_NODE_ARCHIVE" -C .cache/bootstrap
export PATH="$PWD/.cache/bootstrap/${BENCH_NODE_ARCHIVE%.tar.gz}/bin:$PATH"
```

逐条确认成功，SHA 失败不能继续解压。该发行包同时提供 Node/npm。来源：[Node.js 官方发行清单](https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt)。换 shell 后重新设置该实际目录的 PATH；不要再次自动升级已开始测量的 run。

### Python 3.12

已有原生 Python 3.12 时跳过。否则通过 Astral 的 uv 安装 CPython 3.12；该路线使用 Astral `python-build-standalone` 发行，实际补丁版本会记录进环境回执。先保存安装脚本，检查后执行：

```sh
mkdir -p .cache/bootstrap
curl -fL --retry 3 https://astral.sh/uv/install.sh -o .cache/bootstrap/uv-install.sh
cat .cache/bootstrap/uv-install.sh
UV_NO_MODIFY_PATH=1 sh .cache/bootstrap/uv-install.sh
export PATH="$HOME/.local/bin:$PATH"
uv python install 3.12
python3.12 -c 'import platform,sys,venv,ensurepip; print(platform.machine(),sys.version)'
```

来源：[uv 官方安装说明](https://docs.astral.sh/uv/getting-started/installation/)、[指定 Python 版本安装](https://docs.astral.sh/uv/guides/install-python/)。uv 只用于取得解释器；仓库安装器仍创建 `.venv` 并按锁离线安装科学计算依赖，不使用 `uv sync` 更换包版本。

### Google Chrome

已有 Chrome 时跳过。下载 [Google 官方 Mac 安装包](https://dl.google.com/chrome/mac/universal/stable/GGRO/googlechrome.dmg)，打开 DMG，把 `Google Chrome.app` 拖入 `/Applications`（无该目录写权限时可放 `~/Applications`），然后退出安装磁盘。仓库会自动查找这两个位置；自定义位置在 setup 命令中传 `--chrome`。若 macOS 首次打开要求确认，先实际启动一次 Chrome、完成系统要求再退出；不关闭系统安全保护。

## 最终检查与开始准备

在后续运行所用的同一 shell 中执行：

```sh
node -p 'JSON.stringify({version:process.version,arch:process.arch})'
npm --version
python3.12 -c 'import platform,sys; print(platform.machine(),sys.version)'
```

Node 和 Python 架构都必须为 `arm64`；Node 主版本为 22/24，Python 为 3.12。仅 `uname` 正确不足以排除正在使用 x86 解释器。当前目录 PATH 若未持久保存，新的 Codex 工具 shell 需显式恢复它；不要以另一版本安装后又用系统默认版本跑实验。

回到 [同事复测指南](COLLEAGUE_QUICKSTART.zh-CN.md)，运行 `setup-online.py`。它会验证解释器、Chrome 和本机路径，再准备全部锁定依赖和数据。准备完成后才能执行 CPU 校验、GPU probe、pilot、full 和报告。若遇故障，使用仓库内 [恢复说明](TROUBLESHOOTING.zh-CN.md)。
