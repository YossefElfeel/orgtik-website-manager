// Historical platform reducers run privately. This module is never an HTTP auth mechanism.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Module = require("node:module");
const http = require("node:http");
const net = require("node:net");
const { AsyncLocalStorage } = require("node:async_hooks");
const express = require("express");
const clock = require("./clock");

const SOURCE_COMMIT = "33bd33e";
const frozenDirectory = path.resolve(__dirname, "../apps/admin/legacy-v1");
const frozenModules = new Set(["platform", "store", "pricing", "lifecycle", "permissions", "seed-catalog", "seed-pricing", "app-api", "admin-api", "identity"]);
const clone = value => JSON.parse(JSON.stringify(value));
const failure = (code, message) => Object.assign(new Error(message), { status: 503, code });

function recordedClaims(entry) {
  const header = Object.entries(entry.headers || {}).find(([name]) => name.toLowerCase() === "authorization")?.[1];
  const queryToken = new URL(entry.url, "http://private-replay.invalid").searchParams.get("token");
  let token = String(header || queryToken || "").replace(/^Bearer\s+/i, "").trim().replace(/^"|"$/g, "");
  if (token.startsWith("{")) { try { token = JSON.parse(token).accessToken || ""; } catch { token = ""; } }
  try {
    const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    if (claims.sub === undefined && claims.id === undefined) throw new Error();
    return claims; // Expiry/current activation are intentionally not historical authorization.
  } catch { throw failure("legacy_actor_missing", "A historical platform command has no recoverable recorded actor."); }
}

function registryRecords(ctx) {
  const records = [];
  if (ctx.accounts instanceof Map) for (const raw of ctx.accounts.values()) {
    let record;
    try { record = typeof raw === "string" ? JSON.parse(raw) : raw; }
    catch { throw failure("legacy_registry_unavailable", "A required account registration record is unreadable."); }
    if (!record?.user?.id) throw failure("legacy_registry_unavailable", "A required account registration record is incomplete.");
    records.push(record);
  }
  for (const user of ctx.identity?.users || []) if (!records.some(record => String(record.user.id) === String(user.id))) records.push({ user, registration: user.signupInfo || null });
  return records;
}

function safeHistoricalUser(user) {
  const { password, passwordHash, signupSeal, ...safe } = user;
  return { ...clone(safe), isActive: true, deletedAt: null };
}

