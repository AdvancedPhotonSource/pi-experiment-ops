import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'));
const entries = JSON.parse(readFileSync(join(packageRoot, 'lib/resources.json'), 'utf8'));
export function resources(replacements = {}) {
  for (const key of Object.keys(replacements)) if (!(key in entries)) throw new Error(`Unknown extension: ${key}`);
  return {
    extensions: Object.entries(entries).map(([key, path]) => replacements[key] ?? join(packageRoot, path)),
    skills: manifest.pi.skills.map(path => join(packageRoot, path)),
  };
}
export const piCli = join(dirname(fileURLToPath(import.meta.resolve('@earendil-works/pi-coding-agent'))), 'bundle/cli.js');
export const piwCli = join(packageRoot, 'node_modules/@ali-abassi/piw/bin/piw');
export const pythonPath = join(packageRoot, '.runtime/python/bin/python');
export function workspacePaths(workspace) {
  const cwd = resolve(workspace);
  const dataDirectory = join(cwd, '.pi-experiment-ops');
  const agentDirectory = join(dataDirectory, 'agent');
  const encoded = `--${cwd.replace(/^[/\\]/, '').replace(/[/\\:]/g, '-')}--`;
  return { dataDirectory, agentDirectory, sessionDirectory: join(agentDirectory, 'sessions', encoded) };
}
export function initialize(workspace, agentDirectory = workspacePaths(workspace).agentDirectory) {
  mkdirSync(workspace, { recursive: true });
  workspace = realpathSync(workspace);
  mkdirSync(agentDirectory, { recursive: true, mode: 0o700 });
  mkdirSync(join(workspace, '.pi/agents'), { recursive: true });
  const initial = {
    [join(agentDirectory, 'settings.json')]: { offline: true, packages: [], theme: 'dark' },
    [join(agentDirectory, 'modes.config.json')]: { defaultMode: 'build', modes: { plan: { allowWriteTools: false, bash: 'deny', blockUnknownTools: true, allowTools: [], thinkingLevel: null } } },
    [join(agentDirectory, 'interactive-shell.json')]: { minQueryIntervalSeconds: 5 },
    [join(agentDirectory, 'permission-system.json')]: { enabled: true, debug: false, yoloMode: false, forwardedPromptTimeoutSeconds: 30 },
    [join(agentDirectory, 'pi-permissions.jsonc')]: { defaultPolicy: { tools: 'ask', bash: 'ask', mcp: 'ask', skills: 'ask', special: 'ask' } },
    [join(workspace, '.pi/mcp.json')]: { mcpServers: {}, settings: { scriptMode: false } },
  };
  for (const [path, value] of Object.entries(initial)) if (!existsSync(path)) writeFileSync(path, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  const reviewer = join(workspace, '.pi/agents/reviewer.md');
  if (!existsSync(reviewer)) writeFileSync(reviewer, '---\nname: reviewer\ndescription: A reader-only toy reviewer\ntools: read,grep,find,ls\n---\nReview the supplied task concisely. Do not modify files.\n');
  const example = join(workspace, 'workflows/toy');
  if (!existsSync(example)) cpSync(join(packageRoot, 'examples/toy-workflow'), example, { recursive: true });
  return workspace;
}
export function configureEnvironment(workspace, { dataDirectory = workspacePaths(workspace).dataDirectory, agentDirectory = join(dataDirectory, 'agent') } = {}) {
  process.env.PI_CODING_AGENT_DIR = agentDirectory;
  process.env.PI_PERMISSION_SYSTEM_CONFIG_PATH = join(agentDirectory, 'permission-system.json');
  process.env.PI_PERMISSION_SYSTEM_LOGS_DIR = join(dataDirectory, 'permission-logs');
  process.env.PI_OFFLINE = '1';
  process.env.PI_SUBAGENTS_TEMP_ROOT = join(dataDirectory, 'subagents');
  process.env.TMPDIR = join(dataDirectory, 'tmp');
  mkdirSync(process.env.TMPDIR, { recursive: true, mode: 0o700 });
  process.env.PI_GRAPH_HOME = join(dataDirectory, 'graph');
  process.env.PI_GRAPH_STATE_DIR = join(dataDirectory, 'graph/state');
  process.env.PI_GRAPH_ROOTS = join(workspace, 'workflows');
  process.env.PI_GRAPH_PYTHON ??= pythonPath;
  process.env.PATH = [dirname(process.env.PI_GRAPH_PYTHON), join(packageRoot, 'bin'), join(packageRoot, 'node_modules/.bin'), process.env.PATH].join(':');
}
