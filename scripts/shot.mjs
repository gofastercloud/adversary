// Screenshot harness: node scripts/shot.mjs <name> [--w 1440 --h 900]; scenes defined below drive the UI via window.__adv.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
const out = process.env.SHOT_DIR || '/tmp/claude-0/-home-user-adversary/4fb29aa3-3591-51a0-b1b8-f499a96d3df0/scratchpad/shots';
mkdirSync(out, { recursive: true });
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
export async function withPage(fn, { w = +arg('w', 1440), h = +arg('h', 900), url = process.env.URL || 'http://localhost:5173/' } = {}) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message)); page.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push(m.type().toUpperCase() + ' ' + m.text()); });
  await page.goto(url); await page.waitForTimeout(800);
  try { await fn(page, (n) => page.screenshot({ path: `${out}/${n}.png` })); } finally { await browser.close(); }
  if (errors.length) console.log('--- browser console ---\n' + [...new Set(errors)].slice(0, 20).join('\n'));
  return errors;
}
if (process.argv[1].endsWith('shot.mjs')) {
  await withPage(async (page, shot) => { await shot(arg('name', 'title')); });
  console.log('shots in', out);
}
