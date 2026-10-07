// The guided first battle. Fully scripted (fixed deck order and adversary hand) so every coach message is true.
import { newRun } from './run.js';
import * as B from './battle.js';

export const TUT = {
  adversary: { id: 'G0092', tier: 1 },
  deck: ['c.protect.spoofing', 'c.identify.repudiation', 'c.protect.elevation', 'x.threathunt', 'c.respond.spoofing', 'c.respond.spoofing', 'c.detect.spoofing', 'c.protect.tampering', 'c.identify.spoofing', 'c.recover.dos', 'c.respond.tampering', 'x.patch'],
  // iids d0..d11 map to the deck above. Draw order = round-1 hand, the card drawn by d1, then the round-2 hand.
  drawOrder: ['d0', 'd1', 'd6', 'd2', 'd9', 'd7', 'd3', 'd4', 'd5', 'd8', 'd10', 'd11'],   // d7 is the card Log Source Inventory draws
  advOrder: ['T1566.001', 'T1071.001', 'T1033', 'T1055.001', 'T1005', 'T1486']
};

export function tutorialRun(content) {
  const run = newRun(content, { seed: 'tutorial', doctrine: 'architect', assurance: 0 });
  run.mode = 'tutorial';
  run.deck = TUT.deck.map((id, i) => ({ iid: 'd' + i, id, ml: 1 })); run.nextIid = TUT.deck.length;
  run.relics = []; run.res = { cur: 30, max: 30 }; run.money = 0;
  run.node = { type: 'battle', adv: TUT.adversary.id, tier: TUT.adversary.tier };
  run.visited.push({ act: 1, step: 0, type: 'battle' });
  run.phase = 'battle';
  run.battle = B.newBattle(content, { seed: 'tutorial-battle', deck: run.deck, adversary: TUT.adversary, resilience: run.res, relics: [], doctrine: 'architect', assurance: 0, drawOrder: TUT.drawOrder, advOrder: TUT.advOrder, energyBonus: 1 });
  return run;
}
