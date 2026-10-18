// Who may change what in Digital Marketing (wave 5, FS-MKT-4). The app hides what a role can't do;
// this answers 403 {code:"forbidden"} to the same rules, so a hidden button that is reached anyway
// (an old tab, a direct call) is refused, and the app's toast explains it. Reads stay open to every
// role the scope grants. The matrix is the one in orgtik-program/audits/marketing/wave-plan.md and
// the app's lib/roles.ts: keep the three in step.
const SCOPE = "digital_marketing";

function rightsOf(identity, u) {
  const scopes = identity.userScopes(u);
  const roles = new Set(scopes.find((s) => s.scope === SCOPE)?.roles || []);
  const has = (...r) => r.some((x) => roles.has(x));
  const lead = has("super_admin", "marketing_manager");
  const team = lead || has("marketing_specialist");
  return {
    any: roles.size > 0,
    manageProjects: lead,
    deleteProjects: has("super_admin"),
    manageIntegrations: lead,
    syncIntegrations: team,
    editCampaigns: team,
    editPosts: team || has("content_writer"),
    boost: team,
    uploadMedia: team || has("content_writer"),
    deleteAnyMedia: lead,
    manageAudience: team,
  };
}

// [method, path pattern, right]. First match wins; anything not listed needs only `any`.
const RULES = [
  ["POST", /^\/projects\/[^/]+\/switch$/, "any"],
  ["DELETE", /^\/projects\/[^/]+$/, "deleteProjects"],
  [/POST|PATCH|DELETE/, /^\/projects(\/|$)/, "manageProjects"],

  ["POST", /^\/integrations\/[^/]+\/sync$/, "syncIntegrations"],
  [/POST|PATCH|DELETE/, /^\/integrations(\/|$)/, "manageIntegrations"],

  ["PATCH", /^\/campaigns\/[^/]+\/(approve|reject)$/, "any"],
  ["POST", /^\/campaigns\/[^/]+\/comments$/, "any"],
  [/POST|PATCH|DELETE/, /^\/campaigns(\/|$)/, "editCampaigns"],

  ["PATCH", /^\/publishing\/posts\/[^/]+\/(approve|reject)$/, "any"],
  ["POST", /^\/publishing\/posts\/[^/]+\/comments$/, "any"],
  [/POST|PATCH|DELETE/, /^\/publishing\/posts(\/|$)/, "editPosts"],

  [/POST|PATCH|DELETE/, /^\/ads(\/|$)/, "boost"],

  ["POST", /^\/galleries\/bulk-fetch$/, "any"],
  ["DELETE", /^\/galleries\/[^/]+$/, "deleteMedia"],
  [/POST|PUT|PATCH/, /^\/galleries(\/|$)/, "uploadMedia"],

  [/POST|PATCH|DELETE/, /^\/(labels|audiences|messaging)(\/|$)/, "manageAudience"],
];

function roleGuard(ctx, getDb) {
  const { identity } = ctx;
  return (req, res, next) => {
    if (req.method === "OPTIONS" || req.path.startsWith("/__") || req.path.startsWith("/media") || req.path.startsWith("/uploads")) return next();
    const u = identity.userFromReq(req);
    if (!u) return next(); // the route answers 401
    const rights = rightsOf(identity, u);
    const deny = (message) => res.status(403).json({ success: false, statusCode: 403, code: "forbidden", message, msg: message });
    if (!rights.any) return deny("Digital Marketing isn't one of your apps");
    if (req.method === "GET" || (req.method === "POST" && req.path === "/galleries/bulk-fetch")) return next();
    const rule = RULES.find(([m, re]) => (m instanceof RegExp ? m.test(req.method) : m === req.method) && re.test(req.path));
    if (!rule) return next();
    const need = rule[2];
    if (need === "any") return next();
    if (need === "deleteMedia") {
      if (rights.deleteAnyMedia) return next();
      const item = getDb().gallery.find((g) => String(g.id) === req.path.split("/")[2]);
      if (rights.uploadMedia && item && item.uploadedBy === u.id) return next();
      return deny("Your role can delete only the media you uploaded");
    }
    if (rights[need]) return next();
    return deny("Your role in Digital Marketing doesn't allow this change");
  };
}

module.exports = { roleGuard, rightsOf };
