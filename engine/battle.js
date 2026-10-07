// ADVERSARY battle engine: a deterministic, JSON-serialisable two-sided card battle.
//
//   Defender (player): deploys controls on assets, plays actions, runs policies. Slay-the-Spire style
//                      hand cycling (draw 5, discard the rest) with Hearthstone-style persistent board.
//   Adversary (AI):    pilots a deck of real ATT&CK techniques along the kill chain. Footholds are hidden
//                      until detected. Its next move is telegraphed as an *intent* whose fidelity depends
//                      on your intel.
//
// Win: the adversary's Exposure reaches its maximum (evicted) OR the operation window closes with
// everything standing. Lose: a crown-jewel asset is destroyed or Resilience reaches 0.
import { rand, randInt, shuffle } from './rng.js';
import { compileDeck, TACTIC_ORDER } from './tactics.js';
import { LETTER_TO_PROP } from './content.js';

export class GameError extends Error {}
const bad = (m) => { throw new GameError(m); };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const STRIDES = ['S', 'T', 'R', 'I', 'D', 'E'];

/** Fallback battlefield when a scenario has no assets (tutorial, tests). */
export const DEFAULT_ASSETS = [
  { id: 'mail', name: 'Email Gateway', kind: 'email', zone: 'Corporate', hp: 6, jewel: false, exposed: true, icon: 'mail', desc: 'Inbound mail and attachments.', adjacent: ['ws', 'idp'] },
  { id: 'ws', name: 'Staff Workstations', kind: 'endpoint', zone: 'Corporate', hp: 8, jewel: false, exposed: true, icon: 'laptop', desc: 'Laptops and desktops.', adjacent: ['mail', 'idp', 'files'] },
  { id: 'idp', name: 'Identity Provider', kind: 'identity', zone: 'Core', hp: 8, jewel: false, exposed: false, icon: 'id-card', desc: 'Directory and SSO.', adjacent: ['mail', 'ws', 'files', 'db'] },
  { id: 'files', name: 'File Servers', kind: 'server', zone: 'Core', hp: 8, jewel: false, exposed: false, icon: 'server', desc: 'Shared documents.', adjacent: ['ws', 'idp', 'backup'] },
  { id: 'db', name: 'Customer Database', kind: 'data', zone: 'Core', hp: 10, jewel: true, exposed: false, icon: 'database', desc: 'Crown-jewel records.', adjacent: ['idp', 'backup'] },
  { id: 'backup', name: 'Backup Platform', kind: 'backup', zone: 'Core', hp: 6, jewel: false, exposed: false, icon: 'database-backup', desc: 'Backups.', adjacent: ['files', 'db'] }
];

const SENSITIVE = new Set(['server', 'data', 'identity', 'cloud', 'backup', 'ot']);

// ───────────────────────────── card scaling ─────────────────────────────
export function scaleCard(def, ml = 1) {
  const e = JSON.parse(JSON.stringify(def));
  const up = ml - 1;
  if (up > 0) {
    if (e.ward) { const k = Object.keys(e.ward)[0]; e.ward[k] += up; }
    if (e.detect) e.detect.str += up;
    if (e.aegis) e.aegis.revive += up * 2;
    for (const f of e.fx || []) {
      if (['heal', 'shield', 'resilience', 'exposure', 'evict', 'evictPrivileged', 'intel'].includes(f.op) && f.n) f.n += up;
      if (f.op === 'reveal') f.str = (f.str ?? 3) + up;
      if (f.op === 'scanKinds') f.str = (f.str ?? 3) + up;
    }
  }
  if (ml >= 3 && e.cost > 1) e.cost -= 1;
  return e;
}

// ───────────────────────────── creation ─────────────────────────────
export function newBattle(content, o) {
  const T = content.tuning, bt = T.battle;
  const tier = T.adversary.tiers[o.adversary.tier || 1];
  const assur = T.assurance[o.assurance ?? 1];
  const advData = content.adversaries[o.adversary.id];
  if (!advData) bad('unknown adversary ' + o.adversary.id);
  const meta = content.adversaryMeta[o.adversary.id] || {};
  const seed = o.seed;

  const b = {
    v: 2, seed, rng: {}, round: 0, phase: 'defender', over: false, result: null,
    res: { cur: o.resilience.cur, max: o.resilience.max }, expo: { cur: 0, max: tier.exposureMax + (((content.adversaryMeta[o.adversary.id] || {}).balance || {}).exposure || 0) },
    energy: { cur: 0, max: bt.energy }, energyNext: 0,
    cards: {}, draw: [], hand: [], discard: [], board: [],
    assets: [], controls: [], footholds: [], ghosts: [], policies: [],
    relics: o.relics || [], flags: { ...(o.flags || {}) }, intel: 0, powerUsed: false, discountUsed: false, policyFree: false, soarUsed: false, exfilShield: 0, resLostRound: 0, revived: false,
    nid: { f: 1, k: 1, a: 0 }, moneyDelta: 0,
    adv: { id: o.adversary.id, name: advData.name, tier: o.adversary.tier || 1, boss: !!o.adversary.boss, elite: !!o.adversary.elite, traits: meta.traits || [], cards: {}, draw: [], hand: [], discard: [], intent: null, prep: 0, creds: 0, mapped: false, harvested: 0, phaseFired: [], firstBreachDone: false, energyBonusNext: 0, played: [] },
    doctrine: o.doctrine || null, ttx: null, assurance: o.assurance ?? 1, firstRevealRound: null, energyBonus: o.energyBonus || 0,
    stats: { cardsPlayed: 0, reveals: 0, evictions: 0, blocked: 0, deploys: 0, assetsDown: 0, resLost: 0, dataLost: 0, maxExposure: 0, typesPlayed: {}, fnsPlayed: {}, propsPlayed: {}, augments: 0, fastEvict: 0, noReveal: true },
    events: []
  };
  // assets
  const src = content.assets?.length ? content.assets : DEFAULT_ASSETS;
  for (const a of src) b.assets.push({ id: a.id, name: a.name, kind: a.kind, zone: a.zone, icon: a.icon, desc: a.desc, max: a.hp, hp: a.hp, jewel: !!a.jewel, exposed: !!a.exposed, adjacent: a.adjacent.slice(), slots: bt.assetSlots, isolated: false, down: false, staged: false, mapped: false, blocked: false, baseWard: 0, shield: 0, shieldUsed: false, canaryUsed: false });
  // player deck
  for (const c of o.deck) b.cards[c.iid] = { id: c.id, ml: c.ml || 1 };
  b.draw = shuffle(b.rng, seed, 'deck', o.deck.map(c => c.iid));
  if (o.drawOrder) b.draw = [...o.drawOrder, ...b.draw.filter(i => !o.drawOrder.includes(i))];
  // adversary deck
  const deck = compileDeck(advData, { tier: b.adv.tier, size: 22, assessed: meta.assessed || [], techTable: content.techs, goal: b0goal(content, meta), baselineSlots: content.tuning.adversary.baselineSlots || undefined, goalSlots: content.tuning.adversary.goalSlots ?? 2, rand: o.advOrder ? null : () => rand(b.rng, seed, 'adv-baseline') });
  const abal = meta.balance || {};   // per-adversary calibration knobs (lab optimiser): goalNeed, energy, power, exposure
  const bonus = tier.powerBonus + (assur.advPower || 0) + (abal.power || 0);
  deck.forEach((c, i) => {
    const uid = 'a' + i;
    const card = { ...c, uid };
    if (card.power > 0 && ['breach', 'spread', 'strike', 'escalate', 'exfil', 'impair'].includes(card.kind)) card.power = Math.max(1, card.power + bonus);
    b.adv.cards[uid] = card;
  });
  b.adv.draw = shuffle(b.rng, seed, 'adv-deck', Object.keys(b.adv.cards));
  if (o.advOrder) { const first = o.advOrder.map(t => Object.values(b.adv.cards).find(c => c.id === t)?.uid).filter(Boolean); b.adv.draw = [...first, ...b.adv.draw.filter(u => !first.includes(u))]; }
  b.adv.exposureBase = b.expo.max;
  // goal: the adversary's win condition (not used in the scripted tutorial or TTX scenarios)
  const gdef = !o.advOrder && !o.ttx && content.tuning.goals?.[meta.goal];
  if (gdef) b.goal = { kind: meta.goal, rule: gdef.rule, need: Math.max(1, gdef.need[Math.min(2, b.adv.tier - 1)] + (assur.goalNeed || 0) + (abal.goalNeed || 0)), prog: 0 };

  // start-of-battle effects
  for (let i = 0; i < (o.modelBonus || 0); i++) { const a = b.assets[randInt(b.rng, seed, 'model', b.assets.length)]; a.baseWard += 1; }
  for (const r of b.relics) for (const h of content.relics[r]?.hooks?.battleStart || []) relicFx(content, b, h);
  const startFoot = (meta.traits || []).filter(t => t.op === 'startFootholds').reduce((s, t) => s + t.n, 0) + (assur.startFoothold || 0) + (b.flags.preBreach ? 1 : 0);
  for (let i = 0; i < startFoot; i++) plantFoothold(content, b, null, { reason: 'prepositioned' });
  if (b.flags.vendorFoothold) plantFoothold(content, b, b.assets.find(a => a.kind === 'vendor')?.id || null, { reason: 'trusted relationship' });
  if (b.flags.intel1) b.intelBonus = 1;
  if (o.ttx) b.ttx = JSON.parse(JSON.stringify(o.ttx)), b.ttx.score = 0, b.ttx.log = [], b.ttx.done = [], b.ttx.pending = null;
  b.tutorial = o.tutorial || null;
  advDrawAndPlan(content, b);
  startRound(content, b);
  return b;
}

