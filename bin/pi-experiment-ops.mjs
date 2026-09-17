#!/usr/bin/env node
import { configureProvider } from '../lib/provider.mjs';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { initialize, configureEnvironment, resources, piCli, piwCli } from '../lib/index.mjs';
const args = process.argv.slice(2);
const command = args.shift() || 'help';
if (['help', '--help'].includes(command)) {
  console.log('pi-experiment-ops init|doctor|configure|pi|piw [--workspace DIR] [-- upstream arguments]');
} else {
  const separator = args.indexOf('--');
  const index = args.indexOf('--workspace');
  let workspace = process.cwd();
  if (index >= 0 && (separator < 0 || index < separator)) {
    if (!args[index + 1]) throw Error('--workspace requires a directory');
    workspace = args.splice(index, 2)[1];
  }
  workspace = initialize(resolve(workspace));
  configureEnvironment(workspace);
  if (command === 'init') console.log(`Initialized ${workspace}`);
  else if (command === 'configure') {
    const options = {};
    const names = { '--preset': 'preset', '--model': 'model', '--argo-user': 'user', '--base-url': 'baseUrl', '--provider': 'provider', '--api-key-env': 'apiKeyEnv', '--context-window': 'contextWindow', '--max-tokens': 'maxTokens' };
    while (args.length) {
      const flag = args.shift();
      if (!names[flag] || !args.length) throw Error(`Unknown or incomplete configuration option: ${flag}`);
      options[names[flag]] = args.shift();
    }
    console.log(JSON.stringify(configureProvider(workspace, options), null, 2));
  }
  else if (command === 'doctor') {
    const checks = { node: Number(process.versions.node.split('.')[0]) > 22 || (Number(process.versions.node.split('.')[0]) === 22 && Number(process.versions.node.split('.')[1]) >= 19), resources: [...resources().extensions, ...resources().skills].every(existsSync), python: spawnSync(process.env.PI_GRAPH_PYTHON, ['-c', 'import yaml, ruamel.yaml, jsonschema']).status === 0, pi: spawnSync(process.execPath, [piCli, '--version']).status === 0 };
    console.log(JSON.stringify({ workspace, checks }, null, 2));
    process.exitCode = Object.values(checks).every(Boolean) ? 0 : 1;
  } else if (['pi', 'piw'].includes(command)) {
    const forwarded = args[0] === '--' ? args.slice(1) : args;
    const paths = resources();
    const child = command === 'pi' ? spawn(process.execPath, [piCli, '--no-extensions', '--no-skills', '--no-context-files', ...paths.extensions.flatMap(path => ['-e', path]), ...paths.skills.flatMap(path => ['--skill', path]), ...forwarded], { cwd: workspace, stdio: 'inherit' }) : spawn(piwCli, forwarded, { cwd: workspace, stdio: 'inherit' });
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => child.kill(signal));
    child.on('error', error => { console.error(error.message); process.exitCode = 1; });
    child.on('exit', (code, signal) => { process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 143); });
  } else throw Error(`Unknown command: ${command}`);
}
