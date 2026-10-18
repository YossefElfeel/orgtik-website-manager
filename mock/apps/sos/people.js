// People (identity.users) and RBAC (identity.grants) endpoints used by the SOS People pages and the HR dashboard.
const { nowIso } = require("../../lib/util");
const { USER_TYPES, EMAIL_RE, MIN_PASSWORD } = require("./common");

function register(app, S, H, R) {
  const { identity, util } = S;

  const emailOwner = (email, except) => identity.users.find((u) => u !== except && !H.isDeleted(u) && u.email.toLowerCase() === email.toLowerCase());
  const usernameOwner = (name, except) => identity.users.find((u) => u !== except && !H.isDeleted(u) && String(u.username).toLowerCase() === name.toLowerCase());

  // A soft-deleted account still owning this email would shadow the new one in identity.findByEmail.
  function releaseEmail(email) {
    for (const u of identity.users) if (H.isDeleted(u) && u.email.toLowerCase() === email.toLowerCase()) u.email = `deleted-${u.id}.${u.email}`;
  }

  const createIdentityUser = data => require("../../lib/accounts").createIdentityUser(identity, data);
  S.people = { createIdentityUser };

  const matches = (u, q) => {
    const n = String(q).toLowerCase().trim();
    return [`${u.firstName} ${u.lastName}`, u.email, u.username, u.phone].some((v) => String(v || "").toLowerCase().includes(n));
  };
  const byNewest = (a, b) => new Date(b.createdAt) - new Date(a.createdAt) || b.id - a.id;

  // ---------- users ----------
  app.get("/api/users", (req, res) => {
    const me = H.currentUser(req, res);
    if (!me) return;
    const { search, scope, userType } = req.query;
    const isActive = H.parseBool(req.query.isActive);
    let list = H.liveUsers();
    if (search && String(search).trim()) list = list.filter((u) => matches(u, search));
    if (scope && scope !== "all") list = list.filter((u) => !!identity.grants[scope]?.[u.key]);
    if (userType && userType !== "all") list = list.filter((u) => (u.userType || "none") === userType);
    if (isActive !== undefined) list = list.filter((u) => !!u.isActive === isActive);
    list = [...list].sort(byNewest);
    const { items, meta } = util.paginate(list, req.query, { defaultLimit: 10 });
    H.sendPaged(res, items.map(H.personView), meta, "Users fetched successfully");
  });

  app.get("/api/users/all", (req, res) => {
    const me = H.currentUser(req, res);
    if (!me) return;
    const list = [...H.liveUsers()].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
    H.send(res, list.map(H.personView), "Users fetched successfully");
  });

  app.get("/api/users/:id", (req, res) => {
    const me = H.currentUser(req, res);
    if (!me) return;
    const u = H.findLiveUser(req.params.id);
    if (!u) return H.fail(req, res, 404, "User not found");
    // The edit form needs the contact details too (it showed them blank: the list item has none).
    H.send(res, { ...H.personView(u), phone: u.phone ?? null, address: u.address ?? null, city: u.city ?? null, country: u.country ?? null }, "User fetched successfully");
  });

  app.post("/api/users", (req, res) => {
    const admin = H.adminUser(req, res);
    if (!admin) return;
    const b = req.body || {};
    const email = H.trimStr(b.email).toLowerCase();
    const firstName = H.trimStr(b.firstName);
    const lastName = H.trimStr(b.lastName);
    const password = String(b.password || "");
    const errors = [];
    if (!EMAIL_RE.test(email)) errors.push("email must be an email");
    if (!firstName) errors.push("firstName should not be empty");
    if (!lastName) errors.push("lastName should not be empty");
    if (password.length < MIN_PASSWORD) errors.push(`password must be at least ${MIN_PASSWORD} characters long`);
    if (!USER_TYPES.includes(b.userType)) errors.push(`userType must be one of the following values: ${USER_TYPES.join(", ")}`);
    const scopes = Array.isArray(b.scopes) ? b.scopes.map(String) : [];
    const unknown = scopes.filter((s) => !identity.scopeByName(s));
    if (unknown.length) errors.push(`Unknown scope(s): ${unknown.join(", ")}`);
    if (errors.length) return H.fail(req, res, 400, errors[0], errors);
    if (emailOwner(email)) return H.fail(req, res, 409, "A user with this email already exists");
    const username = H.trimStr(b.username) || email.split("@")[0];
    if (usernameOwner(username)) return H.fail(req, res, 409, "This username is already taken");

    const u = createIdentityUser({ ...b, keyPrefix: undefined, email, firstName, lastName, username, password, isActive: b.isActive !== false });
    R.addScope(u, "global"); // every account is at least a member of the global scope, like the seeded people
    for (const s of scopes) R.addScope(u, s);
    S.log(`user created: ${u.email} (id ${u.id}) by ${admin.email}`);
    H.send(res, H.personView(u), "User created successfully", 201);
  });

  function updateUser(req, res) {
    const admin = H.adminUser(req, res);
    if (!admin) return;
    const u = H.findLiveUser(req.params.id);
    if (!u) return H.fail(req, res, 404, "User not found");
    const b = req.body || {};
    const keys = Object.keys(b).filter((k) => b[k] !== undefined);
    if (b.email !== undefined) {
      const email = H.trimStr(b.email).toLowerCase();
      if (!EMAIL_RE.test(email)) return H.fail(req, res, 400, "email must be an email", ["email must be an email"]);
      if (emailOwner(email, u)) return H.fail(req, res, 409, "A user with this email already exists");
      releaseEmail(email);
      u.email = email;
    }
    if (b.username !== undefined) {
      const username = H.trimStr(b.username);
      if (!username) return H.fail(req, res, 400, "username should not be empty");
      if (usernameOwner(username, u)) return H.fail(req, res, 409, "This username is already taken");
      u.username = username;
    }
    for (const k of ["firstName", "lastName"]) {
      if (b[k] === undefined) continue;
      const v = H.trimStr(b[k]);
      if (!v) return H.fail(req, res, 400, `${k} should not be empty`);
      u[k] = v;
    }
    if (b.password !== undefined && String(b.password).length) {
      if (String(b.password).length < MIN_PASSWORD) return H.fail(req, res, 400, `password must be at least ${MIN_PASSWORD} characters long`);
      identity.setPassword(u, String(b.password));
    }
    if (b.userType !== undefined) {
      if (b.userType !== null && !USER_TYPES.includes(b.userType)) return H.fail(req, res, 400, `userType must be one of the following values: ${USER_TYPES.join(", ")}`);
      u.userType = b.userType;
    }
    if (b.isActive !== undefined) {
      const active = b.isActive === true || b.isActive === "true";
      if (!active && u.id === admin.id) return H.fail(req, res, 400, "You cannot deactivate your own account");
      u.isActive = active;
      if (!active) S.chat?.disconnectUser(u.id);
    }
    if (b.phone !== undefined) u.phone = H.trimStr(b.phone) || null;
    for (const k of ["address", "city", "country"]) if (b[k] !== undefined) u[k] = H.trimStr(b[k]) || null;
    u.profile = u.profile || { id: u.id, createdAt: u.createdAt };
    if (b.bio !== undefined) u.profile.about = H.trimStr(b.bio) || null;
    if (b.language !== undefined && H.trimStr(b.language)) u.profile.language = H.trimStr(b.language);
    if (b.timeZone !== undefined && H.trimStr(b.timeZone)) u.profile.timeZone = H.trimStr(b.timeZone);
    for (const k of ["jobTitle", "department"]) if (b[k] !== undefined) u.profile[k] = H.trimStr(b[k]) || null;
    u.profile.updatedAt = nowIso();
    u.updatedAt = nowIso();
    const onlyStatus = keys.length === 1 && keys[0] === "isActive";
    H.send(res, H.personView(u), onlyStatus ? (u.isActive ? "User activated successfully" : "User deactivated successfully") : "User updated successfully");
  }
  app.put("/api/users/:id", updateUser);
  app.patch("/api/users/:id", updateUser);

  app.patch("/api/users/:id/user-type", (req, res) => {
    const admin = H.adminUser(req, res);
    if (!admin) return;
    const u = H.findLiveUser(req.params.id);
    if (!u) return H.fail(req, res, 404, "User not found");
    const t = req.body?.userType ?? null;
    if (t !== null && !USER_TYPES.includes(t)) return H.fail(req, res, 400, `userType must be one of the following values: ${USER_TYPES.join(", ")}`);
    u.userType = t;
    u.updatedAt = nowIso();
    H.send(res, H.personView(u), "User type updated successfully");
  });

  app.delete("/api/users/:id", (req, res) => {
    const admin = H.adminUser(req, res);
    if (!admin) return;
    const u = H.findLiveUser(req.params.id);
    if (!u) return H.fail(req, res, 404, "User not found");
    if (u.id === admin.id) return H.fail(req, res, 400, "You cannot delete your own account");
    // Soft delete: the record stays in identity.users so other apps' references still resolve, but the
    // account loses every scope, cannot sign in and disappears from SOS lists.
    S.deletedUserIds.add(u.id);
    u.deletedAt = nowIso();
    u.isActive = false;
    u.updatedAt = nowIso();
    R.removeAllGrants(u);
    S.cms?.removeMemberEverywhere(u.id);
    S.chat?.disconnectUser(u.id);
    S.log(`user deleted: ${u.email} (id ${u.id}) by ${admin.email}`);
    H.send(res, { message: "User deleted successfully" }, "User deleted successfully");
  });

  // ---------- RBAC ----------
  function userScopesView(u) {
    return identity.userScopes(u).map((e) => {
      const s = identity.scopeByName(e.scope);
      return {
        id: s.id,
        name: s.name,
        displayName: s.displayName,
        domain: s.domain,
        description: s.description,
        isActive: s.isActive,
        metadata: s.metadata,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        roles: e.roles.map((name) => ({ ...R.view(R.ensureRole(e.scope, name)), assignedAt: R.assignedAt(u, e.scope, name) })),
        permissions: e.permissions,
      };
    });
  }

  function targetUser(req, res) {
    const u = H.findLiveUser(req.params.userId);
    if (!u) {
      H.fail(req, res, 404, "User not found");
      return null;
    }
    return u;
  }

  app.get("/api/rbac/roles", (req, res) => {
    const me = H.currentUser(req, res);
    if (!me) return;
    const scope = H.trimStr(req.query.scope);
    if (scope) {
      if (!identity.scopeByName(scope)) return H.fail(req, res, 404, `Scope "${scope}" not found`);
      return H.send(res, R.forScope(scope).map(R.view), "Roles fetched successfully");
    }
    H.send(res, R.all().map(R.view), "Roles fetched successfully");
  });

  app.get("/api/rbac/roles/:id", (req, res) => {
    const me = H.currentUser(req, res);
    if (!me) return;
    const role = R.byId(req.params.id);
    if (!role) return H.fail(req, res, 404, "Role not found");
    H.send(res, R.view(role), "Role fetched successfully");
  });

  app.get("/api/rbac/users/:userId/scopes", (req, res) => {
    const me = H.currentUser(req, res);
    if (!me) return;
    const u = targetUser(req, res);
    if (!u) return;
    H.send(res, userScopesView(u), "User scopes fetched successfully");
  });

  app.post("/api/rbac/users/:userId/scopes", (req, res) => {
    const me = H.rbacUser(req, res);
    if (!me) return;
    const u = targetUser(req, res);
    if (!u) return;
    const b = req.body || {};
    const names = (Array.isArray(b.scopes) ? b.scopes : b.scope ? [b.scope] : []).map(String);
    if (!names.length) return H.fail(req, res, 400, "scopes must contain at least 1 element", ["scopes must contain at least 1 element"]);
    const unknown = names.filter((n) => !identity.scopeByName(n));
    if (unknown.length) return H.fail(req, res, 404, `Scope "${unknown[0]}" not found`);
    for (const n of names) R.addScope(u, n);
    u.updatedAt = nowIso();
    H.send(res, H.personView(u), names.length > 1 ? "Scopes added successfully" : "Scope added successfully");
  });

  function removeScope(req, res, me, u, name) {
    if (name === "global" && u.id === me.id) return H.fail(req, res, 400, "You cannot remove your own global access");
    R.removeScope(u, name);
    u.updatedAt = nowIso();
    return H.send(res, H.personView(u), "Scope removed successfully");
  }

  app.delete("/api/rbac/users/:userId/scopes/:scope", (req, res) => {
    const me = H.rbacUser(req, res);
    if (!me) return;
    const u = targetUser(req, res);
    if (!u) return;
    if (!R.hasScope(u, req.params.scope)) return H.fail(req, res, 404, "This user does not have this scope");
    removeScope(req, res, me, u, req.params.scope);
  });

  // HR dashboard: PATCH /rbac/users/:id/scopes/:scope/toggle
  app.patch("/api/rbac/users/:userId/scopes/:scope/toggle", (req, res) => {
    const me = H.rbacUser(req, res);
    if (!me) return;
    const u = targetUser(req, res);
    if (!u) return;
    const name = req.params.scope;
    if (!identity.scopeByName(name)) return H.fail(req, res, 404, `Scope "${name}" not found`);
    if (R.hasScope(u, name)) return removeScope(req, res, me, u, name);
    R.addScope(u, name);
    u.updatedAt = nowIso();
    H.send(res, H.personView(u), "Scope added successfully");
  });

  app.post("/api/rbac/users/:userId/roles", (req, res) => {
    const me = H.rbacUser(req, res);
    if (!me) return;
    const u = targetUser(req, res);
    if (!u) return;
    const b = req.body || {};
    const ids = (Array.isArray(b.roleIds) ? b.roleIds : b.roleId !== undefined ? [b.roleId] : []).map(Number).filter((n) => !Number.isNaN(n));
    if (!ids.length) return H.fail(req, res, 400, "roleIds must contain at least 1 element", ["roleIds must contain at least 1 element"]);
    const scope = H.trimStr(b.scope);
    const roles = [];
    for (const id of ids) {
      const role = R.byId(id);
      if (!role) return H.fail(req, res, 404, `Role ${id} not found`);
      if (scope && role.scope !== scope) return H.fail(req, res, 400, `Role "${role.name}" does not belong to the "${scope}" scope`);
      roles.push(role);
    }
    for (const role of roles) R.addRole(u, role);
    u.updatedAt = nowIso();
    H.send(res, H.personView(u), roles.length > 1 ? "Roles assigned successfully" : "Role assigned successfully");
  });

  function removeRole(req, res, me, u, role) {
    if (role.scope === "global" && role.name === "super_admin" && u.id === me.id) return H.fail(req, res, 400, "You cannot remove your own super admin role");
    R.removeRole(u, role);
    u.updatedAt = nowIso();
    return H.send(res, H.personView(u), "Role removed successfully");
  }

  app.delete("/api/rbac/users/:userId/roles/:roleId", (req, res) => {
    const me = H.rbacUser(req, res);
    if (!me) return;
    const u = targetUser(req, res);
    if (!u) return;
    const role = R.byId(req.params.roleId);
    if (!role) return H.fail(req, res, 404, "Role not found");
    if (!R.hasRole(u, role)) return H.fail(req, res, 404, "This user does not have this role");
    removeRole(req, res, me, u, role);
  });

  // HR dashboard: PATCH /rbac/users/:id/roles/:roleId/toggle?scope=
  app.patch("/api/rbac/users/:userId/roles/:roleId/toggle", (req, res) => {
    const me = H.rbacUser(req, res);
    if (!me) return;
    const u = targetUser(req, res);
    if (!u) return;
    const role = R.byId(req.params.roleId);
    if (!role) return H.fail(req, res, 404, "Role not found");
    const scope = H.trimStr(req.query.scope || req.body?.scope);
    if (scope && role.scope !== scope) return H.fail(req, res, 400, `Role "${role.name}" does not belong to the "${scope}" scope`);
    if (R.hasRole(u, role)) return removeRole(req, res, me, u, role);
    R.addRole(u, role);
    u.updatedAt = nowIso();
    H.send(res, H.personView(u), "Role assigned successfully");
  });
}

module.exports = { register };
