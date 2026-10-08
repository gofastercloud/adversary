// Balance experiments. Each returns plain data; lab/report.mjs renders it. All randomness is seeded (reproducible).
import { Pool } from './pool.mjs';
import { getContent, SKILL_LADDER } from './sim.mjs';
import { mean, rate, groupBy, pairedDiff, wilson } from './stats.mjs';
import { listScenarios } from '../scripts/lib/load.mjs';

export const DOCTRINES = ['architect', 'hunter', 'phoenix', 'governor', 'responder'];
const seedOf = (...p) => p.join('|');

/** Skill ladder: win rate of full runs by skill, scenario, doctrine. A healthy game climbs steeply: random ≈ 0, expert ≫ standard. */
export async function skillLadder(pool, { n = 40, scenarios = ['enterprise'], skills = ['random', 'novice', 'standard', 'sharp'], assurance = 1, overrides = null, keepSnaps = false } = {}) {
  const specs = [];
  for (const scenario of scenarios) for (const skill of skills) for (const doctrine of DOCTRINES) for (let i = 0; i < n; i++) specs.push({ scenario, skill, doctrine, assurance, seed: seedOf('ladder', scenario, doctrine, i), overrides, keepSnaps });
  const out = await pool.map('run', specs, { planner: skills.includes('expert') });
  return out;
}

/** Representative decks: snapshots taken at battle start from standard-skill runs (what players actually bring). */
export function pickSnaps(runs, { act = null, node = null } = {}) {
  const out = []; for (const r of runs) for (const s of r.snaps || []) if ((act == null || s.act === act) && (node == null || s.node === node)) out.push({ ...s, doctrine: r.doctrine, scenario: r.scenario });
  return out;
}

/** Per-adversary difficulty at representative decks, for each skill. */
export async function adversaryMatrix(pool, { scenario = 'enterprise', snaps, skills = ['random', 'standard', 'sharp'], perAdv = 40, overrides = null, assurance = 1 } = {}) {
  const c = getContent(scenario, overrides); const advs = Object.keys(c.adversaryMeta);
  const specs = [];
  for (const adv of advs) {
    const tier = c.adversaryMeta[adv].tier;
    for (const skill of skills) for (let i = 0; i < (skill === 'expert' ? Math.max(4, Math.round(perAdv / 6)) : perAdv); i++) {
      const sn = snaps.length ? snaps[(i * 7919 + adv.length * 13) % snaps.length] : null;
      specs.push({ scenario, adv, tier, skill, assurance, doctrine: sn?.doctrine || DOCTRINES[i % 5], deck: sn?.deck, resilience: sn?.res, relics: sn?.relics, seed: seedOf('adv', scenario, adv, i), overrides });
    }
  }
  const out = await pool.map('battle', specs, { planner: skills.includes('expert') });
  return { advs: advs.map(a => ({ id: a, name: c.adversaryMeta[a].name, tier: c.adversaryMeta[a].tier, goal: c.adversaryMeta[a].goal })), results: out };
}

