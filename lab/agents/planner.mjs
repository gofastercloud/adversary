// "Expert" defender: determinised Monte-Carlo planning. For each candidate play it clones the battle, re-seeds the future
// randomness (different adversary draws and plants), finishes the battle with the sharp heuristic and averages the outcome.
// It sees hidden footholds and the adversary's current hand, so it is a SKILL CEILING for balance work, not a human proxy.
import * as B from '../../engine/battle.js';
import { makeAgent } from './heuristic.mjs';
import { makeRng } from '../rng.mjs';

const clone = b => { const o = b.obs; b.obs = undefined; const c = structuredClone(b); b.obs = o; return c; };

function rolloutValue(content, b0, first, seed, rollPolicy, horizon) {
  const b = clone(b0); b.seed = b.seed + '|' + seed;
  const ctl = { b: () => b, do: a => B.battleAction(content, b, a) };
  try {
    if (first.type === 'END_TURN') { ctl.do(first); } else ctl.do(first);
  } catch (e) { if (e instanceof B.GameError) return -1; throw e; }
  let guard = 0, turns = 0;
  const startRound = b.round;
  while (!b.over && guard++ < 40) { if (horizon && b.round - startRound >= horizon && b.phase === 'defender') break; if (b.phase === 'defender' && first.type !== 'END_TURN' && guard === 1) { /* finish this turn with the policy */ } rollPolicy.turn(content, ctl); turns++; }
  return evalState(content, b);
}

/** Leaf/terminal value in [-1.2, 1.4]. */
export function evalState(content, b) {
  if (b.over) { const r = b.result; return r.won ? 1 + 0.35 * Math.max(0, r.resEnd) / b.res.max : -0.2 + 0.3 * (r.rounds / (b.adv.rounds || 9)); }
  const hidden = b.footholds.filter(f => !f.revealed).length, crit = b.footholds.filter(f => { const a = B.asset(b, f.asset); return a.jewel || a.kind === 'ot'; }).length;
  const gp = b.goal ? b.goal.prog / b.goal.need : 0;
  const expo = b.expo.cur / b.expo.max;
  return 0.55 + 0.3 * (b.res.cur / b.res.max) + 0.25 * expo - 0.5 * gp - 0.05 * hidden - 0.06 * crit - 0.15 * b.assets.filter(a => a.down).length;
}

export function makePlanner(seed = 'planner', cfg = {}) {
  const { K = 5, M = 4, horizon = 0 } = cfg;
  const roll = makeAgent('sharp', seed + '|roll');
  const base = makeAgent('sharp', seed + '|base');
  const rng = makeRng(seed + '|plan');
  const agent = {
    name: 'expert',
    turn(content, ctl) {
      for (let guard = 0; guard < 30 && !ctl.b().over; guard++) {
        const b = ctl.b();
        if (b.ttx?.pending) { const ch = b.ttx.pending.choices.find(c => c.quality === 'best') || b.ttx.pending.choices[0]; ctl.do({ type: 'DECIDE', choice: ch.id }); continue; }
        const opts = base.options(content, b).slice(0, K);
        const cands = opts.map(o => ({ type: 'PLAY', iid: o.iid, target: o.target }));
        const p = base.power(content, b); if (p) cands.push({ type: 'POWER', target: p });
        cands.push({ type: 'END_TURN' });
        let best = null;
        for (const a of cands) {
          let v = 0; for (let m = 0; m < M; m++) v += rolloutValue(content, b, a, 'm' + m + '_' + rng.int(1e6), roll, horizon);
          v /= M; if (!best || v > best.v) best = { a, v };
        }
        if (best.a.type === 'END_TURN') break;
        try { ctl.do(best.a); } catch (e) { if (e instanceof B.GameError || /illegal/.test(e.message)) break; throw e; }
      }
      if (!ctl.b().over) ctl.do({ type: 'END_TURN' });
    }
  };
  return agent;
}
globalThis.__makePlanner = (seed, cfg) => makePlanner(seed, cfg || globalThis.__plannerCfg || {});
