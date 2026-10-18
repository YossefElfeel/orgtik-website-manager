// Account storage is independent of the replay journal: resetting demo business data never
// clears credentials. Redis commits changed accounts atomically and consumes handoffs once.
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { RealDate } = require("./clock");

const emailKey = (email) => String(email).trim().toLowerCase();
const codeKey = (code) => crypto.createHash("sha256").update(code).digest("hex");

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `scrypt:${salt}:${crypto.scryptSync(String(password), salt, 64).toString("hex")}`;
}

function passwordMatches(user, password) {
  if (user.password !== undefined) return String(password) === user.password;
  const [algorithm, salt, digest] = String(user.passwordHash || "").split(":");
  if (algorithm !== "scrypt" || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(digest)) return false;
  return crypto.timingSafeEqual(Buffer.from(digest, "hex"), crypto.scryptSync(String(password), salt, 64));
}

function setPassword(user, password) {
  user.passwordHash = hashPassword(password);
  delete user.password;
}

// Convert legacy in-memory credentials once; raw passwords never enter account storage.
function snapshot(identity) {
  return new Map(identity.users.map((user) => {
    if (user.password !== undefined) setPassword(user, user.password);
    const { signupSeal, ...safe } = user;
    const grants = {};
    for (const [scope, members] of Object.entries(identity.grants)) {
      if (members[user.key]) grants[scope] = members[user.key];
    }
    return [String(user.id), JSON.stringify({ user: safe, grants, registration: user.signupInfo || null })];
  }));
}

function conflict() {
  return Object.assign(new Error("Account changed concurrently. Please try again."), { status: 409 });
}

function commit(data, changes) {
  const changedIds = new Set(changes.map(({ id }) => id));
  const emails = new Map(Object.entries(data.accounts).filter(([id]) => !changedIds.has(id)).map(([id, raw]) => [emailKey(JSON.parse(raw).user.email), id]));
  for (const { id, expected, value } of changes) {
    if ((data.accounts[id] ?? null) !== expected) throw conflict();
    const email = emailKey(JSON.parse(value).user.email);
    const owner = emails.get(email);
    if (owner && owner !== id) throw conflict();
    emails.set(email, id);
  }
  for (const { id, value } of changes) data.accounts[id] = value;
}

function localStore(file) {
  let memory = { accounts: {}, handoffs: {} };
  const read = () => {
    if (!file) return memory;
    try { return JSON.parse(fs.readFileSync(file, "utf8")); }
    catch (error) { if (error.code === "ENOENT") return { accounts: {}, handoffs: {} }; throw error; }
  };
  const write = (data) => {
    if (!file) { memory = data; return; }
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(data), { mode: 0o600 });
    fs.renameSync(temp, file);
  };
  return {
    kind: file ? "file" : "memory",
    async accounts() { return new Map(Object.entries(read().accounts)); },
    async commit(changes) { const data = read(); commit(data, changes); write(data); },
    async resetTestFixtures() {
      const data = read();
      for (const [id, raw] of Object.entries(data.accounts)) {
        if (/\.test$|@example\.com$/i.test(JSON.parse(raw).user.email)) delete data.accounts[id];
      }
      write(data);
    },
    async putHandoff(code, value) {
      const data = read(); data.handoffs[codeKey(code)] = value; write(data);
    },
    async takeHandoff(code) {
      const data = read(), key = codeKey(code), value = data.handoffs[key];
      delete data.handoffs[key]; write(data);
      return value && value.expiresAt > RealDate.now() ? value : null;
    },
    async claimLegacy(code, expiresAt) {
      const data = read(), key = `used:${codeKey(code)}`;
      if (data.handoffs[key]?.expiresAt > RealDate.now()) return false;
      data.handoffs[key] = { expiresAt }; write(data); return true;
    },
  };
}

