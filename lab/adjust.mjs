#!/usr/bin/env node
// Nudge per-adversary balance knobs from the latest adversary matrix (lab/out/adversaries.json is printed by `lab:adversaries`;
// pass its rows as a log file). Too hard (standard < lo) -> goalNeed +, energy -; too flat (random >= flat and standard >= hi) -> power +, energy +.
//   node lab/adjust.mjs <adversaries.log> [--lo 65] [--hi 90] [--flat 85] [--apply]
import { readFileSync, writeFileSync } from 'node:fs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const LO = +arg('lo', 65), HI = +arg('hi', 90), FLAT = +arg('flat', 85);
const rows = readFileSync(process.argv[2], 'utf8').split('\n').filter(l => /^[GCX]\d{4}/.test(l)).map(l => { const m = l.match(/^(\S+)\s+(.*?)\s+T(\d)\s+(\w+)\s+(\d+)%\s+(\d+)%\s+(\d+)%/); return m && { id: m[1], t: +m[3], r: +m[5], s: +m[6] }; }).filter(Boolean);
const bal = JSON.parse(readFileSync('scripts/balance.json', 'utf8')); bal.adversaryMeta ||= {};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
for (const x of rows) {
  const k = (bal.adversaryMeta[x.id] ||= {}).balance ||= {}; const g = n => k[n] || 0;
  if (x.s < LO) { const d = x.s < 35 ? 3 : x.s < 50 ? 2 : 1; k.goalNeed = clamp(g('goalNeed') + d, -4, 10); if (x.s < 35) k.energy = clamp(g('energy') - 1, -2, 2); console.log('easier', x.id, x.s, JSON.stringify(k)); }
  else if (x.s >= HI && x.r >= FLAT) { k.power = clamp(g('power') + 1, -2, 3); k.energy = clamp(g('energy') + 1, -2, 3); console.log('harder', x.id, `${x.r}/${x.s}`, JSON.stringify(k)); }
}
if (process.argv.includes('--apply')) { writeFileSync('scripts/balance.json', JSON.stringify(bal, null, 1) + '\n'); console.log('wrote scripts/balance.json'); }
