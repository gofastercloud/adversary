#!/usr/bin/env node
// Design-variant explorer: which rule changes make the game reward skill?
// For each variant (a set of content/tuning overrides) it finds, by bisection, the defender-resilience factor at which a
// `standard` player wins ~80% of benchmark battles, then measures the whole skill ladder at that iso-difficulty. The quantity
// to maximise is the gap between random/novice and standard/expert at equal difficulty.
//   node lab/variants.mjs [--n 12] [--expert 3] [--only a,b]
import { mkdirSync, writeFileSync } from 'node:fs';
import { Pool } from './pool.mjs';
import { getContent } from './sim.mjs';
import { deckAt } from './decks.mjs';
import { appearances } from './tune.mjs';
import { pct } from './stats.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const N = +arg('n', 12), EXP = +arg('expert', 3), TARGET_STD = +arg('target', 0.8);
const DOCS = ['architect', 'hunter', 'phoenix', 'governor', 'responder'];

export const VARIANTS = {
  baseline: {},
  'ward+1': { tuning: { balance: { wardAdd: 1 } } },
  'evict+1': { tuning: { balance: { evictAdd: 1 } } },
  'detect-str+1': { tuning: { balance: { detectStrAdd: 1 } } },
  'detect-n+1': { tuning: { balance: { detectNAdd: 1 } } },
  'heal+1': { tuning: { balance: { healAdd: 1 } } },
  'energy-4': { tuning: { battle: { energy: 4 } } },
  'no-baseline-cards': { tuning: { adversary: { baselineSlots: [0, 0, 0] } } },
  'more-baseline': { tuning: { adversary: { baselineSlots: [10, 8, 6] } } },
  'no-goal-payoffs': { tuning: { adversary: { goalSlots: 0 } } },
  'ward+1,evict+1,detect-str+1': { tuning: { balance: { wardAdd: 1, evictAdd: 1, detectStrAdd: 1 } } },
  'goal-amount': { tuning: { goalMode: 'amount' } },
  'goal-amount+ai': { tuning: { goalMode: 'amount', adversary: { goalAI: true } } },
  'goal-ai': { tuning: { adversary: { goalAI: true } } },
  'goal-ai+kit': { tuning: { adversary: { goalAI: true }, balance: { wardAdd: 1, evictAdd: 1, detectStrAdd: 1 } } },
  'adv-energy+1': { tuning: { adversary: { tiers: { 1: { energy: [4, 4, 5, 5, 5, 6] }, 2: { energy: [5, 5, 6, 6, 6, 7] }, 3: { energy: [6, 6, 7, 7, 8, 8] } } } } },
  'adv-power+1': { tuning: { adversary: { tiers: { 1: { powerBonus: 1 }, 2: { powerBonus: 1 }, 3: { powerBonus: 2 } } } } },
  'rounds+2': { tuning: { adversary: { tiers: { 1: { rounds: 9 }, 2: { rounds: 10 }, 3: { rounds: 11 } } } } },
  'rounds-2': { tuning: { adversary: { tiers: { 1: { rounds: 5 }, 2: { rounds: 6 }, 3: { rounds: 7 } } } } },
  'exposure-low': { tuning: { adversary: { tiers: { 1: { exposureMax: 7 }, 2: { exposureMax: 10 }, 3: { exposureMax: 13 } } } } },
  'pressure+kit': { tuning: { balance: { wardAdd: 1, evictAdd: 1, detectStrAdd: 1, healAdd: 1 }, adversary: { tiers: { 1: { energy: [4, 4, 5, 5, 5, 6] }, 2: { energy: [5, 5, 6, 6, 6, 7] }, 3: { energy: [6, 6, 7, 7, 8, 8] } } } } },
  'pressure+kit+exposure': { tuning: { balance: { wardAdd: 1, evictAdd: 1, detectStrAdd: 1, healAdd: 1 }, adversary: { tiers: { 1: { energy: [4, 4, 5, 5, 5, 6], exposureMax: 7 }, 2: { energy: [5, 5, 6, 6, 6, 7], exposureMax: 10 }, 3: { energy: [6, 6, 7, 7, 8, 8], exposureMax: 13 } } } } }
};

