// Turns real ATT&CK techniques into playable adversary cards.
// Card *statistics* (cost, power, stealth) are fictional gameplay values derived from the tactic a
// technique belongs to; the technique ids, names, tactics and mitigations are MITRE data.

export const TACTIC_ORDER = ['reconnaissance', 'resource-development', 'initial-access', 'execution', 'persistence', 'privilege-escalation', 'stealth', 'defense-evasion', 'defense-impairment', 'credential-access', 'discovery', 'lateral-movement', 'collection', 'command-and-control', 'exfiltration', 'inhibit-response-function', 'impair-process-control', 'impact'];

/** Tactic → gameplay archetype. kind decides what the card *does*; stride is the property it attacks. */
export const ARCHETYPE = {
  'reconnaissance':            { kind: 'prep',     stride: 'I', cost: 1, power: 0, stealth: 0 },
  'resource-development':      { kind: 'prep',     stride: 'T', cost: 1, power: 0, stealth: 0 },
  'initial-access':            { kind: 'breach',   stride: 'S', cost: 2, power: 3, stealth: 2 },
  'execution':                 { kind: 'arm',      stride: 'T', cost: 1, power: 1, stealth: 0 },
  'persistence':               { kind: 'persist',  stride: 'T', cost: 1, power: 0, stealth: 0 },
  'privilege-escalation':      { kind: 'escalate', stride: 'E', cost: 2, power: 3, stealth: 0 },
  'stealth':                   { kind: 'evade',    stride: 'R', cost: 1, power: 2, stealth: 0 },
  'defense-evasion':           { kind: 'evade',    stride: 'R', cost: 1, power: 2, stealth: 0 }, // ICS "Evasion"
  'defense-impairment':        { kind: 'disable',  stride: 'R', cost: 2, power: 2, stealth: 0 },
  'credential-access':         { kind: 'creds',    stride: 'S', cost: 1, power: 2, stealth: 0 },
  'discovery':                 { kind: 'map',      stride: 'I', cost: 1, power: 1, stealth: 0 },
  'lateral-movement':          { kind: 'spread',   stride: 'E', cost: 2, power: 3, stealth: 1 },
  'collection':                { kind: 'stage',    stride: 'I', cost: 1, power: 1, stealth: 0 },
  'command-and-control':       { kind: 'beacon',   stride: 'T', cost: 1, power: 1, stealth: 0 },
  'exfiltration':              { kind: 'exfil',    stride: 'I', cost: 2, power: 4, stealth: 0 },
  'impact':                    { kind: 'strike',   stride: 'D', cost: 3, power: 5, stealth: 0 },
  'inhibit-response-function': { kind: 'inhibit',  stride: 'D', cost: 2, power: 3, stealth: 0 },
  'impair-process-control':    { kind: 'impair',   stride: 'T', cost: 3, power: 5, stealth: 0 }
};

export const KIND_TEXT = {
  prep: 'Prepares the operation: the next Breach or Spread this adversary plays is stronger.',
  breach: 'Gains a hidden foothold on an exposed asset unless wards stop it.',
  arm: 'Strengthens a foothold (+1 grip) so it is harder to evict.',
  persist: 'Foothold survives eviction once: it reappears next round.',
  escalate: 'Foothold becomes privileged — unlocks Strike on servers, data and identity assets.',
  evade: 'Raises foothold stealth so monitoring needs a stronger signal to see it.',
  disable: 'Disables a defensive control on the asset until the foothold is evicted or the control is restored.',
  creds: 'Steals credentials: later Spread cards shrug off 1 ward. Hurts identity assets.',
  map: 'Maps the network: reveals which assets are adjacent and lowers the next Spread’s cost.',
  spread: 'Moves to an adjacent asset, creating a new hidden foothold.',
  stage: 'Stages data on the asset, enabling Exfiltration.',
  beacon: 'Command-and-control channel: drains Resilience each round until cut.',
  exfil: 'Steals staged data. Crown-jewel data is a breach.',
  strike: 'Destroys asset integrity. Ransomware also wrecks adjacent backups.',
  inhibit: 'Disables response and monitoring controls on an OT asset.',
  impair: 'Manipulates the physical process: damages OT assets directly.'
};