// ───────────────────────────── helpers ─────────────────────────────
const ev = (b, e) => { b.events.push(e); if (b.obs) b.obs(e); return e; };   // b.obs is a lab-only observer (never serialised)
export const asset = (b, id) => b.assets.find(a => a.id === id);
const foot = (b, id) => b.footholds.find(f => f.id === id);
const def = (content, b, iid) => content.cards[b.cards[iid].id];
const mlOf = (b, iid) => b.cards[iid].ml || 1;
export const effCard = (content, b, iid) => scaleCard(def(content, b, iid), mlOf(b, iid));

function relicPassive(content, b, key) {
  let v = 0;
  for (const r of b.relics) { const p = content.relics[r]?.hooks?.passive; if (p && p[key] != null && typeof p[key] === 'number') v += p[key]; }
  return v;
}
const relicObj = (content, b, key) => b.relics.map(r => content.relics[r]?.hooks?.passive?.[key]).filter(Boolean);
function auras(content, b) {
  const a = { ward: {}, advTax: [], stealthMinus: 0, exfilMinus: 0, shield: 0, onReveal: null, layered: null, protectBonus: 0, startReveal: 0, resilienceShield: 0 };
  const add = (au) => {
    for (const [k, v] of Object.entries(au.ward || {})) a.ward[k] = (a.ward[k] || 0) + v;
    if (au.advTax) a.advTax.push(au.advTax);
    a.stealthMinus += au.stealthMinus || 0; a.exfilMinus += au.exfilMinus || 0; a.shield += au.shield || 0;
    a.protectBonus += au.protectBonus || 0; a.startReveal += au.startReveal || 0; a.resilienceShield += au.resilienceShield || 0;
    if (au.onReveal) a.onReveal = au.onReveal; if (au.layered) a.layered = au.layered;
  };
  for (const p of b.policies) add(scaleCard(content.cards[p.id], p.ml).aura || {});
  for (const r of b.relics) { const t = content.relics[r]?.hooks?.passive?.advTax; if (t) a.advTax.push(t); }
  return a;
}
export function activeControls(b, assetId) {
  const a = asset(b, assetId);
  if (!a || a.down) return [];
  return b.controls.filter(k => k.asset === assetId && !k.disabledBy);
}
function ctrlStats(content, b, k) {
  const e = scaleCard(content.cards[k.card], k.ml);
  const out = { ward: { ...(e.ward || {}) }, mit: new Set(e.mit || []), detect: e.detect ? { ...e.detect } : null, flags: new Set(e.flags || []), resists: new Set(), resistSrc: {}, ctl: new Set(content.cards[k.card].ctl || []), cov: content.cards[k.card].cov || null, aegis: e.aegis ? { ...e.aegis } : null, privBonus: e.privBonus || 0, expert: [] };
  for (const au of k.augs) {
    const ae = scaleCard(content.cards[au.card], au.ml).aug || {};
    for (const [s, v] of Object.entries(ae.ward || {})) out.ward[s] = (out.ward[s] || 0) + v;
    for (const m of ae.mit || []) out.mit.add(m);
    for (const c of content.cards[au.card].ctl || []) out.ctl.add(c);
    for (const r of ae.resists || []) { out.resists.add(r); out.resistSrc[r] = au.card; }
    for (const x of ae.expert || []) { out.resists.add(x.tech); out.resistSrc[x.tech] = au.card; }
    for (const k of ['protect', 'detect']) for (const [t, sc] of Object.entries(ae.cov?.[k] || {})) { out.cov = out.cov || { protect: {}, detect: {} }; out.cov[k] = { ...out.cov[k], [t]: Math.max(sc, out.cov[k]?.[t] || 0) }; }
    for (const f of ae.flags || []) out.flags.add(f);
    if (out.detect) { out.detect.str += ae.detectStr || 0; out.detect.n += ae.detectN || 0; }
    out.privBonus += ae.privBonus || 0;
    if (ae.aegis && out.aegis) out.aegis.revive += ae.aegis.revive;
  }
  return out;
}

/** Explainable ward: total plus the reasons, so the UI can show *why* an attack was stopped. */
export function wardFor(content, b, assetId, card, opts = {}) {
  const A = asset(b, assetId);
  const au = auras(content, b);
  const why = [];
  let total = 0;
  const S = card.stride;
  const ctrls = activeControls(b, assetId);
  let matched = 0;
  for (const k of ctrls) {
    const st = ctrlStats(content, b, k);
    let w = st.ward[S] || 0;
    if (k.card.startsWith('c.protect.') && au.protectBonus && st.ward[Object.keys(st.ward)[0]]) { /* E8 uplift applies to its own stride */ if (st.ward[S]) w += au.protectBonus; }
    if (w) { total += w; why.push({ src: k.card, kid: k.kid, kind: 'ward', n: w }); }
    const mitHit = (card.mit || []).find(m => st.mit.has(m));
    if (mitHit && matched < 2) { total += 1; matched++; why.push({ src: k.card, kid: k.kid, kind: 'mitigation', n: 1, mit: mitHit }); }
    else if (matched < 2 && covOf(st.cov?.protect, card.id)) {
      const sc = covOf(st.cov.protect, card.id); total += covBonus(sc); matched++; why.push({ src: k.card, kid: k.kid, kind: 'mitigation', n: covBonus(sc), cov: sc, tech: card.id });
    }
    else if (matched < 2 && st.ctl.size) {
      // CTID Mappings Explorer: NIST 800-53 controls that mitigate this technique (no ATT&CK mitigation overlap needed)
      const tt = content.techs?.[card.id] || content.techs?.[(card.id || '').split('.')[0]];
      const ctlHit = (tt?.c || []).find(c => st.ctl.has(c));
      if (ctlHit) { total += 1; matched++; why.push({ src: k.card, kid: k.kid, kind: 'mitigation', n: 1, ctl: ctlHit }); }
    }
    for (const r of st.resists) if (card.id === r || card.id.startsWith(r + '.')) { total += 3; why.push({ src: st.resistSrc[r] || k.card, kid: k.kid, kind: 'counter', n: 3, tech: r }); break; }
    if (opts.spread && st.flags.has('segment')) { /* handled by cost/power in spread */ }
  }
  const pa = au.ward[S] || 0; if (pa) { total += pa; why.push({ src: 'policy', kind: 'policy', n: pa }); }
  if (au.layered && ctrls.length >= au.layered.minControls) { total += au.layered.ward; why.push({ src: 'x.zerotrust', kind: 'policy', n: au.layered.ward }); }
  if (A.baseWard) { total += A.baseWard; why.push({ src: 'relic', kind: 'base', n: A.baseWard }); }
  if (A.shield) { total += A.shield; why.push({ src: 'shield', kind: 'shield', n: A.shield }); }
  // adversary bypass traits
  let bypass = 0;
  for (const t of b.adv.traits) if (t.op === 'bypass' && (!t.stride || t.stride === S)) bypass += t.n;
  if (opts.useCreds && b.adv.creds > 0) bypass += 1;
  if (bypass && total > 0) { const d = Math.min(bypass, total); total -= d; why.push({ src: 'adversary', kind: 'bypass', n: -d }); }
  return { total: Math.max(0, total), why };
}
export function wardMap(content, b, assetId) {
  const m = {};
  for (const s of STRIDES) m[s] = wardFor(content, b, assetId, { stride: s, mit: [], id: '' }).total;
  return m;
}
function effStealth(content, b, f, au) {
  let s = f.stealth - (au || auras(content, b)).stealthMinus;
  for (const k of activeControls(b, f.asset)) { const st = ctrlStats(content, b, k); if (st.flags.has('stealthMinus1')) s -= 1; if (st.flags.has('sigma') && f.kind === 'arm') s -= 1; }
  return Math.max(0, s);
}
function loseResilience(content, b, n, cause) {
  if (n <= 0) return 0;
  const au = auras(content, b);
  if (au.resilienceShield && !b.resShieldUsedRound) { n = Math.max(0, n - au.resilienceShield); b.resShieldUsedRound = true; }
  b.res.cur -= n; b.stats.resLost += n; b.resLostRound += n;
  ev(b, { t: 'res', n: -n, cause });
  return n;
}

