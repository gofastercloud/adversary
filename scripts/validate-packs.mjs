#!/usr/bin/env node
// Validates every pack in packs/ against docs/PACK_FORMAT.md, including MITRE ID existence.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { resolveRef, REF_SOURCES } from '../engine/refs.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const attackIds = JSON.parse(readFileSync(path.join(root, 'scripts/data/mitre-attack-ids.json'), 'utf8'));
const d3fendIds = JSON.parse(readFileSync(path.join(root, 'scripts/data/d3fend-ids.json'), 'utf8'));
const icons = new Set(readdirSync(path.join(root, 'web/icons')).filter(f => f.endsWith('.svg')).map(f => f.slice(0, -4)));

const FNS = ['govern', 'identify', 'protect', 'detect', 'respond', 'recover'];
const PROPS = ['spoofing', 'tampering', 'repudiation', 'disclosure', 'dos', 'elevation'];
const CELLS = FNS.flatMap(f => PROPS.map(p => `${f}.${p}`));
const HAND_TYPES = ['high_card', 'pair', 'two_pair', 'three', 'straight', 'flush', 'full_house', 'four', 'straight_flush', 'five', 'monoculture'];
const CONTAINS = ['pair', 'two_pair', 'three', 'four', 'five', 'flush', 'straight', 'full_house'];
const RARITY = ['common', 'uncommon', 'rare'];
const TRIGGERS = ['card', 'held', 'hand', 'retrigger', 'discard', 'round_end', 'boss_defeated', 'passive'];
const COND_KEYS = ['fn', 'prop', 'ml', 'mlMin', 'counter', 'hand', 'contains', 'playedMax', 'playedMin', 'scoringMin', 'handsLeft', 'firstHand', 'noDiscardsUsed', 'distinctFnsMin', 'distinctPropsMin', 'distinctPropsMax', 'moneyMin', 'moneyMax', 'jokersMax', 'boss', 'cardsMin'];
const DO_KEYS = ['chips', 'mult', 'xmult', 'money', 'times', 'handSize', 'hands', 'discards', 'jokerSlots', 'consumableSlots', 'interestCap'];
const COUNTS = ['scoringCards', 'playedCards', 'heldCards', 'discardedCards', 'jokers', 'money', 'deckSize', 'handLevel', 'distinctProps', 'distinctFns', 'handsLeft', 'discardsLeft', 'v'];
const BOSS_KEYS = ['debuffFn', 'debuffProp', 'handsSet', 'discardsSet', 'handSizeDelta', 'playMin', 'halveBase', 'moneyPerCard', 'noRepeatHand', 'oneHandType', 'disableJoker', 'targetMult'];
const PB_OPS = ['setProp', 'setFn', 'upgrade', 'destroy', 'clone', 'copyFn', 'money', 'createJoker'];
const HEX = /^#[0-9a-fA-F]{6}$/;

