#!/usr/bin/env node
// Validates all game content: schema, cross-references, and authority checks against the MITRE data.
//   node scripts/validate-content.mjs [--strict]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveRef } from '../engine/refs.js';
import { loadCore, loadAttack, loadAdversaries, loadScenario, listScenarios } from './lib/load.mjs';
import { compileDeck } from '../engine/tactics.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const d3 = JSON.parse(readFileSync(path.join(root, 'scripts/data/d3fend-ids.json'), 'utf8'));
const icons = new Set(readdirSync(path.join(root, 'web/icons')).filter(f => f.endsWith('.svg')).map(f => f.slice(0, -4)));
const FNS = ['govern', 'identify', 'protect', 'detect', 'respond', 'recover'];
const PROPS = ['spoofing', 'tampering', 'repudiation', 'disclosure', 'dos', 'elevation'];
const CELLS = FNS.flatMap(f => PROPS.map(p => `${f}.${p}`));
const STR = ['S', 'T', 'R', 'I', 'D', 'E'];
const FX_OPS = new Set(['reveal', 'scanKinds', 'draw', 'energy', 'energyNext', 'resilience', 'exposure', 'intel', 'evict', 'evictPrivileged', 'isolate', 'heal', 'shield', 'shieldExfil', 'purge', 'restore', 'clearCreds', 'unstage', 'unprivilege', 'unprivilegeAll', 'blockPath', 'nextPolicyFree', 'damage', 'restoreBackup']);
const RELIC_OPS = new Set(['money', 'exposure', 'intel', 'draw', 'resilience', 'healAll', 'reveal', 'wardRandomAsset']);
const RUN_OPS = new Set(['money', 'resilience', 'maxResilience', 'addCard', 'addRandomCard', 'upgradeRandom', 'upgradeCard', 'addStatus', 'removeStatus', 'flag', 'relicChance', 'ifHasCard']);
const TRAIT_OPS = new Set(['startFootholds', 'discount', 'stealthBonus', 'bypass', 'energyBonus', 'drawBonus', 'ransomPressure', 'hndl', 'phase']);
const KINDS = ['prep', 'breach', 'arm', 'persist', 'escalate', 'evade', 'disable', 'creds', 'map', 'spread', 'stage', 'beacon', 'exfil', 'strike', 'inhibit', 'impair'];
const ASSET_KINDS = ['identity', 'email', 'endpoint', 'server', 'data', 'network', 'cloud', 'ot', 'backup', 'app', 'vendor'];
const KNOWN_EVENTS = new Set(['battle_start', 'battle_end', 'adv_play', 'played', 'evict', 'reveal', 'blocked', 'deploy', 'augment', 'policy', 'action', 'isolate', 'heal', 'asset_down', 'canary', 'aegis', 'revive', 'phase', 'persists', 'exfil', 'exfil_pqc', 'decision', 'inject', 'act_cleared', 'run_won', 'run_lost', 'card_added', 'card_removed', 'upgraded', 'relic', 'shop_buy', 'event_choice', 'wb_answer', 'wb_done', 'wb_perfect', 'consumed', 'goal', 'consumed_run', 'ttx_complete', 'status_added', 'dossier_view', 'daily_done', 'tutorial_done', 'docs_open', 'clearance', 'ach_unlocked']);

