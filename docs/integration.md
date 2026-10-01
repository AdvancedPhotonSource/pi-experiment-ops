# Integration contract

The package exports plain JavaScript helpers with TypeScript declarations:

```js
import { initialize, configureEnvironment, workspacePaths, resources, piCli } from 'pi-experiment-ops';
const paths = workspacePaths(workspace);
initialize(workspace);
configureEnvironment(workspace);
const resourcePaths = resources({ terminal: '/absolute/path/to/terminal-wrapper.ts' });
```

`resources()` returns absolute `extensions` and `skills` arrays for Pi's `DefaultResourceLoader` or CLI flags. Extension keys are `policy`, `mcp`, `terminal`, `subagents`, `processes`, `modes`, `archive`, `workflows`, `codemode`, `permissions`, and `condense`. Replacements occupy the original entry; no duplicate extension is loaded. Unknown keys fail. Applications should disable automatic extension/skill discovery when using this explicit list and append `<workspace>/.pi/skills` to the skill paths. `initialize()` creates this directory with `workspace-setup/SKILL.md`, and empty `models.json` (`{ "providers": {} }`) and `auth.json` (`{}`) files in the agent directory, preserving existing contents.

`initialize` preserves existing files, initializes workspace agent settings, MCP configuration, a reader-only reviewer, the workspace setup skill, and the toy workflow. New permission files set `defaultPolicy.skills` to `"allow"`; existing files retain their policies. Its default agent directory is `.pi-experiment-ops/agent`. `configureEnvironment` sets Pi and subagent workspace directories and executable paths in the current process; call it before creating Pi sessions or children. Run one workspace per host process. It respects an explicitly supplied `PI_OPS_PYTHON`. A bundle-owned `pi` forwarding launcher resolves the installed SDK even when npm hoists it; child launches therefore use the same installed distribution. Applications may prepend an observer launcher while retaining the bundle's executable resolution.

`piCli` is a JavaScript CLI entrypoint (invoke with Node). `pythonPath` is the installation-owned Python interpreter path; `packageRoot` locates installer/docs resources. No consumer should assume a nested or hoisted node_modules layout.

Pi-loaded TypeScript entrypoints re-export the pinned public upstream APIs needed for wrappers:

| Export | Interface |
|---|---|
| `pi-experiment-ops/mcp` | MCP adapter factory |
| `pi-experiment-ops/mcp-types` | MCP runtime type helpers |
| `pi-experiment-ops/subagents` | Required-child extension registration |
| `pi-experiment-ops/shell` | Native interactive-shell extension factory |
| `pi-experiment-ops/archive` | Archive extension and SQLite sync helpers |

These entrypoints are for Pi's extension loader, which supplies upstream compatibility aliases. Applications can import Pi's native SDK through `pi-experiment-ops/sdk`. This subpath re-exports the installed `@earendil-works/pi-coding-agent` API and types unchanged; importing it performs no workspace setup. Consumers using this entrypoint need only declare `pi-experiment-ops` as their Pi dependency. `piCli` and the SDK export resolve the same installed Pi package. This contract owns resource discovery and upstream versions; consumers own network APIs, frontend events, browser decisions, child observers, and application metadata.

The bundle carries upstream community resources using `bundledDependencies`. Release tarballs can be installed without a checkout. Consumers may vendor a versioned tarball until a registry release is available; they should include it in their package files and lock its integrity in their shrinkwrap. Neither a sibling directory dependency nor a workspace symlink is required.

`workspacePaths(workspace)` resolves the default `dataDirectory`, `agentDirectory`, and `sessionDirectory` without creating files or changing environment variables. The paths retain the native Pi workspace encoding and existing experiment-ops layout. Use `settings.json`, `models.json`, and `auth.json` in `agentDirectory` directly; native session files live in `sessionDirectory`. Frontend presentation state belongs in a separate frontend-owned directory.

The `workflows` extension registers each trusted `workflows/NAME/workflow.mjs` default export through pi-subagents' `registerWorkflowResource` API at session startup. Registrations are disposed on shutdown/replacement. Modules export `{ name, version, resolve(args) }` as described by upstream; scripts are JavaScript statement bodies.

Adapters can emit `pi-ops:workflow` with `{ definition: absoluteModulePath, params, reply }`. This process-local trusted-host seam registers a copied definition under a unique resource name and forwards `params` to the public subagents RPC `spawn` method, adding the registered workflow name. `reply` receives `{ result }` (the upstream RPC payload) or `{ error }`. `params` normally includes `args: { input, outputDirectory }`, `cwd`, `model`, and `timeoutMs`. Resource registration is disposed after admission; pi-subagents retains the captured definition/grants for the admitted run. The caller owns path validation, copying, retry presentation, and host metadata. Use upstream `stop` and `subagent:async-complete` to control and observe runs. Retries start fresh runs; older graph ledgers remain historical files.

## Configuration commands in a host application

Import `configure` from `pi-experiment-ops/config` to use the same interactive commands as the standalone CLI:

```js
import { configure } from 'pi-experiment-ops/config';
await configure(workspace, args);
```

`args` is empty for full setup, `['add-mcp']` for MCP setup, or `['add-skill', sourceDirectory]` to copy a skill. Omit the source directory to prompt for it. Help and argument validation run before workspace initialization.

An optional third argument accepts `commandName` for user-facing help, `initializeWorkspace` to supply a host initializer, and `configureHost(workspace, prompts)` for host-specific settings between provider setup and the optional MCP/skill steps. The prompt interface exposes `required(label, fallback, validate)`, where validation returns an error message or `undefined`. The standalone CLI supplies no host callback and writes no frontend configuration. Applications own their additional settings; provider, MCP, and skill setup remain owned by this package.