// ───────────────────────────── footholds ─────────────────────────────
function plantFoothold(content, b, assetId, o = {}) {
  const exposed = b.assets.filter(a => a.exposed && !a.down);
  const A = assetId ? asset(b, assetId) : exposed[randInt(b.rng, b.seed, 'plant', exposed.length)] || b.assets[0];
  const f = { id: 'f' + b.nid.f++, asset: A.id, tech: o.tech || 'T1078', name: o.name || 'Valid Accounts', tactic: o.tactic || 'initial-access', kind: o.kind || 'breach', stride: o.stride || 'S', stealth: o.stealth ?? 3, grip: o.grip ?? 2, revealed: false, revealedRound: null, persistent: false, c2: false, privileged: false, born: b.round, by: o.reason || null, mit: o.mit || [] };
  b.footholds.push(f);
  ev(b, { t: 'foothold', fid: f.id, asset: A.id, tech: f.tech, hidden: true, reason: o.reason });
  return f;
}

export function revealFoothold(content, b, f, how) {
  if (f.revealed) return false;
  f.revealed = true; f.revealedRound = b.round; if (b.firstRevealRound == null) b.firstRevealRound = b.round;
  b.expo.cur = clamp(b.expo.cur + 1, 0, b.expo.max); b.stats.reveals++; b.stats.noReveal = false; b.stats.maxExposure = Math.max(b.stats.maxExposure, b.expo.cur);
  ev(b, { t: 'reveal', fid: f.id, asset: f.asset, tech: f.tech, how });
  for (const r of b.relics) for (const h of content.relics[r]?.hooks?.reveal || []) relicFx(content, b, h);
  const au = auras(content, b);
  if (au.onReveal && !b.soarUsed) { b.soarUsed = true; evictFoothold(content, b, f, au.onReveal.evict || 1, 'soar'); }
  return true;
}
export function evictFoothold(content, b, f, n, how) {
  if (!b.footholds.includes(f)) return;
  f.grip -= n;
  if (f.grip > 0) { ev(b, { t: 'grip', fid: f.id, asset: f.asset, grip: f.grip }); return; }
  b.footholds.splice(b.footholds.indexOf(f), 1);
  // restore controls it had disabled
  for (const k of b.controls) if (k.disabledBy === f.id) { k.disabledBy = null; ev(b, { t: 'restored', kid: k.kid, asset: k.asset }); }
  const wasRevealed = f.revealed;
  if (f.persistent && how !== 'purge') {
    b.ghosts.push({ asset: f.asset, tech: f.tech, name: f.name, tactic: f.tactic, kind: f.kind, stride: f.stride, stealth: f.stealth, due: b.round + 1, mit: f.mit });
    ev(b, { t: 'persists', asset: f.asset, tech: f.tech });
  }
  b.expo.cur = clamp(b.expo.cur + 2, 0, b.expo.max); b.stats.evictions++; b.stats.maxExposure = Math.max(b.stats.maxExposure, b.expo.cur);
  if (wasRevealed && b.round - (f.revealedRound ?? b.round) <= 0) b.stats.fastEvict++;
  ev(b, { t: 'evict', fid: f.id, asset: f.asset, tech: f.tech, how, quick: wasRevealed && b.round === f.revealedRound });
  for (const r of b.relics) for (const h of content.relics[r]?.hooks?.evict || []) relicFx(content, b, h);
}

// ───────────────────────────── effects (defender) ─────────────────────────────
function relicFx(content, b, h) {
  switch (h.op) {
    case 'money': b.moneyDelta += h.n; return;
    case 'exposure': addExposure(b, h.n); return;
    case 'intel': b.intel += h.n; return;
    case 'draw': drawCards(content, b, h.n); return;
    case 'resilience': b.res.cur = Math.min(b.res.max, b.res.cur + h.n); return;
    case 'healAll': for (const a of b.assets) if (!a.down) a.hp = Math.min(a.max, a.hp + h.n); return;
    case 'reveal': { const au = auras(content, b); revealMatching(content, b, null, h.n, h.str, au); return; }
    case 'wardRandomAsset': { const a = b.assets[randInt(b.rng, b.seed, 'relic', b.assets.length)]; a.baseWard += h.n; return; }
    default: return;
  }
}
function addExposure(b, n) { b.expo.cur = clamp(b.expo.cur + n, 0, b.expo.max); b.stats.maxExposure = Math.max(b.stats.maxExposure, b.expo.cur); }
function revealMatching(content, b, assetId, n, str, au) {
  const cand = b.footholds.filter(f => !f.revealed && (!assetId || f.asset === assetId) && effStealth(content, b, f, au) <= str).sort((x, y) => effStealth(content, b, x, au) - effStealth(content, b, y, au) || x.id.localeCompare(y.id));
  let c = 0;
  for (const f of cand) { if (c >= n) break; if (revealFoothold(content, b, f, 'scan')) c++; }
  return c;
}
function drawCards(content, b, n) {
  for (let i = 0; i < n; i++) {
    if (!b.draw.length) { if (!b.discard.length) break; b.draw = shuffle(b.rng, b.seed, 'deck', b.discard); b.discard = []; ev(b, { t: 'reshuffle' }); }
    if (b.hand.length >= 10) break;
    const iid = b.draw.shift(); b.hand.push(iid); ev(b, { t: 'draw', iid });
  }
}
function damageAsset(content, b, A, amount, cause) {
  const au = auras(content, b);
  if (au.shield && !A.shieldUsed && amount > 0) { amount = Math.max(0, amount - au.shield); A.shieldUsed = true; }
  if (amount <= 0) return 0;
  A.hp -= amount;
  ev(b, { t: 'damage', asset: A.id, n: amount, cause });
  if (A.hp <= 0) {
    A.hp = 0;
    // aegis (immutable backups / recovery control) and relic revive
    const aeg = b.controls.find(k => k.asset === A.id && !k.disabledBy && !k.aegisUsed && ctrlStats(content, b, k).aegis);
    if (aeg) { aeg.aegisUsed = true; A.hp = ctrlStats(content, b, aeg).aegis.revive; ev(b, { t: 'aegis', asset: A.id, kid: aeg.kid, hp: A.hp }); return amount; }
    const rv = relicPassive(content, b, 'reviveOnce');
    if (rv && !b.revived) { b.revived = true; A.hp = rv; ev(b, { t: 'revive', asset: A.id, hp: A.hp, relic: true }); return amount; }
    A.down = true; b.stats.assetsDown++;
    ev(b, { t: 'asset_down', asset: A.id, jewel: A.jewel });
    for (const f of b.footholds) if (f.asset === A.id) f.c2 = false;
    if (A.jewel) endBattle(content, b, false, 'jewel');
  }
  return amount;
}

