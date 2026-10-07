// Node-side content loader (tests, simulation, validators).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildContent } from '../../engine/content.js';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rd = (...p) => JSON.parse(readFileSync(path.join(root, ...p), 'utf8'));

export function loadCore() {
  const c = (n) => rd('content/core', n + '.json');
  return {
    taxonomy: c('taxonomy'), cards: c('cards'), doctrines: c('doctrines'), relics: c('relics'), events: c('events'), tuning: c('tuning'),
    adversaryMeta: c('adversary-meta'),
    achievements: existsSync(path.join(root, 'content/core/achievements.json')) ? c('achievements') : { achievements: [] }
  };
}
export function loadAttack() { return { techniques: rd('data/attack/techniques.json'), mitigations: rd('data/attack/mitigations.json'), tactics: rd('data/attack/tactics.json') }; }
export function loadAdversaries() {
  const out = {};
  for (const f of readdirSync(path.join(root, 'data/adversaries'))) if (f !== 'index.json') out[f.replace('.json', '')] = rd('data/adversaries', f);
  return out;
}
export function loadScenario(id) { const p = path.join(root, 'content/packs', id + '.json'); return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null; }
export function listScenarios() { return readdirSync(path.join(root, 'content/packs')).filter(f => f.endsWith('.json')).map(f => f.replace('.json', '')); }

let cache = null;
export function loadContent(scenarioId = 'enterprise', extraIds = []) {
  cache ||= { core: loadCore(), attack: loadAttack(), adversaries: loadAdversaries() };
  return buildContent({ core: cache.core, scenario: scenarioId ? loadScenario(scenarioId) : null, extras: extraIds.map(loadScenario), attack: cache.attack, adversaries: cache.adversaries });
}
