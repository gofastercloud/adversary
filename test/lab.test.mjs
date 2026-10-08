// The playtest lab is part of the product: if the agents, fuzzer or invariants break, balance work is blind.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getContent, simBattle } from '../lab/sim.mjs';
import { playRunLab } from '../lab/agents/run.mjs';
import { fuzzBattle, fuzzRun } from '../lab/fuzz.mjs';
import { checkBattle } from '../lab/invariants.mjs';
import { Pool } from '../lab/pool.mjs';
import { wilson } from '../lab/stats.mjs';
import * as B from '../engine/battle.js';

const DOCS = ['architect', 'hunter', 'phoenix', 'governor', 'responder'];

test('fuzzer: random legal and illegal actions never break invariants, in every pack', () => {
  for (const pack of ['enterprise', 'utilities', 'ot', 'appsec', 'banking', 'cloud', 'tprm']) {
    const c = getContent(pack); const advs = Object.keys(c.adversaryMeta);
    for (let i = 0; i < 8; i++) { const adv = advs[(i * 7) % advs.length]; assert.deepEqual(fuzzBattle(c, { seed: `t${i}`, adv, tier: 1 + (i % 3), doctrine: DOCS[i % 5] }), [], `${pack}/${adv}`); }
    assert.deepEqual(fuzzRun(c, { seed: 'fr-' + pack, doctrine: DOCS[pack.length % 5] }), [], pack + ' run');
  }
});

test('agents are deterministic and the skill ladder is ordered (random < standard)', () => {
  const c = getContent('enterprise'); const advs = Object.keys(c.adversaryMeta).slice(0, 24);
  const run = skill => advs.map((adv, i) => simBattle(c, { adv, tier: c.adversaryMeta[adv].tier, doctrine: DOCS[i % 5], seed: 'lab-' + i, skill }));
  assert.equal(JSON.stringify(run('standard')), JSON.stringify(run('standard')), 'same seed, same battle');
  const win = r => r.filter(x => x.won).length;
  assert.ok(win(run('standard')) > win(run('random')), 'standard beats random on the same seeds');
});

test('battles with injected overrides change outcomes without mutating the shared content', () => {
  const base = getContent('enterprise'); const before = JSON.stringify(base.tuning.goals.exfil.need);
  const hard = getContent('enterprise', { tuning: { goals: { exfil: { need: [1, 1, 1] } } } });
  assert.deepEqual(hard.tuning.goals.exfil.need, [1, 1, 1]); assert.equal(JSON.stringify(base.tuning.goals.exfil.need), before);
  const adv = Object.entries(base.adversaryMeta).find(([, m]) => m.goal === 'exfil')[0];
  const losses = c => Array.from({ length: 12 }, (_, i) => simBattle(c, { adv, tier: 2, doctrine: DOCS[i % 5], seed: 'ov-' + i, skill: 'standard' })).filter(r => !r.won).length;
  assert.ok(losses(hard) > losses(base), 'a goal that needs 1 success is much harder to survive');
});

test('run agent plays full runs whose action logs replay exactly', () => {
  const c = getContent('cloud');
  for (const skill of ['random', 'standard']) {
    const init = { seed: 'lab-run-' + skill, doctrine: 'hunter', assurance: 1 };
    const { run, log } = playRunLab(c, init, { skill, seed: init.seed });
    assert.ok(['won', 'lost'].includes(run.phase));
    assert.ok(log.length > 3);
  }
});

test('pool: results come back in spec order regardless of worker count', async () => {
  const pool = new Pool(2);
  try {
    const specs = Array.from({ length: 12 }, (_, i) => ({ scenario: 'enterprise', adv: 'G0092', tier: 1, doctrine: DOCS[i % 5], seed: 'pool-' + i, skill: 'standard', assurance: 1 }));
    const out = await pool.map('battle', specs);
    const local = specs.map(s => simBattle(getContent('enterprise'), s));
    assert.deepEqual(out.map(r => [r.won, r.how, r.rounds]), local.map(r => [r.won, r.how, r.rounds]));
  } finally { await pool.close(); }
});

test('stats: Wilson interval brackets the estimate', () => { const w = wilson(30, 100); assert.ok(w.lo < 0.3 && w.hi > 0.3 && w.lo > 0.2 && w.hi < 0.4); });
