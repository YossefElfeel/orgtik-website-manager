const crypto = require('node:crypto');
const people = require('./workspace-people');
const { makeWorkspaceOperation } = require('./workspace-command');
const clone = value => JSON.parse(JSON.stringify(value));
const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const hash = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const status = (S, invitation) => invitation.status === 'pending' && Date.parse(invitation.expiresAt) <= S.now() ? 'expired' : invitation.status;
function metadata(S, identity, token) {
  const value = people.invitationMetadata(S, token), person = identity.findByEmail(value.email);
  const recipientState = !person ? 'new' : person.deletedAt || !person.isActive && !person.pendingActivation ? 'inactive' : person.pendingActivation ? 'pending_activation' : 'existing';
  return { ...value, requiresSignIn: recipientState === 'existing', recipientState };
}
function mailbox(S, actor, { workspaceId, readOnly = false } = {}) {
  if (readOnly) throw fail(423, 'impersonation_read_only', 'View-as sessions cannot open a private mailbox.');
  return S.db.mailbox.filter(message => String(message.to).toLowerCase() === actor.email.toLowerCase() && (!workspaceId || message.workspaceId === workspaceId)).map(message => {
    const { acceptanceToken, ...safe } = message;
    if (!message.invitationId) return safe;
    const ws = S.workspace(message.workspaceId), invitation = ws?.invitations?.find(row => row.id === message.invitationId);
    const current = invitation && acceptanceToken && hash(acceptanceToken) === invitation.tokenHash;
    const invitationStatus = !invitation ? 'cancelled' : acceptanceToken && !current ? 'superseded' : status(S, invitation);
    return { ...safe, invitationStatus, ...(current && invitationStatus === 'pending' ? { invitePath: `/invite/${acceptanceToken}` } : {}) };
  });
}
function delivery(S, workspace, actor, invitationId, { readOnly = false } = {}) {
  if (readOnly) throw fail(423, 'impersonation_read_only', 'View-as sessions cannot open invitation delivery.');
  people.requireAdmin(workspace, actor);
  const invitation = workspace.invitations?.find(row => row.id === invitationId);
  if (!invitation) throw fail(404, 'invitation_not_found', 'This invitation was not found.');
  const state = status(S, invitation);
  if (state !== 'pending') throw fail(410, 'invitation_unavailable', 'This invitation is no longer pending.');
  const message = S.db.mailbox.find(row => row.workspaceId === workspace.id && row.eventKey === `invite:${invitation.id}:${invitation.version}` && row.acceptanceToken && hash(row.acceptanceToken) === invitation.tokenHash);
  if (!message) throw fail(503, 'delivery_unavailable', 'Invitation delivery is temporarily unavailable.');
  return { invitationId, status: state, expiresAt: invitation.expiresAt, delivery: 'mock', invitePath: `/invite/${message.acceptanceToken}` };
}
function accept(S, identity, token, actor, body, operationId) {
  if (operationId !== undefined && !/^[\w.:-]{1,200}$/.test(operationId)) throw fail(422, 'invalid_operation_id', 'Use a valid acceptance reference.');
  // Recheck recipient credentials/status on every retry, before any receipt can be used.
  const result = people.acceptInvitation(S, identity, token, actor, body);
  const { workspace, invitation } = people.findInvitation(S, token);
  if (operationId) {
    const operation = makeWorkspaceOperation({ id: operationId, workspaceId: workspace.id, actor: { userId: result.userId }, method: 'POST', path: `/invitations/${invitation.id}/accept`, body: { name: body.name || null } });
    // Neither passwords, password-derived fingerprints nor bearer tokens enter business history.
    const key = `${result.userId}:${operationId}`;
    workspace.acceptanceOperations ??= {};
    const prior = workspace.acceptanceOperations[key];
    if (prior && prior.fingerprint !== operation.fingerprint) throw fail(409, 'operation_conflict', 'Retry the original invitation acceptance unchanged.');
    if (!prior) workspace.acceptanceOperations[key] = { fingerprint: operation.fingerprint, invitationId: invitation.id, result: clone(result) };
  }
  return result;
}
function transfer(S, identity, workspace, actor, memberId, operationId) {
  const current = people.requireAdmin(workspace, actor);
  if (!/^[\w.:-]{1,200}$/.test(operationId || '')) throw fail(422, 'operation_id_required', 'Supply the ownership transfer reference.');
  const operation = makeWorkspaceOperation({ id: operationId, workspaceId: workspace.id, actor: { userId: actor.id }, method: 'POST', path: '/ownership-transfer', body: { memberId } });
  workspace.ownershipOperations ??= {};
  const key = `${actor.id}:${operationId}`, previous = workspace.ownershipOperations[key];
  if (previous) { if (previous.fingerprint !== operation.fingerprint) throw fail(409, 'operation_conflict', 'Retry the original ownership transfer unchanged.'); return clone(previous.result); }
  if (current.role !== 'owner') throw fail(403, 'owner_required', 'Only the current owner can transfer ownership.');
  const target = workspace.members.find(member => member.id === memberId), person = target && identity.findByKey(target.userKey);
  if (person?.isActive !== true || person.deletedAt || person.pendingActivation === true) throw fail(422, 'invalid_owner', 'Choose a member with an active account.');
  const result = people.transferOwnership(S, workspace, actor, memberId);
  workspace.ownershipOperations[key] = { fingerprint: operation.fingerprint, result: clone(result) }; return result;
}
module.exports = { metadata, mailbox, delivery, accept, transfer };
