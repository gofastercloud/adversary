#!/usr/bin/env node
// Fails if any icon name referenced by the UI or by content is missing from web/icons (a missing icon renders as a blank box).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const have = new Set(readdirSync(path.join(root, 'web/icons')).filter(f => f.endsWith('.svg')).map(f => f.slice(0, -4)));
const used = new Map();
const note = (n, where) => { if (!used.has(n)) used.set(n, where); };
const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
for (const f of walk(path.join(root, 'web/js'))) {
  const s = readFileSync(f, 'utf8');
  for (const m of s.matchAll(/<\$\{Icon\}\s+n="([a-z0-9-]+)"/g)) note(m[1], path.relative(root, f));
  for (const m of s.matchAll(/\bicon:\s*'([a-z0-9-]+)'/g)) note(m[1], path.relative(root, f));
  for (const m of s.matchAll(/\bn=\$\{[^}]*?'([a-z0-9-]+)'[^}]*?\}/g)) note(m[1], path.relative(root, f));
  for (const m of s.matchAll(/['"]([a-z0-9]+(?:-[a-z0-9]+)+)['"]\s*[,:\]}]/g)) if (have.has(m[1])) note(m[1], path.relative(root, f));
}
const json = f => JSON.parse(readFileSync(f, 'utf8'));
const scan = (o, f) => { if (Array.isArray(o)) o.forEach(x => scan(x, f)); else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { if (k === 'icon' && typeof v === 'string') note(v, f); else scan(v, f); } };
for (const f of readdirSync(path.join(root, 'content/core'))) scan(json(path.join(root, 'content/core', f)), 'content/core/' + f);
for (const f of readdirSync(path.join(root, 'content/packs'))) scan(json(path.join(root, 'content/packs', f)), 'content/packs/' + f);
const missing = [...used].filter(([n]) => !have.has(n));
if (missing.length) { console.error('Missing icons:\n' + missing.map(([n, w]) => `  ${n}  (first seen in ${w})`).join('\n')); process.exit(1); }
console.log(`icons ok: ${used.size} referenced, ${have.size} available`);
