// Heuristic defender. Uses only information a human can see: hand, board, revealed footholds, intent (by intel level),
// the briefing (adversary mitigation list, goal). Parameterised so the same code plays as novice, standard or sharp.
//   noise  : stddev of score noise (mistakes)         thresh : minimum score worth playing
//   skip   : probability of ending the turn early      goalW  : how much the agent cares about the adversary goal
import * as B from '../../engine/battle.js';
import { makeRng } from '../rng.mjs';

export const SKILLS = {
  novice:   { noise: 3.2, thresh: 1.4, skip: 0.12, goalW: 0.3, mitW: 0.2, power: 0.6, holdConsumables: false },
  standard: { noise: 0.9, thresh: 0.6, skip: 0.02, goalW: 1, mitW: 1, power: 1, holdConsumables: true },
  sharp:    { noise: 0.2, thresh: 0.4, skip: 0, goalW: 1.3, mitW: 1.3, power: 1, holdConsumables: true }
};

const KIND_W = { ot: 5, identity: 4.5, server: 4, data: 4, cloud: 4.5, app: 3.2, backup: 3.2, vendor: 2.4, email: 2.4, endpoint: 2.5 };
const assetValue = (a) => (a.jewel ? 7 : KIND_W[a.kind] || 2.5);

/** What the briefing tells a player: which mitigations/NIST controls blunt this adversary, and which strides it leans on. */
function briefing(content, b) {
  if (b._brief) return b._brief;
  const mit = {}, stride = { S: 0.6, T: 0.6, R: 0.2, I: 0.6, D: 0.5, E: 0.6 }, tech = {};
  for (const c of Object.values(b.adv.cards)) { for (const m of c.mit || []) mit[m] = (mit[m] || 0) + 1; stride[c.stride] = (stride[c.stride] || 0) + (['breach', 'spread', 'strike', 'exfil', 'impair', 'escalate'].includes(c.kind) ? 1.2 : 0.5); tech[c.id] = c; }
  b._brief = { mit, stride, tech };
  return b._brief;
}

function goalPressure(content, b) {
  const G = b.goal; if (!G) return 0;
  return G.prog / G.need;           // 0..1
}

function footholdValue(content, b, f) {
  const A = B.asset(b, f.asset); const G = b.goal; const def = G && content.tuning.goals[G.kind];
  let v = assetValue(A) * 0.7 + (f.privileged ? 3 : 0) + (f.c2 ? 2 : 0) + (f.persistent ? 1 : 0) + f.grip * 0.3;
  if (def && (def.rule === 'dwell' || def.rule === 'reach')) v += 3 + 4 * goalPressure(content, b);
  return v;
}

