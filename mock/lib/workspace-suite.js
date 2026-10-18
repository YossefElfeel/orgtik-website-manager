const express = require('express');
const cors = require('cors');
const connectors = require('./connectors');
const people = require('./workspace-people');
const { TOOL_DEFINITIONS, resolveWorkspaceContext, guestToolRoles } = require('./workspace-context');
const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const clone = value => JSON.parse(JSON.stringify(value));
const chatMessages = data => [...(data.messages || []), ...Object.values(data.threadReplies || {}).flat()];
const ADMIN_ROLES = { tasks: ['super_admin', 'project_manager'], files: ['super_admin'], hr: ['super_admin', 'hr'], crm: ['admin', 'manager'], marketing: ['super_admin', 'marketing_manager'], chat: ['owner', 'admin'] };
function requireToolAdmin(context, tool) {
  const access = context.tools[tool];
  if (!connectors.admitted(access) || !['owner', 'admin'].includes(context.member.role) && !access.roles.some(role => ADMIN_ROLES[tool]?.includes(role))) throw fail(403, 'tool_admin_required', 'Ask this tool’s administrator.');
  return access;
}
function preferences(actor) { return clone(actor.profile?.suitePreferences || { density: 'comfortable' }); }
function savePreferences(actor, patch) {
  const allowed = ['theme', 'density', 'language', 'savedViews', 'notificationPreferences'];
  if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).some(key => !allowed.includes(key)) || JSON.stringify(patch).length > 50000) throw fail(422, 'invalid_preferences', 'Check the preference values.');
  if (patch.theme !== undefined && !['light', 'dark'].includes(patch.theme) || patch.density !== undefined && !['comfortable', 'compact'].includes(patch.density) || patch.language !== undefined && !['en', 'ar', 'de', 'fr', 'it'].includes(patch.language)) throw fail(422, 'invalid_preferences', 'Choose a supported preference.');
  for (const key of ['savedViews', 'notificationPreferences']) if (patch[key] !== undefined && (!patch[key] || typeof patch[key] !== 'object' || Array.isArray(patch[key]))) throw fail(422, 'invalid_preferences', 'Check the preference values.');
  if (patch.notificationPreferences && Object.entries(patch.notificationPreferences).some(([key, value]) => !['inApp', 'mentions', 'tasks', 'billing', 'hr', 'marketing', 'crm', 'files', 'chat', 'emailMock', 'desktopMock'].includes(key) || typeof value !== 'boolean')) throw fail(422, 'invalid_preferences', 'Choose supported notification categories.');
  actor.profile ??= {}; actor.profile.suitePreferences = { ...preferences(actor), ...clone(patch) };
  return preferences(actor);
}
function createSuiteRouter({ S, identity, principal, runtimeFor, command, accountActions, serviceFiles }) {
  const app = express(); app.use(cors({ origin: true, credentials: true })); app.use(express.json({ limit: '200kb' }));
  const context = principal.context.workspaceContext, workspace = context && S.workspace(context.workspace.id), actor = identity.findUser(principal.user.id);
  if (!workspace || !actor) throw fail(403, 'workspace_required', 'Choose a workspace to continue.');
  const currentContext = () => resolveWorkspaceContext(S, identity, actor, { realm: context.realm, workspaceId: workspace.id, actorUserId: principal.actor.id, readOnly: principal.readOnly, audience: principal.claims.aud });
  // Account-owned settings/projectors are supplied by its domain module; the
  // guarded authority effects remain rooted in the existing boundary adapter.
  const read = fn => (req, res, next) => { try { Promise.resolve(fn(req)).then(data => res.set('Cache-Control', 'private, no-store').json({ success: true, data }), next); } catch (error) { next(error); } };
  const write = fn => read(req => { connectors.writable(workspace, currentContext()); return fn(req); });
  app.get('/api/suite/account/sessions', read(() => accountActions.execute('sessions.list')));
  app.post('/api/suite/account/actions/:kind', read(req => accountActions.execute(req.params.kind, req.body)));
  const accountFile = require('node:path').join(__dirname, '../apps/sos/workspace-features.js');
  if (require('node:fs').existsSync(accountFile)) require(accountFile).create({ S, identity, workspace, actor, principal, currentContext, runtimeFor, actions: accountActions }).routes(app, '/api/suite/account');
  else app.use('/api/suite/account', (_req, res) => res.status(503).json({ success: false, code: 'account_features_pending', message: 'The Account feature module is still being prepared.' }));
  const admittedTools = () => Object.entries(currentContext().tools).filter(([, access]) => connectors.admitted(access)).map(([tool]) => tool);
  const snapshots = () => admittedTools().map(tool => ({ tool, data: runtimeFor(tool).suiteFeed?.(currentContext()) || runtimeFor(tool).bootstrap(currentContext()) }));
  function searchItems() {
    const out = [], push = (tool, type, rows, title, path) => { for (const row of rows || []) { const label = title(row); if (label) out.push({ id: `${tool}:${type}:${row.id}`, tool, title: String(label), path: path(row) }); } };
    for (const { tool, data } of snapshots()) {
      if (tool === 'tasks') { push(tool, 'project', data.projects, row => row.title, row => `/projects/${encodeURIComponent(row.id)}/lists`); push(tool, 'task', data.tasks, row => row.title, row => `/projects/${encodeURIComponent(row.projectId)}/lists?task-id=${encodeURIComponent(row.id)}`); }
      if (tool === 'files') { push(tool, 'file', data.files, row => row.name, row => `/my-files?file=${encodeURIComponent(row.id)}`); push(tool, 'folder', data.folders, row => row.name, row => `/my-files?folder=${encodeURIComponent(row.id)}`); }
      if (tool === 'hr') push(tool, 'employee', data.employees, row => row.fullName || [row.firstName, row.lastName].filter(Boolean).join(' ') || row.name, row => `/employees/${encodeURIComponent(row.id)}`);
      if (tool === 'crm') { push(tool, 'contact', data.contacts, row => row.fullName, row => `/customers/${encodeURIComponent(row.id)}`); push(tool, 'company', data.companies, row => row.name, row => `/companies?company=${encodeURIComponent(row.id)}`); push(tool, 'project', data.projects, row => row.projectName, row => `/projects/${encodeURIComponent(row.id)}`); }
      if (tool === 'marketing') {
        push(tool, 'project', data.projects, row => row.name || row.title, row => `/dashboard?projectId=${encodeURIComponent(row.id)}`);
        for (const type of ['campaign', 'post', 'journey']) push(tool, type, data[`${type}s`], row => row.title, row => `${row.path}${row.path.includes('?') ? '&' : '?'}projectId=${encodeURIComponent(row.projectId)}`);
      }
      if (tool === 'chat') { push(tool, 'channel', data.channels, row => row.name, row => `/hq/chat/${encodeURIComponent(row.id)}`); push(tool, 'message', data.messages, row => row.text || row.content, row => `/hq/chat/${encodeURIComponent(row.channelId)}?message=${encodeURIComponent(row.id)}`); }
    }
    return out;
  }
  function notifications() {
    const rows = S.db.notifications.filter(row => row.workspaceId === workspace.id && row.userKey === actor.key).map(row => ({ id: `account:${row.id}`, tool: 'account', category: /billing|invoice|payment|subscription|renewal|refund|credit|price|trial/.test(row.kind || '') ? 'billing' : undefined, title: row.title, path: '/notifications', at: row.at, read: Boolean(row.read) }));
    for (const { tool, data } of snapshots()) for (const row of data.notifications || []) rows.push({ id: `${tool}:${row.id}`, tool, category: row.category || (/mention/.test(row.kind || row.type || '') ? 'mentions' : tool), title: row.title || row.message || row.type, path: row.path || '/', at: row.createdAt || row.at, read: Boolean(row.readAt || row.read) });
    for (const request of workspace.suite?.requests || []) if (request.userId === actor.id || ['owner', 'admin'].includes(context.member.role)) rows.push({ id: `request:${request.id}:${request.state}`, tool: 'account', title: `${request.tool}: ${request.state}`, path: '/team?tab=requests', at: request.decidedAt || request.at, read: false });
    const reads = workspace.suite?.notificationReads?.[actor.id] || [], settings = preferences(actor).notificationPreferences || {};
    if (settings.inApp === false) return [];
    return rows.filter(row => row.title && settings[row.tool] !== false && (!row.category || settings[row.category] !== false)).map(row => ({ ...row, read: row.read || reads.includes(row.id) })).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 100);
  }
  function bootstrap() {
    const ctx = currentContext(), toolPlans = {};
    for (const tool of admittedTools()) {
      const line = workspace.lines.find(row => row.tool === tool && !['ended', 'deleted'].includes(row.state)), plan = S.db.plans.find(row => row.id === line?.planId);
      toolPlans[tool] = { name: plan?.name?.[preferences(actor).language] || plan?.name?.en || '', limits: clone(plan?.limits || {}), usage: Object.fromEntries((runtimeFor(tool).usage?.() || []).map(row => [row.key, row.used])), trialEndsAt: line?.trialEndsAt || null };
    }
    return { ...ctx, connectors: connectors.list(workspace, ctx), preferences: preferences(actor), now: S.iso(S.now()), toolPlans, entry: admittedTools().length === 1 ? `/go/${TOOL_DEFINITIONS[admittedTools()[0]].scope}` : '/' };
  }
  app.get('/api/suite/bootstrap', read(bootstrap));
  app.get('/api/suite/preferences', read(() => preferences(actor)));
  app.patch('/api/suite/preferences', write(req => savePreferences(actor, req.body)));
  app.get('/api/suite/connectors', read(() => connectors.list(workspace, currentContext())));
  app.patch('/api/suite/connectors/:id', write(req => connectors.configure(S, workspace, actor, currentContext(), req.params.id, req.body.enabled)));
  app.post('/api/suite/tools/:tool/trial', write(req => connectors.startTrial(S, workspace, actor, currentContext(), req.params.tool, req.body.planId)));
  app.get('/api/suite/tools/:tool/plans', read(req => S.db.plans.filter(row => row.tool === req.params.tool && row.status === 'active' && row.visibility !== 'private').map(row => ({ id: row.id, name: row.name, trialDays: row.trialDays, tier: row.tier }))));
  app.get('/api/suite/access-requests', read(() => (workspace.suite?.requests || []).filter(row => row.userId === actor.id || ['owner', 'admin'].includes(context.member.role))));
  app.post('/api/suite/access-requests', write(req => connectors.requestAccess(S, workspace, actor, currentContext(), req.body)));
  app.post('/api/suite/access-requests/:id/:decision', write(req => connectors.decideAccess(S, identity, workspace, actor, currentContext(), req.params.id, req.params.decision)));
  app.get('/api/suite/people', read(() => workspace.members.filter(row => row.status === 'active' && (context.member.role !== 'guest' || row.userKey === actor.key)).map(row => { const user = identity.findByKey(row.userKey); return { id: String(user?.id || row.id), memberId: row.id, name: user ? identity.fullName(user) : row.name, email: user?.email || row.email, avatar: user?.avatar || null }; })));
  app.get('/api/suite/crm/directory', read(req => {
    const ctx = currentContext(); connectors.requireConnection(workspace, ctx, 'marketing', 'crm');
    const data = runtimeFor('crm').suiteFeed(ctx), query = String(req.query.search || '').trim().toLocaleLowerCase();
    if (query.length > 200) throw fail(422, 'invalid_directory_query', 'Use a shorter directory search.');
    return { workspaceId: workspace.id, managedIn: 'crm', contacts: data.contacts.filter(row => !query || `${row.fullName} ${row.email} ${row.companyName}`.toLocaleLowerCase().includes(query)).slice(0, 200).map(row => ({ workspaceId: workspace.id, id: row.id, name: row.fullName, email: row.email, companyId: row.companyId, currency: row.currency, tags: row.tags, consent: row.marketingConsent, attribution: row.attribution })), companies: data.companies };
  }));
  function marketingWriteContext(req, keys) {
    const ctx = currentContext();
    connectors.requireConnection(workspace, ctx, 'marketing', 'crm', { targetWrite: true });
    if (!ctx.tools.marketing.canWrite || ctx.member.role === 'guest' || !ctx.tools.marketing.roles.some(role => ['super_admin', 'marketing_manager', 'marketing_specialist'].includes(role))) throw fail(403, 'marketing_write_required', 'Current Marketing writer access is required.');
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).some(key => !keys.includes(key)) || req.body.workspaceId !== undefined && req.body.workspaceId !== workspace.id) throw fail(422, 'invalid_marketing_command', 'Choose a current source workspace and supported action fields.');
    return ctx;
  }
  function marketingOperation(req, run) {
    const operationId = req.get('idempotency-key') || req.body.operationId;
    if (!/^[\w.:-]{1,200}$/.test(operationId || '')) throw fail(422, 'operation_id_required', 'Supply the original Marketing action reference.');
    const operation = require('./workspace-command').makeWorkspaceOperation({ id: operationId, workspaceId: workspace.id, actor: { userId: actor.id }, method: 'POST', path: req.path, body: req.body });
    const key = `${actor.id}:marketing:${operationId}`, prior = workspace.commandOperations?.[key];
    if (prior) { if (prior.fingerprint !== operation.fingerprint) throw fail(409, 'operation_conflict', 'Retry the original Marketing action unchanged.'); return clone(prior.result); }
    const result = run(); workspace.commandOperations ??= {}; workspace.commandOperations[key] = { fingerprint: operation.fingerprint, result: clone(result) }; return result;
  }
  app.post('/api/suite/crm/consent', write(req => {
    const ctx = marketingWriteContext(req, ['workspaceId', 'contactId', 'state', 'operationId']);
    runtimeFor('crm').marketingContact(ctx, req.body.contactId);
    if (!['unknown', 'opted_in', 'opted_out'].includes(req.body.state)) throw fail(422, 'invalid_marketing_consent', 'Choose an explicit consent state.');
    return marketingOperation(req, () => {
      const result = runtimeFor('crm', true).setMarketingConsent(ctx, req.body.contactId, req.body.state);
      S.log(actor.key, 'marketing_consent_recorded', String(req.body.contactId), { workspaceId: workspace.id, tool: 'marketing', state: req.body.state });
      return { workspaceId: workspace.id, contactId: result.id, consent: result.marketingConsent };
    });
  }));
  app.post('/api/suite/marketing/campaigns/:id/lead', write(req => {
    const ctx = marketingWriteContext(req, ['workspaceId', 'contactId', 'title', 'estimate', 'operationId']), marketing = runtimeFor('marketing'), candidate = marketing.campaignCandidate(ctx, req.params.id);
    if (!candidate.capabilities?.canLead) throw fail(403, 'campaign_lead_forbidden', 'This current campaign cannot create CRM leads.');
    if (!candidate.recipientRefs.some(ref => ref.workspaceId === workspace.id && ref.contactId === req.body.contactId)) throw fail(422, 'campaign_recipient_required', 'Choose an actual recipient of this campaign.');
    runtimeFor('crm').marketingContact(ctx, req.body.contactId);
    return marketingOperation(req, () => {
      const receipt = runtimeFor('crm', true).createCampaignLead(ctx, candidate, req.body.contactId, req.body);
      const result = { workspaceId: workspace.id, campaignId: candidate.id, operationId: req.get('idempotency-key') || req.body.operationId, ...receipt, contactPath: `/customers/${encodeURIComponent(receipt.leadId)}`, projectPath: `/projects/${encodeURIComponent(receipt.projectId)}` };
      runtimeFor('marketing', true).recordAttribution(ctx, candidate.id, result);
      S.log(actor.key, 'campaign_lead_created', String(receipt.projectId), { workspaceId: workspace.id, tool: 'marketing', campaignId: candidate.id });
      return result;
    });
  }));
  app.get('/api/suite/marketing/campaigns/:id/results', read(req => {
    const ctx = currentContext(); connectors.requireConnection(workspace, ctx, 'marketing', 'crm');
    const candidate = runtimeFor('marketing').campaignCandidate(ctx, req.params.id), crm = runtimeFor('crm').suiteFeed(ctx), deals = [];
    for (const receipt of candidate.results) {
      const project = crm.projects.find(row => row.id === receipt.projectId), contact = crm.contacts.find(row => row.id === project?.contactId);
      if (!project || !contact) continue;
      deals.push({ leadId: contact.id, projectId: project.id, title: project.projectName, status: project.status, won: project.won, value: project.value, estimatedValue: project.estimatedValue, currency: project.currency, attribution: contact.attribution, contactPath: `/customers/${encodeURIComponent(contact.id)}`, projectPath: `/projects/${encodeURIComponent(project.id)}` });
    }
    const currencies = [...new Set(deals.map(row => row.currency))].map(currency => ({ currency, deals: deals.filter(row => row.currency === currency).length, wonValue: deals.filter(row => row.currency === currency && row.won).reduce((sum, row) => sum + row.value, 0), pipelineEstimate: deals.filter(row => row.currency === currency && !row.won).reduce((sum, row) => sum + row.estimatedValue, 0) }));
    return { workspaceId: workspace.id, campaignId: candidate.id, deals, currencies, receipts: candidate.results.filter(row => deals.some(deal => deal.projectId === row.projectId)) };
  }));
  app.get('/api/suite/projects', read(req => {
    connectors.requireConnection(workspace, currentContext(), 'hr', 'tasks');
    const query = String(req.query.search || '').toLocaleLowerCase();
    const projects = runtimeFor('tasks').bootstrap(currentContext()).projects.filter(row => (!query || `${row.title} ${row.description}`.toLocaleLowerCase().includes(query)) && (!req.query.status || row.status === req.query.status));
    const { items, meta } = require('./util').paginate(projects, req.query, { defaultLimit: 10 });
    return { items, meta };
  }));
  app.get('/api/suite/tasks/projects', read(req => {
    const ctx = currentContext(), source = String(req.query.source);
    connectors.requireConnection(workspace, ctx, source, 'tasks', { targetWrite: true });
    if (source === 'marketing') runtimeFor('marketing').campaignCandidate(ctx, String(req.query.sourceId || ''));
    const tasks = runtimeFor('tasks'), projects = tasks.connectedProjects(ctx);
    if (source !== 'chat') return projects;
    const audience = runtimeFor('chat').connectedTaskAudience(ctx, String(req.query.sourceId || ''));
    const readers = new Set(audience.userIds);
    return audience.restricted ? projects.filter(project => tasks.projectAudience(ctx, project.id).userIds.every(id => readers.has(id))) : projects;
  }));
  app.get('/api/suite/tasks/references', read(req => {
    const ctx = currentContext(), source = String(req.query.source), sourceId = String(req.query.sourceId || ''), ids = String(req.query.ids || '').split(',').filter(Boolean).map(Number);
    if (!['hr', 'crm', 'chat', 'marketing'].includes(source) || !sourceId || ids.length > 50 || ids.some(id => !Number.isSafeInteger(id) || id < 1)) throw fail(422, 'invalid_references', 'Choose up to fifty source-owned task references.');
    const connection = connectors.list(workspace, ctx).find(row => row.source === source && row.target === 'tasks');
    if (!connection?.enabled || !connectors.admitted(ctx.tools[source]) || !connectors.admitted(ctx.tools.tasks)) throw fail(403, 'connection_access_required', 'Current source and Tasks access are required.');
    if (source === 'marketing') runtimeFor('marketing').campaignCandidate(ctx, sourceId);
    else {
      const data = runtimeFor(source).bootstrap(ctx), records = source === 'hr' ? data.employees : source === 'chat' ? chatMessages(data) : [...data.contacts, ...data.projects];
      if (!records.some(row => String(row.id) === sourceId)) throw fail(404, 'source_not_found', 'This source record was not found.');
    }
    return runtimeFor('tasks').suiteFeed(ctx).tasks.filter(task => ids.includes(task.id) && task.source?.app === source && String(task.source.id) === sourceId).map(task => ({ id: task.id, title: task.title, status: task.status, path: `/projects/${task.projectId}/lists?task-id=${task.id}` }));
  }));
  const services = require('../apps/sales/service-catalog');
  app.get('/api/suite/services/catalog', read(() => services.catalog(S, principal)));
  app.get('/api/suite/crm/projects/:id/provisioning', read(req => ({ ...runtimeFor('crm').provisioningCandidate(currentContext(), req.params.id), canProvision: Boolean(require('./workspace-crm-provisioning').canProvision(S, principal, currentContext())) })));
  app.post('/api/suite/crm/projects/:id/provision', write(req => require('./workspace-crm-provisioning').provision({ S, identity, principal, context: currentContext(), runtime: runtimeFor('crm', true), projectId: req.params.id, body: req.body, operationId: req.get('idempotency-key') || req.body.operationId })));
  app.patch('/api/suite/services/catalog/offers/:id', write(req => services.saveOffer(S, principal, req.params.id, req.body)));
  app.patch('/api/suite/services/catalog/bundles/:id', write(req => services.saveBundle(S, principal, req.params.id, req.body)));
  app.post('/api/suite/services/catalog/publish', write(req => services.publish(S, principal, req.get('idempotency-key') || req.body.operationId, { effectiveAt: req.body.effectiveAt })));
  app.get('/api/suite/services/catalog/publication', read(() => services.publication(S, principal)));
  app.get('/api/suite/services/catalog/preview', read(req => services.preview(S, principal, String(req.query.country || 'CH'))));
  app.patch('/api/suite/services/catalog/policy', write(req => services.savePolicy(S, principal, req.body)));
  app.post('/api/suite/services/catalog/schedules/:id/cancel', write(req => services.cancelSchedule(S, principal, req.params.id)));
  const deliveryFiles = require('./service-delivery-files');
  app.get('/api/suite/services/requests', read(() => services.requests(S, principal).map(deliveryFiles.projectRequest)));
  app.get('/api/suite/services/staff', read(() => services.staff(S, identity, principal)));
  app.get('/api/suite/services/requests/:id/files', read(req => {
    if (!services.requests(S, principal).some(row => row.id === req.params.id)) throw fail(404, 'service_request_not_found', 'This request was not found.');
    connectors.requireConnection(workspace, currentContext(), 'crm', 'files');
    return serviceFiles.list(req.query);
  }));
  app.post('/api/suite/services/requests/:id/actions', write(req => deliveryFiles.projectRequest(services.requestAction(S, identity, principal, req.params.id, req.body, { packageFile: value => { connectors.requireConnection(workspace, currentContext(), 'crm', 'files'); return serviceFiles.package(value); } }))));
  app.get('/api/suite/services/deliveries/:id/:deliveryId/:index/content', (req, res, next) => {
    try {
      const row = S.db.serviceRequests.find(item => item.id === req.params.id);
      const customer = row?.workspaceId === workspace.id && ['owner', 'admin', 'member'].includes(context.member.role);
      if (!row || !customer && !services.requests(S, principal).some(item => item.id === row.id)) throw fail(404, 'service_request_not_found', 'This request was not found.');
      if (!/^\d$/.test(req.params.index)) throw fail(404, 'delivery_file_not_found', 'This delivery file was not found.');
      const file = row.deliveries.find(item => item.id === req.params.deliveryId)?.files[Number(req.params.index)], content = deliveryFiles.content(file);
      res.set('Cache-Control', 'private, no-store').set('X-Content-Type-Options', 'nosniff').attachment(content.name).type(content.mimetype).sendFile(content.path, error => { if (error) next(error); });
    } catch (error) { next(error); }
  });
  app.post('/api/suite/tasks', write(req => {
    const ctx = currentContext(), body = req.body, source = body.source;
    if (!['chat', 'crm', 'hr', 'marketing'].includes(source) || typeof body.sourceId !== 'string' && typeof body.sourceId !== 'number') throw fail(422, 'invalid_source', 'Choose a current source record.');
    connectors.requireConnection(workspace, ctx, source, 'tasks', { targetWrite: true });
    if (!ctx.tools[source].canWrite) throw fail(403, 'source_permission_required', 'Your source role cannot create connected tasks.');
    if (source === 'marketing') {
      const candidate = runtimeFor(source).campaignCandidate(ctx, String(body.sourceId));
      if (!candidate.capabilities.canLead) throw fail(403, 'campaign_task_forbidden', 'Current campaign edit permission is required.');
      if (body.journeyId !== undefined || body.stepId !== undefined) runtimeFor(source).journeyTaskCandidate(ctx, candidate.id, body.journeyId, body.stepId);
    } else {
      const projection = runtimeFor(source).bootstrap(ctx), rows = source === 'chat' ? chatMessages(projection) : source === 'hr' ? projection.employees : body.sourceType === 'contact' ? projection.contacts : projection.projects;
      if (!rows?.some(row => String(row.id) === String(body.sourceId))) throw fail(404, 'source_not_found', 'This source record was not found.');
    }
    if (source === 'chat') {
      const audience = runtimeFor('chat').connectedTaskAudience(ctx, String(body.sourceId));
      const readers = new Set(audience.userIds);
      if (audience.restricted && runtimeFor('tasks').projectAudience(ctx, body.projectId).userIds.some(id => !readers.has(id))) throw fail(403, 'source_audience_mismatch', 'Choose a project whose readers can also see this conversation.');
    }
    const operationId = req.get('idempotency-key') || body.operationId;
    if (!/^[\w.:-]{1,200}$/.test(operationId || '')) throw fail(422, 'operation_id_required', 'Supply the original action reference.');
    const operation = require('./workspace-command').makeWorkspaceOperation({ id: operationId, workspaceId: workspace.id, actor: { userId: actor.id }, method: 'POST', path: '/api/suite/tasks', body });
    const key = `${actor.id}:suite-task:${operationId}`, prior = workspace.commandOperations?.[key];
    if (prior) { if (prior.fingerprint !== operation.fingerprint) throw fail(409, 'operation_conflict', 'This reference was used for another action.'); return clone(prior.result); }
    const task = runtimeFor('tasks', true).createConnectedTask(ctx, { title: body.title, description: body.description, projectId: body.projectId, sectionId: body.sectionId, priority: body.priority, dueDate: body.dueDate, assignedUserIds: body.assignedUserIds, source: { app: source, id: body.sourceId } });
    const result = { task, path: `/projects/${task.projectId}/lists?task-id=${task.id}` };
    if (source === 'marketing') runtimeFor(source, true).recordDelivery(ctx, String(body.sourceId), { kind: body.journeyId !== undefined ? 'journey_task' : 'campaign_task', ...(body.journeyId !== undefined ? { journeyId: body.journeyId, stepId: body.stepId } : {}), taskId: task.id, path: result.path, operationId });
    workspace.commandOperations ??= {}; workspace.commandOperations[key] = { fingerprint: operation.fingerprint, result: clone(result) };
    S.log(actor.key, 'connected_task_created', String(task.id), { workspaceId: workspace.id, source, sourceId: body.sourceId });
    return result;
  }));
  app.get('/api/suite/search', read(req => { const query = String(req.query.q || '').toLocaleLowerCase().slice(0, 200); return query ? searchItems().filter(row => row.title.toLocaleLowerCase().includes(query)).slice(0, 50) : []; }));
  app.get('/api/suite/notifications', read(notifications));
  app.post('/api/suite/notifications/read', write(req => { const visible = notifications(), ids = req.body.all === true ? visible.map(row => row.id) : req.body.ids; if (!Array.isArray(ids) || ids.length > 100 || ids.some(id => !visible.some(row => row.id === id))) throw fail(422, 'invalid_notifications', 'Choose your current notifications.'); workspace.suite ??= {}; workspace.suite.notificationReads ??= {}; workspace.suite.notificationReads[actor.id] = [...new Set([...(workspace.suite.notificationReads[actor.id] || []), ...ids])].slice(-1000); return notifications(); }));
  app.get('/api/suite/activity', read(() => [...S.db.audit.filter(row => row.workspaceId === workspace.id && (['owner', 'admin'].includes(context.member.role) || row.by === actor.key)).map((row, index) => ({ id: `account:${row.id || `${row.at}:${index}`}`, tool: 'account', title: row.action, actor: row.by, at: row.at })), ...snapshots().flatMap(({ tool, data }) => (data.activities || []).map(row => ({ ...row, id: `${tool}:${row.id}`, tool })))].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 100)));
  app.get('/api/suite/tools/:tool/admin', read(req => {
    const tool = req.params.tool, ctx = currentContext(); requireToolAdmin(ctx, tool);
    const snapshot = bootstrap(), access = ctx.tools[tool];
    return { tool, plan: snapshot.toolPlans[tool], seats: access.seats, roles: require('./workspace-commands').ROLE_NAMES[tool], members: workspace.members.filter(row => row.status === 'active').map(row => ({ id: row.id, userId: identity.findByKey(row.userKey)?.id, name: row.name || identity.fullName(identity.findByKey(row.userKey)), assigned: Boolean(row.toolGrants?.[tool]?.assigned), roles: row.toolGrants?.[tool]?.roles || [], allowedRoles: row.role === 'guest' ? guestToolRoles(tool) : require('./workspace-commands').ROLE_NAMES[tool] })), connectors: snapshot.connectors.filter(row => row.source === tool || row.target === tool), settings: clone(workspace.suite?.toolSettings?.[tool] || {}), canWrite: access.canWrite && !ctx.actor.readOnly };
  }));
  app.patch('/api/suite/tools/:tool/admin/members/:userId', write(req => { const ctx = currentContext(); requireToolAdmin(ctx, req.params.tool); if (Object.keys(req.body).some(key => !['roles', 'assigned'].includes(key))) throw fail(422, 'invalid_member_change', 'Choose tool roles or assignment.'); return command(req.params.tool, req.body.assigned === false ? 'workspace.member.remove' : 'workspace.tool.roles', { tool: req.params.tool, userId: Number(req.params.userId), roles: req.body.roles, ...(req.body.assigned !== undefined ? { assigned: req.body.assigned } : {}), ...(req.body.assigned === false ? { mode: 'tool_access' } : {}) }, req.get('idempotency-key')); }));
  app.get('/api/suite/tools/:tool/admin/audit', read(req => { const tool = req.params.tool; requireToolAdmin(currentContext(), tool); return S.db.audit.filter(row => row.workspaceId === workspace.id && row.tool === tool).slice(0, 100).map((row, index) => ({ id: row.id || `${row.at}:${index}`, title: row.action, actor: row.by, at: row.at })); }));
  app.patch('/api/suite/tools/:tool/admin/settings', write(req => { const tool = req.params.tool, ctx = currentContext(); requireToolAdmin(ctx, tool); if (!ctx.tools[tool].canWrite) throw fail(403, 'tool_permission_required', 'Your role cannot change settings.'); if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body) || JSON.stringify(req.body).length > 20000 || Object.keys(req.body).some(key => !['name', 'description', 'defaultView', 'weekStart', 'notificationDefaults'].includes(key))) throw fail(422, 'invalid_settings', 'Check the tool settings.'); workspace.suite ??= {}; workspace.suite.toolSettings ??= {}; workspace.suite.toolSettings[tool] = clone(req.body); S.log(actor.key, 'tool_settings_changed', tool, { workspaceId: workspace.id, tool }); return req.body; }));
  app.get('/api/suite/tools/:tool/export', read(req => { const tool = req.params.tool; if (!connectors.admitted(currentContext().tools[tool])) throw fail(403, 'tool_access_required', 'Request access to export your visible data.'); const runtime = runtimeFor(tool); return { workspaceId: workspace.id, tool, at: S.iso(S.now()), data: runtime.suiteExport ? runtime.suiteExport(currentContext()) : runtime.bootstrap(currentContext()), consequences: connectors.list(workspace, currentContext()).filter(row => row.source === tool || row.target === tool).map(row => ({ id: row.id, data: row.data })) }; }));
  app.use((error, req, res, next) => res.status(error.status || 503).json({ success: false, code: error.code || 'suite_unavailable', message: error.status ? error.message : 'The workspace could not be loaded. Try again.' }));
  return app;
}
module.exports = { createSuiteRouter, requireToolAdmin, ADMIN_ROLES, preferences, savePreferences };
