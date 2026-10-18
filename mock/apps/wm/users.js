const { createIdentityUser } = require("../../lib/accounts");
const { ROLES } = require("./permissions");
const { createHash } = require("node:crypto");

function capabilities(identity, actor) {
  return {
    accounts: Boolean(
      identity.grants?.global?.[actor.key]?.roles.includes("super_admin"),
    ),
  };
}

function registerUsers(
  app,
  {
    identity,
    store,
    need,
    ok,
    fail,
    page,
    platform = () => require("../admin").getStore(),
  },
) {
  const rolesOf = (user) =>
    identity.grants.website_manager?.[user.key]?.roles ?? [];
  const versionOf = (user) =>
    createHash("sha256")
      .update(
        JSON.stringify([
          user.updatedAt,
          user.firstName,
          user.lastName,
          user.email,
          user.isActive,
          rolesOf(user),
        ]),
      )
      .digest("hex");
  const view = (user) => ({
    id: user.id,
    key: user.key,
    name: identity.fullName(user),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    active: user.isActive,
    roles: rolesOf(user),
    version: versionOf(user),
  });
  const log = (actor, action, user) => {
    store.audit.unshift({
      at: new Date().toISOString(),
      by: actor.key,
      type: "user",
      action,
      entry: user.key,
      targetName: identity.fullName(user),
    });
    platform()?.log(actor.key, action, user.key);
  };
  app.get("/v2/admin/users", need("users:view"), (req, res) => {
    const q = String(req.query.search ?? "").toLowerCase();
    let users = identity.users.filter(
      (user) =>
        !user.deletedAt &&
        (!q ||
          `${identity.fullName(user)} ${user.email}`.toLowerCase().includes(q)),
    );
    if (!capabilities(identity, req.who.user).accounts) {
      const internal = new Set(
        platform()
          ?.workspace("ws_orgtik")
          ?.members.map((member) => member.userKey) ?? [],
      );
      users = users.filter((user) => internal.has(user.key));
    }
    if (["active", "inactive"].includes(req.query.status))
      users = users.filter(
        (user) => Boolean(user.isActive) === (req.query.status === "active"),
      );
    if (req.query.role && req.query.role !== "all")
      users = users.filter((user) => rolesOf(user).includes(req.query.role));
    const result = page(req, users.map(view));
    ok(res, result.rows, result.meta);
  });
  const validAccount = (body, id) => {
    const fields = {};
    for (const key of ["firstName", "lastName"])
      if (!String(body[key] ?? "").trim() || String(body[key]).length > 100)
        fields[key] = "required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email ?? ""))
      fields.email = "email";
    if (
      identity.users.some(
        (user) =>
          user.id !== id &&
          !user.deletedAt &&
          user.email.toLowerCase() === String(body.email).trim().toLowerCase(),
      )
    )
      fields.email = "duplicate";
    if (!id && (typeof body.password !== "string" || body.password.length < 8))
      fields.password = "password";
    return fields;
  };
  app.post("/v2/admin/users", need("users:manage"), (req, res) => {
    if (!capabilities(identity, req.who.user).accounts)
      return fail(
        res,
        403,
        "suite_admin_required",
        "Suite account administration requires a central super administrator.",
      );
    const errors = validAccount(req.body ?? {});
    if (Object.keys(errors).length)
      return fail(res, 422, "invalid", "Check the account fields.", {
        fieldErrors: errors,
      });
    const body = req.body;
    const user = createIdentityUser(identity, {
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      email: body.email.trim().toLowerCase(),
      username: `staff-${identity.users.reduce((n, row) => Math.max(n, row.id), 0) + 1}`,
      password: body.password,
      userType: "employee",
      keyPrefix: "sos-u",
    });
    (identity.grants.global ||= {})[user.key] = { roles: [], permissions: [] };
    log(req.who.user, "user_create", user);
    ok(res, view(user), {}, 201);
  });
  app.patch("/v2/admin/users/:id", need("users:manage"), (req, res) => {
    const user = identity.findUser(Number(req.params.id));
    if (!user || user.deletedAt)
      return fail(res, 404, "not_found", "Account not found.");
    if (req.get("if-match") !== versionOf(user))
      return fail(res, 412, "stale", "This account changed. Reload it.");
    const body = req.body ?? {},
      actor = req.who.user,
      S = platform();
    const accountEdit = Object.keys(body).some((key) =>
      ["firstName", "lastName", "email", "active"].includes(key),
    );
    if (accountEdit && !capabilities(identity, actor).accounts)
      return fail(
        res,
        403,
        "suite_admin_required",
        "Suite account administration requires a central super administrator.",
      );
    if (accountEdit) {
      const errors = validAccount({ ...user, ...body }, user.id);
      if (body.active !== undefined && typeof body.active !== "boolean")
        errors.active = "invalid";
      if (Object.keys(errors).length)
        return fail(res, 422, "invalid", "Check the account fields.", {
          fieldErrors: errors,
        });
      if (user.id === actor.id && body.active === false)
        return fail(
          res,
          409,
          "self_lockout",
          "You cannot deactivate yourself.",
        );
    }
    if (body.roles !== undefined) {
      if (
        !Array.isArray(body.roles) ||
        body.roles.some((role) => !Object.hasOwn(ROLES, role)) ||
        new Set(body.roles).size !== body.roles.length
      )
        return fail(
          res,
          422,
          "invalid_roles",
          "Choose valid Website Manager roles.",
        );
      if (
        user.id === actor.id &&
        ["wm_admin", "wm_owner", "wm_super_admin"].some(role => rolesOf(user).includes(role)) &&
        !["wm_admin", "wm_owner", "wm_super_admin"].some(role => body.roles.includes(role))
      )
        return fail(
          res,
          409,
          "self_lockout",
          "You cannot remove your own administration access.",
        );
      if (!capabilities(identity, actor).accounts && ["wm_owner", "wm_super_admin"].some(role => body.roles.includes(role) !== rolesOf(user).includes(role)))
        return fail(res, 403, "suite_admin_required", "Only central super administrators can assign owner or super administrator access.");
      const workspace = S?.workspace("ws_orgtik");
      const member = workspace?.members.find(
        (member) => member.userKey === user.key,
      );
      if (
        body.roles.length &&
        (!member ||
          member.status !== "active" ||
          member.role === "guest" ||
          S.db.staffAuthorityRevocations?.[user.key])
      ) {
        if (
          member ||
          !workspace ||
          !capabilities(identity, actor).accounts ||
          S.db.staffAuthorityRevocations?.[user.key]
        )
          return fail(
            res,
            409,
            "internal_member_required",
            "Restore active internal membership in the central suite first.",
          );
        workspace.members.push({
          id: S.id("member"),
          userKey: user.key,
          name: identity.fullName(user),
          email: user.email,
          role: "member",
          status: "active",
          tools: [],
          toolGrants: {},
          joinedAt: S.iso(S.now()),
          accessEpoch: 0,
        });
        workspace.authorityRevision = (workspace.authorityRevision || 0) + 1;
      }
      if (
        JSON.stringify([...rolesOf(user)].sort()) !==
        JSON.stringify([...body.roles].sort())
      ) {
        (identity.grants.website_manager ||= {})[user.key] = {
          roles: [...body.roles],
          permissions: [],
        };
        if (S) {
          S.db.staffAccessEpochs ||= {};
          S.db.staffAccessEpochs[user.key] =
            (S.db.staffAccessEpochs[user.key] || 0) + 1;
        }
        log(actor, "user_roles", user);
      }
    }
    if (accountEdit) {
      for (const key of ["firstName", "lastName", "email"])
        if (body[key] !== undefined) user[key] = String(body[key]).trim();
      user.email = user.email.toLowerCase();
      if (body.active !== undefined && body.active !== user.isActive) {
        user.isActive = body.active;
        user.authVersion = (user.authVersion || 0) + 1;
      }
      log(actor, "user_update", user);
    }
    user.updatedAt = new Date().toISOString();
    ok(res, view(user));
  });
}
module.exports = { registerUsers, capabilities };
