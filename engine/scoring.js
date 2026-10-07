// Scoring pipeline. Pure apart from mutating `state.jokers[i].v` (grow rules) on the state it is given;
// callers wanting a preview must pass a clone.
import { evalHand } from './hands.js';

export const cardView = (content, card) => {
  const c = content.cells[card.cell];
  return { id: card.id, cell: card.cell, ml: card.ml, fn: c.fn, prop: c.prop, fnIdx: c.fnIdx, propIdx: c.propIdx };
};

export const blindOf = (content, ante, idx) => {
  const a = content.antes[ante - 1];
  return a ? a[['small', 'big', 'boss'][idx]] : null;
};
export function blindTarget(content, ante, idx) {
  const eco = content.eco;
  const base = eco.anteBase[Math.min(ante, eco.anteBase.length) - 1] * (ante > eco.anteBase.length ? Math.pow(2, ante - eco.anteBase.length) : 1);
  const b = blindOf(content, ante, idx);
  const m = idx === 2 ? (b?.rule?.targetMult ?? eco.blindMult[2]) : eco.blindMult[idx];
  return Math.floor(base * m);
}

const arr = v => (Array.isArray(v) ? v : [v]);
const inList = (v, x) => v == null || arr(v).includes(x);

export function isDebuffed(content, state, view) {
  const r = state.round && !state.round.over ? blindOf(content, state.round.ante, state.round.idx)?.rule : null;
  if (!r) return false;
  if (r.debuffFn && arr(r.debuffFn).includes(view.fn)) return true;
  if (r.debuffProp && arr(r.debuffProp).includes(view.prop)) return true;
  return false;
}

function cardMatches(c, v, counters) {
  if (!c) return true;
  if (!inList(c.fn, v.fn) || !inList(c.prop, v.prop)) return false;
  if (c.ml != null && v.ml !== c.ml) return false;
  if (c.mlMin != null && v.ml < c.mlMin) return false;
  if (c.counter && !counters.has(v.cell)) return false;
  return true;
}
function handMatches(c, h) {
  if (!c) return true;
  if (c.hand && !c.hand.includes(h.type)) return false;
  if (c.contains && !c.contains.every(x => h.contains.has(x))) return false;
  if (c.playedMax != null && h.playedCount > c.playedMax) return false;
  if (c.playedMin != null && h.playedCount < c.playedMin) return false;
  if (c.scoringMin != null && h.scoringCount < c.scoringMin) return false;
  if (c.handsLeft != null && h.handsLeft !== c.handsLeft) return false;
  if (c.firstHand && !h.firstHand) return false;
  if (c.noDiscardsUsed && h.discardsUsed > 0) return false;
  if (c.distinctFnsMin != null && h.distinctFns < c.distinctFnsMin) return false;
  if (c.distinctPropsMin != null && h.distinctProps < c.distinctPropsMin) return false;
  if (c.distinctPropsMax != null && h.distinctProps > c.distinctPropsMax) return false;
  if (c.moneyMin != null && h.money < c.moneyMin) return false;
  if (c.moneyMax != null && h.money > c.moneyMax) return false;
  if (c.jokersMax != null && h.jokerCount > c.jokersMax) return false;
  if (c.boss && !h.isBoss) return false;
  if (c.cardsMin != null && (h.cards || []).length < c.cardsMin) return false;
  return true;
}
const filt = (list, p, counters) => list.filter(v => cardMatches({ fn: p.fn, prop: p.prop, ml: p.ml }, v, counters));
function countOf(per, h, j, counters) {
  switch (per.count) {
    case 'scoringCards': return filt(h.scoringActive, per, counters).length;
    case 'playedCards': return filt(h.playedViews, per, counters).length;
    case 'heldCards': return filt(h.heldViews, per, counters).length;
    case 'discardedCards': return filt(h.cards || [], per, counters).length;
    case 'jokers': return h.jokerCount;
    case 'money': return Math.floor(h.money / (per.step || 1));
    case 'deckSize': return h.deckSize;
    case 'handLevel': return h.level;
    case 'distinctProps': return h.distinctProps;
    case 'distinctFns': return h.distinctFns;
    case 'handsLeft': return h.handsLeft;
    case 'discardsLeft': return h.discardsLeft;
    case 'v': return j.v || 0;
    default: return 0;
  }
}
const resolve = (x, j) => (x === '$v' ? (j.v || 0) : x);

