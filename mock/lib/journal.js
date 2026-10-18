// The mock's write journal (D-053): the hosted mock keeps its data across cold starts and between
// Vercel instances by recording every successful change and replaying it after the seed.
//
// Store (first match wins):
//   KV_REST_API_URL + KV_REST_API_TOKEN, or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
//                         Upstash Redis over REST (the Vercel Marketplace integration sets these)
//   MOCK_JOURNAL=file     a JSON file in the data directory (local tests of a "cold start")
//   MOCK_JOURNAL=memory   in this process only (tests)
//   none of these         off: the mock behaves as before (data in memory, reset on restart)
// MOCK_SANDBOX names the data set (default "demo"). Each mock deployment uses one sandbox.
//
// Redis keys: orgtik:mock:<sandbox>:meta  {epoch, seedAt, clock}
//             orgtik:mock:<sandbox>:log   list of entries {epoch, app, method, url, headers, body, at, seed}
// An entry's position in the list (1-based) is its sequence number. A reset starts a new epoch and
// empties the list; entries from an older epoch are skipped.
//
// R1 draft: snapshot + commit use epoch/revision CAS across instances. A 409 requires discarding
// speculative state; a 503 must never return mutation success. Legacy push/setMeta/clear remain
// only for the old server adapter; use initialize/reset/commit for the new mutation path.
// Authenticate and validate current membership + operation-specific permission BEFORE receipt
// lookup. An idempotency receipt never grants access. context.actor is audit attribution alone:
// trusted internal replay must use a committed domain command or an original authorization
// decision/snapshot (for example entry.authorization), not today's roles after revocation.
// Trusted replay is a process-internal capability; no client x-mock-replay header is authority.
const fs = require("fs");
const path = require("path");
const crypto = require("node:crypto");
const { applyChanges: applyIdentityChanges } = require("./identity-effects");
const { performance } = require("node:perf_hooks");

const MAX_ENTRIES = Number(process.env.MOCK_JOURNAL_MAX || 5000);
const MAX_BODY = 512 * 1024; // Upstash's free tier refuses requests over 1 MB
const SNAPSHOT_PAGE_ENTRIES = 8;

// Changes that are never recorded: the mock's own controls, and anything carrying a password or
// creating a session (sign-up accounts already travel sealed inside their tokens).
const NOT_RECORDED = /^\/__|\/api\/(users|rbac)(\/|$|\?)|\/(auth|login|logout|register|sign-?up|sign-?in|password|refresh|handoff|token|otp|verify-email)(\/|$|\?)/i;
const CHANGES = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const KEEP_HEADERS = /^(authorization|cookie|content-type|accept|accept-language|origin|referer|user-agent|x-[a-z0-9-]+)$/i;
const DROP_HEADERS = /^x-(vercel|forwarded|real-ip|middleware|matched)/i;

const copy = value => JSON.parse(JSON.stringify(value));
const unavailable = (message = "Journal storage unavailable. Please try again.") => Object.assign(new Error(message), { status: 503, code: "journal_unavailable" });
const conflict = (code = "journal_conflict") => Object.assign(new Error(code === "operation_conflict" ? "This operation ID was already used for a different request." : "Workspace data changed concurrently. Refresh before trying again."), { status: 409, code });
const emptyData = () => ({ meta: null, log: [], operations: {} });

function expectedState(expected) {
  if (!expected || typeof expected.expectedEpoch !== "string" || !expected.expectedEpoch || !Number.isSafeInteger(expected.expectedRevision) || expected.expectedRevision < 0) throw new TypeError("Journal commit requires expectedEpoch and expectedRevision");
}

