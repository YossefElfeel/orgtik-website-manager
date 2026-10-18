const test = require("node:test");
const assert = require("node:assert/strict");
const { createContextService } = require("./session-context");
const { TOOL_DEFINITIONS } = require("./workspace-context");
function fixture() {
  const user = { id: 1, key: "admin", isActive: true, userType: "admin" };
  const member = { id: "member", userKey: user.key, status: "active", role: "owner", revision: 1, toolGrants: Object.fromEntries(Object.entries(TOOL_DEFINITIONS).map(([key, definition]) => [key, { assigned: true, roles: [definition.roles.owner] }])) };
  const internal = { id: "ws_orgtik", name: "OrgTik", kind: "orgtik_internal", state: "active", members: [member], lines: Object.keys(TOOL_DEFINITIONS).map(tool => ({ tool, state: "active", planId: tool, snapshot: { quantity: 10 } })), invitations: [] };
  const S = { db: { staffRoles: { admin: ["super_admin"] }, plans: Object.keys(TOOL_DEFINITIONS).map(id => ({ id, perUser: false })) }, workspace: id => id === internal.id ? internal : null, now: () => Date.now() };
  const identity = { grants: { global: { admin: { roles: ["super_admin"] } }, website_manager: { admin: { roles: ["wm_super_admin"] } } } };
  return { user, member, internal, S, identity, service: createContextService({ realm: "test", identity, platform: () => S }) };
}
test("Mona's staff family lists every assigned internal tool while keeping its staff audience", () => {
  const f = fixture(), value = f.service.resolveWorkspace(f.user, { mode: "staff", audience: "staff:wm", workspaceId: null });
  assert.equal(value.workspaceContext, null);
  assert.deepEqual(value.scopes.map(scope => scope.scope), ["website_manager"]);
  assert.deepEqual(value.staffAccess.toolLaunch, { workspaceId: "ws_orgtik", tools: Object.keys(TOOL_DEFINITIONS) });
  assert.throws(() => f.service.resolveWorkspace(f.user, { mode: "staff", audience: "tool:hr", workspaceId: null }), { code: "staff_access_denied" });
});
test("launcher visibility respects assignment, subscription and current staff authority", () => {
  const f = fixture(); f.member.toolGrants.hr.assigned = false; f.internal.lines = f.internal.lines.filter(line => line.tool !== "chat");
  assert.deepEqual(f.service.staffAccess(f.user).toolLaunch.tools, ["tasks", "files", "crm", "marketing"]);
  f.S.db.staffRoles.admin = ["support"];
  assert.equal(f.service.staffAccess(f.user).toolLaunch, undefined, "global labels and userType cannot grant launcher access");
  f.S.db.staffRoles.admin = ["super_admin"]; f.S.db.staffAuthorityRevocations = { admin: true };
  assert.deepEqual(f.service.staffAccess(f.user).apps, []);
  delete f.S.db.staffAuthorityRevocations; f.member.status = "offboarded";
  assert.deepEqual(f.service.staffAccess(f.user).apps, []);
});