/** Card power by paired ablation: same seeds, same base deck, one slot swapped for the card. Positive = card raises win rate. */
export async function cardPower(pool, { scenario = 'enterprise', snaps, cards = null, pairs = 60, skill = 'standard', overrides = null } = {}) {
  const c = getContent(scenario, overrides);
  const ids = cards || c.cardPool.filter(id => c.cards[id].type !== 'status');
  const advs = Object.keys(c.adversaryMeta);
  const base = [], mod = [];
  const mulberry = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const specsFor = (id) => {
    const rnd = mulberry([...id].reduce((a, ch) => a * 31 + ch.charCodeAt(0) | 0, 7));
    const res = [];
    for (let i = 0; i < pairs; i++) {
      const sn = snaps[Math.floor(rnd() * snaps.length)]; const adv = advs[Math.floor(rnd() * advs.length)];
      const drop = Math.floor(rnd() * sn.deck.length);
      const deckA = sn.deck.map(x => ({ ...x })); const deckB = sn.deck.map((x, j) => (j === drop ? { id, ml: sn.deck[drop].ml } : { ...x }));
      const common = { scenario, adv, tier: c.adversaryMeta[adv].tier, skill, doctrine: sn.doctrine, resilience: sn.res, relics: sn.relics, assurance: 1, seed: seedOf('card', id, i), overrides };
      res.push([{ ...common, deck: deckA }, { ...common, deck: deckB }]);
    }
    return res;
  };
  const all = []; const idx = [];
  for (const id of ids) for (const [a, b] of specsFor(id)) { all.push(a, b); idx.push(id); }
  const out = await pool.map('battle', all);
  const byCard = new Map();
  for (let i = 0; i < idx.length; i++) { const a = out[2 * i], b = out[2 * i + 1]; (byCard.get(idx[i]) || byCard.set(idx[i], { a: [], b: [] }).get(idx[i])); byCard.get(idx[i]).a.push(a.won ? 1 : 0); byCard.get(idx[i]).b.push(b.won ? 1 : 0); }
  return ids.map(id => { const { a, b } = byCard.get(id); const d = pairedDiff(b, a); return { id, name: c.cards[id].name, type: c.cards[id].type, rarity: c.cards[id].rarity, fn: c.cards[id].fn, lift: d.diff, lo: d.lo, hi: d.hi, n: d.n }; }).sort((x, y) => y.lift - x.lift);
}

/** Relic power by paired ablation (relic added vs not). */
export async function relicPower(pool, { scenario = 'enterprise', snaps, pairs = 80, skill = 'standard', overrides = null } = {}) {
  const c = getContent(scenario, overrides); const advs = Object.keys(c.adversaryMeta); const ids = Object.keys(c.relics).filter(r => c.relics[r].rarity !== 'starter');
  const all = [], idx = [];
  for (const id of ids) for (let i = 0; i < pairs; i++) {
    const sn = snaps[(i * 131 + id.length) % snaps.length]; const adv = advs[(i * 17 + id.length) % advs.length];
    const common = { scenario, adv, tier: c.adversaryMeta[adv].tier, skill, doctrine: sn.doctrine, resilience: sn.res, deck: sn.deck, assurance: 1, seed: seedOf('relic', id, i), overrides };
    all.push({ ...common, relics: sn.relics.filter(x => x !== id) }, { ...common, relics: [...sn.relics.filter(x => x !== id), id] }); idx.push(id);
  }
  const out = await pool.map('battle', all);
  const m = new Map();
  for (let i = 0; i < idx.length; i++) { const e = m.get(idx[i]) || m.set(idx[i], { a: [], b: [] }).get(idx[i]); e.a.push(out[2 * i].won ? 1 : 0); e.b.push(out[2 * i + 1].won ? 1 : 0); }
  return ids.map(id => { const d = pairedDiff(m.get(id).b, m.get(id).a); return { id, name: c.relics[id].name, rarity: c.relics[id].rarity, lift: d.diff, lo: d.lo, hi: d.hi, n: d.n }; }).sort((x, y) => y.lift - x.lift);
}

/** Summaries over run results. */
export function summariseRuns(runs) {
  const by = (f) => [...groupBy(runs, f)].map(([k, v]) => ({ key: k, n: v.length, win: rate(v), act: mean(v.map(r => r.act)), battles: mean(v.map(r => r.battles)) }));
  return { overall: rate(runs), bySkill: by(r => r.skill), byDoctrine: by(r => r.doctrine), byScenario: by(r => r.scenario), bySkillDoctrine: by(r => r.skill + '/' + r.doctrine) };
}
export function summariseBattles(res) {
  const by = (f) => [...groupBy(res, f)].map(([k, v]) => ({ key: k, n: v.length, win: rate(v), goal: wilson(v.filter(r => r.how === 'goal').length, v.length), rounds: mean(v.map(r => r.rounds)), resLost: mean(v.map(r => r.resLost)) }));
  return { byAdvSkill: by(r => r.adv + '|' + r.skill), bySkill: by(r => r.skill), byHow: by(r => (r.won ? 'W:' : 'L:') + r.how) };
}
