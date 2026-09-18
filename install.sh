#!/bin/sh
# User-local installer. This file may be downloaded and piped to sh.
set -eu
fail() { printf '%s\n' "Error: $*" >&2; exit 1; }
usage() {
  cat <<'HELP'
Usage: sh install.sh [options]
  --source DIR          Developer install of a local checkout (edits stay live)
  --repo OWNER/REPO     GitHub repository hosting release assets
  --version VERSION     Release version (default 0.3.0)
  --archive FILE        Install a downloaded release tarball instead
  --prefix DIR          Installation directory (default ~/.local/share/pi-experiment-ops)
  --bin-dir DIR         Launcher directory (default ~/.local/bin)
  --workspace DIR       Default workspace (default ~/pi-experiment-workspace)
  --preset argo|openai  Configure the endpoint while installing
  --model ID            Endpoint's exact model identifier
  --argo-user USER      Argonne username, for the Argo preset
  --base-url URL        OpenAI-compatible endpoint base URL
  --provider NAME       Custom provider name (default inference)
  --api-key-env NAME    Read the custom endpoint's API key from this variable
  --context-window N   Context limit (default 128000)
  --max-tokens N        Output limit (default 4096)
  --help
No sudo is used. Shell startup files are left intact.
HELP
}
source_dir= repo= archive= preset= model= argo_user= base_url= provider= api_key_env=
version=0.3.0
prefix=${XDG_DATA_HOME:-"$HOME/.local/share"}/pi-experiment-ops
bin_dir=$HOME/.local/bin
workspace=$HOME/pi-experiment-workspace
context_window=128000
max_tokens=4096
while [ "$#" -gt 0 ]; do
  case "$1" in
    --help|-h) usage; exit 0 ;;
    --source|--repo|--version|--archive|--prefix|--bin-dir|--workspace|--preset|--model|--argo-user|--base-url|--provider|--api-key-env|--context-window|--max-tokens)
      [ "$#" -ge 2 ] || fail "$1 requires a value"
      case "$1" in
        --source) source_dir=$2;; --repo) repo=$2;; --version) version=$2;; --archive) archive=$2;;
        --prefix) prefix=$2;; --bin-dir) bin_dir=$2;; --workspace) workspace=$2;;
        --preset) preset=$2;; --model) model=$2;; --argo-user) argo_user=$2;; --base-url) base_url=$2;;
        --provider) provider=$2;; --api-key-env) api_key_env=$2;;
        --context-window) context_window=$2;; --max-tokens) max_tokens=$2;;
      esac
      shift 2;;
    *) fail "Unknown option: $1";;
  esac
done
[ -z "$source_dir" ] || [ -z "$archive$repo" ] || fail '--source cannot be combined with --archive or --repo'
[ -z "$archive" ] || [ -z "$repo" ] || fail '--archive cannot be combined with --repo'
[ -n "$source_dir$archive$repo" ] || fail 'Supply --source, --archive, or --repo (GitHub location is not assigned yet)'
case "$preset" in ''|argo|openai) ;; *) fail 'Preset must be argo or openai';; esac
[ -z "$preset" ] || [ -n "$model" ] || fail '--model is required with --preset'
[ "$preset" != argo ] || [ -n "$argo_user" ] || fail '--argo-user is required with --preset argo'
[ "$preset" != openai ] || [ -n "$base_url" ] || fail '--base-url is required with --preset openai'
for directory in "$prefix" "$bin_dir" "$workspace"; do
  case "$directory" in /*) ;; *) fail 'Use absolute paths for --prefix, --bin-dir and --workspace';; esac
done
[ "$(uname -s)" = Linux ] || fail 'This release supports Linux; macOS/Windows have not been validated'
case "$(uname -m)" in x86_64) arch=x64;; aarch64|arm64) arch=arm64;; *) fail 'Supported CPUs: x86_64 and aarch64';; esac
for tool in curl tar gzip sha256sum bash; do command -v "$tool" >/dev/null || fail "Required system tool is missing: $tool"; done
umask 077
mkdir -p "$prefix/tools" "$prefix/releases" "$bin_dir"
# Prevent concurrent upgrades from changing the selected release halfway through setup.
mkdir "$prefix/.install-lock" 2>/dev/null || fail "Another install is active: $prefix/.install-lock"
temporary=$(mktemp -d)
trap 'rm -rf "$temporary"; rmdir "$prefix/.install-lock"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
fetch() { curl --proto '=https' --tlsv1.2 -fsSL --retry 2 "$1" -o "$2"; }
PATH="$prefix/tools/node/bin:$prefix/tools/uv:$PATH"
export PATH
if ! command -v node >/dev/null || ! node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22 || a===22 && b>=19 ? 0:1)' 2>/dev/null || ! command -v npm >/dev/null; then
  node_version=22.23.2
  node_file=node-v$node_version-linux-$arch.tar.gz
  fetch "https://nodejs.org/dist/v$node_version/SHASUMS256.txt" "$temporary/SHASUMS256.txt"
  fetch "https://nodejs.org/dist/v$node_version/$node_file" "$temporary/$node_file"
  (cd "$temporary"; awk -v name="$node_file" '$2 == name {print; found=1} END {if (!found) exit 1}' SHASUMS256.txt | sha256sum -c -)
  tar -xzf "$temporary/$node_file" -C "$temporary"
  mkdir -p "$prefix/tools/node"
  cp -R "$temporary/node-v$node_version-linux-$arch/." "$prefix/tools/node/"
fi
node_path=$(command -v node)
if ! command -v uv >/dev/null; then
  fetch 'https://astral.sh/uv/0.8.15/install.sh' "$temporary/uv-install.sh"
  UV_UNMANAGED_INSTALL="$prefix/tools/uv" sh "$temporary/uv-install.sh" </dev/null
fi
if [ -n "$source_dir" ]; then
  source_dir=$(cd "$source_dir" && pwd)
  [ -f "$source_dir/npm-shrinkwrap.json" ] || fail 'Source checkout is missing npm-shrinkwrap.json'
  (cd "$source_dir"; npm ci --legacy-peer-deps --no-audit --no-fund </dev/null)
  package_dir=$source_dir
else
  if [ -n "$repo" ]; then
    case "$repo" in *[!a-zA-Z0-9_./-]*|/*|*..*|*/../*) fail 'Invalid GitHub repository';; esac
    case "$repo" in */*) ;; *) fail 'Use --repo OWNER/REPO';; esac
    case "$version" in ''|*[!a-zA-Z0-9.-]*) fail 'Invalid version';; esac
    filename=pi-experiment-ops-$version.tgz
    release_url=https://github.com/$repo/releases/download/v$version
    fetch "$release_url/$filename" "$temporary/$filename"
    fetch "$release_url/$filename.sha256" "$temporary/$filename.sha256"
    (cd "$temporary"; sha256sum -c "$filename.sha256")
    archive=$temporary/$filename
  fi
  [ -f "$archive" ] || fail 'Release archive does not exist'
  archive=$(cd "$(dirname "$archive")" && pwd)/$(basename "$archive")
  tar -xOf "$archive" package/package.json > "$temporary/package.json"
  version=$(node -e 'const p=JSON.parse(require("fs").readFileSync(process.argv[1]));if(p.name!=="pi-experiment-ops" || !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(p.version))process.exit(1);console.log(p.version)' "$temporary/package.json")
  digest=$(sha256sum "$archive" | cut -c 1-12)
  release_dir=$prefix/releases/$version-$digest
  package_dir=$release_dir/node_modules/pi-experiment-ops
  if [ ! -f "$release_dir/.installed" ]; then
    mkdir -p "$release_dir"
    npm install --prefix "$release_dir" --omit=dev --legacy-peer-deps --no-audit --no-fund "$archive" </dev/null
  fi
