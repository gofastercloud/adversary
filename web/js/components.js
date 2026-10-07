import { html, Icon, tip, cx, Refs, hash01 } from './ui.js';
import { Decrypt } from './term.js';
import { describeCard, strideName } from '../../engine/describe.js';
import { scaleCard, wardMap } from '../../engine/battle.js';

const FNICON = { govern: 'scale', identify: 'search', protect: 'shield', detect: 'radar', respond: 'siren', recover: 'refresh-cw' };
const CARDICON = (content, def) => {
  const t = def.type;
  if (def.cell) return content.cells[def.cell] && ({ govern: 'scroll-text', identify: 'search', protect: 'shield', detect: 'radar', respond: 'siren', recover: 'database-backup' }[def.fn]);
  return { control: 'shield', policy: 'scroll-text', augment: 'wand-sparkles', action: 'zap', status: 'receipt' }[t] || 'shield';
};
export const CARD_ICONS = {
  'x.patch': 'wrench', 'x.segment': 'fence', 'x.edr': 'cctv', 'x.waf': 'shield-alert', 'x.training': 'graduation-cap', 'x.threathunt': 'scan-search', 'x.tabletop': 'clipboard-check', 'x.purple': 'swords', 'x.soar': 'workflow', 'x.zerotrust': 'shield-ban', 'x.e8': 'award', 'x.assume': 'door-open', 'x.insurance': 'umbrella-off', 'status.techdebt': 'receipt',
  'a.mfa-numbermatch': 'hash', 'a.fido2': 'fingerprint', 'a.cond-access': 'sliders-horizontal', 'a.credguard': 'lock-keyhole', 'a.pam-jit': 'timer', 'a.tiering': 'layers', 'a.tls13': 'lock', 'a.kms': 'key-round', 'a.pqc': 'atom', 'a.allowlist': 'package-check', 'a.slsa': 'package', 'a.secureboot': 'power', 'a.cdn': 'globe', 'a.autoscale': 'gauge', 'a.worm-logs': 'file-lock', 'a.edr-telemetry': 'activity', 'a.sigma': 'regex', 'a.hunt': 'telescope', 'a.ueba': 'brain', 'a.honeytoken': 'bug', 'a.immutable-backup': 'database-backup', 'a.airgap': 'unplug'
};
const CELL_ICON = { 'protect.spoofing': 'fingerprint', 'protect.tampering': 'badge-check', 'protect.repudiation': 'file-lock', 'protect.disclosure': 'lock', 'protect.dos': 'gauge', 'protect.elevation': 'key-round', 'detect.spoofing': 'scan-face', 'detect.tampering': 'file-search', 'detect.repudiation': 'activity', 'detect.disclosure': 'eye-off', 'detect.dos': 'radar', 'detect.elevation': 'trending-up', 'respond.spoofing': 'user-x', 'respond.tampering': 'fence', 'respond.repudiation': 'microscope', 'respond.disclosure': 'megaphone', 'respond.dos': 'waves', 'respond.elevation': 'ban', 'recover.spoofing': 'id-card', 'recover.tampering': 'copy-plus', 'recover.repudiation': 'clipboard-check', 'recover.disclosure': 'key-round', 'recover.dos': 'database-backup', 'recover.elevation': 'castle', 'govern.spoofing': 'id-card', 'govern.tampering': 'gavel', 'govern.repudiation': 'scroll-text', 'govern.disclosure': 'file-lock', 'govern.dos': 'hourglass', 'govern.elevation': 'scale', 'identify.spoofing': 'users', 'identify.tampering': 'package', 'identify.repudiation': 'file-search', 'identify.disclosure': 'workflow', 'identify.dos': 'route', 'identify.elevation': 'map' };
export const cardIcon = (def) => CARD_ICONS[def.id] || CELL_ICON[def.cell] || 'shield';

