export * from "../node_modules/pi-mcp-adapter/index.ts";
import { createMcpAdapter as createUpstreamMcpAdapter } from "../node_modules/pi-mcp-adapter/index.ts";
import type { McpAdapterOptions } from "../node_modules/pi-mcp-adapter/types.ts";

export function createMcpAdapter(options: McpAdapterOptions = {}) {
  if (!options.config) return createUpstreamMcpAdapter(options);
  return createUpstreamMcpAdapter({
    ...options,
    config: {
      ...options.config,
      settings: { scriptMode: false, ...options.config.settings },
    },
  });
}
