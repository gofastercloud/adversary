// Assemble a playable content set. Pure: callers supply already-parsed JSON (Node reads files; the
// browser fetches them; Lambda bundles them), so the engine behaves identically everywhere.
import { cyrb53 } from './rng.js';

export const FN_IDS = ['govern', 'identify', 'protect', 'detect', 'respond', 'recover'];
export const PROP_IDS = ['spoofing', 'tampering', 'repudiation', 'disclosure', 'dos', 'elevation'];
export const STRIDE = { spoofing: 'S', tampering: 'T', repudiation: 'R', disclosure: 'I', dos: 'D', elevation: 'E' };
export const LETTER_TO_PROP = Object.fromEntries(Object.entries(STRIDE).map(([k, v]) => [v, k]));

/**
 * @param {object} src
 *   core:  { taxonomy, cards, doctrines, relics, events, tuning, achievements, adversaryMeta }
 *   scenario: scenario pack (kind:'scenario') | null
 *   extras: additional packs whose `cards`/`relics` join the pool (optional)
 *   attack: { techniques, mitigations, tactics }
 *   adversaries: { [id]: data/adversaries/<id>.json }
 */
export function buildContent({ core, scenario = null, extras = [], attack, adversaries = {} }) {
  const tax = core.taxonomy;
  const fns = tax.functions, props = tax.properties;
  const cells = {};
  for (const f of FN_IDS) for (const p of PROP_IDS) {
    const id = `${f}.${p}`;
    const ov = scenario?.cardOverrides?.[id];
    cells[id] = { id, fn: f, prop: p, fnIdx: FN_IDS.indexOf(f), propIdx: PROP_IDS.indexOf(p), stride: STRIDE[p], ...tax.cells[id], ...(ov || {}), baseName: tax.cells[id].name, skinned: !!ov };
  }
  const packs = [scenario, ...extras].filter(Boolean);

  const cards = {};
  for (const c of core.cards.cards) cards[c.id] = { ...c };
  for (const pk of packs) for (const c of pk.cards || []) cards[c.id] = { ...c, pack: pk.id };
  // apply sector skins to the 36 matrix cards (names/lessons only; mechanics never change)
  for (const c of Object.values(cards)) {
    if (c.cell && scenario?.cardOverrides?.[c.cell]) {
      const o = scenario.cardOverrides[c.cell];
      c.name = o.name; c.flavour = o.flavour; c.desc = o.desc; c.lesson = o.desc; c.refs = o.refs; c.skinned = true;
    }
    c.stride = STRIDE[c.prop];
  }
  const relics = {};
  for (const r of core.relics.relics) relics[r.id] = r;
  for (const pk of packs) for (const r of pk.relics || []) relics[r.id] = { ...r, pack: pk.id };

  const doctrines = Object.fromEntries(core.doctrines.doctrines.map(d => [d.id, d]));
  const events = Object.fromEntries(core.events.events.map(e => [e.id, e]));
  const achievements = core.achievements?.achievements || [];
  const meta = core.adversaryMeta || {};
  const fingerprint = cyrb53(JSON.stringify([core.cards, core.relics, core.tuning, core.doctrines, scenario?.id, scenario?.version, scenario?.assets, scenario?.roster, scenario?.systems, scenario?.ttx, core.adversaryMeta, Object.keys(adversaries).sort().map(k => [k, adversaries[k].techs.length])]));

  return {
    fingerprint, fns, props, cells, cards, relics, doctrines, events, achievements, tuning: core.tuning,
    scenario, scenarioId: scenario?.id || null,
    assets: scenario?.assets || [], roster: scenario?.roster || null, systems: scenario?.systems || [], ttx: scenario?.ttx || [],
    theme: scenario?.theme || { accent: '#5ad1ff', accent2: '#8b7bff', bg: ['#0b1020', '#141a33', '#1d1640'] },
    org: scenario?.org || null,
    techs: attack.techniques, mits: attack.mitigations, tactics: attack.tactics,
    adversaries, adversaryMeta: meta,
    cardPool: Object.values(cards).filter(c => c.type !== 'status' && c.rarity !== 'status').map(c => c.id),
    relicPool: Object.values(relics).filter(r => r.rarity !== 'starter').map(r => r.id)
  };
}

export const cardOf = (content, id) => content.cards[id];
export const isControl = c => c.type === 'control';
