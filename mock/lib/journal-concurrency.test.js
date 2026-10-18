const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { memoryStore, fileStore, redisStore, MAX_BODY, MAX_ENTRIES } = require("./journal");
const { makeWorkspaceOperation } = require("./workspace-command");

const meta = epoch => ({ epoch, seedAt: 123456, clock: { now: 123456 } });
const entry = (epoch = "epoch-a", email = "one@fixture.test") => ({ epoch, app: "admin", method: "POST", url: "/v1/app/team", body: Buffer.from(JSON.stringify({ email })).toString("base64"), at: 123456, seed: "fixture", headers: { authorization: "Bearer legacy-fixture-token", cookie: "legacy-fixture-cookie", "content-type": "application/json", "x-mock-replay": "1" } });
const operation = (id = "invite-one", changes = {}) => makeWorkspaceOperation({ id, workspaceId: "ws-a", actor: { userId: 1 }, method: "POST", path: "/v1/app/team", body: { email: "one@fixture.test" }, result: { status: 201, body: { invitationId: "invite-a" } }, ...changes });
const expected = (snapshot, op) => ({ expectedEpoch: snapshot.meta.epoch, expectedRevision: snapshot.revision, ...(op ? { operation: op } : {}) });

function temporaryJournal() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orgtik-journal-cas-"));
  return { file: path.join(dir, "journal.json"), cleanup() {
    const target = path.resolve(dir);
    assert.ok(target.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(target).startsWith("orgtik-journal-cas-"));
    fs.rmSync(target, { recursive: true, force: true });
  } };
}

// Fake shared Redis transport: evaluate one command atomically, then return via Redis REST.
// This verifies multi-instance CAS/idempotency protocol without credentials or hosted state.
function fakeRedis() {
  const values = new Map(), lists = new Map(), hashes = new Map();
  const calls = [];
  const fake = { calls, loseReply: false, failBefore: false, malformed: false };
  const list = key => lists.get(key) || [];
  const hash = key => hashes.get(key) || {};
  function command(args) {
    const [verb, ...params] = args;
    if (verb === "GET") return values.get(params[0]) || null;
    if (verb === "LRANGE") return list(params[0]).slice(Number(params[1]));
    if (verb === "RPUSH") { const rows = list(params[0]); rows.push(params[1]); lists.set(params[0], rows); return rows.length; }
    if (verb === "DEL") { for (const key of params) { values.delete(key); lists.delete(key); hashes.delete(key); } return 1; }
    assert.equal(verb, "EVAL");
    const [script, count, ...rest] = params;
    const keys = rest.slice(0, Number(count)), argv = rest.slice(Number(count));
    const [metaKey, logKey, operationsKey] = keys;
    if (script.includes("orgtik-journal-snapshot-v1")) return [values.get(metaKey) || "", list(logKey).length, list(logKey).slice(Number(argv[0]), Number(argv[1]) + 1)];
    if (script.includes("orgtik-journal-snapshot-page-v1")) {
      if ((values.get(metaKey) || '') !== argv[0] || list(logKey).length < Number(argv[1])) return [0, []];
      return [1, list(logKey).slice(Number(argv[2]), Math.min(Number(argv[3]) + 1, Number(argv[1])))];
    }
    if (script.includes("orgtik-journal-initialize-v1")) {
      if (values.has(metaKey)) return values.get(metaKey);
      if (list(logKey).length) return "";
      values.set(metaKey, argv[0]); return argv[0];
    }
    if (script.includes("orgtik-journal-set-meta-v1")) {
      if (values.has(metaKey) && JSON.parse(values.get(metaKey)).epoch !== JSON.parse(argv[0]).epoch) hashes.delete(logKey);
      values.set(metaKey, argv[0]); return 1;
    }
    if (script.includes("orgtik-journal-lookup-v1")) {
      if (!values.has(metaKey) || JSON.parse(values.get(metaKey)).epoch !== argv[0]) return JSON.stringify({ status: "conflict" });
      const prior = hash(logKey)[argv[1]];
      if (!prior) return JSON.stringify({ status: "missing" });
      return JSON.stringify(prior.fingerprint === argv[2] ? { status: "duplicate", sequence: prior.sequence, ...(Object.hasOwn(prior, "result") ? { result: prior.result } : {}) } : { status: "operation_conflict" });
    }
    if (script.includes("orgtik-journal-reset-v1")) {
      if (!values.has(metaKey) || JSON.parse(values.get(metaKey)).epoch !== argv[0] || list(logKey).length !== Number(argv[1])) return 0;
      lists.delete(logKey); hashes.delete(operationsKey); values.set(metaKey, argv[2]); return 1;
    }
    assert.ok(script.includes("orgtik-journal-commit-v1"));
    if (!values.has(metaKey) || JSON.parse(values.get(metaKey)).epoch !== argv[0]) return JSON.stringify({ status: "conflict" });
    const receipts = hash(operationsKey), prior = argv[4] && receipts[argv[4]];
    if (prior) return JSON.stringify(prior.fingerprint === argv[5] ? { status: "duplicate", sequence: prior.sequence, ...(Object.hasOwn(prior, "result") ? { result: prior.result } : {}) } : { status: "operation_conflict" });
    const rows = list(logKey);
    if (rows.length !== Number(argv[1])) return JSON.stringify({ status: "conflict" });
    if (rows.length >= Number(argv[3])) return JSON.stringify({ status: "full" });
    rows.push(argv[2]); lists.set(logKey, rows);
    const sequence = rows.length;
    const receipt = argv[4] ? { ...JSON.parse(argv[6]), sequence } : null;
    if (receipt) { receipts[argv[4]] = receipt; hashes.set(operationsKey, receipts); }
    return JSON.stringify({ status: "committed", sequence, ...(receipt && Object.hasOwn(receipt, "result") ? { result: receipt.result } : {}) });
  }
  fake.fetch = async (_url, options) => {
    const batch = JSON.parse(options.body); calls.push(batch);
    if (fake.failBefore) { fake.failBefore = false; throw new Error("fixture transport failure"); }
    const results = batch.map(args => ({ result: command(args) }));
    if (fake.loseReply) { fake.loseReply = false; throw new Error("fixture lost reply after commit"); }
    return { ok: true, async json() { return fake.malformed ? [{}] : JSON.parse(JSON.stringify(results)); } };
  };
  return fake;
}

