import { registerRequiredChildExtensions } from "pi-subagents/required-child-extensions";
import { fileURLToPath } from "node:url";
import { createReadTool, createBashTool, createEditTool, createWriteTool, createGrepTool, createFindTool, createLsTool, type ExtensionAPI } from '@earendil-works/pi-coding-agent';
export default function (pi: ExtensionAPI) {
  let registration: { dispose(): void } | undefined;
  pi.on('session_start', (_event, ctx) => {
    registration?.dispose();
    registration = registerRequiredChildExtensions({ sessionId: ctx.sessionManager.getSessionId(), extensions: [{ id: 'experiment-ops-policy', path: fileURLToPath(import.meta.url) }] });
  });
  pi.on('session_shutdown', () => registration?.dispose());
  for (const factory of [createReadTool, createBashTool, createEditTool, createWriteTool, createGrepTool, createFindTool, createLsTool]) {
    pi.registerTool({ ...factory(process.cwd()), executionMode: 'sequential' } as any);
  }
}
