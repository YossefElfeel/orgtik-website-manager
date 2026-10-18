// Shared route helpers: auth, brand (project) scoping and a handler wrapper.
const { error } = require("../lib");

function makeHelpers(ctx, getDb, views) {
  const { identity } = ctx;

  // Customers only see the brands they belong to; OrgTik staff see every brand.
  const canSee = (p, u) => {
    const roles = identity.userScopes(u).find(scope => scope.scope === "digital_marketing")?.roles || [];
    return roles.some(role => ["super_admin", "marketing_manager", "marketing_specialist", "content_writer"].includes(role)) || roles.includes("client_reviewer") && (p.memberUserIds || []).includes(u.id);
  };
  const projectsFor = (u) => getDb().projects.filter((p) => canSee(p, u));

  function activeProject(u) {
    const db = getDb();
    const visible = projectsFor(u);
    let p = visible.find((x) => x.id === db.activeProject[u.id]);
    if (!p) {
      p = visible.find((x) => x.key === "nile") || visible[0] || null;
      if (p && !identity.workspaceMode) db.activeProject[u.id] = p.id;
    }
    return p;
  }

  // Explicit ?projectId= wins when the user can see it; otherwise the active brand.
  function projectFor(req, u) {
    const id = req.query?.projectId || req.body?.projectId;
    if (id) {
      const p = getDb().projects.find((x) => x.id === id);
      if (p && canSee(p, u)) return p;
      if (identity.workspaceMode) return null;
    }
    return activeProject(u);
  }

  // Wraps a handler with auth + a project lookup: fn(req, res, user, project).
  const handle = (fn, { needsProject = true } = {}) => (req, res, next) => {
    const u = identity.requireUser(req, res);
    if (!u) return;
    try {
      const p = needsProject ? projectFor(req, u) : null;
      if (needsProject && !p) return error(res, 404, "No project found. Create a brand first.");
      const out = fn(req, res, u, p);
      if (out && typeof out.catch === "function") out.catch(next);
    } catch (e) {
      next(e);
    }
  };

  const notFound = (res, what = "Resource") => error(res, 404, `${what} not found`);

  return { canSee, projectsFor, activeProject, projectFor, handle, notFound };
}

module.exports = { makeHelpers };
