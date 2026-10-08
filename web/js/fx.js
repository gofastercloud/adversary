// Juice: particles, floating numbers, stamps, banners, screen shake, achievement toasts.
import { sfx } from './audio.js';
import { flashBg, surge } from './bg.js';
let settings = { motion: true, shake: true, glitch: true };
export const setFxSettings = (s) => { settings = { ...settings, ...s }; };
const fxRoot = () => document.getElementById('fx');
const reduceMq = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
/** True when decorative motion is allowed (settings toggle and the OS reduced-motion preference both honoured). */
export const motionOK = () => settings.motion && !reduceMq.matches;
const glitchOK = () => motionOK() && settings.glitch;
const PHOS = ['#00ff9c', '#7dffc9', '#d6ffe8', '#fff'];

/** Particles (squares, circles or text glyphs) driven by the Web Animations API: no per-frame JS. */
export function burst(x, y, { n = 24, colors = ['#fff'], speed = 260, life = 800, size = 8, gravity = 520, shape = 'sq', chars = null } = {}) {
  if (!motionOK()) return;
  const root = fxRoot(); if (!root) return; const T = life / 1000;
  for (let i = 0; i < n; i++) {
    const el = document.createElement('i'); el.className = chars ? 'pc pg' : 'pc'; const c = colors[i % colors.length];
    const a = Math.random() * Math.PI * 2, v = speed * (0.35 + Math.random() * 0.8), s = size * (0.5 + Math.random());
    if (chars) { el.textContent = chars[(Math.random() * chars.length) | 0]; el.style.cssText = `left:${x}px;top:${y}px;color:${c};font-size:${Math.round(s * 1.7)}px;text-shadow:0 0 6px ${c}`; }
    else el.style.cssText = `left:${x}px;top:${y}px;width:${s}px;height:${s}px;background:${c};box-shadow:0 0 ${s}px ${c};${shape === 'circle' ? 'border-radius:50%;' : ''}`;
    root.appendChild(el);
    const vx = Math.cos(a) * v, vy = Math.sin(a) * v - speed * 0.25, rot = (Math.random() - .5) * 720;
    const at = (k) => { const t = k * T; return `translate(${vx * t}px, ${vy * t + 0.5 * gravity * t * t}px) rotate(${rot * t}deg) scale(${1 - k * 0.6})`; };
    const an = el.animate([0, .25, .5, .75, 1].map(k => ({ offset: k, transform: at(k), opacity: 1 - k * k })), { duration: life, easing: 'linear' });
    an.onfinish = () => el.remove();
  }
}
/** Falling code glyphs: the "shatter" for an evicted foothold. */
export function glyphBurst(x, y, o = {}) { burst(x, y, { n: 34, colors: PHOS, chars: '01ｱｲｳｴｵﾊﾋﾌ<>/#T1078', speed: 300, size: 9, gravity: 380, life: 950, ...o }); }
/** Expanding ring: ward shield ripple, deploy pulse, achievement pop. */
export function ripple(x, y, { color = '#00ff9c', size = 150, ms = 700, square = false } = {}) {
  if (!motionOK()) return; const root = fxRoot(); if (!root) return;
  const el = document.createElement('i'); el.className = 'rip'; el.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;border-color:${color};box-shadow:0 0 18px ${color},inset 0 0 18px ${color};${square ? 'border-radius:22%' : ''}`;
  root.appendChild(el); const a = el.animate([{ transform: 'scale(.15)', opacity: .95 }, { transform: 'scale(1)', opacity: 0 }], { duration: ms, easing: 'cubic-bezier(.1,.7,.3,1)' }); a.onfinish = () => el.remove();
}
/** Horizontal tear bars: a short screen glitch for breaches and boss entrances. */
export function glitchScreen(ms = 600, color = '#ff2e6e') {
  if (!glitchOK()) return; const root = fxRoot(); if (!root) return;
  for (let i = 0; i < 9; i++) {
    const el = document.createElement('i'); el.className = 'gbar'; const h = 6 + Math.random() * 60; const c = i % 3 === 0 ? '#00ff9c' : i % 3 === 1 ? color : '#3ad6ff';
    el.style.cssText = `top:${Math.random() * 100}%;height:${h}px;background:${c}`; root.appendChild(el);
    const d = (Math.random() - .5) * 90; const an = el.animate([{ transform: 'translateX(0)', opacity: 0 }, { transform: `translateX(${d}px)`, opacity: .34 }, { transform: `translateX(${-d}px)`, opacity: .05 }, { transform: `translateX(${d / 2}px)`, opacity: .28 }, { transform: 'translateX(0)', opacity: 0 }], { duration: ms * (.6 + Math.random() * .4), delay: Math.random() * ms * .3, easing: 'steps(5)' }); an.onfinish = () => el.remove();
  }
  document.body.classList.add('glitching'); setTimeout(() => document.body.classList.remove('glitching'), ms);
}
/** Clone `el` into the fx layer and fly it to `to`, shrinking and fading (card play / discard). Resolves when done. */
export function flyClone(el, to, { ms = 420, scale = .3, rot = 14, delay = 0 } = {}) {
  if (!motionOK() || !el) return Promise.resolve(); const root = fxRoot(); if (!root) return Promise.resolve();
  const r = el.getBoundingClientRect(); const c = el.cloneNode(true); c.classList.remove('deal', 'selected', 'playable', 'flip'); c.removeAttribute('id'); c.classList.add('fly');
  c.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;margin:0;transform:none;`;
  root.appendChild(c); const dx = to.x - (r.left + r.width / 2), dy = to.y - (r.top + r.height / 2);
  const an = c.animate([{ transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 }, { offset: .6, transform: `translate(${dx * .7}px,${dy * .7}px) scale(${(1 + scale) / 2}) rotate(${rot / 2}deg)`, opacity: .95 }, { transform: `translate(${dx}px,${dy}px) scale(${scale}) rotate(${rot}deg)`, opacity: 0 }], { duration: ms, delay, easing: 'cubic-bezier(.55,.05,.75,.4)', fill: 'backwards' });
  return new Promise(res => { an.onfinish = () => { c.remove(); res(); }; an.oncancel = () => { c.remove(); res(); }; });
}
export function confetti(n = 140) {
  if (!motionOK()) return; const root = fxRoot(); if (!root) return; const cols = ['#00ff9c', '#7dffc9', '#ffd23d', '#3ad6ff', '#d6ffe8', '#39ff88'];
  for (let i = 0; i < Math.min(n, 120); i++) {
    const el = document.createElement('i'); el.className = 'pc pg'; const w = 10 + Math.random() * 12; el.textContent = '01ｱｲｳｴｵ'[(Math.random() * 7) | 0]; el.style.cssText = `left:${Math.random() * innerWidth}px;top:-24px;font-size:${w}px;color:${cols[i % cols.length]};text-shadow:0 0 8px currentColor`; root.appendChild(el);
    const sway = (Math.random() - .5) * 200, dur = 1700 + Math.random() * 1700; const an = el.animate([0, .25, .5, .75, 1].map(k => ({ offset: k, transform: `translate(${sway * Math.sin(k * 6)}px, ${k * (innerHeight + 60)}px)`, opacity: k > .85 ? (1 - k) / .15 : 1 })), { duration: dur, delay: Math.random() * 500, easing: 'linear', fill: 'backwards' }); an.onfinish = () => el.remove();
  }
}
export function floater(text, x, y, color = '#fff') { const root = fxRoot(); if (!root) return; const el = document.createElement('div'); el.className = 'float'; el.textContent = text; el.style.cssText = `left:${x}px;top:${y}px;color:${color}`; root.appendChild(el); setTimeout(() => el.remove(), 1200); }
export function stamp(text, x, y, color = '#ff5470') { const root = fxRoot(); if (!root) return; const el = document.createElement('div'); el.className = 'stamp'; el.textContent = text; el.style.cssText = `left:${x}px;top:${y}px;color:${color};border-color:${color};text-shadow:0 0 14px ${color}`; root.appendChild(el); setTimeout(() => el.remove(), 1300); }
/** Imperatively resolve scrambled characters into `text` inside `el`. */
export function decryptInto(el, text, ms = 600) {
  if (!motionOK()) { el.textContent = text; return; }
  const pool = '0123456789ABCDEF#$%&*<>/=+'; const t0 = performance.now(); let last = 0;
  const step = (t) => { if (!el.isConnected) return; const k = Math.min(1, (t - t0) / ms); if (t - last > 45 || k === 1) { last = t; const f = Math.floor(k * text.length); el.textContent = k === 1 ? text : Array.from(text).map((c, i) => c === ' ' || i < f ? c : pool[(Math.random() * pool.length) | 0]).join(''); } if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
export function banner(text, sub, color = '#00ff9c', ms = 2000) {
  const root = fxRoot(); if (!root) return; const el = document.createElement('div'); el.className = 'banner';
  const d = document.createElement('div'); d.style.setProperty('--bc', color); const t = document.createElement('span'); t.className = 'bt'; t.dataset.t = text; d.appendChild(t); decryptInto(t, text, 520);
  if (sub) { const s = document.createElement('small'); s.textContent = sub; d.appendChild(s); } el.appendChild(d); root.appendChild(el); setTimeout(() => el.remove(), ms + 200);
}
/** Terminal verdicts from the adversary's point of view: win = access denied (green), breach = access granted (red). */
export const accessBanner = (granted, sub, ms = 2600) => { banner(granted ? 'ACCESS GRANTED' : 'ACCESS DENIED', sub, granted ? '#ff2e4e' : '#00ff9c', ms); glitchScreen(granted ? 900 : 450, granted ? '#ff2e4e' : '#00ff9c'); };
export function shake(big = false) { if (!motionOK() || !settings.shake) return; const c = big ? 'shake-big' : 'shake'; document.body.classList.remove('shake', 'shake-big'); void document.body.offsetWidth; document.body.classList.add(c); setTimeout(() => document.body.classList.remove(c), big ? 720 : 440); }
export function flash(color = '#fff') { if (!motionOK()) return; document.body.style.setProperty('--flash', color); document.body.classList.remove('flash'); void document.body.offsetWidth; document.body.classList.add('flash'); setTimeout(() => document.body.classList.remove('flash'), 400); }
export function combo(text, sub) { const root = fxRoot(); if (!root) return; const el = document.createElement('div'); el.className = 'combo'; el.innerHTML = `${text}<small>${sub || ''}</small>`; root.appendChild(el); setTimeout(() => el.remove(), 1700); }
/** Boss entrance: rain surge, glitch tear, big shake and a decrypting banner. */
export function bossEntrance(name, kicker = 'APEX ADVERSARY DETECTED') { surge(3200); flashBg(0.9); glitchScreen(1000, '#ff2e6e'); shake(true); banner(kicker, name, '#ff2e6e', 2600); }
export const centerOf = (el) => { if (!el) return { x: innerWidth / 2, y: innerHeight / 2 }; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
export const assetEl = (id) => document.querySelector(`[data-asset="${id}"]`);

export function toastAchievement(a, tierColors = { bronze: '#cd8a4b', silver: '#cfd8f0', gold: '#ffd23d', platinum: '#8ff3ff' }) {
  const root = document.getElementById('toasts'); if (!root) return;
  const el = document.createElement('div'); el.className = `toast ${a.hidden ? 'secret' : a.tier}`;
  el.innerHTML = `<svg class="wm" aria-hidden="true"><use href="#i-hood"/></svg><div class="ic"><svg class="i"><use href="#i-${a.icon}"/></svg></div><div><small>${a.hidden ? 'Secret unlocked' : 'Achievement unlocked'} · ${a.tier}</small><b></b><span></span></div><div class="xp">+${a.xp ?? { bronze: 25, silver: 60, gold: 120, platinum: 250 }[a.tier]}</div>`;
  el.querySelector('b').textContent = a.name; el.querySelector('span').textContent = a.desc; decryptInto(el.querySelector('b'), a.name, 700);
  root.appendChild(el); setTimeout(() => el.remove(), 5800);
  const r = el.getBoundingClientRect(); const c = a.hidden ? ['#ff4fd8', '#fff', '#8ff3ff'] : [tierColors[a.tier], '#fff'];
  setTimeout(() => { ripple(r.left + 40, r.top + 36, { color: c[0], size: 120, ms: 900, square: true }); glyphBurst(r.left + 40, r.top + 36, { n: a.tier === 'platinum' ? 40 : 22, colors: [...c, '#00ff9c'], speed: 300 }); }, 260);
  setTimeout(() => burst(r.left + 40, r.top + 30, { n: a.tier === 'platinum' ? 70 : a.tier === 'gold' ? 46 : 28, colors: c, speed: 340, size: 7, shape: 'circle' }), 250);
  if (a.hidden) sfx.secret(); else sfx.ach(a.tier);
  if (a.tier === 'gold' || a.tier === 'platinum') { flashBg(0.5); if (a.tier === 'platinum') confetti(90); }
}
