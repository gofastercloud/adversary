#!/usr/bin/env node
// Compiles MITRE EMB3D (STIX 2.1) and CTID Mappings Explorer data into compact committed files.
//   node scripts/build-mapping-data.mjs            (downloads to .cache/mappings/ if absent)
// Output: data/emb3d/{properties,threats,mitigations,links}.json, data/ctid/{nist-800-53,aws,azure,gcp,m365}.json
// EMB3D © The MITRE Corporation (https://emb3d.mitre.org/terms-of-use). CTID mappings: Apache-2.0 (Center for Threat-Informed Defense).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = path.join(root, '.cache/mappings'); mkdirSync(cache, { recursive: true });
const D = 'https://ctid.mitre.org/mappings/data';
const SRC = {
  emb3d: 'https://emb3d.mitre.org/assets/emb3d-stix-2.0.1.json',
  nist: `${D}/nist_800_53/attack-16.1/nist_800_53-rev5/enterprise/nist_800_53-rev5_attack-16.1-enterprise_json.json`,
  dot: 'https://center-for-threat-informed-defense.github.io/defending-ot-with-attack/defending-ot-with-att%26ck-0.3.json',
  aws: `${D}/aws/attack-16.1/aws-12.12.2024/enterprise/aws-12.12.2024_attack-16.1-enterprise_json.json`
};
const get = k => { const f = path.join(cache, k + '.json'); if (!existsSync(f)) { console.log('downloading', k); execFileSync('curl', ['-sSfL', '-m', '120', '-o', f, SRC[k]]); } return JSON.parse(readFileSync(f, 'utf8')); };
const w = (p, o) => { mkdirSync(path.dirname(path.join(root, p)), { recursive: true }); writeFileSync(path.join(root, p), JSON.stringify(o) + '\n'); console.log(p, JSON.stringify(o).length, 'bytes'); };
const clean = s => (s || '').replace(/\s+/g, ' ').trim();
const first = (s, n = 280) => { const t = clean(s.replace(/[#*_`>\[\]]/g, '')); return t.length > n ? t.slice(0, n - 1).replace(/\s\S*$/, '') + '…' : t; };

// ── EMB3D
const e = get('emb3d').objects;
const byId = Object.fromEntries(e.map(o => [o.id, o]));
const props = {}, threats = {}, mits = {}, links = { propThreat: [], mitThreat: [], sub: [] };
for (const o of e) {
  if (o.type === 'x-mitre-emb3d-property') props[o.x_mitre_emb3d_property_id] = { n: o.name, cat: o.category, sub: !!o.is_subproperty };
  if (o.type === 'vulnerability') threats[o.x_mitre_emb3d_threat_id] = { n: o.name, cat: o.x_mitre_emb3d_threat_category, maturity: o.x_mitre_emb3d_threat_maturity, d: first(o.description),
    cwe: [...(o.x_mitre_emb3d_threat_CWEs || '').matchAll(/CWE-(\d+)/g)].map(m => +m[1]).filter((v, i, a) => a.indexOf(v) === i),
    cve: [...(o.x_mitre_emb3d_threat_CVEs || '').matchAll(/CVE-\d{4}-\d{4,7}/g)].map(m => m[0]).filter((v, i, a) => a.indexOf(v) === i) };
  if (o.type === 'course-of-action') mits[o.x_mitre_emb3d_mitigation_id] = { n: o.name, tier: o.x_mitre_emb3d_mitigation_maturity, d: first(o.description),
    iec: [...(o.x_mitre_emb3d_mitigation_IEC_62443_mappings || '').matchAll(/^- (.+)$/gm)].map(m => clean(m[1])) };
}
const pid = o => o?.x_mitre_emb3d_property_id, tid = o => o?.x_mitre_emb3d_threat_id, mid = o => o?.x_mitre_emb3d_mitigation_id;
for (const r of e.filter(o => o.type === 'relationship')) {
  const s = byId[r.source_ref], t = byId[r.target_ref];
  if (r.relationship_type === 'relates-to' && pid(s) && tid(t)) links.propThreat.push([pid(s), tid(t)]);
  if (r.relationship_type === 'mitigates' && mid(s) && tid(t)) links.mitThreat.push([mid(s), tid(t)]);
  if (r.relationship_type === 'subproperty-of' && pid(s) && pid(t)) links.sub.push([pid(s), pid(t)]);
}
w('data/emb3d/properties.json', props); w('data/emb3d/threats.json', threats); w('data/emb3d/mitigations.json', mits); w('data/emb3d/links.json', links);

// ── CTID NIST 800-53 -> ATT&CK (technique -> controls). "mitigates" = control mitigates technique.
const nist = get('nist').mapping_objects, tn = {};
for (const m of nist) if (m.mapping_type === 'mitigates' && m.capability_id) (tn[m.attack_object_id] ||= []).push(m.capability_id);
for (const k in tn) tn[k] = [...new Set(tn[k].map(c => c.replace(/-0(\d)/, '-$1')))].sort();
w('data/ctid/nist-800-53.json', { src: 'CTID Mappings Explorer: NIST SP 800-53 Rev.5 -> ATT&CK 16.1', url: 'https://ctid.mitre.org/mappings/external/nist/', techniques: tn });

// ── CTID AWS capability scores
const sc = { minimal: 1, partial: 2, significant: 3 }, aws = {};
for (const m of get('aws').mapping_objects) {
  if (m.mapping_type !== 'technique_scores') continue;
  const c = (aws[m.capability_id] ||= { n: m.capability_description, t: {} });
  (c.t[m.attack_object_id] ||= {})[m.score_category] = sc[m.score_value];
}
w('data/ctid/aws.json', { src: 'CTID Mappings Explorer: AWS Security Capabilities -> ATT&CK 16.1 (12.12.2024)', url: 'https://ctid.mitre.org/mappings/external/aws/', score: sc, capabilities: aws });

// ── CTID Defending OT with ATT&CK: 22 reference-architecture assets (ATT&CK asset objects) and the techniques that target them.
// The collection predates ATT&CK v19's ICS renumbering, so only technique ids that still exist in data/attack are kept.
const dot = get('dot').objects, dby = Object.fromEntries(dot.map(o => [o.id, o]));
const dext = o => (o.external_references || []).find(r => r.external_id)?.external_id;
const T0 = JSON.parse(readFileSync(path.join(root, 'data/attack/techniques.json'), 'utf8'));
const oa = {};
for (const o of dot) if (o.type === 'x-mitre-asset') oa[dext(o)] = { n: o.name.replace(/^Applications \(O365\)$/, 'Applications (O365)'), d: first(o.description, 220), plat: o.x_mitre_platforms || [], t: [] };
for (const r of dot) if (r.type === 'relationship' && r.relationship_type === 'targets') {
  const s = dby[r.source_ref], t = dby[r.target_ref];
  if (s?.type === 'attack-pattern' && t?.type === 'x-mitre-asset' && T0[dext(s)]) oa[dext(t)].t.push(dext(s));
}
for (const a of Object.values(oa)) a.t = [...new Set(a.t)].sort();
w('data/ctid/ot-assets.json', { src: 'CTID Defending OT with ATT&CK v1.0.0 reference architecture (assets A0001-A0033)', url: 'https://center-for-threat-informed-defense.github.io/defending-ot-with-attack/architecture/', assets: oa });

// Fold NIST control ids into the shared technique table as `c`, so wardFor can award CTID-mapped control matches
// with no extra loader plumbing. (Idempotent; sub-techniques fall back to the parent at lookup time.)
const tp = path.join(root, 'data/attack/techniques.json'), T = JSON.parse(readFileSync(tp, 'utf8'));
let n = 0; for (const [id, t] of Object.entries(T)) { delete t.c; if (tn[id]) { t.c = tn[id]; n++; } }
writeFileSync(tp, JSON.stringify(T) + '\n'); console.log('techniques with NIST mappings:', n);
