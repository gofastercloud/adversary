import { withPage } from './shot.mjs';
await withPage(async (page, shot) => {
  await page.waitForTimeout(1000);
  await page.evaluate(async () => {
    const { app, store } = window.__adv;
    await app.startRun({ scenario: 'enterprise', doctrine: 'architect', assurance: 1, seed: 'wbtest' });
    const run = store.get().run;
    store.set({ run: { ...run, phase: 'whiteboard', whiteboard: { system: 0, qs: ['hi3', 'hi1', 'hi6'], answers: [], done: false } } });
  });
  await page.waitForTimeout(700); await shot('20-wb');
  await page.click('.stride-btns .btn >> nth=0'); await page.waitForTimeout(800); await shot('21-wb-answer');
}, { w: 1440, h: 900 });
