# Upstream provenance

Upstream sources are bundled unchanged with their license notices.

| Component | Pinned baseline | Upstream |
|---|---|---|
| Pi coding agent, agent core, AI and TUI | `0.85.1` | [Pi](https://pi.dev/) |
| MCP adapter | `2.34.0` | [nicobailon/pi-mcp-adapter](https://github.com/nicobailon/pi-mcp-adapter) |
| Subagents | `0.68.0` | [nicobailon/pi-subagents](https://github.com/nicobailon/pi-subagents) |
| Processes | `@aliou/pi-processes@0.12.0` | [aliou/pi-processes](https://github.com/aliou/pi-processes) |
| Interactive shell | `0.15.2` | [nicobailon/pi-interactive-shell](https://github.com/nicobailon/pi-interactive-shell) |
| Agent modes | `0.3.0` | [pi-agent-modes on npm](https://www.npmjs.com/package/pi-agent-modes) |
| pi-graph | `4db15464e2268755aafcb52e32341bd536dc56dd` | [ali-abassi/pi-graph](https://github.com/ali-abassi/pi-graph/tree/4db15464e2268755aafcb52e32341bd536dc56dd) |
| SQLite archive | `4030631e21608f549033b9d291dbf0d76578245a` | [gordonbrander/pi-archive](https://github.com/gordonbrander/pi-archive/tree/4030631e21608f549033b9d291dbf0d76578245a) |

The archive is installed from Gordon Brander's pinned Git source under `@gordonb/pi-archive`. The unscoped npm `pi-archive` is a different implementation. pi-graph is installed from its pinned Git source under its declared package name `@ali-abassi/piw`. npm's shrinkwrap preserves their resolved commit identities.

This package supplies exact Pi host dependencies and bundles community resource packages using Pi's [standard package manifest](https://pi.dev/docs/latest/packages). See also the [graph integration contract](https://github.com/ali-abassi/pi-graph/blob/4db15464e2268755aafcb52e32341bd536dc56dd/docs/integration-contract.md) and [subagent extension API](https://github.com/nicobailon/pi-subagents/blob/main/docs/extension-api.md).

