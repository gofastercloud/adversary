// The roguelike run: map → briefing → battle → debrief/reward → shop/rest/event/whiteboard → … → boss.
// Pure and deterministic: runAction(content, run, action) → { run, events }.
import { rand, randInt, shuffle, weightedPick } from './rng.js';
import * as B from './battle.js';
import { LETTER_TO_PROP } from './content.js';

export const RUN_VERSION = 2;
export class RunError extends Error {}
const bad = (m) => { throw new RunError(m); };
const clone = (x) => structuredClone(x);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

const TYPES = { battle: 'Skirmish', elite: 'Intrusion Set', boss: 'Apex Adversary', shop: 'Procurement', rest: 'Rest & Training', event: 'Event', whiteboard: 'Threat-Modelling Workshop', ttx: 'Tabletop Exercise' };
export const NODE_LABEL = TYPES;

// ───────────────────────────── creation ─────────────────────────────
export function newRun(content, { seed, doctrine = 'architect', assurance = 1, mode = 'run', ttxId = null, profile = {} }) {
  const d = content.doctrines[doctrine]; if (!d) bad('unknown doctrine ' + doctrine);
  const as = content.tuning.assurance[assurance] || content.tuning.assurance[1];
  const run = {
    v: RUN_VERSION, seed, mode, scenario: content.scenarioId, fp: content.fingerprint, doctrine, assurance, rng: {},
    phase: 'map', act: 1, step: 0, node: null, map: [], visited: [],
    res: { cur: d.maxResilience + (as.resilienceBonus || 0), max: d.maxResilience + (as.resilienceBonus || 0) },
    money: d.money, deck: [], nextIid: 0, relics: [d.relic], flags: {}, modelBonus: 0,
    battle: null, reward: null, shop: null, rest: null, event: null, whiteboard: null, briefing: null,
    usedAdv: [], usedEvents: [], stats: { battles: 0, elites: 0, bosses: 0, evictions: 0, cardsAdded: 0, upgrades: 0, removed: 0, bought: 0, wbCorrect: 0, wbTotal: 0, wbPerfect: 0, resLost: 0, fastEvicts: 0, wins: 0, byLetter: {} },
    result: null, ttx: null
  };
  for (const id of d.deck) run.deck.push({ iid: 'd' + run.nextIid++, id, ml: 1 });
  const rl = content.relics[d.relic]?.hooks?.passive?.maxResilience; if (rl) { run.res.max += rl; run.res.cur += rl; }
  if (mode === 'ttx') {
    const t = content.ttx.find(x => x.id === ttxId); if (!t) bad('unknown TTX ' + ttxId);
    run.ttx = { id: ttxId };
    // TTX loadout: starter deck with a few upgrades so facilitators can focus on decisions
    for (const c of run.deck.slice(0, 4)) c.ml = 2;
    run.phase = 'briefing'; run.node = { type: 'ttx', adv: t.adversary.id, tier: t.adversary.tier || 3, ttx: ttxId };
    run.briefing = briefingFor(content, run, run.node);
    return run;
  }
  genMap(content, run);
  return run;
}

function genMap(content, run) {
  const hasWB = content.systems.length > 0;
  const pickTwo = (list) => { const l = shuffle(run.rng, run.seed, 'map', list); return l.slice(0, 2); };
  for (let a = 1; a <= 3; a++) {
    const steps = [];
    steps.push([{ type: 'battle' }]);
    steps.push(pickTwo(hasWB ? ['battle', 'event', 'whiteboard', 'shop'] : ['battle', 'event', 'shop', 'rest']).map(t => ({ type: t })));
    const second = shuffle(run.rng, run.seed, 'map', ['rest', 'battle'])[0];
    steps.push(shuffle(run.rng, run.seed, 'map', ['elite', second]).map(t => ({ type: t })));
    steps.push(pickTwo(hasWB ? ['shop', 'rest', 'event', 'whiteboard'] : ['shop', 'rest', 'event']).map(t => ({ type: t })));
    steps.push([{ type: 'boss' }]);
    run.map.push(steps);
  }
}

