export const packageRoot: string;
export const piCli: string;
export const piwCli: string;
export const pythonPath: string;
export type ExtensionName = 'policy' | 'mcp' | 'terminal' | 'subagents' | 'processes' | 'modes' | 'archive' | 'graph' | 'codemode' | 'permissions';
export function resources(replacements?: Partial<Record<ExtensionName, string>>): { extensions: string[]; skills: string[] };
export function initialize(workspace: string, agentDirectory?: string): string;
export function configureEnvironment(workspace: string, options?: { dataDirectory?: string; agentDirectory?: string }): void;
export function workspacePaths(workspace: string): {
  dataDirectory: string;
  agentDirectory: string;
  sessionDirectory: string;
};
