// Hand evaluation: CSF function = rank, STRIDE property = suit.
// Cards passed in are { fn: 0..5 (rank index), prop: 0..5, cell: 'protect.spoofing' }.

export const HAND_ORDER = ['monoculture', 'five', 'straight_flush', 'four', 'full_house', 'flush', 'straight', 'three', 'two_pair', 'pair', 'high_card'];

export function evalHand(cards) {
  const n = cards.length;
  const byFn = new Map();
  cards.forEach((c, i) => { (byFn.get(c.fn) || byFn.set(c.fn, []).get(c.fn)).push(i); });
  const groups = [...byFn.values()].sort((a, b) => b.length - a.length || a[0] - b[0]);
  const sizes = groups.map(g => g.length);

  const present = new Set();
  if (sizes[0] >= 2) present.add('pair');
  if (sizes.filter(s => s >= 2).length >= 2 || sizes[0] >= 4) present.add('two_pair');
  if (sizes[0] >= 3) present.add('three');
  if (sizes[0] >= 4) present.add('four');
  if (sizes[0] >= 5) present.add('five');
  if (sizes[0] >= 3 && sizes.filter(s => s >= 2).length >= 2) present.add('full_house');
  const flush = n === 5 && cards.every(c => c.prop === cards[0].prop);
  if (flush) present.add('flush');
  let straight = false;
  if (n === 5 && byFn.size === 5) {
    const fns = [...byFn.keys()].sort((a, b) => a - b);
    straight = fns[4] - fns[0] === 4;
  }
  if (straight) present.add('straight');
  if (flush && straight) present.add('straight_flush');
  const mono = n === 5 && cards.every(c => c.cell === cards[0].cell);
  if (mono) present.add('monoculture');

  let type = 'high_card';
  for (const t of HAND_ORDER) if (present.has(t)) { type = t; break; }
  present.add(type);

  let scoring;
  const all = cards.map((_, i) => i);
  switch (type) {
    case 'monoculture': case 'five': case 'straight_flush': case 'flush': case 'straight': case 'full_house': scoring = all; break;
    case 'four': scoring = groups[0].slice(0, 4); break;
    case 'three': scoring = groups[0].slice(0, 3); break;
    case 'two_pair': scoring = sizes[0] >= 4 ? groups[0].slice(0, 4) : [...groups[0], ...groups[1]]; break;
    case 'pair': scoring = groups[0].slice(0, 2); break;
    default: {
      // High card: the card from the most advanced CSF function (Recover > … > Govern).
      let best = 0;
      cards.forEach((c, i) => { if (c.fn > cards[best].fn) best = i; });
      scoring = [best];
    }
  }
  scoring = scoring.slice().sort((a, b) => a - b);
  return { type, scoring, contains: present };
}
