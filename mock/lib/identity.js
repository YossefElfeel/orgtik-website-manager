// Local stand-in for the SOS identity backend (sosback.orgtik.*): users, scopes, tokens, /api/auth/*.
// Every app module shares these people so the same names show up across all tools.
const config = require("../config");
const { nowIso, daysFromNow, ok, fail } = require("./util");
const { passwordMatches, setPassword } = require("./auth-store");
const { RealDate } = require("./clock");
let accountStore;
const configureStore = (store) => { accountStore = store; };
let sessionAuthority;
const configureAuthority = (authority, callbacks) => {
  sessionAuthority = authority;
  if (callbacks) authority.configureAuthority(callbacks);
};

// Password for every local test account. Local only; documented in local-dev/README.md.
const LOCAL_PASSWORD = "Local@2026";

// key → person. Keys are what app modules use in `grants`.
const PEOPLE = [
  { key: "admin", firstName: "Mona", lastName: "Adel", email: "mona.adel@orgtik.test", userType: "admin", jobTitle: "Chief Executive Officer", department: "Management" },
  { key: "manager", firstName: "Karim", lastName: "Hassan", email: "karim.hassan@orgtik.test", userType: "manager", jobTitle: "Operations Manager", department: "Operations" },
  { key: "employee", firstName: "Salma", lastName: "Nabil", email: "salma.nabil@orgtik.test", userType: "employee", jobTitle: "Frontend Developer", department: "Engineering" },
  { key: "sales", firstName: "Omar", lastName: "Farouk", email: "omar.farouk@orgtik.test", userType: "salesman", jobTitle: "Sales Executive", department: "Sales" },
  { key: "customer", firstName: "Nour", lastName: "Khaled", email: "nour.khaled@nilefoods.test", userType: "customer", jobTitle: "Marketing Director", department: "Nile Foods" },
  { key: "finance", firstName: "Hany", lastName: "Samir", email: "hany.samir@orgtik.test", userType: "employee", jobTitle: "Finance Manager", department: "Finance" },
  { key: "u7", firstName: "Youssef", lastName: "Ibrahim", email: "youssef.ibrahim@orgtik.test", userType: "employee", jobTitle: "Backend Developer", department: "Engineering" },
  { key: "u8", firstName: "Laila", lastName: "Mostafa", email: "laila.mostafa@orgtik.test", userType: "employee", jobTitle: "UI/UX Designer", department: "Design" },
  { key: "u9", firstName: "Ahmed", lastName: "Tarek", email: "ahmed.tarek@orgtik.test", userType: "employee", jobTitle: "QA Engineer", department: "Engineering" },
  { key: "u10", firstName: "Rana", lastName: "Saad", email: "rana.saad@orgtik.test", userType: "employee", jobTitle: "HR Specialist", department: "Human Resources" },
  { key: "u11", firstName: "Mahmoud", lastName: "Gamal", email: "mahmoud.gamal@orgtik.test", userType: "employee", jobTitle: "DevOps Engineer", department: "Engineering" },
  { key: "u12", firstName: "Dina", lastName: "Fathy", email: "dina.fathy@orgtik.test", userType: "employee", jobTitle: "Marketing Specialist", department: "Marketing" },
  { key: "u13", firstName: "Tamer", lastName: "Wagdy", email: "tamer.wagdy@orgtik.test", userType: "salesman", jobTitle: "Account Manager", department: "Sales" },
  { key: "u14", firstName: "Hoda", lastName: "Ashraf", email: "hoda.ashraf@orgtik.test", userType: "employee", jobTitle: "Content Writer", department: "Marketing" },
  { key: "u15", firstName: "Sherif", lastName: "Magdy", email: "sherif.magdy@orgtik.test", userType: "manager", jobTitle: "Project Manager", department: "Engineering" },
  { key: "u16", firstName: "Aya", lastName: "Hamed", email: "aya.hamed@orgtik.test", userType: "employee", jobTitle: "Accountant", department: "Finance" },
];