// ───────────────────────────── helpers ─────────────────────────────
const newIid = (run) => 'd' + run.nextIid++;
const cardDef = (content, id) => content.cards[id];
function addCard(content, run, id, ml = 1) { run.deck.push({ iid: newIid(run), id, ml }); run.stats.cardsAdded++; }
function gainRelic(content, run, id, events) {
  if (run.relics.includes(id)) return false;
  run.relics.push(id);
  const mr = content.relics[id]?.hooks?.passive?.maxResilience; if (mr) { run.res.max += mr; run.res.cur += mr; }
  events.push({ t: 'relic', id, rarity: content.relics[id]?.rarity });
  return true;
}
const heal = (run, n) => { run.res.cur = Math.min(run.res.max, run.res.cur + n); };

function cardWeight(content, run, c) {
  const rw = { common: 60, uncommon: 30, rare: 10 }[c.rarity] ?? 0; if (!rw) return 0;
  const d = content.doctrines[run.doctrine];
  let w = rw * (d.focus.includes(c.fn) ? 2.2 : 1);
  if (c.type === 'augment') {
    const fits = run.deck.some(x => { const dc = content.cards[x.id]; return dc.type === 'control' && dc.cell && c.base.some(b => b === dc.cell || (b.endsWith('.*') && dc.cell.startsWith(b.slice(0, -1)))); });
    w *= fits ? 2 : 0.15;
  }
  // diminishing returns for duplicates
  const dup = run.deck.filter(x => x.id === c.id).length;
  w *= dup >= 3 ? 0.1 : dup === 2 ? 0.4 : 1;
  return w;
}
function rollCards(content, run, n, bias = {}) {
  const pool = content.cardPool.map(id => content.cards[id]).filter(c => !c.unplayable);
  const out = [];
  for (let i = 0; i < n; i++) {
    const cand = pool.filter(c => !out.includes(c.id)).map(c => ({ c, w: cardWeight(content, run, c) * (bias[c.rarity] || 1) })).filter(x => x.w > 0);
    if (!cand.length) break;
    out.push(weightedPick(run.rng, run.seed, 'reward', cand, x => x.w).c.id);
  }
  return out;
}
function rollRelics(content, run, n, rarityBias = { common: 50, uncommon: 35, rare: 15 }) {
  const pool = content.relicPool.filter(id => !run.relics.includes(id)).map(id => content.relics[id]);
  const out = [];
  for (let i = 0; i < n; i++) {
    const cand = pool.filter(r => !out.includes(r.id));
    if (!cand.length) break;
    out.push(weightedPick(run.rng, run.seed, 'relic', cand, r => rarityBias[r.rarity] || 10).id);
  }
  return out;
}

// ───────────────────────────── nodes ─────────────────────────────
function briefingFor(content, run, node) {
  const meta = content.adversaryMeta[node.adv] || {};
  return { adv: node.adv, name: meta.name || content.adversaries[node.adv]?.name, tier: node.tier, type: node.type, traits: meta.traits || [], blurb: meta.blurb, role: meta.role, motive: meta.motive, note: meta.note, color: meta.color, icon: meta.icon };
}
function chooseAdversary(content, run, type) {
  const act = content.roster?.acts?.[run.act - 1];
  if (!act) bad('scenario has no roster for act ' + run.act);
  const tiers = act.tiers || { battle: 1, elite: 2, boss: 3 };
  let id;
  if (type === 'boss') id = act.boss;
  else {
    const list = (type === 'elite' ? act.elite : act.battle).filter(x => !run.usedAdv.includes(x));
    const pool = list.length ? list : (type === 'elite' ? act.elite : act.battle);
    id = pool[randInt(run.rng, run.seed, 'adv', pool.length)];
  }
  run.usedAdv.push(id);
  return { type, adv: id, tier: tiers[type] };
}

