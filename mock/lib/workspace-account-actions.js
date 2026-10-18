const people = require('./workspace-people');
const { seatCounts } = require('./workspace-context');
const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
function createAccountActions({ S, identity, principal, workspace, sessionStore, authority, token, frame }) {
  const actor = identity.findUser(principal.user.id), member = workspace && people.memberOf(workspace, actor);
  const ownPerson = () => { if (principal.readOnly) throw fail(423, 'account_read_only', 'View-as sessions cannot change this account.'); if (!actor || actor.isActive !== true || actor.deletedAt || actor.pendingActivation) throw fail(403, 'account_access_required', 'Your current active account is required.'); };
  const writable = () => { ownPerson(); if (!member) throw fail(403, 'account_access_required', 'Your current workspace membership is required.'); };
  const sessionList = async () => {
    if (principal.readOnly) throw fail(403, 'session_owner_required', 'Session information belongs to its signed-in owner.');
    const doc = await sessionStore.read();
    const iso = value => value ? new Date(typeof value === 'number' ? value > 1e12 ? value : value * 1000 : value).toISOString() : null;
    return Object.values(doc.state.sessions).filter(row => String(row.principalUserId) === String(actor.id)).map(row => ({ id: row.sid, current: row.sid === principal.session.sid, createdAt: iso(row.createdAt), lastSeenAt: iso(row.lastSeenAt || row.createdAt), revokedAt: iso(row.revokedAt), scopes: [...new Set(Object.values(doc.state.families).filter(family => family.sid === row.sid && !family.revokedAt).map(family => family.accessAudience))] }));
  };
  return { async execute(kind, body = {}) {
    if (kind === 'sessions.list') return sessionList();
    if (kind === 'audit.list') return S.db.audit.filter(row => workspace ? row.workspaceId === workspace.id && (['owner', 'admin'].includes(member?.role) || row.by === actor.key || row.effectiveUserId === actor.id) : row.by === actor.key).slice(0, 300).map((row, index) => ({ id: row.id || `${row.at}:${index}`, action: row.action, target: row.target, workspaceId: row.workspaceId || null, actorUserId: row.actorUserId || identity.findByKey(row.by)?.id || null, effectiveUserId: row.effectiveUserId || null, by: row.by, at: row.at }));
    if (['sessions.revoke', 'workspace.create', 'person.delete'].includes(kind)) ownPerson(); else writable();
    if (kind === 'sessions.revoke') {
      if (body.all !== true && body.id !== principal.session.sid) throw fail(422, 'session_action_required', 'Sign out this session or all your sessions.');
      await authority.logout(token, body.all === true); frame.accountSessionExit = true;
      return { sessionAction: 'signed_out' };
    }
    if (kind === 'member.status') {
      if (workspace.state === 'suspended') throw fail(423, 'workspace_read_only', 'This workspace is read-only.');
      people.requireAdmin(workspace, actor);
      const target = workspace.members.find(row => row.id === body.memberId);
      if (!target || target.role === 'owner' || target.id === member.id) throw fail(409, 'protected_membership', 'The owner and your own membership cannot be suspended here.');
      const person = identity.findByKey(target.userKey);
      if (!person || person.isActive !== true || person.deletedAt || person.pendingActivation) throw fail(409, 'person_inactive', 'This person must activate their account before membership access can be restored.');
      const staffEpoch = S.db.staffAccessEpochs?.[target.userKey] ?? 0;
      if (workspace.kind === 'orgtik_internal' && (S.db.staffAccessEpochs !== undefined && (!S.db.staffAccessEpochs || typeof S.db.staffAccessEpochs !== 'object' || Array.isArray(S.db.staffAccessEpochs)) || !Number.isSafeInteger(staffEpoch) || staffEpoch < 0 || staffEpoch === Number.MAX_SAFE_INTEGER)) throw fail(503, 'staff_epoch_invalid', 'Staff access recovery is temporarily required.');
      if (!['suspended', 'active'].includes(body.status) || !['active', 'suspended'].includes(target.status)) throw fail(422, 'invalid_member_status', 'Suspend or restore an active membership.');
      if (body.status === 'active' && target.status === 'suspended') for (const [tool, grant] of Object.entries(target.toolGrants || {})) if (grant.assigned) { const counts = seatCounts(S, workspace, tool); if (counts.available !== null && counts.available < 1) throw fail(409, 'seat_capacity_exhausted', 'Release or buy an available seat before restoring access.'); }
      if (target.status !== body.status) { target.status = body.status; target.accessEpoch = (target.accessEpoch || 0) + 1; target.revision++; people.revision(workspace); if (workspace.kind === 'orgtik_internal') { S.db.staffAccessEpochs ??= {}; S.db.staffAccessEpochs[target.userKey] = staffEpoch + 1; } }
      S.log(actor.key, `member_${body.status}`, target.id, { workspaceId: workspace.id });
      return { id: target.id, status: target.status };
    }
    if (kind === 'member.role') {
      if (workspace.state === 'suspended') throw fail(423, 'workspace_read_only', 'This workspace is read-only.');
      const role = body.customRoleId ? workspace.suite?.account?.customRoles?.find(row => row.id === body.customRoleId)?.baseRole : body.role;
      if (!['admin', 'member', 'guest'].includes(role)) throw fail(422, 'invalid_role', 'Choose a configured canonical membership role.');
      const result = people.changeMember(S, workspace, actor, body.memberId, { role });
      if (body.customRoleId) result.customRoleId = body.customRoleId; else delete result.customRoleId;
      return { id: result.id, role: result.role, customRoleId: result.customRoleId || null };
    }
    if (kind === 'team.inviteMany') {
      if (workspace.state === 'suspended') throw fail(423, 'workspace_read_only', 'This workspace is read-only.');
      people.requireAdmin(workspace, actor);
      if (!Array.isArray(body.rows) || !body.rows.length || body.rows.length > 50 || !/^[\w.:-]{1,140}$/.test(body.operationId || '')) throw fail(422, 'invalid_invite_batch', 'Choose up to fifty invitation rows and the original action reference.');
      const result = { invited: [], failed: [] };
      for (const [index, row] of body.rows.entries()) { try { result.invited.push(people.invite(S, identity, workspace, actor, row, { operationId: `${body.operationId}:${index}` })); } catch (error) { result.failed.push({ row: index + 1, email: String(row?.email || ''), code: error.code || 'invitation_failed' }); } }
      return result;
    }
    if (kind === 'workspace.create') {
      const name = String(body.name || '').trim(), country = body.country || 'CH';
      if (!name || name.length > 200 || !Object.hasOwn(S.db.countries, country)) throw fail(422, 'invalid_workspace', 'Enter a workspace name and a supported country.');
      if (S.db.workspaces.filter(row => row.state !== 'deleted' && row.members.some(person => person.userKey === actor.key && person.role === 'owner')).length >= 20) throw fail(422, 'workspace_limit', 'This account owns twenty workspaces.');
      const id = S.id('ws'), created = S.createWorkspace({ wsId: id, ownerKey: actor.key, name, email: actor.email, country, currency: S.db.countries[country].currency });
      created.kind = 'customer'; created.timeZone = actor.profile?.timeZone || 'Africa/Cairo'; created.authorityRevision = 1; created.invitations ??= []; created.initialization = { kind: 'empty', seedAt: created.createdAt };
      for (const row of created.members) { row.id ??= `member:${id}:${row.userKey}`; row.revision ??= 1; row.toolGrants ??= {}; }
      S.log(actor.key, 'workspace_created', id, { workspaceId: id });
      return { workspaceId: id, name: created.name, sessionAction: 'choose_workspace' };
    }
    if (kind === 'membership.leave') {
      if (member.role === 'owner') throw fail(409, 'ownership_transfer_required', 'Transfer ownership before leaving this workspace.');
      const next = S.db.workspaces.find(row => !['deleted', 'cancelled'].includes(row.state) && row.id !== workspace.id && people.memberOf(row, actor));
      const session = await authority.switchContext(token, next ? { mode: 'workspace', workspaceId: next.id, audience: 'suite' } : { mode: 'identity', workspaceId: null, audience: 'identity' });
      member.status = 'removed'; member.accessEpoch = (member.accessEpoch || 0) + 1; member.revision++; for (const grant of Object.values(member.toolGrants || {})) grant.assigned = false; people.revision(workspace);
      frame.accountSessionExit = true; S.log(actor.key, 'workspace_left', member.id, { workspaceId: workspace.id });
      return { sessionAction: 'session_changed', session: { user: identity.publicUser(actor), ...session }, workspaceId: next?.id || null };
    }
    if (kind === 'person.delete') {
      if (body.confirm !== actor.email || !require('./auth-store').passwordMatches(actor, body.password)) throw fail(422, 'account_confirmation_required', 'Confirm your email and current password.');
      const owned = S.db.workspaces.filter(row => !['deleted', 'cancelled'].includes(row.state) && row.members.some(person => person.userKey === actor.key && person.role === 'owner' && person.status === 'active'));
      if (owned.length) throw fail(409, 'ownership_transfer_required', 'Transfer or close your owned workspaces before deleting the account.');
      const mine = S.db.workspaces.filter(row => row.members.some(person => person.userKey === actor.key));
      if (S.db.invoices.some(invoice => mine.some(row => row.id === invoice.workspaceId && row.members.some(person => person.userKey === actor.key && person.role === 'owner')) && ['open', 'past_due'].includes(invoice.state))) throw fail(409, 'unpaid_invoices', 'Settle your outstanding invoices first.');
      await authority.revokeUser(actor.id); actor.isActive = false; actor.deletedAt = S.iso(S.now()); actor.authVersion = (actor.authVersion || 0) + 1;
      for (const row of mine) { const membership = row.members.find(person => person.userKey === actor.key); membership.status = 'removed'; membership.accessEpoch = (membership.accessEpoch || 0) + 1; for (const grant of Object.values(membership.toolGrants || {})) grant.assigned = false; people.revision(row); }
      frame.accountSessionExit = true; S.log(actor.key, 'personal_account_deleted', String(actor.id));
      return { sessionAction: 'signed_out', state: 'deleted' };
    }
    throw fail(422, 'unknown_account_action', 'Choose a supported account action.');
  } };
}
module.exports = { createAccountActions };
