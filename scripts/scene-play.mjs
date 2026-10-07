import { withPage } from './shot.mjs';
await withPage(async (page, shot) => {
  await page.waitForTimeout(1200);
  await page.click('text=New run'); await page.waitForTimeout(500);
  await page.click('text=Begin operation'); await page.waitForTimeout(1000);
  await page.locator('.node.avail').first().click(); await page.waitForTimeout(600);
  await page.click('text=Begin battle'); await page.waitForTimeout(1400);
  await shot('10-battle-fit');
  // select the first deployable control and target the email gateway
  const cards = page.locator('.hand .card'); const n = await cards.count(); console.log('hand', n);
  for (let i = 0; i < n; i++) { const t = await cards.nth(i).locator('.card-type').innerText(); const nm = await cards.nth(i).locator('.card-name').innerText(); console.log(i, nm, '|', t); }
  await cards.nth(2).click(); await page.waitForTimeout(500); await shot('11-selected');
  const targets = page.locator('.asset.targetable'); console.log('targets', await targets.count());
  if (await targets.count()) { await targets.first().click(); await page.waitForTimeout(900); await shot('12-deployed'); }
  await page.click('text=End turn'); await page.waitForTimeout(900); await shot('13-adv-stage'); await page.waitForTimeout(3500); await shot('14-after-turn');
}, { w: 1440, h: 900 });
