#!/usr/bin/env node
// Drafts a TTX scenario (injects, decisions, objectives) from a real incident in data/flows (CTID Attack Flow corpus).
//   node scripts/gen-ttx-draft.mjs <flow-id> --adv <G####|C####> [--tier 2] [--rounds 8] [--out scripts/drafts]
// What is data-derived: the order of attacker behaviour, narrative text (the flow's own action descriptions), the technique
// and mitigation links, NIST 800-53 controls (CTID mapping), and the lesson text (ATT&CK mitigation descriptions).
// What is a DRAFT for a human to refine: the clock, the decision wording, quality ratings and effects. Output is flagged `draft: true`.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const id = process.argv[2]; if (!id || id.startsWith('--')) { console.error('usage: gen-ttx-draft.mjs <flow-id> --adv <id>'); process.exit(1); }
const flow = JSON.parse(readFileSync(path.join(root, 'data/flows', id + '.json'), 'utf8'));
const T = JSON.parse(readFileSync(path.join(root, 'data/attack/techniques.json'), 'utf8'));
const M = JSON.parse(readFileSync(path.join(root, 'data/attack/mitigations.json'), 'utf8'));
const rounds = +arg('rounds', 8), tier = +arg('tier', 2), adv = arg('adv', 'G0092');
const first = s => (s || '').split(/(?<=[.!?])\s/)[0];
const par = t => t.split('.')[0];
const label = m => { const d = first(M[m].d); return d.toLowerCase().startsWith(M[m].n.toLowerCase()) ? d : `${M[m].n}: ${d}`; };
const sent = d => { let t = d.replace(/\s+/g, ' ').trim(); if (t.length >= 150) t = t.replace(/\s\S*$/, '') + '…'; return /[.!?…]$/.test(t) ? t : t + '.'; };
const clip = d => d.length > 150 ? d.slice(0, 150) + ' ' : d;

// 1. stages: contiguous runs of actions bucketed into `rounds` groups; drop duplicate techniques
const seen = new Set(), acts = flow.acts.filter(a => { const k = par(a.t); if (seen.has(k)) return false; seen.add(k); return true; });
const per = Math.max(1, Math.ceil(acts.length / rounds)), stages = [];
for (let i = 0; i < acts.length; i += per) stages.push(acts.slice(i, i + per));
const last = stages.length - 1;

// 2. injects
const kindOf = (st, i) => i === 0 ? 'ops' : i === last ? 'alert' : st.some(a => /^T1(0(03|10|21)|021|486|485|490|489)/.test(a.t)) ? 'alert' : 'ops';
const injects = stages.map((st, i) => {
  const lead = st.find(a => a.d) || st[0], tech = T[lead.t] || T[par(lead.t)];
  const mits = [...new Set(st.flatMap(a => (T[a.t] || T[par(a.t)] || {}).m || []))].filter(m => M[m]);
  const rank = mits.map(m => [m, st.filter(a => ((T[a.t] || T[par(a.t)] || {}).m || []).includes(m)).length]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const inj = { id: 'i' + (i + 1), round: Math.min(rounds, i + 1), at: `T+${String(i * 4).padStart(2, '0')}:00`, kind: kindOf(st, i), title: `${lead.n}${tech?.n && tech.n !== lead.n ? ` (${tech.n})` : ''}`.slice(0, 70),
    text: (st.map(a => a.d).filter(Boolean).slice(0, 3).map(d => sent(clip(d))).join(' ') || `The adversary performs ${lead.n}.`).slice(0, 460), refs: [...new Set(st.map(a => 'attack:' + a.t))].slice(0, 4), fx: i === 0 ? [] : [{ op: 'intel', n: 1 }] };
  if (rank.length && i > 0 && i < last) {
    const [m] = rank[0], alt = rank[1]?.[0];
    const ctl = (T[lead.t]?.c || T[par(lead.t)]?.c || []).slice(0, 2).map(c => 'nist-800-53:' + c);
    inj.decision = { prompt: `Responders see this activity (${lead.n}). What do they do?`, choices: [
      { id: 'a', quality: 'best', label: label(m), fx: [{ op: 'reveal', n: 2 }, { op: 'shieldAll', n: 1 }], lesson: `ATT&CK: ${first(M[m].d)} This mitigation applies to ${rank[0][1]} behaviour(s) in this stage.`, refs: ['attack:' + m, ...ctl].slice(0, 4) },
      { id: 'b', quality: 'ok', label: alt ? label(alt) : 'Increase monitoring on the affected hosts and wait for more evidence.', fx: [{ op: 'intel', n: 1 }], lesson: alt ? `A partial fix: ${first(M[alt].d)} It helps, but misses the primary control for this behaviour.` : 'Watching without acting gives the adversary time.', refs: [alt ? 'attack:' + alt : 'nist-csf:DE.CM-01'] },
      { id: 'c', quality: 'poor', label: 'Treat it as noise and continue business as usual.', fx: [{ op: 'plant' }, { op: 'resilience', n: -3 }], lesson: 'Early-stage activity is usually the last cheap moment to intervene; waiting converts a contained event into an incident.', refs: ['nist:800-61'] }
    ] };
  }
  return inj;
});
const out = { id: `${id}-ttx`, draft: true, name: flow.name.replace(/\b\w/g, c => c.toUpperCase()).slice(0, 48), blurb: `Draft exercise based on the documented incident “${flow.name}” (CTID Attack Flow corpus). ${flow.desc}`.slice(0, 300), adversary: { id: adv, tier }, rounds, maxScore: 250, injects,
  objectives: [{ id: 'o1', kind: 'detectBy', round: Math.max(2, Math.ceil(rounds / 2)), text: `Detect the intrusion by round ${Math.max(2, Math.ceil(rounds / 2))}`, points: 30 }, { id: 'o2', kind: 'keepJewel', text: 'Keep the crown jewels intact', points: 40 }, { id: 'o3', kind: 'decisions', text: 'Make the best call on at least half of the decisions', points: 30 }],
  sources: flow.refs, goal: flow.goal };
const dir = path.resolve(root, arg('out', 'scripts/drafts')); mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, `${id}.ttx.json`), JSON.stringify(out, null, 1) + '\n');
console.log(`${id}: ${injects.length} injects, ${injects.filter(i => i.decision).length} decisions, ${flow.refs.length} sources → ${path.relative(root, path.join(dir, id + '.ttx.json'))}`);
