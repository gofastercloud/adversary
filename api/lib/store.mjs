// Storage abstraction. DynamoStore is the production implementation (single-table design);
// MemoryStore backs unit tests and the zero-dependency local emulator.
import { createHash, timingSafeEqual } from 'node:crypto';

export const sha256 = (s) => createHash('sha256').update(s).digest('hex');
export function safeEqual(a, b) { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); }
export const boardKey = (board) => `BOARD#${board}`;
const pad = (n) => String(9_999_999_999 - Math.max(0, Math.min(9_999_999_998, Math.floor(n)))).padStart(10, '0');   // ascending sort = descending points

/** Table design (all items):  PK | SK
 *   PLAYER#<id>   | META          { secretHash, handle, createdAt }
 *   PLAYER#<id>   | PROFILE       { profile, updatedAt }
 *   PLAYER#<id>   | RUN#<ts>#<n>  { summary, ttl }
 *   BOARD#<board> | P#<id>        { points, handle, runId, GSI1PK=BOARD#<board>, GSI1SK=<inverted points>#<id>, ttl }
 *   RL#<id>       | W#<bucket>    { n, ttl }
 */
export class MemoryStore {
  constructor() { this.items = new Map(); }
  _k(pk, sk) { return pk + '\u0000' + sk; }
  async getPlayer(id) { return this.items.get(this._k(`PLAYER#${id}`, 'META')) || null; }
  async createPlayer(id, secretHash, handle) {
    const k = this._k(`PLAYER#${id}`, 'META'); if (this.items.has(k)) return false;
    this.items.set(k, { pk: `PLAYER#${id}`, sk: 'META', secretHash, handle, createdAt: Date.now() }); return true;
  }
  async setHandle(id, handle) { const p = await this.getPlayer(id); if (p) p.handle = handle; }
  async getProfile(id) { return this.items.get(this._k(`PLAYER#${id}`, 'PROFILE')) || null; }
  async putProfile(id, profile) { this.items.set(this._k(`PLAYER#${id}`, 'PROFILE'), { pk: `PLAYER#${id}`, sk: 'PROFILE', profile, updatedAt: Date.now() }); }
  async putRun(id, summary, ttl) { const sk = `RUN#${Date.now()}#${Math.floor(Math.random() * 1e6)}`; this.items.set(this._k(`PLAYER#${id}`, sk), { pk: `PLAYER#${id}`, sk, summary, ttl }); return sk; }
  async upsertBoard(board, id, handle, points, runId, ttl) {
    const k = this._k(boardKey(board), `P#${id}`); const cur = this.items.get(k);
    if (cur && cur.points >= points) return false;
    this.items.set(k, { pk: boardKey(board), sk: `P#${id}`, points, handle, runId, playerId: id, gsi1pk: boardKey(board), gsi1sk: `${pad(points)}#${id}`, ttl }); return true;
  }
  async topBoard(board, limit = 50) {
    return [...this.items.values()].filter(i => i.gsi1pk === boardKey(board)).sort((a, b) => a.gsi1sk.localeCompare(b.gsi1sk)).slice(0, limit).map(i => ({ playerId: i.playerId, handle: i.handle, points: i.points }));
  }
  async incr(key, bucket, ttl) { const k = this._k(`RL#${key}`, `W#${bucket}`); const cur = this.items.get(k) || { n: 0, ttl }; cur.n++; this.items.set(k, cur); return cur.n; }
}

