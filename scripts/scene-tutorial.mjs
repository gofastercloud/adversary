import { withPage } from './shot.mjs';
await withPage(async (page, shot) => {
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.__adv.app.startTutorial());
  await page.waitForTimeout(1200);
  const next = async () => { await page.click('.coach .btn.primary'); await page.waitForTimeout(500); };
  await shot('30-tut-welcome'); await next();     // welcome
  await shot('31-tut-adv'); await next();          // adv
  await next();                                    // intent
  await shot('32-tut-assets'); await next();       // assets
  await shot('33-tut-mfa');
  await page.click('[data-card="c.protect.spoofing"]'); await page.waitForTimeout(400);
  await page.click('[data-asset="mail"]'); await page.waitForTimeout(1200);
  await shot('34-tut-intel');
  await page.click('[data-card="c.identify.repudiation"]'); await page.waitForTimeout(300); await page.click('[data-card="c.identify.repudiation"]'); await page.waitForTimeout(1200);
  await next();                                    // intent2
  await shot('35-tut-end');
  await page.click('text=End turn'); await page.waitForTimeout(3500);
  await shot('36-tut-fog'); await next();
  await page.click('[data-card="x.threathunt"]'); await page.waitForTimeout(300); await page.click('[data-card="x.threathunt"]'); await page.waitForTimeout(1500);
  await shot('37-tut-evict');
  await page.click('[data-card="c.respond.spoofing"] >> nth=0'); await page.waitForTimeout(400);
  await page.locator('.fh.targetable').first().click(); await page.waitForTimeout(1500);
  await shot('38-tut-done');
  console.log('coach title:', await page.locator('.coach h4').innerText());
}, { w: 1440, h: 900 });
