import { html, Icon, useState, useEffect, useMemo, cx, store, useStore, tip, Refs, RefLink, Modal, Sigil } from './ui.js';
import { Typed } from './term.js';
import * as app from './app.js';
import { loadDossier, loadMenuContent, getManifest, getCore, loadFlowIndex, loadFlow } from './loader.js';
import { Card, CardTip, FNCOL } from './components.js';
import { clearanceOf, codexProgress, CLEARANCE_NAMES } from '../../engine/achievements.js';
import { sfx } from './audio.js';

export function useMenuContent() {
  const s = useStore();
  useEffect(() => { if (!s.content) loadMenuContent().then(c => store.set({ content: c })); }, []);
  return s.content;
}

export function DossierModal({ id, onClose }) {
  const s = useStore(); const content = s.content; const [d, setD] = useState(null);
  const meta = content.adversaryMeta[id] || {}; const deck = content.adversaries[id];
  useEffect(() => { loadDossier(id).then(x => { setD(x); app.emitUi({ t: 'dossier_view', adv: id }); }); }, [id]);
  const byTactic = useMemo(() => { const m = {}; for (const t of deck?.techs || []) { const k = t.tac[0]; (m[k] ||= []).push(t); } return m; }, [id]);
  const col = meta.color || '#ff5470';
  if (!d) return html`<${Modal} onClose=${onClose}><p>Loading dossier…</p><//>`;
  const mits = {}; for (const t of deck.techs) for (const m of t.m || []) mits[m] = (mits[m] || 0) + 1;
  const topM = Object.entries(mits).sort((a, b) => b[1] - a[1]).slice(0, 8);
  return html`<${Modal} onClose=${onClose} wide=${true}><div class="dossier" style=${`--accent:${col}`}>
    <div class="col" style="align-items:center"><${Sigil} id=${id} color=${col} icon=${meta.icon || 'hood'} size="lg"/><span class=${'tier-badge t' + (meta.tier || 1)}>${content.tuning.adversary.tiers[meta.tier || 1].name}</span><${RefLink} r=${'attack:' + id} label=${'MITRE ' + id}/></div>
    <div><div class="dimmer" style="font-family:var(--font-display);letter-spacing:.25em;font-size:.72rem">ADVERSARY DOSSIER · ${meta.role || ''}</div><h2>${d.name}</h2><div class="dim">${(d.aliases || []).join(' · ')}</div>
      <${Typed} tag="p" cls="brief-blurb" text=${d.summary} cps=${220}/><div>${(d.summaryCites || []).map(c => html`<a class="reflink std" href=${c.url} target="_blank" rel="noopener noreferrer"><${Icon} n="external-link"/>${c.name.slice(0, 48)}</a>`)}</div>
      ${meta.traits?.length ? html`<h4 style="margin-top:.8rem">In ADVERSARY</h4><div class="trait-l" style=${`--advc:${col}`}>${meta.traits.filter(t => t.name).map(t => html`<div style=${`border-left:3px solid ${col};padding:.4rem .6rem;margin:.3rem 0;background:rgba(255,255,255,.04)`}><b>${t.name}.</b> ${t.text}</div>`)}</div>` : null}
      <h4 style="margin-top:.8rem">Techniques by tactic <span class="dimmer">(${deck.techs.length}${deck.software.length ? ' incl. via ' + deck.software.length + ' tools' : ''})</span></h4>
      ${Object.entries(byTactic).map(([tac, ts]) => html`<div style="margin:.35rem 0"><b class="dim" style="font-size:.72rem;letter-spacing:.1em;text-transform:uppercase">${content.tactics[tac]?.name || tac}</b><div>${ts.slice(0, 14).map(t => html`<${RefLink} r=${'attack:' + t.id} label=${`${t.id} ${t.n}`.slice(0, 44)}/>`)}</div></div>`)}
      <h4 style="margin-top:.8rem">Procedure examples <span class="dimmer">(MITRE, with primary sources)</span></h4>
      ${d.procedures.slice(0, 10).map(p => html`<div class="proc"><span class="tid">${p.id}</span>${p.text}${p.via ? html` <span class="dimmer">[via ${p.via.join(', ')}]</span>` : null}<div>${p.cites.map(c => html`<a class="reflink std" href=${c.url} target="_blank" rel="noopener noreferrer"><${Icon} n="external-link"/>${c.name.slice(0, 54)}</a>`)}</div></div>`)}
      ${d.observables?.length ? html`<h4 style="margin-top:.8rem">Documented observables</h4><p class="dimmer" style="font-size:.78rem">Artefacts named in MITRE procedure examples, with the technique they accompany. MITRE does not publish indicator feeds: IPs, domains and hashes rot quickly and are omitted here. Use the primary advisories below for current IoCs; build detections on <i>behaviour</i> (the technique), not on these strings alone.</p><div class="obs">${d.observables.map(o => html`<span class=${o.kind} ...${tip(`${o.kind} · ${o.tech} ${content.techs[o.tech]?.n || ''}`)}>${o.value}</span>`)}</div>` : null}
      <h4 style="margin-top:.8rem">Counter with (most common ATT&CK mitigations)</h4><div>${topM.map(([m, n]) => html`<a class="reflink mitre" href=${`https://attack.mitre.org/mitigations/${m}/`} target="_blank" rel="noopener noreferrer" ...${tip(content.mits[m]?.d)}><${Icon} n="external-link"/>${m} ${content.mits[m]?.n} ×${n}</a>`)}</div>
      ${d.softwareLinks?.length ? html`<h4 style="margin-top:.8rem">Software</h4><div>${d.softwareLinks.slice(0, 24).map(x => html`<a class="reflink mitre" href=${x.url} target="_blank" rel="noopener noreferrer">${x.n}</a>`)}</div>` : null}
      <h4 style="margin-top:.8rem">Primary sources</h4>${d.sources.map(x => html`<div><a href=${x.url} target="_blank" rel="noopener noreferrer"><${Icon} n="external-link"/> ${x.name}</a></div>`)}
      <p class="dimmer" style="font-size:.72rem;margin-top:1rem">Data: MITRE ATT&CK® (${getManifest().attackVersion}). © The MITRE Corporation, used under the ATT&CK Terms of Use. Card statistics are fictional gameplay values.</p>
    </div></div><//>`;
}