const users = PEOPLE.map((p, i) => {
  const createdAt = daysFromNow(-400 + i * 11);
  return {
    id: i + 1,
    key: p.key,
    email: p.email,
    username: `${p.firstName}.${p.lastName}`.toLowerCase(),
    firstName: p.firstName,
    lastName: p.lastName,
    avatar: null,
    isActive: true,
    isEmailVerified: true,
    managerId: p.key === "admin" ? null : p.key === "manager" || p.key === "u15" ? 1 : 2,
    userType: p.userType,
    phone: `+2010${String(12345670 + i * 137).slice(0, 8)}`,
    password: LOCAL_PASSWORD,
    createdAt,
    updatedAt: createdAt,
    profile: {
      id: i + 1,
      jobTitle: p.jobTitle,
      department: p.department,
      about: null,
      language: "en",
      timeZone: "Africa/Cairo",
      weekStartDay: "saturday",
      dateFormat: "DD/MM/YYYY",
      timeFormat: "24h",
      flyoutToastMessage: true,
      timezoneChangeNotification: true,
      createdAt,
      updatedAt: createdAt,
    },
  };
});

// ---- scopes & grants (filled by server.js from each app module) ----
const scopes = [];
const grants = {}; // scopeName -> { userKey: { roles, permissions } }

function addScope(def, appKey) {
  if (scopes.some((s) => s.name === def.name)) return;
  const createdAt = daysFromNow(-420);
  scopes.push({
    id: scopes.length + 1,
    name: def.name,
    displayName: def.displayName || def.name,
    domain: def.domain || (appKey ? config.webUrl(appKey) : config.webUrl("sos")),
    description: def.description || "",
    isActive: def.isActive !== false,
    metadata: def.metadata || { icon: "solar:widget-bold", color: "#8135cd" },
    createdAt,
    updatedAt: createdAt,
  });
}

function addGrants(scopeName, map) {
  grants[scopeName] = grants[scopeName] || {};
  for (const [userKey, v] of Object.entries(map || {})) {
    const entry = Array.isArray(v) ? { roles: v, permissions: [] } : { roles: v.roles || [], permissions: v.permissions || [] };
    grants[scopeName][userKey] = entry;
  }
}

// Called once by server.js with every loaded app module.
function registerModules(modules) {
  addScope({ name: "global", displayName: "Global", description: "Access to the whole Orgtik suite.", metadata: { icon: "solar:home-2-bold", color: "#BBBBBB" } }, "sos");
  for (const m of modules) {
    for (const s of m.scopes || []) addScope(s, s.web || m.key);
    for (const [scopeName, map] of Object.entries(m.grants || {})) addGrants(scopeName, map);
  }
  // Every seeded person is at least a member of the global scope; the admin is super admin.
  const g = grants.global || (grants.global = {});
  for (const u of users) if (!g[u.key]) g[u.key] = { roles: [], permissions: [] };
  if (!g.admin || g.admin.roles.length === 0) g.admin = { roles: ["super_admin"], permissions: [] };
}

// [{ scope, roles, permissions }] for a user, only scopes where they have an entry.
function userScopes(user) {
  if (sessionAuthority?.hasPreparedRequest()) return sessionAuthority.projectionFor(user).scopes || [];
  const out = [];
  for (const s of scopes) {
    const e = grants[s.name]?.[user.key];
    if (e) out.push({ scope: s.name, roles: [...e.roles], permissions: [...e.permissions] });
  }
  return out;
}

const scopeByName = (name) => scopes.find((s) => s.name === name);

// ---- users ----
const findUser = (id) => users.find((u) => String(u.id) === String(id));
const findByKey = (key) => users.find((u) => u.key === key);
const findByEmail = (email) => users.find((u) => u.email.toLowerCase() === String(email || "").trim().toLowerCase());
const fullName = (u) => `${u.firstName} ${u.lastName}`;