export function computeParams(content, state) {
  const e = content.eco;
  const p = { hands: e.hands, discards: e.discards, handSize: e.handSize, jokerSlots: e.jokerSlots, consumableSlots: e.consumableSlots, interestCap: e.interestCap };
  for (const j of state.jokers) for (const r of content.jokers[j.id].rules) {
    if (r.on !== 'passive') continue;
    for (const k of Object.keys(p)) if (r.do[k]) p[k] += r.do[k];
  }
  p.hands = Math.max(1, p.hands); p.handSize = Math.max(3, p.handSize); p.discards = Math.max(0, p.discards);
  return p;
}

function newCtx(content, state, views, extra = {}) {
  const r = state.round;
  const blind = r ? blindOf(content, r.ante, r.idx) : null;
  return {
    counters: new Set(blind?.counters || []),
    isBoss: !!r && r.idx === 2,
    money: state.money, jokerCount: state.jokers.length, deckSize: state.deck.length,
    discardsUsed: r?.discardsUsed || 0, discardsLeft: r?.discards || 0, firstHand: !r || r.handsPlayed === 0,
    ...extra
  };
}

/**
 * Score a played hand. `ids` must be a subset of state.hand (already position-sorted by the caller).
 * Returns { type, level, scoring, debuffed, steps, chips, mult, total, money, zeroed }.
 */