export function Codex() {
  const s = useStore(); const content = useMenuContent(); const [tab, setTab] = useState('adversaries'); const [view, setView] = useState(null); const [q, setQ] = useState('');
  if (!content) return html`<div class="screen"><p>Loading…</p></div>`;
  const prog = codexProgress(content, s.profile);
  const advs = Object.entries(content.adversaryMeta).filter(([k]) => (tab === 'campaigns') === (k[0] === 'C')).filter(([k, m]) => !q || (m.name + k).toLowerCase().includes(q.toLowerCase())).sort((a, b) => b[1].tier - a[1].tier || a[1].name.localeCompare(b[1].name));
  const cards = Object.values(content.cards).filter(c => c.type !== 'status').filter(c => !q || (c.name + c.desc).toLowerCase().includes(q.toLowerCase()));
  const ring = (a, b) => html`<div class="col" style="align-items:center"><div class="ring" style=${`--p:${b ? a / b * 100 : 0}`}><b>${a}</b></div><small class="dim">/ ${b}</small></div>`;
  return html`<div class="screen"><div class="row wrap"><button class="btn ghost small" onClick=${() => app.goto(s.run ? 'run' : 'title')}>Back</button><h2>Codex</h2><span class="spacer"/>${[['Adversaries', prog.adv], ['Controls', prog.cards], ['Relics', prog.relics]].map(([n, p]) => html`<div class="row" style="gap:.5rem">${ring(p[0], p[1])}<small class="dim">${n}</small></div>`)}</div>
    <div class="row wrap"><div class="tabs">${['adversaries', 'campaigns', 'incidents', 'controls', 'relics', 'reference'].map(t => html`<button class=${cx('tab', tab === t && 'on')} onClick=${() => { sfx.click(); setTab(t); }}>${t}</button>`)}</div><span class="spacer"/><input placeholder="Search…" value=${q} onInput=${e => setQ(e.target.value)} style="padding:.5em .9em;border-radius:9px;border:1px solid var(--line2);background:rgba(0,0,0,.4);color:var(--ink)"/></div>
    ${(tab === 'adversaries' || tab === 'campaigns') && html`<div class="picker">${advs.map(([id, m]) => { const seen = s.profile.codex.adv[id]; return html`<button class="pick" style=${`--c:${m.color || '#ff5470'}`} onClick=${() => setView({ t: 'adv', id })}><div class="row"><${Sigil} id=${id} color=${m.color || '#ff5470'} icon=${m.icon || 'hood'} size="sm" glitch=${false}/><div><h3 style="font-size:1rem">${m.name}</h3><div class="dim mono" style="font-size:.72rem">${id} · ${content.tuning.adversary.tiers[m.tier].name}</div><div class="dimmer" style="font-size:.74rem">${m.role}</div></div></div><p>${m.blurb}</p>${seen ? html`<span class="chip good">Encountered ×${seen}</span>` : html`<span class="chip">Not yet encountered</span>`}</button>`; })}</div>`}
    ${tab === 'controls' && html`<div class="row wrap" style="gap:1rem;justify-content:center">${cards.map(c => { const seen = s.profile.codex.card[c.id]; return html`<div style=${seen ? '' : 'filter:grayscale(1) brightness(.55)'}><${Card} content=${content} def=${c} onClick=${() => setView({ t: 'card', id: c.id })}/></div>`; })}</div>`}
    ${tab === 'relics' && html`<div class="row wrap" style="gap:1rem;justify-content:center">${Object.values(content.relics).map(r => html`<div class="relic-card" style=${s.profile.codex.relic[r.id] ? '' : 'filter:grayscale(1) brightness(.6)'}><div class="ic"><${Icon} n=${r.icon}/></div><h4>${r.name}</h4><p>${r.desc}</p><p class="dim" style="font-size:.7rem">${r.lesson}</p><${Refs} list=${r.refs}/></div>`)}</div>`}
    ${tab === 'incidents' && html`<${Incidents} content=${content} q=${q}/>`}
    ${tab === 'reference' && html`<${Reference} content=${content}/>`}
    ${view?.t === 'adv' && html`<${DossierModal} id=${view.id} onClose=${() => setView(null)}/>`}
    ${view?.t === 'card' && html`<${Modal} onClose=${() => setView(null)}><div class="row" style="gap:2rem;align-items:flex-start;flex-wrap:wrap"><${Card} content=${content} def=${content.cards[view.id]} cls="big" tiltOn=${false}/><div style="flex:1;min-width:280px"><${CardTip} content=${content} def=${content.cards[view.id]}/></div></div><//>`}</div>`;
}

