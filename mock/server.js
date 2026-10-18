// Starts one mock API per app (plus the shared SOS/identity API and a local icon server).
// Usage: node server.js [--only tasks,files]   (the SOS/identity API always runs)
//        MOCK_PORT_OFFSET=100 node server.js   (shift API ports, e.g. to test in isolation)
//        MOCK_NOW=2026-09-29T09:00:00+03:00 MOCK_CLOCK=frozen node server.js
//                                              (a fixed instant, for audits and screenshots)
//
// Control routes, on every API port (README "Controls"):
//   POST /__mock/reset           rebuild every app's seed data; servers keep running and tokens stay valid
//   GET  /__mock/clock           the mock time
//   POST /__mock/clock           {now, frozen}: set it (now: an ISO date or "real"), then reset the data
//   POST /__mock/clock/advance   {days, hours, minutes}: move the clock on, keeping the data
//   GET  /__mock/requests        recent requests: ?since=<seq>&app=&user=&status=4xx&limit=
//   GET  /__mock/status          clock, data generation, test switches, and every app's ports
//   POST /__mock/faults          {app, method, match, status, delayMs, times}: make matching requests slow or fail
//   GET/DELETE /__mock/faults    list or clear the rules (DELETE /__mock/faults/:id for one)
//   POST /__mock/strict          {on}: refuse users whose launcher scopes don't include the app (also MOCK_STRICT_SCOPES=1)
const clock = require("./lib/clock");
clock.install(); // before anything else reads the time: the seed data is built from it

const fs = require("fs");
const path = require("path");
const http = require("http");
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { Server } = require("socket.io");

const config = require("./config");
const icons = require("./lib/icons");
const requests = require("./lib/requests");
const journal = require("./lib/journal");
const authStorage = require("./lib/auth-store");
const accountStore = authStorage.pickStore(config);
let workspaceBoundary;

// "chats" has no API: its module only registers a launcher tile.
const ORDER = ["sos", "tasks", "files", "sales", "hr", "marketing", "content", "wm", "admin", "chats"];
const onlyArg = process.argv.find((a) => a.startsWith("--only"));
const only = onlyArg ? (onlyArg.split("=")[1] || process.argv[process.argv.indexOf(onlyArg) + 1] || "").split(",").filter(Boolean) : null;
const LOG_DIR = path.join(config.dataDir, "logs");
fs.mkdirSync(LOG_DIR, { recursive: true });
const unhandledLog = path.join(LOG_DIR, "unhandled.log");

// A reset re-requires the app modules and the shared libraries so every in-memory store is
// rebuilt from its seed. These modules hold state that must survive a reset.
const KEEP = new Set(["./lib/clock", "./lib/requests", "./lib/icons", "./lib/journal", "./lib/auth-store", "./config"].map((p) => require.resolve(p)));
const RELOAD_DIRS = ["apps", "lib"].map((d) => path.join(__dirname, d) + path.sep);
function purgeLocalModules() {
  for (const id of Object.keys(require.cache)) {
    if (!KEEP.has(id) && RELOAD_DIRS.some((d) => id.startsWith(d))) delete require.cache[id];
  }
}

// Load app modules (apps/<key>.js). A broken module is reported and skipped, never fatal.
function loadModules() {
  const modules = [];
  for (const key of ORDER) {
    if (only && key !== "sos" && key !== "admin" && !only.includes(key)) continue;
    const file = path.join(__dirname, "apps", `${key}.js`);
    if (!fs.existsSync(file)) continue;
    try {
      const m = require(file);
      m.key = key;
      modules.push(m);
    } catch (e) {
      console.error(`[api:${key}] failed to load apps/${key}.js:\n`, e);
    }
  }
  return modules;
}

