#!/usr/bin/env node
// Compiles CTID's Attack Flow corpus (real incidents as ordered ATT&CK technique graphs, STIX 2.1) into compact game data.
//   node scripts/build-flows.mjs     (downloads to .cache/flows/ if absent)
// Output: data/flows/<slug>.json, data/flows/index.json, data/flows/stats.json (observed technique frequency + transitions).
// Attack Flow corpus © The MITRE Corporation, Apache-2.0 (https://github.com/center-for-threat-informed-defense/attack-flow).
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const B = 'https://center-for-threat-informed-defense.github.io/attack-flow';
const cache = path.join(root, '.cache/flows'); mkdirSync(cache, { recursive: true });
const index = execFileSync('curl', ['-sSfL', '-m', '60', `${B}/example_flows/`]).toString();
const files = [...new Set([...index.matchAll(/href="\.\.\/corpus\/([^"]+\.json)"/g)].map(m => m[1]))];
const T = JSON.parse(readFileSync(path.join(root, 'data/attack/techniques.json'), 'utf8'));
const clean = (s, n) => { const t = (s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s\S*$/, '') + '…' : t; };

// terminal technique -> adversary goal (ATT&CK-defined impact/exfiltration behaviours)
const GOAL_OF = { T1486: 'ransom', T1485: 'destroy', T1561: 'destroy', T1657: 'fraud', T1498: 'disrupt', T1499: 'disrupt', T1489: 'disrupt', T1529: 'disrupt', T1491: 'disrupt', T1531: 'disrupt', T1496: 'resource' };
// Editorial goal tags where the technique heuristic misreads the incident (documented in the flow's own description/sources).
const GOAL_OVERRIDE = { 'swift-heist': 'fraud', 'fin13-case-1': 'fraud', 'fin13-case-2': 'fraud', 'mac-malware-steals-crypto': 'fraud', 'cisa-iranian-apt': 'resource', 'searchawesome-adware': 'resource', 'muddy-water': 'exfil', 'cobalt-kitty-campaign': 'exfil', 'turla-carbon-emulation-plan': 'exfil', 'uber-breach': 'exfil', 'marriott-breach': 'exfil', 'mitre-nerve': 'preposition' };
const EXFIL = new Set(['T1041', 'T1048', 'T1567', 'T1537', 'T1020', 'T1029', 'T1030', 'T1052', 'T1011']);

const out = [], freq = {}, trans = {}, tacTrans = {}, goals = {};
for (const f of files) {
  const file = path.join(cache, f.replace(/%20/g, ' ').replace(/%26/g, '&').replace(/%28/g, '(').replace(/%29/g, ')'));
  if (!existsSync(file)) execFileSync('curl', ['-sSfL', '-m', '60', '-o', file, `${B}/corpus/${f}`]);
  const d = JSON.parse(readFileSync(file, 'utf8')), by = new Map(d.objects.map(o => [o.id, o]));
  const flow = d.objects.find(o => o.type === 'attack-flow'); if (!flow) continue;
  const actions = d.objects.filter(o => o.type === 'attack-action' && o.technique_id);
  if (actions.length < 3) continue;           // skip the attack-tree demo and stubs
  // resolve successor actions through operators / conditions
  const nextOf = id => { const seen = new Set(), res = new Set(), st = [...(by.get(id)?.effect_refs || [])]; while (st.length) { const x = st.pop(); if (seen.has(x)) continue; seen.add(x); const o = by.get(x); if (!o) continue; if (o.type === 'attack-action') res.add(x); else st.push(...(o.effect_refs || []), ...(o.on_true_refs || []), ...(o.on_false_refs || [])); } return [...res]; };
  const depth = new Map(), q = [];
  for (const s of flow.start_refs || []) { const st = [s]; const seen = new Set(); while (st.length) { const x = st.pop(); if (seen.has(x)) continue; seen.add(x); const o = by.get(x); if (o?.type === 'attack-action') { depth.set(x, 0); q.push(x); } else if (o) st.push(...(o.effect_refs || [])); } }
  while (q.length) { const x = q.shift(); for (const n of nextOf(x)) if (!depth.has(n)) { depth.set(n, depth.get(x) + 1); q.push(n); } }
  const order = actions.slice().sort((a, b) => (depth.get(a.id) ?? 99) - (depth.get(b.id) ?? 99));
  const idx = new Map(order.map((a, i) => [a.id, i]));
  const acts = order.map(a => ({ i: idx.get(a.id), t: a.technique_id, tac: a.tactic_id || null, n: clean(a.name, 80), d: clean(a.description, 300), next: nextOf(a.id).map(x => idx.get(x)).filter(x => x !== undefined) }));
  const terminal = acts.filter(a => !a.next.length);
  let goal = null;
  for (const a of acts) { const g = GOAL_OF[a.t] || GOAL_OF[a.t.split('.')[0]]; if (g && (!goal || ['ransom', 'destroy', 'fraud'].includes(g))) goal = g; }
  if (!goal && acts.some(a => EXFIL.has(a.t.split('.')[0]))) goal = 'exfil';
  if (!goal && acts.some(a => a.t.startsWith('T08') || a.t.startsWith('T09'))) goal = 'disrupt';
  goal ||= 'access';
  const slug = flow.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  goal = GOAL_OVERRIDE[slug] || goal;
  const refs = (flow.external_references || []).filter(r => r.url).map(r => ({ n: clean(r.source_name, 40), u: r.url })).slice(0, 6);
  const actor = d.objects.find(o => o.type === 'threat-actor')?.name || null;
  out.push({ id: slug, name: flow.name, goal, actor, scope: flow.scope || 'incident', desc: clean(flow.description, 400), refs, acts });
  goals[goal] = (goals[goal] || 0) + 1;
  const seen = new Set();
  for (const a of acts) { const k = a.t; if (!seen.has(k)) { seen.add(k); freq[k] = (freq[k] || 0) + 1; const par = k.split('.')[0]; if (par !== k && !seen.has(par)) { seen.add(par); freq[par] = (freq[par] || 0) + 1; } } }
  for (const a of acts) for (const n of a.next) { const b = acts[n]; const key = `${a.t.split('.')[0]}>${b.t.split('.')[0]}`; trans[key] = (trans[key] || 0) + 1; if (a.tac && b.tac) { const tk = `${a.tac}>${b.tac}`; tacTrans[tk] = (tacTrans[tk] || 0) + 1; } }
}
mkdirSync(path.join(root, 'data/flows'), { recursive: true });
for (const f of readdirSync(path.join(root, 'data/flows'))) if (f.endsWith('.json')) execFileSync('rm', [path.join(root, 'data/flows', f)]);
for (const o of out) writeFileSync(path.join(root, 'data/flows', o.id + '.json'), JSON.stringify(o) + '\n');
const N = out.length;
const top = Object.entries(freq).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
writeFileSync(path.join(root, 'data/flows/index.json'), JSON.stringify(out.map(o => ({ id: o.id, name: o.name, goal: o.goal, actor: o.actor, n: o.acts.length, desc: o.desc, refs: o.refs }))) + '\n');
writeFileSync(path.join(root, 'data/flows/stats.json'), JSON.stringify({ src: 'CTID Attack Flow corpus', flows: N, goals, freq: Object.fromEntries(top.filter(([, c]) => c >= 2)), trans: Object.fromEntries(Object.entries(trans).filter(([, c]) => c >= 2)), tacTrans, unknown: top.filter(([k]) => !T[k]).map(([k]) => k) }) + '\n');
console.log('flows', N, 'goals', goals, 'distinct techniques', top.length, 'unknown ids', top.filter(([k]) => !T[k]).length);
console.log(top.slice(0, 15).map(([k, c]) => `${k}:${c}`).join(' '));
