const crypto = require("node:crypto");
const { AsyncLocalStorage } = require("node:async_hooks");
const { RealDate } = require("./clock");

const ACCESS_TTL = 30 * 24 * 3600, REFRESH_TTL = 90 * 24 * 3600, HANDOFF_TTL = 60;
const AUDIENCES = new Set(["identity", "suite", "tool:tasks", "tool:files", "tool:hr", "tool:sales", "tool:marketing", "tool:chats", "staff:admin", "staff:wm"]);
const MODES = new Set(["identity", "workspace", "staff"]);
const CLAIMS = ["aud", "exp", "fid", "iat", "iss", "jti", "mode", "sid", "sub", "type", "v", "workspaceId"];
const clone = value => JSON.parse(JSON.stringify(value));
const id = () => crypto.randomFillSync(Buffer.alloc(24)).toString("base64url");
const digest = value => crypto.createHash("sha256").update(String(value)).digest("hex");
const authError = (code = "session_invalid", status = 401) => Object.assign(new Error(status === 503 ? "Session service unavailable. Please retry." : "This session is no longer valid. Sign in again."), { status, code });
const currentVersion = user => {
  if (user.authVersion === undefined) return 0; // preserved account records before R1
  if (!Number.isSafeInteger(user.authVersion) || user.authVersion < 0) throw authError("account_version_invalid", 503);
  return user.authVersion;
};
const activeUser = user => user && user.isActive === true && !user.deletedAt;
const accessEpoch = value => {
  if (value === undefined) return 0; // session families and memberships preserved before R1
  if (!Number.isSafeInteger(value) || value < 0) throw authError("member_epoch_invalid", 503);
  return value;
};
const memberEpoch = context => accessEpoch(context?.workspaceContext?.member?.accessEpoch);
const staffEpoch = context => accessEpoch(context?.staffAccess?.accessEpoch);
const normalToken = value => {
  let token = String(value || "").trim();
  if (/^bearer\s+/i.test(token)) token = token.replace(/^bearer\s+/i, "");
  if (token.startsWith('"')) { try { token = JSON.parse(token); } catch { return null; } }
  if (String(token).startsWith("{")) { try { token = JSON.parse(token).accessToken; } catch { return null; } }
  return typeof token === "string" && token.length > 0 && token.length <= 16384 ? token : null;
};
const tokenFrom = req => normalToken(req.headers?.authorization || req.headers?.Authorization); // no query-token authentication

