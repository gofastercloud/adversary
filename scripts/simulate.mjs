#!/usr/bin/env node
// Balance simulation: node scripts/simulate.mjs [--n 40] [--doctrine architect] [--tier 1] [--adv G0092,...]
import { loadContent } from './lib/load.mjs';
import { playBattle } from './lib/bot.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const N = +arg('n', 30), tierArg = arg('tier', null);
const content = loadContent(arg('scenario', 'enterprise'));
const doctrines = (arg('doctrine', 'architect,hunter,phoenix,governor,responder')).split(',');
const advs = arg('adv', null)?.split(',') || content.roster.acts.flatMap(a => [...a.battle, ...a.elite, a.boss]);
const tierOf = (id) => tierArg ? +tierArg : (content.adversaryMeta[id]?.tier || 1);
console.log('adv'.padEnd(34) + 'tier ' + doctrines.map(d => d.padEnd(18)).join(''));
for (const adv of advs) {
  let line = `${adv} ${content.adversaryMeta[adv]?.name || ''}`.padEnd(34) + String(tierOf(adv)).padEnd(5);
  for (const d of doctrines) {
    let wins = 0, rounds = 0, lost = 0, ev = 0;
    for (let i = 0; i < N; i++) {
      const b = playBattle(content, { seed: `sim-${adv}-${d}-${i}`, doctrine: d, adversary: adv, tier: tierOf(adv) });
      if (b.result.won) wins++; rounds += b.result.rounds; lost += b.result.resLost; ev += b.result.how === 'evicted' ? 1 : 0;
    }
    line += `${(100 * wins / N).toFixed(0)}% r${(rounds / N).toFixed(1)} L${(lost / N).toFixed(0)} E${(100 * ev / N).toFixed(0)}`.padEnd(18);
  }
  console.log(line);
}
