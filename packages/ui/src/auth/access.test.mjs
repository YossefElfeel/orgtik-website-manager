import test from "node:test";
import assert from "node:assert/strict";
import { toolAccess, staffToolLaunch } from "./access.ts";

const context = () => ({ version: 1, realm: "test", workspace: { id: "ws_a", name: "A", kind: "customer", state: "active", timeZone: "Africa/Cairo" }, actor: { userId: 1, effectiveUserId: 1, readOnly: false }, member: { id: "m", role: "owner", revision: 1 }, revision: 1, tools: {} });
test("super-admin staff navigation exposes assigned tools without authorizing a staff token in them", () => {
  const session = { user: { id: 1 }, tokens: { accessToken: "fixture" }, scopes: [{ scope: "website_manager", roles: ["wm_super_admin"] }], workspaceContext: null, staffAccess: { actorUserId: 1, apps: ["admin", "wm"], roles: { admin: ["super_admin"] }, permissions: {}, toolLaunch: { workspaceId: "ws_orgtik", tools: ["tasks", "hr", "tasks"] } } };
  assert.deepEqual(staffToolLaunch(session), { workspaceId: "ws_orgtik", tools: ["tasks", "hr"] });
  assert.equal(toolAccess(null, "hr", session.scopes).hasAccess, false);
  session.workspaceContext = context();
  assert.equal(staffToolLaunch(session), undefined, "a customer tab retains its own context");
  session.workspaceContext = null;
  session.staffAccess.roles.admin = ["support"];
  assert.equal(staffToolLaunch(session), undefined);
});
test("global and another tool's admin roles cannot grant customer access", () => {
  assert.equal(toolAccess(null, "crm", [{ scope: "global", roles: ["super_admin"] }, { scope: "hr_system", roles: ["super_admin"] }]).hasAccess, false);
  assert.equal(toolAccess(null, "crm", [{ scope: "sales", roles: ["manager"] }]).roles[0], "manager");
});
test("workspace ownership does not bypass tool assignment or no-access state", () => {
  const c = context();
  assert.equal(toolAccess(c, "files", [{ scope: "file_manager", roles: ["super_admin"] }]).hasAccess, false);
  c.tools.files = { scope: "file_manager", roles: ["super_admin"], access: "no_access", canWrite: true, seats: { capacity: 0, assigned: 0, reserved: 0, available: 0 } };
  assert.deepEqual(toolAccess(c, "files").roles, []);
});
test("unmetered capacity remains null and read-only preserves reads while blocking writes", () => {
  const c = context();
  c.tools.hr = { scope: "hr_system", roles: ["hr"], access: "read_only", canWrite: false, seats: { capacity: null, assigned: 2, reserved: 1, available: null } };
  const a = toolAccess(c, "hr");
  assert.equal(a.hasAccess, true); assert.equal(a.canWrite, false); assert.equal(a.readOnly, true);
  assert.equal(c.tools.hr.seats.capacity, null); assert.equal(c.tools.hr.seats.available, null);
  c.tools.hr.access = "active"; c.tools.hr.canWrite = true; c.actor.readOnly = true;
  assert.equal(toolAccess(c, "hr").canWrite, false);
});
