import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve(process.env.PI_OPS_PACKAGE_ROOT || new URL('..', import.meta.url).pathname);
const ops = await import(join(root, 'lib/index.mjs'));

test('permission system asks once, remembers the tool approval, and supports session auto-allow', async t => {
  const workspace = mkdtempSync(join(tmpdir(), 'pi-ops-permissions-'));
  const previousCwd = process.cwd();
  const previousEnv = { ...process.env };
  t.after(() => {
    process.chdir(previousCwd);
    for (const key of Object.keys(process.env)) if (!(key in previousEnv)) delete process.env[key];
    Object.assign(process.env, previousEnv);
    rmSync(workspace, { recursive: true, force: true });
  });
  ops.initialize(workspace);
  ops.configureEnvironment(workspace);
  process.chdir(workspace);
  writeFileSync(join(workspace, 'sample.txt'), 'permission fixture');
  const agentDir = ops.workspacePaths(workspace).agentDirectory;
  writeFileSync(join(agentDir, 'models.json'), JSON.stringify({ providers: { fixture: { baseUrl: 'http://127.0.0.1:1/v1', api: 'openai-completions', apiKey: 'fixture', models: [{ id: 'fixture', input: ['text'], reasoning: false, contextWindow: 128000, maxTokens: 4096, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }] } } }));

  const { DefaultResourceLoader, SettingsManager, ModelRuntime, SessionManager, createAgentSession, initTheme } = await import(join(root, 'lib/sdk.mjs'));
  initTheme('dark', false);
  const settingsManager = SettingsManager.create(workspace, agentDir);
  const permissionExtension = ops.resources().extensions.find(path => path.endsWith('/extensions/permissions.ts'));
  assert.ok(permissionExtension);
  const resourceLoader = new DefaultResourceLoader({ cwd: workspace, agentDir, settingsManager, noExtensions: true, noSkills: true, noContextFiles: true, noPromptTemplates: true, noThemes: true, additionalExtensionPaths: [permissionExtension] });
  await resourceLoader.reload();
  assert.deepEqual(resourceLoader.getExtensions().errors, []);
  const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, 'auth.json'), modelsPath: join(agentDir, 'models.json'), allowModelNetwork: false });
  const { session } = await createAgentSession({ cwd: workspace, agentDir, resourceLoader, settingsManager, modelRuntime, model: modelRuntime.getModel('fixture', 'fixture'), thinkingLevel: 'off', sessionManager: SessionManager.create(workspace) });
  t.after(async () => { await session.extensionRunner.emit({ type: 'session_shutdown' }); session.dispose(); });
  const prompts = [];
  const errors = [];
  const ui = session.extensionRunner.createContext().ui;
  await session.bindExtensions({ mode: 'rpc', uiContext: { ...ui, notify: () => {}, select: async (title, options) => { prompts.push({ title, options }); return options[1]; }, input: async () => undefined }, onError: error => errors.push(error) });
  assert.deepEqual(errors, []);

  const call = id => session.extensionRunner.emitToolCall({ type: 'tool_call', toolName: 'read', toolCallId: id, input: { path: 'sample.txt' } });
  assert.notEqual((await call('permission-1'))?.block, true);
  assert.deepEqual(prompts[0].options.slice(0, 3), ['Allow Once', 'Allow Always', 'Reject']);
  assert.notEqual((await call('permission-2'))?.block, true);
  assert.equal(prompts.length, 1, 'Allow Always should approve the same tool pattern for this session');

  const api = globalThis.__piExperimentOpsPermissions;
  assert.equal(api.getYoloMode(), false);
  assert.deepEqual(api.setYoloMode(true, { persist: false, source: 'test' }), { yoloMode: true, changed: true, persisted: false });
  await session.extensionRunner.emitBeforeAgentStart('test', undefined, 'test', {});
  assert.equal(api.getYoloMode(), true, 'Session auto-allow should survive the extension config refresh before each turn');
  assert.equal(JSON.parse(readFileSync(join(agentDir, 'permission-system.json'))).yoloMode, false, 'Session auto-allow must not persist');
  assert.notEqual((await session.extensionRunner.emitToolCall({ type: 'tool_call', toolName: 'write', toolCallId: 'permission-3', input: { path: 'other.txt', content: 'ok' } }))?.block, true);
  assert.equal(prompts.length, 1);
});
