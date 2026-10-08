// The API application: pure functions over (event, store). Wrapped by Lambda entry points and the local emulator.
import { replay } from '../engine/run.js';
import { dailyConfig, sydneyDate } from '../engine/rng.js';
import { contentFor, scenarioIds, doctrineIds } from './lib/content.mjs';
import { json, err, bearer, parseBody, sanitiseHandle } from './lib/http.mjs';
import { sha256, safeEqual } from './lib/store.mjs';

const LIMITS = { runBody: 320_000, maxActions: 9000, profileBody: 64_000, perMinute: 6, perDay: 120 };
const BOARD_RE = /^(daily:\d{4}-\d{2}-\d{2}|all:[a-z0-9-]{2,32}:ML[0-3]|ttx:[a-z0-9-]{2,40})$/;
const DAY = 86400;

export function createApi(store, { now = () => Date.now() } = {}) {
  const sec = () => Math.floor(now() / 1000);

  async function authenticate(event, { register }) {
    const a = bearer(event); if (!a) return { res: err(401, 'missing or malformed credentials') };
    const p = await store.getPlayer(a.id);
    if (!p) {
      if (!register) return { res: err(401, 'unknown player') };
      if (!(await store.createPlayer(a.id, sha256(a.secret), 'Defender'))) return { res: err(409, 'player id already registered') };
      return { id: a.id, player: { handle: 'Defender' } };
    }
    if (!safeEqual(p.secretHash, sha256(a.secret))) return { res: err(403, 'bad credentials') };
    return { id: a.id, player: p };
  }

  async function rateLimit(id) {
    const m = await store.incr(id, 'm' + Math.floor(sec() / 60), sec() + 3600);
    if (m > LIMITS.perMinute) return err(429, 'slow down', { retryAfter: 60 });
    const d = await store.incr(id, 'd' + Math.floor(sec() / DAY), sec() + 2 * DAY);
    if (d > LIMITS.perDay) return err(429, 'daily submission limit reached');
    return null;
  }

  const read = async (event) => {
    const method = event.requestContext?.http?.method, path = event.rawPath || '';
    try {
      if (method === 'GET' && path.endsWith('/daily')) {
        const date = sydneyDate(new Date(now()));
        return json(200, { date, ...dailyConfig(date, scenarioIds, doctrineIds) }, { 'cache-control': 'public, max-age=60' });
      }
      if (method === 'GET' && path.endsWith('/leaderboard')) {
        const board = event.queryStringParameters?.board || '';
        if (!BOARD_RE.test(board)) return err(400, 'bad board');
        return json(200, { board, entries: await store.topBoard(board, 50) }, { 'cache-control': 'public, max-age=30' });
      }
      if (method === 'GET' && path.endsWith('/profile')) {
        const a = await authenticate(event, { register: false }); if (a.res) return a.res;
        const p = await store.getProfile(a.id); return json(200, { profile: p?.profile || null, updatedAt: p?.updatedAt || null });
      }
      return err(404, 'not found');
    } catch (e) { return fail(e); }
  };

  const write = async (event) => {
    const method = event.requestContext?.http?.method, path = event.rawPath || '';
    try {
      if (method === 'POST' && path.endsWith('/runs')) return await postRun(event);
      if (method === 'PUT' && path.endsWith('/profile')) return await putProfile(event);
      return err(404, 'not found');
    } catch (e) { return fail(e); }
  };

  function fail(e) {
    if (e.status) return err(e.status, e.message);
    console.error('unhandled', e);
    return err(500, 'internal error');
  }

  async function putProfile(event) {
    const a = await authenticate(event, { register: true }); if (a.res) return a.res;
    const body = parseBody(event, LIMITS.profileBody);
    const profile = cleanProfile(body.profile); if (!profile) return err(400, 'invalid profile');
    await store.putProfile(a.id, profile);
    return json(200, { ok: true });
  }

  async function postRun(event) {
    if (!bearer(event)) return err(401, 'missing or malformed credentials');
    const body = parseBody(event, LIMITS.runBody);
    const v = validateRunBody(body); if (v) return err(400, v);
    const content = contentFor(body.scenario);
    if (!content) return err(400, 'unknown scenario');
    if (body.fingerprint !== content.fingerprint) return err(409, 'client_outdated', { expected: content.fingerprint });
    const a = await authenticate(event, { register: true }); if (a.res) return a.res;
    const rl = await rateLimit(a.id); if (rl) return rl;

    const t0 = Date.now();
    const rp = replay(content, body.init, body.log);
    if (!rp.ok) return err(422, 'replay_failed', { at: rp.at, reason: rp.error });
    const run = rp.run;
    if (!['won', 'lost'].includes(run.phase)) return err(422, 'run_incomplete');
    const res = run.result;

    const boards = [`all:${body.scenario}:ML${body.init.assurance}`];
    if (body.init.mode === 'ttx') boards.push(`ttx:${body.init.ttxId}`);
    if (body.daily) {
      const today = sydneyDate(new Date(now())), yesterday = sydneyDate(new Date(now() - DAY * 1000));
      if (![today, yesterday].includes(body.daily)) return err(422, 'daily_expired');
      const cfg = dailyConfig(body.daily, scenarioIds, doctrineIds);
      if (body.init.seed !== cfg.seed || body.scenario !== cfg.scenario || body.init.doctrine !== cfg.doctrine || body.init.assurance !== cfg.assurance || body.init.mode !== 'run') return err(422, 'not_the_daily');
      boards.push(`daily:${body.daily}`);
    }
    const handle = sanitiseHandle(body.handle);
    const runKey = await store.putRun(a.id, { scenario: body.scenario, doctrine: body.init.doctrine, assurance: body.init.assurance, mode: body.init.mode, won: res.won, points: res.points, act: res.act, battles: res.battles, actions: body.log.length }, sec() + 180 * DAY);
    let improved = [];
    for (const b of boards) if (await store.upsertBoard(b, a.id, handle, res.points, runKey, sec() + (b.startsWith('daily') ? 90 : 3650) * DAY)) improved.push(b);
    if (handle !== a.player.handle) await store.setHandle(a.id, handle);
    return json(200, { verified: true, points: res.points, won: res.won, result: res, boards: improved, ms: Date.now() - t0 });
  }

  return { read, write };
}

