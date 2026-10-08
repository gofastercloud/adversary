import { html, Icon, useState, useEffect, useMemo, useRef, cx, store, useStore, tip, Refs, RefLink, Modal, Sigil, clock, pct, sleep } from './ui.js';
import * as app from './app.js';
import { Card, CardTip, FNCOL, cardIcon } from './components.js';
import { loadDossier } from './loader.js';
import { NODE_LABEL, wbQuestion } from '../../engine/run.js';
import { compileDeck } from '../../engine/tactics.js';
import { strideName } from '../../engine/describe.js';
import { sfx } from './audio.js';
import { Typed, Decrypt, Count } from './term.js';
import { burst, confetti, banner, floater } from './fx.js';
import { clearanceOf } from '../../engine/achievements.js';

const NODE_ICON = { battle: 'swords', elite: 'skull', boss: 'crown', shop: 'coins', rest: 'heart-pulse', event: 'circle-help', whiteboard: 'workflow', ttx: 'clipboard-check' };

export function RunHeader({ onDeck }) {
  const { run, content } = useStore();
  const lvl = run.res.cur / run.res.max;
  return html`<div class="row wrap" style="gap:.8rem">
    <span class="chip" style=${`border-color:${lvl < .3 ? 'var(--bad)' : lvl < .6 ? 'var(--warn)' : 'var(--good)'}`}><${Icon} n="heart-pulse"/>Resilience ${run.res.cur}/${run.res.max}</span>
    <span class="chip"><${Icon} n="coins"/>$${run.money}</span>
    <span class="chip"><${Icon} n="layers"/>Act ${run.act} · ${content.roster?.acts?.[run.act - 1]?.name?.replace(/^Act [IVX]+ — /, '') || ''}</span>
    <button class="btn small ghost" onClick=${onDeck}><${Icon} n="layers"/>Deck (${run.deck.length})</button>
    <span class="spacer"/>
    <span class="row" style="gap:.3rem">${run.relics.map(id => { const r = content.relics[id]; return html`<span class="relic" ...${tip(html`<div style="width:260px"><h4>${r.name}</h4><p>${r.desc}</p><p class="dim">${r.lesson}</p></div>`)}><${Icon} n=${r.icon}/></span>`; })}</span></div>`;
}

export function DeckModal({ onClose, pick, title, filter }) {
  const { run, content } = useStore();
  const cards = run.deck.filter(c => !filter || filter(c)).slice().sort((a, b) => content.cards[a.id].fn.localeCompare(content.cards[b.id].fn) || content.cards[a.id].name.localeCompare(content.cards[b.id].name));
  return html`<${Modal} onClose=${onClose} wide=${true}><h2>${title || 'Your deck'} <span class="dim" style="font-size:1rem">${cards.length} cards</span></h2><div class="deck-pick">${cards.map(c => html`<${Card} content=${content} def=${content.cards[c.id]} ml=${c.ml} onClick=${pick ? () => pick(c) : null} tiltOn=${true}/>`)}</div><//>`;
}

export function MapScreen() {
  const { run, content } = useStore(); const [deck, setDeck] = useState(false);
  const choose = (i) => { sfx.click(); const r = app.act({ type: 'CHOOSE', index: i }); };
  return html`<div class="screen map"><${RunHeader} onDeck=${() => setDeck(true)}/>
    <div class="map-head"><h2>${content.org?.name}</h2><span class="dim">${content.org?.sector}</span></div>
    <div class="acts" tabindex="0" role="group" aria-label="Operation map">${run.map.map((steps, ai) => { const cls = ai + 1 < run.act ? 'past' : ai + 1 === run.act ? 'cur' : 'future'; return html`<div class=${cx('act panel', cls)}><h3>${content.roster.acts[ai].name}</h3><div class="steps">${steps.map((opts, si) => { const isNow = ai + 1 === run.act && si === run.step; const done = ai + 1 < run.act || (ai + 1 === run.act && si < run.step); return html`<div class="step">${opts.map((o, oi) => html`<div class=${cx('node', o.type, isNow && 'avail', done && 'done')} onClick=${isNow ? () => choose(oi) : null} ...${tip(NODE_LABEL[o.type])}><${Icon} n=${NODE_ICON[o.type]}/>${NODE_LABEL[o.type]}</div>`)}</div>`; })}</div></div>`; })}</div>
    ${deck && html`<${DeckModal} onClose=${() => setDeck(false)}/>`}</div>`;
}

