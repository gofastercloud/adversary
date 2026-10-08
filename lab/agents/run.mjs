// Run-level player: map routing, card picks, shops, rests, events and whiteboard answers, with a battle agent inside.
// Policies are intentionally simple and legible; "smart" is what an attentive human does (balance the deck, cover the
// mitigations the act's adversaries use, spend money, rest when hurt, upgrade wards).
import * as B from '../../engine/battle.js';
import * as R from '../../engine/run.js';
import { agentFor, battleMetrics } from '../sim.mjs';
import { makeRng } from '../rng.mjs';

export const RUN_POLICIES = {
  random:   { cards: 'random', shop: false, smartMap: false, wb: 0.2, takeRelic: true },
  novice:   { cards: 'greedy', shop: true, smartMap: false, wb: 0.55, takeRelic: true },
  standard: { cards: 'smart', shop: true, smartMap: true, wb: 0.8, takeRelic: true },
  sharp:    { cards: 'smart', shop: true, smartMap: true, wb: 0.95, takeRelic: true },
  expert:   { cards: 'smart', shop: true, smartMap: true, wb: 0.95, takeRelic: true }
};
const RARE_W = { common: 1, uncommon: 2, rare: 3, status: -5 };

/** Mitigations the current act's adversaries lean on (what a player reads off the briefing screens). */
function actThreat(content, run) {
  const act = content.roster?.acts?.[Math.min(2, run.act - 1)]; const m = {};
  for (const id of [...(act?.battle || []), ...(act?.elite || []), act?.boss].filter(Boolean)) for (const t of content.adversaries[id]?.techs || []) for (const x of t.m || []) m[x] = (m[x] || 0) + 1;
  return m;
}
function deckProfile(content, run) {
  const p = { control: 0, ward: 0, detect: 0, evict: 0, heal: 0, intel: 0, policy: 0, augment: 0, size: run.deck.length, fn: {} };
  for (const c of run.deck) { const d = content.cards[c.id]; if (d.type === 'status') continue; p[d.type] = (p[d.type] || 0) + 1; p.fn[d.fn] = (p.fn[d.fn] || 0) + 1;
    if (d.ward) p.ward++; if (d.detect || (d.fx || []).some(f => ['reveal', 'scanKinds'].includes(f.op))) p.detect++; if ((d.fx || []).some(f => ['evict', 'purge', 'evictPrivileged', 'restoreBackup'].includes(f.op))) p.evict++; if (d.aegis || (d.fx || []).some(f => f.op === 'heal')) p.heal++; }
  return p;
}
export function cardScore(content, run, id, pol) {
  const c = content.cards[id]; if (!c) return -9;
  if (pol.cards === 'random') return Math.random();
  let s = (RARE_W[c.rarity] || 1);
  const doc = content.doctrines[run.doctrine]; if (doc?.focus?.includes(c.fn)) s += 1.5;
  if (pol.cards === 'greedy') return s + (c.type === 'control' ? 1 : 0);
  const p = deckProfile(content, run), threat = actThreat(content, run);
  const dup = run.deck.filter(x => x.id === id).length;
  s -= dup * 1.6;
  if (c.type === 'control' && c.ward) { s += p.ward < 5 ? 2.5 : 0.4; for (const m of c.mit || []) s += Math.min(2, (threat[m] || 0) * 0.15); if (c.cov?.protect) s += 0.8; }
  if (c.detect || (c.fx || []).some(f => ['reveal', 'scanKinds'].includes(f.op))) s += p.detect < 3 ? 2.5 : 0.3;
  if ((c.fx || []).some(f => ['evict', 'purge', 'evictPrivileged'].includes(f.op))) s += p.evict < 3 ? 2.2 : 0.5;
  if (c.aegis || (c.fx || []).some(f => f.op === 'heal')) s += p.heal < 2 ? 1.8 : 0;
  if (c.type === 'policy') s += p.policy < 2 ? 1.2 : -1.5;
  if (c.type === 'augment') { const fits = run.deck.some(x => { const d = content.cards[x.id]; return d.type === 'control' && d.cell && (c.base || []).some(b => b === d.cell || (b.endsWith('.*') && d.cell.startsWith(b.slice(0, -1)))); }); s += fits ? 1.5 + (p.augment < 3 ? 0.8 : 0) : -4; }
  if (c.consume) s += c.consume === 'run' ? 0.6 : 0.2;
  if (p.size > 20) s -= (p.size - 20) * 0.35;
  return s;
}
function eventScore(content, run, ch) {
  let s = 0;
  for (const fx of ch.fx) switch (fx.op) {
    case 'money': s += fx.n * 0.08; break; case 'resilience': s += fx.n * (run.res.cur / run.res.max < 0.6 ? 0.5 : 0.25); break; case 'maxResilience': s += fx.n * 0.6; break;
    case 'addCard': s += 1.5; break; case 'addRandomCard': s += 1.2; break; case 'upgradeRandom': case 'upgradeCard': s += 2.5; break; case 'addStatus': s -= 2.2; break; case 'removeStatus': s += 2; break;
    case 'relicChance': s += 1.2; break; case 'flag': s += 0.8; break; case 'ifHasCard': s += 0.5; break; default: break;
  }
  return s;
}