function Reference({ content }) {
  return html`<div class="col" style="max-width:980px;margin:0 auto"><div class="panel debrief"><h3>STRIDE → security property</h3><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(250px,1fr))">${content.props.map(p => html`<div class="proc" style=${`border-color:var(--st-${p.letter})`}><b>${p.letter} · ${p.stride}</b> → ${p.name}<div class="dim" style="font-size:.8rem">${p.blurb}</div></div>`)}</div><${Refs} list=${['stride:overview', 'owasp:threat-modeling-manifesto', 'owasp:threat-dragon', 'capec:1']}/></div>
    <div class="panel debrief"><h3>NIST CSF 2.0 functions</h3><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(250px,1fr))">${content.fns.map(f => html`<div class="proc" style=${`border-color:${FNCOL[f.id]}`}><b>${f.name} (${f.csf})</b><div class="dim" style="font-size:.8rem">${f.blurb}</div></div>`)}</div><${Refs} list=${['nist-csf:overview', 'nist-800-53:PL-8', 'nist:800-61', 'nist:800-207']}/></div>
    <div class="panel debrief"><h3>Frameworks used in this game</h3><p><${Refs} list=${['attack:TA0001', 'attack:M1032', 'd3fend:Multi-factorAuthentication', 'owasp-top10:A01', 'owasp-api:API1', 'owasp-llm:LLM01', 'owasp:asvs', 'owasp:samm', 'e8:maturity-model', 'iec62443:overview', 'nist:800-82', 'cis:1', 'iso27001:A.5.1', 'ism:overview', 'soci:overview', 'apra:cps234', 'privacy:ndb', 'nist:fips-203']}/></p>${content.scenario?.reading && html`<h4>Further reading — ${content.scenario.name}</h4>${content.scenario.reading.map(r => html`<div><a href=${r.url} target="_blank" rel="noopener noreferrer"><${Icon} n="external-link"/> ${r.title}</a></div>`)}`}</div></div>`;
}

