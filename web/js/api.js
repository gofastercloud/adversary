// Backend client. Everything degrades gracefully offline: the game is fully playable without the API.
// Fails closed: until config.json says otherwise (and if it cannot be read) there is no backend and no request is made.
let cfg = { apiBase: null };
export async function initApi() {
  try {
    const r = await fetch('config.json', { cache: 'no-cache' });
    const c = r.ok ? await r.json() : null;
    cfg = c && typeof c === 'object' && typeof c.apiBase === 'string' ? c : { apiBase: null };
  } catch { cfg = { apiBase: null }; }
}
// false in a static build with no backend (API_BASE=off gives apiBase null): the UI hides leaderboards, handles and cloud sync
export const online = () => !!cfg.apiBase;
const LS = 'adversary.player.v1';
export function player() {
  try { const p = JSON.parse(localStorage.getItem(LS)); if (p?.id && p?.secret) return p; } catch { /* ignore */ }
  const rnd = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, '0')).join('');
  const p = { id: rnd().slice(0, 24), secret: rnd(), handle: 'Defender-' + rnd().slice(0, 4).toUpperCase() };
  try { localStorage.setItem(LS, JSON.stringify(p)); } catch { /* private mode */ }
  return p;
}
export function setHandle(h) { const p = player(); p.handle = String(h).replace(/[^\w .\-]/g, '').slice(0, 20) || p.handle; try { localStorage.setItem(LS, JSON.stringify(p)); } catch { /* ignore */ } return p; }
async function call(path, { method = 'GET', body, auth = false, timeout = 8000 } = {}) {
  if (!cfg.apiBase) return { ok: false, error: 'offline' };
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const p = player();
    const r = await fetch(cfg.apiBase + path, { method, signal: ctl.signal, headers: { 'content-type': 'application/json', ...(auth ? { authorization: `Bearer ${p.id}.${p.secret}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, status: r.status, error: data.error || r.statusText, data };
    return { ok: true, data };
  } catch (e) { return { ok: false, error: 'offline' }; } finally { clearTimeout(t); }
}
export const getDaily = () => call('/daily');
export const getBoard = (board) => call('/leaderboard?board=' + encodeURIComponent(board));
export const submitRun = (payload) => call('/runs', { method: 'POST', body: { ...payload, handle: player().handle, playerId: player().id }, auth: true, timeout: 20000 });
export const putProfile = (profile) => call('/profile', { method: 'PUT', body: { profile }, auth: true });
export const getProfileRemote = () => call('/profile', { auth: true });
