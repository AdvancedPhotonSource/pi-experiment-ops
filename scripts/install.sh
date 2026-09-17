#!/usr/bin/env bash
set -euo pipefail
root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$root"
node --input-type=module -e 'const [a,b]=process.versions.node.split(".").map(Number); if(a<22 || (a===22 && b<19)) throw Error("Node 22.19+ required")'
command -v uv >/dev/null || { echo 'Install uv: https://docs.astral.sh/uv/getting-started/installation/' >&2; exit 1; }
if ! node --input-type=module -e 'import { piCli, resources } from "./lib/index.mjs"; import { existsSync } from "node:fs"; if (![piCli, ...resources().extensions].every(existsSync)) process.exit(1)' 2>/dev/null; then npm ci --omit=dev --legacy-peer-deps --no-audit --no-fund; fi
uv venv --python 3.12 --allow-existing .runtime/python
uv pip sync --python .runtime/python/bin/python requirements.lock
if [[ "${1:-}" != --runtime-only ]]; then node bin/pi-experiment-ops.mjs doctor --workspace "${1:-$PWD/.demo}"; fi