function uploadsDir(key) {
  const dir = path.join(config.dataDir, "uploads", key);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function makeCtx(key, identity, util) {
  const dir = uploadsDir(key);
  const storage = multer.diskStorage({
    destination: dir,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}-${file.originalname.replace(/[^\w.\-]+/g, "_")}`),
  });
  return {
    key,
    config,
    identity,
    util,
    // utf8 so Arabic (and other non-Latin) upload names survive intact.
    upload: multer({ storage, limits: { fileSize: 200 * 1024 * 1024 }, defParamCharset: "utf8" }),
    uploadsDir: dir,
    fileUrl: (filename) => `${config.apiUrl(key)}/uploads/${encodeURIComponent(filename)}`,
    apiUrl: config.apiUrl,
    webUrl: config.webUrl,
    io: null,
    log: (...args) => console.log(`[api:${key}]`, ...args),
    workspaceBoundary: key === 'wm',
    salesLeadDelivery: key === 'wm' ? async (payload, metadata) => workspaceBoundary.deliverWebsiteLead(payload, metadata) : undefined,
    catalogMirror: key === 'wm' ? args => workspaceBoundary.catalogMirror(args) : undefined,
    staffPreferences: key === 'wm' ? { current: () => workspaceBoundary.staffPreferences(), save: patch => workspaceBoundary.staffPreferences(patch) } : undefined,
    crmLeadTarget: key === 'wm' ? args => workspaceBoundary.crmLeadTarget(args) : undefined,
    previewIssuerAllowed: key === 'wm' ? user => Boolean(workspaceBoundary?.contextService().staffAccess(user).permissions.wm?.includes('content:view')) : undefined,
  };
}

// ---- state shared by every build ----
const slots = new Map(); // app key -> { server, io, app }
const state = { generation: 0, lastReset: null, resetting: false, strict: process.env.MOCK_STRICT_SCOPES === "1" };

// Test-only fault rules. They let an audit show a screen's loading, error and no-permission
// states without touching the app: e.g. { app: "hr", match: "/api/attendance", status: 403 }.
// `match` is a substring of the URL, or a regular expression prefixed "re:"
// (e.g. "re:/api/(users|staff)$"). Rules survive a reset.
const faults = [];
let nextFaultId = 1;
function faultMatcher(match) {
  if (!match) return () => true;
  if (match.startsWith("re:")) {
    const re = new RegExp(match.slice(3)); // throws on a bad pattern; checked when the rule is added
    return (url) => re.test(url);
  }
  return (url) => url.includes(match);
}
function matchesFault(rule, key, req) {
  if (rule.app && rule.app !== key) return false;
  if (rule.method && rule.method.toUpperCase() !== req.method) return false;
  return rule.test(req.originalUrl);
}

function status() {
  return {
    clock: clock.status(),
    generation: state.generation,
    lastReset: state.lastReset,
    lastRequestSeq: requests.lastSeq(),
    strictScopes: state.strict,
    journal: store ? { sandbox, store: store.kind, epoch: persist.epoch, entries: persist.applied, skipped: persist.skipped, seedAt: persist.seedAt && new clock.RealDate(persist.seedAt).toISOString() } : null,
    faults,
    apps: Object.fromEntries(
      Object.entries(config.apps).map(([k, a]) => [k, { web: config.webUrl(k), api: a.api == null ? null : config.apiUrl(k), running: slots.has(k), reserved: Boolean(a.reserved) }]),
    ),
  };
}

// Rebuilds everything after the current response has gone out, so the handler that asked
// for it isn't swapped out from under itself.
function scheduleReset(reason) {
  if (state.resetting) return;
  state.resetting = true;
  setImmediate(() => {
    try {
      build();
      console.log(`[mock] data reset (${reason}); generation ${state.generation}, clock ${clock.status().mode} at ${clock.status().now}`);
    } catch (e) {
      console.error("[mock] reset failed:", e);
    } finally {
      state.resetting = false;
    }
  });
}

function controlRoutes(app) {
  const c = express.Router();
  c.get("/status", (req, res) => res.json({ success: true, data: status() }));
  c.post("/reset", async (req, res, next) => {
    try {
      // Only CI's explicit preview reset can clear reserved test-domain fixtures. Production
      // and ordinary data resets always preserve accounts, including non-test preview users.
      if (req.body?.fixtures === true) {
        const identity = require("./lib/identity");
        const user = identity.userFromReq(req);
        if (sandbox !== "preview" || !user || !identity.userScopes(user).some(scope => scope.scope === "global" && scope.roles.includes("super_admin"))) {
          return res.status(403).json({ success: false, message: "Test account resets are restricted to preview administrators." });
        }
        await accountStore.resetTestFixtures();
      }
      await resetData("POST /__mock/reset");
      res.json({ success: true, message: "Every app's data was reset", data: { generation: state.generation } });
    } catch (error) { next(error); }
  });
  c.get("/clock", (req, res) => res.json({ success: true, data: clock.status() }));
  c.post("/clock", async (req, res, next) => {
    const { now, frozen, reset = true } = req.body || {};
    const previous = clock.exportState();
    try {
      const data = clock.set({ now, frozen });
      if (reset) await resetData("clock set");
      else await saveClock();
      res.json({ success: true, message: reset ? "Clock set; data was rebuilt for the new time" : "Clock set", data });
    } catch (e) {
      clock.importState(previous);
      if (e.status) return next(e);
      res.status(400).json({ success: false, statusCode: 400, message: e.message });
    }
  });
  c.post("/clock/advance", async (req, res, next) => {
    const { days = 0, hours = 0, minutes = 0, seconds = 0 } = req.body || {};
    const ms = ((Number(days) * 24 + Number(hours)) * 60 + Number(minutes)) * 60000 + Number(seconds) * 1000;
    const previous = clock.exportState();
    try {
      const data = clock.advance(ms);
      await saveClock();
      res.json({ success: true, message: "Clock moved on", data });
    } catch (e) {
      clock.importState(previous);
      if (e.status) return next(e);
      res.status(400).json({ success: false, statusCode: 400, message: e.message });
    }
  });
  c.get("/requests", (req, res) => res.json({ success: true, data: requests.list(req.query) }));
  c.get("/faults", (req, res) => res.json({ success: true, data: faults }));
  c.post("/faults", (req, res) => {
    const { app: appKey, method, match, status: code, delayMs, times } = req.body || {};
    if (!code && !delayMs) return res.status(400).json({ success: false, statusCode: 400, message: "A fault needs a status, a delayMs, or both" });
    let test;
    try {
      test = faultMatcher(match);
    } catch (e) {
      return res.status(400).json({ success: false, statusCode: 400, message: `Invalid "re:" pattern: ${e.message}` });
    }
    const rule = { id: nextFaultId++, app: appKey || null, method: method || null, match: match || null, status: code ? Number(code) : null, delayMs: delayMs ? Number(delayMs) : 0, remaining: times ? Number(times) : null };
    Object.defineProperty(rule, "test", { value: test, enumerable: false }); // kept out of the JSON listing
    faults.push(rule);
    res.status(201).json({ success: true, message: "Fault rule added", data: rule });
  });
  c.delete("/faults", (req, res) => {
    faults.length = 0;
    res.json({ success: true, message: "All fault rules cleared", data: [] });
  });
  c.delete("/faults/:id", (req, res) => {
    const i = faults.findIndex((f) => String(f.id) === req.params.id);
    if (i !== -1) faults.splice(i, 1);
    res.json({ success: true, message: i === -1 ? "No such rule" : "Fault rule removed", data: faults });
  });
  c.post("/strict", (req, res) => {
    state.strict = Boolean(req.body?.on);
    res.json({ success: true, message: `Strict scopes ${state.strict ? "on" : "off"}`, data: { strictScopes: state.strict } });
  });
  app.use("/__mock", c);
}

// Applies the fault rules (and, with MOCK_FAULTS=1, the ?__fail= and ?__delay= query params).
function faultMiddleware(key) {
  return (req, res, next) => {
    if (req.path.startsWith("/__mock") || req.path === "/__health") return next();
    let code = null;
    let delay = 0;
    const rule = faults.find((r) => matchesFault(r, key, req));
    if (rule) {
      code = rule.status;
      delay = rule.delayMs;
      if (rule.remaining != null && --rule.remaining <= 0) faults.splice(faults.indexOf(rule), 1);
    } else if (process.env.MOCK_FAULTS === "1" && (req.query.__fail || req.query.__delay)) {
      code = req.query.__fail ? Number(req.query.__fail) : null;
      delay = req.query.__delay ? Number(req.query.__delay) : 0;
    }
    if (code == null && !delay) return next();
    const act = () => (code ? res.status(code).json({ success: false, statusCode: code, message: `[local mock] injected ${code} for ${req.method} ${req.path}` }) : next());
    return delay ? setTimeout(act, delay) : act();
  };
}

// With strict scopes on, an app's API refuses people whose launcher doesn't include that app,
// the way a real backend would. Unauthenticated calls go through to the app's own logic.
// "View as" (D-017): a session started from SOS People is read-only. Every app refuses a change
// made with such a token (403, code "read_only"), except leaving it again and the hand-off itself.
const READ_ONLY_ALLOWED = ["/api/auth/exit-impersonation", "/api/auth/logout", "/api/auth/refresh", "/api/auth/handoff", "/api/auth/handoff/exchange"];
function readOnlyMiddleware(identity) {
  return (req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method) || req.path.startsWith("/__") || READ_ONLY_ALLOWED.includes(req.path)) return next();
    const claims = identity.decode(identity.tokenFrom(req));
    if (!claims?.readOnly) return next();
    const message = "You're viewing as someone else: changes are turned off.";
    res.status(403).json({ success: false, statusCode: 403, code: "read_only", message, error: { code: "read_only", message } });
  };
}

function strictScopesMiddleware(key, identity) {
  const names = () => identity.scopes.filter((s) => s.domain === config.webUrl(key)).map((s) => s.name);
  return (req, res, next) => {
    if (!state.strict || key === "sos" || req.path.startsWith("/__") || req.path.startsWith("/uploads")) return next();
    const user = identity.userFromReq(req);
    const appScopes = names();
    if (!user || appScopes.length === 0) return next();
    if (identity.userScopes(user).some((s) => appScopes.includes(s.scope))) return next();
    return res.status(403).json({ success: false, statusCode: 403, message: `[local mock] ${user.email} has no access to ${key}` });
  };
}

function build() {
  purgeLocalModules();
  const identity = require("./lib/identity");
  identity.configureStore(accountStore);
  if (workspaceBoundary) identity.configureAuthority(workspaceBoundary.authority);
  const util = require("./lib/util");
  const modules = loadModules();
  identity.registerModules(modules);
  state.generation += 1;

  for (const key of ORDER) {
    const own = modules.find((m) => m.key === key);
    if (!own && key !== "sos") continue;
    if (config.apps[key].api == null) continue; // frontend-only app: scopes/grants only, no server
    const ctx = makeCtx(key, identity, util);
    const app = express();
    app.disable("x-powered-by");
    app.set("etag", false);
    app.use(cors({ origin: true, credentials: true }));
    app.use(express.json({ limit: "50mb" }));
    app.use(express.urlencoded({ extended: true, limit: "50mb" }));
    app.use((req, res, next) => {
      const started = clock.RealDate.now();
      res.on("finish", () => {
        if (req.method === "OPTIONS") return;
        const ms = clock.RealDate.now() - started;
        console.log(`[api:${key}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
        if (!req.originalUrl.startsWith("/__mock")) {
          requests.record({ t: new Date().toISOString(), app: key, method: req.method, url: req.originalUrl, status: res.statusCode, ms, user: requests.actor(req), gen: state.generation });
        }
      });
      next();
    });
    app.use("/uploads", express.static(ctx.uploadsDir));
    app.get("/__health", (req, res) => res.json({ ok: true, app: key, generation: state.generation }));
    controlRoutes(app);
    app.use(faultMiddleware(key));
    app.use(strictScopesMiddleware(key, identity));
    app.use(readOnlyMiddleware(identity));

    if (key === "sos") identity.routes(app, ctx);
    if (own?.routes) own.routes(app, ctx);
    // Fallback routes other modules add to this API (e.g. HR needing a task-manager endpoint).
    for (const m of modules) if (m !== own && m.mounts?.[key]) m.mounts[key](app, ctx);

    app.use((req, res) => {
      const line = `${new Date().toISOString()} [api:${key}] ${req.method} ${req.originalUrl}\n`;
      fs.appendFile(unhandledLog, line, () => {});
      console.warn(`[api:${key}] NO MOCK HANDLER: ${req.method} ${req.originalUrl}`);
      res.status(404).json({ success: false, statusCode: 404, message: `[local mock] No handler for ${req.method} ${req.path}` });
    });
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
      console.error(`[api:${key}] ERROR on ${req.method} ${req.originalUrl}:`, err);
      const status = Number.isInteger(err.status) && err.status >= 400 && err.status <= 599 ? err.status : 500;
      res.status(status).json({ success: false, statusCode: status, ...(err.code ? { code: err.code } : {}), message: status === 503 ? "Account service unavailable. Please try again." : err.message });
    });

    let slot = slots.get(key);
    if (!slot && process.env.ORGTIK_MOCK_NO_LISTEN) {
      // Serverless: no sockets. A stand-in io lets modules register handlers and emit harmlessly.
      const io = { on() {}, use() {}, emit() {}, of() { return io; }, to() { return io; }, in() { return io; }, sockets: new Map(), _nsps: new Map() };
      slot = { server: null, io };
      slots.set(key, slot);
    } else if (!slot) {
      // Every app sets cookies on "localhost", and browsers send all of them to every port;
      // a bigger header limit avoids HTTP 431 once you're signed in to all apps.
      const server = http.createServer({ maxHeaderSize: 64 * 1024 }, (req, res) => handle(key, req, res));
      const io = new Server(server, { cors: { origin: true, credentials: true } });
      slot = { server, io };
      slots.set(key, slot);
      server.listen(config.apps[key].api, () => console.log(`[api:${key}] mock API on ${config.apiUrl(key)}  (web app: ${config.webUrl(key)})`));
    } else {
      // Socket handlers close over the previous data. Drop them, with their middleware, then
      // close each client's connection. Closing the transport (rather than sending a
      // "disconnect") is what makes socket.io clients reconnect on their own, and they
      // reconnect to the new handlers.
      for (const nsp of slot.io._nsps.values()) {
        nsp.removeAllListeners("connection");
        nsp._fns.length = 0;
        for (const socket of nsp.sockets.values()) socket.conn.close();
      }
    }
    slot.app = app;
    ctx.io = slot.io;
    if (own?.sockets && !['tasks', 'files', 'hr', 'sales', 'marketing', 'chats'].includes(key)) own.sockets(slot.io, ctx);
    else slot.io.on("connection", () => {}); // accept connections so clients don't retry forever
  }
  state.lastReset = new Date().toISOString();
}

