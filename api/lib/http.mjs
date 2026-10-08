// Minimal API Gateway HTTP API (payload v2) helpers.
export const json = (status, body, headers = {}) => ({
  statusCode: status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...headers },
  body: JSON.stringify(body)
});
export const err = (status, message, extra = {}) => json(status, { error: message, ...extra });
export function bearer(event) {
  const h = event.headers?.authorization || event.headers?.Authorization || '';
  const m = /^Bearer ([a-f0-9]{24})\.([a-f0-9]{16,96})$/.exec(h);
  return m ? { id: m[1], secret: m[2] } : null;
}
export function parseBody(event, maxBytes) {
  const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '');
  if (Buffer.byteLength(raw) > maxBytes) { const e = new Error('payload too large'); e.status = 413; throw e; }
  try { return JSON.parse(raw); } catch { const e = new Error('invalid JSON'); e.status = 400; throw e; }
}
export const sanitiseHandle = (h) => String(h || '').replace(/[^\w .\-]/g, '').trim().slice(0, 20) || 'Defender';
