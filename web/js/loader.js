import { buildContent, adversaryIdsFor } from '../../engine/content.js';
const base = 'content/';
let cache = { manifest: null, core: null, attack: null, packs: {}, advs: {}, dossiers: {} };
const j = async (u) => { const r = await fetch(u, { cache: 'force-cache' }); if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.json(); };
export async function loadBase() {
  cache.manifest ||= await (await fetch(base + 'manifest.json', { cache: 'no-cache' })).json();
  const v = '?v=' + cache.manifest.version;
  [cache.core, cache.attack] = await Promise.all([cache.core || j(base + 'core.json' + v), cache.attack || j(base + 'attack.json' + v)]);
  return cache.manifest;
}
export async function loadContent(scenarioId, extras = []) {
  await loadBase();
  const v = '?v=' + cache.manifest.version;
  const need = [scenarioId, ...extras];
  await Promise.all(need.map(async id => { cache.packs[id] ||= await j(`${base}packs/${id}.json${v}`); }));
  const scenario = cache.packs[scenarioId];
  const ids = adversaryIdsFor(scenario);
  await Promise.all(ids.map(async id => { cache.advs[id] ||= await j(`${base}adversaries/${id}.json${v}`); }));
  const adversaries = Object.fromEntries(ids.map(id => [id, cache.advs[id]]));
  return buildContent({ core: { taxonomy: cache.core.taxonomy, cards: cache.core.cards, doctrines: cache.core.doctrines, relics: cache.core.relics, events: cache.core.events, tuning: cache.core.tuning, achievements: cache.core.achievements, adversaryMeta: cache.core.adversaryMeta }, scenario, extras: extras.map(e => cache.packs[e]), attack: cache.attack, adversaries });
}
export const loadDossier = async (id) => (cache.dossiers[id] ||= await j(`${base}dossiers/${id}.json?v=${cache.manifest.version}`));
export const getManifest = () => cache.manifest;
export const getCore = () => cache.core;
// a lightweight content (no scenario) for menus: codex & achievements before a run starts
export async function loadMenuContent(scenarioId) { return loadContent(scenarioId || cache.manifest?.scenarios?.[0]?.id); }
