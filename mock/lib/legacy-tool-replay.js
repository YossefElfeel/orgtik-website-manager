// Process-private migration of accepted input-only tool history. No router is exposed
// to the network, no global require cache is changed, and this cannot issue sessions.
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), Module = require("node:module");
const http = require("node:http"), net = require("node:net"), express = require("express");
const clock = require("./clock");
const manifest = require("./workspace-runtime-manifest.json");
const ROOT = path.resolve(__dirname, ".."), APPS = ["tasks", "files", "sales", "hr", "marketing"];
const STAFF_APPS = ["wm"];
const clone = value => JSON.parse(JSON.stringify(value));
const fail = message => Object.assign(new Error(message), { status: 503, code: "legacy_tool_replay_unavailable" });

function privateGraph(appKey, identity, config, util) {
  const files = manifest.apps[appKey] || manifest.staff?.[appKey];
  if (!files) throw fail(`A historical module manifest is missing: ${appKey}`);
  const allowed = new Set(files), cache = new Map();
  const context = vm.createContext({ Buffer, console, process, URL, URLSearchParams, AbortController, AbortSignal, Date, Math: Object.create(Math), structuredClone, setTimeout, clearTimeout, setInterval, clearInterval, setImmediate, clearImmediate });
  vm.runInContext("globalThis.global = globalThis", context);
  const injected = new Map([[path.join(ROOT, "lib/identity.js"), identity], [path.join(ROOT, "config.js"), config], [path.join(ROOT, "lib/util.js"), util], [path.join(ROOT, "lib/clock.js"), clock]]);
  function resolve(request, parent) {
    const candidate = path.resolve(path.dirname(parent), request);
    const filename = [candidate, `${candidate}.js`, `${candidate}.json`, path.join(candidate, "index.js")].find(file => fs.existsSync(file) && fs.statSync(file).isFile());
    const relative = filename && path.relative(ROOT, filename).replace(/\\/g, "/");
    if (!relative || relative.startsWith("../") || path.isAbsolute(relative) || !injected.has(filename) && (!allowed.has(relative) || relative !== `apps/${appKey}.js` && !relative.startsWith(`apps/${appKey}/`) && !relative.startsWith("lib/"))) throw fail(`Unapproved historical tool dependency: ${request}`);
    return filename;
  }
  function load(filename) {
    if (injected.has(filename)) return injected.get(filename);
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} }; cache.set(filename, module);
    try {
      if (filename.endsWith(".json")) module.exports = JSON.parse(fs.readFileSync(filename, "utf8"));
      else {
        const native = Module.createRequire(filename);
        const ownedRequire = request => request.startsWith(".") || path.isAbsolute(request) ? load(resolve(request, filename)) : native(request);
        ownedRequire.resolve = request => request.startsWith(".") || path.isAbsolute(request) ? resolve(request, filename) : native.resolve(request);
        new vm.Script(Module.wrap(fs.readFileSync(filename, "utf8")), { filename }).runInContext(context)(module.exports, ownedRequire, module, filename, path.dirname(filename));
      }
      return module.exports;
    } catch (error) { cache.delete(filename); throw error; }
  }
  return { load: relative => load(resolve(`./${relative}`, path.join(ROOT, "entry.js"))), close: () => cache.clear() };
}

function invoke(router, entry, identity) {
  return new Promise((resolve, reject) => {
    const req = new http.IncomingMessage(new net.Socket());
    req.method = entry.method; req.url = entry.url;
    // Accepted journal metadata is consumed by the private capability, not by HTTP
    // authorization or a special caller-supplied bypass header.
    req.headers = Object.fromEntries(Object.entries(entry.headers || {}).filter(([name]) => !/^(authorization|cookie|x-mock-)/i.test(name)).map(([name, value]) => [name.toLowerCase(), value]));
    try { req.body = entry.body ? JSON.parse(Buffer.from(entry.body, "base64").toString("utf8")) : {}; identity.bindAcceptedRequest(req); }
    catch { return reject(fail("The historical tool body or private request binding is invalid.")); }
    const res = new http.ServerResponse(req);
    res.end = value => {
      const rawPayload = value ? Buffer.from(value) : Buffer.alloc(0);
      let body = null; try { body = rawPayload.length ? JSON.parse(rawPayload.toString("utf8")) : null; } catch { /* no binary reconstruction */ }
      resolve({ statusCode: res.statusCode, rawPayload, body }); return res;
    };
    router.handle(req, res, error => reject(error || fail("The historical tool route is unavailable.")));
  });
}

