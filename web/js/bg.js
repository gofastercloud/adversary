// Digital-rain background (canvas 2D, ~30 fps, pauses when hidden) plus the scenario palette.
// Replaces the old WebGL swirl: no GPU readbacks, one cheap fade + a handful of glyph draws per frame.
// Public API is unchanged (initBg, setPalette, setIntensity, flashBg, setBgEnabled, setBgQuality) plus surge() and setRain().

// Technique IDs (real ATT&CK identifiers) and hex fragments fall alongside katakana.
const IDS = ['T1078', 'T1566', 'T1059', 'T1190', 'T1486', 'T1003', 'T1021', 'T1055', 'T1027', 'T1105', 'T1071', 'T1053', 'T1547', 'T1082', 'T1018', 'T1041', 'T1567', 'T1490', 'T1562', 'T1133', 'T1110', 'T1556', 'T1621', 'T1204', 'T1068', 'T1005', 'T1219', 'T1112', 'T1070', 'T1036', 'TA0001', 'TA0040', 'M1032', 'M1026', 'M1051', '0x7F', '0xDEAD', '0xC0DE'];
const KANA = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾅﾆﾇﾈﾉﾊﾋﾌﾍﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ';
const LATIN = '0123456789ABCDEF<>/\\|=+*:;';

// The default (enterprise) theme is blue; the Matrix skin maps it to phosphor green. Any other scenario theme
// (for example the amber utilities one) keeps its own accent, so scenario identity is honoured.
const MATRIX = { accent: '#00ff9c', accent2: '#3ad6ff', bg: ['#04120b', '#06200f', '#0a2e18'] };
const LEGACY_DEFAULT = '#5ad1ff';
export const resolveTheme = (t) => !t || String(t.accent).toLowerCase() === LEGACY_DEFAULT ? MATRIX : t;

const hexRgb = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
let canvas, ctx, raf = 0, last = 0, acc = 0;
let enabled = true, rainOn = true, motionOn = true, hasKana = true, running = false;
let cell = 18, fps = 30, cols = [], W = 0, H = 0;
let rgb = hexRgb(MATRIX.accent), pulse = 0, surgeUntil = 0, intensity = 1;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const pick = (s) => s[(Math.random() * s.length) | 0];
const glyph = () => hasKana && Math.random() < 0.62 ? pick(KANA) : pick(LATIN);

function detectKana() {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 20; const x = c.getContext('2d', { willReadFrequently: true });
    const sum = (ch) => { x.clearRect(0, 0, 20, 20); x.font = '16px monospace'; x.fillStyle = '#fff'; x.fillText(ch, 2, 16); const d = x.getImageData(0, 0, 20, 20).data; let s = 0; for (let i = 3; i < d.length; i += 4) s = (s * 31 + d[i]) >>> 0; return s; };
    const a = sum('ｱ'), b = sum('ｷ'), z = sum('ﾈ'); hasKana = !(a === b && b === z);
  } catch { hasKana = false; }
}

