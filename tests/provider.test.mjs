import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { configureProvider } from '../lib/provider.mjs';
import { initialize, packageRoot } from '../lib/index.mjs';
const read = file => JSON.parse(readFileSync(file, 'utf8'));
test('provider setup merges private configuration and real Pi sends endpoint identity', { timeout: 90000 }, async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'pi-ops-provider-'));
  initialize(workspace);
  const directory = join(workspace, '.pi-experiment-ops/agent');
  const configPath = join(directory, 'models.json');
  writeFileSync(configPath, JSON.stringify({ providers: { previous: { apiKey: 'preserve-me' } } }));
  writeFileSync(join(directory, 'auth.json'), '{"untouched":true}');
  const requests = [];
  const server = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    requests.push({ body: JSON.parse(Buffer.concat(chunks)), authorization: req.headers.authorization });
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    for (const [delta, finish_reason] of [[{ role: 'assistant', content: 'Configured endpoint works.' }, null], [{}, 'stop']]) res.write('data: ' + JSON.stringify({ id: 'fixture', object: 'chat.completion.chunk', model: 'toy', choices: [{ index: 0, delta, finish_reason }] }) + '\n\n');
    res.end('data: [DONE]\n\n');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}/v1`;
  const chat = () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(packageRoot, 'bin/pi-experiment-ops.mjs'), 'pi', '--workspace', workspace, '--', '-p', '--no-approve', 'hello'], { env: { ...process.env, TEST_ENDPOINT_KEY: 'fixture-secret' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = ''; child.stdout.on('data', data => output += data); child.stderr.on('data', data => output += data);
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(Error(output)); }, 45000);
    child.on('error', reject); child.on('exit', code => { clearTimeout(timer); code === 0 ? resolve(output) : reject(Error(output)); });
  });
  try {
    const options = { preset: 'argo', user: 'test-user', model: 'toy', baseUrl };
    configureProvider(workspace, options);
    const first = readFileSync(configPath, 'utf8');
    configureProvider(workspace, options);
    assert.equal(readFileSync(configPath, 'utf8'), first);
    assert.equal(read(configPath).providers.previous.apiKey, 'preserve-me');
    assert.equal(read(configPath + '.bak').providers.previous.apiKey, 'preserve-me');
    assert.equal(read(join(directory, 'auth.json')).untouched, true);
    assert.equal(statSync(configPath).mode & 0o777, 0o600);
    assert.equal(read(join(directory, 'settings.json')).defaultProvider, 'argo');
    assert.match(readFileSync(join(workspace, 'workflows/toy/steps.yaml'), 'utf8'), /model: "argo\/toy"/);
    assert.match(await chat(), /Configured endpoint works/);
    assert.equal(requests[0].body.user, 'test-user');
    assert.equal(requests[0].authorization, 'Bearer test-user');
    configureProvider(workspace, { preset: 'openai', provider: 'custom', model: 'toy', baseUrl, apiKeyEnv: 'TEST_ENDPOINT_KEY' });
    assert.match(await chat(), /Configured endpoint works/);
    assert.equal(requests[1].authorization, 'Bearer fixture-secret');
    assert.equal(read(configPath).providers.custom.apiKey, '$TEST_ENDPOINT_KEY');
    assert.doesNotMatch(readFileSync(configPath, 'utf8'), /fixture-secret/);
    for (const invalid of [{ user: '!command' }, { baseUrl: 'http://remote.example/v1' }, { model: '' }, { maxTokens: -1 }]) assert.throws(() => configureProvider(workspace, { ...options, ...invalid }));
    assert.equal(existsSync(join(workspace, '.pi/agent/models.json')), false);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
