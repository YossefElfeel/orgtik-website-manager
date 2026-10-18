const crypto = require("node:crypto");
const path = require("node:path");
const express = require("express");
const cors = require('cors');
const { AsyncLocalStorage } = require("node:async_hooks");
const { createSessionAuthority } = require("./session-authority");
const sessionStorage = require("./session-store");
const { createContextService } = require("./session-context");
const { createRuntimeRegistry } = require("./workspace-runtime");
const { initializeWorkspaceAuthority, assignInitialOwnerSeats, APP_TO_TOOL } = require("./workspace-context");
const authStorage = require("./auth-store");
const { encodeDomainCheckpoint } = require("./domain-checkpoint");
const clock = require("./clock");
const people = require("./workspace-people");
const journeys = require('./workspace-people-journeys');
const { createTaskSampleRouter, isTaskSampleRequest } = require('./task-sample-assets');
const { makeWorkspaceOperation } = require("./workspace-command");
const { seatCounts, TOOL_DEFINITIONS } = require("./workspace-context");
const clone = value => JSON.parse(JSON.stringify(value));
const failure = (status, code, message) => Object.assign(new Error(message), { status, code });

function createWorkspaceBoundary({ realm, config, store, accountStore, platform, identity: identityFor, dispatch, persist, util, makeCtx, staffAvailable = () => true }) {
  const requests = new AsyncLocalStorage(), privateFrames = new Map();
  let initialized = false;
  const contextService = (snapshot, grants) => createContextService({ realm, identity: grants ? { ...identityFor(), grants } : identityFor(), platform: () => snapshot ? { db: snapshot.db, workspace: id => snapshot.db.workspaces.find(row => row.id === id), now: () => clock.now() } : platform().getStore() });
  const sessionStore = sessionStorage.pickStore(config, { realm });
  const authority = createSessionAuthority({
    realm, store: sessionStore,
    loadUser: async id => { const accounts = await accountStore.accounts(), raw = accounts.get(String(id)); return raw ? JSON.parse(raw).user : identityFor().findUser(id); },
    resolveWorkspace: (user, options) => contextService(options.revalidate ? options.frame?.authorizationSnapshot : undefined, options.revalidate ? options.frame?.authorizationGrants : undefined).resolveWorkspace(user, options),
    contextFor: (user, options) => {
      const exiting = options.principal?.readOnly && String(user.id) === String(options.principal.actor.id) && /^\/api\/auth\/exit-impersonation(?:$|\?)/.test(options.request?.path || options.request?.url || '');
      if (exiting) return contextService().contextFor(user, { ...options, extra: { ...options.extra, exitImpersonation: true } });
      if (options.extra?.mode === 'identity' && options.extra.workspaceId === null && options.extra.audience === 'identity' && !options.principal?.readOnly) return { mode: 'identity', audience: 'identity', workspaceId: null, workspaceContext: null, scopes: [], staffAccess: null };
      return contextService().contextFor(user, options);
    },
  });
  function currentPrincipal(req) {
    const principal = req ? authority.verifiedFromReq(req) : requests.getStore()?.frame.principal;
    return principal ? { ...principal, workspaceContext: principal.context.workspaceContext } : null;
  }
  function staffPreferences(patch) {
    const p = currentPrincipal(), S = platform().getStore(), person = p && identityFor().findUser(p.user.id);
    if (!person || p.claims.mode !== 'staff' || p.claims.aud !== 'staff:wm' || !p.context.staffAccess?.permissions.wm?.includes('content:view')) throw failure(403, 'wm_staff_required', 'Current Website Manager access is required.');
    const helpers = require('./workspace-suite');
    if (patch !== undefined) { if (p.readOnly) throw failure(423, 'view_as_read_only', 'View-as cannot save appearance choices.'); return helpers.savePreferences(person, patch); }
    return { person: { id: person.id, name: identityFor().fullName(person), email: person.email }, preferences: helpers.preferences(person), now: S.iso(S.now()), scope: 'staff:wm' };
  }
  function catalogMirror({ country = 'CH' } = {}) {
    const p = currentPrincipal(), S = platform().getStore(), identity = identityFor(), person = p && identity.findUser(p.user.id);
    if (!person || p.claims.mode !== 'staff' || p.claims.aud !== 'staff:wm' || !p.context.staffAccess?.permissions.wm?.includes('content:view')) throw failure(403, 'wm_staff_required', 'Current Website Manager access is required.');
    if (!Object.hasOwn(S.db.countries, country)) throw failure(422, 'catalog_country_required', 'Choose a configured catalog country.');
    const currency = S.db.countries[country].currency, resolved = { workspace: { country, currency, billing: { country }, members: [], lines: [] }, buyerKey: null, region: { country, currency, source: 'mock-override' } };
    const catalog = require('../apps/admin/website-offers').publicCatalog(S, resolved), rights = p.context.staffAccess.permissions.admin || [], internal = S.workspace('ws_orgtik');
    let crmContext = null;
    try { if (internal?.kind === 'orgtik_internal' && !['deleted', 'cancelled'].includes(internal.state)) crmContext = require('./workspace-context').resolveWorkspaceContext(S, identity, person, { realm, workspaceId: internal.id, actorUserId: p.actor.id, audience: 'sales' }); } catch (error) { if (![403, 404].includes(error.status)) throw error; }
    const canCRM = Boolean(rights.includes('services:view') && require('./connectors').admitted(crmContext?.tools.crm)), canConsole = rights.includes('tools:view');
    return { readOnly: true, country, countries: Object.keys(S.db.countries), region: catalog.region, currency, decimals: catalog.decimals, priceVersion: S.db.priceVersion, policy: catalog.policy, bundles: catalog.bundles, items: S.db.websiteOffers.map(offer => {
      const published = catalog.items.find(row => row.id === offer.id), service = offer.kind === 'service', path = service ? `/catalog/services/${encodeURIComponent(offer.serviceId)}` : `/catalog/software?offer=${encodeURIComponent(offer.id)}`, canOpen = service ? canCRM : canConsole;
      const query = new URLSearchParams({ ...(service && internal ? { workspaceId: internal.id } : {}), redirect: path });
      return { id: offer.id, catalogId: offer.id, kind: offer.kind, name: published?.names || offer.name, serviceId: offer.serviceId || null, planId: offer.planId || offer.serviceId, toolId: offer.tool || null, managedIn: service ? 'crm' : 'console', scope: service ? 'sales' : 'platform_admin', path, workspaceId: service ? internal?.id || null : null, status: offer.tool ? S.db.tools.find(tool => tool.key === offer.tool)?.status : S.db.services.find(row => row.id === offer.serviceId)?.status, available: Boolean(published), publishedAt: offer.publishedAt || null, monthlyMinor: published?.monthlyMinor ?? null, prices: published?.prices || null, currency, decimals: catalog.decimals, launch: { canOpen, reason: canOpen ? null : service ? 'crm_service_access_required' : 'console_catalog_access_required', url: canOpen ? `${config.webUrl('sos')}/go/${service ? 'sales' : 'platform_admin'}?${query}` : null } };
    }) };
  }
  function crmLeadTarget({ leadId } = {}) {
    const request = requests.getStore(), p = currentPrincipal(), S = platform().getStore(), identity = identityFor(), person = p && identity.findUser(p.user.id), workspace = S.workspace('ws_orgtik');
    if (!request || !person || p.claims.mode !== 'staff' || p.claims.aud !== 'staff:wm' || !p.context.staffAccess?.permissions.wm?.includes('content:view') || typeof leadId !== 'string' || !/^[\w-]{1,160}$/.test(leadId)) throw failure(403, 'wm_lead_context_required', 'Choose an actual Website Manager lead reference.');
    const path = `/customers/${encodeURIComponent(leadId)}`, base = { workspaceId: workspace?.id || null, leadId, scope: 'sales', path, canOpen: false, reason: 'crm_read_access_required', url: null };
    if (!workspace || workspace.kind !== 'orgtik_internal' || ['deleted', 'cancelled'].includes(workspace.state)) return { ...base, reason: 'orgtik_crm_unavailable' };
    let context;
    try { context = require('./workspace-context').resolveWorkspaceContext(S, identity, person, { realm, workspaceId: workspace.id, actorUserId: p.actor.id, audience: 'sales' }); } catch (error) { if ([403, 404].includes(error.status)) return base; throw error; }
    if (!require('./connectors').admitted(context.tools.crm)) return base;
    let runtime = request.suiteReadRuntimes.get('sales'); if (!runtime) { runtime = registry.create(workspace.id, 'sales'); request.suiteReadRuntimes.set('sales', runtime); }
    if (!runtime.suiteFeed(context).contacts.some(row => row.id === leadId)) return { ...base, reason: 'crm_record_unavailable' };
    const query = new URLSearchParams({ workspaceId: workspace.id, redirect: path });
    return { ...base, canOpen: true, reason: null, url: `${config.webUrl('sos')}/go/sales?${query}` };
  }
  function internalCrmRuntime(request) {
    const S = platform().getStore(), workspace = S.workspace('ws_orgtik');
    if (!request || workspace?.kind !== 'orgtik_internal' || ['suspended', 'deleted', 'cancelled'].includes(workspace.state)) throw failure(503, 'orgtik_crm_unavailable', 'The OrgTik CRM is unavailable.');
    const owner = workspace.members.find(member => member.status === 'active' && member.toolGrants?.crm?.assigned && member.toolGrants.crm.roles?.some(role => ['admin', 'manager'].includes(role))), actor = owner && identityFor().findByKey(owner.userKey);
    if (!actor) throw failure(503, 'orgtik_crm_unavailable', 'The OrgTik CRM has no admitted intake owner.');
    const context = require('./workspace-context').resolveWorkspaceContext(S, identityFor(), actor, { realm, workspaceId: workspace.id });
    if (!context.tools.crm.canWrite) throw failure(503, 'orgtik_crm_read_only', 'The OrgTik CRM is read-only.');
    const key = 'internal:sales';
    if (!request.relatedRuntimes.has(key)) request.relatedRuntimes.set(key, registry.create(workspace.id, 'sales'));
    return request.relatedRuntimes.get(key);
  }
  function deliverWebsiteLead(payload, metadata) {
    const request = requests.getStore();
    if (!request || request.key !== 'wm' || request.req.method !== 'POST' || !/^\/v2\/public\/leads(?:$|\?)/.test(request.req.url) || typeof metadata?.wmLeadId !== 'string' || metadata.wmLeadId.length > 200) throw failure(403, 'website_intake_forbidden', 'Only the validated website lead flow can deliver this record.');
    try {
      const result = internalCrmRuntime(request).receiveWebsiteIntake(payload, { sourceKey: `wm:${metadata.wmLeadId}` });
      return { state: 'sent', ...result, managedIn: 'crm', at: new Date(clock.now()).toISOString() };
    } catch (error) {
      if (['orgtik_crm_unavailable', 'orgtik_crm_read_only'].includes(error.code)) return { state: 'deferred', code: 'crm_intake_pending', reason: error.code, managedIn: 'crm', at: new Date(clock.now()).toISOString() };
      throw error;
    }
  }
  function deliverPaidServices(request) {
    const S = platform().getStore();
    for (const service of S.db.serviceRequests.filter(row => row.source?.kind === 'website_order' && !row.crmProjectId)) {
      const stored = S.db.publicWebsiteOrders.find(row => row.snapshot?.reference === service.source.reference);
      if (stored?.snapshot?.paymentStatus !== 'succeeded' || !S.db.websiteOrderLinks.some(row => row.reference === service.source.reference && row.workspaceId === service.workspaceId)) continue;
      const order = stored.snapshot, workspace = S.workspace(service.workspaceId), owner = workspace?.members.find(row => row.role === 'owner' && row.status === 'active'), person = owner && identityFor().findByKey(owner.userKey);
      if (!person || !stored.billing?.email) continue;
      try {
        const line = order.groups.flatMap(group => group.lines).find(row => row.catalogId === service.catalogId && row.fulfillment !== 'tool');
        if (!line) continue;
        const result = internalCrmRuntime(request).receiveWebsiteIntake({ source: 'website_order', name: stored.billing.name || identityFor().fullName(person), email: stored.billing.email, company: workspace.name, message: service.brief, locale: person.profile?.language || 'en' }, { sourceKey: `website-order:${order.reference}:${service.id}`, serviceRequestId: service.id, reference: order.reference, title: `${service.title} · ${order.reference}`, paidSnapshot: { currency: order.currency, decimals: order.decimals, paidAt: order.createdAt, line: clone(line), policy: clone(order.policy) } });
        service.crmLeadId = result.leadId; service.crmProjectId = result.projectId; service.crmDelivery = { state: 'sent' };
      } catch (error) { service.crmDelivery = { state: 'deferred', code: error.code || 'crm_intake_unavailable' }; }
    }
  }
  const registry = createRuntimeRegistry({
    realm, identity: new Proxy({}, { get: (_target, name) => identityFor()[name] }), config, util,
    platform: () => platform().getStore(), currentPrincipal, businessClock: clock,
    servicesFor({ workspace, appKey, identity }) {
      if (!/^[\w-]{1,200}$/.test(workspace.id)) throw failure(503, "invalid_workspace_id", "Workspace storage is unavailable.");
      const ctx = { ...makeCtx(appKey, identity, util), realm, workspaceId: workspace.id, currentContext: () => currentPrincipal()?.workspaceContext, uploadsDir: path.join(config.dataDir, "uploads", "workspaces", workspace.id, appKey), io: null, boardAuthority: { authorize: authorizeBoardFile, custodyTarget: args => boardCustodyTarget(workspace.id, args) }, sharedFiles: { resolve: resolveSharedFile, project: projectSharedFile, ...Object.fromEntries(['authorizeWhiteboard', 'createWhiteboard', 'saveWhiteboard', 'resolveWhiteboard'].map(method => [method, args => invokeBoardFile(method, args)])) } };
      const upload = () => (req, res, next) => /multipart\/form-data|application\/octet-stream/i.test(req.headers["content-type"] || "") ? res.status(501).json({ success: false, code: "packaged_assets_only", message: "Choose a packaged sample asset." }) : next();
      ctx.filesPolicy = () => require('./workspace-files-policy').filesPolicy(platform().getStore(), workspace.id, currentPrincipal()?.workspaceContext);
      ctx.connectedTasks = { references: args => connectedTaskReferences(appKey, args) };
      ctx.crmDirectory = { current: args => currentCrmDirectory(appKey, args), resolve: args => currentCrmDirectory(appKey, args, true) };
      ctx.upload = Object.fromEntries(["single", "array", "any", "fields", "none"].map(name => [name, upload]));
      return {
        ctx, assets: { kind: "packaged", workspaceId: workspace.id },
        verifyActorPassword: password => { const principal = currentPrincipal(); return principal && authStorage.passwordMatches(principal.user, password); },
        commands: { execute: (...args) => executeCommand(...args) }, lifecycle: { execute: (...args) => executeCommand(...args) },
      };
    },
  });
  function filesRuntime() {
    const request = requests.getStore(), principal = request?.frame.principal, context = principal?.context.workspaceContext;
    const access = context?.tools.files;
    if (!context || !access || ['no_access', 'not_subscribed'].includes(access.access) || !access.roles?.length) throw failure(403, 'files_access_denied', 'Ask your workspace owner for Files access.');
    if (request.runtime?.appKey === 'files') return request.runtime;
    if (!request.relatedRuntimes.has('files')) request.relatedRuntimes.set('files', registry.create(context.workspace.id, 'files'));
    return request.relatedRuntimes.get('files');
  }
  function connectedTaskReferences(appKey, { source, sourceId, ids } = {}) {
    const request = requests.getStore(), p = request?.frame.principal, initial = p?.context.workspaceContext;
    if (!initial || source !== APP_TO_TOOL[appKey] || !['chat', 'crm', 'hr', 'marketing'].includes(source) || !['string', 'number'].includes(typeof sourceId) || !String(sourceId) || String(sourceId).length > 160 || !Array.isArray(ids) || ids.length > 50 || ids.some(id => !Number.isSafeInteger(id) || id < 1)) throw failure(422, 'invalid_task_references', 'Choose current source-owned task references.');
    const S = platform().getStore(), person = identityFor().findUser(p.user.id), context = require('./workspace-context').resolveWorkspaceContext(S, identityFor(), person, { realm, workspaceId: initial.workspace.id, actorUserId: p.actor.id, readOnly: p.readOnly, audience: p.claims.aud });
    const connections = require('./connectors'), connection = connections.list(S.workspace(initial.workspace.id), context).find(row => row.source === source && row.target === 'tasks');
    if (!connection?.enabled || !connections.admitted(context.tools[source]) || !connections.admitted(context.tools.tasks)) throw failure(403, 'connection_access_required', 'Current source and Tasks access are required.');
    let runtime = request.runtime?.appKey === 'tasks' ? request.runtime : request.relatedRuntimes.get('tasks') || request.suiteReadRuntimes.get('tasks');
    if (!runtime) { runtime = registry.create(initial.workspace.id, 'tasks'); request.suiteReadRuntimes.set('tasks', runtime); }
    // The owning tool has already checked its source record ACL. Only actual
    // visible Tasks records pinned to that exact source can be projected here.
    return runtime.suiteFeed(context).tasks.filter(task => ids.includes(task.id) && task.source?.app === source && String(task.source.id) === String(sourceId)).map(task => ({ id: task.id, title: task.title, status: task.status, path: `/projects/${task.projectId}/lists?task-id=${task.id}` }));
  }
  function currentCrmDirectory(appKey, args = {}, selected = false) {
    const request = requests.getStore(), p = request?.frame.principal, initial = p?.context.workspaceContext;
    if (appKey !== 'marketing' || !initial) throw failure(403, 'marketing_context_required', 'Current Marketing workspace access is required.');
    const S = platform().getStore(), person = identityFor().findUser(p.user.id), context = require('./workspace-context').resolveWorkspaceContext(S, identityFor(), person, { realm, workspaceId: initial.workspace.id, actorUserId: p.actor.id, readOnly: p.readOnly, audience: p.claims.aud });
    require('./connectors').requireConnection(S.workspace(initial.workspace.id), context, 'marketing', 'crm');
    const query = String(args.search || '').trim().toLocaleLowerCase(), ids = args.contactIds;
    const validId = id => typeof id === 'string' ? require('./workspace-file-references').identifier(id) : Number.isSafeInteger(id) && id > 0;
    if (query.length > 200 || selected && (!Array.isArray(ids) || ids.length > 200 || ids.some(id => !validId(id)))) throw failure(422, 'invalid_directory_selection', 'Select up to two hundred current CRM contacts.');
    let runtime = request.runtime?.appKey === 'sales' ? request.runtime : request.relatedRuntimes.get('sales') || request.suiteReadRuntimes.get('sales');
    if (!runtime) { runtime = registry.create(initial.workspace.id, 'sales'); request.suiteReadRuntimes.set('sales', runtime); }
    const data = runtime.suiteFeed(context);
    if (selected && ids.some(id => !data.contacts.some(row => row.id === id))) throw failure(403, 'recipient_unavailable', 'A selected CRM contact is no longer visible. Review the audience.');
    const contacts = data.contacts.filter(row => selected ? ids.includes(row.id) : !query || `${row.fullName} ${row.email} ${row.companyName}`.toLocaleLowerCase().includes(query)).slice(0, 200);
    return { workspaceId: initial.workspace.id, managedIn: 'crm', contacts: contacts.map(row => ({ workspaceId: initial.workspace.id, id: row.id, name: row.fullName, email: row.email, companyId: row.companyId, currency: row.currency, tags: row.tags, consent: row.marketingConsent, attribution: row.attribution })), companies: data.companies };
  }
  function resolveSharedFile(value) {
    const principal = requests.getStore()?.frame.principal, workspaceId = principal?.context.workspaceContext?.workspace.id;
    const ref = require('./workspace-file-references').reference(value, workspaceId);
    const runtime = filesRuntime();
    if (!runtime.resolveSharedFile) throw failure(503, 'files_runtime_unavailable', 'Files could not be loaded. Try again.');
    return runtime.resolveSharedFile({ actorId: principal.user.id, fileId: ref.fileId, versionId: ref.versionId });
  }
  function invokeBoardFile(method, args) {
    const principal = requests.getStore()?.frame.principal;
    if (!principal || args.actorId !== principal.user.id) throw failure(403, 'whiteboard_forbidden', 'This whiteboard action is not authorized.');
    const runtime = filesRuntime();
    if (typeof runtime[method] !== 'function') throw failure(503, 'whiteboard_storage_unavailable', 'Whiteboards could not be loaded. Try again.');
    return runtime[method](args);
  }
  function authorizeBoardFile({ actorId, boardId, fileId, write = false }) {
    const request = requests.getStore(), principal = request?.frame.principal, context = principal?.context.workspaceContext, access = context?.tools.chat;
    if (!context || principal.user.id !== actorId || !access || ['no_access', 'not_subscribed'].includes(access.access) || !access.roles?.some(role => ['owner', 'admin', 'member'].includes(role))) throw failure(403, 'whiteboard_access_required', 'An assigned Chats member is required for this whiteboard.');
    let runtime = request.runtime?.appKey === 'chats' ? request.runtime : request.relatedRuntimes.get('chats');
    if (!runtime) { runtime = registry.create(context.workspace.id, 'chats'); request.relatedRuntimes.set('chats', runtime); }
    if (typeof runtime.authorizeWhiteboardTarget !== 'function') throw failure(503, 'whiteboard_storage_unavailable', 'Whiteboards could not be loaded. Try again.');
    return runtime.authorizeWhiteboardTarget({ actorId, boardId, fileId, write });
  }
  function boardCustodyTarget(workspaceId, args) {
    const runtime = registry.create(workspaceId, 'chats');
    try {
      if (typeof runtime.isWhiteboardCustodyTarget !== 'function') throw failure(503, 'whiteboard_storage_unavailable', 'Whiteboard custody could not be validated.');
      return runtime.isWhiteboardCustodyTarget(args);
    } finally { runtime.close(); }
  }
  function projectSharedFile(value) {
    try { return { state: 'available', file: resolveSharedFile(value) }; }
    catch (error) {
      if ([403, 404].includes(error.status) || error.status === 410 && error.code === 'file_content_unavailable') return { state: 'unavailable' };
      throw error;
    }
  }
  function fileReferenceRoutes(toolApp, frame, runtime) {
    const app = express(); app.use(cors({ origin: true, credentials: true }));
    app.get('/api/shared/files', (req, res, next) => {
      try {
        const principal = frame.principal;
        runtime.authorizeSharedTarget({ actorId: principal.user.id, type: req.query.resourceType, id: req.query.resourceId });
        const data = filesRuntime().listSharedFiles({ actorId: principal.user.id, search: req.query.search, page: req.query.page, limit: req.query.limit });
        res.set('Cache-Control', 'private, no-store').json({ success: true, data });
      } catch (error) { next(error); }
    });
    app.get('/api/shared/files/:fileId/versions/:versionId/content', (req, res, next) => {
      try {
        const principal = frame.principal, value = { workspaceId: principal.context.workspaceContext.workspace.id, fileId: req.params.fileId, versionId: req.params.versionId };
        runtime.authorizeSharedTarget({ actorId: principal.user.id, type: req.query.resourceType, id: req.query.resourceId, referenceId: req.query.referenceId, reference: value });
        resolveSharedFile(value);
        const content = filesRuntime().contentSharedFile({ actorId: principal.user.id, fileId: value.fileId, versionId: value.versionId });
        // attachment(filename) infers a MIME from the editable name; the pinned bytes
        // remain the authority even when a PDF is renamed with another extension.
        res.set('Cache-Control', 'private, no-store').set('X-Content-Type-Options', 'nosniff');
        if (content.bytes) res.attachment(content.name).type(content.mimetype).send(content.bytes);
        else res.attachment(content.name).type(content.mimetype).sendFile(content.path, error => { if (error) next(error); });
      } catch (error) { next(error); }
    });
    app.use(toolApp);
    app.use((error, req, res, next) => res.status(error.status || 503).json({ success: false, code: error.code || 'files_unavailable', message: error.status ? error.message : 'Files could not be loaded. Try again.' }));
    return app;
  }
  function executeCommand(kind, payload, metadata = {}) {
    const request = requests.getStore(), principal = request?.frame.principal, runtime = request?.runtime;
    if (!principal?.context.workspaceContext || !runtime || metadata.workspaceId !== runtime.workspaceId || (metadata.actor?.effectiveUserId ?? metadata.actor?.userId) !== principal.user.id) throw failure(403, "workspace_command_forbidden", "This workspace action is not authorized.");
    const S = platform().getStore(), workspace = S.workspace(runtime.workspaceId), tool = APP_TO_TOOL[runtime.appKey], access = principal.context.workspaceContext.tools[tool];
    const readOptions = kind === 'hr.offboarding.options';
    if (!readOptions && (principal.readOnly || access?.access === "read_only")) throw failure(423, "workspace_read_only", "This workspace is read-only.");
    if (!readOptions && !access?.canWrite) throw failure(403, 'tool_permission_required', 'Your tool role cannot perform this action.');
    const args = { S, identity: identityFor(), workspace, actor: principal.user, runtime, payload, transferOwned: row => transferOwned(workspace, row, runtime) };
    const hr = require("./workspace-hr");
    const shared = ["profile.self_update", "workspace.tool.roles", "workspace.member.remove"].includes(kind);
    const leaveAction = { 'hr.leave.create': 'create', 'hr.leave.approve': 'decision', 'hr.leave.cancel': 'cancel' }[kind];
    const allowed = shared || tool === "hr" && (leaveAction ? leaveAction !== 'decision' || access.roles.some(role => ["super_admin", "hr", "manager"].includes(role)) : ["hr.hire", "hr.offboard", "hr.offboarding.options", "hr.offboarding.action"].includes(kind) && access.roles.some(role => ["super_admin", "hr"].includes(role)));
    if (tool === 'hr' && leaveAction && !allowed) throw failure(403, 'leave_forbidden', 'Only HR or the current reporting manager may decide this request.');
    if (allowed) {
      if (shared) require('./workspace-commands').authorize({ ...args, principal, tool, kind });
      if (kind === 'hr.hire') hr.validateHirePayload(payload);
      if (kind === 'hr.offboard' && runtime.exportSnapshot().data.employees.some(employee => employee.id === Number(payload.employeeId) && employee.authUserId === principal.user.id)) throw failure(400, 'self_offboarding_forbidden', 'Ask another HR administrator to schedule your offboarding.');
      if (kind === 'hr.offboarding.options') {
        const result = hr.offboardingOptions(args), readOnly = principal.readOnly || access.access === 'read_only';
        return { ...result, readOnly, canOffboard: result.canOffboard && !readOnly, canTrackActions: !readOnly };
      }
      const id = metadata.operationId;
      if (leaveAction && !/^[\w.:-]{1,200}$/.test(id || '')) throw failure(422, 'operation_id_required', 'Supply the original leave action reference.');
      if (id && !/^[\w.:-]{1,200}$/.test(id)) throw failure(422, "invalid_operation_id", "Use a valid action reference.");
      if (leaveAction) runtime.authorizeLeave(leaveAction, payload, principal.user.id);
      const operation = id && makeWorkspaceOperation({ id, workspaceId: workspace.id, actor: { userId: principal.user.id, ...(principal.readOnly ? { impersonatedBy: principal.actor.id } : {}) }, method: "POST", path: `/commands/${kind}`, body: payload });
      workspace.commandOperations ??= {};
      const key = id && `${principal.user.id}:${kind}:${id}`, prior = key && workspace.commandOperations[key];
      if (prior) {
        if (prior.fingerprint !== operation.fingerprint) throw failure(409, "operation_conflict", "This action reference was already used differently.");
        return clone(prior.result);
      }
      const result = shared ? require('./workspace-commands').execute({ ...args, principal, tool, kind }) : leaveAction ? hr.leaveCommand(args, leaveAction) : kind === "hr.hire" ? hr.hire(args) : kind === "hr.offboard" ? hr.offboard(args) : hr.offboardingAction(args);
      if (key) workspace.commandOperations[key] = { fingerprint: operation.fingerprint, result: clone(result) };
      return result;
    }
    throw failure(501, "workspace_command_required", "This workspace action is not available yet.");
  }
  function transferOwned(workspace, row, currentRuntime) {
    const identity = identityFor();
    const target = workspace.members.find(member => member.id === row.transfer.ownerMemberId && member.status === 'active');
    const targetPerson = target && identity.findByKey(target.userKey), result = {};
    for (const appKey of Object.keys(APP_TO_TOOL)) {
      const runtime = currentRuntime?.appKey === appKey ? currentRuntime : registry.create(workspace.id, appKey);
      try {
        if (runtime.transferOwnership) {
          const grant = target?.toolGrants?.[APP_TO_TOOL[appKey]];
          result[appKey] = runtime.transferOwnership({ operationId: `offboard:${row.id}:${appKey}`, fromUserId: row.userId, target: targetPerson && require('./workspace-custody').eligible(target, APP_TO_TOOL[appKey], identity) ? { kind: 'member', userId: targetPerson.id } : { kind: 'archive' } });
          if (runtime !== currentRuntime) registry.commit(runtime);
        }
      } finally { if (runtime !== currentRuntime) runtime.close(); }
    }
    return result;
  }
  async function commitSystemPhase(job, at, execute) {
    const identity = identityFor(), before = platform().exportState(), runtimesBefore = registry.exportState(), staffBefore = exportStaffState(), accountsBefore = authStorage.snapshot(identity);
    let commitAttempted = false;
    try {
      await clock.runPinned({ at, seed: `system:${realm}:${persist.epoch}:${persist.applied}:${job}` }, execute);
      const after = platform().exportState(), workspaceState = registry.exportState(), staffState = exportStaffState();
      const changes = [...authStorage.snapshot(identity)].filter(([id, value]) => accountsBefore.get(id) !== value).map(([id, value]) => ({ id, value, expected: accountsBefore.get(id) ?? null }));
      if (JSON.stringify(after) === JSON.stringify(before) && JSON.stringify(workspaceState) === JSON.stringify(runtimesBefore) && JSON.stringify(staffState) === JSON.stringify(staffBefore) && !changes.length) return false;
      const entry = { epoch: persist.epoch, kind: 'workspace-v1', app: 'admin', method: 'SYSTEM', url: `/__system/${job}`, headers: {}, body: null, actor: { kind: 'system' }, at, checkpoint: encodeDomainCheckpoint({ platformState: after, workspaceState, staffState }) };
      const identityEffect = { changes, ...(store.kind === 'redis' ? { accountsKey: `orgtik:identity:${realm}:accounts`, emailsKey: `orgtik:identity:${realm}:emails` } : {}) };
      commitAttempted = true;
      const committed = await store.commit(entry, { expectedEpoch: persist.epoch, expectedRevision: persist.applied, identity: identityEffect });
      persist.applied = committed.sequence; persist.modern = true; persist.workspaceModern = true;
      return true;
    } catch (error) {
      identity.hydrate(accountsBefore, { replace: true }); platform().importState(before); registry.importState(runtimesBefore); importStaffState(staffBefore);
      if (commitAttempted) persist.rebuild = true;
      throw error;
    }
  }
  async function settleSystemDue(key, req) {
    const url = req.url || '/';
    // Immutable assets and operational probes must remain non-destructive smoke surfaces.
    if (req.method === 'OPTIONS' || /^\/(?:__|uploads\/|assets\/|favicon\.|icons\/)/.test(url) || key === 'tasks' && isTaskSampleRequest(req)) return;
    const at = clock.now();
    const dueWorkspaces = platform().getStore().db.workspaces.filter(workspace => !['cancelled', 'deleted'].includes(workspace.state) && (workspace.offboardings || []).some(row => row.status === 'scheduled' && Date.parse(row.effectiveAt) <= at)).map(workspace => workspace.id);
    if (dueWorkspaces.length) await commitSystemPhase('offboarding', at, () => {
      for (const id of dueWorkspaces) {
        const S = platform().getStore(), workspace = S.workspace(id), runtime = registry.create(id, 'hr');
        try {
          require('./workspace-hr').runOffboarding({ S, identity: identityFor(), workspace, actor: null, runtime, transferOwned: row => transferOwned(workspace, row, runtime) });
          registry.commit(runtime);
        } finally { runtime.close(); }
      }
    });
    const billing = require('./workspace-billing-lifecycle');
    const selected = billing.selectBillingDue({ db: platform().getStore().db, at });
    if (selected.length) await commitSystemPhase('billing', at, () => {
      for (const initial of selected) {
        // Earlier global price publication may have consumed shared markers. Re-select against
        // the current candidate and never retain references across a platform import.
        const S = platform().getStore(), job = billing.selectBillingDue({ db: S.db, at, workspaceId: initial.workspaceId })[0];
        if (!job) continue;
        const value = billing.executeBillingCommand({ db: S.db, command: { kind: 'billing.run', workspaceId: job.workspaceId, operationId: job.operationId, at: S.iso(at) }, authority: { kind: 'system', workspaceId: job.workspaceId } });
        platform().importState({ ...platform().exportState(), db: value.db });
      }
    });
  }
  function billingCommand(frame, req, kind, workspaceId) {
    const p = frame.principal, S = platform().getStore(), ws = S.workspace(workspaceId);
    const system = kind === 'billing.run';
    if (!p || p.readOnly || !ws || (system ? p.claims.mode !== 'staff' || !p.context.staffAccess?.permissions.admin?.includes('billing:full') : p.context.workspaceContext?.workspace.id !== workspaceId || p.context.workspaceContext.member.role !== 'owner')) throw failure(403, 'billing_forbidden', 'Current billing authority is required.');
    const allowed = system ? ['workspaceId', 'operationId'] : ['operationId', 'lineId', 'paymentMethodId', 'quantity', 'quoteId'];
    if (Object.keys(req.body || {}).some(key => !allowed.includes(key))) throw failure(422, 'invalid_billing_command', 'Only the billing selection can be sent.');
    const operationId = req.get('idempotency-key') || req.body?.operationId;
    if (!/^[\w.:-]{1,200}$/.test(operationId || '')) throw failure(422, 'operation_id_required', 'Supply the original billing attempt reference.');
    const requestOperation = makeWorkspaceOperation({ id: operationId, workspaceId, actor: { userId: p.actor.id }, method: 'POST', path: req.path, body: req.body });
    ws.billingRequests ??= {};
    const requestKey = `${p.actor.id}:${kind}:${operationId}`, prior = ws.billingRequests[requestKey];
    if (prior) {
      if (prior.fingerprint !== requestOperation.fingerprint) throw failure(409, 'operation_conflict', 'Retry the original billing request unchanged.');
      return clone(prior.result);
    }
    const command = { ...req.body, operationId, kind, workspaceId, at: S.iso(S.now()) };
    const value = require('./workspace-billing-lifecycle').executeBillingCommand({ db: S.db, command, authority: { kind: system ? 'system' : 'user', workspaceId, userId: p.user.id, canManageBilling: !system, readOnly: p.readOnly } });
    platform().importState({ ...platform().exportState(), db: value.db });
    const current = platform().getStore().workspace(workspaceId);
    current.billingRequests ??= {}; current.billingRequests[requestKey] = { fingerprint: requestOperation.fingerprint, result: clone(value.result) };
    if (!value.duplicate) platform().getStore().log(p.actor.key, 'billing_command', workspaceId, { kind, operationId, initiatedBy: p.actor.id });
    return value.result;
  }
  async function initialize() {
    identityFor().configureAuthority(authority);
    if (initialized) return;
    const before = await accountStore.accounts();
    identityFor().hydrate(before);
    if (store.kind !== "redis") {
      await store.initializeIdentity(new Map([...authStorage.snapshot(identityFor()), ...before]));
      accountStore.accounts = () => store.identityAccounts();
    } else {
      const seeds = [...authStorage.snapshot(identityFor())].filter(([id]) => !before.has(id)).map(([id, value]) => ({ id, value, expected: null }));
      if (seeds.length) await accountStore.commit(seeds);
    }
    initializeWorkspaceAuthority(platform().getStore(), identityFor(), { seedAt: new clock.RealDate(persist.seedAt).toISOString() });
    initialized = true;
  }
  function importState(state) { registry.importState(state); }
  function exportStaffState() {
    if (!staffAvailable('wm')) return {};
    const value = require('../apps/wm').exportState?.();
    return value ? { wm: value } : {};
  }
  function importStaffState(state) {
    if (state?.wm) {
      if (!staffAvailable('wm')) throw failure(503, 'staff_runtime_unavailable', 'Website Manager is required to restore this history.');
      require('../apps/wm').importState(state.wm);
    }
  }
  function frameApp(capability, req, fallback) {
    const value = privateFrames.get(capability);
    if (!value || value.key !== req.headers["x-mock-app"] || value.method !== req.method || value.url !== req.url) return (_req, res) => {
      // This callback receives a raw Node response before any Express app is selected.
      res.statusCode = 403; res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, code: 'invalid_dispatch_capability' }));
    };
    privateFrames.delete(capability); delete req.headers["x-orgtik-dispatch"];
    authority.bindPreparedRequest(req, value.frame);
    req.workspaceContext = value.frame.principal?.context.workspaceContext || null;
    return (incoming, response) => authority.runPrepared(value.frame, () => requests.run(value.request, () => value.app(incoming, response)));
  }
  const expectedAudience = (key, url) => {
    if (APP_TO_TOOL[key] && /^\/api\/auth\/(profile|avatar)(?:$|\?|\/)/.test(url)) return `tool:${key}`;
    if (/^\/api\/auth\//.test(url)) return undefined;
    if (/^\/v1\/app\//.test(url)) return "suite";
    if (key === "admin" && /^\/v1\/admin\//.test(url)) return "staff:admin";
    if (key === "wm") return "staff:wm";
    if (APP_TO_TOOL[key]) return `tool:${key}`;
    return undefined;
  };
  function availabilityRoutes(toolApp, frame, tool) {
    const app = express(); app.use(cors({ origin: true, credentials: true }));
    app.get('/api/calendar/availability', (req, res, next) => {
      let hrRuntime;
      try {
        const principal = frame.principal, id = principal?.context.workspaceContext?.workspace.id;
        if (!id) throw failure(403, 'workspace_required', 'Choose a workspace to continue.');
        const workspace = platform().getStore().workspace(id), context = principal.context.workspaceContext;
        // The retained absence projection grants no HR record/directory access. Missing
        // subscriptions, disabled connections and external reviewers receive no rows.
        const connector = require('./connectors').list(workspace, context).find(row => row.source === APP_TO_TOOL[tool] && row.target === 'hr');
        if (context.tools.hr.access === 'not_subscribed' || connector?.enabled === false || context.member.role === 'guest') return res.json({ success: true, statusCode: 200, data: { workspaceId: id, timeZone: workspace.timeZone, fromDate: req.query.fromDate, toDate: req.query.toDate, items: [] } });
        hrRuntime = registry.create(id, 'hr');
        const data = require('./workspace-availability').projectAvailability({ realm, workspace: platform().getStore().workspace(id), identity: identityFor(), snapshot: hrRuntime.exportSnapshot(), tool, actor: principal.user, fromDate: req.query.fromDate, toDate: req.query.toDate });
        res.json({ success: true, statusCode: 200, message: 'Workspace availability fetched', data });
      } catch (error) { next(error); }
      finally { hrRuntime?.close(); }
    });
    app.use(toolApp);
    app.use((error, req, res, next) => res.status(error.status || 503).json({ success: false, code: error.code || 'availability_unavailable', message: error.message }));
    return app;
  }
  function accountRoutes(legacyApp, frame) {
    const app = express(); app.use(cors({ origin: true, credentials: true })); app.use(express.json({ limit: "1mb" }));
    const principal = () => frame.principal;
    const answer = (res, data, message = "Success") => res.json({ success: true, statusCode: 200, message, data });
    const safeUser = user => identityFor().publicUser(user);
    const ownContext = () => principal()?.context.workspaceContext;
    const workspace = () => {
      const context = ownContext();
      if (!context) throw failure(403, "workspace_required", "Choose a workspace to continue.");
      return platform().getStore().workspace(context.workspace.id);
    };
    const writable = () => {
      if (principal()?.readOnly || workspace().state === "suspended") throw failure(423, "workspace_read_only", "This workspace is read-only.");
    };
    const route = fn => (req, res, next) => { try { const result = fn(req); if (result?.then) result.then(data => answer(res, data), next); else answer(res, result); } catch (error) { next(error); } };
    const ownedPeople = () => {
      const context = ownContext();
      if (!context) return principal() ? [principal().user] : [];
      const workspace = platform().getStore().workspace(context.workspace.id);
      const keys = new Set(workspace.members.filter(member => member.status === "active").map(member => member.userKey));
      return identityFor().users.filter(user => keys.has(user.key) && (context.member.role !== "guest" || user.id === context.actor.effectiveUserId));
    };
    app.get("/api/auth/me", (req, res) => {
      const p = principal(); if (!p) return res.status(401).json({ success: false, code: "unauthenticated" });
      answer(res, { user: safeUser(p.user), scopes: p.context.scopes, workspaceContext: p.context.workspaceContext, staffAccess: p.context.staffAccess }, "Profile fetched");
    });
    app.get('/api/auth/mailbox', route(() => {
      return journeys.mailbox(platform().getStore(), principal().user, { readOnly: principal().readOnly });
    }));
    const personActions = req => {
      const p = principal();
      if (!p) throw failure(401, 'unauthenticated', 'Sign in to manage your account.');
      return require('./workspace-account-actions').createAccountActions({ S: platform().getStore(), identity: identityFor(), principal: p, workspace: ownContext() ? workspace() : null, sessionStore, authority, token: identityFor().tokenFrom(req), frame });
    };
    const publicCareers = (req, write = false) => {
      const S = platform().getStore(), ws = S.workspace(req.params.workspaceId);
      if (!ws || ['deleted', 'cancelled'].includes(ws.state)) throw failure(404, 'careers_not_found', 'This careers page is unavailable.');
      const line = ws.lines.find(row => row.tool === 'hr' && !['ended', 'deleted'].includes(row.state)), plan = line && S.db.plans.find(row => row.id === line.planId);
      const planEligible = Boolean(line && plan?.tool === 'hr'), canApply = planEligible && ws.state !== 'suspended' && line.state !== 'read_only';
      if (!planEligible) throw failure(404, 'careers_not_found', 'This careers page is unavailable.');
      const runtime = registry.create(ws.id, 'hr');
      if (write) requests.getStore().relatedRuntimes.set(`public-careers:${ws.id}`, runtime);
      return { runtime, planEligible, canApply };
    };
    app.get('/v1/public/careers/:workspaceId', route(req => {
      const { runtime, ...eligibility } = publicCareers(req);
      try { if (!runtime.publicCareers) throw failure(503, 'careers_unavailable', 'The careers page is being prepared.'); return runtime.publicCareers(eligibility); } finally { runtime.close(); }
    }));
    app.post('/v1/public/careers/:workspaceId/jobs/:jobId/applications', route(req => {
      const { runtime, ...eligibility } = publicCareers(req, true);
      if (!runtime.applyPublicCareer) throw failure(503, 'careers_unavailable', 'The careers page is being prepared.');
      return runtime.applyPublicCareer({ ...eligibility, jobId: req.params.jobId, application: req.body, operationId: req.get('idempotency-key') });
    }));
    const publicChats = (req, write = false) => {
      const S = platform().getStore(), ws = S.workspace(req.params.workspaceId), token = req.params.token;
      if (!ws || ['deleted', 'cancelled'].includes(ws.state) || typeof token !== 'string' || token.length > 240) throw failure(404, 'guest_entry_unavailable', 'This guest entry is unavailable.');
      const line = ws.lines.find(row => row.tool === 'chat' && !['ended', 'deleted'].includes(row.state)), plan = line && S.db.plans.find(row => row.id === line.planId), planEligible = Boolean(line && plan?.tool === 'chat'), canJoin = planEligible && ws.state !== 'suspended' && line.state !== 'read_only';
      if (!planEligible) throw failure(404, 'guest_entry_unavailable', 'This guest entry is unavailable.');
      const runtime = registry.create(ws.id, 'chats');
      if (write) requests.getStore().relatedRuntimes.set(`public-chats:${ws.id}`, runtime);
      return { runtime, planEligible, canJoin, token };
    };
    app.get('/v1/public/chats/:workspaceId/guests/:token', route(req => {
      if (req.query.visitToken !== undefined && (typeof req.query.visitToken !== 'string' || req.query.visitToken.length > 240)) throw failure(422, 'invalid_visit_proof', 'Use the original guest visit proof.');
      const { runtime, ...eligibility } = publicChats(req);
      try { if (!runtime.publicGuest) throw failure(503, 'guest_entry_pending', 'This guest entry is being prepared.'); return runtime.publicGuest({ ...eligibility, visitToken: req.query.visitToken }); } finally { runtime.close(); }
    }));
    app.post('/v1/public/chats/:workspaceId/guests/:token', route(req => {
      if (principal()?.readOnly) throw failure(423, 'view_as_read_only', 'View-as cannot create a guest visit.');
      const { runtime, ...eligibility } = publicChats(req, true);
      if (!runtime.joinPublicGuest) throw failure(503, 'guest_entry_pending', 'This guest entry is being prepared.');
      return runtime.joinPublicGuest({ ...eligibility, guest: req.body, operationId: req.get('idempotency-key') });
    }));
    app.get('/api/auth/account', route(req => {
      personActions(req);
      const p = principal(), S = platform().getStore();
      return { user: safeUser(p.user), readOnly: p.readOnly, workspaceId: ownContext()?.workspace.id || null, workspaces: S.db.workspaces.filter(row => !['deleted', 'cancelled'].includes(row.state) && people.memberOf(row, p.user)).map(row => ({ id: row.id, name: row.name, state: row.state, role: people.memberOf(row, p.user).role })) };
    }));
    app.get('/api/auth/account/sessions', route(req => personActions(req).execute('sessions.list')));
    app.get('/api/auth/account/audit', route(req => personActions(req).execute('audit.list')));
    app.post('/api/auth/account/actions/:kind', route(req => {
      if (!['workspace.create', 'person.delete', 'sessions.revoke'].includes(req.params.kind)) throw failure(422, 'workspace_action_required', 'Choose a workspace for this action.');
      return personActions(req).execute(req.params.kind, req.body);
    }));
    app.use('/v1/admin', (req, res, next) => {
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
      const S = platform().getStore(), serviceId = value => S.db.plans.some(row => row.id === value && row.service) || S.db.services.some(row => row.id === value), moved = () => res.status(410).json({ success: false, code: 'services_managed_in_crm', message: 'Manage service catalogs and delivery in the OrgTik CRM.', managedIn: 'crm', path: req.path.startsWith('/service-requests') ? '/service-requests' : '/catalog' });
      if (/^\/(?:services|service-requests)(?:\/|$)/.test(req.path)) return moved();
      if (/^\/plans(?:\/|$)/.test(req.path) && (req.body?.service === true || serviceId(req.path.split('/')[2]))) return moved();
      if (req.path === '/price-drafts' && Array.isArray(req.body?.changes) && req.body.changes.some(row => serviceId(String(row.key || '').split(':')[0]))) return moved();
      const draft = /^\/price-drafts\/([^/]+)\/publish$/.exec(req.path);
      if (draft && S.db.priceDrafts.find(row => row.id === draft[1])?.changes.some(row => serviceId(row.key.split(':')[0]))) return moved();
      if (/^\/bundles(?:\/|$)/.test(req.path) && Array.isArray(req.body?.planIds) && req.body.planIds.some(serviceId)) return moved();
      const country = /^\/countries\/([^/]+)$/.exec(req.path);
      if (country && req.body?.fixed) {
        const prior = S.db.countries[country[1]]?.fixed || {};
        if (Object.entries(req.body.fixed).some(([key, value]) => serviceId(key.split(':')[0]) && JSON.stringify(value) !== JSON.stringify(prior[key]))) return moved();
        req.body.fixed = { ...Object.fromEntries(Object.entries(prior).filter(([key]) => serviceId(key.split(':')[0]))), ...req.body.fixed };
      }
      next();
    });
    app.get("/api/auth/my-scopes", (req, res) => {
      const p = principal(); if (!p) return res.status(401).json({ success: false, code: "unauthenticated" });
      const names = new Set(p.context.scopes.map(scope => scope.scope));
      const descriptors = identityFor().scopes.filter(scope => names.has(scope.name));
      const launch = p.context.staffAccess?.toolLaunch;
      if (!p.context.workspaceContext && launch) for (const tool of launch.tools) {
        const scope = identityFor().scopeByName(TOOL_DEFINITIONS[tool]?.scope);
        if (scope && !names.has(scope.name)) { descriptors.push({ ...scope, mode: "workspace", workspaceId: launch.workspaceId }); names.add(scope.name); }
      }
      for (const key of p.context.staffAccess?.apps || []) {
        const scope = identityFor().scopeByName(key === "admin" ? "platform_admin" : "website_manager");
        if (scope && !names.has(scope.name)) descriptors.push({ ...scope, mode: "staff", target: key });
      }
      answer(res, descriptors);
    });
    app.post("/api/auth/workspace", (req, res, next) => {
      const body = req.body || {}, mode = body.mode || "workspace";
      const audience = contextService().audienceFor(body.target || (mode === "staff" ? "admin" : "suite"));
      authority.switchContext(identityFor().tokenFrom(req), { mode, workspaceId: mode === "staff" ? null : body.workspaceId, audience }).then(value => answer(res, value, "Workspace selected"), next);
    });
    app.patch('/v1/admin/people/:id/status', route(req => {
      const p = principal();
      if (p?.claims.mode !== 'staff' || p.claims.aud !== 'staff:admin' || !p.context.staffAccess?.permissions.admin?.includes('staff:full')) throw failure(403, 'staff_permission_required', 'Only authorized OrgTik staff can change account status.');
      const user = identityFor().findUser(req.params.id);
      if (!user) throw failure(404, 'person_not_found', 'This account was not found.');
      if (typeof req.body.isActive !== 'boolean' || user.id === p.user.id && !req.body.isActive) throw failure(422, 'invalid_account_status', 'Choose a valid account status.');
      if (user.isActive !== req.body.isActive) { user.isActive = req.body.isActive; user.authVersion = (user.authVersion || 0) + 1; user.updatedAt = platform().getStore().iso(platform().getStore().now()); }
      platform().getStore().log(p.actor.key, 'account_status_changed', String(user.id), { isActive: user.isActive });
      return safeUser(user);
    }));
    app.post('/v1/admin/billing/lifecycle', route(req => billingCommand(frame, req, 'billing.run', req.body.workspaceId)));
    app.post('/v1/app/billing/recover', route(req => billingCommand(frame, req, 'billing.recover', workspace().id)));
    app.post('/v1/app/subscriptions/:id/retry', (req, res, next) => {
      try {
        const ws = workspace(), method = req.body.paymentMethodId || ws.paymentMethods.find(row => row.isDefault && !row.expired)?.id;
        req.body = { lineId: req.params.id, paymentMethodId: method };
        const result = billingCommand(frame, req, 'billing.recover', ws.id);
        if (result.paymentStatus === 'failed') { frame.commitRefusal = true; return res.status(402).json({ error: { code: 'payment_failed', message: 'The payment did not go through. Choose another saved method.', invoiceId: result.invoiceId } }); }
        res.json({ data: platform().getStore().workspace(ws.id).lines.find(line => line.id === result.lineId), meta: {} });
      } catch (error) { next(error); }
    });
    app.post('/v1/app/billing/seats/quote', route(req => billingCommand(frame, req, 'billing.seats.quote', workspace().id)));
    app.post('/v1/app/billing/seats/confirm', route(req => billingCommand(frame, req, 'billing.seats.confirm', workspace().id)));
    app.post('/v1/app/billing/seats/reduce', route(req => billingCommand(frame, req, 'billing.seats.reduce', workspace().id)));
    app.post('/v1/app/billing/seats/cancel-reduction', route(req => billingCommand(frame, req, 'billing.seats.cancel-reduction', workspace().id)));
    app.get("/v1/app/invitations", route(() => { const ws = workspace(); people.requireAdmin(ws, principal().user); return (ws.invitations || []).map(({ tokenHash, grants, ...row }) => ({ ...row, tools: Object.keys(grants), status: row.status === "pending" && Date.parse(row.expiresAt) <= platform().getStore().now() ? "expired" : row.status })); }));
    app.get('/v1/app/team', (req, res, next) => {
      try {
        const ws = workspace(), S = platform().getStore();
        const data = ws.members.filter(member => !['removed', 'offboarded', 'cancelled'].includes(member.status)).map(member => {
          const user = identityFor().findByKey(member.userKey);
          return { id: member.id, userKey: member.userKey, name: user ? identityFor().fullName(user) : member.name, email: user?.email || member.email, role: member.role, customRoleId: member.customRoleId || null, status: member.status, tools: Object.keys(member.toolGrants || {}).filter(tool => member.toolGrants[tool].assigned), joinedAt: member.joinedAt, invitationId: member.invitationId || null };
        });
        const filtered = ownContext().member.role === 'guest' ? data.filter(member => member.userKey === principal().user.key) : data;
        res.json({ data: filtered, meta: { seats: S.seats(ws), seatModel: 'B', perTool: Object.fromEntries(Object.keys(TOOL_DEFINITIONS).map(tool => [tool, seatCounts(S, ws, tool)])), perUserLines: ws.lines.filter(line => S.db.plans.find(plan => plan.id === line.planId)?.perUser).map(line => ({ id: line.id, tool: line.tool, unit: line.snapshot.unit, currency: line.snapshot.currency, cycle: line.cycle })) } });
      } catch (error) { next(error); }
    });
    app.post('/v1/app/team/invite', (req, res, next) => {
      try { writable(); const data = people.invite(platform().getStore(), identityFor(), workspace(), principal().user, req.body, { operationId: req.get('idempotency-key') }); res.status(201).json({ data, meta: {} }); } catch (error) { next(error); }
    });
    app.patch('/v1/app/team/:id', (req, res, next) => {
      try { writable(); const data = people.changeMember(platform().getStore(), workspace(), principal().user, req.params.id, req.body); res.json({ data, meta: {} }); } catch (error) { next(error); }
    });
    app.post("/v1/app/invitations", route(req => { writable(); return people.invite(platform().getStore(), identityFor(), workspace(), principal().user, req.body, { operationId: req.get('idempotency-key') }); }));
    app.post("/v1/app/invitations/:id/cancel", route(req => { writable(); return people.changeInvitation(platform().getStore(), workspace(), principal().user, req.params.id, "cancel", { operationId: req.get('idempotency-key') }); }));
    app.post("/v1/app/invitations/:id/resend", route(req => { writable(); return people.changeInvitation(platform().getStore(), workspace(), principal().user, req.params.id, "resend", { operationId: req.get('idempotency-key') }); }));
    app.get('/v1/app/invitations/:id/delivery', route(req => journeys.delivery(platform().getStore(), workspace(), principal().user, req.params.id, { readOnly: principal().readOnly })));
    app.get("/v1/public/invitations/:token", route(req => journeys.metadata(platform().getStore(), identityFor(), req.params.token)));
    app.post("/v1/public/invitations/:token/accept", route(req => {
      if (principal()?.readOnly) throw failure(423, "impersonation_read_only", "View-as sessions cannot accept invitations.");
      const result = journeys.accept(platform().getStore(), identityFor(), req.params.token, principal()?.user, req.body, req.get('idempotency-key'));
      const user = identityFor().findUser(result.userId);
      const hrRuntime = registry.create(result.workspaceId, 'hr');
      try {
        if (require('./workspace-hr').activateEmployee({ S: platform().getStore(), runtime: hrRuntime, userId: result.userId })) registry.commit(hrRuntime);
      } finally { hrRuntime.close(); }
      const tokens = identityFor().issueTokens(user, { mode: "workspace", workspaceId: result.workspaceId, audience: "suite" });
      return { ...result, tokens, workspaceContext: contextService().resolveWorkspace(user, { mode: "workspace", workspaceId: result.workspaceId, audience: "suite" }).workspaceContext };
    }));
    app.post("/v1/app/ownership-transfer", route(req => { writable(); return journeys.transfer(platform().getStore(), identityFor(), workspace(), principal().user, req.body.memberId, req.get('idempotency-key')); }));
    app.post('/v1/app/people-lifecycle', route(() => {
      writable(); const ws = workspace(); people.requireAdmin(ws, principal().user);
      const hrRuntime = registry.create(ws.id, 'hr');
      try { const result = require('./workspace-hr').runOffboarding({ S: platform().getStore(), identity: identityFor(), workspace: ws, actor: principal().user, runtime: hrRuntime, transferOwned: row => transferOwned(ws, row, hrRuntime) }); registry.commit(hrRuntime); return result; }
      finally { hrRuntime.close(); }
    }));
    app.get("/v1/app/mailbox", route(() => {
      return journeys.mailbox(platform().getStore(), principal().user, { workspaceId: workspace().id, readOnly: principal().readOnly });
    }));
    app.get("/v1/app/seats", route(() => {
      const ws = workspace();
      return Object.fromEntries(Object.keys(TOOL_DEFINITIONS).map(tool => [tool, seatCounts(platform().getStore(), ws, tool)]));
    }));
    app.get(["/api/users", "/api/users/all", "/api/staff"], (req, res) => {
      if (!ownContext()) return res.status(403).json({ success: false, code: "workspace_required" });
      const data = ownedPeople().map(user => ({ id: user.id, key: user.key, firstName: user.firstName, lastName: user.lastName, email: user.email, avatar: user.avatar, isActive: user.isActive }));
      answer(res, data);
    });
    app.get(["/api/users/me", "/api/users/profile"], (req, res) => {
      const p = principal(); if (!p) return res.status(401).json({ success: false });
      answer(res, { ...safeUser(p.user), scopes: p.context.scopes, workspaceContext: p.context.workspaceContext, staffAccess: p.context.staffAccess });
    });
    app.get("/api/users/:id", (req, res) => {
      const user = ownedPeople().find(row => String(row.id) === req.params.id);
      if (!user) return res.status(404).json({ success: false, message: "This person was not found in your workspace." });
      answer(res, user.id === principal()?.user.id ? safeUser(user) : { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, avatar: user.avatar });
    });
    // General-tool APIs must not expose the old global demo stores in customer mode.
    app.use((req, res, next) => {
      if (principal()?.claims.mode === "workspace" && /^\/api\//.test(req.path) && !/^\/api\/auth\//.test(req.path)) return res.status(403).json({ success: false, code: "workspace_route_required", message: "Use the workspace application for this action." });
      next();
    });
    app.use(legacyApp);
    app.use((error, req, res, next) => res.status(error.status || 503).json({ success: false, code: error.code || 'workspace_unavailable', message: error.message }));
    return app;
  }
  async function handle({ key, req, body, legacyApp, legacyAppFor, send, sendJson, sync }) {
    // Cold storage work occurs before the user transaction, but still belongs to
    // this HTTP request. A temporary outage must not reject an ignored server
    // callback promise and terminate the process; initialization can retry later.
    try { await initialize(); await sync(); }
    catch (error) { return sendJson(error.status || 503, { success: false, code: error.code || 'workspace_runtime_unavailable', message: 'Workspace storage could not be loaded. Try again.' }); }
    let identity, S, saved, currentLegacyApp;
    const refreshLiveReferences = async () => {
      identity = identityFor(); saved = await accountStore.accounts(); identity.hydrate(saved); identity.configureAuthority(authority);
      S = platform().getStore(); initializeWorkspaceAuthority(S, identity, { seedAt: new clock.RealDate(persist.seedAt).toISOString() });
      currentLegacyApp = legacyAppFor ? legacyAppFor() : legacyApp;
      if (typeof currentLegacyApp !== 'function') throw failure(503, 'workspace_runtime_unavailable', 'The current app runtime is unavailable.');
    };
    try { await refreshLiveReferences(); }
    catch { return sendJson(503, { success: false, code: 'workspace_runtime_unavailable', message: 'The current app runtime is unavailable. Try again.' }); }
    // Deadline work is a trusted transaction independent of the caller's authorization.
    // Its committed state must survive a subsequent expired/offboarded/read-only refusal.
    for (let attempt = 0; attempt < 2; attempt++) {
      try { await settleSystemDue(key, req); break; }
      catch (error) {
        if (error.status === 409 && attempt === 0) {
          // Discarded candidates never become authority. Reload the winning checkpoint and
          // canonical accounts before one trusted retry; the user body has not run yet.
          try {
            await sync(); await refreshLiveReferences();
          } catch { return sendJson(503, { success: false, code: 'lifecycle_unavailable', message: 'Due workspace transitions could not be completed. Try again.' }); }
          continue;
        }
        return sendJson(error.status || 503, { success: false, code: error.code || 'lifecycle_unavailable', message: 'Due workspace transitions could not be completed. Try again.' });
      }
    }
    try { await refreshLiveReferences(); }
    catch { return sendJson(503, { success: false, code: 'workspace_runtime_unavailable', message: 'The current app runtime is unavailable. Try again.' }); }
    let json;
    try { json = body.length && /application\/json/.test(req.headers["content-type"] || "") ? JSON.parse(body.toString("utf8")) : {}; }
    catch { return sendJson(400, { success: false, code: "invalid_json", message: "Check the request and try again." }); }
    req.body = json;
    const url = req.url || "/", authPublic = /^\/api\/auth\/(login|register|handoff\/exchange)(?:$|\?)/.test(url);
    const publicFile = key === 'files' && /^\/api\/v1\/public\/shares\/([\w-]+)(?:$|\/|\?)/.exec(url);
    const taskSample = key === 'tasks' && isTaskSampleRequest(req);
    const publicCms = key === 'wm' && (['GET', 'HEAD'].includes(req.method) && /^\/v2\/(?:public(?:\/|$)|media\/[^/]+(?:$|\?))/.test(url) || req.method === 'POST' && /^\/v2\/public\/(leads|ideas)(?:$|\?)/.test(url));
    const cmsPreview = key === 'wm' && ['GET', 'HEAD'].includes(req.method) && /^\/v2\/preview\/entries\/[\w-]+(?:$|\?)/.test(url);
    const anonymous = authPublic || publicFile || taskSample || publicCms || cmsPreview || /^\/v1\/public\//.test(url) || /^\/(__health|__mock\/status|__mock\/clock)(?:$|\?)/.test(url);
    let frame, runtime, commitAttempted = false;
    const relatedRuntimes = new Map();
    const suiteReadRuntimes = new Map();
    const requestEpoch = persist.epoch;
    initializeWorkspaceAuthority(S, identity, { seedAt: new clock.RealDate(persist.seedAt).toISOString() });
    const platformBefore = platform().exportState(), accountsBefore = authStorage.snapshot(identity), runtimesBefore = registry.exportState(), staffBefore = exportStaffState();
    try {
      const refresh = /^\/api\/auth\/refresh(?:$|\?)/.test(url);
      frame = await authority.prepareRequest(req, { audience: publicCms || cmsPreview || taskSample ? undefined : expectedAudience(key, url), allowAnonymous: anonymous, ...(authPublic || publicFile || publicCms || cmsPreview || taskSample ? { token: null } : {}), ...(refresh ? { token: json.refreshToken, type: "refresh" } : {}) });
      frame.authorizationSnapshot = platformBefore;
      // Candidate self-role edits must not become their own authorization source
      // or make an authorized edit look like an external authority change.
      frame.authorizationGrants = clone(identity.grants);
      const principal = frame.principal;
      const cmsUpload = key === 'wm' && req.method === 'POST' && /^\/v2\/admin\/media(?:$|\?)/.test(url);
      if (['POST', 'PUT', 'PATCH'].includes(req.method) && /multipart\/form-data|application\/octet-stream/i.test(req.headers['content-type'] || '') && !cmsUpload) throw failure(501, 'packaged_assets_only', 'Choose a packaged sample asset in this prototype.');
      if (cmsPreview) {
        const token = /^Preview (\S+)$/.exec(req.headers.authorization || '')?.[1];
        if (!require('../apps/wm').validatePreviewGrant?.(token)) throw failure(401, 'preview_expired', 'Open a new preview from Website Manager.');
      }
      if (/^\/(?:__mock\/|v[12]\/__mock\/)/.test(url) && req.method !== "GET" && (principal?.claims.mode !== 'staff' || !principal?.context.staffAccess?.permissions.admin?.includes("settings:full"))) throw failure(403, "mock_control_forbidden", "Only an authorized mock administrator can do this.");
      const request = { frame, key, req, principal, runtime: null, relatedRuntimes, suiteReadRuntimes };
      const result = await authority.runPrepared(frame, () => requests.run(request, async () => {
        let app = key === "sos" || key === "admin" ? accountRoutes(currentLegacyApp, frame) : currentLegacyApp;
        if (/^\/api\/suite(?:\/|$)/.test(url)) {
          const context = principal?.context.workspaceContext;
          if (!context) throw failure(403, 'workspace_required', 'Choose a workspace to continue.');
          const runtimeFor = (tool, write = false) => {
            const appKey = TOOL_DEFINITIONS[tool]?.app;
            if (!appKey) throw failure(422, 'unsupported_tool', 'Choose a supported tool.');
            if (relatedRuntimes.has(appKey)) return relatedRuntimes.get(appKey);
            if (!suiteReadRuntimes.has(appKey)) suiteReadRuntimes.set(appKey, registry.create(context.workspace.id, appKey));
            const candidate = suiteReadRuntimes.get(appKey);
            if (write) { suiteReadRuntimes.delete(appKey); relatedRuntimes.set(appKey, candidate); }
            return candidate;
          };
          const accountActions = require('./workspace-account-actions').createAccountActions({ S, identity, principal, workspace: S.workspace(context.workspace.id), sessionStore, authority, token: identity.tokenFrom(req), frame });
          app = require('./workspace-suite').createSuiteRouter({ S, identity, principal, runtimeFor, accountActions, serviceFiles: {
            list: query => filesRuntime().listSharedFiles({ actorId: principal.user.id, search: query.search, page: query.page, limit: query.limit }),
            package: value => { const ref = require('./workspace-file-references').reference(value, context.workspace.id); return filesRuntime().packageServiceDelivery({ actorId: principal.user.id, fileId: ref.fileId, versionId: ref.versionId }); },
          }, command: (tool, kind, payload, operationId) => {
            request.runtime = runtimeFor(tool, true);
            return executeCommand(kind, payload, { workspaceId: context.workspace.id, actor: { userId: principal.user.id }, operationId });
          } });
        } else if (taskSample) { app = express(); app.use(createTaskSampleRouter({ config })); }
        else if (publicFile) {
          const workspaceId = registry.publicFileWorkspace(publicFile[1]);
          if (!workspaceId) throw failure(404, 'public_grant_not_found', 'This link is not available.');
          runtime = registry.create(workspaceId, 'files'); request.runtime = runtime; app = runtime.router;
        } else if (APP_TO_TOOL[key] && (!/^\/(__|api\/auth\/)/.test(url) || /^\/api\/auth\/(profile|avatar)(?:$|\?|\/)/.test(url))) {
          const context = principal?.context.workspaceContext;
          if (!context) throw failure(403, "workspace_required", "Choose a workspace to continue.");
          const access = context.tools[APP_TO_TOOL[key]];
          if (!access || ["no_access", "not_subscribed"].includes(access.access)) throw failure(403, "tool_access_denied", "Ask your workspace owner for access.");
          if (req.method !== "GET" && req.method !== "HEAD" && (principal.readOnly || access.access === "read_only")) throw failure(423, "workspace_read_only", "This workspace tool is read-only.");
          runtime = registry.create(context.workspace.id, key); request.runtime = runtime; app = runtime.router;
          if (['tasks', 'chats'].includes(key)) app = fileReferenceRoutes(app, frame, runtime);
          if (['tasks', 'chats'].includes(key)) app = availabilityRoutes(app, frame, key);
        }
        const capability = crypto.randomFillSync(Buffer.alloc(24)).toString("base64url");
        privateFrames.set(capability, { key, method: req.method, url, frame, request, app });
        const headers = { ...req.headers, "x-orgtik-dispatch": capability };
        try { return await dispatch(key, { method: req.method, url, headers, body }); }
        finally { privateFrames.delete(capability); }
      }));
      const persistPublicRefusal = publicFile && req.method === 'POST' && /\/session(?:$|\?)/.test(url) && [401, 404, 429].includes(result.statusCode);
      if (result.statusCode >= 400 && !persistPublicRefusal && !frame.commitRefusal) {
        identity.hydrate(accountsBefore, { replace: true }); platform().importState(platformBefore); registry.importState(runtimesBefore); importStaffState(staffBefore);
        return send(result);
      }
      if (persist.epoch !== requestEpoch) {
        // Authorized fixture resets already persisted a new epoch and rebuilt its seed.
        // Never append the pre-reset candidate or old runtime snapshots to that epoch.
        await authority.commitPending(frame); return send(result);
      }
      if (req.method === 'POST' && /^\/api\/auth\/login-as\/[1-9]\d*(?:$|\?)/.test(url)) {
        const data = JSON.parse(result.rawPayload.toString('utf8')).data, viewed = data?.workspaceContext;
        if (viewed?.actor.readOnly && principal?.actor.id === viewed.actor.userId) S.log(principal.actor.key, 'view_as_started', String(viewed.actor.effectiveUserId), { workspaceId: viewed.workspace.id, actorUserId: principal.actor.id, effectiveUserId: viewed.actor.effectiveUserId });
      }
      if (req.method === 'POST' && /^\/api\/auth\/exit-impersonation(?:$|\?)/.test(url) && principal?.readOnly) S.log(principal.actor.key, 'view_as_ended', String(principal.user.id), { workspaceId: principal.context.workspaceContext?.workspace.id, actorUserId: principal.actor.id, effectiveUserId: principal.user.id });
      // Approved owner-domain adapter. The existing transaction commits or rolls
      // back the platform and related CRM snapshots together; paid rows stay intact.
      if (req.method === 'POST' && /^\/v1\/app\/website-orders(?:$|\?)/.test(url)) await authority.runPrepared(frame, () => requests.run({ frame, key, req, principal: frame.principal, runtime, relatedRuntimes }, () => deliverPaidServices(requests.getStore())));
      assignInitialOwnerSeats(S);
      if (runtime) registry.commit(runtime);
      for (const related of relatedRuntimes.values()) registry.commit(related);
      const after = platform().exportState(), workspaceState = registry.exportState(), staffState = exportStaffState();
      const changes = [...authStorage.snapshot(identity)].filter(([id, value]) => saved.get(id) !== value).map(([id, value]) => ({ id, value, expected: saved.get(id) ?? null }));
      const changed = JSON.stringify(after) !== JSON.stringify(platformBefore) || JSON.stringify(workspaceState) !== JSON.stringify(runtimesBefore) || JSON.stringify(staffState) !== JSON.stringify(staffBefore) || changes.length;
      if (changed) {
        const identityEffect = { changes, ...(store.kind === "redis" ? { accountsKey: `orgtik:identity:${realm}:accounts`, emailsKey: `orgtik:identity:${realm}:emails` } : {}) };
        const entry = { epoch: persist.epoch, kind: "workspace-v1", app: key, method: req.method, url, headers: {}, body: null, at: clock.now(), checkpoint: encodeDomainCheckpoint({ platformState: after, workspaceState, staffState }) };
        if (!frame.accountSessionExit && !/^\/api\/auth\/logout(?:-all)?(?:$|\?)/.test(url)) await authority.revalidatePrepared(frame);
        commitAttempted = true;
        const committed = await store.commit(entry, { expectedEpoch: persist.epoch, expectedRevision: persist.applied, identity: identityEffect });
        persist.applied = committed.sequence; persist.modern = true; persist.workspaceModern = true;
      }
      await authority.commitPending(frame);
      return send(result);
    } catch (error) {
      identity.hydrate(accountsBefore, { replace: true }); platform().importState(platformBefore); registry.importState(runtimesBefore); importStaffState(staffBefore);
      if (commitAttempted) persist.rebuild = true;
      return sendJson(error.status || 503, { success: false, code: error.code || "workspace_unavailable", message: error.message });
    } finally { if (frame) authority.discardPending(frame); runtime?.close(); for (const related of relatedRuntimes.values()) related.close(); for (const related of suiteReadRuntimes.values()) related.close(); }
  }
  return { authority, registry, initialize, handle, importState, exportStaffState, importStaffState, frameApp, currentPrincipal, contextService, deliverWebsiteLead, staffPreferences, catalogMirror, crmLeadTarget };
}
module.exports = { createWorkspaceBoundary };
