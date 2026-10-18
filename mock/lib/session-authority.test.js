const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { memoryStore, fileStore, pickStore } = require("./session-store");
const { createSessionAuthority, tokenFrom, ACCESS_TTL, REFRESH_TTL } = require("./session-authority");
const clock = require("./clock");

function fixture(store = memoryStore({ realm: "test", secret: Buffer.alloc(32, 7) })) {
  const people = new Map([[1, { id: 1, key: "admin", email: "staff@orgtik.test", isActive: true, authVersion: 0, staff: true }], [2, { id: 2, key: "member", email: "member@orgtik.test", isActive: true, authVersion: 0 }]]);
  const members = new Map([[1, new Set(["ws_a", "ws_b"])], [2, new Set(["ws_a"])]]), denied = new Set();
  const callbacks = {
    loadUser: id => { const u = people.get(Number(id)); return u && { ...u }; },
    resolveWorkspace: (user, ctx) => {
      if (ctx.mode === "staff" && (!user.staff || !ctx.audience.startsWith("staff:"))) return null;
      if (ctx.mode === "workspace" && (!members.get(user.id)?.has(ctx.workspaceId) || denied.has(ctx.audience))) return null;
      if (ctx.readOnly && !ctx.actor.staff) return null;
      return { scopes: [{ scope: "task_manager", roles: [ctx.readOnly ? "viewer" : "member"], permissions: [] }], workspaceContext: { workspace: { id: ctx.workspaceId }, actor: { userId: ctx.actor.id, effectiveUserId: user.id, readOnly: ctx.readOnly } } };
    },
    contextFor: (user, { extra, principal }) => ({ workspaceId: extra.workspaceId === null ? null : extra.workspaceId || "ws_a", mode: extra.mode || "workspace", audience: extra.audience || "suite", impersonationApproved: Boolean(principal?.actor.staff), reason: "support check", scopes: [{ scope: "task_manager", roles: [extra.impersonatedBy ? "viewer" : "member"], permissions: [] }] }),
  };
  return { store, people, members, denied, callbacks, authority: createSessionAuthority({ realm: "test", store, ...callbacks }) };
}
const request = token => ({ headers: token ? { authorization: `Bearer ${token}` } : {}, path: "/api/auth/login" });
async function staged(f, who = 1, extra = {}) {
  const frame = await f.authority.prepareRequest(request(), { allowAnonymous: true });
  const tokens = f.authority.runPrepared(frame, () => f.authority.issueTokens(f.people.get(who), extra));
  return { frame, tokens };
}
async function issued(f, who = 1, extra = {}) { const result = await staged(f, who, extra); await f.authority.commitPending(result.frame); return result.tokens; }
const authorize = (f, token, opts = {}) => f.authority.prepareRequest(request(token), opts);
async function signed(store, claims, header = { alg: "HS256", typ: "JWT" }) {
  const prefix = [header, claims].map(x => Buffer.from(JSON.stringify(x)).toString("base64url")).join(".");
  return `${prefix}.${crypto.createHmac("sha256", await store.signingKey()).update(prefix).digest("base64url")}`;
}
const payload = token => JSON.parse(Buffer.from(token.split(".")[1], "base64url"));

test('staff reappointment cannot revive earlier staff or view-as families, while other workspace access survives', async () => {
  const f = fixture(); let epoch = 0;
  const originalResolve = f.callbacks.resolveWorkspace, originalContext = f.callbacks.contextFor;
  const staffAccess = () => ({ actorUserId: 1, accessEpoch: epoch, apps: ['admin'], roles: { admin: ['super_admin'] }, permissions: { admin: ['workspaces:edit'] } });
  f.authority.configureAuthority({
    resolveWorkspace(user, options) {
      const value = originalResolve(user, options); if (!value) return null;
      return options.mode === 'staff' ? { scopes: [{ scope: 'platform_admin', roles: ['super_admin'], permissions: [] }], workspaceContext: null, staffAccess: staffAccess() } : { ...value, staffAccess: options.actor.staff ? staffAccess() : null };
    },
    contextFor(user, options) {
      const value = originalContext(user, options);
      return options.extra.mode === 'staff' ? { ...value, scopes: [{ scope: 'platform_admin', roles: ['super_admin'], permissions: [] }], workspaceContext: null, staffAccess: staffAccess() } : { ...value, staffAccess: options.principal?.actor.staff ? staffAccess() : null };
    },
  });
  const staff = await issued(f, 1, { mode: 'staff', workspaceId: null, audience: 'staff:admin' });
  const other = await issued(f, 1, { workspaceId: 'ws_b' });
  const frame = await authorize(f, staff.accessToken);
  const view = f.authority.runPrepared(frame, () => f.authority.issueTokens(f.people.get(2), { impersonatedBy: 1, mode: 'workspace', workspaceId: 'ws_a', audience: 'tool:tasks' }));
  await f.authority.commitPending(frame);
  assert.equal((await authorize(f, view.accessToken)).principal.readOnly, true);
  epoch++; // Current employment may be reappointed; historical session families remain revoked.
  await assert.rejects(authorize(f, staff.accessToken), error => error.code === 'staff_membership_revoked');
  await assert.rejects(authorize(f, view.accessToken), error => error.code === 'staff_membership_revoked');
  assert.equal((await authorize(f, other.accessToken)).principal.claims.workspaceId, 'ws_b');
  const current = await issued(f, 1, { mode: 'staff', workspaceId: null, audience: 'staff:admin' });
  assert.equal((await authorize(f, current.accessToken)).principal.context.staffAccess.accessEpoch, 1);
});

