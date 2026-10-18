// Security state is independent of business replay. No bearer tokens enter this store.
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { RealDate } = require("./clock");

const clone = value => JSON.parse(JSON.stringify(value));
const emptyState = () => ({ sessions: {}, families: {}, handoffs: {}, userVersions: {} });
const unavailable = () => Object.assign(new Error("Session service unavailable. Please retry."), { status: 503, code: "session_store_unavailable" });
const conflict = () => Object.assign(new Error("Session changed concurrently. Please retry."), { status: 409, code: "session_conflict" });
const random = size => crypto.randomFillSync(Buffer.alloc(size)); // unaffected by the business RNG
function deriveKey(secret, realm) {
  const bytes = Buffer.isBuffer(secret) ? secret : Buffer.from(String(secret || ""));
  if (bytes.length < 32) throw unavailable();
  return Buffer.from(crypto.hkdfSync("sha256", bytes, Buffer.from(realm), Buffer.from("orgtik-session-authority:v1"), 32));
}
function validDocument(doc, realm) {
  if (doc?.schema !== 1 || doc.realm !== realm || !Number.isSafeInteger(doc.revision) || doc.revision < 0 || !doc.state?.sessions || !doc.state?.families || !doc.state?.handoffs) throw unavailable();
  return doc;
}

function memoryStore({ realm = "test", secret = random(32) } = {}) {
  let document = { schema: 1, realm, revision: 0, state: emptyState() };
  return {
    kind: "memory", realm,
    async signingKey() { return deriveKey(secret, realm); },
    async read() { return clone(document); },
    async compareAndSwap(expectedRevision, state) {
      if (document.revision !== expectedRevision) throw conflict();
      document = { schema: 1, realm, revision: expectedRevision + 1, state: clone(state) };
      return clone(document);
    },
  };
}

function fileStore(file, { realm, secret } = {}) {
  const target = path.resolve(file), lock = `${target}.lock`;
  function readDocument() {
    try { return validDocument(JSON.parse(fs.readFileSync(target, "utf8")), realm); }
    catch (error) { if (error.code === "ENOENT") return null; throw unavailable(); }
  }
  async function locked(fn) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const deadline = RealDate.now() + 5000;
    let handle;
    while (!handle) {
      try { handle = fs.openSync(lock, "wx", 0o600); }
      catch (error) {
        if (error.code !== "EEXIST" || RealDate.now() >= deadline) throw unavailable();
        // Never steal an active writer's lock. A killed writer requires explicit repair.
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    try { return await fn(); }
    finally { fs.closeSync(handle); fs.unlinkSync(lock); }
  }
  function write(doc) {
    const temp = `${target}.${process.pid}.${random(8).toString("hex")}.tmp`;
    try { fs.writeFileSync(temp, JSON.stringify(doc), { mode: 0o600 }); fs.renameSync(temp, target); }
    catch { try { fs.unlinkSync(temp); } catch {} throw unavailable(); }
  }
  async function initialized() {
    const prior = readDocument();
    if (prior) return prior;
    return locked(() => {
      const existing = readDocument();
      if (existing) return existing;
      const doc = { schema: 1, realm, revision: 0, signingKey: random(32).toString("base64url"), state: emptyState() };
      write(doc); return doc;
    });
  }
  return {
    kind: "file", realm,
    async signingKey() {
      const doc = await initialized();
      return deriveKey(secret || Buffer.from(doc.signingKey || "", "base64url"), realm);
    },
    async read() { const { signingKey, ...safe } = await initialized(); return clone(safe); },
    async compareAndSwap(expectedRevision, state) {
      await initialized();
      return locked(() => {
        const doc = readDocument();
        if (doc.revision !== expectedRevision) throw conflict();
        const updated = { ...doc, revision: doc.revision + 1, state: clone(state) };
        write(updated);
        const { signingKey, ...safe } = updated;
        return clone(safe);
      });
    },
  };
}

const CAS = `local raw = redis.call('GET', KEYS[1])
local revision = 0
if raw then revision = cjson.decode(raw).revision end
if revision ~= tonumber(ARGV[1]) then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
return 1`;
function redisStore(url, credential, { realm, secret } = {}) {
  const key = `orgtik:identity:${realm}:security:v1`;
  async function command(args) {
    try {
      const response = await fetch(url.replace(/\/$/, ""), { method: "POST", headers: { authorization: `Bearer ${credential}`, "content-type": "application/json" }, body: JSON.stringify(args), signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw unavailable();
      const body = await response.json();
      if (body.error) throw unavailable();
      return body.result;
    } catch { throw unavailable(); }
  }
  return {
    kind: "redis", realm,
    async signingKey() { return deriveKey(secret || credential, realm); },
    async read() {
      const raw = await command(["GET", key]);
      try { return raw ? clone(validDocument(JSON.parse(raw), realm)) : { schema: 1, realm, revision: 0, state: emptyState() }; }
      catch { throw unavailable(); }
    },
    async compareAndSwap(expectedRevision, state) {
      const doc = { schema: 1, realm, revision: expectedRevision + 1, state: clone(state) };
      if (await command(["EVAL", CAS, "1", key, String(expectedRevision), JSON.stringify(doc)]) !== 1) throw conflict();
      return clone(doc);
    },
  };
}

function pickStore(config, options = {}) {
  const env = options.env || process.env, realm = options.realm || env.MOCK_SANDBOX || "demo";
  if (!/^[\w-]{1,100}$/.test(realm)) throw unavailable();
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL, credential = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  const secret = options.secret || env.MOCK_SESSION_SECRET || env.MOCK_AUTH_SECRET;
  if (url && credential) return redisStore(url, credential, { realm, secret });
  const localServices = env.ORGTIK_SERVICES_DEV === "1" && env.VERCEL_ENV === "development";
  if (!localServices && (config.hosted || env.VERCEL || url || credential)) return { kind: "unavailable", realm, async signingKey() { throw unavailable(); }, async read() { throw unavailable(); }, async compareAndSwap() { throw unavailable(); } };
  const file = options.file || (env.MOCK_AUTH_FILE ? `${env.MOCK_AUTH_FILE}.sessions` : path.join(config.dataDir, "journal", "security", `${realm}.json`));
  return fileStore(file, { realm, secret });
}

module.exports = { emptyState, memoryStore, fileStore, redisStore, pickStore, deriveKey };