export function Briefing() {
  const { run, content, profile } = useStore(); const br = run.briefing; const advData = content.adversaries[br.adv]; const meta = content.adversaryMeta[br.adv] || {};
  const [doss, setDoss] = useState(null);
  useEffect(() => { loadDossier(br.adv).then(setDoss); }, [br.adv]);
  const deckMit = useMemo(() => { const s = new Set(); for (const c of run.deck) { const d = content.cards[c.id]; for (const m of d.mit || []) s.add(m); for (const m of d.aug?.mit || []) s.add(m); } return s; }, [run.deck]);
  const mitFreq = useMemo(() => { const f = {}; for (const t of advData.techs) for (const m of t.m || []) f[m] = (f[m] || 0) + 1; return Object.entries(f).sort((a, b) => b[1] - a[1]).slice(0, 10); }, [br.adv]);
  const deck = useMemo(() => compileDeck(advData, { tier: br.tier, assessed: meta.assessed || [], techTable: content.techs }), [br.adv]);
  const tacs = ['initial-access', 'execution', 'persistence', 'privilege-escalation', 'stealth', 'defense-impairment', 'credential-access', 'discovery', 'lateral-movement', 'collection', 'command-and-control', 'exfiltration', 'impact', 'inhibit-response-function', 'impair-process-control'];
  const have = new Set(deck.map(c => c.tactic));
  const col = meta.color || '#ff5470';
  return html`<div class="screen"><div class="brief panel glow" style=${`--advc:${col};--accent:${col}`}>
    <div class="col" style="align-items:center"><${Sigil} id=${br.adv} color=${col} icon=${meta.icon || 'hood'} size="lg"/><span class=${'tier-badge t' + br.tier}>${content.tuning.adversary.tiers[br.tier].name}${br.type === 'boss' ? ' · BOSS' : br.type === 'elite' ? ' · ELITE' : ''}</span><${RefLink} r=${'attack:' + br.adv} label="MITRE page"/>
      <button class="btn ghost small" onClick=${() => { store.set({ modal: { type: 'dossier', id: br.adv } }); }}><${Icon} n="file-search"/>Dossier</button></div>
    <div><div class="dimmer" style="font-family:var(--font-display);letter-spacing:.25em;font-size:.75rem">INTELLIGENCE BRIEFING</div><h2><${Decrypt} text=${br.name} ms=${800}/></h2>
      <div class="dim">${(advData.aliases || []).slice(0, 4).join(' · ')}</div><${Typed} tag="p" cls="brief-blurb" text=${br.blurb} cps=${130}/>
      ${br.note && html`<p class="chip warn" style="white-space:normal">⚠ ${br.note}</p>`}
      <div class="trait-l">${br.traits.filter(t => t.name).map(t => html`<div><b>${t.name}.</b> ${t.text}</div>`)}</div>
      ${meta.goal && html`<div class="goalbrief"><${Icon} n=${content.tuning.goals[meta.goal].icon}/> <b>Goal: ${content.tuning.goals[meta.goal].name}.</b> ${content.tuning.goals[meta.goal].blurb} <span class="dim">${content.tuning.goals[meta.goal].how}</span></div>`}
      <h3 class="dim">Kill chain coverage (signature techniques)</h3><div class="dimmer" style="font-size:.78rem;margin:-.2rem 0 .3rem">Each battle also draws ${[7, 5, 4][Math.min(2, br.tier - 1)]} commodity techniques at random from baseline tradecraft (what most intrusion sets do, weighted by ATT&CK prevalence). Payoffs come from its signature or, if it has too few, from what real incidents with the same goal used.</div><div class="kc">${tacs.map(t => html`<span class=${have.has(t) ? 'has' : ''}>${content.tactics[t]?.name || t}</span>`)}</div>
      <h4 class="dim" style="margin-top:.8rem">Mitigations that blunt its techniques — does your deck cover them?</h4>
      <div class="row wrap">${mitFreq.map(([m, n]) => { const ok = deckMit.has(m); return html`<a class=${cx('chip')} style=${`border-color:${ok ? 'var(--good)' : 'var(--bad)'};color:${ok ? '#9bffb5' : '#ffb0c0'}`} href=${`https://attack.mitre.org/mitigations/${m}/`} target="_blank" rel="noopener noreferrer" ...${tip(content.mits[m]?.d || '')}>${ok ? '✓' : '✗'} ${m} ${content.mits[m]?.n} <small class="dimmer">×${n}</small></a>`; })}</div>
      ${doss && html`<h4 class="dim" style="margin-top:.8rem">Documented observables <span class="dimmer">(from ATT&CK procedure examples — behaviours, not blocklists)</span></h4><div class="obs">${doss.observables.slice(0, 10).map(o => html`<span class=${o.kind} ...${tip(`${o.kind} · seen with ${o.tech}`)}>${o.value}</span>`)}</div>`}
      <div class="row" style="margin-top:1.2rem"><button class="btn primary big" onClick=${() => { sfx.stinger(); app.act({ type: 'START_BATTLE' }); }}><${Icon} n="swords"/>Begin battle</button></div></div></div></div>`;
}