// The IApiUser/IUser shape the SOS API returns (no password, no internal key).
function publicUser(u) {
  if (!u) return null;
  const { password, passwordHash, key, signupSeal, ...rest } = u;
  return { ...rest, deletedAt: u.deletedAt ?? null };
}

// Token issuance is synchronous only within a prepared candidate request. The server must
// commit its account/workspace changes and authority.commitPending(frame) before response.
function issueTokens(user, extra = {}) {
  if (!sessionAuthority) throw Object.assign(new Error("Session authority is not ready."), { status: 503, code: "session_not_prepared" });
  return sessionAuthority.issueTokens(user, extra);
}
function decode(token) {
  const p = sessionAuthority?.verifiedFromToken(token);
  return p ? { ...p.claims, ...(p.readOnly ? { readOnly: true, impersonatedBy: publicUser(p.actor) } : {}) } : null;
}

// Authorization accepts Bearer and the existing JSON token wrapper. Query values never
// authenticate HTTP; public-resource capabilities belong to their own boundary.
function tokenFrom(req) {
  return require("./session-authority").tokenFrom(req);
}

// Deactivated or deleted users are signed out even if they still hold a token.
function preparedIdentityUser(principal) {
  if (!principal || principal.claims.type !== "access") return null;
  // The coordinator hydrates identity storage before preparing the request. Auth
  // commands must mutate that journal-owned record, never the verifier's read copy.
  const canonical = findUser(principal.user.id);
  if (!canonical || canonical.key !== principal.user.key || canonical.isActive !== principal.user.isActive || (canonical.authVersion ?? 0) !== (principal.user.authVersion ?? 0)) throw Object.assign(new Error("The prepared identity record is unavailable."), { status: 503, code: "identity_not_prepared" });
  return canonical;
}
function userFromToken(token) {
  const principal = sessionAuthority?.verifiedFromToken(token);
  return preparedIdentityUser(principal);
}
const userFromReq = (req) => preparedIdentityUser(sessionAuthority?.verifiedFromReq(req));

// Express middleware-ish helper: returns the user or sends 401 and returns null.
function requireUser(req, res) {
  const u = userFromReq(req);
  if (!u) {
    fail(res, 401, "Unauthorized");
    return null;
  }
  return u;
}

function authPayload(user, extraTokenClaims) {
  const tokens = issueTokens(user, extraTokenClaims), projection = sessionAuthority.projectionFor(user), selected = projection.scopes || [];
  return { user: publicUser(user), tokens, scopes: selected, roles: [...new Set(selected.flatMap(s => s.roles))], permissions: [], workspaceContext: projection.workspaceContext ?? null, staffAccess: projection.staffAccess ?? null };
}

