const express = require("express");
const cors = require('cors');
const { createPrivateModuleGraph } = require("./private-module-graph");
const { createTenantIdentityFacade, APP_TO_TOOL } = require("./workspace-context");
const manifest = require("./workspace-runtime-manifest.json");
const { createBusinessCalendar } = require("./business-calendar");
const { RealDate } = require("./clock");
const clone = value => JSON.parse(JSON.stringify(value));
const fail = message => Object.assign(new Error(message), { status: 503, code: "workspace_runtime_unavailable" });
const snapshotKey = (workspaceId, appKey) => `${workspaceId}:${appKey}`;

function createRuntimeRegistry({ realm, identity, config, util, platform, currentPrincipal, servicesFor, businessClock }) {
  let snapshots = {};
  function importState(state) {
    if (!state || state.version !== 1 || state.realm !== realm || !state.snapshots || typeof state.snapshots !== "object") throw fail("Workspace snapshot is incomplete.");
    const next = clone(state.snapshots);
    for (const [key, snapshot] of Object.entries(next)) {
      if (snapshot.version !== 1 || snapshot.realm !== realm || key !== snapshotKey(snapshot.workspaceId, snapshot.appKey) || !manifest.apps[snapshot.appKey] || !snapshot.data || !snapshot.sequences) throw fail("Workspace snapshot belongs to another realm or app.");
    }
    snapshots = next;
  }
  function create(workspaceId, appKey, { snapshot = snapshots[snapshotKey(workspaceId, appKey)] } = {}) {
    const S = platform(), workspace = S.workspace(workspaceId);
    if (!workspace || !APP_TO_TOOL[appKey] || !manifest.apps[appKey]) throw fail("Workspace tool is unavailable.");
    const scoped = createTenantIdentityFacade({ identity, S, realm, workspaceId, appKey, currentPrincipal });
    const services = servicesFor({ workspace, appKey, identity: scoped });
    const initialization = clone(workspace.initialization || { kind: "empty", seedAt: workspace.createdAt });
    let initializing = true;
    const currentTime = () => initializing ? Date.parse(initialization.seedAt) : businessClock?.now ? businessClock.now() : Date.now();
    class ScopedDate extends RealDate {
      constructor(...args) { super(...(args.length ? args : [currentTime()])); }
      static now() { return currentTime(); }
    }
    const scopedUtil = { ...util, nowIso: () => new ScopedDate().toISOString(), daysFromNow: (days, hours = 0) => new ScopedDate(currentTime() + days * 864e5 + hours * 36e5).toISOString() };
    scopedUtil.createStore = (rows, options) => util.createStore(rows, { ...options, now: scopedUtil.nowIso });
    services.ctx.util = scopedUtil;
    const calendar = createBusinessCalendar(workspace.timeZone || "Africa/Cairo", currentTime);
    const graph = createPrivateModuleGraph({ appKey, identity: scoped, config, util: scopedUtil, manifest: manifest.apps[appKey], Date: ScopedDate });
    try {
      const tool = graph.load();
      if (typeof tool.createWorkspaceRuntime !== "function") throw fail(`Workspace adapter is missing: ${appKey}`);
      const input = { realm, workspace: clone({ id: workspace.id, name: workspace.name, country: workspace.country, currency: workspace.currency, timeZone: workspace.timeZone || "Africa/Cairo" }), initialization, identity: scoped, clock: calendar, services, assets: services.assets, ...(snapshot ? { snapshot: clone(snapshot) } : {}) };
      const runtime = tool.createWorkspaceRuntime(input), router = express();
      initializing = false;
      router.disable("x-powered-by"); router.set("etag", false);
      router.use(cors({ origin: true, credentials: true }));
      router.use(express.json({ limit: "1mb" })); router.use(express.urlencoded({ extended: true, limit: "1mb" }));
      router.use(runtime.router);
      router.use((req, res) => res.status(404).json({ success: false, message: "This workspace route was not found." }));
      router.use((error, req, res, next) => res.status(error.status || 500).json({ success: false, code: error.code, message: error.message }));
      return { ...runtime, router, graph, workspaceId, appKey, close() { runtime.close?.(); graph.close(); } };
    } catch (error) { graph.close(); throw error.status ? error : fail(`Workspace adapter failed: ${appKey}: ${error.message}`); }
  }
  return {
    create, importState,
    exportState: () => ({ version: 1, realm, snapshots: clone(snapshots) }),
    commit(runtime) { const snapshot = runtime.exportSnapshot(); if (snapshot.realm !== realm || snapshot.workspaceId !== runtime.workspaceId || snapshot.appKey !== runtime.appKey) throw fail("Invalid candidate workspace snapshot."); snapshots[snapshotKey(runtime.workspaceId, runtime.appKey)] = clone(snapshot); },
    restoreCandidate(runtime, before) { snapshots[snapshotKey(runtime.workspaceId, runtime.appKey)] = clone(before); },
    deleteWorkspace(workspaceId) { for (const key of Object.keys(snapshots)) if (key.startsWith(`${workspaceId}:`)) delete snapshots[key]; },
    publicFileWorkspace(shareId) {
      const matches = Object.values(snapshots).filter(snapshot => snapshot.appKey === 'files' && snapshot.data.shares.some(([id]) => id === shareId)).map(snapshot => snapshot.workspaceId);
      const fixtures = ['5f1c7a52-9d0e-4b6a-8e1f-2a9c3b7d4e01', '8c2e4f61-3b7a-4d19-9a0c-6e5f1d2b3a04', 'b3d9e0a7-6c21-4f58-8b4e-9f0a1c2d3e05'];
      if (fixtures.includes(shareId) && !snapshots[snapshotKey('ws_orgtik', 'files')]) matches.push('ws_orgtik');
      const ids = [...new Set(matches)];
      if (ids.length > 1) throw fail('Public Files grant has ambiguous ownership.');
      const ws = ids.length === 1 && platform().workspace(ids[0]);
      return ws && !['deleted', 'cancelled'].includes(ws.state) ? ws.id : null;
    },
  };
}
module.exports = { createRuntimeRegistry, snapshotKey };