function enterNode(content, run, node, events) {
  run.visited.push({ act: run.act, step: run.step, type: node.type });
  switch (node.type) {
    case 'battle': case 'elite': case 'boss': {
      const n = chooseAdversary(content, run, node.type);
      run.node = n; run.phase = 'briefing'; run.briefing = briefingFor(content, run, n);
      break;
    }
    case 'shop': run.phase = 'shop'; run.shop = makeShop(content, run); break;
    case 'rest': run.phase = 'rest'; run.rest = { done: false }; break;
    case 'event': {
      const pool = Object.keys(content.events).filter(e => !run.usedEvents.includes(e));
      const id = (pool.length ? pool : Object.keys(content.events))[randInt(run.rng, run.seed, 'event', (pool.length ? pool : Object.keys(content.events)).length)];
      run.usedEvents.push(id); run.phase = 'event'; run.event = { id, picked: null };
      break;
    }
    case 'whiteboard': run.phase = 'whiteboard'; run.whiteboard = makeWhiteboard(content, run); break;
    default: bad('unknown node');
  }
}
function advance(content, run, events) {
  run.node = null; run.briefing = null;
  run.step++;
  if (run.step >= run.map[run.act - 1].length) {
    events.push({ t: 'act_cleared', act: run.act, resLost: run.stats.resLost });
    const bossHeal = Math.ceil(run.res.max * 0.5); heal(run, bossHeal);
    run.act++; run.step = 0;
    if (run.act > 3) { finish(content, run, true, events); return; }
  }
  run.phase = 'map';
}

// ───────────────────────────── shop / rest / event / whiteboard ─────────────────────────────
function makeShop(content, run) {
  const sh = content.tuning.shop;
  const cards = rollCards(content, run, 5, { rare: 0.7 }).map(id => ({ kind: 'card', id, cost: Math.round(sh.cardCost[content.cards[id].rarity] * (0.9 + rand(run.rng, run.seed, 'shop') * 0.25)), sold: false }));
  const relics = rollRelics(content, run, 2).map(id => ({ kind: 'relic', id, cost: Math.round(sh.relicCost[content.relics[id].rarity] * (0.9 + rand(run.rng, run.seed, 'shop') * 0.2)), sold: false }));
  return { slots: [...cards, ...relics], removeCost: sh.removeCost + sh.removeStep * run.stats.removed, removed: false, healed: false };
}
function makeWhiteboard(content, run) {
  const sys = content.systems[Math.min(content.systems.length - 1, run.act <= 1 ? 0 : run.act === 2 ? 1 : (run.step % 2))];
  const sysIdx = content.systems.indexOf(sys);
  const used = new Set(run.usedScenarios || []); run.usedScenarios = [...used];
  let pool = sys.scenarios.filter(s => !used.has(s.id));
  if (pool.length < content.tuning.battle.questions) pool = sys.scenarios;
  const picks = shuffle(run.rng, run.seed, 'wb', pool).slice(0, content.tuning.battle.questions || 3);
  for (const p of picks) run.usedScenarios.push(p.id);
  return { system: sysIdx, qs: picks.map(p => p.id), answers: [], done: false };
}
export function wbQuestion(content, run) {
  const w = run.whiteboard; if (!w) return null;
  const sys = content.systems[w.system];
  const idx = w.answers.length;
  return { system: sys, index: idx, total: w.qs.length, scenario: sys.scenarios.find(s => s.id === w.qs[idx]) };
}

