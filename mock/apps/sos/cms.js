// CMS instances -> accounts -> members (Systems > CMSs, and the website managers' "Content / My Dashboards").
// The SOS UI opens `${cmsInstance.domain}/auth?token=…&refreshToken=…` after POST …/get-token.
//  - "Orgtik Website CMS" is the local Content dashboard (content-dashboard-somion-main, web :3006). Its tokens are
//    real identity tokens for the signed-in SOS user, so its /[locale]/auth page validates them via /api/auth/me.
//  - The other instances are client websites: their domains point at a small local placeholder page served by this
//    mock (/local-cms/<slug>), never at a real website.
const fs = require("fs");
const { nowIso, daysFromNow } = require("../../lib/util");
const { EMAIL_RE, MIN_PASSWORD } = require("./common");

const MASK = "••••••••"; // what the API returns instead of an account password (8 chars: passes the edit form's min(8))
const isMask = (v) => typeof v === "string" && /^[•*]+$/.test(v);
const CONTENT_WEB_DEFAULT = "http://localhost:3006"; // content-dashboard-somion-main

const SEED = [
  {
    slug: "orgtik-website", name: "Orgtik Website CMS", logo: "cms-orgtik-website", active: true, days: -300, sso: true,
    description: "Orgtik's website content dashboard (local app on :3006).",
    posts: [],
    accounts: [
      { name: "Website Editors", email: "editors@orgtik.test", password: "OrgtikWeb@2026", members: ["u14", "u12", "admin"] },
      { name: "Guest Writers", email: "writers@orgtik.test", password: "Writers@2026", members: ["u8"] },
    ],
  },
  {
    slug: "nile-foods", name: "Nile Foods Website", logo: "cms-nile-foods", active: true, days: -160,
    description: "Corporate website and recipe blog for Nile Foods.",
    posts: ["Behind the scenes: a morning at our 10th of Ramadan factory", "5 healthy breakfast ideas for busy school mornings", "Meet the new Nile Oats range"],
    accounts: [
      { name: "Editorial Team", email: "editorial@nilefoods.test", password: "NileFoods@2026", members: ["u14", "u12"] },
      { name: "Marketing Admin", email: "marketing@nilefoods.test", password: "NileMkt#2026", members: ["u12", "admin"] },
    ],
  },
  {
    slug: "cairo-bites", name: "Cairo Bites Magazine", logo: "cms-cairo-bites", active: true, days: -90,
    description: "Food & lifestyle magazine managed for a client.",
    posts: ["The ultimate koshary crawl in Downtown Cairo", "Autumn street food guide 2026"],
    accounts: [{ name: "Content Manager", email: "content@cairobites.test", password: "CairoBites#26", members: ["u14"] }],
  },
  {
    slug: "delta-pharma", name: "Delta Pharma Portal", logo: "cms-delta-pharma", active: false, days: -45,
    description: "Product information portal (paused by the client).",
    posts: ["Portal maintenance notice"],
    accounts: [{ name: "Portal Admin", email: "admin@deltapharma.test", password: "DeltaPortal@26", members: [] }],
  },
];

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const escHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function register(app, S, H) {
  const { identity, util, ctx, config } = S;
  const API = config.apiUrl("sos");
  const instances = [];
  const accounts = [];
  let instSeq = 1;
  let accSeq = 1;

  const localDomain = (slugOrId) => `${API}/local-cms/${slugOrId}`;

  const contentWeb = config.apps.content ? config.webUrl("content") : CONTENT_WEB_DEFAULT;
  const contentApi = config.apps.content?.api ? `${config.apiUrl("content")}/api` : "http://localhost:4006/api";
  for (const c of SEED) {
    const created = daysFromNow(c.days);
    const inst = {
      id: instSeq++,
      name: c.name,
      // `${domain}/auth?token=` must land on the content app's /en/auth page (it has locale routes).
      domain: c.sso ? `${contentWeb}/en` : localDomain(c.slug),
      apiUrl: c.sso ? contentApi : `${localDomain(c.slug)}/api`,
      loginEndpointPath: c.sso ? "/en/auth" : "/auth/login",
      logoUrl: S.assets[c.logo]?.url || null,
      isActive: c.active,
      metadata: { slug: c.slug, description: c.description, localPreview: !c.sso, authMode: c.sso ? "sos-sso" : "cms-account", posts: c.posts },
      createdAt: created,
      updatedAt: created,
      deletedAt: null,
    };
    instances.push(inst);
    for (const a of c.accounts) {
      accounts.push({
        id: accSeq++,
        cmsId: inst.id,
        name: a.name,
        email: a.email,
        password: a.password,
        memberIds: a.members.map((k) => identity.findByKey(k)?.id).filter(Boolean),
        createdAt: created,
        updatedAt: created,
      });
    }
  }

  const liveInstances = () => instances.filter((i) => !i.deletedAt);
  const findInstance = (id) => liveInstances().find((i) => String(i.id) === String(id));
  const findAccount = (id) => accounts.find((a) => String(a.id) === String(id));
  const instanceBySlug = (slug) => liveInstances().find((i) => i.metadata?.slug === slug || String(i.id) === String(slug));

  // ICMSInstance (types/CMS.ts)
  const instanceView = (i) => ({
    id: i.id, name: i.name, domain: i.domain, apiUrl: i.apiUrl, loginEndpointPath: i.loginEndpointPath, logoUrl: i.logoUrl,
    isActive: i.isActive,
    metadata: i.metadata ? { slug: i.metadata.slug, description: i.metadata.description, localPreview: !!i.metadata.localPreview, authMode: i.metadata.authMode || "cms-account" } : null,
    accountCount: accounts.filter((a) => a.cmsId === i.id).length,
    memberCount: new Set(accounts.filter((a) => a.cmsId === i.id).flatMap((a) => a.memberIds)).size,
    createdAt: i.createdAt, updatedAt: i.updatedAt, deletedAt: i.deletedAt,
  });
  // ICMSAccount (types/CMSAccount.ts) — password is always masked.
  const accountView = (a) => {
    const inst = instances.find((i) => i.id === a.cmsId);
    return {
      id: a.id,
      cmsId: a.cmsId,
      name: a.name,
      email: a.email,
      password: MASK,
      members: a.memberIds.map((id) => identity.findUser(id)).filter((u) => u && !H.isDeleted(u)).map((u) => ({ id: u.id, avatar: u.avatar, firstName: u.firstName, lastName: u.lastName, email: u.email })),
      cmsInstance: inst ? instanceView(inst) : null,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  };

  const isMember = (u, inst) => accounts.some((a) => a.cmsId === inst.id && a.memberIds.includes(u.id));
  const isWebsiteManager = (u) => !!identity.grants.website_manager?.[u.key];

  S.cms = {
    stats: () => ({ active: liveInstances().filter((i) => i.isActive).length, total: liveInstances().length }),
    removeMemberEverywhere: (userId) => {
      for (const a of accounts) a.memberIds = a.memberIds.filter((id) => id !== userId);
    },
  };

  function issueCmsTokens(acc, inst, user) {
    // The local Content dashboard signs in with SOS itself: hand over identity tokens for the current user.
    if (inst.metadata?.authMode === "sos-sso") {
      const t = identity.issueTokens(user);
      return { accessToken: t.accessToken, refreshToken: t.refreshToken, expiresIn: t.expiresIn, loginUrl: `${inst.domain.replace(/\/+$/, "")}/auth?token=${t.accessToken}` };
    }
    const iat = Math.floor(Date.now() / 1000);
    const claims = { sub: acc.id, accountId: acc.id, cmsId: inst.id, cms: inst.name, email: acc.email, account: acc.name, sosUserId: user.id, sosUser: H.fullName(user), iat };
    const accessToken = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ ...claims, type: "cms-access", exp: iat + 3600 })}.local-cms-signature`;
    const refreshToken = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ ...claims, type: "cms-refresh", exp: iat + 7 * 86400 })}.local-cms-signature`;
    return { accessToken, refreshToken, expiresIn: 3600, loginUrl: `${inst.domain.replace(/\/+$/, "")}/auth?token=${accessToken}` };
  }

  const multipart = (req, res, next) => ctx.upload.single("logo")(req, res, (err) => (err ? H.fail(req, res, 400, err.message) : next()));
  const dropUpload = (req) => req.file && fs.unlink(req.file.path, () => {});
  // Remove a previously uploaded logo (never the generated seed files).
  const dropLogo = (url) => {
    const name = url && String(url).includes("/uploads/") ? decodeURIComponent(String(url).split("/uploads/").pop()) : "";
    if (name && !name.startsWith("seed-") && !/[\\/]/.test(name)) fs.unlink(require("path").join(ctx.uploadsDir, name), () => {});
  };

  // ---------- instances ----------
  app.get("/api/cms-instances", (req, res) => {
    const me = H.currentUser(req, res);
    if (!me) return;
    let list = liveInstances();
    // Super admins manage every CMS; website managers only see the dashboards they are a member of.
    if (!H.isSuperAdmin(me)) list = isWebsiteManager(me) ? list.filter((i) => i.isActive && isMember(me, i)) : [];
    if (req.query.search) list = util.search(list, req.query.search, ["name", "domain"]);
    const { items, meta } = util.paginate(list, req.query, { defaultLimit: 10 });
    H.sendPaged(res, items.map(instanceView), meta, "CMS instances fetched successfully");
  });

  app.get("/api/cms-instances/:id", (req, res) => {
    const me = H.currentUser(req, res);
    if (!me) return;
    const inst = findInstance(req.params.id);
    if (!inst || (!H.isSuperAdmin(me) && !isMember(me, inst))) return H.fail(req, res, 404, "CMS instance not found");
    H.send(res, instanceView(inst), "CMS instance fetched successfully");
  });

  function applyInstanceFields(inst, b, req) {
    if (b.name !== undefined) inst.name = H.trimStr(b.name);
    if (b.apiUrl !== undefined) inst.apiUrl = H.trimStr(b.apiUrl);
    if (b.loginEndpointPath !== undefined) inst.loginEndpointPath = H.trimStr(b.loginEndpointPath) || "/auth/login";
    if (b.domain !== undefined) inst.domain = H.trimStr(b.domain).replace(/\/+$/, "") || localDomain(inst.id);
    if (b.isActive !== undefined) inst.isActive = b.isActive === true || b.isActive === "true";
    if (req.file) {
      dropLogo(inst.logoUrl);
      inst.logoUrl = ctx.fileUrl(req.file.filename);
    }
  }

  app.post("/api/cms-instances", multipart, (req, res) => {
    const admin = H.adminUser(req, res);
    if (!admin) return dropUpload(req);
    const b = req.body || {};
    const errors = [];
    if (!H.trimStr(b.name)) errors.push("name should not be empty");
    if (!H.trimStr(b.apiUrl)) errors.push("apiUrl should not be empty");
    if (req.file && !/^image\//.test(req.file.mimetype)) errors.push("logo must be an image");
    if (errors.length) {
      dropUpload(req);
      return H.fail(req, res, 400, errors[0], errors);
    }
    const now = nowIso();
    const inst = { id: instSeq++, name: "", domain: "", apiUrl: "", loginEndpointPath: "/auth/login", logoUrl: null, isActive: true, metadata: { localPreview: true }, createdAt: now, updatedAt: now, deletedAt: null };
    applyInstanceFields(inst, { ...b, domain: b.domain ?? "" }, req);
    instances.push(inst);
    H.send(res, instanceView(inst), "CMS instance created successfully", 201);
  });

  function updateInstance(req, res) {
    const admin = H.adminUser(req, res);
    if (!admin) return dropUpload(req);
    const inst = findInstance(req.params.id);
    if (!inst) {
      dropUpload(req);
      return H.fail(req, res, 404, "CMS instance not found");
    }
    const b = req.body || {};
    if (b.name !== undefined && !H.trimStr(b.name)) return H.fail(req, res, 400, "name should not be empty");
    if (req.file && !/^image\//.test(req.file.mimetype)) {
      dropUpload(req);
      return H.fail(req, res, 400, "logo must be an image");
    }
    applyInstanceFields(inst, b, req);
    inst.updatedAt = nowIso();
    H.send(res, instanceView(inst), "CMS instance updated successfully");
  }
  app.patch("/api/cms-instances/:id", multipart, updateInstance);
  app.put("/api/cms-instances/:id", multipart, updateInstance);

  app.delete("/api/cms-instances/:id", (req, res) => {
    const admin = H.adminUser(req, res);
    if (!admin) return;
    const inst = findInstance(req.params.id);
    if (!inst) return H.fail(req, res, 404, "CMS instance not found");
    inst.deletedAt = nowIso();
    dropLogo(inst.logoUrl);
    for (let i = accounts.length - 1; i >= 0; i--) if (accounts[i].cmsId === inst.id) accounts.splice(i, 1);
    H.send(res, null, "CMS instance deleted successfully");
  });

  // Content / My Dashboards: sign in to a CMS with an account the user belongs to.
  app.post("/api/cms-instances/:id/get-token", (req, res) => {
    const me = H.currentUser(req, res);
    if (!me) return;
    const inst = findInstance(req.params.id);
    if (!inst) return H.fail(req, res, 404, "CMS instance not found");
    if (!inst.isActive && !H.isSuperAdmin(me)) return H.fail(req, res, 400, "This CMS is currently inactive");
    const own = accounts.filter((a) => a.cmsId === inst.id);
    const acc = own.find((a) => a.memberIds.includes(me.id)) || (H.isSuperAdmin(me) ? own[0] : null);
    if (!acc) return H.fail(req, res, own.length ? 403 : 404, own.length ? "You are not a member of any account on this CMS" : "No account is configured for this CMS yet");
    H.send(res, issueCmsTokens(acc, inst, me), `Signed in to ${inst.name} as ${acc.name}`);
  });

  // ---------- accounts ----------
  app.get("/api/cms-accounts", (req, res) => {
    const admin = H.adminUser(req, res);
    if (!admin) return;
    let list = accounts.filter((a) => findInstance(a.cmsId));
    if (req.query.cmsId !== undefined && req.query.cmsId !== "") list = list.filter((a) => String(a.cmsId) === String(req.query.cmsId));
    if (req.query.search) list = util.search(list, req.query.search, ["name", "email"]);
    const { items, meta } = util.paginate(list, req.query, { defaultLimit: 10 });
    H.sendPaged(res, items.map(accountView), meta, "CMS accounts fetched successfully");
  });

  app.get("/api/cms-accounts/:id", (req, res) => {
    const admin = H.adminUser(req, res);
    if (!admin) return;
    const acc = findAccount(req.params.id);
    if (!acc) return H.fail(req, res, 404, "CMS account not found");
    H.send(res, accountView(acc), "CMS account fetched successfully");
  });

  app.post("/api/cms-accounts", (req, res) => {
    const admin = H.adminUser(req, res);
    if (!admin) return;
    const b = req.body || {};
    const inst = findInstance(b.cmsId);
    const errors = [];
    if (!inst) errors.push("cmsId must reference an existing CMS instance");
    if (!H.trimStr(b.name)) errors.push("name should not be empty");
    if (!EMAIL_RE.test(H.trimStr(b.email))) errors.push("email must be an email");
    if (String(b.password || "").length < MIN_PASSWORD || isMask(b.password)) errors.push(`password must be at least ${MIN_PASSWORD} characters long`);
    if (errors.length) return H.fail(req, res, 400, errors[0], errors);
    const now = nowIso();
    const acc = { id: accSeq++, cmsId: inst.id, name: H.trimStr(b.name), email: H.trimStr(b.email).toLowerCase(), password: String(b.password), memberIds: [], createdAt: now, updatedAt: now };
    accounts.push(acc);
    H.send(res, accountView(acc), "CMS account created successfully", 201);
  });

  function updateAccount(req, res) {
    const admin = H.adminUser(req, res);
    if (!admin) return;
    const acc = findAccount(req.params.id);
    if (!acc) return H.fail(req, res, 404, "CMS account not found");
    const b = req.body || {};
    if (b.name !== undefined) {
      if (!H.trimStr(b.name)) return H.fail(req, res, 400, "name should not be empty");
      acc.name = H.trimStr(b.name);
    }
    if (b.email !== undefined) {
      if (!EMAIL_RE.test(H.trimStr(b.email))) return H.fail(req, res, 400, "email must be an email");
      acc.email = H.trimStr(b.email).toLowerCase();
    }
    // The edit form sends back the masked value when the password was not touched.
    if (b.password !== undefined && !isMask(b.password) && String(b.password).length) {
      if (String(b.password).length < MIN_PASSWORD) return H.fail(req, res, 400, `password must be at least ${MIN_PASSWORD} characters long`);
      acc.password = String(b.password);
    }
    if (b.cmsId !== undefined && String(b.cmsId) !== String(acc.cmsId)) {
      if (!findInstance(b.cmsId)) return H.fail(req, res, 400, "cmsId must reference an existing CMS instance");
      acc.cmsId = Number(b.cmsId);
    }
    acc.updatedAt = nowIso();
    H.send(res, accountView(acc), "CMS account updated successfully");
  }
  app.patch("/api/cms-accounts/:id", updateAccount);
  app.put("/api/cms-accounts/:id", updateAccount);

  app.delete("/api/cms-accounts/:id", (req, res) => {
    const admin = H.adminUser(req, res);
    if (!admin) return;
    const i = accounts.findIndex((a) => String(a.id) === String(req.params.id));
    if (i === -1) return H.fail(req, res, 404, "CMS account not found");
    accounts.splice(i, 1);
    H.send(res, null, "CMS account deleted successfully");
  });

  app.post("/api/cms-accounts/:id/users", (req, res) => {
    const admin = H.adminUser(req, res);
    if (!admin) return;
    const acc = findAccount(req.params.id);
    if (!acc) return H.fail(req, res, 404, "CMS account not found");
    const ids = (Array.isArray(req.body?.userIds) ? req.body.userIds : []).map(Number);
    if (!ids.length) return H.fail(req, res, 400, "userIds must contain at least 1 element");
    const missing = ids.filter((id) => !H.findLiveUser(id));
    if (missing.length) return H.fail(req, res, 404, `User ${missing[0]} not found`);
    for (const id of ids) if (!acc.memberIds.includes(id)) acc.memberIds.push(id);
    acc.updatedAt = nowIso();
    H.send(res, accountView(acc), ids.length > 1 ? "Members added successfully" : "Member added successfully");
  });

  app.delete("/api/cms-accounts/:id/users/:userId", (req, res) => {
    const admin = H.adminUser(req, res);
    if (!admin) return;
    const acc = findAccount(req.params.id);
    if (!acc) return H.fail(req, res, 404, "CMS account not found");
    const uid = Number(req.params.userId);
    if (!acc.memberIds.includes(uid)) return H.fail(req, res, 404, "This user is not a member of the account");
    acc.memberIds = acc.memberIds.filter((id) => id !== uid);
    acc.updatedAt = nowIso();
    H.send(res, null, "Member removed successfully");
  });

  app.post("/api/cms-accounts/:id/get-token", (req, res) => {
    const me = H.currentUser(req, res);
    if (!me) return;
    const acc = findAccount(req.params.id);
    const inst = acc && findInstance(acc.cmsId);
    if (!acc || !inst) return H.fail(req, res, 404, "CMS account not found");
    if (!H.isSuperAdmin(me) && !acc.memberIds.includes(me.id)) return H.fail(req, res, 403, "You are not a member of this account");
    H.send(res, issueCmsTokens(acc, inst, me), `Signed in to ${inst.name} as ${acc.name}`);
  });

  // ---------- local stand-in for the CMS websites ----------
  // The login API a real SOS backend would call (apiUrl + loginEndpointPath); here it only checks the stored credentials.
  app.post("/local-cms/:slug/api/auth/login", (req, res) => {
    const inst = instanceBySlug(req.params.slug);
    if (inst?.metadata?.authMode === "sos-sso") return res.status(404).json({ success: false, statusCode: 404, message: "This CMS signs in through Orgtik SOS" });
    const acc = inst && accounts.find((a) => a.cmsId === inst.id && a.email === String(req.body?.email || "").toLowerCase());
    if (!acc || acc.password !== req.body?.password) return res.status(401).json({ success: false, statusCode: 401, message: "Invalid credentials" });
    const owner = identity.findByKey("admin");
    res.json({ success: true, statusCode: 200, message: "Login successful", data: issueCmsTokens(acc, inst, owner) });
  });

  const page = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(title)}</title><style>
