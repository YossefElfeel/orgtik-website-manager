const { makeWorkspaceOperation } = require('./workspace-command');
const { permissionsFor } = require('../apps/admin/permissions');
const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const canProvision = (S, principal, context) => context.workspace.kind === 'orgtik_internal' && context.workspace.id === 'ws_orgtik' && context.tools.crm?.canWrite && context.tools.crm.roles.some(role => ['admin', 'manager'].includes(role)) && permissionsFor(S.db.staffRoles[principal.user.key] || []).includes('workspaces:edit');
function provision({ S, identity, principal, context, runtime, projectId, body, operationId }) {
  if (!canProvision(S, principal, context)) throw fail(403, 'provisioning_permission_required', 'An authorised OrgTik CRM workspace administrator must provision this customer.');
  if (!/^[\w.:-]{1,140}$/.test(operationId || '')) throw fail(422, 'operation_id_required', 'Supply the original provisioning reference.');
  const candidate = runtime.provisioningCandidate(context, projectId);
  if (!candidate.won || !candidate.customer) throw fail(409, 'won_project_required', 'Confirm the actual customer contract before provisioning a workspace.');
  const name = String(body.name || candidate.customer.companyName || candidate.customer.name).trim(), country = body.country || 'CH';
  if (!name || name.length > 200 || !Object.hasOwn(S.db.countries, country)) throw fail(422, 'invalid_workspace', 'Choose a workspace name and supported country.');
  const operation = makeWorkspaceOperation({ id: operationId, workspaceId: context.workspace.id, actor: { userId: principal.user.id }, method: 'POST', path: `/api/suite/crm/projects/${candidate.projectId}/provision`, body: { name, country } });
  if (candidate.receipt) {
    if (candidate.receipt.fingerprint !== operation.fingerprint) throw fail(409, 'operation_conflict', 'This project was already provisioned with a different action.');
    const workspace = S.workspace(candidate.receipt.workspaceId);
    if (!workspace || workspace.state === 'deleted') throw fail(409, 'provisioned_workspace_unavailable', 'Review the original customer workspace before provisioning again.');
    return candidate.receipt;
  }
  const person = candidate.customer.authUserId ? identity.findUser(candidate.customer.authUserId) : identity.findByEmail(candidate.customer.email);
  if (!person) return { state: 'awaiting_owner_signup', projectId: candidate.projectId, customerId: candidate.customer.id, email: candidate.customer.email, signupPath: '/register' };
  if (person.email.toLowerCase() !== candidate.customer.email.toLowerCase() || person.isActive !== true || person.deletedAt || person.pendingActivation) throw fail(409, 'owner_activation_required', 'The actual customer account must be active and match this contact before provisioning.');
  if (S.db.workspaces.filter(row => row.state !== 'deleted' && row.members.some(member => member.userKey === person.key && member.role === 'owner')).length >= 20) throw fail(422, 'workspace_limit', 'This customer already owns twenty workspaces.');
  const workspace = S.createWorkspace({ wsId: S.id('ws'), ownerKey: person.key, name, email: person.email, country, currency: S.db.countries[country].currency });
  workspace.crmSource = { workspaceId: context.workspace.id, projectId: candidate.projectId, customerId: candidate.customer.id, contractId: candidate.contractId };
  const receipt = { state: 'provisioned', workspaceId: workspace.id, workspaceName: workspace.name, ownerUserId: person.id, projectId: candidate.projectId, customerId: candidate.customer.id, contractId: candidate.contractId, at: S.iso(S.now()), fingerprint: operation.fingerprint, provisioning: 'empty_customer_workspace' };
  runtime.recordProvisioning(context, candidate.projectId, receipt);
  S.notifyOwner(workspace, 'crm_workspace_created', { title: `Your workspace ${workspace.name} is ready`, projectId: candidate.projectId }, `crm-workspace:${candidate.projectId}`);
  S.log(principal.user.key, 'crm_workspace_provisioned', workspace.id, { workspaceId: context.workspace.id, customerWorkspaceId: workspace.id, projectId: candidate.projectId });
  return receipt;
}
module.exports = { provision, canProvision };
