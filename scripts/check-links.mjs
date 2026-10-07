#!/usr/bin/env node
// Link checker for the authoritative references the game ships (content refs, reading lists, dossier sources).
//   node scripts/check-links.mjs [--limit 400] [--concurrency 8]      (needs network; run in CI weekly, not on every push)
// Resolves every `source:id` ref through engine/refs.js, de-duplicates URLs, and requests each (HEAD, falling back to GET).
// Landing-page sources (e.g. soci:, apra:) are checked once per source. 4xx/5xx and timeouts are reported; 403/429 from bot
// protection, 5xx and timeouts are warnings (sites throttle bots); only 404/410 fail the check.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveRef } from '../engine/refs.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] : d; };
const urls = new Map();
const add = (u, where) => { if (/^https?:\/\//.test(u) && !urls.has(u)) urls.set(u, where); };
const visit = (o, where) => {
  if (typeof o === 'string') { if (/^[a-z0-9-]+:[\w.\-/() ]+$/i.test(o)) { const r = resolveRef(o); if (r) add(r.url, where + ' ' + o); } else add(o, where); return; }
  if (Array.isArray(o)) return o.forEach(x => visit(x, where));
  if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (k === 'url' && typeof v === 'string') add(v, where); else visit(v, where); }
};
for (const d of ['content/core', 'content/packs']) for (const f of readdirSync(path.join(root, d))) visit(JSON.parse(readFileSync(path.join(root, d, f), 'utf8')), `${d}/${f}`);
for (const f of readdirSync(path.join(root, 'data/dossiers'))) if (f !== 'index.json') { const j = JSON.parse(readFileSync(path.join(root, 'data/dossiers', f), 'utf8')); for (const s of j.sources || []) add(s.url, 'dossier ' + f); for (const s of j.summaryCites || []) add(s.url, 'dossier ' + f); }
const list = [...urls].slice(0, arg('limit', 400)), conc = arg('concurrency', 8);
const bad = [], warn = []; let done = 0;
async function check([u, where]) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const r = await fetch(u, { method, redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'adversary-link-check/1.0' } });
      if (r.ok) return;
      if (method === 'HEAD' && [403, 404, 405, 501].includes(r.status)) continue;
      (([404, 410].includes(r.status)) ? bad : warn).push(`${r.status} ${u}  (${where})`); return;
    } catch (e) { if (method === 'GET') warn.push(`ERR ${e.name} ${u}  (${where})`); }
  }
}
const q = list.slice();
await Promise.all(Array.from({ length: conc }, async () => { while (q.length) { await check(q.shift()); if (++done % 50 === 0) console.log(`${done}/${list.length}`); } }));
console.log(`checked ${list.length} of ${urls.size} urls: ${bad.length} broken, ${warn.length} warnings (blocked/5xx/timeouts)`);
for (const l of warn) console.log('warn', l);
for (const l of bad) console.log('FAIL', l);
process.exit(bad.length ? 1 : 0);
