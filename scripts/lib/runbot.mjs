// Automated full-run player (balance + determinism tests). Records the action log so runs can be replayed.
import * as B from '../../engine/battle.js';
import * as R from '../../engine/run.js';
import { pickBest } from './bot.mjs';

export function playRun(content, init, { maxActions = 4000, log = [] } = {}) {
  let run = R.newRun(content, init);
  const act = (a) => { const r = R.tryRunAction(content, run, a); if (!r.ok) throw new Error('illegal ' + JSON.stringify(a) + ': ' + r.error); log.push(a); run = r.run; return r; };
  let n = 0;
  const events = [];
  while (!['won', 'lost'].includes(run.phase) && n++ < maxActions) {
    switch (run.phase) {
      case 'map': {
        const opts = run.map[run.act - 1][run.step];
        // prefer rest when hurt, elites when healthy, else first
        const hurt = run.res.cur < run.res.max * 0.55;
        let idx = opts.findIndex(o => hurt && o.type === 'rest'); if (idx < 0) idx = opts.findIndex(o => o.type === 'elite' && !hurt); if (idx < 0) idx = opts.findIndex(o => ['shop', 'whiteboard', 'event'].includes(o.type)); if (idx < 0) idx = 0;
        events.push(...act({ type: 'CHOOSE', index: idx }).events); break;
      }
      case 'briefing': events.push(...act({ type: 'START_BATTLE' }).events); break;
      case 'battle': {
        const b = run.battle;
        if (b.ttx?.pending) { const ch = b.ttx.pending.choices.find(c => c.quality === 'best') || b.ttx.pending.choices[0]; events.push(...act({ type: 'BATTLE', action: { type: 'DECIDE', choice: ch.id } }).events); break; }
        if (b.phase === 'defender') {
          const best = pickBest(content, b);
          if (best) { events.push(...act({ type: 'BATTLE', action: { type: 'PLAY', iid: best.iid, target: best.target } }).events); break; }
          events.push(...act({ type: 'BATTLE', action: { type: 'END_TURN' } }).events);
        } else throw new Error('stuck in battle phase ' + b.phase);
        break;
      }
      case 'reward': {
        const r = run.reward;
        if (!r.cardTaken) {
          // take the highest-weight on-focus card, or skip when deck is already large and nothing is good
          const d = content.doctrines[run.doctrine];
          const score = (id) => { const c = content.cards[id]; return ({ common: 1, uncommon: 2, rare: 3 }[c.rarity] || 0) + (d.focus.includes(c.fn) ? 1.5 : 0) + (c.type === 'augment' ? 1 : 0); };
          const pick = r.cards.slice().sort((a, b) => score(b) - score(a))[0];
          if (pick && run.deck.length < 26) events.push(...act({ type: 'TAKE_CARD', id: pick }).events); else events.push(...act({ type: 'SKIP_CARD' }).events);
        } else if (r.relics.length && !r.relicTaken) events.push(...act({ type: 'TAKE_RELIC', id: r.relics[0] }).events);
        else events.push(...act({ type: 'DONE_REWARD' }).events);
        break;
      }
      case 'shop': {
        const s = run.shop;
        let bought = false;
        for (const [i, slot] of s.slots.entries()) if (!slot.sold && slot.cost <= run.money && (slot.kind === 'relic' || run.deck.length < 24)) { try { events.push(...act({ type: 'BUY', index: i }).events); bought = true; break; } catch (e) { /* owned */ } }
        if (!bought) { if (!s.removed && run.deck.some(c => c.id === 'status.techdebt') && run.money >= s.removeCost) events.push(...act({ type: 'REMOVE', iid: run.deck.find(c => c.id === 'status.techdebt').iid }).events); else events.push(...act({ type: 'LEAVE' }).events); }
        break;
      }
      case 'rest': {
        if (!run.rest.done) {
          if (run.res.cur < run.res.max * 0.6) events.push(...act({ type: 'REST', choice: 'heal' }).events);
          else { const up = run.deck.filter(c => c.ml < 3 && content.cards[c.id].type !== 'status').sort((a, b) => (content.cards[b.id].type === 'control' ? 1 : 0) - (content.cards[a.id].type === 'control' ? 1 : 0))[0]; if (up) events.push(...act({ type: 'REST', choice: 'upgrade', iid: up.iid }).events); else events.push(...act({ type: 'REST', choice: 'heal' }).events); }
        } else events.push(...act({ type: 'LEAVE' }).events);
        break;
      }
      case 'event': {
        if (run.event.picked == null) events.push(...act({ type: 'EVENT', index: 0 }).events); else events.push(...act({ type: 'EVENT_DONE' }).events);
        break;
      }
      case 'whiteboard': {
        const q = R.wbQuestion(content, run);
        if (q && q.index < q.total) events.push(...act({ type: 'WB_ANSWER', letter: q.scenario.answer }).events); else events.push(...act({ type: 'WB_DONE' }).events);
        break;
      }
      default: throw new Error('unhandled phase ' + run.phase);
    }
  }
  return { run, log, events };
}
