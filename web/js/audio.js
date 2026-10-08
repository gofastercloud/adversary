// Procedural sound effects (Web Audio). No asset files; respects the mute/volume settings.
let ctx = null, master = null, vol = 0.5, muted = false;
function ensure() {
  if (ctx) return ctx;
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = vol; master.connect(ctx.destination); } catch { ctx = null; }
  return ctx;
}
export function setAudio({ volume, mute }) { if (volume != null) vol = volume; if (mute != null) muted = mute; if (master) master.gain.value = muted ? 0 : vol; }
export function unlock() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); }
function env(g, t0, a, d, peak = 1) { g.gain.cancelScheduledValues(t0); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d); }
function tone(freq, { t = 0, type = 'square', a = 0.005, d = 0.15, peak = 0.25, slide = 0, detune = 0 } = {}) {
  const c = ensure(); if (!c || muted) return; const t0 = c.currentTime + t;
  const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t0); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + a + d); o.detune.value = detune;
  env(g, t0, a, d, peak); o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + a + d + 0.05);
}
function noise({ t = 0, d = 0.2, peak = 0.2, hp = 800, lp = 8000 } = {}) {
  const c = ensure(); if (!c || muted) return; const t0 = c.currentTime + t; const n = c.sampleRate * d;
  const buf = c.createBuffer(1, n, c.sampleRate); const ch = buf.getChannelData(0); for (let i = 0; i < n; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = c.createBufferSource(); s.buffer = buf; const g = c.createGain(); const f1 = c.createBiquadFilter(); f1.type = 'highpass'; f1.frequency.value = hp; const f2 = c.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = lp;
  env(g, t0, 0.003, d, peak); s.connect(f1); f1.connect(f2); f2.connect(g); g.connect(master); s.start(t0);
}
const N = (semi) => 440 * Math.pow(2, (semi - 9) / 12);
export const sfx = {
  click() { tone(520, { d: .05, peak: .12, type: 'triangle' }); },
  hover() { tone(880, { d: .025, peak: .04, type: 'sine' }); },
  card() { noise({ d: .12, peak: .12, hp: 1200 }); tone(300, { d: .1, peak: .12, slide: -120, type: 'triangle' }); },
  deploy() { tone(N(0), { d: .12, peak: .22 }); tone(N(7), { t: .07, d: .16, peak: .2 }); noise({ d: .1, peak: .08 }); },
  reveal() { tone(N(12), { d: .08, peak: .2, type: 'triangle' }); tone(N(19), { t: .06, d: .18, peak: .2, type: 'triangle' }); },
  evict() { noise({ d: .35, peak: .28, hp: 300, lp: 3000 }); tone(N(-5), { d: .25, peak: .3, slide: -140, type: 'sawtooth' }); tone(N(7), { t: .1, d: .2, peak: .2 }); },
  block() { tone(N(-12), { d: .1, peak: .3, type: 'square' }); noise({ d: .08, peak: .15, hp: 2000 }); tone(N(0), { t: .06, d: .2, peak: .18, type: 'triangle' }); },
  hit() { noise({ d: .3, peak: .35, hp: 100, lp: 1200 }); tone(110, { d: .3, peak: .4, slide: -60, type: 'sawtooth' }); },
  big() { noise({ d: .7, peak: .4, hp: 60, lp: 900 }); tone(70, { d: .7, peak: .5, slide: -30, type: 'sawtooth' }); },
  adv() { tone(N(-12), { d: .18, peak: .22, type: 'sawtooth' }); tone(N(-11), { t: .02, d: .2, peak: .18, type: 'sawtooth' }); },
  energy() { tone(N(5), { d: .05, peak: .1, type: 'triangle' }); },
  coin() { tone(N(19), { d: .05, peak: .15, type: 'square' }); tone(N(24), { t: .06, d: .16, peak: .15, type: 'square' }); },
  buy() { sfx.coin(); tone(N(16), { t: .12, d: .2, peak: .12 }); },
  tick() { tone(1200, { d: .02, peak: .06 }); },
  turn() { tone(N(0), { d: .1, peak: .15, type: 'triangle' }); tone(N(4), { t: .08, d: .1, peak: .15, type: 'triangle' }); tone(N(7), { t: .16, d: .18, peak: .15, type: 'triangle' }); },
  win() { [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone(N(s), { t: i * .09, d: .3, peak: .22, type: 'square' })); },
  lose() { [7, 5, 2, -2].forEach((s, i) => tone(N(s - 12), { t: i * .22, d: .5, peak: .25, type: 'sawtooth', slide: -40 })); },
  ach(tier = 'bronze') { const base = { bronze: 0, silver: 2, gold: 4, platinum: 7 }[tier] ?? 0; [0, 4, 7, 12].forEach((s, i) => tone(N(base + s + 7), { t: i * .08, d: .45, peak: .2, type: 'triangle' })); tone(N(base + 31), { t: .4, d: .6, peak: .12, type: 'sine' }); },
  secret() { [12, 15, 19, 22, 27].forEach((s, i) => tone(N(s), { t: i * .06, d: .5, peak: .16, type: 'sine', detune: i * 6 })); noise({ t: .1, d: .5, peak: .05, hp: 4000 }); },
  levelup() { [0, 4, 7, 11, 14, 19, 23, 26].forEach((s, i) => tone(N(s), { t: i * .1, d: .5, peak: .2, type: 'square' })); },
  error() { tone(160, { d: .18, peak: .2, type: 'sawtooth' }); },
  whoosh() { noise({ d: .4, peak: .12, hp: 400, lp: 4000 }); },
  flip() { noise({ d: .06, peak: .1, hp: 3000 }); tone(N(10), { d: .06, peak: .08, type: 'triangle' }); },
  stinger() { tone(N(-12), { d: .6, peak: .3, type: 'sawtooth', slide: 30 }); tone(N(-5), { t: .1, d: .6, peak: .22, type: 'sawtooth' }); noise({ d: .5, peak: .1, hp: 100, lp: 700 }); }
};
