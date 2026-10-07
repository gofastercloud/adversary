// Fuzzer: random legal and illegal actions against battles and runs; checks invariants after every action, that illegal
// actions are rejected without mutating state, that states stay JSON-serialisable, and that replays are exact.
import * as B from '../engine/battle.js';
import * as R from '../engine/run.js';
import { getContent, starterDeck } from './sim.mjs';
import { makeRng } from './rng.mjs';
import { checkBattle, hash } from './invariants.mjs';

export function fuzzBattle(content, { seed, adv, tier, doctrine, illegalRate = 0.15 }) {
  const rng = makeRng('fuzz|' + seed); const d = content.doctrines[doctrine];
  const b = B.newBattle(content, { seed, deck: starterDeck(content, doctrine), adversary: { id: adv, tier }, resilience: { cur: d.maxResilience, max: d.maxResilience }, relics: [d.relic], doctrine, assurance: rng.int(4) });
  const problems = []; let steps = 0;
  const note = (m) => { if (problems.length < 5) problems.push(`${adv}/${doctrine}/${seed} step ${steps}: ${m}`); };
  while (!b.over && steps++ < 600) {
    for (const x of checkBattle(content, b)) note(x);
    let action;
    const r = rng();
    if (r < illegalRate) {
      // illegal on purpose: unknown card, wrong phase, over-budget, bad target
      const pick = rng.int(5);
      action = pick === 0 ? { type: 'PLAY', iid: 'nope', target: {} } : pick === 1 ? { type: 'PLAY', iid: 'also-nope', target: { asset: 'zzz' } } : pick === 2 ? { type: 'DECIDE', choice: 'z' } : pick === 3 ? { type: 'PLAY' } : { type: 'BOGUS' };
      const before = hash(b); try { B.battleAction(content, b, action); note('illegal action accepted: ' + JSON.stringify(action)); } catch (e) { if (!(e instanceof B.GameError)) note('illegal action threw non-GameError: ' + e.message); }
      if (hash(b) !== before) note('illegal action mutated state: ' + JSON.stringify(action));
      continue;
    }
    if (r < 0.62 && b.hand.length) {
      const iid = rng.pick(b.hand); const ts = B.validTargets(content, b, iid);
      if (ts.length) { try { B.battleAction(content, b, { type: 'PLAY', iid, target: rng.pick(ts) }); } catch (e) { if (!(e instanceof B.GameError)) { note('play threw: ' + e.stack.split('\n').slice(0, 3).join(' | ')); break; } } continue; }
    }
    if (b.ttx?.pending) { B.battleAction(content, b, { type: 'DECIDE', choice: rng.pick(b.ttx.pending.choices).id }); continue; }
    try { B.battleAction(content, b, { type: 'END_TURN' }); } catch (e) { note('end turn threw: ' + e.stack.split('\n').slice(0, 3).join(' | ')); break; }
  }
  if (!b.over) note('battle did not terminate in 600 steps');
  try { JSON.parse(JSON.stringify(b)); } catch { note('state not JSON-serialisable'); }
  return problems;
}

export function fuzzRun(content, { seed, doctrine }) {
  const rng = makeRng('fuzzrun|' + seed); const init = { seed, doctrine, assurance: rng.int(4) };
  let run = R.newRun(content, init); const log = []; const problems = []; let n = 0;
  const note = m => { if (problems.length < 5) problems.push(`run ${seed} action ${n}: ${m}`); };
  while (!['won', 'lost'].includes(run.phase) && n++ < 3000) {
    const ph = run.phase; let a;
    if (ph === 'map') a = { type: 'CHOOSE', index: rng.int(run.map[run.act - 1][run.step].length) };
    else if (ph === 'briefing') a = { type: 'START_BATTLE' };
    else if (ph === 'battle') {
      const b = run.battle;
      if (b.ttx?.pending) a = { type: 'BATTLE', action: { type: 'DECIDE', choice: rng.pick(b.ttx.pending.choices).id } };
      else if (rng() < 0.5 && b.hand.length) { const iid = rng.pick(b.hand); const ts = B.validTargets(content, b, iid); a = ts.length ? { type: 'BATTLE', action: { type: 'PLAY', iid, target: rng.pick(ts) } } : { type: 'BATTLE', action: { type: 'END_TURN' } }; }
      else a = { type: 'BATTLE', action: { type: 'END_TURN' } };
    }
    else if (ph === 'reward') { const r = run.reward; a = !r.cardTaken ? (rng() < 0.5 ? { type: 'TAKE_CARD', id: rng.pick(r.cards) } : { type: 'SKIP_CARD' }) : r.relics.length && !r.relicTaken ? { type: 'TAKE_RELIC', id: r.relics[0] } : { type: 'DONE_REWARD' }; }
    else if (ph === 'shop') a = rng() < 0.5 ? { type: 'BUY', index: rng.int(run.shop.slots.length) } : { type: 'LEAVE' };
    else if (ph === 'rest') a = !run.rest.done ? { type: 'REST', choice: rng.pick(['heal', 'upgrade', 'remove']), iid: rng.pick(run.deck).iid } : { type: 'LEAVE' };
    else if (ph === 'event') a = run.event.picked == null ? { type: 'EVENT', index: rng.int(content.events[run.event.id].choices.length) } : { type: 'EVENT_DONE' };
    else if (ph === 'whiteboard') { const q = R.wbQuestion(content, run); a = q && q.index < q.total ? { type: 'WB_ANSWER', letter: rng.pick('STRIDE'.split('')) } : { type: 'WB_DONE' }; }
    else { note('unhandled phase ' + ph); break; }
    const before = hash(run); const r = R.tryRunAction(content, run, a);
    if (!r.ok) { if (hash(run) !== before) note('rejected action mutated the run'); continue; }
    run = r.run; log.push(a);
    if (run.battle && !run.battle.over) for (const x of checkBattle(content, run.battle)) note(x);
    if (!Number.isFinite(run.money) || run.money < 0) note('bad money ' + run.money);
    if (run.res.cur > run.res.max) note('res above max');
  }
  if (!['won', 'lost'].includes(run.phase)) note('run did not terminate');
  const rp = R.replay(content, init, log);
  if (!rp.ok) note('replay failed at ' + rp.at + ': ' + rp.error); else if (hash(rp.run) !== hash(run)) note('replay diverged from original');
  return problems;
}