function operationMetadata(operation) {
  if (!operation) return null;
  const { id, workspaceId, actor, fingerprint, result } = operation;
  const identifier = value => (typeof value === "string" && value.length > 0 && value.length <= 200) || (typeof value === "number" && Number.isSafeInteger(value));
  if (typeof id !== "string" || !identifier(id) || typeof workspaceId !== "string" || !identifier(workspaceId) || !identifier(actor?.userId) || (actor.impersonatedBy !== undefined && !identifier(actor.impersonatedBy)) || typeof fingerprint !== "string" || !fingerprint || fingerprint.length > 256) throw new TypeError("Invalid committed operation metadata");
  const cleanActor = { userId: actor.userId, ...(actor.impersonatedBy !== undefined ? { impersonatedBy: actor.impersonatedBy } : {}) };
  const receipt = { fingerprint, ...(result !== undefined ? { result: copy(result) } : {}) };
  const secrets = /^(password|passwordHash|oldPassword|newPassword|currentPassword|confirmPassword|token|accessToken|refreshToken|secret|authorization|cookie)$/i;
  const inspect = value => {
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value)) {
      if (secrets.test(key)) throw new TypeError("Committed operation results must omit credentials");
      inspect(item);
    }
  };
  inspect(receipt.result);
  return {
    key: crypto.createHash("sha256").update(JSON.stringify([workspaceId, String(cleanActor.userId), id])).digest("hex"),
    context: { workspaceId, actor: cleanActor, operationId: id },
    receipt,
  };
}

function prepareCommit(entry, expected) {
  expectedState(expected);
  if (!entry || entry.epoch !== expected.expectedEpoch) throw new TypeError("Journal entry must use the expected epoch");
  const operation = operationMetadata(expected.operation);
  const persisted = copy(entry);
  if (operation) {
    persisted.context = operation.context;
    // New committed context replaces the old saved bearer token for trusted internal replay.
    persisted.headers = Object.fromEntries(Object.entries(persisted.headers || {}).filter(([key]) => !/^(authorization|cookie|x-mock-replay)$/i.test(key)));
  }
  const raw = JSON.stringify(persisted);
  if (Buffer.byteLength(raw) + Buffer.byteLength(JSON.stringify(operation?.receipt || {})) > MAX_BODY) throw unavailable("Journal entry is too large to persist. Nothing was committed.");
  return { raw, operation };
}

function assertCurrent(data, expected) {
  if (data.meta?.epoch !== expected.expectedEpoch || data.log.length !== expected.expectedRevision) throw conflict();
}

function commitData(data, entry, expected) {
  const { raw, operation } = prepareCommit(entry, expected);
  if (data.meta?.epoch !== expected.expectedEpoch) throw conflict();
  const prior = operation && data.operations[operation.key];
  if (prior) {
    if (prior.fingerprint !== operation.receipt.fingerprint) throw conflict("operation_conflict");
    return { sequence: prior.sequence, replayed: true, ...(prior.result !== undefined ? { result: copy(prior.result) } : {}) };
  }
  assertCurrent(data, expected);
  const accounts = expected.identity ? applyIdentityChanges(data.identityAccounts || {}, expected.identity.changes) : null;
  if (data.log.length >= MAX_ENTRIES) throw unavailable("Journal is full. Nothing was committed.");
  data.log.push(raw);
  if (accounts) data.identityAccounts = accounts;
  const sequence = data.log.length;
  if (operation) data.operations[operation.key] = { ...operation.receipt, sequence };
  return { sequence, replayed: false, ...(operation?.receipt.result !== undefined ? { result: copy(operation.receipt.result) } : {}) };
}

function lookupData(data, operation, { expectedEpoch } = {}) {
  if (typeof expectedEpoch !== "string" || !expectedEpoch) throw new TypeError("Operation lookup requires expectedEpoch");
  if (data.meta?.epoch !== expectedEpoch) throw conflict();
  const normalized = operationMetadata(operation);
  if (!normalized) throw new TypeError("Operation lookup requires operation metadata");
  const prior = data.operations[normalized.key];
  if (!prior) return null;
  if (prior.fingerprint !== normalized.receipt.fingerprint) throw conflict("operation_conflict");
  return { sequence: prior.sequence, replayed: true, ...(prior.result !== undefined ? { result: copy(prior.result) } : {}) };
}