export function Card({ content, def, ml = 1, cost, discounted, cls, style, onClick, onContext, selected, playable, unaffordable, back, i, tiltOn = true, children, tipOff, extra, iid }) {
  if (back) return html`<div class=${cx('card back', cls)} style=${style}><div class="card-in"></div></div>`;
  const d = def; const e = scaleCard(d, ml);
  const lines = describeCard(content, d, ml);
  const c = cost ?? e.cost;
  const onMove = tiltOn ? (ev) => { const r = ev.currentTarget.getBoundingClientRect(); const x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height; const el = ev.currentTarget; el.style.setProperty('--ry', (x - .5) * 16 + 'deg'); el.style.setProperty('--rx', (.5 - y) * 14 + 'deg'); el.style.setProperty('--mx', x); el.style.setProperty('--my', y); el.style.setProperty('--fa', x * 180 + y * 90); } : null;
  const onLeave = tiltOn ? (ev) => { const el = ev.currentTarget; el.style.setProperty('--ry', '0deg'); el.style.setProperty('--rx', '0deg'); } : null;
  const typeLbl = { control: 'Control', action: 'Action', policy: 'Policy', augment: 'Augment', status: 'Status' }[d.type];
  const fnName = content.fns.find(f => f.id === d.fn)?.name, propName = content.props.find(p => p.id === d.prop);
  return html`<div class=${cx('card', 'fn-' + d.fn, 'st-' + d.stride, 'rar-' + d.rarity, d.type === 'status' && 'status', playable && 'playable', selected && 'selected', unaffordable && 'unaffordable', cls)} style=${{ ...(style || {}), '--i': i }} onClick=${onClick} onContextMenu=${onContext} onMouseMove=${onMove} onMouseLeave=${onLeave} data-card=${d.id} data-ml=${ml} data-iid=${iid}>
    <div class="card-in">
      <div class=${cx('cost', c === 0 && 'zero', discounted && 'disc')}>${d.type === 'status' ? '–' : c}</div>
      <div class="ml">${[1, 2, 3].map(k => html`<i class=${k <= ml ? 'on' : ''}/>`)}</div>
      <div class="card-art"><${Icon} n=${cardIcon(d)} cls="big"/><span class="fnb">${(fnName || '').slice(0, 3).toUpperCase()}</span><span class="emb" title=${propName?.stride}>${d.stride}</span></div>
      <div class="card-name">${d.name}</div>
      <div class="card-type">${typeLbl} · ${fnName} × ${propName?.name}</div>
      <div class="card-text">${lines.map(l => html`<p class=${'k-' + l.k}>${l.t}</p>`)}</div>
      <div class="card-foot"><span>${(d.pack || 'core')}</span><span class="gem"/></div>
      <div class="foil"/><div class="shine"/>
      ${children}
    </div></div>`;
}

export function CardTip({ content, def, ml = 1 }) {
  return html`<div style="width:300px"><h4>${def.name} <small class="dim">ML${ml}</small></h4><div class="dim" style="font-size:.78rem">${def.type} · ${content.fns.find(f => f.id === def.fn)?.name} × ${strideName(def.stride)} (${content.props.find(p => p.id === def.prop)?.stride})</div><p style="margin:.5em 0">${def.lesson || def.desc}</p>${describeCard(content, def, ml).map(l => html`<div class=${'k-' + l.k} style="font-size:.8rem">• ${l.t}</div>`)}<div class="refs"><${Refs} list=${def.refs}/></div></div>`;
}

export const FNCOL = { govern: 'var(--fn-govern)', identify: 'var(--fn-identify)', protect: 'var(--fn-protect)', detect: 'var(--fn-detect)', respond: 'var(--fn-respond)', recover: 'var(--fn-recover)' };

export function Foothold({ f, content, targetable, onClick, hint }) {
  const t = content.techs[f.tech];
  const cls = cx('fh', targetable && 'targetable', hint && 'hidden-hint');
  const body = hint ? html`<${Icon} n="circle-help"/>?` : html`<${Icon} n="skull"/><${Decrypt} text=${f.tech} ms=${700}/><span class="grip">${Array.from({ length: f.grip }, () => html`<i/>`)}</span>${f.privileged && html`<span class="fl" title="Privileged">P</span>`}${f.c2 && html`<span class="fl" title="C2 beacon">C2</span>`}${f.persistent && html`<span class="fl" title="Persistent">∞</span>`}`;
  return html`<span class=${cls} onClick=${onClick} ...${hint ? {} : tip(() => html`<div style="width:280px"><h4>${f.tech} ${t?.n || f.name}</h4><div class="dim" style="font-size:.78rem">${f.tactic} · stealth ${f.stealth} · grip ${f.grip}${f.privileged ? ' · privileged' : ''}${f.c2 ? ' · C2 beacon' : ''}${f.persistent ? ' · persistent' : ''}</div><p style="margin:.4em 0">Revealed. Evict it before it spreads, stages data or strikes.</p><div class="refs"><${Refs} list=${['attack:' + f.tech]}/></div></div>`)}>${body}</span>`;
}

