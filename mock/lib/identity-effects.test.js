const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { memoryStore, fileStore } = require("./journal");

const account = (id, email) => JSON.stringify({ user: { id, email, passwordHash: "fixture-hash" }, grants: {}, registration: null });
async function scenario(store) {
  const first = account(1, "one@fixture.test"), second = account(2, "two@fixture.test");
  await store.initialize({ epoch: "identity-test", seedAt: 1 });
  await store.initializeIdentity(new Map([["1", first]]));
  const entry = { epoch: "identity-test", kind: "workspace-v1", workspace: { members: [1, 2], reservations: ["seat-two"] } };
  const expected = { expectedEpoch: "identity-test", expectedRevision: 0, identity: { changes: [{ id: "2", expected: null, value: second }] } };
  await assert.rejects(store.commit(entry, { ...expected, expectedRevision: 99 }), { status: 409 });
  assert.equal((await store.identityAccounts()).has("2"), false);
  assert.equal((await store.snapshot()).revision, 0);
  await store.commit(entry, expected);
  assert.equal((await store.identityAccounts()).get("2"), second);
  const snapshot = await store.snapshot();
  assert.equal(snapshot.revision, 1); assert.equal(JSON.parse(snapshot.entries[0]).workspace.members[1], 2);
  assert.equal(snapshot.entries[0].includes("passwordHash"), false);
  await assert.rejects(store.commit({ ...entry, workspace: { members: [] } }, { expectedEpoch: "identity-test", expectedRevision: 1, identity: { changes: [{ id: "3", expected: null, value: account(3, "two@fixture.test") }] } }), { status: 409 });
  assert.equal((await store.snapshot()).revision, 1);
  assert.equal((await store.identityAccounts()).has("3"), false);
}
test("identity and seat effects commit atomically in memory", () => scenario(memoryStore()));
test("cold-start identity and business effects share one file commit", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orgtik-identity-effects-")), file = path.join(dir, "journal.json");
  try {
    await scenario(fileStore(file));
    const restored = fileStore(file);
    assert.equal((await restored.identityAccounts()).size, 2);
    assert.equal((await restored.snapshot()).revision, 1);
  } finally {
    const relative = path.relative(path.resolve(os.tmpdir()), path.resolve(dir));
    assert.ok(relative.startsWith('orgtik-identity-effects-') && !relative.includes(path.sep));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
