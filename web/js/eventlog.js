// Turns engine events into player-facing log lines. Hidden adversary successes are NOT logged (fog of war).
import { strideName } from '../../engine/describe.js';
import { clock } from './ui.js';

export function whySummary(content, why) {
  return (why || []).map(w => {
    if (w.kind === 'ward') return `${content.cards[w.src]?.name || w.src} +${w.n}`;
    if (w.kind === 'mitigation') return w.ctl ? `NIST ${w.ctl} (CTID-mapped) matched +${w.n}` : `${w.mit} ${content.mits[w.mit]?.n || ''} matched +${w.n}`;
    if (w.kind === 'counter') return `${content.cards[w.src]?.name || w.src} counters ${w.tech} +${w.n}`;
    if (w.kind === 'policy') return `policy +${w.n}`;
    if (w.kind === 'shield') return `shield +${w.n}`;
    if (w.kind === 'base') return `hardening +${w.n}`;
    if (w.kind === 'bypass') return `adversary bypass ${w.n}`;
    return '';
  }).filter(Boolean).join(' · ');
}

export function logLine(content, b, e) {
  const A = (id) => b.assets.find(a => a.id === id)?.name || id;
  const T = (id) => `${id} ${content.techs[id]?.n || ''}`.trim();
  const t = clock(b.round);
  switch (e.t) {
    case 'blocked': return { t, cls: 'good', text: `BLOCKED ${T(e.tech)} on ${A(e.asset)} — ward ${e.ward}${e.why?.length ? ' (' + whySummary(content, e.why) + ')' : ''}`, refs: ['attack:' + e.tech] };
    case 'partial': return { t, cls: 'warn', text: `Wards reduced the intrusion (${e.ward}) but it still landed. ${whySummary(content, e.why)}`, refs: [] };
    case 'reveal': return { t, cls: 'info', text: `DETECTED ${T(e.tech)} foothold on ${A(e.asset)}`, refs: ['attack:' + e.tech] };
    case 'evict': return { t, cls: 'good', text: `EVICTED foothold ${e.tech} from ${A(e.asset)}${e.quick ? ' — same-round response!' : ''}`, refs: [] };
    case 'grip': return e.revealed === false ? null : { t, cls: 'info', text: `Foothold on ${A(e.asset)} weakened (grip ${e.grip})`, refs: [] };
    case 'persists': return { t, cls: 'warn', text: `Persistence mechanism on ${A(e.asset)} will restore the foothold next round`, refs: ['attack:TA0003'] };
    case 'damage': return { t, cls: 'bad', text: `${A(e.asset)} took ${e.n} damage (${e.cause})`, refs: ['attack:' + e.cause] };
    case 'asset_down': return { t, cls: 'bad', text: `${A(e.asset)} IS DOWN${e.jewel ? ' — crown jewel lost' : ''}`, refs: [] };
    case 'exfil': return { t, cls: 'bad', text: `Data exfiltrated from ${A(e.asset)}: −${e.n} Resilience${e.jewel ? ' (crown jewel ×2)' : ''}`, refs: ['attack:TA0010'] };
    case 'harvest': return { t, cls: 'warn', text: `Stolen data on ${A(e.asset)} was not post-quantum protected: quantum debt accrues`, refs: ['nist:fips-203', 'nist:ir-8547'] };
    case 'disabled': return { t, cls: 'bad', text: `${content.cards[e.card]?.name} on ${A(e.asset)} was DISABLED (${e.tech}). Evict the foothold to restore it.`, refs: ['attack:' + e.tech] };
    case 'restored': return { t, cls: 'good', text: `Control restored on ${A(e.asset)}`, refs: [] };
    case 'beacon': return { t, cls: 'warn', text: `Unexplained outbound beaconing from ${A(e.asset)} drains Resilience`, refs: ['attack:TA0011'] };
    case 'deploy': return { t, cls: 'info', text: `Deployed ${content.cards[e.card]?.name} on ${A(e.asset)}`, refs: content.cards[e.card]?.refs?.slice(0, 2) || [] };
    case 'augment': return { t, cls: 'info', text: `Augmented ${A(e.asset)} with ${content.cards[e.card]?.name}`, refs: content.cards[e.card]?.refs?.slice(0, 2) || [] };
    case 'policy': return { t, cls: 'info', text: `Policy in force: ${content.cards[e.card]?.name}`, refs: content.cards[e.card]?.refs?.slice(0, 2) || [] };
    case 'isolate': return { t, cls: 'info', text: `${A(e.asset)} isolated until your next turn`, refs: ['attack:M1030'] };
    case 'aegis': return { t, cls: 'good', text: `Recovery control revived ${A(e.asset)} at ${e.hp} integrity`, refs: ['attack:M1053'] };
    case 'revive': return { t, cls: 'good', text: `Golden-image rebuild revived ${A(e.asset)} at ${e.hp}`, refs: [] };
    case 'canary': return { t, cls: 'good', text: `CANARY TRIPPED on ${A(e.asset)}: the intruder touched a decoy`, refs: ['d3fend:DecoyUserCredential'] };
    case 'phase': return { t, cls: 'bad', text: `The adversary changes tactics: ${e.name || e.id}`, refs: [] };
    case 'inject': return { t: e.clock || t, cls: 'warn', text: `INJECT — ${e.title}`, refs: [] };
    case 'decision': return { t, cls: e.quality === 'best' ? 'good' : e.quality === 'poor' ? 'bad' : 'info', text: `Decision (${e.quality}): ${e.lesson || ''}`, refs: e.refs || [] };
    case 'res': return e.cause === 'heal' ? null : { t, cls: 'bad', text: `Resilience ${e.n}`, refs: [] };
    case 'round': return { t, cls: 'dim', text: `── Round ${e.n} ──`, refs: [] };
    default: return null;
  }
}
