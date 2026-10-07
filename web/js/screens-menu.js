import { html, Icon, useState, useEffect, useMemo, cx, store, useStore, Refs, Modal, Sigil } from './ui.js';
import * as app from './app.js';
import { getCore, getManifest, loadContent } from './loader.js';
import { setPalette } from './bg.js';
import { sfx, unlock } from './audio.js';
import { clearanceOf } from '../../engine/achievements.js';
import { Card } from './components.js';

const FNCOL = { govern: 'var(--fn-govern)', identify: 'var(--fn-identify)', protect: 'var(--fn-protect)', detect: 'var(--fn-detect)', respond: 'var(--fn-respond)', recover: 'var(--fn-recover)' };

export function TopBar({ onMenu, inRun }) {
  const s = useStore(); const core = getCore(); const lvl = core ? clearanceOf({ tuning: core.tuning }, s.profile.xp) : null;
  return html`<div class="topbar"><button class="iconbtn" onClick=${() => { sfx.click(); onMenu(); }} aria-label="Menu"><${Icon} n="menu"/></button>
    <span class="brand">ADVER<em>SARY</em></span><span class="spacer"/>
    ${lvl && html`<div class="clr hide-sm"><${Icon} n="id-card"/><span>${lvl.name} · L${lvl.level}</span><div class="meter seg"><i style=${`width:${lvl.pct * 100}%`}/></div><span class="dimmer">${s.profile.xp} XP</span></div>`}
    <button class="iconbtn" onClick=${() => app.goto('achievements')} title="Achievements"><${Icon} n="trophy"/></button>
    <button class="iconbtn" onClick=${() => app.goto('codex')} title="Codex"><${Icon} n="book-open"/></button>
    <button class="iconbtn" onClick=${() => app.goto('settings')} title="Settings"><${Icon} n="settings"/></button></div>`;
}

const FACTS = [
  ['ATT&CK T1621', 'Plain push MFA is defeated by MFA-request generation (“push bombing”). Number matching and FIDO2 are the counters.'],
  ['ATT&CK M1053', 'Ransomware crews delete reachable backups first (T1490). An air-gapped copy sits outside the blast radius.'],
  ['STRIDE', 'Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege — a checklist for every data flow.'],
  ['NIST CSF 2.0', 'Govern joined Identify, Protect, Detect, Respond and Recover in CSF 2.0: strategy and accountability come first.'],
  ['CISA AA24-038A', 'Volt Typhoon lives off the land: vssadmin, netsh, ntdsutil. Hunt for behaviour, not malware.'],
  ['FIPS 203', 'ML-KEM is NIST’s post-quantum key-encapsulation standard. “Harvest now, decrypt later” makes migration a today problem.'],
  ['Essential Eight', 'Application control, patching, MFA, restricted admin, hardening, macros, backups: maturity levels measure how consistently, not just whether.'],
  ['Dwell time', 'Every round an intruder stays hidden is another foothold, another credential, another staged dataset.']
];

