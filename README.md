# pi-experiment-ops

A standalone Pi package for experiment operations: MCP instruments, background tool execution through CodeMode, subagents, background processes, interactive terminals, agent modes, searchable SQLite transcripts, and pi-graph workflows. Upstream packages remain unchanged. The package runs through Pi's native terminal interface or its public SDK.

## User installation: release package

Users install under `~/.local/share/pi-experiment-ops`, with a launcher in `~/.local/bin`. These locations and the workspace are configurable. No administrator access or global npm installation is needed.

Install from the [AdvancedPhotonSource/pi-experiment-ops](https://github.com/AdvancedPhotonSource/pi-experiment-ops) GitHub release:

```bash
curl -fsSL https://raw.githubusercontent.com/AdvancedPhotonSource/pi-experiment-ops/v0.2.0/install.sh | \
  sh -s -- --repo AdvancedPhotonSource/pi-experiment-ops --version 0.2.0
```

Available versions and downloads are listed on the [releases page](https://github.com/AdvancedPhotonSource/pi-experiment-ops/releases).

For Argo, use the preset on the same installer:

```bash
curl -fsSL https://raw.githubusercontent.com/AdvancedPhotonSource/pi-experiment-ops/v0.2.0/install.sh | \
  sh -s -- --repo AdvancedPhotonSource/pi-experiment-ops --version 0.2.0 \
    --preset argo --argo-user YOUR_ARGONNE_USERNAME --model GPT-4.1
```

The Argo preset uses `https://apps.inside.anl.gov/argoapi/v1`. Choose an exact model ID from your endpoint's `/models` response. Setup configures Pi's default provider/model and the untouched toy workflow. It sends no inference request. Generic OpenAI-compatible endpoints are supported with `--preset openai --base-url URL --model ID --api-key-env VARIABLE_NAME`.

Run `~/.local/bin/pi-experiment-ops` to launch Pi in the configured workspace. If desired, add `export PATH="$HOME/.local/bin:$PATH"` to your shell configuration. The installer does not edit shell startup files. For other providers, use Pi's `/login` or configure workspace provider files.

If you already have a downloaded release tarball and a copy of `install.sh`, install locally:

```bash
sh install.sh --archive /path/to/pi-experiment-ops-0.2.0.tgz \
  --workspace "$HOME/pi-experiment-workspace"
```

See the [installation and endpoint guide](docs/installation.md) for options, developer Argo setup, managed-machine prerequisites, upgrades, recovery, and uninstalling.

## Developer installation: local checkout

Clone this repository into a directory you own. On Linux:

```bash
git clone https://github.com/AdvancedPhotonSource/pi-experiment-ops.git
cd pi-experiment-ops
sh install.sh --source "$PWD" --workspace "$HOME/pi-experiment-workspace"
"$HOME/.local/bin/pi-experiment-ops"
```

The installer provisions Node.js/npm when needed, uv when needed, Python 3.12, and the locked npm/Python dependencies without sudo. The launcher points at this checkout, so source edits take effect immediately. It uses a separate workspace for configuration, credentials, sessions, and workflow output.

If Node.js 22.19+ and uv are already available, the lower-level development/CI path is:

```bash
npm ci
bash scripts/install.sh "$HOME/pi-experiment-workspace"
node bin/pi-experiment-ops.mjs pi --workspace "$HOME/pi-experiment-workspace"
```

## Configuration and operations

- MCP configuration is `<workspace>/.pi/mcp.json`, with an `mcpServers` object. The MCP adapter accepts stdio commands or HTTP URLs. Host configuration discovery is disabled; tools are exposed individually by default. Keep secrets in environment variables or private workspace configuration.
- Provider configuration, credentials, modes, shell settings, and Pi sessions live under `<workspace>/.pi-experiment-ops/agent`. Startup preserves existing files. Choose a provider/model with Pi flags or Pi settings.
- Pi owns agent execution and native session history. `/resume` restores conversations. A resumed transcript does not restart past processes or terminals.
- Use `subagent` for delegated work, `process` for background commands, and `interactive_shell` for persistent terminals. These retain the upstream native terminal UI. Their skills describe controls and cancellation.
- Use `codemode_execute` with `wait: false` to run registered Pi or MCP tools in a background TypeScript cell, then retrieve its result with `codemode_result({ sessionId })`. The MCP adapter supplies the MCP tools; CodeMode supplies execution and polling. The bundled CodeMode skill describes configuration and troubleshooting. Background calls retain the MCP server's configured request timeout; set `requestTimeoutMs` above the expected operation duration.
- The archive indexes this workspace's agent sessions into `.pi/archive.db`; `search_archive` searches transcripts.
- Agent modes provide plan/build behavior; plan defaults deny write tools, bash, and unknown tools. This is an execution policy, not a sandbox. Native agents run with your account's filesystem and network permissions.
- Instrument servers must serialize conflicting physical operations until completion, including operations returning asynchronous job IDs. Sequential agent tools do not serialize separate agents.

Full MCP server log/progress content is not exposed through the inspected public interfaces. Server status and tool execution remain available through the upstream adapter.

## Workflows

Initialization copies the toy generator → reviewer → renderer graph to `workflows/toy`. Set its `model` to your provider/model before running:

```bash
pi-experiment-ops piw --workspace /absolute/workspace -- run workflows/toy/steps.yaml --input 'A toy dataset' --json --no-cache
pi-experiment-ops piw --workspace /absolute/workspace -- resume workflows/toy/steps.yaml RUN_ID --json
```

The example uses one worker, 30-second step limits, JSON gates, and an atomic completion receipt. Rejected review blocks rendering. `fail-command` in the input deliberately fails the renderer; create `allow-render` inside the run directory and resume. Completed steps are reused and the receipt prevents repeated completion writes. pi-graph is the sole runner. Its agent transcripts are governed by upstream child persistence behavior.

## Background MCP acceptance test

Run `node --test tests/codemode.test.mjs` to exercise a blocking MCP tool that sleeps for 60 seconds. A deterministic local model fixture drives the real Pi agent loop: launch a CodeMode cell with `wait: false`, read another file, confirm the cell is pending, then retrieve its completed result. The same test runs against the installed release in `npm run test:package`.

For manual testing, `node tests/fixtures/sleep-mcp.mjs 8766` starts the test server at `http://127.0.0.1:8766/mcp` (8766 is the default port). Add that URL as a server named `sleeper` in the workspace's `.pi/mcp.json`, with `directTools: true`, `lifecycle: "eager"`, and `requestTimeoutMs: 90000`. In a persistent Pi session, ask the agent to run `return await tools.sleeper_sleep({});` through `codemode_execute` with `wait: false`, do independent work, and later retrieve the result with `codemode_result`.

## SDK consumers

[The integration contract](docs/integration.md) describes resource selection, wrapper replacement, paths, and workspace setup. Consumers embed Pi's public SDK and keep their presentation, transport, and metadata storage in their own packages.

## Upgrades and removal

Back up your workspace, then rerun the installer for the desired release version using the same workspace. To roll back, reinstall a previous release version. See the [installation guide](docs/installation.md#upgrades-rollback-and-removal) for upgrade, rollback, and uninstall instructions. Workspace configuration and session history are kept separately from the installed package.

For missing Python imports, rerun the installer and doctor. For missing PTYs, check platform/compiler support. For provider failures, check workspace authentication and model identifiers. For installation conflicts, use the documented peer dependency flag. See [upstream provenance](THIRD_PARTY.md) for pinned versions and source links.