function resetData(data, meta, expected) {
  expectedState(expected);
  assertCurrent(data, expected);
  if (!meta?.epoch || meta.epoch === expected.expectedEpoch) throw new TypeError("Journal reset requires a new epoch");
  data.meta = copy(meta); data.log = []; data.operations = {};
  return { meta: copy(data.meta), revision: 0, entries: [] };
}

function snapshotData(data, from = 0) {
  return { meta: data.meta ? copy(data.meta) : null, revision: data.log.length, entries: data.log.slice(from) };
}

function memoryStore() {
  const data = emptyData();
  return {
    kind: "memory",
    async getMeta() { return data.meta ? copy(data.meta) : null; },
    async setMeta(meta) { if (data.meta?.epoch !== meta.epoch) data.operations = {}; data.meta = copy(meta); },
    async initialize(meta) { if (!data.meta) { if (data.log.length) throw unavailable("Journal metadata is missing; existing history was preserved."); data.meta = copy(meta); } return copy(data.meta); },
    async read(from) { return data.log.slice(from); },
    async push(entry) { data.log.push(JSON.stringify(entry)); return data.log.length; },
    async clear() { data.log = []; data.operations = {}; },
    async snapshot(from) { return snapshotData(data, from); },
    async poll(from) { return snapshotData(data, from); },
    async commit(entry, expected) { return commitData(data, entry, expected); },
    async identityAccounts() { return data.identityAccounts ? new Map(Object.entries(data.identityAccounts)) : null; },
    async initializeIdentity(accounts) { if (!data.identityAccounts) data.identityAccounts = Object.fromEntries(accounts); return new Map(Object.entries(data.identityAccounts)); },
    async lookupOperation(operation, expected) { return lookupData(data, operation, expected); },
    async reset(meta, expected) { return resetData(data, meta, expected); },
  };
}

