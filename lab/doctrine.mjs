#!/usr/bin/env node
// Doctrine parity experiment: standard-skill full-run clear rate per doctrine under hero-power / starter variants.
//   node lab/doctrine.mjs [--n 60] [--arms A,B]      (arms defined below; A is the shipped content)
import { Pool } from './pool.mjs';
import * as X from './experiments.mjs';
import { pct } from './stats.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const N = +arg('n', 60), ARMS = arg('arms', 'A,B').split(',');
export const DARMS = {
  A: null,
  B: { doctrines: { responder: { power: { cost: 2 } } } },
  C: { doctrines: { responder: { power: { cost: 2 } }, architect: { power: { fx: [{ op: 'shield', n: 3 }] } }, phoenix: { power: { fx: [{ op: 'heal', n: 3 }] } } } }
};
const pool = new Pool();
try {
  for (const a of ARMS) {
    const runs = await X.skillLadder(pool, { n: N, skills: ['standard'], overrides: DARMS[a] }); const s = X.summariseRuns(runs);
    console.log(`arm ${a}: overall ${pct(s.overall.p)}  ` + s.byDoctrine.map(r => `${r.key} ${pct(r.win.p)}`).join('  '));
  }
} finally { await pool.close(); }
