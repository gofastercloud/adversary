// Juice: particles, floating numbers, stamps, banners, screen shake, achievement toasts.
import { sfx } from './audio.js';
import { flashBg } from './bg.js';
let settings = { motion: true, shake: true };
export const setFxSettings = (s) => { settings = { ...settings, ...s }; };
const fxRoot = () => document.getElementById('fx');

export function burst(x, y, { n = 24, colors = ['#fff'], speed = 260, life = 800, size = 8, gravity = 520, shape = 'sq' } = {}) {
  if (!settings.motion) return;
  const root = fxRoot(); if (!root) return;
  for (let i = 0; i < n; i++) {
    const el = document.createElement('i'); el.className = 'pc';
    const a = Math.random() * Math.PI * 2, v = speed * (0.35 + Math.random() * 0.8); const s = size * (0.5 + Math.random());
    el.style.cssText = `left:${x}px;top:${y}px;width:${s}px;height:${s}px;background:${colors[i % colors.length]};box-shadow:0 0 ${s}px ${colors[i % colors.length]};${shape === 'circle' ? 'border-radius:50%;' : ''}`;
    root.appendChild(el);
    const vx = Math.cos(a) * v, vy = Math.sin(a) * v - speed * 0.25, rot = (Math.random() - .5) * 720; const t0 = performance.now();
    const step = (t) => { const dt = (t - t0) / 1000; const k = (t - t0) / life; if (k >= 1) { el.remove(); return; } el.style.transform = `translate(${vx * dt}px, ${vy * dt + 0.5 * gravity * dt * dt}px) rotate(${rot * dt}deg) scale(${1 - k * 0.6})`; el.style.opacity = String(1 - k * k); requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
}
export function confetti(n = 140) {
  if (!settings.motion) return; const root = fxRoot(); if (!root) return; const cols = ['#ff5470', '#ffd23d', '#4ade80', '#5ad1ff', '#a78bfa', '#f472d0'];
  for (let i = 0; i < n; i++) { const el = document.createElement('i'); el.className = 'pc'; const x = Math.random() * innerWidth; const w = 6 + Math.random() * 8; const c = cols[i % cols.length]; el.style.cssText = `left:${x}px;top:-20px;width:${w}px;height:${w * 1.6}px;background:${c};`; root.appendChild(el); const dur = 1800 + Math.random() * 1800, sway = (Math.random() - .5) * 240, rot = Math.random() * 1080, d0 = Math.random() * 500; const t0 = performance.now() + d0; const step = (t) => { if (t < t0) return requestAnimationFrame(step); const k = (t - t0) / dur; if (k >= 1) { el.remove(); return; } el.style.transform = `translate(${sway * Math.sin(k * 6)}px, ${k * (innerHeight + 60)}px) rotate(${rot * k}deg)`; requestAnimationFrame(step); }; requestAnimationFrame(step); }
}
export function floater(text, x, y, color = '#fff') { const root = fxRoot(); if (!root) return; const el = document.createElement('div'); el.className = 'float'; el.textContent = text; el.style.cssText = `left:${x}px;top:${y}px;color:${color}`; root.appendChild(el); setTimeout(() => el.remove(), 1200); }
export function stamp(text, x, y, color = '#ff5470') { const root = fxRoot(); if (!root) return; const el = document.createElement('div'); el.className = 'stamp'; el.textContent = text; el.style.cssText = `left:${x}px;top:${y}px;color:${color};border-color:${color};text-shadow:0 0 14px ${color}`; root.appendChild(el); setTimeout(() => el.remove(), 1300); }
export function banner(text, sub, color = '#5ad1ff', ms = 2000) { const root = fxRoot(); if (!root) return; const el = document.createElement('div'); el.className = 'banner'; el.innerHTML = ''; const d = document.createElement('div'); d.style.setProperty('--bc', color); d.textContent = text; if (sub) { const s = document.createElement('small'); s.textContent = sub; d.appendChild(s); } el.appendChild(d); root.appendChild(el); setTimeout(() => el.remove(), ms + 200); }
export function shake(big = false) { if (!settings.motion || !settings.shake) return; const c = big ? 'shake-big' : 'shake'; document.body.classList.remove('shake', 'shake-big'); void document.body.offsetWidth; document.body.classList.add(c); setTimeout(() => document.body.classList.remove(c), big ? 720 : 440); }
export function flash(color = '#fff') { if (!settings.motion) return; document.body.style.setProperty('--flash', color); document.body.classList.remove('flash'); void document.body.offsetWidth; document.body.classList.add('flash'); setTimeout(() => document.body.classList.remove('flash'), 400); }
export function combo(text, sub) { const root = fxRoot(); if (!root) return; const el = document.createElement('div'); el.className = 'combo'; el.innerHTML = `${text}<small>${sub || ''}</small>`; root.appendChild(el); setTimeout(() => el.remove(), 1700); }
export const centerOf = (el) => { if (!el) return { x: innerWidth / 2, y: innerHeight / 2 }; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
export const assetEl = (id) => document.querySelector(`[data-asset="${id}"]`);

export function toastAchievement(a, tierColors = { bronze: '#cd8a4b', silver: '#cfd8f0', gold: '#ffd23d', platinum: '#8ff3ff' }) {
  const root = document.getElementById('toasts'); if (!root) return;
  const el = document.createElement('div'); el.className = `toast ${a.hidden ? 'secret' : a.tier}`;
  el.innerHTML = `<div class="ic"><svg class="i"><use href="#i-${a.icon}"/></svg></div><div><small>${a.hidden ? 'Secret unlocked' : 'Achievement unlocked'} · ${a.tier}</small><b></b><span></span></div><div class="xp">+${a.xp ?? { bronze: 25, silver: 60, gold: 120, platinum: 250 }[a.tier]}</div>`;
  el.querySelector('b').textContent = a.name; el.querySelector('span').textContent = a.desc;
  root.appendChild(el); setTimeout(() => el.remove(), 5800);
  const r = el.getBoundingClientRect(); const c = a.hidden ? ['#ff4fd8', '#fff', '#8ff3ff'] : [tierColors[a.tier], '#fff'];
  setTimeout(() => burst(r.left + 40, r.top + 30, { n: a.tier === 'platinum' ? 70 : a.tier === 'gold' ? 46 : 28, colors: c, speed: 340, size: 7, shape: 'circle' }), 250);
  if (a.hidden) sfx.secret(); else sfx.ach(a.tier);
  if (a.tier === 'gold' || a.tier === 'platinum') { flashBg(0.5); if (a.tier === 'platinum') confetti(90); }
}