function fileStore(file, { io = fs, lockTimeoutMs = 5000 } = {}) {
  io.mkdirSync(path.dirname(file), { recursive: true });
  const lockFile = `${file}.lock`;
  const load = () => {
    let data;
    try { data = JSON.parse(io.readFileSync(file, "utf8")); }
    catch (error) { if (error.code === "ENOENT") return emptyData(); throw unavailable("Journal file could not be read. Existing history was preserved."); }
    if (!data || !Array.isArray(data.log) || !Object.hasOwn(data, "meta")) throw unavailable("Journal file is invalid. Existing history was preserved.");
    data.operations ||= {};
    if (typeof data.operations !== "object" || Array.isArray(data.operations)) throw unavailable("Journal operation receipts are invalid. Existing history was preserved.");
    return data;
  };
  const save = data => {
    const temp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
    try {
      io.writeFileSync(temp, JSON.stringify(data), { mode: 0o600 });
      io.renameSync(temp, file);
    } catch { throw unavailable(); }
    finally { try { io.rmSync(temp, { force: true }); } catch { /* A failed cleanup cannot acknowledge a write. */ } }
  };
  const mutate = async fn => {
    const deadline = performance.now() + lockTimeoutMs;
    let handle;
    for (;;) {
      try { handle = io.openSync(lockFile, "wx", 0o600); break; }
      catch (error) {
        if (error.code !== "EEXIST") throw unavailable();
        if (performance.now() >= deadline) throw unavailable("Journal file is locked by another instance. Nothing was committed.");
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    try {
      const data = load();
      const result = fn(data);
      save(data);
      return result;
    } finally {
      io.closeSync(handle);
      io.rmSync(lockFile, { force: true });
    }
  };
  return {
    kind: "file",
    async getMeta() { return load().meta; },
    async setMeta(meta) { return mutate(data => { if (data.meta?.epoch !== meta.epoch) data.operations = {}; data.meta = copy(meta); }); },
    async initialize(meta) { return mutate(data => { if (!data.meta) { if (data.log.length) throw unavailable("Journal metadata is missing; existing history was preserved."); data.meta = copy(meta); } return copy(data.meta); }); },
    async read(from) { return load().log.slice(from); },
    async push(entry) { return mutate(data => { data.log.push(JSON.stringify(entry)); return data.log.length; }); },
    async clear() { return mutate(data => { data.log = []; data.operations = {}; }); },
    async snapshot(from) { return snapshotData(load(), from); },
    async poll(from) { return snapshotData(load(), from); },
    async commit(entry, expected) { return mutate(data => commitData(data, entry, expected)); },
    async identityAccounts() { const accounts = load().identityAccounts; return accounts ? new Map(Object.entries(accounts)) : null; },
    async initializeIdentity(accounts) { return mutate(data => { data.identityAccounts ??= Object.fromEntries(accounts); return new Map(Object.entries(data.identityAccounts)); }); },
    async lookupOperation(operation, expected) { return lookupData(load(), operation, expected); },
    async reset(meta, expected) { return mutate(data => resetData(data, meta, expected)); },
  };
}

// Lua scripts keep the snapshot, CAS append/receipt and reset atomic across Redis instances.
const SNAPSHOT = `-- orgtik-journal-snapshot-v1
local meta = redis.call('GET', KEYS[1])
local revision = redis.call('LLEN', KEYS[2])
return {meta or '', revision, redis.call('LRANGE', KEYS[2], ARGV[1], math.min(tonumber(ARGV[2]), revision - 1))}`;
const SNAPSHOT_PAGE = `-- orgtik-journal-snapshot-page-v1
local meta = redis.call('GET', KEYS[1]) or ''
local revision = redis.call('LLEN', KEYS[2])
if meta ~= ARGV[1] or revision < tonumber(ARGV[2]) then return {0, {}} end
return {1, redis.call('LRANGE', KEYS[2], ARGV[3], math.min(tonumber(ARGV[4]), tonumber(ARGV[2]) - 1))}`;
const INITIALIZE = `-- orgtik-journal-initialize-v1
local meta = redis.call('GET', KEYS[1])
if meta then return meta end
if redis.call('LLEN', KEYS[2]) > 0 then return '' end
redis.call('SET', KEYS[1], ARGV[1])
return ARGV[1]`;
const LOOKUP = `-- orgtik-journal-lookup-v1
local meta = redis.call('GET', KEYS[1])
if not meta or cjson.decode(meta).epoch ~= ARGV[1] then return cjson.encode({status='conflict'}) end
local raw = redis.call('HGET', KEYS[2], ARGV[2])
if not raw then return cjson.encode({status='missing'}) end
local prior = cjson.decode(raw)
if prior.fingerprint ~= ARGV[3] then return cjson.encode({status='operation_conflict'}) end
return cjson.encode({status='duplicate', sequence=prior.sequence, result=prior.result})`;
const COMMIT = `-- orgtik-journal-commit-v1
local rawMeta = redis.call('GET', KEYS[1])
if not rawMeta or cjson.decode(rawMeta).epoch ~= ARGV[1] then return cjson.encode({status='conflict'}) end
if ARGV[5] ~= '' then
  local raw = redis.call('HGET', KEYS[3], ARGV[5])
  if raw then
    local prior = cjson.decode(raw)
    if prior.fingerprint ~= ARGV[6] then return cjson.encode({status='operation_conflict'}) end
    return cjson.encode({status='duplicate', sequence=prior.sequence, result=prior.result})
  end
end
local length = redis.call('LLEN', KEYS[2])
if length ~= tonumber(ARGV[2]) then return cjson.encode({status='conflict'}) end
if length >= tonumber(ARGV[4]) then return cjson.encode({status='full'}) end
local receipt = nil
if ARGV[5] ~= '' then receipt = cjson.decode(ARGV[7]) end
-- Identity and business effects are validated before either table is changed.
local changes = nil
local replacements = {}
if ARGV[8] and ARGV[8] ~= '' then
  changes = cjson.decode(ARGV[8])
  local owners = {}
  for _, change in ipairs(changes) do
    local expected = change.expected
    if expected == cjson.null then expected = false end
    if redis.call('HGET', KEYS[4], change.id) ~= expected then return cjson.encode({status='account_conflict'}) end
    replacements[change.id] = cjson.decode(change.value)
  end
  for _, change in ipairs(changes) do
    local email = string.lower(replacements[change.id].user.email)
    if owners[email] and owners[email] ~= change.id then return cjson.encode({status='account_conflict'}) end
    owners[email] = change.id
    local owner = redis.call('HGET', KEYS[5], email)
    if owner and owner ~= change.id then
      local replacement = replacements[owner]
      if not replacement or string.lower(replacement.user.email) == email then return cjson.encode({status='account_conflict'}) end
    end
  end
end
local sequence = redis.call('RPUSH', KEYS[2], ARGV[3])
if changes then
  for _, change in ipairs(changes) do
    local prior = redis.call('HGET', KEYS[4], change.id)
    if prior then
      local email = string.lower(cjson.decode(prior).user.email)
      if redis.call('HGET', KEYS[5], email) == change.id then redis.call('HDEL', KEYS[5], email) end
    end
  end
  for _, change in ipairs(changes) do
    redis.call('HSET', KEYS[4], change.id, change.value)
    redis.call('HSET', KEYS[5], string.lower(replacements[change.id].user.email), change.id)
  end
end
local result = nil
if receipt then
  receipt.sequence = sequence
  redis.call('HSET', KEYS[3], ARGV[5], cjson.encode(receipt))
  result = receipt.result
end
return cjson.encode({status='committed', sequence=sequence, result=result})`;
const RESET = `-- orgtik-journal-reset-v1
local raw = redis.call('GET', KEYS[1])
if not raw or cjson.decode(raw).epoch ~= ARGV[1] or redis.call('LLEN', KEYS[2]) ~= tonumber(ARGV[2]) then return 0 end
redis.call('DEL', KEYS[2], KEYS[3])
redis.call('SET', KEYS[1], ARGV[3])
return 1`;
const SET_META = `-- orgtik-journal-set-meta-v1
local prior = redis.call('GET', KEYS[1])
if prior and cjson.decode(prior).epoch ~= cjson.decode(ARGV[1]).epoch then redis.call('DEL', KEYS[2]) end
redis.call('SET', KEYS[1], ARGV[1])
return 1`;

function redisStore(url, token, prefix, { fetch: request = globalThis.fetch } = {}) {
  const metaKey = `${prefix}:meta`, logKey = `${prefix}:log`, operationsKey = `${prefix}:operations`;
  async function pipeline(commands) {
    let storageFailure = 'transport';
    try {
      const response = await request(`${url.replace(/\/$/, "")}/pipeline`, {
        method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(commands), signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) { storageFailure = `http_${response.status}`; throw unavailable(); }
      const out = await response.json();
      if (!Array.isArray(out) || out.length !== commands.length || out.some(row => !row || row.error || !Object.hasOwn(row, "result"))) {
        const errors = Array.isArray(out) ? out.map(row => typeof row?.error === 'string' ? row.error : '').join(' ') : '';
        storageFailure = /max.*(?:size|bytes)|too large/i.test(errors) ? 'size_limit' : /NOPERM|unauthorized|invalid.*token/i.test(errors) ? 'permissions' : /quota|limit.*exceed|budget/i.test(errors) ? 'quota' : errors ? 'redis_command' : 'response_format';
        throw unavailable();
      }
      return out.map(row => row.result);
    } catch { throw Object.assign(unavailable(), { storageFailure }); }
  }
  const evaluate = async (script, keys, args) => (await pipeline([["EVAL", script, String(keys.length), ...keys, ...args]]))[0];
  const snapshot = async (from = 0) => {
    if (!Number.isSafeInteger(from) || from < 0) throw new TypeError('Journal snapshot offset must be a non-negative integer');
    // Keep each response bounded. A journal can contain many compressed domain snapshots.
    // Pin the first revision, permit append-only growth, and retry if a reset changes its epoch.
    for (let attempt = 0; attempt < 3; attempt++) {
      const [meta, rawRevision, first] = await evaluate(SNAPSHOT, [metaKey, logKey], [String(from), String(from + SNAPSHOT_PAGE_ENTRIES - 1)]);
      const revision = Number(rawRevision), entries = first || [];
      if (!Number.isSafeInteger(revision) || revision < 0 || !Array.isArray(entries) || entries.length !== Math.min(SNAPSHOT_PAGE_ENTRIES, Math.max(0, revision - from))) throw unavailable('Journal snapshot is incomplete.');
      let consistent = true;
      for (let offset = from + entries.length; offset < revision; offset += SNAPSHOT_PAGE_ENTRIES) {
        const end = Math.min(offset + SNAPSHOT_PAGE_ENTRIES, revision);
        const [valid, page] = await evaluate(SNAPSHOT_PAGE, [metaKey, logKey], [meta || '', String(revision), String(offset), String(end - 1)]);
        if (Number(valid) !== 1) { consistent = false; break; }
        if (!Array.isArray(page) || page.length !== end - offset) throw unavailable('Journal snapshot is incomplete.');
        entries.push(...page);
      }
      if (consistent) return { meta: meta ? JSON.parse(meta) : null, revision, entries };
    }
    throw unavailable('Journal changed repeatedly while loading its snapshot. Please try again.');
  };
  return {
    kind: "redis",
    async getMeta() { const [meta] = await pipeline([["GET", metaKey]]); return meta ? JSON.parse(meta) : null; },
    async setMeta(meta) { await evaluate(SET_META, [metaKey, operationsKey], [JSON.stringify(meta)]); },
    async initialize(meta) { const raw = await evaluate(INITIALIZE, [metaKey, logKey], [JSON.stringify(meta)]); if (!raw) throw unavailable("Journal metadata is missing; existing history was preserved."); return JSON.parse(raw); },
    async read(from) { const [list] = await pipeline([["LRANGE", logKey, String(from), "-1"]]); return list || []; },
    async push(entry) { const [length] = await pipeline([["RPUSH", logKey, JSON.stringify(entry)]]); return Number(length); },
    async clear() { await pipeline([["DEL", logKey, operationsKey]]); },
    snapshot,
    poll: snapshot,
    async commit(entry, expected) {
      const { raw, operation } = prepareCommit(entry, expected);
      const keys = [metaKey, logKey, operationsKey];
      let identityChanges = "";
      if (expected.identity) {
        const { accountsKey, emailsKey, changes } = expected.identity;
        if (typeof accountsKey !== "string" || typeof emailsKey !== "string" || !Array.isArray(changes)) throw new TypeError("Invalid identity transaction");
        for (const change of changes) {
          const record = JSON.parse(change.value);
          if (String(record.user?.id) !== String(change.id) || record.user.password !== undefined) throw new TypeError("Unsafe identity delta");
        }
        keys.push(accountsKey, emailsKey); identityChanges = JSON.stringify(changes);
        if (Buffer.byteLength(identityChanges) + Buffer.byteLength(raw) > MAX_BODY) throw unavailable("Atomic change exceeds the persistence limit.");
      }
      let reply;
      try { reply = JSON.parse(await evaluate(COMMIT, keys, [expected.expectedEpoch, String(expected.expectedRevision), raw, String(MAX_ENTRIES), operation?.key || "", operation?.receipt.fingerprint || "", JSON.stringify(operation?.receipt || {}), identityChanges])); }
      catch { throw unavailable(); }
      if (reply.status === "account_conflict") throw Object.assign(new Error("Account changed concurrently."), { status: 409, code: "account_conflict" });
      if (reply.status === "conflict" || reply.status === "operation_conflict") throw conflict(reply.status === "operation_conflict" ? reply.status : undefined);
      if (reply.status === "full") throw unavailable("Journal is full. Nothing was committed.");
      if (!["committed", "duplicate"].includes(reply.status) || !Number.isSafeInteger(reply.sequence) || reply.sequence < 1) throw unavailable();
      return { sequence: reply.sequence, replayed: reply.status === "duplicate", ...(Object.hasOwn(reply, "result") ? { result: reply.result } : {}) };
    },
    async lookupOperation(operation, { expectedEpoch } = {}) {
      if (typeof expectedEpoch !== "string" || !expectedEpoch) throw new TypeError("Operation lookup requires expectedEpoch");
      const normalized = operationMetadata(operation);
      if (!normalized) throw new TypeError("Operation lookup requires operation metadata");
      let reply;
      try { reply = JSON.parse(await evaluate(LOOKUP, [metaKey, operationsKey], [expectedEpoch, normalized.key, normalized.receipt.fingerprint])); }
      catch { throw unavailable(); }
      if (reply.status === "missing") return null;
      if (reply.status === "conflict" || reply.status === "operation_conflict") throw conflict(reply.status === "operation_conflict" ? reply.status : undefined);
      if (reply.status !== "duplicate" || !Number.isSafeInteger(reply.sequence) || reply.sequence < 1) throw unavailable();
      return { sequence: reply.sequence, replayed: true, ...(Object.hasOwn(reply, "result") ? { result: reply.result } : {}) };
    },
    async reset(meta, expected) {
      expectedState(expected);
      if (!meta?.epoch || meta.epoch === expected.expectedEpoch) throw new TypeError("Journal reset requires a new epoch");
      const result = await evaluate(RESET, [metaKey, logKey, operationsKey], [expected.expectedEpoch, String(expected.expectedRevision), JSON.stringify(meta)]);
      if (result !== 1) throw conflict();
      return { meta: copy(meta), revision: 0, entries: [] };
    },
  };
}

function pickStore(config) {
  const env = process.env;
  const sandbox = (env.MOCK_SANDBOX || "demo").replace(/[^\w-]/g, "");
  const prefix = `orgtik:mock:${sandbox}`;
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return { sandbox, store: redisStore(url, token, prefix) };
  if (env.MOCK_JOURNAL === "file") return { sandbox, store: fileStore(path.join(config.dataDir, "journal", `${sandbox}.json`)) };
  if (env.MOCK_JOURNAL === "memory") return { sandbox, store: memoryStore() };
  return { sandbox, store: null };
}

const recordable = (method, url) => CHANGES.has(method) && !NOT_RECORDED.test(url);

function redactBody(body) {
  if (!body.length) return body;
  try {
    const data = JSON.parse(body.toString("utf8"));
    const clean = (value) => {
      if (Array.isArray(value)) return value.map(clean);
      if (!value || typeof value !== "object") return value;
      return Object.fromEntries(Object.entries(value).filter(([key]) => !/^(password|passwordHash|newPassword|oldPassword|currentPassword|confirmPassword)$/i.test(key)).map(([key, item]) => [key, clean(item)]));
    };
    return Buffer.from(JSON.stringify(clean(data)));
  } catch { return body; }
}

function recordHeaders(headers) {
  const out = {};
  for (const [k, v] of Object.entries(headers || {})) if (KEEP_HEADERS.test(k) && !DROP_HEADERS.test(k)) out[k] = v;
  return out;
}

// Serialises the work that changes the in-memory data, so the order applied here is the order
// recorded in the journal.
function makeLock() {
  let tail = Promise.resolve();
  return (fn) => {
    const run = tail.then(fn, fn);
    tail = run.catch(() => {});
    return run;
  };
}

module.exports = { pickStore, recordable, recordHeaders, redactBody, makeLock, MAX_ENTRIES, MAX_BODY, memoryStore, fileStore, redisStore };