// Techniques that need no foothold: they hit exposed assets from outside.
export const REMOTE_STRIKE = new Set(['T1498', 'T1499', 'T1496', 'T1491', 'T1531']);
// Gameplay STRIDE overrides (heuristic — ATT&CK has no official STRIDE mapping).
const STRIDE_OVERRIDE = {
  T1486: 'D', T1485: 'D', T1561: 'D', T1490: 'D', T1498: 'D', T1499: 'D', T1496: 'D', T1529: 'D',
  T1565: 'T', T1491: 'T', T1195: 'T', T1189: 'T', T1505: 'T', T1542: 'T', T1554: 'T',
  T1190: 'E', T1068: 'E', T1548: 'E', T1134: 'E', T1021: 'E', T1210: 'E',
  T1078: 'S', T1133: 'S', T1199: 'S', T1566: 'S', T1110: 'S', T1621: 'S', T1557: 'S', T1111: 'S', T1528: 'S', T1539: 'S', T1556: 'S', T1003: 'S', T1558: 'S', T1098: 'E', T1136: 'E',
  T1070: 'R', T1562: 'R', T1036: 'R', T1027: 'R', T1685: 'R', T1654: 'R', T1222: 'R',
  T1048: 'I', T1041: 'I', T1567: 'I', T1530: 'I', T1537: 'I', T1552: 'I', T1005: 'I', T1213: 'I', T1119: 'I', T1040: 'I', T1020: 'I'
};
export function strideOf(techId, tactic) {
  const base = techId.split('.')[0];
  return STRIDE_OVERRIDE[techId] || STRIDE_OVERRIDE[base] || ARCHETYPE[tactic].stride;
}

/**
 * Pick the tactic under which a technique is played. Techniques list several tactics
 * (e.g. T1078 = initial-access, persistence, ...). We choose the one with the most gameplay relevance
 * for the adversary's role: prefer the earliest tactic that the scenario's phase wants, else first.
 */
export function primaryTactic(tacs) {
  const known = tacs.filter(t => ARCHETYPE[t]);
  if (!known.length) return null;
  return known[0];
}

/**
 * Compile adversary deck data (data/adversaries/<id>.json) into playable cards.
 * tier: 1 commodity | 2 intrusion set | 3 apex. Higher tiers: more power, more cards of signature techniques.
 */
// Baseline tradecraft: commodity techniques most intrusion sets use (ATT&CK-derived prevalence `p`). They give each
// adversary a believable common core and make every battle a little different, while the *signature* overlay
// (the adversary's own techniques) and all payoff cards (exfil/strike/impair/inhibit) stay adversary-specific.
const BASELINE_KINDS = ['breach', 'arm', 'persist', 'escalate', 'evade', 'disable', 'creds', 'map', 'spread', 'stage', 'beacon'];
const BASELINE_SLOTS = [7, 5, 4];   // commodity actors lean on common tradecraft; apex actors on their own