export function Title() {
  const s = useStore(); const [fi, setFi] = useState(0);
  useEffect(() => { const t = setInterval(() => setFi(x => (x + 1) % FACTS.length), 6500); return () => clearInterval(t); }, []);
  const core = getCore();
  const decor = useMemo(() => core ? ['c.protect.spoofing', 'c.detect.tampering', 'a.fido2', 'c.respond.tampering', 'x.edr', 'a.pqc'].map((id, i) => ({ id, left: 6 + i * 16, top: i % 2 ? 62 : 10, r: (i - 2.5) * 7 })) : [], [core]);
  const c = s.content;
  const streak = s.profile.daily?.streak || 0;
  return html`<div class="screen title"><div class="title-cards">${c && decor.map(d => html`<div style=${`position:absolute;left:${d.left}%;top:${d.top}%;--r:${d.r}deg;transform:rotate(${d.r}deg);animation:floaty 9s ${d.r}s ease-in-out infinite`}><${Card} content=${c} def=${c.cards[d.id]} tiltOn=${false}/></div>`)}</div>
    <div style="position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;gap:1.2rem">
    <div class="logo" data-t="ADVERSARY">ADVERSARY</div>
    <div class="tagline">Threat modelling · Blue team · Card battler</div>
    <div class="menu">
      ${s.saved && html`<button class="btn good big pulse" onClick=${async () => { unlock(); if (!(await app.resumeRun())) return; }}><${Icon} n="play"/>Continue run</button>`}
      <button class="btn primary big" onClick=${() => { unlock(); app.goto('setup'); }}><${Icon} n="swords"/>New run</button>
      <button class="btn violet" onClick=${() => { unlock(); app.goto('daily'); }}><${Icon} n="flame"/>Daily challenge${streak > 1 ? html` <span class="chip" style="margin-left:.4em">🔥 ${streak}</span>` : ''}</button>
      <button class="btn warn" onClick=${() => app.goto('ttx')}><${Icon} n="clipboard-check"/>Tabletop exercises</button>
      <div class="row" style="gap:.6rem"><button class="btn ghost" style="flex:1" onClick=${() => app.goto('tutorial')}><${Icon} n="graduation-cap"/>Tutorial</button><button class="btn ghost" style="flex:1" onClick=${() => app.goto('docs')}><${Icon} n="book-open"/>Guide</button></div>
    </div>
    <div class="ticker" key=${fi}><b class="glowtext" style="color:var(--accent)">${FACTS[fi][0]}</b> — ${FACTS[fi][1]}</div>
    ${s.notice && html`<div class="chip warn">${s.notice}</div>`}
    </div></div>`;
}

export function Setup() {
  const s = useStore(); const core = getCore(); const man = getManifest();
  const [scn, setScn] = useState(s.scenario || man.scenarios[0].id);
  const [doc, setDoc] = useState('architect'); const [as, setAs] = useState(1); const [seed, setSeed] = useState('');
  const sc = man.scenarios.find(x => x.id === scn);
  useEffect(() => { setPalette(sc.theme); }, [scn]);
  const unlocked = s.profile.unlocks.doctrines; const maxAs = s.profile.unlocks.assurance;
  const [org, setOrg] = useState(null);
  useEffect(() => { let live = true; fetch(`content/packs/${scn}.json?v=${man.version}`).then(r => r.json()).then(p => live && setOrg(p)); return () => { live = false; }; }, [scn]);
  const D = core.doctrines.doctrines;
  const start = async () => { unlock(); sfx.turn(); await app.startRun({ scenario: scn, doctrine: doc, assurance: as, seed: seed.trim() || undefined }); };
  return html`<div class="screen setup"><div class="row"><button class="btn ghost small" onClick=${() => app.goto('title')}><${Icon} n="chevron-right" cls="" style="transform:rotate(180deg)"/>Back</button><h2>New run</h2></div>
    <h3 class="dim">1 · Scenario — whose network are you defending?</h3>
    <div class="picker">${man.scenarios.map(x => html`<button class=${cx('pick', scn === x.id && 'on')} style=${`--c:${x.theme.accent}`} onClick=${() => { sfx.click(); setScn(x.id); }}><h3><span class="pk-ic"><${Icon} n=${x.icon}/></span>${x.name}</h3><p>${x.tagline}</p><p class="dimmer">${x.org || ''}</p></button>`)}</div>
    ${org && html`<div class="panel" style="padding:.9rem 1.1rem"><b>${org.org.name}</b> — ${org.org.sector}<p class="dim" style="margin:.4em 0">${org.org.brief}</p><div class="row wrap">${org.org.regimes.map(r => html`<span class="chip" title=${r.note}><${Icon} n="gavel"/>${r.name}</span>`)}</div></div>`}
    <h3 class="dim">2 · Doctrine — your playstyle and starting deck</h3>
    <div class="picker">${D.map(d => { const lock = !unlocked.includes(d.id); const ach = lock && core.achievements.achievements.find(a => a.id === d.unlock); return html`<button class=${cx('pick', doc === d.id && 'on')} style="--c:var(--accent2)" onClick=${() => !lock && (sfx.click(), setDoc(d.id))}><h3><span class="pk-ic"><${Icon} n=${d.icon}/></span>${d.name}</h3><p>${d.blurb}</p><p class="dimmer"><b>${d.power.name}</b>: ${d.power.text}</p><div class="deckmini">${d.deck.map(id => html`<i style=${`--fn:${FNCOL[id.startsWith('c.') ? id.split('.')[1] : ({ 'x.patch': 'protect', 'x.threathunt': 'detect', 'x.training': 'govern', 'x.soar': 'respond' }[id] || 'protect')]}`}/>`)}</div>${lock && html`<div class="lock"><div><${Icon} n="lock" cls="lg"/><br/>Locked<br/><small>${ach ? ach.desc : 'Earn an achievement'}</small></div></div>`}</button>`; })}</div>
    <h3 class="dim">3 · Assurance — maturity level of the adversaries</h3>
    <div class="picker">${core.tuning.assurance.map(a => html`<button class=${cx('pick', as === a.id && 'on')} style="--c:var(--warn)" onClick=${() => a.id <= maxAs && (sfx.click(), setAs(a.id))}><h3>${a.name}</h3><p>${a.note}</p>${a.id > maxAs && html`<div class="lock">Win a run at ML${a.id - 1} to unlock</div>`}</button>`)}</div>
    <div class="begin-bar"><input placeholder="Seed (optional — share it for the same run)" value=${seed} onInput=${e => setSeed(e.target.value)} style="flex:1;min-width:220px;padding:.7em 1em;border-radius:10px;border:1px solid var(--line2);background:rgba(0,0,0,.4);color:var(--ink);font-family:var(--font-mono)"/><button class="btn primary big" onClick=${start}><${Icon} n="rocket"/>Begin operation</button></div></div>`;
}

