#!/usr/bin/env node
// Responsive + accessibility audit: axe-core on every screen/phase reached, at a range of viewports, plus layout checks
// (horizontal overflow, clipped controls, touch-target size, 200% zoom reflow, keyboard focus reachability).
//   node scripts/a11y.mjs [--viewports 320x568,...] [--steps 260] [--json lab/out/a11y.json]
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const URL_ = arg('url', 'http://localhost:5173/'), STEPS = +arg('steps', 260);
const VPS = arg('viewports', '320x568,360x740,390x844,844x390,768x1024,1024x768,1440x900,1920x1080,720x450').split(',').map(v => v.split('x').map(Number));
const AXE = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');
let server = null;
try { await fetch(URL_, { signal: AbortSignal.timeout(1500) }); } catch { server = spawn('node', ['scripts/dev-server.mjs', '--no-build', '--port', '5173'], { stdio: 'ignore' }); for (let i = 0; i < 40; i++) { try { await fetch(URL_, { signal: AbortSignal.timeout(500) }); break; } catch { await new Promise(r => setTimeout(r, 250)); } } }
process.on('exit', () => { try { server?.kill(); } catch { /* gone */ } });
const browser = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const issues = new Map();   // key -> {rule, impact, help, where:Set, nodes:[]}
const add = (rule, impact, help, where, node) => { const k = rule + '|' + help; const e = issues.get(k) || { rule, impact, help, where: new Set(), nodes: new Set() }; e.where.add(where); if (node) e.nodes.add(node.slice(0, 140)); issues.set(k, e); };
const rnd = (() => { let s = 4242; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; })();

async function audit(page, where) {
  await page.evaluate(AXE);
  const r = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] } }));
  for (const v of r.violations) for (const n of v.nodes.slice(0, 4)) add(v.id, v.impact, v.help, where, n.target.join(' '));
  const l = await page.evaluate(() => {
    const de = document.documentElement, out = { over: de.scrollWidth - de.clientWidth, small: [], clipped: [] };
    const vis = e => { const s = getComputedStyle(e), q = e.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && q.width > 0 && q.height > 0 && +s.opacity > 0.05; };
    for (const e of document.querySelectorAll('button, a[href], [role=button], input, select, textarea, [tabindex="0"]')) {
      if (!vis(e) || e.closest('[aria-hidden=true]')) continue; const q = e.getBoundingClientRect();
      if (q.width < 24 || q.height < 24) out.small.push((e.className?.toString?.().split(' ')[0] || e.tagName) + ` ${Math.round(q.width)}x${Math.round(q.height)} "${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 24)}"`);
      if (q.right > innerWidth + 1 && !e.closest('.scroll-x, .hand, [data-scroll]')) out.clipped.push((e.className?.toString?.().split(' ')[0] || e.tagName) + ` right=${Math.round(q.right)}`);
    }
    return out;
  });
  if (l.over > 2) add('layout-overflow', 'serious', `Horizontal overflow ${l.over}px`, where);
  for (const s of l.small.slice(0, 6)) add('target-size', 'moderate', 'Touch/click target under 24px', where, s);
  for (const s of l.clipped.slice(0, 4)) add('clipped-control', 'serious', 'Control extends past viewport', where, s);
}

