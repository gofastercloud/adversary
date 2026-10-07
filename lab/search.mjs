#!/usr/bin/env node
// Random search over rule levers for the variant that best rewards skill at equal difficulty.
// Objective J = (standard - random) + (standard - idle) + 0.5 * (lite - standard), all measured at iso-standard difficulty.
//   node lab/search.mjs [--trials 40] [--n 10]            appends to lab/out/search.jsonl, prints the best
import { appendFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { Pool } from './pool.mjs';
import { getContent } from './sim.mjs';
import { appearances } from './tune.mjs';
import { benchSpecs } from './variants.mjs';
import { makeRng } from './rng.mjs';
import { pct } from './stats.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const TRIALS = +arg('trials', 40), N = +arg('n', 10), SEED = arg('seed', 'search1');
const LEVERS = {
  defEnergy: [3, 4], hand: [5, 6], wardAdd: [0, 1, 2], healAdd: [0, 1], detectN: [0, 1], advEnergy: [0, 1, 2], advPower: [0, 1], rounds: [-1, 0, 1, 2], exposure: [-3, 0, 3], goalAI: [false, true], baseline: [0, 1], goalMode: ['amount', 'amount', 'count']
};
const BASE_ENERGY = { 1: [3, 3, 4, 4, 4, 5], 2: [4, 4, 5, 5, 5, 6], 3: [5, 5, 6, 6, 7, 7] }, BASE_ROUNDS = { 1: 7, 2: 8, 3: 9 }, BASE_EXPO = { 1: 10, 2: 14, 3: 18 }, BASE_POWER = { 1: 0, 2: 0, 3: 1 };
export function overridesFor(v) {
  const tiers = {}; for (const t of [1, 2, 3]) tiers[t] = { energy: BASE_ENERGY[t].map(e => e + v.advEnergy), rounds: BASE_ROUNDS[t] + v.rounds, exposureMax: BASE_EXPO[t] + v.exposure, powerBonus: BASE_POWER[t] + v.advPower };
  return { tuning: { goalMode: v.goalMode, battle: { energy: v.defEnergy, handSize: v.hand }, balance: { wardAdd: v.wardAdd, healAdd: v.healAdd, detectNAdd: v.detectN }, adversary: { tiers, goalAI: v.goalAI, baselineSlots: v.baseline ? [7, 5, 4] : [0, 0, 0] } } };
}
const winRate = r => r.filter(x => x.won).length / r.length;

export async function evalVariant(pool, apps, ov, { lite = true } = {}) {
  const base = getContent('enterprise');
  const goalOv = off => { const o = structuredClone(ov); o.tuning.goals = Object.fromEntries(Object.keys(base.tuning.goals).map(g => [g, { need: base.tuning.goals[g].need.map(n => n + off) }])); return o; };
  const probe = async (off, f, skill = 'standard') => winRate(await pool.map('battle', benchSpecs(apps, goalOv(off), f, { skill, n: N })));
  let off = -3, w = 0; for (const cand of [-3, -2, -1, 0, 1, 2, 3, 4, 6]) { off = cand; w = await probe(off, 1); if (w >= 0.83) break; }
  let lo = 0.4, hi = 3, f = 1; if (Math.abs(w - 0.85) > 0.03) for (let it = 0; it < 6; it++) { f = (lo + hi) / 2; w = await probe(off, f); if (Math.abs(w - 0.85) < 0.03) break; if (w < 0.85) lo = f; else hi = f; }
  const out = { goalOffset: off, factor: +f.toFixed(2), standard: w };
  for (const skill of ['idle', 'random', 'novice']) out[skill] = await probe(off, f, skill);
  if (lite) out.lite = winRate(await pool.map('battle', benchSpecs(apps.filter((_, i) => i % 2 === 0), goalOv(off), f, { skill: 'lite', n: Math.max(4, N >> 1) })));
  out.J = (out.standard - out.random) + (out.standard - out.idle) + 0.5 * ((out.lite ?? out.standard) - out.standard);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync('lab/out', { recursive: true }); const pool = new Pool(); const rng = makeRng(SEED); const apps = appearances().filter((_, i) => i % 3 === 1);
  const key = Object.keys(LEVERS);
  const baseline = { defEnergy: 3, hand: 5, wardAdd: 0, healAdd: 0, detectN: 0, advEnergy: 0, advPower: 0, rounds: 0, exposure: 0, goalAI: false, baseline: 1, goalMode: 'count' };
  const trials = [baseline]; for (let t = 0; t < TRIALS; t++) trials.push(Object.fromEntries(key.map(k => [k, rng.pick(LEVERS[k])])));
  try {
    for (const v of trials) {
      const r = await evalVariant(pool, apps, overridesFor(v)); appendFileSync('lab/out/search.jsonl', JSON.stringify({ v, r }) + '\n');
      console.log(`J=${r.J.toFixed(2)} idle ${pct(r.idle)} rnd ${pct(r.random)} nov ${pct(r.novice)} std ${pct(r.standard)} lite ${pct(r.lite)} goal+${r.goalOffset} f=${r.factor}  ${JSON.stringify(v)}`);
    }
  } finally { await pool.close(); }
}
