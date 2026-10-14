// Static builds (API_BASE=off) have no backend: the client must report offline and never call fetch.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const realFetch = globalThis.fetch;
const stubConfig = (cfg, calls) => {
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (String(url) === 'config.json') return { ok: true, json: async () => cfg };
    return { ok: true, status: 200, statusText: 'OK', json: async () => ({ date: '2026-10-14' }) };
  };
};

test('offline (apiBase null): online() is false and calls return offline without a request', async () => {
  const calls = [];
  stubConfig({ apiBase: null, version: 'abc' }, calls);
  try {
    const api = await import('../web/js/api.js');
    await api.initApi();
    assert.equal(api.online(), false);
    assert.deepEqual(await api.getDaily(), { ok: false, error: 'offline' });
    assert.deepEqual(await api.getBoard('daily:2026-10-14'), { ok: false, error: 'offline' });
    assert.deepEqual(calls, ['config.json'], 'only config.json may be fetched');
  } finally { globalThis.fetch = realFetch; }
});

test('online (apiBase /api): online() is true and calls go to the API', async () => {
  const calls = [];
  stubConfig({ apiBase: '/api', version: 'abc' }, calls);
  try {
    const api = await import('../web/js/api.js');
    await api.initApi();
    assert.equal(api.online(), true);
    const r = await api.getDaily();
    assert.equal(r.ok, true);
    assert.deepEqual(calls, ['config.json', '/api/daily']);
  } finally { globalThis.fetch = realFetch; }
});

test('fail closed: before initApi, and when config.json cannot be read, no /api request is made', async () => {
  const calls = [];
  globalThis.fetch = async (url) => { calls.push(String(url)); if (String(url) === 'config.json') return { ok: false, status: 404, json: async () => { throw new Error('not json'); } }; return { ok: true, status: 200, json: async () => ({}) }; };
  try {
    const api = await import('../web/js/api.js?fresh');
    assert.equal(api.online(), false, 'offline before config loads');
    assert.deepEqual(await api.getDaily(), { ok: false, error: 'offline' });
    await api.initApi();
    assert.equal(api.online(), false, 'offline when config.json is missing');
    assert.deepEqual(await api.getBoard('daily:2026-10-14'), { ok: false, error: 'offline' });
    assert.deepEqual(calls, ['config.json'], 'only config.json may be fetched');
  } finally { globalThis.fetch = realFetch; }
});