for (const kind of ["memory", "file", "redis"]) test(`${kind}: two independent instances cannot both commit the final seat`, async () => {
  const temp = kind === "file" ? temporaryJournal() : null;
  const backend = kind === "redis" ? fakeRedis() : null;
  const first = kind === "memory" ? memoryStore() : kind === "file" ? fileStore(temp.file) : redisStore("https://fixture.invalid", "fixture-only", "fixture:shared", { fetch: backend.fetch });
  const second = kind === "memory" ? first : kind === "file" ? fileStore(temp.file) : redisStore("https://fixture.invalid", "fixture-only", "fixture:shared", { fetch: backend.fetch });
  try {
    assert.deepEqual(await Promise.all([first.initialize(meta("epoch-a")), second.initialize(meta("epoch-b"))]), [meta("epoch-a"), meta("epoch-a")]);
    const [a, b] = await Promise.all([first.snapshot(), second.snapshot()]);
    assert.equal(a.revision, 0); assert.equal(b.revision, 0);
    const results = await Promise.allSettled([
      first.commit(entry(), expected(a, operation("invite-one"))),
      second.commit(entry("epoch-a", "two@fixture.test"), expected(b, operation("invite-two", { body: { email: "two@fixture.test" } }))),
    ]);
    assert.equal(results.filter(row => row.status === "fulfilled").length, 1);
    const loser = results.find(row => row.status === "rejected").reason;
    assert.equal(loser.status, 409); assert.equal(loser.code, "journal_conflict");
    const stored = await second.snapshot();
    assert.equal(stored.revision, 1); assert.equal(stored.entries.length, 1);
    const replayed = stored.entries.map(JSON.parse);
    assert.equal(replayed.filter(row => row.method === "POST").length, 1, "A cold read reconstructs one reserved seat");
    assert.equal(replayed[0].context.workspaceId, "ws-a");
    assert.deepEqual(replayed[0].context.actor, { userId: 1 });
    assert.equal(replayed[0].headers.authorization, undefined);
    assert.equal(replayed[0].headers.cookie, undefined);
    assert.equal(replayed[0].headers["x-mock-replay"], undefined);
    if (backend) assert.ok(backend.calls.filter(batch => batch[0][0] === "EVAL").length >= 5, "Snapshots and commits are atomic EVALs");
  } finally { temp?.cleanup(); }
});

