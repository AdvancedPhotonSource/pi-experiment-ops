import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { registerWorkflowResource } from '../node_modules/pi-subagents/src/api/workflow-resources.ts';
import { existsSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

// Workspace modules are trusted code exporting a pi-subagents resource definition.
export default function (pi: ExtensionAPI) {
  let sessionId: string;
  let registrations: { dispose(): void }[] = [];
  const load = async (file: string, name?: string) => {
    const { default: definition } = await import(pathToFileURL(file).href);
    return registerWorkflowResource({ sessionId, definition: { ...definition, ...(name ? { name } : {}) } });
  };
  pi.on('session_start', async (_event, ctx) => {
    registrations.forEach(registration => registration.dispose());
    registrations = [];
    sessionId = ctx.sessionManager.getSessionId();
    const root = join(ctx.cwd, 'workflows');
    if (!existsSync(root)) return;
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      const file = join(root, entry.name, 'workflow.mjs');
      if (entry.isDirectory() && existsSync(file) && statSync(file).isFile() && realpathSync(file).startsWith(realpathSync(root) + '/')) registrations.push(await load(file));
    }
  });
  pi.on('session_shutdown', () => { registrations.forEach(registration => registration.dispose()); registrations = []; });
  // Host adapters use a copied definition for each run; pi-subagents owns execution.
  pi.events.on('pi-ops:workflow', async (request: any) => {
    let registration: { dispose(): void } | undefined;
    try {
      const name = `pi-ops.${randomUUID()}`;
      registration = await load(request.definition, name);
      const requestId = randomUUID();
      const result = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { off(); reject(new Error('Workflow launch timed out')); }, 30000);
        const off = pi.events.on(`subagents:rpc:v1:reply:${requestId}`, (reply: any) => {
          clearTimeout(timer); off();
          if (reply.success) resolve(reply.data); else reject(new Error(reply.error?.message || 'Workflow launch failed'));
        });
        pi.events.emit('subagents:rpc:v1:request', { version: 1, requestId, method: 'spawn', params: { ...request.params, workflow: name } });
      });
      request.reply({ result });
    } catch (error) { request.reply({ error: String(error) }); }
    finally { registration?.dispose(); }
  });
}
