#!/bin/zsh
cd "${0:A:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
  echo "请先安装 Node.js 22 或更新版本：https://nodejs.org/en/download"
  read -r
  exit 1
fi
node start.mjs
if [[ $? != 0 ]]; then read -r; fi
