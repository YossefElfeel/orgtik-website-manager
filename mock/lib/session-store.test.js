const test = require("node:test"), assert = require("node:assert/strict");
const { redisStore, memoryStore, fileStore, pickStore } = require("./session-store");
const { createSessionAuthority } = require("./session-authority");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");

test("Redis session stores isolate realms and compare-and-swap security revision", async () => {
  const savedFetch = global.fetch, records = new Map(), calls = [];
  global.fetch = async (_, init) => {
    const args = JSON.parse(init.body); calls.push(args);
    let result;
    if (args[0] === "GET") result = records.get(args[1]) || null;
    else if (args[0] === "EVAL") {
      const current = records.has(args[3]) ? JSON.parse(records.get(args[3])).revision : 0;
      result = current === Number(args[4]) ? 1 : 0;
      if (result) records.set(args[3], args[5]);
    } else throw new Error("unexpected command");
    return { ok: true, json: async () => ({ result }) };
  };
  try {
    const credential = "test-only-credential-32-characters-long", a = redisStore("http://storage.invalid", credential, { realm: "a" }), b = redisStore("http://storage.invalid", credential, { realm: "b" });
    const initial = await a.read(), state = { ...initial.state, sessions: { one: { sid: "one" } } };
    await a.compareAndSwap(initial.revision, state);
    await assert.rejects(a.compareAndSwap(initial.revision, state), { status: 409 });
    assert.equal((await b.read()).revision, 0);
    assert.notDeepEqual(await a.signingKey(), await b.signingKey());
    assert(!JSON.stringify(calls).includes(credential));
    const doc = JSON.parse(records.get("orgtik:identity:a:security:v1"));
    assert.equal(doc.revision, 1); assert.equal("signingKey" in doc, false);
  } finally { global.fetch = savedFetch; }
});

test("Redis failure/corrupt state and partial hosted credentials fail as503", async () => {
  const savedFetch = global.fetch;
  try {
    const store = redisStore("http://storage.invalid", "test-only-credential-32-characters-long", { realm: "test" });
    global.fetch = async () => { throw new Error("socket closed"); };
    await assert.rejects(store.read(), { status: 503 });
    global.fetch = async () => ({ ok: true, json: async () => ({ result: "broken-json" }) });
    await assert.rejects(store.read(), { status: 503 });
    const missing = pickStore({ hosted: false, dataDir: os.tmpdir() }, { realm: "test", env: { KV_REST_API_URL: "http://storage.invalid" } });
    assert.equal(missing.kind, "unavailable"); await assert.rejects(missing.read(), { status: 503 });
  } finally { global.fetch = savedFetch; }
});

test("local persisted secret and security document cannot be read from another realm", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orgtik-session-store-")), file = path.join(dir, "sessions.json");
  try {
    const a = fileStore(file, { realm: "a" }); await a.signingKey();
    const b = fileStore(file, { realm: "b" }); await assert.rejects(b.read(), { status: 503 });
    const before = fs.readFileSync(file); await assert.rejects(b.signingKey(), { status: 503 }); assert.deepEqual(fs.readFileSync(file), before);
  } finally { if (fs.existsSync(file)) fs.unlinkSync(file); fs.rmdirSync(dir); }
});

test("a rejected registration/account commit can discard its staged security effects", async () => {
  const store = memoryStore({ realm: "test", secret: Buffer.alloc(32, 9) });
  const authority = createSessionAuthority({ realm: "test", store, loadUser: async () => ({ id: 1, isActive: true }), contextFor: () => ({ mode: "identity", workspaceId: null, audience: "identity" }) });
  const frame = await authority.prepareRequest({ headers: {} }, { allowAnonymous: true });
  const tokens = authority.runPrepared(frame, () => authority.issueTokens({ id: 1, isActive: true }));
  authority.discardPending(frame);
  await assert.rejects(authority.commitPending(frame), { status: 503 });
  assert.equal(Object.keys((await store.read()).state.sessions).length, 0);
  await assert.rejects(authority.prepareRequest({ headers: { authorization: `Bearer ${tokens.accessToken}` } }), { status: 401 });
});
