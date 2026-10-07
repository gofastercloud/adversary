// Structural invariants for battles and runs. Returns a list of violations (empty = healthy).
import { createHash } from 'node:crypto';

export function checkBattle(content, b) {
  const v = [];
  const fin = (n, name) => { if (!Number.isFinite(n)) v.push(`${name} not finite: ${n}`); };
  fin(b.energy.cur, 'energy'); fin(b.res.cur, 'resilience'); fin(b.expo.cur, 'exposure');
  if (b.energy.cur < 0) v.push('negative energy');
  if (b.res.cur > b.res.max) v.push('resilience above max');
  for (const a of b.assets) { fin(a.hp, 'hp ' + a.id); if (a.hp < 0 || a.hp > a.max) v.push(`hp out of range on ${a.id}: ${a.hp}/${a.max}`); if (a.down && a.hp > 0) v.push(`${a.id} down with hp>0`); if (!a.down && a.hp <= 0 && !b.over) v.push(`${a.id} hp<=0 but not down`); }
  if (b.goal) { fin(b.goal.prog, 'goal'); if (b.goal.prog < 0) v.push('negative goal progress'); }
  // card conservation: every player card instance is in exactly one zone
  const zones = { hand: b.hand, draw: b.draw, discard: b.discard, board: b.board, exhausted: b.exhausted || [] };
  const seen = new Map();
  for (const [z, list] of Object.entries(zones)) for (const iid of list) { if (seen.has(iid)) v.push(`card ${iid} in both ${seen.get(iid)} and ${z}`); seen.set(iid, z); }
  for (const iid of Object.keys(b.cards)) if (!seen.has(iid) && !(b.policies || []).some(p => p.iid === iid)) v.push(`card ${iid} (${b.cards[iid].id}) is in no zone`);
  for (const k of b.controls) { if (!b.assets.find(a => a.id === k.asset)) v.push(`control on missing asset ${k.asset}`); }
  for (const f of b.footholds) { if (!b.assets.find(a => a.id === f.asset)) v.push(`foothold on missing asset ${f.asset}`); if (f.grip < 1) v.push(`foothold ${f.id} grip ${f.grip}`); }
  for (const a of b.assets) if (b.controls.filter(k => k.asset === a.id).length > a.slots) v.push(`slots exceeded on ${a.id}`);
  if (!b.over && b.phase !== 'defender' && b.phase !== 'adversary') v.push('bad phase ' + b.phase);
  return v;
}

/** State hash that ignores transient presentation fields (the per-action event buffer). */
export const hash = o => createHash('sha1').update(JSON.stringify(o, (k, v) => (k === 'events' || k === 'obs' ? undefined : v))).digest('hex').slice(0, 16);
