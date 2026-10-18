// Systems registry (= identity.scopes, what the SoSBar launcher shows) and the Home dashboard KPIs.
const { nowIso } = require("../../lib/util");

const slugify = (s) => String(s || "").toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").replace(/_+/g, "_").replace(/^_|_$/g, "");
const isUrl = (s) => {
  try {
    const u = new URL(String(s));
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};
const DAY = 864e5;

function register(app, S, H, R) {
  const { identity, util } = S;

  const scopeView = (s) => ({
    id: s.id,
    name: s.name,
    displayName: s.displayName,
    description: s.description,
    domain: s.domain,
    isActive: s.isActive,
    metadata: s.metadata ? { ...s.metadata } : null,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  });
  const findScope = (id) => identity.scopes.find((s) => String(s.id) === String(id));

  app.get("/api/scopes", (req, res) => {
    const me = H.currentUser(req, res);
    if (!me) return;
    let list = [...identity.scopes].sort((a, b) => a.id - b.id);
    const isActive = H.parseBool(req.query.isActive);
    if (isActive !== undefined) list = list.filter((s) => !!s.isActive === isActive);
    if (req.query.search) list = util.search(list, req.query.search, ["name", "displayName", "description", "domain"]);
    const { items, meta } = util.paginate(list, req.query, { defaultLimit: 100 });
    H.sendPaged(res, items.map(scopeView), meta, "Scopes fetched successfully");
  });

  app.get("/api/scopes/:id", (req, res) => {
    const me = H.currentUser(req, res);
    if (!me) return;
    const s = findScope(req.params.id) || identity.scopeByName(req.params.id);
    if (!s) return H.fail(req, res, 404, "System not found");
    H.send(res, scopeView(s), "Scope fetched successfully");
  });

  app.post("/api/scopes", (req, res) => {
    const admin = H.adminUser(req, res);
    if (!admin) return;
    const b = req.body || {};
    const displayName = H.trimStr(b.displayName);
    const name = slugify(b.name || displayName);
    const domain = H.trimStr(b.domain).replace(/\/+$/, "");
    const errors = [];
    if (!displayName) errors.push("displayName should not be empty");
    if (!name) errors.push("name should not be empty");
    if (!isUrl(domain)) errors.push("domain must be a URL address");
    if (errors.length) return H.fail(req, res, 400, errors[0], errors);
    if (identity.scopeByName(name)) return H.fail(req, res, 409, `A system named "${name}" already exists`);
    const now = nowIso();
    const s = {
      id: identity.scopes.reduce((m, x) => Math.max(m, x.id), 0) + 1,
      name,
      displayName,
      domain,
      description: H.trimStr(b.description),
      isActive: b.isActive !== false,
      metadata: { icon: b.metadata?.icon || "solar:widget-bold", color: b.metadata?.color || "#8135cd" },
      createdAt: now,
      updatedAt: now,
    };
    identity.scopes.push(s);
    // The creator gets the new system's admin role so it shows up in their launcher right away.
    const firstRole = R.forScope(name)[0];
    if (firstRole) R.addRole(admin, firstRole);
    S.log(`system created: ${name} -> ${domain} by ${admin.email}`);
    H.send(res, scopeView(s), "System created successfully", 201);
  });

  function updateScope(req, res) {
    const admin = H.adminUser(req, res);
    if (!admin) return;
    const s = findScope(req.params.id);
    if (!s) return H.fail(req, res, 404, "System not found");
    const b = req.body || {};
    const keys = Object.keys(b).filter((k) => b[k] !== undefined);
    if (b.name !== undefined && slugify(b.name) !== s.name) {
      const next = slugify(b.name);
      if (s.name === "global") return H.fail(req, res, 400, "The global scope cannot be renamed");
      if (!next) return H.fail(req, res, 400, "name should not be empty");
      if (identity.scopeByName(next)) return H.fail(req, res, 409, `A system named "${next}" already exists`);
      identity.grants[next] = identity.grants[s.name] || {};
      delete identity.grants[s.name];
      R.renameScope(s.name, next);
      s.name = next;
    }
    if (b.displayName !== undefined) {
      const v = H.trimStr(b.displayName);
      if (!v) return H.fail(req, res, 400, "displayName should not be empty");
      s.displayName = v;
    }
    if (b.description !== undefined) s.description = H.trimStr(b.description);
    if (b.domain !== undefined) {
      const v = H.trimStr(b.domain).replace(/\/+$/, "");
      if (!isUrl(v)) return H.fail(req, res, 400, "domain must be a URL address", ["domain must be a URL address"]);
      s.domain = v;
    }
    if (b.metadata && typeof b.metadata === "object") s.metadata = { ...(s.metadata || {}), ...b.metadata };
    if (b.isActive !== undefined) {
      const active = b.isActive === true || b.isActive === "true";
      if (!active && s.name === "global") return H.fail(req, res, 400, "The global scope cannot be deactivated");
      s.isActive = active;
    }
    s.updatedAt = nowIso();
    const onlyStatus = keys.length === 1 && keys[0] === "isActive";
    H.send(res, scopeView(s), onlyStatus ? (s.isActive ? "System activated successfully" : "System deactivated successfully") : "System updated successfully");
  }
  app.put("/api/scopes/:id", updateScope);
  app.patch("/api/scopes/:id", updateScope);

  // "DELETE : Deactivate scope" — kept in the registry, hidden from the launcher.
  app.delete("/api/scopes/:id", (req, res) => {
    const admin = H.adminUser(req, res);
    if (!admin) return;
    const s = findScope(req.params.id);
    if (!s) return H.fail(req, res, 404, "System not found");
    if (s.name === "global") return H.fail(req, res, 400, "The global scope cannot be deactivated");
    s.isActive = false;
    s.updatedAt = nowIso();
    H.send(res, null, "System deactivated successfully");
  });

  // ---------- Home dashboard KPIs (shown to global super admins) ----------
  app.get("/api/dashboard/stats", (req, res) => {
    const me = H.currentUser(req, res);
    if (!me) return;
    const since = Date.now() - 30 * DAY;
    const systems = identity.scopes.filter((s) => s.name !== "global");
    const activeSystems = systems.filter((s) => s.isActive);
    const newSystems = systems.filter((s) => new Date(s.createdAt).getTime() >= since).length;
    const users = H.liveUsers();
    const activeUsers = users.filter((u) => u.isActive);
    const newUsers = users.filter((u) => new Date(u.createdAt).getTime() >= since).length;
    const cms = S.cms ? S.cms.stats() : { active: 0, total: 0 };
    const pct = systems.length ? Math.round((activeSystems.length / systems.length) * 999) / 10 : 99.9;
    const health = pct >= 95 ? "Healthy" : pct >= 75 ? "Degraded" : "Unhealthy";
    const inactiveCms = cms.total - cms.active;
    H.send(res, {
      activeSystems: { value: activeSystems.length, change: newSystems, changeLabel: `+${newSystems} this month`, total: systems.length },
      totalMembers: { value: activeUsers.length, change: newUsers, changeLabel: `+${newUsers} joined this month`, total: users.length },
      cmsPlatforms: {
        value: cms.active,
        total: cms.total,
        status: inactiveCms === 0 ? "All platforms operational" : `${cms.active} of ${cms.total} platforms active`,
      },
      systemHealth: { value: `${pct}%`, percentage: pct, status: health },
    }, "Dashboard statistics fetched successfully");
  });
}

module.exports = { register, slugify };