const KIND_ICON = { identity: 'id-card', email: 'mail', endpoint: 'laptop', server: 'server', data: 'database', network: 'network', cloud: 'cloud', ot: 'factory', backup: 'database-backup', app: 'receipt', vendor: 'handshake' };
export function AssetTile({ a, b, content, targetable, untargetable, onClick, hit, intent, showHints, targetFids, onFh }) {
  const wards = wardMap(content, b, a.id);
  const ctrls = b.controls.filter(k => k.asset === a.id);
  const feet = b.footholds.filter(f => f.asset === a.id);
  const hidden = feet.filter(f => !f.revealed).length;
  const hpPct = a.hp / a.max * 100;
  const kindColor = { identity: '#c77dff', email: '#5ad1ff', endpoint: '#58e07a', server: '#ffa94d', data: '#ffd23d', network: '#5ad1ff', cloud: '#7be0ff', ot: '#ff6b4a', backup: '#b58cff', app: '#ffb02e', vendor: '#ff5fa2' }[a.kind] || '#5ad1ff';
  return html`<div class=${cx('asset', 'kind-' + a.kind, a.jewel && 'jewel', a.down && 'down', a.isolated && 'isolated', targetable && 'targetable', untargetable && 'untargetable', hit && 'hit', intent && 'intent')} style=${{ '--k': kindColor, '--pip': (100 / a.max) + '%' }} onClick=${targetable ? onClick : null} data-asset=${a.id} ...${tip(() => html`<div style="width:300px"><h4>${a.name}</h4><div class="dim" style="font-size:.78rem">${a.zone} · ${a.kind}${a.jewel ? ' · CROWN JEWEL' : ''}${a.exposed ? ' · internet/user exposed' : ''}</div><p style="margin:.4em 0">${a.desc}</p><div style="font-size:.8rem">Wards: ${['S', 'T', 'R', 'I', 'D', 'E'].map(s => `${s}${wards[s]}`).join(' · ')}</div><div class="dim" style="font-size:.76rem;margin-top:.3em">Adjacent: ${a.adjacent.join(', ')}</div></div>`)}>
    <div class="a-badges">${a.isolated && html`<span class="badge iso">Isolated</span>`}${a.staged && html`<span class="badge staged">Data staged</span>`}${a.blocked && html`<span class="badge block">Path pruned</span>`}${a.shield > 0 && html`<span class="badge shield">+${a.shield}</span>`}</div>
    <div class="a-head"><${Icon} n=${a.icon || KIND_ICON[a.kind]}/><span class="a-name">${a.name}</span>${a.jewel && html`<span class="a-jewel" title="Crown jewel"><${Icon} n="gem"/></span>`}</div>
    <div class=${cx('a-hp', hpPct < 35 ? 'low' : hpPct < 65 ? 'mid' : '')}><i style=${`width:${hpPct}%`}/><b>${a.hp}/${a.max}</b></div>
    <div class="a-wards">${['S', 'T', 'R', 'I', 'D', 'E'].map(s => html`<span class=${cx('w', wards[s] > 0 && 'on', 'tag-' + s)} style=${`--c:var(--st-${s})`}><small>${s}</small>${wards[s] || ''}</span>`)}</div>
    <div class="a-ctrls">${Array.from({ length: a.slots }, (_, i) => { const k = ctrls[i]; if (!k) return html`<div class="slot"/>`; const d = content.cards[k.card]; return html`<div class=${cx('slot', 'filled', k.disabledBy && 'off')} style=${`--fn:${FNCOL[d.fn]}`} ...${tip(() => html`<div style="width:280px"><h4>${d.name}${k.disabledBy ? ' (DISABLED)' : ''}</h4>${k.augs.length ? html`<div class="dim" style="font-size:.78rem">Augments: ${k.augs.map(x => content.cards[x.card].name).join(', ')}</div>` : null}<p style="margin:.4em 0">${d.lesson || d.desc}</p>${k.disabledBy ? html`<p class="bad">Disabled by an adversary foothold. Evict the foothold or restore the control.</p>` : null}<${Refs} list=${d.refs}/></div>`)}><${Icon} n=${cardIcon(d)}/>${k.augs.length ? html`<span class="augs">${k.augs.map(() => html`<i/>`)}</span>` : null}</div>`; })}</div>
    <div class="a-fh">${feet.filter(f => f.revealed).map(f => html`<${Foothold} f=${f} content=${content} targetable=${targetFids?.has(f.id)} onClick=${(e) => { e.stopPropagation(); onFh?.(f); }}/>`)}${showHints && feet.some(f => !f.revealed && f.born <= b.round - 2) ? html`<${Foothold} f=${{}} content=${content} hint=${true}/>` : null}</div>
  </div>`;
}
export { KIND_ICON, FNICON };
