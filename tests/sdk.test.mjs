import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, existsSync, rmSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const root = resolve(process.env.PI_OPS_PACKAGE_ROOT || new URL('..', import.meta.url).pathname);
const require = createRequire(join(root, 'package.json'));
const ops = await import(pathToFileURL(join(root, 'lib/index.mjs')));
const environment = () => Object.fromEntries(['PI_CODING_AGENT_DIR', 'PI_OPS_PYTHON', 'PI_SUBAGENTS_TEMP_ROOT', 'TMPDIR', 'PATH'].map(key => [key, process.env[key]]));
const before = environment();
const sdk = await import(pathToFileURL(require.resolve('pi-experiment-ops/sdk')));
const nativePath = resolve(dirname(ops.piCli), '../index.js');
const native = await import(pathToFileURL(nativePath));

test('SDK export preserves native API identity and workspace paths match the standalone TUI', () => {
  assert.deepEqual(Object.keys(sdk), Object.keys(native));
  for (const key of Object.keys(native)) assert.equal(sdk[key], native[key], key);
  assert.deepEqual(environment(), before, 'SDK import must not configure the workspace');
  assert.equal(ops.piCli, join(dirname(nativePath), 'bundle/cli.js'));
  const workspace = mkdtempSync(join(tmpdir(), 'pi-ops-sdk-'));
  const previous = process.env.PI_CODING_AGENT_DIR;
  try {
    const paths = ops.workspacePaths(workspace);
    assert.equal(existsSync(paths.dataDirectory), false);
    assert.deepEqual(environment(), before, 'Path resolution must not configure the workspace');
    ops.initialize(workspace);
    process.env.PI_CODING_AGENT_DIR = paths.agentDirectory;
    const session = sdk.SessionManager.create(workspace);
    assert.equal(session.getSessionDir(), paths.sessionDirectory);
  } finally {
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previous;
    rmSync(workspace, { recursive: true, force: true });
  }
});


test('initialization creates editable configuration and skills while preserving user files', t => {
  const workspace = mkdtempSync(join(tmpdir(), 'pi-ops-init-'));
  t.after(() => rmSync(workspace, { recursive: true, force: true }));
  ops.initialize(workspace);
  const { agentDirectory } = ops.workspacePaths(workspace);
  assert.ok(statSync(join(workspace, '.pi/skills')).isDirectory());
  for (const [name, empty] of [['models.json', { providers: {} }], ['auth.json', {}]]) {
    const path = join(agentDirectory, name);
    assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), empty);
    assert.equal(statSync(path).mode & 0o777, 0o600);
  }
  const models = join(agentDirectory, 'models.json');
  const auth = join(agentDirectory, 'auth.json');
  const skill = join(workspace, '.pi/skills/custom.md');
  const contents = ['{"providers":{"fixture":{"models":[{"id":"toy"}]}}}', '{"fixture":{"type":"api_key","key":"test"}}', '---\nname: custom\ndescription: Test skill\n---\nInstructions.\n'];
  const paths = [models, auth, skill];
  paths.forEach((path, index) => writeFileSync(path, contents[index]));
  ops.initialize(workspace);
  assert.deepEqual(paths.map(path => readFileSync(path, 'utf8')), contents);
  rmSync(models);
  ops.initialize(workspace);
  assert.deepEqual(JSON.parse(readFileSync(models, 'utf8')), { providers: {} });
  assert.equal(readFileSync(auth, 'utf8'), contents[1]);
});
