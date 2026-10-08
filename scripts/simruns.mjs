#!/usr/bin/env node
import { loadContent } from './lib/load.mjs';
import { playRun } from './lib/runbot.mjs';
import * as R from '../engine/run.js';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const N = +arg('n', 20), assurance = +arg('assurance', 1);
const content = loadContent(arg('scenario', 'enterprise'));
const docs = arg('doctrine', 'architect,hunter,phoenix,governor,responder').split(',');
for (const doctrine of docs) {
  const reach = [0, 0, 0, 0]; let wins = 0, pts = 0, battles = 0; const killers = {};
  for (let i = 0; i < N; i++) {
    const { run } = playRun(content, { seed: `run-${doctrine}-${i}`, doctrine, assurance });
    if (run.result.won) wins++; reach[Math.min(3, run.act - (run.result.won ? 1 : 0))]++; pts += run.result.points; battles += run.stats.battles;
    if (!run.result.won) { const k = run.battle?.adv?.id; killers[k] = (killers[k] || 0) + 1; }
  }
  const top = Object.entries(killers).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${content.adversaryMeta[k]?.name || k}×${v}`).join(', ');
  console.log(`${doctrine.padEnd(10)} win ${(100 * wins / N).toFixed(0)}%  died in act1/2/3: ${reach[1]}/${reach[2]}/${reach[3]}  avg battles ${(battles / N).toFixed(1)}  avg pts ${(pts / N).toFixed(0)}  killers: ${top}`);
}
