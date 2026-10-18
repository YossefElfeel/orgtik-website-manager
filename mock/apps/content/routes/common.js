// Auth + small validation helpers shared by the Content routes.
// Tokens are the shared identity tokens (lib/identity.js). Writes need the website_manager scope (or global super_admin).
const { fail, LANGS } = require("../lib");

function makeCommon(ctx) {
  const { identity } = ctx;
  const SCOPE = "website_manager";

  const canManage = (u) => !!(identity.grants[SCOPE]?.[u.key] || identity.grants.global?.[u.key]?.roles?.includes("super_admin"));
  const rawToken = (req) => {
    const t = identity.tokenFrom(req);
    return t && t !== "undefined" && t !== "null" ? t : null;
  };

  // Public reads (the website reads the same endpoints). A token that is sent but invalid/expired -> 401,
  // so the dashboard's 401 handler sends the user back to the SOS login.
  function optionalUser(req, res, next) {
    const t = rawToken(req);
    if (t) {
      const u = identity.userFromToken(t);
      if (!u) return fail(res, 401, "Unauthorized");
      req.user = u;
    }
    next();
  }
  function requireUser(req, res, next) {
    const u = identity.userFromToken(rawToken(req));
    if (!u) return fail(res, 401, "Unauthorized");
    req.user = u;
    next();
  }
  function requireEditor(req, res, next) {
    const u = identity.userFromToken(rawToken(req));
    if (!u) return fail(res, 401, "Unauthorized");
    if (!canManage(u)) return fail(res, 403, "You don't have access to the Content Dashboard (website_manager scope required).");
    req.user = u;
    next();
  }

  // Collects field errors in the { field: [messages] } shape the dashboard toasts.
  function checker() {
    const errors = {};
    const add = (field, msg) => (errors[field] = errors[field] || []).push(msg);
    return {
      errors,
      add,
      required(field, value, label = field) {
        if (value === undefined || value === null || String(value).trim() === "") add(field, `${label} is required`);
      },
      localized(field, value, label = field) {
        if (!value || typeof value !== "object" || !LANGS.some((l) => String(value[l] ?? "").trim())) add(field, `${label} is required`);
      },
      ok: () => Object.keys(errors).length === 0,
      send(res) {
        const first = Object.values(errors)[0]?.[0] || "Validation failed";
        return fail(res, 400, first, errors);
      },
    };
  }

  const notFound = (res, what) => fail(res, 404, `${what} not found`);

  return { optionalUser, requireUser, requireEditor, checker, notFound, canManage };
}

module.exports = { makeCommon };