export function benchSpecs(apps, overrides, f, { n = N, skill, seedTag = 'v' } = {}) {
  const specs = [];
  apps.forEach((a, ai) => { const c = getContent(a.sc); for (let i = 0; i < n; i++) { const d = DOCS[i % 5]; const sn = deckAt(c, d, a.act, a.node, `${a.sc}|${a.act}|${a.node}|${i}`);
    const res = { cur: Math.max(1, Math.round(sn.res.cur * f)), max: Math.max(1, Math.round(sn.res.max * f)) };
    specs.push({ scenario: a.sc, adv: a.adv, tier: a.tier, boss: a.node === 'boss', elite: a.node === 'elite', skill, doctrine: d, deck: sn.deck, resilience: res, relics: sn.relics, assurance: 1, seed: `${seedTag}|${ai}|${i}`, overrides }); } });
  return specs;
}
const winRate = r => r.filter(x => x.won).length / r.length;

const withGoalOffset = (ov, off, base) => { if (!off) return ov; const o = structuredClone(ov || {}); o.tuning ||= {}; o.tuning.goals ||= {}; for (const g of Object.keys(base.tuning.goals)) o.tuning.goals[g] = { need: base.tuning.goals[g].need.map(n => n + off) }; return o; };

export async function ladderAt(pool, apps, overrides, { std = TARGET_STD, nExp = EXP } = {}) {
  const base = getContent('enterprise');
  // iso-difficulty: raise every goal clock until a standard player wins ~target, then fine-tune with a resilience factor
  let off = 0, w = 0;
  const probe = async (o, f) => winRate(await pool.map('battle', benchSpecs(apps, withGoalOffset(overrides, o, base), f, { skill: 'standard' })));
  for (const cand of [0, 1, 2, 3, 4, 6, 8]) { off = cand; w = await probe(off, 1); if (w >= std - 0.02) break; }
  let lo = 0.4, hi = 3, f = 1;
  if (Math.abs(w - std) > 0.02) for (let it = 0; it < 7; it++) { f = (lo + hi) / 2; w = await probe(off, f); if (Math.abs(w - std) < 0.02) break; if (w < std) lo = f; else hi = f; }
  const ov = withGoalOffset(overrides, off, base);
  const out = { goalOffset: off, factor: +f.toFixed(2), standard: w };
  for (const skill of ['random', 'novice', 'sharp', 'lite']) out[skill] = winRate(await pool.map('battle', benchSpecs(apps, ov, f, { skill })));
  if (nExp) out.expert = winRate(await pool.map('battle', benchSpecs(apps.filter((_, i) => i % 3 === 0), ov, f, { skill: 'expert', n: nExp, seedTag: 'vx' }), { planner: true }));
  out.gapLow = out.standard - out.random; out.gapHigh = (out.expert ?? out.lite) - out.standard;
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pool = new Pool(); mkdirSync('lab/out', { recursive: true });
  const only = arg('only', null)?.split(','); const apps = appearances().filter((_, i) => i % 3 === 1);
  const res = {};
  try {
    for (const [name, ov] of Object.entries(VARIANTS)) {
      if (only && !only.includes(name)) continue;
      const r = await ladderAt(pool, apps, Object.keys(ov).length ? ov : null); res[name] = r;
      console.log(`${name.padEnd(30)} goal+${r.goalOffset} f=${r.factor} random ${pct(r.random)} novice ${pct(r.novice)} standard ${pct(r.standard)} sharp ${pct(r.sharp)} lite ${pct(r.lite)}${r.expert != null ? ' expert ' + pct(r.expert) : ''}  gap(std-rnd) ${(100 * r.gapLow).toFixed(0)}pp`);
    }
    writeFileSync('lab/out/variants.json', JSON.stringify(res));
  } finally { await pool.close(); }
}
