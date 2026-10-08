// Local API emulator: runs the real handlers behind a Node HTTP server (no Docker, no AWS account).
//   - default: in-memory store (resets on restart)
//   - DYNAMODB_ENDPOINT=http://localhost:4566 TABLE_NAME=adversary: use a DynamoDB-compatible emulator (Floci / DynamoDB Local)
import { createApi } from './app.mjs';
import { MemoryStore, dynamoFromEnv } from './lib/store.mjs';

let api;
async function get() { return (api ||= createApi(process.env.DYNAMODB_ENDPOINT ? await dynamoFromEnv() : new MemoryStore())); }
const READ = new Set(['GET']);

export async function handle(req, res, url) {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks).toString('utf8');
  const event = {
    version: '2.0', rawPath: url.pathname.replace(/^\/api/, ''), rawQueryString: url.search.slice(1),
    queryStringParameters: Object.fromEntries(url.searchParams), headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), String(v)])),
    requestContext: { http: { method: req.method } }, body, isBase64Encoded: false
  };
  const a = await get();
  const out = await (READ.has(req.method) ? a.read(event) : a.write(event));
  res.writeHead(out.statusCode, out.headers); res.end(out.body);
}
