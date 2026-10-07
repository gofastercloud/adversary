// Simulation primitives shared by the CLI, workers, the optimiser and the tests.
import * as B from '../engine/battle.js';
import * as R from '../engine/run.js';
import { applyBalance } from '../engine/content.js';
import { loadContent } from '../scripts/lib/load.mjs';
import { makeAgent, SKILLS } from './agents/heuristic.mjs';
import { makeRandomAgent } from './agents/random.mjs';
import './agents/planner.mjs';   // registers the lite/expert planner

const envCache = new Map();
/** Content for a scenario, optionally with tuning/meta overrides (deep-merged copies; the shared base is never mutated). */
export function getContent(scenario = 'enterprise', overrides = null) {
  const key = scenario + '|' + (overrides ? JSON.stringify(overrides) : '');
  if (envCache.has(key)) return envCache.get(key);
  const base = loadContent(scenario, [], { allAdversaries: true });
  let c = base;
  if (overrides) {
    c = { ...base, tuning: structuredClone(base.tuning), adversaryMeta: structuredClone(base.adversaryMeta) };
    deepMerge(c.tuning, overrides.tuning || {});
    for (const [id, m] of Object.entries(overrides.adversaryMeta || {})) deepMerge((c.adversaryMeta[id] ||= {}), m);
    if (overrides.cards) { c.cardsBase = structuredClone(base.cardsBase); for (const [id, p] of Object.entries(overrides.cards)) deepMerge(c.cardsBase[id], p); }
    if (overrides.doctrines) { c.doctrines = structuredClone(base.doctrines); for (const [id, p] of Object.entries(overrides.doctrines)) deepMerge(c.doctrines[id], p); }
    applyBalance(c);
  }
  if (envCache.size > 40) envCache.clear();
  envCache.set(key, c); return c;
}
export function deepMerge(t, s) { for (const [k, v] of Object.entries(s)) { if (v && typeof v === 'object' && !Array.isArray(v)) deepMerge((t[k] ||= {}), v); else t[k] = v; } return t; }

export const SKILL_LADDER = ['random', 'novice', 'standard', 'sharp', 'lite', 'expert'];
export function agentFor(skill, seed) {
  if (skill === 'idle') return { name: 'idle', turn(content, ctl) { if (!ctl.b().over) ctl.do({ type: 'END_TURN' }); } };   // does nothing: measures how slow the adversary clocks are
  if (skill === 'random') return makeRandomAgent(seed);
  if (skill === 'expert') return globalThis.__makePlanner(seed);     // set by lab/agents/planner.mjs (lazy, heavy)
  if (skill === 'lite') return globalThis.__makePlanner(seed, { K: 4, M: 2, horizon: 1 });   // cheap planner: one adversary turn of lookahead
  if (typeof skill === 'string' && skill.startsWith('standard-no-')) return makeAgent({ ...SKILLS.standard, ban: skill.slice(12).split('+') }, seed);
  return makeAgent(skill, seed);
}

export function starterDeck(content, doctrineId) { return content.doctrines[doctrineId].deck.map((id, i) => ({ iid: 'd' + i, id, ml: 1 })); }

/** Plays one battle to the end. spec: { adv, tier, doctrine, seed, skill, assurance, deck?, resilience?, relics?, boss?, elite? } */
export function simBattle(content, spec) {
  const d = content.doctrines[spec.doctrine || 'architect'];
  const deck = spec.deck ? spec.deck.map((c, i) => ({ iid: 'd' + i, id: c.id, ml: c.ml || 1 })) : starterDeck(content, spec.doctrine || 'architect');
  const b = B.newBattle(content, { seed: spec.seed, deck, adversary: { id: spec.adv, tier: spec.tier, boss: !!spec.boss, elite: !!spec.elite },
    resilience: spec.resilience || { cur: d.maxResilience, max: d.maxResilience }, relics: spec.relics || (d.relic ? [d.relic] : []), doctrine: spec.doctrine || 'architect', assurance: spec.assurance ?? 1 });
  const agent = agentFor(spec.skill || 'standard', spec.seed);
  const tally = {}; b.obs = e => { const k = e.t === 'adv_play' ? 'adv:' + e.kind : e.t; tally[k] = (tally[k] || 0) + 1; };
  let guard = 0;
  const ctl = { b: () => b, do: a => B.battleAction(content, b, a) };
  while (!b.over && guard++ < 60) agent.turn(content, ctl);
  b.obs = undefined;
  const m = battleMetrics(content, b, spec); m.tally = tally; return m;
}

export function battleMetrics(content, b, spec = {}) {
  const r = b.result || { won: false, how: 'stuck', rounds: b.round, resLost: b.stats.resLost };
  return { adv: b.adv.id, tier: b.adv.tier, doctrine: spec.doctrine, skill: spec.skill, won: !!r.won, how: r.how, rounds: r.rounds, resLost: r.resLost, resEnd: r.resEnd ?? b.res.cur, resMax: b.res.max,
    goal: b.goal?.kind || null, goalFrac: b.goal ? +(b.goal.prog / b.goal.need).toFixed(2) : null, evictions: r.evictions, blocked: r.blocked, cards: r.cardsPlayed, expo: r.exposure, jewelSafe: r.jewelSafe,
    types: b.stats.typesPlayed, assetsDown: r.assetsDown, deploys: b.stats.deploys };
}
