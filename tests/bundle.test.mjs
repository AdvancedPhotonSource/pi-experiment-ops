import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
const root = resolve(process.env.PI_OPS_PACKAGE_ROOT || new URL('..', import.meta.url).pathname);
const ops = await import(join(root, 'lib/index.mjs'));
const run = (args, workspace) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [join(root, 'bin/pi-experiment-ops.mjs'), ...args], { cwd: workspace, env: { ...process.env, PATH: process.env.PATH.split(':').filter(path => !path.includes('node_modules/.bin')).join(':') }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  const timeout = setTimeout(() => { child.kill('SIGKILL'); reject(Error('Timed out: ' + err)); }, 90000);
  child.stdout.on('data', chunk => out += chunk);
  child.stderr.on('data', chunk => err += chunk);
  child.on('error', error => { clearTimeout(timeout); reject(error); });
  child.on('exit', code => { clearTimeout(timeout); resolve({ code, out, err }); });
});
test('isolated bundle resources, real Pi chat and real subagent workflows', { timeout: 180000 }, async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'pi-ops-test-'));
  ops.initialize(workspace);
  const skillDir = join(workspace, '.pi/skills/workspace-check');
  mkdirSync(skillDir);
  writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: workspace-check\ndescription: Check the workspace skill fixture\n---\nWORKSPACE_SKILL_INSTRUCTIONS\n');
  assert.equal(JSON.parse(readFileSync(join(workspace, '.pi/mcp.json'))).settings.scriptMode, false);
  assert.equal(JSON.parse(readFileSync(join(workspace, '.pi-experiment-ops/agent/permission-system.json'))).yoloMode, false);
  assert.equal(JSON.parse(readFileSync(join(workspace, '.pi-experiment-ops/agent/pi-permissions.jsonc'))).defaultPolicy.tools, 'ask');
  assert.equal(ops.resources().extensions.length, 10);
  assert.equal(new Set(ops.resources({ terminal: '/replacement.ts' }).extensions).size, 10);
  assert.ok(ops.resources({ terminal: '/replacement.ts' }).extensions.includes('/replacement.ts'));
  assert.throws(() => ops.resources({ typo: 'x' }), /Unknown extension/);
  writeFileSync(join(workspace, '.pi-experiment-ops/agent/permission-system.json'), JSON.stringify({ enabled: true, debug: false, yoloMode: true, forwardedPromptTimeoutSeconds: 30 }));
  const settings = join(workspace, '.pi-experiment-ops/agent/settings.json');
  writeFileSync(settings, '{"offline":true,"packages":[],"theme":"light"}');
  ops.initialize(workspace);
  assert.equal(JSON.parse(readFileSync(settings)).theme, 'light');
  writeFileSync(join(workspace, '.pi-experiment-ops/agent/pi-permissions.jsonc'), JSON.stringify({ defaultPolicy: { tools: 'ask', bash: 'ask', mcp: 'ask', skills: 'allow', special: 'ask' } }));
  const requests = [];
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const request = JSON.parse(Buffer.concat(chunks));
    requests.push(request);
    const prompt = JSON.stringify(request.messages);
    const content = prompt.includes('PI_OPS_TOY_GENERATE') ? JSON.stringify({ title: 'Toy', values: [1, 2, 3] }) : prompt.includes('PI_OPS_TOY_REVIEW') ? JSON.stringify({ approved: !prompt.includes('reject-review'), reason: 'Fixture review' }) : 'Standalone Pi bundle works.';
    const user = [...request.messages].reverse().find(message => message.role === 'user');
    const text = typeof user?.content === 'string' ? user.content : (user?.content ?? []).filter(part => part.type === 'text').map(part => part.text).join('\n');
    if (request.tools?.some(tool => tool.function.name === 'structured_output') && /PI_OPS_TOY_(GENERATE|REVIEW)/.test(text) && request.messages.at(-1).role !== 'tool') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const delta = { role: 'assistant', tool_calls: [{ index: 0, id: 'structured-call', type: 'function', function: { name: 'structured_output', arguments: JSON.stringify({ value: JSON.parse(content) }) } }] };
      for (const [part, finish_reason] of [[delta, null], [{}, 'tool_calls']]) res.write('data: ' + JSON.stringify({ id: 'fixture', object: 'chat.completion.chunk', model: 'toy', choices: [{ index: 0, delta: part, finish_reason }] }) + '\n\n');
      res.end('data: [DONE]\n\n');
      return;
    }
    if (text?.startsWith('run-toy ') && request.messages.at(-1).role !== 'tool') {
      const input = text.slice(8);
      const cwd = join(workspace, 'runs', input);
      mkdirSync(cwd, { recursive: true });
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const delta = { role: 'assistant', tool_calls: [{ index: 0, id: 'toy-call', type: 'function', function: { name: 'subagent', arguments: JSON.stringify({ workflow: 'toy', args: { input, outputDirectory: cwd }, cwd, model: 'local-test/toy', async: false, timeoutMs: 60000 }) } }] };
      for (const [part, finish_reason] of [[delta, null], [{}, 'tool_calls']]) res.write('data: ' + JSON.stringify({ id: 'fixture', object: 'chat.completion.chunk', model: 'toy', choices: [{ index: 0, delta: part, finish_reason }] }) + '\n\n');
      res.end('data: [DONE]\n\n');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    for (const [delta, finish_reason] of [[{ role: 'assistant', content }, null], [{}, 'stop']]) res.write('data: ' + JSON.stringify({ id: 'fixture', object: 'chat.completion.chunk', model: 'toy', choices: [{ index: 0, delta, finish_reason }] }) + '\n\n');
    res.end('data: [DONE]\n\n');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const agent = join(workspace, '.pi-experiment-ops/agent');
  writeFileSync(join(agent, 'models.json'), JSON.stringify({ providers: { 'local-test': { baseUrl: `http://127.0.0.1:${server.address().port}/v1`, api: 'openai-completions', apiKey: 'fixture', models: [{ id: 'toy', name: 'Toy', input: ['text'], reasoning: false, contextWindow: 128000, maxTokens: 4096, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } }] } } }));
  try {
    const chat = await run(['pi', '--', '-p', '--no-approve', '--model', 'local-test/toy', 'hello'], workspace);
    assert.equal(chat.code, 0, chat.err);
    assert.match(chat.out, /Standalone Pi bundle works/);
    assert.match(JSON.stringify(requests[0].messages), /Check the workspace skill fixture/);
    const skill = await run(['pi', '--', '-p', '--no-approve', '--model', 'local-test/toy', '/skill:workspace-check'], workspace);
    assert.equal(skill.code, 0, skill.err);
    assert.match(JSON.stringify(requests.at(-1).messages), /WORKSPACE_SKILL_INSTRUCTIONS/);
    assert.doesNotMatch(chat.err, /Failed to load extension|Extension errors|dispose is not a function/i);
    const tools = requests[0].tools.map(tool => tool.function.name);
    for (const name of ['subagent', 'process', 'interactive_shell', 'search_archive', 'codemode_execute', 'codemode_result']) assert.ok(tools.includes(name), `Missing extension tool ${name}`);
    assert.equal(tools.includes('mcpScript'), false);
    assert.ok(!tools.includes('pi_graph'));
    for (const input of ['toy', 'reject-review', 'fail-command']) {
      const result = await run(['pi', '--', '-p', '--no-approve', '--model', 'local-test/toy', 'run-toy ' + input], workspace);
      assert.equal(result.code, 0, result.err + result.out);
      const directory = join(workspace, 'runs', input);
      if (input === 'toy') {
        assert.equal(JSON.parse(readFileSync(join(directory, 'receipt.json'))).count, 1);
        assert.ok(existsSync(join(directory, 'chart.png')));
      } else assert.equal(existsSync(join(directory, 'receipt.json')), false);
    }
    assert.ok(requests.filter(request => JSON.stringify(request.messages).includes('PI_OPS_TOY_GENERATE')).length >= 3);

  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
