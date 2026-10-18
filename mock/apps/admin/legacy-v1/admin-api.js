// Staff API for ADM (Phase E): /v1/admin/*. Guarded by the spec's permission matrix (02):
// 401 without a session, 403 with the missing permission named. Envelope { data, meta } /
// { error: { code, message, fieldErrors?, required? } }; lists page with page/pageSize (25).
const { permissionsFor, ROLE_LABELS, LABELS, MODULES, MATRIX, ROLE_KEYS } = require("./permissions");
const { advance } = require("./lifecycle");

module.exports = function adminApi(app, ctx, S, H) {
  const { identity } = ctx;
  const { ok, fail, page } = H;
  const db = S.db;

  function staff(req, res) {
    const u = identity.userFromReq(req);
    if (!u) return fail(res, 401, "unauthenticated", "Sign in again."), null;
    const roles = db.staffRoles[u.key] ?? [];
    if (!roles.length) return fail(res, 403, "forbidden", "You don't have access to the OrgTik admin."), null;
    return { user: u, key: u.key, roles, permissions: permissionsFor(roles) };
  }
  const can = (who, p) => who.permissions.includes(p) || (p.endsWith(":edit") && who.permissions.includes(p.replace(":edit", ":full")));
  const need = (p) => Object.assign((req, res, next) => {
    const who = staff(req, res);
    if (!who) return;
    if (!can(who, p)) return fail(res, 403, "forbidden", "Your role can't do this.", { required: p });
    req.who = who;
    advance(S);
    next();
  }, { permission: p }); // read by orgtik-program/phase-e/openapi.mjs
  const name = (key) => { const u = key && identity.findByKey?.(key); return u ? identity.fullName(u) : key; };
  const usd = (amount, cur) => Math.round((amount / S.usdRate(cur)) * 100) / 100;
  const monthly = (l) => (l.cycle === "yearly" ? l.snapshot.amount / 12 : l.cycle === "monthly" ? l.snapshot.amount : 0);
  const paying = (l) => l.state === "active" || l.state === "cancelling" || l.state === "past_due";

  // ---- me ----
  app.get("/v1/admin/me", (req, res) => {
    const who = staff(req, res);
    if (!who) return;
    ok(res, {
      user: { key: who.key, id: who.user.id, firstName: who.user.firstName, lastName: who.user.lastName, email: who.user.email },
      roles: who.roles.map((r) => ({ key: r, label: ROLE_LABELS[r] })),
      permissions: who.permissions,
      // ADM-27 and ADM-28 live in the Website Manager (D-019, D-029).
      links: { content: `${require("../../config").webUrl("wm")}/en/content`, suggestions: `${require("../../config").webUrl("wm")}/en/marketing/ideas` },
      twoFactor: { required: true, verified: true },
    });
  });

  // ---- ADM-02 overview ----
  app.get("/v1/admin/overview", need("overview:view"), (req, res) => {
    const lines = db.workspaces.flatMap((w) => w.lines.map((l) => ({ ...l, ws: w })));
    const mrrUsd = lines.filter(paying).reduce((s, l) => s + usd(monthly(l), l.snapshot.currency), 0);
    const byState = (arr, key = "state") => arr.reduce((m, x) => ((m[x[key]] = (m[x[key]] ?? 0) + 1), m), {});
    ok(res, {
      mrrUsd: Math.round(mrrUsd * 100) / 100,
      workspaces: byState(db.workspaces),
      lines: byState(lines),
      trialsEndingIn3Days: lines.filter((l) => l.state === "trialing" && Date.parse(l.trialEndsAt) - S.now() <= 3 * 86400000).length,
      invoices: byState(db.invoices),
      serviceRequests: byState(db.serviceRequests),
      tickets: byState(db.tickets),
      waitlist: db.waitlist.length,
      customPlanRequests: db.customPlanRequests.filter((r) => r.state === "new").length,
      migrations: db.migrations.filter((m) => m.state === "queued").length,
    }, { currency: "USD" });
  });

  // ---- ADM-03/04 tools ----
  const STATUS_NEXT = { coming_soon: ["beta", "live"], beta: ["live", "coming_soon"], live: ["retired"], retired: ["live"] };
  app.get("/v1/admin/tools", need("tools:view"), (req, res) => ok(res, db.tools.slice().sort((a, b) => a.order - b.order).map((t) => ({ ...t, plans: db.plans.filter((p) => p.tool === t.key).length, workspaces: db.workspaces.filter((w) => w.lines.some((l) => l.tool === t.key && l.state !== "deleted")).length, waitlist: db.waitlist.filter((x) => x.tool === t.key).length, next: STATUS_NEXT[t.status] ?? [] }))));
  app.get("/v1/admin/tools/:key", need("tools:view"), (req, res) => {
    const t = db.tools.find((x) => x.key === req.params.key);
    if (!t) return fail(res, 404, "not_found", "No such tool.");
    ok(res, { ...t, next: STATUS_NEXT[t.status] ?? [], features: db.features.filter((f) => f.tool === t.key), plans: db.plans.filter((p) => p.tool === t.key) });
  });
  app.post("/v1/admin/tools", need("tools:edit"), (req, res) => {
    const b = req.body ?? {};
    const errs = {};
    if (!/^[a-z][a-z0-9_]{1,30}$/.test(b.key ?? "")) errs.key = "invalid";
    if (db.tools.some((t) => t.key === b.key)) errs.key = "taken";
    if (!b.name?.en?.trim()) errs["name.en"] = "required";
    if (!b.name?.ar?.trim()) errs["name.ar"] = "required"; // D-014: EN and AR required
    if (Object.keys(errs).length) return fail(res, 422, "invalid", "Some fields need attention.", { fieldErrors: errs });
    const t = { key: b.key, order: db.tools.length + 1, status: "coming_soon", icon: b.icon ?? "ph-cube", scope: null, name: b.name, short: b.short ?? { en: "" } };
    db.tools.push(t);
    S.log(req.who.key, "tool_create", t.key);
    ok(res, t, {}, 201);
  });
  app.patch("/v1/admin/tools/:key", need("tools:edit"), (req, res) => {
    const t = db.tools.find((x) => x.key === req.params.key);
    if (!t) return fail(res, 404, "not_found", "No such tool.");
    const b = req.body ?? {};
    if (b.status && b.status !== t.status) {
      if (!(STATUS_NEXT[t.status] ?? []).includes(b.status)) return fail(res, 409, "wrong_state", `A ${t.status} tool can't become ${b.status}.`);
      if (t.mandatory && b.status === "retired") return fail(res, 409, "mandatory", "General can't be retired.");
      // Going live notifies the waitlist (ADM-29, US-A-04).
      if (b.status === "live" || b.status === "beta") for (const w of db.waitlist.filter((x) => x.tool === t.key)) w.notified = true;
      S.log(req.who.key, "tool_status", t.key, { from: t.status, to: b.status });
      t.status = b.status;
    }
    for (const k of ["name", "short", "icon", "order"]) if (b[k] !== undefined) t[k] = b[k];
    ok(res, t);
  });

  // ---- ADM-05 features & limits ----
  app.get("/v1/admin/features", need("plans:view"), (req, res) => ok(res, db.features.filter((f) => !req.query.tool || f.tool === req.query.tool).map((f) => ({ ...f, usedBy: db.plans.filter((p) => p.limits?.[f.key] !== undefined || p.flags?.[f.key] !== undefined).length }))));
  app.post("/v1/admin/features", need("plans:edit"), (req, res) => {
    const b = req.body ?? {};
    const errs = {};
    if (!db.tools.some((t) => t.key === b.tool)) errs.tool = "required";
    if (!new RegExp(`^${b.tool}\\.[a-z_]{2,40}$`).test(b.key ?? "")) errs.key = "invalid"; // G-20: "<tool>.<feature>"
    if (db.features.some((f) => f.key === b.key)) errs.key = "taken";
    if (!["flag", "limit"].includes(b.kind)) errs.kind = "required";
    if (b.kind === "limit" && !["hard", "soft"].includes(b.enforcement)) errs.enforcement = "required";
    if (Object.keys(errs).length) return fail(res, 422, "invalid", "Some fields need attention.", { fieldErrors: errs });
    const f = { key: b.key, tool: b.tool, kind: b.kind, unit: b.unit ?? null, enforcement: b.kind === "limit" ? b.enforcement : undefined };
    db.features.push(f);
    ok(res, f, {}, 201);
  });
  app.delete("/v1/admin/features/:key", need("plans:edit"), (req, res) => {
    const used = db.plans.filter((p) => p.limits?.[req.params.key] !== undefined || p.flags?.[req.params.key] !== undefined);
    if (used.length) return fail(res, 409, "in_use", `Used by ${used.length} plan(s).`, { plans: used.map((p) => p.id) });
    db.features = db.features.filter((f) => f.key !== req.params.key);
    res.status(204).end();
  });

  // ---- ADM-06/07 plans ----
  const planOut = (p) => ({ ...p, subscribers: db.workspaces.filter((w) => w.lines.some((l) => l.planId === p.id && l.state !== "deleted")).length });
  app.get("/v1/admin/plans", need("plans:view"), (req, res) => ok(res, db.plans.filter((p) => !p.service && (!req.query.tool || p.tool === req.query.tool)).map(planOut)));
  app.get("/v1/admin/plans/:id", need("plans:view"), (req, res) => {
    const p = db.plans.find((x) => x.id === req.params.id);
    if (!p) return fail(res, 404, "not_found", "No such plan.");
    ok(res, planOut(p));
  });
  const planErrors = (b, isNew) => {
    const e = {};
    if (isNew && !/^[a-z][a-z0-9_]{2,40}$/.test(b.id ?? "")) e.id = "invalid";
    if (isNew && db.plans.some((p) => p.id === b.id)) e.id = "taken";
    if (isNew && !db.tools.some((t) => t.key === b.tool)) e.tool = "required";
    if (b.name !== undefined && (!b.name?.en?.trim() || !b.name?.ar?.trim())) e.name = "required";
    if (b.minSeats !== undefined && !(Number.isInteger(b.minSeats) && b.minSeats >= 1)) e.minSeats = "min";
    if (b.trialDays !== undefined && !(Number.isInteger(b.trialDays) && b.trialDays >= 0 && b.trialDays <= 90)) e.trialDays = "range";
    if (b.yearlyDiscountPct !== undefined && !(b.yearlyDiscountPct >= 0 && b.yearlyDiscountPct < 100)) e.yearlyDiscountPct = "range";
    if (b.defaultUsd?.monthly !== undefined && !(b.defaultUsd.monthly >= 0)) e["defaultUsd.monthly"] = "min";
    for (const k of Object.keys(b.limits ?? {})) if (!db.features.some((f) => f.key === k && f.kind === "limit")) e[`limits.${k}`] = "unknown";
    return e;
  };
  app.post("/v1/admin/plans", need("plans:edit"), (req, res) => {
    const b = req.body ?? {};
    const e = planErrors({ ...b, name: b.name ?? {} }, true);
    if (Object.keys(e).length) return fail(res, 422, "invalid", "Some fields need attention.", { fieldErrors: e });
    const p = { tier: "custom", perUser: false, minSeats: 1, guestLimit: 0, trialDays: 0, yearlyDiscountPct: 100 * (2 / 12), visibility: "public", status: "active", limits: {}, flags: {}, defaultUsd: { monthly: 0 }, ...b };
    db.plans.push(p);
    S.log(req.who.key, "plan_create", p.id);
    ok(res, planOut(p), {}, 201);
  });
  app.patch("/v1/admin/plans/:id", need("plans:edit"), (req, res) => {
    const p = db.plans.find((x) => x.id === req.params.id);
    if (!p) return fail(res, 404, "not_found", "No such plan.");
    const e = planErrors(req.body ?? {}, false);
    if (Object.keys(e).length) return fail(res, 422, "invalid", "Some fields need attention.", { fieldErrors: e });
    // Prices go through the grid and its publishing (ADM-12), not the plan editor.
    const { id: _id, tool: _tool, ...rest } = req.body ?? {};
    Object.assign(p, rest);
    S.log(req.who.key, "plan_update", p.id);
    ok(res, planOut(p));
  });

  // ---- ADM-08 currencies, ADM-09/10 zones, ADM-11 countries, ADM-15 rates ----
  const currencyInUse = (code) => db.workspaces.some((w) => w.currency === code) || db.zones.some((z) => z.currency === code && z.active) || Object.values(db.countries).some((c) => c.currency === code);
  app.get("/v1/admin/currencies", need("pricing:view"), (req, res) => ok(res, Object.values(db.currencies).map((c) => ({ ...c, inUse: currencyInUse(c.code), workspaces: db.workspaces.filter((w) => w.currency === c.code).length }))));
  app.patch("/v1/admin/currencies/:code", need("pricing:edit"), (req, res) => {
    const c = db.currencies[req.params.code];
    if (!c) return fail(res, 404, "not_found", "No such currency.");
    const b = req.body ?? {};
    if (b.active === false && currencyInUse(c.code)) return fail(res, 409, "in_use", "A currency in use can't be turned off (R03-C5).");
    const e = {};
    if (b.decimals !== undefined && ![0, 2, 3].includes(b.decimals)) e.decimals = "range";
    if (b.step !== undefined && !(b.step > 0)) e.step = "min";
    if (b.mode !== undefined && !["nearest", "up", "down"].includes(b.mode)) e.mode = "required";
    if (Object.keys(e).length) return fail(res, 422, "invalid", "Some fields need attention.", { fieldErrors: e });
    Object.assign(c, b, { code: c.code });
    S.db.pricingLog.unshift({ id: S.id("pl"), at: S.iso(S.now()), by: req.who.key, action: "currency", summary: `${c.code}: ${JSON.stringify(b)}` });
    ok(res, c);
  });
  app.post("/v1/admin/currencies", need("pricing:edit"), (req, res) => {
    const b = req.body ?? {};
    if (!/^[A-Z]{3}$/.test(b.code ?? "") || db.currencies[b.code]) return fail(res, 422, "invalid", "Use a new 3-letter ISO code.", { fieldErrors: { code: db.currencies[b.code] ? "taken" : "invalid" } });
    db.currencies[b.code] = { code: b.code, name: b.name ?? b.code, decimals: b.decimals ?? 2, step: b.step ?? 1, mode: b.mode ?? "nearest", active: true };
    ok(res, db.currencies[b.code], {}, 201);
  });
  app.get("/v1/admin/zones", need("pricing:view"), (req, res) => ok(res, db.zones.map((z) => ({ ...z, countries: Object.entries(db.countries).filter(([, c]) => c.zone === z.id).map(([iso]) => iso), workspaces: db.workspaces.filter((w) => w.zone === z.id && w.state !== "deleted").length }))));
  app.post("/v1/admin/zones", need("pricing:edit"), (req, res) => {
    const b = req.body ?? {};
    if (!/^[a-z][a-z0-9_]{1,30}$/.test(b.id ?? "") || db.zones.some((z) => z.id === b.id)) return fail(res, 422, "invalid", "Choose a new key.", { fieldErrors: { id: "invalid" } });
    if (!db.currencies[b.currency]?.active) return fail(res, 422, "invalid", "Choose an active currency.", { fieldErrors: { currency: "required" } });
    const z = { id: b.id, name: b.name ?? b.id, currency: b.currency, isDefault: false, active: true };
    db.zones.push(z);
    ok(res, z, {}, 201);
  });
  app.patch("/v1/admin/zones/:id", need("pricing:edit"), (req, res) => {
    const z = db.zones.find((x) => x.id === req.params.id);
    if (!z) return fail(res, 404, "not_found", "No such zone.");
    const b = req.body ?? {};
    if (b.active === false && z.isDefault) return fail(res, 409, "default_zone", "The Default zone can't be turned off.");
    if (b.active === false) {
      // X5: its countries fall back to Default for new customers; existing workspaces queue for migration.
      for (const w of db.workspaces.filter((x) => x.zone === z.id)) db.migrations.push({ id: S.id("mig"), workspaceId: w.id, from: { country: w.country, currency: w.currency }, to: { country: w.country, currency: db.zones.find((x) => x.isDefault).currency }, requestedAt: S.iso(S.now()), state: "queued", requestedBy: req.who.key, reason: `Zone ${z.name} turned off` });
    }
    Object.assign(z, { name: b.name ?? z.name, active: b.active ?? z.active, currency: b.currency ?? z.currency });
    ok(res, z);
  });
  app.get("/v1/admin/countries", need("pricing:view"), (req, res) => ok(res, Object.entries(db.countries).map(([iso, c]) => ({ iso, ...c, fixed: c.fixed ?? {} }))));
  app.patch("/v1/admin/countries/:iso", need("pricing:edit"), (req, res) => {
    const c = db.countries[req.params.iso];
    if (!c) return fail(res, 404, "not_found", "No such country.");
    const b = req.body ?? {};
    const zone = b.zone ? db.zones.find((z) => z.id === b.zone) : db.zones.find((z) => z.id === c.zone);
    if (!zone) return fail(res, 422, "invalid", "Choose a zone.", { fieldErrors: { zone: "required" } });
    const cur = b.currency ?? c.currency;
    // X2: a currency override needs an exchange rate from the zone's currency.
    if (cur !== zone.currency && S.pricing.rate(db, zone.currency, cur) == null) return fail(res, 422, "invalid", `Add an exchange rate ${zone.currency} → ${cur} first (R03-X2).`, { fieldErrors: { currency: "no_rate" } });
    Object.assign(c, { zone: zone.id, currency: cur, fixed: b.fixed ?? c.fixed });
    db.pricingLog.unshift({ id: S.id("pl"), at: S.iso(S.now()), by: req.who.key, action: "country", summary: `${req.params.iso}: zone ${zone.id}, ${cur}${b.fixed ? `, fixed ${JSON.stringify(b.fixed)}` : ""}` });
    ok(res, { iso: req.params.iso, ...c });
  });
  app.get("/v1/admin/rates", need("pricing:view"), (req, res) => ok(res, db.rates));
  app.put("/v1/admin/rates", need("pricing:edit"), (req, res) => {
    const { from, to, rate } = req.body ?? {};
    if (!db.currencies[from] || !db.currencies[to] || !(rate > 0)) return fail(res, 422, "invalid", "From, to and a positive rate.", { fieldErrors: { rate: "min" } });
    const r = db.rates.find((x) => x.from === from && x.to === to);
    if (r) Object.assign(r, { rate, updatedAt: S.iso(S.now()), by: req.who.key });
    else db.rates.push({ from, to, rate, updatedAt: S.iso(S.now()), by: req.who.key });
    // P6: rates change new purchases only.
    db.pricingLog.unshift({ id: S.id("pl"), at: S.iso(S.now()), by: req.who.key, action: "rate", summary: `${from} → ${to} = ${rate} (new purchases only)` });
    ok(res, db.rates);
  });

  // ---- ADM-12 grid, drafts and publishing; ADM-13 preview; ADM-14 log ----
  app.get("/v1/admin/grid", need("pricing:view"), (req, res) => {
    const plans = db.plans.filter((p) => !p.service && p.tier !== "free" && (!req.query.tool || p.tool === req.query.tool));
    const open = db.priceDrafts.find((d) => d.state === "draft");
    // Who a draft would reach if published to existing customers: their lines, counted now.
    const reach = (d) => {
      const ids = new Set(d.changes.map((c) => c.key.split(":")[0]));
      const lines = db.workspaces.flatMap((w) => w.lines.filter((l) => ids.has(l.planId) && (l.state === "active" || l.state === "cancelling")).map((l) => w.id));
      return { lines: lines.length, workspaces: new Set(lines).size };
    };
    const draft = open ? { ...open, affects: reach(open) } : undefined;
    ok(res, {
      zones: db.zones.filter((z) => z.active),
      plans: plans.map((p) => ({ id: p.id, tool: p.tool, name: p.name, perUser: p.perUser, defaultUsd: p.defaultUsd, cells: Object.fromEntries(db.zones.map((z) => [z.id, { monthly: db.grid[`${p.id}:monthly:${z.id}`] ?? null, yearly: db.grid[`${p.id}:yearly:${z.id}`] ?? null }])) })),
      draft,
      priceVersion: db.priceVersion,
    });
  });
  app.post("/v1/admin/price-drafts", need("pricing:edit"), (req, res) => {
    const changes = req.body?.changes ?? [];
    if (!Array.isArray(changes) || !changes.length) return fail(res, 422, "invalid", "Change at least one price.", { fieldErrors: { changes: "required" } });
    for (const c of changes) if (!/^[a-z0-9_]+:(monthly|yearly|once):[a-z0-9_]+$/.test(c.key ?? "") || !(c.to == null || c.to >= 0)) return fail(res, 422, "invalid", `Bad change ${c.key}.`, { fieldErrors: { [c.key]: "invalid" } });
    let d = db.priceDrafts.find((x) => x.state === "draft");
    if (!d) db.priceDrafts.push((d = { id: S.id("pd"), state: "draft", createdBy: req.who.key, createdAt: S.iso(S.now()), changes: [] }));
    for (const c of changes) {
      const existing = d.changes.find((x) => x.key === c.key);
      const from = db.grid[c.key] ?? null;
      if (existing) existing.to = c.to;
      else d.changes.push({ key: c.key, from, to: c.to });
    }
    d.changes = d.changes.filter((c) => c.to !== c.from);
    ok(res, d);
  });
  app.delete("/v1/admin/price-drafts/:id", need("pricing:edit"), (req, res) => {
    db.priceDrafts = db.priceDrafts.filter((d) => !(d.id === req.params.id && d.state === "draft"));
    res.status(204).end();
  });
  app.post("/v1/admin/price-drafts/:id/publish", need("pricing:edit"), (req, res) => {
    const d = db.priceDrafts.find((x) => x.id === req.params.id && x.state === "draft");
    if (!d) return fail(res, 404, "not_found", "No draft to publish.");
    const { effectiveAt, applyMode, reason } = req.body ?? {};
    const e = {};
    if (!["new_only", "existing_next_renewal", "existing_now"].includes(applyMode)) e.applyMode = "required";
    if (!reason?.trim()) e.reason = "required";
    if (effectiveAt && Number.isNaN(Date.parse(effectiveAt))) e.effectiveAt = "invalid";
    const increase = d.changes.some((c) => c.from != null && c.to > c.from);
    // P5: only a decrease may reach existing customers without notice.
    if (applyMode === "existing_now" && increase) e.applyMode = "increase_needs_notice";
    if (Object.keys(e).length) return fail(res, 422, "invalid", "Some fields need attention.", { fieldErrors: e });
    for (const c of d.changes) if (c.to == null) delete db.grid[c.key]; else db.grid[c.key] = c.to;
    db.priceVersion += 1;
    Object.assign(d, { state: "published", publishedAt: S.iso(S.now()), publishedBy: req.who.key, effectiveAt: effectiveAt ?? S.iso(S.now()), applyMode, reason, priceVersion: db.priceVersion });
    // Existing lines: P3 keep the snapshot; P4 a notice and the new price at the first renewal after it.
    let notified = 0;
    if (applyMode !== "new_only") {
      const keys = new Set(d.changes.map((c) => c.key.split(":")[0]));
      for (const w of db.workspaces) for (const l of w.lines) if (keys.has(l.planId) && (l.state === "active" || l.state === "cancelling")) {
        if (applyMode === "existing_now") {
          const r = S.resolve(l.planId, w.country, l.cycle, S.seats(w));
          if (r) l.snapshot = { ...l.snapshot, amount: r.amount, unit: r.unit, priceVersion: db.priceVersion };
        } else {
          l.scheduled = { kind: "price_change", effectiveAt: new Date(Math.max(Date.parse(l.periodEnd), S.now() + db.settings.priceChange.noticeDays * 86400000)).toISOString(), priceVersion: db.priceVersion };
          notified += 1;
        }
      }
    }
    db.pricingLog.unshift({ id: S.id("pl"), at: S.iso(S.now()), by: req.who.key, action: "publish", summary: d.changes.map((c) => `${c.key} ${c.from ?? "—"} → ${c.to ?? "—"}`).join(" · "), applyMode, reason, priceVersion: db.priceVersion, notified });
    ok(res, { ...d, notified });
  });
  app.get("/v1/admin/price-preview", need("pricing:view"), (req, res) => {
    const { planId, cycle = "monthly", country, seats } = req.query;
    if (!db.plans.some((p) => p.id === planId)) return fail(res, 422, "invalid", "Choose a plan.", { fieldErrors: { planId: "required" } });
    const all = Object.keys(db.countries);
    const list = (country ? [country] : all).map((iso) => ({ country: iso, ...S.resolve(planId, iso, cycle, Number(seats) || 1) }));
    ok(res, list, { rules: ["R03-ALG-1…9"] });
  });
  app.get("/v1/admin/pricing-log", need("pricing:view"), (req, res) => page(req, res, db.pricingLog.map((x) => ({ ...x, byName: name(x.by) }))));

  // ---- ADM-16 bundles, ADM-17 coupons ----
  app.get("/v1/admin/bundles", need("bundles:view"), (req, res) => ok(res, db.bundles.map((b) => ({ ...b, examples: ["SA", "AE", "EG", "DE"].map((iso) => {
    const lines = b.planIds.map((p) => S.resolve(p, iso, "monthly", 5)).filter(Boolean);
    const cur = lines[0]?.currency;
    const dec = db.currencies[cur]?.decimals ?? 2;
    const sum = S.pricing.toDecimals(lines.reduce((s, l) => s + l.amount, 0), dec);
    return { country: iso, currency: cur, sum, price: S.pricing.toDecimals(sum * (1 - b.pct / 100), dec) }; // R03-B1
  }) }))));
  app.post("/v1/admin/bundles", need("bundles:edit"), (req, res) => {
    const b = req.body ?? {};
    const e = {};
    if (!b.name?.en?.trim() || !b.name?.ar?.trim()) e.name = "required";
    if (!Array.isArray(b.planIds) || b.planIds.length < 2 || b.planIds.some((p) => !db.plans.some((x) => x.id === p))) e.planIds = "min2";
    if (!(b.pct > 0 && b.pct < 100)) e.pct = "range";
    if (Object.keys(e).length) return fail(res, 422, "invalid", "Some fields need attention.", { fieldErrors: e });
    const x = { id: S.id("bnd"), name: b.name, planIds: b.planIds, pct: b.pct, active: b.active !== false };
    db.bundles.push(x);
    ok(res, x, {}, 201);
  });
  app.patch("/v1/admin/bundles/:id", need("bundles:edit"), (req, res) => {
    const x = db.bundles.find((b) => b.id === req.params.id);
    if (!x) return fail(res, 404, "not_found", "No such bundle.");
    Object.assign(x, req.body ?? {}, { id: x.id });
    ok(res, x);
  });
  app.get("/v1/admin/coupons", need("bundles:view"), (req, res) => ok(res, db.coupons.map((c) => ({ ...c, exhausted: c.redeemed >= c.maxRedemptions, expired: Date.parse(c.validTo) < S.now() }))));
  app.post("/v1/admin/coupons", need("bundles:edit"), (req, res) => {
    const b = req.body ?? {};
    const e = {};
    if (!/^[A-Z0-9]{4,20}$/.test(b.code ?? "")) e.code = "invalid";
    if (db.coupons.some((c) => c.code === b.code)) e.code = "taken";
    if (b.kind === "percent" && !(b.value > 0 && b.value <= 100)) e.value = "range";
    if (b.kind === "fixed" && !(b.amounts && Object.keys(b.amounts).length && Object.entries(b.amounts).every(([k, v]) => db.currencies[k] && v > 0))) e.amounts = "required"; // K1, G-06
    if (!["percent", "fixed"].includes(b.kind)) e.kind = "required";
    if (!b.validTo || Date.parse(b.validTo) <= Date.parse(b.validFrom ?? S.iso(S.now()))) e.validTo = "after_start";
    if (Object.keys(e).length) return fail(res, 422, "invalid", "Some fields need attention.", { fieldErrors: e });
    const c = { code: b.code, kind: b.kind, value: b.value, amounts: b.amounts, appliesTo: b.appliesTo ?? "all", maxRedemptions: b.maxRedemptions ?? 100, redeemed: 0, validFrom: b.validFrom ?? S.iso(S.now()), validTo: b.validTo, active: true, note: b.note ?? "" };
    db.coupons.push(c);
    ok(res, c, {}, 201);
  });
  app.patch("/v1/admin/coupons/:code", need("bundles:edit"), (req, res) => {
    const c = db.coupons.find((x) => x.code === req.params.code);
    if (!c) return fail(res, 404, "not_found", "No such coupon.");
    if (c.redeemed > 0 && (req.body?.kind || req.body?.value || req.body?.amounts)) return fail(res, 409, "redeemed", "A coupon already used can't change its discount; end it and create a new one.");
    Object.assign(c, req.body ?? {}, { code: c.code, redeemed: c.redeemed });
    ok(res, c);
  });

  // ---- ADM-18 tax rules, ADM-19 gateways ----
  app.get("/v1/admin/tax-rules", need("tax:view"), (req, res) => ok(res, db.taxRules, { decision: db.settings.switches.taxDisplay }));
  app.put("/v1/admin/tax-rules/:country", need("tax:edit"), (req, res) => {
    const b = req.body ?? {};
    if (!db.countries[req.params.country]) return fail(res, 404, "not_found", "No such country.");
    if (!(b.rate >= 0 && b.rate < 100)) return fail(res, 422, "invalid", "Rate between 0 and 100.", { fieldErrors: { rate: "range" } });
    const r = db.taxRules.find((t) => t.country === req.params.country);
    const next = { country: req.params.country, name: b.name ?? "VAT", rate: b.rate, inclusive: b.inclusive ?? null, b2bReverseCharge: Boolean(b.b2bReverseCharge), eInvoicing: b.eInvoicing ?? "", active: b.active !== false };
    if (r) Object.assign(r, next); else db.taxRules.push(next);
    S.log(req.who.key, "tax_rule", req.params.country);
    ok(res, next);
  });
  app.get("/v1/admin/gateways", need("tax:view"), (req, res) => ok(res, db.gateways));
  app.patch("/v1/admin/gateways/:id", need("tax:edit"), (req, res) => {
    const g = db.gateways.find((x) => x.id === req.params.id);
    if (!g) return fail(res, 404, "not_found", "No such gateway.");
    Object.assign(g, req.body ?? {}, { id: g.id });
    ok(res, g);
  });
  const route = (country, currency) => db.gateways.filter((g) => g.active && (g.countries.includes(country) || g.countries.includes("*")) && g.currencies.includes(currency)).sort((a, b) => a.priority - b.priority);
  app.get("/v1/admin/gateways/route", need("tax:view"), (req, res) => ok(res, route(req.query.country, req.query.currency)));

  // ---- ADM-20/21 workspaces ----
  const wsSummary = (w) => {
    const owner = w.members.find((m) => m.role === "owner");
    const mrr = w.lines.filter(paying).reduce((s, l) => s + monthly(l), 0);
    return { id: w.id, name: w.name, country: w.country, currency: w.currency, state: w.state, owner: owner ? { key: owner.userKey, name: owner.userKey ? name(owner.userKey) : owner.name, email: owner.userKey ? identity.findByKey(owner.userKey)?.email : owner.email } : null, seats: S.seats(w), tools: w.lines.filter((l) => l.state !== "deleted" && l.state !== "ended").map((l) => ({ tool: l.tool, state: l.state })), mrr: S.pricing.toDecimals(mrr, db.currencies[w.currency]?.decimals ?? 2), mrrUsd: usd(mrr, w.currency), createdAt: w.createdAt };
  };
  app.get("/v1/admin/workspaces", need("workspaces:view"), (req, res) => {
    const q = String(req.query.q ?? "").toLowerCase();
    let list = db.workspaces.filter((w) => w.state !== "deleted");
    if (q) list = list.filter((w) => w.name.toLowerCase().includes(q) || w.members.some((m) => (m.email ?? identity.findByKey(m.userKey)?.email ?? "").toLowerCase().includes(q)));
    if (req.query.state) list = list.filter((w) => w.state === req.query.state);
    if (req.query.country) list = list.filter((w) => w.country === req.query.country);
    if (req.query.tool) list = list.filter((w) => w.lines.some((l) => l.tool === req.query.tool && l.state !== "ended"));
    page(req, res, list.map(wsSummary));
  });
  app.get("/v1/admin/workspaces/:id", need("workspaces:view"), (req, res) => {
    const w = S.workspace(req.params.id);
    if (!w) return fail(res, 404, "not_found", "No such workspace.");
    ok(res, {
      ...wsSummary(w),
      zone: w.zone, currencyLocked: w.currencyLocked, flags: w.flags, billing: w.billing, notes: w.notes.map((n) => ({ ...n, byName: name(n.by) })), paymentMethods: w.paymentMethods.map(({ id, kind, brand, last4, expires, isDefault, expired }) => ({ id, kind, brand, last4, expires, isDefault, expired: Boolean(expired) })),
      members: w.members.map((m) => ({ ...m, name: m.userKey ? name(m.userKey) : m.name, email: m.userKey ? identity.findByKey(m.userKey)?.email : m.email })),
      lines: w.lines.map((l) => ({ ...l, toolName: db.tools.find((t) => t.key === l.tool)?.name, planName: db.plans.find((p) => p.id === l.planId)?.name })),
      invoices: db.invoices.filter((i) => i.workspaceId === w.id).map(({ id, number, state, total, currency, issuedAt }) => ({ id, number, state, total, currency, issuedAt })),
      tickets: db.tickets.filter((t) => t.workspaceId === w.id).map(({ id, number, subject, state }) => ({ id, number, subject, state })),
      serviceRequests: db.serviceRequests.filter((r) => r.workspaceId === w.id).map(({ id, number, title, state }) => ({ id, number, title, state })),
      migration: db.migrations.find((m) => m.workspaceId === w.id && m.state === "queued") ?? null,
      audit: db.audit.filter((a) => a.target === w.id).slice(0, 30).map((a) => ({ ...a, byName: name(a.by) })),
    });
  });
  app.post("/v1/admin/workspaces/:id/actions", need("workspaces:edit"), (req, res) => {
    const w = S.workspace(req.params.id);
    if (!w) return fail(res, 404, "not_found", "No such workspace.");
    const { action, reason, lineId, days, text } = req.body ?? {};
    const needReason = ["suspend", "reactivate", "extend_trial", "view_as", "cancel"].includes(action);
    if (needReason && !reason?.trim()) return fail(res, 422, "invalid", "Say why: it goes in the audit log.", { fieldErrors: { reason: "required" } });
    const l = lineId ? w.lines.find((x) => x.id === lineId) : null;
    switch (action) {
      case "suspend":
        if (w.state === "suspended") return fail(res, 409, "wrong_state", "Already suspended.");
        w.flags.suspendedReason = reason; w.state = "suspended"; break;
      case "reactivate":
        if (!["suspended", "cancelled"].includes(w.state)) return fail(res, 409, "wrong_state", "Only a suspended or cancelled workspace comes back.");
        w.state = "active"; delete w.flags.suspendedReason; break;
      case "cancel":
        w.state = "cancelled"; w.cancelledAt = S.iso(S.now()); break;
      case "extend_trial":
        if (!l || l.state !== "trialing") return fail(res, 409, "wrong_state", "Only a trial can be extended.");
        if (!(days >= 1 && days <= 30)) return fail(res, 422, "invalid", "Between 1 and 30 days.", { fieldErrors: { days: "range" } });
        l.trialEndsAt = new Date(Date.parse(l.trialEndsAt) + days * 86400000).toISOString(); l.periodEnd = l.trialEndsAt; break;
      case "note":
        if (!text?.trim()) return fail(res, 422, "invalid", "Write the note.", { fieldErrors: { text: "required" } });
        w.notes.unshift({ at: S.iso(S.now()), by: req.who.key, text: text.trim() }); break;
      case "view_as": {
        // G-25, D-017: read-only, with a reason, recorded; the customer sees nothing change.
        S.log(req.who.key, "view_as", w.id, { reason });
        const owner = w.members.find((m) => m.role === "owner");
        return ok(res, { readOnly: true, workspaceId: w.id, as: owner?.userKey ?? owner?.email, url: owner?.userKey ? `${require("../../config").webUrl("sos")}/people?viewAs=${identity.findByKey(owner.userKey)?.id}` : null, note: owner?.userKey ? null : "This owner has no local sign-in; the read-only view is the workspace detail." });
      }
      default:
        return fail(res, 422, "invalid", "Unknown action.", { fieldErrors: { action: "required" } });
    }
    S.log(req.who.key, action, w.id, { reason, line: lineId, days });
    ok(res, { state: w.state, line: l ?? null });
  });
  app.get("/v1/admin/migrations", need("workspaces:view"), (req, res) => ok(res, db.migrations.map((m) => ({ ...m, workspace: S.workspace(m.workspaceId)?.name }))));
  app.post("/v1/admin/migrations/:id/:decision(approve|reject)", need("workspaces:edit"), (req, res) => {
    const m = db.migrations.find((x) => x.id === req.params.id && x.state === "queued");
    if (!m) return fail(res, 404, "not_found", "Nothing queued with that id.");
    // C4: applies at the next renewal with a notice; open invoices stay in the old currency.
    // A rejection says why (the customer is told); an approval may carry a note.
    const reason = String(req.body?.reason ?? "").trim();
    if (req.params.decision === "reject" && !reason) return fail(res, 422, "invalid", "Say why: the customer is told.", { fieldErrors: { reason: "required" } });
    m.state = req.params.decision === "approve" ? "scheduled" : "rejected";
    m.decidedBy = req.who.key; m.decidedAt = S.iso(S.now()); m.decisionReason = reason || null;
    S.log(req.who.key, `migration_${m.state}`, m.workspaceId, { reason: reason || undefined });
    ok(res, m);
  });

  // ---- ADM-22 custom plan requests ----
  app.get("/v1/admin/custom-plans", need("workspaces:view"), (req, res) => ok(res, db.customPlanRequests.map((r) => ({ ...r, workspace: S.workspace(r.workspaceId)?.name }))));
  app.post("/v1/admin/custom-plans/:id/quote", need("workspaces:edit"), (req, res) => {
    const r = db.customPlanRequests.find((x) => x.id === req.params.id);
    if (!r) return fail(res, 404, "not_found", "No such request.");
    const { amount, validDays = 30 } = req.body ?? {};
    if (!(amount > 0)) return fail(res, 422, "invalid", "A price above 0.", { fieldErrors: { amount: "min" } });
    const ws = S.workspace(r.workspaceId);
    // ALG-1: a private plan has its own price and currency (the workspace's).
    r.quote = { amount, currency: ws.currency, validUntil: new Date(S.now() + validDays * 86400000).toISOString() };
    r.state = "quoted";
    ok(res, r);
  });

  // ---- ADM-23 invoices, payments, refunds ----
  app.get("/v1/admin/invoices", need("billing:view"), (req, res) => {
    let list = db.invoices.slice().sort((a, b) => String(b.issuedAt).localeCompare(String(a.issuedAt)));
    if (req.query.state) list = list.filter((i) => i.state === req.query.state);
    if (req.query.workspaceId) list = list.filter((i) => i.workspaceId === req.query.workspaceId);
    if (req.query.currency) list = list.filter((i) => i.currency === req.query.currency);
    page(req, res, list.map((i) => ({ ...i, workspace: S.workspace(i.workspaceId)?.name, totalUsd: usd(i.total, i.currency) })));
  });
  app.get("/v1/admin/invoices/:id", need("billing:view"), (req, res) => {
    const i = db.invoices.find((x) => x.id === req.params.id);
    if (!i) return fail(res, 404, "not_found", "No such invoice.");
    ok(res, { ...i, workspace: S.workspace(i.workspaceId)?.name, refundable: i.payments.filter((p) => p.status === "succeeded").reduce((s, p) => s + p.amount, 0) - i.refunded });
  });
  app.post("/v1/admin/invoices/:id/:action(void|mark-paid|refund|retry|issue)", need("billing:edit"), (req, res) => {
    const i = db.invoices.find((x) => x.id === req.params.id);
    if (!i) return fail(res, 404, "not_found", "No such invoice.");
    const a = req.params.action, b = req.body ?? {};
    const dec = db.currencies[i.currency]?.decimals ?? 2;
    if (a === "void") {
      if (!["draft", "open", "past_due"].includes(i.state)) return fail(res, 409, "wrong_state", "Only an unpaid invoice can be voided.");
      if (!b.reason?.trim()) return fail(res, 422, "invalid", "Say why.", { fieldErrors: { reason: "required" } });
      Object.assign(i, { state: "void", voidedAt: S.iso(S.now()), voidReason: b.reason });
    } else if (a === "issue") {
      if (i.state !== "draft") return fail(res, 409, "wrong_state", "Only a draft is issued.");
      Object.assign(i, { state: "open", issuedAt: S.iso(S.now()), dueAt: new Date(S.now() + 7 * 86400000).toISOString() });
    } else if (a === "mark-paid" || a === "retry") {
      if (!["open", "past_due"].includes(i.state)) return fail(res, 409, "wrong_state", "This invoice isn't waiting for a payment.");
      const succeeded = a === "mark-paid" || b.simulate !== "fail";
      const r = S.usdRate(i.currency);
      i.payments.push({ id: S.id("pay"), amount: i.total, currency: i.currency, method: a === "mark-paid" ? (b.method ?? "bank_transfer") : "card", gateway: a === "mark-paid" ? "manual" : "gw_retry", at: S.iso(S.now()), status: succeeded ? "succeeded" : "failed", usdRate: r, usdAmount: S.pricing.toDecimals(i.total / r, 2), by: req.who.key, reference: b.reference ?? null });
      if (succeeded) {
        Object.assign(i, { state: "paid", paidAt: S.iso(S.now()) });
        const ws = S.workspace(i.workspaceId);
        // Paying the invoice brings its lines back (spec 06: Past due / Read-only → Active).
        for (const it of i.lines) { const l = ws?.lines.find((x) => x.id === it.lineId); if (l && (l.state === "past_due" || l.state === "read_only")) Object.assign(l, { state: "active", graceEndsAt: null, readOnlySince: null, lastFailure: null, periodEnd: new Date(S.now() + 30 * 86400000).toISOString() }); }
        if (ws) { ws.currencyLocked = true; if (ws.state === "past_due" && !ws.lines.some((l) => l.state === "past_due" || l.state === "read_only")) ws.state = "active"; }
      } else i.state = "past_due";
    } else if (a === "refund") {
      if (!["paid", "partially_refunded"].includes(i.state)) return fail(res, 409, "wrong_state", "Only a paid invoice is refunded.");
      const max = S.pricing.toDecimals(i.payments.filter((p) => p.status === "succeeded").reduce((s, p) => s + p.amount, 0) - i.refunded, dec);
      const amount = S.pricing.toDecimals(Number(b.amount), dec);
      if (!(amount > 0 && amount <= max)) return fail(res, 422, "invalid", `Between 0 and ${max} ${i.currency}.`, { fieldErrors: { amount: "range" }, max });
      if (!b.reason?.trim()) return fail(res, 422, "invalid", "Say why.", { fieldErrors: { reason: "required" } });
      // R4: in the original currency and amount; G-14: a credit note, numbered.
      const cn = { id: S.id("cn"), number: `CN-2026-${String(db.invoices.reduce((n, x) => n + x.creditNotes.length, 0) + 15).padStart(6, "0")}`, amount, reason: b.reason, at: S.iso(S.now()), by: req.who.key };
      i.creditNotes.push(cn);
      i.refunded = S.pricing.toDecimals(i.refunded + amount, dec);
      i.state = i.refunded >= i.total ? "refunded" : "partially_refunded";
    }
    S.log(req.who.key, `invoice_${a}`, i.workspaceId, { invoice: i.number });
    ok(res, i);
  });
  app.post("/v1/admin/invoices", need("billing:edit"), (req, res) => {
    const b = req.body ?? {};
    const ws = S.workspace(b.workspaceId);
    const e = {};
    if (!ws) e.workspaceId = "required";
    if (!Array.isArray(b.lines) || !b.lines.length || b.lines.some((l) => !l.label?.trim() || !(l.amount > 0))) e.lines = "required";
    if (Object.keys(e).length) return fail(res, 422, "invalid", "Some fields need attention.", { fieldErrors: e });
    const dec = db.currencies[ws.currency]?.decimals ?? 2;
    const rule = db.taxRules.find((t) => t.country === ws.country && t.active);
    const subtotal = S.pricing.toDecimals(b.lines.reduce((s, l) => s + l.amount, 0), dec);
    const tax = rule ? S.pricing.toDecimals(subtotal * rule.rate / 100, dec) : 0;
    const n = 1040 + db.invoices.length + 1;
    const inv = { id: S.id("inv"), number: `INV-2026-${String(n).padStart(6, "0")}`, workspaceId: ws.id, kind: "manual", state: "draft", currency: ws.currency, issuedAt: null, dueAt: null, lines: b.lines, subtotal, taxLabel: rule ? `${rule.name} ${rule.rate}%` : null, tax, total: S.pricing.toDecimals(subtotal + tax, dec), payments: [], creditNotes: [], refunded: 0, createdBy: req.who.key };
    db.invoices.push(inv);
    ok(res, inv, {}, 201);
  });

  // ---- ADM-24/25 services and requests ----
  app.get("/v1/admin/services", need("services:view"), (req, res) => ok(res, db.services.map((s) => ({ ...s, prices: s.kind === "package" ? Object.fromEntries(db.zones.map((z) => [z.id, db.grid[`${s.id}:${s.billing}:${z.id}`] ?? null])) : null, zoneCurrencies: Object.fromEntries(db.zones.map((z) => [z.id, z.currency])), requests: db.serviceRequests.filter((r) => r.serviceId === s.id).length }))));
  app.patch("/v1/admin/services/:id", need("services:edit"), (req, res) => {
    const s = db.services.find((x) => x.id === req.params.id);
    if (!s) return fail(res, 404, "not_found", "No such service.");
    Object.assign(s, req.body ?? {}, { id: s.id });
    ok(res, s);
  });
  const srOut = (r) => ({ ...r, currency: S.workspace(r.workspaceId)?.currency, workspace: S.workspace(r.workspaceId)?.name, service: db.services.find((s) => s.id === r.serviceId)?.name, assigneeName: name(r.assignee) });
  app.get("/v1/admin/service-requests", need("services:view"), (req, res) => {
    let list = db.serviceRequests.slice();
    if (req.query.state) list = list.filter((r) => r.state === req.query.state);
    if (req.query.mine) list = list.filter((r) => r.assignee === req.who.key);
    page(req, res, list.map(srOut));
  });
  app.get("/v1/admin/service-requests/:id", need("services:view"), (req, res) => {
    const r = db.serviceRequests.find((x) => x.id === req.params.id);
    if (!r) return fail(res, 404, "not_found", "No such request.");
    ok(res, srOut(r));
  });
  const SR_NEXT = { new: ["under_review", "cancelled"], under_review: ["quoted", "cancelled"], quoted: ["awaiting_payment", "rejected", "expired"], awaiting_payment: ["in_progress", "cancelled"], in_progress: ["in_review", "on_hold"], in_review: ["in_progress", "completed"], on_hold: ["in_progress", "cancelled"], rejected: ["quoted"], expired: ["quoted"], cancelled: ["quoted"] };
  app.post("/v1/admin/service-requests/:id/actions", need("services:view"), (req, res) => {
    const r = db.serviceRequests.find((x) => x.id === req.params.id);
    if (!r) return fail(res, 404, "not_found", "No such request.");
    // E*: Service Team edits only the requests assigned to them.
    const edit = can(req.who, "services:edit") || (req.who.permissions.includes("services:edit:assigned") && r.assignee === req.who.key);
    if (!edit) return fail(res, 403, "forbidden", "Your role can't change this request.", { required: "services:edit" });
    const b = req.body ?? {};
    const ws = S.workspace(r.workspaceId);
    switch (b.action) {
      case "assign": if (!db.staffRoles[b.assignee]) return fail(res, 422, "invalid", "Choose a staff member.", { fieldErrors: { assignee: "required" } }); r.assignee = b.assignee; break;
      case "review": if (r.state !== "new") return fail(res, 409, "wrong_state", "Only a new request goes to review."); r.state = "under_review"; break;
      case "quote": {
        if (!["under_review", "rejected", "expired", "cancelled", "quoted"].includes(r.state)) return fail(res, 409, "wrong_state", "This request can't be quoted now.");
        if (!Array.isArray(b.lines) || !b.lines.length || b.lines.some((l) => !l.label?.trim() || typeof l.amount !== "number")) return fail(res, 422, "invalid", "Add the quote's lines.", { fieldErrors: { lines: "required" } });
        const dec = db.currencies[ws.currency]?.decimals ?? 2;
        // R03-V2: in the workspace currency; V3: the subscriber discount as its own line.
        r.quote = { currency: ws.currency, lines: b.lines, total: S.pricing.toDecimals(b.lines.reduce((s, l) => s + l.amount, 0), dec), validUntil: new Date(S.now() + (b.validDays ?? 14) * 86400000).toISOString(), sentAt: S.iso(S.now()) };
        r.state = "quoted"; break;
      }
      case "start": if (r.state !== "awaiting_payment" && r.state !== "on_hold") return fail(res, 409, "wrong_state", "Work starts after the first payment."); r.state = "in_progress"; break;
      case "hold": if (r.state !== "in_progress") return fail(res, 409, "wrong_state", "Only work in progress is put on hold."); r.state = "on_hold"; break;
      case "deliver": {
        if (r.state !== "in_progress") return fail(res, 409, "wrong_state", "Deliver from work in progress.");
        if (!b.note?.trim()) return fail(res, 422, "invalid", "Say what's delivered.", { fieldErrors: { note: "required" } });
        r.deliveries.push({ id: S.id("dl"), at: S.iso(S.now()), note: b.note, files: b.files ?? [], autoApproveAt: new Date(S.now() + db.settings.services.autoApproveDays * 86400000).toISOString() });
        r.state = "in_review"; break;
      }
      case "milestone": { const m = r.milestones[b.index]; if (!m) return fail(res, 404, "not_found", "No such milestone."); m.state = b.state; break; }
      case "message": if (!b.text?.trim()) return fail(res, 422, "invalid", "Write the message.", { fieldErrors: { text: "required" } }); r.messages.push({ by: "staff", author: req.who.key, at: S.iso(S.now()), text: b.text.trim() }); break;
      case "cancel": if (!(SR_NEXT[r.state] ?? []).includes("cancelled")) return fail(res, 409, "wrong_state", "This request can't be cancelled now."); r.state = "cancelled"; break;
      default: return fail(res, 422, "invalid", "Unknown action.", { fieldErrors: { action: "required" } });
    }
    S.log(req.who.key, `service_${b.action}`, r.workspaceId, { request: r.number });
    ok(res, srOut(r));
  });

  // ---- ADM-26 tickets ----
  const tkOut = (t) => ({ ...t, workspace: S.workspace(t.workspaceId)?.name, assigneeName: name(t.assignee), messages: t.messages.map((m) => ({ ...m, authorName: m.by === "staff" ? name(m.author) : (identity.findByKey?.(m.author) ? name(m.author) : m.author) })) });
  app.get("/v1/admin/tickets", need("tickets:view"), (req, res) => {
    let list = db.tickets.slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    if (req.query.state) list = list.filter((t) => t.state === req.query.state);
    if (req.query.mine) list = list.filter((t) => t.assignee === req.who.key);
    page(req, res, list.map(tkOut));
  });
  app.get("/v1/admin/tickets/:id", need("tickets:view"), (req, res) => {
    const t = db.tickets.find((x) => x.id === req.params.id);
    if (!t) return fail(res, 404, "not_found", "No such ticket.");
    ok(res, tkOut(t));
  });
  app.post("/v1/admin/tickets/:id/actions", need("tickets:edit"), (req, res) => {
    const t = db.tickets.find((x) => x.id === req.params.id);
    if (!t) return fail(res, 404, "not_found", "No such ticket.");
    const b = req.body ?? {};
    if (b.action === "reply") {
      if (!b.text?.trim()) return fail(res, 422, "invalid", "Write the reply.", { fieldErrors: { text: "required" } });
      t.messages.push({ by: "staff", author: req.who.key, at: S.iso(S.now()), text: b.text.trim(), internal: Boolean(b.internal) });
      if (!b.internal) { t.state = b.waitForCustomer ? "waiting_for_you" : t.state === "open" ? "in_progress" : t.state; if (t.state === "waiting_for_you") t.autoCloseAt = new Date(S.now() + 7 * 86400000).toISOString(); }
      if (!t.assignee) t.assignee = req.who.key;
    } else if (b.action === "assign") t.assignee = b.assignee;
    else if (b.action === "resolve") { t.state = "resolved"; t.resolvedAt = S.iso(S.now()); t.reopenUntil = new Date(S.now() + 7 * 86400000).toISOString(); }
    else if (b.action === "close") t.state = "closed";
    else if (b.action === "priority") t.priority = b.priority;
    else return fail(res, 422, "invalid", "Unknown action.", { fieldErrors: { action: "required" } });
    t.updatedAt = S.iso(S.now());
    ok(res, tkOut(t));
  });

  // ---- ADM-29 waitlist ----
  app.get("/v1/admin/waitlist", need("waitlist:view"), (req, res) => page(req, res, db.waitlist.filter((w) => !req.query.tool || w.tool === req.query.tool)));

  // ---- ADM-30 staff & roles ----
  // Who requests and tickets can be assigned to, for the people who assign them (no staff:view needed).
  app.get("/v1/admin/staff/options", (req, res, next) => {
    const who = staff(req, res);
    if (!who) return;
    if (!["services:edit", "services:edit:assigned", "tickets:edit"].some((p) => can(who, p))) return fail(res, 403, "forbidden", "Your role can't do this.", { required: "services:edit" });
    req.who = who;
    next();
  }, (req, res) => {
    const module = req.query.for === "tickets" ? "tickets" : "services";
    const people = Object.entries(db.staffRoles).map(([key, roles]) => ({ key, roles, perms: permissionsFor(roles) })).filter((x) => x.perms.some((p) => p === `${module}:edit` || p === `${module}:full` || p === `${module}:edit:assigned`));
    ok(res, people.map((x) => ({ key: x.key, name: name(x.key), roles: x.roles })));
  });
  app.get("/v1/admin/staff", need("staff:view"), (req, res) => ok(res, identity.users.filter((u) => u.userType !== "customer").map((u) => ({ key: u.key, id: u.id, name: identity.fullName(u), email: u.email, roles: db.staffRoles[u.key] ?? [] })), { roles: ROLE_KEYS.map((k) => ({ key: k, label: ROLE_LABELS[k] })), modules: MODULES.map((m) => ({ key: m, label: LABELS[m], levels: MATRIX[m].split(" ") })) }));
  app.put("/v1/admin/staff/:key/roles", need("staff:full"), (req, res) => {
    const roles = req.body?.roles ?? [];
    if (!Array.isArray(roles) || roles.some((r) => !ROLE_KEYS.includes(r))) return fail(res, 422, "invalid", "Unknown role.", { fieldErrors: { roles: "invalid" } });
    if (req.params.key === req.who.key && !roles.includes("super_admin")) return fail(res, 409, "self_lockout", "You can't remove your own Super Admin role.");
    if (roles.length) db.staffRoles[req.params.key] = roles; else delete db.staffRoles[req.params.key];
    S.log(req.who.key, "staff_roles", req.params.key, { roles });
    ok(res, { key: req.params.key, roles });
  });

  // ---- ADM-31 templates ----
  app.get("/v1/admin/templates", need("templates:view"), (req, res) => ok(res, db.templates.map((t) => ({ ...t, missing: ["ar", "de", "fr", "it"].filter((l) => !t.subject[l]?.trim() || !t.body[l]?.trim()) }))));
  app.patch("/v1/admin/templates/:key", need("templates:edit"), (req, res) => {
    const t = db.templates.find((x) => x.key === req.params.key);
    if (!t) return fail(res, 404, "not_found", "No such template.");
    const b = req.body ?? {};
    if (b.subject && !b.subject.en?.trim()) return fail(res, 422, "invalid", "The English subject is required.", { fieldErrors: { "subject.en": "required" } });
    if (b.subject) t.subject = { ...t.subject, ...b.subject };
    if (b.body) t.body = { ...t.body, ...b.body };
    Object.assign(t, { updatedAt: S.iso(S.now()), updatedBy: req.who.key });
    ok(res, t);
  });

  // ---- ADM-32 reports (R03-R2, R3: USD by default, the latest reporting rate) ----
  app.get("/v1/admin/reports", need("reports:view"), (req, res) => {
    const lines = db.workspaces.flatMap((w) => w.lines.map((l) => ({ ...l, ws: w })));
    const mrrBy = (keyFn) => lines.filter(paying).reduce((m, l) => { const k = keyFn(l); m[k] = Math.round(((m[k] ?? 0) + usd(monthly(l), l.snapshot.currency)) * 100) / 100; return m; }, {});
    const payments = db.invoices.flatMap((i) => i.payments.filter((p) => p.status === "succeeded").map((p) => ({ ...p, invoice: i.number })));
    ok(res, {
      mrrUsd: Object.values(mrrBy(() => "all"))[0] ?? 0,
      mrrByTool: mrrBy((l) => l.tool),
      mrrByCountry: mrrBy((l) => l.ws.country),
      revenueUsd: Math.round(payments.reduce((s, p) => s + p.usdAmount, 0) * 100) / 100,
      refundsUsd: Math.round(db.invoices.reduce((s, i) => s + usd(i.refunded, i.currency), 0) * 100) / 100,
      trials: { active: lines.filter((l) => l.state === "trialing").length },
      churn: { cancelling: lines.filter((l) => l.state === "cancelling").length, ended: lines.filter((l) => l.state === "ended").length },
      payments: payments.slice(0, 50),
    }, { currency: "USD", rateNote: "MRR uses today's reporting rate; payments keep the rate of their day (R03-R1/R3)." });
  });

  // ---- ADM-33 platform settings ----
  app.get("/v1/admin/settings", need("settings:view"), (req, res) => ok(res, db.settings));
  app.patch("/v1/admin/settings", need("settings:full"), (req, res) => {
    const b = req.body ?? {};
    const e = {};
    if (b.dunning && !(b.dunning.graceDays >= 1 && b.dunning.cancelAfterDays > b.dunning.graceDays)) e.dunning = "order";
    if (b.retention && Object.values(b.retention).some((d) => !(d >= 0 && d <= 365))) e.retention = "range";
    if (Object.keys(e).length) return fail(res, 422, "invalid", "Some fields need attention.", { fieldErrors: e });
    for (const k of ["retention", "dunning", "trial", "services", "limits", "priceChange", "company"]) if (b[k]) db.settings[k] = { ...db.settings[k], ...b[k] };
    if (b.switches) for (const [k, v] of Object.entries(b.switches)) if (db.settings.switches[k]) db.settings.switches[k].value = v;
    S.log(req.who.key, "settings", "platform");
    ok(res, db.settings);
  });

  app.get("/v1/admin/audit", need("settings:view"), (req, res) => page(req, res, db.audit.map((a) => ({ ...a, byName: name(a.by) }))));
};
