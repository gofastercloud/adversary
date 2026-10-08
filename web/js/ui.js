import { h, render, Fragment } from 'preact';
import { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'preact/hooks';
import htm from 'htm';
import { resolveRef } from '../../engine/refs.js';

export const html = htm.bind(h);
export { h, render, Fragment, useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect };
export const cx = (...a) => a.filter(Boolean).join(' ');

export function Icon({ n, cls = '' }) { return n ? html`<svg class=${'i ' + cls} aria-hidden="true"><use href=${'#i-' + n}/></svg>` : null; }

// ───── tiny store
const listeners = new Set();
export const store = { s: {}, set(p) { this.s = { ...this.s, ...(typeof p === 'function' ? p(this.s) : p) }; listeners.forEach(f => f()); }, get() { return this.s; } };
export function useStore() { const [, force] = useState(0); useEffect(() => { const f = () => force(x => x + 1); listeners.add(f); return () => listeners.delete(f); }, []); return store.s; }

// ───── tooltips
let tipSet = null;
export function TipLayer() {
  const [t, setT] = useState(null);
  useEffect(() => { tipSet = setT; return () => { tipSet = null; }; }, []);
  const ref = useRef();
  useLayoutEffect(() => {
    if (!t || !ref.current) return; const el = ref.current; const r = el.getBoundingClientRect();
    let x = t.x + 18, y = t.y + 14; if (x + r.width > innerWidth - 8) x = t.x - r.width - 18; if (y + r.height > innerHeight - 8) y = Math.max(8, innerHeight - r.height - 8);
    el.style.left = Math.max(8, x) + 'px'; el.style.top = Math.max(8, y) + 'px';
  });
  return html`<div id="tip" ref=${ref} class=${t ? 'on' : ''}>${t?.content}</div>`;
}
export function tip(content) {
  return {
    onMouseEnter: (e) => tipSet?.({ content: typeof content === 'function' ? content() : content, x: e.clientX, y: e.clientY }),
    onMouseMove: (e) => tipSet?.((p) => p && { ...p, x: e.clientX, y: e.clientY }),
    onMouseLeave: () => tipSet?.(null),
    onFocus: (e) => { const r = e.target.getBoundingClientRect(); tipSet?.({ content: typeof content === 'function' ? content() : content, x: r.right, y: r.top }); },
    onBlur: () => tipSet?.(null)
  };
}
export const hideTip = () => tipSet?.(null);

export function RefLink({ r, label }) {
  const x = resolveRef(r); if (!x) return null;
  return html`<a class=${'reflink ' + x.kind} href=${x.url} target="_blank" rel="noopener noreferrer" onClick=${e => e.stopPropagation()}><${Icon} n="external-link"/>${label || x.label}</a>`;
}
export function Refs({ list }) { return html`<span class="refs">${(list || []).map(r => html`<${RefLink} r=${r}/>`)}</span>`; }

export function Modal({ onClose, children, wide, cls }) {
  useEffect(() => { const f = (e) => e.key === 'Escape' && onClose?.(); addEventListener('keydown', f); return () => removeEventListener('keydown', f); }, [onClose]);
  return html`<div class="modal-back" onClick=${e => e.target === e.currentTarget && onClose?.()}><div class=${cx('modal panel glow rise', cls)} style=${wide ? 'width:min(1180px,100%)' : ''}><button class="iconbtn modal-x" onClick=${onClose} aria-label="Close"><${Icon} n="x"/></button>${children}</div></div>`;
}

// deterministic hash → [0,1)
export const hash01 = (s, k = 0) => { let h = 2166136261 ^ k; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return ((h >>> 0) % 100000) / 100000; };

/** Procedural adversary portrait. */
export function Sigil({ id, color = '#ff5470', icon = 'hood', size = '', glitch = true }) {
  const polys = [0, 1, 2].map(i => { const n = 3 + Math.floor(hash01(id, i) * 5), r = 44 - i * 11, rot = hash01(id, i + 9) * 360; const pts = Array.from({ length: n }, (_, k) => { const a = (k / n) * Math.PI * 2 + rot * Math.PI / 180; return `${50 + r * Math.cos(a)},${50 + r * Math.sin(a)}`; }).join(' '); return html`<polygon points=${pts} fill="none" stroke=${color} stroke-width=${i === 0 ? 1.6 : 1} opacity=${0.85 - i * 0.2}/>`; });
  const rays = Array.from({ length: 7 }, (_, i) => { const a = hash01(id, 30 + i) * Math.PI * 2, l = 14 + hash01(id, 40 + i) * 30; return html`<line x1=${50} y1=${50} x2=${50 + l * Math.cos(a)} y2=${50 + l * Math.sin(a)} stroke=${color} stroke-width="0.8" opacity="0.5"/>`; });
  return html`<div class=${cx('sigil', size, glitch && 'glitch')} style=${`--c:${color}`}><svg class="pat" viewBox="0 0 100 100">${polys}${rays}</svg><${Icon} n=${icon} cls="ico"/></div>`;
}

export const fmtMoney = (n) => '$' + n;
export const clock = (round, hoursPer = 4) => { const t = 8 + (round - 1) * hoursPer; const d = 1 + Math.floor(t / 24); const hh = String(Math.floor(t % 24)).padStart(2, '0'); return `Day ${d} · ${hh}:00`; };
export const pct = (a, b) => Math.max(0, Math.min(100, (a / b) * 100));
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