test("revalidation closes revoked-session and changed-membership races before a domain commit", async () => {
  const f = fixture(), tokens = await issued(f), frame = await authorize(f, tokens.accessToken);
  assert.equal((await f.authority.revalidatePrepared(frame)).user.id,1);
  await f.authority.logout(tokens.accessToken);
  await assert.rejects(f.authority.revalidatePrepared(frame),{status:401});
  const next = await issued(f);let revision=1,seen;
  const resolve=f.callbacks.resolveWorkspace;
  f.authority.configureAuthority({resolveWorkspace:(user,options)=>{seen=options;const context=resolve(user,options);return context&&{...context,workspaceContext:{...context.workspaceContext,member:{revision}}};}});
  const prepared=await authorize(f,next.accessToken);revision=2;
  await assert.rejects(f.authority.revalidatePrepared(prepared),{status:409,code:'authority_changed'});
  assert.equal(seen.revalidate,true);assert.equal(seen.frame,prepared);
  const anonymous=await f.authority.prepareRequest(request(),{allowAnonymous:true});assert.equal(await f.authority.revalidatePrepared(anonymous),null);
  f.authority.discardPending(anonymous);await assert.rejects(f.authority.revalidatePrepared(anonymous),{status:503});
});

test("offboarding access epoch keeps old families revoked after rehire without affecting another workspace", async () => {
  const f = fixture(), epochs = new Map([["ws_a", 0], ["ws_b", 0]]);
  const originalResolve = f.callbacks.resolveWorkspace, originalContext = f.callbacks.contextFor;
  const epochContext = context => ({ ...context, workspaceContext: { ...context.workspaceContext, member: { accessEpoch: epochs.get(context.workspaceId || context.workspaceContext?.workspace.id) ?? 0 } } });
  f.authority.configureAuthority({
    resolveWorkspace: (user, options) => { const result = originalResolve(user, options); return result && epochContext({ ...result, workspaceId: options.workspaceId }); },
    contextFor: (user, options) => epochContext(originalContext(user, options)),
  });
  const a = await issued(f), b = (await f.authority.switchContext(a.accessToken, { workspaceId: "ws_b" })).tokens;
  const grant = await f.authority.createHandoff(a.accessToken, "tool:tasks");
  const pending = await staged(f);
  f.members.get(1).delete("ws_a"); epochs.set("ws_a", 1);
  f.members.get(1).add("ws_a"); // a later invitation/hire restores membership, not old sessions
  for (const action of [() => authorize(f, a.accessToken), () => f.authority.refresh(a.refreshToken), () => f.authority.exchangeHandoff(grant.code), () => f.authority.commitPending(pending.frame)]) await assert.rejects(action, { status: 401, code: "membership_revoked" });
  assert.equal((await authorize(f, b.accessToken)).principal.claims.workspaceId, "ws_b");
  const fresh = await issued(f);
  assert.equal((await authorize(f, fresh.accessToken)).principal.family.memberAccessEpoch, 1);
  epochs.set("ws_a", -1);
  await assert.rejects(authorize(f, fresh.accessToken), { status: 503, code: "member_epoch_invalid" });
});