export function validateRunBody(b) {
  if (!b || typeof b !== 'object') return 'body must be an object';
  const i = b.init;
  if (!i || typeof i !== 'object') return 'init required';
  if (typeof i.seed !== 'string' || i.seed.length < 1 || i.seed.length > 80) return 'bad seed';
  if (!doctrineIds.includes(i.doctrine)) return 'bad doctrine';
  if (!Number.isInteger(i.assurance) || i.assurance < 0 || i.assurance > 3) return 'bad assurance';
  if (!['run', 'ttx'].includes(i.mode)) return 'bad mode';
  if (i.mode === 'ttx' && !(typeof i.ttxId === 'string' && /^[a-z0-9-]{2,40}$/.test(i.ttxId))) return 'bad ttxId';
  if (typeof b.scenario !== 'string' || !/^[a-z0-9-]{2,32}$/.test(b.scenario)) return 'bad scenario';
  if (typeof b.fingerprint !== 'string' || b.fingerprint.length > 40) return 'bad fingerprint';
  if (!Array.isArray(b.log) || b.log.length < 1 || b.log.length > LIMITS.maxActions) return 'bad log';
  if (b.daily != null && !/^\d{4}-\d{2}-\d{2}$/.test(b.daily)) return 'bad daily';
  for (const a of b.log) if (!a || typeof a !== 'object' || typeof a.type !== 'string' || a.type.length > 24) return 'bad action';
  return null;
}

export function cleanProfile(p) {
  if (!p || typeof p !== 'object') return null;
  const num = (x, max) => (Number.isFinite(x) ? Math.max(0, Math.min(max, Math.floor(x))) : 0);
  const idMap = (o, re, max, cap) => { const out = {}; let n = 0; for (const [k, v] of Object.entries(o || {})) { if (n++ >= cap) break; if (re.test(k) && Number.isFinite(v)) out[k] = Math.min(max, v); } return out; };
  const ACH = /^ach\.[a-z0-9-]{1,48}$/, ID = /^[A-Za-z0-9._-]{1,40}$/;
  return {
    v: 1, xp: num(p.xp, 10_000_000),
    ach: { unlocked: idMap(p.ach?.unlocked, ACH, 4e15, 400), progress: idMap(p.ach?.progress, /^ach\.[a-z0-9:-]{1,56}$/, 1e9, 800) },
    stats: { runs: num(p.stats?.runs, 1e6), wins: num(p.stats?.wins, 1e6), battles: num(p.stats?.battles, 1e7), bestPoints: num(p.stats?.bestPoints, 1e9), playSeconds: num(p.stats?.playSeconds, 1e9) },
    codex: { adv: idMap(p.codex?.adv, ID, 1e6, 200), tech: idMap(p.codex?.tech, ID, 1e6, 1200), card: idMap(p.codex?.card, ID, 1e6, 200), relic: idMap(p.codex?.relic, ID, 1e6, 100), ref: {} },
    unlocks: { doctrines: (Array.isArray(p.unlocks?.doctrines) ? p.unlocks.doctrines : []).filter(d => typeof d === 'string' && doctrineIds.includes(d)), assurance: num(p.unlocks?.assurance, 3) || 1 },
    daily: { streak: num(p.daily?.streak, 10000), best: num(p.daily?.best, 1e9), last: /^\d{4}-\d{2}-\d{2}$/.test(p.daily?.last || '') ? p.daily.last : null, done: {} },
    settings: {}
  };
}
