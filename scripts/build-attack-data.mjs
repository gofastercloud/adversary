#!/usr/bin/env node
// Compiles MITRE ATT&CK STIX (Enterprise + ICS) into the game's data files.
//   node scripts/build-attack-data.mjs [stixDir]
// stixDir must contain enterprise.json and ics.json (attack-stix-data bundles). If omitted, they are
// downloaded to .cache/stix/. Output (committed, deterministic):
//   data/attack/{tactics,techniques,mitigations,software}.json  shared reference tables
//   data/adversaries/<ID>.json   engine-facing deck: techniques + tactic + mitigations
//   data/dossiers/<ID>.json      UI-facing profile: description, procedure examples, observables, citations
// ATT&CK® is © The MITRE Corporation, used under the ATT&CK Terms of Use (see data/attack/NOTICE.md).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = (...p) => path.join(root, ...p);

export const ROSTER = {
  // intrusion sets (G) and campaigns (C) the game ships. Add an ID here and re-run to ship another.
  groups: ['G1017', 'G0034', 'G0016', 'G0032', 'G0046', 'G1015', 'G0102', 'G0096', 'G0035', 'G0139', 'G0106', 'G0092', 'G0037', 'G0091', 'G1004', 'G0007', 'G1051', 'G1043', 'G0117', 'G0082', 'G0080', 'G1032', 'G1057', 'G0114', 'G0125', 'G0088', 'G0049', 'G0129', 'G0045'],
  campaigns: ['C0024', 'C0025', 'C0028', 'C0030', 'C0034', 'C0063', 'C0057', 'C0029', 'C0012', 'C0059', 'C0058', 'C0020', 'C0049', 'C0014', 'C0041', 'C0022']
};

let dir = process.argv[2];
if (!dir) {
  dir = out('.cache/stix'); mkdirSync(dir, { recursive: true });
  for (const [f, d] of [['enterprise', 'enterprise-attack'], ['ics', 'ics-attack']]) {
    if (!existsSync(path.join(dir, f + '.json'))) {
      console.log('downloading', f);
      execFileSync('curl', ['-sSfL', '-o', path.join(dir, f + '.json'), `https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/${d}/${d}.json`]);
    }
  }
}

const bundles = { enterprise: JSON.parse(readFileSync(path.join(dir, 'enterprise.json'), 'utf8')), ics: JSON.parse(readFileSync(path.join(dir, 'ics.json'), 'utf8')) };
const live = o => !o.revoked && !o.x_mitre_deprecated;
const extId = o => (o.external_references || []).find(r => /^(mitre-attack|mitre-ics-attack|mitre-mobile-attack)$/.test(r.source_name) && r.external_id)?.external_id;
const extUrl = o => (o.external_references || []).find(r => /^(mitre-attack|mitre-ics-attack)$/.test(r.source_name))?.url;

