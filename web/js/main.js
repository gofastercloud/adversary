import { html, render, useEffect, useStore, store, TipLayer, Icon, Modal, hideTip } from './ui.js';
import * as app from './app.js';
import { TopBar, Title, Setup, DailyScreen, TtxSelect, Settings } from './screens-menu.js';
import { MapScreen, Briefing, RewardScreen, ShopScreen, RestScreen, EventScreen, WhiteboardScreen, ResultScreen, DeckModal } from './screens-run.js';
import { BattleScreen } from './battle.js';
import { Codex, Achievements, DossierModal } from './codex.js';
import { Docs, Tutorial, TutorialCoach } from './docs.js';
import { unlock, sfx } from './audio.js';
import { banner, confetti } from './fx.js';
import { setIntensity, setPalette } from './bg.js';
import { Typed, Art, Count } from './term.js';

function RunRouter() {
  const s = useStore(); const { run } = s;
  if (!run) return html`<div class="screen"><p>No active run.</p></div>`;
  if (s.holdBattle && run.battle?.over) return html`<${BattleScreen}/>`;
  switch (run.phase) {
    case 'map': return html`<${MapScreen}/>`;
    case 'briefing': return html`<${Briefing}/>`;
    case 'battle': return html`<${BattleScreen}/>`;
    case 'reward': return html`<${RewardScreen}/>`;
    case 'shop': return html`<${ShopScreen}/>`;
    case 'rest': return html`<${RestScreen}/>`;
    case 'event': return html`<${EventScreen}/>`;
    case 'whiteboard': return html`<${WhiteboardScreen}/>`;
    case 'won': case 'lost': return html`<${ResultScreen}/>`;
    default: return html`<div class="screen"><p>Unknown phase ${run.phase}</p></div>`;
  }
}
function LevelUp() {
  const { levelup } = useStore(); useEffect(() => { if (levelup) { sfx.levelup(); confetti(160); } }, [levelup]);
  if (!levelup) return null;
  return html`<div class="levelup" onClick=${() => store.set({ levelup: null })}><div><${Art} kind="analyst" cls="art-sm"/><div class="nm">Clearance upgraded</div><h1>LEVEL <${Count} to=${levelup.level} ms=${900}/></h1><div class="nm" style="color:#fff">${levelup.name}</div><p class="dim" style="margin-top:1rem">Click to continue</p></div></div>`;
}
function App() {
  const s = useStore();
  useEffect(() => { app.boot().catch(e => { console.error(e); store.set({ screen: 'error', error: String(e) }); }); const f = () => unlock(); addEventListener('pointerdown', f, { once: true }); addEventListener('pointerdown', () => hideTip()); }, []);
  useEffect(() => { hideTip(); }, [s.screen, s.run?.phase]);
  // rain brightness follows the view: full on menus, dimmed in battle so the board stays crisp
  const view = s.screen === 'run' ? (s.run?.phase || 'run') : s.screen;
  useEffect(() => { if (!s.run && ['title', 'loading', 'daily', 'codex', 'achievements', 'docs', 'settings'].includes(view)) setPalette(null); }, [view]);
  useEffect(() => { document.body.dataset.view = view; setIntensity({ title: .8, loading: .9, setup: .55, daily: .55, ttx: .55, battle: .2, map: .5, briefing: .4, reward: .45, shop: .4, rest: .5, event: .45, won: .5, lost: .45, codex: .3, achievements: .3, docs: .25, tutorial: .25, settings: .35 }[view] ?? .4); }, [view]);
  let body;
  switch (s.screen) {
    case 'loading': body = html`<div class="screen title loading"><${Art} kind="hacker" cls="art-title"/><div class="logo" data-t="ADVERSARY">ADVERSARY</div><div class="tagline"><${Typed} text="Decrypting intelligence" cps=${40} keep=${true}/></div><div class="loadbar" aria-hidden="true"><i/></div></div>`; break;
    case 'error': body = html`<div class="screen title"><h2>Could not start</h2><p class="dim">${s.error}</p></div>`; break;
    case 'title': body = html`<${Title}/>`; break;
    case 'setup': body = html`<${Setup}/>`; break;
    case 'daily': body = html`<${DailyScreen}/>`; break;
    case 'ttx': body = html`<${TtxSelect}/>`; break;
    case 'codex': body = html`<${Codex}/>`; break;
    case 'achievements': body = html`<${Achievements}/>`; break;
    case 'settings': body = html`<${Settings}/>`; break;
    case 'docs': body = html`<${Docs}/>`; break;
    case 'tutorial': body = html`<${Tutorial}/>`; break;
    case 'run': body = html`<${RunRouter}/>`; break;
    default: body = html`<${Title}/>`;
  }
  const m = s.modal;
  return html`<${TopBar} onMenu=${() => app.goto(s.run && s.screen !== 'run' ? 'run' : s.run ? 'settings' : 'title')} inRun=${!!s.run}/>
    ${s.loading && html`<div class="modal-back" style="z-index:950"><div class="panel glow" style="padding:1.4rem 2rem;font-family:var(--font-display)">Preparing scenario…</div></div>`}
    ${body}
    ${m?.type === 'dossier' && s.content && html`<${DossierModal} id=${m.id} onClose=${() => store.set({ modal: null })}/>`}
    ${s.tutorial && s.screen === 'run' && html`<${TutorialCoach}/>`}
    <${LevelUp}/><${TipLayer}/>`;
}
import { emptyProfile } from '../../engine/achievements.js';
store.set({ screen: 'loading', profile: emptyProfile(), settings: app.DEFAULT_SETTINGS, runCtx: { progress: {} }, runLog: [], log: [] });
render(html`<${App}/>`, document.getElementById('app'));

window.__adv = { app, store };
