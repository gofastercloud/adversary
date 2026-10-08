import { html, Icon, useState, useEffect, useRef, useLayoutEffect, useMemo, cx, store, useStore, tip, Refs, RefLink, Modal, Sigil, clock, pct, sleep, hideTip } from './ui.js';
import * as app from './app.js';
import { Card, CardTip, AssetTile, FNCOL, cardIcon } from './components.js';
import { logLine, whySummary } from './eventlog.js';
import * as B from '../../engine/battle.js';
import { describeCard } from '../../engine/describe.js';
import { sfx } from './audio.js';
import { burst, glyphBurst, ripple, glitchScreen, flyClone, accessBanner, bossEntrance, floater, stamp, banner, shake, flash, combo, centerOf, assetEl, confetti, motionOK } from './fx.js';
import { flashBg } from './bg.js';
import { tutAllows, tutAllowsEnd } from './docs.js';
import { Count, Decrypt } from './term.js';

const TACTIC_ICON = { 'reconnaissance': 'search', 'resource-development': 'package', 'initial-access': 'door-open', 'execution': 'terminal', 'persistence': 'anchor', 'privilege-escalation': 'trending-up', 'stealth': 'ghost', 'defense-evasion': 'ghost', 'defense-impairment': 'shield-off', 'credential-access': 'key-round', 'discovery': 'radar', 'lateral-movement': 'route', 'collection': 'archive', 'command-and-control': 'radio-tower', 'exfiltration': 'upload', 'impact': 'bomb', 'inhibit-response-function': 'siren', 'impair-process-control': 'factory' };
const tname = (content, t) => content.tactics[t]?.name || t;

function groupPlays(events) {
  const plays = []; let cur = null;
  for (const e of events) {
    if (e.t === 'adv_play') { cur = { play: e, evs: [] }; plays.push(cur); } else if (cur && !['round', 'draw', 'reshuffle', 'reveal'].includes(e.t)) cur.evs.push(e);
  }
  return plays.map(p => {
    const bl = p.evs.find(e => e.t === 'blocked');
    const visible = p.evs.some(e => ['damage', 'exfil', 'asset_down', 'disabled', 'canary'].includes(e.t));
    return { ...p, outcome: bl ? 'blocked' : visible ? 'landed' : 'unseen', why: bl?.why, ward: bl?.ward };
  });
}

