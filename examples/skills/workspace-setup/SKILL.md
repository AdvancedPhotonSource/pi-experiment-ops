---
name: workspace-setup
description: Add or configure MCP servers, install skill folders, and set up AI providers or default models in a pi-experiment-ops workspace. Use when the user asks the agent to change workspace setup.
---

# Workspace setup

Work in the user's selected workspace. All paths below are relative to that workspace, not to the application installation or the user's home.

| Purpose | Workspace path |
|---|---|
| MCP server connections | `.pi/mcp.json` |
| Installed skills | `.pi/skills/<folder-name>/SKILL.md` |
| Custom providers and models | `.pi-experiment-ops/agent/models.json` |
| Default provider and model | `.pi-experiment-ops/agent/settings.json` |
| Provider credentials | `.pi-experiment-ops/agent/auth.json` |
| Skill and tool permissions | `.pi-experiment-ops/agent/pi-permissions.jsonc` |

Inspect existing entries before changing them. Merge the requested entry and preserve other settings. Ask for missing connection details or model IDs instead of guessing. Avoid printing credentials; prefer environment variable references when the user has supplied an environment-based credential. Complete the requested file changes, then report their location and any remaining authentication or restart step.

## Add an MCP server

For agent-driven setup, edit `.pi/mcp.json` directly. The `pi-experiment-ops config add-mcp` command is an interactive wizard intended for a person at a terminal. You can configure the connection directly without it.

Ask for a server name, connection type, URL or local program, and any required authentication. Add the entry under the existing `mcpServers` object. If the name already exists, determine whether the user wants to update it or use a different name.

A web connection can use:

```json
{
  "mcpServers": {
    "instrument": {
      "url": "http://instrument-host:9001/mcp",
      "directTools": true,
      "lifecycle": "eager"
    }
  }
}
```

For a server that specifically requires SSE, add `"httpTransport": "sse"`. For bearer authentication, add `"auth": "bearer"` and `"bearerTokenEnv": "INSTRUMENT_TOKEN"`, using the user's environment variable name. For OAuth, use `"auth": "oauth"`; the user can authenticate in the TUI with `/mcp-auth instrument`. Custom headers support references such as `"headers": { "X-API-Key": "$env:INSTRUMENT_KEY" }`.

A local program uses `command` and an array of separate `args` instead of `url`:

```json
{
  "command": "python3",
  "args": ["/absolute/path/to/server.py"],
  "directTools": true,
  "lifecycle": "eager"
}
```

Arguments are literal strings, not shell command fragments. Set an absolute `cwd` if needed. The program inherits the launching process's environment; explicit `env` entries can reference it with `$env:NAME`. Saving configuration does not install the server software or start it immediately. Tell the user to restart the agent to load the connection.

## Add a skill

Accept a local folder containing `SKILL.md` and any supporting files. Copy the entire folder to `.pi/skills/<folder-name>/`, preserving the source and existing installed skills. If that destination exists, resolve whether the user wants a replacement or another name before overwriting it.

When available, use the CLI with the explicit workspace:

```bash
pi-experiment-ops config add-skill /path/to/skill --workspace /path/to/workspace
```

If the command is not on PATH, create the destination's parent directory and copy the folder using filesystem tools. No JSON registration is needed. Keep scripts and other supporting files beside `SKILL.md` as supplied. Read the skill's frontmatter to report its invocation name, which can differ from its folder name.

After copying, tell the user to restart the agent and use `/skill:name` for explicit invocation. New workspaces default to `defaultPolicy.skills: "allow"`, making skill descriptions available for automatic selection. Existing workspaces retain their permission file. If a skill is hidden, inspect `.pi-experiment-ops/agent/pi-permissions.jsonc` and explain the applicable rule; change permissions only within the user's requested scope. Allowing skill instructions does not override permissions on the tools those instructions use.

## Providers and defaults

Custom providers are entries under `providers` in `.pi-experiment-ops/agent/models.json`. An OpenAI-compatible provider needs `baseUrl`, `api: "openai-completions"`, and a `models` array with the exact model IDs. Use `apiKey: "$MY_API_KEY"` to refer to an environment variable. Set model capabilities such as `input: ["text", "image"]` only when the provider supports them; preserve existing model limits and other fields when updating entries.

For Argo, prefer the package's noninteractive helper if available, substituting the user's exact username and model ID:

```bash
pi-experiment-ops configure --workspace /path/to/workspace --preset argo --argo-user USERNAME --model MODEL_ID
```

If editing Argo manually, its default base URL is `https://apps.inside.anl.gov/argoapi/v1`; the username is used as the provider's `apiKey` and the model's `samplingParams.user`. Set `compat.supportsDeveloperRole`, `compat.supportsReasoningEffort`, and `compat.supportsStore` to `false`.

To select a default, merge `defaultProvider` and `defaultModel` into `.pi-experiment-ops/agent/settings.json`. They must match the configured provider name and model ID. Credentials belong in the shared agent configuration or the launching terminal's environment. Restart the agent after provider changes.
