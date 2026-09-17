import { existsSync, readFileSync, writeFileSync, renameSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { initialize } from './index.mjs';
const read = path => existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
function save(path, value) {
  const text = JSON.stringify(value, null, 2) + '\n';
  if (existsSync(path) && readFileSync(path, 'utf8') === text) return;
  if (existsSync(path)) { writeFileSync(path + '.bak', readFileSync(path), { mode: 0o600 }); chmodSync(path + '.bak', 0o600); }
  writeFileSync(path + '.tmp', text, { mode: 0o600 });
  chmodSync(path + '.tmp', 0o600);
  renameSync(path + '.tmp', path);
}
export function configureProvider(workspace, options) {
  const argo = options.preset === 'argo';
  if (!argo && options.preset !== 'openai') throw Error('Preset must be argo or openai');
  const name = argo ? 'argo' : options.provider || 'inference';
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw Error('Invalid provider name');
  if (!options.model?.trim()) throw Error('--model is required; choose a model supported by your endpoint');
  const baseUrl = (options.baseUrl || (argo ? 'https://apps.inside.anl.gov/argoapi/v1' : '')).replace(/\/$/, '');
  const url = new URL(baseUrl);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw Error('Use HTTPS for remote endpoints (HTTP is allowed on loopback)');
  if (url.username || url.password || url.search || url.hash) throw Error('Base URL must not contain credentials, query, or fragment');
  if (argo && !/^[a-zA-Z0-9._-]+$/.test(options.user || '')) throw Error('--argo-user requires your Argonne username');
  if (options.apiKeyEnv && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(options.apiKeyEnv)) throw Error('Invalid API-key environment variable name');
  const contextWindow = Number(options.contextWindow || 128000), maxTokens = Number(options.maxTokens || 4096);
  if (![contextWindow, maxTokens].every(n => Number.isSafeInteger(n) && n > 0) || maxTokens > contextWindow) throw Error('Invalid context/output token limits');
  initialize(workspace);
  const directory = join(workspace, '.pi-experiment-ops/agent');
  const path = join(directory, 'models.json');
  const config = read(path), previous = config.providers?.[name] || {};
  const existing = previous.models || [];
  const model = { ...existing.find(item => item.id === options.model), id: options.model, name: options.model, reasoning: false, input: ['text'], contextWindow, maxTokens };
  if (argo) model.samplingParams = { ...model.samplingParams, user: options.user };
  config.providers = { ...config.providers, [name]: {
    ...previous, baseUrl, api: 'openai-completions',
    apiKey: argo ? options.user : options.apiKeyEnv ? '$' + options.apiKeyEnv : 'keyless-endpoint',
    compat: { ...previous.compat, supportsDeveloperRole: false, supportsReasoningEffort: false, supportsStore: false },
    models: [...existing.filter(item => item.id !== options.model), model],
  } };
  save(path, config);
  const settings = join(directory, 'settings.json');
  save(settings, { ...read(settings), defaultProvider: name, defaultModel: options.model });
  const workflow = join(workspace, 'workflows/toy/steps.yaml');
  const yaml = readFileSync(workflow, 'utf8');
  if (/^model: local-test\/toy$/m.test(yaml)) writeFileSync(workflow, yaml.replace(/^model: local-test\/toy$/m, `model: ${JSON.stringify(name + '/' + options.model)}`));
  return { provider: name, model: options.model, baseUrl };
}
