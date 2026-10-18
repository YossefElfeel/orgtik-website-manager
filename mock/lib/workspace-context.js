// Current membership and tool grants are authority. Identity/token role claims are not.
const TOOL_DEFINITIONS = Object.freeze({
  tasks: { app: "tasks", scope: "task_manager", roles: { owner: "super_admin", admin: "project_manager", member: "developer", guest: "viewer" }, viewers: ["viewer"] },
  files: { app: "files", scope: "file_manager", roles: { owner: "super_admin", admin: "super_admin", member: "file_editor", guest: "file_guest" }, viewers: ["file_guest", "file_viewer"] },
  hr: { app: "hr", scope: "hr_system", roles: { owner: "super_admin", admin: "hr", member: "employee" }, viewers: [] },
  crm: { app: "sales", scope: "sales", roles: { owner: "admin", admin: "manager", member: "salesman", guest: "customer" }, viewers: [], externalRoles: ["customer"] },
  marketing: { app: "marketing", scope: "digital_marketing", roles: { owner: "super_admin", admin: "marketing_manager", member: "marketing_specialist", guest: "client_reviewer" }, viewers: [], externalRoles: ["client_reviewer"] },
  chat: { app: "chats", scope: "hq", roles: { owner: "owner", admin: "admin", member: "member", guest: "guest" }, viewers: ["guest"] },
});
const APP_TO_TOOL = Object.fromEntries(Object.entries(TOOL_DEFINITIONS).map(([key, value]) => [value.app, key]));
const clone = value => JSON.parse(JSON.stringify(value));
const failure = (status, code, message) => Object.assign(new Error(message), { status, code });
const liveLine = (workspace, tool) => workspace.lines.find(line => line.tool === tool && !["ended", "deleted"].includes(line.state));
const activeMember = (workspace, key) => workspace.members.find(member => member.userKey === key && member.status === "active");
function guestToolRoles(tool) {
  const definition = TOOL_DEFINITIONS[tool];
  return definition?.roles.guest ? [...new Set([definition.roles.guest, ...definition.viewers, ...(definition.externalRoles || [])])] : [];
}
function memberToolRoles(member, tool) {
  const roles = Array.isArray(member?.toolGrants?.[tool]?.roles) ? member.toolGrants[tool].roles : [];
  return member?.role === 'guest' ? roles.filter(role => guestToolRoles(tool).includes(role)) : roles;
}

function seatCounts(S, workspace, tool) {
  const line = liveLine(workspace, tool), plan = line && S.db.plans.find(row => row.id === line.planId);
  // D-061 meters purchased seats on per-user tools; fixed-price licences remain unmetered.
  const capacity = !line ? 0 : plan?.perUser || plan?.contractedQuantity ? line.snapshot?.quantity ?? 0 : null;
  const assigned = workspace.members.filter(member => member.status === "active" && member.toolGrants?.[tool]?.assigned === true).length;
  const reserved = (workspace.invitations || []).filter(invite => invite.status === "pending" && Date.parse(invite.expiresAt) > S.now() && invite.reservations?.includes(tool)).length;
  return { capacity, assigned, reserved, available: capacity === null ? null : Math.max(0, capacity - assigned - reserved) };
}

function initializeWorkspaceAuthority(S, identity, { seedAt = S.iso?.(S.now()) || new Date().toISOString() } = {}) {
  if (S.db.workspaceAuthorityVersion === 1) return false;
  for (const workspace of S.db.workspaces) {
    workspace.kind ??= workspace.id === "ws_orgtik" ? "orgtik_internal" : "customer";
    workspace.timeZone ??= "Africa/Cairo";
    workspace.authorityRevision ??= 1;
    workspace.invitations ??= [];
    // The reviewed OrgTik fixture includes Nour as an explicit external reviewer. This
    // fixture membership does not grant privileges in any other customer workspace.
    const reviewer = workspace.id === 'ws_orgtik' && identity.findByKey?.('customer');
    if (reviewer && !workspace.members.some(member => member.userKey === reviewer.key)) workspace.members.push({ userKey: reviewer.key, email: reviewer.email, name: identity.fullName?.(reviewer) || reviewer.firstName, role: 'guest', status: 'active', tools: ['tasks', 'files', 'crm', 'marketing'], joinedAt: seedAt });
    const fixture = ["ws_orgtik", "ws_nile"].includes(workspace.id);
    workspace.initialization ??= { kind: fixture ? "fixture" : "empty", ...(fixture ? { fixtureId: workspace.id === "ws_orgtik" ? "orgtik-v1" : "nile-v1" } : {}), seedAt: fixture ? seedAt : workspace.createdAt };
    for (const member of workspace.members) {
      member.id ??= `member:${workspace.id}:${member.userKey || member.email}`;
      member.revision ??= 1;
      member.toolGrants ??= {};
      if (fixture && member.status === "active") for (const [tool, definition] of Object.entries(TOOL_DEFINITIONS)) {
        if (!liveLine(workspace, tool) || member.tools && !member.tools.includes(tool) || !definition.roles[member.role]) continue;
        const former = workspace.id === "ws_orgtik" && identity.grants?.[definition.scope]?.[member.userKey]?.roles;
        if (workspace.id === "ws_orgtik" && !former?.length) continue;
        member.toolGrants[tool] ??= { roles: former?.length ? [...former] : [definition.roles[member.role]], assigned: true };
      }
    }
    for (const line of workspace.lines) line.ownerAssignmentInitialized ??= true;
  }
  S.db.workspaceAuthorityVersion = 1;
  return true;
}

