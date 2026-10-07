// Assemble a playable content set from core + a campaign pack + optional extras.
import { cyrb53 } from './rng.js';

export const FN_IDS = ['govern', 'identify', 'protect', 'detect', 'respond', 'recover'];
export const PROP_IDS = ['spoofing', 'tampering', 'repudiation', 'disclosure', 'dos', 'elevation'];
export const cellId = (fn, prop) => `${fn}.${prop}`;
export const splitCell = (c) => c.split('.');

export function buildContent({ core, campaign = null, extras = [] }) {
  if (!core || core.kind !== 'core') throw new Error('core pack required');
  if (campaign && campaign.kind !== 'campaign') throw new Error('campaign pack must be kind=campaign');
  const packs = [core, ...(campaign ? [campaign] : []), ...extras.filter(e => e && e.id !== campaign?.id)];

  const cells = {};
  for (const f of FN_IDS) for (const p of PROP_IDS) {
    const id = cellId(f, p);
    const base = core.cells[id];
    const ov = campaign?.cardOverrides?.[id];
    cells[id] = { id, fn: f, prop: p, fnIdx: FN_IDS.indexOf(f), propIdx: PROP_IDS.indexOf(p), ...base, ...(ov || {}), baseName: base.name, skinned: !!ov };
  }
  const jokers = {};
  const jokerPool = [];
  const playbooks = {};
  const playbookPool = [];
  for (const pk of packs) {
    for (const j of pk.jokers || []) { jokers[j.id] = { ...j, pack: pk.id, cost: core.economy.rarityCost[j.rarity] }; jokerPool.push(j.id); }
    for (const b of pk.playbooks || []) { playbooks[b.id] = { ...b, pack: pk.id }; playbookPool.push(b.id); }
  }
  const frameworks = Object.fromEntries(core.frameworks.map(f => [f.id, f]));
  const handTypes = Object.fromEntries(core.handTypes.map(h => [h.id, h]));
  const fingerprint = cyrb53(JSON.stringify(packs.map(p => [p.id, p.version, p])));

  return {
    core, campaign, extras, packIds: packs.map(p => p.id), fingerprint,
    eco: core.economy, fns: core.functions, props: core.properties,
    cells, jokers, jokerPool, playbooks, playbookPool, frameworks, handTypes, tags: core.tags,
    antes: campaign?.campaign?.antes || [], systems: campaign?.systems || [],
    theme: campaign?.theme || { accent: '#5ad1ff', accent2: '#8b7bff', bg: ['#0b1020', '#141a33', '#1d1640'] },
    org: campaign?.org || null
  };
}

/** Convenience for Node: load packs from a directory object { id: json }. */
export function contentFromMap(map, campaignId, extraIds = []) {
  return buildContent({ core: map.core, campaign: map[campaignId], extras: extraIds.map(i => map[i]) });
}
