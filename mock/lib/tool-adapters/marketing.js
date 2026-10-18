const express = require("express");
const L = require("../../apps/marketing/lib");
const SCHEMA = "orgtik.workspace.marketing";
const LISTS = ["projects", "gallery", "labels", "integrations", "posts", "postComments", "campaigns", "campaignComments", "executions", "audiences", "segments", "imports", "senders", "templates", "competitors"];
const clone = value => JSON.parse(JSON.stringify(value));
const failure = message => Object.assign(new Error(message), { status: 503, code: "workspace_runtime_unavailable" });

function createWorkspaceRuntime(input, appModule) {
  const { realm, workspace, initialization, identity, clock, snapshot } = input;
  if (!realm || !workspace?.id || !identity?.workspaceMode || identity.workspaceId !== workspace.id || identity.realm !== realm || !clock || !["empty", "fixture"].includes(initialization?.kind)) throw failure("Invalid Marketing workspace input");
  if (initialization.kind === "fixture" && !((workspace.id === "ws_orgtik" && initialization.fixtureId === "orgtik-v1") || (workspace.id === "ws_nile" && initialization.fixtureId === "nile-v1"))) throw failure("Unknown Marketing workspace fixture");
  const checkSnapshot = value => {
    if (!value || value.schema !== SCHEMA || value.version !== 1 || value.realm !== realm || value.workspaceId !== workspace.id || value.appKey !== "marketing" || value.fixtureId !== initialization.fixtureId || !value.data || LISTS.some(key => !Array.isArray(value.data[key])) || !value.data.activeProject || !value.data.oauthStates || !value.data.tempIntegrations || !value.data.ownershipTransfers || !Number.isSafeInteger(value.sequences?.nextGalleryId) || value.sequences.nextGalleryId !== value.data.nextGalleryId || value.data.nextGalleryId <= Math.max(0, ...value.data.gallery.map(row => Number(row.id) || 0))) throw failure("Invalid Marketing snapshot");
  };
  if (snapshot) checkSnapshot(snapshot);
  const ctx = { ...input.services.ctx, realm, workspaceId: workspace.id, workspace, identity, services: input.services, io: null };
  L.configureClock(clock);
  const state = appModule.createState(ctx, { empty: initialization.kind === "empty", snapshot: snapshot?.data });
  if (!snapshot && initialization.fixtureId === "nile-v1") {
    const db = state.db, projectIds = new Set(db.projects.filter(row => row.key === "nile").map(row => row.id));
    db.projects = db.projects.filter(row => projectIds.has(row.id));
    for (const key of LISTS.filter(key => !["projects", "postComments", "campaignComments"].includes(key))) db[key] = db[key].filter(row => projectIds.has(row.projectId));
    const posts = new Set(db.posts.map(row => row.id)), campaigns = new Set(db.campaigns.map(row => row.id));
    db.postComments = db.postComments.filter(row => posts.has(row.postId));
    db.campaignComments = db.campaignComments.filter(row => campaigns.has(row.campaignId));
    const people = new Set(identity.users.map(user => user.id));
    for (const row of db.projects) {
      row.memberUserIds = row.memberUserIds.filter(id => people.has(id));
      row.createdByUserId ??= row.userId;
      row.userId = people.has(row.userId) ? row.userId : row.memberUserIds[0] ?? identity.users[0]?.id ?? null;
    }
    db.activeProject = Object.fromEntries(Object.entries(db.activeProject).filter(([id, projectId]) => people.has(Number(id)) && projectIds.has(projectId)));
    db.oauthStates = {}; db.tempIntegrations = {};
  }
  const router = express.Router(); let closed = false;
  router.use((req, res, next) => closed ? res.status(503).json({ success: false, code: "workspace_runtime_closed" }) : next());
  router.use((req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method) || req.path === "/galleries/bulk-fetch" || req.path === "/projects" || /^\/projects\/[^/]+\/switch$/.test(req.path)) return next();
    const db = state.db, match = req.path.match(/^\/(projects|publishing\/posts|campaigns|ads\/(?:campaigns|executions)|galleries|labels|integrations|audiences|messaging\/(?:sender-configs|templates))\/([^/]+)/);
    const tables = { projects: "projects", "publishing/posts": "posts", campaigns: "campaigns", "ads/campaigns": "campaigns", "ads/executions": "executions", galleries: "gallery", labels: "labels", integrations: "integrations", audiences: "audiences", "messaging/sender-configs": "senders", "messaging/templates": "templates" };
    const row = match && db[tables[match[1]]].find(item => String(item.id) === match[2]);
    const currentUser = identity.userFromReq(req);
    const activeProject = currentUser && state.helpers?.activeProject(currentUser);
    const projectId = row?.projectId || req.body?.projectId || req.query?.projectId || (req.path.endsWith("/callback") ? db.oauthStates[req.body?.state]?.projectId : null) || activeProject?.id;
    const project = projectId && db.projects.find(item => item.id === projectId);
    return row?.custodyReadOnly || project?.custodyReadOnly ? res.status(403).json({ success: false, code: "custody_read_only", message: "Archived records require ownership review before changes." }) : next();
  });
  appModule.routes(router, ctx, state);
  const open = () => { if (closed) throw failure("Marketing runtime is closed"); };
  const exportSnapshot = () => { open(); return { schema: SCHEMA, version: 1, realm, workspaceId: workspace.id, appKey: "marketing", data: clone(state.db), sequences: { nextGalleryId: state.db.nextGalleryId }, ...(initialization.fixtureId ? { fixtureId: initialization.fixtureId } : {}) }; };
  function bootstrap(context) {
    open();
    if (context.realm !== realm || context.workspace.id !== workspace.id) throw failure("Marketing bootstrap context mismatch");
    const user = identity.findUser(context.actor.effectiveUserId), access = context.tools?.marketing?.access;
    if (!user || !identity.userScopes(user).some(scope => scope.scope === "digital_marketing" && scope.roles.length) || !["free", "trial", "active", "read_only"].includes(access)) return { appKey: "marketing", workspaceId: workspace.id, state: "no_access", projects: [] };
    const projects = state.helpers.projectsFor(user), active = state.helpers.activeProject(user);
    return { appKey: "marketing", workspaceId: workspace.id, state: access === "read_only" ? "read_only" : projects.length ? "ready" : "empty", projects: projects.map(row => state.views.projectView(row, active?.id)), capabilities: { canWrite: context.tools.marketing.canWrite } };
  }
  function transferOwnership(command) {
    open();
    if (!command.operationId || !Number.isSafeInteger(command.fromUserId) || command.fromUserId < 1 || !["member", "archive"].includes(command.target?.kind)) throw failure("Invalid Marketing ownership command");
    const target = command.target.kind === "member" ? identity.findUser(command.target.userId) : null;
    if (command.target.kind === "member" && (!target || target.id === command.fromUserId)) throw failure("Marketing ownership target is not an admitted member");
    const db = state.db, fingerprint = JSON.stringify(command), previous = db.ownershipTransfers[command.operationId];
    if (previous) { if (previous.fingerprint !== fingerprint) throw failure("Marketing ownership operation changed"); return clone(previous.result); }
    const result = { transferred: [], archived: [] }, at = clock.iso(clock.nowMs?.() ?? clock.now());
    for (const key of ["projects", "gallery", "labels", "integrations", "posts", "campaigns", "executions", "audiences", "segments", "imports", "senders", "templates", "competitors"]) for (const row of db[key]) {
      const owner = Object.hasOwn(row, "ownerUserId") ? row.ownerUserId : row.userId ?? row.createdByUserId ?? row.uploadedBy;
      if (Number(owner) !== command.fromUserId) continue;
      // Legacy userId is author attribution except on projects; keep history immutable.
      row.ownerUserId = target?.id ?? null;
      if (key === "projects") { row.createdByUserId ??= row.userId; row.userId = target?.id ?? null; }
      if (!target) { row.ownershipArchivedAt = at; row.custodyReadOnly = true; }
      (target ? result.transferred : result.archived).push(`${key}:${row.id}`);
    }
    const extension = db.marketingV3;
    for (const [key, list] of Object.entries({ socialThreads: extension.socialThreads, journeys: extension.journeys, drafts: extension.drafts, testSends: extension.testSends, brandKits: Object.values(extension.brandKits), emailDesigns: Object.values(extension.emailDesigns), domains: Object.values(extension.domains) })) for (const row of list) {
      const owner = Object.hasOwn(row, "ownerUserId") ? row.ownerUserId : row.createdBy ?? row.recordedBy ?? row.by;
      if (Number(owner) !== command.fromUserId) continue;
      row.ownerUserId = target?.id ?? null;
      if (!target) { row.ownershipArchivedAt = at; row.custodyReadOnly = true; }
      (target ? result.transferred : result.archived).push(`marketingV3.${key}:${row.id || row.senderId || row.projectId || "settings"}`);
    }
    for (const project of db.projects) if (project.memberUserIds.includes(command.fromUserId)) project.memberUserIds = [...new Set(project.memberUserIds.filter(id => id !== command.fromUserId).concat(target ? [target.id] : []))];
    delete db.activeProject[command.fromUserId];
    db.ownershipTransfers[command.operationId] = { fingerprint, result: clone(result) };
    return result;
  }
  function applyCommitted(command) {
    open(); if (!command.snapshot) throw failure("Marketing replay requires committed snapshot effects");
    checkSnapshot(command.snapshot); state.db = clone(command.snapshot.data);
  }
  function suiteFeed(context) {
    const base = bootstrap(context);
    if (base.state === "no_access") return base;
    const visible = new Set(base.projects.map(row => row.id)), db = state.db;
    const campaigns = db.campaigns.filter(row => visible.has(row.projectId)).map(row => ({ id: row.id, title: row.name, projectId: row.projectId, status: row.status, at: row.updatedAt, path: `/campaigns/${encodeURIComponent(row.id)}?projectId=${encodeURIComponent(row.projectId)}` }));
    const posts = db.posts.filter(row => visible.has(row.projectId)).map(row => ({ id: row.id, title: row.title, projectId: row.projectId, status: row.status, at: row.updatedAt, path: `/posts/${encodeURIComponent(row.id)}?projectId=${encodeURIComponent(row.projectId)}` }));
    const journeys = db.marketingV3.journeys.filter(row => visible.has(row.projectId)).map(row => ({ id: row.id, title: row.name, projectId: row.projectId, status: row.state, at: row.updatedAt, path: `/journeys?journey=${encodeURIComponent(row.id)}&projectId=${encodeURIComponent(row.projectId)}` }));
    return { ...base, campaigns, posts, journeys, activities: [...campaigns, ...posts, ...journeys].map(row => ({ id: row.id, title: row.title, at: row.at, action: row.status, path: row.path })), notifications: [] };
  }
  return { journeyTaskCandidate: (...args) => state.v3.journeyTaskCandidate(...args), campaignCandidate: (...args) => state.v3.campaignCandidate(...args), recordAttribution: (...args) => state.v3.recordAttribution(...args), recordDelivery: (...args) => state.v3.recordDelivery(...args), router, exportSnapshot, bootstrap, suiteFeed, transferOwnership, applyCommitted, usage: () => { open(); return [{ key: "brands", used: state.db.projects.length }, { key: "posts", used: state.db.posts.length }, { key: "campaigns", used: state.db.campaigns.length }]; }, transitionCalendar() { open(); state.transitionCalendar(); }, close() { closed = true; } };
}
module.exports = { createWorkspaceRuntime, SCHEMA, LISTS };