export function compileDeck(adv, { tier = 1, size = 22, tacticsAllowed = null, assessed = [], techTable = null, rand = null, goal = null } = {}) {
  const cards = [];
  const techs = [...adv.techs, ...(techTable ? assessed.filter(a => techTable[a]).map(a => ({ id: a, n: techTable[a].n, tac: techTable[a].tac, m: techTable[a].m || [] })) : [])];
  for (const t of adv.techs) {
    const tactic = primaryTactic(t.tac);
    if (!tactic) continue;
    if (tacticsAllowed && !tacticsAllowed.includes(tactic)) continue;
    const a = ARCHETYPE[tactic];
    const sig = (t.d || 0) >= 2;
    cards.push({
      id: t.id, name: t.n, tactic, kind: a.kind, stride: strideOf(t.id, tactic),
      cost: a.cost, power: a.power + (a.power > 0 ? Math.floor((tier - 1) / 1) * 0 : 0) + (sig && a.power > 1 ? 1 : 0),
      stealth: a.stealth, mit: t.m || [], ev: t.ev || 0, sig,
      remote: REMOTE_STRIKE.has(t.id.split('.')[0]) && a.kind === 'strike'
    });
  }
  // Balanced kill chain: cap each archetype so decks don't drown in (say) discovery cards.
  const CAP = { prep: 1, breach: 3, arm: 1, persist: 1, escalate: 2, evade: 2, disable: 2, creds: 2, map: 1, spread: 3, stage: 2, beacon: 1, exfil: 3, strike: 3, inhibit: 2, impair: 3 };
  const byKind = new Map();
  for (const c of cards) (byKind.get(c.kind) || byKind.set(c.kind, []).get(c.kind)).push(c);
  for (const list of byKind.values()) list.sort((x, y) => y.ev - x.ev || x.id.localeCompare(y.id));
  const chosen = [];
  for (const [k, list] of byKind) chosen.push(...list.slice(0, CAP[k] ?? 1));
  // Adversaries with no observed destructive technique (e.g. pre-positioning actors) get *assessed-intent*
  // cards from their meta, clearly labelled as such in the UI.
  for (const a of assessed) {
    const t = techs.find(x => x.id === a);
    if (!t || chosen.some(c => c.id === a)) continue;
    const tactic = primaryTactic(t.tac); if (!tactic) continue;
    const ar = ARCHETYPE[tactic];
    chosen.push({ id: a, name: t.n, tactic, kind: ar.kind, stride: strideOf(a, tactic), cost: ar.cost, power: ar.power, stealth: ar.stealth, mit: t.m || [], ev: 0, sig: false, assessed: true, remote: false });
  }
  // Goal payoffs: an adversary whose goal needs impact/exfiltration but whose observed technique list lacks enough of it
  // draws the missing payoff cards from what real incidents with the same goal used (ATT&CK Attack Flow corpus).
  if (rand && techTable && goal?.kinds?.length) {
    const doms = new Set(adv.domains || ['enterprise']);
    const have = chosen.filter(c => goal.kinds.includes(c.kind)).length, want = 2 - have;
    const mk = (wOf) => Object.entries(techTable).filter(([id, t]) => wOf(t) && doms.has(t.dom || 'enterprise') && !chosen.some(c => c.id.split('.')[0] === id.split('.')[0])).map(([id, t]) => {
      const tactic = primaryTactic(t.tac); if (!tactic) return null; const kind = ARCHETYPE[tactic].kind;
      return goal.kinds.includes(kind) ? { id, t, tactic, kind, w: wOf(t) } : null;
    }).filter(Boolean).sort((a, b) => a.id.localeCompare(b.id));
    let pool = mk(t => t.g?.[goal.key]);
    if (!pool.length) pool = mk(t => t.p);   // goals with no observed incidents yet fall back to general prevalence
    for (let n = 0; n < want && pool.length; n++) {
      const total = pool.reduce((x, c) => x + c.w, 0); let r = rand() * total, i = 0;
      while (i < pool.length - 1 && (r -= pool[i].w) > 0) i++;
      const c = pool.splice(i, 1)[0], a = ARCHETYPE[c.tactic];
      chosen.push({ id: c.id, name: c.t.n, tactic: c.tactic, kind: a.kind, stride: strideOf(c.id, c.tactic), cost: a.cost, power: a.power, stealth: a.stealth, mit: c.t.m || [], ev: 0, sig: false, goalCard: true, remote: false });
    }
  }
  if (rand && techTable) {
    const doms = new Set(adv.domains || ['enterprise']);
    const have = new Set(chosen.map(c => c.id.split('.')[0])), advTac = new Set(adv.techs.flatMap(t => t.tac));
    const perKind = {};
    const pool = Object.entries(techTable).filter(([id, t]) => t.p && doms.has(t.dom || 'enterprise') && !have.has(id.split('.')[0])).map(([id, t]) => {
      const tactic = primaryTactic(t.tac); if (!tactic || (tacticsAllowed && !tacticsAllowed.includes(tactic))) return null;
      const kind = ARCHETYPE[tactic].kind; if (!BASELINE_KINDS.includes(kind)) return null;
      return { id, t, tactic, kind, w: Math.pow(t.p, 1.5) * (advTac.has(tactic) ? 1.5 : 1) };
    }).filter(Boolean).sort((a, b) => a.id.localeCompare(b.id));   // stable order: determinism
    for (let n = 0; n < BASELINE_SLOTS[Math.min(2, tier - 1)] && pool.length; n++) {
      const total = pool.reduce((x, c) => x + c.w, 0); let r = rand() * total, i = 0;
      while (i < pool.length - 1 && (r -= pool[i].w) > 0) i++;
      const c = pool.splice(i, 1)[0];
      if ((perKind[c.kind] = (perKind[c.kind] || 0) + 1) > 2 || chosen.filter(x => x.kind === c.kind).length >= (CAP[c.kind] ?? 1) + 1) continue;
      have.add(c.id.split('.')[0]);
      const a = ARCHETYPE[c.tactic];
      chosen.push({ id: c.id, name: c.t.n, tactic: c.tactic, kind: a.kind, stride: strideOf(c.id, c.tactic), cost: a.cost, power: a.power, stealth: a.stealth, mit: c.t.m || [], ev: 0, sig: false, baseline: true, prev: c.t.p, remote: false });
    }
  }
  // If over budget, drop the least valuable cards first (never the payoff cards at the end of the kill chain).
  const value = (c) => (c.goalCard ? 500 : 0) + (c.baseline ? 5 + (c.prev || 0) / 10 : 0) + (c.assessed ? 1000 : 0) + ({ exfil: 60, strike: 60, impair: 60, inhibit: 30, spread: 25, escalate: 22, stage: 22, breach: 24, creds: 14, disable: 14 }[c.kind] || 0) + (c.ev || 0);
  const kept = chosen.slice().sort((a, b) => value(b) - value(a) || a.id.localeCompare(b.id)).slice(0, size + assessed.length);
  return kept.sort((a, b) => TACTIC_ORDER.indexOf(a.tactic) - TACTIC_ORDER.indexOf(b.tactic) || b.ev - a.ev);
}
