// Local mock backend for the Website Manager (orgtik-website-manager, web :3007, API :4007).
// API v2 (plan, Phase 2 "Mock API v2"): success is { data, meta }; an error is
// { error: { code, message, fieldErrors?, requestId } }. All state is in memory and rebuilt by
// POST /__mock/reset. S0: identity, roles and permissions. S1: content entries, seeded read-only
// from the website (apps/wm/seed/build.mjs -> seed/website.json), starting with case studies.
const crypto = require("crypto");
const fs = require("fs");
const { ROLES, permissionsFor } = require("./wm/permissions");
const { makeStore } = require("./wm/content");
const { makeLibrary } = require("./wm/library");
const { makeOps } = require("./wm/ops");
const path = require("path");
const multer = require("multer");
const codec = require("./wm/state-codec");
const { RealDate } = require("../lib/clock");
let internal;
const SCHEMA = "orgtik.staff.wm";
const tokenHash = token => crypto.createHash("sha256").update(String(token)).digest("hex");
function previewGrant(holder, token) {
  const grant = holder?.previews.get(tokenHash(token));
  const user = grant && (typeof grant.by === "number" ? holder.ctx.identity.findUser(grant.by) : holder.ctx.identity.findByKey(grant.by));
  if (!grant || Date.parse(grant.expiresAt) <= RealDate.now() || !user || user.isActive === false || user.deletedAt || typeof holder.ctx.previewIssuerAllowed === "function" && !holder.ctx.previewIssuerAllowed(user)) return null;
  return { ...codec.copy(grant), issuerKey: user.key, issuerUserId: user.id, realm: holder.realm };
}
function exportHolder(holder) {
  if (!holder) throw codec.fail("Website Manager has not been initialized.");
  const library = holder.lib.exportState(), ops = holder.ops.exportState();
  return { schema: SCHEMA, version: 1, realm: holder.realm, data: { content: holder.store.exportState(), library: library.data, ops: ops.data, previews: codec.copy([...holder.previews]), submissions: holder.submissions.exportState(), roles: codec.copy(holder.roleOverrides) }, sequences: { ...library.sequences, ...ops.sequences } };
}
function importHolder(holder, snapshot) {
  if (!holder || snapshot?.schema !== SCHEMA || snapshot.version !== 1 || snapshot.realm !== holder.realm) throw codec.fail("Website Manager snapshot belongs to another realm or version.");
  // Validate every part before mutating any live closure.
  const content = holder.store.validateState(snapshot.data?.content);
  const roles = require("./wm/roles").validateRoleOverrides(snapshot.data?.roles);
  const library = holder.lib.validateState({ data: snapshot.data?.library, sequences: snapshot.sequences });
  const ops = holder.ops.validateState({ data: snapshot.data?.ops, sequences: snapshot.sequences });
  const submissions = holder.submissions.validateState(snapshot.data?.submissions);
  const previews = codec.mapRows(snapshot.data?.previews, { ids: false });
  if (previews.some(([hash, grant]) => !/^[a-f0-9]{64}$/.test(hash) || !["string", "number"].includes(typeof grant.by) || !Number.isFinite(Date.parse(grant.expiresAt)))) throw codec.fail("Website preview grants are incomplete.");
  holder.store.importState(content); holder.lib.importState(library); holder.ops.importState(ops); holder.submissions.importState(submissions); codec.replaceMap(holder.previews, previews); codec.replaceObject(holder.roleOverrides, roles);
}

const SCOPE = "website_manager";

