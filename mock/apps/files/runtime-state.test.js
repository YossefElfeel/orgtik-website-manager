const { test } = require("node:test");
const assert = require("node:assert/strict");
const manifest = require("./assets/manifest.json");
const codec = require("./runtime-state");
const lib = require("./lib");

const person = { id: 41, key: 'owner' };
const identity = { users: [person], userScopes: () => [{ scope: 'file_manager', roles: ['super_admin'] }] };

test("empty Files store exposes no seeded files, folders, shares or people-owned pins", () => {
  const state = codec.empty();
  for (const key of codec.MAPS) assert.equal(state[key].size, 0);
  assert.deepEqual(codec.decode(codec.encode(state), manifest), state);
});

test("Files snapshot preserves nested pins, shares, sessions, failure limits, previews and metadata", () => {
  const state = codec.nileFixture(identity, manifest, '2026-10-07T09:00:00Z');
  const file = [...state.files.values()][0], folder = [...state.folders.keys()][0];
  file.versions = [{ id: 'v1', number: 1, size: manifest[file.storage.key].size, createdAt: file.createdAt, storage: { ...file.storage }, comment: 'approved sample', references: ['task:1'] }];
  state.pins.set(41, new Map([[folder, 'fixture']]));
  state.shares.set('share', { id: 'share', resourceType: 'file', resourceId: file.id, downloadCount: 2, version: 3, secretHash: 'hash' });
  state.sessions.set('hashed-token', { shareId: 'share', version: 3, expiresAt: 17 });
  state.failures.set('share|ip', { count: 8, first: 5 });
  state.previewPages.set(file.id, ['<svg/>']);
  state.activities.push({ id: 'activity', actorId: '41' });
  const encoded = codec.encode(state), restored = codec.decode(encoded, manifest);
  assert.deepEqual(codec.encode(restored), encoded);
  restored.pins.get(41).delete(folder); restored.files.get(file.id).versions[0].comment = 'changed';
  assert.equal(state.pins.get(41).size, 1); assert.equal(file.versions[0].comment, 'approved sample');
});

test("Files rejects foreign asset paths, dangling references and folder cycles", () => {
  const original = codec.nileFixture(identity, manifest, '2026-10-07T09:00:00Z');
  const bytes = codec.encode(original); bytes.files[0][1].storage = { kind: 'upload', path: 'outside-workspace' };
  assert.throws(() => codec.decode(bytes, manifest), error => error.code === 'invalid_tool_snapshot');
  const cyclic = codec.encode(original); cyclic.folders[0][1].parentId = cyclic.folders[1][0];
  assert.throws(() => codec.decode(cyclic, manifest), error => error.code === 'invalid_tool_snapshot');
});

test("Nile Files fixture contains its agreement and required ancestry only", () => {
  const state = codec.nileFixture(identity, manifest, '2026-10-07T09:00:00Z');
  assert.equal(state.files.size, 1); assert.equal(state.folders.size, 2); assert.equal(state.shares.size, 0);
  const file = [...state.files.values()][0];
  assert.equal(file.storage.key, 'pdf_msa_nilefoods'); assert.equal(file.ownerId, 41);
});

test("Files random-ID and capability issuance counters round-trip after records are removed", () => {
  lib.importCounters({ ids: 0, secrets: 0 }); lib.newId(); lib.newSecret();
  const before = lib.exportCounters(); lib.importCounters(before); lib.newId();
  assert.deepEqual(lib.exportCounters(), { ids: 2, secrets: 1 });
  assert.throws(() => lib.importCounters({ ids: -1, secrets: 1 }));
});