function createSessionAuthority(options) {
  const { realm, store } = options;
  if (!/^[\w-]{1,100}$/.test(realm || "") || store.realm !== realm) throw authError("session_store_unavailable", 503);
  const requestState = new AsyncLocalStorage(), frames = new WeakSet(), principals = new WeakMap();
  let callbacks = { loadUser: options.loadUser, resolveWorkspace: options.resolveWorkspace, contextFor: options.contextFor }, key, keyPromise;
  const now = () => Math.floor(RealDate.now() / 1000);
  const configureAuthority = next => { callbacks = { ...callbacks, ...next }; };
  async function readyKey() {
    if (!keyPromise) keyPromise = Promise.resolve(store.signingKey()).then(value => { key = Buffer.from(value); return key; }).catch(error => { keyPromise = null; throw error; });
    return keyPromise;
  }
  function sign(claims) {
    if (!key) throw authError("session_not_prepared", 503);
    const head = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify(claims)).toString("base64url"), input = `${head}.${body}`;
    return `${input}.${crypto.createHmac("sha256", key).update(input).digest("base64url")}`;
  }
  function decodeSigned(value, expectedType) {
    const token = normalToken(value);
    if (!token || !key) throw authError();
    try {
      const parts = token.split(".");
      if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) throw authError();
      const header = JSON.parse(Buffer.from(parts[0], "base64url")), p = JSON.parse(Buffer.from(parts[1], "base64url"));
      if (header.alg !== "HS256" || header.typ !== "JWT" || Object.keys(header).sort().join() !== "alg,typ") throw authError();
      const signature = Buffer.from(parts[2], "base64url"), expected = crypto.createHmac("sha256", key).update(`${parts[0]}.${parts[1]}`).digest();
      if (signature.length !== expected.length || !crypto.timingSafeEqual(signature, expected)) throw authError();
      if (Object.keys(p).sort().join() !== CLAIMS.join() || p.v !== 1 || p.iss !== `orgtik-mock:${realm}` || !AUDIENCES.has(p.aud) || !MODES.has(p.mode)) throw authError();
      if (!["access", "refresh"].includes(p.type) || expectedType && p.type !== expectedType || p.type === "refresh" && p.aud !== "identity") throw authError();
      if (!Number.isSafeInteger(p.iat) || !Number.isSafeInteger(p.exp) || p.exp <= now() || p.iat > now() + 30 || p.exp <= p.iat || p.exp - p.iat > (p.type === "access" ? ACCESS_TTL : REFRESH_TTL)) throw authError();
      if (![p.sid, p.fid, p.jti].every(x => typeof x === "string" && /^[\w-]{16,100}$/.test(x)) || !["string", "number"].includes(typeof p.sub)) throw authError();
      if (p.workspaceId !== null && (typeof p.workspaceId !== "string" || !p.workspaceId || p.workspaceId.length > 150)) throw authError();
      return { token, claims: p };
    } catch { throw authError(); }
  }
  function records(doc, claims) {
    const session = doc.state.sessions[claims.sid], family = doc.state.families[claims.fid];
    if (!session || !family || session.revokedAt || family.revokedAt || session.expiresAt <= now() || family.expiresAt <= now()) throw authError();
    if ((session.securityVersion || 0) !== (doc.state.userVersions?.[String(session.principalUserId)] || 0) || session.impersonation && (session.impersonation.effectiveSecurityVersion || 0) !== (doc.state.userVersions?.[String(session.impersonation.effectiveUserId)] || 0)) throw authError();
    if (String(session.principalUserId) !== String(claims.sub) || family.sid !== claims.sid || family.workspaceId !== claims.workspaceId || family.mode !== claims.mode || claims.type === "access" && family.accessAudience !== claims.aud) throw authError();
    return { session, family };
  }
  async function user(idValue) {
    if (typeof callbacks.loadUser !== "function") throw authError("session_not_configured", 503);
    let value;
    try { value = await callbacks.loadUser(idValue); }
    catch (error) { if (error.status) throw error; throw authError("account_store_unavailable", 503); }
    if (!activeUser(value)) throw authError();
    return value;
  }
  async function principal(doc, parsed, { audience, workspaceHeader, refreshHash = false, revalidate = false, frame } = {}) {
    const { claims, token } = parsed, { session, family } = records(doc, claims);
    if (audience && !(Array.isArray(audience) ? audience : [audience]).includes(claims.aud)) throw authError("audience_mismatch");
    if (workspaceHeader !== undefined && String(workspaceHeader) !== String(claims.workspaceId)) throw authError("workspace_mismatch", 409);
    if (refreshHash && family.tokenHash !== digest(token)) throw authError("refresh_reuse");
    const actor = await user(session.principalUserId);
    if (currentVersion(actor) !== session.authVersion) throw authError();
    const effective = session.impersonation ? await user(session.impersonation.effectiveUserId) : actor;
    if (session.impersonation && currentVersion(effective) !== session.impersonation.effectiveAuthVersion) throw authError();
    const readOnly = Boolean(session.impersonation);
    let context = { scopes: [], workspaceContext: null, staffAccess: null };
    if (claims.mode !== "identity") {
      if (typeof callbacks.resolveWorkspace !== "function") throw authError("session_not_configured", 503);
      context = await callbacks.resolveWorkspace(effective, { workspaceId: claims.workspaceId, mode: claims.mode, audience: family.accessAudience, readOnly, actor, ...(revalidate ? { revalidate: true, frame } : {}) });
      if (!context) throw authError("workspace_forbidden", 403);
      if (claims.mode === "workspace" && accessEpoch(family.memberAccessEpoch) !== memberEpoch(context)) throw authError("membership_revoked");
      if ((claims.mode === 'staff' || readOnly) && accessEpoch(family.staffAccessEpoch) !== staffEpoch(context)) throw authError('staff_membership_revoked');
    } else if (claims.workspaceId !== null || family.accessAudience !== "identity") throw authError();
    return { user: effective, actor, claims, context, session, family, readOnly };
  }
  function issueContext(effective, extra, frame) {
    if (typeof callbacks.contextFor !== "function") throw authError("session_not_configured", 503);
    const context = callbacks.contextFor(effective, { extra, principal: frame.principal, request: frame.request });
    if (!context || typeof context.then === "function") throw authError("session_context_not_prepared", 503);
    const mode = context.mode || (context.workspaceId ? "workspace" : "identity"), audience = context.audience || (mode === "identity" ? "identity" : "suite");
    const workspaceId = context.workspaceId ?? context.workspaceContext?.workspace?.id ?? null;
    if (!MODES.has(mode) || !AUDIENCES.has(audience) || mode === "identity" && (workspaceId !== null || audience !== "identity") || mode === "workspace" && (!workspaceId || audience.startsWith("staff:")) || mode === "staff" && !audience.startsWith("staff:")) throw authError("invalid_session_context", 403);
    let actor = effective, impersonation;
    if (extra.impersonatedBy) {
      actor = frame.principal?.actor;
      if (!actor || !context.impersonationApproved || mode !== "workspace" || audience.startsWith("staff:")) throw authError("impersonation_forbidden", 403);
      impersonation = { effectiveUserId: effective.id, effectiveAuthVersion: currentVersion(effective), effectiveSecurityVersion: frame.base.state.userVersions?.[String(effective.id)] || 0, readOnly: true, reason: context.reason || "View as" };
    }
    return { context, actor, mode, audience, workspaceId, impersonation };
  }
  function newFamily(session, { workspaceId, mode, audience, context }, state) {
    const fid = id(), at = now(), expiresAt = Math.min(session.expiresAt, at + REFRESH_TTL);
    const family = { fid, sid: session.sid, workspaceId, mode, accessAudience: audience, memberAccessEpoch: mode === "workspace" ? memberEpoch(context) : 0, staffAccessEpoch: mode === 'staff' || session.impersonation ? staffEpoch(context) : 0, generation: 0, tokenHash: null, expiresAt, revokedAt: null };
    state.families[fid] = family;
    return mint(session, family);
  }
  function mint(session, family) {
    const at = now(), common = { v: 1, iss: `orgtik-mock:${realm}`, sub: session.principalUserId, sid: session.sid, fid: family.fid, workspaceId: family.workspaceId, mode: family.mode, iat: at };
    if (Math.min(family.expiresAt, session.expiresAt) <= at) throw authError();
    const accessToken = sign({ ...common, aud: family.accessAudience, type: "access", exp: Math.min(at + ACCESS_TTL, session.expiresAt, family.expiresAt), jti: id() });
    const refreshToken = sign({ ...common, aud: "identity", type: "refresh", exp: Math.min(family.expiresAt, session.expiresAt), jti: id() });
    family.tokenHash = digest(refreshToken);
    return { accessToken, refreshToken, expiresIn: Math.min(ACCESS_TTL, session.expiresAt - at, family.expiresAt - at) };
  }
  async function prepareRequest(req, requestOptions = {}) {
    await readyKey();
    const base = await store.read();
    const token = requestOptions.token === undefined ? tokenFrom(req) : normalToken(requestOptions.token);
    const frame = { base, request: req, token, headerToken: tokenFrom(req), principal: null, pending: [], discarded: false, committed: false };
    if (token) frame.principal = await principal(base, decodeSigned(token, requestOptions.type || "access"), { audience: requestOptions.audience, workspaceHeader: req.headers?.["x-workspace"] });
    else if (!requestOptions.allowAnonymous) throw authError();
    frames.add(frame); principals.set(req, { frame, principal: frame.principal });
    return frame;
  }
  function runPrepared(frame, fn) { if (!frames.has(frame) || frame.discarded) throw authError("session_not_prepared", 503); return requestState.run(frame, fn); }
  function runWithoutRequest(fn) { return requestState.run(null, fn); }
  async function revalidatePrepared(frame) {
    if (!frames.has(frame) || frame.discarded || frame.committed) throw authError("session_not_prepared", 503);
    if (!frame.principal) return null;
    const original = frame.principal;
    const fresh = await principal(await store.read(), decodeSigned(frame.token, original.claims.type), { revalidate: true, frame });
    const originalMember = original.context.workspaceContext?.member, currentMember = fresh.context.workspaceContext?.member;
    if (String(fresh.actor.id) !== String(original.actor.id) || String(fresh.user.id) !== String(original.user.id) || fresh.readOnly !== original.readOnly || currentMember?.revision !== originalMember?.revision || memberEpoch(fresh.context) !== memberEpoch(original.context) || JSON.stringify(fresh.context.scopes || []) !== JSON.stringify(original.context.scopes || []) || JSON.stringify(fresh.context.staffAccess || null) !== JSON.stringify(original.context.staffAccess || null)) throw authError("authority_changed", 409);
    return fresh;
  }
  function bindPreparedRequest(req, frame) {
    if (!frames.has(frame) || frame.discarded || tokenFrom(req) !== frame.headerToken) throw authError("session_not_prepared", 503);
    principals.set(req, { frame, principal: frame.principal });
  }
  function issueTokens(effective, extra = {}) {
    const frame = requestState.getStore();
    if (!frame || frame.discarded || frame.committed || !activeUser(effective)) throw authError("session_not_prepared", 503);
    if (frame.principal?.readOnly && !extra.impersonatedBy && !(String(effective.id) === String(frame.principal.actor.id) && /\/api\/auth\/exit-impersonation(?:$|\?)/.test(frame.request.path || frame.request.url || ""))) throw authError("impersonation_read_only", 403);
    const context = issueContext(effective, extra, frame), at = now();
    const session = { sid: id(), principalUserId: context.actor.id, authVersion: currentVersion(context.actor), securityVersion: frame.base.state.userVersions?.[String(context.actor.id)] || 0, createdAt: at, expiresAt: at + REFRESH_TTL, revokedAt: null, authStrength: "password", ...(context.impersonation ? { impersonation: context.impersonation } : {}) };
    const state = { sessions: { [session.sid]: session }, families: {}, handoffs: {} }, tokens = newFamily(session, context, state);
    frame.pending.push({ sessions: state.sessions, families: state.families });
    frame.issueProjection = { ...context.context, readOnly: Boolean(context.impersonation), actor: context.actor, user: effective };
    return tokens;
  }
  async function commitPending(frame) {
    if (!frames.has(frame) || frame.discarded || frame.committed) throw authError("session_not_prepared", 503);
    if (!frame.pending.length) { frame.committed = true; return; }
    await atomic(async doc => {
      if (frame.token) await principal(doc, decodeSigned(frame.token, "access"));
      for (const pending of frame.pending) {
        for (const session of Object.values(pending.sessions)) {
          const actor = await user(session.principalUserId);
          if (currentVersion(actor) !== session.authVersion) throw authError();
          if ((doc.state.userVersions?.[String(actor.id)] || 0) !== session.securityVersion) throw authError();
          const effective = session.impersonation ? await user(session.impersonation.effectiveUserId) : actor;
          if (session.impersonation && currentVersion(effective) !== session.impersonation.effectiveAuthVersion) throw authError();
          if (session.impersonation && (doc.state.userVersions?.[String(effective.id)] || 0) !== session.impersonation.effectiveSecurityVersion) throw authError();
          for (const family of Object.values(pending.families)) if (family.sid === session.sid && family.mode !== "identity") {
            const projection = await callbacks.resolveWorkspace(effective, { workspaceId: family.workspaceId, mode: family.mode, audience: family.accessAudience, readOnly: Boolean(session.impersonation), actor });
            if (!projection) throw authError("workspace_forbidden", 403);
            if (family.mode === "workspace" && accessEpoch(family.memberAccessEpoch) !== memberEpoch(projection)) throw authError("membership_revoked");
            if ((family.mode === 'staff' || session.impersonation) && accessEpoch(family.staffAccessEpoch) !== staffEpoch(projection)) throw authError('staff_membership_revoked');
          }
        }
        Object.assign(doc.state.sessions, clone(pending.sessions)); Object.assign(doc.state.families, clone(pending.families));
      }
      return { changed: true };
    });
    frame.committed = true; frame.pending = [];
  }
  async function atomic(fn) {
    await readyKey();
    for (let attempt = 0; attempt < 4; attempt++) {
      const doc = await store.read(), result = await fn(doc);
      try { if (result.changed) await store.compareAndSwap(doc.revision, doc.state); }
      catch (error) { if (error.status === 409 && attempt < 3) continue; throw error; }
      if (result.error) throw result.error;
      return result.value;
    }
    throw authError("session_conflict", 409);
  }
  async function refresh(value, opts = {}) {
    return atomic(async doc => {
      const parsed = decodeSigned(value, "refresh"), p = await principal(doc, parsed, { workspaceHeader: opts.workspaceHeader });
      if (p.family.tokenHash !== digest(parsed.token)) { p.family.revokedAt = now(); return { changed: true, error: authError("refresh_reuse") }; }
      p.family.generation++;
      return { changed: true, value: { ...mint(p.session, p.family), workspaceContext: p.context.workspaceContext ?? null } };
    });
  }
  async function switchContext(value, opts = {}) {
    return atomic(async doc => {
      const p = await principal(doc, decodeSigned(value, "access"));
      const extra = { workspaceId: Object.prototype.hasOwnProperty.call(opts, "workspaceId") ? opts.workspaceId : p.claims.workspaceId, mode: opts.mode ?? p.claims.mode, audience: opts.audience ?? p.family.accessAudience };
      const selected = issueContext(p.user, extra, { principal: p, request: requestState.getStore()?.request || { path: "/api/auth/workspace" } });
      if (p.readOnly && (selected.workspaceId !== p.claims.workspaceId || selected.mode !== p.claims.mode || selected.audience.startsWith("staff:"))) throw authError("impersonation_read_only", 403);
      let projection = selected.context;
      if (selected.mode !== "identity") {
        projection = await callbacks.resolveWorkspace(p.user, { workspaceId: selected.workspaceId, mode: selected.mode, audience: selected.audience, readOnly: p.readOnly, actor: p.actor });
        if (!projection) throw authError("workspace_forbidden", 403);
      }
      const tokens = newFamily(p.session, { ...selected, context: projection }, doc.state);
      return { changed: true, value: { tokens, accessToken: tokens.accessToken, workspaceContext: projection.workspaceContext ?? null, scopes: projection.scopes || [], staffAccess: projection.staffAccess ?? selected.context.staffAccess ?? null } };
    });
  }
  async function logout(value, all = false) {
    return atomic(async doc => {
      const p = await principal(doc, decodeSigned(value, "access"));
      if (all) (doc.state.userVersions ||= {})[String(p.actor.id)] = (doc.state.userVersions?.[String(p.actor.id)] || 0) + 1;
      for (const session of Object.values(doc.state.sessions)) if (session.sid === p.session.sid || all && String(session.principalUserId) === String(p.actor.id)) session.revokedAt = now();
      return { changed: true, value: null };
    });
  }
  async function revokeUser(userId, workspaceId) {
    return atomic(async doc => {
      if (workspaceId === undefined) (doc.state.userVersions ||= {})[String(userId)] = (doc.state.userVersions?.[String(userId)] || 0) + 1;
      for (const session of Object.values(doc.state.sessions)) if (String(session.principalUserId) === String(userId) || String(session.impersonation?.effectiveUserId) === String(userId)) {
        if (workspaceId === undefined) session.revokedAt = now();
        else for (const family of Object.values(doc.state.families)) if (family.sid === session.sid && family.workspaceId === workspaceId) family.revokedAt = now();
      }
      return { changed: true, value: null };
    });
  }
  async function createHandoff(value, target) {
    return atomic(async doc => {
      const p = await principal(doc, decodeSigned(value, "access")), audience = target || p.family.accessAudience;
      if (!AUDIENCES.has(audience) || p.claims.mode === "workspace" && audience.startsWith("staff:") || p.claims.mode === "staff" && !audience.startsWith("staff:") || p.claims.mode === "identity" && audience !== "identity") throw authError("audience_mismatch", 403);
      if (p.claims.mode !== "identity" && !await callbacks.resolveWorkspace(p.user, { workspaceId: p.claims.workspaceId, mode: p.claims.mode, audience, readOnly: p.readOnly, actor: p.actor })) throw authError("workspace_forbidden", 403);
      const code = id();
      doc.state.handoffs[digest(code)] = { sid: p.session.sid, fid: p.family.fid, workspaceId: p.claims.workspaceId, mode: p.claims.mode, target: audience, expiresAt: now() + HANDOFF_TTL };
      return { changed: true, value: { code, expiresIn: HANDOFF_TTL } };
    });
  }
  async function exchangeHandoff(code, target) {
    if (typeof code !== "string" || !/^[\w-]{16,100}$/.test(code)) throw authError("handoff_expired", 400);
    return atomic(async doc => {
      const h = doc.state.handoffs[digest(code)];
      if (!h || h.expiresAt <= now() || target && h.target !== target) throw authError("handoff_expired", 400);
      const session = doc.state.sessions[h.sid], family = doc.state.families[h.fid];
      const p = await principal(doc, { token: "", claims: { sub: session?.principalUserId, sid: h.sid, fid: h.fid, workspaceId: h.workspaceId, mode: h.mode, aud: family?.accessAudience, type: "access" } });
      let context = p.context;
      if (h.mode !== "identity") { context = await callbacks.resolveWorkspace(p.user, { workspaceId: h.workspaceId, mode: h.mode, audience: h.target, readOnly: p.readOnly, actor: p.actor }); if (!context) throw authError("workspace_forbidden", 403); }
      if (h.expiresAt <= now()) throw authError("handoff_expired", 400);
      delete doc.state.handoffs[digest(code)];
      const tokens = newFamily(p.session, { workspaceId: h.workspaceId, mode: h.mode, audience: h.target, context }, doc.state);
      return { changed: true, value: { accessToken: tokens.accessToken, tokens, workspaceContext: context.workspaceContext ?? null } };
    });
  }
  function verifiedFromReq(req) { const entry = principals.get(req), p = entry?.principal; return p && !entry.frame.discarded && p.claims.type === "access" && p.claims.exp > now() ? p : null; }
  function verifiedFromToken(value) {
    const frame = requestState.getStore();
    if (!frame || frame.discarded || frame.token !== normalToken(value) || !frame.principal || frame.principal.claims.exp <= now()) return null;
    return frame.principal;
  }
  function projectionFor(effective) {
    const frame = requestState.getStore();
    if (frame?.issueProjection && String(frame.issueProjection.user.id) === String(effective.id)) return frame.issueProjection;
    if (frame?.principal && String(frame.principal.user.id) === String(effective.id)) return frame.principal.context;
    return { scopes: [], workspaceContext: null, staffAccess: null };
  }
  return {
    realm, configureAuthority, prepareRequest, runPrepared, runWithoutRequest, bindPreparedRequest, revalidatePrepared, issueTokens, commitPending, switchContext, refresh, logout, revokeUser, createHandoff, exchangeHandoff,
    verifiedFromReq, verifiedFromToken, projectionFor, hasPreparedRequest: () => Boolean(requestState.getStore()),
    exportPending(frame) { if (!frames.has(frame)) throw authError("session_not_prepared", 503); return clone(frame.pending); },
    discardPending(frame) { if (!frames.has(frame)) return; frame.pending = []; frame.discarded = true; principals.delete(frame.request); },
  };
}
module.exports = { createSessionAuthority, tokenFrom, normalToken, ACCESS_TTL, REFRESH_TTL, HANDOFF_TTL, AUDIENCES };
