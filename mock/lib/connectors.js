const { TOOL_DEFINITIONS, seatCounts, guestToolRoles } = require('./workspace-context');
const people = require('./workspace-people');
const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const DEFINITIONS = Object.freeze([
  { id: 'tasks-files', source: 'tasks', target: 'files', data: ['Pinned file versions'] },
  { id: 'chat-files', source: 'chat', target: 'files', data: ['Pinned attachments', 'Whiteboards'] },
  { id: 'tasks-hr', source: 'tasks', target: 'hr', accessMode: 'projection', data: ['Approved absence availability'] },
  { id: 'chat-hr', source: 'chat', target: 'hr', accessMode: 'projection', data: ['Approved absence availability'] },
  { id: 'hr-tasks', source: 'hr', target: 'tasks', data: ['Projects', 'Onboarding tasks'] },
  { id: 'crm-tasks', source: 'crm', target: 'tasks', data: ['Follow-up tasks'] },
  { id: 'crm-files', source: 'crm', target: 'files', data: ['Packaged service delivery versions'] },
  { id: 'chat-tasks', source: 'chat', target: 'tasks', data: ['Task from a message'] },
  { id: 'marketing-crm', source: 'marketing', target: 'crm', data: ['Contacts', 'Attribution'] },
  { id: 'marketing-tasks', source: 'marketing', target: 'tasks', data: ['Campaign follow-ups', 'Journey task steps'] },
]);
const admitted = access => access && !['not_subscribed', 'no_access'].includes(access.access) && access.roles?.length;
function state(context, connector, { targetWrite = false } = {}) {
  const source = context.tools[connector.source], target = context.tools[connector.target];
  if (!admitted(source)) return 'source_access_required';
  if (target?.access === 'not_subscribed') return 'not_subscribed';
  if (!admitted(target) && connector.accessMode !== 'projection') return 'no_access';
  if (connector.accessMode === 'projection' && context.member.role === 'guest') return 'role_denied';
  if (context.actor.readOnly || source.access === 'read_only' || target.access === 'read_only') return 'read_only';
  if (connector.enabled === false) return 'disabled';
  if (targetWrite && !target.canWrite) return 'role_denied';
  return 'available';
}
function list(workspace, context) {
  return DEFINITIONS.map(definition => {
    const connector = { ...definition, enabled: workspace.suite?.connectors?.[definition.id] !== false };
    return { ...connector, state: state(context, connector) };
  });
}
function requireConnection(workspace, context, source, target, options) {
  const connector = list(workspace, context).find(row => row.source === source && row.target === target);
  if (!connector) throw fail(422, 'unknown_connection', 'Choose a supported connection.');
  const reason = state(context, connector, options);
  if (reason !== 'available') throw fail(reason === 'read_only' ? 423 : 403, `connection_${reason}`, 'This connection is unavailable. Review tool access, billing and connection settings.');
  return connector;
}
function writable(workspace, context) {
  if (context.actor.readOnly || ['suspended', 'read_only', 'cancelled', 'deleted'].includes(workspace.state)) throw fail(423, 'workspace_read_only', 'This workspace is read-only.');
}
function configure(S, workspace, actor, context, id, enabled) {
  writable(workspace, context);
  const definition = DEFINITIONS.find(row => row.id === id);
  if (!definition || typeof enabled !== 'boolean') throw fail(422, 'invalid_connection', 'Choose a connection and its enabled state.');
  if (!['owner', 'admin'].includes(context.member.role)) require('./workspace-suite').requireToolAdmin(context, definition.source);
  if (!context.tools[definition.source].canWrite) throw fail(403, 'source_permission_required', 'Your source tool is read-only.');
  workspace.suite ??= {}; workspace.suite.connectors ??= {}; workspace.suite.connectors[id] = enabled;
  S.log(actor.key, 'connection_changed', id, { workspaceId: workspace.id, enabled });
  return list(workspace, context).find(row => row.id === id);
}
function requestAccess(S, workspace, actor, context, body) {
  writable(workspace, context);
  const tool = body.tool;
  if (!Object.hasOwn(TOOL_DEFINITIONS, tool) || !TOOL_DEFINITIONS[tool].roles[context.member.role]) throw fail(422, 'unsupported_tool', 'Choose a supported tool for your membership.');
  if (admitted(context.tools[tool])) return { state: 'already_available', tool };
  workspace.suite ??= {}; workspace.suite.requests ??= [];
  const prior = workspace.suite.requests.find(row => row.memberId === context.member.id && row.tool === tool && row.state === 'pending');
  if (prior) return prior;
  const request = { id: S.id('access'), memberId: context.member.id, userId: actor.id, tool, kind: context.tools[tool].access === 'not_subscribed' ? 'add_tool' : 'seat', reason: String(body.reason || '').trim().slice(0, 1000), state: 'pending', at: S.iso(S.now()) };
  workspace.suite.requests.push(request);
  S.log(actor.key, 'access_requested', request.id, { workspaceId: workspace.id, tool });
  for (const member of workspace.members.filter(row => row.status === 'active' && ['owner', 'admin'].includes(row.role))) people.notice(S, workspace, member.email, 'access_requested', `${request.id}:${member.id}`, { requestId: request.id, tool });
  return request;
}
function decideAccess(S, identity, workspace, actor, context, id, decision) {
  writable(workspace, context); people.requireAdmin(workspace, actor);
  if (!['approve', 'deny'].includes(decision)) throw fail(422, 'invalid_decision', 'Approve or decline the request.');
  const request = workspace.suite?.requests?.find(row => row.id === id);
  if (!request) throw fail(404, 'request_not_found', 'This request was not found.');
  if (request.state !== 'pending') return request;
  if (decision === 'approve') {
    const member = workspace.members.find(row => row.id === request.memberId && row.status === 'active');
    if (!member || !TOOL_DEFINITIONS[request.tool].roles[member.role]) throw fail(409, 'membership_changed', 'Review the current membership.');
    const counts = seatCounts(S, workspace, request.tool);
    if (!workspace.lines.some(row => row.tool === request.tool && !['ended', 'deleted'].includes(row.state))) throw fail(409, 'tool_not_subscribed', 'Add the tool before assigning access.');
    if (!member.toolGrants?.[request.tool]?.assigned && counts.available !== null && counts.available < 1) throw fail(409, 'seat_capacity_exhausted', 'Buy or release a seat first.');
    const role = TOOL_DEFINITIONS[request.tool].roles[member.role];
    if (member.role === 'guest' && !guestToolRoles(request.tool).includes(role)) throw fail(422, 'unsupported_guest_role', 'This guest cannot use the tool.');
    member.toolGrants ??= {}; member.toolGrants[request.tool] = { assigned: true, roles: [role] };
    member.revision++; people.revision(workspace);
  }
  Object.assign(request, { state: decision === 'approve' ? 'approved' : 'denied', decidedBy: actor.id, decidedAt: S.iso(S.now()) });
  const recipient = identity.findUser(request.userId);
  if (recipient) people.notice(S, workspace, recipient.email, 'access_decided', `${request.id}:decision`, { requestId: request.id, tool: request.tool, state: request.state });
  S.log(actor.key, 'access_decided', id, { workspaceId: workspace.id, decision });
  return request;
}
function startTrial(S, workspace, actor, context, tool, planId) {
  writable(workspace, context);
  if (context.member.role !== 'owner') throw fail(403, 'owner_required', 'Ask the workspace owner to add the tool.');
  const product = S.db.tools.find(row => row.key === tool), plan = S.db.plans.find(row => row.id === planId && row.tool === tool);
  if (!Object.hasOwn(TOOL_DEFINITIONS, tool) || !product || product.status !== 'live' && product.status !== 'beta' || !plan || plan.status !== 'active' || plan.visibility === 'private' || !(plan.trialDays > 0)) throw fail(422, 'trial_unavailable', 'Choose an available trial plan.');
  if (workspace.lines.some(row => row.tool === tool && (row.trialUsed || row.trialEndsAt))) throw fail(409, 'trial_used', 'This workspace already had a trial of this tool.');
  const existing = workspace.lines.find(row => row.tool === tool && !['ended', 'deleted'].includes(row.state));
  if (existing && existing.state !== 'free') throw fail(409, 'already_subscribed', 'This workspace already has this tool.');
  const price = S.resolveForWorkspace(plan.id, workspace, 'monthly');
  if (!price) throw fail(422, 'price_unavailable', 'This plan has no price in the workspace region.');
  const end = S.iso(S.now() + plan.trialDays * 864e5), line = { id: S.id('ln'), tool, planId: plan.id, cycle: 'monthly', state: 'trialing', trialEndsAt: end, periodEnd: end, startedAt: S.iso(S.now()), trialUsed: true, snapshot: { amount: price.amount, unit: price.unit, quantity: price.quantity, currency: price.currency, source: price.source, priceVersion: S.db.priceVersion } };
  if (existing) Object.assign(existing, { state: 'ended', endedAt: S.iso(S.now()), replacedBy: line.id });
  workspace.lines.unshift(line);
  S.log(actor.key, 'trial_start', workspace.id, { plan: plan.id });
  return line;
}
module.exports = { DEFINITIONS, admitted, state, list, requireConnection, writable, configure, requestAccess, decideAccess, startTrial };