export function playRunLab(content, init, { skill = 'standard', seed = init.seed, policy = null, maxActions = 6000, onBattle = null } = {}) {
  const pol = policy || RUN_POLICIES[skill] || RUN_POLICIES.standard;
  const rng = makeRng(seed + '|runagent');
  let run = R.newRun(content, init); const log = [], battles = [], picks = [], snaps = [], offers = [];
  const act = a => { const r = R.tryRunAction(content, run, a, { inPlace: true }); if (!r.ok) throw new Error('illegal ' + JSON.stringify(a) + ': ' + r.error); log.push(a); run = r.run; return r; };
  let n = 0, agent = null;
  while (!['won', 'lost'].includes(run.phase) && n++ < maxActions) {
    switch (run.phase) {
      case 'map': {
        const opts = run.map[run.act - 1][run.step]; let idx = 0;
        if (pol.smartMap) {
          const hurt = run.res.cur / run.res.max; const strong = run.deck.length >= 12;
          const val = o => ({ rest: hurt < 0.55 ? 6 : hurt < 0.8 ? 2.5 : 0.8, shop: run.money >= 60 ? 4 : 1.2, whiteboard: 2.2, event: 2, battle: 3, elite: hurt > 0.7 && strong ? 3.6 : 0.5, boss: 5 }[o.type] ?? 1);
          idx = opts.reduce((bi, o, i) => (val(o) > val(opts[bi]) ? i : bi), 0);
        } else idx = rng.int(opts.length);
        act({ type: 'CHOOSE', index: idx }); break;
      }
      case 'briefing': snaps.push({ act: run.act, node: run.node.type, adv: run.node.adv, tier: run.node.tier, deck: run.deck.map(c => ({ id: c.id, ml: c.ml })), res: { cur: run.res.cur, max: run.res.max }, relics: run.relics.slice() }); act({ type: 'START_BATTLE' }); agent = agentFor(skill, seed + '|b' + run.visited.length); break;
      case 'battle': {
        const ctl = { b: () => run.battle, do: a => act({ type: 'BATTLE', action: a }) };
        agent.turn(content, ctl);
        const bb = run.battle;
        if (bb?.over && !bb._rec) { bb._rec = true; const m = battleMetrics(content, bb, { skill, doctrine: run.doctrine }); m.act = run.act; m.node = run.node?.type || 'battle'; m.deck = run.deck.length; m.res0 = null; battles.push(m); if (onBattle) onBattle(m); }
        break;
      }
      case 'reward': {
        const r = run.reward;
        if (!r.cardTaken) {
          offers.push({ act: run.act, cards: r.cards.slice() });
          const ranked = r.cards.map(id => [id, cardScore(content, run, id, pol)]).sort((a, b) => b[1] - a[1]);
          const top = ranked[0];
          if (top && (pol.cards === 'random' ? rng() < 0.5 : top[1] > 1.2 + Math.max(0, run.deck.length - 18) * 0.3)) { act({ type: 'TAKE_CARD', id: top[0] }); picks.push({ id: top[0], act: run.act }); } else act({ type: 'SKIP_CARD' });
        } else if (r.relics.length && !r.relicTaken) { if (pol.takeRelic) act({ type: 'TAKE_RELIC', id: r.relics[0] }); else act({ type: 'SKIP_RELIC' }); }
        else act({ type: 'DONE_REWARD' });
        break;
      }
      case 'shop': {
        const s = run.shop; let did = false;
        if (pol.shop) {
          const options = s.slots.map((sl, i) => ({ sl, i })).filter(({ sl }) => !sl.sold && sl.cost <= run.money).map(({ sl, i }) => ({ i, v: sl.kind === 'relic' ? 4 + (RARE_W[content.relics[sl.id]?.rarity] || 1) - sl.cost / 40 : cardScore(content, run, sl.id, pol) - sl.cost / 45 })).sort((a, b) => b.v - a.v);
          if (options[0] && options[0].v > 1.0) { try { act({ type: 'BUY', index: options[0].i }); did = true; } catch { /* already owned */ } }
          if (!did && !s.removed && run.deck.some(c => c.id === 'status.techdebt') && run.money >= s.removeCost) { act({ type: 'REMOVE', iid: run.deck.find(c => c.id === 'status.techdebt').iid }); did = true; }
          if (!did && !s.healed && run.res.cur / run.res.max < 0.5 && run.money >= content.tuning.shop.healCost) { act({ type: 'HEAL_SHOP' }); did = true; }
        }
        if (!did) act({ type: 'LEAVE' });
        break;
      }
      case 'rest': {
        if (!run.rest.done) {
          if (run.res.cur / run.res.max < 0.62) act({ type: 'REST', choice: 'heal' });
          else {
            const up = run.deck.filter(c => c.ml < 3 && content.cards[c.id].type !== 'status').sort((a, b) => cardUp(content, b) - cardUp(content, a))[0];
            if (up) act({ type: 'REST', choice: 'upgrade', iid: up.iid }); else act({ type: 'REST', choice: 'heal' });
          }
        } else act({ type: 'LEAVE' });
        break;
      }
      case 'event': {
        if (run.event.picked == null) { const e = content.events[run.event.id]; const sc = e.choices.map((c, i) => [i, eventScore(content, run, c) + (pol.cards === 'random' ? rng() * 3 : 0)]).sort((a, b) => b[1] - a[1]); act({ type: 'EVENT', index: sc[0][0] }); } else act({ type: 'EVENT_DONE' });
        break;
      }
      case 'whiteboard': {
        const q = R.wbQuestion(content, run);
        if (q && q.index < q.total) { const right = rng() < pol.wb; const wrong = 'STRIDE'.split('').filter(l => l !== q.scenario.answer); act({ type: 'WB_ANSWER', letter: right ? q.scenario.answer : rng.pick(wrong) }); } else act({ type: 'WB_DONE' });
        break;
      }
      default: throw new Error('unhandled phase ' + run.phase);
    }
  }
  return { run, log, picks, battles, snaps, offers };
}
const cardUp = (content, c) => { const d = content.cards[c.id]; return (d.ward ? 3 : 0) + (d.detect ? 2.5 : 0) + (d.type === 'control' ? 2 : 0) + (d.fx?.length ? 1 : 0) + (3 - c.ml) * 0.3; };

