import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const root = resolve(process.env.PI_OPS_PACKAGE_ROOT || new URL('..', import.meta.url).pathname);
const require = createRequire(join(root, 'package.json'));
const ops = await import(pathToFileURL(join(root, 'lib/index.mjs')));
const environment = () => Object.fromEntries(['PI_CODING_AGENT_DIR', 'PI_GRAPH_HOME', 'PI_GRAPH_STATE_DIR', 'PI_GRAPH_ROOTS', 'PI_GRAPH_PYTHON', 'PI_SUBAGENTS_TEMP_ROOT', 'TMPDIR', 'PATH'].map(key => [key, process.env[key]]));
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
