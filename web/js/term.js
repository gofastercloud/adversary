// Terminal-style text effects: typed-in text, decrypt (scramble resolving to text), count-up numbers, hood art.
import { html, useState, useEffect, useRef, cx } from './ui.js';
import { motionOK } from './fx.js';
import { hackerSvg, analystSvg } from './art.js';

const raf = requestAnimationFrame;
/** Types `text` in with a blinking caret. Full text is always available to screen readers; layout never jumps. */
export function Typed({ text = '', cps = 90, delay = 0, keep = false, cls = '', tag = 'span' }) {
  const [n, setN] = useState(() => motionOK() ? 0 : text.length);
  useEffect(() => {
    if (!motionOK()) { setN(text.length); return; }
    setN(0); let live = true, id = 0; const rate = Math.max(cps, text.length / 1.8); const t0 = performance.now() + delay;
    const step = (t) => { if (!live) return; const k = Math.max(0, Math.min(text.length, Math.floor((t - t0) / 1000 * rate))); setN(p => p === k ? p : k); if (k < text.length) id = raf(step); };
    id = raf(step); return () => { live = false; cancelAnimationFrame(id); };
  }, [text]);
  const done = n >= text.length;
  return html`<${tag} class=${cx('typed', cls)}><span class="sr">${text}</span><span aria-hidden="true">${text.slice(0, n)}${(!done || keep) && html`<i class="caret"/>`}<span class="ghost">${text.slice(n)}</span></span><//>`;
}

const POOL = '0123456789ABCDEF#$%&*<>/=+';
const scramble = (s, k) => Array.from(s).map((c, i) => c === ' ' || i < k ? c : POOL[(Math.random() * POOL.length) | 0]).join('');
/** Characters flicker and resolve left-to-right into `text` (used for technique IDs, banners, boss names). */
export function Decrypt({ text = '', ms = 650, cls = '', tag = 'span' }) {
  const [out, setOut] = useState(() => motionOK() ? scramble(text, 0) : text);
  useEffect(() => {
    if (!motionOK()) { setOut(text); return; }
    let live = true, id = 0; const t0 = performance.now(); let lastT = 0;
    const step = (t) => { if (!live) return; const k = Math.min(1, (t - t0) / ms); if (t - lastT > 40 || k === 1) { lastT = t; setOut(k === 1 ? text : scramble(text, Math.floor(k * text.length))); } if (k < 1) id = raf(step); };
    id = raf(step); return () => { live = false; cancelAnimationFrame(id); };
  }, [text]);
  return html`<${tag} class=${cx('dec', cls)} aria-label=${text}><span aria-hidden="true">${out}</span><//>`;
}

/** Counts up to `to` (ease-out). */
export function Count({ to = 0, ms = 800, prefix = '', suffix = '', delay = 0, cls = '' }) {
  const [v, setV] = useState(() => motionOK() ? 0 : to);
  useEffect(() => {
    if (!motionOK() || !to) { setV(to); return; }
    let live = true, id = 0; const t0 = performance.now() + delay;
    const step = (t) => { if (!live) return; const k = Math.max(0, Math.min(1, (t - t0) / ms)); setV(Math.round(to * (1 - (1 - k) ** 3))); if (k < 1) id = raf(step); };
    id = raf(step); return () => { live = false; cancelAnimationFrame(id); };
  }, [to]);
  return html`<span class=${cls} aria-label=${prefix + to + suffix}><span aria-hidden="true">${prefix}${v}${suffix}</span></span>`;
}

const ART = { hacker: hackerSvg('hk'), analyst: analystSvg('an') };
/** Original illustrations. kind: 'hacker' (adversary) | 'analyst' (defender). */
export function Art({ kind = 'hacker', cls = '' }) { return html`<div class=${cx('art-wrap', 'art-' + kind, cls)} dangerouslySetInnerHTML=${{ __html: ART[kind] }}/>`; }