function runFx(content, b, fx, ctx) {
  const A = ctx.asset ? asset(b, ctx.asset) : null;
  const F = ctx.fid ? foot(b, ctx.fid) : null;
  const au = auras(content, b);
  switch (fx.op) {
    case 'reveal': return revealMatching(content, b, A?.id || null, fx.n || 1, fx.str ?? 3, au);
    case 'scanKinds': { let c = 0; for (const a of b.assets.filter(a => fx.kinds.includes(a.kind))) c += revealMatching(content, b, a.id, 2, fx.str ?? 3, au); return c; }
    case 'draw': drawCards(content, b, fx.n); return;
    case 'energy': b.energy.cur += fx.n; return;
    case 'energyNext': b.energyNext += fx.n; return;
    case 'resilience': { const h = Math.min(fx.n, b.res.max - b.res.cur); b.res.cur += h; ev(b, { t: 'res', n: h, cause: 'heal' }); return; }
    case 'exposure': addExposure(b, fx.n); ev(b, { t: 'expo', n: fx.n }); return;
    case 'intel': b.intel += fx.n; return;
    case 'evict': if (F) evictFoothold(content, b, F, fx.n, 'evict'); return;
    case 'evictPrivileged': for (const f of b.footholds.filter(f => f.asset === A?.id && f.privileged)) evictFoothold(content, b, f, fx.n, 'evict'); return;
    case 'damage': if (A) damageAsset(content, b, A, fx.n, 'self-inflicted'); return;
    case 'restoreBackup': {
      // Restoring needs a working backup: an active recovery control on the board (not broken by the adversary) gives a full rebuild
      if (!A) return;
      const ok = b.controls.some(k => !k.disabledBy && ctrlStats(content, b, k).aegis) && !b.flags.brokenBackups;
      for (const f of b.footholds.filter(f => f.asset === A.id)) evictFoothold(content, b, f, 99, 'purge');
      const was = A.hp; A.hp = Math.min(A.max, A.hp + (ok ? 99 : fx.n)); if (A.hp > 0) A.down = false;
      for (const k of b.controls.filter(k => k.asset === A.id && k.disabledBy)) { k.disabledBy = null; ev(b, { t: 'restored', kid: k.kid, asset: A.id }); }
      ev(b, { t: 'heal', asset: A.id, n: A.hp - was, backup: ok }); return;
    }
    case 'isolate': if (A) { A.isolated = true; ev(b, { t: 'isolate', asset: A.id }); } return;
    case 'heal': if (A) { const was = A.hp; A.hp = Math.min(A.max, A.hp + fx.n); if (A.hp > 0) A.down = false; ev(b, { t: 'heal', asset: A.id, n: A.hp - was }); } return;
    case 'shield': if (A) A.shield += fx.n; return;
    case 'shieldExfil': b.exfilShield += fx.n; return;
    case 'purge': if (A) for (const f of b.footholds.filter(f => f.asset === A.id)) evictFoothold(content, b, f, 99, 'purge'); return;
    case 'restore': if (A) for (const k of b.controls.filter(k => k.asset === A.id && k.disabledBy)) { k.disabledBy = null; ev(b, { t: 'restored', kid: k.kid, asset: A.id }); } return;
    case 'clearCreds': b.adv.creds = 0; return;
    case 'unstage': if (A) A.staged = false; return;
    case 'unprivilege': for (const f of b.footholds.filter(f => f.asset === A?.id)) f.privileged = false; return;
    case 'unprivilegeAll': for (const f of b.footholds) f.privileged = false; return;
    case 'blockPath': if (A) A.blocked = true; return;
    case 'nextPolicyFree': b.policyFree = true; return;
    default: bad('unknown fx ' + fx.op);
  }
}

// ───────────────────────────── player actions ─────────────────────────────
export function cardCost(content, b, iid) {
  const e = effCard(content, b, iid);
  let c = e.cost;
  if (e.type === 'policy' && b.policyFree) c = 0;
  const df = relicObj(content, b, 'discountFirst')[0];
  if (df && !b.discountUsed && e.fn === df.fn) c = Math.max(0, c - df.n);
  return c;
}
export function targetKind(content, b, iid) { return def(content, b, iid).target || 'none'; }

export function validTargets(content, b, iid) {
  const e = effCard(content, b, iid);
  const t = e.target || 'none';
  if (t === 'asset') {
    if (e.type === 'control') return b.assets.filter(a => !a.down && b.controls.filter(k => k.asset === a.id).length < a.slots).map(a => ({ asset: a.id }));
    return b.assets.map(a => ({ asset: a.id }));
  }
  if (t === 'foothold') return b.footholds.filter(f => f.revealed).map(f => ({ fid: f.id }));
  if (t === 'control') return b.controls.filter(k => augmentFits(content, e, k) && k.augs.length < 2).map(k => ({ kid: k.kid }));
  return [{}];
}
function augmentFits(content, e, k) {
  const cell = content.cards[k.card].cell || '';
  return (e.base || []).some(x => x === cell || (x.endsWith('.*') && cell.startsWith(x.slice(0, -1))));
}

export function playCard(content, b, iid, target = {}) {
  assertDefender(b);
  const idx = b.hand.indexOf(iid); if (idx < 0) bad('card not in hand');
  const e = effCard(content, b, iid);
  if (e.unplayable || e.type === 'status') bad('That card cannot be played.');
  const cost = cardCost(content, b, iid);
  if (cost > b.energy.cur) bad('Not enough energy.');
  const tk = e.target || 'none';
  if (tk === 'asset') { if (!target.asset || !asset(b, target.asset)) bad('Choose an asset.'); }
  if (tk === 'foothold') { const f = foot(b, target.fid); if (!f || !f.revealed) bad('Choose a revealed foothold.'); }
  if (tk === 'control') { const k = b.controls.find(x => x.kid === target.kid); if (!k || !augmentFits(content, e, k)) bad('That augment does not fit that control.'); if (k.augs.length >= 2) bad('Control already has 2 augments.'); }

  if (e.type === 'control') {
    const A = asset(b, target.asset);
    if (A.down) bad('Asset is down.');
    if (b.controls.filter(k => k.asset === A.id).length >= A.slots) bad('Asset has no free control slots.');
  }
  // pay
  b.energy.cur -= cost;
  const df = relicObj(content, b, 'discountFirst')[0];
  if (df && !b.discountUsed && e.fn === df.fn) b.discountUsed = true;
  if (e.type === 'policy' && b.policyFree) b.policyFree = false;
  b.hand.splice(idx, 1);
  const card = content.cards[b.cards[iid].id];

  if (e.type === 'control') {
    const k = { kid: 'k' + b.nid.k++, iid, card: card.id, ml: mlOf(b, iid), asset: target.asset, augs: [], disabledBy: null, aegisUsed: !!b.flags.brokenBackups && !!scaleCard(card, 1).aegis };
    b.controls.push(k); b.board.push(iid);
    ev(b, { t: 'deploy', kid: k.kid, asset: k.asset, card: card.id });
    b.stats.deploys++;
    // detection controls reveal immediately on deploy (so cards feel responsive)
    const st = ctrlStats(content, b, k);
    if (st.detect) monitorReveal(content, b, k, st);
  } else if (e.type === 'augment') {
    const k = b.controls.find(x => x.kid === target.kid);
    k.augs.push({ card: card.id, ml: mlOf(b, iid) }); b.board.push(iid);
    ev(b, { t: 'augment', kid: k.kid, asset: k.asset, card: card.id });
    b.stats.augments++;
    const st = ctrlStats(content, b, k); if (st.detect) monitorReveal(content, b, k, st);
  } else if (e.type === 'policy') {
    if (b.policies.length >= content.tuning.battle.policySlots) { const old = b.policies.shift(); b.discard.push(old.iid); b.board = b.board.filter(x => x !== old.iid); ev(b, { t: 'policy_out', card: old.id }); }
    b.policies.push({ iid, id: card.id, ml: mlOf(b, iid) }); b.board.push(iid);
    ev(b, { t: 'policy', card: card.id });
  } else {
    for (const fx of e.fx || []) runFx(content, b, fx, { asset: target.asset, fid: target.fid });
    // consumables: 'battle' exhausts for this fight; 'run' is spent for the rest of the run
    if (e.consume) { (b.exhausted ||= []).push(iid); if (e.consume === 'run') (b.spent ||= []).push(iid); ev(b, { t: 'consumed', card: card.id, scope: e.consume }); }
    else b.discard.push(iid);
    ev(b, { t: 'action', card: card.id, asset: target.asset, fid: target.fid });
  }
  b.stats.cardsPlayed++;
  b.stats.typesPlayed[e.type] = (b.stats.typesPlayed[e.type] || 0) + 1;
  if (e.fn) b.stats.fnsPlayed[e.fn] = (b.stats.fnsPlayed[e.fn] || 0) + 1;
  if (e.prop) b.stats.propsPlayed[e.prop] = (b.stats.propsPlayed[e.prop] || 0) + 1;
  ev(b, { t: 'played', iid, card: card.id, cost });
  checkEnd(content, b);
}

export function usePower(content, b, target = {}) {
  assertDefender(b);
  const p = b.doctrine && content.doctrines[b.doctrine]?.power; if (!p) bad('No hero power.');
  if (b.powerUsed) bad('Hero power already used this round.');
  if (p.cost > b.energy.cur) bad('Not enough energy.');
  if (p.target === 'asset' && !asset(b, target.asset)) bad('Choose an asset.');
  b.energy.cur -= p.cost; b.powerUsed = true;
  for (const fx of p.fx) runFx(content, b, fx, { asset: target.asset, fid: target.fid });
  ev(b, { t: 'power', doctrine: b.doctrine, asset: target.asset });
  checkEnd(content, b);
}
function assertDefender(b) {
  if (b.over) bad('The battle is over.');
  if (b.phase !== 'defender') bad('Not your turn.');
  if (b.ttx?.pending) bad('Resolve the decision first.');
}

