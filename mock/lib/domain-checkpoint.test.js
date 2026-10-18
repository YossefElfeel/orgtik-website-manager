const { test } = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const { encodeDomainCheckpoint, decodeDomainCheckpoint } = require('./domain-checkpoint');

test('lossless checkpoint compression preserves native data and historical gzip checkpoints', () => {
  const value = { platformState: { invoices: [{ id: 'historical', total: 120.75, currency: 'CHF', snapshot: { tax: 8.1 } }] }, workspaceState: { snapshots: { marketing: { contacts: [{ id: 'native-uuid', name: 'عميل' }], operations: [{ id: 'original', result: 7 }] } } } };
  const raw = Buffer.from(JSON.stringify(value));
  const historical = { version: 1, encoding: 'gzip-base64', bytes: raw.length, data: zlib.gzipSync(raw).toString('base64') };
  const encoded = encodeDomainCheckpoint(value);
  assert.deepEqual(decodeDomainCheckpoint(historical), value);
  assert.deepEqual(decodeDomainCheckpoint(encoded), value);
  assert.equal(encoded.version, historical.version); assert.equal(encoded.bytes, historical.bytes);
  assert.deepEqual((encoded.encoding === 'br-base64' ? zlib.brotliDecompressSync : zlib.gunzipSync)(Buffer.from(encoded.data, 'base64')), raw);
  assert.throws(() => decodeDomainCheckpoint({ ...encoded, bytes: encoded.bytes + 1 }), { status: 503 });
});