function makeCol(i, first) {
  const speed = 5 + Math.random() * 15;
  const col = { x: i * cell, y: first ? -Math.random() * (H / cell) : -Math.random() * 30, speed, str: null, si: 0, prev: -1 };
  if (Math.random() < 0.09) { col.str = pick(IDS); col.si = 0; }
  return col;
}
function layout() {
  if (!canvas) return;
  const w = Math.max(2, innerWidth), h = Math.max(2, innerHeight);
  canvas.width = W = w; canvas.height = H = h;
  ctx = canvas.getContext('2d', { alpha: true });
  ctx.textBaseline = 'top'; ctx.font = `${cell}px VT323, "JetBrains Mono", monospace`;
  const n = Math.ceil(w / cell);
  cols = Array.from({ length: n }, (_, i) => makeCol(i, true));
  ctx.clearRect(0, 0, W, H);
}
const col2 = (a) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
function tint() { // mix toward alert red while the pulse is up
  const k = Math.min(1, pulse); return [rgb[0] + (255 - rgb[0]) * k, rgb[1] + (60 - rgb[1]) * k, rgb[2] + (90 - rgb[2]) * k].map(Math.round);
}
function draw(dt) {
  const now = performance.now(); const mult = (now < surgeUntil ? 3.2 : 1) * (1 + pulse * 1.5);
  const c = tint(); const body = `rgb(${c[0]},${c[1]},${c[2]})`; const head = `rgb(${Math.min(255, c[0] + 170)},${Math.min(255, c[1] + 90)},${Math.min(255, c[2] + 140)})`;
  ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = `rgba(0,0,0,${now < surgeUntil ? 0.05 : 0.075})`; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  const rows = H / cell;
  for (let i = 0; i < cols.length; i++) {
    const k = cols[i]; k.y += k.speed * dt * mult; const row = Math.floor(k.y);
    if (row < 0) continue;
    while (k.prev < row) {
      k.prev++; if (k.prev < 0) continue;
      const y = k.prev * cell;
      // previous head cell drops to body colour
      if (k.prev > 0) { ctx.fillStyle = body; ctx.clearRect(k.x, y - cell, cell, cell); ctx.fillText(k.last || glyph(), k.x, y - cell); }
      const ch = k.str ? (k.si < k.str.length ? k.str[k.si++] : (k.str = null, glyph())) : glyph(); k.last = ch;
      ctx.clearRect(k.x, y, cell, cell); ctx.fillStyle = head; ctx.fillText(ch, k.x, y);
    }
    if (Math.random() < 0.02 && k.prev > 3) { const sy = (k.prev - 2 - ((Math.random() * 9) | 0)) * cell; if (sy > 0) { ctx.clearRect(k.x, sy, cell, cell); ctx.fillStyle = col2(0.55); ctx.fillText(glyph(), k.x, sy); } }
    if (row > rows + 2 + Math.random() * 12) { cols[i] = makeCol(i, false); cols[i].y = -Math.random() * 14; cols[i].prev = -1; }
  }
  if (pulse > 0.01) pulse *= 0.93; else pulse = 0;
}
function frame(t) {
  raf = requestAnimationFrame(frame);
  if (document.hidden) { last = 0; return; }
  if (!last) last = t; const step = 1000 / fps; acc += t - last; last = t;
  if (acc < step) return; const dt = Math.min(0.1, acc / 1000); acc = 0; draw(dt);
}
function start() { if (running || !canvas || !enabled || !rainOn) return; running = true; last = 0; raf = requestAnimationFrame(frame); }
function stop() { running = false; cancelAnimationFrame(raf); raf = 0; }
function applyState() {
  if (!canvas) return;
  const on = enabled && rainOn;
  canvas.style.display = on ? '' : 'none';
  if (!on) { stop(); return; }
  if (reduced() || !motionOn) { // motion off: one still frame of rain, no loop
    stop(); layout(); for (let i = 0; i < 160; i++) draw(1 / 30); return;
  }
  start();
}

export function initBg(c) {
  canvas = c; detectKana();
  const go = () => { layout(); applyState(); };
  (document.fonts?.load ? document.fonts.load('16px VT323').catch(() => {}) : Promise.resolve()).then(go);
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { layout(); if (!running) applyState(); }, 150); });
  document.addEventListener('visibilitychange', () => { last = 0; });
}
export function setPalette(theme) {
  const t = resolveTheme(theme); rgb = hexRgb(t.accent);
  const r = document.documentElement.style;
  r.setProperty('--accent', t.accent); r.setProperty('--accent2', t.accent2);
  r.setProperty('--bg1', t.bg[0]); r.setProperty('--bg2', t.bg[1]); r.setProperty('--bg3', t.bg[2]);
}
/** 0..1: how visible the rain is. Battles dim it so the board stays readable. */
export const setIntensity = (v) => { intensity = v; if (canvas) canvas.style.opacity = String(v); };
export const flashBg = (v = 1) => { pulse = Math.min(1.2, pulse + v * 0.8); };
/** Rain surge (boss entrance): faster, brighter columns for a short while. */
export const surge = (ms = 2500) => { surgeUntil = performance.now() + ms; };
/** Master switch driven by the "animated background" setting. */
export const setBgEnabled = (v) => { enabled = !!v; applyState(); };
export const setBgMotion = (v) => { motionOn = !!v; applyState(); };
export const setRain = (v) => { rainOn = !!v; applyState(); };
export const setBgQuality = (q) => { const nc = q === 'high' ? 14 : q === 'low' ? 22 : 17; fps = q === 'low' ? 20 : 30; if (nc !== cell) { cell = nc; layout(); } };
export const rainState = () => ({ running, intensity, kana: hasKana });