// ───────────────────────────── monitors ─────────────────────────────
function monitorReveal(content, b, k, st) {
  const au = auras(content, b);
  let n = st.detect.n;
  const cand = b.footholds.filter(f => !f.revealed && (st.detect.scope === 'global' || f.asset === k.asset) && effStealth(content, b, f, au) <= st.detect.str + (f.privileged ? st.privBonus : 0) + covBonus(covOf(st.cov?.detect, f.tech))).sort((x, y) => effStealth(content, b, x, au) - effStealth(content, b, y, au) || x.id.localeCompare(y.id));
  const bonus = relicPassive(content, b, 'detectStr');
  let c = 0;
  for (const f of cand) { if (c >= n) break; if (revealFoothold(content, b, f, 'monitor')) c++; }
  if (bonus && c < n) { /* relic strength already folded via passive below */ }
  return c;
}
function monitorsStart(content, b) {
  const au = auras(content, b);
  const bonus = relicPassive(content, b, 'detectStr');
  for (const k of b.controls.filter(k => !k.disabledBy && !asset(b, k.asset).down)) {
    const st = ctrlStats(content, b, k);
    if (!st.detect) continue;
    st.detect.str += bonus;
    const cand = b.footholds.filter(f => !f.revealed && (st.detect.scope === 'global' || f.asset === k.asset) && effStealth(content, b, f, au) <= st.detect.str + (f.privileged ? st.privBonus : 0) + covBonus(covOf(st.cov?.detect, f.tech))).sort((x, y) => effStealth(content, b, x, au) - effStealth(content, b, y, au) || x.id.localeCompare(y.id));
    let c = 0;
    for (const f of cand) { if (c >= st.detect.n) break; if (revealFoothold(content, b, f, 'monitor')) c++; }
    if (st.flags.has('autoEvict')) for (const f of b.footholds.filter(f => f.revealed && f.asset === k.asset)) evictFoothold(content, b, f, 1, 'auto');
  }
}

// ───────────────────────────── rounds ─────────────────────────────
function startRound(content, b) {
  b.round++; b.phase = 'defender';
  b.energy.max = content.tuning.battle.energy + relicPassive(content, b, 'energy') + b.energyBonus;
  b.energy.cur = b.energy.max + b.energyNext; b.energyNext = 0;
  b.powerUsed = false; b.discountUsed = false; b.policyFree = false; b.soarUsed = false; b.exfilShield = 0; b.resLostRound = 0; b.resShieldUsedRound = false;
  b.intel = (b.intelBonus || 0) + relicPassive(content, b, 'intel'); b.intelBonus = 0;
  for (const a of b.assets) { a.isolated = false; a.blocked = false; a.shield = 0; a.shieldUsed = false; }
  // ghosts (persistence) return
  for (const g of b.ghosts.filter(g => g.due <= b.round)) { if (!asset(b, g.asset).down) { const f = plantFoothold(content, b, g.asset, { ...g, grip: 1, reason: 'persistence' }); f.persistent = false; } }
  b.ghosts = b.ghosts.filter(g => g.due > b.round);
  // augments with start-of-round effects
  for (const k of b.controls) {
    if (k.disabledBy) continue;
    const st = ctrlStats(content, b, k);
    if (st.flags.has('jit')) for (const f of b.footholds) if (f.asset === k.asset && f.privileged) { f.privileged = false; ev(b, { t: 'jit', asset: k.asset }); }
    if (st.flags.has('regen1')) { const A = asset(b, k.asset); if (!A.down && A.hp < A.max) { A.hp++; ev(b, { t: 'heal', asset: A.id, n: 1 }); } }
  }
  // draw
  drawCards(content, b, content.tuning.battle.handSize + relicPassive(content, b, 'draw'));
  // detection
  monitorsStart(content, b);
  const au = auras(content, b);
  for (let i = 0; i < au.startReveal; i++) revealMatching(content, b, null, 1, 99, au);
  for (const r of b.relics) for (const h of content.relics[r]?.hooks?.roundStart || []) relicFx(content, b, h);
  ev(b, { t: 'round', n: b.round });
  fireInjects(content, b);
  checkEnd(content, b);
}

export function endTurn(content, b) {
  assertDefender(b);
  // discard hand (status cards too)
  for (const iid of b.hand) b.discard.push(iid);
  b.hand = [];
  b.phase = 'adversary';
  ev(b, { t: 'end_turn' });
  adversaryTurn(content, b);
  if (b.over) return;
  endRound(content, b);
}
function endRound(content, b) {
  for (const a of b.assets) { a.shield = 0; }
  const limit = b.ttx?.rounds || content.tuning.adversary.tiers[b.adv.tier].rounds || content.tuning.battle.maxRounds;
  if (b.round >= limit) { endBattle(content, b, true, 'survived'); return; }
  startRound(content, b);
}

// ───────────────────────────── adversary ─────────────────────────────
function advTierEnergy(content, b, round = b.round) {
  const t = content.tuning.adversary.tiers[b.adv.tier];
  const a = content.tuning.assurance[b.assurance ?? 1] || { advEnergy: 0 };
  let e = t.energy[clamp(round - 1, 0, t.energy.length - 1)] + (b.adv.traits.filter(x => x.op === 'energyBonus').reduce((s, x) => s + x.n, 0)) + (a.advEnergy || 0) + b.adv.energyBonusNext + ((content.adversaryMeta[b.adv.id]?.balance || {}).energy || 0);
  return Math.max(1, e);
}
function advHandSize(content, b) {
  const t = content.tuning.adversary.tiers[b.adv.tier];
  return t.hand + b.adv.traits.filter(x => x.op === 'drawBonus').reduce((s, x) => s + x.n, 0);
}
function advDrawAndPlan(content, b) {
  const A = b.adv;
  while (A.hand.length < advHandSize(content, b)) {
    if (!A.draw.length) { if (!A.discard.length) break; A.draw = shuffle(b.rng, b.seed, 'adv-deck', A.discard); A.discard = []; }
    A.hand.push(A.draw.shift());
  }
  const plan = bestPlay(content, b, advTierEnergy(content, b, b.round + 1));
  A.intent = plan ? { uid: plan.uid, asset: plan.target.asset || null, fid: plan.target.fid || null } : null;
}
export function advCost(content, b, c, target) {
  let cost = c.cost;
  const au = auras(content, b);
  for (const t of au.advTax) if (t.tactics.includes(c.tactic)) cost += t.n;
  for (const t of b.adv.traits) if (t.op === 'discount' && t.kinds.includes(c.kind)) cost -= t.n;
  if (c.kind === 'spread') {
    if (b.adv.mapped) cost -= 1;
    const to = target?.asset && activeControls(b, target.asset).some(k => ctrlStats(content, b, k).flags.has('segment'));
    const from = target?.fid && foot(b, target.fid) && activeControls(b, foot(b, target.fid).asset).some(k => ctrlStats(content, b, k).flags.has('segment'));
    if (to || from) cost += 1;
  }
  return Math.max(0, cost);
}