for (const [w, h] of VPS) {
  const vp = `${w}x${h}`; const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', hasTouch: w < 800 });
  const page = await ctx.newPage(); const seen = new Set();
  page.on('pageerror', e => add('pageerror', 'critical', e.message.slice(0, 120), vp));
  const once = async (name) => { if (seen.has(name)) return; seen.add(name); await page.waitForTimeout(350); await audit(page, `${vp} ${name}`); };
  await page.goto(URL_); await page.waitForTimeout(1200); await once('title');
  // keyboard: the first Tab must land on something visible, and focus must be visible
  await page.keyboard.press('Tab'); const foc = await page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body) return null; const s = getComputedStyle(e); return { outline: s.outlineStyle !== 'none' || s.boxShadow !== 'none' }; });
  if (!foc) add('keyboard', 'serious', 'Tab does not move focus into the page', vp); else if (!foc.outline) add('focus-visible', 'serious', 'Focused control has no visible indicator', vp);
  for (const s of ['setup', 'codex', 'achievements', 'settings', 'docs', 'daily', 'ttx']) { await page.evaluate(x => window.__adv.app.goto(x), s).catch(() => {}); await once(s); }
  await page.evaluate(() => window.__adv.app.startTutorial()); await page.waitForTimeout(900); await once('tutorial');
  await page.evaluate(() => window.__adv.app.finishTutorial?.(true)); await page.evaluate(() => window.__adv.app.quitToTitle?.()); await page.waitForTimeout(400);
  await page.evaluate(() => window.__adv.app.goto('setup')); await page.waitForTimeout(500);
  const click = async (sel) => { const l = page.locator(sel).first(); if (!(await l.count())) return false; try { await l.click({ timeout: 1500 }); return true; } catch { return false; } };
  if (await click('text=Begin operation')) {
    await page.waitForTimeout(600);
    for (let i = 0; i < STEPS; i++) {
      const st = await page.evaluate(() => { const s = window.__adv.store.get(); return { screen: s.screen, phase: s.run?.phase, over: s.run?.battle?.over, pending: !!s.run?.battle?.ttx?.pending }; });
      if (st.phase === 'won' || st.phase === 'lost' || st.screen === 'result') { await once('result'); break; }
      const nm = `${st.screen}/${st.phase}${st.pending ? '/inject' : ''}${st.over ? '/over' : ''}`; await once(nm);
      if (st.over && await click('text=Debrief')) continue;
      switch (st.phase) {
        case 'map': (await click('.node.avail')); break;
        case 'briefing': await click('text=Begin battle'); break;
        case 'battle': {
          if (st.over) { (await click('text=Continue')) || (await click('.modal .btn')); break; }
          if (st.pending) { (await click('.ttx .choice')) || (await click('.modal .btn')); break; }
          const n = await page.locator('.hand .card.playable').count();
          if (n && rnd() < 0.7) { await page.locator('.hand .card.playable').nth(Math.floor(rnd() * n)).click({ timeout: 1500 }).catch(() => {}); await page.waitForTimeout(100); await once('battle/selected');
            const t = page.locator('.asset.targetable, .fh.targetable, .slot.targetable'); if (await t.count()) await t.first().click({ timeout: 1500, force: true }).catch(() => {}); else await page.locator('.hand .card.selected').first().click({ timeout: 1000 }).catch(() => {}); await page.waitForTimeout(250); }
          else { await click('text=End turn'); await page.waitForTimeout(800); }
          break; }
        case 'reward': (await click('.reward .cards .card')) || (await click('.reward .relic')) || (await click('text=Continue')) || (await click('.reward .btn')); break;
        case 'shop': (await click('text=Continue')) || (await click('text=Leave')); break;
        case 'rest': if (!(await click('.rest-opt:not([disabled])'))) await click('text=Continue'); else { await page.waitForTimeout(200); (await click('.modal .card')) && (await click('.modal .btn.primary')); } break;
        case 'event': (await click('.event .choices .btn')) || (await click('text=Continue')); break;
        case 'whiteboard': (await click('.stride-btns .btn')) || (await click('text=Next')) || (await click('text=Finish')); break;
        default: await page.waitForTimeout(150);
      }
      await page.waitForTimeout(60);
    }
  }
  await ctx.close();
}
await browser.close();
const out = [...issues.values()].map(e => ({ ...e, where: [...e.where], nodes: [...e.nodes] })).sort((a, b) => ['critical', 'serious', 'moderate', 'minor'].indexOf(a.impact) - ['critical', 'serious', 'moderate', 'minor'].indexOf(b.impact));
mkdirSync('lab/out', { recursive: true }); writeFileSync(arg('json', 'lab/out/a11y.json'), JSON.stringify(out, null, 1));
for (const e of out) console.log(`[${e.impact}] ${e.rule}: ${e.help} (${e.where.length} places)\n    ${e.where.slice(0, 4).join(' | ')}\n    ${e.nodes.slice(0, 3).join(' | ')}`);
console.log(out.length ? `${out.length} distinct issues` : 'a11y ok');
process.exit(out.some(e => ['critical', 'serious'].includes(e.impact)) ? 1 : 0);
