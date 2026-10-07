#!/usr/bin/env node
// Balance calibrator. Per-adversary knobs (goalNeed, energy, power, exposure) are tuned so each adversary, at each place it
// appears in each pack's roster, is beaten by a "standard" player with a realistic deck at the target rate for that node.
//   node lab/tune.mjs [--n 40] [--scenarios all] [--apply]      (writes lab/out/tune.json; --apply writes scripts/balance.json)
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { Pool } from './pool.mjs';
import { getContent, deepMerge } from './sim.mjs';
import { deckAt } from './decks.mjs';
import { listScenarios } from '../scripts/lib/load.mjs';
import { pct } from './stats.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const N = +arg('n', 40), scenarios = arg('scenarios', 'all') === 'all' ? listScenarios() : arg('scenarios').split(',');
const DOCS = ['architect', 'hunter', 'phoenix', 'governor', 'responder'];
// target win rate for a standard-skill player with a typical deck, by act and node (full-run clear ≈ 15-20%)
export const TARGET = { 1: { battle: 0.96, elite: 0.90, boss: 0.88 }, 2: { battle: 0.93, elite: 0.85, boss: 0.80 }, 3: { battle: 0.90, elite: 0.80, boss: 0.70 } };

/** All (scenario, act, node, adversary, tier) appearances. */
export function appearances(scs = scenarios) {
  const out = [];
  for (const sc of scs) { const c = getContent(sc); c.roster.acts.forEach((a, i) => { const t = a.tiers || { battle: 1, elite: 2, boss: 3 };
    for (const id of a.battle) out.push({ sc, act: i + 1, node: 'battle', adv: id, tier: t.battle }); for (const id of a.elite) out.push({ sc, act: i + 1, node: 'elite', adv: id, tier: t.elite }); out.push({ sc, act: i + 1, node: 'boss', adv: a.boss, tier: t.boss }); }); }
  return out;
}

export async function evaluate(pool, apps, overrides, { n = N, skill = 'standard' } = {}) {
  const specs = [];
  apps.forEach((a, ai) => { const c = getContent(a.sc); for (let i = 0; i < n; i++) { const doctrine = DOCS[i % 5]; const sn = deckAt(c, doctrine, a.act, a.node, `${a.sc}|${a.act}|${a.node}|${i}`);
    specs.push({ scenario: a.sc, adv: a.adv, tier: a.tier, boss: a.node === 'boss', elite: a.node === 'elite', skill, doctrine, deck: sn.deck, resilience: sn.res, relics: sn.relics, assurance: 1, seed: `tune|${ai}|${i}`, overrides, _ai: ai }); } });
  const out = await pool.map('battle', specs);
  const wins = apps.map(() => 0); out.forEach((r, k) => { if (r.won) wins[specs[k]._ai]++; });
  return wins.map(w => w / n);
}

const loss = (apps, rates) => { const per = new Map(); apps.forEach((a, i) => { const e = per.get(a.adv) || { s: 0, n: 0 }; e.s += (rates[i] - TARGET[a.act][a.node]) ** 2; e.n++; per.set(a.adv, e); }); return per; };

