// Synthetic "what a player has by now" decks, so balance can be measured at any point of a run without playing the run.
// Built from the doctrine's starter deck plus reward picks (3 offers per battle, taken with the smart run policy) and rest upgrades.
import { makeRng } from './rng.mjs';
import { cardScore, RUN_POLICIES } from './agents/run.mjs';

const RW = { common: 60, uncommon: 30, rare: 10 };
function offer(content, rng, n = 3) {
  const pool = content.cardPool.map(id => content.cards[id]).filter(c => !c.unplayable && c.type !== 'status');
  const out = [];
  while (out.length < n) { const tot = pool.reduce((s, c) => s + (RW[c.rarity] || 20), 0); let r = rng() * tot; const c = pool.find(c => (r -= (RW[c.rarity] || 20)) <= 0) || pool[0]; if (!out.includes(c.id)) out.push(c.id); }
  return out;
}
/** Deck at the start of `node` ('battle'|'elite'|'boss') in `act` (1-3) for a doctrine. Deterministic in seed. */
export function deckAt(content, doctrineId, act, node, seed, { pol = RUN_POLICIES.standard } = {}) {
  const rng = makeRng('deck|' + seed); const d = content.doctrines[doctrineId];
  const run = { doctrine: doctrineId, act, deck: d.deck.map((id, i) => ({ iid: 'd' + i, id, ml: 1 })), res: { cur: d.maxResilience, max: d.maxResilience }, money: 0, relics: d.relic ? [d.relic] : [], roster: content.roster };
  // battles faced before this node: act1 ≈ 3 battles + elite + boss; each grants a reward; rests grant upgrades
  const prior = (act - 1) * 5 + (node === 'battle' ? 1 : node === 'elite' ? 3 : 4) + (act > 1 ? 0 : 0);
  for (let i = 0; i < prior; i++) {
    run.act = Math.min(3, 1 + Math.floor(i / 5));
    const offers = offer(content, rng); const ranked = offers.map(id => [id, cardScore(content, run, id, pol)]).sort((a, b) => b[1] - a[1]);
    if (ranked[0][1] > 1.2 + Math.max(0, run.deck.length - 18) * 0.3) run.deck.push({ iid: 'r' + i, id: ranked[0][0], ml: 1 });
    if (i % 4 === 3) { const up = run.deck.filter(c => c.ml < 3 && content.cards[c.id].type !== 'status').sort((a, b) => ((content.cards[b.id].ward ? 3 : 0) + (content.cards[b.id].detect ? 2 : 0)) - ((content.cards[a.id].ward ? 3 : 0) + (content.cards[a.id].detect ? 2 : 0)))[0]; if (up) up.ml++; }
  }
  run.act = act;
  const maxRes = Math.round(d.maxResilience * (content.tuning.balance?.resScale || 1)) + (act - 1) * 4;
  const relics = run.relics.slice(); const relicPool = content.relicPool;
  for (let i = 0; i < act - 1 + (node === 'boss' ? 1 : 0); i++) { const r = relicPool[rng.int(relicPool.length)]; if (!relics.includes(r)) relics.push(r); }
  return { deck: run.deck.map(c => ({ id: c.id, ml: c.ml })), res: { cur: Math.round(maxRes * (0.78 + 0.2 * rng())), max: maxRes }, relics, doctrine: doctrineId };
}