// ---- persistence: the write journal (D-053, lib/journal.js) ----
// With a store configured, the seed is built at a fixed instant (meta.seedAt) with seeded random
// numbers, and every recorded change is replayed with its own instant and seed, so every instance
// of the mock rebuilds the same data. Without a store nothing here runs.
const pickedJournal = journal.pickStore(config);
const sandbox = pickedJournal.sandbox;
const store = pickedJournal.store || journal.fileStore(path.join(config.dataDir, "journal", `${sandbox}-workspace.json`));
const persist = { epoch: null, seedAt: null, clockJson: null, applied: 0, skipped: 0, rebuild: false, ready: null, lock: journal.makeLock(), legacy: null, modern: false };
const realRandom = (() => { const r = Math.random; return () => r(); })(); // outside a pinned run this is the real one
workspaceBoundary = require("./lib/workspace-boundary").createWorkspaceBoundary({ realm: sandbox, config, store, accountStore, platform: () => platform(), identity: () => require("./lib/identity"), dispatch, persist, util: require("./lib/util"), makeCtx, staffAvailable: key => Boolean(slots.get(key)?.app) });

function newMeta() {
  return { epoch: `${clock.RealDate.now().toString(36)}-${Math.floor(realRandom() * 1e9).toString(36)}`, seedAt: clock.now(), clock: clock.exportState() };
}

