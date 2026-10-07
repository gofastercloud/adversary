// Generates player-facing rules text from the data model, so text can never drift from behaviour.

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const list = (a) => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' or ' + a[a.length - 1];
const arr = v => Array.isArray(v) ? v : [v];

export function names(content) {
  const fn = Object.fromEntries(content.fns.map(f => [f.id, f.name]));
  const prop = Object.fromEntries(content.props.map(p => [p.id, p.name]));
  const hand = Object.fromEntries(Object.values(content.handTypes).map(h => [h.id, h.name]));
  return { fn, prop, hand };
}
const fmt = (n) => (Number.isInteger(n) ? String(n) : String(+n.toFixed(2)));

function cardNoun(c, nm) {
  const parts = [];
  if (c.fn) parts.push(list(arr(c.fn).map(x => nm.fn[x])));
  if (c.prop) parts.push(list(arr(c.prop).map(x => nm.prop[x])));
  if (c.ml) parts.push(`ML${c.ml}`);
  if (c.mlMin) parts.push(`ML${c.mlMin}+`);
  if (c.counter) parts.push('counter-measure');
  return parts.length ? parts.join(' ') + ' ' : '';
}
function handConds(c, nm) {
  const out = [];
  if (c.hand) out.push(`the hand is ${list(c.hand.map(h => nm.hand[h]))}`);
  if (c.contains) out.push(`the hand contains ${list(c.contains.map(h => (nm.hand[h] || h.replace('_', ' '))))}`);
  if (c.playedMax != null) out.push(`${c.playedMax} or fewer cards are played`);
  if (c.playedMin != null) out.push(`at least ${c.playedMin} cards are played`);
  if (c.scoringMin != null) out.push(`at least ${c.scoringMin} cards score`);
  if (c.handsLeft != null) out.push(c.handsLeft === 0 ? 'it is the final Deploy' : `${plural(c.handsLeft, 'Deploy')} remain after it`);
  if (c.firstHand) out.push('it is the first Deploy of the round');
  if (c.noDiscardsUsed) out.push('no Replaces have been used this round');
  if (c.distinctFnsMin != null) out.push(`${c.distinctFnsMin}+ different CSF functions are played`);
  if (c.distinctPropsMin != null) out.push(`${c.distinctPropsMin}+ different properties are played`);
  if (c.distinctPropsMax != null) out.push(`at most ${c.distinctPropsMax} property type is played`);
  if (c.moneyMin != null) out.push(`you hold $${c.moneyMin}+`);
  if (c.moneyMax != null) out.push(`you hold $${c.moneyMax} or less`);
  if (c.jokersMax != null) out.push(`you own ${c.jokersMax} or fewer Doctrines`);
  if (c.boss) out.push('facing a Boss');
  if (c.cardsMin != null) out.push(`${c.cardsMin}+ cards are discarded`);
  return out;
}
function effects(d, per, nm, curV) {
  if (!d) return '';
  const e = [];
  const val = v => (v === '$v' ? (curV != null ? fmt(curV) : 'X') : fmt(v));
  const perTxt = per ? ' ' + perPhrase(per, nm) : '';
  if (d.chips != null) e.push(`+${val(d.chips)} Chips${perTxt}`);
  if (d.mult != null) e.push(`+${val(d.mult)} Mult${perTxt}`);
  if (d.xmult != null) e.push(per ? `×(1 + ${fmt(d.xmult)}${perTxt.replace(' per', ' per')}) Mult`.replace(/\(1 \+ ([\d.]+) per/, '(1 + $1 per') + '' : `×${fmt(d.xmult)} Mult`);
  if (d.money != null) e.push(`+$${val(d.money)}${perTxt}`);
  if (d.times != null) e.push(`${d.times} extra time${d.times === 1 ? '' : 's'}`);
  if (d.handSize != null) e.push(`${d.handSize > 0 ? '+' : ''}${d.handSize} hand size`);
  if (d.hands != null) e.push(`${d.hands > 0 ? '+' : ''}${d.hands} Deploy${Math.abs(d.hands) === 1 ? '' : 's'} per round`);
  if (d.discards != null) e.push(`${d.discards > 0 ? '+' : ''}${d.discards} Replace${Math.abs(d.discards) === 1 ? '' : 's'} per round`);
  if (d.jokerSlots != null) e.push(`${d.jokerSlots > 0 ? '+' : ''}${d.jokerSlots} Doctrine slot`);
  if (d.consumableSlots != null) e.push(`${d.consumableSlots > 0 ? '+' : ''}${d.consumableSlots} consumable slot`);
  if (d.interestCap != null) e.push(`+$${d.interestCap} interest cap`);
  return e.join(', ');
}
function perPhrase(p, nm) {
  const f = [];
  if (p.fn) f.push(list(arr(p.fn).map(x => nm.fn[x])));
  if (p.prop) f.push(list(arr(p.prop).map(x => nm.prop[x])));
  if (p.ml) f.push(`ML${p.ml}`);
  const q = f.join(' ');
  switch (p.count) {
    case 'scoringCards': return `per scored ${q ? q + ' ' : ''}card`;
    case 'playedCards': return `per played ${q ? q + ' ' : ''}card`;
    case 'heldCards': return `per ${q ? q + ' ' : ''}card held`;
    case 'discardedCards': return `per discarded ${q ? q + ' ' : ''}card`;
    case 'jokers': return 'per Doctrine owned';
    case 'money': return `per $${p.step} held`;
    case 'deckSize': return 'per card in your deck';
    case 'handLevel': return 'per level of the played hand';
    case 'distinctProps': return 'per different property played';
    case 'distinctFns': return 'per different function played';
    case 'handsLeft': return 'per remaining Deploy';
    case 'discardsLeft': return 'per remaining Replace';
    case 'v': return 'per stack';
    default: return '';
  }
}

export function describeRule(rule, content, v) {
  const nm = names(content);
  const c = rule.if || {};
  const cardPart = cardNoun(c, nm);
  const handPart = handConds(c, nm);
  const cond = handPart.length ? ` if ${handPart.join(' and ')}` : '';
  let subject;
  switch (rule.on) {
    case 'card': subject = `Each scored ${cardPart}card`; break;
    case 'held': subject = `Each ${cardPart}card held in hand`; break;
    case 'hand': subject = handPart.length ? cap(`when ${handPart.join(' and ')}`) : 'Every Deploy'; break;
    case 'retrigger': subject = `Retrigger each scored ${cardPart}card`; break;
    case 'discard': subject = handPart.length ? cap(`on Replace, ${handPart.join(' and ')}`) : 'On Replace'; break;
    case 'round_end': subject = 'End of round' + cond; break;
    case 'boss_defeated': subject = 'When a Boss is defeated'; break;
    case 'passive': subject = ''; break;
    default: subject = '';
  }
  if (['card', 'held'].includes(rule.on) && handPart.length) subject += cond;
  let text;
  if (rule.on === 'retrigger') text = `${subject} ${effects(rule.do, null, nm, v)}`;
  else if (rule.on === 'passive') text = cap(effects(rule.do, null, nm, v));
  else if (rule.grow && !rule.do) {
    const trig = { hand: 'a hand is played', card: 'a card scores', discard: 'you Replace', round_end: 'a round ends', boss_defeated: 'a Boss is defeated' }[rule.on] || 'triggered';
    const when = handPart.length ? ` (${handPart.join(' and ')})` : '';
    text = `Gains +${fmt(rule.grow.by)} each time ${trig}${when}`;
    if (rule.grow.reset) text += `; resets if ${handConds(rule.grow.reset, nm).join(' and ') || 'reset'}`;
  } else text = `${subject}: ${effects(rule.do, rule.per, nm, v)}`;
  if (v == null && JSON.stringify(rule.do || {}).includes('$v')) text += ' (X grows over the run)';
  return text.replace(/\s+/g, ' ').trim();
}

export function describeJoker(j, content, v) {
  return j.rules.map(r => describeRule(r, content, v));
}

export function describeBossRule(rule, content) {
  const nm = names(content);
  const out = [];
  if (rule.debuffFn) out.push(`${list(arr(rule.debuffFn).map(x => nm.fn[x]))} cards are debuffed`);
  if (rule.debuffProp) out.push(`${list(arr(rule.debuffProp).map(x => nm.prop[x]))} cards are debuffed`);
  if (rule.handsSet != null) out.push(`Only ${plural(rule.handsSet, 'Deploy')}`);
  if (rule.discardsSet != null) out.push(rule.discardsSet === 0 ? 'No Replaces' : `Only ${plural(rule.discardsSet, 'Replace')}`);
  if (rule.handSizeDelta) out.push(`${rule.handSizeDelta} hand size`);
  if (rule.playMin) out.push(`Hands must contain ${rule.playMin}+ cards`);
  if (rule.halveBase) out.push('Hand base Chips and Mult are halved');
  if (rule.moneyPerCard) out.push(`Lose $${Math.abs(rule.moneyPerCard)} per card played`);
  if (rule.noRepeatHand) out.push('A hand type scores nothing if already played this round');
  if (rule.oneHandType) out.push('Only the first hand type played scores');
  if (rule.disableJoker) out.push('A random Doctrine is disabled each Deploy');
  if (rule.targetMult) out.push(`Target ×${rule.targetMult}`);
  return out;
}

export function describePlaybook(p, content) {
  const nm = names(content);
  const t = p.target ? (p.target.min === p.target.max ? `${p.target.max}` : `${p.target.min}–${p.target.max}`) : '';
  switch (p.op) {
    case 'setProp': return `Convert ${t} selected control${p.target.max > 1 ? 's' : ''} to ${nm.prop[p.params.prop]} (${content.props.find(x => x.id === p.params.prop).stride})`;
    case 'setFn': return `Convert ${t} selected control${p.target.max > 1 ? 's' : ''} to ${nm.fn[p.params.fn]}`;
    case 'upgrade': return `Raise ${t} selected control${p.target.max > 1 ? 's' : ''} by one maturity level (max ML3)`;
    case 'destroy': return `Destroy ${t} selected control${p.target.max > 1 ? 's' : ''} permanently`;
    case 'clone': return `Add a copy of ${t} selected control to your deck and hand`;
    case 'copyFn': return `${t} selected: all but the last take the last one’s CSF function`;
    case 'money': return `Double your budget (max +$${p.params.cap})`;
    case 'createJoker': return 'Create a random Doctrine (needs a free slot)';
    default: return '';
  }
}

export function describeFramework(f, content) {
  const h = content.handTypes[f.hand];
  return `Level up ${h.name}: +${h.lchips} Chips, +${h.lmult} Mult`;
}