export async function calibrate(pool, { log = console.log, perAdv = true, from = null, rounds = 2 } = {}) {
  const apps = appearances(); const advs = [...new Set(apps.map(a => a.adv))];
  const base = getContent('enterprise'); const goalOf = id => base.adversaryMeta[id]?.goal;
  const goals = Object.keys(base.tuning.goals);
  const knobs = Object.fromEntries(advs.map(a => [a, { goalNeed: 0, energy: 0, power: 0, exposure: 0 }]));
  const goalOff = Object.fromEntries(goals.map(g => [g, 0]));
  const ov = () => ({ tuning: { goals: Object.fromEntries(goals.map(g => [g, { need: base.tuning.goals[g].need.map(n => Math.max(1, n + goalOff[g])) }])) }, adversaryMeta: Object.fromEntries(Object.entries(knobs).map(([id, b]) => [id, { balance: b }])) });
  const meanLoss = l => ([...l.values()].reduce((s, e) => s + e.s / e.n, 0) / l.size);
  if (from) { Object.assign(goalOff, from.goalOff); for (const [a, k] of Object.entries(from.knobs)) if (knobs[a]) Object.assign(knobs[a], k); }
  // Stage G: one need-offset per goal kind (global shape of the clocks)
  if (!from) {
    const grid = [-1, 0, 1, 2, 3, 4, 5, 6, 8, 10]; const perGoal = Object.fromEntries(goals.map(g => [g, []]));
    for (const v of grid) {
      for (const g of goals) goalOff[g] = v;
      const rates = await evaluate(pool, apps, ov()); const l = loss(apps, rates);
      for (const g of goals) { const ids = advs.filter(a => goalOf(a) === g); if (!ids.length) continue; perGoal[g].push({ v, l: ids.reduce((s, a) => s + l.get(a).s / l.get(a).n, 0) / ids.length }); }
      log(`goal offset ${v}: mean loss ${meanLoss(l).toFixed(4)}`);
    }
    for (const g of goals) { const c = perGoal[g].sort((x, y) => x.l - y.l || Math.abs(x.v) - Math.abs(y.v))[0]; goalOff[g] = c ? c.v : 0; }
    log('goal offsets', JSON.stringify(goalOff));
  }
  // Stage A: per-adversary residual calibration (small ranges, because the global shape is already set)
  if (perAdv) {
    // coordinate descent in steps around each adversary's current value, within hard limits
    const STEPS = { goalNeed: [-2, -1, 0, 1, 2], energy: [-1, 0, 1], power: [-1, 0, 1], exposure: [-2, 0, 2] };
    const LIM = { goalNeed: [-4, 8], energy: [-2, 2], power: [-2, 2], exposure: [-4, 4] };
    for (let r = 0; r < rounds; r++) for (const dim of ['goalNeed', 'energy', 'power', 'exposure']) {
      const per = new Map(advs.map(a => [a, []])); const cur = Object.fromEntries(advs.map(a => [a, knobs[a][dim]]));
      for (const d of STEPS[dim]) {
        for (const a of advs) knobs[a][dim] = Math.max(LIM[dim][0], Math.min(LIM[dim][1], cur[a] + d));
        const rates = await evaluate(pool, apps, ov()); const l = loss(apps, rates);
        for (const a of advs) per.get(a).push({ v: knobs[a][dim], l: l.get(a).s / l.get(a).n, d });
        log(`round ${r + 1} ${dim} ${d >= 0 ? '+' : ''}${d}: mean loss ${meanLoss(l).toFixed(4)}`);
      }
      for (const a of advs) knobs[a][dim] = per.get(a).sort((x, y) => x.l - y.l || Math.abs(x.d) - Math.abs(y.d))[0].v;
    }
  }
  const rates = await evaluate(pool, apps, ov(), { n: N * 2 });
  return { knobs, goalOff, apps, rates, advs, overrides: ov() };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pool = new Pool(); mkdirSync('lab/out', { recursive: true });
  try {
    const from = arg('from', null) ? JSON.parse(readFileSync(arg('from'), 'utf8')) : null;
    const res = await calibrate(pool, { from, rounds: +arg('rounds', 2) });
    const rows = res.apps.map((a, i) => ({ ...a, rate: res.rates[i], target: TARGET[a.act][a.node] }));
    const rmse = Math.sqrt(rows.reduce((s, r) => s + (r.rate - r.target) ** 2, 0) / rows.length);
    console.log('RMSE vs target', (100 * rmse).toFixed(1) + 'pp over', rows.length, 'appearances');
    const capped = Object.entries(res.knobs).filter(([, k]) => Math.abs(k.goalNeed) >= 2 || Math.abs(k.energy) >= 1 || Math.abs(k.power) >= 1).map(([a]) => a); if (capped.length) console.log('adversaries needing the edge of their per-adversary range (structural?):', capped.join(', '));
    writeFileSync('lab/out/tune.json', JSON.stringify({ knobs: res.knobs, goalOff: res.goalOff, rmse, rows }));
    if (process.argv.includes('--apply')) {
      const p = 'scripts/balance.json'; const cur = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : {};
      cur.tuning = cur.tuning || {}; cur.tuning.goals = Object.fromEntries(Object.entries(res.goalOff).map(([g, off]) => [g, { need: getContent('enterprise').tuning.goals[g].need.map(n => Math.max(1, n + off)) }]));
      cur.adversaryMeta = Object.fromEntries(Object.entries(res.knobs).map(([id, b]) => [id, { balance: Object.fromEntries(Object.entries(b).filter(([, v]) => v !== 0)) }]).filter(([, v]) => Object.keys(v.balance).length));
      writeFileSync(p, JSON.stringify(cur, null, 1) + '\n'); console.log('wrote', p);
    }
  } finally { await pool.close(); }
}
