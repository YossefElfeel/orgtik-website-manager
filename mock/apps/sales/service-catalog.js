// OrgTik's CRM edits the existing platform service catalog; customer CRMs have no authority here.
const clone = value => JSON.parse(JSON.stringify(value));
const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const LOCALES = ['en', 'ar', 'de', 'fr', 'it'];
function authorize(principal, { write = false, catalog = true } = {}) {
  const context = principal?.context.workspaceContext, permissions = principal?.context.staffAccess?.permissions.admin || [], access = context?.tools.crm;
  if (context?.workspace.kind !== 'orgtik_internal' || !access || ['not_subscribed', 'no_access'].includes(access.access)) throw fail(403, 'orgtik_crm_required', 'The OrgTik internal CRM manages services.');
  if (write && (principal.readOnly || !access.canWrite || access.access === 'read_only')) throw fail(423, 'service_read_only', 'This CRM session is read-only.');
  if (!permissions.includes('services:view') || catalog && write && !permissions.includes('services:edit')) throw fail(403, 'service_permission_required', 'Your current OrgTik service permission is required.');
  return permissions;
}
function translated(value, array = false) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(locale => !LOCALES.includes(locale)) || LOCALES.some(locale => array ? !Array.isArray(value[locale]) || value[locale].length > 12 || value[locale].some(text => typeof text !== 'string' || !text.trim() || text.length > 500) : typeof value[locale] !== 'string' || !value[locale].trim() || value[locale].length > 2000)) throw fail(422, 'translations_required', 'Supply the five supported translations.');
  return clone(value);
}
function catalog(S, principal) {
  authorize(principal);
  return { managedIn: 'crm', priceVersion: S.db.priceVersion, services: clone(S.db.services), offers: S.db.websiteOffers.filter(row => row.kind === 'service').map(row => ({ ...clone(row), regionalPrices: Object.fromEntries(S.db.zones.map(zone => [zone.id, S.db.grid[`${row.serviceId}:monthly:${zone.id}`] ?? null])), countryPrices: Object.fromEntries(Object.entries(S.db.countries).map(([code, country]) => [code, country.fixed?.[`${row.serviceId}:monthly`] ?? null])) })), bundles: clone(S.db.websiteOfferBundles.filter(row => row.kind === 'service')), zones: clone(S.db.zones), countries: Object.entries(S.db.countries).map(([code, country]) => ({ code, name: country.name || code, currency: country.currency, zone: country.zone })), currencies: clone(S.db.currencies), canPublish: !principal.readOnly && principal.context.workspaceContext.tools.crm.canWrite && principal.context.staffAccess.permissions.admin.includes('services:edit') };
}
function saveOffer(S, principal, id, body) {
  authorize(principal, { write: true });
  const offer = S.db.websiteOffers.find(row => row.id === id && row.kind === 'service');
  if (!offer) throw fail(404, 'service_offer_not_found', 'This service offer was not found.');
  if (!body || Object.keys(body).some(key => !['name', 'description', 'capabilities', 'department', 'departmentName', 'icon', 'monthlyCHF', 'regionalPrices', 'countryPrices', 'status'].includes(key))) throw fail(422, 'invalid_service_offer', 'Choose supported service catalog fields.');
  const patch = {};
  for (const key of ['name', 'description', 'departmentName']) if (body[key] !== undefined) patch[key] = translated(body[key]);
  if (body.capabilities !== undefined) patch.capabilities = translated(body.capabilities, true);
  if (body.department !== undefined) { if (!['design', 'development', 'marketing', 'it-support'].includes(body.department)) throw fail(422, 'invalid_department', 'Choose a service department.'); patch.department = body.department; }
  if (body.icon !== undefined) { if (!/^[a-z][a-z0-9-]{0,59}$/.test(body.icon)) throw fail(422, 'invalid_icon', 'Choose a catalog icon name.'); patch.icon = body.icon; }
  if (body.monthlyCHF !== undefined) { if (!Number.isFinite(body.monthlyCHF) || body.monthlyCHF < 0 || body.monthlyCHF > 1000000) throw fail(422, 'invalid_service_price', 'Enter a valid monthly CHF price.'); patch.monthlyCHF = body.monthlyCHF; }
  for (const key of ['regionalPrices', 'countryPrices']) if (body[key] !== undefined) {
    const prices = body[key], names = key === 'regionalPrices' ? S.db.zones.map(zone => zone.id) : Object.keys(S.db.countries);
    if (!prices || typeof prices !== 'object' || Array.isArray(prices) || Object.entries(prices).some(([name, value]) => !names.includes(name) || value !== null && (!Number.isFinite(value) || value < 0 || value > 1000000))) throw fail(422, 'invalid_regional_price', 'Choose known regions/countries and valid prices; null clears an override.');
    patch[key] = clone(prices);
  }
  if (patch.monthlyCHF !== undefined && patch.countryPrices?.CH !== undefined && patch.countryPrices.CH !== patch.monthlyCHF) throw fail(422, 'conflicting_chf_price', 'The CHF price and Swiss override must agree.');
  if (body.status !== undefined) { if (!['active', 'archived'].includes(body.status)) throw fail(422, 'invalid_service_status', 'Choose active or archived.'); patch.status = body.status; }
  offer.draft = { ...(offer.draft || {}), ...patch, updatedAt: S.iso(S.now()), updatedBy: principal.user.key };
  S.log(principal.user.key, 'service_catalog_drafted', id, { workspaceId: principal.context.workspaceContext.workspace.id });
  return clone(offer);
}
function saveBundle(S, principal, id, body) {
  authorize(principal, { write: true });
  const bundle = S.db.websiteOfferBundles.find(row => row.id === id && row.kind === 'service');
  if (!bundle) throw fail(404, 'service_bundle_not_found', 'This service bundle was not found.');
  if (!body || Object.keys(body).some(key => !['name', 'ids', 'why', 'recommended'].includes(key))) throw fail(422, 'invalid_service_bundle', 'Choose supported service bundle fields.');
  const patch = {};
  for (const key of ['name', 'why']) if (body[key] !== undefined) patch[key] = translated(body[key]);
  if (body.ids !== undefined) { if (!Array.isArray(body.ids) || !body.ids.length || body.ids.length > 30 || new Set(body.ids).size !== body.ids.length || body.ids.some(offerId => !S.db.websiteOffers.some(offer => offer.id === offerId && offer.kind === 'service'))) throw fail(422, 'invalid_bundle_members', 'Choose unique service offers.'); patch.ids = [...body.ids]; }
  if (body.recommended !== undefined) { if (typeof body.recommended !== 'boolean') throw fail(422, 'invalid_recommendation', 'Choose the recommendation state.'); patch.recommended = body.recommended; }
  bundle.draft = { ...(bundle.draft || {}), ...patch, updatedAt: S.iso(S.now()), updatedBy: principal.user.key };
  return clone(bundle);
}
function applyDrafts(S, actorKey) {
  const changed = [];
  for (const offer of S.db.websiteOffers.filter(row => row.kind === 'service' && row.draft)) {
    const { updatedAt, updatedBy, status, regionalPrices, countryPrices, ...draft } = offer.draft;
    const service = S.db.services.find(row => row.id === offer.serviceId), plan = S.db.plans.find(row => row.id === offer.serviceId);
    if (!service || !plan) throw fail(409, 'service_mapping_unavailable', 'Review the service fulfillment mapping.');
    if (draft.monthlyCHF !== undefined) {
      const rate = S.pricing.rate(S.db, 'USD', 'CHF'); if (!(rate > 0)) throw fail(503, 'price_unavailable', 'The platform exchange rate is unavailable.');
      S.db.countries.CH.fixed ??= {}; S.db.countries.CH.fixed[`${offer.serviceId}:monthly`] = draft.monthlyCHF;
      plan.defaultUsd = { ...plan.defaultUsd, monthly: draft.monthlyCHF / rate };
    }
    for (const [zone, price] of Object.entries(regionalPrices || {})) { const key = `${offer.serviceId}:monthly:${zone}`; if (price === null) delete S.db.grid[key]; else S.db.grid[key] = price; }
    for (const [code, price] of Object.entries(countryPrices || {})) { const country = S.db.countries[code], key = `${offer.serviceId}:monthly`; country.fixed ??= {}; if (price === null) delete country.fixed[key]; else country.fixed[key] = price; }
    Object.assign(offer, clone(draft)); if (draft.name) { service.name = clone(draft.name); plan.name = clone(draft.name); }
    if (status) service.status = status;
    delete offer.draft; offer.publishedAt = S.iso(S.now()); offer.publishedBy = actorKey; changed.push(offer.id);
  }
  for (const bundle of S.db.websiteOfferBundles.filter(row => row.kind === 'service' && row.draft)) { const { updatedAt, updatedBy, ...draft } = bundle.draft; Object.assign(bundle, clone(draft)); delete bundle.draft; changed.push(bundle.id); }
  if (S.db.servicePricingPolicyDraft) { S.db.servicePricingPolicy = clone(S.db.servicePricingPolicyDraft); delete S.db.servicePricingPolicyDraft; changed.push('service-pricing-policy'); }
  if (changed.length) S.db.priceVersion++;
  const result = { managedIn: 'crm', changed, priceVersion: S.db.priceVersion, at: S.iso(S.now()), applyMode: 'new_public_quotes' };
  return result;
}
function captureDrafts(S) { return { offers: S.db.websiteOffers.filter(row => row.kind === 'service' && row.draft).map(row => ({ id: row.id, draft: clone(row.draft) })), bundles: S.db.websiteOfferBundles.filter(row => row.kind === 'service' && row.draft).map(row => ({ id: row.id, draft: clone(row.draft) })), policy: S.db.servicePricingPolicyDraft ? clone(S.db.servicePricingPolicyDraft) : null }; }
function setDrafts(S, value) { for (const row of S.db.websiteOffers) if (row.kind === 'service') delete row.draft; for (const row of S.db.websiteOfferBundles) if (row.kind === 'service') delete row.draft; delete S.db.servicePricingPolicyDraft; for (const { id, draft } of value.offers) { const row = S.db.websiteOffers.find(row => row.id === id && row.kind === 'service'); if (!row) throw fail(409, 'catalog_changed', 'Review the current catalog.'); row.draft = clone(draft); } for (const { id, draft } of value.bundles) { const row = S.db.websiteOfferBundles.find(row => row.id === id && row.kind === 'service'); if (!row) throw fail(409, 'catalog_changed', 'Review the current bundles.'); row.draft = clone(draft); } if (value.policy) S.db.servicePricingPolicyDraft = clone(value.policy); }
function history(S, result, drafts, by) { const workspace = S.workspace('ws_orgtik'); workspace.suite ??= {}; workspace.suite.serviceHistory ??= []; workspace.suite.serviceHistory.unshift({ ...clone(result), by, drafts: clone(drafts) }); workspace.suite.serviceHistory = workspace.suite.serviceHistory.slice(0, 30); S.log(by, 'service_catalog_published', String(result.priceVersion), { workspaceId: workspace.id, tool: 'crm', changed: result.changed, applyMode: result.applyMode }); }
function publish(S, principal, operationId, { effectiveAt } = {}) {
  authorize(principal, { write: true });
  if (!/^[\w.:-]{1,200}$/.test(operationId || '')) throw fail(422, 'operation_id_required', 'Supply the original publish reference.');
  const workspace = S.workspace(principal.context.workspaceContext.workspace.id), key = `${principal.user.id}:service-publish:${operationId}`;
  const operation = require('../../lib/workspace-command').makeWorkspaceOperation({ id: operationId, workspaceId: workspace.id, actor: { userId: principal.user.id }, method: 'POST', path: '/services/catalog/publish', body: { effectiveAt: effectiveAt || null } });
  const prior = workspace.commandOperations?.[key];
  if (prior) { if (prior.fingerprint && prior.fingerprint !== operation.fingerprint) throw fail(409, 'operation_conflict', 'This publish reference was already used differently.'); return clone(prior.result); }
  const drafts = captureDrafts(S);
  if (JSON.stringify(drafts).length > 100000) throw fail(422, 'catalog_batch_limit', 'Publish a smaller catalog batch.');
  let result;
  if (effectiveAt) {
    const at = Date.parse(effectiveAt); if (!Number.isFinite(at) || at <= S.now() || at > S.now() + 366 * 864e5) throw fail(422, 'invalid_publish_date', 'Choose a future publish date within one year.');
    if (!drafts.offers.length && !drafts.bundles.length && !drafts.policy) throw fail(409, 'no_draft_changes', 'Save changes before scheduling.');
    workspace.suite ??= {}; workspace.suite.serviceSchedules ??= [];
    if (workspace.suite.serviceSchedules.filter(row => row.state === 'scheduled').length >= 20) throw fail(422, 'schedule_limit', 'Review existing schedules first.');
    const scheduled = { id: S.id('service_schedule'), state: 'scheduled', effectiveAt: S.iso(at), by: principal.user.key, drafts, createdAt: S.iso(S.now()) };
    workspace.suite.serviceSchedules.push(scheduled); setDrafts(S, { offers: [], bundles: [], policy: null });
    result = { managedIn: 'crm', id: scheduled.id, state: 'scheduled', effectiveAt: scheduled.effectiveAt, changed: [...drafts.offers, ...drafts.bundles].map(row => row.id), priceVersion: S.db.priceVersion };
  } else { result = applyDrafts(S, principal.user.key); history(S, result, drafts, principal.user.key); }
  workspace.commandOperations ??= {}; workspace.commandOperations[key] = { fingerprint: operation.fingerprint, result: clone(result) };
  return result;
}
function applyScheduled(S) {
  const workspace = S.workspace('ws_orgtik'); if (!workspace) return;
  for (const row of (workspace.suite?.serviceSchedules || []).filter(row => row.state === 'scheduled').sort((a, b) => Date.parse(a.effectiveAt) - Date.parse(b.effectiveAt))) if (Date.parse(row.effectiveAt) <= S.now()) {
    const working = captureDrafts(S); setDrafts(S, row.drafts); const result = applyDrafts(S, row.by); setDrafts(S, working); row.state = 'published'; row.publishedAt = S.iso(S.now()); row.priceVersion = result.priceVersion; history(S, { ...result, scheduleId: row.id }, row.drafts, row.by);
  }
}
function savePolicy(S, principal, body) {
  authorize(principal, { write: true });
  const { durationSavings, countBands } = body;
  if (!durationSavings || Object.keys(durationSavings).some(key => !['1', '3', '6', '12'].includes(key)) || [1, 3, 6, 12].some(month => !Number.isFinite(durationSavings[month]) || durationSavings[month] < 0 || durationSavings[month] > 60) || durationSavings[1] !== 0 || !Array.isArray(countBands) || countBands.length !== 4 || [1, 2, 3, 5].some(min => !countBands.some(band => band.min === min && Number.isFinite(band.saving) && band.saving >= 0 && band.saving <= 60)) || countBands.find(band => band.min === 1).saving !== 0) throw fail(422, 'invalid_service_policy', 'Use the four supported terms and quantity bands with discounts from 0 to 60%.');
  S.db.servicePricingPolicyDraft = { durationSavings: clone(durationSavings), countBands: clone(countBands).sort((a, b) => a.min - b.min) }; return clone(S.db.servicePricingPolicyDraft);
}
function publication(S, principal) {
  authorize(principal); applyScheduled(S); const workspace = S.workspace('ws_orgtik');
  return { drafts: captureDrafts(S), policy: clone(S.db.servicePricingPolicy || { durationSavings: { 1: 0, 3: 5, 6: 10, 12: 15 }, countBands: [{ min: 1, saving: 0 }, { min: 2, saving: 5 }, { min: 3, saving: 10 }, { min: 5, saving: 15 }] }), history: clone(workspace.suite?.serviceHistory || []), scheduled: (workspace.suite?.serviceSchedules || []).map(({ drafts, ...row }) => clone(row)) };
}
function preview(S, principal, country = 'CH') {
  authorize(principal); if (!Object.hasOwn(S.db.countries, country)) throw fail(422, 'invalid_country', 'Choose a known country.');
  const candidate = { ...S, db: clone(S.db), log: () => {} }; candidate.workspace = id => candidate.db.workspaces.find(row => row.id === id);
  candidate.resolveForWorkspace = (planId, workspace, cycle = 'monthly', quantity) => S.pricing.resolveWorkspaceLine(candidate.db, { planId, cycle, workspace, seats: quantity ?? S.purchasedSeats(workspace, candidate.db.plans.find(row => row.id === planId)?.tool, planId) });
  applyDrafts(candidate, principal.user.key);
  const currency = candidate.db.countries[country].currency;
  return require('../admin/website-offers').publicCatalog(candidate, { region: { country, currency, source: 'service-preview' }, workspace: { country, currency, billing: { country }, members: [], lines: [] } });
}
function cancelSchedule(S, principal, id) { authorize(principal, { write: true }); const row = S.workspace('ws_orgtik').suite?.serviceSchedules?.find(row => row.id === id); if (!row || row.state !== 'scheduled') throw fail(409, 'schedule_unavailable', 'This schedule is no longer pending.'); row.state = 'cancelled'; row.cancelledAt = S.iso(S.now()); row.cancelledBy = principal.user.key; return { id, state: row.state }; }
function payment(S, row) {
  const order = row.source?.kind === 'website_order' && S.db.publicWebsiteOrders.find(value => value.snapshot?.reference === row.source.reference && value.snapshot.paymentStatus === 'succeeded');
  if (order && S.db.websiteOrderLinks.some(link => link.reference === row.source.reference && link.workspaceId === row.workspaceId && link.requests.some(request => request.requestId === row.id))) {
    const line = order.snapshot.groups.flatMap(group => group.lines).find(value => value.catalogId === row.catalogId && value.fulfillment !== 'tool');
    if (line) return { prepaid: true, reference: order.snapshot.reference, currency: order.snapshot.currency, decimals: order.snapshot.decimals, amountMinor: line.total, paidAt: order.snapshot.createdAt, months: line.months };
  }
  const invoice = row.invoiceId && S.db.invoices.find(value => value.id === row.invoiceId && value.workspaceId === row.workspaceId && value.state === 'paid');
  return invoice ? { prepaid: false, invoiceId: invoice.id, currency: invoice.currency, amount: invoice.total, paidAt: invoice.paidAt || invoice.issuedAt } : null;
}
function requests(S, principal) {
  const permissions = authorize(principal, { catalog: false }), assignedOnly = permissions.includes('services:edit:assigned') && !permissions.includes('services:edit');
  const writable = !principal.readOnly && principal.context.workspaceContext.tools.crm.canWrite;
  return S.db.serviceRequests.filter(row => !assignedOnly || row.assignee === principal.user.key).map(row => { const paid = payment(S, row), canEdit = writable && (permissions.includes('services:edit') || assignedOnly && row.assignee === principal.user.key); return { ...clone(row), prepaid: Boolean(paid?.prepaid), paidSource: paid, managedIn: 'crm', workspaceName: S.workspace(row.workspaceId)?.name, currency: S.workspace(row.workspaceId)?.currency, capabilities: { canEdit, canAssign: writable && permissions.includes('services:edit'), canStart: Boolean(canEdit && paid && (row.state === 'awaiting_payment' || paid.prepaid && row.state === 'under_review')), canDeliver: canEdit && row.state === 'in_progress' } }; });
}
function staff(S, identity, principal) {
  authorize(principal, { catalog: false });
  const context = require('../../lib/workspace-context'), permission = require('../admin/permissions');
  return S.workspace('ws_orgtik').members.filter(member => member.status === 'active' && member.role !== 'guest').flatMap(member => {
    const person = identity.findByKey(member.userKey), rights = permission.permissionsFor(S.db.staffRoles[member.userKey] || []);
    if (!person || person.isActive !== true || person.deletedAt || person.pendingActivation || !context.resolveWorkspaceContext(S, identity, person, { workspaceId: 'ws_orgtik' }).tools.crm.canWrite || !rights.some(right => ['services:edit', 'services:edit:assigned'].includes(right))) return [];
    return [{ key: person.key, id: person.id, name: identity.fullName(person) }];
  });
}
function requestAction(S, identity, principal, id, body, { packageFile } = {}) {
  const permissions = authorize(principal, { write: true, catalog: false }), row = S.db.serviceRequests.find(request => request.id === id);
  if (!row || permissions.includes('services:edit:assigned') && !permissions.includes('services:edit') && row.assignee !== principal.user.key) throw fail(404, 'service_request_not_found', 'This request was not found.');
  if (!permissions.includes('services:edit') && !(permissions.includes('services:edit:assigned') && row.assignee === principal.user.key)) throw fail(403, 'service_permission_required', 'Your role cannot change this request.');
  const at = S.iso(S.now()), transitions = { review: ['new', 'under_review'], start: ['awaiting_payment', 'in_progress'], hold: ['in_progress', 'on_hold'], resume: ['on_hold', 'in_progress'] };
  const paid = payment(S, row), prepaid = paid?.prepaid;
  if (body.action === 'start' && !paid) throw fail(409, 'service_payment_required', 'The customer must complete the actual mock payment before work starts.');
  if (body.action === 'start' && prepaid && row.state === 'under_review') { transitions.start = ['under_review', 'in_progress']; row.periodStart = at; row.periodEnd = S.iso(S.now() + row.termMonths * 30 * 864e5); }
  if (transitions[body.action]) { const [from, to] = transitions[body.action]; if (row.state !== from) throw fail(409, 'wrong_service_state', 'Review the current service state.'); row.state = to; }
  else if (body.action === 'assign') { if (!permissions.includes('services:edit')) throw fail(403, 'service_assignment_required', 'An OrgTik service administrator assigns delivery ownership.'); if (!staff(S, identity, principal).some(person => person.key === body.assignee)) throw fail(422, 'invalid_service_assignee', 'Choose eligible active OrgTik CRM staff.'); row.assignee = body.assignee; }
  else if (body.action === 'message') { const text = String(body.text || '').trim(); if (!text || text.length > 5000) throw fail(422, 'message_required', 'Write a short message.'); row.messages.push({ by: 'staff', author: principal.user.key, at, text }); }
  else if (body.action === 'deliver') { const note = String(body.note || '').trim(); if (row.state !== 'in_progress' || !note || note.length > 5000) throw fail(422, 'delivery_required', 'Describe the delivery for work in progress.'); if (body.files !== undefined && (!Array.isArray(body.files) || body.files.length > 10) || body.files?.length && !packageFile) throw fail(422, 'packaged_assets_only', 'Choose up to ten packaged Files versions.'); const files = body.files?.length ? body.files.map(packageFile) : []; row.deliveries.push({ id: S.id('dl'), at, note, files, createdByUserId: principal.user.id, autoApproveAt: S.iso(S.now() + S.db.settings.services.autoApproveDays * 864e5) }); row.state = 'in_review'; }
  else if (body.action === 'quote') { if (prepaid) throw fail(409, 'service_already_paid', 'This website service is already paid. Complete onboarding and start its service period.'); if (!['under_review', 'rejected', 'expired', 'cancelled', 'quoted'].includes(row.state) || !Array.isArray(body.lines) || !body.lines.length || body.lines.length > 30 || body.lines.some(line => typeof line.label !== 'string' || !line.label.trim() || !Number.isFinite(line.amount)) || body.lines.reduce((sum, line) => sum + line.amount, 0) < 0 || !Number.isInteger(body.validDays || 14) || (body.validDays || 14) < 1 || (body.validDays || 14) > 90) throw fail(422, 'invalid_service_quote', 'Add valid quote lines and a review period.'); const currency = S.workspace(row.workspaceId).currency; row.quote = { currency, lines: clone(body.lines), total: S.pricing.toDecimals(body.lines.reduce((sum, line) => sum + line.amount, 0), S.db.currencies[currency].decimals), validUntil: S.iso(S.now() + (body.validDays || 14) * 864e5), sentAt: at }; row.state = 'quoted'; }
  else if (body.action === 'milestone') { const milestone = row.milestones[body.index]; if (!milestone || !['pending', 'in_progress', 'done'].includes(body.state)) throw fail(422, 'invalid_milestone', 'Choose a current milestone and state.'); milestone.state = body.state; }
  else if (body.action === 'cancel') { if (!['new', 'under_review', 'awaiting_payment', 'on_hold'].includes(row.state)) throw fail(409, 'wrong_service_state', 'This service cannot be cancelled now.'); row.state = 'cancelled'; }
  else throw fail(422, 'invalid_service_action', 'Choose a supported service action.');
  row.updatedAt = at; S.log(principal.user.key, `service_${body.action}`, id, { workspaceId: row.workspaceId, managedIn: 'crm' }); return clone(row);
}
module.exports = { authorize, catalog, saveOffer, saveBundle, publish, applyScheduled, publication, preview, savePolicy, cancelSchedule, requests, staff, requestAction };