body{margin:0;font-family:"Segoe UI",Helvetica,Arial,sans-serif;background:#f4f2f8;color:#1f2937}
header{display:flex;align-items:center;gap:14px;padding:18px 32px;background:#fff;border-bottom:1px solid #e5e7eb}
header img{width:44px;height:44px;border-radius:12px}header h1{font-size:20px;margin:0}header span{color:#6b7280;font-size:13px}
main{max-width:880px;margin:32px auto;padding:0 20px}.card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:22px 24px;margin-bottom:18px}
.badge{display:inline-block;background:#ede9fe;color:#5b21b6;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:600}
.ok{background:#dcfce7;color:#166534}.warn{background:#fef3c7;color:#92400e}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:10px 6px;border-bottom:1px solid #f1f1f4;font-size:14px}
th{color:#6b7280;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.04em}code{background:#f3f4f6;padding:2px 6px;border-radius:6px;font-size:12px}
</style></head><body>${body}</body></html>`;

  function cmsPage(req, res) {
    const inst = instanceBySlug(req.params.slug);
    if (!inst) return res.status(404).type("html").send(page("CMS not found", `<main><div class="card"><h2>CMS not found</h2><p>No local CMS called <code>${escHtml(req.params.slug)}</code>.</p></div></main>`));
    const token = String(req.query.token || "");
    let claims = null;
    try {
      claims = token ? JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) : null;
    } catch {
      claims = null;
    }
    const valid = claims && claims.cmsId === inst.id && (!claims.exp || claims.exp * 1000 > Date.now());
    const acc = valid ? findAccount(claims.accountId) : null;
    const posts = (inst.metadata?.posts || ["Welcome to your new website"]).map((p, i) =>
      `<tr><td>${escHtml(p)}</td><td>${i === 0 ? '<span class="badge ok">Published</span>' : i === 1 ? '<span class="badge warn">Draft</span>' : '<span class="badge ok">Published</span>'}</td><td>${escHtml(new Date(Date.now() - (i + 1) * 3 * 864e5).toLocaleDateString("en-GB"))}</td></tr>`).join("");
    const status = !token
      ? `<div class="card"><h2>Sign in required</h2><p>Open this CMS from <b>Orgtik SOS → Content</b> (or Systems → CMS → Accounts → Login) to be signed in automatically.</p></div>`
      : valid
        ? `<div class="card"><span class="badge ok">Signed in</span><h2 style="margin:10px 0 6px">Welcome, ${escHtml(claims.sosUser)}</h2>
<p style="margin:0;color:#4b5563">You are working as the <b>${escHtml(claims.account)}</b> account (<code>${escHtml(claims.email)}</code>) on <b>${escHtml(inst.name)}</b>.</p>
<p style="margin:10px 0 0;color:#6b7280;font-size:13px">Local mock CMS — no real website is involved. Token expires ${escHtml(new Date(claims.exp * 1000).toLocaleTimeString("en-GB"))}.</p></div>
<div class="card"><h3 style="margin-top:0">Pages & posts</h3><table><tr><th>Title</th><th>Status</th><th>Updated</th></tr>${posts}</table></div>`
        : `<div class="card"><span class="badge warn">Invalid session</span><h2>This sign-in link is invalid or expired</h2><p>Go back to Orgtik SOS and click the CMS again.</p></div>`;
    const logo = inst.logoUrl ? `<img src="${escHtml(inst.logoUrl)}" alt="">` : "";
    res.type("html").send(page(`${inst.name} · CMS`, `<header>${logo}<div><h1>${escHtml(inst.name)} <span>CMS dashboard</span></h1><span>${escHtml(inst.domain)}${acc ? ` · ${escHtml(acc.name)}` : ""}</span></div></header><main>${status}</main>`));
  }
  app.get("/local-cms/:slug", cmsPage);
  app.get("/local-cms/:slug/auth", cmsPage);
  app.get("/local-cms/:slug/:locale/auth", cmsPage);
}

module.exports = { register, MASK };
