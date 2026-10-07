import { html, Icon, useState, useEffect, useRef, useLayoutEffect, store, useStore, Refs, RefLink, cx } from './ui.js';
import * as app from './app.js';
import { sfx } from './audio.js';
import { confetti } from './fx.js';

// ───────────────────────── tutorial ─────────────────────────
const STEPS = [
  { id: 'welcome', modal: true, title: 'Welcome, defender', text: 'You are defending Harbourline Group, a fictional Australian advisory firm. Opposite you is a real adversary from MITRE ATT&CK, played by an AI that uses that group’s documented techniques. This 3-minute tutorial teaches the loop. Nothing here counts toward your profile except the achievements.', next: 'Show me' },
  { id: 'adv', anchor: '.hud-adv', pos: 'below', title: 'A real adversary', text: 'TA505 (ATT&CK G0092) is a financially motivated group known for mass phishing. Click the portrait any time for a dossier with procedure examples and links to primary sources. The EXPOSURE bar fills when you detect, evict or block it. Fill it and the operation is burned — you win early.', next: 'Next' },
  { id: 'intent', anchor: '.intent', pos: 'below', title: 'Intent', text: 'Its next move is telegraphed, but at fidelity 0 you only see the tactic: Initial Access. Intel (Identify cards, relics) reveals the technique, then the target. That is threat intelligence in game form.', next: 'Next' },
  { id: 'assets', anchor: '[data-asset="ws"]', pos: 'right', title: 'Assets and wards', text: 'Each tile is something you must defend. The bar is integrity; the gold gem marks crown jewels — lose one and the battle is over. The six boxes are wards by STRIDE category: S Spoofing, T Tampering, R Repudiation, I Information disclosure, D Denial of service, E Elevation of privilege. A technique must beat the ward for its category.', next: 'Next' },
  { id: 'mfa', anchor: '[data-card="c.protect.spoofing"]', pos: 'above', action: true, allow: ['d0'], title: 'Deploy a control', text: 'The intent says Initial Access is aimed at the Email Gateway. Click Phishing-Resistant MFA (cost 2), then click the Email Gateway. Controls are persistent: they sit on the asset and add a ward.', done: b => b.controls.some(k => k.card === 'c.protect.spoofing' && k.asset === 'mail') },
  { id: 'intel', anchor: '[data-card="c.identify.repudiation"]', pos: 'above', action: true, allow: ['d1'], title: 'Buy intel', text: 'You have 2 energy left. Play Log Source Inventory (cost 1): it draws a card and gives +2 intel this round. Click it, then click it again to play.', done: b => b.intel >= 2 },
  { id: 'intent2', anchor: '.intent', pos: 'below', title: 'Better fidelity', text: 'Now you can see the technique (T1566.001 Spearphishing Attachment) and its target. The adversary will re-plan if you block its first choice — real intrusions go where the wards are weakest.', next: 'Next' },
  { id: 'end', anchor: '.btn.good.big', pos: 'above', action: true, allowEnd: true, title: 'End your turn', text: 'Hand and energy reset each round, like Slay the Spire; your deployed controls stay. Press End turn (or E).', done: b => b.round >= 2 },
  { id: 'fog', modal: true, title: 'Nothing happened… or did it?', text: 'No alarm sounded. That is the point: the adversary may now hold a hidden foothold. Hidden footholds drain Resilience, spread, stage data and eventually strike. Monitors (Detect controls), hunts and intel reveal them — the longer an intruder dwells, the more noise they make (look for the “?” on an asset).', next: 'Hunt it' },
  { id: 'hunt', anchor: '[data-card="x.threathunt"]', pos: 'above', action: true, allow: ['d3'], title: 'Threat hunt', text: 'Play Threat Hunt (cost 2). Hunting is hypothesis-driven: it reveals hidden footholds anywhere, up to stealth 5.', done: b => b.footholds.some(f => f.revealed) },
  { id: 'evict', anchor: '[data-card="c.respond.spoofing"]', pos: 'above', action: true, allow: ['d4', 'd5'], title: 'Evict it', text: 'A revealed foothold appears as a red chip on its asset. Play Credential Revocation (cost 1), then click the foothold. Each Respond card removes grip; at 0 the foothold is gone and the adversary’s Exposure jumps.', done: b => b.footholds.length === 0 },
  { id: 'done', modal: true, title: 'Contained.', text: 'That is the loop: Identify and Protect to shape where the adversary can land, Detect to see it, Respond to remove it, Recover to repair. In a real run you will build a deck across three acts, face bosses like Volt Typhoon and APT29, and run threat-modelling workshops between fights. Open the Codex any time for adversary dossiers and control references.', next: 'Finish tutorial' }
];
export const tutAllows = (t, iid) => { const st = STEPS[t.i]; return !st || (st.allow ? st.allow.includes(iid) : false); };
export const tutAllowsEnd = (t) => !!STEPS[t.i]?.allowEnd;

