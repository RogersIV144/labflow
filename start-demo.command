#!/bin/zsh
set -eu
cd "${0:A:h}"
if ! command -v node >/dev/null 2>&1; then
  runtime="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin"
  [[ -x "$runtime/node" ]] && export PATH="$runtime:$PATH"
fi
if ! command -v node >/dev/null 2>&1; then
  echo "需要 Node.js 22 或更新版本。安装后重新打开此文件。"
  read -r
  exit 1
fi
if [[ ! -d node_modules || ! -d dist ]]; then
  echo "请先按 README 安装依赖并构建 Demo。"
  read -r
  exit 1
fi
echo "LabFlow: http://127.0.0.1:4317/ （关闭窗口或按 Ctrl+C 停止）"
exec node --import tsx server/index.ts --production