export function Achievements() {
  const s = useStore(); const content = useMenuContent(); const [cat, setCat] = useState('All');
  if (!content) return html`<div class="screen"><p>Loading…</p></div>`;
  const all = content.achievements; const un = s.profile.ach.unlocked; const prog = s.profile.ach.progress;
  const cats = ['All', ...new Set(all.map(a => a.cat))];
  const list = all.filter(a => cat === 'All' || a.cat === cat).sort((a, b) => (!!un[b.id] - !!un[a.id]) || a.order - b.order);
  const lvl = clearanceOf(content, s.profile.xp);
  const total = all.length, done = Object.keys(un).length;
  const tiers = ['bronze', 'silver', 'gold', 'platinum'].map(t => [t, all.filter(a => a.tier === t && un[a.id]).length, all.filter(a => a.tier === t).length]);
  return html`<div class="screen"><div class="row wrap"><button class="btn ghost small" onClick=${() => app.goto(s.run ? 'run' : 'title')}>Back</button><h2>Achievements</h2><span class="spacer"/>
    <div class="panel row" style="padding:.6rem 1rem;gap:1rem"><div class="ring" style=${`--p:${done / total * 100}`}><b>${done}</b></div><div><b>${done} / ${total}</b> unlocked<div class="dim" style="font-size:.78rem">${tiers.map(([t, a, b]) => html`<span style=${`color:var(--tier-${t});margin-right:.6em`}>● ${a}/${b}</span>`)}</div></div></div>
    <div class="panel" style="padding:.6rem 1rem;min-width:260px"><b>${lvl.name}</b> · Clearance L${lvl.level}<div class="meter seg" style="--c:var(--accent2);margin:.3rem 0"><i style=${`width:${lvl.pct * 100}%`}/></div><small class="dim">${s.profile.xp} XP${lvl.next ? ' · next at ' + lvl.next : ' · max'}</small></div></div>
    <div class="tabs">${cats.map(c => html`<button class=${cx('tab', cat === c && 'on')} onClick=${() => setCat(c)}>${c}</button>`)}</div>
    <div class="ach-grid">${list.map(a => { const u = !!un[a.id]; const secret = a.hidden && !u; const need = a.rule.distinctGte || a.rule.gte || 1; const cur = prog[a.id] || 0; return html`<div class=${cx('ach', a.tier, u ? 'unlocked' : 'locked', secret && 'secret')} ...${tip(!secret ? html`<div style="width:280px"><h4>${a.name}</h4><p>${a.desc}</p>${a.reward ? html`<p class="good">🎁 ${a.reward}</p>` : null}${a.lesson && u ? html`<p class="dim">${a.lesson}</p>` : null}<${Refs} list=${u ? a.refs : []}/></div>` : 'A secret achievement. Experiment — security rewards curiosity.')}>
      <div class="ic"><${Icon} n=${secret ? 'circle-help' : a.icon}/></div><div style="flex:1;min-width:0"><h4>${secret ? '???' : a.name}</h4><p>${secret ? 'Secret achievement' : a.desc}</p>${!u && !secret && need > 1 ? html`<div class="bar"><i style=${`width:${Math.min(100, cur / need * 100)}%`}/></div>` : null}${a.reward && !secret ? html`<p style="color:var(--good);font-size:.72rem">🎁 ${a.reward}</p>` : null}</div><span class="xp">${u ? '✓' : a.xp ?? ({ bronze: 25, silver: 60, gold: 120, platinum: 250 })[a.tier]}</span></div>`; })}</div></div>`;
}