function applyRunFx(content, run, fx, events) {
  switch (fx.op) {
    case 'money': run.money = Math.max(0, run.money + fx.n); break;
    case 'resilience': if (fx.n < 0) { run.res.cur = Math.max(1, run.res.cur + fx.n); run.stats.resLost -= fx.n; } else heal(run, fx.n); break;
    case 'maxResilience': run.res.max += fx.n; run.res.cur += fx.n; break;
    case 'addCard': addCard(content, run, fx.id); events.push({ t: 'card_added', id: fx.id }); break;
    case 'addRandomCard': { const id = rollCards(content, run, 1, { [fx.rarity || 'common']: 50 })[0]; if (id) { addCard(content, run, id); events.push({ t: 'card_added', id }); } break; }
    case 'upgradeRandom': { const c = run.deck.filter(x => x.ml < 3 && content.cards[x.id].type !== 'status'); if (c.length) { const t = c[randInt(run.rng, run.seed, 'event', c.length)]; t.ml++; run.stats.upgrades++; events.push({ t: 'upgraded', id: t.id, ml: t.ml }); } break; }
    case 'upgradeCard': { const t = run.deck.find(x => x.id === fx.id && x.ml < 3); if (t) { t.ml++; run.stats.upgrades++; events.push({ t: 'upgraded', id: t.id, ml: t.ml }); } break; }
    case 'addStatus': run.deck.push({ iid: newIid(run), id: fx.id, ml: 1 }); events.push({ t: 'status_added', id: fx.id }); break;
    case 'removeStatus': { const i = run.deck.findIndex(x => x.id === fx.id); if (i >= 0) { run.deck.splice(i, 1); run.stats.removed++; } break; }
    case 'flag': run.flags[fx.id] = true; break;
    case 'relicChance': gainRelic(content, run, fx.id, events); break;
    case 'ifHasCard': for (const f of (run.deck.some(x => x.id === fx.id) ? fx.then : fx.else) || []) applyRunFx(content, run, f, events); break;
    default: bad('unknown run fx ' + fx.op);
  }
}

