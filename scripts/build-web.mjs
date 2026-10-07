#!/usr/bin/env node
// Builds the static SPA into dist/web: bundled JS/CSS (content-hashed), icon sprite, fonts, content JSON.
//   node scripts/build-web.mjs [--watch]
import { build, context } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadCore, loadAttack, loadAdversaries, listScenarios, loadScenario } from './lib/load.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist/web');
const watch = process.argv.includes('--watch');
const j = (...p) => path.join(root, ...p);

export async function buildWeb({ apiBase = '/api' } = {}) {
  rmSync(dist, { recursive: true, force: true });
  mkdirSync(path.join(dist, 'assets'), { recursive: true });
  mkdirSync(path.join(dist, 'content/packs'), { recursive: true });

  // ── content
  const core = loadCore(), attack = loadAttack(), advs = loadAdversaries();
  const w = (rel, obj) => { mkdirSync(path.dirname(path.join(dist, rel)), { recursive: true }); writeFileSync(path.join(dist, rel), typeof obj === 'string' ? obj : JSON.stringify(obj)); };
  const coreBundle = JSON.stringify(core);
  const version = createHash('sha256').update(coreBundle).update(JSON.stringify(attack.mitigations)).digest('hex').slice(0, 10);
  w('content/core.json', coreBundle);
  w('content/attack.json', attack);
  const scenarios = [];
  for (const id of listScenarios()) { const p = loadScenario(id); w(`content/packs/${id}.json`, p); scenarios.push({ id, name: p.name, tagline: p.tagline, icon: p.icon, theme: p.theme, org: p.org?.name, version: p.version }); }
  const advIndex = JSON.parse(readFileSync(j('data/adversaries/index.json'), 'utf8'));
  for (const a of advIndex) { cpSync(j('data/adversaries', a.id + '.json'), path.join(dist, 'content/adversaries', a.id + '.json')); cpSync(j('data/dossiers', a.id + '.json'), path.join(dist, 'content/dossiers', a.id + '.json')); }
  w('content/manifest.json', { version, built: new Date().toISOString(), scenarios, adversaries: advIndex.map(a => a.id), attackVersion: readFileSync(j('data/attack/NOTICE.md'), 'utf8').match(/version ([\d.]+)/)?.[1] });
  cpSync(j('data/attack/NOTICE.md'), path.join(dist, 'content/NOTICE-ATTACK.md'));

  // ── icon sprite
  const icons = readdirSync(j('web/icons')).filter(f => f.endsWith('.svg'));
  let sprite = '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">';
  for (const f of icons) {
    const inner = readFileSync(j('web/icons', f), 'utf8').replace(/<!--[\s\S]*?-->/g, '').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim();
    sprite += `<symbol id="i-${f.slice(0, -4)}" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</g></symbol>`;
  }
  sprite += '</svg>';

  // ── fonts
  mkdirSync(path.join(dist, 'assets/fonts'), { recursive: true });
  for (const f of readdirSync(j('web/fonts'))) cpSync(j('web/fonts', f), path.join(dist, 'assets/fonts', f));
  cpSync(j('web/icons/LICENSE'), path.join(dist, 'assets/ICONS-LICENSE.txt'), { force: true });

  // ── bundle
  const common = { bundle: true, minify: !watch, sourcemap: true, target: 'es2022', logLevel: 'warning', define: { 'process.env.NODE_ENV': '"production"' }, entryNames: '[name].[hash]', outdir: path.join(dist, 'assets'), metafile: true, loader: { '.woff2': 'file', '.svg': 'text' }, assetNames: 'fonts/[name]' };
  const r = await build({ ...common, entryPoints: { app: j('web/js/main.js'), style: j('web/css/main.css') } });
  const outs = Object.keys(r.metafile.outputs).map(f => path.basename(f));
  const js = outs.find(f => /^app\..*\.js$/.test(f)), css = outs.find(f => /^style\..*\.css$/.test(f));
  let html = readFileSync(j('web/index.html'), 'utf8').replace('%%JS%%', `assets/${js}`).replace('%%CSS%%', `assets/${css}`).replace('%%SPRITE%%', sprite).replace(/%%VERSION%%/g, version);
  w('index.html', html);
  w('config.json', { apiBase, version });
  console.log(`web built: ${js} (${(readFileSync(path.join(dist, 'assets', js)).length / 1024).toFixed(0)} KB), ${css}, content ${version}`);
  return { dist, version };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await buildWeb({ apiBase: process.env.API_BASE || '/api' });
