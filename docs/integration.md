# Integration contract

The package exports plain JavaScript helpers with TypeScript declarations:

```js
import { initialize, configureEnvironment, workspacePaths, resources, piCli, piwCli } from 'pi-experiment-ops';
const paths = workspacePaths(workspace);
initialize(workspace);
configureEnvironment(workspace);
const resourcePaths = resources({ terminal: '/absolute/path/to/terminal-wrapper.ts' });
```

`resources()` returns absolute `extensions` and `skills` arrays for Pi's `DefaultResourceLoader` or CLI flags. Extension keys are `policy`, `mcp`, `terminal`, `subagents`, `processes`, `modes`, `archive`, and `graph`. Replacements occupy the original entry; no duplicate extension is loaded. Unknown keys fail. Applications should disable automatic extension/skill discovery when using this explicit list.

`initialize` preserves existing files, initializes workspace agent settings, MCP configuration, a reader-only reviewer, and the toy workflow. Its default agent directory is `.pi-experiment-ops/agent`. `configureEnvironment` sets Pi and graph workspace directories and executable paths in the current process; call it before creating Pi sessions or children. Run one workspace per host process. It respects an explicitly supplied `PI_GRAPH_PYTHON`. A bundle-owned `pi` forwarding launcher resolves the installed SDK even when npm hoists it; graph children therefore use the same installed distribution. Applications may prepend an observer launcher while retaining the bundle's executable resolution.

`piCli` is a JavaScript CLI entrypoint (invoke with Node); `piwCli` is an executable shell launcher. `pythonPath` is the installation-owned Python interpreter path; `packageRoot` locates installer/docs resources. No consumer should assume a nested or hoisted node_modules layout.

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