// ---- /api/auth/* core routes (mounted on the SOS API port before the SOS module) ----
function routes(app) {
  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body || {};
    const u = findByEmail(email);
    if (!u || !passwordMatches(u, password)) return fail(res, 401, "Invalid email or password. Please try again.");
    if (u.deletedAt) return fail(res, 401, "Invalid email or password. Please try again.");
    if (!u.isActive) return fail(res, 403, "This account is deactivated.");
    return ok(res, authPayload(u), "Login successful");
  });

  // Sign-up from the public website (2026-10-07): a new customer account, signed in at once.
  // Modules that give a customer somewhere to land (the platform's workspace) listen through
  // onRegister. The server commits the account to its own store before returning success.
  app.post("/api/auth/register", (req, res) => {
    const b = req.body || {};
    const email = String(b.email || "").trim().toLowerCase();
    const name = String(b.name || "").trim();
    const password = String(b.password || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(res, 400, "Please enter a valid email.");
    if (!name) return fail(res, 400, "Please enter your name.");
    if (password.length < 8) return fail(res, 400, "Use at least 8 characters for your password.");
    if (findByEmail(email)) return fail(res, 409, "An account with this email already exists. Sign in instead.");
    const [firstName, ...rest] = name.split(/\s+/);
    const at = new Date().toISOString();
    // Shared with HR hiring/invitation activation; the candidate domain commit
    // preserves existing IDs and rejects a collision across concurrent writers.
    const id = require("./workspace-people").allocatePersonId(module.exports);
    const u = {
      id, key: `signup_${id}`, email, username: email.split("@")[0], firstName, lastName: rest.join(" "),
      avatar: null, isActive: true, isEmailVerified: true, managerId: null, userType: "customer", phone: null,
      createdAt: at, updatedAt: at,
      profile: { id, jobTitle: null, department: String(b.company || "").trim() || null, about: null, language: "en", timeZone: "Europe/Zurich", weekStartDay: "monday", dateFormat: "DD/MM/YYYY", timeFormat: "24h", flyoutToastMessage: true, timezoneChangeNotification: true, createdAt: at, updatedAt: at },
    };
    setPassword(u, password);
    addSignupUser(u, { company: String(b.company || "").trim() });
    return ok(res, authPayload(u), "Account created", 201);
  });

  app.get("/api/auth/me", (req, res) => {
    const u = requireUser(req, res);
    if (!u) return;
    return ok(res, { user: publicUser(u), scopes: userScopes(u) }, "Profile fetched");
  });

  // Scopes the SoSBar launcher shows (it adds "global" itself).
  app.get("/api/auth/my-scopes", (req, res) => {
    const u = requireUser(req, res);
    if (!u) return;
    const names = new Set(userScopes(u).map((s) => s.scope));
    return ok(res, scopes.filter((s) => s.name !== "global" && s.isActive && names.has(s.name)), "Scopes fetched");
  });

  const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
  app.post("/api/auth/refresh", asyncRoute(async (req, res) => {
    if (!sessionAuthority) throw Object.assign(new Error("Session authority is not ready."), { status: 503 });
    return ok(res, await sessionAuthority.refresh(req.body?.refreshToken, { workspaceHeader: req.headers?.["x-workspace"] }), "Token refreshed");
  }));
  app.post("/api/auth/logout", asyncRoute(async (req, res) => {
    if (!sessionAuthority) throw Object.assign(new Error("Session authority is not ready."), { status: 503 });
    await sessionAuthority.logout(tokenFrom(req)); return ok(res, null, "Logged out");
  }));
  app.post("/api/auth/logout-all", asyncRoute(async (req, res) => {
    if (!sessionAuthority) throw Object.assign(new Error("Session authority is not ready."), { status: 503 });
    const user = requireUser(req, res); if (!user) return;
    await sessionAuthority.logout(tokenFrom(req), true);
    user.authVersion = (user.authVersion || 0) + 1;
    return ok(res, null, "All sessions logged out");
  }));

  // The hand-off between suite apps without a token in the address (FS-SOS-2, D-017 as proposed):
  // the launcher asks for a one-time code from the signed-in session; the app it opens sends the
  // code back here and gets the session's access token in the response body. A code works once,
  // for 60 seconds. (A proposal for the real API; the mock keeps codes in memory.)
  app.post("/api/auth/handoff", asyncRoute(async (req, res) => {
    if (!sessionAuthority) throw Object.assign(new Error("Session authority is not ready."), { status: 503 });
    return ok(res, await sessionAuthority.createHandoff(tokenFrom(req), req.body?.audience || req.body?.target), "Hand-off code created");
  }));

  app.post("/api/auth/handoff/exchange", asyncRoute(async (req, res) => {
    if (!sessionAuthority) throw Object.assign(new Error("Session authority is not ready."), { status: 503 });
    return ok(res, await sessionAuthority.exchangeHandoff(req.body?.code, req.body?.audience || req.body?.target), "Signed in");
  }));
}
const registerHooks = [];
const onRegister = (fn) => registerHooks.push(fn);
// Adds a signed-up person and lets modules give them somewhere to land. Registration metadata
// stays private; the account store rehydrates it before replay. Old unsigned/sealed sessions
// require sign-in again and never reconstruct accounts from current HTTP tokens.
function addSignupUser(u, info = {}) {
  if (u.password !== undefined) setPassword(u, u.password);
  Object.defineProperty(u, "signupInfo", { value: info, enumerable: false, configurable: true });
  if (!findUser(u.id)) users.push(u);
  (grants.global || (grants.global = {}))[u.key] = { roles: [], permissions: [] };
  for (const fn of registerHooks) {
    try {
      fn(u, info);
    } catch (e) {
      console.error("[identity] a sign-up hook failed:", e);
    }
  }
  return u;
}

