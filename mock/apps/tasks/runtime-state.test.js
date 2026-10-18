const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildSeed } = require("./seed");
const codec = require("./runtime-state");

test("empty Tasks store has no demo entities and round-trips all counters after deletion", () => {
  const db = buildSeed({ empty: true });
  for (const table of codec.TABLES) assert.deepEqual(db[table], []);
  const discarded = db.nextId('project');
  const encoded = codec.encode(db), restored = codec.decode(encoded.data, encoded.sequences);
  assert.equal(restored.nextId('project'), discarded + 1);
  assert.deepEqual(codec.encode(db), encoded, "Restored mutations do not alias the source store.");
});

test("Tasks codec preserves assignments, ordering, notifications and conversations without sharing arrays", () => {
  const db = buildSeed({ empty: true });
  db.tasks.push({ id: db.nextId('task'), assignments: [{ id: db.nextId('assignment'), assigneeId: 41 }], dependsOn: [] });
  db.notifications.push({ id: db.nextId('notification'), userId: 41, readAt: 'fixture' });
  db.conversations.push({ id: db.nextId('conversation'), lastReadAt: { 41: 'fixture' } });
  db.myOrder[41] = [db.tasks[0].id];
  const encoded = codec.encode(db), restored = codec.decode(encoded.data, encoded.sequences);
  assert.deepEqual(codec.encode(restored), encoded);
  restored.tasks[0].assignments[0].assigneeId = 42;
  assert.equal(db.tasks[0].assignments[0].assigneeId, 41);
});

test("Tasks snapshots reject counters that would reuse committed IDs or uncovered fields", () => {
  const db = buildSeed({ empty: true });
  db.projects.push({ id: db.nextId('project') });
  const encoded = codec.encode(db);
  assert.throws(() => codec.decode(encoded.data, { project: 1 }), error => error.code === 'invalid_tool_snapshot');
  db.uncovered = [];
  assert.throws(() => codec.encode(db), error => error.code === 'invalid_tool_snapshot');
});

test("Nile Tasks projection keeps project one and admitted people only", () => {
  const files = { teamFile: id => `team-${id}`, attachment: key => ({ file: key, originalName: key, mimetype: 'fixture', size: 1 }) };
  const owner = { id: 41, key: 'owner', firstName: 'Nile', lastName: 'Owner' };
  const identity = { users: [owner], findUser: id => id === 41 ? owner : null, userScopes: () => [{ scope: 'task_manager', roles: ['super_admin'] }] };
  const db = codec.nileFixture(buildSeed({ files, identity, seedAt: '2026-10-07T09:00:00Z' }), identity);
  assert.equal(db.projects.length, 1); assert.equal(db.projects[0].id, 1);
  assert.ok(db.tasks.length > 0);
  assert.ok(db.tasks.every(task => task.projectId === 1 && task.assignments.every(assignment => assignment.assigneeId === 41)));
  assert.equal(db.teams.length + db.bookmarks.length + db.conversations.length + db.messages.length, 0);
  assert.deepEqual(codec.encode(codec.decode(codec.encode(db).data, db.seq)), codec.encode(db));
});
