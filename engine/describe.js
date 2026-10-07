// Player-facing rules text, generated from data so text can never drift from behaviour.
import { scaleCard } from './battle.js';
import { KIND_TEXT } from './tactics.js';

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const STRIDE_NAME = { S: 'Authentication', T: 'Integrity', R: 'Non-repudiation', I: 'Confidentiality', D: 'Availability', E: 'Authorisation' };
export const strideName = (l) => STRIDE_NAME[l];

function fxText(fx, content) {
  switch (fx.op) {
    case 'reveal': return `Reveal up to ${plural(fx.n || 1, 'hidden foothold')} (stealth ≤ ${fx.str ?? 3})`;
    case 'scanKinds': return `Scan ${fx.kinds.join('/')} assets: reveal footholds (stealth ≤ ${fx.str ?? 3})`;
    case 'draw': return `Draw ${plural(fx.n, 'card')}`;
    case 'energy': return `Gain ${fx.n} energy`;
    case 'energyNext': return `+${fx.n} energy next turn`;
    case 'resilience': return `Restore ${fx.n} Resilience`;
    case 'exposure': return `+${fx.n} Exposure to the adversary`;
    case 'intel': return `+${fx.n} intel this round`;
    case 'evict': return `Reduce a revealed foothold’s grip by ${fx.n} (removes it at 0)`;
    case 'evictPrivileged': return `Reduce privileged footholds on the asset by ${fx.n} grip`;
    case 'isolate': return 'Isolate the asset until your next turn';
    case 'heal': return fx.n >= 90 ? 'Fully restore the asset' : `Restore ${fx.n} integrity`;
    case 'shield': return `+${fx.n} ward against everything until the adversary’s turn ends`;
    case 'shieldExfil': return `Exfiltration deals ${fx.n} less this round`;
    case 'purge': return 'Remove every foothold on the asset';
    case 'restore': return 'Re-enable disabled controls on the asset';
    case 'clearCreds': return 'Strip the adversary’s stolen credentials';
    case 'unstage': return 'Remove staged data';
    case 'unprivilege': return 'Footholds on the asset lose privilege';
    case 'unprivilegeAll': return 'All footholds lose privilege';
    case 'blockPath': return 'The adversary cannot spread or escalate into the asset this round';
    case 'nextPolicyFree': return 'Your next Policy costs 0';
    default: return fx.op;
  }
}
function auraText(a) {
  const out = [];
  for (const [s, n] of Object.entries(a.ward || {})) out.push(`All assets: +${n} ${STRIDE_NAME[s]} ward`);
  if (a.advTax) out.push(`Adversary ${a.advTax.tactics.map(t => t.replace(/-/g, ' ')).join('/')} cards cost ${a.advTax.n} more`);
  if (a.stealthMinus) out.push(`Footholds are ${a.stealthMinus} stealth easier to detect`);
  if (a.exfilMinus) out.push(`Exfiltration deals ${a.exfilMinus} less`);
  if (a.shield) out.push(`Each asset ignores the first ${a.shield} damage each round`);
  if (a.protectBonus) out.push(`Every Protect control: +${a.protectBonus} ward on its property`);
  if (a.startReveal) out.push('Start of your turn: reveal the stealthiest-lowest hidden foothold');
  if (a.resilienceShield) out.push(`The first Resilience loss each round is reduced by ${a.resilienceShield}`);
  if (a.onReveal) out.push('First reveal each round: automatically reduce that foothold’s grip by 1');
  if (a.layered) out.push(`Assets with ${a.layered.minControls}+ controls: +${a.layered.ward} ward (all properties)`);
  return out;
}

/** Returns [{k:'ward'|'detect'|'fx'|'aura'|'aug'|'note', t}] for a card instance. */
export function describeCard(content, def, ml = 1) {
  const c = scaleCard(def, ml);
  const out = [];
  if (c.type === 'status') { out.push({ k: 'note', t: 'Unplayable. Clogs your hand.' }); return out; }
  if (c.type === 'control') {
    for (const [s, n] of Object.entries(c.ward || {})) out.push({ k: 'ward', s, t: `+${n} ${STRIDE_NAME[s]} ward` });
    if (c.detect) out.push({ k: 'detect', t: `Monitor: reveals ${plural(c.detect.n, 'foothold')} per round (stealth ≤ ${c.detect.str}${c.detect.scope === 'global' ? ', anywhere' : ''})` });
    if (c.aegis) out.push({ k: 'fx', t: `If the asset would go down, revive it at ${c.aegis.revive} integrity (once)` });
    if (c.flags?.includes('autoEvict')) out.push({ k: 'fx', t: 'Each round: revealed footholds here lose 1 grip' });
    if (c.flags?.includes('segment')) out.push({ k: 'fx', t: 'Adversary Spread into/out of this asset costs +1 and has −1 power' });
    if (c.flags?.includes('stealthMinus1')) out.push({ k: 'fx', t: 'Footholds here are 1 stealth easier to detect' });
    if (c.mit?.length) out.push({ k: 'mit', t: 'Counters: ' + c.mit.map(m => `${m} ${content.mits[m]?.n || ''}`.trim()).join(', ') });
  } else if (c.type === 'policy') {
    out.push({ k: 'note', t: 'Policy — stays in play (2 slots)' });
    for (const t of auraText(c.aura || {})) out.push({ k: 'aura', t });
  } else if (c.type === 'augment') {
    out.push({ k: 'note', t: 'Attach to a ' + (c.base.map(b => b.endsWith('.*') ? b.split('.')[0] : (content.cells[b]?.name || b)).join(' / ')) + ' control' });
    const a = c.aug || {};
    for (const [s, n] of Object.entries(a.ward || {})) out.push({ k: 'ward', s, t: `+${n} ${STRIDE_NAME[s]} ward` });
    if (a.detectStr) out.push({ k: 'detect', t: `+${a.detectStr} detection strength` });
    if (a.detectN) out.push({ k: 'detect', t: `+${a.detectN} foothold revealed per round` });
    if (a.privBonus) out.push({ k: 'detect', t: `+${a.privBonus} strength vs privileged footholds` });
    if (a.aegis) out.push({ k: 'fx', t: `Revive for ${a.aegis.revive} more integrity` });
    for (const r of a.resists || []) out.push({ k: 'counter', t: `Counters ${r} ${content.techs[r]?.n || ''} (+3 ward)`.trim() });
    for (const x of a.expert || []) out.push({ k: 'counter', t: `Counters ${x.tech} ${content.techs[x.tech]?.n || ''} (+3 ward; expert guidance)`.trim() });
    for (const f of a.flags || []) out.push({ k: 'fx', t: { jit: 'Privileged footholds here lose privilege each round', regen1: 'Asset recovers 1 integrity each round', pqc: 'Immune to harvest-now-decrypt-later', canary: 'First Credential Access or Collection here: reveal it and +2 Exposure', sigma: 'Footholds created by execution here: −1 stealth', vault: 'Backups adjacent are safe from ransomware spillover' }[f] || f });
  } else {
    if (c.target === 'foothold') out.push({ k: 'note', t: 'Target: a revealed foothold' });
    for (const fx of c.fx || []) out.push({ k: 'fx', t: fxText(fx, content) });
  }
  return out;
}

export function describeTrait(t) { return t.text; }
export function describeRelic(r) { return r.desc; }
export const describeKind = (k) => KIND_TEXT[k];
export function describePower(p) { return p.text; }
