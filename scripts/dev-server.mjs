#!/usr/bin/env node
// Static dev server for dist/web (+ optional local API emulator mounted at /api).
//   node scripts/dev-server.mjs [--port 5173] [--no-build]
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWeb } from './build-web.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist/web');
const port = +(process.argv[process.argv.indexOf('--port') + 1] || process.env.PORT || 5173);
if (!process.argv.includes('--no-build')) await buildWeb();
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.map': 'application/json', '.md': 'text/markdown', '.txt': 'text/plain' };
let api = null;
try { api = (await import('../api/local.mjs')).handle; } catch { /* API emulator optional */ }

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/') && api) return api(req, res, url);
  let p = path.join(dist, decodeURIComponent(url.pathname));
  if (!p.startsWith(dist)) { res.writeHead(403); return res.end(); }
  if (!existsSync(p) || statSync(p).isDirectory()) p = path.join(dist, 'index.html');
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream', 'cache-control': p.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' });
  res.end(readFileSync(p));
}).listen(port, () => console.log(`ADVERSARY dev server: http://localhost:${port}  ${api ? '(with local API)' : '(static only)'}`));