export function scoreHand(content, state, ids) {
  const r = state.round;
  const eco = content.eco;
  const byId = new Map(state.deck.map(c => [c.id, c]));
  const played = ids.map(id => cardView(content, byId.get(id)));
  const ev = evalHand(played);
  const def = content.handTypes[ev.type];
  const level = state.handLevels[ev.type] || 1;
  let chips = def.chips + (level - 1) * def.lchips;
  let mult = def.mult + (level - 1) * def.lmult;
  const blind = blindOf(content, r.ante, r.idx);
  const rule = (r.idx === 2 && blind?.rule) || {};
  if (rule.halveBase) { chips = Math.max(1, Math.floor(chips / 2)); mult = Math.max(1, Math.floor(mult / 2)); }

  const scoringViews = ev.scoring.map(i => played[i]);
  const debuffedIds = scoringViews.filter(v => isDebuffed(content, state, v)).map(v => v.id);
  const scoringActive = scoringViews.filter(v => !debuffedIds.includes(v.id));
  const heldViews = state.hand.filter(id => !ids.includes(id)).map(id => cardView(content, byId.get(id)));
  const out = { type: ev.type, level, contains: [...ev.contains], scoring: scoringViews.map(v => v.id), debuffed: debuffedIds, steps: [], money: 0, zeroed: false };

  const repeat = rule.noRepeatHand && r.handTypesPlayed.includes(ev.type);
  const other = rule.oneHandType && r.handTypesPlayed.length > 0 && r.handTypesPlayed[0] !== ev.type;
  if (repeat || other) {
    out.zeroed = true; out.chips = chips; out.mult = mult; out.total = 0;
    out.steps.push({ kind: 'zero', reason: repeat ? 'Hand type already played this round' : 'Only the first hand type may score' });
    return out;
  }

  const active = state.jokers.filter(j => j.uid !== r.disabled);
  const distinct = (list, k) => new Set(list.map(v => v[k])).size;
  const h = newCtx(content, state, played, {
    type: ev.type, contains: ev.contains, playedCount: played.length, scoringCount: ev.scoring.length,
    handsLeft: r.hands - 1, level, playedViews: played, heldViews, scoringActive,
    distinctFns: distinct(played, 'fn'), distinctProps: distinct(played, 'prop')
  });

  const step = (s) => { out.steps.push({ ...s, tChips: chips, tMult: mult }); };
  step({ kind: 'hand', type: ev.type, level, dChips: chips, dMult: mult });

  const apply = (j, rule, v, src) => {
    const d = rule.do; if (!d) return;
    let count = 1;
    if (rule.per) { count = countOf(rule.per, h, j, h.counters); if (count <= 0) return; }
    const dc = d.chips != null ? resolve(d.chips, j) * count : 0;
    const dm = d.mult != null ? resolve(d.mult, j) * count : 0;
    let xm = 1;
    if (d.xmult != null) xm = rule.per ? 1 + resolve(d.xmult, j) * count : resolve(d.xmult, j);
    const dmoney = d.money != null ? resolve(d.money, j) * count : 0;
    if (!dc && !dm && xm === 1 && !dmoney) return;
    chips += dc; mult += dm; mult *= xm; out.money += dmoney;
    step({ kind: src.kind, jokerUid: j.uid, jokerId: j.id, cardId: src.cardId, dChips: dc, dMult: dm, xMult: xm, money: dmoney, retrigger: src.retrigger });
  };

  const jokerRules = (on) => active.flatMap(j => content.jokers[j.id].rules.filter(r2 => r2.on === on).map(r2 => [j, r2]));

  // 1. scoring cards, left to right
  for (const v of scoringViews) {
    if (debuffedIds.includes(v.id)) { step({ kind: 'debuff', cardId: v.id }); continue; }
    let reps = 1;
    for (const [, rr] of jokerRules('retrigger')) if (cardMatches(rr.if, v, h.counters) && handMatches(rr.if, h)) reps += rr.do.times || 0;
    for (let k = 0; k < reps; k++) {
      const cc = eco.mlChips[v.ml] || 0;
      chips += cc;
      step({ kind: 'card', cardId: v.id, dChips: cc, retrigger: k > 0 });
      if (h.counters.has(v.cell)) { chips += eco.counterChips; step({ kind: 'counter', cardId: v.id, dChips: eco.counterChips, retrigger: k > 0 }); }
      for (const [j, rr] of jokerRules('card')) if (cardMatches(rr.if, v, h.counters) && handMatches(rr.if, h)) apply(j, rr, v, { kind: 'joker', cardId: v.id, retrigger: k > 0 });
    }
  }
  // 2. held in hand
  for (const v of heldViews) {
    if (isDebuffed(content, state, v)) continue;
    for (const [j, rr] of jokerRules('held')) if (cardMatches(rr.if, v, h.counters) && handMatches(rr.if, h)) apply(j, rr, v, { kind: 'joker', cardId: v.id });
  }
  // 3. whole-hand jokers, in doctrine order (grow, then effects)
  for (const j of active) {
    for (const rr of content.jokers[j.id].rules) {
      if (rr.on !== 'hand') continue;
      if (rr.grow) {
        if (rr.grow.reset && handMatches(rr.grow.reset, h)) j.v = 0;
        else if (handMatches(rr.if, h)) j.v = (j.v || 0) + rr.grow.by;
        if (!rr.do) continue;
      }
      if (!handMatches(rr.if, h)) continue;
      apply(j, rr, null, { kind: 'joker' });
    }
  }
  out.chips = chips; out.mult = mult; out.total = Math.floor(chips * mult);
  return out;
}

/** Fire non-scoring triggers: discard, round_end, boss_defeated. Returns dollars gained. Mutates joker v. */
export function fireTrigger(content, state, on, cards = []) {
  const r = state.round;
  const views = cards.map(c => cardView(content, c));
  const h = newCtx(content, state, [], { cards: views, playedViews: [], heldViews: [], scoringActive: [], type: null, contains: new Set(), playedCount: 0, scoringCount: 0, handsLeft: r?.hands ?? 0, level: 1, distinctFns: 0, distinctProps: 0 });
  let money = 0;
  for (const j of state.jokers) {
    if (r && j.uid === r.disabled) continue;
    for (const rr of content.jokers[j.id].rules) {
      if (rr.on !== on) continue;
      if (!handMatches(rr.if, h)) continue;
      if (on === 'discard' && rr.if && (rr.if.fn || rr.if.prop) && !rr.per) { if (!views.some(v => cardMatches(rr.if, v, h.counters))) continue; }
      if (rr.grow) { if (rr.grow.reset && handMatches(rr.grow.reset, h)) j.v = 0; else j.v = (j.v || 0) + rr.grow.by; }
      if (rr.do?.money) {
        let count = 1;
        if (rr.per) count = countOf(rr.per, h, j, h.counters);
        money += resolve(rr.do.money, j) * count;
      }
    }
  }
  return money;
}
