# pi-experiment-ops

A standalone Pi package for experiment operations: MCP instruments, background tool execution through CodeMode, subagents, background processes, interactive terminals, agent modes, searchable SQLite transcripts, and scripted subagent workflows. Upstream packages remain unchanged. The package runs through Pi's native terminal interface or its public SDK.

## Overview

This package assembles a pinned, frontend-independent Pi distribution for experiment operations.

### Bundled Pi extensions

| Extension | Purpose |
|---|---|
| [`policy`](extensions/policy.ts) | Applies the configured plan/build tool-access policy. |
| [`pi-mcp-adapter`](https://pi.dev/packages/pi-mcp-adapter) | Connects stdio and HTTP MCP instrument servers and exposes their tools to Pi. |
| [`pi-interactive-shell`](https://pi.dev/packages/pi-interactive-shell) | Provides persistent terminal sessions for interactive programs and long-running work. |
| [`pi-subagents`](https://pi.dev/packages/pi-subagents) | Runs child agents and scripted multi-agent workflows. |
| [`workflows`](extensions/workflows.ts) | Registers trusted workspace workflow resources with pi-subagents. |
| [`@aliou/pi-processes`](https://pi.dev/packages/%40aliou/pi-processes) | Starts and monitors background commands without blocking the conversation. |
| [`pi-agent-modes`](https://pi.dev/packages/pi-agent-modes) | Switches between configured operating modes such as plan and build. |
| [`@gordonb/pi-archive`](https://pi.dev/packages/%40gordonb/pi-archive) | Indexes native session transcripts and provides full-text history search. |
| [`@ian-pascoe/pi-codemode`](https://pi.dev/packages/%40ian-pascoe/pi-codemode) | Composes registered Pi and MCP tools in persistent TypeScript cells, including background execution. |
| [`pi-permission-system`](https://pi.dev/packages/pi-permission-system) | Applies allow, session approval, ask, and deny policies to Pi and MCP tool calls. |

| [`pi-condense`](https://github.com/jjuraszek/pi-condense) | Caps images sent to the model and optionally summarizes older tool output. |

The launcher loads bundled skills and workspace skills from `.pi/skills`.

### APIs for downstream applications

| Export | Purpose |
|---|---|
| `pi-experiment-ops` | Initializes workspaces, configures the process environment, resolves workspace paths, returns extension and skill resources with optional replacements, and exposes Pi, Python, and package paths. |
| `pi-experiment-ops/mcp` | Exposes the MCP adapter factory used by wrapper extensions. |
| `pi-experiment-ops/mcp-types` | Exposes MCP runtime type helpers. |
| `pi-experiment-ops/subagents` | Exposes required-child subagent registration. |
| `pi-experiment-ops/shell` | Exposes the native interactive-shell extension factory. |
| `pi-experiment-ops/archive` | Exposes the archive extension and SQLite synchronization helpers. |
| `pi-experiment-ops/sdk` | Re-exports the pinned native Pi SDK and its types without performing workspace setup. |

See the [integration contract](docs/integration.md) for the complete consumer interface.

### Helper commands

| Command | Function |
|---|---|
| `pi-experiment-ops init` | Creates or completes a workspace while preserving existing configuration. |
| `pi-experiment-ops config` | Guides workspace provider setup, with optional MCP and skill addition. |
| `pi-experiment-ops configure` | Writes provider and model settings for Argo or another OpenAI-compatible endpoint. |
| `pi-experiment-ops doctor` | Checks the Node.js version, bundled resources, Python environment, and Pi CLI. |
| `pi-experiment-ops pi` | Launches Pi's native terminal interface with this package's extensions and skills. |

Each command accepts `--workspace DIR`; `pi` passes arguments following `--` to the underlying CLI.

### Other notable components

| Component | Purpose |
|---|---|
| Release and source installers | Provision the locked Node and Python dependencies without a global npm installation or administrator access. |
| Isolated workspace state | Keeps configuration, credentials, sessions, temporary files, and workflow state outside the installed package. |
| Toy workflow | Installs a generator → reviewer → renderer workflow for validating execution, review checks, command failures, and fresh retries without physical instruments. |

## Image context budget

Pi's automatic compaction manages the overall token budget. The bundled pi-condense extension additionally caps each request at four recent images, covering both attachments and tool results. Above the cap it replaces the oldest images with text notes in batches of two, retaining the latest three or four images while preserving the original transcript and UI history. This also applies to resumed sessions.

`initialize()` supplies `contextPrune.maxImagesPerRequest: 4` in the agent directory's `settings.json` for new and existing workspaces, preserving any explicit value and other settings. Change this positive integer and restart the session to adjust the budget. An explicit `null` selects pi-condense's provider-specific defaults. Images removed from a request must be re-read or re-attached if needed again.

LLM-based tool-output summarization remains off by default; `/pruner on` enables it separately. Image capping runs in either mode and makes no additional model calls.

## Installation

### User installation: release package

Users install under `~/.local/share/pi-experiment-ops`, with a launcher in `~/.local/bin`. These locations and the workspace are configurable. No administrator access or global npm installation is needed.

Install from the [AdvancedPhotonSource/pi-experiment-ops](https://github.com/AdvancedPhotonSource/pi-experiment-ops) GitHub release:

```bash
curl -fsSL https://raw.githubusercontent.com/AdvancedPhotonSource/pi-experiment-ops/v0.6.1/install.sh | \
  sh -s -- --repo AdvancedPhotonSource/pi-experiment-ops --version 0.6.1
```

Available versions and downloads are listed on the [releases page](https://github.com/AdvancedPhotonSource/pi-experiment-ops/releases).

For Argo, use the preset on the same installer:

```bash
curl -fsSL https://raw.githubusercontent.com/AdvancedPhotonSource/pi-experiment-ops/v0.6.1/install.sh | \
  sh -s -- --repo AdvancedPhotonSource/pi-experiment-ops --version 0.6.1 \
    --preset argo --argo-user YOUR_ARGONNE_USERNAME --model GPT-4.1
```

The Argo preset uses `https://apps.inside.anl.gov/argoapi/v1`. Choose an exact model ID from your endpoint's `/models` response. Setup configures Pi's default provider/model inherited by the toy workflow. It sends no inference request. Generic OpenAI-compatible endpoints are supported with `--preset openai --base-url URL --model ID --api-key-env VARIABLE_NAME`.

The installer creates and configures `~/pi-experiment-workspace` by default. Pass `--workspace /absolute/path` to the installer to choose another workspace. Preset settings are saved within that workspace:

- `.pi-experiment-ops/agent/models.json` stores the provider's base URL and model definitions. For the Argo example above, it also stores the supplied username.
- `.pi-experiment-ops/agent/settings.json` selects the default provider and model (`argo` and `GPT-4.1` in this example).

The generated `~/.local/bin/pi-experiment-ops` launcher remembers this workspace and uses it from any working directory. Pass `--workspace DIR` to the launcher to select another workspace, which has its own provider configuration. Presets configure the selected workspace; there is no shared global provider configuration.

Run `~/.local/bin/pi-experiment-ops` to launch Pi in the configured workspace. If desired, add `export PATH="$HOME/.local/bin:$PATH"` to your shell configuration. The installer does not edit shell startup files. For other providers, use Pi's `/login` or configure workspace provider files.

If you already have a downloaded release tarball and a copy of `install.sh`, install locally:

```bash
sh install.sh --archive /path/to/pi-experiment-ops-0.6.1.tgz \
  --workspace "$HOME/pi-experiment-workspace"
```

See the [installation and endpoint guide](docs/installation.md) for options, developer Argo setup, managed-machine prerequisites, upgrades, recovery, and uninstalling.

### Developer installation: local checkout

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

## Guided workspace setup

Run the setup wizard in the workspace you want to configure:

```bash
pi-experiment-ops config --workspace /path/to/workspace
```

It creates missing workspace files, guides you through an Argo or OpenAI-compatible provider and model, and offers to save your defaults. It then offers MCP and skill setup; both can be skipped. To add them later, use:

```bash
pi-experiment-ops config add-mcp --workspace /path/to/workspace
pi-experiment-ops config add-skill /path/to/skill/dir --workspace /path/to/workspace
```

MCP setup asks for a name, connection type, address or local command, and authentication details. Skill addition copies a complete folder containing `SKILL.md`; omit its path to enter it at a prompt. Existing skill folders are not overwritten. Without `--workspace`, these commands use the current directory.

You can also ask the agent to add a server or skill. Initialization installs a `workspace-setup` skill with the shared file locations and instructions for direct editing or copying when the CLI is unavailable. See [guided configuration](docs/installation.md#guided-configuration) for details.

## Workspace skills

Initialization creates `<workspace>/.pi/skills` and adds the `workspace-setup` skill. Put each additional skill in `.pi/skills/<name>/SKILL.md`, for example:

```markdown
---
name: analyze-data
description: Analyze experimental data in this workspace
---
Read the data and summarize the findings.
```

Restart Pi after adding skills, then use `/skill:analyze-data` to load one explicitly. New workspaces set `defaultPolicy.skills` to `"allow"` in `.pi-experiment-ops/agent/pi-permissions.jsonc`, so skill descriptions are also available for automatic selection. Existing workspaces retain their permission settings; change `defaultPolicy.skills` to `"allow"` there to adopt the new default, keeping any individual skill rules. Tool and command approvals remain separate.

## Configuration and operations

`pi-experiment-ops init --workspace DIR` creates the configuration files below and preserves existing contents when rerun. Relative paths are within the workspace.

| Path | Initial contents |
|---|---|
| `.pi-experiment-ops/agent/models.json` | `{ "providers": {} }`; add custom providers and models here |
| `.pi-experiment-ops/agent/auth.json` | `{}`; Pi stores provider credentials here |
| `.pi-experiment-ops/agent/settings.json` | Offline catalog, package, and theme defaults |
| `.pi-experiment-ops/agent/modes.config.json` | Build/plan mode defaults |
| `.pi-experiment-ops/agent/interactive-shell.json` | Shell query interval |
| `.pi-experiment-ops/agent/permission-system.json` | Permission extension settings |
| `.pi-experiment-ops/agent/pi-permissions.jsonc` | Default permission policies |
| `.pi/mcp.json` | Empty MCP server configuration |
| `.pi/agents/reviewer.md` | Toy reviewer definition |
| `.pi/skills/` | Workspace skills, including the initial `workspace-setup/SKILL.md` |
| `workflows/toy/` | Toy workflow source |

Sessions, logs, databases, and workflow outputs are created when used.

- MCP configuration is `<workspace>/.pi/mcp.json`, with an `mcpServers` object. The MCP adapter accepts stdio commands or HTTP URLs. Host configuration discovery is disabled; tools are exposed individually by default. Keep secrets in environment variables or private workspace configuration.
- Provider configuration, credentials, modes, shell settings, and Pi sessions live under `<workspace>/.pi-experiment-ops/agent`. Startup preserves existing files. Choose a provider/model with Pi flags or Pi settings.
- Tool permissions default to asking for every unmatched call. Use `/permissions auto` to auto-allow requests for the current TUI session, `/permissions ask` to restore prompts, or edit `.pi-experiment-ops/agent/pi-permissions.jsonc` for tool and command patterns. Explicit deny rules remain enforced in auto mode.
- Pi owns agent execution and native session history. `/resume` restores conversations. A resumed transcript does not restart past processes or terminals.
- Use `subagent` for delegated work, `process` for background commands, and `interactive_shell` for persistent terminals. These retain the upstream native terminal UI. Their skills describe controls and cancellation.
- Use `codemode_execute` with `wait: false` to run registered Pi or MCP tools in a background TypeScript cell, then retrieve its result with `codemode_result({ sessionId })`. The permission policy gates the CodeMode launch; calls inside an accepted cell are not prompted separately. The MCP adapter supplies the MCP tools; CodeMode supplies execution and polling. The bundled CodeMode skill describes configuration and troubleshooting. Background calls retain the MCP server's configured request timeout; set `requestTimeoutMs` above the expected operation duration.
- The archive indexes this workspace's agent sessions into `.pi/archive.db`; `search_archive` searches transcripts.
- Agent modes provide plan/build behavior; plan defaults deny write tools, bash, and unknown tools. This is an execution policy, not a sandbox. Native agents run with your account's filesystem and network permissions.
- Instrument servers must serialize conflicting physical operations until completion, including operations returning asynchronous job IDs. Sequential agent tools do not serialize separate agents.

Full MCP server log/progress content is not exposed through the inspected public interfaces. Server status and tool execution remain available through the upstream adapter.

### Selecting a workspace provider and model

After adding a provider to `<workspace>/.pi-experiment-ops/agent/models.json`, select it by setting `defaultProvider` and `defaultModel` in the same directory's `settings.json`. Use the provider key and exact model ID from `models.json`. For example, for provider `argo` and model `GPT-4.1`, merge these fields into the existing settings, preserving other fields:

```json
{
  "defaultProvider": "argo",
  "defaultModel": "GPT-4.1"
}
```

The installer presets and `pi-experiment-ops configure` set these defaults automatically.

Launch the terminal interface with that workspace:

```bash
pi-experiment-ops pi --workspace /path/to/workspace
```

Pi reads the workspace's `models.json` and `settings.json`. Restart Pi after changing the provider configuration or defaults.

## Workflows

Initialization copies the toy generator → reviewer → renderer workflow to `workflows/toy/workflow.mjs`. The module exports a pi-subagents workflow resource definition with a bounded `resolve(args)` function. Workspace resources register when the native Pi session starts.

Invoke the `subagent` tool with:

```json
{"workflow":"toy","args":{"input":"A toy dataset","outputDirectory":"/absolute/workspace/output"},"cwd":"/absolute/workspace/output","async":true}
```

Create the output directory first. Children inherit the selected model. The example validates JSON dataset/reviewer responses and grants one fixed rendering command through `runs.host`. Rejected reviews block rendering. `fail-command` in the input deliberately fails the renderer. Run again in a fresh output directory to repeat all steps. Pi-subagents owns child execution, cancellation, artifacts, and workflow receipts.

Workspace modules are trusted code. Export `{ name, version, resolve }`; return `{ script, hostCommands? }` or `{ error }`. Script bodies use JavaScript, `runs.run` for sequential steps and `runs.all` for fanout. `hostCommands` grants exact command/key pairs. See [pi-subagents' resource API](https://github.com/nicobailon/pi-subagents/blob/main/docs/extension-api.md). Existing YAML workflows require manual conversion; initialization preserves existing directories.

## Background MCP acceptance test

Run `node --test tests/codemode.test.mjs` to exercise a blocking MCP tool held behind a test-controlled release gate. A deterministic local model fixture drives the real Pi agent loop: launch a CodeMode cell with `wait: false`, read another file, confirm the cell is pending, release the MCP call, then retrieve its completed result. The same test runs against the installed release in `npm run test:package` without a long artificial delay.

For manual testing, `node tests/fixtures/sleep-mcp.mjs 8766` starts the test server at `http://127.0.0.1:8766/mcp` (8766 is the default port). Add that URL as a server named `sleeper` in the workspace's `.pi/mcp.json`, with `directTools: true`, `lifecycle: "eager"`, and `requestTimeoutMs: 90000`. In a persistent Pi session, ask the agent to run `return await tools.sleeper_sleep({});` through `codemode_execute` with `wait: false`, do independent work, and later retrieve the result with `codemode_result`.

## SDK consumers

[The integration contract](docs/integration.md) describes resource selection, wrapper replacement, paths, and workspace setup. Consumers embed Pi's public SDK and keep their presentation, transport, and metadata storage in their own packages.

## Upgrades and removal

Back up your workspace, then rerun the installer for the desired release version using the same workspace. To roll back, reinstall a previous release version. See the [installation guide](docs/installation.md#upgrades-rollback-and-removal) for upgrade, rollback, and uninstall instructions. Workspace configuration and session history are kept separately from the installed package.

For missing Python imports, rerun the installer and doctor. For missing PTYs, check platform/compiler support. For provider failures, check workspace authentication and model identifiers. For installation conflicts, use the documented peer dependency flag. See [upstream provenance](THIRD_PARTY.md) for pinned versions and source links.