function createLegacyPlatform(ctx = {}, { seedAt = clock.now(), seed = `seed:${seedAt}` } = {}) {
  clock.install();
  const trusted = new AsyncLocalStorage(), cache = new Map();
  const serialize = require("./journal").makeLock();
  const config = ctx.config || require("../config");
  function load(name) {
    if (!frozenModules.has(name)) throw failure("legacy_module_unavailable", `Unknown frozen platform module: ${name}`);
    if (cache.has(name)) return cache.get(name).exports;
    const filename = path.join(frozenDirectory, `${name}.js`);
    let source = fs.readFileSync(filename, "utf8");
    if (name === "store") {
      const needle = "  return S;";
      if (source.split(needle).length !== 2) throw failure("legacy_source_changed", "The frozen sequence instrumentation no longer matches its source.");
      source = source.replace(needle, "  Object.defineProperty(S, '__legacySequence', { get: () => seq });\n  return S;");
    }
    if (name === "platform") source += "\nObject.defineProperty(module.exports, '__legacyStore', { get: () => S });\n";
    const module = { exports: {} }; cache.set(name, module);
    const requireFrozen = request => {
      if (request === "../config" || request === "../../config") return config;
      if (name === "identity" && request === "./util") return ctx.util || require("./util");
      if (name === "identity" && request === "./auth-store") return require("./auth-store");
      if (name === "identity" && request === "./clock") return clock;
      if (request === "crypto" || request === "node:crypto") return require("node:crypto");
      const candidate = request.replace(/^\.\/admin\//, "").replace(/^\.\//, "").replace(/\.js$/, "");
      if (frozenModules.has(candidate)) return load(candidate);
      throw failure("legacy_dependency_unavailable", `Frozen platform dependency is not approved: ${request}`);
    };
    vm.runInThisContext(Module.wrap(source), { filename })(module.exports, requireFrozen, module, filename, frozenDirectory);
    return module.exports;
  }
  let identity, platform, S;
  const admin = express(), sos = express();
  let committed = null;
  let incomplete = false;
  clock.runPinned({ at: seedAt, seed }, () => {
    identity = load("identity");
    identity.userFromReq = () => trusted.getStore()?.actor || null;
    identity.requireUser = (req, res) => { const user = identity.userFromReq(req); if (!user) res.status(401).json({ error: { code: "private_replay_only" } }); return user; };
    platform = load("platform");
    identity.registerModules([{ key: "admin", scopes: platform.scopes, grants: platform.grants }]);
    const privateContext = { ...ctx, config, identity };
    const guard = key => (req, res, next) => {
      if (trusted.getStore()?.app !== key) return res.status(403).json({ error: { code: "private_replay_only", message: "Historical replay is process-internal." } });
      next();
    };
    admin.use(guard("admin")); sos.use(guard("sos"));
    platform.routes(admin, privateContext); platform.mounts.sos(sos, privateContext);
    S = platform.__legacyStore;
  });
  const restored = new Set(identity.users.map(user => String(user.id)));

  function restoreRegistrations(throughAt) {
    const through = Number(throughAt);
    const pending = registryRecords(ctx).filter(record => record.registration && !restored.has(String(record.user.id)) && Date.parse(record.user.createdAt) <= through).sort((a, b) => Date.parse(a.user.createdAt) - Date.parse(b.user.createdAt) || Number(a.user.id) - Number(b.user.id));
    for (const record of pending) {
      const user = safeHistoricalUser(record.user);
      clock.runPinned({ at: Date.parse(user.createdAt), seed: `registration:${user.id}:${user.createdAt}` }, () => identity.hydrate(new Map([[String(user.id), JSON.stringify({ user, grants: {}, registration: record.registration })]])));
      restored.add(String(user.id));
    }
    return pending.length;
  }
  restoreRegistrations(seedAt);

  function invoke(router, entry) {
    return new Promise((resolve, reject) => {
      const request = new http.IncomingMessage(new net.Socket());
      request.method = entry.method; request.url = entry.url;
      request.headers = Object.fromEntries(Object.entries(entry.headers || {}).filter(([name]) => !/^x-mock-(replay|actor)/i.test(name)).map(([name, value]) => [name.toLowerCase(), value]));
      try {
        const bytes = entry.body ? Buffer.from(entry.body, "base64") : Buffer.alloc(0);
        request.body = bytes.length ? JSON.parse(bytes.toString("utf8")) : {};
      } catch { return reject(failure("legacy_body_unavailable", "A historical platform request body could not be reconstructed.")); }
      const response = new http.ServerResponse(request);
      response.end = payload => {
        const rawPayload = payload ? Buffer.from(payload) : Buffer.alloc(0);
        let body = null; try { body = rawPayload.length ? JSON.parse(rawPayload.toString("utf8")) : null; } catch { /* Preserve non-JSON bytes. */ }
        resolve({ statusCode: response.statusCode, rawPayload, body }); return response;
      };
      router.handle(request, response, e => reject(e || failure("legacy_route_unavailable", "A historical platform route is unavailable.")));
    });
  }

  async function replayOne(entry) {
    if (committed) throw failure("legacy_after_checkpoint", "An unversioned platform writer followed a committed modern checkpoint; stop migration and reconcile the writer.");
    const permitted = entry?.app === "admin" && /^\/v1\/(admin|app|__mock)(\/|$)/.test(entry.url || "") || entry?.app === "sos" && /^\/v1\/app(\/|$)/.test(entry.url || "");
    if (!permitted || !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(entry.method) || !Number.isFinite(Number(entry.at))) throw failure("legacy_route_unavailable", "Only recorded platform requests can use the private historical reducer.");
    restoreRegistrations(entry.at);
    // These two controls were public in the frozen implementation. Their authority is the
    // accepted journal entry inside this private reducer, never a client-supplied header.
    const legacyControl = entry.app === "admin" && entry.method === "POST" && ["/v1/__mock/fail-next-payment", "/v1/__mock/advance"].includes(entry.url);
    const claims = legacyControl ? {} : recordedClaims(entry), id = claims.sub ?? claims.id;
    let actor = legacyControl ? null : identity.findUser(id);
    if (!actor) {
      const record = registryRecords(ctx).find(row => String(row.user.id) === String(id));
      if (record && Date.parse(record.user.createdAt) <= Number(entry.at)) {
        actor = safeHistoricalUser(record.user); identity.users.push(actor); restored.add(String(actor.id));
      }
    }
    if (!actor && !legacyControl) throw failure("legacy_actor_missing", "A recorded historical actor is unavailable; no financial amounts were invented.");
    if (claims.readOnly && !["GET", "HEAD", "OPTIONS"].includes(entry.method)) throw failure("legacy_read_only", "A recorded read-only identity cannot authorize a historical mutation.");
    const result = await trusted.run({ app: entry.app, actor, claims }, () => clock.runPinned({ at: entry.at, seed: entry.seed }, () => invoke(entry.app === "admin" ? admin : sos, entry)));
    if (result.statusCode >= 400) throw failure("legacy_replay_refused", `The frozen reducer refused an accepted historical command (${result.statusCode}); stop migration instead of skipping it.`);
    return result;
  }

  function exportState() {
    if (incomplete && !committed) throw failure("legacy_replay_incomplete", "A historical command was refused; partial financial state cannot be adopted.");
    return committed ? clone(committed) : { db: clone(S.db), sequence: S.__legacySequence, failNext: S.failNext || 0, sourceCommit: SOURCE_COMMIT };
  }
  function adoptCommittedSnapshot(snapshot) {
    if (!snapshot?.db || !Array.isArray(snapshot.db.workspaces) || !Array.isArray(snapshot.db.invoices) || !Number.isSafeInteger(snapshot.sequence) || snapshot.sequence < 1000) throw failure("platform_checkpoint_invalid", "The committed platform checkpoint is incomplete.");
    committed = clone(snapshot);
    return exportState();
  }
  const replayAccepted = entry => serialize(async () => {
    try { return await replayOne(entry); }
    catch (e) { if (!committed) incomplete = true; throw e; }
  });
  return { state: S, router: { admin, sos }, identity, replayAccepted, restoreRegistrations, exportState, adoptCommittedSnapshot };
}

module.exports = { createLegacyPlatform, SOURCE_COMMIT };