function myFoots(b) { return b.footholds.filter(f => !asset(b, f.asset).down); }
function distToJewel(b, from) {
  const J = b.assets.filter(a => a.jewel && !a.down).map(a => a.id);
  const seen = new Map([[from, 0]]); const q = [from];
  while (q.length) { const x = q.shift(); if (J.includes(x)) return seen.get(x); for (const n of asset(b, x).adjacent) if (!seen.has(n)) { seen.set(n, seen.get(x) + 1); q.push(n); } }
  return 9;
}
function advOptions(content, b, c) {
  const out = [];
  const feet = myFoots(b);
  const free = (a) => !a.isolated && !a.down;
  switch (c.kind) {
    case 'prep': out.push({}); break;
    case 'breach': for (const a of b.assets) if (a.exposed && free(a) && !a.blocked) out.push({ asset: a.id }); break;
    case 'arm': case 'persist': case 'beacon': for (const f of feet) out.push({ fid: f.id }); break;
    case 'escalate': for (const f of feet) if (!f.privileged && !asset(b, f.asset).isolated) out.push({ fid: f.id }); break;
    case 'evade': for (const f of feet) out.push({ fid: f.id }); break;
    case 'disable': for (const f of feet) if (activeControls(b, f.asset).length && !asset(b, f.asset).isolated) out.push({ fid: f.id }); break;
    case 'creds': for (const f of feet) if (!asset(b, f.asset).isolated) out.push({ fid: f.id }); break;
    case 'map': if (feet.length) out.push({ fid: feet[0].id }); break;
    case 'stage': for (const f of feet) if (!asset(b, f.asset).staged && !asset(b, f.asset).isolated) out.push({ fid: f.id }); break;
    case 'spread': for (const f of feet) { if (asset(b, f.asset).isolated) continue; for (const n of asset(b, f.asset).adjacent) { const B = asset(b, n); if (free(B) && !B.blocked && !b.footholds.some(x => x.asset === n)) out.push({ fid: f.id, asset: n }); } } break;
    case 'exfil': for (const f of feet) if (asset(b, f.asset).staged && !asset(b, f.asset).isolated) out.push({ fid: f.id, asset: f.asset }); break;
    case 'strike':
      if (c.remote) { for (const a of b.assets) if (a.exposed && free(a)) out.push({ asset: a.id }); }
      else for (const f of feet) { const A = asset(b, f.asset); if (A.isolated) continue; if (!SENSITIVE.has(A.kind) || f.privileged) out.push({ fid: f.id, asset: f.asset }); }
      break;
    case 'inhibit': case 'impair': for (const f of feet) { const A = asset(b, f.asset); if (A.isolated) continue; if (c.kind === 'impair' && A.kind !== 'ot') continue; if (c.kind === 'inhibit' && !activeControls(b, A.id).length) continue; out.push({ fid: f.id, asset: f.asset }); } break;
    default: break;
  }
  return out;
}
function scoreOption(content, b, c, o) {
  const f = o.fid ? foot(b, o.fid) : null;
  const A = o.asset ? asset(b, o.asset) : f ? asset(b, f.asset) : null;
  const w = A ? wardFor(content, b, A.id, c, { useCreds: c.kind === 'spread' }).total : 0;
  const pw = c.power + (['breach', 'spread'].includes(c.kind) ? b.adv.prep : 0);
  const late = Math.min(1.6, 0.8 + b.round * 0.1);     // operations get bolder as the window closes
  const dj = A ? distToJewel(b, A.id) : 9;
  const have = (k) => myFoots(b).some(x => x.kind === k);
  let s = 0;
  switch (c.kind) {
    case 'prep': s = b.adv.prep >= 1 ? -6 : (myFoots(b).length === 0 && b.round < 3 ? 3 : 0.3); break;
    case 'breach': { if (pw - w <= 0) return -99; const n = myFoots(b).length; s = (n === 0 ? 20 : n < 2 ? 9 : 3) + (9 - dj) * 0.8 - w * 1.5; break; }
    case 'arm': s = f.grip < 3 ? 4 + (f.revealed ? 2 : 0) : 0.5; break;
    case 'persist': s = f.persistent ? -9 : (f.revealed ? 8 : 3); break;
    case 'escalate': { if (pw - w <= 0) return -99; s = (SENSITIVE.has(A.kind) ? 12 : 7) + (9 - dj) * 0.6; break; }
    case 'evade': s = f.revealed ? 12 : f.stealth >= 5 ? -3 : 2.5; break;
    case 'disable': { const dets = activeControls(b, A.id).filter(k => ctrlStats(content, b, k).detect); s = dets.length ? 13 : 7; break; }
    case 'creds': s = b.adv.creds >= 2 ? -3 : 7 + (A.kind === 'identity' ? 4 : 0); break;
    case 'map': s = b.adv.mapped ? -6 : 3.5; break;
    case 'spread': { if (pw - w <= 0) return -99; s = 11 + (9 - dj) * 2 - w * 1.5; break; }
    case 'stage': s = A.jewel ? 15 : (A.kind === 'data' || A.kind === 'server' || A.kind === 'app') ? 9 : 2; break;
    case 'beacon': s = f.c2 ? -9 : 6.5; break;
    case 'exfil': { if (c.power - w <= 0) return -99; s = (A.jewel ? 32 : 11) * late; break; }
    case 'strike': { const dmg = c.power - w; if (dmg <= 0) return -99; s = ((A.jewel ? 30 : 10) + dmg * 1.4 + (A.hp <= dmg ? 8 : 0)) * late; break; }
    case 'inhibit': s = 11; break;
    case 'impair': { const dmg = c.power - w; if (dmg <= 0) return -99; s = ((A.jewel ? 32 : 12) + dmg) * late; break; }
    default: s = 0;
  }
  if (f && f.revealed && ['arm', 'persist', 'beacon', 'creds', 'map', 'stage'].includes(c.kind)) s -= 2; // don't invest in doomed footholds
  if (content.tuning.adversary.goalAI) s += goalBonus(content, b, c, o, A, f);
  return s + (rand(b.rng, b.seed, 'ai-jitter') * 0.4);
}
/** Goal-directed play: each adversary pursues what it wants (dwell undetected on critical assets, breadth, or payoffs). */
function goalBonus(content, b, c, o, A, f) {
  const G = b.goal; if (!G) return 0;
  const def = content.tuning.goals[G.kind]; let s = 0;
  const critical = (a) => a && (a.jewel || (def.targets && def.targets !== 'any' && def.targets.includes(a.kind)));
  if (def.rule === 'dwell') {
    const tgt = o.asset ? asset(b, o.asset) : A;
    if (c.kind === 'spread' && critical(tgt)) s += 7;
    if (c.kind === 'breach') s += 1;
    if (c.kind === 'evade' && f && f.revealed) s += 8;          // go dark again: only undetected footholds count
    if (c.kind === 'persist' && f && critical(A)) s += 4;
    if (c.kind === 'escalate' && critical(A)) s += 2;
    if (['strike', 'impair', 'exfil'].includes(c.kind)) s -= 6;  // noisy: burns the dwell
  } else if (def.rule === 'reach') {
    if (c.kind === 'spread' || c.kind === 'breach') s += 6;
    if (c.kind === 'evade' && f && f.revealed) s += 4;
  } else {
    if (def.kinds.includes(c.kind)) s += 8 * Math.min(1.6, 0.8 + b.round * 0.1);
    if (c.kind === 'stage' && def.kinds.includes('exfil')) s += 6;
    if (c.kind === 'escalate' && def.kinds.includes('strike')) s += 4;
    if (c.kind === 'spread') s += (def.jewelOnly ? distToJewel(b, A?.id) <= 1 : critical(o.asset ? asset(b, o.asset) : A)) ? 4 : 0;
  }
  return s * (G.prog / G.need > 0.6 ? 1.3 : 1);
}
function bestPlay(content, b, energy) {
  let best = null;
  const phaseGate = (c) => true;
  for (const uid of b.adv.hand) {
    const c = b.adv.cards[uid];
    if (!phaseGate(c)) continue;
    for (const o of advOptions(content, b, c)) {
      const cost = advCost(content, b, c, o);
      if (cost > energy) continue;
      const sc = scoreOption(content, b, c, o) - cost * 0.3;
      if (sc > -50 && (!best || sc > best.score)) best = { uid, target: o, score: sc, cost };
    }
  }
  return best;
}

function adversaryTurn(content, b) {
  const A = b.adv;
  b.adv.hndlThisTurn = 0;
  // upkeep: beacons drain
  const beaconMinus = relicPassive(content, b, 'beaconMinus');
  for (const f of b.footholds.filter(f => f.c2 && !asset(b, f.asset).isolated && !asset(b, f.asset).down)) { loseResilience(content, b, Math.max(0, 1 - beaconMinus), 'beacon'); ev(b, { t: 'beacon', fid: f.id, asset: f.asset }); }
  checkEnd(content, b); if (b.over) return;
  // phase triggers
  for (const t of A.traits.filter(t => t.op === 'phase')) {
    if (A.phaseFired.includes(t.id)) continue;
    if (b.expo.cur / b.expo.max >= t.at) { A.phaseFired.push(t.id); ev(b, { t: 'phase', id: t.id, name: t.name }); for (const e of t.effects) applyAdvTrait(content, b, e); }
  }
  let energy = advTierEnergy(content, b); A.energyBonusNext = 0;
  ev(b, { t: 'adv_turn', energy });
  let plays = 0;
  // 1. scripted plays (TTX) then 2. intent, then greedy
  let first = true;
  while (plays < 6 && !b.over) {
    let pick = null;
    if (first && A.intent && A.hand.includes(A.intent.uid)) {
      const c = A.cards[A.intent.uid];
      const opts = advOptions(content, b, c);
      const match = opts.find(o => (o.asset || null) === (A.intent.asset || null) && (o.fid || null) === (A.intent.fid || null)) || null;
      if (match && advCost(content, b, c, match) <= energy && scoreOption(content, b, c, match) > -50) pick = { uid: A.intent.uid, target: match };
    }
    first = false;
    if (!pick) pick = bestPlay(content, b, energy);
    if (!pick) break;
    const c = A.cards[pick.uid];
    const cost = advCost(content, b, c, pick.target);
    energy -= cost; plays++;
    A.hand.splice(A.hand.indexOf(pick.uid), 1); A.discard.push(pick.uid);
    A.played.push(c.id);
    resolveAdv(content, b, c, pick.target, cost);
    checkEnd(content, b);
  }
  goalTick(content, b); checkEnd(content, b);
  if (b.over) return;
  // end of adversary turn: unplayed cards are discarded, like the defender's hand; fresh draw + new intent
  for (const u of A.hand) A.discard.push(u);
  A.hand = [];
  advDrawAndPlan(content, b);
}
function applyAdvTrait(content, b, e) {
  if (e.op === 'startFootholds') for (let i = 0; i < e.n; i++) plantFoothold(content, b, null, { reason: 'phase shift' });
  else if (e.op === 'energyBonus') b.adv.energyBonusNext += e.n;
  else if (e.op === 'stealthAll') for (const f of b.footholds) f.stealth += e.n;
  else if (e.op === 'hideAll') for (const f of b.footholds) f.revealed = false;
}

