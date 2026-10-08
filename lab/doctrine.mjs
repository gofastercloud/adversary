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
  D: { doctrines: { responder: { relic: 'r.zero-trust-seed' } } },
  E: { doctrines: { responder: { deck: ['c.protect.spoofing','c.protect.tampering','c.protect.elevation','c.protect.disclosure','c.protect.dos','c.detect.spoofing','c.detect.tampering','c.identify.spoofing','c.identify.dos','c.recover.spoofing','c.respond.spoofing','x.patch'] } } },
  R1: { doctrines: { architect: { relic: 'r.mdr' } } }, R2: { doctrines: { architect: { relic: 'r.golden-image' } } }, R3: { doctrines: { architect: { relic: 'r.board-sponsor' } } },
  H: { doctrines: { architect: { maxResilience: 60 } } },
  T1: { doctrines: { architect: { maxResilience: 60 }, phoenix: { maxResilience: 58 }, governor: { maxResilience: 44 }, responder: { maxResilience: 30 } } },
  C: { doctrines: { responder: { power: { cost: 2 } }, architect: { power: { fx: [{ op: 'shield', n: 3 }] } }, phoenix: { power: { fx: [{ op: 'heal', n: 3 }] } } } }
};
const pool = new Pool();
try {
  for (const a of ARMS) {
    const runs = await X.skillLadder(pool, { n: N, skills: ['standard'], overrides: DARMS[a] }); const s = X.summariseRuns(runs);
    console.log(`arm ${a}: overall ${pct(s.overall.p)}  ` + s.byDoctrine.map(r => `${r.key} ${pct(r.win.p)}`).join('  '));
  }
} finally { await pool.close(); }
