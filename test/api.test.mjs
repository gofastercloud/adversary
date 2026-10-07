import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApi, validateRunBody, cleanProfile } from '../api/app.mjs';
import { MemoryStore } from '../api/lib/store.mjs';
import { contentFor } from '../api/lib/content.mjs';
import { playRun } from '../scripts/lib/runbot.mjs';
import { sydneyDate, dailyConfig } from '../engine/rng.js';
import { scenarioIds, doctrineIds } from '../api/lib/content.mjs';

const ID = 'a'.repeat(24), SECRET = 'b'.repeat(32);
const ev = (method, path, { body, auth = true, query } = {}) => ({ rawPath: path, requestContext: { http: { method } }, queryStringParameters: query, headers: auth ? { authorization: `Bearer ${ID}.${SECRET}` } : {}, body: body ? JSON.stringify(body) : undefined });

function makeRun(init) {
  const content = contentFor('enterprise'); const log = [];
  const { run } = playRun(content, init, { log });
  return { content, log, run };
}

test('daily config is deterministic and served', async () => {
  const api = createApi(new MemoryStore(), { now: () => Date.parse('2026-10-07T03:00:00Z') });
  const r = await api.read(ev('GET', '/daily', { auth: false }));
  const d = JSON.parse(r.body);
  assert.equal(r.statusCode, 200);
  assert.equal(d.date, '2026-10-07');
  assert.deepEqual({ seed: d.seed, scenario: d.scenario, doctrine: d.doctrine }, (({ seed, scenario, doctrine }) => ({ seed, scenario, doctrine }))(dailyConfig('2026-10-07', scenarioIds, doctrineIds)));
});

test('a legitimately played run is verified, stored and ranked', async () => {
  const store = new MemoryStore(); const api = createApi(store);
  const init = { seed: 'api-1', doctrine: 'phoenix', assurance: 0, mode: 'run', ttxId: null };
  const { content, log, run } = makeRun(init);
  const r = await api.write(ev('POST', '/runs', { body: { init, scenario: 'enterprise', log, fingerprint: content.fingerprint, handle: 'Tester <b>', playerId: ID } }));
  assert.equal(r.statusCode, 200, r.body);
  const out = JSON.parse(r.body);
  assert.equal(out.verified, true); assert.equal(out.points, run.result.points);
  const lb = JSON.parse((await api.read(ev('GET', '/leaderboard', { auth: false, query: { board: 'all:enterprise:ML0' } }))).body);
  assert.equal(lb.entries.length, 1); assert.equal(lb.entries[0].handle, 'Tester b');   // handle sanitised
  assert.equal(lb.entries[0].points, run.result.points);
});

test('forged results are rejected: tampered log, wrong fingerprint, truncated run, bad creds', async () => {
  const store = new MemoryStore(); const api = createApi(store);
  const init = { seed: 'api-2', doctrine: 'architect', assurance: 0, mode: 'run', ttxId: null };
  const { content, log } = makeRun(init);
  const post = (b, auth) => api.write(ev('POST', '/runs', { body: b, auth }));
  const base = { init, scenario: 'enterprise', log, fingerprint: content.fingerprint };
  assert.equal((await post({ ...base, log: log.slice(0, Math.max(1, log.length - 2)) })).statusCode, 422);                       // incomplete
  const tampered = log.map(a => ({ ...a })); const i = tampered.findIndex(a => a.type === 'BUY' || a.type === 'TAKE_CARD'); if (i >= 0) tampered[i].id = 'c.recover.elevation'; tampered.push({ type: 'BATTLE', action: { type: 'PLAY', iid: 'zzz', target: {} } });
  assert.equal((await post({ ...base, log: tampered })).statusCode, 422);                               // replay fails
  assert.equal((await post({ ...base, fingerprint: 'deadbeef' })).statusCode, 409);                     // outdated/forged content
  assert.equal((await post({ ...base, init: { ...init, assurance: 9 } })).statusCode, 400);
  assert.equal((await post(base, false)).statusCode, 401);
  assert.equal((await post({ ...base, daily: '2026-10-07' })).statusCode, 422);                         // not the daily seed
  // a different secret for an existing player is refused
  assert.equal((await post(base)).statusCode, 200);
  const bad = await api.write({ ...ev('POST', '/runs', { body: base }), headers: { authorization: `Bearer ${ID}.${'c'.repeat(32)}` } });
  assert.equal(bad.statusCode, 403);
});

test('rate limiting kicks in', async () => {
  const api = createApi(new MemoryStore());
  const init = { seed: 'api-3', doctrine: 'architect', assurance: 0, mode: 'run', ttxId: null };
  const { content, log } = makeRun(init);
  const body = { init, scenario: 'enterprise', log, fingerprint: content.fingerprint };
  let last; for (let i = 0; i < 8; i++) last = await api.write(ev('POST', '/runs', { body }));
  assert.equal(last.statusCode, 429);
});

test('daily submissions must use the daily seed and appear on the daily board', async () => {
  const now = Date.parse('2026-10-07T03:00:00Z'); const store = new MemoryStore(); const api = createApi(store, { now: () => now });
  const cfg = dailyConfig(sydneyDate(new Date(now)), scenarioIds, doctrineIds);
  const init = { seed: cfg.seed, doctrine: cfg.doctrine, assurance: 1, mode: 'run', ttxId: null };
  const content = contentFor(cfg.scenario); const log = []; playRun(content, init, { log });
  const r = await api.write(ev('POST', '/runs', { body: { init, scenario: cfg.scenario, log, fingerprint: content.fingerprint, daily: cfg.date ?? sydneyDate(new Date(now)) } }));
  assert.equal(r.statusCode, 200, r.body);
  assert.ok(JSON.parse(r.body).boards.some(b => b.startsWith('daily:')));
});

test('profile round trip sanitises input', async () => {
  const api = createApi(new MemoryStore());
  const evil = { xp: 1e99, ach: { unlocked: { 'ach.ok': 1, '__proto__': 1, 'x y': 1 }, progress: {} }, codex: { adv: { G0092: 3, '<script>': 1 } }, unlocks: { doctrines: ['hunter', 'evil'], assurance: 99 }, settings: { x: 1 } };
  assert.equal((await api.write(ev('PUT', '/profile', { body: { profile: evil } }))).statusCode, 200);
  const p = JSON.parse((await api.read(ev('GET', '/profile'))).body).profile;
  assert.equal(p.xp, 10_000_000); assert.deepEqual(Object.keys(p.ach.unlocked), ['ach.ok']); assert.deepEqual(Object.keys(p.codex.adv), ['G0092']); assert.deepEqual(p.unlocks.doctrines, ['hunter']); assert.equal(p.unlocks.assurance, 3);
});

test('oversized and malformed bodies are rejected', async () => {
  const api = createApi(new MemoryStore());
  const r = await api.write({ ...ev('POST', '/runs'), body: 'x'.repeat(400_000) });
  assert.equal(r.statusCode, 413);
  const r2 = await api.write({ ...ev('POST', '/runs'), body: '{nope' });
  assert.equal(r2.statusCode, 400);
});