export function BattleScreen() {
  const s = useStore(); const { content, run } = s; const b = run.battle;
  const [sel, setSel] = useState(null);            // {iid} | {power:true}
  const [log, setLog] = useState([]);
  const [hit, setHit] = useState({});
  const [preview, setPreview] = useState(null);
  const [sideOpen, setSideOpen] = useState(false);
  const [inspect, setInspect] = useState(null);
  const fieldRef = useRef(); const [links, setLinks] = useState([]);
  const adv = content.adversaryMeta[b.adv.id] || {}; const advData = content.adversaries[b.adv.id];
  const hold = s.holdBattle; const stage = s.stage;
  const dragRef = useRef(null);

  // ── log
  const addLog = (evs, bb = b) => setLog(l => [...l, ...evs.map(e => logLine(content, bb, e)).filter(Boolean)].slice(-80));
  useEffect(() => { if (b.round === 1 && !log.length) addLog([{ t: 'round', n: 1 }]); }, []);
  useEffect(() => { const t = run.node?.type; if (b.round !== 1 || (t !== 'boss' && t !== 'elite')) return; const id = setTimeout(() => { bossEntrance(b.adv.name.toUpperCase(), t === 'boss' ? 'APEX ADVERSARY DETECTED' : 'ELITE INTRUSION SET'); sfx.stinger(); }, 450); return () => clearTimeout(id); }, []);
  const logRef = useRef(); useEffect(() => { if (logRef.current) logRef.current.scrollTop = 1e9; }, [log]);

  // ── adjacency links + scale-to-fit (the battlefield always fits its panel, whatever the scenario)
  const innerRef = useRef(); const [fit, setFit] = useState(1);
  useLayoutEffect(() => {
    const calc = () => {
      const box = fieldRef.current, inner = innerRef.current; if (!box || !inner) return;
      const k = Math.min(1.18, (box.clientWidth - 12) / inner.offsetWidth, (box.clientHeight - 12) / inner.offsetHeight);
      setFit(k);
      const ir = inner.getBoundingClientRect(); const pos = {};
      inner.querySelectorAll('[data-asset]').forEach(el => { const r = el.getBoundingClientRect(); pos[el.dataset.asset] = { x: (r.left - ir.left + r.width / 2) / (ir.width / inner.offsetWidth), y: (r.top - ir.top + r.height / 2) / (ir.height / inner.offsetHeight) }; });
      const ls = []; const seen = new Set();
      for (const a of b.assets) for (const n of a.adjacent) { const key = [a.id, n].sort().join('|'); if (seen.has(key) || !pos[a.id] || !pos[n]) continue; seen.add(key); ls.push({ a: pos[a.id], b: pos[n], k: key }); }
      setLinks(ls);
    };
    calc(); const ro = new ResizeObserver(calc); if (fieldRef.current) ro.observe(fieldRef.current); if (innerRef.current) ro.observe(innerRef.current); addEventListener('resize', calc);
    const t = setTimeout(calc, 120); return () => { ro.disconnect(); removeEventListener('resize', calc); clearTimeout(t); };
  }, [b.assets.length, b.round, b.footholds.length]);

  // ── post-commit effects (floaters, stamps, sounds) for events from the player's own actions / resolved adversary turn
  const present = async (events, prev) => {
    await sleep(60);
    let evictCount = 0;
    for (const e of events) {
      const at = e.asset ? centerOf(assetEl(e.asset)) : { x: innerWidth / 2, y: innerHeight / 2 };
      switch (e.t) {
        case 'reveal': stamp('DETECTED', at.x, at.y - 10, '#3ad6ff'); ripple(at.x, at.y, { color: '#3ad6ff', size: 170 }); burst(at.x, at.y, { colors: ['#3ad6ff', '#fff'], n: 14 }); sfx.reveal(); break;
        case 'evict': evictCount++; stamp(e.quick ? 'EVICTED!' : 'EVICTED', at.x, at.y, '#4ade80'); glyphBurst(at.x, at.y, { colors: ['#39ff88', '#d6ffe4', '#fff'], n: 44, speed: 420 }); ripple(at.x, at.y, { color: '#39ff88', size: 220, ms: 800 }); sfx.evict(); shake(); if (e.quick) combo('QUICK RESPONSE', 'kill chain broken'); break;
        case 'deploy': case 'augment': ripple(at.x, at.y, { color: '#00ff9c', size: 190, square: true }); burst(at.x, at.y, { colors: ['#00ff9c', '#fff'], n: 14, speed: 160, shape: 'circle' }); sfx.deploy(); break;
        case 'blocked': floater('BLOCKED', at.x, at.y - 30, '#39ff88'); ripple(at.x, at.y, { color: '#39ff88', size: 200, ms: 650, square: true }); ripple(at.x, at.y, { color: '#d6ffe8', size: 120, ms: 500, square: true }); burst(at.x, at.y, { colors: ['#39ff88', '#fff'], n: 12, speed: 200 }); sfx.block(); break;
        case 'damage': floater('−' + e.n, at.x, at.y - 20, '#ff5470'); setHit(h => ({ ...h, [e.asset]: Date.now() })); sfx.hit(); shake(); flashBg(0.6); break;
        case 'asset_down': stamp('DOWN', at.x, at.y, '#ff5470'); shake(true); glitchScreen(700); sfx.big(); flash('#ff2e4e'); break;
        case 'exfil': floater('DATA LOST −' + e.n, at.x, at.y - 10, '#ffb02e'); sfx.hit(); break;
        case 'heal': if (e.n > 0) { floater('+' + e.n, at.x, at.y - 10, '#7dff9b'); sfx.coin(); } break;
        case 'isolate': stamp('ISOLATED', at.x, at.y, '#7be0ff'); sfx.deploy(); break;
        case 'canary': stamp('CANARY!', at.x, at.y, '#ffd23d'); sfx.secret?.(); burst(at.x, at.y, { colors: ['#ffd23d', '#fff'], n: 30 }); break;
        case 'aegis': case 'revive': stamp('REVIVED', at.x, at.y, '#b58cff'); confetti(40); sfx.win(); break;
        case 'disabled': floater('DISABLED', at.x, at.y - 20, '#ff9f43'); sfx.error(); break;
        case 'phase': banner('PHASE SHIFT', e.name, '#ff2e6e', 1800); sfx.stinger(); shake(true); break;
        case 'inject': banner('INJECT', e.title, '#f5c542', 1800); sfx.stinger(); break;
        case 'res': if (e.n < 0) { const hp = document.getElementById('res-bar'); const p = centerOf(hp); floater(String(e.n), p.x, p.y + 20, '#ff5470'); } break;
        default: break;
      }
      await sleep(40);
    }
  };

  const logEvents = (events, bb) => addLog(events.filter(e => e.from === 'battle' || true).map(({ from, ...e }) => e), bb);

  const doAction = async (action) => {
    if (s.tutorial && action.type === 'END_TURN' && !tutAllowsEnd(s.tutorial)) { floater('Follow the coach', innerWidth / 2, 160, '#5ad1ff'); return; }
    if (s.tutorial && action.type === 'FORFEIT') return;
    const full = { type: 'BATTLE', action };
    const r = app.step(full); if (!r.ok) { floater(r.error, innerWidth / 2, 120, '#ff9aad'); return; }
    const evs = r.events.filter(e => e.from === 'battle');
    if (action.type === 'PLAY') flyPlayed(action);
    if (action.type === 'END_TURN') {
      const plays = groupPlays(evs);
      setSel(null); sfx.turn(); flyHandOut();
      store.set({ stage: { plays, i: -1, intro: true } });
      await sleep(550);
      for (let i = 0; i < plays.length; i++) { store.set({ stage: { plays, i } }); sfx.adv(); await sleep(plays[i].outcome === 'unseen' ? 650 : 1050); }
      store.set({ stage: null });
    }
    app.commit(r, full);
    document.querySelectorAll('.hand .card').forEach(el => { el.style.visibility = ''; });
    logEvents(evs, r.run.battle);
    present(evs, b);
    if (r.run.battle.over) endOfBattle(r.run.battle);
    else if (action.type !== 'END_TURN') sfx.card();
  };
  // card flourishes: the played card flies to its target and dissolves; the hand is swept to the deck at end of turn
  const targetPoint = (t = {}) => {
    const asset = t.asset || b.footholds.find(f => f.id === t.fid)?.asset || b.controls.find(k => k.kid === t.kid)?.asset;
    return asset ? centerOf(assetEl(asset)) : { x: innerWidth / 2, y: innerHeight * 0.38 };
  };
  const flyPlayed = (action) => {
    if (!motionOK()) return; const el = document.querySelector(`.hand .card[data-iid="${action.iid}"]`); if (!el) return;
    const to = targetPoint(action.target); const d = content.cards[b.cards[action.iid].id];
    flyClone(el, to, { ms: 440, scale: .35, rot: 10 }).then(() => { if (d.type === 'action') glyphBurst(to.x, to.y, { n: 18, colors: ['#ffd23d', '#fff'], speed: 260 }); });
  };
  const flyHandOut = () => {
    if (!motionOK()) return; const pile = document.querySelector('.pile .stack'); const to = pile ? centerOf(pile) : { x: 60, y: innerHeight - 100 };
    document.querySelectorAll('.hand .card').forEach((el, i) => { flyClone(el, to, { ms: 380, scale: .22, rot: -14, delay: i * 45 }); el.style.visibility = 'hidden'; });
  };
  const endOfBattle = (nb) => {
    store.set({ holdBattle: true });
    const res = nb.result;
    if (res.won) { accessBanner(false, res.how === 'evicted' ? 'Adversary evicted: exposure maxed, the operation is burned' : 'Operation contained: the window closed with your crown jewels intact'); sfx.win(); confetti(120); flashBg(1); }
    else { accessBanner(true, res.how === 'goal' ? `Breach. The adversary achieved its goal: ${content.tuning.goals[b.goal?.kind]?.name || ''}` : res.how === 'jewel' ? 'Breach. A crown jewel was lost' : res.how === 'resilience' ? 'Breach. Resilience exhausted' : 'Operation abandoned'); sfx.lose(); shake(true); flashBg(1); }
  };

  // ── targeting
  const iid = sel?.iid; const card = iid ? content.cards[b.cards[iid].id] : null; const eff = iid ? B.effCard(content, b, iid) : null;
  const power = sel?.power ? content.doctrines[b.doctrine].power : null;
  const tk = power ? power.target : eff?.target || 'none';
  const targets = useMemo(() => { if (!sel) return null; if (power) return power.target === 'asset' ? b.assets.map(a => ({ asset: a.id })) : [{}]; return B.validTargets(content, b, iid); }, [sel, b.round, b.hand.length, b.controls.length, b.energy.cur]);
  const tAssets = new Set((targets || []).filter(t => t.asset).map(t => t.asset)); const tFids = new Set((targets || []).filter(t => t.fid).map(t => t.fid)); const tKids = new Set((targets || []).filter(t => t.kid).map(t => t.kid));
  const confirm = (target) => { if (power) { setSel(null); doAction({ type: 'POWER', target }); } else { const id = iid; setSel(null); doAction({ type: 'PLAY', iid: id, target }); } };
  const clickCard = (id) => {
    if (b.over || s.stage || b.ttx?.pending) return;
    if (s.tutorial && !tutAllows(s.tutorial, id)) { floater('Follow the coach', innerWidth / 2, innerHeight - 260, '#5ad1ff'); return; }
    const c = B.effCard(content, b, id); const cost = B.cardCost(content, b, id);
    if (c.unplayable || c.type === 'status') { floater('Unplayable', innerWidth / 2, innerHeight - 260, '#ffb02e'); sfx.error(); return; }
    if (cost > b.energy.cur) { floater('Not enough energy', innerWidth / 2, innerHeight - 260, '#ffb02e'); sfx.error(); return; }
    if (sel?.iid === id) { if ((c.target || 'none') === 'none') confirm({}); else setSel(null); return; }
    sfx.click(); setSel({ iid: id });
  };
  useEffect(() => {
    const f = (e) => { if (e.target.tagName === 'INPUT') return; if (e.key === 'Escape') setSel(null); if ((e.key === 'e' || e.key === 'E') && !s.stage && !b.over && !b.ttx?.pending) doAction({ type: 'END_TURN' }); if (/^[1-9]$/.test(e.key)) { const id = b.hand[+e.key - 1]; if (id) clickCard(id); } if (e.key === 'Enter' && sel?.iid && tk === 'none') confirm({}); };
    addEventListener('keydown', f); return () => removeEventListener('keydown', f);
  });
  const playable = b.hand.filter(id => { const c = B.effCard(content, b, id); return !c.unplayable && c.type !== 'status' && B.cardCost(content, b, id) <= b.energy.cur && B.validTargets(content, b, id).length; });
  const noMoves = playable.length === 0;
  const intent = B.intentView(content, b);

  // ── view
  const zones = []; for (const a of b.assets) { let z = zones.find(z => z.name === a.zone); if (!z) zones.push(z = { name: a.zone, assets: [] }); z.assets.push(a); }
  const resP = pct(b.res.cur, b.res.max), exP = pct(b.expo.cur, b.expo.max);
  const advc = adv.color || '#ff5470';
  const n = b.hand.length;
  const intentAsset = intent?.asset;
  const dossier = () => store.set({ modal: { type: 'dossier', id: b.adv.id } });
  const hint = s.settings.hints;
  const playedStage = stage && stage.i >= 0 ? stage.plays[stage.i] : null;

  return html`<div class="battle" style=${`--advc:${advc}`}>
    <div class="hud">
      <div class="panel hud-me">
        <div class="hud-row"><span class="lbl">Resilience</span><div id="res-bar" class=${cx('meter res', resP < 30 ? 'low' : resP < 60 ? 'mid' : '')}><i style=${`width:${resP}%`}/><b>${b.res.cur} / ${b.res.max}</b></div></div>
        <div class="hud-row"><span class="lbl">Budget</span><span class="money">$${run.money}</span><span class="spacer"/><button class="btn small ghost side-toggle" onClick=${() => setSideOpen(o => !o)} aria-expanded=${sideOpen}><${Icon} n="terminal"/>Intel</button><span class="chip" ...${tip('Gold earns only between battles: rewards, events, shops.')}><${Icon} n="coins"/>${run.relics.length} relics</span></div>
        <div class="hud-row"><span class="lbl">Clock</span><span class="clock">${clock(b.round)}</span><span class="spacer"/><div class="round-pips">${Array.from({ length: content.tuning.adversary.tiers[b.adv.tier].rounds }, (_, i) => html`<i class=${i + 1 < b.round ? 'done' : i + 1 === b.round ? 'now' : ''}/>`)}</div></div>
      </div>
      <div class="panel hud-adv glow" style=${`--accent:${advc}`}>
        <div style="cursor:pointer" onClick=${dossier} ...${tip('Click to open the adversary dossier')}><${Sigil} id=${b.adv.id} color=${advc} icon=${adv.icon || 'hood'}/></div>
        <div style="flex:1;min-width:0"><div class="row"><span class=${'tier-badge t' + b.adv.tier}>${content.tuning.adversary.tiers[b.adv.tier].name}</span><span class="dimmer mono" style="font-size:.72rem">${b.adv.id}</span><span class="spacer"/><span class="chip"><${Icon} n="zap"/>${b.adv.hand.length} cards</span></div>
          <div class="nm">${b.adv.name}</div><div class="sub">${adv.role || ''} · ${adv.motive || ''}</div>
          <div class=${cx('meter expo seg')} style="--seg:${100 / b.expo.max}%"><i style=${`width:${exP}%`}/><b>EXPOSURE ${b.expo.cur} / ${b.expo.max}</b></div>
          <div class="traits">${b.adv.traits.filter(t => t.name).map(t => html`<span class="trait" ...${tip(html`<div style="width:280px"><h4>${t.name}</h4><p>${t.text}</p>${t.note ? html`<p class="dim">${t.note}</p>` : null}</div>`)}>${t.name}</span>`)}</div></div>
      </div>
      <div class="panel hud-me">
        ${b.goal && html`<${GoalMeter} b=${b} content=${content}/>`}
        <div class=${cx('intent', intent?.level < 1 && 'hidden-intent')}>
          <${Icon} n=${TACTIC_ICON[intent?.tactic] || 'circle-help'} cls="lg"/>
          <div><div class="iv">${intent ? (intent.level >= 1 ? `${intent.tech} ${intent.name}` : tname(content, intent.tactic)) : 'No move planned'}</div>
          <small>${intent ? `${tname(content, intent.tactic)}${intent.level >= 2 && intent.asset ? ' → ' + b.assets.find(a => a.id === intent.asset)?.name : ''}${intent.level >= 3 ? ` · ${intent.stride} · power ${intent.power}` : ''}${intent.origin === 'baseline' ? ' · baseline tradecraft' : intent.origin === 'signature' ? ' · signature' : intent.origin === 'assessed' ? ' · assessed intent' : ''}` : ''}</small></div>
          <span class="spacer"/><div class="fid" ...${tip('Intel level: how much of the adversary’s next move you can see. Identify cards, relics and Assume Breach raise it.')}>${[1, 2, 3].map(i => html`<i class=${i <= (intent?.level || 0) ? 'on' : ''}/>`)}</div></div>
        <div class="row"><span class="dimmer" style="font-size:.74rem">${b.ttx ? 'TTX · score ' + b.ttx.score : (intent?.level >= 1 ? 'Intent' : 'Intent (fidelity 0)')}</span><span class="spacer"/>${b.ttx?.pending ? '' : html`<button class="btn small ghost" aria-label="Settings" onClick=${() => app.goto('settings')}><${Icon} n="settings"/></button><button class="btn small bad" onClick=${() => { if (confirm('Abandon this operation? The run ends.')) doAction({ type: 'FORFEIT' }); }}>Abandon</button>`}</div>
      </div>
    </div>

    <div class="field-wrap">
      <div class="field panel" ref=${fieldRef}>
        ${sel && html`<div class="target-banner">${power ? power.name : card.name}: ${tk === 'asset' ? 'choose an asset' : tk === 'foothold' ? 'choose a revealed foothold' : tk === 'control' ? 'choose a control to augment' : 'click the card again (or press Enter) to play'} <span class="kbd">Esc</span></div>`}
        <div class="field-inner" ref=${innerRef} style=${`transform:scale(${fit})`}>
        <svg class="links">${links.map(l => html`<line x1=${l.a.x} y1=${l.a.y} x2=${l.b.x} y2=${l.b.y} class=${l.hot ? 'hot' : ''}/>`)}</svg>
        ${zones.map(z => html`<div class=${cx('zone', z.assets.length > 3 && 'two')}><h5>${z.name}</h5>${z.assets.map(a => html`<${AssetTile} a=${a} b=${b} content=${content} showHints=${hint} hit=${hit[a.id] && Date.now() - hit[a.id] < 600} targetable=${tAssets.has(a.id) && tk === 'asset'} untargetable=${sel && tk === 'asset' && !tAssets.has(a.id)} intent=${intentAsset === a.id && intent?.level >= 2} onClick=${() => confirm({ asset: a.id })} targetFids=${tk === 'foothold' ? tFids : null} onFh=${(f) => tk === 'foothold' && tFids.has(f.id) && confirm({ fid: f.id })}/>`)}</div>`)}
        </div>
        ${tk === 'control' && html`<div style="position:absolute;bottom:8px;left:50%;transform:translateX(-50%);display:flex;gap:.5rem;z-index:30" class="panel"><span class="dim" style="padding:.4em .8em">Augment which control?</span>${b.controls.filter(k => tKids.has(k.kid)).map(k => html`<button class="btn small" onClick=${() => confirm({ kid: k.kid })}>${content.cards[k.card].name} @ ${b.assets.find(a => a.id === k.asset).name}</button>`)}${!tKids.size && html`<span class="bad" style="padding:.4em .8em">No compatible control deployed.</span>`}</div>`}
      </div>
      <div class=${cx('side', sideOpen && 'open')}>
        <div class="panel"><div class="panel-h"><${Icon} n="scroll-text"/>Programme (${b.policies.length}/${content.tuning.battle.policySlots})</div><div class="prog">${b.policies.map(p => { const d = content.cards[p.id]; return html`<span class="pol" style=${`--fn:${FNCOL[d.fn]}`} ...${tip(html`<${CardTip} content=${content} def=${d} ml=${p.ml}/>`)}><${Icon} n=${cardIcon(d)}/>${d.name}</span>`; })}${!b.policies.length && html`<span class="dimmer" style="font-size:.78rem">Policies you enact stay in force.</span>`}</div></div>
        <div class="panel"><div class="panel-h"><${Icon} n="gem"/>Relics</div><div class="relics">${run.relics.map(id => { const r = content.relics[id]; return html`<span class="relic" ...${tip(html`<div style="width:260px"><h4>${r.name}</h4><p>${r.desc}</p><p class="dim">${r.lesson}</p><${Refs} list=${r.refs}/></div>`)}><${Icon} n=${r.icon}/></span>`; })}</div></div>
        <div class="panel" style="flex:1;min-height:0;display:flex;flex-direction:column"><div class="panel-h"><${Icon} n="terminal"/>SOC feed</div><div class="log" ref=${logRef}>${log.map(l => html`<div class=${l.cls}><span class="t">${l.t}</span>${l.text} ${(l.refs || []).slice(0, 1).map(r => html`<${RefLink} r=${r} label="↗"/>`)}</div>`)}</div></div>
      </div>
    </div>

    ${preview && b.cards[preview] && html`<div class="card-preview" aria-hidden="true"><${Card} content=${content} def=${content.cards[b.cards[preview].id]} ml=${b.cards[preview].ml} cost=${B.cardCost(content, b, preview)} tiltOn=${false} cls="big-preview"/></div>`}
    <div class="bottom">
      <div class="pile" ...${tip('Draw pile · cards left before your discard is reshuffled')}>Deck<div class="stack"><i/><b>${b.draw.length}</b></div><span class="dimmer">${b.discard.length} discard</span></div>
      <div class="hand" tabindex="0" role="group" aria-label="Your hand">${b.hand.map((id, i) => { const d = content.cards[b.cards[id].id]; const c = B.cardCost(content, b, id); const base = B.effCard(content, b, id).cost; const ok = !d.unplayable && c <= b.energy.cur; const rot = (i - (n - 1) / 2) * Math.min(4, 22 / Math.max(n, 1)); const lift = Math.abs(i - (n - 1) / 2) ** 2 * 1.6; return html`<${Card} key=${id} content=${content} def=${d} ml=${b.cards[id].ml} cost=${c} discounted=${c < base} playable=${ok} unaffordable=${!ok} selected=${sel?.iid === id} onClick=${() => clickCard(id)} onContext=${(e) => { e.preventDefault(); setInspect(id); }} onEnter=${() => setPreview(id)} onLeaveCb=${() => setPreview(p => (p === id ? null : p))} cls="deal" i=${i} iid=${id} style=${{ '--rot': rot + 'deg', '--lift': lift + 'px' }}/>`; })}</div>
      <div class="energy-wrap"><div class=${cx('energy', b.energy.cur === 0 && 'empty')} ...${tip('Energy: spent to play cards. Resets each round.')}>${b.energy.cur}<small>/ ${b.energy.max}</small></div>
        ${b.doctrine && html`<div class="power"><button ...${tip(content.doctrines[b.doctrine].power.text)} class=${cx('btn small violet', sel?.power && 'pulse')} disabled=${b.powerUsed || b.energy.cur < content.doctrines[b.doctrine].power.cost || !!s.stage} onClick=${() => { if (sel?.power) setSel(null); else { const p = content.doctrines[b.doctrine].power; if (p.target === 'none') doAction({ type: 'POWER', target: {} }); else setSel({ power: true }); } }}><${Icon} n=${content.doctrines[b.doctrine].icon}/>${content.doctrines[b.doctrine].power.name} · ${content.doctrines[b.doctrine].power.cost}</button></div>`}
        <button class=${cx('btn good big', noMoves && !s.stage && 'pulse')} disabled=${!!s.stage || b.over || !!b.ttx?.pending} onClick=${() => doAction({ type: 'END_TURN' })}>End turn <span class="kbd">E</span></button></div>
    </div>

    ${stage && html`<div class="adv-stage">${playedStage ? html`<${AdvPlay} key=${stage.i} p=${playedStage} content=${content} b=${b} advc=${advc} intel=${b.intel}/>` : html`<div class="adv-play"><div class="kicker">${b.adv.name.toUpperCase()}</div><h3>is acting…</h3></div>`}</div>`}
    ${b.ttx?.pending && !b.over && html`<${DecisionModal} d=${b.ttx.pending} content=${content} onChoose=${(c) => doAction({ type: 'DECIDE', choice: c })} b=${b}/>`}
    ${hold && b.over && html`<${BattleEnd} b=${b} content=${content} run=${run}/>`}
    ${inspect && html`<${Modal} onClose=${() => setInspect(null)}><div class="row" style="gap:2rem;align-items:flex-start"><${Card} content=${content} def=${content.cards[b.cards[inspect].id]} ml=${b.cards[inspect].ml} cls="big" tiltOn=${false}/><div><${CardTip} content=${content} def=${content.cards[b.cards[inspect].id]} ml=${b.cards[inspect].ml}/></div></div><//>`}
  </div>`;
}

function AdvPlay({ p, content, b, advc, intel }) {
  const e = p.play; const known = p.outcome !== 'unseen' || intel >= 1;
  const t = content.techs[e.tech];
  return html`<div class="adv-play" style=${`--advc:${advc}`}>
    <div class="kicker">${b.adv.name.toUpperCase()} · ${known ? (content.tactics[e.tactic]?.name || e.tactic) : 'UNKNOWN ACTIVITY'}</div>
    <h3>${known ? e.name : '???'}</h3><div class="tid">${known ? e.tech : ''} ${known && e.asset ? '→ ' + (b.assets.find(a => a.id === e.asset)?.name || '') : ''}</div>
    <div class=${cx('out', p.outcome)}>${p.outcome === 'blocked' ? 'BLOCKED' : p.outcome === 'landed' ? 'IT LANDS' : 'NO ALERT RAISED'}</div>
    ${p.outcome === 'blocked' && html`<div class="why">Ward ${p.ward}: ${whySummary(content, p.why)}</div>`}
    ${p.outcome === 'unseen' && html`<div class="why dim">${known ? 'The attempt succeeded quietly. Detection, intel and dwell-time noise are how you find it.' : 'Nothing you can see changed.'}</div>`}
    ${known && t && html`<div class="why dim" style="margin-top:.4rem">${t.n}</div>`}
  </div>`;
}

function DecisionModal({ d, content, onChoose, b }) {
  const inj = b.ttx.injects.find(i => i.id === d.inject);
  return html`<div class="modal-back"><div class="modal panel glow rise" style="max-width:760px"><div class="kicker" style="font-family:var(--font-display);letter-spacing:.25em;color:var(--warn);font-size:.75rem">${inj?.at || ''} · ${inj?.kind?.toUpperCase() || 'INJECT'}</div><h2>${inj?.title}</h2><p>${inj?.text}</p><h4 class="dim" style="margin:.8rem 0 .4rem">${d.prompt}</h4><div class="col">${d.choices.map(c => html`<button class="btn" style="text-transform:none;letter-spacing:0;font-family:var(--font-ui);justify-content:flex-start;text-align:left" onClick=${() => onChoose(c.id)}>${c.label}</button>`)}</div></div></div>`;
}

function BattleEnd({ b, content, run }) {
  const r = b.result; const adv = content.adversaryMeta[b.adv.id] || {};
  const next = run.phase;
  return html`<div class="modal-back" style="z-index:600;background:rgba(3,5,12,.6)"><div class="modal panel glow rise center" style="max-width:640px"><div class=${'tier-badge t' + b.adv.tier}>${b.adv.name}</div><h2 class="verdict-h" style=${`font-size:2.2rem;color:${r.won ? 'var(--good)' : '#ff5470'}`}><${Decrypt} text=${r.won ? (r.how === 'evicted' ? 'Adversary evicted' : 'Operation contained') : 'Breach'} ms=${700}/></h2>
    <div class="statgrid" style="margin:1rem 0"><div class="stat"><b><${Count} to=${r.rounds}/></b><span>Rounds</span></div><div class="stat"><b><${Count} to=${r.evictions} delay=${120}/></b><span>Evictions</span></div><div class="stat"><b><${Count} to=${r.blocked} delay=${240}/></b><span>Blocked</span></div><div class="stat"><b><${Count} to=${r.resLost} delay=${360}/></b><span>Resilience lost</span></div></div>
    ${r.debt > 0 && html`<p class="warn">⚠ Quantum debt: ${r.debt} Resilience will be lost to future decryption of stolen data. Post-quantum hybrid crypto would have prevented it.</p>`}
    <button class="btn primary big" onClick=${() => { store.set({ holdBattle: false }); sfx.click(); }}>${r.won ? 'Debrief' : 'See what happened'}</button></div></div>`;
}

function GoalMeter({ b, content }) {
  const G = b.goal, d = content.tuning.goals[G.kind]; const pct = Math.min(100, Math.round(100 * G.prog / G.need));
  return html`<div class=${cx('goalbar', pct >= 60 && 'hot', pct >= 85 && 'crit')} role="meter" aria-label=${'Adversary goal: ' + d.name} aria-valuemin="0" aria-valuemax=${G.need} aria-valuenow=${+G.prog.toFixed(1)} ...${tip(d.how + ' ' + d.blurb)}><${Icon} n=${d.icon}/><b>Goal: ${d.name}</b><div class="gm"><i style=${`width:${pct}%`}/></div><span class="gv">${+G.prog.toFixed(1)}/${G.need}</span></div>`;
}
