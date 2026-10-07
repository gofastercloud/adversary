#!/usr/bin/env node
// UI end-to-end bot (Playwright + the local dev server). It plays real runs through the DOM at several viewports and fails on:
// console errors, uncaught exceptions, failed requests, horizontal overflow, key controls outside the viewport, and stuck screens.
//   node scripts/e2e.mjs [--runs 2] [--steps 500] [--url http://localhost:5173/] [--viewports 1440x900,1024x768,390x844]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg('url', 'http://localhost:5173/'), RUNS = +arg('runs', 2), STEPS = +arg('steps', 500);
const VIEWPORTS = arg('viewports', '1440x900,1024x768,390x844').split(',').map(v => v.split('x').map(Number));
const SHOTS = process.env.SHOT_DIR || 'lab/out/e2e'; mkdirSync(SHOTS, { recursive: true });
const rnd = (() => { let s = 12345; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; })();
const pick = a => a[Math.floor(rnd() * a.length)];
const problems = [];
const bad = (vp, m) => { if (problems.length < 60) problems.push(`[${vp}] ${m}`); };

// start the dev server ourselves when nothing is listening (dist/web must be built: npm run build)
let server = null;
try { await fetch(URL_, { signal: AbortSignal.timeout(1500) }); } catch {
  const port = new URL(URL_).port || 5173;
  server = spawn('node', ['scripts/dev-server.mjs', '--no-build', '--port', String(port)], { stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { try { await fetch(URL_, { signal: AbortSignal.timeout(500) }); break; } catch { await new Promise(r => setTimeout(r, 250)); } }
}
const stopServer = () => { try { server?.kill(); } catch { /* already gone */ } };
process.on('exit', stopServer);
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
async function checkLayout(page, vp, where) {
  const r = await page.evaluate(() => {
    const de = document.documentElement; const over = de.scrollWidth - de.clientWidth;
    const btn = [...document.querySelectorAll('button')].find(b => /end turn/i.test(b.textContent || '')); let btnIn = true;
    if (btn) { const q = btn.getBoundingClientRect(); btnIn = q.right <= innerWidth + 1 && q.bottom <= innerHeight + 1 && q.left >= -1 && q.top >= -1; }
    return { over, btnIn, hasBtn: !!btn };
  });
  if (r.over > 2) bad(vp, `${where}: horizontal overflow ${r.over}px`);
  if (r.hasBtn && !r.btnIn) bad(vp, `${where}: End turn button is outside the viewport`);
}

for (const [w, h] of VIEWPORTS) {
  const vp = `${w}x${h}`;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', e => bad(vp, 'PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/401|Failed to load resource/.test(m.text())) bad(vp, 'console error: ' + m.text().slice(0, 200)); });
  page.on('requestfailed', r => { if (!/\/api\//.test(r.url())) bad(vp, 'request failed: ' + r.url()); });
  await page.goto(URL_); await page.waitForTimeout(1200);
  await checkLayout(page, vp, 'title');
  const store = () => page.evaluate(() => { const s = window.__adv.store.get(); return { screen: s.screen, phase: s.run?.phase, over: s.run?.battle?.over, pending: !!s.run?.battle?.ttx?.pending, round: s.run?.battle?.round, ach: Object.keys(s.profile?.ach?.unlocked || {}).length }; });
  const click = async (sel, opt = {}) => { const l = page.locator(sel).first(); if (await l.count() === 0) return false; try { await l.click({ timeout: 2000, ...opt }); return true; } catch { return false; } };

  // ── tutorial, via real clicks
  await page.evaluate(() => window.__adv.app.startTutorial()); await page.waitForTimeout(900);
  const next = async () => { await click('.coach .btn.primary'); await page.waitForTimeout(350); };
  for (let i = 0; i < 4; i++) await next();
  const tutOk = await (async () => {
    if (!(await click('[data-card="c.protect.spoofing"]'))) return 'mfa card missing';
    await page.waitForTimeout(250); if (!(await click('[data-asset="mail"]'))) return 'mail asset missing'; await page.waitForTimeout(900);
    if (!(await click('[data-card="c.identify.repudiation"]'))) return 'intel card missing'; await page.waitForTimeout(250); await click('[data-card="c.identify.repudiation"]'); await page.waitForTimeout(900);
    await next(); await checkLayout(page, vp, 'tutorial'); return null;
  })();
  if (tutOk) bad(vp, 'tutorial: ' + tutOk);
  await page.evaluate(() => window.__adv.app.finishTutorial?.(true)); await page.waitForTimeout(500);
  await page.evaluate(() => window.__adv.app.quitToTitle?.()); await page.waitForTimeout(500);

  for (let run = 0; run < RUNS; run++) {
    await page.evaluate(() => window.__adv.app.goto('setup')); await page.waitForTimeout(500);
    if (run % 2 === 1) await click('.scn-card >> nth=' + (1 + run), {});          // vary scenario when the picker is present
    if (!(await click('text=Begin operation'))) { bad(vp, 'setup: Begin operation not clickable'); continue; }
    await page.waitForTimeout(700);
    let stuck = 0, lastKey = '';
    for (let step = 0; step < STEPS; step++) {
      const st = await store(); const key = JSON.stringify(st);
      if (st.phase === 'won' || st.phase === 'lost' || st.screen === 'result') { await page.screenshot({ path: `${SHOTS}/${vp}-result-${run}.png` }); break; }
      stuck = key === lastKey ? stuck + 1 : 0; lastKey = key;
      if (stuck > 25) { bad(vp, `stuck at ${JSON.stringify(st)}`); await page.screenshot({ path: `${SHOTS}/${vp}-stuck-${run}.png` }); await page.evaluate(() => window.__adv.app.act({ type: 'FORFEIT' })); break; }
      if (st.over && await click('text=Debrief')) { await page.waitForTimeout(400); continue; }
      switch (st.phase) {
        case 'map': await click('.node.avail >> nth=' + Math.floor(rnd() * 2)) || await click('.node.avail'); break;
        case 'briefing': await checkLayout(page, vp, 'briefing'); await click('text=Begin battle'); break;
        case 'battle': {
          if (st.over) { await click('text=Continue') || await click('.modal .btn'); break; }
          if (st.pending) { await click('.ttx .choice >> nth=0') || await click('.modal .btn'); break; }
          const n = await page.locator('.hand .card.playable').count();
          if (n && rnd() < 0.75) {
            await page.locator('.hand .card.playable').nth(Math.floor(rnd() * n)).click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(120);
            const t = page.locator('.asset.targetable, .fh.targetable, .slot.targetable'); const tn = await t.count();
            if (tn) await t.nth(Math.floor(rnd() * tn)).click({ timeout: 2000, force: true }).catch(() => {});
            else await page.locator('.hand .card.selected').first().click({ timeout: 1500 }).catch(() => {});
            await page.waitForTimeout(300);
          } else { await checkLayout(page, vp, 'battle'); await click('text=End turn'); await page.waitForTimeout(900); }
          break;
        }
        case 'reward': { if (!(await click('.reward .cards .card >> nth=0'))) { if (!(await click('.reward .relic'))) await click('text=Continue') || await click('.reward .btn'); } else await page.waitForTimeout(300); break; }
        case 'shop': await checkLayout(page, vp, 'shop'); if (rnd() < 0.5) await click('.shop .goods .card >> nth=' + Math.floor(rnd() * 3)); await click('text=Continue') || await click('text=Leave'); break;
        case 'rest': if (!(await click('.rest-opt:not([disabled]) >> nth=0'))) await click('text=Continue'); else { await page.waitForTimeout(250); await click('.modal .card >> nth=0'); await click('text=Continue'); } break;
        case 'event': if (!(await click('.event .choices .btn >> nth=0'))) await click('text=Continue'); break;
        case 'whiteboard': { await checkLayout(page, vp, 'whiteboard'); if (!(await click('.stride-btns .btn >> nth=' + Math.floor(rnd() * 6)))) { (await click('text=Next')) || (await click('text=Finish')); } break; }
        default: await page.waitForTimeout(200);
      }
      await page.waitForTimeout(60);
    }
  }
  await ctx.close();
}
await browser.close();
if (problems.length) { console.log('E2E PROBLEMS:\n' + problems.join('\n')); process.exit(1); }
console.log('e2e ok:', VIEWPORTS.map(v => v.join('x')).join(', '), RUNS + ' runs each');