// ---------- text cleaning
function clean(text, refs, max = 600) {
  if (!text) return '';
  const cites = [];
  let t = text
    .replace(/\(Citation: ([^)]+)\)/g, (_, name) => { const r = refs.get(name.trim()); if (r?.url) cites.push({ name: name.trim(), url: r.url }); return ''; })
    .replace(/<code>([\s\S]*?)<\/code>/g, '`$1`')
    .replace(/\[([^\]]+)\]\((https?:[^)]+|[^)]*)\)/g, '$1')
    .replace(/\s+/g, ' ').replace(/\s+([.,;:])/g, '$1').trim();
  if (t.length > max) { const cut = t.slice(0, max); t = cut.slice(0, Math.max(cut.lastIndexOf('. ') + 1, 200)) || cut; }
  const seen = new Set();
  return { text: t, cites: cites.filter(c => !seen.has(c.url) && seen.add(c.url)).slice(0, 3) };
}
function codeSnippets(text) {
  const t = text || '';
  const quoted = [...t.matchAll(/<code>([\s\S]*?)<\/code>/g), ...t.matchAll(/`([^`\n]{3,160})`/g)].map(m => m[1].trim());
  // artefact names called out in prose (e.g. "BrightmetricAgent.exe", "ntds.dit")
  const named = [...t.matchAll(/\b([A-Za-z0-9][\w\-]{1,40}\.(?:exe|dll|ps1|bat|vbs|dit|dmp|sys|lnk|hta|jsp|aspx|asp|war|jar))\b/g)].map(m => m[1]);
  return [...new Set([...quoted, ...named])].filter(Boolean);
}
const LOLBINS = new Set(['wevtutil.exe', 'comsvcs.dll', 'gdi32.dll', 'gdiplus.dll', 'netsh', 'vssadmin', 'certutil', 'bitsadmin', 'rundll32', 'regsvr32', 'mshta', 'schtasks', 'psexec', 'procdump', 'nltest', 'dsquery', 'ntdsutil', 'wmic', 'reg', 'sc', 'net', 'powershell', 'cmd', 'netstat', 'whoami', 'ipconfig', 'tasklist', 'systeminfo', 'nslookup', 'cscript', 'wscript', 'msiexec', 'esentutl', 'dsget', 'quser', 'qwinsta', 'arp', 'route', 'tracert', 'ping', 'findstr']);
function classifyObs(s) {
  if (s.length < 4 || s.length > 160) return null;
  if (LOLBINS.has(s.toLowerCase().replace(/\.exe$/, '')) || LOLBINS.has(s.toLowerCase())) return 'lolbin';
  if (/^HK(LM|CU|EY|CR)[\\_]/i.test(s)) return 'registry';
  if (/^(https?:\/\/|\w+:\/\/)/i.test(s)) return null; // never ship raw URLs as IoCs — they rot and can be live infrastructure
  if (/^\d{1,3}(\.\d{1,3}){3}/.test(s) || /^[a-f0-9]{32,64}$/i.test(s)) return null; // no IPs or hashes from prose
  if (/(^|\s)(-\w+|\/[a-z]{1,3}\b|--\w+)/i.test(s) && /\s/.test(s)) return 'command';
  if (/^[\w.\-]+\.(exe|dll|ps1|bat|vbs|js|sh|py|dmp|zip|rar|7z|sys|lnk|hta|msi|jar|war|aspx|asp|php|jsp|tmp|log|txt|dat|ini|cfg|conf|plist)$/i.test(s)) return 'file';
  if (/[\\\/]/.test(s) && /^([A-Za-z]:\\|%\w+%|\/\w|\\\\)/.test(s)) return 'path';
  if (/^[\w\-]+(\.exe)?$/i.test(s) && /^(ntdsutil|vssadmin|wmic|netsh|certutil|bitsadmin|rundll32|regsvr32|mshta|schtasks|psexec|procdump|nltest|dsquery|reg|sc|net|powershell|cmd)$/i.test(s)) return 'tool';
  return null;
}

const tacticOrder = ['reconnaissance', 'resource-development', 'initial-access', 'execution', 'persistence', 'privilege-escalation', 'stealth', 'defense-evasion', 'defense-impairment', 'credential-access', 'discovery', 'lateral-movement', 'collection', 'command-and-control', 'exfiltration', 'inhibit-response-function', 'impair-process-control', 'impact'];
const normTactic = t => (t === 'evasion' ? 'defense-evasion' : t);

// ---------- shared tables
const tactics = {}, techniques = {}, mitigations = {}, softwareTbl = {};
const byStixId = new Map();   // stix id -> { obj, dom }
for (const dom of ['enterprise', 'ics']) for (const o of bundles[dom].objects) byStixId.set(o.id, { o, dom });

for (const dom of ['enterprise', 'ics']) {
  const objs = bundles[dom].objects;
  for (const o of objs.filter(o => o.type === 'x-mitre-tactic' && live(o))) {
    const id = extId(o); const sn = normTactic(o.x_mitre_shortname);
    tactics[sn] = tactics[sn] || { id, name: o.name, short: sn, domains: [] };
    if (!tactics[sn].domains.includes(dom)) tactics[sn].domains.push(dom);
    tactics[sn][dom + 'Id'] = id;
  }
  for (const o of objs.filter(o => o.type === 'attack-pattern' && live(o))) {
    const id = extId(o); if (!id) continue;
    techniques[id] = { n: o.name, tac: [...new Set((o.kill_chain_phases || []).map(k => normTactic(k.phase_name)))], dom, ...(o.x_mitre_is_subtechnique ? { sub: true } : {}), ...(o.x_mitre_platforms ? { plat: o.x_mitre_platforms } : {}) };
  }
  for (const o of objs.filter(o => o.type === 'course-of-action' && live(o))) {
    const id = extId(o); if (!id) continue;
    mitigations[id] = { n: o.name, d: clean(o.description, new Map(), 280).text, dom };
  }
  for (const o of objs.filter(o => ['malware', 'tool'].includes(o.type) && live(o))) {
    const id = extId(o); if (!id) continue;
    softwareTbl[id] = { n: o.name, t: o.type, dom };
  }
}
// mitigation -> technique relationships
for (const dom of ['enterprise', 'ics']) for (const r of bundles[dom].objects) {
  if (r.type !== 'relationship' || r.relationship_type !== 'mitigates' || r.revoked) continue;
  const m = byStixId.get(r.source_ref)?.o, t = byStixId.get(r.target_ref)?.o;
  if (!m || !t || m.type !== 'course-of-action' || t.type !== 'attack-pattern') continue;
  const mid = extId(m), tid = extId(t);
  if (techniques[tid] && mitigations[mid]) (techniques[tid].m = techniques[tid].m || []).push(mid);
}
for (const t of Object.values(techniques)) if (t.m) t.m = [...new Set(t.m)].sort();

// parent technique inherits nothing automatically, but game wants sub-technique -> parent mitigations too
for (const [id, t] of Object.entries(techniques)) if (t.sub) { const p = techniques[id.split('.')[0]]; if (p?.m) t.m = [...new Set([...(t.m || []), ...p.m])].sort(); }

const version = bundles.enterprise.objects.find(o => o.type === 'x-mitre-collection')?.x_mitre_version;
writeFileSync(out('data/attack/tactics.json'), JSON.stringify(tactics));
writeFileSync(out('data/attack/techniques.json'), JSON.stringify(techniques));
writeFileSync(out('data/attack/mitigations.json'), JSON.stringify(mitigations));
writeFileSync(out('data/attack/software.json'), JSON.stringify(softwareTbl));
writeFileSync(out('data/attack/NOTICE.md'), `# ATT&CK data notice\n\nThis directory contains data derived from MITRE ATT&CK® (Enterprise and ICS), version ${version || 'latest'}.\n\n© ${new Date().getFullYear()} The MITRE Corporation. This work is reproduced and distributed with the permission of The MITRE Corporation under the ATT&CK Terms of Use: https://attack.mitre.org/resources/legal-and-branding/terms-of-use/\n\nMITRE ATT&CK® is a registered trademark of The MITRE Corporation. The game's card statistics (cost, power, stealth) are fictional gameplay values derived from this data and are not MITRE content.\n`);

// ---------- adversaries
function build(id) {
  const kind = id[0] === 'G' ? 'group' : 'campaign';
  let hit = null;
  for (const dom of ['enterprise', 'ics']) for (const o of bundles[dom].objects) {
    if ((o.type === 'intrusion-set' || o.type === 'campaign') && live(o) && extId(o) === id) { hit = hit || { o, doms: [] }; hit.doms.push(dom); }
  }
  if (!hit) { console.warn('!! not found', id); return null; }
  const o = hit.o;
  const refs = new Map();
  for (const dom of hit.doms) for (const x of bundles[dom].objects) for (const r of x.external_references || []) if (r.source_name && !refs.has(r.source_name)) refs.set(r.source_name, r);
  for (const r of o.external_references || []) refs.set(r.source_name, r);

  // gather this entity's stix ids across both domains (same id in both bundles)
  const uses = new Map();   // technique ext id -> { texts:[], cites:[] }
  const sw = new Map();     // software ext id -> { n, t, techs:Set }
  const swStix = [];        // [dom, software stix id, ext id, name]
  for (const dom of hit.doms) {
    const objs = bundles[dom].objects;
    const idx = new Map(objs.map(x => [x.id, x]));
    for (const r of objs) {
      if (r.type !== 'relationship' || r.revoked || r.relationship_type !== 'uses' || r.source_ref !== o.id) continue;
      const tgt = idx.get(r.target_ref); if (!tgt || !live(tgt)) continue;
      if (tgt.type === 'attack-pattern') {
        const tid = extId(tgt); if (!tid || !techniques[tid]) continue;
        const u = uses.get(tid) || { texts: [], obs: [] }; uses.set(tid, u);
        const c = clean(r.description, refs, 340);
        if (c.text) u.texts.push(c);
        for (const s of codeSnippets(r.description)) { const k = classifyObs(s); if (k) u.obs.push({ kind: k, value: s }); }
      } else if (['malware', 'tool'].includes(tgt.type)) {
        const sid = extId(tgt); if (!sid) continue;
        sw.set(sid, { id: sid, n: tgt.name, t: tgt.type }); swStix.push([dom, tgt.id, sid, tgt.name]);
      }
    }
  }
  // techniques implemented by the adversary's documented software (ATT&CK models these as software -> technique)
  const viaSw = new Map();   // tech id -> { names:Set, text, cites }
  for (const [dom, sstix, sid, sname] of swStix) {
    for (const r of bundles[dom].objects) {
      if (r.type !== 'relationship' || r.revoked || r.relationship_type !== 'uses' || r.source_ref !== sstix) continue;
      const tgt = byStixId.get(r.target_ref)?.o; if (!tgt || tgt.type !== 'attack-pattern' || !live(tgt)) continue;
      const tid = extId(tgt); if (!tid || !techniques[tid]) continue;
      const v = viaSw.get(tid) || { names: new Set(), text: null, cites: [], obs: [] }; viaSw.set(tid, v);
      v.names.add(sname);
      if (!v.text) { const c = clean(r.description, refs, 300); if (c.text) { v.text = `${sname}: ` + c.text; v.cites = c.cites; } }
      for (const sn of codeSnippets(r.description)) { const k = classifyObs(sn); if (k) v.obs.push({ kind: k, value: sn }); }
    }
  }
  const techs0 = [...uses.keys()].map(tid => {
    const t = techniques[tid];
    const sv = viaSw.get(tid);
    return { id: tid, n: t.n, tac: t.tac.sort((a, b) => tacticOrder.indexOf(a) - tacticOrder.indexOf(b)), m: t.m || [], d: uses.get(tid).texts.length, ev: uses.get(tid).texts.length * 2 + (sv ? sv.names.size : 0), ...(sv ? { sw: [...sv.names].sort() } : {}) };
  });
  const extra = [...viaSw.keys()].filter(tid => !uses.has(tid)).map(tid => { const t = techniques[tid]; const sv = viaSw.get(tid); return { id: tid, n: t.n, tac: t.tac.slice().sort((a, b) => tacticOrder.indexOf(a) - tacticOrder.indexOf(b)), m: t.m || [], d: 0, ev: sv.names.size, sw: [...sv.names].sort() }; });
  const techs = [...techs0, ...extra].sort((a, b) => tacticOrder.indexOf(a.tac[0]) - tacticOrder.indexOf(b.tac[0]) || b.ev - a.ev || a.id.localeCompare(b.id));

  const aliases = (o.aliases || o.x_mitre_aliases || []).filter(a => a !== o.name);
  const pageUrl = extUrl(o) || `https://attack.mitre.org/${kind === 'group' ? 'groups' : 'campaigns'}/${id}/`;
  const deck = { id, kind, name: o.name, aliases, url: pageUrl, domains: hit.doms, ...(o.first_seen ? { first: o.first_seen.slice(0, 7), last: o.last_seen?.slice(0, 7) } : {}), techs, software: [...sw.values()].sort((a, b) => a.n.localeCompare(b.n)).map(s => ({ id: s.id, n: s.n, t: s.t })) };

  // ---- dossier (UI)
  const d = clean(o.description, refs, 900);
  const obsAll = []; const seenObs = new Set();
  for (const [tid, u] of [...uses, ...[...viaSw].filter(([k]) => !uses.has(k))]) for (const ob of u.obs) { const k = ob.kind + ob.value.toLowerCase(); if (!seenObs.has(k)) { seenObs.add(k); obsAll.push({ ...ob, tech: tid }); } }
  const dossier = {
    id, name: o.name, aliases, url: pageUrl,
    summary: d.text, summaryCites: d.cites,
    procedures: techs.map(t => { const u = uses.get(t.id); const first = u?.texts[0]; if (first) return { id: t.id, text: first.text, cites: first.cites }; const sv = viaSw.get(t.id); return sv?.text ? { id: t.id, text: sv.text, cites: sv.cites, via: t.sw } : null; }).filter(Boolean),
    observables: obsAll.sort((a, b) => ['file', 'path', 'registry', 'command', 'lolbin', 'tool'].indexOf(a.kind) - ['file', 'path', 'registry', 'command', 'lolbin', 'tool'].indexOf(b.kind)).slice(0, 24),
    sources: (o.external_references || []).filter(r => r.url && !/attack\.mitre\.org/.test(r.url)).map(r => ({ name: r.source_name, url: r.url, desc: r.description?.slice(0, 200) })).slice(0, 14),
    softwareLinks: deck.software.map(s => ({ ...s, url: `https://attack.mitre.org/software/${s.id}/` }))
  };
  writeFileSync(out('data/adversaries', id + '.json'), JSON.stringify(deck));
  writeFileSync(out('data/dossiers', id + '.json'), JSON.stringify(dossier));
  return { id, name: o.name, kind, techs: techs.length, sw: deck.software.length, obs: dossier.observables.length, sources: dossier.sources.length };
}

const index = [];
for (const id of [...ROSTER.groups, ...ROSTER.campaigns]) { const r = build(id); if (r) index.push(r); }
writeFileSync(out('data/adversaries/index.json'), JSON.stringify(index));
console.table(index);
console.log(`ATT&CK ${version}: ${Object.keys(techniques).length} techniques, ${Object.keys(mitigations).length} mitigations, ${index.length} adversaries written.`);
