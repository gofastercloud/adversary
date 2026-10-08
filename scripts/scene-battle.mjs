import { withPage } from './shot.mjs';
const W = +(process.argv[2] || 1440), H = +(process.argv[3] || 900);
await withPage(async (page, shot) => {
  await page.waitForTimeout(1200); await shot('01-title');
  await page.click('text=New run'); await page.waitForTimeout(700); await shot('02-setup');
  await page.click('text=Begin operation'); await page.waitForTimeout(1200); await shot('03-map');
  await page.locator('.node.avail').first().click(); await page.waitForTimeout(800); await shot('04-briefing');
  await page.click('text=Begin battle'); await page.waitForTimeout(1500); await shot('05-battle');
}, { w: W, h: H });
