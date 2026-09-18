import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

// The MCP request stays open for the entire sleep; the server has no job API.
export async function startSleepMcp(port = 0) {
  const calls = [];
  const timers = new Set();
  const started = Promise.withResolvers();
  const finished = Promise.withResolvers();
  const server = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.method !== 'POST') return res.writeHead(405).end();
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks));
    if (body.id === undefined) return res.writeHead(202).end();
    let result;
    if (body.method === 'initialize') result = { protocolVersion: body.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'sleep-test', version: '1.0.0' } };
    else if (body.method === 'ping') result = {};
    else if (body.method === 'tools/list') result = { tools: [{ name: 'sleep', description: 'Sleep for exactly 60 seconds, then return. This is a blocking MCP call.', inputSchema: { type: 'object', properties: {} } }] };
    else if (body.method === 'tools/call' && body.params.name === 'sleep') {
      const call = { startedAt: Date.now() };
      calls.push(call);
      started.resolve(call);
      await new Promise(resolve => {
        const timer = setTimeout(() => { timers.delete(timer); resolve(); }, 60_000);
        timers.add(timer);
      });
      call.finishedAt = Date.now();
      result = { content: [{ type: 'text', text: JSON.stringify({ sleptMs: call.finishedAt - call.startedAt, completed: true }) }] };
      res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }));
      finished.resolve(call);
      return;
    } else return res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: -32601, message: 'Method not found' } }));
    res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }));
  });
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve));
  return {
    calls, started: started.promise, finished: finished.promise,
    url: `http://127.0.0.1:${server.address().port}/mcp`,
    async close() {
      for (const timer of timers) clearTimeout(timer);
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mcp = await startSleepMcp(Number(process.argv[2] ?? 8766));
  console.log(mcp.url);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await mcp.close(); });
}