function assignInitialOwnerSeats(S) {
  let changed = false;
  for (const workspace of S.db.workspaces) for (const line of workspace.lines) {
    if (line.ownerAssignmentInitialized || !TOOL_DEFINITIONS[line.tool] || ["ended", "deleted"].includes(line.state)) continue;
    const owner = workspace.members.find(member => member.role === "owner" && member.status === "active");
    const available = seatCounts(S, workspace, line.tool).available;
    if (owner && (available === null || available > 0)) {
      owner.toolGrants ??= {};
      const grant = owner.toolGrants[line.tool] ||= { roles: [] };
      if (!Array.isArray(grant.roles) || !grant.roles.length) grant.roles = [TOOL_DEFINITIONS[line.tool].roles.owner];
      grant.assigned = true;
      owner.revision = (owner.revision || 0) + 1;
      workspace.authorityRevision = (workspace.authorityRevision || 0) + 1;
    }
    line.ownerAssignmentInitialized = true;
    changed = true;
  }
  return changed;
}

function resolveWorkspaceContext(S, identity, user, { realm = "demo", workspaceId, headerWorkspace, actorUserId = user?.id, readOnly = false, audience = "suite" } = {}) {
  if (!user || user.isActive === false || user.deletedAt) throw failure(401, "unauthenticated", "Sign in again.");
  if (!workspaceId) throw failure(403, "workspace_required", "Choose a workspace to continue.");
  if (headerWorkspace && headerWorkspace !== workspaceId) throw failure(409, "workspace_mismatch", "This tab belongs to a different workspace.");
  const workspace = S.workspace(workspaceId), member = workspace && activeMember(workspace, user.key);
  if (!workspace || !member || ["deleted", "cancelled"].includes(workspace.state)) throw failure(403, "workspace_access_revoked", "You no longer have access to this workspace.");
  const tools = {};
  for (const [tool, definition] of Object.entries(TOOL_DEFINITIONS)) {
    const line = liveLine(workspace, tool), grant = member.toolGrants?.[tool], seats = seatCounts(S, workspace, tool);
    const roles = memberToolRoles(member, tool);
    let access = "no_access", reason = "tool_not_assigned";
    if (!line) { access = "not_subscribed"; reason = "not_subscribed"; }
    else if (grant?.assigned && roles.length && definition.roles[member.role] && (seats.capacity === null || seats.capacity > 0)) {
      access = line.state === "trialing" ? "trial" : line.state === "free" ? "free" : "active";
      reason = undefined;
      if (workspace.state === "suspended" || line.state === "read_only") { access = "read_only"; reason = "billing_read_only"; }
    } else if (!definition.roles[member.role]) reason = "unsupported_tool_role";
    const canWrite = ["trial", "free", "active"].includes(access) && !readOnly && !roles.every(role => definition.viewers.includes(role));
    tools[tool] = { scope: definition.scope, roles: access === "no_access" || access === "not_subscribed" ? [] : [...roles], access, canWrite, ...(reason ? { reason } : {}), seats };
  }
  if (audience.startsWith("tool:")) {
    const tool = APP_TO_TOOL[audience.slice(5)], access = tools[tool];
    if (!access || ["no_access", "not_subscribed"].includes(access.access)) throw failure(403, access?.reason || "tool_access_denied", "Ask your workspace owner for tool access.");
  }
  return {
    version: 1, realm,
    workspace: { id: workspace.id, name: workspace.name, kind: workspace.kind || "customer", state: workspace.state, timeZone: workspace.timeZone || "Africa/Cairo" },
    actor: { userId: actorUserId, effectiveUserId: user.id, readOnly: Boolean(readOnly), ...(actorUserId !== user.id ? { impersonatedBy: actorUserId } : {}) },
    member: { id: member.id, role: member.role, revision: member.revision || 1, accessEpoch: member.accessEpoch || 0 }, tools, revision: workspace.authorityRevision || 1,
  };
}