fi
bash "$package_dir/scripts/install.sh" "$workspace" </dev/null
if [ -n "$preset" ]; then
  "$node_path" "$package_dir/bin/pi-experiment-ops.mjs" configure --workspace "$workspace" \
    --preset "$preset" --model "$model" --argo-user "$argo_user" --base-url "$base_url" \
    --provider "$provider" --api-key-env "$api_key_env" --context-window "$context_window" --max-tokens "$max_tokens"
fi
# Generate a safely quoted launcher; Node handles paths containing spaces or shell characters.
OPS_BIN=$bin_dir OPS_PACKAGE=$package_dir OPS_NODE=$node_path OPS_TOOLS=$prefix/tools OPS_WORKSPACE=$workspace node --input-type=module <<'JS'
import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';
const quote = value => "'" + value.replaceAll("'", "'\\''") + "'";
const env = process.env, path = join(env.OPS_BIN, 'pi-experiment-ops');
if (existsSync(path) && !readFileSync(path, 'utf8').includes('# pi-experiment-ops managed launcher')) throw Error(`Refusing to replace unrelated executable: ${path}`);
const script = '#!/bin/sh\n# pi-experiment-ops managed launcher\n' +
  `export PATH=${quote(dirname(env.OPS_NODE) + ':' + env.OPS_TOOLS + '/uv:') }"$PATH"\n` +
  `command_name=\${1:-pi}\nif [ "$#" -gt 0 ]; then shift; fi\n` +
  'explicit_workspace=0\nfor argument in "$@"; do\n  [ "$argument" != -- ] || break\n  if [ "$argument" = --workspace ]; then explicit_workspace=1; break; fi\ndone\n' +
  `if [ "$explicit_workspace" = 1 ]; then exec ${quote(env.OPS_NODE)} ${quote(join(env.OPS_PACKAGE, 'bin/pi-experiment-ops.mjs'))} "$command_name" "$@"; fi\n` +
  `exec ${quote(env.OPS_NODE)} ${quote(join(env.OPS_PACKAGE, 'bin/pi-experiment-ops.mjs'))} "$command_name" --workspace ${quote(env.OPS_WORKSPACE)} "$@"\n`;
writeFileSync(path + '.tmp', script, { mode: 0o755 });
renameSync(path + '.tmp', path);
JS
if [ -z "$source_dir" ]; then touch "$release_dir/.installed"; fi
printf '\nInstalled. Launch: %s/pi-experiment-ops\nWorkspace: %s\n' "$bin_dir" "$workspace"
printf 'If needed, add your launcher directory to PATH in your shell configuration: %s\n' "$bin_dir"
