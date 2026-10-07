#!/usr/bin/env node
// Computes "baseline tradecraft": how widely each ATT&CK technique is used across ALL tracked intrusion sets
// (directly or via the software they use). Folds `p` (percent of intrusion sets, 0-100, per domain) into
// data/attack/techniques.json and writes data/baseline/summary.json (top techniques per tactic, for docs/UI).
// Prevalence is a *popularity prior*, not a risk score: it says what adversaries commonly do, not what is worst.
//   node scripts/build-baseline.mjs [stixDir]   (downloads to .cache/stix/ if absent, like build-attack-data)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = process.argv[2] || path.join(root, '.cache/stix'); mkdirSync(dir, { recursive: true });
for (const [f, d] of [['enterprise', 'enterprise-attack'], ['ics', 'ics-attack']]) if (!existsSync(path.join(dir, f + '.json'))) { console.log('downloading', f); execFileSync('curl', ['-sSfL', '-o', path.join(dir, f + '.json'), `https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/${d}/${d}.json`]); }
const tp = path.join(root, 'data/attack/techniques.json'), T = JSON.parse(readFileSync(tp, 'utf8'));
const live = o => !o.revoked && !o.x_mitre_deprecated;
const extId = o => (o.external_references || []).find(r => /^mitre-(ics-)?attack$/.test(r.source_name) && r.external_id)?.external_id;
const summary = {};
for (const dom of ['enterprise', 'ics']) {
  const objs = JSON.parse(readFileSync(path.join(dir, dom + '.json'), 'utf8')).objects, by = new Map(objs.map(o => [o.id, o]));
  const groups = objs.filter(o => o.type === 'intrusion-set' && live(o));
  const uses = new Map();   // source stix id -> Set(technique ids)
  for (const r of objs) if (r.type === 'relationship' && r.relationship_type === 'uses' && !r.revoked) {
    const t = by.get(r.target_ref); if (t?.type !== 'attack-pattern' || !live(t)) continue;
    (uses.get(r.source_ref) || uses.set(r.source_ref, new Set()).get(r.source_ref)).add(extId(t));
  }
  const gt = new Map();     // group -> technique set (direct + via software)
  for (const g of groups) gt.set(g.id, new Set(uses.get(g.id) || []));
  for (const r of objs) if (r.type === 'relationship' && r.relationship_type === 'uses' && !r.revoked) {
    const s = by.get(r.target_ref); if (!s || !['malware', 'tool'].includes(s.type) || !live(s) || !gt.has(r.source_ref)) continue;
    for (const t of uses.get(s.id) || []) gt.get(r.source_ref).add(t);
  }
  const active = [...gt.values()].filter(s => s.size > 0), N = active.length;
  const count = {};
  for (const s of active) { const seen = new Set(); for (const t of s) { seen.add(t); seen.add(t.split('.')[0]); } for (const t of seen) count[t] = (count[t] || 0) + 1; }
  let n = 0;
  for (const [id, t] of Object.entries(T)) if ((t.dom || 'enterprise') === dom) { delete t.p; if (count[id]) { t.p = Math.max(1, Math.round(100 * count[id] / N)); n++; } }
  const byTac = {};
  for (const [id, t] of Object.entries(T)) if ((t.dom || 'enterprise') === dom && t.p) for (const tac of t.tac) (byTac[tac] ||= []).push([id, t.n, t.p]);
  for (const k in byTac) byTac[k] = byTac[k].sort((a, b) => b[2] - a[2] || a[0].localeCompare(b[0])).slice(0, 12);
  summary[dom] = { intrusionSets: N, techniquesWithData: n, top: byTac };
  console.log(dom, 'intrusion sets with data:', N, 'techniques with prevalence:', n);
}
// Observed-incident overlay: how often each technique appears in real incidents (CTID Attack Flow corpus, build-flows.mjs).
// p = 70% group prevalence (breadth across actors) + 30% incident frequency (what actually showed up in documented intrusions).
// Goal-conditioned frequency `g` (share of flows with that goal using the technique) drives goal payoff sampling.
const flowDir = path.join(root, 'data/flows');
if (existsSync(path.join(flowDir, 'stats.json'))) {
  const st = JSON.parse(readFileSync(path.join(flowDir, 'stats.json'), 'utf8')), idx = JSON.parse(readFileSync(path.join(flowDir, 'index.json'), 'utf8'));
  const byGoal = {}, goalN = {};
  for (const f of idx) { const d = JSON.parse(readFileSync(path.join(flowDir, f.id + '.json'), 'utf8')); goalN[d.goal] = (goalN[d.goal] || 0) + 1; const seen = new Set(); for (const a of d.acts) { for (const k of new Set([a.t, a.t.split('.')[0]])) if (!seen.has(k)) { seen.add(k); (byGoal[d.goal] ||= {})[k] = (byGoal[d.goal][k] || 0) + 1; } } }
  let nb = 0;
  for (const [id, t] of Object.entries(T)) {
    delete t.pg; delete t.po; delete t.g;
    const po = st.freq[id] ? Math.round(100 * st.freq[id] / st.flows) : 0;
    if (po) { t.po = po; t.pg = t.p || 0; t.p = Math.max(1, Math.round(0.7 * (t.p || 0) + 0.3 * po)); nb++; }
    for (const [g, m] of Object.entries(byGoal)) if (m[id] && goalN[g] >= 2) (t.g ||= {})[g] = Math.round(100 * m[id] / goalN[g]);
  }
  summary.observed = { flows: st.flows, goals: goalN, techniquesBlended: nb };
  console.log('blended observed incident frequency into', nb, 'techniques;', JSON.stringify(goalN));
}
writeFileSync(tp, JSON.stringify(T) + '\n');
mkdirSync(path.join(root, 'data/baseline'), { recursive: true });
writeFileSync(path.join(root, 'data/baseline/summary.json'), JSON.stringify({ src: 'Derived from MITRE ATT&CK intrusion-set / software usage relationships', ...summary }, null, 1) + '\n');
