// Design review harness: node scripts/scene-design.mjs <prefix> [w] [h]
// Captures title, setup, map, briefing, battle (mid-fight), reward, shop, rest, event, codex, achievements, settings, result.
import { withPage } from './shot.mjs';
const P = process.argv[2] || 'x', W = +(process.argv[3] || 1440), H = +(process.argv[4] || 900);
const tag = `${P}-${W}`;
await withPage(async (page, shot) => {
  const s = (n) => shot(`${tag}-${n}`);
  await page.waitForTimeout(1500); await s('01-title');
  await page.click('text=New run'); await page.waitForTimeout(800); await s('02-setup');
  await page.click('text=Begin operation'); await page.waitForTimeout(1200); await s('03-map');
  await page.locator('.node.avail').first().click(); await page.waitForTimeout(1200); await s('04-briefing');
  await page.click('text=Begin battle'); await page.waitForTimeout(1600);
  // play a couple of cards to get mid-fight state
  for (let k = 0; k < 2; k++) {
    const cards = page.locator('.hand .card:not(.unaffordable)'); if (!(await cards.count())) break;
    await cards.first().click(); await page.waitForTimeout(300);
    const t = page.locator('.asset.targetable'); if (await t.count()) await t.first().click(); else if (await page.locator('.card.selected').count()) await cards.first().click();
    await page.waitForTimeout(600);
  }
  await page.waitForTimeout(500); await s('05-battle');
  await page.click('text=End turn'); await page.waitForTimeout(1500); await s('06-adv-turn'); await page.waitForTimeout(5000);
  await s('07-battle-after');
  // force a win to reach the reward
  await page.evaluate(() => { const { app, store } = window.__adv; const r = store.get().run; const b = { ...r.battle, expo: { ...r.battle.expo, cur: r.battle.expo.max } }; store.set({ run: { ...r, battle: b } }); });
  await page.evaluate(() => { const { app } = window.__adv; app.act({ type: 'BATTLE', action: { type: 'END_TURN' } }); });
  await page.waitForTimeout(2600); await s('08-battle-won');
  await page.evaluate(() => window.__adv.store.set({ holdBattle: false })); await page.waitForTimeout(1500); await s('09-reward');
  const goNode = async (type) => page.evaluate((type) => {
    const { app, store } = window.__adv; const st = store.get(); let r = st.run;
    if (r.phase !== 'map') r = { ...r, phase: 'map', battle: null };
    for (let a = 0; a < r.map.length; a++) for (let si = 0; si < r.map[a].length; si++) { const i = r.map[a][si].findIndex(n => n.type === type); if (i >= 0) { store.set({ run: { ...r, act: a + 1, step: si } }); return app.act({ type: 'CHOOSE', index: i }).ok; } }
    return false;
  }, type);
  for (const [t, n] of [['shop', '10-shop'], ['rest', '11-rest'], ['event', '12-event']]) { const ok = await goNode(t); await page.waitForTimeout(1300); if (ok) await s(n); }
  await page.evaluate(() => { const { store } = window.__adv; const r = store.get().run; store.set({ run: { ...r, phase: 'map', battle: null, act: 1, step: 0 } }); });
  await page.evaluate(() => window.__adv.app.goto('codex')); await page.waitForTimeout(1200); await s('13-codex');
  await page.evaluate(() => window.__adv.app.goto('achievements')); await page.waitForTimeout(1200); await s('14-achievements');
  await page.evaluate(() => window.__adv.app.goto('settings')); await page.waitForTimeout(800); await s('15-settings');
  await page.evaluate(() => { const { store, app } = window.__adv; const r = store.get().run; store.set({ screen: 'run', run: { ...r, phase: 'map' } }); });
  // result: forfeit from a fresh battle
  await page.evaluate(async () => { const { app, store } = window.__adv; await app.startRun({ scenario: 'enterprise', doctrine: 'architect', assurance: 1, seed: 'resseed' }); app.act({ type: 'CHOOSE', index: 0 }); app.act({ type: 'START_BATTLE' }); app.act({ type: 'BATTLE', action: { type: 'FORFEIT' } }); store.set({ holdBattle: false }); });
  await page.waitForTimeout(1800); await s('16-result-lost');
  await page.evaluate(() => { const { store } = window.__adv; const r = store.get().run; store.set({ run: { ...r, result: { ...r.result, won: true }, phase: 'won' } }); });
  await page.waitForTimeout(1800); await s('17-result-won');
}, { w: W, h: H });
console.log('done', tag);
