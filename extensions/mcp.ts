import { createMcpAdapter } from 'pi-mcp-adapter';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
export default function (pi: ExtensionAPI) {
  const path = join(process.cwd(), '.pi/mcp.json');
  const config = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : { mcpServers: {} };
  config.settings = { ...config.settings, hostConfigDiscovery: 'off' };
  for (const server of Object.values(config.mcpServers || {}) as any[]) server.directTools ??= true;
  return createMcpAdapter({ config })(pi);
}
