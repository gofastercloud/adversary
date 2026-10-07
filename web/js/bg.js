// Swirling "paint" shader background tinted by the current scenario palette. Falls back to a CSS gradient.
const VS = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }';
const FS = `precision highp float; uniform vec2 res; uniform float t; uniform vec3 c1; uniform vec3 c2; uniform vec3 c3; uniform float intensity; uniform float pulse;
void main(){
  vec2 uv = (gl_FragCoord.xy - .5*res) / length(res) / 0.55;
  float len = length(uv);
  float ang = atan(uv.y, uv.x) + 0.35 * t * 0.25 + 1.6 * (0.6 - len);
  uv = vec2(len * cos(ang), len * sin(ang)) * 26.;
  float sp = t * 1.6;
  vec2 uv2 = vec2(uv.x + uv.y);
  for (int i = 0; i < 5; i++) {
    uv2 += sin(max(uv.x, uv.y)) + uv;
    uv += .5 * vec2(cos(5.1123 + .353 * uv2.y + sp * .131), sin(uv2.x - .113 * sp));
    uv -= cos(uv.x + uv.y) - sin(uv.x * .711 - uv.y);
  }
  float paint = length(uv) * .035;
  float contrast = 2.1;
  float c1p = max(0., 1. - contrast * abs(1. - paint));
  float c2p = max(0., 1. - contrast * abs(paint));
  float c3p = 1. - min(1., c1p + c2p);
  vec3 col = c1 * c1p + c2 * c2p + c3 * c3p;
  col = mix(vec3(0.02, 0.03, 0.07), col * 1.7, 0.78 * intensity + 0.15 * pulse);
  float v = smoothstep(1.3, .2, len * .75);
  col *= .35 + .75 * v;
  col += pulse * vec3(.35, .02, .06) * (1. - v);
  gl_FragColor = vec4(col, 1.);
}`;
let gl, prog, loc, raf, start = performance.now(), cols = [[.04, .06, .14], [.08, .1, .22], [.14, .1, .32]], intensity = 1, pulse = 0, canvas, enabled = true, scale = 0.5;
const hex = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
export function initBg(c) {
  canvas = c;
  try {
    gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) throw new Error('no webgl');
    const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
    prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog); gl.useProgram(prog);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const p = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(p); gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);
    loc = Object.fromEntries(['res', 't', 'c1', 'c2', 'c3', 'intensity', 'pulse'].map(n => [n, gl.getUniformLocation(prog, n)]));
    resize(); addEventListener('resize', resize); frame();
  } catch (e) { canvas.style.background = 'radial-gradient(circle at 30% 20%, #241a52, #0b1020 60%, #05070f)'; }
}
function resize() { if (!canvas) return; canvas.width = Math.max(2, Math.floor(innerWidth * scale)); canvas.height = Math.max(2, Math.floor(innerHeight * scale)); gl?.viewport(0, 0, canvas.width, canvas.height); }
function frame() {
  raf = requestAnimationFrame(frame);
  if (!enabled || document.hidden) return;
  const t = (performance.now() - start) / 1000;
  gl.uniform2f(loc.res, canvas.width, canvas.height); gl.uniform1f(loc.t, t);
  gl.uniform3fv(loc.c1, cols[0]); gl.uniform3fv(loc.c2, cols[1]); gl.uniform3fv(loc.c3, cols[2]); gl.uniform1f(loc.intensity, intensity); pulse *= 0.96; gl.uniform1f(loc.pulse, pulse);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
export function setPalette(theme) {
  if (!theme) return;
  cols = theme.bg.map(hex);
  const r = document.documentElement.style;
  r.setProperty('--accent', theme.accent); r.setProperty('--accent2', theme.accent2);
  r.setProperty('--bg1', theme.bg[0]); r.setProperty('--bg2', theme.bg[1]); r.setProperty('--bg3', theme.bg[2]);
}
export const setIntensity = (v) => { intensity = v; };
export const flashBg = (v = 1) => { pulse = Math.min(1.5, pulse + v); };
export const setBgEnabled = (v) => { enabled = v; if (!v && canvas) { canvas.style.background = '#070a14'; } };
export const setBgQuality = (q) => { scale = q === 'high' ? 0.8 : q === 'low' ? 0.3 : 0.5; resize(); };
