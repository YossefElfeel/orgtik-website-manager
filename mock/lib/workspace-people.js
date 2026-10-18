const crypto = require("node:crypto");
const { setPassword } = require("./auth-store");
const { TOOL_DEFINITIONS, guestToolRoles, seatCounts } = require("./workspace-context");
const { makeWorkspaceOperation } = require('./workspace-command');
const hash = value => crypto.createHash("sha256").update(String(value)).digest("hex");
const emailOf = value => String(value || "").trim().toLowerCase();
const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
function allocatePersonId(identity) {
  const occupied = new Set(identity.users.map(user => Number(user.id)));
  for (let attempt = 0; attempt < 32; attempt++) {
    const id = crypto.randomFillSync(Buffer.alloc(6)).readUIntBE(0, 6);
    if (id > 0 && !occupied.has(id)) return id;
  }
  throw fail(503, 'person_id_unavailable', 'The person could not be registered. Try again.');
}
const roles = {
  tasks: ["super_admin", "project_manager", "developer", "viewer"], files: ["super_admin", "file_editor", "file_viewer", "file_guest"],
  hr: ["super_admin", "hr", "manager", "finance_manager", "employee"], crm: ["admin", "manager", "salesman", "customer"],
  marketing: ["super_admin", "marketing_manager", "marketing_specialist", "content_writer", "client_reviewer"], chat: ["owner", "admin", "member", "guest"],
};
function memberOf(workspace, user) { return workspace.members.find(member => member.userKey === user?.key && member.status === "active"); }
function requireAdmin(workspace, actor) { const member = memberOf(workspace, actor); if (!member || !["owner", "admin"].includes(member.role)) throw fail(403, "workspace_admin_required", "Ask a workspace administrator."); return member; }
function revision(workspace) { workspace.authorityRevision = (workspace.authorityRevision || 0) + 1; }
function notice(S, workspace, to, kind, eventKey, details) {
  if (S.db.mailbox.some(message => message.eventKey === eventKey)) return;
  S.db.mailbox.push({ id: S.id("mail"), workspaceId: workspace.id, to, template: kind, eventKey, at: S.iso(S.now()), delivery: "mock", ...details });
}
function grantsFor(tools, role, toolRoles = {}) {
  if (!Array.isArray(tools) || new Set(tools).size !== tools.length) throw fail(422, "invalid_tools", "Choose each tool once.");
  return Object.fromEntries(tools.map(tool => {
    if (typeof tool !== 'string' || !Object.hasOwn(TOOL_DEFINITIONS, tool)) throw fail(422, 'invalid_tools', 'Choose a supported workspace tool.');
    const definition = TOOL_DEFINITIONS[tool], selected = toolRoles[tool] || definition?.roles[role];
    if (!definition || !definition.roles[role] || !roles[tool].includes(selected)) throw fail(422, "unsupported_tool_role", "This role is not supported for that tool.");
    if (role === 'guest' && !guestToolRoles(tool).includes(selected)) throw fail(422, 'unsupported_guest_role', 'Guests can only receive the supported review or meeting access.');
    return [tool, { roles: [selected], assigned: false }];
  }));
}
function currentTools(workspace, role) {
  return Object.keys(TOOL_DEFINITIONS).filter(tool => TOOL_DEFINITIONS[tool].roles[role] && workspace.lines.some(line => line.tool === tool && !['ended', 'deleted'].includes(line.state)));
}
function requestedTools(workspace, value, role) {
  const tools = value === null ? currentTools(workspace, role) : value ?? [];
  if (!Array.isArray(tools) || new Set(tools).size !== tools.length) throw fail(422, 'invalid_tools', 'Choose each supported tool once.');
  return [...tools];
}
const invitationDto = (S, row) => ({ id: row.id, email: row.email, role: row.role, tools: [...row.tools], status: row.status === 'pending' && Date.parse(row.expiresAt) <= S.now() ? 'expired' : row.status, expiresAt: row.expiresAt, ...(row.operationId ? { operationId: row.operationId } : {}) });
function reserve(S, workspace, tools, exceptInvite) {
  for (const tool of tools) {
    const counts = seatCounts(S, workspace, tool);
    const own = exceptInvite?.status === "pending" && Date.parse(exceptInvite.expiresAt) > S.now() && exceptInvite.reservations.includes(tool) ? 1 : 0;
    if (counts.capacity === 0 || counts.available !== null && counts.available + own < 1) throw fail(409, "seat_capacity_exhausted", `There is no available ${tool} seat. Buy or release a seat first.`);
  }
}
function invite(S, identity, workspace, actor, body, { authorizedHire = false, operationId } = {}) {
  const administrator = !authorizedHire && requireAdmin(workspace, actor);
  const email = emailOf(body.email), role = body.role || "member";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !["admin", "member", "guest"].includes(role)) throw fail(422, "invalid_invitation", "Check the email and role.");
  if (role === 'admin' && administrator?.role !== 'owner') throw fail(403, 'owner_required', 'Only the workspace owner can appoint administrators.');
  const selected = requestedTools(workspace, body.tools, role);
  const overrides = body.toolRoles || {};
  if (typeof overrides !== 'object' || Array.isArray(overrides)) throw fail(422, 'invalid_roles', 'Choose valid tool roles.');
  grantsFor(selected, role, overrides);
  if (operationId !== undefined && (typeof operationId !== 'string' || !/^[\w.:-]{1,200}$/.test(operationId))) throw fail(422, 'invalid_operation_id', 'Use a valid invitation reference.');
  const operation = operationId && makeWorkspaceOperation({ id: operationId, workspaceId: workspace.id, actor: { userId: actor.id }, method: 'POST', path: '/invitations', body: { email, role, tools: body.tools === null ? null : selected, toolRoles: overrides, name: String(body.name || '') } });
  const receiptKey = operationId && `${actor.id}:${operationId}`, previous = receiptKey && workspace.invitationOperations?.[receiptKey];
  if (previous) {
    if (previous.fingerprint !== operation.fingerprint) throw fail(409, 'operation_conflict', 'This invitation reference was already used differently.');
    const recorded = workspace.invitations?.find(row => row.id === previous.invitationId);
    if (!recorded) throw fail(503, 'invitation_corrupt', 'This invitation could not be recovered.');
    return invitationDto(S, recorded);
  }
  const person = identity.findByEmail(email), existing = workspace.members.find(member => person && member.userKey === person.key || !member.userKey && emailOf(member.email) === email);
  if (existing?.status === "active" && !authorizedHire) throw fail(409, "already_member", "This person already belongs to the workspace.");
  if ((workspace.invitations || []).some(item => item.email === email && item.status === "pending" && Date.parse(item.expiresAt) > S.now())) throw fail(409, "already_invited", "An invitation is already pending.");
  const grants = grantsFor(selected.filter(tool => !existing?.toolGrants?.[tool]?.assigned), role, overrides);
  reserve(S, workspace, Object.keys(grants));
  const token = crypto.randomFillSync(Buffer.alloc(32)).toString("base64url"), id = S.id("invite");
  const invitation = { id, workspaceId: workspace.id, email, name: String(body.name || ""), role: existing?.status === "active" ? existing.role : role, kind: existing?.status === "active" ? "tool_access" : "workspace_join", tools: selected, grants, reservations: Object.keys(grants), tokenHash: hash(token), status: "pending", createdAt: S.iso(S.now()), expiresAt: S.iso(S.now() + 7 * 864e5), version: 1, ...(operationId ? { operationId } : {}) };
  workspace.invitations ??= []; workspace.invitations.push(invitation);
  const member = existing || { id: `member:${workspace.id}:${person?.key || email}`, userKey: person?.key || null, email, name: invitation.name, role, revision: 0, toolGrants: {} };
  if (!existing) workspace.members.push(member);
  invitation.memberId = member.id;
  if (member.status !== "active") Object.assign(member, { status: "invited", invitationId: id, tools: Object.keys(grants) });
  member.revision++;
  notice(S, workspace, email, "workspace_invitation", `invite:${id}:1`, { invitationId: id, acceptanceToken: token, workspaceName: workspace.name, expiresAt: invitation.expiresAt });
  revision(workspace); S.log(actor.key, "invitation_created", id, { workspaceId: workspace.id });
  if (receiptKey) { workspace.invitationOperations ??= {}; workspace.invitationOperations[receiptKey] = { fingerprint: operation.fingerprint, invitationId: id }; }
  return invitationDto(S, invitation);
}
function changeInvitation(S, workspace, actor, id, action, { operationId } = {}) {
  const administrator = requireAdmin(workspace, actor);
  const invitation = workspace.invitations?.find(item => item.id === id);
  if (!invitation) throw fail(404, "invitation_not_found", "This invitation was not found.");
  if (action === 'resend' && invitation.role === 'admin' && administrator.role !== 'owner') throw fail(403, 'owner_required', 'Only the owner can resend administrator invitations.');
  if (!['cancel', 'resend'].includes(action)) throw fail(422, 'invalid_invitation_action', 'Choose an invitation action.');
  if (operationId !== undefined && (typeof operationId !== 'string' || !/^[\w.:-]{1,200}$/.test(operationId))) throw fail(422, 'invalid_operation_id', 'Use a valid invitation reference.');
  const operation = operationId && makeWorkspaceOperation({ id: operationId, workspaceId: workspace.id, actor: { userId: actor.id }, method: 'POST', path: `/invitations/${id}/${action}` });
  const key = operationId && `${actor.id}:${operationId}`, previous = key && workspace.invitationActionOperations?.[key];
  if (previous) { if (previous.fingerprint !== operation.fingerprint) throw fail(409, 'operation_conflict', 'This action reference was already used differently.'); return invitationDto(S, invitation); }
  const completed = () => { if (key) { workspace.invitationActionOperations ??= {}; workspace.invitationActionOperations[key] = { fingerprint: operation.fingerprint }; } return invitationDto(S, invitation); };
  if (action === "cancel") {
    if (invitation.status === "accepted") throw fail(409, "invitation_already_accepted", "This invitation was already accepted.");
    if (invitation.status !== "cancelled") {
      invitation.status = "cancelled"; invitation.cancelledAt = S.iso(S.now());
      const member = workspace.members.find(row => row.id === invitation.memberId);
      if (member?.status === 'invited' && member.invitationId === invitation.id) { member.status = 'cancelled'; member.revision++; }
      revision(workspace);
    }
    return completed();
  }
  if (action !== "resend" || ["accepted", "cancelled"].includes(invitation.status)) throw fail(409, "invitation_unavailable", "This invitation cannot be resent.");
  reserve(S, workspace, invitation.reservations, invitation);
  const token = crypto.randomFillSync(Buffer.alloc(32)).toString("base64url");
  invitation.tokenHash = hash(token); invitation.status = "pending"; invitation.version++;
  invitation.expiresAt = S.iso(S.now() + 7 * 864e5);
  notice(S, workspace, invitation.email, "workspace_invitation", `invite:${id}:${invitation.version}`, { invitationId: id, acceptanceToken: token, workspaceName: workspace.name, expiresAt: invitation.expiresAt });
  revision(workspace); return completed();
}
function findInvitation(S, token) {
  const tokenHash = hash(token);
  for (const workspace of S.db.workspaces) {
    const invitation = workspace.invitations?.find(item => item.tokenHash === tokenHash);
    if (invitation) return { workspace, invitation };
  }
  throw fail(404, "invitation_not_found", "This invitation was not found.");
}
function invitationMetadata(S, token) {
  const { workspace, invitation } = findInvitation(S, token);
  return { id: invitation.id, workspace: { id: workspace.id, name: workspace.name }, email: invitation.email, role: invitation.role, tools: invitation.reservations, status: invitation.status === "pending" && Date.parse(invitation.expiresAt) <= S.now() ? "expired" : invitation.status, expiresAt: invitation.expiresAt };
}
function acceptInvitation(S, identity, token, actor, body) {
  const { workspace, invitation } = findInvitation(S, token);
  let person = identity.findByEmail(invitation.email);
  if (person && person.isActive === true && (!actor || actor.id !== person.id)) throw fail(403, "recipient_sign_in_required", "Sign in with the invited email to accept.");
  if (invitation.status === "accepted") {
    if (!person || actor?.id !== person.id) throw fail(403, "recipient_sign_in_required", "Sign in with the invited email.");
    return { workspaceId: workspace.id, userId: person.id, replayed: true };
  }
  if (invitation.status !== "pending" || Date.parse(invitation.expiresAt) <= S.now()) throw fail(410, "invitation_expired", "This invitation has expired or was cancelled.");
  const member = workspace.members.find(item => item.id === invitation.memberId || item.invitationId === invitation.id);
  if (!member) throw fail(503, "invitation_corrupt", "This invitation cannot be processed.");
  const toolAccess = invitation.kind === 'tool_access' && member.status === 'active';
  const effectiveRole = toolAccess ? member.role : invitation.role;
  for (const [tool, grant] of Object.entries(invitation.grants)) {
    if (!Object.hasOwn(TOOL_DEFINITIONS, tool) || !TOOL_DEFINITIONS[tool].roles[effectiveRole]) throw fail(422, 'unsupported_tool_role', 'The current membership cannot use this invited tool.');
    if (effectiveRole === 'guest' && grant.roles.some(role => !guestToolRoles(tool).includes(role))) throw fail(422, 'unsupported_guest_role', 'The current guest role cannot accept this tool access.');
  }
  if (!person || person.pendingActivation) {
    if (String(body.password || "").length < 8) throw fail(422, "password_required", "Choose a password with at least eight characters.");
    if (!person) {
      const id = allocatePersonId(identity), name = String(body.name || invitation.name || invitation.email.split("@")[0]).trim().split(/\s+/);
      person = { id, key: `person_${id}`, email: invitation.email, firstName: name[0], lastName: name.slice(1).join(" "), userType: "employee", isActive: true, isEmailVerified: true, authVersion: 0, createdAt: S.iso(S.now()), updatedAt: S.iso(S.now()), profile: { language: "en", timeZone: workspace.timeZone, theme: "light" } };
      identity.users.push(person);
    }
    person.isActive = true; person.pendingActivation = false; setPassword(person, body.password);
  }
  if (person.isActive !== true || person.deletedAt) throw fail(403, "account_inactive", "This account is not available.");
  // The pending reservation is consumed once in the same domain commit as membership.
  member.userKey = person.key;
  if (!toolAccess) { member.status = 'active'; member.joinedAt = S.iso(S.now()); member.role = invitation.role; }
  member.toolGrants = { ...member.toolGrants, ...Object.fromEntries(Object.entries(invitation.grants).map(([tool, grant]) => [tool, { ...grant, assigned: true }])) };
  member.revision++; invitation.status = "accepted"; invitation.acceptedAt = S.iso(S.now()); invitation.acceptedUserId = person.id;
  revision(workspace); notice(S, workspace, invitation.email, "invitation_accepted", `invite-accepted:${invitation.id}`, { invitationId: invitation.id, workspaceName: workspace.name });
  return { workspaceId: workspace.id, userId: person.id, replayed: false };
}
function transferOwnership(S, workspace, actor, targetId) {
  const current = requireAdmin(workspace, actor);
  if (current.role !== "owner") throw fail(403, "owner_required", "Only the workspace owner can transfer ownership.");
  const target = workspace.members.find(member => member.id === targetId && member.status === "active" && member.role !== "guest");
  if (!target || target === current) throw fail(422, "invalid_owner", "Choose another active workspace member.");
  current.role = "admin"; target.role = "owner"; current.revision++; target.revision++; revision(workspace);
  S.log(actor.key, "ownership_transferred", workspace.id, { from: current.id, to: target.id });
  return { workspaceId: workspace.id, ownerMemberId: target.id };
}
function changeMember(S, workspace, actor, targetId, body) {
  const current = requireAdmin(workspace, actor);
  const target = workspace.members.find(row => row.id === targetId || row.userKey === targetId || row.email === targetId);
  if (!target) throw fail(404, 'member_not_found', 'This member was not found.');
  if (target.role === 'owner') throw fail(409, 'ownership_transfer_required', 'Transfer ownership before changing the owner.');
  const role = body.role || target.role;
  if (!['admin', 'member', 'guest'].includes(role)) throw fail(422, 'invalid_role', 'Choose a valid workspace role.');
  if (role === 'admin' && target.role !== 'admin' && current.role !== 'owner') throw fail(403, 'owner_required', 'Only the owner can appoint administrators.');
  if (body.status === 'removed') {
    target.status = 'removed'; target.accessEpoch = (target.accessEpoch || 0) + 1;
    for (const grant of Object.values(target.toolGrants || {})) grant.assigned = false;
    for (const invitation of workspace.invitations || []) if (invitation.memberId === target.id && invitation.status === 'pending') invitation.status = 'cancelled';
  } else if (body.tools !== undefined || role !== target.role) {
    const requested = body.tools === undefined ? Object.keys(target.toolGrants || {}).filter(tool => target.toolGrants[tool].assigned) : requestedTools(workspace, body.tools, role);
    const grants = grantsFor(requested, role, body.toolRoles);
    if (target.status !== 'active') throw fail(409, 'member_inactive', 'Accept the invitation before assigning tool access.');
    reserve(S, workspace, requested.filter(tool => !target.toolGrants?.[tool]?.assigned));
    target.toolGrants = Object.fromEntries(Object.entries(grants).map(([tool, grant]) => [tool, { ...grant, assigned: true }]));
    target.tools = requested;
  }
  target.role = role; target.revision++; revision(workspace);
  S.log(actor.key, 'membership_changed', target.id, { workspaceId: workspace.id });
  return target;
}
module.exports = { allocatePersonId, invite, changeInvitation, invitationMetadata, acceptInvitation, transferOwnership, changeMember, memberOf, requireAdmin, grantsFor, notice, revision, findInvitation };
