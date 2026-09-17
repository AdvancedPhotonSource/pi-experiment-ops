# Installation and endpoint configuration

## Managed Linux machines

All writes belong to your account. The bootstrap needs an existing POSIX shell, Bash, curl with HTTPS support, tar, gzip, sha256sum, and standard Unix utilities. It supports Linux x86_64 and aarch64. The managed Node build requires a compatible glibc-based distribution. macOS, Windows, and musl/Alpine are outside the tested bootstrap target.

An existing Node.js ≥22.19 and npm are reused. Otherwise the script downloads Node 22.23.2 from nodejs.org and verifies its published SHA-256. An existing uv is reused; otherwise the pinned uv 0.8.15 installer runs with `UV_UNMANAGED_INSTALL`. uv provisions Python 3.12 and synchronizes the package's hashed Python lock. No system package manager, sudo, global npm prefix, or shell-profile edits are used.

Network access is required for GitHub, nodejs.org when Node is missing, npm, and Python/uv distribution hosts. Corporate proxies and approved CA certificates should be configured in your shell using the normal curl/npm/uv settings. The script preserves TLS verification. Some PTY platforms require native compiler tools; if no upstream prebuilt binary fits your host, use an IT-provided compiler or a supported execution host. Git is needed for a developer checkout and its pinned Git dependencies; release assets already bundle the community sources.

## Installation modes and paths

| Option | Purpose/default |
|---|---|
| `--source DIR` | Developer installation; npm ci in your checkout and a launcher pointing to it |
| `--archive FILE` | Install a locally downloaded npm release tarball |
| `--repo OWNER/REPO --version VERSION` | Download a GitHub Release tarball and its SHA-256 file |
| `--prefix DIR` | `${XDG_DATA_HOME:-$HOME/.local/share}/pi-experiment-ops` |
| `--bin-dir DIR` | `$HOME/.local/bin` |
| `--workspace DIR` | `$HOME/pi-experiment-workspace` |

Use absolute paths for prefix, launcher directory, and workspace. Paths containing spaces and quotes are supported. A release installation lives under `PREFIX/releases/VERSION-DIGEST/node_modules/pi-experiment-ops`. Managed Node/uv binaries live under `PREFIX/tools`. Python is private to each package installation. The generated launcher remembers the installation and default workspace; `pi-experiment-ops pi --workspace /another/workspace` overrides it.

The current launcher is replaced only after provisioning, doctor, and requested endpoint configuration succeed. Existing release directories remain available. An installation lock prevents concurrent upgrades; after an interrupted process, confirm it has exited before removing `PREFIX/.install-lock`.

The installer can be read before execution or piped to `sh`. It accepts all required values as arguments, reads no prompts from the pipe, and runs child installers with stdin closed. Missing preset/model/user values fail clearly. Downloaded release archives have their SHA-256 checked against the release's checksum file. A `--archive` file is an explicitly supplied local artifact; verify its published checksum yourself when acquiring it separately.

## Developer examples

```bash
cd /path/to/pi-experiment-ops
sh install.sh --source "$PWD" --workspace "$HOME/work/experiment"
sh install.sh --source "$PWD" --workspace "$HOME/work/argo-experiment" \
  --preset argo --argo-user YOUR_ARGONNE_USERNAME --model GPT-4.1
```

Use the existing lower-level `scripts/install.sh WORKSPACE` when dependencies are managed externally. It provisions only this package's Python environment and validates its runtime. Run `npm ci` after changing the npm lock. No npm link or privileged global install is required.

## Configure an existing installation

```bash
pi-experiment-ops configure --preset argo \
  --argo-user YOUR_ARGONNE_USERNAME --model GPT-4.1

export INFERENCE_API_KEY='YOUR_KEY'
pi-experiment-ops configure --preset openai --provider facility \
  --base-url https://inference.example.org/v1 --model YOUR_MODEL \
  --api-key-env INFERENCE_API_KEY
```

With the source CLI, use `node bin/pi-experiment-ops.mjs configure --workspace DIR ...`. Installer options accept the same preset arguments. `--base-url` can override the Argo URL for a site-supported gateway or loopback test endpoint. Remote endpoints require HTTPS. Keyless endpoints can omit `--api-key-env`; Pi receives a placeholder key. API-key *values* are not accepted as installer arguments or copied into configuration: generic credentials are referenced by environment variable name.

Configuration is stored in `WORKSPACE/.pi-experiment-ops/agent/models.json`, with `defaultProvider`/`defaultModel` in `settings.json`. Other providers, other model entries, and unrelated settings are preserved; an explicitly selected provider/model is updated. Changed JSON files receive a private `.bak` copy, and repeated identical setup performs no JSON rewrite. `auth.json`, MCP configuration, session history, and global `~/.pi/agent` are preserved. Backups may contain existing provider secrets and have mode 0600.

New model metadata defaults to text input, reasoning disabled, a 128000-token context, and 4096 output tokens. These are configurable client limits, not discovered endpoint capabilities. Use `--context-window` and `--max-tokens` to match your deployment; edit the model entry to enable supported images or reasoning. Use Pi's model picker after configuration. The untouched toy graph model placeholder is updated once; edited workflows retain their model choices.

## Argo and ALCF are different presets

The live [Argo API schema](https://apps.inside.anl.gov/argoapi/openapi.json) exposes `/argoapi/v1/chat/completions`, including `user`, streaming, and tool-call fields. The [model catalog](https://apps.inside.anl.gov/argoapi/v1/models) supplies current model identifiers. The preset uses Pi's `openai-completions` API, your Argonne username as its API-key value, and an explicit `user` field in each request via Pi's model `samplingParams`. This also applies to graph children that disable extensions. It does not add a proxy or patch Pi.

The [example zero-to-pi installer](https://raw.githubusercontent.com/lowpolyneko/zero-to-pi/main/setup.sh) configures ALCF Minerva with an authentication helper. That is a separate service and authentication flow; its bearer-token helper is not needed to configure this Argo preset. Follow your institution's Argo access/network requirements. A reachable model catalog is not proof that your username is authorized to run inference.

## Upgrades, rollback, and removal

Rerun the bootstrap with a new `--version` and the same workspace. Repeating a release reuses its dependency installation, checks Python/runtime health, and preserves workspace data. Endpoint settings change only when you explicitly pass a preset or run `configure`. To roll back, rerun with the previous release archive/version. Developer launchers always track their checkout; check out the desired revision and reinstall its dependencies when rolling back.

To uninstall a release installation, remove the generated `BIN_DIR/pi-experiment-ops` launcher and `PREFIX`. A developer installation also owns dependencies and `.runtime` inside its checkout; remove those or the checkout when no longer needed. Workspace credentials, sessions, workflows, and artifacts are separate; retain, archive, or delete the workspace according to your needs. Shared pre-existing Node/uv installations and shell startup files are preserved.

See also the official [uv installer options](https://docs.astral.sh/uv/reference/installer/) and [Node download verification](https://github.com/nodejs/node#verifying-binaries).