function createTenantIdentityFacade({ identity, S, realm, workspaceId, appKey, currentPrincipal }) {
  const tool = APP_TO_TOOL[appKey], definition = TOOL_DEFINITIONS[tool];
  if (!definition) throw failure(503, "unknown_tool", "Unknown workspace tool.");
  const workspace = () => S.workspace(workspaceId);
  const admitted = () => identity.users.filter(user => activeMember(workspace(), user.key) && user.isActive !== false && !user.deletedAt);
  const projectUser = user => {
    if (!user || !activeMember(workspace(), user.key)) return null;
    const roles = memberToolRoles(activeMember(workspace(), user.key), tool);
    const viewer = activeMember(workspace(), user.key).role === 'guest' || roles.length && roles.every(role => (definition.externalRoles || definition.viewers).includes(role));
    const publicUser = identity.publicUser ? identity.publicUser(user) : Object.fromEntries(Object.entries(user).filter(([key]) => !/password|secret|seal/i.test(key)));
    return { ...clone(publicUser), key: user.key, userType: viewer ? "customer" : "employee" };
  };
  const facade = {
    workspaceMode: true, workspaceId, realm,
    userFromReq(req) { const principal = currentPrincipal(req); return principal?.workspaceContext?.workspace.id === workspaceId ? projectUser(identity.findUser(principal.workspaceContext.actor.effectiveUserId)) : null; },
    requireUser(req, res) { const user = this.userFromReq(req); if (!user) { res.status(401).json({ success: false, message: "Sign in again." }); return null; } return user; },
    findUser(id) { return projectUser(admitted().find(user => String(user.id) === String(id))); },
    findByKey(key) { return projectUser(admitted().find(user => user.key === key)); },
    findByEmail(email) { return projectUser(admitted().find(user => user.email.toLowerCase() === String(email).trim().toLowerCase())); },
    publicUser(user) {
      const safe = projectUser(user);
      if (!safe) return null;
      const principal = currentPrincipal();
      return { ...safe, scopes: facade.userScopes(safe), ...(principal?.workspaceContext?.actor.effectiveUserId === safe.id ? { workspaceContext: clone(principal.workspaceContext) } : {}) };
    },
    scopeByName(name) { return name === definition.scope ? identity.scopes.find(scope => scope.name === name) || null : null; },
    currentContext: () => currentPrincipal()?.workspaceContext || null,
    canWrite(user) { const context = currentPrincipal()?.workspaceContext; return context?.workspace.id === workspaceId && context.actor.effectiveUserId === user?.id && context.tools[tool]?.canWrite === true; },
    fullName(user) { return user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() : ""; },
    userScopes(user) {
      const member = user && activeMember(workspace(), user.key), grant = member?.toolGrants?.[tool];
      const roles = memberToolRoles(member, tool);
      return grant?.assigned && roles.length ? [{ scope: definition.scope, roles: [...roles], permissions: [] }] : [];
    },
    tokenFrom: req => identity.tokenFrom(req), decode: token => identity.decode(token),
    userFromToken(token) {
      const claims = identity.decode(token);
      return claims?.workspaceId === workspaceId && claims.aud === `tool:${appKey}` ? projectUser(identity.userFromToken(token)) : null;
    },
    onRegister() { throw failure(503, "workspace_command_required", "People changes require a workspace command."); },
  };
  Object.defineProperties(facade, {
    users: { get: () => admitted().map(projectUser) }, seedUsers: { get: () => admitted().map(projectUser) },
    scopes: { get: () => identity.scopes.filter(scope => scope.name === definition.scope) },
    grants: { get: () => ({ [definition.scope]: Object.fromEntries(admitted().map(user => [user.key, { roles: memberToolRoles(activeMember(workspace(), user.key), tool), permissions: [] }])) }) },
  });
  return facade;
}

module.exports = { TOOL_DEFINITIONS, APP_TO_TOOL, guestToolRoles, seatCounts, initializeWorkspaceAuthority, assignInitialOwnerSeats, resolveWorkspaceContext, createTenantIdentityFacade };