test("signed staged tokens are unusable until security persistence commits", async () => {
  const f = fixture(), { frame, tokens } = await staged(f);
  assert.equal(payload(tokens.accessToken).exp - payload(tokens.accessToken).iat, ACCESS_TTL);
  assert.equal(payload(tokens.refreshToken).exp - payload(tokens.refreshToken).iat, REFRESH_TTL);
  assert.equal(payload(tokens.accessToken).iss, "orgtik-mock:test");
  assert.equal(payload(tokens.accessToken).workspaceId, "ws_a");
  assert.equal(payload(tokens.accessToken).aud, "suite");
  assert.equal("roles" in payload(tokens.accessToken), false);
  await assert.rejects(authorize(f, tokens.accessToken), { status: 401 });
  await f.authority.commitPending(frame);
  assert.equal((await authorize(f, tokens.accessToken)).principal.user.id, 1);
  assert(!JSON.stringify(await f.store.read()).includes(tokens.refreshToken));
  assert(!JSON.stringify(f.authority.exportPending(frame)).includes(tokens.accessToken));
});

test("tampering, unknown issuer/realm/header claims, unsigned and wrong token types fail", async () => {
  const f = fixture(), tokens = await issued(f), claims = payload(tokens.accessToken);
  for (const token of [tokens.accessToken.slice(0, -5) + "wrong", await signed(f.store, { ...claims, iss: "orgtik-mock:other" }), await signed(f.store, { ...claims, roles: ["super_admin"] }), await signed(f.store, claims, { alg: "none", typ: "JWT" }), `${tokens.accessToken.split('.').slice(0,2).join('.')}.local-dev-signature`, tokens.refreshToken]) await assert.rejects(authorize(f, token), { status: 401 });
  await assert.rejects(f.authority.refresh(tokens.accessToken), { status: 401 });
  await assert.rejects(authorize(f, tokens.accessToken, { audience: "tool:files" }), { status: 401, code: "audience_mismatch" });
});

test("request workspace binding rejects a different header and ignores URL tokens", async () => {
  const f = fixture(), tokens = await issued(f), req = request(tokens.accessToken);
  req.headers["x-workspace"] = "ws_b";
  await assert.rejects(f.authority.prepareRequest(req), { status: 409, code: "workspace_mismatch" });
  assert.equal(tokenFrom({ headers: {}, query: { token: tokens.accessToken } }), null);
  assert.equal(tokenFrom({ headers: { authorization: JSON.stringify({ accessToken: tokens.accessToken }) } }), tokens.accessToken);
});

test("real expiry is independent of the frozen business clock", async () => {
  const f = fixture(), tokens = await issued(f), claims = payload(tokens.accessToken);
  const before = clock.exportState();
  try {
    clock.set({ now: "2099-01-01T00:00:00Z", frozen: true });
    assert.equal((await authorize(f, tokens.accessToken)).principal.user.id, 1);
    const now = Math.floor(clock.RealDate.now() / 1000);
    await assert.rejects(authorize(f, await signed(f.store, { ...claims, iat: now - 60, exp: now })), { status: 401 });
  } finally { clock.importState(before); }
});

test("refresh rotates once, preserves context, and reuse revokes that family", async () => {
  const f = fixture(), tokens = await issued(f, 1, { workspaceId: "ws_b" });
  const rotated = await f.authority.refresh(tokens.refreshToken);
  assert.notEqual(rotated.refreshToken, tokens.refreshToken);
  assert.equal(payload(rotated.accessToken).workspaceId, "ws_b");
  assert.equal((await authorize(f, tokens.accessToken)).principal.user.id, 1);
  await assert.rejects(f.authority.refresh(tokens.refreshToken), { status: 401, code: "refresh_reuse" });
  await assert.rejects(authorize(f, rotated.accessToken), { status: 401 });
});

test("concurrent refresh candidates cannot both remain usable", async () => {
  const f = fixture(), tokens = await issued(f), other = fixture(f.store);
  const results = await Promise.allSettled([f.authority.refresh(tokens.refreshToken), other.authority.refresh(tokens.refreshToken)]);
  assert.equal(results.filter(x => x.status === "fulfilled").length, 1);
  assert.equal(results.filter(x => x.status === "rejected").length, 1);
  const successful = results.find(x => x.status === "fulfilled").value;
  await assert.rejects(authorize(f, successful.accessToken), { status: 401 });
});

