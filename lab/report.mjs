#!/usr/bin/env node
// Renders lab/out/*.json into a single self-contained lab/out/report.html (no external assets).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { summariseRuns, summariseBattles } from './experiments.mjs';
import { mean, pct, groupBy, wilson } from './stats.mjs';

const dir = process.argv[2] || 'lab/out';
const load = n => existsSync(`${dir}/${n}.json`) ? JSON.parse(readFileSync(`${dir}/${n}.json`, 'utf8')) : null;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const bar = (p, lo, hi, color = '#00ff9c') => `<div class="bar"><i style="width:${Math.max(0, p * 100)}%;background:${color}"></i>${lo != null ? `<b style="left:${lo * 100}%;width:${Math.max(0.5, (hi - lo) * 100)}%"></b>` : ''}</div>`;
const heat = p => { const h = 120 * p; return `hsl(${h} 70% ${18 + 20 * p}%)`; };
let html = `<!doctype html><meta charset=utf-8><title>ADVERSARY balance lab</title><style>
body{background:#07120d;color:#cfe;font:14px/1.45 ui-monospace,Menlo,monospace;margin:0;padding:24px 32px;max-width:1200px}
h1,h2{font-weight:600;letter-spacing:.04em} h2{border-bottom:1px solid #1d3b2c;padding-bottom:4px;margin-top:36px}
table{border-collapse:collapse;width:100%;margin:8px 0} td,th{padding:3px 8px;text-align:left;border-bottom:1px solid #12281d} th{color:#7fd;font-weight:500}
.bar{position:relative;height:12px;background:#10261b;border-radius:2px;min-width:140px}.bar i{display:block;height:100%;border-radius:2px}.bar b{position:absolute;top:3px;height:6px;background:#fff6;border-radius:2px}
.flag{color:#ffbe46}.bad{color:#ff5470}.good{color:#4ade80}.dim{color:#6a9}.cell{display:inline-block;width:46px;text-align:center;border-radius:3px;margin-right:2px}
small{color:#6a9}
</style><h1>ADVERSARY balance lab</h1>`;

const ladder = load('ladder');
if (ladder) {
  const s = summariseRuns(ladder);
  html += `<h2>Skill ladder (full runs)</h2><p class=dim>${ladder.length} runs. A healthy game climbs steeply with skill. Bars show win rate with 95% interval.</p><table><tr><th>skill<th>win<th><th>mean act reached<th>battles/run`;
  for (const r of s.bySkill) html += `<tr><td>${r.key}<td>${pct(r.win.p)}<td>${bar(r.win.p, r.win.lo, r.win.hi)}<td>${r.act.toFixed(2)}<td>${r.battles.toFixed(1)}`;
  html += `</table><h2>Doctrines × skill</h2><table><tr><th>doctrine${[...new Set(ladder.map(r => r.skill))].map(k => `<th>${k}`).join('')}`;
  for (const [d, rs] of groupBy(ladder, r => r.doctrine)) { const bySk = groupBy(rs, r => r.skill); html += `<tr><td>${d}` + [...new Set(ladder.map(r => r.skill))].map(k => { const w = wilson((bySk.get(k) || []).filter(r => r.won).length, (bySk.get(k) || []).length); return `<td><span class=cell style="background:${heat(Math.min(1, w.p * 2.5))}">${pct(w.p)}</span>`; }).join(''); }
  const spread = (() => { const v = [...groupBy(ladder.filter(r => r.skill === 'standard'), r => r.doctrine)].map(([, rs]) => rs.filter(r => r.won).length / rs.length); return v.length ? Math.max(...v) - Math.min(...v) : 0; })();
  html += `</table><p>Doctrine spread at standard skill: <b class="${spread > 0.1 ? 'flag' : 'good'}">${(spread * 100).toFixed(0)}pp</b></p>`;
  // gating
  const g = {}; for (const r of ladder.filter(x => x.skill === 'standard')) for (const [adv, tier, w, how, rounds, lost, act, node] of r.bl) { const k = `act ${act} ${node}`; (g[k] ||= { n: 0, w: 0, goal: 0 }); g[k].n++; g[k].w += w; if (how === 'goal' && !w) g[k].goal++; }
  html += `<h2>Where standard-skill runs die</h2><table><tr><th>node<th>win<th><th>n<th>lost to goal`;
  for (const k of Object.keys(g).sort()) html += `<tr><td>${k}<td>${pct(g[k].w / g[k].n)}<td>${bar(g[k].w / g[k].n)}<td>${g[k].n}<td>${g[k].n - g[k].w ? pct(g[k].goal / (g[k].n - g[k].w)) : '-'}`;
  html += '</table>';
}
const adv = load('adversaries');
if (adv) {
  const s = summariseBattles(adv.results); const skills = [...new Set(adv.results.map(r => r.skill))];
  html += `<h2>Adversaries (representative decks)</h2><p class=dim>Win rate by skill. Flags: <span class=flag>easy</span> standard &gt; 95%, <span class=bad>brutal</span> standard &lt; 25%, <span class=flag>flat</span> sharp − random &lt; 15pp (play barely matters).</p><table><tr><th>id<th>name<th>T<th>goal${skills.map(k => `<th>${k}`).join('')}<th>loss by goal<th>flags`;
  for (const a of adv.advs) {
    const g = k => s.byAdvSkill.find(x => x.key === a.id + '|' + k); const std = g('standard'), rnd = g('random'), shp = g('sharp');
    const fl = []; if (std && std.win.p > 0.95) fl.push('<span class=flag>easy</span>'); if (std && std.win.p < 0.25) fl.push('<span class=bad>brutal</span>'); if (rnd && shp && shp.win.p - rnd.win.p < 0.15) fl.push('<span class=flag>flat</span>');
    html += `<tr><td>${a.id}<td>${esc(a.name)}<td>${a.tier}<td>${a.goal}` + skills.map(k => `<td><span class=cell style="background:${heat(g(k)?.win.p ?? 0)}">${g(k) ? pct(g(k).win.p) : '-'}</span>`).join('') + `<td>${std ? pct(std.goal.p) : '-'}<td>${fl.join(' ')}`;
  }
  html += '</table>';
}
for (const [name, title, note] of [['cards', 'Card power (paired ablation)', 'Win-rate change when the card replaces a random card in a realistic deck (same seeds). Large positives are must-picks; negatives are traps. Intervals are 95%.'], ['relics', 'Relic power (paired ablation)', 'Win-rate change when the relic is added.']]) {
  const d = load(name); if (!d) continue;
  html += `<h2>${title}</h2><p class=dim>${note}</p><table><tr><th>id<th>type/rarity<th>lift<th>`;
  for (const c of d) { const w = Math.min(1, Math.abs(c.lift) * 4); html += `<tr><td>${esc(c.id)}<td>${c.type || ''} ${c.rarity}<td class="${c.lo > 0 ? 'good' : c.hi < 0 ? 'bad' : 'dim'}">${(100 * c.lift).toFixed(1)}pp<td>${bar(w, null, null, c.lift >= 0 ? '#4ade80' : '#ff5470')}`; }
  html += '</table>';
}
const tune = load('tune');
if (tune) html += `<h2>Optimiser</h2><pre>${esc(JSON.stringify(tune, null, 1)).slice(0, 6000)}</pre>`;
writeFileSync(`${dir}/report.html`, html + '</body>'); console.log(`wrote ${dir}/report.html`);