export function Tutorial() {
  useEffect(() => { app.startTutorial(); }, []);
  return html`<div class="screen"><p>Loading tutorial…</p></div>`;
}

export function TutorialCoach() {
  const s = useStore(); const t = s.tutorial; const step = STEPS[t.i]; const b = s.run?.battle;
  const [rect, setRect] = useState(null); const ref = useRef();
  useEffect(() => { if (step?.done && b && step.done(b)) { sfx.coin(); setTimeout(() => store.set({ tutorial: { i: t.i + 1 } }), 450); } }, [s.run, t.i]);
  useLayoutEffect(() => {
    const upd = () => { if (!step?.anchor) return setRect(null); const el = document.querySelector(step.anchor); if (!el) return setRect(null); const r = el.getBoundingClientRect(); setRect({ x: r.left - 8, y: r.top - 8, w: r.width + 16, h: r.height + 16 }); };
    upd(); const iv = setInterval(upd, 250); addEventListener('resize', upd); return () => { clearInterval(iv); removeEventListener('resize', upd); };
  }, [t.i, s.run?.battle?.hand?.length, s.stage]);
  if (!step) return null;
  const next = () => { sfx.click(); if (step.id === 'done') { app.finishTutorial(); } else store.set({ tutorial: { i: t.i + 1 } }); };
  let style;
  if (step.modal || !rect) style = 'left:50%;top:50%;transform:translate(-50%,-50%);width:min(560px,92vw)';
  else if (step.action) style = 'right:14px;top:210px;width:290px';   // park over the side panel so it never covers the play area
  else {
    const W = 340; let x = rect.x, y;
    if (step.pos === 'below') y = rect.y + rect.h + 14; else if (step.pos === 'above') y = Math.max(8, rect.y - 210); else { x = rect.x + rect.w + 16; y = rect.y; }
    x = Math.max(8, Math.min(innerWidth - W - 8, x)); y = Math.max(8, Math.min(innerHeight - 220, y)); style = `left:${x}px;top:${y}px`;
  }
  return html`<div>${(step.modal || !step.action) && html`<div style="position:fixed;inset:0;z-index:780;background:rgba(2,4,10,${step.modal ? .7 : 0})"/>`}
    ${rect && !step.modal && html`<div class=${cx('spot', step.action && 'soft')} style=${`left:${rect.x}px;top:${rect.y}px;width:${rect.w}px;height:${rect.h}px`}/>`}
    <div class="coach" style=${style} ref=${ref}><div class="dimmer" style="font-size:.7rem;letter-spacing:.2em;font-family:var(--font-display)">TUTORIAL · ${t.i + 1}/${STEPS.length}</div><h4>${step.title}</h4><p>${step.text}</p>
      <div class="row">${step.next ? html`<button class="btn primary small" onClick=${next}>${step.next}</button>` : html`<span class="chip">Do this to continue</span>`}<span class="spacer"/><button class="btn ghost small" onClick=${() => app.finishTutorial(true)}>Skip tutorial</button></div></div></div>`;
}