test("SID logout and logout-all persist across independent authority instances", async () => {
  const f = fixture(), a = await issued(f), b = await issued(f), other = fixture(f.store);
  await f.authority.logout(a.accessToken);
  await assert.rejects(authorize(other, a.accessToken), { status: 401 });
  assert.equal((await authorize(other, b.accessToken)).principal.user.id, 1);
  const pending = await staged(f);
  await other.authority.logout(b.accessToken, true);
  await assert.rejects(f.authority.commitPending(pending.frame), { status: 401 });
  await assert.rejects(authorize(f, b.accessToken), { status: 401 });
  assert.equal((await authorize(f, (await issued(f)).accessToken)).principal.user.id, 1);
});

test("current account authVersion/deactivation and workspace removal override tokens", async () => {
  const f = fixture(), a = await issued(f), b = await issued(f, 1, { workspaceId: "ws_b" });
  f.members.get(1).delete("ws_a");
  await assert.rejects(authorize(f, a.accessToken), { status: 403 });
  assert.equal((await authorize(f, b.accessToken)).principal.user.id, 1);
  f.people.get(1).isActive = false;
  await assert.rejects(authorize(f, b.accessToken), { status: 401 });
  f.people.get(1).isActive = true; f.people.get(1).authVersion++;
  await assert.rejects(authorize(f, b.accessToken), { status: 401 });
});

test("per-workspace family revocation preserves the other workspace", async () => {
  const f = fixture(), a = await issued(f), b = await issued(f, 1, { workspaceId: "ws_b" });
  await f.authority.revokeUser(1, "ws_a");
  await assert.rejects(authorize(f, a.accessToken), { status: 401 });
  assert.equal((await authorize(f, b.accessToken)).principal.user.id, 1);
});

test("handoffs are hashed, destination-scoped, consumed once and recheck current access", async () => {
  const f = fixture(), tokens = await issued(f), h = await f.authority.createHandoff(tokens.accessToken, "tool:files"), other = fixture(f.store);
  assert(!JSON.stringify(await f.store.read()).includes(h.code));
  await assert.rejects(other.authority.exchangeHandoff(h.code, "tool:sales"), { status: 400 });
  const exchanged = await other.authority.exchangeHandoff(h.code, "tool:files");
  assert.equal(payload(exchanged.accessToken).aud, "tool:files");
  assert.equal(payload(exchanged.accessToken).workspaceId, "ws_a");
  await assert.rejects(f.authority.exchangeHandoff(h.code), { status: 400 });
  const denied = await f.authority.createHandoff(tokens.accessToken, "tool:files");
  f.denied.add("tool:files");
  await assert.rejects(f.authority.exchangeHandoff(denied.code), { status: 403 });
  await assert.rejects(f.authority.createHandoff(tokens.accessToken, "staff:admin"), { status: 403 });
});

test("handoff race has one winner and expired/revoked grants never mint tokens", async () => {
  const f = fixture(), tokens = await issued(f), h = await f.authority.createHandoff(tokens.accessToken), other = fixture(f.store);
  const results = await Promise.allSettled([f.authority.exchangeHandoff(h.code), other.authority.exchangeHandoff(h.code)]);
  assert.equal(results.filter(x => x.status === "fulfilled").length, 1);
  const later = await f.authority.createHandoff(tokens.accessToken), doc = await f.store.read();
  for (const value of Object.values(doc.state.handoffs)) value.expiresAt = 0;
  await f.store.compareAndSwap(doc.revision, doc.state);
  await assert.rejects(f.authority.exchangeHandoff(later.code), { status: 400 });
  const revoked = await f.authority.createHandoff(tokens.accessToken); await f.authority.logout(tokens.accessToken);
  await assert.rejects(f.authority.exchangeHandoff(revoked.code), { status: 401 });
});

test("impersonation keeps original subject and forced read-only across refresh and handoff", async () => {
  const f = fixture(), actorTokens = await issued(f), req = request(actorTokens.accessToken), frame = await f.authority.prepareRequest(req);
  const view = f.authority.runPrepared(frame, () => f.authority.issueTokens(f.people.get(2), { impersonatedBy: { id: 99 }, readOnly: false }));
  await f.authority.commitPending(frame);
  assert.equal(payload(view.accessToken).sub, 1);
  const authorized = await authorize(f, view.accessToken);
  assert.equal(authorized.principal.user.id, 2); assert.equal(authorized.principal.actor.id, 1); assert.equal(authorized.principal.readOnly, true);
  await assert.rejects(Promise.resolve().then(() => f.authority.runPrepared(authorized, () => f.authority.issueTokens(f.people.get(2)))), { status: 403 });
  const refreshed = await f.authority.refresh(view.refreshToken);
  const h = await f.authority.createHandoff(refreshed.accessToken, "tool:files"), exchanged = await f.authority.exchangeHandoff(h.code);
  assert.equal((await authorize(f, exchanged.accessToken)).principal.readOnly, true);
  await assert.rejects(f.authority.createHandoff(view.accessToken, "staff:admin"), { status: 403 });
});