function scorePlay(content, b, iid, target, ctx) {
  const e = B.effCard(content, b, iid);
  const cost = B.cardCost(content, b, iid);
  const { brief, hiddenN, gp, P } = ctx;
  let s = 0;
  const A = target.asset ? B.asset(b, target.asset) : null;
  const intentAsset = b.adv.intent ? (b.adv.intent.asset || (b.adv.intent.fid ? B.asset(b, (b.footholds.find(f => f.id === b.adv.intent.fid) || {}).asset)?.id : null)) : null;
  const threatened = A && (A.id === intentAsset || b.footholds.some(f => f.asset === A.id));
  if (e.type === 'control') {
    const ctrls = b.controls.filter(k => k.asset === A.id);
    if (e.ward) {
      const stride = Object.keys(e.ward)[0];
      const existing = Object.values(B.wardMap(content, b, A.id)).reduce((x, y) => x + y, 0);
      let mit = 0; for (const m of e.mit || []) mit += (brief.mit[m] || 0);
      let ctl = 0; if (e.ctl) for (const c of Object.values(brief.tech)) if ((content.techs[c.id]?.c || []).some(x => e.ctl.includes(x))) ctl += 0.3;
      s = assetValue(A) * (brief.stride[stride] || 0.6) * e.ward[stride] / (1 + existing * 0.45) + 1.2 + P.mitW * (mit * 0.35 + ctl) + (e.cov?.protect ? Math.min(2.5, Object.keys(e.cov.protect).filter(t => brief.tech[t]).length * 0.7) : 0);
      if (ctrls.some(k => k.card === e.id)) s -= 5;
      if (threatened) s += 1.5;
      if (e.flags?.includes('segment')) s += A.jewel || A.kind === 'ot' ? 2 : 0.5;
    }
    if (e.detect) {
      const has = ctrls.some(k => content.cards[k.card].detect);
      let v = (has ? 0.6 : assetValue(A) * 0.7 + 3) + (hiddenN ? 3.5 : 0.5) + (b.footholds.some(f => f.asset === A.id && !f.revealed) ? 5 : 0);
      if (e.detect.scope === 'global') v = hiddenN ? 8 : 3.2;
      if (e.cov?.detect) v += Math.min(2.5, Object.keys(e.cov.detect).filter(t => brief.tech[t]).length * 0.6);
      s += v * (P.goalW > 0.5 && b.goal && ['dwell', 'reach'].includes(content.tuning.goals[b.goal.kind].rule) ? 1.3 : 1);
    }
    if (e.aegis) s += A.jewel ? 8 : A.kind === 'backup' ? 5 : 2.5 + (b.goal && ['ransom', 'destroy'].includes(b.goal.kind) ? 3 : 0);
    if (!e.ward && !e.detect && !e.aegis) s += 3;
  } else if (e.type === 'policy') {
    s = b.policies.some(p => p.id === e.id) ? -9 : 4.2 + (e.aura?.layered ? 1.5 : 0) + (e.aura?.startReveal ? 2 : 0);
    if (b.policies.length >= content.tuning.battle.policySlots) s -= 3;
  } else if (e.type === 'augment') {
    const k = b.controls.find(x => x.kid === target.kid);
    s = 4 + (k.augs.length ? -1 : 1) + (e.aug.ward ? 1.5 : 0);
    for (const r of e.aug.resists || []) if (brief.tech[r] || Object.keys(brief.tech).some(t => t.startsWith(r + '.'))) s += 3;
    for (const x of e.aug.expert || []) if (brief.tech[x.tech] || Object.keys(brief.tech).some(t => t.startsWith(x.tech + '.'))) s += 3;
    for (const m of e.aug.mit || []) s += (brief.mit[m] || 0) * 0.2;
    if (e.aug.flags?.includes('pqc') && b.adv.traits.some(t => t.op === 'hndl')) s += 4;
    s += assetValue(B.asset(b, k.asset)) * 0.3;
  } else {
    for (const fx of e.fx || []) {
      switch (fx.op) {
        case 'evict': { const f = b.footholds.find(x => x.id === target.fid); s += f ? 5 + footholdValue(content, b, f) * 0.9 + Math.min(fx.n, f.grip) * 1.5 : 0; break; }
        case 'reveal': case 'scanKinds': s += hiddenN ? 3 + 2.2 * Math.min(hiddenN, fx.n || 2) + 4 * gp : 0.2; break;
        case 'heal': s += A ? (A.max - A.hp) * (A.jewel ? 1.7 : 0.9) + (A.down ? 9 : 0) : 0; break;
        case 'isolate': s += b.footholds.some(f => f.asset === A?.id) ? 4 + 5 * gp + (A?.id === intentAsset ? 4 : 0) : 0; break;
        case 'purge': s += b.footholds.filter(f => f.asset === A?.id).length * (hiddenN ? 6 : 6.5) + (A?.max - A?.hp) * 0.3; break;
        case 'draw': s += b.energy.cur > cost + 1 ? 3.2 : 1; break;
        case 'intel': s += b.intel < 3 ? 2 : 0.3; break;
        case 'shield': s += (A && A.id === intentAsset) ? 6 : 0.4; break;
        case 'unprivilege': case 'evictPrivileged': s += b.footholds.some(f => f.asset === A?.id && f.privileged) ? 7 : 0; break;
        case 'unprivilegeAll': s += b.footholds.filter(f => f.privileged).length * 3; break;
        case 'exposure': s += 2.6; break;
        case 'resilience': s += (b.res.max - b.res.cur) > 3 ? 4 + (b.res.cur / b.res.max < 0.5 ? 3 : 0) : 0.4; break;
        case 'restore': s += b.controls.some(k => k.asset === A?.id && k.disabledBy) ? 6 : 0; break;
        case 'restoreBackup': s += A ? b.footholds.filter(f => f.asset === A.id).length * 5 + (A.max - A.hp) * 1.2 + (A.down ? 8 : 0) - 4 : 0; break;
        case 'clearCreds': s += b.adv.creds ? 3 : 0; break;
        case 'unstage': s += A?.staged ? 5 : 0; break;
        case 'blockPath': s += 1; break;
        case 'shieldExfil': s += b.assets.some(a => a.staged) ? 5 : 0.3; break;
        case 'damage': s -= fx.n * (A?.jewel ? 2.5 : 1.3); break;
        default: s += 1;
      }
    }
    if (!e.fx?.length) s = 0;
    // one-shot consumables: hold for an emergency unless the agent is careless
    if (e.consume === 'run' && P.holdConsumables && gp < 0.55 && b.res.cur / b.res.max > 0.5) s -= 6;
    if (e.consume === 'battle' && P.holdConsumables && gp < 0.35 && b.res.cur / b.res.max > 0.6) s -= 3;
    if (e.id === 'x.killswitch' && A) s += b.footholds.filter(f => f.asset === A.id).length * 2;
  }
  return s - cost * 0.8;
}

