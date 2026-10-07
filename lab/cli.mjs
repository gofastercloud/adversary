#!/usr/bin/env node
// node lab/cli.mjs <command> [--n 40] [--scenarios enterprise,ot] [--out lab/out]
import { mkdirSync, writeFileSync } from 'node:fs';
import { Pool } from './pool.mjs';
import * as X from './experiments.mjs';
import { pct } from './stats.mjs';
import { listScenarios } from '../scripts/lib/load.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const cmd = process.argv[2] || 'help', n = +arg('n', 40), out = arg('out', 'lab/out');
const scenarios = (arg('scenarios', 'enterprise')).split(',').map(s => s === 'all' ? listScenarios() : [s]).flat();
mkdirSync(out, { recursive: true });
const save = (name, data) => { writeFileSync(`${out}/${name}.json`, JSON.stringify(data)); console.log('wrote', `${out}/${name}.json`); };
const pool = new Pool(+arg('workers', 0) || undefined);
const line = (k, r) => `${String(k).padEnd(26)} ${pct(r.win.p).padStart(4)} [${pct(r.win.lo)}-${pct(r.win.hi)}] n=${r.n} act≈${r.act.toFixed(2)} battles≈${r.battles.toFixed(1)}`;

try {
  if (cmd === 'ladder') {
    const runs = await X.skillLadder(pool, { n, scenarios, skills: arg('skills', 'random,novice,standard,sharp').split(','), assurance: +arg('assurance', 1), keepSnaps: true });
    save('ladder', runs); const s = X.summariseRuns(runs);
    console.log('overall', pct(s.overall.p)); for (const r of s.bySkill) console.log(line(r.key, r)); console.log('--- by doctrine'); for (const r of s.byDoctrine) console.log(line(r.key, r)); console.log('--- by scenario'); for (const r of s.byScenario) console.log(line(r.key, r));
  } else if (cmd === 'adversaries') {
    const runs = await X.skillLadder(pool, { n: 10, scenarios: [scenarios[0]], skills: ['standard'], keepSnaps: true });
    const snaps = X.pickSnaps(runs);
    const r = await X.adversaryMatrix(pool, { scenario: scenarios[0], snaps, perAdv: n, skills: arg('skills', 'random,standard,sharp').split(',') });
    save('adversaries', r); const s = X.summariseBattles(r.results);
    const rows = r.advs.map(a => { const g = sk => s.byAdvSkill.find(x => x.key === a.id + '|' + sk); return `${a.id.padEnd(6)} ${a.name.padEnd(30)} T${a.tier} ${String(a.goal).padEnd(11)} ` + ['random', 'standard', 'sharp'].map(sk => { const x = g(sk); return x ? pct(x.win.p).padStart(4) : '  - '; }).join(' '); });
    console.log('id     name                           tier goal        random standard sharp'); console.log(rows.join('\n'));
  } else if (cmd === 'cards') {
    const runs = await X.skillLadder(pool, { n: 8, scenarios: [scenarios[0]], skills: ['standard'], keepSnaps: true });
    const r = await X.cardPower(pool, { scenario: scenarios[0], snaps: X.pickSnaps(runs), pairs: n });
    save('cards', r); for (const c of r) console.log(`${(100 * c.lift).toFixed(1).padStart(6)}pp [${(100 * c.lo).toFixed(0)},${(100 * c.hi).toFixed(0)}] ${c.type.padEnd(8)} ${c.rarity.padEnd(8)} ${c.id}`);
  } else if (cmd === 'relics') {
    const runs = await X.skillLadder(pool, { n: 8, scenarios: [scenarios[0]], skills: ['standard'], keepSnaps: true });
    const r = await X.relicPower(pool, { scenario: scenarios[0], snaps: X.pickSnaps(runs), pairs: n });
    save('relics', r); for (const c of r) console.log(`${(100 * c.lift).toFixed(1).padStart(6)}pp [${(100 * c.lo).toFixed(0)},${(100 * c.hi).toFixed(0)}] ${c.rarity.padEnd(9)} ${c.id}`);
  } else if (cmd === 'mechanics') {
    // Which defender mechanics carry the game? Standard agent with one capability banned, on realistic decks, paired seeds.
    const { getContent } = await import('./sim.mjs'); const { appearances, TARGET } = await import('./tune.mjs'); const { deckAt } = await import('./decks.mjs');
    const sc = scenarios[0]; const c = getContent(sc); const apps = appearances([sc]);
    const kinds = ['ward', 'detect', 'evict', 'heal', 'policy', 'augment', 'intel', 'consumable', 'isolate'];
    const skills = ['standard', ...kinds.map(k => 'standard-no-' + k), 'random'];
    const specs = []; for (const skill of skills) apps.forEach((a, ai) => { for (let i = 0; i < n; i++) { const d = X.DOCTRINES[i % 5]; const sn = deckAt(c, d, a.act, a.node, `${sc}|${a.act}|${a.node}|${i}`); specs.push({ scenario: sc, adv: a.adv, tier: a.tier, boss: a.node === 'boss', elite: a.node === 'elite', skill, doctrine: d, deck: sn.deck, resilience: sn.res, relics: sn.relics, assurance: 1, seed: `mech|${ai}|${i}` }); } });
    const res = await pool.map('battle', specs); const by = {}; res.forEach((r, k) => { (by[r.skill] ||= []).push(r.won ? 1 : 0); });
    const base = by.standard.reduce((x, y) => x + y, 0) / by.standard.length;
    console.log(`scenario ${sc}: standard win ${pct(base)} over ${by.standard.length} battles`);
    for (const k of skills.slice(1)) { const w = by[k].reduce((x, y) => x + y, 0) / by[k].length; console.log(`${k.padEnd(24)} ${pct(w).padStart(4)}  (${w - base >= 0 ? '+' : ''}${(100 * (w - base)).toFixed(1)}pp)`); }
    save('mechanics', Object.fromEntries(skills.map(k => [k, by[k].reduce((x, y) => x + y, 0) / by[k].length])));
  } else if (cmd === 'fuzz') {
    const { fuzzBattle, fuzzRun } = await import('./fuzz.mjs'); const { getContent } = await import('./sim.mjs');
    const DOCS = X.DOCTRINES; let bad = 0, total = 0;
    for (const sc of listScenarios()) {
      const c = getContent(sc); const advs = Object.keys(c.adversaryMeta);
      for (let i = 0; i < n; i++) { const adv = advs[i % advs.length]; for (const p of fuzzBattle(c, { seed: `f${i}`, adv, tier: 1 + (i % 3), doctrine: DOCS[i % 5] })) { bad++; console.log(sc, p); } total++; }
      for (let i = 0; i < Math.max(2, Math.round(n / 20)); i++) { for (const p of fuzzRun(c, { seed: `fr${i}`, doctrine: DOCS[i % 5] })) { bad++; console.log(sc, p); } total++; }
    }
    console.log(`fuzzed ${total} battles/runs across ${listScenarios().length} packs: ${bad} violations`); if (bad) process.exitCode = 1;
  } else console.log('commands: ladder | adversaries | cards | relics | mechanics | fuzz');
} finally { await pool.close(); }
