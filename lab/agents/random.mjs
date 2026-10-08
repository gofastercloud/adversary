// Uniformly random legal defender: the floor of the skill ladder. A good game should crush it.
import * as B from '../../engine/battle.js';
import { makeRng } from '../rng.mjs';
export function makeRandomAgent(seed = 'rand', { endProb = 0.18 } = {}) {
  const rng = makeRng(seed + '|random');
  return {
    name: 'random',
    turn(content, ctl) {
      for (let guard = 0; guard < 30 && !ctl.b().over; guard++) {
        const b = ctl.b();
        if (b.ttx?.pending) ctl.do({ type: 'DECIDE', choice: rng.pick(b.ttx.pending.choices).id });
        if (rng() < endProb) break;
        const opts = [];
        for (const iid of b.hand) {
          const e = B.effCard(content, b, iid);
          if (e.unplayable || e.type === 'status' || B.cardCost(content, b, iid) > b.energy.cur) continue;
          for (const t of B.validTargets(content, b, iid)) opts.push({ iid, t });
        }
        if (!opts.length) break;
        const o = rng.pick(opts);
        try { ctl.do({ type: 'PLAY', iid: o.iid, target: o.t }); } catch (e) { if (!(e instanceof B.GameError) && !/illegal/.test(e.message)) throw e; }
      }
      if (!ctl.b().over) ctl.do({ type: 'END_TURN' });
    }
  };
}