export function RewardScreen() {
  const { run, content, runTechs } = useStore(); const rw = run.reward; const b = run.battle;
  const [deck, setDeck] = useState(false);
  const played = useMemo(() => [...new Set(b.adv.played)], []);
  const advData = content.adversaries[rw.adv];
  const lines = [['Contained ' + (rw.how === 'evicted' ? '(evicted)' : '(survived)'), '+$' + (rw.money - rw.fast - rw.noDamage)], rw.fast ? ['Early eviction bonus', '+$' + rw.fast] : null, rw.noDamage ? ['Flawless defence', '+$' + rw.noDamage] : null].filter(Boolean);
  useEffect(() => { sfx.coin(); }, []);
  const takeCard = (id) => { sfx.buy(); burst(innerWidth / 2, innerHeight / 2, { colors: ['#ffd23d', '#fff'], n: 40 }); app.act({ type: 'TAKE_CARD', id }); };
  return html`<div class="screen"><div class="reward panel glow rise"><h1 class="glowtext" style="color:var(--good)"><${Decrypt} text=${rw.type === 'boss' ? 'Apex adversary defeated' : 'Victory'} ms=${800}/></h1>
    <div class="tally">${lines.map(([a, c], i) => html`<div style=${`--i:${i}`}><span>${a}</span><${Count} to=${+String(c).replace(/\D/g, '')} prefix="+$" delay=${i * 140}/></div>`)}<div class="tot" style=${`--i:${lines.length}`}><span>Total budget</span><${Count} to=${rw.money} prefix="+$" delay=${lines.length * 140} ms=${1000}/></div></div>
    ${rw.debt > 0 && html`<p class="chip warn" style="white-space:normal">⚠ ${rw.debt} quantum debt applied: data stolen without post-quantum protection will be readable later.</p>`}
    <div class="debrief panel"><h4><${Icon} n="book-open"/> Debrief — what ${advData.name} actually did</h4><ul>${played.slice(0, 8).map(tid => { const t = content.techs[tid]; const mits = (t?.m || []).slice(0, 4); return html`<li><b>${tid}</b> ${t?.n} <${RefLink} r=${'attack:' + tid} label="↗"/> <span class="dimmer">mitigations:</span> ${mits.map(m => html`<a class="chip" style="font-size:.68rem" href=${`https://attack.mitre.org/mitigations/${m}/`} target="_blank" rel="noopener noreferrer">${m} ${content.mits[m]?.n}</a>`)}</li>`; })}${!played.length && html`<li class="dimmer">The adversary never got a move in.</li>`}</ul><p class="dimmer" style="font-size:.78rem;margin-top:.6rem">Source: MITRE ATT&CK ${advData.id}. Open the dossier from the Codex for procedure examples and primary-source advisories.</p></div>
    ${!run.reward.cardTaken ? html`<h3>Choose a control to add to your deck</h3><div class="cards">${rw.cards.map((id, i) => html`<${Card} content=${content} def=${content.cards[id]} cls="flip" i=${i} onClick=${() => takeCard(id)}/>`)}</div><div class="row" style="justify-content:center"><button class="btn ghost" onClick=${() => app.act({ type: 'SKIP_CARD' })}>Skip (keep the deck lean)</button></div>` : null}
    ${run.reward.cardTaken && rw.relics.length && !rw.relicTaken ? html`<h3>Choose a relic</h3><div class="row wrap" style="justify-content:center;gap:1rem">${rw.relics.map(id => { const r = content.relics[id]; return html`<div class="relic-card" onClick=${() => { sfx.buy(); app.act({ type: 'TAKE_RELIC', id }); }}><div class="ic"><${Icon} n=${r.icon}/></div><h4>${r.name}</h4><p>${r.desc}</p><p class="dimmer" style="font-size:.7rem">${r.rarity}</p></div>`; })}</div><div class="row" style="justify-content:center;margin-top:1rem"><button class="btn ghost" onClick=${() => app.act({ type: 'SKIP_RELIC' })}>Skip</button></div>` : null}
    ${run.reward.cardTaken && (!rw.relics.length || rw.relicTaken) && html`<div class="row" style="justify-content:center;margin-top:1.2rem"><button class="btn good big" onClick=${() => app.act({ type: 'DONE_REWARD' })}>Continue <${Icon} n="chevron-right"/></button></div>`}
    <div class="row" style="justify-content:center;margin-top:.8rem"><button class="btn ghost small" onClick=${() => setDeck(true)}>View deck (${run.deck.length})</button></div>
    ${deck && html`<${DeckModal} onClose=${() => setDeck(false)}/>`}</div></div>`;
}

export function ShopScreen() {
  const { run, content } = useStore(); const sh = run.shop; const [deck, setDeck] = useState(false); const [rm, setRm] = useState(false);
  const buy = (i) => { const r = app.act({ type: 'BUY', index: i }); if (r.ok) { burst(innerWidth / 2, innerHeight / 2, { colors: ['#ffd23d'], n: 30 }); sfx.buy(); } };
  return html`<div class="screen"><${RunHeader} onDeck=${() => setDeck(true)}/><div class="shop"><h2 style="text-align:center">Procurement</h2><p class="dim center">Spend carefully — budget only comes from battles and events. Tooltips explain what each control counters.</p>
    <div class="goods">${sh.slots.map((s, i) => { if (s.kind === 'card') { const d = content.cards[s.id]; return html`<div class=${cx('good', s.sold && 'sold')}><${Card} content=${content} def=${d} onClick=${() => buy(i)}/><span class=${cx('price', run.money < s.cost && 'no')}>$${s.cost}</span></div>`; } const r = content.relics[s.id]; return html`<div class=${cx('good', s.sold && 'sold')}><div class="relic-card" onClick=${() => buy(i)}><div class="ic"><${Icon} n=${r.icon}/></div><h4>${r.name}</h4><p>${r.desc}</p></div><span class=${cx('price', run.money < s.cost && 'no')}>$${s.cost}</span></div>`; })}</div>
    <div class="row" style="justify-content:center;gap:1rem;flex-wrap:wrap"><button class="btn warn" disabled=${sh.removed || run.money < sh.removeCost} onClick=${() => setRm(true)}><${Icon} n="trash-2"/>Decommission a card · $${sh.removeCost}</button><button class="btn good" disabled=${sh.healed || run.money < content.tuning.shop.healCost} onClick=${() => app.act({ type: 'HEAL_SHOP' })}><${Icon} n="heart-pulse"/>Restore ${content.tuning.shop.healAmount} Resilience · $${content.tuning.shop.healCost}</button><button class="btn primary" onClick=${() => app.act({ type: 'LEAVE' })}>Leave <${Icon} n="chevron-right"/></button></div></div>
    ${deck && html`<${DeckModal} onClose=${() => setDeck(false)}/>`}${rm && html`<${DeckModal} title="Decommission which card?" onClose=${() => setRm(false)} pick=${(c) => { setRm(false); app.act({ type: 'REMOVE', iid: c.iid }); sfx.buy(); }}/>`}</div>`;
}

export function RestScreen() {
  const { run, content } = useStore(); const [mode, setMode] = useState(null);
  const done = run.rest.done;
  return html`<div class="screen"><${RunHeader} onDeck=${() => {}}/><h2 class="center" style="margin-top:1rem">Rest & Training</h2><p class="center dim">Resilience ${run.res.cur}/${run.res.max}. Choose one.</p>
    <div class="rest-opts"><button class="rest-opt" disabled=${done} onClick=${() => { sfx.coin(); app.act({ type: 'REST', choice: 'heal' }); }}><${Icon} n="heart-pulse"/><h3>Recover</h3><p class="dim">Restore ${Math.ceil(run.res.max * .3)} Resilience.</p></button>
      <button class="rest-opt" disabled=${done} onClick=${() => setMode('upgrade')}><${Icon} n="trending-up"/><h3>Maturity uplift</h3><p class="dim">Raise one card a maturity level (ML1→ML3): stronger numbers, and at ML3 it costs 1 less.</p></button>
      <button class="rest-opt" disabled=${done} onClick=${() => setMode('remove')}><${Icon} n="trash-2"/><h3>Decommission</h3><p class="dim">Permanently remove a card to thin your deck.</p></button></div>
    ${done && html`<div class="row" style="justify-content:center"><button class="btn primary big" onClick=${() => app.act({ type: 'LEAVE' })}>Continue</button></div>`}
    ${mode && html`<${DeckModal} title=${mode === 'upgrade' ? 'Uplift which card?' : 'Remove which card?'} filter=${c => mode === 'remove' || (c.ml < 3 && content.cards[c.id].type !== 'status')} onClose=${() => setMode(null)} pick=${(c) => { setMode(null); sfx.buy(); burst(innerWidth / 2, innerHeight / 2, { colors: ['#4ade80', '#fff'], n: 40 }); app.act({ type: 'REST', choice: mode, iid: c.iid }); }}/>`}</div>`;
}

export function EventScreen() {
  const { run, content } = useStore(); const e = content.events[run.event.id]; const picked = run.event.picked;
  return html`<div class="screen"><div class="event panel glow rise"><div class="dimmer" style="font-family:var(--font-display);letter-spacing:.25em;font-size:.75rem">EVENT</div><h2>${e.title}</h2><p style="font-size:1.05rem">${e.text}</p>
    ${picked == null ? html`<div class="choices">${e.choices.map((c, i) => html`<button class="btn" onClick=${() => { sfx.click(); app.act({ type: 'EVENT', index: i }); }}>${c.text}</button>`)}</div>` : html`<div class="verdict ok rise" style="text-align:left;margin:1rem 0"><p><b>${e.choices[picked].text}</b></p><p>${e.choices[picked].result}</p>${e.choices[picked].lesson && html`<p class="dim">💡 ${e.choices[picked].lesson}</p>`}<${Refs} list=${e.choices[picked].refs || []}/></div><p class="dim" style="font-size:.85rem">${e.lesson}</p><button class="btn primary big" onClick=${() => app.act({ type: 'EVENT_DONE' })}>Continue</button>`}</div></div>`;
}

// ───────── threat-modelling workshop ─────────
function boxEdge(el, tx, ty) { const w = 85, h = 32; const dx = tx - el.x, dy = ty - el.y; if (!dx && !dy) return { x: el.x, y: el.y }; const sx = w / Math.abs(dx || 1e-9), sy = h / Math.abs(dy || 1e-9); const k = Math.min(sx, sy); return { x: el.x + dx * k, y: el.y + dy * k }; }
const wrap2 = (t) => { if (t.length <= 17) return [t]; const w = t.split(' '); let best = [t, '']; let bd = 1e9; for (let i = 1; i < w.length; i++) { const l1 = w.slice(0, i).join(' '), l2 = w.slice(i).join(' '); const d = Math.abs(l1.length - l2.length); if (d < bd) { bd = d; best = [l1, l2]; } } return best[1] ? best : [t]; };
export function DFD({ system, target }) {
  const els = Object.fromEntries(system.elements.map(e => [e.id, e]));
  const flows = system.flows.map(f => { const a = els[f.from], b = els[f.to]; const p1 = boxEdge(a, b.x, b.y), p2 = boxEdge(b, a.x, a.y); return { f, p1, p2, mx: (p1.x + p2.x) / 2, my: (p1.y + p2.y) / 2 }; });
  return html`<svg class="canvas" viewBox="0 0 1000 560" preserveAspectRatio="xMidYMid meet"><defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#8fb4ff"/></marker></defs>
    ${(system.boundaries || []).map(b => html`<g class="boundary"><rect x=${b.x} y=${b.y} width=${b.w} height=${b.h}/><text x=${b.x + 12} y=${b.y + 18}>${b.label}</text></g>`)}
    ${flows.map(({ f, p1, p2 }) => html`<g class=${cx('flow', target?.kind === 'flow' && target.id === f.id && 'target')}><path d=${`M${p1.x},${p1.y} L${p2.x},${p2.y}`}/></g>`)}
    ${system.elements.map(e => { const isT = target?.kind === 'element' && target.id === e.id; const lines = wrap2(e.label); return html`<g class=${cx('el', e.type === 'store' && 'store', e.type === 'external' && 'ext', isT && 'target')}>${e.type === 'process' ? html`<rect x=${e.x - 85} y=${e.y - 32} width="170" height="64" rx="32"/>` : e.type === 'store' ? html`<rect x=${e.x - 85} y=${e.y - 32} width="170" height="64" rx="4" style="fill:rgba(20,30,70,.9)"/><line x1=${e.x - 85} x2=${e.x + 85} y1=${e.y - 21} y2=${e.y - 21}/><line x1=${e.x - 85} x2=${e.x + 85} y1=${e.y + 21} y2=${e.y + 21}/>` : html`<rect x=${e.x - 85} y=${e.y - 32} width="170" height="64" rx="2"/>`}${lines.map((l, i) => html`<text x=${e.x} y=${e.y + 5 + (i - (lines.length - 1) / 2) * 16}>${l}</text>`)}</g>`; })}
    ${flows.map(({ f, mx, my }) => { const isT = target?.kind === 'flow' && target.id === f.id; return html`<g class=${cx('flow', 'lbl', isT && 'target')}><text x=${mx} y=${my - 7}>${f.label}</text>${isT && html`<circle cx=${mx} cy=${my} r="9" fill="#ff5470" opacity=".9"><animate attributeName="r" values="7;14;7" dur="1s" repeatCount="indefinite"/></circle>`}</g>`; })}</svg>`;
}
const STRIDE_FULL = { S: ['Spoofing', 'Pretending to be someone/something else'], T: ['Tampering', 'Modifying data or code without authority'], R: ['Repudiation', 'Denying an action; no reliable evidence'], I: ['Information disclosure', 'Exposing data to the unauthorised'], D: ['Denial of service', 'Degrading or blocking legitimate use'], E: ['Elevation of privilege', 'Gaining capability you were not granted'] };
export function WhiteboardScreen() {
  const { run, content } = useStore(); const w = run.whiteboard; const q = wbQuestion(content, run); const sys = content.systems[w.system];
  const [shown, setShown] = useState(0);   // index of question whose result we are showing
  const answered = w.answers.length; const cur = Math.min(shown, w.qs.length - 1);
  const scn = sys.scenarios.find(s => s.id === w.qs[cur]); const ans = w.answers[cur];
  const choose = (l) => { const r = app.act({ type: 'WB_ANSWER', letter: l }); if (r.ok) { const ok = l === scn.answer; sfx[ok ? 'win' : 'error'](); if (ok) burst(innerWidth * .7, innerHeight * .5, { colors: ['#4ade80', '#fff'], n: 40 }); } };
  return html`<div class="screen"><${RunHeader} onDeck=${() => {}}/><div class="row"><h2><${Icon} n="workflow"/> Threat-modelling workshop</h2><span class="dim">${sys.name}</span><span class="spacer"/><span class="chip">Question ${cur + 1} / ${w.qs.length}</span></div>
    <p class="dim" style="margin:.2rem 0 .6rem">${sys.blurb} Each correct STRIDE call earns $12 and a ward on a random asset for your next battle; a perfect workshop also restores 4 Resilience.</p>
    <div class="wb"><div class="panel dfd"><${DFD} system=${sys} target=${scn.target}/></div>
      <div class="panel wb-q"><div class="dimmer" style="font-family:var(--font-display);letter-spacing:.2em;font-size:.72rem">OBSERVATION ${cur + 1}</div><div class="story">${scn.text}</div>
        ${!ans ? html`<h4 class="dim">Which STRIDE category does this threat belong to?</h4><div class="stride-btns">${Object.entries(STRIDE_FULL).map(([l, [n, d]]) => html`<button class="btn" style=${`--sc:var(--st-${l})`} onClick=${() => choose(l)} title=${d}><b>${l}</b>${n}</button>`)}</div>` : html`<div class=${cx('verdict', ans.ok ? 'ok' : 'no')}><b>${ans.ok ? 'Correct' : 'Not quite'} — ${STRIDE_FULL[scn.answer][0]} (${strideName(scn.answer)})</b><p style="margin:.4em 0">${scn.why}</p><${Refs} list=${scn.refs || []}/></div>
          <div class="row" style="justify-content:flex-end">${cur + 1 < w.qs.length ? html`<button class="btn primary" onClick=${() => setShown(cur + 1)}>Next <${Icon} n="chevron-right"/></button>` : html`<button class="btn good big" onClick=${() => { const r = app.act({ type: 'WB_DONE' }); if (r.ok) { sfx.coin(); } }}>Finish workshop</button>`}</div>`}
      </div></div></div>`;
}

// ───────── result ─────────
export function ResultScreen() {
  const { run, content, profile, runTechs, submitted } = useStore(); const r = run.result; const s = run.stats;
  const lvl = clearanceOf(content, profile.xp);
  useEffect(() => { if (r.won) { confetti(160); } }, []);
  const letters = ['S', 'T', 'R', 'I', 'D', 'E'];
  const seen = (runTechs || []).slice(0, 14);
  return html`<div class="screen result ${r.won ? 'won' : 'lost'}"><h1><${Decrypt} text=${run.mode === 'ttx' ? 'Exercise complete' : r.won ? 'Campaign won' : 'Breach'} ms=${900}/></h1><div class="tagline">${content.org?.name} · ${content.doctrines[r.doctrine].name} · ML${r.assurance}</div>
    <div class="statgrid"><div class="stat"><b><${Count} to=${r.points}/></b><span>Points</span></div><div class="stat"><b><${Count} to=${s.battles}/></b><span>Battles won</span></div><div class="stat"><b><${Count} to=${s.evictions}/></b><span>Evictions</span></div><div class="stat"><b><${Count} to=${r.act}/></b><span>Act reached</span></div><div class="stat"><b>${s.wbCorrect}/${s.wbTotal}</b><span>STRIDE correct</span></div><div class="stat"><b><${Count} to=${run.deck.length}/></b><span>Deck size</span></div></div>
    ${run.ttx?.result && html`<div class="panel" style="padding:1rem;max-width:760px;text-align:left"><h3>Exercise scorecard — ${run.ttx.result.score} points</h3>${run.ttx.result.objectives.map(o => html`<div class="row"><span class=${o.ok ? 'good' : 'bad'}>${o.ok ? '✓' : '✗'}</span><span>${o.text}</span><span class="spacer"/><b>${o.points}</b></div>`)}</div>`}
    <div class="panel debrief" style="max-width:900px"><h4><${Icon} n="graduation-cap"/> What you learned</h4><div class="row wrap">${letters.map(l => { const x = s.byLetter[l]; return x ? html`<span class="chip"><span class=${'stride tag-' + l}>${l}</span> ${x.ok}/${x.n}</span>` : null; })}</div>
      ${seen.length > 0 && html`<p class="dim" style="margin-top:.6rem">Techniques you faced:</p><div>${seen.map(t => html`<${RefLink} r=${'attack:' + t} label=${`${t} ${content.techs[t]?.n || ''}`.slice(0, 44)}/>`)}</div>`}
      ${r.won ? null : html`<p class="dim" style="margin-top:.6rem">Tip: open the adversary dossier before the fight (Briefing → Dossier) and match your controls to the mitigations it lists.</p>`}</div>
    <div class="row"><span class="chip">Clearance L${lvl.level} · ${lvl.name}</span>${submitted?.ok ? html`<span class="chip good">Run verified by server ✓</span>` : submitted && !submitted.ok ? html`<span class="chip warn" title=${submitted.error}>Offline — score not posted</span>` : null}</div>
    <div class="row wrap" style="justify-content:center"><button class="btn primary big" onClick=${() => { app.quitToTitle(); app.goto('setup'); }}>Another run</button><button class="btn ghost" onClick=${() => { navigator.clipboard?.writeText(`ADVERSARY seed ${app.S().init.seed} · ${content.scenarioId} · ${r.doctrine} · ML${r.assurance}`); floater('Seed copied', innerWidth / 2, 140, '#4ade80'); }}>Copy seed</button><button class="btn ghost" onClick=${() => app.quitToTitle()}>Title</button></div></div>`;
}
