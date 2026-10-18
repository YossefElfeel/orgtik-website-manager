const { test } = require('node:test');
const assert = require('node:assert/strict');
const codec = require('./runtime-state');

test('Chats snapshot codec fails closed on uncovered state, counters and historical authority', () => {
  const initialized = codec.initialize({ workspace: { id: 'fresh', name: 'Fresh' }, identity: { users: [] } });
  assert.throws(() => codec.decode({ ...initialized.data, users: [{ id: 1, roles: ['owner'] }] }, initialized.sequences), /uncovered/);
  assert.throws(() => codec.decode(initialized.data, { ...initialized.sequences, hiddenId: 3 }), /counters/);
  assert.throws(() => codec.decode({ ...initialized.data, historicalUsers: [{ id: 'old', name: 'Old', role: 'owner' }] }, initialized.sequences), /authority/);
  assert.throws(() => codec.decode({ ...initialized.data, readState: { '1': { foreign: 1 } } }, initialized.sequences), /cursor/);
  assert.equal(codec.id('__proto__'), false);
});

test('Chats board indexes and permanent receipts reject incomplete or copied drawing authority', () => {
  const state = codec.initialize({ workspace: { id: 'fresh', name: 'Fresh' }, identity: { users: [] } });
  const board = { id: 'b-one', name: 'Saved drawing', ownerId: '1', channelId: null, meetingId: null, reference: { workspaceId: 'fresh', fileId: 'file-one', versionId: 'v1' }, revision: 1, createdAt: '2026-10-07T09:00:00Z', updatedAt: '2026-10-07T09:00:00Z' };
  state.data.whiteboards.push(board);
  state.data.whiteboardOperations = { '1:create': { fingerprint: 'a'.repeat(64), boardId: 'b-one', versionId: 'v1' } };
  assert.equal(codec.decode(state.data, state.sequences).data.whiteboards[0].reference.versionId, 'v1');
  for (const patch of [{ scene: { elements: [] } }, { channelId: 'unjoined' }, { meetingId: 'unverified' }, { reference: null }, { revision: 0 }]) assert.throws(() => codec.decode({ ...state.data, whiteboards: [{ ...board, ...patch }] }, state.sequences), error => error.status === 503);
  assert.throws(() => codec.decode({ ...state.data, whiteboardOperations: { '1:create': { fingerprint: 'a'.repeat(64), boardId: 'foreign-board', versionId: 'v1' } } }, state.sequences), /receipt/);
});
