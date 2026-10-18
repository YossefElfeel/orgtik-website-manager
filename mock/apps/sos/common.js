// Shared helpers for the SOS mock: response envelopes, auth guards and the user shapes the SOS frontend reads.
const { nowIso, timeAgo } = require("../../lib/util");

const USER_TYPES = ["admin", "employee", "manager", "customer", "salesman"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8; // the SOS login form rejects anything shorter, so never create such accounts

function createHelpers(S) {
  const { identity } = S;

  // { success, statusCode, message, data, timestamp } — SuccessResponse<T> in types/index.ts
  const send = (res, data = null, message = "Success", status = 200, extra = {}) =>
    res.status(status).json({ success: true, statusCode: status, message, data, timestamp: nowIso(), ...extra });

  // PaginatedData<T>: { success, message, statusCode, timestamp, data: T[], meta: { total, page, limit, totalPages, hasNext, hasPrev } }
  const sendPaged = (res, items, meta, message = "Success") =>
    res.status(200).json({ success: true, statusCode: 200, message, timestamp: nowIso(), data: items, meta });

  // ErrorResponse: { message, statusCode, path, timestamp, errors? }
  const fail = (req, res, status, message, errors) =>
    res.status(status).json({ success: false, statusCode: status, message, ...(errors ? { errors } : {}), path: req.originalUrl, timestamp: nowIso() });

  const isDeleted = (u) => !!u && (!!u.deletedAt || S.deletedUserIds.has(u.id));
  const liveUsers = () => identity.users.filter((u) => !isDeleted(u));
  const findLiveUser = (id) => {
    const u = identity.findUser(id);
    return u && !isDeleted(u) ? u : null;
  };

  const rolesIn = (u, scope) => identity.grants[scope]?.[u.key]?.roles || [];
  const isSuperAdmin = (u) => !!u && rolesIn(u, "global").includes("super_admin");
  // RBAC edits: global super admins, plus HR admins (the HR dashboard edits employee permissions through this API).
  const canManageRbac = (u) => isSuperAdmin(u) || rolesIn(u, "hr_system").some((r) => r === "super_admin" || r === "hr");

  // Signed-in, existing, active user — or a 401 sent and null returned.
  function currentUser(req, res) {
    const u = identity.userFromReq(req);
    if (!u) {
      fail(req, res, 401, "Unauthorized");
      return null;
    }
    if (isDeleted(u)) {
      fail(req, res, 401, "This account no longer exists.");
      return null;
    }
    if (!u.isActive) {
      fail(req, res, 401, "This account is deactivated.");
      return null;
    }
    return u;
  }
  function guard(req, res, check, message) {
    const u = currentUser(req, res);
    if (!u) return null;
    if (!check(u)) {
      fail(req, res, 403, message);
      return null;
    }
    return u;
  }
  const adminUser = (req, res) => guard(req, res, isSuperAdmin, "Forbidden resource: only global super admins can do this.");
  const rbacUser = (req, res) => guard(req, res, canManageRbac, "Forbidden resource: you cannot manage roles and scopes.");

  const scopeNamesOf = (u) => identity.userScopes(u).map((s) => s.scope);

  // IPeopleItem / IUser (types/user.ts)
  function personView(u) {
    return {
      ...identity.publicUser(u),
      scopes: scopeNamesOf(u),
      deletedAt: null,
      createdAtTimeAgo: timeAgo(u.createdAt),
      updatedAtTimeAgo: timeAgo(u.updatedAt),
    };
  }

  // IUser plus the flat profile fields other dashboards read from GET/PUT /auth/profile.
  function profileView(u) {
    const p = u.profile || {};
    return {
      ...personView(u),
      phone: u.phone ?? null,
      jobTitle: p.jobTitle ?? null,
      department: p.department ?? null,
      bio: p.about ?? null,
      language: p.language ?? null,
      timeZone: p.timeZone ?? null,
      weekStartDay: p.weekStartDay ?? null,
      dateFormat: p.dateFormat ?? null,
      timeFormat: p.timeFormat ?? null,
      flyoutToastMessage: p.flyoutToastMessage ?? null,
      timezoneChangeNotification: p.timezoneChangeNotification ?? null,
    };
  }

  const fullName = (u) => (u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.username || u.email : "Unknown user");

  function parseBool(v) {
    if (v === undefined || v === null || v === "" || v === "all") return undefined;
    if (v === true || v === "true" || v === "1") return true;
    if (v === false || v === "false" || v === "0") return false;
    return undefined;
  }

  const trimStr = (v) => (v === undefined || v === null ? "" : String(v).trim());

  return {
    send, sendPaged, fail, isDeleted, liveUsers, findLiveUser, rolesIn, isSuperAdmin, canManageRbac,
    currentUser, adminUser, rbacUser, scopeNamesOf, personView, profileView, fullName, parseBool, trimStr,
  };
}

module.exports = { createHelpers, USER_TYPES, EMAIL_RE, MIN_PASSWORD };