export class DynamoStore {
  constructor({ table, client }) { this.table = table; this.c = client; this.cmd = null; }
  async _lib() { return (this.cmd ||= await import('@aws-sdk/lib-dynamodb')); }
  async getPlayer(id) { const { GetCommand } = await this._lib(); return (await this.c.send(new GetCommand({ TableName: this.table, Key: { pk: `PLAYER#${id}`, sk: 'META' } }))).Item || null; }
  async createPlayer(id, secretHash, handle) {
    const { PutCommand } = await this._lib();
    try { await this.c.send(new PutCommand({ TableName: this.table, Item: { pk: `PLAYER#${id}`, sk: 'META', secretHash, handle, createdAt: Date.now() }, ConditionExpression: 'attribute_not_exists(pk)' })); return true; }
    catch (e) { if (e.name === 'ConditionalCheckFailedException') return false; throw e; }
  }
  async setHandle(id, handle) { const { UpdateCommand } = await this._lib(); await this.c.send(new UpdateCommand({ TableName: this.table, Key: { pk: `PLAYER#${id}`, sk: 'META' }, UpdateExpression: 'SET handle = :h', ExpressionAttributeValues: { ':h': handle } })); }
  async getProfile(id) { const { GetCommand } = await this._lib(); return (await this.c.send(new GetCommand({ TableName: this.table, Key: { pk: `PLAYER#${id}`, sk: 'PROFILE' } }))).Item || null; }
  async putProfile(id, profile) { const { PutCommand } = await this._lib(); await this.c.send(new PutCommand({ TableName: this.table, Item: { pk: `PLAYER#${id}`, sk: 'PROFILE', profile, updatedAt: Date.now() } })); }
  async putRun(id, summary, ttl) { const { PutCommand } = await this._lib(); const sk = `RUN#${Date.now()}#${Math.floor(Math.random() * 1e6)}`; await this.c.send(new PutCommand({ TableName: this.table, Item: { pk: `PLAYER#${id}`, sk, summary, ttl } })); return sk; }
  async upsertBoard(board, id, handle, points, runId, ttl) {
    const { PutCommand } = await this._lib();
    try { await this.c.send(new PutCommand({ TableName: this.table, Item: { pk: boardKey(board), sk: `P#${id}`, points, handle, runId, playerId: id, gsi1pk: boardKey(board), gsi1sk: `${pad(points)}#${id}`, ttl }, ConditionExpression: 'attribute_not_exists(pk) OR points < :p', ExpressionAttributeValues: { ':p': points } })); return true; }
    catch (e) { if (e.name === 'ConditionalCheckFailedException') return false; throw e; }
  }
  async topBoard(board, limit = 50) {
    const { QueryCommand } = await this._lib();
    const r = await this.c.send(new QueryCommand({ TableName: this.table, IndexName: 'gsi1', KeyConditionExpression: 'gsi1pk = :b', ExpressionAttributeValues: { ':b': boardKey(board) }, Limit: limit, ScanIndexForward: true, ProjectionExpression: 'playerId, handle, points' }));
    return r.Items || [];
  }
  async incr(key, bucket, ttl) {
    const { UpdateCommand } = await this._lib();
    const r = await this.c.send(new UpdateCommand({ TableName: this.table, Key: { pk: `RL#${key}`, sk: `W#${bucket}` }, UpdateExpression: 'ADD n :one SET #t = :ttl', ExpressionAttributeNames: { '#t': 'ttl' }, ExpressionAttributeValues: { ':one': 1, ':ttl': ttl }, ReturnValues: 'UPDATED_NEW' }));
    return r.Attributes.n;
  }
}

export async function dynamoFromEnv() {
  const { DynamoDBClient } = await import('@aws-sdk/client-dynamodb');
  const { DynamoDBDocumentClient } = await import('@aws-sdk/lib-dynamodb');
  const raw = new DynamoDBClient({ ...(process.env.DYNAMODB_ENDPOINT ? { endpoint: process.env.DYNAMODB_ENDPOINT, region: process.env.AWS_REGION || 'ap-southeast-2', credentials: { accessKeyId: 'local', secretAccessKey: 'local' } } : {}) });
  return new DynamoStore({ table: process.env.TABLE_NAME, client: DynamoDBDocumentClient.from(raw, { marshallOptions: { removeUndefinedValues: true } }) });
}