// Merge in place: app modules hold references to these users. Stored grants and credentials
// take precedence over seed defaults, including deactivation and password changes.
function hydrate(records, { replace = false } = {}) {
  const ids = new Set(records.keys());
  if (replace) {
    for (let i = users.length - 1; i >= 0; i--) {
      if (!ids.has(String(users[i].id))) {
        for (const members of Object.values(grants)) delete members[users[i].key];
        users.splice(i, 1);
      }
    }
  }
  for (const raw of records.values()) {
    const record = JSON.parse(raw);
    let user = findUser(record.user.id);
    if (!user) {
      user = record.user;
      if (record.registration) addSignupUser(user, record.registration);
      else users.push(user);
    } else {
      for (const key of Object.keys(user)) delete user[key];
      Object.assign(user, record.user);
      if (record.registration) addSignupUser(user, record.registration);
    }
    for (const members of Object.values(grants)) delete members[user.key];
    for (const [scope, value] of Object.entries(record.grants || {})) (grants[scope] ||= {})[user.key] = value;
  }
}

// A private facade is supplied only to committed-history reducers. It is never mounted as
// HTTP identity and does not create sessions. Historical actor expiry/revocation cannot undo
// already committed effects; callers still supply persisted accounts before replay.
function createCommittedReplayFacade() {
  const { AsyncLocalStorage } = require("node:async_hooks"), trusted = new AsyncLocalStorage(), bound = new WeakMap();
  const clone = value => JSON.parse(JSON.stringify(value));
  const people = users.map(user => { const { password, passwordHash, signupSeal, ...safe } = user; return clone(safe); });
  const privateScopes = clone(scopes), privateGrants = clone(grants), hooks = [];
  const legacyFailure = message => Object.assign(new Error(message), { status: 503, code: "legacy_tool_replay_unavailable" });
  const active = () => { const frame = trusted.getStore(); return frame?.active ? frame : null; };
  const normalized = value => {
    let token = String(value || "").trim().replace(/^Bearer\s+/i, "");
    try { if (token.startsWith('"') || token.startsWith("{")) { token = JSON.parse(token); if (typeof token === "object") token = token.accessToken; } } catch { return null; }
    return typeof token === "string" && token ? token : null;
  };
  const privateFind = id => people.find(user => String(user.id) === String(id));
  const fromReq = req => { const frame = active(); return frame && bound.get(req) === frame ? frame.actor : null; };
  const legacyScopes = user => privateScopes.flatMap(scope => { const entry = privateGrants[scope.name]?.[user?.key]; return entry ? [{ scope: scope.name, roles: [...(entry.roles || [])], permissions: [...(entry.permissions || [])] }] : []; });
  const noIssue = () => { throw legacyFailure("Committed replay cannot issue sessions or change HTTP authority."); };
  function runAccepted(entry, fn, { allowAnonymous = false } = {}) {
    if (!entry || !["tasks", "files", "hr", "sales", "marketing", "wm"].includes(entry.app) || !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(entry.method) || !Number.isFinite(Number(entry.at)) || typeof entry.url !== "string" || !entry.url.startsWith("/") || entry.kind || entry.platformState || entry.checkpoint) throw legacyFailure("Only an accepted legacy tool entry can prepare historical authority.");
    const header = Object.entries(entry.headers || {}).find(([name]) => name.toLowerCase() === "authorization")?.[1];
    const token = normalized(header || new URL(entry.url, "http://private-replay.invalid").searchParams.get("token"));
    let claims = null, actor = null;
    if (token) {
      try { claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")); } catch { throw legacyFailure("A committed tool actor could not be recovered."); }
      actor = privateFind(claims.sub ?? claims.id);
      if (!actor) throw legacyFailure("A committed tool actor is absent from the persisted account registry.");
      if (claims.readOnly && !["GET", "HEAD", "OPTIONS"].includes(entry.method)) throw legacyFailure("Read-only history cannot contain a committed tool mutation.");
      // Current deactivation cannot undo a past committed effect. This copy is private
      // to the reducer and is never written back to identity storage.
      actor = { ...actor, isActive: true, deletedAt: null };
    } else if (!allowAnonymous || entry.method !== "POST" || !(entry.app === "wm" && ["/v2/public/leads", "/v2/public/ideas", "/v2/__mock/forms-live", "/v2/__mock/without-suggestions"].includes(new URL(entry.url, "http://private-replay.invalid").pathname) || entry.app === "sales" && new URL(entry.url, "http://private-replay.invalid").pathname === "/api/leads/intake")) throw legacyFailure("An accepted private command has no recoverable actor.");
    const frame = { entry, token, claims, actor, active: true };
    let result;
    try { result = trusted.run(frame, fn); } catch (error) { frame.active = false; throw error; }
    if (result && typeof result.then === "function") return Promise.resolve(result).finally(() => { frame.active = false; });
    frame.active = false; return result;
  }
  return {
    workspaceMode: false, LOCAL_PASSWORD, users: people, scopes: privateScopes, grants: privateGrants, fullName, publicUser, nowIso, setPassword, passwordMatches,
    findUser: privateFind, findByKey: key => people.find(user => user.key === key), findByEmail: email => people.find(user => user.email.toLowerCase() === String(email || "").trim().toLowerCase()), scopeByName: name => privateScopes.find(scope => scope.name === name),
    userScopes: legacyScopes, userFromReq: fromReq,
    tokenFrom: req => { const frame = active(); return frame && bound.get(req) === frame ? frame.token : null; },
    decode: token => { const frame = active(); return frame && normalized(token) === frame.token ? frame.claims : null; },
    userFromToken: token => { const frame = active(); return frame && normalized(token) === frame.token ? frame.actor : null; },
    requireUser: (req, res) => { const found = fromReq(req); if (!found) fail(res, 401, "Unauthorized"); return found; },
    runAccepted,
    bindAcceptedRequest(req) { const frame = active(); if (!frame || req.method !== frame.entry.method || req.url !== frame.entry.url) throw legacyFailure("Historical request does not match its accepted entry."); bound.set(req, frame); },
    onRegister: fn => hooks.push(fn),
    registerModules(modules) {
      for (const module of modules) {
        for (const scope of module.scopes || []) if (!privateScopes.some(row => row.name === scope.name)) privateScopes.push({ ...clone(scope), domain: config.webUrl(module.key), isActive: true });
        for (const [name, entries] of Object.entries(module.grants || {})) for (const [key, value] of Object.entries(entries)) (privateGrants[name] ||= {})[key] = Array.isArray(value) ? { roles: [...value], permissions: [] } : clone(value);
      }
    },
    issueTokens: noIssue, authPayload: noIssue, routes: noIssue, configureAuthority: noIssue, configureStore: noIssue, hydrate: noIssue,
  };
}

module.exports = {
  LOCAL_PASSWORD, users, scopes, grants, onRegister, configureStore, configureAuthority, hydrate, setPassword, passwordMatches, createCommittedReplayFacade,
  registerModules, userScopes, scopeByName,
  findUser, findByKey, findByEmail, fullName, publicUser,
  issueTokens, decode, tokenFrom, userFromToken, userFromReq, requireUser, authPayload,
  routes, nowIso,
};
