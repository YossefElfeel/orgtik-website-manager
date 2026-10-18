const express = require("express");
const SCHEMA = "orgtik.workspace.sales";
const clone = value => JSON.parse(JSON.stringify(value));
const failure = message => Object.assign(new Error(message), { status: 503, code: "workspace_runtime_unavailable" });
const COUNTERS = ["project", "invoice", "customInvoice", "subscription", "commission", "offer", "ticket", "refund"];
const LISTS = ["projects", "contracts", "offers", "subscriptions", "invoices", "commissions", "tickets", "notifications", "couponUses", "staff", "customers", "salesmanNotes", "leads", "packages", "coupons", "zones", "durations", "departments", "categories", "features", "plans"];
function minimumCounters(db) {
  const number = value => Number(String(value).match(/(\d+)$/)?.[1]) || 0;
  const highest = values => values.reduce((max, value) => Math.max(max, Number(value) || 0), 0);
  return {
    project: highest(db.projects.map(row => row.referenceNumber)), ticket: highest(db.tickets.map(row => row.number)),
    offer: highest(db.offers.map(row => number(row.code))), subscription: highest(db.subscriptions.map(row => number(row.number))), commission: highest(db.commissions.map(row => number(row.reference))),
    invoice: highest(db.invoices.filter(row => /^INV-/.test(row.invoiceId)).map(row => number(row.invoiceId))), customInvoice: highest(db.invoices.filter(row => /^CINV-/.test(row.invoiceId)).map(row => number(row.invoiceId))), refund: highest(db.invoices.filter(row => /^RF-/.test(row.invoiceId)).map(row => number(row.invoiceId))),
  };
}