// Validate the entire batch before writing; concurrent email registrations cannot both win.
const COMMIT = `
local changes = cjson.decode(ARGV[1])
local replacing = {}
for _, change in ipairs(changes) do
  local current = redis.call('HGET', KEYS[1], change.id)
  local expected = change.expected
  if expected == cjson.null then expected = false end
  if current ~= expected then return 0 end
  replacing[change.id] = cjson.decode(change.value)
end
local newOwners = {}
for _, change in ipairs(changes) do
  local record = replacing[change.id]
  local email = string.lower(record.user.email)
  if newOwners[email] and newOwners[email] ~= change.id then return 0 end
  newOwners[email] = change.id
  local owner = redis.call('HGET', KEYS[2], string.lower(record.user.email))
  if owner and owner ~= change.id then
    local replacement = replacing[owner]
    if not replacement or string.lower(replacement.user.email) == email then return 0 end
  end
end
for _, change in ipairs(changes) do
  local current = redis.call('HGET', KEYS[1], change.id)
  if current then
    local old = cjson.decode(current)
    if redis.call('HGET', KEYS[2], string.lower(old.user.email)) == change.id then
      redis.call('HDEL', KEYS[2], string.lower(old.user.email))
    end
  end
  local record = cjson.decode(change.value)
  redis.call('HSET', KEYS[1], change.id, change.value)
  redis.call('HSET', KEYS[2], string.lower(record.user.email), change.id)
end
return 1`;

function redisStore(url, token, prefix) {
  async function command(args) {
    try {
      const response = await fetch(url.replace(/\/$/, ""), {
        method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify(args), signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`account store answered ${response.status}`);
      const body = await response.json();
      if (body.error) throw new Error("account store command failed");
      return body.result;
    } catch { throw Object.assign(new Error("Account service unavailable. Please try again."), { status: 503 }); }
  }
  const accountsKey = `${prefix}:accounts`, emailsKey = `${prefix}:emails`;
  return {
    kind: "redis",
    async accounts() {
      const values = await command(["HGETALL", accountsKey]);
      // Redis REST returns alternating field/value entries; also accept its object format.
      return new Map(Array.isArray(values) ? Array.from({ length: values.length / 2 }, (_, i) => [values[i * 2], values[i * 2 + 1]]) : Object.entries(values || {}));
    },
    async commit(changes) {
      if (changes.length && await command(["EVAL", COMMIT, "2", accountsKey, emailsKey, JSON.stringify(changes)]) !== 1) throw conflict();
    },
    async resetTestFixtures() {
      await command(["EVAL", `local entries = redis.call('HGETALL', KEYS[1])
for i=1,#entries,2 do
  local email = string.lower(cjson.decode(entries[i+1]).user.email)
  if string.match(email, '%.test$') or string.match(email, '@example%.com$') then
    redis.call('HDEL', KEYS[1], entries[i])
    redis.call('HDEL', KEYS[2], email)
  end
end
return 1`, "2", accountsKey, emailsKey]);
    },
    async putHandoff(code, value) {
      const result = await command(["SET", `${prefix}:handoff:${codeKey(code)}`, JSON.stringify(value), "EX", "60", "NX"]);
      if (result !== "OK") throw conflict();
    },
    async takeHandoff(code) {
      const value = await command(["GETDEL", `${prefix}:handoff:${codeKey(code)}`]);
      return value ? JSON.parse(value) : null;
    },
    async claimLegacy(code, expiresAt) {
      return await command(["SET", `${prefix}:used:${codeKey(code)}`, "1", "EX", String(Math.max(1, Math.ceil((expiresAt - RealDate.now()) / 1000))), "NX"]) === "OK";
    },
  };
}

function pickStore(config) {
  const env = process.env;
  const sandbox = (env.MOCK_SANDBOX || "demo").replace(/[^\w-]/g, "");
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return redisStore(url, token, `orgtik:identity:${sandbox}`);
  if (env.MOCK_AUTH_STORE === "file") return localStore(env.MOCK_AUTH_FILE || path.join(config.dataDir, "identity", `${sandbox}.json`));
  if (env.VERCEL || url || token) return {
    kind: "unavailable",
    async accounts() { throw new Error("Persistent account storage is not configured."); },
  };
  return localStore();
}

module.exports = { pickStore, snapshot, setPassword, passwordMatches, localStore, redisStore };