function resolveAdv(content, b, c, target, cost) {
  const A = b.adv;
  const f = target.fid ? foot(b, target.fid) : null;
  const asst = target.asset ? asset(b, target.asset) : f ? asset(b, f.asset) : null;
  const vis = { t: 'adv_play', uid: c.uid, tech: c.id, name: c.name, tactic: c.tactic, kind: c.kind, asset: asst?.id || null, fid: f?.id || null, cost };
  ev(b, vis);
  const blocked = (w, extra) => { b.stats.blocked++; addExposure(b, 1); ev(b, { t: 'blocked', tech: c.id, name: c.name, asset: asst?.id, ward: w.total, why: w.why, ...extra }); };
  const power = c.power + (['breach', 'spread'].includes(c.kind) ? A.prep : 0);
  switch (c.kind) {
    case 'prep': A.prep += 1; ev(b, { t: 'adv_prep' }); break;
    case 'breach': {
      const w = wardFor(content, b, asst.id, c);
      let p = power;
      if (!A.firstBreachDone) { p -= relicPassive(content, b, 'firstBreachMinus'); }
      A.firstBreachDone = true; A.prep = 0;
      if (p - w.total <= 0) { blocked(w); break; }
      const stealthBonus = A.traits.filter(t => t.op === 'stealthBonus').reduce((s, t) => s + t.n, 0);
      const noMonitor = !activeControls(b, asst.id).some(k => ctrlStats(content, b, k).detect) ? 1 : 0;
      const nf = plantFoothold(content, b, asst.id, { tech: c.id, name: c.name, tactic: c.tactic, kind: c.kind, stride: c.stride, stealth: 2 + stealthBonus + noMonitor + (c.sig ? 1 : 0), grip: clamp(p - w.total, 1, 3), mit: c.mit, reason: c.name });
      if (w.total > 0) ev(b, { t: 'partial', tech: c.id, ward: w.total, why: w.why });
      break;
    }
    case 'arm': f.grip = Math.min(4, f.grip + 1); ev(b, { t: 'grip', fid: f.id, asset: f.asset, grip: f.grip, revealed: f.revealed }); break;
    case 'persist': f.persistent = true; ev(b, { t: 'persist', fid: f.id, asset: f.asset }); break;
    case 'escalate': { const w = wardFor(content, b, asst.id, c); if (power - w.total <= 0) { blocked(w); break; } f.privileged = true; ev(b, { t: 'privileged', fid: f.id, asset: f.asset }); break; }
    case 'evade': { f.stealth = Math.min(8, f.stealth + 2); if (f.revealed) { f.revealed = false; ev(b, { t: 'rehide', fid: f.id, asset: f.asset }); } else ev(b, { t: 'stealth', fid: f.id, asset: f.asset }); break; }
    case 'disable': {
      const w = wardFor(content, b, asst.id, c);
      if (power - w.total <= 0) { blocked(w); break; }
      const cs = activeControls(b, asst.id).sort((x, y) => (ctrlStats(content, b, y).detect ? 1 : 0) - (ctrlStats(content, b, x).detect ? 1 : 0));
      const k = cs[0]; if (k) { k.disabledBy = f.id; ev(b, { t: 'disabled', kid: k.kid, asset: asst.id, card: k.card, by: f.id, tech: c.id }); }
      break;
    }
    case 'creds': {
      A.creds += 1; ev(b, { t: 'creds', n: A.creds });
      canaryCheck(content, b, asst, f);
      if (asst.kind === 'identity') { const w = wardFor(content, b, asst.id, c); const d = Math.max(0, power - w.total); if (d > 0) damageAsset(content, b, asst, d, c.id); }
      break;
    }
    case 'map': { A.mapped = true; for (const n of asst.adjacent) asset(b, n).mapped = true; ev(b, { t: 'mapped', asset: asst.id }); break; }
    case 'spread': {
      const w = wardFor(content, b, target.asset, c, { useCreds: true });
      let p = power; if (activeControls(b, target.asset).some(k => ctrlStats(content, b, k).flags.has('segment')) || activeControls(b, f.asset).some(k => ctrlStats(content, b, k).flags.has('segment'))) p -= 1;
      A.prep = 0;
      if (p - w.total <= 0) { blocked(w, { asset: target.asset }); break; }
      plantFoothold(content, b, target.asset, { tech: c.id, name: c.name, tactic: c.tactic, kind: c.kind, stride: c.stride, stealth: Math.max(1, f.stealth - 1), grip: 1, mit: c.mit, reason: c.name });
      break;
    }
    case 'stage': { asst.staged = true; ev(b, { t: 'staged', asset: asst.id }); canaryCheck(content, b, asst, f); break; }
    case 'beacon': f.c2 = true; ev(b, { t: 'c2', fid: f.id, asset: f.asset }); break;
    case 'exfil': {
      const w = wardFor(content, b, asst.id, c);
      const au = auras(content, b);
      if (activeControls(b, asst.id).some(k => ctrlStats(content, b, k).flags.has('pqc'))) ev(b, { t: 'exfil_pqc', asset: asst.id });
      const detMinus = activeControls(b, asst.id).some(k => content.cards[k.card].cell === 'detect.disclosure') ? 1 : 0;
      const amt = power - w.total - au.exfilMinus - b.exfilShield - detMinus;
      if (amt <= 0) { blocked(w); break; }
      const loss = asst.jewel ? amt * 2 : amt;
      loseResilience(content, b, loss, 'exfil'); b.stats.dataLost += loss; asst.staged = false; goalHit(content, b, 'exfil', asst, amt, power);
      ev(b, { t: 'exfil', asset: asst.id, n: loss, jewel: asst.jewel, tech: c.id });
      if (A.traits.some(t => t.op === 'hndl') && !activeControls(b, asst.id).some(k => ctrlStats(content, b, k).flags.has('pqc'))) { A.harvested += 1; ev(b, { t: 'harvest', asset: asst.id }); }
      break;
    }
    case 'strike': case 'impair': {
      const w = wardFor(content, b, asst.id, c);
      const sm = relicPassive(content, b, 'strikeMinus');
      let ransom = A.traits.filter(t => t.op === 'ransomPressure').reduce((s, t) => s + (b.round >= t.round ? t.n : 0), 0);
      const dmg = power + ransom - w.total - sm;
      if (dmg <= 0) { blocked(w); break; }
      const d = damageAsset(content, b, asst, dmg, c.id);
      if (d > 0) loseResilience(content, b, Math.ceil(d / 2), 'impact');
      goalHit(content, b, c.kind === 'impair' ? 'impair' : 'strike', asst, dmg, power + ransom);
      if (/^T1486|^T1490|^T1485|^T1561|^T1489/.test(c.id)) for (const n of asst.adjacent) { const B = asset(b, n); if (B.kind === 'backup' && !B.down) { const vaulted = activeControls(b, B.id).some(k => ctrlStats(content, b, k).flags.has('vault')); if (!vaulted) damageAsset(content, b, B, 2, c.id); else ev(b, { t: 'vault', asset: B.id }); } }
      break;
    }
    case 'inhibit': {
      const w = wardFor(content, b, asst.id, c);
      if (power - w.total <= 0) { blocked(w); break; }
      const cs = activeControls(b, asst.id); const k = cs[0]; if (k) { k.disabledBy = f.id; ev(b, { t: 'disabled', kid: k.kid, asset: asst.id, card: k.card, by: f.id, tech: c.id }); }
      goalHit(content, b, 'inhibit', asst);
      break;
    }
  }
}
/** Goal progress from a resolved payoff card (exfil/strike/impair/inhibit). */
function goalHit(content, b, kind, A, amt = null, power = null) {
  const G = b.goal; if (!G || b.over) return;
  const def = content.tuning.goals[G.kind]; if (def.rule !== 'payoff' || !def.kinds.includes(kind)) return;
  if (def.jewelOnly && !A.jewel) return;
  let n = def.jewelOnly ? 2 : (A.jewel || (G.kind === 'disrupt' && A.kind === 'ot')) ? 2 : 1;
  // amount mode: progress follows how much actually got through the wards, so every point of defence matters
  if (content.tuning.goalMode === 'amount' && amt != null && power) n = +(n * Math.max(0.25, Math.min(1, amt / power))).toFixed(2);
  G.prog = +(G.prog + n).toFixed(2); ev(b, { t: 'goal', kind: G.kind, prog: G.prog, need: G.need, asset: A.id });
}
/** End-of-adversary-turn goal rules (dwell / reach). Isolated assets do not count: containment buys time. */
function goalTick(content, b) {
  const G = b.goal; if (!G || b.over) return;
  const def = content.tuning.goals[G.kind];
  if (def.rule === 'dwell') {
    const live = b.footholds.filter(f => { const a = asset(b, f.asset); return !f.revealed && !a.isolated && !a.down && (def.targets === 'any' || def.targets.includes(a.kind) || a.jewel); });
    const inc = content.tuning.goalMode === 'amount' ? Math.min(2, 0.5 + 0.5 * live.length) : 1;   // amount mode: more undetected footholds, faster dwell
    G.prog = live.length >= (def.minFootholds || 1) ? G.prog + inc : Math.max(0, G.prog - 1);
  } else if (def.rule === 'reach') G.prog = new Set(b.footholds.filter(f => !f.revealed && !asset(b, f.asset).isolated).map(f => f.asset)).size;
  else return;
  ev(b, { t: 'goal', kind: G.kind, prog: G.prog, need: G.need });
}
function canaryCheck(content, b, A, f) {
  const can = activeControls(b, A.id).find(k => ctrlStats(content, b, k).flags.has('canary') && !k.canaryUsed);
  if (can && f) { can.canaryUsed = true; addExposure(b, 2); revealFoothold(content, b, f, 'canary'); ev(b, { t: 'canary', asset: A.id }); }
}