export function validatePack(pack, file = '?') {
  const errs = [], warns = [];
  const E = (p, m) => errs.push(`${file}: ${p}: ${m}`);
  const W = (p, m) => warns.push(`${file}: ${p}: ${m}`);
  const isStr = (v, min = 1, max = 2000) => typeof v === 'string' && v.trim().length >= min && v.length <= max;
  const num = v => typeof v === 'number' && Number.isFinite(v);

  function ref(r, p) {
    const res = resolveRef(r);
    if (!res) return E(p, `bad or unknown ref "${r}" (sources: ${REF_SOURCES.join(', ')})`);
    const [src, id] = [r.slice(0, r.indexOf(':')), r.slice(r.indexOf(':') + 1)];
    if (src === 'attack' && !attackIds.enterprise[id]) E(p, `ATT&CK Enterprise id ${id} does not exist`);
    if (src === 'ics' && !attackIds.ics[id]) E(p, `ATT&CK ICS id ${id} does not exist`);
    if (src === 'd3fend' && !d3fendIds[id]) E(p, `D3FEND id ${id} does not exist`);
  }
  const refs = (a, p, { min = 0, max = 8 } = {}) => {
    if (!Array.isArray(a)) return E(p, 'must be an array of refs');
    if (a.length < min || a.length > max) E(p, `needs ${min}-${max} refs, has ${a.length}`);
    a.forEach((r, i) => ref(r, `${p}[${i}]`));
  };
  const icon = (v, p) => { if (!icons.has(v)) E(p, `unknown icon "${v}"`); };
  const only = (obj, allowed, p) => { for (const k of Object.keys(obj)) if (!allowed.includes(k)) E(p, `unknown key "${k}" (allowed: ${allowed.join(', ')})`); };
  const asList = v => Array.isArray(v) ? v : [v];

  function cond(c, p, kind) {
    if (c == null) return;
    if (typeof c !== 'object') return E(p, 'must be an object');
    only(c, COND_KEYS, p);
    for (const k of ['fn']) if (c[k] != null) asList(c[k]).forEach(x => FNS.includes(x) || E(p, `bad fn ${x}`));
    for (const k of ['prop']) if (c[k] != null) asList(c[k]).forEach(x => PROPS.includes(x) || E(p, `bad prop ${x}`));
    if (c.hand) c.hand.forEach(x => HAND_TYPES.includes(x) || E(p, `bad hand type ${x}`));
    if (c.contains) c.contains.forEach(x => CONTAINS.includes(x) || E(p, `bad contains ${x}`));
    for (const k of COND_KEYS) if (typeof c[k] === 'number' && !Number.isInteger(c[k])) E(p, `${k} must be an integer`);
  }
  function rules(rs, p) {
    if (!Array.isArray(rs) || !rs.length) return E(p, 'rules must be a non-empty array');
    rs.forEach((r, i) => {
      const q = `${p}[${i}]`;
      only(r, ['on', 'if', 'per', 'do', 'grow'], q);
      if (!TRIGGERS.includes(r.on)) return E(q, `bad trigger "${r.on}"`);
      cond(r.if, `${q}.if`);
      if (r.per) {
        only(r.per, ['count', 'fn', 'prop', 'ml', 'step'], `${q}.per`);
        if (!COUNTS.includes(r.per.count)) E(q, `bad per.count ${r.per.count}`);
        if (r.per.count === 'money' && !(r.per.step > 0)) E(q, 'per.count money needs step');
        if (r.per.fn) asList(r.per.fn).forEach(x => FNS.includes(x) || E(q, `bad per.fn ${x}`));
        if (r.per.prop) asList(r.per.prop).forEach(x => PROPS.includes(x) || E(q, `bad per.prop ${x}`));
      }
      if (r.do) {
        only(r.do, DO_KEYS, `${q}.do`);
        for (const [k, v] of Object.entries(r.do)) {
          if (v === '$v') continue;
          if (!num(v)) E(q, `do.${k} must be a number or "$v"`);
        }
        if (r.on === 'passive' && Object.keys(r.do).some(k => !['handSize', 'hands', 'discards', 'jokerSlots', 'consumableSlots', 'interestCap'].includes(k))) E(q, 'passive may only change handSize/hands/discards/jokerSlots/consumableSlots/interestCap');
        if (r.on !== 'passive' && Object.keys(r.do).some(k => ['handSize', 'hands', 'discards', 'jokerSlots', 'consumableSlots', 'interestCap'].includes(k))) E(q, 'passive keys only valid with on:"passive"');
        if (r.on === 'retrigger' && !r.do.times) E(q, 'retrigger needs do.times');
        if ((r.on === 'discard' || r.on === 'round_end' || r.on === 'boss_defeated') && (r.do.chips || r.do.mult || r.do.xmult)) E(q, `${r.on} rules can only give money`);
        if (r.on === 'passive' && r.if) E(q, 'passive rules cannot have conditions');
        if (r.do.xmult != null && r.do.xmult !== '$v' && !r.per) {
          if (r.do.xmult < 1.2 || r.do.xmult > 4) E(q, 'literal xmult must be 1.2–4');
          if (!r.if) E(q, 'unconditional xmult is not allowed');
        }
        if (r.do.xmult != null && r.per && !(r.do.xmult > 0 && r.do.xmult <= 1)) E(q, 'per-scaled xmult increment must be in (0,1]');
        if (num(r.do.mult) && r.do.mult > 20) E(q, 'mult > 20 is out of range');
        if (num(r.do.chips) && r.do.chips > 150) E(q, 'chips > 150 is out of range');
        if (num(r.do.money) && r.do.money > 8) E(q, 'money > 8 is out of range');
      } else if (!r.grow) E(q, 'rule needs do and/or grow');
      if (r.grow) {
        only(r.grow, ['by', 'reset'], `${q}.grow`);
        if (!num(r.grow.by)) E(q, 'grow.by must be a number');
        cond(r.grow.reset, `${q}.grow.reset`);
      }
    });
    if (rs.some(r => (r.do && Object.values(r.do).includes('$v')) ) && !rs.some(r => r.grow)) E(p, 'uses "$v" but has no grow rule');
  }
  function joker(j, p, packId) {
    only(j, ['id', 'name', 'rarity', 'icon', 'init', 'rules', 'lesson', 'refs'], p);
    if (!isStr(j.id) || !j.id.startsWith(packId + '.')) E(p, `id must start with "${packId}."`);
    if (!isStr(j.name, 2, 32)) E(p, 'name 2–32 chars');
    if (!RARITY.includes(j.rarity)) E(p, 'bad rarity');
    icon(j.icon, `${p}.icon`);
    if (!isStr(j.lesson, 30, 400)) E(p, 'lesson 30–400 chars');
    refs(j.refs, `${p}.refs`, { min: 1, max: 4 });
    rules(j.rules, `${p}.rules`);
  }
  function blind(b, p, boss) {
    const allowed = ['name', 'tactic', 'technique', 'blurb', 'counters', 'mitigations', 'refs', ...(boss ? ['rule', 'lesson'] : [])];
    only(b, allowed, p);
    if (!isStr(b.name, 3, 40)) E(p, 'name 3–40 chars');
    if (!isStr(b.blurb, 30, 330)) E(p, 'blurb 30–330 chars');
    if (!/^(attack|ics):TA\d{4}$/.test(b.tactic || '')) E(p, 'tactic must be attack:TA#### or ics:TA####'); else ref(b.tactic, `${p}.tactic`);
    if (!/^(attack|ics):T\d{4}(\.\d{3})?$/.test(b.technique || '')) E(p, 'technique must be attack:T#### or ics:T####'); else ref(b.technique, `${p}.technique`);
    if (!Array.isArray(b.counters) || b.counters.length < 1 || b.counters.length > 4) E(p, 'counters: 1–4 cell ids'); else b.counters.forEach(c => CELLS.includes(c) || E(p, `bad counter cell ${c}`));
    refs(b.mitigations, `${p}.mitigations`, { min: 1, max: 5 });
    b.mitigations?.forEach(m => /^(attack|ics):M\d{4}$/.test(m) || E(p, `mitigation ${m} must be an M id`));
    refs(b.refs || [], `${p}.refs`, { max: 4 });
    if (boss) {
      if (!isStr(b.lesson, 60, 480)) E(p, 'boss lesson 60–480 chars');
      const r = b.rule;
      if (!r || typeof r !== 'object') return E(p, 'boss needs rule');
      only(r, BOSS_KEYS, `${p}.rule`);
      const ks = Object.keys(r);
      if (ks.length < 1 || ks.length > 2) E(p, 'rule: 1–2 keys');
      if (r.debuffFn) asList(r.debuffFn).forEach(x => FNS.includes(x) || E(p, `bad debuffFn ${x}`));
      if (r.debuffProp) asList(r.debuffProp).forEach(x => PROPS.includes(x) || E(p, `bad debuffProp ${x}`));
      if (r.handsSet != null && !(r.handsSet >= 1 && r.handsSet <= 3)) E(p, 'handsSet 1–3');
      if (r.discardsSet != null && !(r.discardsSet >= 0 && r.discardsSet <= 2)) E(p, 'discardsSet 0–2');
      if (r.handSizeDelta != null && !(r.handSizeDelta >= -2 && r.handSizeDelta <= -1)) E(p, 'handSizeDelta -1 or -2');
      if (r.playMin != null && !(r.playMin >= 3 && r.playMin <= 5)) E(p, 'playMin 3–5');
      if (r.moneyPerCard != null && !(r.moneyPerCard === -1)) E(p, 'moneyPerCard must be -1');
      if (r.disableJoker != null && r.disableJoker !== 'random') E(p, 'disableJoker must be "random"');
      if (r.targetMult != null && !(r.targetMult >= 1.5 && r.targetMult <= 3)) E(p, 'targetMult 1.5–3');
    }
  }
  function system(s, p) {
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

  // ---------- top level
  if (pack.schema !== 1) E('schema', 'must be 1');
  if (!/^[a-z0-9-]+$/.test(pack.id || '')) E('id', 'kebab-case id required');
  if (pack.id !== file.replace(/\.json$/, '')) E('id', `must match filename (${file})`);
  if (!isStr(pack.name, 2, 40)) E('name', 'required');
  if (!/^\d+\.\d+\.\d+$/.test(pack.version || '')) E('version', 'semver required');

  if (pack.kind === 'core') {
    for (const f of FNS) if (!pack.functions?.some(x => x.id === f)) E('functions', `missing ${f}`);
    for (const f of PROPS) if (!pack.properties?.some(x => x.id === f)) E('properties', `missing ${f}`);
    for (const c of CELLS) {
      const x = pack.cells?.[c];
      if (!x) { E('cells', `missing ${c}`); continue; }
      if (!isStr(x.name, 3, 40) || !isStr(x.flavour, 8, 48) || !isStr(x.desc, 60, 400)) E(`cells.${c}`, 'name 3–40, flavour 8–48, desc 60–400');
      refs(x.refs, `cells.${c}.refs`, { min: 2, max: 6 });
    }
    HAND_TYPES.forEach(h => pack.handTypes?.some(x => x.id === h) || E('handTypes', `missing ${h}`));
    pack.jokers?.forEach((j, i) => joker(j, `jokers[${i}]`, 'core'));
    pack.playbooks?.forEach((b, i) => { if (!PB_OPS.includes(b.op)) E(`playbooks[${i}]`, 'bad op'); icon(b.icon, `playbooks[${i}].icon`); refs(b.refs, `playbooks[${i}].refs`, { min: 1 }); });
    pack.frameworks?.forEach((b, i) => { icon(b.icon, `frameworks[${i}].icon`); refs(b.refs, `frameworks[${i}].refs`, { min: 1 }); });
  } else if (pack.kind === 'campaign') {
    only(pack, ['schema', 'id', 'kind', 'name', 'version', 'tagline', 'icon', 'theme', 'org', 'cardOverrides', 'jokers', 'playbooks', 'campaign', 'systems', 'reading'], '$');
    if (!isStr(pack.tagline, 10, 60)) E('tagline', '10–60 chars');
    icon(pack.icon, 'icon');
    const t = pack.theme;
    if (!t || !HEX.test(t.accent) || !HEX.test(t.accent2) || !Array.isArray(t.bg) || t.bg.length !== 3 || !t.bg.every(c => HEX.test(c))) E('theme', 'needs accent, accent2 (#rrggbb) and bg[3]');
    const o = pack.org;
    if (!o || !isStr(o.name, 3, 40) || !isStr(o.sector, 3, 60) || !isStr(o.brief, 80, 600)) E('org', 'name, sector, brief(80–600) required');
    if (o && (!Array.isArray(o.crownJewels) || o.crownJewels.length < 2 || o.crownJewels.length > 5)) E('org.crownJewels', '2–5 items');
    if (o && (!Array.isArray(o.regimes) || o.regimes.length < 1 || o.regimes.length > 4)) E('org.regimes', '1–4');
    o?.regimes?.forEach((r, i) => { if (!isStr(r.name, 3, 70) || !isStr(r.note, 30, 320)) E(`org.regimes[${i}]`, 'name & note (30–320)'); refs(r.refs || [], `org.regimes[${i}].refs`, { max: 3 }); });
    const co = Object.entries(pack.cardOverrides || {});
    if (co.length < 10 || co.length > 16) E('cardOverrides', `10–16 cells (has ${co.length})`);
    co.forEach(([c, x]) => {
      if (!CELLS.includes(c)) return E('cardOverrides', `bad cell ${c}`);
      only(x, ['name', 'flavour', 'desc', 'refs'], `cardOverrides.${c}`);
      if (!isStr(x.name, 3, 40) || !isStr(x.flavour, 8, 48) || !isStr(x.desc, 60, 400)) E(`cardOverrides.${c}`, 'name 3–40, flavour 8–48, desc 60–400');
      refs(x.refs, `cardOverrides.${c}.refs`, { min: 2, max: 6 });
    });
    if (!Array.isArray(pack.jokers) || pack.jokers.length < 7 || pack.jokers.length > 10) E('jokers', '7–10 jokers');
    const ids = new Set();
    pack.jokers?.forEach((j, i) => { joker(j, `jokers[${i}]`, pack.id); if (ids.has(j.id)) E('jokers', `dup id ${j.id}`); ids.add(j.id); });
    if (pack.jokers) { const r = {}; pack.jokers.forEach(j => r[j.rarity] = (r[j.rarity] || 0) + 1); if (!r.rare) W('jokers', 'no rare jokers'); if ((r.common || 0) < 2) W('jokers', 'fewer than 2 common jokers'); }
    pack.playbooks?.forEach((b, i) => {
      only(b, ['id', 'name', 'icon', 'cost', 'op', 'target', 'params', 'lesson', 'refs'], `playbooks[${i}]`);
      if (!b.id?.startsWith(pack.id + '.')) E(`playbooks[${i}]`, 'id prefix'); if (!PB_OPS.includes(b.op)) E(`playbooks[${i}]`, 'bad op'); icon(b.icon, `playbooks[${i}].icon`); refs(b.refs, `playbooks[${i}].refs`, { min: 1 });
    });
    const an = pack.campaign?.antes;
    if (!Array.isArray(an) || an.length !== 8) E('campaign.antes', 'exactly 8 antes');
    else {
      const bossKinds = new Set();
      an.forEach((a, i) => {
        const p = `campaign.antes[${i}]`;
        only(a, ['name', 'small', 'big', 'boss'], p);
        if (!isStr(a.name, 3, 40)) E(p, 'name');
        blind(a.small, `${p}.small`, false); blind(a.big, `${p}.big`, false); blind(a.boss, `${p}.boss`, true);
        Object.keys(a.boss?.rule || {}).forEach(k => bossKinds.add(k));
      });
      if (bossKinds.size < 5) E('campaign', `bosses use only ${bossKinds.size} distinct rule keys (need ≥5)`);
      const techs = an.flatMap(a => [a.small, a.big, a.boss].map(b => b?.technique)); if (new Set(techs).size < 22) W('campaign', 'many repeated techniques');
    }
    if (!Array.isArray(pack.systems) || pack.systems.length !== 2) E('systems', 'exactly 2 systems');
    else { pack.systems.forEach((s, i) => system(s, `systems[${i}]`)); const all = new Set(); pack.systems.forEach(s => s.scenarios?.forEach(x => { if (all.has(x.id)) E('systems', `duplicate scenario id ${x.id}`); all.add(x.id); })); }
    if (!Array.isArray(pack.reading) || pack.reading.length < 3 || pack.reading.length > 6) E('reading', '3–6 items');
    pack.reading?.forEach((r, i) => { if (!isStr(r.title, 3, 90) || !/^https:\/\//.test(r.url || '')) E(`reading[${i}]`, 'title + https url'); });
  } else E('kind', 'must be core or campaign');
  return { errs, warns };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = path.join(root, 'packs');
  const only = process.argv.slice(2);
  const files = readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json' && (!only.length || only.includes(f.replace('.json', ''))));
  let bad = 0;
  for (const f of files) {
    let pack;
    try { pack = JSON.parse(readFileSync(path.join(dir, f), 'utf8')); } catch (e) { console.error(`${f}: invalid JSON: ${e.message}`); bad++; continue; }
    const { errs, warns } = validatePack(pack, f);
    warns.forEach(w => console.warn('warn  ' + w));
    errs.forEach(e => console.error('ERROR ' + e));
    console.log(`${errs.length ? '✗' : '✓'} ${f} — ${errs.length} errors, ${warns.length} warnings`);
    bad += errs.length;
  }
  if (!files.length) console.log('no packs found');
  process.exit(bad ? 1 : 0);
}