for (const kind of ["memory", "file", "redis"]) test(`${kind}: retries return the original result and reject altered requests`, async () => {
  const temp = kind === "file" ? temporaryJournal() : null;
  const backend = kind === "redis" ? fakeRedis() : null;
  const store = kind === "memory" ? memoryStore() : kind === "file" ? fileStore(temp.file) : redisStore("https://fixture.invalid", "fixture-only", "fixture:retry", { fetch: backend.fetch });
  try {
    await store.initialize(meta("epoch-a"));
    const start = await store.snapshot();
    assert.equal(await store.lookupOperation(operation(), { expectedEpoch: start.meta.epoch }), null);
    const committed = await store.commit(entry(), expected(start, operation()));
    const found = await store.lookupOperation(operation(), { expectedEpoch: start.meta.epoch });
    assert.deepEqual(found, { ...committed, replayed: true }, "A retry can return its result before final-seat validation runs again");
    const repeated = await store.commit(entry(), expected(start, operation("invite-one", { result: { ignored: "new speculative result" } })));
    assert.equal(committed.sequence, 1); assert.equal(committed.replayed, false);
    assert.equal(repeated.sequence, 1); assert.equal(repeated.replayed, true);
    assert.deepEqual(repeated.result, committed.result);
    assert.equal((await store.snapshot()).revision, 1);
    await assert.rejects(store.commit(entry(), expected(start, operation("invite-one", { body: { email: "altered@fixture.test" } }))), { status: 409, code: "operation_conflict" });
    await assert.rejects(store.lookupOperation(operation("invite-one", { body: { email: "altered@fixture.test" } }), { expectedEpoch: start.meta.epoch }), { status: 409, code: "operation_conflict" });
    const current = await store.snapshot();
    await store.commit(entry(), expected(current, operation("invite-one", { workspaceId: "ws-b" })));
    await store.commit(entry(), expected(await store.snapshot(), operation("invite-one", { actor: { userId: 2 } })));
    assert.equal((await store.snapshot()).revision, 3, "Operation IDs are scoped to workspace and actor");
    const old = await store.snapshot();
    await assert.rejects(store.reset(meta("epoch-b"), expected(start)), { status: 409 });
    const reset = await store.reset(meta("epoch-b"), expected(old));
    assert.equal(reset.revision, 0);
    await assert.rejects(store.commit(entry(), expected(old, operation())), { status: 409 });
    await assert.rejects(store.lookupOperation(operation(), { expectedEpoch: old.meta.epoch }), { status: 409 });
    await store.commit(entry("epoch-b"), expected(reset, operation()));
    assert.equal((await store.snapshot()).revision, 1, "A new epoch does not inherit old receipts");
  } finally { temp?.cleanup(); }
});

test("operation fingerprints bind workspace, effective actor, method, path and body", () => {
  const initial = operation();
  assert.equal(initial.fingerprint, operation("another-id").fingerprint, "The operation ID indexes the fingerprint rather than changing request identity");
  assert.equal(operation("one", { body: { first: 1, second: 2 } }).fingerprint, operation("one", { body: { second: 2, first: 1 } }).fingerprint);
  for (const changed of [{ workspaceId: "ws-b" }, { actor: { userId: 2 } }, { actor: { userId: 1, impersonatedBy: 2 } }, { method: "PATCH" }, { path: "/v1/app/other" }, { body: { email: "other@fixture.test" } }]) assert.notEqual(initial.fingerprint, operation("invite-one", changed).fingerprint);
});

test("oversize and credential-bearing receipts fail without creating persisted success", async () => {
  const store = memoryStore();
  await store.initialize(meta("epoch-a"));
  const snapshot = await store.snapshot();
  await assert.rejects(store.commit({ ...entry(), body: "x".repeat(MAX_BODY) }, expected(snapshot, operation())), { status: 503 });
  for (const key of ["password", "passwordHash", "accessToken", "refreshToken", "token", "authorization"]) await assert.rejects(store.commit(entry(), expected(snapshot, operation("one", { result: { nested: { [key]: "must-not-persist" } } }))), /must omit credentials/);
  assert.equal((await store.snapshot()).revision, 0);
});

test("memory snapshots cannot alter the stored revision or metadata", async () => {
  const store = memoryStore();
  await store.initialize(meta("epoch-a"));
  const view = await store.snapshot(); view.meta.epoch = "tampered"; view.entries.push("fake");
  assert.equal((await store.snapshot()).meta.epoch, "epoch-a");
  assert.equal((await store.snapshot()).revision, 0);
});

test("legacy journal bytes remain readable while newer commits add optional context", async () => {
  const temp = temporaryJournal();
  try {
    fs.writeFileSync(temp.file, JSON.stringify({ meta: meta("epoch-a"), log: [JSON.stringify(entry())] }));
    const store = fileStore(temp.file);
    assert.equal((await store.snapshot()).revision, 1);
    assert.equal(JSON.parse((await store.read(0))[0]).headers.authorization, "Bearer legacy-fixture-token");
    await store.commit(entry(), expected(await store.snapshot(), operation()));
    assert.equal((await store.snapshot()).revision, 2);
  } finally { temp.cleanup(); }
});