// ───────────────────────────── injects & TTX ─────────────────────────────
function fireInjects(content, b) {
  if (!b.ttx) return;
  for (const inj of b.ttx.injects.filter(i => i.round === b.round && !b.ttx.done.includes(i.id))) {
    b.ttx.done.push(inj.id);
    ev(b, { t: 'inject', id: inj.id, title: inj.title, kind: inj.kind, clock: inj.at });
    for (const fx of inj.fx || []) injectFx(content, b, fx);
    if (inj.decision) { b.ttx.pending = { inject: inj.id, ...inj.decision }; break; }
  }
}
function injectFx(content, b, fx) {
  switch (fx.op) {
    case 'resilience': if (fx.n < 0) loseResilience(content, b, -fx.n, 'inject'); else b.res.cur = Math.min(b.res.max, b.res.cur + fx.n); break;
    case 'exposure': addExposure(b, fx.n); break;
    case 'intel': b.intel += fx.n; break;
    case 'energyNext': b.energyNext += fx.n; break;
    case 'draw': drawCards(content, b, fx.n); break;
    case 'plant': plantFoothold(content, b, fx.asset || null, { reason: 'inject' }); break;
    case 'reveal': revealMatching(content, b, fx.asset || null, fx.n || 1, fx.str ?? 9, auras(content, b)); break;
    case 'shieldAll': for (const a of b.assets) a.shield += fx.n; break;
    case 'score': b.ttx.score += fx.n; break;
    case 'flag': b.flags[fx.id] = true; break;
    case 'disable': { const k = b.controls.find(k => !k.disabledBy); if (k) k.disabledBy = 'inject'; break; }
    default: break;
  }
}
export function decide(content, b, choiceId) {
  if (!b.ttx?.pending) bad('No decision pending.');
  const p = b.ttx.pending;
  const ch = p.choices.find(c => c.id === choiceId); if (!ch) bad('Unknown choice.');
  for (const fx of ch.fx || []) injectFx(content, b, fx);
  const pts = ch.quality === 'best' ? 3 : ch.quality === 'good' ? 2 : ch.quality === 'ok' ? 1 : 0;
  b.ttx.score += pts * 10;
  b.ttx.log.push({ inject: p.inject, choice: ch.id, quality: ch.quality });
  ev(b, { t: 'decision', inject: p.inject, choice: ch.id, quality: ch.quality, lesson: ch.lesson, refs: ch.refs });
  b.ttx.pending = null;
  // remaining injects scheduled this round
  fireInjects(content, b);
}

// ───────────────────────────── end ─────────────────────────────
/** CTID-style coverage lookup: exact technique, else its parent. Returns the 1-3 score (minimal/partial/significant) or 0. */
const covOf = (map, id) => (map && id && (map[id] || map[id.split('.')[0]])) || 0;
const covBonus = sc => (sc >= 3 ? 2 : sc >= 1 ? 1 : 0);
const b0goal = (content, meta) => { const d = content.tuning.goals?.[meta.goal]; return d ? { key: meta.goal, kinds: d.rule === 'payoff' ? d.kinds : [] } : null; };
function checkEnd(content, b) {
  if (b.over) return;
  if (b.res.cur <= 0) { b.res.cur = 0; endBattle(content, b, false, 'resilience'); return; }
  if (b.goal && b.goal.prog >= b.goal.need) { endBattle(content, b, false, 'goal'); return; }
  if (b.expo.cur >= b.expo.max) endBattle(content, b, true, 'evicted');
}
function endBattle(content, b, won, how) {
  if (b.over) return;
  b.over = true; b.phase = 'over';
  let debt = 0;
  if (won && b.adv.harvested > 0) debt = b.adv.harvested; // quantum debt: stolen ciphertext awaiting decryption
  const res = { won, how, rounds: b.round, resLost: b.stats.resLost, exposure: b.expo.cur, evictions: b.stats.evictions, adversary: b.adv.id, tier: b.adv.tier, boss: b.adv.boss, harvested: b.adv.harvested, debt, assetsDown: b.stats.assetsDown, resEnd: Math.max(0, b.res.cur - debt), moneyDelta: b.moneyDelta, blocked: b.stats.blocked, cardsPlayed: b.stats.cardsPlayed, ttxScore: b.ttx?.score || 0, jewelSafe: !b.assets.some(a => a.jewel && a.down), noReveal: b.stats.noReveal, spent: b.spent || [] };
  if (b.ttx) res.objectives = evalObjectives(content, b, won);
  b.result = res;
  ev(b, { t: 'battle_end', won, how });
}
function evalObjectives(content, b, won) {
  return (b.ttx.objectives || []).map(o => {
    let ok = false;
    switch (o.kind) {
      case 'keepJewel': ok = !b.assets.some(a => a.jewel && a.down); break;
      case 'detectBy': ok = b.firstRevealRound != null && b.firstRevealRound <= o.round; break;
      case 'evictAll': ok = b.footholds.length === 0; break;
      case 'resilienceAbove': ok = b.res.cur >= o.n; break;
      case 'win': ok = won; break;
      case 'decisions': ok = (b.ttx.log || []).filter(l => l.quality === 'best').length >= o.n; break;
      default: ok = false;
    }
    return { id: o.id, text: o.text, ok, points: ok ? o.points : 0 };
  });
}

export function forfeit(content, b) { if (!b.over) endBattle(content, b, false, 'forfeit'); }

/** Public dispatcher used by run.js and tests. Returns events produced by the action. */
export function battleAction(content, b, a) {
  b.events = [];
  switch (a.type) {
    case 'PLAY': playCard(content, b, a.iid, a.target || {}); break;
    case 'POWER': usePower(content, b, a.target || {}); break;
    case 'END_TURN': endTurn(content, b); break;
    case 'DECIDE': decide(content, b, a.choice); break;
    case 'FORFEIT': forfeit(content, b); break;
    default: bad('unknown battle action ' + a.type);
  }
  const events = b.events; b.events = [];
  return events;
}

/** What the player may know about the adversary's next move, by intel level. */
export function intentView(content, b) {
  const I = b.adv.intent; if (!I) return null;
  const c = b.adv.cards[I.uid];
  const lvl = Math.min(3, b.intel);
  const v = { level: lvl, tactic: c.tactic, kind: c.kind };
  if (lvl >= 1) { v.tech = c.id; v.name = c.name; v.origin = c.goalCard ? 'goal' : c.baseline ? 'baseline' : c.assessed ? 'assessed' : 'signature'; }
  if (lvl >= 2) { v.asset = I.asset || (I.fid ? foot(b, I.fid)?.asset : null); }
  if (lvl >= 3) { v.stride = c.stride; v.power = c.power; v.cost = c.cost; }
  return v;
}
export function publicState(b) { return b; }
