import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { startSleepMcp } from './fixtures/sleep-mcp.mjs';

const root = resolve(process.env.PI_OPS_PACKAGE_ROOT || new URL('..', import.meta.url).pathname);
const ops = await import(join(root, 'lib/index.mjs'));

test('CodeMode releases the Pi agent loop during an ordinary 60-second MCP call', { timeout: 120_000 }, async t => {
  const workspace = mkdtempSync(join(tmpdir(), 'pi-ops-codemode-'));
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
  const mcp = await startSleepMcp();
  t.after(() => mcp.close());
  writeFileSync(join(workspace, '.pi/mcp.json'), JSON.stringify({ mcpServers: { sleeper: { url: mcp.url, lifecycle: 'eager', directTools: true, requestTimeoutMs: 90_000 } } }));
  writeFileSync(join(workspace, 'independent.txt'), 'Independent work completed while MCP sleeps.');

  // Deterministic model responses drive the real Pi loop and real registered tools.
  const requests = [];
  let cellId;
  const provider = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks));
    requests.push({ body, at: Date.now() });
    const index = requests.length;
    const lastTool = [...body.messages].reverse().find(message => message.role === 'tool');
    let call;
    if (index === 1) call = { name: 'codemode_execute', args: { script: 'return await tools.sleeper_sleep({});', wait: false } };
    if (index === 2) {
      cellId = JSON.parse(lastTool.content).sessionId;
      await mcp.started;
      call = { name: 'read', args: { path: 'independent.txt' } };
    }
    if (index === 3 || index === 5) call = { name: 'codemode_result', args: { sessionId: cellId } };
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const send = (delta, finish_reason = null) => res.write('data: ' + JSON.stringify({ id: `fixture-${index}`, object: 'chat.completion.chunk', model: 'fixture', choices: [{ index: 0, delta, finish_reason }] }) + '\n\n');
    send({ role: 'assistant', content: '' });
    if (call) {
      send({ tool_calls: [{ index: 0, id: `call_${index}`, type: 'function', function: { name: call.name, arguments: JSON.stringify(call.args) } }] });
      send({}, 'tool_calls');
    } else { send({ content: index === 4 ? 'Independent work done; sleep remains in the background.' : 'Sleep result retrieved.' }); send({}, 'stop'); }
    res.end('data: [DONE]\n\n');
  });
  await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve));
  t.after(async () => { provider.closeAllConnections(); await new Promise(resolve => provider.close(resolve)); });
  const agentDir = ops.workspacePaths(workspace).agentDirectory;
  writeFileSync(join(agentDir, 'models.json'), JSON.stringify({ providers: { 'local-test': { baseUrl: `http://127.0.0.1:${provider.address().port}/v1`, api: 'openai-completions', apiKey: 'fixture', models: [{ id: 'fixture', input: ['text'], reasoning: false, contextWindow: 128000, maxTokens: 4096, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }] } } }));
  const { DefaultResourceLoader, SettingsManager, ModelRuntime, SessionManager, createAgentSession, initTheme } = await import(join(root, 'lib/sdk.mjs'));
  initTheme("dark", false);
  const settingsManager = SettingsManager.create(workspace, agentDir);
  const paths = ops.resources();
  const resourceLoader = new DefaultResourceLoader({ cwd: workspace, agentDir, settingsManager, noExtensions: true, noSkills: true, noContextFiles: true, noPromptTemplates: true, noThemes: true, additionalExtensionPaths: paths.extensions, additionalSkillPaths: paths.skills });
  await resourceLoader.reload();
  assert.deepEqual(resourceLoader.getExtensions().errors, []);
  const modelRuntime = await ModelRuntime.create({ authPath: join(agentDir, 'auth.json'), modelsPath: join(agentDir, 'models.json'), allowModelNetwork: false });
  const { session } = await createAgentSession({ cwd: workspace, agentDir, resourceLoader, settingsManager, modelRuntime, model: modelRuntime.getModel('local-test', 'fixture'), thinkingLevel: 'off', sessionManager: SessionManager.create(workspace) });
  t.after(async () => { await session.extensionRunner.emit({ type: 'session_shutdown' }); session.dispose(); });
  const errors = [];
  await session.bindExtensions({ mode: 'rpc', onError: error => errors.push(error) });
  session.agent.toolExecution = 'sequential';
  assert.ok(session.getActiveToolNames().includes('codemode_execute'));
  assert.ok(session.getActiveToolNames().includes('sleeper_sleep'));
  assert.deepEqual(errors, []);
  const events = [];
  session.subscribe(event => { if (event.type === 'tool_execution_end') events.push({ ...event, at: Date.now() }); });
  const launchedAt = Date.now();
  await session.prompt('Start the sleep in CodeMode, do independent work, and check that it remains pending.');
  const releasedAt = Date.now();
  assert.ok(releasedAt - launchedAt < 20_000, 'The main agent should finish independent work well before the sleep');
  const execute = events.find(event => event.toolName === 'codemode_execute');
  assert.equal(JSON.parse(execute.result.content[0].text).result, 'pending', JSON.stringify(execute));
  assert.equal(JSON.parse(events.find(event => event.toolName === 'codemode_result').result.content[0].text).result, 'pending');
  const read = events.find(event => event.toolName === 'read');
  assert.match(read.result.content[0].text, /Independent work completed/);
  assert.equal(session.isStreaming, false);
  assert.equal(requests.length, 4, 'Pi must reach subsequent model calls while the cell runs');
  await mcp.started;
  assert.equal(mcp.calls[0].finishedAt, undefined);
  t.diagnostic(`Pi completed four model requests and an independent read in ${releasedAt - launchedAt} ms; MCP sleep is still running.`);

  const completed = await mcp.finished;
  assert.ok(completed.finishedAt - completed.startedAt >= 60_000);
  assert.ok(read.at < completed.finishedAt);
  await delay(200); // Allow the completed MCP response to reach the worker.
  await session.prompt('Retrieve the completed CodeMode result.');
  const result = JSON.parse(events.filter(event => event.toolName === 'codemode_result').at(-1).result.content[0].text);
  assert.equal(result.result, 'success', JSON.stringify(result));
  assert.match(JSON.stringify(result.data), /completed/);
  assert.equal(mcp.calls.length, 1, 'Result retrieval must not repeat the MCP operation');
  assert.deepEqual(errors, []);
  t.diagnostic(`MCP completed after ${completed.finishedAt - completed.startedAt} ms; codemode_result returned success without rerunning it.`);
});