module.exports = {
  exportState: () => internal ? exportHolder(internal) : null,
  importState: snapshot => importHolder(internal, snapshot),
  validatePreviewGrant: token => previewGrant(internal, token),
  scopes: [
    {
      name: SCOPE,
      displayName: "Website Manager",
      description: "Manage everything on orgtik.ch: pages, content, media, SEO, leads and the roadmap.",
      metadata: { icon: "solar:global-bold", color: "#6C3CAA" },
      web: "wm",
    },
  ],
  // D-034: who holds which Website Manager role.
  grants: {
    [SCOPE]: {
      admin: ["wm_super_admin"],
      manager: ["wm_approver"],
      u14: ["wm_editor"],
      u12: ["wm_marketing"],
      u8: ["wm_seo"],
      employee: ["wm_viewer"],
    },
  },

  routes(app, ctx) {
    const { identity } = ctx;
    const roleOverrides = {};
    const rid = () => crypto.randomUUID();
    const ok = (res, data, meta = {}, status = 200) => res.status(status).json({ data, meta });
    const fail = (res, status, code, message, extra = {}) => res.status(status).json({ error: { code, message, requestId: rid(), ...extra } });

    const rolesOf = (u) => identity.userScopes(u).find((s) => s.scope === SCOPE)?.roles ?? [];

    // Every /v2/admin call: a valid token (401), then membership of the scope (403).
    function member(req, res) {
      const u = identity.userFromReq(req);
      if (!u) return fail(res, 401, "unauthenticated", "Sign in again."), null;
      const roles = rolesOf(u);
      if (!roles.length) return fail(res, 403, "forbidden", "You don't have access to the Website Manager."), null;
      return { user: u, roles, permissions: permissionsFor(roles, roleOverrides) };
    }
    const can = (who, permission) => who.permissions.includes(permission);
    // Guards a route by permission: 403 with the missing permission named, so the UI can say why.
    const need = (permission) => (req, res, next) => {
      const who = member(req, res);
      if (!who) return;
      if (!can(who, permission)) return fail(res, 403, "forbidden", "Your role can't do this.", { required: permission });
      req.who = who;
      next();
    };

    app.get("/v2/admin/me", (req, res) => {
      const who = member(req, res);
      if (!who) return;
      const u = identity.publicUser(who.user);
      ok(res, {
        user: { id: u.id, key: who.user.key, firstName: u.firstName, lastName: u.lastName, email: u.email, avatar: u.avatar ?? null },
        roles: who.roles.map((r) => ({ key: r, label: ROLES[r]?.label ?? r })),
        permissions: who.permissions,
        identity: require("./wm/users").capabilities(identity, who.user),
        site: { id: "orgtik", name: "orgtik.ch", locales: ["en", "ar", "de", "fr", "it"], publicLocales: ["en"] },
      });
    });

    const store = makeStore(() => new Date().toISOString(), { demo: true });
    // Metadata restoration must not delete existing bytes during a build/cold start.
    const UPLOADS = ctx.uploadsDir || path.join(__dirname, "wm", "uploads");
    const lib = makeLibrary({ seed: store.seed, store, now: () => new Date().toISOString(), uploads: UPLOADS, demo: true });
    const ops = makeOps({ store, now: () => new Date().toISOString() });
    const previews = new Map();
    const submissions = require("./wm/ideas").ideaSubmissions(store.ideas);
    const realm = ctx.realm || ctx.config?.sandbox || process.env.MOCK_SANDBOX || "demo";
    if (!/^[\w-]{1,100}$/.test(realm)) throw codec.fail("Invalid Website Manager realm.");
    const holder = { realm, store, lib, ops, previews, submissions, roleOverrides, ctx };
    internal = holder;
    // Claude's suggestions for G2's gaps (D-038): drafts for review, never published by themselves.
    require("./wm/suggestions").applySuggestions({ store, media: lib.media, now: () => new Date().toISOString() });
    store.ensureDemo();
    const analytics = require("./wm/analytics").makeAnalytics({ store, lib, ops, now: () => new Date().toISOString() });
    // Scheduled publishing happens when anyone asks: the mock has no background jobs.
    app.use("/v2", (req, res, next) => (lib.keepAddresses({ key: "scheduler" }, () => store.tick()), next()));
    const who = (req) => ({ key: req.who.user.key });
    const TYPES = new Set(require("./wm/content").TYPES);

    app.get("/v2/admin/overview", need("overview:view"), (req, res) => {
      // Media issues come from the library: files in use without a description or clear rights.
      const mediaIssues = [...lib.media.values()].filter((m) => lib.mediaOut(m).issues.some((i) => i !== "unused")).length;
      const newLeads = [...ops.leads.values()].filter((l) => l.status === "new").length;
      ok(res, { queue: { ...store.queue(who(req)), seoIssues: lib.health().counts.descriptionMissing, mediaIssues, newLeads } }, { generatedAt: new Date().toISOString() });
    });

    // Test control: the seed as the website has it, without Claude's suggestions (flows that count
    // the gaps the suggestions would close call this after a reset).
    // Test control (flows/site-forms.mjs, D-041): a privacy version in force and the forms live, in one
    // call. The real path (Legal → publish with four eyes, then Settings → forms) is covered by the
    // Website Manager flows; /__mock/reset puts everything back.
    app.post("/v2/__mock/forms-live", (req, res) => {
      const privacy = store.entries.get("lg_privacy");
      const at = new Date(Date.now() - 60 * 1000).toISOString();
      if (privacy && !privacy.legalVersions.some((v) => v.effectiveFrom)) privacy.legalVersions.unshift({ versionLabel: "1.0-local", effectiveFrom: at, publishedAt: at, by: "seed", note: "Local test version (D-041); not legally reviewed." });
      ops.site.formsMode = "live";
      ok(res, { forms: { mode: ops.site.formsMode, privacyVersion: privacyInForce() } });
    });
    app.post("/v2/__mock/without-suggestions", (req, res) => {
      for (const e of store.entries.values()) if (e.draft && e.workflow.lastEditor === "assistant") {
        e.draft = null;
        e.workflow = { ...e.workflow, state: "published", updatedBy: "seed", lastEditor: null };
        e.versions = e.versions.filter((v) => v.by !== "assistant");
      }
      for (const m of lib.media.values()) if (m.altSuggested) {
        m.alt = { ...m.alt, en: "" };
        delete m.altSuggested;
      }
      ok(res, { ok: true });
    });

    // The website's numbers for the Overview: sample data until an analytics source is connected.
    app.get("/v2/admin/analytics", need("overview:view"), (req, res) => {
      const period = String(req.query.period ?? "30d");
      if (!analytics.PERIODS[period]) return fail(res, 422, "invalid", "Unknown period.", { fieldErrors: { period: "required" } });
      ok(res, analytics.report(period));
    });

    // ---- entries (S1: case studies, service families, services, software modules, articles) ----
    const entryOr404 = (req, res) => {
      if (!TYPES.has(req.params.type)) return fail(res, 404, "unknown_type", `No content type ${req.params.type}.`), null;
      const e = store.entries.get(req.params.id);
      if (!e || e.type !== req.params.type) return fail(res, 404, "not_found", "This entry doesn't exist (any more)."), null;
      return e;
    };
    // Optimistic concurrency: saves and transitions send If-Match: <version>. A stale one is 412
    // with the current version, so the editor can say "someone else changed this".
    const fresh = (req, res, e) => {
      const want = req.get("if-match");
      if (want != null && Number(want) !== e.workflow.version) return fail(res, 412, "stale", "This entry changed since you opened it.", { current: e.workflow.version, by: person(e.workflow.updatedBy).name ?? "" }), false;
      return true;
    };
    // People are stored by key; screens get names. "seed" is the import from the website.
    const person = (key) => {
      if (!key || key === "seed") return { key: "seed", name: null };
      if (key === "assistant") return { key, name: "Claude (suggestion)" };
      const u = identity.findByKey(key);
      return { key, name: u ? identity.fullName(u) : key };
    };
    const named = (row) => ({ ...row, updatedBy: person(row.updatedBy) });
    const send = (res, e, status = 200) => {
      res.set("ETag", String(e.workflow.version));
      const d = named(store.detail(e));
      ok(res, { ...d, versions: d.versions.map((v) => ({ ...v, by: person(v.by) })) }, {}, status);
    };

    const manager = require("./wm/manager");
    app.post("/v2/admin/studio/page-draft/:id", need("content:edit"), (req, res) => {
      const result = manager.savePageDraft(store, req.params.id, req.body?.commands, {key: req.who.user.key}, () => new Date().toISOString());
      if (result.status) return fail(res, result.status, result.code, "Check the draft and try again.", {fieldErrors: result.fieldErrors});
      send(res, store.entries.get(req.params.id));
    });
    app.get("/v2/admin/manager/pages/:id", need("content:view"), (req,res)=> {
      if(!manager.config[req.params.id]) return fail(res,404,"not_found","Page not found.");
      const records=manager.sourceIds(req.params.id).map(id=>store.detail(store.entries.get(id))).map(value=>({...value,updatedBy:person(value.updatedBy),versions:value.versions.map(row=>({...row,by:person(row.by)}))}));
      ok(res,records);
    });
    app.get("/v2/admin/manager/order/:type",need("content:view"),(req,res)=>{
      if(!["service","caseStudy","article"].includes(req.params.type))return fail(res,404,"not_found","List not found.");
      ok(res,manager.orderOf(store,req.params.type));
    });
    app.put("/v2/admin/manager/order/:type",need("content:edit"),(req,res)=>{
      const type=req.params.type;
      if(!["service","caseStudy","article"].includes(type))return fail(res,404,"not_found","List not found.");
      const current=manager.orderOf(store,type),ids=req.body?.ids;
      if(req.body?.version!==current.version)return fail(res,412,"stale","The list changed. Reload and try again.");
      if(!Array.isArray(ids)||ids.length!==current.ids.length||new Set(ids).size!==ids.length||ids.some(id=>!current.ids.includes(id)))return fail(res,422,"invalid_fields","Include each entry once.");
      store.managerOrders[type]=[...ids];
      store.audit.unshift({at:new Date().toISOString(),by:req.who.user.key,action:"manager_order",entry:type,type:"settings"});
      ok(res,manager.orderOf(store,type));
    });
    app.get("/v2/admin/entries/:type", need("content:view"), (req, res) => {
      if (!TYPES.has(req.params.type)) return fail(res, 404, "unknown_type", `No content type ${req.params.type}.`);
      const q = String(req.query.search ?? "").trim().toLowerCase();
      const state = String(req.query.state ?? "");
      const dept = String(req.query.department ?? "");
      const parent = String(req.query.parent ?? "");
      let rows = [...store.entries.values()].filter((e) => e.type === req.params.type && e.id !== "gl_components").map((e) => named(store.summary(e)));
      if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q) || Object.values(r.slug).some((sl) => sl?.includes(q)));
      if (state) rows = rows.filter((r) => r.state === state);
      if (dept) rows = rows.filter((r) => r.department === dept);
      if (parent) rows = rows.filter((r) => r.parent === parent);
      if (req.query.missingLanguages === "true") rows = rows.filter(r => ["en", "ar", "de", "fr", "it"].some(locale => !["ready", "published"].includes(r.translation[locale])));
      if (req.query.deliveryStatus) rows = rows.filter(r => r.status === req.query.deliveryStatus);
      if (req.query.period) rows = rows.filter(r => r.period === req.query.period);
      if (req.query.year) rows = rows.filter(r => String(r.year) === String(req.query.year));
      // Services sort inside their family, like the website lists them.
      rows.sort((a, b) => String(a.parent ?? "").localeCompare(String(b.parent ?? "")) || a.order - b.order);
      if(store.managerOrders[req.params.type]) {const order=manager.orderOf(store,req.params.type).ids;rows.sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));}
      const sort = String(req.query.sort ?? "");
      const field = ({ name: "name", state: "state", updated: "updatedAt" })[sort.replace(/^-/, "")];
      if (field) rows.sort((a, b) => String(a[field]).localeCompare(String(b[field])) * (sort.startsWith("-") ? -1 : 1));
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));
      const page = Math.max(1, Number(req.query.page) || 1);
      ok(res, rows.slice((page - 1) * pageSize, page * pageSize), { page, pageSize, total: rows.length });
    });

    app.get("/v2/admin/entries/:type/:id", need("content:view"), (req, res) => {
      const e = entryOr404(req, res);
      if (e) send(res, e);
    });

    // Editors change entries; the SEO team may change an entry's SEO block, and only that.
    const editsEntry = (req, res, next) => {
      const p = req.who.permissions;
      if (p.includes("content:edit")) return next();
      const onlySeo = Object.keys(req.body ?? {}).every((k) => ["locale", "seo", "note"].includes(k)) && req.body?.seo;
      if (onlySeo && p.includes("seo:edit")) return next();
      return fail(res, 403, "forbidden", "Changing this needs content:edit.", { required: "content:edit" });
    };
    app.post("/v2/admin/entries/:type", need("content:create"), (req, res) => {
      if (!TYPES.has(req.params.type)) return fail(res, 404, "unknown_type", `No content type ${req.params.type}.`);
      const r = store.create(req.params.type, who(req), req.body ?? {});
      if (r.status) return fail(res, r.status, r.code, r.message ?? r.code);
      if (r.errors) return fail(res, 422, "invalid", "Some fields need attention.", { fieldErrors: r.errors });
      send(res, r.entry, 201);
    });
    app.post("/v2/admin/entries/:type/:id/visibility", need("content:view"), (req, res) => {
      const e = entryOr404(req, res);
      if (!e || !fresh(req, res, e)) return;
      const r = lib.keepAddresses(who(req), () => store.setVisibility(e, who(req), String(req.body?.action ?? ""), { can: (p) => req.who.permissions.includes(p) }));
      if (r.status) return fail(res, r.status, r.code, r.message ?? r.code, { required: r.required });
      send(res, e);
    });
    app.delete("/v2/admin/entries/:type/:id", need("content:delete"), (req, res) => {
      const e = entryOr404(req, res);
      if (!e) return;
      const r = store.remove(e, who(req));
      if (r.status) return fail(res, r.status, r.code, r.message ?? r.code);
      res.status(204).end();
    });
    app.patch("/v2/admin/entries/:type/:id", need("content:view"), editsEntry, (req, res) => {
      const e = entryOr404(req, res);
      if (!e || !fresh(req, res, e)) return;
      if (req.body?.sampleLabel !== undefined && !req.who.permissions.includes("claims:approve")) {
        return fail(res, 403, "forbidden", "Changing a sample label needs claims approval.", { required: "claims:approve" });
      }
      const r = store.save(e, who(req), req.body ?? {}, { can: (x) => req.who.permissions.includes(x) });
      if (r.status) return fail(res, r.status, r.code, r.message ?? r.code, { required: r.required });
      if (r.errors) return fail(res, 422, "invalid", "Some fields need attention.", { fieldErrors: r.errors });
      send(res, e);
    });

    app.post("/v2/admin/entries/:type/:id/transitions", need("content:view"), (req, res) => {
      const e = entryOr404(req, res);
      if (!e || !fresh(req, res, e)) return;
      const r = lib.keepAddresses(who(req), () => store.transition(e, who(req), String(req.body?.action ?? ""), { can: (p) => req.who.permissions.includes(p), note: req.body?.note, publishAt: req.body?.publishAt }));
      if (r.status) return fail(res, r.status, r.code, r.message ?? r.code, { required: r.required, fieldErrors: r.fieldErrors });
      send(res, e);
    });

    app.post("/v2/admin/entries/:type/:id/translation", need("localization:view"), (req, res) => {
      const e = entryOr404(req, res);
      if (!e || !fresh(req, res, e)) return;
      const r = store.translate(e, who(req), String(req.body?.locale ?? ""), String(req.body?.action ?? ""), { can: (p) => req.who.permissions.includes(p) });
      if (r.status) return fail(res, r.status, r.code, r.message ?? r.code, { required: r.required });
      send(res, e);
    });
    app.get("/v2/admin/entries/:type/:id/versions/:n", need("content:view"), (req, res) => {
      const e = entryOr404(req, res);
      if (!e) return;
      const v = store.versionOf(e, req.params.n);
      if (!v) return fail(res, 404, "not_found", "No such version.");
      ok(res, { ...v, by: person(v.by) });
    });
    app.post("/v2/admin/entries/:type/:id/restore", need("content:edit"), (req, res) => {
      const e = entryOr404(req, res);
      if (!e || !fresh(req, res, e)) return;
      const r = store.restore(e, who(req), req.body?.version, {can: (p) => req.who.permissions.includes(p)});
      if (r.status) return fail(res, r.status, r.code, r.message ?? "Cannot restore this version.", {required:r.required,fieldErrors:r.fieldErrors});
      send(res, e);
    });
    // Every entry's languages at once (the localization matrix).
    app.get("/v2/admin/localization", need("localization:view"), (req, res) => {
      const rows = [...store.entries.values()].map((e) => { const s = store.summary(e); return { id: s.id, type: s.type, name: s.name, translation: s.translation, state: s.state }; });
      ok(res, rows, { total: rows.length, page: 1, pageSize: rows.length });
    });
    app.post("/v2/admin/entries/:type/:id/approve-figures", need("claims:approve"), (req, res) => {
      const e = entryOr404(req, res);
      if (!e || !fresh(req, res, e)) return;
      const r = store.approveFigures(e, who(req));
      if (r.status) return fail(res, r.status, r.code, r.code);
      send(res, e);
    });

    app.get("/v2/admin/audit", need("settings:view"), (req, res) => {
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));
      const page = Math.max(1, Number(req.query.page) || 1);
      const type = String(req.query.type ?? "");
      const by = String(req.query.by ?? "");
      const search = String(req.query.search ?? "").trim().toLowerCase();
      let rows = store.audit.map(event => ({ ...event, targetName: event.targetName ?? (store.entries.has(event.entry) ? store.summary(store.entries.get(event.entry)).name : event.entry) }));
      if (search) rows = rows.filter(event => `${event.targetName} ${event.action} ${person(event.by).name ?? ""}`.toLowerCase().includes(search));
      // "content": anything that happened to a page or an entry, whatever its type.
      if (type === "content") rows = rows.filter((a) => store.entries.has(a.entry));
      else if (type) rows = rows.filter((a) => a.type === type);
      if (by) rows = rows.filter((a) => a.by === by);
      ok(res, rows.slice((page - 1) * pageSize, page * pageSize).map((a) => ({ ...a, by: person(a.by) })), { page, pageSize, total: rows.length });
    });

    // What the website reads (D-012: at runtime, with a last-known-good copy). Live content only.
    app.get("/v2/public/case-studies", (req, res) => {
      ok(res, [...store.entries.values()].filter((e) => e.type === "caseStudy" && e.workflow.visibility === "live").sort((a, b) => a.order - b.order).map((e) => ({ id: e.id, department: e.department, format: e.format, ...e.live })));
    });

    const page = (req, rows) => {
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));
      const n = Math.max(1, Number(req.query.page) || 1);
      return { rows: rows.slice((n - 1) * pageSize, n * pageSize), meta: { page: n, pageSize, total: rows.length } };
    };
    app.get("/v2/admin/queue", need("content:view"), (req, res) => {
      let rows = [...store.entries.values()].filter(entry => (!req.query.state || (entry.draft ? entry.workflow.state : "published") === req.query.state) && (req.query.mine !== "1" || entry.workflow.lastEditor === req.who.user.key)).map(entry => named(store.summary(entry)));
      if (req.query.search) rows = rows.filter(row => row.name.toLowerCase().includes(String(req.query.search).toLowerCase()));
      const result = page(req, rows); ok(res, result.rows, result.meta);
    });
    // ---- members: who works in the Website Manager (for owners of leads, audit filters) ----
    require("./wm/users").registerUsers(app, { identity, store, need, ok, fail, page });
    app.get("/v2/admin/members", need("content:view"), (req, res) => {
      const rows = identity.users
        .map((u) => ({ u, roles: rolesOf(u) }))
        .filter((x) => x.roles.length)
        .map(({ u, roles }) => ({ key: u.key, name: identity.fullName(u), roles, permissions: permissionsFor(roles, roleOverrides) }));
      ok(res, rows, { total: rows.length, page: 1, pageSize: rows.length });
    });

    // ---- leads (D-028: the website's slice of the one pipeline) ----
    const pii = (req) => req.who.permissions.includes("leads:pii");
    const leadOut = (req, l) => ({ ...ops.view(l, pii(req)), owner: l.owner ? person(l.owner) : null, notes: l.notes.map((n) => ({ ...n, by: person(n.by) })), history: l.history.map((h) => ({ ...h, by: person(h.by === "visitor" ? null : h.by) })) });
    app.get("/v2/admin/leads", need("marketing:view"), (req, res) => {
      const status = String(req.query.status ?? "");
      const q = String(req.query.search ?? "").trim().toLowerCase();
      let rows = [...ops.leads.values()];
      if (status === "open") rows = rows.filter((l) => ops.OPEN.includes(l.status));
      else if (status === "closed") rows = rows.filter((l) => ["unqualified", "lost", "spam", "duplicate"].includes(l.status));
      else if (status) rows = rows.filter((l) => l.status === status);
      // Search by name or email only for those who may see them.
      if (q) rows = rows.filter((l) => `${l.topic} ${l.message} ${l.company} ${pii(req) ? `${l.name} ${l.email}` : ""}`.toLowerCase().includes(q));
      rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const counts = {};
      for (const l of ops.leads.values()) counts[l.status] = (counts[l.status] ?? 0) + 1;
      const { rows: out, meta } = page(req, rows);
      ok(res, out.map((l) => leadOut(req, l)), { ...meta, counts, pii: pii(req) });
    });
    app.get("/v2/admin/leads/export.csv", need("marketing:view"), (req, res) => {
      store.audit.unshift({ at: new Date().toISOString(), by: req.who.user.key, action: "leads_export", entry: "leads", type: "lead", withPersonalData: pii(req) });
      res.set("Content-Disposition", 'attachment; filename="orgtik-leads.csv"').type("text/csv; charset=utf-8").send(ops.csv(pii(req)));
    });
    const leadOr404 = (req, res) => ops.leads.get(req.params.id) ?? (fail(res, 404, "not_found", "This lead doesn't exist (any more)."), null);
    const leadFresh = (req, res, l) => {
      const want = req.get("if-match");
      if (want != null && Number(want) !== l.version) return fail(res, 412, "stale", "This lead changed since you opened it.", { current: l.version, by: person(l.history[0]?.by).name ?? "" }), false;
      return true;
    };
    app.get("/v2/admin/leads/:id", need("marketing:view"), (req, res) => {
      const l = leadOr404(req, res);
      if (l) ok(res, leadOut(req, l));
    });
    app.post("/v2/admin/leads/:id/move", need("marketing:edit"), (req, res) => {
      const l = leadOr404(req, res);
      if (!l || !leadFresh(req, res, l)) return;
      const r = ops.move(l, who(req), String(req.body?.action ?? ""), req.body ?? {});
      if (r.status) return fail(res, r.status, r.code, r.message ?? r.code, { fieldErrors: r.fieldErrors });
      ok(res, leadOut(req, l));
    });
    app.post("/v2/admin/leads/:id/assign", need("marketing:edit"), (req, res) => {
      const l = leadOr404(req, res);
      if (!l || !leadFresh(req, res, l)) return;
      ops.assign(l, who(req), req.body?.owner ?? null);
      ok(res, leadOut(req, l));
    });
    app.post("/v2/admin/leads/:id/notes", need("marketing:edit"), (req, res) => {
      const l = leadOr404(req, res);
      if (!l) return;
      const r = ops.note(l, who(req), req.body?.text);
      if (r.status) return fail(res, r.status, r.code, "Write a note first.", { fieldErrors: r.fieldErrors });
      ok(res, leadOut(req, l));
    });
    app.delete("/v2/admin/leads/:id/personal-data", need("marketing:edit"), (req, res) => {
      if (!pii(req)) return fail(res, 403, "forbidden", "Erasing personal data needs leads:pii.", { required: "leads:pii" });
      const l = leadOr404(req, res);
      if (!l) return;
      ops.erase(l, who(req));
      ok(res, leadOut(req, l));
    });
    app.get('/v2/admin/catalog', need('content:view'), (req, res) => {
      if (!ctx.catalogMirror) return fail(res, 503, 'catalog_unavailable', 'The catalog mirror is unavailable.');
      ok(res, ctx.catalogMirror());
    });
    // The website's contact form (S6). Answers 201 with the lead's id, or 422 with what's missing.
    app.post("/v2/public/leads", async (req, res) => {
      if (ops.site.formsMode !== "live") return fail(res, 409, "forms_preview", "The website's forms are in preview.");
      if (String(req.body?.privacyVersion ?? "") !== privacyInForce()) return fail(res, 409, "privacy_outdated", "The privacy notice changed; reload the page.");
      const r = ops.submit(req.body ?? {});
      if (r.fieldErrors) return fail(res, 422, "invalid", "Some fields need attention.", { fieldErrors: r.fieldErrors });
      // D-028: Sales owns the pipeline. The lead is handed to Sales' intake (server to server); a
      // duplicate email becomes a note on the existing Sales lead. If Sales is down, the lead
      // stays here with the failure recorded, so nothing is lost.
      r.lead.handoff = await toSales(r.lead, req.body ?? {});
      ok(res, { id: r.lead.id, formsMode: ops.site.formsMode, sales: r.lead.handoff }, {}, 201);
    });
    async function toSales(l, body) {
      const locale = ["en", "ar", "de", "fr", "it"].includes(body.locale) ? body.locale : undefined;
      const payload = { source: "website", name: l.name, email: l.email, company: l.company || undefined, phone: l.phone || undefined, page: l.page || undefined, bundle: l.context?.bundle ?? undefined, utm: Object.keys(l.utm).length ? l.utm : undefined, message: l.topic ? `[${l.topic}] ${l.message}` : l.message, locale };
      if (typeof ctx.salesLeadDelivery === "function" || ctx.committedReplay || ctx.workspaceBoundary) {
        try {
          const delivered = typeof ctx.salesLeadDelivery === "function" ? await ctx.salesLeadDelivery(payload, { realm, wmLeadId: l.id }) : { state: "deferred", code: "orgtik_crm_intake_pending" };
          const result = delivered?.deferred === true && !delivered.state ? { ...delivered, state: "deferred" } : delivered;
          if (!result || !["sent", "failed", "deferred"].includes(result.state)) return { state: "failed", code: "invalid_delivery_result", at: new Date().toISOString() };
          return { ...result, at: result.at || new Date().toISOString() };
        } catch { return { state: "failed", code: "shared_delivery_unavailable", at: new Date().toISOString() }; }
      }
      try {
        const res = await fetch(`${ctx.apiUrl("sales")}/api/leads/intake`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(3000) });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) return { state: "failed", status: res.status, code: j.code ?? j.error?.code ?? null, at: new Date().toISOString() };
        return { state: "sent", leadId: j.data?.leadId ?? null, duplicate: Boolean(j.data?.duplicate), at: new Date().toISOString() };
      } catch (e) {
        return { state: "failed", status: null, code: e.name === "TimeoutError" ? "timeout" : "unreachable", at: new Date().toISOString() };
      }
    }

    // ---- site settings ----
    const siteOut = () => ({ ...ops.site, updatedBy: ops.site.updatedBy ? person(ops.site.updatedBy) : null, readiness: ops.readiness() });
    app.get("/v2/admin/settings/site", need("settings:view"), (req, res) => ok(res, siteOut()));
    app.patch("/v2/admin/settings/site", need("settings:edit"), (req, res) => {
      const want = req.get("if-match");
      if (want != null && Number(want) !== ops.site.version) return fail(res, 412, "stale", "Someone changed the settings since you opened them.", { current: ops.site.version, by: person(ops.site.updatedBy).name ?? "" });
      const r = ops.updateSite(who(req), req.body ?? {}, (x) => req.who.permissions.includes(x));
      if (r.status) return fail(res, r.status, r.code, r.code, { required: r.required });
      if (r.errors) return fail(res, 422, "invalid", "Some fields need attention.", { fieldErrors: r.errors });
      ok(res, siteOut());
    });

    // ---- roadmap ideas: community submissions and their moderation ----
    const { ideaView, eraseSubmitter, publicIdea, moderateComment, addIdeaNote } = require("./wm/ideas");
    const ideaOut = (req, x) => ({ ...ideaView(x, pii(req)), notes: (x.notes ?? []).map(n => ({ ...n, by: person(n.by) })), ...(x.mergedInto ? { mergedIntoTitle: store.ideas.get(x.mergedInto)?.title ?? x.mergedInto } : {}), history: x.history.map((h) => ({ ...h, by: person(h.by === "visitor" ? null : h.by) })) });
    app.get("/v2/admin/ideas/:id", need("marketing:view"), (req, res) => {
      const idea = store.ideas.get(req.params.id);
      if (!idea) return fail(res, 404, "not_found", "This idea does not exist.");
      ok(res, ideaOut(req, idea));
    });
    app.patch("/v2/admin/ideas/:id", need("marketing:edit"), (req, res) => {
      const idea = store.ideas.get(req.params.id);
      if (!idea) return fail(res, 404, "not_found", "This idea does not exist.");
      if (Number(req.get("if-match")) !== idea.version) return fail(res, 412, "stale", "This idea changed since you opened it.", { current: idea.version });
      const patch = req.body ?? {}, errors = {};
      for (const [field, max] of Object.entries({ title: 180, body: 5000, theme: 100 })) if (field in patch && (typeof patch[field] !== "string" || !patch[field].trim() || patch[field].length > max)) errors[field] = "invalid";
      if (Object.keys(errors).length) return fail(res, 422, "invalid", "Some fields need attention.", { fieldErrors: errors });
      for (const field of ["title", "body", "theme"]) if (field in patch) idea[field] = patch[field].trim();
      idea.version += 1;
      const at = new Date().toISOString(), by = who(req).key;
      idea.history.unshift({ at, by, action: "edit", from: idea.status, to: idea.status });
      store.audit.unshift({ at, by, action: "idea_edit", entry: idea.id, type: "idea", version: idea.version });
      ok(res, ideaOut(req, idea));
    });
    app.get("/v2/admin/ideas", need("marketing:view"), (req, res) => {
      const status = String(req.query.status ?? "");
      const q = String(req.query.search ?? "").trim().toLowerCase();
      let rows = [...store.ideas.values()];
      if (req.query.mergeable === "true") rows = rows.filter(x => store.VISIBLE.includes(x.status));
      if (status && status !== "all") rows = rows.filter((x) => (status === "closed" ? ["declined", "merged", "hidden"].includes(x.status) : x.status === status));
      if (q) rows = rows.filter((x) => `${x.title} ${x.body} ${x.theme}`.toLowerCase().includes(q));
      // Waiting ones first by age (oldest first), then the rest by votes.
      rows.sort((a, b) => a.status === "pending" && b.status !== "pending" ? -1 : b.status === "pending" && a.status !== "pending" ? 1 : a.status === "pending" ? a.submittedAt.localeCompare(b.submittedAt) : b.votes - a.votes);
      const counts = {};
      for (const x of store.ideas.values()) counts[x.status] = (counts[x.status] ?? 0) + 1;
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));
      const page = Math.max(1, Number(req.query.page) || 1);
      ok(res, rows.slice((page - 1) * pageSize, page * pageSize).map(x => ideaOut(req, x)), { page, pageSize, total: rows.length, counts });
    });
    app.post("/v2/admin/ideas/:id/moderate", need("marketing:edit"), (req, res) => {
      const idea = store.ideas.get(req.params.id);
      if (!idea) return fail(res, 404, "not_found", "This idea doesn't exist (any more).");
      const want = req.get("if-match");
      if (want != null && Number(want) !== idea.version) return fail(res, 412, "stale", "This idea changed since you opened it.", { current: idea.version, by: person(idea.history[0]?.by).name ?? "" });
      const r = store.moderate(idea, who(req), String(req.body?.action ?? ""), req.body ?? {});
      if (r.status) return fail(res, r.status, r.code, r.message ?? r.code, { fieldErrors: r.fieldErrors });
      res.set("ETag", String(idea.version));
      ok(res, ideaOut(req, idea));
    });
    app.post("/v2/admin/ideas/:id/erase", need("leads:pii"), (req, res) => {
      const idea = store.ideas.get(req.params.id);
      if (!idea) return fail(res, 404, "not_found", "This idea doesn't exist (any more).");
      const want = req.get("if-match");
      if (want != null && Number(want) !== idea.version) return fail(res, 412, "stale", "This idea changed since you opened it.", { current: idea.version });
      eraseSubmitter(idea, who(req).key, new Date().toISOString(), store.audit);
      ok(res, ideaOut(req, idea));
    });
    app.post("/v2/admin/ideas/:id/comments/:commentId/moderate", need("marketing:edit"), (req, res) => {
      const idea = store.ideas.get(req.params.id);
      if (!idea) return fail(res, 404, "not_found", "This idea does not exist.");
      if (Number(req.get("if-match")) !== idea.version) return fail(res, 412, "stale", "This idea changed since you opened it.", { current: idea.version });
      const result = moderateComment(idea, req.params.commentId, req.body?.action, who(req).key, new Date().toISOString(), store.audit);
      if (result.status) return fail(res, result.status, result.code, "The comment could not be updated.");
      ok(res, ideaOut(req, idea));
    });
    app.post("/v2/admin/ideas/:id/notes", need("marketing:edit"), (req, res) => {
      const idea = store.ideas.get(req.params.id);
      if (!idea) return fail(res, 404, "not_found", "This idea does not exist.");
      if (Number(req.get("if-match")) !== idea.version) return fail(res, 412, "stale", "This idea changed since you opened it.", { current: idea.version });
      const result = addIdeaNote(idea, req.body?.text, who(req).key, new Date().toISOString(), store.audit);
      if (result.status) return fail(res, result.status, result.code, "Write a note of up to 5000 characters.", { fieldErrors: result.fieldErrors });
      ok(res, ideaOut(req, idea));
    });
    // What the roadmap page shows: moderated ideas only, most wanted first.
    app.get("/v2/public/ideas", (req, res) => {
      ok(res, [...store.ideas.values()].filter((x) => store.VISIBLE.includes(x.status)).sort((a, b) => b.votes - a.votes).map(publicIdea));
    });
    // The roadmap's "suggest an idea" form (S6, D-041). A suggestion waits for moderation
    // (pending, not on the page); who sent it is kept for the team, never shown publicly.
    app.post("/v2/public/ideas", (req, res) => {
      const b = req.body ?? {};
      const fieldErrors = {};
      const name = String(b.name ?? "").trim();
      const email = String(b.email ?? "").trim();
      const message = String(b.message ?? "").trim();
      const theme = String(b.topic ?? "").trim();
      // Older clients may omit a title; preserve those submissions with their first sentence.
      const title = b.title == null ? message.split(/(?<=[.!?])\s/)[0].slice(0, 180) : String(b.title).trim();
      if (!title || title.length > 180) fieldErrors.title = "required_or_too_long";
      if (!theme) fieldErrors.topic = "required";
      if (!name) fieldErrors.name = "required";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = "email";
      if (!message) fieldErrors.message = "required";
      if (b.consent !== true) fieldErrors.consent = "required";
      if (Object.keys(fieldErrors).length) return fail(res, 422, "invalid", "Some fields need attention.", { fieldErrors });
      if (ops.site.formsMode !== "live") return fail(res, 409, "forms_preview", "The website's forms are in preview.");
      if (String(b.privacyVersion ?? "") !== privacyInForce()) return fail(res, 409, "privacy_outdated", "The privacy notice changed; reload the page.");
      const submission = { name, email, title, message, topic: theme, privacyVersion: String(b.privacyVersion), consent: true };
      const key = req.get("idempotency-key");
      const duplicate = submissions.duplicate(submission, key);
      if (duplicate?.conflict) return fail(res, 409, "idempotency_conflict", "This request key was already used for another idea.");
      if (duplicate) return ok(res, { id: duplicate.id, status: store.ideas.get(duplicate.id).status, duplicate: true });
      const baseId = `idea_${Date.now().toString(36)}`;
      let id = baseId, suffix = 1;
      while (store.ideas.has(id)) id = `${baseId}_${suffix++}`;
      const at = new Date().toISOString();
      store.ideas.set(id, {
        id, status: "pending", theme, title, body: message, votes: 0, comments: 0, submittedAt: at,
        order: store.ideas.size + 1, source: "website", version: 1,
        submitter: { name, email, privacyVersion: String(b.privacyVersion ?? "") },
        history: [{ at, by: "visitor", action: "submitted", to: "pending" }],
      });
      submissions.remember(submission, key, id);
      ok(res, { id, status: "pending" }, {}, 201);
    });
    // Every published version of a legal document, newest first (plan: legal versions).
    app.get("/v2/public/legal/:key/versions", (req, res) => {
      const e = store.entries.get(`lg_${req.params.key}`);
      if (!e) return fail(res, 404, "not_found", "No such legal document.");
      ok(res, e.legalVersions.map((v) => ({ ...v, by: undefined })));
    });

    // ---- media library ----
    const mediaUrl = (m) => (m.source === "upload" ? `/v2/media/${m.file}` : null);
    const mediaOf = (m, uses) => ({ ...lib.mediaOut(m, uses), url: mediaUrl(m) });
    app.get("/v2/admin/media", need("media:view"), (req, res) => {
      const kind = String(req.query.kind ?? "");
      const issue = String(req.query.issue ?? "");
      const q = String(req.query.search ?? "").trim().toLowerCase();
      let rows = [...lib.media.values()].map((m) => mediaOf(m));
      if (kind) rows = rows.filter((m) => m.kind === kind);
      if (issue) rows = rows.filter((m) => issue === "attention" ? m.issues.some(value => value !== "unused") : m.issues.includes(issue));
      if (q) rows = rows.filter((m) => `${m.file} ${m.description ?? ""} ${(m.tags ?? []).join(" ")} ${Object.values(m.alt).join(" ")}`.toLowerCase().includes(q));
      const counts = {};
      for (const m of [...lib.media.values()].map((x) => lib.mediaOut(x))) for (const i of m.issues) counts[i] = (counts[i] ?? 0) + 1;
      counts.attention = [...lib.media.values()].filter(m => lib.mediaOut(m).issues.some(issue => issue !== "unused")).length;
      const { rows: out, meta } = page(req, rows);
      ok(res, out, { ...meta, counts });
    });
    const mediaOr404 = (req, res) => lib.media.get(req.params.id) ?? (fail(res, 404, "not_found", "This file isn't in the library (any more)."), null);
    app.get("/v2/admin/media/:id", need("media:view"), (req, res) => {
      const m = mediaOr404(req, res);
      if (m) ok(res, mediaOf(m, true));
    });
    app.patch("/v2/admin/media/:id", need("media:edit"), (req, res) => {
      const m = mediaOr404(req, res);
      if (!m) return;
      const want = req.get("if-match");
      if (want != null && Number(want) !== m.version) return fail(res, 412, "stale", "This file changed since you opened it.", { current: m.version, by: person(m.updatedBy).name ?? "" });
      const r = lib.updateMedia(m, who(req), req.body ?? {});
      if (r.errors) return fail(res, 422, "invalid", "Some fields need attention.", { fieldErrors: r.errors });
      ok(res, mediaOf(m, true));
    });
    const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
    const ACCEPT = ["image/webp", "image/png", "image/jpeg", "image/svg+xml", "video/mp4", "video/webm"];
    app.post("/v2/admin/media", need("media:create"), (req, res, next) => upload.single("file")(req, res, error => error ? fail(res, 422, "invalid", "The upload is incomplete or exceeds 15 MB.", { fieldErrors: { file: "invalid" } }) : next()), (req, res) => {
      if (!req.file) return fail(res, 422, "invalid", "Choose a file to upload.", { fieldErrors: { file: "required" } });
      if (!ACCEPT.includes(req.file.mimetype)) return fail(res, 422, "invalid", "This kind of file can't go on the website.", { fieldErrors: { file: "type" } });
      let tags;
      try { tags = JSON.parse(req.body.tags ?? "[]"); } catch { return fail(res, 422, "invalid", "Tags must be a list."); }
      const description = req.body.description ?? "";
      if (typeof description !== "string" || description.length > 2000 || !Array.isArray(tags) || tags.length > 30 || tags.some(tag => typeof tag !== "string" || tag.length > 80)) return fail(res, 422, "invalid", "Invalid media metadata.");
      ok(res, mediaOf(lib.addUpload(who(req), req.file, { description: description.trim(), tags: [...new Set(tags.map(tag => tag.trim()).filter(Boolean))] }), true), {}, 201);
    });
    app.delete("/v2/admin/media/:id", need("media:delete"), (req, res) => {
      const m = mediaOr404(req, res);
      if (!m) return;
      const r = lib.removeMedia(m, who(req));
      if (r.status) return fail(res, r.status, r.code, r.message, { count: r.count });
      res.status(204).end();
    });
    app.get("/v2/media/:file", (req, res) => {
      if (![...lib.media.values()].some(media => media.source === "upload" && media.file === req.params.file)) return res.status(404).end();
      const f = path.join(UPLOADS, path.basename(req.params.file));
      if (!fs.existsSync(f)) return res.status(404).end();
      res.sendFile(f);
    });

    // ---- SEO ----
    app.get("/v2/admin/seo/health", need("seo:view"), (req, res) => {
      const h = lib.health();
      const issue = String(req.query.issue ?? "");
      let rows = issue ? h.rows.filter((r) => r.issues.includes(issue)) : h.rows;
      const search = String(req.query.search ?? "").trim().toLowerCase();
      if (search) rows = rows.filter(row => `${row.name} ${row.path} ${row.title}`.toLowerCase().includes(search));
      if (req.query.kind) rows = rows.filter(row => row.type === req.query.kind);
      const result = page(req, rows);
      ok(res, result.rows, { ...result.meta, counts: h.counts, healthy: h.healthy, checked: h.rows.length });
    });
    app.get("/v2/admin/seo/redirects", need("seo:view"), (req, res) => {
      let rows = [...lib.redirects.values()].sort((a, b) => a.from.localeCompare(b.from)).map((r) => {
        const history = store.audit.filter(event => event.entry === r.id && event.type === "redirect" || event.action === "redirect_auto" && event.from === r.from);
        if (!history.some(event => ["redirect_create", "redirect_auto"].includes(event.action))) history.push({ at: r.createdAt, by: r.createdBy, action: "redirect_create" });
        return { ...r, createdBy: person(r.createdBy), history: history.map(event => ({ ...event, by: person(event.by) })) };
      });
      const search = String(req.query.search ?? "").trim().toLowerCase();
      if (search) rows = rows.filter(row => `${row.from} ${row.to} ${row.note ?? ""}`.toLowerCase().includes(search));
      if (req.query.kind) rows = rows.filter(row => String(row.code) === req.query.kind);
      const { rows: out, meta } = page(req, rows);
      ok(res, out, meta);
    });
    app.post("/v2/admin/seo/redirects", need("seo:create"), (req, res) => {
      const r = lib.saveRedirect(who(req), req.body ?? {});
      if (r.errors) return fail(res, 422, "invalid", "Some fields need attention.", { fieldErrors: r.errors });
      ok(res, r.redirect, {}, 201);
    });
    const redirectOr404 = (req, res) => lib.redirects.get(req.params.id) ?? (fail(res, 404, "not_found", "This redirect doesn't exist (any more)."), null);
    app.patch("/v2/admin/seo/redirects/:id", need("seo:edit"), (req, res) => {
      const x = redirectOr404(req, res);
      if (!x) return;
      const want = req.get("if-match");
      if (want != null && Number(want) !== x.version) return fail(res, 412, "stale", "This redirect changed since you opened it.", { current: x.version, by: person(x.updatedBy).name ?? "" });
      const r = lib.saveRedirect(who(req), { ...x, ...(req.body ?? {}) }, x);
      if (r.errors) return fail(res, 422, "invalid", "Some fields need attention.", { fieldErrors: r.errors });
      ok(res, r.redirect);
    });
    app.delete("/v2/admin/seo/redirects/:id", need("seo:delete"), (req, res) => {
      const x = redirectOr404(req, res);
      if (!x) return;
      lib.removeRedirect(x, who(req));
      res.status(204).end();
    });
    app.get("/v2/admin/seo/indexing", need("seo:view"), (req, res) => {
      ok(res, { settings: { ...lib.settings, history: lib.settings.history.map((h) => ({ ...h, by: person(h.by) })) }, urls: lib.indexingUrls(), sitemap: lib.sitemap(), robots: lib.robots() });
    });
    app.patch("/v2/admin/seo/indexing", need("seo:view"), (req, res) => {
      if (!req.who.permissions.includes("site:visibility")) return fail(res, 403, "forbidden", "Changing search visibility needs site:visibility.", { required: "site:visibility" });
      const want = req.get("if-match");
      if (want != null && Number(want) !== lib.settings.version) return fail(res, 412, "stale", "Someone changed this since you opened it.", { current: lib.settings.version, by: person(lib.settings.history[0]?.by).name ?? "" });
      const r = lib.setVisibility(who(req), req.body?.visibility, req.body?.reason);
      if (r.errors) return fail(res, 422, "invalid", "Some fields need attention.", { fieldErrors: r.errors });
      ok(res, { settings: { ...lib.settings, history: lib.settings.history.map((h) => ({ ...h, by: person(h.by) })) }, urls: lib.indexingUrls(), sitemap: lib.sitemap(), robots: lib.robots() });
    });
    // What the website's head tags need from the settings (S3: prerender-heads). No people, no PII.
    // A file the website ships is its own /assets path; an upload lives in the Website Manager until the site has it.
    const ogImageOf = (id) => { const m = id && lib.media.get(id); return !m ? null : m.source === "upload" ? mediaUrl(m) : `/assets/${m.file}`; };
    app.get("/v2/public/site", (req, res) => {
      const { siteName, titleTemplate, defaultDescription, defaultOgImage, organization, locales } = ops.site;
      const org = Object.fromEntries(Object.entries(organization).filter(([, v]) => String(v ?? "").trim()));
      ok(res, { siteName, titleTemplate, defaultDescription, defaultOgImage: ogImageOf(defaultOgImage), organization: org, canonicalHost: lib.settings.canonicalHost, visibility: lib.settings.visibility, publicLocales: locales.filter((l) => l.public).map((l) => l.code), forms: { mode: ops.site.formsMode, privacyVersion: privacyInForce() } });
    });
    // The privacy notice a form submission was made under: the newest version already in force.
    const privacyInForce = () => {
      const v = (store.entries.get("lg_privacy")?.legalVersions ?? []).filter((x) => x.effectiveFrom && x.effectiveFrom <= new Date().toISOString()).sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
      return v ? String(v.versionLabel ?? "") : "";
    };
    app.get("/v2/public/redirects", (req, res) => ok(res, [...lib.redirects.values()].map(({ from, to, code, handledBy }) => ({ from, to, code, handledBy: handledBy ?? "host" }))));
    app.get("/v2/public/robots.txt", (req, res) => res.type("text/plain").send(lib.robots()));
    app.get("/v2/public/sitemap.xml", (req, res) => {
      const urls = lib.sitemap().map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod></url>`).join("\n");
      res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
    });

    // ---- preview: the real site showing unpublished drafts (plan: "Preview tokens show the real site in 390/768/1440 frames") ----
    // A token is short-lived and read-only: it opens drafts, nothing else. The Website Manager hands
    // it to the site's frame by postMessage and the site sends it as a header, never in an address
    // (D-017). Drafts show over what's published; archived entries stay out, like on the site.
    const PREVIEW_MINUTES = 30;
    app.post("/v2/admin/preview-token", need("content:view"), (req, res) => {
      for (const [t, p] of previews) if (Date.parse(p.expiresAt) <= RealDate.now()) previews.delete(t);
      const token = crypto.randomBytes(18).toString("base64url");
      const expiresAt = new RealDate(RealDate.now() + PREVIEW_MINUTES * 60000).toISOString();
      previews.set(tokenHash(token), { by: req.who.user.key ?? req.who.user.id, expiresAt });
      ok(res, { token, expiresAt });
    });
    app.get("/v2/admin/preview/addresses", need("content:view"), (req, res) => ok(res, lib.previewAddresses()));
    const previewOk = (req, res) => {
      const m = /^Preview (\S+)$/.exec(req.get("authorization") ?? "");
      const p = m && previewGrant(holder, m[1]);
      if (!p) return fail(res, 401, "preview_expired", "This preview has expired. Open it again from the Website Manager."), false;
      return true;
    };
    app.get("/v2/preview/entries/:type", (req, res) => {
      if (!previewOk(req, res)) return;
      if (!TYPES.has(req.params.type)) return fail(res, 404, "unknown_type", `No content type ${req.params.type}.`);
      const rows = [...store.entries.values()].filter((e) => e.type === req.params.type && e.workflow.visibility !== "archived");
      rows.sort((a, b) => String(a.parent ?? "").localeCompare(String(b.parent ?? "")) || a.order - b.order);
      ok(res, rows.map((e) => ({ id: e.id, order: e.order, ...(e.parent ? { parent: e.parent } : {}), ...(e.department ? { department: e.department, format: e.format } : {}), ...(e.draft ?? e.live), preview: { state: e.draft ? e.workflow.state : "published", onSite: e.workflow.visibility === "live" } })));
    });

    // Every type the same way; the website's adapters rebuild its own shapes from these.
    app.get("/v2/public/entries/:type", (req, res) => {
      if (!TYPES.has(req.params.type)) return fail(res, 404, "unknown_type", `No content type ${req.params.type}.`);
      const rows = [...store.entries.values()].filter((e) => e.type === req.params.type && e.workflow.visibility === "live");
      rows.sort((a, b) => String(a.parent ?? "").localeCompare(String(b.parent ?? "")) || a.order - b.order);
      ok(res, rows.map((e) => ({ id: e.id, order: e.order, ...(e.parent ? { parent: e.parent } : {}), ...(e.department ? { department: e.department, format: e.format } : {}), ...e.live })));
    });

    // Prices shown on the website (plan: Pricing). Read-only here: numbers need pricing:edit and
    // Admin approval, which arrives with the pricing editor.
    app.get("/v2/admin/pricing", need("content:view"), (req, res) => ok(res, store.pricing()));

    require("./wm/roles").registerRoles(app, { identity, store, overrides: roleOverrides, need, ok, fail });

    return { exportState: () => exportHolder(holder), importState: snapshot => importHolder(holder, snapshot) };
  },
};
