// Server-side content: the exact same engine + data as the SPA, so replays are bit-for-bit comparable.
import { buildContent, adversaryIdsFor } from '../../engine/content.js';
import { core, packs, adversaries, attack } from './bundled.mjs';

const cache = new Map();
export const scenarioIds = Object.keys(packs).sort();
export const doctrineIds = core.doctrines.doctrines.map(d => d.id);
export function contentFor(scenarioId) {
  if (!packs[scenarioId]) return null;
  if (!cache.has(scenarioId)) {
    const scenario = packs[scenarioId];
    cache.set(scenarioId, buildContent({ core, scenario, extras: [], attack, adversaries: Object.fromEntries(adversaryIdsFor(scenario).map(id => [id, adversaries[id]])) }));
  }
  return cache.get(scenarioId);
}