export function DailyScreen() {
  const s = useStore(); const [cfg, setCfg] = useState(null); const [board, setBoard] = useState(null);
  const man = getManifest(); const core = getCore();
  useEffect(() => { app.dailyRunConfig().then(c => { setCfg(c); import('./api.js').then(a => a.getBoard('daily:' + c.date).then(r => r.ok && setBoard(r.data))); }); }, []);
  if (!cfg) return html`<div class="screen"><p>Loading…</p></div>`;
  const sc = man.scenarios.find(x => x.id === cfg.scenario); const d = core.doctrines.doctrines.find(x => x.id === cfg.doctrine);
  const done = s.profile.daily.done?.[cfg.date];
  return html`<div class="screen result"><div class="row"><button class="btn ghost small" onClick=${() => app.goto('title')}>Back</button></div>
    <h1>Daily Challenge</h1><div class="tagline">${cfg.date} · Australia/Sydney</div>
    <div class="panel" style="padding:1.2rem;max-width:640px"><div class="row" style="justify-content:center;gap:1.2rem"><span class="pk-ic" style="width:60px;height:60px;display:grid;place-items:center"><${Icon} n=${sc.icon} cls="xl"/></span><div style="text-align:left"><h3>${sc.name}</h3><div class="dim">${d.name} · Assurance ML1</div><div class="dimmer mono">seed ${cfg.seed}</div></div></div>
      <p class="dim" style="margin-top:.8rem">Everyone plays the same seed. Your run is replayed on the server to verify the score. Keep your streak alive: 🔥 ${s.profile.daily.streak || 0} day${(s.profile.daily.streak || 0) === 1 ? '' : 's'}.</p>
      ${done != null && html`<p class="chip good">Completed today: ${done} pts</p>`}
      <button class="btn violet big" onClick=${() => app.startRun({ scenario: cfg.scenario, doctrine: cfg.doctrine, assurance: 1, seed: cfg.seed, daily: true })}><${Icon} n="flame"/>${done != null ? 'Play again' : 'Start daily'}</button></div>
    ${board?.entries?.length ? html`<div class="panel lb" style="padding:1rem"><h3>Today’s leaderboard</h3><table><tbody>${board.entries.map((e, i) => html`<tr class=${e.playerId === (JSON.parse(localStorage.getItem('adversary.player.v1') || '{}').id) ? 'me' : ''}><td>${i + 1}</td><td>${e.handle}</td><td class="right mono">${e.points}</td></tr>`)}</tbody></table></div>` : html`<p class="dimmer">Leaderboard unavailable offline (the game is fully playable without it).</p>`}</div>`;
}

