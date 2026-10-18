// Fallback routes the HR app needs on other APIs. The owning app's own routes win; these only answer
// paths nobody else handles.
//   sos   (port 4000): /api/scopes, /api/rbac/*  - employee wizard "Permissions" step (hooks/useSoSApi.ts)
//   tasks (port 4001): /api/projects             - HR "Projects" page (redux/features/projects/projectApi.ts)
module.exports = function makeMounts({ db, identity, util }) {
  const { ok, fail, paginate } = util;
  const KNOWN_ROLES = {
    hr_system: ["super_admin", "hr", "manager", "employee", "finance_manager"],
    global: ["super_admin"],
  };
  const DESCRIPTIONS = {
    super_admin: "Full access to every screen and approval.", hr: "Manages employees, time off, payroll preparation and hiring.",
    manager: "Approves time off and sees attendance for their team.", employee: "Self-service: attendance, time off, payslips and tickets.",
    finance_manager: "Pays approved payroll, loans and finance exports.", admin: "Administrator of this system.", member: "Standard member.",
  };
  const auth = (req, res) => identity.requireUser(req, res);
  const scopeMini = (s) => ({ id: s.id, name: s.name, displayName: s.displayName, domain: s.domain, description: s.description, isActive: s.isActive, metadata: s.metadata, createdAt: s.createdAt, updatedAt: s.updatedAt });

  function roleNames(scope) {
    const names = new Set(KNOWN_ROLES[scope.name] || []);
    for (const e of Object.values(identity.grants[scope.name] || {})) for (const r of e.roles || []) names.add(r);
    if (!names.size) ["admin", "member"].forEach((r) => names.add(r));
    return [...names];
  }
  // Stable ids: scope.id * 100 + position (positions only ever grow as new role names appear).
  const roleOrder = {};
  function rolesOf(scope) {
    const order = (roleOrder[scope.name] = roleOrder[scope.name] || []);
    for (const n of roleNames(scope)) if (!order.includes(n)) order.push(n);
    return order.map((name, i) => ({ id: scope.id * 100 + i + 1, name, description: DESCRIPTIONS[name] || `${name} role`, isActive: true, scopeId: scope.id, scopeEntity: scopeMini(scope), createdAt: scope.createdAt, updatedAt: scope.updatedAt, permissions: [] }));
  }
  const allRoles = () => identity.scopes.flatMap(rolesOf);
  const roleById = (id) => allRoles().find((r) => r.id === Number(id));
  function userScopesView(user) {
    return identity.userScopes(user).map((us) => {
      const scope = identity.scopeByName(us.scope);
      if (!scope) return null;
      const roles = rolesOf(scope);
      return { ...scopeMini(scope), roles: us.roles.map((name) => { const r = roles.find((x) => x.name === name); return { id: r ? r.id : 0, name, description: r?.description || "", isActive: true, assignedAt: scope.updatedAt }; }) };
    }).filter(Boolean);
  }
  const grantOf = (scopeName, user, create = false) => {
    identity.grants[scopeName] = identity.grants[scopeName] || {};
    if (!identity.grants[scopeName][user.key] && create) identity.grants[scopeName][user.key] = { roles: [], permissions: [] };
    return identity.grants[scopeName][user.key];
  };
  const targetUser = (req, res) => {
    const u = identity.findUser(req.params.id);
    if (!u) fail(res, 404, "User not found", { error: "User not found" });
    return u;
  };

  function sos(app, ctx) {
    const base = `${ctx.apiUrl("sos")}/api`;
    // Calls whichever implementation answers on this port (the SOS mock's or the fallbacks below).
    const call = async (req, method, path, body) => {
      const r = await fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json", Authorization: req.headers.authorization || "" }, body: body ? JSON.stringify(body) : undefined });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw Object.assign(new Error(json.message || `${method} ${path} failed`), { status: r.status });
      return json;
    };

    app.get("/api/scopes", (req, res) => {
      if (!auth(req, res)) return;
      let list = identity.scopes.map(scopeMini);
      if (req.query.isActive !== undefined) list = list.filter((s) => String(s.isActive) === String(req.query.isActive));
      if (req.query.search) list = util.search(list, req.query.search, ["name", "displayName"]);
      const { items, meta } = paginate(list, req.query, { defaultLimit: 100 });
      res.json({ success: true, statusCode: 200, message: "Scopes fetched", data: req.query.page ? items : list, meta });
    });
    app.get("/api/scopes/:id", (req, res) => {
      if (!auth(req, res)) return;
      const s = identity.scopes.find((x) => String(x.id) === String(req.params.id) || x.name === req.params.id);
      if (!s) return fail(res, 404, "Scope not found");
      ok(res, scopeMini(s), "Scope fetched");
    });
    app.get("/api/rbac/roles", (req, res) => {
      if (!auth(req, res)) return;
      if (req.query.scope) {
        const s = identity.scopeByName(req.query.scope);
        return ok(res, s ? rolesOf(s) : [], "Roles fetched");
      }
      ok(res, allRoles(), "Roles fetched");
    });
    app.get("/api/rbac/users/:id/scopes", (req, res) => {
      if (!auth(req, res)) return;
      const u = targetUser(req, res);
      if (u) ok(res, userScopesView(u), "User scopes fetched");
    });
    app.post("/api/rbac/users/:id/scopes", (req, res) => {
      if (!auth(req, res)) return;
      const u = targetUser(req, res);
      if (!u) return;
      for (const name of [].concat(req.body?.scopes || [])) if (identity.scopeByName(name)) grantOf(name, u, true);
      ok(res, userScopesView(u), "Scopes assigned");
    });
    app.delete("/api/rbac/users/:id/scopes/:scope", (req, res) => {
      if (!auth(req, res)) return;
      const u = targetUser(req, res);
      if (!u) return;
      if (identity.grants[req.params.scope]) delete identity.grants[req.params.scope][u.key];
      ok(res, userScopesView(u), "Scope removed");
    });
    app.post("/api/rbac/users/:id/roles", (req, res) => {
      if (!auth(req, res)) return;
      const u = targetUser(req, res);
      if (!u) return;
      for (const id of [].concat(req.body?.roleIds || [])) {
        const r = roleById(id);
        if (!r) continue;
        const g = grantOf(r.scopeEntity.name, u, true);
        if (!g.roles.includes(r.name)) g.roles.push(r.name);
      }
      ok(res, userScopesView(u), "Roles assigned");
    });
    app.delete("/api/rbac/users/:id/roles/:roleId", (req, res) => {
      if (!auth(req, res)) return;
      const u = targetUser(req, res);
      if (!u) return;
      const r = roleById(req.params.roleId);
      const g = r && grantOf(r.scopeEntity.name, u);
      if (g) g.roles = g.roles.filter((x) => x !== r.name);
      ok(res, userScopesView(u), "Role removed");
    });
    // Toggles (only the HR wizard uses these): implemented on top of the add/remove endpoints above,
    // through HTTP, so they stay consistent with whichever implementation owns those endpoints.
    app.patch("/api/rbac/users/:id/scopes/:scope/toggle", async (req, res) => {
      if (!auth(req, res)) return;
      try {
        const current = await call(req, "GET", `/rbac/users/${req.params.id}/scopes`);
        const has = (current.data || []).some((s) => s.name === req.params.scope);
        const out = has ? await call(req, "DELETE", `/rbac/users/${req.params.id}/scopes/${encodeURIComponent(req.params.scope)}`) : await call(req, "POST", `/rbac/users/${req.params.id}/scopes`, { scopes: [req.params.scope] });
        ok(res, out.data ?? null, has ? "Scope disabled" : "Scope enabled");
      } catch (e) {
        fail(res, e.status || 500, e.message, { error: e.message });
      }
    });
    app.patch("/api/rbac/users/:id/roles/:roleId/toggle", async (req, res) => {
      if (!auth(req, res)) return;
      try {
        const scopeName = req.query.scope;
        const current = await call(req, "GET", `/rbac/users/${req.params.id}/scopes`);
        const scopes = current.data || [];
        const roleId = Number(req.params.roleId);
        const has = scopes.filter((s) => !scopeName || s.name === scopeName).some((s) => (s.roles || []).some((r) => Number(r.id) === roleId));
        if (!has && scopeName && !scopes.some((s) => s.name === scopeName)) await call(req, "POST", `/rbac/users/${req.params.id}/scopes`, { scopes: [scopeName] });
        const out = has ? await call(req, "DELETE", `/rbac/users/${req.params.id}/roles/${roleId}`) : await call(req, "POST", `/rbac/users/${req.params.id}/roles`, { roleIds: [roleId], scope: scopeName });
        ok(res, out.data ?? null, has ? "Role removed" : "Role assigned");
      } catch (e) {
        fail(res, e.status || 500, e.message, { error: e.message });
      }
    });
  }

  function tasks(app) {
    app.get("/api/projects", (req, res) => {
      if (!auth(req, res)) return;
      let list = db.projects;
      if (req.query.status) list = list.filter((p) => p.status === req.query.status);
      if (req.query.search) list = util.search(list, req.query.search, ["title", "description"]);
      const { items, meta } = paginate(list, req.query, { defaultLimit: 9 });
      ok(res, { items, meta }, "Projects fetched");
    });
  }

  return { sos, tasks };
};
