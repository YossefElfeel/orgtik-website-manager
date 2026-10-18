const { resolveWorkspaceContext, TOOL_DEFINITIONS } = require("./workspace-context");
const { permissionsFor } = require("../apps/admin/permissions");
const { permissionsFor: wmPermissionsFor } = require('../apps/wm/permissions');
const fail = (code, status = 403) => Object.assign(new Error("This context is not available to your account."), { status, code });
const TARGET_AUDIENCES = { sos: "suite", suite: "suite", tasks: "tool:tasks", files: "tool:files", hr: "tool:hr", sales: "tool:sales", crm: "tool:sales", marketing: "tool:marketing", chats: "tool:chats", chat: "tool:chats", admin: "staff:admin", wm: "staff:wm" };
function createContextService({ realm, identity, platform }) {
  function staffAccess(user) {
    const internal = platform().workspace('ws_orgtik');
    if (!internal?.members.some(member => member.userKey === user.key && member.status === 'active' && member.role !== 'guest')) return { actorUserId: user.id, apps: [], roles: {}, permissions: {} };
    for (const value of [platform().db.staffAuthorityRevocations, platform().db.staffAccessEpochs]) if (value !== undefined && (!value || typeof value !== 'object' || Array.isArray(value))) throw fail('staff_authority_unavailable', 503);
    if (Object.hasOwn(platform().db.staffAuthorityRevocations || {}, user.key)) return { actorUserId: user.id, apps: [], roles: {}, permissions: {} };
    const admin = platform().db.staffRoles?.[user.key] || [], wm = identity.grants.website_manager?.[user.key]?.roles || [];
    const access = { actorUserId: user.id, accessEpoch: platform().db.staffAccessEpochs?.[user.key] ?? 0, apps: [...(admin.length ? ["admin"] : []), ...(wm.length ? ["wm"] : [])], roles: { ...(admin.length ? { admin: [...admin] } : {}), ...(wm.length ? { wm: [...wm] } : {}) }, permissions: { ...(admin.length ? { admin: permissionsFor(admin) } : {}), ...(wm.length ? { wm: wmPermissionsFor(wm) } : {}) } };
    // A staff family remains bound to its staff audience. Launcher metadata lets
    // current super administrators open their assigned OrgTik workspace tools
    // through an explicit workspace switch, without granting tenant access.
    if (admin.includes("super_admin") && !["deleted", "cancelled"].includes(internal.state)) {
      const context = resolveWorkspaceContext(platform(), identity, user, { realm, workspaceId: internal.id });
      access.toolLaunch = { workspaceId: internal.id, tools: Object.entries(context.tools).filter(([, tool]) => !["no_access", "not_subscribed"].includes(tool.access)).map(([key]) => key) };
    }
    return access;
  }
  function resolveWorkspace(user, { workspaceId, mode, audience = "suite", readOnly = false, actor = user }) {
    const access = staffAccess(actor);
    if (mode === "staff") {
      const app = audience === "staff:admin" ? "admin" : audience === "staff:wm" ? "wm" : null;
      if (readOnly || !app || !access.apps.includes(app) || workspaceId !== null) throw fail("staff_access_denied");
      return { mode, audience, workspaceId: null, workspaceContext: null, staffAccess: access, scopes: [{ scope: app === "admin" ? "platform_admin" : "website_manager", roles: access.roles[app], permissions: access.permissions[app] }] };
    }
    if (mode !== "workspace" || audience.startsWith("staff:")) throw fail("audience_mismatch");
    if (readOnly && !access.permissions.admin?.includes("workspaces:edit")) throw fail("impersonation_permission_revoked");
    const context = resolveWorkspaceContext(platform(), identity, user, { realm, workspaceId, actorUserId: actor.id, readOnly, audience });
    const scopes = Object.entries(context.tools).filter(([, tool]) => tool.roles.length).map(([, tool]) => ({ scope: tool.scope, roles: tool.roles, permissions: [] }));
    return { mode, audience, workspaceId, workspaceContext: context, staffAccess: access.apps.length ? access : null, scopes };
  }
  function contextFor(user, { extra = {}, principal, request }) {
    if (extra.exitImpersonation === true) return resolveWorkspace(user, { workspaceId: null, mode: 'staff', audience: 'staff:admin' });
    const body = request?.body || {}, mode = extra.mode || body.mode || (principal?.claims.mode === "staff" ? "staff" : "workspace");
    const target = extra.audience || TARGET_AUDIENCES[extra.target || body.target] || (mode === "staff" ? principal?.claims.aud : "suite");
    let workspaceId = Object.hasOwn(extra, "workspaceId") ? extra.workspaceId : body.workspaceId || principal?.claims.workspaceId;
    if (extra.impersonatedBy) {
      const match = /^\/v1\/admin\/workspaces\/([^/?]+)\/impersonate/.exec(request?.url || "");
      workspaceId = extra.workspaceId || match?.[1] || workspaceId;
      const projection = resolveWorkspace(user, { workspaceId, mode: "workspace", audience: "suite", readOnly: true, actor: principal?.actor });
      return { ...projection, impersonationApproved: true, reason: body.reason || "View as" };
    }
    if (mode === "staff") return resolveWorkspace(user, { workspaceId: null, mode, audience: target });
    if (!workspaceId) workspaceId = platform().db.workspaces.find(workspace => workspace.state !== "deleted" && workspace.members.some(member => member.userKey === user.key && member.status === "active"))?.id;
    if (!workspaceId) return { mode: "identity", audience: "identity", workspaceId: null, workspaceContext: null, scopes: [], staffAccess: null };
    return resolveWorkspace(user, { workspaceId, mode: "workspace", audience: target || "suite" });
  }
  return { resolveWorkspace, contextFor, staffAccess, audienceFor: target => TARGET_AUDIENCES[target] || target };
}
module.exports = { createContextService, TARGET_AUDIENCES };
