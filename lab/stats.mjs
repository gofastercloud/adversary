export const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
export const sd = a => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
/** Wilson score interval for a proportion (95%). */
export function wilson(k, n, z = 1.96) { if (!n) return { p: 0, lo: 0, hi: 0, n }; const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return { p, lo: (c - m) / d, hi: (c + m) / d, n }; }
export const pct = x => (100 * x).toFixed(0) + '%';
export const groupBy = (arr, f) => { const m = new Map(); for (const x of arr) { const k = f(x); (m.get(k) || m.set(k, []).get(k)).push(x); } return m; };
export const rate = (arr, f = x => x.won) => wilson(arr.filter(f).length, arr.length);
/** Paired difference of means with a normal-approx 95% CI. */
export function pairedDiff(a, b) { const d = a.map((x, i) => x - b[i]); const m = mean(d), s = sd(d) / Math.sqrt(d.length || 1); return { diff: m, lo: m - 1.96 * s, hi: m + 1.96 * s, n: d.length }; }