// Changes (live and replayed) reach the apps through a loopback HTTP server, so Express gets real
// request and response objects; the pin is set around the whole round trip.
let loopback = null;
function loopbackBase() {
  if (!loopback) {
    loopback = new Promise((resolve, reject) => {
      const srv = http.createServer({ maxHeaderSize: 64 * 1024 }, (req, res) => {
        const fallback = () => slots.get(req.headers["x-mock-app"])?.app;
        const app = req.headers["x-orgtik-dispatch"] ? workspaceBoundary.frameApp(req.headers["x-orgtik-dispatch"], req, fallback) : fallback();
        if (!app) return sendJson(res, 404, { success: false, statusCode: 404, message: "[mock] no such app" });
        app(req, res);
      });
      srv.on("error", reject);
      srv.on("connection", (socket) => socket.unref());
      srv.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${srv.address().port}`));
      srv.unref();
    });
    loopback.catch(() => { loopback = null; });
  }
  return loopback;
}

async function dispatch(key, { method, url, headers, body }) {
  const base = await loopbackBase();
  return require("./lib/dispatch").dispatch(base, key, { method, url, headers, body });
}

// Financial replay uses a committed domain snapshot. The old input-only prefix uses its
// frozen reducer so today's pricing, roles or token expiry cannot alter a paid invoice.
const platformRequest = (key, url) => key === "admin" && /^\/v1\/(admin|app|public|__mock)(\/|$)/.test(url) || key === "sos" && /^\/v1\/(app|public)(\/|$)/.test(url);
const platform = () => require("./apps/admin");
const storageError = message => Object.assign(new Error(message), { status: 503 });

async function replay(lines, offset) {
  let n = 0;
  for (const line of lines) {
    n += 1;
    const e = typeof line === "string" ? JSON.parse(line) : line;
    if (e.epoch !== persist.epoch) throw storageError("Journal epoch does not match its committed history.");
    if (e.kind === "clock-v2") { clock.importState(e.clock); continue; }
    if (e.kind === "workspace-v1") {
      const checkpoint = e.checkpoint ? require("./lib/domain-checkpoint").decodeDomainCheckpoint(e.checkpoint) : e;
      if (checkpoint.platformState?.platformVersion !== 2 || !checkpoint.workspaceState) throw storageError("Invalid workspace checkpoint.");
      platform().importState(checkpoint.platformState); workspaceBoundary.importState(checkpoint.workspaceState);
      workspaceBoundary.importStaffState(checkpoint.staffState || {});
      persist.legacy.adoptCommittedSnapshot(checkpoint.platformState);
      persist.toolLegacy?.adoptWorkspaceCheckpoint();
      persist.workspaceModern = true; persist.modern = true; continue;
    }
    if (e.platformState) {
      if (!platformRequest(e.app, e.url) || e.platformState.platformVersion !== 2) throw storageError("Invalid platform checkpoint.");
      platform().importState(e.platformState);
      persist.legacy.adoptCommittedSnapshot(e.platformState);
      persist.modern = true;
      continue;
    }
    if (platformRequest(e.app, e.url)) {
      await persist.legacy.replayAccepted(e);
      platform().importState(persist.legacy.exportState());
      continue;
    }
    if (['tasks', 'files', 'hr', 'sales', 'marketing', 'wm'].includes(e.app)) {
      if (persist.workspaceModern) throw storageError('An older tool writer followed a workspace checkpoint. Reconcile that writer before continuing.');
      persist.toolLegacy ??= require('./lib/legacy-tool-replay').createLegacyToolReplay({ identity: require('./lib/identity'), config, util: require('./lib/util'), makeCtx, realm: sandbox, seedAt: persist.seedAt });
      await persist.toolLegacy.replayAccepted(e);
      workspaceBoundary.importState(persist.toolLegacy.exportWorkspaceState());
      if (e.app === 'wm') workspaceBoundary.importStaffState(persist.toolLegacy.exportStaffState());
      continue;
    }
    if (!slots.get(e.app)?.app) throw storageError(`A required journal app is unavailable: ${e.app}`);
    const r = await clock.runPinned({ at: e.at, seed: e.seed }, () =>
      dispatch(e.app, { method: e.method, url: e.url, headers: e.headers, body: e.body ? Buffer.from(e.body, "base64") : null }),
    );
    if (r.statusCode >= 400) throw storageError(`Accepted journal command #${offset + n} could not be restored (${r.statusCode}).`);
  }
  persist.applied = offset + n;
}

async function restore(meta, entries) {
  persist.toolLegacy?.close(); persist.toolLegacy = null;
  workspaceBoundary.importState({ version: 1, realm: sandbox, snapshots: {} });
  persist.epoch = meta.epoch;
  persist.seedAt = meta.seedAt;
  persist.clockJson = JSON.stringify(meta.clock ?? null);
  clock.importState(meta.clock);
  clock.runPinned({ at: meta.seedAt, seed: `seed:${meta.seedAt}` }, () => workspaceBoundary.authority.runWithoutRequest(build));
  const accounts = await accountStore.accounts();
  const identity = require("./lib/identity");
  identity.hydrate(accounts);
  persist.legacy = require("./lib/platform-replay").createLegacyPlatform({ identity, accounts, config }, { seedAt: meta.seedAt });
  persist.modern = false;
  persist.workspaceModern = false;
  persist.applied = 0;
  persist.skipped = 0;
  // Leave rebuild set if reconstruction fails. Never serve partially restored financial state.
  persist.rebuild = true;
  await replay(entries, 0);
  persist.rebuild = false;
  console.log(`[journal] ${sandbox}: seed of ${new clock.RealDate(meta.seedAt).toISOString()} + ${persist.applied} committed changes`);
}

function ready() {
  if (!store) return Promise.resolve();
  if (!persist.ready) {
    persist.ready = persist.lock(async () => {
      await store.initialize(newMeta());
      const { meta, entries } = await store.snapshot(0);
      await restore(meta, entries);
    });
    persist.ready.catch(() => { persist.ready = null; });
  }
  return persist.ready;
}

// Catch up against one atomic metadata/revision view (inside the request lock).
async function sync() {
  let snapshot = await store.snapshot(persist.applied);
  if (!snapshot.meta) {
    await store.initialize(newMeta());
    snapshot = await store.snapshot(0);
    return restore(snapshot.meta, snapshot.entries);
  }
  if (snapshot.meta.epoch !== persist.epoch || persist.rebuild || snapshot.revision < persist.applied) {
    snapshot = await store.snapshot(0);
    return restore(snapshot.meta, snapshot.entries);
  }
  if (snapshot.entries.length) {
    const accounts = await accountStore.accounts();
    require("./lib/identity").hydrate(accounts);
    // New account registrations are metadata for reconstructing the accepted historical actor.
    // The reducer also reads the current hydrated registry for accounts created after warm-up.
    try { await replay(snapshot.entries, persist.applied); }
    catch (error) { persist.rebuild = true; throw error; }
  }
}

// Controls also run under the request lock. Persist their clock change before acknowledging it.
async function saveClock() {
  if (!store) return;
  const entry = { epoch: persist.epoch, kind: "clock-v2", clock: clock.exportState() };
  const committed = await store.commit(entry, { expectedEpoch: persist.epoch, expectedRevision: persist.applied });
  persist.applied = committed.sequence;
}

async function resetData(reason) {
  if (!store) { scheduleReset(reason); return; }
  const meta = newMeta();
  await store.reset(meta, { expectedEpoch: persist.epoch, expectedRevision: persist.applied });
  await restore(meta, []);
  console.log(`[mock] data reset (${reason}); journal epoch ${meta.epoch}`);
}

function readBody(req) {
  if (req.readableEnded) {
    if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
    if (typeof req.body === "string") return Promise.resolve(Buffer.from(req.body));
    return Promise.resolve(req.body == null ? Buffer.alloc(0) : Buffer.from(JSON.stringify(req.body)));
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function send(res, r, { head = false } = {}) {
  const headers = { ...r.headers };
  delete headers["transfer-encoding"];
  delete headers.connection;
  delete headers["keep-alive"];
  delete headers.date;
  headers["content-length"] = head && headers['content-length'] !== undefined ? headers['content-length'] : r.rawPayload.length;
  res.writeHead(r.statusCode, headers);
  res.end(r.rawPayload);
}

const sendJson = (res, code, body) => {
  res.writeHead(code, { "content-type": "application/json", "access-control-allow-origin": res.getHeader('access-control-allow-origin') || "*", "access-control-allow-credentials": "true", vary: 'Origin' });
  res.end(JSON.stringify(body));
};

// Every request to an app's API goes through here (the local servers and api/index.js).
async function handle(key, req, res) {
  res.setHeader('access-control-allow-origin', req.headers.origin || '*');
  res.setHeader('access-control-allow-credentials', 'true');
  res.setHeader('vary', 'Origin');
  // Preflights do not need account storage and must work even during an outage.
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "access-control-allow-origin": req.headers.origin || "*", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS", "access-control-allow-headers": req.headers["access-control-request-headers"] || "content-type,authorization", "access-control-allow-credentials": "true", vary: "Origin" });
    return res.end();
  }
  try {
    await ready();
  } catch (e) {
    console.error("[journal] start failed:", e);
    return sendJson(res, 503, { success: false, statusCode: 503, message: "[mock] data store unavailable" });
  }
  const url = req.url || "/";
  const body = await readBody(req);
  return persist.lock(async () => {
    let saved;
    try {
      if (store) await sync();
      saved = await accountStore.accounts();
      require("./lib/identity").hydrate(saved);
    } catch {
      return sendJson(res, 503, { success: false, statusCode: 503, message: "Account service unavailable. Please try again." });
    }
    if (!slots.get(key)?.app) return sendJson(res, 404, { success: false, statusCode: 404, message: `[mock] no API for ${key}` });
    delete req.headers["x-orgtik-dispatch"];
    delete req.headers['x-mock-app'];
    return workspaceBoundary.handle({ key, req, body, legacyApp: slots.get(key).app, legacyAppFor: () => slots.get(key)?.app, send: result => send(res, result, { head: req.method === 'HEAD' }), sendJson: (code, value) => sendJson(res, code, value), sync });
  });
}

// On Vercel the APIs are served by api/index.js (no ports, no icon server).
if (process.env.ORGTIK_MOCK_NO_LISTEN) {
  if (!store) build();
  module.exports = { slots, state, handle, ready };
  return;
}

if (store) {
  ready().catch((e) => {
    console.error("[journal] start failed:", e);
    process.exit(1);
  });
} else {
  build();
}

const excalidrawDist = path.join(__dirname, "..", config.apps.chats.dir, "node_modules", "@excalidraw", "excalidraw", "dist", "prod");
icons.start(config.icons.port, fs.existsSync(excalidrawDist) ? [{ path: "/excalidraw", dir: excalidrawDist }] : []);
const c = clock.status();
if (c.mode !== "real") console.log(`\n[mock] clock is ${c.mode} at ${c.now}`);
console.log(`\nLocal test accounts: see local-dev/README.md (password for all: ${require("./lib/identity").LOCAL_PASSWORD})\n`);
