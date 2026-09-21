import permissionSystem from 'pi-permission-system';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

type PermissionRuntime = {
  getYoloMode(): boolean;
  setYoloMode(enabled: boolean, options?: { persist?: boolean; source?: string }): { yoloMode: boolean; changed: boolean; persisted: boolean; error?: string };
};

type PermissionGlobals = typeof globalThis & {
  __piPermissionSystem?: PermissionRuntime;
  __piExperimentOpsPermissions?: PermissionRuntime;
};

function upstreamRuntime(): PermissionRuntime | undefined {
  return (globalThis as typeof globalThis & { __piPermissionSystem?: PermissionRuntime }).__piPermissionSystem;
}

export default async function (pi: ExtensionAPI) {
  await permissionSystem(pi);
  let sessionOverride: boolean | undefined;
  const service: PermissionRuntime = {
    getYoloMode: () => sessionOverride ?? upstreamRuntime()?.getYoloMode() ?? false,
    setYoloMode: (enabled, options = {}) => {
      if (options.persist === false) sessionOverride = enabled;
      else sessionOverride = undefined;
      return upstreamRuntime()?.setYoloMode(enabled, options) ?? { yoloMode: false, changed: false, persisted: false, error: 'Permission system is unavailable.' };
    },
  };
  (globalThis as PermissionGlobals).__piExperimentOpsPermissions = service;
  pi.on('session_start', () => { sessionOverride = undefined; });
  // pi-permission-system 0.8 reloads its file config before each turn. Reapply
  // the process-local choice after that refresh so session-only mode remains session-only.
  pi.on('before_agent_start', () => {
    if (sessionOverride !== undefined) upstreamRuntime()?.setYoloMode(sessionOverride, { persist: false, source: 'pi-experiment-ops-session' });
  });
  pi.on('session_shutdown', () => {
    const globals = globalThis as PermissionGlobals;
    if (globals.__piExperimentOpsPermissions === service) delete globals.__piExperimentOpsPermissions;
  });
  pi.registerCommand('permissions', {
    description: 'Show or change tool approvals for this session: /permissions ask|auto|status',
    handler: async (args, ctx) => {
      const action = args.trim().toLowerCase() || 'status';
      if (!['ask', 'auto', 'status'].includes(action)) {
        ctx.ui.notify('Use /permissions ask, /permissions auto, or /permissions status.', 'warning');
        return;
      }
      if (action === 'status') {
        ctx.ui.notify(`Tool approvals: ${service.getYoloMode() ? 'auto-allow for this session' : 'ask for each unmatched call'}.`, 'info');
        return;
      }
      const result = service.setYoloMode(action === 'auto', { persist: false, source: 'pi-experiment-ops-command' });
      ctx.ui.notify(result.error ?? `Tool approvals: ${result.yoloMode ? 'auto-allow for this session' : 'ask for each unmatched call'}.`, result.error ? 'error' : 'info');
    },
  });
}
