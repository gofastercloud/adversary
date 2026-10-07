#!/usr/bin/env node
// Builds content/packs/<id>.json from scripts/packs/<id>.mjs (systems, ttx, etc.) + the JSON header for that pack.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const only = process.argv.slice(2);
for (const f of readdirSync(path.join(root, 'scripts/packs')).filter(f => f.endsWith('.mjs'))) {
  const id = f.replace('.mjs', ''); if (only.length && !only.includes(id)) continue;
  const mod = await import(pathToFileURL(path.join(root, 'scripts/packs', f)).href);
  const target = path.join(root, 'content/packs', id + '.json');
  const base = existsSync(target) ? JSON.parse(readFileSync(target, 'utf8')) : mod.base;
  if (!base) throw new Error(`no base for ${id}`);
  const out = { ...base, ...(mod.header || {}), systems: mod.systems || base.systems || [], ttx: mod.ttx || base.ttx || [], ...(mod.overrides ? { cardOverrides: mod.overrides } : {}), ...(mod.cards ? { cards: mod.cards } : {}), ...(mod.relics ? { relics: mod.relics } : {}) };
  writeFileSync(target, JSON.stringify(out, null, 1) + '\n');
  console.log('wrote', id, 'systems', out.systems.length, 'ttx', out.ttx.length);
}