const GOAL_LABEL = (content, g) => content.tuning.goals?.[g]?.name || g;
function Incidents({ content, q }) {
  const [list, setList] = useState(null); const [open, setOpen] = useState(null);
  useEffect(() => { loadFlowIndex().then(setList); }, []);
  if (!list) return html`<p class="dim">Loading incident library…</p>`;
  const rows = list.filter(f => !q || (f.name + f.desc + (f.actor || '')).toLowerCase().includes(q.toLowerCase()));
  return html`<p class="dimmer" style="max-width:760px;margin:.2rem auto .8rem;text-align:center">Real intrusions as ordered ATT&CK technique chains, from the Center for Threat-Informed Defense Attack Flow corpus. Read the steps, then play the adversary that matches.</p>
    <div class="row wrap" style="gap:.8rem;justify-content:center">${rows.map(f => html`<button class="pick" style="--c:#ffbe46;text-align:left;max-width:300px" onClick=${() => setOpen(f.id)}><b>${f.name}</b><div class="dimmer" style="font-size:.74rem">${f.n} steps · goal: ${GOAL_LABEL(content, f.goal)}${f.actor ? ' · ' + f.actor : ''}</div><div style="font-size:.78rem;margin-top:.2rem">${f.desc.slice(0, 120)}${f.desc.length > 120 ? '…' : ''}</div></button>`)}</div>
    ${open && html`<${IncidentModal} id=${open} content=${content} onClose=${() => setOpen(null)}/>`}`;
}
function IncidentModal({ id, content, onClose }) {
  const [d, setD] = useState(null);
  useEffect(() => { loadFlow(id).then(setD); }, [id]);
  if (!d) return html`<${Modal} onClose=${onClose}><p>Loading…</p><//>`;
  return html`<${Modal} onClose=${onClose} wide=${true}><div class="dossier"><div style="grid-column:1/-1"><div class="dimmer" style="font-family:var(--font-display);letter-spacing:.25em;font-size:.72rem">INCIDENT TIMELINE · goal: ${GOAL_LABEL(content, d.goal)}</div><h2>${d.name}</h2><p>${d.desc}</p>
    <div>${d.refs.map(r => html`<a class="reflink std" href=${r.u} target="_blank" rel="noopener noreferrer"><${Icon} n="external-link"/>${r.n}</a>`)}</div>
    <h4 style="margin-top:.8rem">Steps in order <span class="dimmer">(${d.acts.length}; branches and parallel steps are flattened by distance from the start)</span></h4>
    ${d.acts.map((a, i) => html`<div class="proc"><span class="tid">${i + 1}</span><a class="reflink mitre" href=${`https://attack.mitre.org/techniques/${a.t.replace('.', '/')}/`} target="_blank" rel="noopener noreferrer">${a.t}</a> <b>${a.n}</b>${a.d ? html`<div class="dimmer" style="font-size:.8rem">${a.d}</div>` : null}</div>`)}
    <p class="dimmer" style="font-size:.72rem;margin-top:1rem">Source: CTID Attack Flow corpus (Apache-2.0). Descriptions are the corpus authors’ summaries; follow the links for the primary reporting.</p></div></div><//>`;
}
