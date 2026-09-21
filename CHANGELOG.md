# Changelog

Notable changes to pi-experiment-ops are documented here.

## [0.4.0] - 2026-09-21

### Added

- Bundle `pi-permission-system` 0.8.0 with ask-by-default policy files for Pi, MCP, bash, skill, and special operations.
- Add `/permissions ask|auto|status` for session-only approval control.

### Changed

- Route direct Pi and MCP tool calls through the shared permission gate while retaining optional MCP adapter approvals.
- Disable MCP adapter script mode by default so CodeMode is the bundled scripted tool-call interface.

### Notes

- Permission policy gates the `codemode_execute` launch. Tool calls inside an accepted CodeMode cell are not prompted separately.

## [0.3.0] - Unreleased

### Added

- Bundle `@ian-pascoe/pi-codemode` 0.7.4 and its skills with the standalone distribution.
- Expose CodeMode through the `codemode` resource replacement key for downstream applications.
- Support non-blocking execution of registered Pi and MCP tools through `codemode_execute`, with later result retrieval through `codemode_result`.
- Add an end-to-end acceptance test covering a 60-second MCP operation running in the background while the Pi agent performs independent work.
- Add a README overview of bundled extensions, downstream APIs, helper commands, installation paths, and other package components.

### Changed

- Advance the package version from 0.2.0 to 0.3.0.
- Extend bundle and standalone-package tests to verify the CodeMode extension, skills, and tools in both source and packed installations.

### CI

- Upload release archives and checksums separately, with up to five attempts and exponential backoff for transient GitHub release failures.

[0.3.0]: https://github.com/AdvancedPhotonSource/pi-experiment-ops/compare/v0.2.0...HEAD
[0.4.0]: https://github.com/AdvancedPhotonSource/pi-experiment-ops/compare/v0.3.0...HEAD
