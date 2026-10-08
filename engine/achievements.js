// Achievements + profile progression. Declarative and event-driven:
//   rule: { event, where?, scope: 'lifetime'|'run', gte?: N (default 1), sum?: 'payloadKey' }
// Every engine/run event flows through evaluate(); the same function runs in the browser (instant
// feedback) and in the Lambda (so verified submissions record achievements server-side).

export const TIER_XP = { bronze: 25, silver: 60, gold: 120, platinum: 250 };

export function emptyProfile() {
  return { v: 1, xp: 0, ach: { unlocked: {}, progress: {} }, stats: { runs: 0, wins: 0, battles: 0, bestPoints: 0, playSeconds: 0 }, codex: { adv: {}, tech: {}, card: {}, relic: {}, ref: {} }, unlocks: { doctrines: ['architect'], assurance: 1 }, daily: { streak: 0, best: 0, last: null, done: {} }, settings: {} };
}

// where-matcher: { key: value | {gte,lte,gt,lt,in,has,not,eq,exists} } with dotted keys
function get(o, path) { return path.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o); }
function match(v, m) {
  if (m !== null && typeof m === 'object' && !Array.isArray(m)) {
    if ('eq' in m && v !== m.eq) return false;
    if ('gte' in m && !(v >= m.gte)) return false;
    if ('lte' in m && !(v <= m.lte)) return false;
    if ('gt' in m && !(v > m.gt)) return false;
    if ('lt' in m && !(v < m.lt)) return false;
    if ('in' in m && !m.in.includes(v)) return false;
    if ('not' in m && match(v, m.not)) return false;
    if ('exists' in m && (v != null) !== m.exists) return false;
    if ('has' in m) { if (!Array.isArray(v) || !v.some(el => (typeof m.has === 'object' ? Object.entries(m.has).every(([k, mm]) => match(get(el, k), mm)) : el === m.has))) return false; }
    if ('keys' in m && !(v && typeof v === 'object' && Object.keys(v).length >= m.keys)) return false;
    return true;
  }
  return v === m;
}
export function matches(rule, ev) {
  if (ev.t !== rule.event) return false;
  for (const [k, m] of Object.entries(rule.where || {})) if (!match(get(ev, k), m)) return false;
  return true;
}

/**
 * @param {object} content   content.achievements: [{id, rule, ...}]
 * @param {object} profile   mutated copy returned
 * @param {object} runCtx    { progress: {} } — run-scoped counters; pass the same object for the whole run
 * @param {Array}  events
 * @returns {{profile, unlocked:[achievement], xpGained}}
 */
export function evaluate(content, profile0, runCtx, events) {
  const profile = structuredClone(profile0);
  const unlocked = [];
  let xpGained = 0;
  const queue = events.slice();
  const lvl0 = clearanceOf(content, profile.xp).level;
  let lastLevel = lvl0;
  for (let qi = 0; qi < queue.length; qi++) {
    const ev = queue[qi];
    discover(profile, ev);
    for (const a of content.achievements) {
      if (profile.ach.unlocked[a.id]) continue;
      const r = a.rule;
      if (!matches(r, ev)) continue;
      const bag = r.scope === 'run' ? (runCtx.progress ||= {}) : profile.ach.progress;
      let done;
      if (r.distinct) {
        const key = a.id + ':set'; const set = new Set(bag[key] || []);
        const v = get(ev, r.distinct); if (v != null) set.add(v);
        bag[key] = [...set]; bag[a.id] = set.size; done = set.size >= (r.distinctGte ?? 1);
      } else {
        bag[a.id] = (bag[a.id] || 0) + (r.sum ? (Number(get(ev, r.sum)) || 0) : 1);
        done = bag[a.id] >= (r.gte ?? 1);
      }
      if (!done) continue;
      profile.ach.unlocked[a.id] = Date.now();
      const xp = a.xp ?? TIER_XP[a.tier] ?? 25;
      profile.xp += xp; xpGained += xp; unlocked.push(a);
      for (const u of a.unlocks || []) { if (u.doctrine && !profile.unlocks.doctrines.includes(u.doctrine)) profile.unlocks.doctrines.push(u.doctrine); if (u.assurance != null) profile.unlocks.assurance = Math.max(profile.unlocks.assurance, u.assurance); }
      queue.push({ t: 'ach_unlocked', id: a.id });
    }
    if (ev.t === 'run_won') profile.unlocks.assurance = Math.max(profile.unlocks.assurance, Math.min(3, (ev.assurance ?? 1) + 1));
    if (ev.t === 'run_won' || ev.t === 'run_lost') { profile.stats.runs++; if (ev.t === 'run_won') profile.stats.wins++; profile.stats.bestPoints = Math.max(profile.stats.bestPoints, ev.points || 0); }
    if (ev.t === 'battle_end') profile.stats.battles++;
    const l = clearanceOf(content, profile.xp).level;
    if (l !== lastLevel) { lastLevel = l; queue.push({ t: 'clearance', level: l }); }
  }
  return { profile, unlocked, xpGained, levelUp: lastLevel > lvl0 ? lastLevel : null };
}

/** Codex discovery: the collection loop. */
function discover(profile, ev) {
  const c = profile.codex;
  const bump = (bag, k) => { if (k != null) bag[k] = (bag[k] || 0) + 1; };
  switch (ev.t) {
    case 'battle_start': bump(c.adv, ev.adv); break;
    case 'adv_play': bump(c.tech, ev.tech); break;
    case 'played': bump(c.card, ev.card); break;
    case 'relic': bump(c.relic, ev.id); break;
    case 'card_added': bump(c.card, ev.id); break;
    case 'dossier_view': bump(c.adv, ev.adv); break;
    default: break;
  }
}

export function clearanceOf(content, xp) {
  const t = content.tuning.clearance;
  let lvl = 0; for (let i = 0; i < t.length; i++) if (xp >= t[i]) lvl = i;
  const next = t[lvl + 1] ?? null;
  return { level: lvl + 1, name: CLEARANCE_NAMES[Math.min(lvl, CLEARANCE_NAMES.length - 1)], xp, floor: t[lvl], next, pct: next ? (xp - t[lvl]) / (next - t[lvl]) : 1 };
}
export const CLEARANCE_NAMES = ['Analyst Trainee', 'SOC Analyst', 'Senior Analyst', 'Detection Engineer', 'Threat Hunter', 'Incident Lead', 'Security Architect', 'Principal Defender', 'Head of Security', 'CISO', 'Board Advisor', 'Cyber Legend'];

/** Collection completeness for the Codex header. */
export function codexProgress(content, profile) {
  const advTotal = Object.keys(content.adversaryMeta).filter(k => k[0] === 'G').length;
  const advSeen = Object.keys(profile.codex.adv).filter(k => k[0] === 'G').length;
  const cardTotal = content.cardPool.length, cardSeen = Object.keys(profile.codex.card).filter(k => content.cards[k]).length;
  const relicTotal = Object.keys(content.relics).length, relicSeen = Object.keys(profile.codex.relic).length;
  const techSeen = Object.keys(profile.codex.tech).length;
  return { adv: [advSeen, advTotal], cards: [cardSeen, cardTotal], relics: [relicSeen, relicTotal], techniques: [techSeen, Object.keys(content.techs).length] };
}