function createLegacyToolReplay({ identity, config, util, makeCtx, realm, seedAt }) {
  if (!/^[\w-]{1,100}$/.test(realm || "") || !Number.isFinite(Number(seedAt)) || typeof makeCtx !== "function") throw fail("Historical migration context is incomplete.");
  clock.install();
  const historical = identity.createCommittedReplayFacade(), tools = new Map(), lock = require("./journal").makeLock();
  let incomplete = false, closed = false, committed = false;
  const ensure = () => { if (closed || incomplete) throw fail("Historical tool migration is closed or incomplete."); };
  clock.runPinned({ at: seedAt, seed: `seed:${seedAt}` }, () => {
    try {
      // Eager loading preserves the original startup RNG order even when only one
      // tool has journal entries. Each graph owns its own module closures.
      const graphs = [...APPS, ...STAFF_APPS].map(appKey => { const graph = privateGraph(appKey, historical, config, util); const app = graph.load(`apps/${appKey}.js`); return { appKey, graph, app }; });
      historical.registerModules(graphs.map(({ appKey, app }) => ({ key: appKey, scopes: app.scopes, grants: app.grants })));
      for (const { appKey, graph, app } of graphs) {
        const ctx = { ...makeCtx(appKey, historical, util), identity: historical, realm, committedReplay: true, io: null }, router = express();
        router.disable("x-powered-by"); router.set("etag", false);
        let state, hooks;
        if (appKey === "hr" || appKey === "sales" || appKey === "marketing") state = app.createState(ctx);
        hooks = app.routes(router, ctx, state);
        tools.set(appKey, { graph, state, hooks, router });
      }
    } catch (error) { for (const value of tools.values()) value.graph.close(); throw error; }
  });
  const snapshot = appKey => {
    const { graph, state, hooks } = tools.get(appKey);
    const envelope = { version: 1, realm, workspaceId: "ws_orgtik", appKey, fixtureId: "orgtik-v1" };
    if (appKey === "tasks" || appKey === "files") return { ...envelope, schema: `orgtik.tool.${appKey}`, ...hooks.exportState() };
    if (appKey === "hr") return { ...envelope, schema: "orgtik.workspace.hr", ...graph.load("apps/hr/seed.js").exportDb(state.db) };
    if (appKey === "sales") return { ...envelope, schema: "orgtik.workspace.sales", data: clone({ db: state.db, profilePrefs: state.profilePrefs }), sequences: clone(state.db.counters) };
    return { ...envelope, schema: "orgtik.workspace.marketing", data: clone(state.db), sequences: { nextGalleryId: state.db.nextGalleryId } };
  };
  return {
    async replayAccepted(entry) {
      return lock(async () => {
        ensure(); if (committed) throw fail("An old tool writer followed the workspace checkpoint; reconcile it before continuing.");
        const value = tools.get(entry?.app);
        if (!value) throw fail("This historical app cannot be migrated as a customer tool.");
        try {
          const publicPath = new URL(entry.url, "http://private-replay.invalid").pathname;
          const allowAnonymous = entry.method === "POST" && (entry.app === "wm" && ["/v2/public/leads", "/v2/public/ideas", "/v2/__mock/forms-live", "/v2/__mock/without-suggestions"].includes(publicPath) || entry.app === "sales" && publicPath === "/api/leads/intake");
          const response = await historical.runAccepted(entry, () => clock.runPinned({ at: entry.at, seed: entry.seed }, () => invoke(value.router, entry, historical)), { allowAnonymous });
          if (response.statusCode >= 400) throw fail(`The reducer refused a committed ${entry.app} command (${response.statusCode}, ${response.body?.error?.code || response.body?.code || "refused"}).`);
          return response;
        } catch (error) { incomplete = true; throw error; }
      });
    },
    exportWorkspaceState() { ensure(); return clone({ version: 1, realm, snapshots: Object.fromEntries(APPS.map(app => [`ws_orgtik:${app}`, snapshot(app)])) }); },
    exportStaffState() {
      ensure(); const wm = tools.get("wm")?.hooks?.exportState?.();
      if (!wm || wm.schema !== "orgtik.staff.wm" || wm.realm !== realm) throw fail("The committed WM staff snapshot is unavailable.");
      return clone({ wm });
    },
    adoptWorkspaceCheckpoint() { ensure(); committed = true; },
    close() { closed = true; for (const value of tools.values()) { value.hooks?.close?.(); value.graph.close(); } tools.clear(); },
  };
}
module.exports = { createLegacyToolReplay, APPS, STAFF_APPS };