// ───────────────────────────── battle ↔ run ─────────────────────────────
function startBattle(content, run, events) {
  const n = run.node;
  const ttx = run.mode === 'ttx' ? content.ttx.find(t => t.id === run.ttx.id) : null;
  const bseed = `${run.seed}|b${run.visited.length}|${run.act}.${run.step}`;
  run.battle = B.newBattle(content, {
    seed: bseed, deck: run.deck.filter(c => content.cards[c.id].type !== 'status' || true).map(c => ({ ...c })),
    adversary: { id: n.adv, tier: n.tier, boss: n.type === 'boss', elite: n.type === 'elite' },
    resilience: { cur: run.res.cur, max: run.res.max }, relics: run.relics, doctrine: run.doctrine, assurance: run.assurance,
    flags: run.flags, modelBonus: run.modelBonus, ttx: ttx ? { injects: ttx.injects, objectives: ttx.objectives, rounds: ttx.rounds } : null
  });
  run.flags = {}; run.modelBonus = 0; run.phase = 'battle'; run.briefing = null;
  events.push({ t: 'battle_start', adv: n.adv, tier: n.tier, type: n.type });
}
function finishBattle(content, run, events) {
  const b = run.battle, r = b.result;
  const n = run.node;
  run.stats.resLost += r.resLost; run.stats.evictions += r.evictions; run.stats.fastEvicts += b.stats.fastEvict;
  events.push({ t: 'battle_end', reveals: b.stats.reveals, deploys: b.stats.deploys, maxExposure: b.stats.maxExposure, resEnd: r.resEnd, won: r.won, how: r.how, adv: r.adversary, type: n.type, tier: r.tier, rounds: r.rounds, resLost: r.resLost, exposure: r.exposure, evictions: r.evictions, blocked: r.blocked, cardsPlayed: r.cardsPlayed, noReveal: r.noReveal, jewelSafe: r.jewelSafe, debt: r.debt, typesPlayed: b.stats.typesPlayed, fnsPlayed: b.stats.fnsPlayed, propsPlayed: b.stats.propsPlayed, augments: b.stats.augments, assetsDown: r.assetsDown, act: run.act, ttxScore: r.ttxScore, assurance: run.assurance, doctrine: run.doctrine });
  if (!r.won) { run.res.cur = 0; finish(content, run, false, events); return; }
  run.res.cur = clamp(r.resEnd, 1, run.res.max);
  if (r.spent?.length) { run.deck = run.deck.filter(c => !r.spent.includes(c.iid)); events.push({ t: 'consumed_run', n: r.spent.length }); }
  run.money += r.moneyDelta;
  run.stats.battles++; run.stats.wins++;
  if (n.type === 'elite') run.stats.elites++; if (n.type === 'boss') run.stats.bosses++;
  if (run.mode === 'ttx') { finishTtx(content, run, b, events); return; }
  // rewards
  const rw = content.tuning.rewards; const tIdx = clamp(run.act - 1, 0, 2);
  const base = n.type === 'boss' ? rw.boss[tIdx] : n.type === 'elite' ? rw.elite[tIdx] : rw.battle[tIdx];
  const fast = r.how === 'evicted' ? rw.fastBonus : 0;
  const noDamage = r.resLost === 0 ? 5 : 0;
  const money = base + fast + noDamage;
  run.money += money;
  const bias = n.type === 'elite' ? { uncommon: 1.6, rare: 2.5 } : n.type === 'boss' ? { rare: 3 } : {};
  run.reward = { adv: r.adversary, type: n.type, how: r.how, money, fast, noDamage, resLost: r.resLost, cards: rollCards(content, run, 3, bias), relics: n.type === 'boss' || n.type === 'elite' ? rollRelics(content, run, n.type === 'boss' ? 3 : 1, n.type === 'boss' ? { common: 20, uncommon: 45, rare: 35 } : undefined) : [], cardTaken: false, relicTaken: false, debt: r.debt, harvested: r.harvested };
  run.phase = 'reward';
  if (n.type === 'boss') { run.res.max += 4; run.res.cur = Math.min(run.res.max, run.res.cur + 4); }
}
function finishTtx(content, run, b, events) {
  const t = content.ttx.find(x => x.id === run.ttx.id);
  const objs = b.result.objectives || [];
  const pts = objs.reduce((s, o) => s + o.points, 0) + b.ttx.score + (b.result.how === 'evicted' ? 40 : 20) + b.res.cur;
  run.ttx.result = { objectives: objs, decisions: b.ttx.log, score: pts, max: t.maxScore || 300 };
  events.push({ t: 'ttx_complete', id: run.ttx.id, score: pts, objectivesMet: objs.filter(o => o.ok).length, objectives: objs.length, perfect: objs.length > 0 && objs.every(o => o.ok) });
  finish(content, run, true, events);
}

export function finish(content, run, won, events) {
  run.phase = won ? 'won' : 'lost';
  const s = run.stats;
  const mult = 1 + 0.25 * run.assurance;
  const base = s.battles * 100 + (run.act - (won ? 1 : 1)) * 500 + run.res.cur * 5 + run.money + (won ? 3000 : 0) + s.wbCorrect * 20 + s.fastEvicts * 30 + s.elites * 100 + s.bosses * 400;
  const points = Math.round(base * mult) + (run.ttx?.result?.score || 0) * 10;
  run.result = { won, act: Math.min(run.act, 3), battles: s.battles, bosses: s.bosses, points, assurance: run.assurance, doctrine: run.doctrine, scenario: run.scenario, mode: run.mode, deckSize: run.deck.length, relics: run.relics.length };
  const byFn = {}, byId = {}; let ml3 = 0, debt = 0;
  for (const c of run.deck) { const d = content.cards[c.id]; byFn[d.fn] = (byFn[d.fn] || 0) + 1; byId[c.id] = (byId[c.id] || 0) + 1; if (c.ml >= 3) ml3++; if (c.id === 'status.techdebt') debt++; }
  const playable = run.deck.length - debt;
  const topFnShare = playable ? Math.max(0, ...Object.entries(byFn).filter(([k]) => k).map(([, v]) => v)) / run.deck.length : 0;
  events.push({ t: won ? 'run_won' : 'run_lost', ...run.result, stats: s, deck: { size: run.deck.length, maxDup: Math.max(0, ...Object.values(byId)), techdebt: debt, ml3, topFnShare: +topFnShare.toFixed(2), fns: Object.keys(byFn).length }, resEnd: run.res.cur, resMax: run.res.max, relicCount: run.relics.length, money: run.money });
}

