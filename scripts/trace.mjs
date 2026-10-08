import { loadContent } from './lib/load.mjs';
import * as B from '../engine/battle.js';
import { botTurn, starterDeck } from './lib/bot.mjs';
const [adv = 'G0102', tier = '2', doctrine = 'architect', seed = 't1'] = process.argv.slice(2);
const content = loadContent('enterprise');
const d = content.doctrines[doctrine];
const b = B.newBattle(content, { seed, deck: starterDeck(content, doctrine), adversary: { id: adv, tier: +tier }, resilience: { cur: d.maxResilience, max: d.maxResilience }, relics: [d.relic], doctrine });
const fmt = (e) => { const { t, ...r } = e; return t + ' ' + JSON.stringify(r).replace(/"/g, ''); };
let guard = 0;
while (!b.over && guard++ < 20) {
  const handBefore = b.hand.map(i => b.cards[i].id.replace('c.', '')).join(', ');
  console.log(`\n=== Round ${b.round}  energy ${b.energy.cur}  res ${b.res.cur}/${b.res.max}  expo ${b.expo.cur}/${b.expo.max}  hand: ${handBefore}`);
  console.log('   adv hand:', b.adv.hand.map(u => b.adv.cards[u].id + ':' + b.adv.cards[u].kind).join(' '), ' intent:', JSON.stringify(b.adv.intent));
  const evs = [];
  const orig = B.battleAction;
  // run bot with event capture: wrap by re-running actions via battleAction (bot calls it) — capture from b.events inside
  botTurn(content, b);
  console.log('   footholds:', b.footholds.map(f => `${f.asset}:${f.tech}${f.revealed ? '*' : ''}g${f.grip}${f.privileged ? 'P' : ''}${f.c2 ? 'C' : ''}`).join(' '), '| assets:', b.assets.map(a => `${a.id}${a.hp}${a.down ? 'X' : ''}${a.staged ? 's' : ''}`).join(' '), '| ctrls:', b.controls.map(k => k.asset + ':' + k.card.replace('c.', '') + (k.disabledBy ? '(off)' : '')).join(' '));
}
console.log('\nRESULT', JSON.stringify(b.result));