function createWorkspaceRuntime(input, appModule) {
  const { realm, workspace, initialization, identity, snapshot } = input;
  if (!realm || !workspace?.id || !identity?.workspaceMode || identity.workspaceId !== workspace.id || identity.realm !== realm || !["empty", "fixture"].includes(initialization?.kind)) throw failure("Invalid CRM workspace input");
  if (initialization.kind === "fixture" && !((workspace.id === "ws_orgtik" && initialization.fixtureId === "orgtik-v1") || (workspace.id === "ws_nile" && initialization.fixtureId === "nile-v1"))) throw failure("Unknown CRM workspace fixture");
  const checkSnapshot = value => {
    if (!value || value.schema !== SCHEMA || value.version !== 1 || value.realm !== realm || value.workspaceId !== workspace.id || value.appKey !== "sales" || value.fixtureId !== initialization.fixtureId || !value.data?.db || !value.data.profilePrefs || LISTS.some(key => !Array.isArray(value.data.db[key])) || COUNTERS.some(key => !Number.isSafeInteger(value.sequences?.[key]) || value.sequences[key] < 0 || value.sequences[key] !== value.data.db.counters?.[key])) throw failure("Invalid CRM snapshot");
    const minimum = minimumCounters(value.data.db);
    if (COUNTERS.some(key => value.sequences[key] < minimum[key])) throw failure("CRM sequence would reuse a business reference");
  };
  if (snapshot) checkSnapshot(snapshot);
  const ctx = { ...input.services.ctx, realm, workspaceId: workspace.id, workspace, identity, services: input.services, io: null };
  const S = appModule.createState(ctx, { empty: initialization.kind === "empty" || initialization.fixtureId === "nile-v1", snapshot: snapshot?.data });
  const router = express.Router(); let closed = false;
  router.use((req, res, next) => closed ? res.status(503).json({ success: false, code: "workspace_runtime_closed" }) : next());
  router.use((req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const match = req.path.match(/^\/api\/(customers|projects|contracts|offers|subscriptions|invoices|tickets|leads|departments)\/([^/]+)/);
    const row = match && S.db[match[1]].find(item => String(item.id) === match[2] || item.invoiceId === match[2]);
    const projectId = row?.projectId || req.body?.projectId, customerId = row?.customerId || req.body?.customerId;
    const project = projectId && S.db.projects.find(item => item.id === projectId);
    const customer = customerId && S.db.customers.find(item => item.id === customerId);
    return row?.custodyReadOnly || project?.custodyReadOnly || customer?.custodyReadOnly ? res.status(403).json({ success: false, code: "custody_read_only", message: "Archived records require ownership review before changes." }) : next();
  });
  appModule.routes(router, ctx, S);
  const open = () => { if (closed) throw failure("CRM runtime is closed"); };
  function exportSnapshot() { open(); return { schema: SCHEMA, version: 1, realm, workspaceId: workspace.id, appKey: "sales", data: clone({ db: S.db, profilePrefs: S.profilePrefs }), sequences: clone(S.db.counters), ...(initialization.fixtureId ? { fixtureId: initialization.fixtureId } : {}) }; }
  function bootstrap(context) {
    open();
    if (context.realm !== realm || context.workspace.id !== workspace.id) throw failure("CRM bootstrap context mismatch");
    const user = identity.findUser(context.actor.effectiveUserId), access = context.tools?.crm?.access;
    if (!user || !S.core.appRole(user) || !["free", "trial", "active", "read_only"].includes(access)) return { appKey: "sales", workspaceId: workspace.id, state: "no_access", contacts: [], projects: [] };
    const role = S.core.appRole(user), req = { sc: { user, role, customer: S.core.customerByAuth(user.id), staff: S.core.staffByAuth(user.id), lang: "en", displayCurrency: null } };
    const projects = S.deals.visibleProjects(req);
    const contacts = S.db.customers.filter(row => role === "customer" ? row.authUserId === user.id : role === "salesman" ? row.ownerUserId === user.id || Boolean(req.sc.staff && row.assignedSalesmanId === req.sc.staff.id) : true);
    return { appKey: "sales", workspaceId: workspace.id, state: access === "read_only" ? "read_only" : contacts.length || projects.length ? "ready" : "empty", contacts: contacts.map(row => ({ id: row.id, fullName: row.fullName, companyName: row.companyName, status: row.status })), projects: projects.map(row => ({ id: row.id, projectName: row.projectName, status: row.status })), capabilities: { canWrite: context.tools.crm.canWrite } };
  }
  function transferOwnership(command) {
    open();
    if (!command.operationId || !Number.isSafeInteger(command.fromUserId) || command.fromUserId < 1 || !["member", "archive"].includes(command.target?.kind)) throw failure("Invalid CRM ownership command");
    const target = command.target.kind === "member" ? identity.findUser(command.target.userId) : null;
    if (command.target.kind === "member" && (!target || target.id === command.fromUserId)) throw failure("CRM ownership target is not an admitted member");
    const fingerprint = JSON.stringify(command), receipts = S.db.ownershipTransfers || (S.db.ownershipTransfers = {});
    if (receipts[command.operationId]) { if (receipts[command.operationId].fingerprint !== fingerprint) throw failure("CRM ownership operation changed"); return clone(receipts[command.operationId].result); }
    const result = { transferred: [], archived: [] }, at = input.clock.iso(input.clock.nowMs?.() ?? input.clock.now());
    const fromStaff = S.core.staffByAuth(command.fromUserId), toStaff = target ? S.core.staffByAuth(target.id) : null;
    // Preserve customer/person and creator/payment attribution. Operational assignments are separate.
    for (const kind of ["customers", "projects"]) for (const row of S.db[kind]) {
      if (fromStaff && row.assignedSalesmanId === fromStaff.id) {
        row.assignedSalesmanId = toStaff?.id ?? null; row.ownerUserId = target?.id ?? null;
        if (!target) { row.ownershipArchivedAt = at; row.custodyReadOnly = true; }
        (target ? result.transferred : result.archived).push(`${kind}:${row.id}`);
      } else if (row.ownerUserId === command.fromUserId) {
        row.ownerUserId = target?.id ?? null; if (!target) { row.ownershipArchivedAt = at; row.custodyReadOnly = true; }
        (target ? result.transferred : result.archived).push(`${kind}:${row.id}`);
      }
    }
    for (const row of S.db.departments) if (Number(row.managerId) === command.fromUserId) { row.managerId = target?.id ?? null; if (!target) { row.ownershipArchivedAt = at; row.custodyReadOnly = true; } (target ? result.transferred : result.archived).push(`department:${row.id}`); }
    for (const row of S.db.tickets) if (Number(row.assigneeId) === command.fromUserId) { row.assigneeId = target?.id ?? null; if (!target) { row.ownershipArchivedAt = at; row.custodyReadOnly = true; } (target ? result.transferred : result.archived).push(`ticket:${row.id}`); }
    for (const row of S.db.leads) if (Number(row.assignedToUserId ?? row.ownerUserId) === command.fromUserId) { row.assignedToUserId = target?.id ?? null; row.ownerUserId = target?.id ?? null; if (!target) { row.ownershipArchivedAt = at; row.custodyReadOnly = true; } (target ? result.transferred : result.archived).push(`lead:${row.id}`); }
    receipts[command.operationId] = { fingerprint, result: clone(result) }; return result;
  }
  function applyCommitted(command) {
    open(); if (!command.snapshot) throw failure("CRM replay requires committed snapshot effects");
    checkSnapshot(command.snapshot);
    for (const key of Object.keys(S.db)) delete S.db[key]; Object.assign(S.db, clone(command.snapshot.data.db));
    S.profilePrefs = clone(command.snapshot.data.profilePrefs);
  }
  function receiveWebsiteIntake(payload, metadata) {
    open();
    if (workspace.id !== 'ws_orgtik' || !metadata?.sourceKey) throw Object.assign(new Error('OrgTik intake authority is required.'), { status: 403 });
    const result = S.crm.receiveIntake(payload, metadata);
    if (!metadata.serviceRequestId) return result;
    const customer = S.db.customers.find(row => row.id === result.leadId), receipt = customer.intakeReceipts[metadata.sourceKey];
    let project = receipt.projectId && S.db.projects.find(row => row.id === receipt.projectId);
    if (!project) {
      const actor = identity.users.find(person => ['admin', 'manager'].includes(S.core.appRole(person)));
      if (!actor) throw Object.assign(new Error('An admitted CRM intake owner is required.'), { status: 503, code: 'orgtik_crm_unavailable' });
      const created = S.deals.createProject({ sc: { role: 'admin', user: actor, lang: 'en' } }, { customerId: customer.id, projectName: metadata.title || payload.company || payload.name, projectDescription: payload.message, projectType: 'client_project' }, { at: input.clock.iso(input.clock.nowMs?.() ?? input.clock.now()), status: 'confirmed', actorUser: actor });
      if (created.error) throw Object.assign(new Error(created.error), { status: 422, code: 'crm_deal_invalid' });
      project = created.value;
      project.source = { kind: 'website_order', reference: metadata.reference, serviceRequestId: metadata.serviceRequestId };
      project.paidSnapshot = clone(metadata.paidSnapshot);
      receipt.projectId = project.id;
    }
    return { ...result, projectId: project.id };
  }
  function suiteFeed(context) {
    const base = bootstrap(context);
    if (base.state === 'no_access') return base;
    const user = identity.findUser(context.actor.effectiveUserId), role = S.core.appRole(user), req = { sc: { user, role, staff: S.core.staffByAuth(user.id), customer: S.core.customerByAuth(user.id), lang: 'en', displayCurrency: null } }, owned = require('../../apps/sales/v3')(S).bootstrap(req);
    const contacts = new Set(owned.contacts.map(row => row.id)), projects = new Set(base.projects.map(row => row.id));
    const notifications = S.db.notifications.filter(row => row.userId === user.id && (!row.data?.customerId || contacts.has(row.data.customerId)) && (!row.data?.projectId || projects.has(row.data.projectId))).map(row => ({ id: row.id, title: row.title, message: row.message, createdAt: row.createdAt, readAt: row.readAt, path: row.data?.projectId ? `/projects/${encodeURIComponent(row.data.projectId)}` : row.data?.customerId ? `/customers/${encodeURIComponent(row.data.customerId)}` : '/dashboard' }));
    return { ...base, contacts: owned.contacts.map(row => ({ id: row.id, fullName: row.fullName, companyId: row.companyId, companyName: row.companyName, email: row.email, status: row.status, currency: row.currency, tags: row.tags, attribution: row.attribution, marketingConsent: row.marketingConsent })), projects: owned.projects.map(row => ({ id: row.id, projectName: row.projectName, status: row.status, contactId: row.contactId, won: row.won, value: row.value, estimatedValue: row.estimatedValue, currency: row.currency })), companies: owned.companies.map(row => ({ id: row.id, name: row.name })), activities: owned.activities.map(row => ({ id: row.id, title: row.text, actor: row.actorName, at: row.at, action: row.kind, path: `/customers/${encodeURIComponent(row.contactId)}` })), notifications };
  }
  return { router, exportSnapshot, bootstrap, suiteFeed, receiveWebsiteIntake,
    provisioningCandidate: (context, id) => { open(); return require('../../apps/sales/v3')(S).provisioningCandidate(context, id); },
    recordProvisioning: (context, id, receipt) => { open(); return require('../../apps/sales/v3')(S).recordProvisioning(context, id, receipt); },
    setMarketingConsent: (context, id, value) => { bootstrap(context); return require('../../apps/sales/v3')(S).setMarketingConsent(context, id, value); },
    marketingContact: (context, id) => { bootstrap(context); return require('../../apps/sales/v3')(S).marketingContact(context, id); },
    createCampaignLead: (context, candidate, id, body) => { bootstrap(context); return require('../../apps/sales/v3')(S).createCampaignLead(context, candidate, id, body); },
    usage: () => { open(); return [{ key: "contacts", used: S.db.customers.length }, { key: "projects", used: S.db.projects.length }, { key: "leads", used: S.db.leads.length }]; }, transferOwnership, applyCommitted, dueTransitions: () => { open(); return S.db.subscriptions.flatMap(row => row.status === "cancelled" ? [] : row.installments.filter(item => !item.invoiceId && item.status !== "paid" && new Date(item.dueDate).getTime() <= (input.clock.nowMs?.() ?? input.clock.now()) + 30 * 864e5).map(item => ({ kind: "sales.schedule.due", subscriptionId: row.id, installmentNumber: item.number }))); }, stageDueTransitions() { open(); S.billing.refreshSchedules({ system: true }); }, close() { closed = true; S.io = null; } };
}
module.exports = { createWorkspaceRuntime, SCHEMA, COUNTERS, LISTS };