/** Capability bans for ablation experiments ("how much does this mechanic carry the game?"). */
export function banned(e, kind) {
  const ops = (e.fx || []).map(f => f.op);
  switch (kind) {
    case 'ward': return e.type === 'control' && !!e.ward;
    case 'detect': return !!e.detect || ops.some(o => ['reveal', 'scanKinds'].includes(o));
    case 'evict': return ops.some(o => ['evict', 'evictPrivileged', 'purge', 'restoreBackup'].includes(o));
    case 'heal': return !!e.aegis || ops.some(o => ['heal', 'resilience'].includes(o));
    case 'policy': return e.type === 'policy';
    case 'augment': return e.type === 'augment';
    case 'intel': return ops.includes('intel') || ops.includes('draw');
    case 'consumable': return !!e.consume;
    case 'isolate': return ops.some(o => ['isolate', 'shield', 'blockPath'].includes(o));
    default: return false;
  }
}

export function makeAgent(skill = 'standard', seed = 'agent') {
  const P = typeof skill === 'string' ? SKILLS[skill] : skill;
  const rng = makeRng(seed + '|' + (typeof skill === 'string' ? skill : 'custom'));
  const agent = {
    name: typeof skill === 'string' ? skill : 'custom', P,
    /** All legal plays with scores (descending). */
    options(content, b) {
      const ctx = { brief: briefing(content, b), hiddenN: b.footholds.filter(f => !f.revealed).length, gp: goalPressure(content, b), P };
      const out = [], seen = new Set();
      for (const iid of b.hand) {
        const e = B.effCard(content, b, iid);
        if (e.unplayable || e.type === 'status' || B.cardCost(content, b, iid) > b.energy.cur) continue;
        if (P.ban && P.ban.some(k => banned(e, k))) continue;
        for (const t of B.validTargets(content, b, iid)) {
          const key = b.cards[iid].id + JSON.stringify(t) + b.cards[iid].ml; if (seen.has(key)) continue; seen.add(key);
          out.push({ iid, target: t, s: scorePlay(content, b, iid, t, ctx) });
        }
      }
      return out.sort((x, y) => y.s - x.s);
    },
    pick(content, b) {
      const opts = this.options(content, b); if (!opts.length) return null;
      if (P.noise) for (const o of opts) o.n = o.s + rng.normal() * P.noise; else for (const o of opts) o.n = o.s;
      opts.sort((x, y) => y.n - x.n);
      const best = opts[0];
      return best.n > P.thresh ? best : null;
    },
    power(content, b) {
      if (!b.doctrine || b.powerUsed || rng() > P.power) return null;
      const p = content.doctrines[b.doctrine].power; if (p.cost > b.energy.cur) return null;
      const hidden = b.footholds.some(f => !f.revealed);
      let target = {};
      if (p.target === 'asset') {
        const hurt = b.assets.filter(a => a.hp < a.max).sort((x, y) => (y.max - y.hp) - (x.max - x.hp))[0];
        const threatened = b.assets.filter(a => b.footholds.some(f => f.asset === a.id)).sort((x, y) => assetValue(y) - assetValue(x))[0];
        target = { asset: (hurt || threatened || b.assets.find(a => a.jewel)).id };
      }
      const op = p.fx[0].op;
      if ((op === 'reveal' || op === 'scanKinds') && !hidden) return null;
      return target;
    },
    /** One full defender turn. ctl = { b(): current battle, do(action): apply a battle action }. */
    turn(content, ctl) {
      const tryDo = a => { try { ctl.do(a); return true; } catch (e) { if (e instanceof B.GameError || /illegal/.test(e.message)) return false; throw e; } };
      for (let guard = 0; guard < 30 && !ctl.b().over; guard++) {
        const b = ctl.b();
        if (b.ttx?.pending) this.decide(ctl);
        if (rng() < P.skip) break;
        const best = this.pick(content, ctl.b()); if (!best) break;
        if (!tryDo({ type: 'PLAY', iid: best.iid, target: best.target })) break;
      }
      if (!ctl.b().over) { const t = this.power(content, ctl.b()); if (t) tryDo({ type: 'POWER', target: t }); }
      for (let g = 0; g < 8 && !ctl.b().over; g++) { const best = this.pick(content, ctl.b()); if (!best) break; if (!tryDo({ type: 'PLAY', iid: best.iid, target: best.target })) break; }
      if (!ctl.b().over) ctl.do({ type: 'END_TURN' });
    },
    decide(ctl) {
      const p = ctl.b().ttx?.pending; if (!p) return;
      const order = ['best', 'good', 'ok', 'poor'];
      const acc = P === SKILLS.novice ? 0.45 : P === SKILLS.sharp ? 0.97 : 0.8;
      const ch = rng() < acc ? p.choices.find(c => c.quality === 'best') : rng.pick(p.choices);
      ctl.do({ type: 'DECIDE', choice: (ch || p.choices[0]).id });
    }
  };
  return agent;
}