test("temporary storage/read/write failure never falls back to a cached principal", async () => {
  const f = fixture(), tokens = await issued(f), baseRead = f.store.read;
  await authorize(f, tokens.accessToken);
  f.store.read = async () => { throw Object.assign(new Error("synthetic outage"), { status: 503 }); };
  await assert.rejects(authorize(f, tokens.accessToken), { status: 503 });
  f.store.read = baseRead;
  const pending = await staged(f), baseCas = f.store.compareAndSwap;
  f.store.compareAndSwap = async () => { throw Object.assign(new Error("synthetic outage"), { status: 503 }); };
  await assert.rejects(f.authority.commitPending(pending.frame), { status: 503 });
  f.authority.discardPending(pending.frame); f.store.compareAndSwap = baseCas;
  await assert.rejects(authorize(f, pending.tokens.accessToken), { status: 401 });
});

test("concurrent prepared requests cannot share staged sessions or principal cache", async () => {
  const f = fixture(), first = await f.authority.prepareRequest(request(), { allowAnonymous: true }), second = await f.authority.prepareRequest(request(), { allowAnonymous: true });
  const [a, b] = await Promise.all([
    f.authority.runPrepared(first, async () => { await new Promise(resolve => setTimeout(resolve, 5)); return f.authority.issueTokens(f.people.get(1)); }),
    f.authority.runPrepared(second, async () => f.authority.issueTokens(f.people.get(2))),
  ]);
  assert.notEqual(payload(a.accessToken).sid, payload(b.accessToken).sid);
  assert.equal(f.authority.exportPending(first)[0].sessions[payload(a.accessToken).sid].principalUserId, 1);
  assert.equal(f.authority.exportPending(second)[0].sessions[payload(b.accessToken).sid].principalUserId, 2);
  assert.equal(f.authority.verifiedFromToken(a.accessToken), null);
  f.authority.discardPending(first); await f.authority.commitPending(second);
  await assert.rejects(authorize(f, a.accessToken), { status: 401 });
  assert.equal((await authorize(f, b.accessToken)).principal.user.id, 2);
});

test("staff and identity audiences remain distinct from customer data authority", async () => {
  const f = fixture(), staff = await issued(f, 1, { mode: "staff", audience: "staff:admin", workspaceId: null });
  await assert.rejects(authorize(f, staff.accessToken, { audience: "suite" }), { status: 401 });
  await assert.rejects(f.authority.createHandoff(staff.accessToken, "tool:files"), { status: 403 });
  f.people.get(1).staff = false;
  await assert.rejects(f.authority.refresh(staff.refreshToken), { status: 403 });
  const onboard = await issued(f, 2, { mode: "identity", audience: "identity", workspaceId: null });
  const prepared = await authorize(f, onboard.accessToken, { audience: "identity" });
  assert.equal(prepared.principal.context.workspaceContext, null);
  await assert.rejects(authorize(f, onboard.accessToken, { audience: "suite" }), { status: 401 });
});

test("workspace/staff switches create same-SID families, preserve old tabs, and logout covers them", async () => {
  const f = fixture(), tokens = await issued(f), old = payload(tokens.accessToken);
  const switched = await f.authority.switchContext(tokens.accessToken, { workspaceId: "ws_b", mode: "workspace", audience: "suite" });
  assert.equal(payload(switched.accessToken).sid, old.sid);
  assert.notEqual(payload(switched.accessToken).fid, old.fid);
  assert.equal((await authorize(f, tokens.accessToken)).principal.claims.workspaceId, "ws_a");
  assert.equal((await authorize(f, switched.accessToken)).principal.claims.workspaceId, "ws_b");
  const staff = await f.authority.switchContext(tokens.accessToken, { workspaceId: null, mode: "staff", audience: "staff:admin" });
  assert.equal(payload(staff.accessToken).sid, old.sid);
  assert.equal(payload(staff.accessToken).mode, "staff");
  assert.equal(payload(staff.accessToken).workspaceId, null);
  await f.authority.logout(tokens.accessToken);
  await assert.rejects(authorize(f, switched.accessToken), { status: 401 });
  await assert.rejects(authorize(f, staff.accessToken), { status: 401 });
});