// ───────────────────────── guide ─────────────────────────
const SECTIONS = [
  ['goal', 'The goal', () => html`<p>You defend a fictional organisation from a <b>real adversary from MITRE ATT&CK</b> (APT29, Volt Typhoon, Sandworm, FIN7, Scattered Spider…). Each battle lasts a handful of rounds. <b>You win</b> by surviving the operation window with every crown-jewel asset standing, or earlier by filling the adversary’s <b>Exposure</b> bar through detection, eviction and blocked attacks. <b>You lose</b> if a crown jewel is destroyed or your Resilience hits zero.</p><p>A run is three acts of battles, events, shops, rest sites and threat-modelling workshops, ending in an apex adversary. Your deck, relics and Resilience carry over.</p>`],
  ['turn', 'A turn', () => html`<p>Each round you draw 5 cards and get 3 energy (hand and energy reset; <b>deployed controls stay</b>). Play cards, then End turn: the adversary acts. Its next move is <b>telegraphed</b> as an intent whose clarity depends on your intel.</p><p>Hotkeys: <span class="kbd">1-9</span> select a card, click again or <span class="kbd">Enter</span> to play, <span class="kbd">E</span> end turn, <span class="kbd">Esc</span> cancel, right-click to inspect.</p>`],
  ['assets', 'Assets, wards & STRIDE', () => html`<p>Assets are what you defend. Every adversary technique carries a STRIDE class (a gameplay heuristic — ATT&CK has no official mapping). To succeed it must beat the asset’s <b>ward</b> in that category. Wards come from your controls, policies, shields and — importantly — <b>real ATT&CK mitigation matches</b>: if your control implements a mitigation that ATT&CK lists for that technique you get +1, and specific augments (FIDO2 vs MFA fatigue, Credential Guard vs LSASS dumping, air-gapped vaults vs recovery inhibition) give +3. The log tells you exactly why an attack was blocked.</p><${Refs} list=${['stride:overview', 'attack:M1032', 'attack:T1621', 'owasp:threat-modeling-manifesto']}/>`],
  ['cards', 'Cards: the 6×6 matrix', () => html`<p>Your 36 core controls are the cells of <b>NIST CSF 2.0 function × STRIDE property</b>: e.g. <i>Detect × Spoofing</i> = identity threat detection; <i>Recover × Availability</i> = immutable backups. The function decides what the card <i>does</i> (Govern = policies, Identify = intel, Protect = wards, Detect = monitors, Respond = eviction, Recover = repair); the property decides which attacks it counters. <b>Augments</b> attach to a deployed control to upgrade it (MFA → FIDO2 passkeys, encryption → post-quantum hybrid crypto). <b>Policies</b> are persistent global effects (two slots).</p><${Refs} list=${['nist-csf:overview', 'e8:maturity-model', 'nist:fips-203']}/>`],
  ['fog', 'Fog of war: footholds & detection', () => html`<p>Successful intrusions create <b>hidden footholds</b>. You do not see them until a monitor, scan or hunt reveals them (detection strength must meet the foothold’s stealth). Hidden footholds spread, escalate, stage data, beacon, disable controls and eventually strike. Long-dwelling footholds make noise: after two rounds a “?” appears on the asset. Revealed footholds can be evicted by Respond cards (each reduces grip). Persistent footholds come back once unless purged.</p>`],
  ['run', 'The run', () => html`<p>Map nodes: <b>Skirmish</b> (normal), <b>Intrusion set</b> (elite, better rewards), <b>Apex adversary</b> (boss), <b>Procurement</b> (shop), <b>Rest & training</b> (heal or raise a card’s maturity level ML1→ML3), <b>Events</b> (security decisions with trade-offs) and <b>Threat-modelling workshops</b>. After each battle you get a <b>debrief</b> of what the adversary actually did with links to ATT&CK, then choose a card to add. A lean, specialised deck beats a bloated one — you can Decommission cards. <b>Technical Debt</b> is the junk you accept when you defer work.</p>`],
  ['wb', 'Threat-modelling workshops', () => html`<p>You are shown a data-flow diagram of the system and an observation about one element or flow. Pick the STRIDE category. Correct answers earn budget, a ward bonus for your next battle, and learning: each answer explains <i>why</i>, with references. This is STRIDE-per-element, the same exercise you would run with a real team.</p><${Refs} list=${['owasp:threat-dragon', 'owasp:threat-modeling-manifesto', 'stride:overview']}/>`],
  ['ttx', 'Tabletop exercises', () => html`<p>Scripted incidents built from real MITRE campaigns. A clock runs, injects land — a journalist calls, the regulator asks a question, the vendor wants you to stay quiet — and you make timed decisions while defending. You are scored against objectives (detect by T+24h, keep the crown jewels, make best-practice calls), not just survival.</p>`],
  ['ach', 'Achievements, codex & clearance', () => html`<p>${'Over 100 achievements (about 20 hidden) award XP toward your clearance level and unlock doctrines. The Codex tracks every adversary, control and relic you meet — and links to dossiers with procedure examples, documented observables and primary sources (CISA, vendor reports).'}</p>`],
  ['sources', 'Sources, IoCs & licensing', () => html`<p>Adversary data is compiled from <b>MITRE ATT&CK®</b> (Enterprise and ICS) under the ATT&CK Terms of Use. ATT&CK does not ship indicator feeds, so the game shows <i>documented observables</i> — file names and command lines quoted in MITRE’s procedure examples, with the technique they accompany — and links to the primary advisories. It deliberately omits IP addresses, domains and hashes: they rot quickly and can be live infrastructure. Build detections on behaviour. Card numbers are fictional.</p><${Refs} list=${['attack:TA0001', 'd3fend:Multi-factorAuthentication', 'owasp-top10:A01', 'owasp-llm:LLM01', 'nist-csf:overview']}/>`]
];
export function Docs() {
  const [open, setOpen] = useState('goal');
  useEffect(() => { app.emitUi({ t: 'docs_open' }); }, []);
  return html`<div class="screen setup"><div class="row"><button class="btn ghost small" onClick=${() => app.goto(store.get().run ? 'run' : 'title')}>Back</button><h2>Guide</h2><span class="spacer"/><button class="btn primary small" onClick=${() => app.goto('tutorial')}><${Icon} n="graduation-cap"/>Play the tutorial</button></div>
    <div class="grid" style="grid-template-columns:220px 1fr;align-items:start"><div class="col panel" style="padding:.6rem;position:sticky;top:0">${SECTIONS.map(([id, t]) => html`<button class=${cx('tab', open === id && 'on')} onClick=${() => setOpen(id)} style="text-align:left">${t}</button>`)}</div>
    <div class="panel debrief" style="max-width:900px;margin:0">${SECTIONS.filter(([id]) => id === open).map(([id, t, f]) => html`<h3>${t}</h3>${f()}`)}</div></div></div>`;
}
