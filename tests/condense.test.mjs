import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const root = resolve(process.env.PI_OPS_PACKAGE_ROOT || new URL('..', import.meta.url).pathname);
const ops = await import(join(root, 'lib/index.mjs'));

test('image budget initializes existing workspaces and preserves explicit settings', t => {
  const workspace = mkdtempSync(join(tmpdir(), 'pi-ops-image-settings-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  ops.initialize(workspace);
  const path = join(ops.workspacePaths(workspace).agentDirectory, 'settings.json');
  assert.equal(JSON.parse(readFileSync(path)).contextPrune.maxImagesPerRequest, 4);
  for (const contextPrune of [undefined, { enabled: true }, { maxImagesPerRequest: 8 }, { maxImagesPerRequest: null }]) {
    const settings = { theme: 'light', contextPrune };
    writeFileSync(path, JSON.stringify(settings));
    ops.initialize(workspace);
    const expected = contextPrune && Object.hasOwn(contextPrune, 'maxImagesPerRequest') ? contextPrune : { ...contextPrune, maxImagesPerRequest: 4 };
    assert.deepEqual(JSON.parse(readFileSync(path)), { theme: 'light', contextPrune: expected });
    const before = readFileSync(path, 'utf8');
    ops.initialize(workspace);
    assert.equal(readFileSync(path, 'utf8'), before);
  }
});

test('real Pi context hook caps attachments and tool images while preserving resumed history', async t => {
  const workspace = mkdtempSync(join(tmpdir(), 'pi-ops-condense-'));
  const previousEnv = { ...process.env };
  t.after(() => {
    for (const key of Object.keys(process.env)) if (!(key in previousEnv)) delete process.env[key];
    Object.assign(process.env, previousEnv);
    rmSync(workspace, { recursive: true, force: true });
  });
  ops.initialize(workspace);
  ops.configureEnvironment(workspace);
  const agentDir = ops.workspacePaths(workspace).agentDirectory;
  writeFileSync(join(agentDir, 'models.json'), JSON.stringify({ providers: { fixture: { baseUrl: 'http://127.0.0.1:1/v1', api: 'openai-completions', apiKey: 'fixture', models: [{ id: 'fixture', input: ['text', 'image'], reasoning: false, contextWindow: 128000, maxTokens: 4096, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }] } } }));
  const { DefaultResourceLoader, SettingsManager, ModelRuntime, SessionManager, createAgentSession, initTheme } = await import(join(root, 'lib/sdk.mjs'));
  initTheme('dark', false);
  const settingsManager = SettingsManager.create(workspace, agentDir);
  const extension = ops.resources().extensions.find(path => path.endsWith('/pi-condense/index.ts'));
  assert.ok(extension);
  const resourceLoader = new DefaultResourceLoader({ cwd: workspace, agentDir, settingsManager, noExtensions: true, noSkills: true, noContextFiles: true, noPromptTemplates: true, noThemes: true, additionalExtensionPaths: [extension] });
  await resourceLoader.reload();
  assert.deepEqual(resourceLoader.getExtensions().errors, []);
  const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, 'auth.json'), modelsPath: join(agentDir, 'models.json'), allowModelNetwork: false });
  const manager = SessionManager.create(workspace, ops.workspacePaths(workspace).sessionDirectory);
  const image = id => ({ type: 'image', data: Buffer.from(`image-${id}`).toString('base64'), mimeType: 'image/png' });
  const assistant = { role: 'assistant', content: [{ type: 'text', text: 'Observations retained.' }], api: 'openai-completions', provider: 'fixture', model: 'fixture', usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }, stopReason: 'stop', timestamp: 2 };
  const messages = [
    { role: 'user', content: [{ type: 'text', text: 'Original instructions.' }, image(1), image(2)], timestamp: 1 },
    { ...assistant, content: [{ type: 'toolCall', id: 'plot', name: 'plot', arguments: {} }], stopReason: 'toolUse' },
    { role: 'toolResult', toolCallId: 'plot', toolName: 'plot', content: [{ type: 'text', text: 'Measurement results.' }, image(3), image(4)], isError: false, timestamp: 3 },
    { ...assistant, timestamp: 4 },
    { role: 'user', content: [image(5)], timestamp: 5 },
  ];
  for (const message of messages) manager.appendMessage(message);
  const sessionPath = manager.getSessionFile();
  const { session } = await createAgentSession({ cwd: workspace, agentDir, resourceLoader, settingsManager, modelRuntime, model: modelRuntime.getModel('fixture', 'fixture'), thinkingLevel: 'off', sessionManager: SessionManager.open(sessionPath) });
  t.after(async () => { await session.extensionRunner.emit({ type: 'session_shutdown' }); session.dispose(); });
  const errors = [];
  await session.bindExtensions({ mode: 'rpc', onError: error => errors.push(error) });
  const before = readFileSync(sessionPath, 'utf8');
  const images = history => history.flatMap(message => Array.isArray(message.content) ? message.content.filter(block => block.type === 'image') : []);
  const project = history => session.extensionRunner.emitContext(history);
  assert.deepEqual(await project(messages.slice(0, 4)), messages.slice(0, 4), 'Four images remain intact');
  const capped = await project(session.messages);
  assert.deepEqual(images(capped), [image(3), image(4), image(5)]);
  assert.equal(capped[0].content[0].text, 'Original instructions.');
  assert.match(capped[0].content[1].text, /earlier image omitted/);
  assert.equal(capped[2].content[0].text, 'Measurement results.');
  assert.deepEqual(capped[1], messages[1], 'Tool call pairing survives image pruning');
  assert.deepEqual(capped[3], messages[3], 'Assistant observations survive image pruning');
  const six = [...messages, { role: 'user', content: [image(6)], timestamp: 6 }];
  assert.deepEqual(images(await project(six)), [image(3), image(4), image(5), image(6)]);
  assert.deepEqual((await project(six)).slice(0, 4), capped.slice(0, 4), 'The prefix stays stable within a pruning batch');
  const seven = [...six, { role: 'user', content: [image(7)], timestamp: 7 }];
  assert.deepEqual(images(await project(seven)), [image(5), image(6), image(7)]);
  assert.deepEqual(images(session.messages), [1, 2, 3, 4, 5].map(image));
  assert.equal(readFileSync(sessionPath, 'utf8'), before, 'The persisted transcript is unchanged');
  writeFileSync(join(agentDir, 'settings.json'), JSON.stringify({ contextPrune: { maxImagesPerRequest: 8 } }));
  await session.extensionRunner.emit({ type: 'session_start' });
  assert.deepEqual(await project(seven), seven, 'Explicit budgets are honored on reload');
  assert.deepEqual(errors, []);
});