export function validateAll() {
  const errs = [], warns = [];
  const core = loadCore(), attack = loadAttack(), advs = loadAdversaries();
  const E = (f, m) => errs.push(`${f}: ${m}`);
  const W = (f, m) => warns.push(`${f}: ${m}`);
  const isStr = (v, min = 1, max = 2000) => typeof v === 'string' && v.trim().length >= min && v.length <= max;
  const num = v => typeof v === 'number' && Number.isFinite(v);
  const only = (obj, allowed, f, p) => { for (const k of Object.keys(obj || {})) if (!allowed.includes(k)) E(f, `${p}: unknown key "${k}"`); };
  const icon = (v, f, p) => { if (!icons.has(v)) E(f, `${p}: unknown icon "${v}"`); };

  const emb3d = Object.fromEntries(['threats', 'mitigations', 'properties'].map(k => [k, JSON.parse(readFileSync(path.join(root, `data/emb3d/${k}.json`), 'utf8'))]));
  const otAssets = JSON.parse(readFileSync(path.join(root, 'data/ctid/ot-assets.json'), 'utf8')).assets;
  function ref(r, f, p) {
    const res = resolveRef(r);
    if (!res) return E(f, `${p}: bad or unknown ref "${r}"`);
    const i = r.indexOf(':'), src = r.slice(0, i), id = r.slice(i + 1);
    if (src === 'attack' && /^A\d{4}$/.test(id)) { if (!otAssets[id]) E(f, `${p}: ATT&CK asset ${id} not in data/ctid/ot-assets.json`); }
    else if (src === 'attack') { const ok = attack.techniques[id] || attack.mitigations[id] || Object.values(attack.tactics).some(t => t.id === id || t.enterpriseId === id || t.icsId === id) || advs[id] || attackIdsAll[id]; if (!ok) E(f, `${p}: ATT&CK id ${id} not found in dataset`); }
    if (src === 'ics') { if (!attackIdsAll[id]) E(f, `${p}: ICS id ${id} not found`); }
    if (src === 'emb3d') { const t = id.startsWith('TID') ? emb3d.threats : id.startsWith('MID') ? emb3d.mitigations : emb3d.properties; if (!t[id]) E(f, `${p}: EMB3D id ${id} not found in data/emb3d`); }
    if (src === 'd3fend' && !d3[id]) E(f, `${p}: D3FEND id ${id} not found`);
  }
  const attackIdsAll = JSON.parse(readFileSync(path.join(root, 'scripts/data/mitre-attack-ids.json'), 'utf8')); // flatten
  for (const dom of Object.values(attackIdsAll)) Object.assign(attackIdsAll, dom);
  const refs = (a, f, p, { min = 0, max = 8 } = {}) => {
    if (!Array.isArray(a)) return E(f, `${p}: refs must be an array`);
    if (a.length < min || a.length > max) E(f, `${p}: needs ${min}-${max} refs (has ${a.length})`);
    a.forEach((r, i) => ref(r, f, `${p}[${i}]`));
  };
  const mitExists = (m, f, p) => { if (!attack.mitigations[m]) E(f, `${p}: mitigation ${m} not in ATT&CK data`); };
  const mitigates = (mitIds, tech) => { const t = attack.techniques[tech]; return !!t && (t.m || []).some(m => mitIds.includes(m)); };

  // ───── taxonomy
  const tax = core.taxonomy;
  for (const c of CELLS) { const x = tax.cells[c]; if (!x) { E('taxonomy', `missing cell ${c}`); continue; } if (!isStr(x.name, 3, 44) || !isStr(x.flavour, 8, 52) || !isStr(x.desc, 60, 420)) E('taxonomy', `${c}: name/flavour/desc length`); refs(x.refs, 'taxonomy', `${c}.refs`, { min: 2, max: 6 }); }

  // ───── cards
  const cards = new Map();
  for (const c of core.cards.cards) {
    const f = `cards:${c.id}`;
    if (cards.has(c.id)) E(f, 'duplicate id'); cards.set(c.id, c);
    if (!['control', 'action', 'policy', 'augment', 'status'].includes(c.type)) E(f, 'bad type');
    if (!FNS.includes(c.fn) || !PROPS.includes(c.prop)) E(f, 'bad fn/prop');
    if (!isStr(c.name, 3, 44)) E(f, 'name'); if (!isStr(c.desc, 30, 420)) E(f, 'desc'); refs(c.refs || [], f, 'refs', { min: c.type === 'status' ? 1 : 2, max: 6 });
    if (c.cell && !CELLS.includes(c.cell)) E(f, 'bad cell');
    if (!['none', 'asset', 'foothold', 'control'].includes(c.target)) E(f, 'bad target');
    if (c.type === 'control' && c.target !== 'asset') E(f, 'controls target an asset');
    if (c.type === 'augment' && c.target !== 'control') E(f, 'augments target a control');
    for (const m of c.mit || []) mitExists(m, f, 'mit');
    for (const k of ['protect', 'detect']) for (const [tid, sc] of Object.entries(c.cov?.[k] || {})) { if (!attack.techniques[tid]) E(f, `cov.${k} ${tid}: unknown technique`); if (![1, 2, 3].includes(sc)) E(f, `cov.${k} ${tid}: score must be 1-3`); }
    for (const s of Object.keys(c.ward || {})) if (!STR.includes(s)) E(f, 'bad ward stride ' + s);
    for (const fx of c.fx || []) if (!FX_OPS.has(fx.op)) E(f, 'unknown fx ' + fx.op);
    if (c.type === 'action' && !c.fx?.length) E(f, 'action needs fx');
    if (c.consume && !['battle', 'run'].includes(c.consume)) E(f, 'consume must be battle|run');
    if (c.consume && c.type !== 'action') E(f, 'only actions can be consumables');
    if (c.type === 'augment') {
      const au = c.aug || {};
      for (const m of au.mit || []) mitExists(m, f, 'aug.mit');
      for (const r of au.resists || []) {
        if (!attack.techniques[r]) E(f, `resists ${r}: technique not in ATT&CK data`);
        else if (!mitigates(au.mit || [], r)) E(f, `resists ${r}: ATT&CK lists none of ${JSON.stringify(au.mit)} as a mitigation for ${r} (${attack.techniques[r].n}). Use "expert" with a citation if this is expert knowledge.`);
      }
      for (const x of au.expert || []) { if (!attack.techniques[x.tech]) E(f, `expert ${x.tech}: unknown technique`); ref(x.ref, f, 'expert.ref'); }
      for (const b of c.base || []) if (!CELLS.includes(b) && !/^(govern|identify|protect|detect|respond|recover)\.\*$/.test(b)) E(f, 'bad base ' + b);
      if (!(c.base || []).length) E(f, 'augment needs base');
    }
    if (!['common', 'uncommon', 'rare', 'status'].includes(c.rarity)) E(f, 'bad rarity');
    if (!(c.cost >= 0 && c.cost <= 4)) E(f, 'cost 0-4');
  }
  for (const cell of CELLS) if (!cards.has('c.' + cell)) E('cards', `missing matrix card c.${cell}`);

  // ───── doctrines / relics / events / tuning
  const relics = new Map(core.relics.relics.map(r => [r.id, r]));
  for (const r of core.relics.relics) {
    const f = `relics:${r.id}`; icon(r.icon, f, 'icon'); refs(r.refs, f, 'refs', { min: 1, max: 4 });
    for (const [h, list] of Object.entries(r.hooks)) if (h !== 'passive') for (const x of list) if (!RELIC_OPS.has(x.op)) E(f, `unknown hook op ${x.op}`);
  }
  for (const d of core.doctrines.doctrines) {
    const f = `doctrine:${d.id}`; icon(d.icon, f, 'icon');
    if (d.deck.length !== 12) E(f, 'starter deck must have 12 cards');
    for (const id of d.deck) if (!cards.has(id)) E(f, 'unknown card ' + id);
    if (!relics.has(d.relic)) E(f, 'unknown relic ' + d.relic);
    for (const fx of d.power.fx) if (!FX_OPS.has(fx.op)) E(f, 'bad power fx');
    if (d.unlock && !core.achievements.achievements.some(a => a.id === d.unlock)) E(f, 'unlock achievement missing ' + d.unlock);
  }
  const runFx = (fx, f, p) => { if (!RUN_OPS.has(fx.op)) E(f, `${p}: unknown run op ${fx.op}`); if (['addCard', 'upgradeCard', 'ifHasCard'].includes(fx.op) && !cards.has(fx.id)) E(f, `${p}: unknown card ${fx.id}`); if (fx.op === 'addStatus' && !cards.has(fx.id)) E(f, `${p}: unknown status ${fx.id}`); if (fx.op === 'relicChance' && !relics.has(fx.id)) E(f, `${p}: unknown relic ${fx.id}`); for (const x of [...(fx.then || []), ...(fx.else || [])]) runFx(x, f, p + '.nested'); };
  for (const e of core.events.events) { const f = `event:${e.id}`; if (!isStr(e.text, 40, 400)) E(f, 'text'); if (!e.choices?.length || e.choices.length > 3) E(f, '1-3 choices'); e.choices.forEach((c, i) => { for (const fx of c.fx) runFx(fx, f, `choices[${i}]`); refs(c.refs || [], f, `choices[${i}].refs`, { max: 3 }); }); }

  // ───── achievements
  const achIds = new Set();
  for (const a of core.achievements.achievements) {
    const f = `ach:${a.id}`; if (achIds.has(a.id)) E(f, 'dup'); achIds.add(a.id);
    icon(a.icon, f, 'icon'); if (!['bronze', 'silver', 'gold', 'platinum'].includes(a.tier)) E(f, 'tier');
    if (!KNOWN_EVENTS.has(a.rule.event)) E(f, 'unknown event ' + a.rule.event);
    if (!isStr(a.name, 3, 40) || !isStr(a.desc, 10, 160)) E(f, 'name/desc');
    refs(a.refs || [], f, 'refs', { max: 4 });
  }
  const nAch = core.achievements.achievements.length;
  if (nAch < 60) W('achievements', `only ${nAch}`);

  // ───── goals
  for (const [gid, g] of Object.entries(core.tuning.goals || {})) {
    const f = `goal:${gid}`; icon(g.icon, f, 'icon'); refs(g.refs, f, 'refs', { min: 1, max: 4 });
    if (!['dwell', 'reach', 'payoff'].includes(g.rule)) E(f, 'bad rule');
    if (!Array.isArray(g.need) || g.need.length !== 3 || g.need.some(n => !Number.isInteger(n) || n < 1)) E(f, 'need must be [t1,t2,t3]');
    if (g.rule === 'payoff' && !g.kinds?.length) E(f, 'payoff goal needs kinds');
    for (const k of ['blurb', 'how', 'lesson']) if (!isStr(g[k], 20, 400)) E(f, k);
  }
  // ───── adversary meta
  for (const [id, m] of Object.entries(core.adversaryMeta)) {
    const f = `advmeta:${id}`;
    if (!advs[id]) E(f, 'no data/adversaries file'); icon(m.icon, f, 'icon');
    if (![1, 2, 3].includes(m.tier)) E(f, 'tier');
    if (!core.tuning.goals?.[m.goal]) E(f, 'goal must be one of tuning.goals: ' + m.goal);
    if (!isStr(m.blurb, 40, 320)) E(f, 'blurb');
    for (const t of m.traits || []) { if (!TRAIT_OPS.has(t.op)) E(f, 'bad trait op ' + t.op); if (!isStr(t.text, 15, 260)) E(f, `trait ${t.id} text`); if (t.op === 'discount') for (const k of t.kinds) if (!KINDS.includes(k)) E(f, 'bad kind ' + k); }
    for (const a of m.assessed || []) if (!attack.techniques[a]) E(f, 'assessed technique unknown ' + a);
    if (advs[id]) { const deck = compileDeck(advs[id], { tier: m.tier, assessed: m.assessed || [], techTable: attack.techniques }); const pay = deck.filter(c => ['exfil', 'strike', 'impair'].includes(c.kind)).length; if (pay < 1 && m.tier >= 2) W(f, `deck has no payoff (exfil/strike/impair) cards`); if (deck.length < 12) W(f, `deck is small (${deck.length})`); }
  }

  // ───── scenarios
  for (const id of listScenarios()) {
    const p = loadScenario(id), f = `scenario:${id}`;
    if (p.schema !== 2 || p.kind !== 'scenario' || p.id !== id) E(f, 'schema/kind/id mismatch');
    icon(p.icon, f, 'icon');
    const t = p.theme; if (!t || ![t.accent, t.accent2, ...(t.bg || [])].every(c => /^#[0-9a-fA-F]{6}$/.test(c)) || t.bg.length !== 3) E(f, 'theme');
    if (!isStr(p.tagline, 10, 80)) E(f, 'tagline');
    const o = p.org; if (!o || !isStr(o.name, 3, 40) || !isStr(o.brief, 80, 600) || !(o.crownJewels || []).length || !(o.regimes || []).length) E(f, 'org');
    o?.regimes?.forEach((r, i) => refs(r.refs || [], f, `org.regimes[${i}].refs`, { max: 3 }));
    // assets
    const A = new Map((p.assets || []).map(a => [a.id, a]));
    if (A.size < 6 || A.size > 9) E(f, `assets: 6–9 (has ${A.size})`);
    for (const a of A.values()) {
      const g = `${f}.assets.${a.id}`; icon(a.icon, g, 'icon');
      if (!ASSET_KINDS.includes(a.kind)) E(g, 'kind'); if (!(a.hp >= 6 && a.hp <= 12)) E(g, 'hp 6–12'); if (!isStr(a.desc, 10, 150)) E(g, 'desc ≤150');
      for (const n of a.adjacent) { if (!A.has(n)) E(g, 'adjacent unknown ' + n); else if (!A.get(n).adjacent.includes(a.id)) E(g, `adjacency not symmetric with ${n}`); }
    }
    const jewels = [...A.values()].filter(a => a.jewel), exposed = [...A.values()].filter(a => a.exposed);
    if (!jewels.length || jewels.length > 2) E(f, '1–2 crown jewels'); if (exposed.length < 2) E(f, '≥2 exposed assets');
    const dist = (from) => { const seen = new Map([[from, 0]]); const q = [from]; while (q.length) { const x = q.shift(); for (const n of A.get(x)?.adjacent || []) if (!seen.has(n)) { seen.set(n, seen.get(x) + 1); q.push(n); } } return seen; };
    if (exposed[0] && dist(exposed[0].id).size !== A.size) E(f, 'asset graph is not connected');
    for (const e of exposed) { const d = dist(e.id); for (const j of jewels) if ((d.get(j.id) ?? 9) < 2) E(f, `crown jewel ${j.id} is adjacent to exposed asset ${e.id} (need ≥2 hops)`); }
    // roster
    const acts = p.roster?.acts; if (!acts || acts.length !== 3) E(f, 'roster needs 3 acts');
    for (const [i, ac] of (acts || []).entries()) for (const k of [...ac.battle, ...ac.elite, ac.boss]) { if (!advs[k]) E(f, `roster act ${i + 1}: no adversary data for ${k}`); else if (!core.adversaryMeta[k]) E(f, `roster: no meta for ${k}`); }
    // overrides
    for (const [c, x] of Object.entries(p.cardOverrides || {})) { if (!CELLS.includes(c)) E(f, 'override cell ' + c); if (!isStr(x.name, 3, 44) || !isStr(x.flavour, 8, 52) || !isStr(x.desc, 60, 420)) E(f, `override ${c} lengths`); refs(x.refs, f, `override ${c}.refs`, { min: 2, max: 6 }); }
    if (p.systems?.length > 2) E(f, 'systems: 0–2');
    p.systems?.forEach((s, i) => system(s, f, `systems[${i}]`, E, W, refs, isStr, num, only));
    for (const t of p.ttx || []) ttx(t, p, f, E, W, refs, advs, core, attack);
    for (const c of p.cards || []) if (cards.has(c.id) && !c.id.startsWith(id + '.')) E(f, `scenario card id must be prefixed "${id}."`);
    if (!(p.reading || []).length) W(f, 'no reading list');
    for (const r of p.reading || []) if (!/^https:\/\//.test(r.url)) E(f, 'reading url');
  }
  return { errs, warns };
}

function ttx(t, p, f, E, W, refs, advs, core, attack) {
  const g = `${f}.ttx.${t.id}`;
  if (!advs[t.adversary?.id]) E(g, 'unknown adversary');
  if (!(t.rounds >= 4 && t.rounds <= 12)) E(g, 'rounds 4–12');
  const ids = new Set();
  for (const inj of t.injects || []) {
    if (ids.has(inj.id)) E(g, 'dup inject ' + inj.id); ids.add(inj.id);
    if (!(inj.round >= 1 && inj.round <= t.rounds)) E(g, `inject ${inj.id} round`);
    if (inj.decision) { if (inj.decision.choices.length < 2 || inj.decision.choices.length > 4) E(g, `inject ${inj.id} choices`); if (!inj.decision.choices.some(c => c.quality === 'best')) E(g, `inject ${inj.id} needs a best choice`); for (const c of inj.decision.choices) refs(c.refs || [], g, `${inj.id}.${c.id}.refs`, { max: 3 }); }
  }
  for (const o of t.objectives || []) if (!['keepJewel', 'detectBy', 'evictAll', 'resilienceAbove', 'win', 'decisions'].includes(o.kind)) E(g, 'objective kind ' + o.kind);
}
function system(s, f, p, E0, W0, refs0, isStr, num, only0) {
  const E = (pp, m) => E0(f, `${pp}: ${m}`), W = (pp, m) => W0(f, `${pp}: ${m}`);
  const only = (o, a, pp) => only0(o, a, f, pp);
  const refs = (a, pp, opt) => refs0(a, f, pp, opt);
  const asList = v => Array.isArray(v) ? v : [v];
    only(s, ['id', 'name', 'blurb', 'elements', 'flows', 'boundaries', 'scenarios'], p);
    if (!isStr(s.id) || !isStr(s.name, 3, 60) || !isStr(s.blurb, 30, 320)) E(p, 'id/name/blurb required (blurb 30–320)');
    const els = new Map();
    if (!Array.isArray(s.elements) || s.elements.length < 5 || s.elements.length > 9) E(p, 'elements: 5–9');
    (s.elements || []).forEach((e, i) => {
      const q = `${p}.elements[${i}]`;
      only(e, ['id', 'type', 'label', 'x', 'y'], q);
      if (!isStr(e.id) || els.has(e.id)) E(q, 'id missing/duplicate'); else els.set(e.id, e);
      if (!['process', 'store', 'external'].includes(e.type)) E(q, 'type process|store|external');
      if (!isStr(e.label, 2, 26)) E(q, 'label 2–26 chars');
      if (!(e.x >= 90 && e.x <= 910 && e.y >= 50 && e.y <= 510)) E(q, 'x∈[90,910], y∈[50,510]');
    });
    const arr = [...els.values()];
    for (let i = 0; i < arr.length; i++) for (let k = i + 1; k < arr.length; k++) {
      if (Math.abs(arr[i].x - arr[k].x) < 190 && Math.abs(arr[i].y - arr[k].y) < 100) E(p, `elements ${arr[i].id} and ${arr[k].id} overlap/too close (need ≥190 horizontal or ≥100 vertical separation)`);
    }
    const flows = new Map(); const pairs = new Set();
    if (!Array.isArray(s.flows) || s.flows.length < 6 || s.flows.length > 12) E(p, 'flows: 6–12');
    (s.flows || []).forEach((f, i) => {
      const q = `${p}.flows[${i}]`;
      only(f, ['id', 'from', 'to', 'label'], q);
      if (!isStr(f.id) || flows.has(f.id) || els.has(f.id)) E(q, 'id missing/duplicate (flow ids must not collide with element ids)'); else flows.set(f.id, f);
      if (!els.has(f.from) || !els.has(f.to) || f.from === f.to) E(q, 'from/to must be distinct existing elements');
      if (!isStr(f.label, 2, 28)) E(q, 'label 2–28 chars');
      const key = `${f.from}>${f.to}`; if (pairs.has(key)) E(q, 'duplicate ordered pair'); pairs.add(key);
      if (pairs.has(`${f.to}>${f.from}`)) W(q, 'bidirectional pair draws overlapping arrows; prefer a single labelled flow');
    });
    (s.boundaries || []).forEach((b, i) => {
      const q = `${p}.boundaries[${i}]`;
      only(b, ['id', 'label', 'x', 'y', 'w', 'h'], q);
      if (![b.x, b.y, b.w, b.h].every(num) || b.w < 100 || b.h < 100 || b.x < 0 || b.y < 0 || b.x + b.w > 1000 || b.y + b.h > 560) E(q, 'bad rectangle');
      for (const e of els.values()) {
        const ex1 = e.x - 85, ex2 = e.x + 85, ey1 = e.y - 32, ey2 = e.y + 32;
        const inside = ex1 >= b.x && ex2 <= b.x + b.w && ey1 >= b.y && ey2 <= b.y + b.h;
        const outside = ex2 <= b.x || ex1 >= b.x + b.w || ey2 <= b.y || ey1 >= b.y + b.h;
        if (!inside && !outside) E(q, `element ${e.id} straddles boundary`);
      }
    });
    const sc = s.scenarios;
    if (!Array.isArray(sc) || sc.length !== 8) return E(p, 'exactly 8 scenarios');
    const letters = new Set(); let nFlow = 0, nStore = 0; const ids = new Set();
    sc.forEach((x, i) => {
      const q = `${p}.scenarios[${i}]`;
      only(x, ['id', 'target', 'text', 'answer', 'why', 'refs'], q);
      if (!isStr(x.id) || ids.has(x.id)) E(q, 'id missing/duplicate'); ids.add(x.id);
      const t = x.target;
      if (!t || !['element', 'flow'].includes(t.kind)) return E(q, 'target.kind element|flow');
      const tgt = t.kind === 'flow' ? flows.get(t.id) : els.get(t.id);
      if (!tgt) return E(q, `target ${t.id} not found`);
      if (t.kind === 'flow') nFlow++;
      if (t.kind === 'element' && tgt.type === 'store') nStore++;
      if (!'STRIDE'.includes(x.answer) || x.answer.length !== 1) E(q, 'answer must be one of S T R I D E');
      letters.add(x.answer);
      const ok = t.kind === 'flow' ? 'TID' : tgt.type === 'external' ? 'SR' : tgt.type === 'store' ? 'TRID' : 'STRIDE';
      if (!ok.includes(x.answer)) E(q, `answer ${x.answer} not applicable to a ${t.kind === 'flow' ? 'flow' : tgt.type} (STRIDE-per-element allows ${ok})`);
      if (!isStr(x.text, 50, 340)) E(q, 'text 50–340 chars');
      if (!isStr(x.why, 60, 520)) E(q, 'why 60–520 chars');
      refs(x.refs || [], `${q}.refs`, { max: 4 });
    });
    if (letters.size < 5) E(p, `scenarios cover only ${letters.size} STRIDE letters (need ≥5)`);
    if (nFlow < 2) E(p, 'need ≥2 flow scenarios'); if (nStore < 2) E(p, 'need ≥2 store scenarios');
  }


if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { errs, warns } = validateAll();
  warns.forEach(w => console.warn('warn  ' + w));
  errs.forEach(e => console.error('ERROR ' + e));
  console.log(`${errs.length ? '✗' : '✓'} content: ${errs.length} errors, ${warns.length} warnings`);
  process.exit(errs.length && !process.argv.includes('--warn-only') ? 1 : 0);
}