test("concurrent switch families keep their own binding; view-as cannot widen context", async () => {
  const f = fixture(), tokens = await issued(f), other = fixture(f.store);
  const [a, b] = await Promise.all([f.authority.switchContext(tokens.accessToken, { workspaceId: "ws_a", mode: "workspace", audience: "tool:files" }), other.authority.switchContext(tokens.accessToken, { workspaceId: "ws_b", mode: "workspace", audience: "suite" })]);
  assert.equal((await authorize(f, a.accessToken)).principal.claims.workspaceId, "ws_a");
  assert.equal((await authorize(f, b.accessToken)).principal.claims.workspaceId, "ws_b");
  const frame = await authorize(f, tokens.accessToken), view = f.authority.runPrepared(frame, () => f.authority.issueTokens(f.people.get(2), { impersonatedBy: { id: 1 } }));
  await f.authority.commitPending(frame);
  await assert.rejects(f.authority.switchContext(view.accessToken, { workspaceId: "ws_b", mode: "workspace", audience: "suite" }), { status: 403 });
  await assert.rejects(f.authority.switchContext(view.accessToken, { workspaceId: null, mode: "staff", audience: "staff:admin" }), { status: 403 });
});

test("malformed account versions cannot downgrade revocation authority to zero", async () => {
  const f = fixture(), tokens = await issued(f);
  f.people.get(1).authVersion = "1";
  await assert.rejects(authorize(f, tokens.accessToken), { status: 503 });
});

test("prepared request caches are isolated and cleared; identity rejects unsigned HTTP tokens", async () => {
  const f = fixture(), tokens = await issued(f), req = request(tokens.accessToken), frame = await f.authority.prepareRequest(req), identity = require("./identity");
  identity.configureAuthority(f.authority);
  assert.equal(identity.userFromToken(tokens.accessToken), null);
  assert.equal(identity.userFromReq(request(tokens.accessToken)), null);
  f.authority.runPrepared(frame, () => { assert.equal(identity.userFromToken(tokens.accessToken).id, 1); assert.equal(identity.userFromReq(req).id, 1); });
  const inner = request(tokens.accessToken); f.authority.bindPreparedRequest(inner, frame);
  assert.equal(identity.userFromReq(inner).id, 1); f.authority.discardPending(frame);
  assert.equal(identity.userFromReq(inner), null);
  const old = `e30.${Buffer.from(JSON.stringify({ sub: 1, exp: 1 })).toString('base64url')}.local-dev-signature`;
  assert.equal(identity.userFromToken(old), null);
  const replay = identity.createCommittedReplayFacade();
  assert.equal(replay.userFromToken(old), null);
  replay.runAccepted({ app: 'tasks', method: 'POST', url: '/api/projects', headers: { authorization: `Bearer ${old}` }, at: 1 }, () => {
    const acceptedReq = { method: 'POST', url: '/api/projects', headers: {} };
    replay.bindAcceptedRequest(acceptedReq);
    assert.equal(replay.userFromReq(acceptedReq).id, 1);
    assert.equal(replay.userFromReq(request(old)), null);
    assert.equal(replay.userFromToken(old).id, 1);
  });
  assert.equal(replay.userFromToken(old), null);
  assert.throws(() => replay.issueTokens(), /cannot issue/);
});

test("local key/session persistence survives a cold authority and file CAS rejects stale writes", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orgtik-session-")), file = path.join(dir, "sessions.json");
  try {
    const f = fixture(fileStore(file, { realm: "test" })), tokens = await issued(f), other = fixture(fileStore(file, { realm: "test" }));
    assert.equal((await authorize(other, tokens.accessToken)).principal.user.id, 1);
    const a = await f.store.read(), b = await other.store.read();
    await f.store.compareAndSwap(a.revision, a.state);
    await assert.rejects(other.store.compareAndSwap(b.revision, b.state), { status: 409 });
    assert.equal("signingKey" in a, false);
  } finally { if (fs.existsSync(file)) fs.unlinkSync(file); fs.rmdirSync(dir); }
});

test("hosted mode never supplies an unconfigured/public secret or memory fallback", async () => {
  const store = pickStore({ hosted: true, dataDir: os.tmpdir() }, { env: {}, realm: "production" });
  assert.equal(store.kind, "unavailable");
  await assert.rejects(store.signingKey(), { status: 503 });
  await assert.rejects(store.read(), { status: 503 });
});
