// Counter-based, stateless-by-design PRNG: every draw is hash(seed, stream, counter).
// State is just a { stream: counter } object, so it serialises and replays exactly.

function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}
function mix(a) {
  a = (a ^ (a >>> 16)) >>> 0; a = Math.imul(a, 0x85ebca6b) >>> 0;
  a = (a ^ (a >>> 13)) >>> 0; a = Math.imul(a, 0xc2b2ae35) >>> 0;
  return (a ^ (a >>> 16)) >>> 0;
}

/** Draw a float in [0,1) from `stream`, advancing that stream's counter in `rng`. */
export function rand(rng, seed, stream) {
  const c = (rng[stream] = (rng[stream] || 0) + 1);
  const base = hashStr(`${seed}|${stream}`);
  return mix((base + Math.imul(c, 0x9e3779b1)) >>> 0) / 4294967296;
}
export const randInt = (rng, seed, stream, n) => Math.floor(rand(rng, seed, stream) * n);
export const pick = (rng, seed, stream, arr) => arr[randInt(rng, seed, stream, arr.length)];

/** Fisher–Yates on a copy. */
export function shuffle(rng, seed, stream, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(rng, seed, stream, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function weightedPick(rng, seed, stream, items, weightOf) {
  const total = items.reduce((s, it) => s + weightOf(it), 0);
  let r = rand(rng, seed, stream) * total;
  for (const it of items) { r -= weightOf(it); if (r < 0) return it; }
  return items[items.length - 1];
}

/** Daily seed: stable string for a Sydney calendar date (YYYY-MM-DD). */
export function dailySeed(dateStr) { return `daily-${dateStr}`; }

/** 53-bit string hash (cyrb53) — used for content fingerprints. */
export function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