test("corrupt files fail closed and atomic replacement failures preserve prior history", async () => {
  const temp = temporaryJournal();
  try {
    fs.writeFileSync(temp.file, "corrupt fixture bytes");
    await assert.rejects(fileStore(temp.file).initialize(meta("epoch-a")), { status: 503 });
    assert.equal(fs.readFileSync(temp.file, "utf8"), "corrupt fixture bytes");
    fs.rmSync(temp.file);
    const good = fileStore(temp.file); await good.initialize(meta("epoch-a"));
    const snapshot = await good.snapshot(), before = fs.readFileSync(temp.file);
    const broken = fileStore(temp.file, { io: { ...fs, renameSync() { throw new Error("fixture disk unavailable"); } } });
    await assert.rejects(broken.commit(entry(), expected(snapshot, operation())), { status: 503 });
    assert.ok(fs.readFileSync(temp.file).equals(before));
    assert.equal((await good.snapshot()).revision, 0);
    const retry = await good.commit(entry(), expected(snapshot, operation()));
    assert.equal(retry.replayed, false); assert.equal(retry.sequence, 1);
    assert.deepEqual(fs.readdirSync(path.dirname(temp.file)), ["journal.json"], "Failure removes its temporary file and exclusive lock");
  } finally { temp.cleanup(); }
});

test("a held file lock times out without takeover, even with the fixture clock frozen", async () => {
  const temp = temporaryJournal(), NativeDate = globalThis.Date;
  try {
    const store = fileStore(temp.file, { lockTimeoutMs: 25 });
    await store.initialize(meta("epoch-a"));
    const snapshot = await store.snapshot();
    fs.writeFileSync(`${temp.file}.lock`, "another fixture process");
    globalThis.Date = class extends NativeDate { static now() { return 123456; } };
    await assert.rejects(store.commit(entry(), expected(snapshot, operation())), { status: 503 });
    assert.equal(fs.readFileSync(`${temp.file}.lock`, "utf8"), "another fixture process");
    assert.equal((await store.snapshot()).revision, 0);
  } finally { globalThis.Date = NativeDate; temp.cleanup(); }
});

test("Redis lost-response retries recover one durable receipt, while pre-commit failures persist nothing", async () => {
  const backend = fakeRedis();
  const a = redisStore("https://fixture.invalid", "fixture-only", "fixture:outage", { fetch: backend.fetch });
  const b = redisStore("https://fixture.invalid", "fixture-only", "fixture:outage", { fetch: backend.fetch });
  await a.initialize(meta("epoch-a")); const initial = await a.snapshot();
  backend.failBefore = true;
  await assert.rejects(a.commit(entry(), expected(initial, operation())), { status: 503 });
  assert.equal((await b.snapshot()).revision, 0);
  backend.loseReply = true;
  await assert.rejects(a.commit(entry(), expected(initial, operation())), { status: 503 });
  assert.equal((await b.snapshot()).revision, 1);
  const retry = await b.commit(entry(), expected(initial, operation()));
  assert.equal(retry.replayed, true); assert.equal(retry.sequence, 1);
  assert.deepEqual(retry.result, operation().result);
  backend.malformed = true;
  await assert.rejects(a.commit(entry(), expected(initial, operation())), { status: 503 });
});

test('Redis cold-start snapshots larger than a transport response limit remain complete and bounded', async () => {
  const backend = fakeRedis(), rows = Array.from({ length: 55 }, (_, index) => JSON.stringify({ index, checkpoint: 'x'.repeat(240000) }));
  const rawFetch = backend.fetch;
  let largest = 0;
  backend.fetch = async (...args) => {
    const response = await rawFetch(...args), result = await response.json();
    const bytes = Buffer.byteLength(JSON.stringify(result)); largest = Math.max(largest, bytes);
    if (bytes > 10 * 1024 * 1024) return { ok: false, status: 413 };
    return { ok: true, json: async () => result };
  };
  const store = redisStore('https://fixture.invalid', 'fixture-only', 'fixture:paged', { fetch: backend.fetch });
  await store.initialize(meta('epoch-a'));
  for (const row of rows) await store.push(JSON.parse(row));
  const snapshot = await store.snapshot();
  assert.equal(snapshot.revision, 55);
  assert.deepEqual(snapshot.entries.map(JSON.parse), rows.map(JSON.parse));
  assert.ok(largest < 4 * 1024 * 1024, 'Every response stays below the provider limit');
  assert.deepEqual((await store.poll(50)).entries.map(JSON.parse), rows.slice(50).map(JSON.parse));
  assert.deepEqual((await store.snapshot(55)).entries, []);
});

