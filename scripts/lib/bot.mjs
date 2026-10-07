// A heuristic defender used for balance simulation and smoke tests. Deliberately simple.
import * as B from '../../engine/battle.js';

const assetValue = (a) => (a.jewel ? 6 : a.kind === 'identity' ? 4.5 : a.exposed ? 3.5 : 2.5);

export function starterDeck(content, doctrineId) {
  return content.doctrines[doctrineId].deck.map((id, i) => ({ iid: 'd' + i, id, ml: 1 }));
}

function strideWeights(b) {
  const w = { S: 1, T: 1, R: 0.5, I: 1, D: 0.8, E: 1 };
  for (const uid of b.adv.hand) w[b.adv.cards[uid].stride] += 1;
  return w;
}

function scoreOption(content, b, iid, target, sw) {
  const e = B.effCard(content, b, iid);
  const cost = B.cardCost(content, b, iid);
  let s = 0;
  const A = target.asset ? B.asset(b, target.asset) : null;
  const hidden = b.footholds.filter(f => !f.revealed).length;
  if (e.type === 'control') {
    const ctrls = b.controls.filter(k => k.asset === A.id);
    if (e.ward) {
      const stride = Object.keys(e.ward)[0];
      const existing = Object.values(B.wardMap(content, b, A.id)).reduce((x, y) => x + y, 0);
      s = assetValue(A) * sw[stride] * e.ward[stride] / (1 + existing * 0.5) + 1.5;
      if (ctrls.some(k => k.card === e.id)) s -= 5;
    } else if (e.detect) {
      const has = ctrls.some(k => content.cards[k.card].detect);
      s = (has ? 0.5 : assetValue(A) + 3) + (hidden ? 3 : 0);
      if (e.detect.scope === 'global') s = hidden ? 7 : 3.5;
    } else if (e.aegis) s = A.jewel ? 8 : A.kind === 'backup' ? 6 : 2;
    else s = 3;
  } else if (e.type === 'policy') {
    s = b.policies.some(p => p.id === e.id) ? -9 : 4.5;
  } else if (e.type === 'augment') {
    s = 5;
  } else {
    for (const fx of e.fx || []) {
      switch (fx.op) {
        case 'evict': { const f = B.asset && b.footholds.find(x => x.id === target.fid); s += 9 + (f?.privileged ? 3 : 0) + (f?.c2 ? 2 : 0) + (f?.persistent ? -2 : 0); break; }
        case 'reveal': case 'scanKinds': s += hidden ? 6 : 0.3; break;
        case 'heal': s += A ? (A.max - A.hp) * (A.jewel ? 1.6 : 0.8) + (A.down ? 8 : 0) : 0; break;
        case 'isolate': s += b.footholds.some(f => f.asset === A?.id && f.revealed) ? 7 : 0; break;
        case 'purge': s += b.footholds.filter(f => f.asset === A?.id).length * 6 + (A?.max - A?.hp) * 0.5; break;
        case 'draw': s += b.energy.cur > 1 ? 3 : 1; break;
        case 'intel': s += 1.5; break;
        case 'shield': s += b.adv.intent && (b.adv.intent.asset === A?.id) ? 6 : 0.5; break;
        case 'unprivilege': case 'evictPrivileged': s += b.footholds.some(f => f.asset === A?.id && f.privileged) ? 7 : 0; break;
        case 'exposure': s += 2.5; break;
        case 'resilience': s += (b.res.max - b.res.cur) > 3 ? 4 : 0.5; break;
        case 'restore': s += b.controls.some(k => k.asset === A?.id && k.disabledBy) ? 6 : 0; break;
        case 'clearCreds': s += b.adv.creds ? 3 : 0; break;
        case 'unstage': s += A?.staged ? 5 : 0; break;
        case 'blockPath': s += 1; break;
        case 'shieldExfil': s += b.assets.some(a => a.staged) ? 5 : 0; break;
        default: s += 1;
      }
    }
    if (!e.fx?.length) s = 0;
  }
  return s - cost * 0.9;
}

export function pickBest(content, b) {
  const sw = strideWeights(b);
  let best = null;
  const seen = new Set();
  for (const iid of b.hand) {
    const e = B.effCard(content, b, iid);
    if (e.unplayable || e.type === 'status') continue;
    if (B.cardCost(content, b, iid) > b.energy.cur) continue;
    for (const t of B.validTargets(content, b, iid)) {
      const key = b.cards[iid].id + JSON.stringify(t) + b.cards[iid].ml;
      if (seen.has(key)) continue; seen.add(key);
      let s;
      if (e.type === 'augment') {
        const k = b.controls.find(x => x.kid === t.kid);
        s = scoreOption(content, b, iid, t, sw) + (k.augs.length ? -1 : 1) + (e.aug.resists ? 1.5 : 0) + (e.aug.ward ? 1.5 : 0);
      } else s = scoreOption(content, b, iid, t, sw);
      if (s > 1.2 && (!best || s > best.s)) best = { iid, target: t, s };
    }
  }
  return best;
}

export function botTurn(content, b) {
  // hero power if useful (cost 1, only when energy would otherwise be wasted)
  for (let guard = 0; guard < 24 && !b.over; guard++) {
    const best = pickBest(content, b);
    if (!best) break;
    try { B.battleAction(content, b, { type: 'PLAY', iid: best.iid, target: best.target }); } catch (e) { if (e instanceof B.GameError) break; throw e; }
  }
  if (!b.over && b.doctrine && !b.powerUsed) {
    const p = content.doctrines[b.doctrine].power;
    if (p.cost <= b.energy.cur) {
      try {
        let target = {};
        if (p.target === 'asset') { const hurt = b.assets.filter(a => a.hp < a.max).sort((x, y) => (y.max - y.hp) - (x.max - x.hp))[0]; target = { asset: (hurt || b.assets.find(a => a.jewel)).id }; }
        if (p.fx[0].op === 'reveal' && !b.footholds.some(f => !f.revealed)) throw new B.GameError('skip');
        B.battleAction(content, b, { type: 'POWER', target });
      } catch (e) { if (!(e instanceof B.GameError)) throw e; }
    }
  }
  if (!b.over) B.battleAction(content, b, { type: 'END_TURN' });
}

export function playBattle(content, { seed, doctrine = 'architect', adversary, tier = 1, boss = false, deck, resilience, assurance = 1, relics = [] }) {
  const d = content.doctrines[doctrine];
  const b = B.newBattle(content, { seed, deck: deck || starterDeck(content, doctrine), adversary: { id: adversary, tier, boss }, resilience: resilience || { cur: d.maxResilience, max: d.maxResilience }, relics: relics.length ? relics : [d.relic], doctrine, assurance });
  let guard = 0;
  while (!b.over && guard++ < 40) botTurn(content, b);
  return b;
}
