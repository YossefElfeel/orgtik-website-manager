const { createHash } = require("node:crypto");
const { ROLES, PERMISSIONS, permissionsFor } = require("./permissions");
const { capabilities } = require("./users");
const codec = require("./state-codec");
const PROTECTED = new Set(["wm_owner", "wm_super_admin"]);
const versionOf = (permissions) =>
  createHash("sha256")
    .update(JSON.stringify([...permissions].sort()))
    .digest("hex");

function validateRoleOverrides(value) {
  const overrides = codec.object(value ?? {});
  for (const [key, permissions] of Object.entries(overrides)) {
    if (
      !Object.hasOwn(ROLES, key) ||
      !Array.isArray(permissions) ||
      permissions.some((p) => !PERMISSIONS.includes(p)) ||
      new Set(permissions).size !== permissions.length
    )
      throw codec.fail("Website Manager role permissions are invalid.");
  }
  return overrides;
}

function registerRoles(app, { identity, store, overrides, need, ok, fail }) {
  const role = (key) => ({
    key,
    label: ROLES[key].label,
    permissions: permissionsFor([key], overrides),
    version: versionOf(permissionsFor([key], overrides)),
    protected: PROTECTED.has(key),
  });
  app.get("/v2/admin/roles", need("settings:view"), (_req, res) =>
    ok(res, Object.keys(ROLES).map(role)),
  );
  app.patch("/v2/admin/roles/:key", need("roles:manage"), (req, res) => {
    const key = req.params.key;
    if (!Object.hasOwn(ROLES, key))
      return fail(res, 404, "not_found", "Role not found.");
    if (PROTECTED.has(key) && !capabilities(identity, req.who.user).accounts)
      return fail(
        res,
        403,
        "suite_admin_required",
        "Only central super administrators can change this role.",
      );
    if (req.get("if-match") !== role(key).version)
      return fail(
        res,
        412,
        "stale",
        "This role changed. Reload it before saving.",
      );
    const permissions = req.body?.permissions;
    if (
      !Array.isArray(permissions) ||
      permissions.some((p) => !PERMISSIONS.includes(p)) ||
      new Set(permissions).size !== permissions.length
    )
      return fail(
        res,
        422,
        "invalid_permissions",
        "Choose valid capabilities.",
      );
    const next = permissionsFor(req.who.roles, {
      ...overrides,
      [key]: permissions,
    });
    if (
      ["roles:manage", "users:manage", "settings:view"].some(
        (p) => req.who.permissions.includes(p) && !next.includes(p),
      )
    )
      return fail(
        res,
        409,
        "self_lockout",
        "You cannot remove your own administration access.",
      );
    overrides[key] = [...permissions].sort();
    store.audit.unshift({
      at: new Date().toISOString(),
      by: req.who.user.key,
      type: "role",
      action: "role_permissions",
      entry: key,
      targetName: ROLES[key].label,
    });
    ok(res, role(key));
  });
}
module.exports = { registerRoles, validateRoleOverrides, PROTECTED };