test('Redis paged snapshots pin append-only revisions and restart cleanly after an epoch reset', async () => {
  const backend = fakeRedis(), rawFetch = backend.fetch;
  const store = redisStore('https://fixture.invalid', 'fixture-only', 'fixture:paged-race', { fetch: (...args) => backend.fetch(...args) });
  await store.initialize(meta('epoch-a'));
  for (let index = 0; index < 20; index++) await store.push({ epoch: 'epoch-a', index });
  let append = true;
  backend.fetch = async (...args) => {
    const response = await rawFetch(...args), command = JSON.parse(args[1].body)[0];
    if (append && command[1]?.includes('orgtik-journal-snapshot-v1')) {
      append = false; await store.push({ epoch: 'epoch-a', index: 20 });
    }
    return response;
  };
  const pinned = await store.snapshot();
  assert.equal(pinned.revision, 20);
  assert.deepEqual(pinned.entries.map(row => JSON.parse(row).index), Array.from({ length: 20 }, (_, index) => index));
  let reset = true;
  backend.fetch = async (...args) => {
    const response = await rawFetch(...args), command = JSON.parse(args[1].body)[0];
    if (reset && command[1]?.includes('orgtik-journal-snapshot-v1')) {
      reset = false;
      await store.reset(meta('epoch-b'), { expectedEpoch: 'epoch-a', expectedRevision: 21 });
      for (let index = 0; index < 12; index++) await store.push({ epoch: 'epoch-b', index });
    }
    return response;
  };
  const fresh = await store.snapshot();
  assert.equal(fresh.meta.epoch, 'epoch-b'); assert.equal(fresh.revision, 12);
  assert.ok(fresh.entries.every(row => JSON.parse(row).epoch === 'epoch-b'));
});

test('Redis paged snapshots reject incomplete pages and repeated resets without disclosing provider replies', async () => {
  const backend = fakeRedis(), rawFetch = backend.fetch;
  const store = redisStore('https://fixture.invalid', 'fixture-only', 'fixture:paged-failure', { fetch: (...args) => backend.fetch(...args) });
  await store.initialize(meta('epoch-a'));
  for (let index = 0; index < 12; index++) await store.push({ index });
  backend.fetch = async (...args) => {
    const response = await rawFetch(...args), command = JSON.parse(args[1].body)[0];
    return command[1]?.includes('orgtik-journal-snapshot-page-v1') ? { ok: true, json: async () => [{ result: [1, []] }] } : response;
  };
  await assert.rejects(store.snapshot(), { status: 503 });
  backend.fetch = async (...args) => {
    const response = await rawFetch(...args), command = JSON.parse(args[1].body)[0];
    return command[1]?.includes('orgtik-journal-snapshot-page-v1') ? { ok: true, json: async () => [{ result: [0, []] }] } : response;
  };
  await assert.rejects(store.snapshot(), { status: 503 });
  backend.fetch = async () => ({ ok: true, json: async () => [{ error: 'NOPERM private fixture credential' }] });
  await assert.rejects(store.snapshot(), error => error.status === 503 && error.storageFailure === 'permissions' && !JSON.stringify(error).includes('private fixture credential') && !error.message.includes('private fixture credential'));
  backend.fetch = async () => ({ ok: false, status: 413 });
  await assert.rejects(store.snapshot(), { status: 503, storageFailure: 'http_413' });
  await assert.rejects(store.snapshot(-1), /non-negative integer/);
});

test("a full journal rejects new commits and missing metadata never erases history", async () => {
  const temp = temporaryJournal();
  try {
    const history = Array.from({ length: MAX_ENTRIES }, () => JSON.stringify(entry()));
    fs.writeFileSync(temp.file, JSON.stringify({ meta: meta("epoch-a"), log: history }));
    const store = fileStore(temp.file), snapshot = await store.snapshot();
    await assert.rejects(store.commit(entry(), expected(snapshot, operation())), { status: 503 });
    assert.equal((await store.snapshot()).revision, MAX_ENTRIES);
    fs.writeFileSync(temp.file, JSON.stringify({ meta: null, log: history }));
    await assert.rejects(store.initialize(meta("epoch-b")), { status: 503 });
    assert.equal((await store.read(0)).length, MAX_ENTRIES);
  } finally { temp.cleanup(); }
});
