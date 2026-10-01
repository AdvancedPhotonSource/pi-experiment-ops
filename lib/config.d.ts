export interface ConfigPrompts {
  required(label: string, fallback?: string, validate?: (value: string) => string | undefined): Promise<string>;
}
export interface ConfigOptions {
  commandName?: string;
  initializeWorkspace?: (workspace: string) => string;
  configureHost?: (workspace: string, prompts: ConfigPrompts) => Promise<void>;
}
export function configure(workspace: string, args: string[], options?: ConfigOptions): Promise<void>;
