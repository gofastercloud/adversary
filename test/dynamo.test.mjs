// Exercises the real DynamoStore (AWS SDK v3, GSI, conditional writes, atomic counters) against Dynalite, a pure-Node
// DynamoDB emulator, so the DynamoDB code path is verified without Docker or an AWS account.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import dynalite from 'dynalite';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoStore } from '../api/lib/store.mjs';
import { createApi } from '../api/app.mjs';
import { ensureTable } from '../scripts/lib/local-table.mjs';
import { contentFor } from '../api/lib/content.mjs';
import { playRun } from '../scripts/lib/runbot.mjs';

const server = dynalite({ createTableMs: 0, deleteTableMs: 0, updateTableMs: 0 });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const endpoint = `http://127.0.0.1:${server.address().port}`;
after(() => server.close());
await ensureTable({ endpoint, table: 'adversary-test' });
const raw = new DynamoDBClient({ endpoint, region: 'ap-southeast-2', credentials: { accessKeyId: 'x', secretAccessKey: 'x' } });
const store = new DynamoStore({ table: 'adversary-test', client: DynamoDBDocumentClient.from(raw, { marshallOptions: { removeUndefinedValues: true } }) });

test('DynamoStore: player create is conditional, counters are atomic, boards rank through the GSI', async () => {
  assert.equal(await store.createPlayer('p1', 'hash', 'Alice'), true);
  assert.equal(await store.createPlayer('p1', 'other', 'Mallory'), false, 'second create loses the condition');
  assert.equal((await store.getPlayer('p1')).handle, 'Alice');
  assert.equal(await store.incr('rl-1', 7, 9999999999), 1);
  assert.equal(await store.incr('rl-1', 7, 9999999999), 2);
  await store.upsertBoard('all:enterprise:ML0', 'p1', 'Alice', 1200, 'r1', 9999999999);
  await store.upsertBoard('all:enterprise:ML0', 'p2', 'Bob', 3400, 'r2', 9999999999);
  await store.upsertBoard('all:enterprise:ML0', 'p1', 'Alice', 900, 'r3', 9999999999);   // lower score must not overwrite
  const top = await store.topBoard('all:enterprise:ML0');
  assert.deepEqual(top.map(t => [t.handle, t.points]), [['Bob', 3400], ['Alice', 1200]]);
});

test('the real API verifies and stores a played run on DynamoDB', async () => {
  const api = createApi(store);
  const init = { seed: 'ddb-1', doctrine: 'phoenix', assurance: 0, mode: 'run', ttxId: null };
  const content = contentFor('enterprise'), log = [];
  const { run } = playRun(content, init, { log });
  const ID = 'c'.repeat(24), SECRET = 'd'.repeat(32);
  const res = await api.write({ rawPath: '/runs', requestContext: { http: { method: 'POST' } }, headers: { authorization: `Bearer ${ID}.${SECRET}` }, body: JSON.stringify({ init, scenario: 'enterprise', log, fingerprint: content.fingerprint, handle: 'Dyna', playerId: ID }) });
  assert.equal(res.statusCode, 200, res.body);
  assert.equal(JSON.parse(res.body).points, run.result.points);
  const lb = JSON.parse((await api.read({ rawPath: '/leaderboard', requestContext: { http: { method: 'GET' } }, queryStringParameters: { board: 'all:enterprise:ML0' }, headers: {} })).body);
  assert.ok(lb.entries.some(e => e.handle === 'Dyna'));
});