// ───────────────────────────── dispatcher ─────────────────────────────
export function runAction(content, run0, action, { inPlace = false } = {}) {
  const run = inPlace ? run0 : clone(run0);
  const events = [];
  const ph = run.phase;
  switch (action.type) {
    case 'CHOOSE': {
      if (ph !== 'map') bad('Not on the map.');
      const opts = run.map[run.act - 1][run.step];
      const node = opts[action.index ?? 0]; if (!node) bad('No such node.');
      enterNode(content, run, node, events); break;
    }
    case 'START_BATTLE': { if (ph !== 'briefing') bad('Nothing to start.'); startBattle(content, run, events); break; }
    case 'BATTLE': {
      if (ph !== 'battle') bad('Not in battle.');
      const be = B.battleAction(content, run.battle, action.action);
      for (const e of be) events.push({ ...e, from: 'battle' });
      if (run.battle.over) finishBattle(content, run, events);
      break;
    }
    case 'TAKE_CARD': {
      if (ph !== 'reward' || run.reward.cardTaken) bad('No card to take.');
      if (!run.reward.cards.includes(action.id)) bad('Not offered.');
      addCard(content, run, action.id); run.reward.cardTaken = true; events.push({ t: 'card_added', id: action.id }); break;
    }
    case 'SKIP_CARD': { if (ph !== 'reward') bad('No reward.'); run.reward.cardTaken = true; events.push({ t: 'card_skipped' }); break; }
    case 'TAKE_RELIC': {
      if (ph !== 'reward' || run.reward.relicTaken) bad('No relic to take.');
      if (!run.reward.relics.includes(action.id)) bad('Not offered.');
      gainRelic(content, run, action.id, events); run.reward.relicTaken = true; break;
    }
    case 'SKIP_RELIC': { if (ph !== 'reward') bad('No reward.'); run.reward.relicTaken = true; break; }
    case 'DONE_REWARD': {
      if (ph !== 'reward') bad('No reward.');
      if (!run.reward.cardTaken) bad('Take or skip a card first.');
      if (run.reward.relics.length && !run.reward.relicTaken) bad('Take or skip a relic first.');
      run.reward = null; advance(content, run, events); break;
    }
    case 'BUY': {
      if (ph !== 'shop') bad('Not in a shop.');
      const slot = run.shop.slots[action.index]; if (!slot || slot.sold) bad('Nothing there.');
      if (run.money < slot.cost) bad('Not enough budget.');
      if (slot.kind === 'card') addCard(content, run, slot.id); else if (!gainRelic(content, run, slot.id, events)) bad('Already owned.');
      run.money -= slot.cost; slot.sold = true; run.stats.bought++; events.push({ t: 'shop_buy', kind: slot.kind, id: slot.id, cost: slot.cost }); break;
    }
    case 'REMOVE': {
      if (ph !== 'shop' || run.shop.removed) bad('Cannot remove.');
      if (run.money < run.shop.removeCost) bad('Not enough budget.');
      const i = run.deck.findIndex(c => c.iid === action.iid); if (i < 0) bad('No such card.');
      run.money -= run.shop.removeCost; run.deck.splice(i, 1); run.shop.removed = true; run.stats.removed++; events.push({ t: 'card_removed', id: action.iid }); break;
    }
    case 'HEAL_SHOP': {
      if (ph !== 'shop' || run.shop.healed) bad('Cannot heal.');
      const sh = content.tuning.shop; if (run.money < sh.healCost) bad('Not enough budget.');
      run.money -= sh.healCost; heal(run, sh.healAmount); run.shop.healed = true; break;
    }
    case 'LEAVE': {
      if (ph !== 'shop' && ph !== 'rest') bad('Nothing to leave.');
      if (ph === 'rest' && !run.rest.done) bad('Choose an option first.');
      run.shop = null; run.rest = null; advance(content, run, events); break;
    }
    case 'REST': {
      if (ph !== 'rest' || run.rest.done) bad('Cannot rest.');
      if (action.choice === 'heal') heal(run, Math.ceil(run.res.max * 0.3));
      else if (action.choice === 'upgrade') { const c = run.deck.find(x => x.iid === action.iid); if (!c || c.ml >= 3 || content.cards[c.id].type === 'status') bad('Cannot upgrade that.'); c.ml++; run.stats.upgrades++; events.push({ t: 'upgraded', id: c.id, ml: c.ml }); }
      else if (action.choice === 'remove') { const i = run.deck.findIndex(x => x.iid === action.iid); if (i < 0) bad('No such card.'); run.deck.splice(i, 1); run.stats.removed++; events.push({ t: 'card_removed', id: action.iid }); }
      else bad('Unknown rest option.');
      run.rest.done = true; break;
    }
    case 'EVENT': {
      if (ph !== 'event' || run.event.picked != null) bad('No event choice.');
      const e = content.events[run.event.id]; const ch = e.choices[action.index]; if (!ch) bad('No such choice.');
      for (const fx of ch.fx) applyRunFx(content, run, fx, events);
      run.event.picked = action.index; events.push({ t: 'event_choice', id: e.id, index: action.index }); break;
    }
    case 'EVENT_DONE': { if (ph !== 'event' || run.event.picked == null) bad('Choose first.'); run.event = null; advance(content, run, events); break; }
    case 'WB_ANSWER': {
      if (ph !== 'whiteboard') bad('Not in a workshop.');
      const q = wbQuestion(content, run); if (!q || q.index >= q.total) bad('No question.');
      if (!'STRIDE'.includes(action.letter) || action.letter.length !== 1) bad('Bad answer.');
      const ok = action.letter === q.scenario.answer;
      run.whiteboard.answers.push({ id: q.scenario.id, letter: action.letter, ok });
      run.stats.wbTotal++; if (ok) run.stats.wbCorrect++;
      const L = q.scenario.answer; run.stats.byLetter[L] = run.stats.byLetter[L] || { n: 0, ok: 0 }; run.stats.byLetter[L].n++; if (ok) run.stats.byLetter[L].ok++;
      events.push({ t: 'wb_answer', ok, letter: L, id: q.scenario.id });
      break;
    }
    case 'WB_DONE': {
      if (ph !== 'whiteboard') bad('Not in a workshop.');
      const w = run.whiteboard; if (w.answers.length < w.qs.length) bad('Answer all questions.');
      const correct = w.answers.filter(a => a.ok).length;
      run.money += correct * 12; run.modelBonus += correct;
      if (correct === w.qs.length) { run.stats.wbPerfect++; heal(run, 4); events.push({ t: 'wb_perfect', n: correct }); }
      events.push({ t: 'wb_done', correct, total: w.qs.length });
      run.whiteboard = null; advance(content, run, events); break;
    }
    case 'ABANDON': { finish(content, run, false, events); run.result.abandoned = true; break; }
    default: bad('unknown action ' + action.type);
  }
  return { run, events };
}

export function tryRunAction(content, run, action, opts) {
  try { return { ok: true, ...runAction(content, run, action, opts) }; }
  catch (e) { if (e instanceof RunError || e instanceof B.GameError) return { ok: false, error: e.message }; throw e; }
}

/** Replay an action log from a fresh run. Stops (and reports) at the first illegal action. */
export function replay(content, init, actions) {
  let run = newRun(content, init);
  const all = [];
  for (let i = 0; i < actions.length; i++) {
    const r = tryRunAction(content, run, actions[i], { inPlace: true });
    if (!r.ok) return { ok: false, at: i, error: r.error, run, events: all };
    run = r.run; all.push(...r.events);
  }
  return { ok: true, run, events: all };
}
