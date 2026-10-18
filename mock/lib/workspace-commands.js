const people = require('./workspace-people');
const { TOOL_DEFINITIONS, guestToolRoles, resolveWorkspaceContext, seatCounts } = require('./workspace-context');
const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const ROLE_NAMES = {
  tasks: ['super_admin', 'project_manager', 'developer', 'viewer'],
  files: ['super_admin', 'file_editor', 'file_viewer', 'file_guest'],
  hr: ['super_admin', 'hr', 'manager', 'finance_manager', 'employee'],
  crm: ['admin', 'manager', 'salesman', 'customer'],
  marketing: ['super_admin', 'marketing_manager', 'marketing_specialist', 'content_writer', 'client_reviewer'],
  chat: ['owner', 'admin', 'member', 'guest'],
};
const PROFILE_FIELDS = ['jobTitle', 'department', 'about', 'language', 'timeZone', 'weekStartDay', 'dateFormat', 'timeFormat', 'flyoutToastMessage', 'timezoneChangeNotification'];
function authorize({ S, identity, workspace, principal, tool, kind, payload }) {
  if (!principal?.user || principal.context?.workspaceContext?.workspace.id !== workspace.id) throw fail(403, 'workspace_command_forbidden', 'Choose the current workspace.');
  const actor = identity.findUser(principal.user.id);
  const context = resolveWorkspaceContext(S, identity, actor, { workspaceId: workspace.id, readOnly: Boolean(principal.readOnly), actorUserId: principal.actor?.id || actor?.id });
  const access = context.tools[tool];
  if (!actor || principal.readOnly || !access?.canWrite) throw fail(423, 'workspace_read_only', 'This workspace tool is read-only.');
  if (kind === 'profile.self_update') return { actor, access };
  if (!['workspace.tool.roles', 'workspace.member.remove'].includes(kind)) throw fail(501, 'workspace_command_required', 'This action is not available yet.');
  const isToolAdmin = access.roles.some(role => require('./workspace-suite').ADMIN_ROLES[tool]?.includes(role));
  if (!isToolAdmin) people.requireAdmin(workspace, actor);
  const user = identity.findUser(payload.userId), member = user && people.memberOf(workspace, user);
  if (!member) throw fail(404, 'member_not_found', 'This person was not found in the workspace.');
  if (payload.tool !== tool || !ROLE_NAMES[tool]) throw fail(422, 'invalid_tool', 'Choose the current workspace tool.');
  return { actor, access, user, member, grant: member.toolGrants?.[tool] };
}
function execute(args) {
  const { S, identity, workspace, principal, tool, kind, payload } = args;
  const authorization = authorize(args), { actor, user, member } = authorization;
  let grant = authorization.grant;
  if (kind === 'profile.self_update') {
    const patch = payload.patch || {};
    const allowed = new Set(['firstName', 'lastName', 'username', 'avatar', ...PROFILE_FIELDS]);
    if (Object.keys(patch).some(key => !allowed.has(key))) throw fail(422, 'invalid_profile', 'Only profile fields can be changed here.');
    for (const [key, value] of Object.entries(patch)) {
      if (['flyoutToastMessage', 'timezoneChangeNotification'].includes(key)) {
        if (typeof value !== 'boolean') throw fail(422, 'invalid_profile', 'Check the profile value.');
      } else if (value !== null && (typeof value !== 'string' || value.length > 2000)) throw fail(422, 'invalid_profile', 'Check the profile value.');
      if (['firstName', 'lastName'].includes(key) && !String(value || '').trim()) throw fail(422, 'invalid_profile', 'Enter your name.');
      if (key === 'timeZone') { try { new Intl.DateTimeFormat('en', { timeZone: value }); } catch { throw fail(422, 'invalid_timezone', 'Choose a valid timezone.'); } }
      if (key === 'avatar' && value && !/^\/|^https:\/\//.test(value)) throw fail(422, 'invalid_avatar', 'Choose a valid image reference.');
    }
    actor.profile ??= {};
    for (const [key, value] of Object.entries(patch)) (PROFILE_FIELDS.includes(key) ? actor.profile : actor)[key] = value;
    actor.updatedAt = S.iso(S.now());
    S.log(actor.key, 'profile_updated', String(actor.id), { workspaceId: workspace.id, fields: Object.keys(patch) });
    return { ...identity.publicUser(actor), scopes: principal.context.scopes, workspaceContext: principal.context.workspaceContext };
  }
  if (kind === 'workspace.tool.roles') {
    if (payload.assigned !== undefined && typeof payload.assigned !== 'boolean') throw fail(422, 'invalid_assignment', 'Choose the assignment state.');
    if (!grant?.assigned && payload.assigned !== true) throw fail(409, 'tool_not_assigned', 'Assign an available seat before changing tool roles.');
    if (!Array.isArray(payload.roles) || !payload.roles.length || new Set(payload.roles).size !== payload.roles.length || payload.roles.some(role => !ROLE_NAMES[tool].includes(role))) throw fail(422, 'invalid_roles', 'Choose valid tool roles.');
    if (member.role === 'guest' && payload.roles.some(role => !guestToolRoles(tool).includes(role))) throw fail(422, 'unsupported_guest_role', 'Guests can only receive supported review access.');
    if (!TOOL_DEFINITIONS[tool].roles[member.role]) throw fail(422, 'unsupported_tool_role', 'This membership cannot use that tool.');
    if (!grant?.assigned && payload.assigned === true) {
      const counts = seatCounts(S, workspace, tool);
      if (counts.available !== null && counts.available < 1) throw fail(409, 'seat_capacity_exhausted', 'Buy or release a seat first.');
      member.toolGrants ??= {}; grant = member.toolGrants[tool] ??= { assigned: false, roles: [] }; grant.assigned = true;
    }
    grant.roles = [...payload.roles];
  } else if (kind === 'workspace.member.remove') {
    if (payload.mode !== 'tool_access') throw fail(422, 'invalid_removal', 'Choose tool access removal.');
    if (actor.id === user.id) throw fail(409, 'self_removal', 'Ask another administrator to remove your tool access.');
    if (grant) { grant.assigned = false; grant.roles = []; }
    for (const invitation of workspace.invitations || []) if (invitation.status === 'pending' && invitation.email === user.email.toLowerCase()) {
      invitation.reservations = invitation.reservations.filter(name => name !== tool);
      delete invitation.grants[tool];
    }
  } else throw fail(501, 'workspace_command_required', 'This action is not available yet.');
  member.revision++; people.revision(workspace);
  S.log(actor.key, kind, member.id, { workspaceId: workspace.id, tool });
  return { userId: user.id, memberId: member.id, tool, roles: [...(grant?.roles || [])], assigned: Boolean(grant?.assigned) };
}
module.exports = { authorize, execute, ROLE_NAMES };