export function TtxSelect() {
  const s = useStore(); const man = getManifest(); const [list, setList] = useState([]);
  useEffect(() => { Promise.all(man.scenarios.map(x => fetch(`content/packs/${x.id}.json?v=${man.version}`).then(r => r.json()))).then(ps => setList(ps.flatMap(p => (p.ttx || []).map(t => ({ ...t, scenario: p.id, scenarioName: p.name, theme: p.theme }))))); }, []);
  return html`<div class="screen setup"><div class="row"><button class="btn ghost small" onClick=${() => app.goto('title')}>Back</button><h2>Tabletop exercises</h2></div>
    <p class="dim" style="max-width:780px">Scripted incidents built from real MITRE campaigns. A clock runs, injects land, executives ask questions, and you make timed decisions while defending. Scored against objectives, not just survival.</p>
    <div class="picker">${list.length ? list.map(t => html`<button class="pick" style=${`--c:${t.theme.accent}`} onClick=${async () => { setPalette(t.theme); await app.startRun({ scenario: t.scenario, doctrine: 'responder', assurance: 1, mode: 'ttx', ttxId: t.id }); }}><h3><span class="pk-ic"><${Icon} n="clipboard-check"/></span>${t.name}</h3><p>${t.blurb}</p><p class="dimmer">${t.scenarioName} · ${t.rounds} rounds · ${t.injects.length} injects</p></button>`) : html`<p class="dimmer">No exercises yet.</p>`}</div></div>`;
}

export function Settings() {
  const s = useStore(); const st = s.settings; const set = app.saveSettings;
  return html`<div class="screen setup settings"><div class="row"><button class="btn ghost small" onClick=${() => app.goto(s.run ? 'run' : 'title')}>Back</button><h2>Settings</h2></div>
    <div class="panel" style="padding:1rem 1.2rem;max-width:640px">
      <label>Volume <input type="range" min="0" max="1" step=".05" value=${st.volume} onInput=${e => set({ volume: +e.target.value })}/><span>${Math.round(st.volume * 100)}%</span></label>
      <label><input type="checkbox" checked=${st.mute} onChange=${e => set({ mute: e.target.checked })}/> Mute</label>
      <label><input type="checkbox" checked=${st.crt} onChange=${e => set({ crt: e.target.checked })}/> CRT scanlines & vignette</label>
      <label><input type="checkbox" checked=${st.motion} onChange=${e => set({ motion: e.target.checked })}/> Animated background & effects</label>
      <label><input type="checkbox" checked=${st.shake} onChange=${e => set({ shake: e.target.checked })}/> Screen shake</label>
      <label><input type="checkbox" checked=${st.hints} onChange=${e => set({ hints: e.target.checked })}/> Show “suspicious activity” hints on assets</label>
      <label>Background quality <select value=${st.bg} onChange=${e => set({ bg: e.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
      <label>Leaderboard handle <input value=${st.handle || ''} placeholder="Defender-XXXX" maxlength="20" onChange=${e => { import('./api.js').then(a => a.setHandle(e.target.value)); set({ handle: e.target.value }); }} style="padding:.4em .7em;border-radius:8px;border:1px solid var(--line2);background:rgba(0,0,0,.4);color:var(--ink)"/></label>
      <p class="dimmer" style="font-size:.78rem">Progress is stored in your browser. If the backend is reachable, verified runs and your profile are also saved to the cloud under an anonymous player id — no email or personal data.</p>
      <div class="row"><button class="btn bad small" onClick=${() => { if (confirm('Erase all local progress?')) { localStorage.clear(); location.reload(); } }}>Erase local data</button></div>
    </div></div>`;
}
