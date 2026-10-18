// Customer API for USR (Phase E): /v1/app/*. The signed-in person acts inside one workspace
// (X-Workspace header or ?workspace=, else their first). Roles in the workspace (spec 05 §1):
// owner (billing and everything), admin (team and tools, no billing), member, guest.
const { advance, toolState, banners, overLimits } = require("./lifecycle");
const { linkWebsiteOrder } = require("./website-offers");
const { makeWorkspaceOperation } = require("../../lib/workspace-command");

module.exports = function appApi(app, ctx, S, H) {
  const { identity } = ctx;
  const { ok, fail, page } = H;
  const db = S.db;
  const DAY = 86400000;

  function person(req, res) {
    const u = identity.userFromReq(req);
    if (!u) return fail(res, 401, "unauthenticated", "Sign in again."), null;
    if (db.workspaceAuthorityVersion !== 1) advance(S);
    const mine = db.workspaces.filter((w) => w.state !== "deleted" && w.members.some((m) => m.userKey === u.key && m.status === "active"));
    if (!mine.length) return fail(res, 403, "no_workspace", "You're not in a workspace yet."), null;
    const binding = req.workspaceContext?.workspace.id;
    const wanted = req.get("x-workspace") || req.query.workspace || binding;
    if (binding && wanted !== binding) return fail(res, 409, "workspace_mismatch", "This tab belongs to a different workspace."), null;
    const ws = (wanted && mine.find((w) => w.id === wanted)) || (!binding && mine[0]);
    if (!ws) return fail(res, 403, "workspace_required", "Choose a workspace to continue."), null;
    if (wanted && ws.id !== wanted) return fail(res, 404, "not_found", "No such workspace."), null;
    const member = ws.members.find((m) => m.userKey === u.key);
    return { user: u, key: u.key, ws, member, mine, role: member.role };
  }
  // Guards by workspace role; suspended workspaces read only (spec 06: suspended → no changes).
  const ROLE_RANK = { guest: 0, member: 1, admin: 2, owner: 3 };
  const as = (min, { write = false } = {}) => Object.assign((req, res, next) => {
    const p = person(req, res);
    if (!p) return;
    if (ROLE_RANK[p.role] < ROLE_RANK[min]) return fail(res, 403, "forbidden", min === "owner" ? "Only the workspace owner can do this." : "Ask a workspace admin to do this.", { required: `role:${min}` });
    if (write && p.ws.state === "suspended") return fail(res, 423, "suspended", "This workspace is suspended. Contact support.");
    req.p = p;
    next();
  }, { role: min, write }); // read by orgtik-program/phase-e/openapi.mjs
  const dec = (cur) => db.currencies[cur]?.decimals ?? 2;
  const money = (n, cur) => S.pricing.toDecimals(n, dec(cur));
  const nameOf = (m) => (m.userKey ? identity.fullName(identity.findByKey(m.userKey)) : m.name);
  const emailOf = (m) => (m.userKey ? identity.findByKey(m.userKey)?.email : m.email);
  const taxFor = ws => S.taxForWorkspace(ws);
  const availablePlan = (p, ws) => p.status !== "archived" && ((!p.private && p.visibility !== "private") || p.workspaceId === ws.id);
  const live = (l) => l.state !== "deleted" && l.state !== "ended";

  // ---- USR-00 shell: who am I, which workspace, which tools, which banner ----
  app.get("/v1/app/me", as("guest"), (req, res) => {
    const { user, ws, member, mine } = req.p;
    const tools = db.tools.slice().sort((a, b) => a.order - b.order).map((t) => {
      const state = toolState(S, ws, t, member);
      if (!state) return null;
      const l = ws.lines.find((x) => x.tool === t.key && live(x));
      return { key: t.key, name: t.name, short: t.short, icon: t.icon, status: t.status, mandatory: Boolean(t.mandatory), state, scope: t.scope, line: l ? { id: l.id, planId: l.planId, state: l.state, trialEndsAt: l.trialEndsAt ?? null } : null };
    }).filter(Boolean);
    const all = banners(S, ws, member);
    ok(res, {
      user: { key: user.key, id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email },
      workspaceContext: req.workspaceContext || null,
      workspace: { id: ws.id, name: ws.name, slug: ws.slug, country: ws.country, currency: ws.currency, state: ws.state, role: member.role, retentionDays: db.settings.retention.workspaceDays },
      workspaces: mine.map((w) => ({ id: w.id, name: w.name, role: w.members.find((m) => m.userKey === user.key).role, state: w.state })),
      tools,
      banner: all[0] ?? null, // D-026: one at a time, by priority
      banners: all,
      unread: db.notifications.filter((n) => n.workspaceId === ws.id && n.userKey === user.key && !n.read).length,
      can: { billing: member.role === "owner", team: ROLE_RANK[member.role] >= 2, buy: member.role === "owner" },
    });
  });

  // ---- USR-04 tools catalogue and USR-05 plans for one tool (prices from the resolver) ----
  const priced = (p, ws, cycle) => {
    if (p.tier === "free") return { amount: 0, unit: 0, currency: ws.currency, source: "Free", quantity: 1 };
    const r = S.resolveForWorkspace(p.id, ws, cycle);
    return r ? { amount: r.amount, unit: r.unit, currency: r.currency, source: r.source, quantity: r.quantity } : null;
  };
  app.get("/v1/app/tools", as("guest"), (req, res) => {
    const { ws, member } = req.p;
    ok(res, db.tools.filter((t) => t.status !== "retired").sort((a, b) => a.order - b.order).map((t) => {
      const plans = db.plans.filter(p => p.tool === t.key && availablePlan(p, ws));
      const from = plans.filter((p) => p.tier !== "free").map((p) => priced(p, ws, "monthly")).filter(Boolean).sort((a, b) => a.unit - b.unit)[0] ?? null;
      return { key: t.key, name: t.name, short: t.short, icon: t.icon, status: t.status, mandatory: Boolean(t.mandatory), state: toolState(S, ws, t, member), hasFree: plans.some((p) => p.tier === "free"), trialDays: Math.max(0, ...plans.map((p) => p.trialDays ?? 0)), fromUnit: from ? { amount: from.unit, currency: from.currency, perUser: plans.find((p) => priced(p, ws, "monthly")?.unit === from.unit)?.perUser ?? false } : null, onWaitlist: db.waitlist.some((w) => w.tool === t.key && w.workspaceId === ws.id) };
    }));
  });
  app.get("/v1/app/tools/:key", as("guest"), (req, res) => {
    const { ws, member } = req.p;
    const t = db.tools.find((x) => x.key === req.params.key && x.status !== "retired");
    if (!t) return fail(res, 404, "not_found", "No such tool.");
    const l = ws.lines.find((x) => x.tool === t.key && live(x));
    const usedTrial = ws.lines.some((x) => x.tool === t.key && x.trialUsed) || Boolean(l?.trialEndsAt);
    const tax = S.taxForWorkspace(ws);
    ok(res, {
      key: t.key, name: t.name, short: t.short, icon: t.icon, status: t.status, mandatory: Boolean(t.mandatory), state: toolState(S, ws, t, member),
      line: l ?? null,
      plans: db.plans.filter(p => p.tool === t.key && availablePlan(p, ws)).map((p) => ({
        id: p.id, name: p.name, tier: p.tier, perUser: p.perUser, minSeats: p.minSeats, trialDays: usedTrial ? 0 : p.trialDays ?? 0, recommended: Boolean(p.recommended),
        contractedQuantity: p.contractedQuantity ?? null, workspacePrivate: Boolean(p.private || p.visibility === "private"),
        limits: Object.entries(p.limits ?? {}).map(([k, v]) => ({ key: k, value: v, unit: db.features.find((f) => f.key === k)?.unit ?? null })),
        flags: Object.entries(p.flags ?? {}).filter(([, v]) => v).map(([k]) => k),
        monthly: priced(p, ws, "monthly"), yearly: p.tier === "free" ? null : priced(p, ws, "yearly"), yearlyDiscountPct: p.yearlyDiscountPct ?? 0,
        current: l?.planId === p.id,
      })),
      seats: S.purchasedSeats(ws, t.key, l?.planId),
      seatModel: db.settings.switches.seatModel.value, // G-04
      taxDisplay: tax.inclusive ? "inclusive" : "exclusive", taxInclusive: tax.inclusive, taxRate: tax.rate, reverseCharge: tax.reverseCharge,
    });
  });
  app.post("/v1/app/tools/:key/waitlist", as("member"), (req, res) => {
    const { ws, user } = req.p;
    const t = db.tools.find((x) => x.key === req.params.key);
    if (!t || t.status !== "coming_soon") return fail(res, 409, "wrong_state", "Only a tool that's coming soon has a waitlist.");
    if (!db.waitlist.some((w) => w.tool === t.key && w.workspaceId === ws.id)) db.waitlist.push({ id: S.id("wl"), tool: t.key, workspaceId: ws.id, workspace: ws.name, email: user.email, at: S.iso(S.now()), country: ws.country, notified: false });
    ok(res, { tool: t.key, onWaitlist: true }, {}, 201);
  });

  // ---- USR-06 start a trial (F-02); USR-07/08 checkout (preview → confirm) ----
  app.post("/v1/app/tools/:key/trial", as("owner", { write: true }), (req, res) => {
    const { ws } = req.p;
    const p = db.plans.find((x) => x.id === req.body?.planId && x.tool === req.params.key);
    if (!p || !(p.trialDays > 0)) return fail(res, 422, "invalid", "This plan has no trial.", { fieldErrors: { planId: "no_trial" } });
    const existing = ws.lines.find((l) => l.tool === p.tool && live(l));
    // G-17: one trial per tool per workspace.
    if (ws.lines.some((l) => l.tool === p.tool && (l.trialUsed || l.trialEndsAt))) return fail(res, 409, "trial_used", "This workspace already had a trial of this tool.");
    if (existing && existing.state !== "free") return fail(res, 409, "wrong_state", "You already have this tool.");
    const r = S.resolveForWorkspace(p.id, ws, "monthly");
    const end = S.iso(S.now() + p.trialDays * DAY);
    const line = { id: S.id("ln"), tool: p.tool, planId: p.id, cycle: "monthly", state: "trialing", trialEndsAt: end, periodEnd: end, startedAt: S.iso(S.now()), trialUsed: true, snapshot: { amount: r.amount, unit: r.unit, quantity: r.quantity, currency: r.currency, source: r.source, priceVersion: db.priceVersion } };
    if (existing) Object.assign(existing, { state: "ended", endedAt: S.iso(S.now()), replacedBy: line.id });
    // In front of the tool's older lines: toolState reads a tool's first line, which must be the live one.
    const at = ws.lines.findIndex((x) => x.tool === p.tool);
    ws.lines.splice(at < 0 ? ws.lines.length : at, 0, line);
    S.log(req.p.key, "trial_start", ws.id, { plan: p.id });
    ok(res, line, {}, 201);
  });

  function quote(ws, items, { coupon, bundleId, intent } = {}) {
    const cur = ws.currency;
    const lines = [];
    if (ws.billingCredit > 0 && ws.billingCreditCurrency && ws.billingCreditCurrency !== cur) return { error: ["currency", "credit_migration_required"] };
    if (!Array.isArray(items) || !items.length) return { error: ["items", "required"] };
    const selectedTools = new Set();
    for (const it of items) {
      const p = db.plans.find((x) => x.id === it.planId);
      if (!p || !availablePlan(p, ws) || !p.tool || ["coming_soon", "retired"].includes(db.tools.find(t => t.key === p.tool)?.status)) return { error: ["planId", "unknown"] };
      if (selectedTools.has(p.tool)) return { error: ["items", "duplicate_tool"] };
      selectedTools.add(p.tool);
      const cycle = it.cycle ?? "monthly";
      if (!["monthly", "yearly"].includes(cycle) || p.private?.cycle && p.private.cycle !== cycle) return { error: ["cycle", "invalid"] };
      let quantity = S.purchasedSeats(ws, p.tool, p.id);
      if (it.intent === "seat_purchase" || intent === "seat_purchase") {
        if (!p.perUser || !Number.isSafeInteger(it.quantity) || it.quantity < Math.max(p.minSeats ?? 1, S.assignedSeats(ws, p.tool, p.id) + S.reservedSeats(ws, p.tool))) return { error: ["quantity", "invalid"] };
        quantity = it.quantity;
      }
      // Legacy browser seats never change paid capacity; quantity requires the explicit intent.
      const r = S.resolveForWorkspace(p.id, ws, cycle, quantity);
      if (!r) return { error: ["planId", "no_price"] };
      if (!Number.isSafeInteger(Math.round(r.amount * 10 ** dec(cur)))) return { error: ["quantity", "invalid"] };
      if (r.currency !== cur) return { error: ["currency", "mismatch"] }; // R03-C3: one currency per workspace
      const current = ws.lines.find((l) => l.tool === p.tool && (l.state === "active" || l.state === "cancelling"));
      // Proration (R03-ALG-8, G-01): an upgrade mid-period pays the remaining share now.
      const proration = S.pricing.proration(current, cycle, S.now(), dec(cur));
      lines.push({ planId: p.id, tool: p.tool, name: p.name, cycle, unit: r.unit, quantity: r.quantity, amount: r.amount, source: r.source, prorationFactor: proration.factor, credit: proration.credit, replaces: current?.id ?? null, periodEnd: proration.periodEnd, periodStart: proration.periodStart, contractedCapacity: p.contractedQuantity ?? null });
    }
    const covers = b => b.planIds.every(id => lines.some(l => l.planId === id) || ws.lines.some(x => x.planId === id && ["active", "cancelling"].includes(x.state) && !lines.some(selection => selection.tool === x.tool)));
    const bundle = bundleId ? db.bundles.find(b => b.id === bundleId && b.active) : db.bundles.find(b => b.active && covers(b) && b.planIds.some(id => lines.some(l => l.planId === id)));
    if (bundleId && (!bundle || !covers(bundle) || lines.some(l => !bundle.planIds.includes(l.planId)))) return { error: ["bundleId", "invalid"] };
    let c = null, couponError = null;
    if (coupon) {
      c = db.coupons.find((x) => x.code === String(coupon).toUpperCase());
      // Used up says more than "inactive" (a used-up code is switched off too, e.g. SUMMER10).
      if (!c) couponError = "coupon_invalid";
      else if (c.redeemed >= c.maxRedemptions) couponError = "coupon_used_up";
      else if (!c.active) couponError = "coupon_invalid";
      else if (Date.parse(c.validFrom) > S.now()) couponError = "coupon_not_started";
      else if (Date.parse(c.validTo) < S.now()) couponError = "coupon_expired";
      else if (c.appliesTo !== "all" && !lines.some((l) => l.planId === c.appliesTo)) couponError = "coupon_not_applicable";
      if (couponError) c = null;
    }
    const rule = taxFor(ws);
    const t = S.pricing.totals({ lines: lines.map(l => ({ ...l, bundleEligible: Boolean(bundle?.planIds.includes(l.planId)), couponEligible: c?.appliesTo === "all" || c?.appliesTo === l.planId })), currency: cur, decimals: dec(cur), bundlePct: bundle?.pct ?? 0, coupon: c, tax: rule });
    // Keep unused switch credit in the workspace currency instead of discarding a negative due.
    const accountCreditUsed = Math.min(ws.billingCredit ?? 0, t.prorated);
    if (accountCreditUsed > 0) {
      const charged = S.pricing.totals({ lines: [{ amount: money(t.prorated - accountCreditUsed, cur) }], currency: cur, decimals: dec(cur), tax: rule });
      Object.assign(t, { prorated: charged.prorated, net: charged.net, tax: charged.tax, total: charged.total });
    }
    t.accountCreditUsed = accountCreditUsed;
    if (![t.total, t.net, t.tax, t.creditRemaining].every(value => Number.isSafeInteger(Math.round(value * 10 ** dec(cur))))) return { error: ["items", "invalid_amount"] };
    lines.forEach((line, i) => { line.periodAmount = t.lineAmounts[i].discounted; });
    return { ...t, currency: cur, lines, bundle: bundle ? { id: bundle.id, name: bundle.name, pct: bundle.pct } : null, coupon: c ? { code: c.code, kind: c.kind } : null, couponError: couponError ?? t.couponError ?? null, taxLabel: rule.label, taxRate: rule.rate, taxDisplay: rule.inclusive ? "inclusive" : "exclusive", reverseCharge: rule.reverseCharge, taxDecided: db.settings.switches.taxDisplay.decided };
  }
  const quoteInputs = body => ({ items: body.items ?? [], coupon: body.coupon ? String(body.coupon).toUpperCase() : null, bundleId: body.bundleId ?? null, intent: body.intent ?? null });
  const quoteFingerprint = (p, body) => makeWorkspaceOperation({ id: "subscription-quote", workspaceId: p.ws.id, actor: { userId: p.user.id }, method: "POST", path: "/v1/app/checkout", body: quoteInputs(body) }).fingerprint;
  const quoteContext = ws => JSON.stringify({ currency: ws.currency, country: ws.country, state: ws.state, billingCountry: ws.billing.country, taxId: ws.billing.taxId, credit: ws.billingCredit ?? 0, creditCurrency: ws.billingCreditCurrency, members: ws.members.map(m => [m.userKey, m.email, m.role, m.status, m.tools]), lines: ws.lines.filter(l => ["active", "cancelling", "past_due", "read_only"].includes(l.state)).map(l => [l.id, l.planId, l.state, l.periodStart, l.periodEnd, l.snapshot]) });
  app.post("/v1/app/checkout/preview", as("owner"), (req, res) => {
    const { ws } = req.p;
    const items = req.body?.items ?? [];
    if (!Array.isArray(items) || !items.length) return fail(res, 422, "invalid", "Choose at least one plan.", { fieldErrors: { items: "required" } });
    const q = quote(ws, items, req.body);
    if (q.error) return fail(res, 422, "invalid", "That plan can't be bought here.", { fieldErrors: { [q.error[0]]: q.error[1] } });
    const boundary = Math.min(S.now() + 15 * 60000, ...q.lines.filter(l => l.replaces).map(l => Date.parse(ws.lines.find(old => old.id === l.replaces)?.periodEnd)).filter(end => end > S.now()));
    const priced = { ...q, priceVersion: db.priceVersion, quoteId: S.id("cq"), expiresAt: S.iso(boundary), expiresIn: Math.max(0, Math.floor((boundary - S.now()) / 1000)) };
    db.checkoutQuotes ??= [];
    db.checkoutQuotes.push({ id: priced.quoteId, workspaceId: ws.id, actorId: req.p.user.id, fingerprint: quoteFingerprint(req.p, req.body), context: quoteContext(ws), snapshot: JSON.parse(JSON.stringify(priced)), consumed: false });
    ok(res, { ...priced, paymentMethods: ws.paymentMethods.filter((m) => !m.expired), gateways: S.routeGateways(ws).map(({ id, name, methods, recurring }) => ({ id, name, methods, recurring })) });
  });
  app.post("/v1/app/checkout/confirm", as("owner", { write: true }), (req, res) => {
    const { ws } = req.p;
    const b = req.body ?? {};
    const operationId = req.get("idempotency-key");
    if (operationId && !/^[\w.:-]{1,200}$/.test(operationId)) return fail(res, 422, "invalid", "Use a valid payment attempt ID.");
    // The role/read-only guards run first. A prior receipt never grants a removed member
    // permission, and a repeated confirmed payment retains its original monetary result.
    const operation = operationId ? makeWorkspaceOperation({ id: operationId, workspaceId: ws.id, actor: { userId: req.p.user.id }, method: req.method, path: req.path, body: b }) : null;
    const prior = operation && db.checkoutOperations?.find(row => row.id === operation.id && row.workspaceId === ws.id && row.actor.userId === req.p.user.id);
    if (prior) return prior.fingerprint === operation.fingerprint ? ok(res, prior.result, {}, 201) : fail(res, 409, "operation_conflict", "This payment attempt was already used for a different checkout.");
    const held = b.quoteId ? db.checkoutQuotes?.find(row => row.id === b.quoteId) : null;
    if (b.quoteId && !held) return fail(res, 404, "quote_not_found", "Review a new checkout quote.");
    if (held && (held.workspaceId !== ws.id || held.actorId !== req.p.user.id)) return fail(res, 403, "forbidden", "This checkout quote belongs to another workspace or owner.");
    if (held?.consumed) return fail(res, 409, "quote_used", "This quote already has a successful payment.");
    if (held && Date.parse(held.snapshot.expiresAt) <= S.now()) return fail(res, 410, "quote_expired", "Review the total again before paying.");
    if (held && (held.fingerprint !== quoteFingerprint(req.p, b) || held.context !== quoteContext(ws) || b.billing?.taxId !== undefined && b.billing.taxId !== ws.billing.taxId || held.snapshot.lines.some(l => !db.plans.some(p => p.id === l.planId && availablePlan(p, ws))))) return fail(res, 409, "checkout_changed", "Your billing context changed. Review a new total before paying.");
    const q = held ? JSON.parse(JSON.stringify(held.snapshot)) : quote(b.billing ? { ...ws, billing: { ...ws.billing, ...b.billing, country: ws.billing?.country || ws.country } } : ws, b.items ?? [], b);
    if (held && q.coupon) {
      const coupon = db.coupons.find(row => row.code === q.coupon.code);
      if (!coupon?.active || coupon.redeemed >= coupon.maxRedemptions || Date.parse(coupon.validTo) < S.now()) return fail(res, 409, "checkout_changed", "The discount is no longer available. Review a new total.");
    }
    if (q.error || !(b.items ?? []).length) return fail(res, 422, "invalid", "That plan can't be bought here.", { fieldErrors: { items: "required" } });
    if (b.coupon && q.couponError) return fail(res, 422, "invalid", "That code doesn't work.", { fieldErrors: { coupon: q.couponError } });
    const pm = ws.paymentMethods.find((m) => m.id === b.paymentMethodId && !m.expired);
    if (!pm) return fail(res, 422, "invalid", "Choose a payment method.", { fieldErrors: { paymentMethodId: "required" } });
    if (!ws.billing?.legalName?.trim() && !b.billing?.legalName?.trim()) return fail(res, 422, "invalid", "Add the billing name first.", { fieldErrors: { "billing.legalName": "required" } });
    // Payment, simulated: mock controls can make the next one fail (see /v1/__mock/fail-next-payment).
    const failed = S.failNext > 0 ? (S.failNext--, true) : pm.last4 === "0002";
    // A declined payment leaves nothing behind (USR-08): no invoice, no line, no coupon used.
    if (failed) return fail(res, 402, "payment_failed", "The payment didn't go through. Nothing changed; try another card.", { reason: "card_declined" });
    const gateway = S.routeGateways(ws, { method: pm.kind })[0];
    if (!gateway) return fail(res, 409, "no_gateway", "No configured payment gateway supports this workspace currency.");
    if (!S.usdRate(q.currency)) return fail(res, 503, "payment_rate_unavailable", "The USD reporting rate is unavailable. Nothing was charged.");
    if (b.billing) ws.billing = { ...ws.billing, ...b.billing, country: ws.billing?.country || ws.country };
    const inv = invoiceFrom(ws, q, "paid", { ...pm, gateway: gateway.id });
    const periodDays = (c) => (c === "yearly" ? 365 : 30);
    const created = [];
    for (const l of q.lines) {
      const old = l.replaces ? ws.lines.find((x) => x.id === l.replaces) : ws.lines.find((x) => x.tool === l.tool && live(x));
      if (old) Object.assign(old, { state: "ended", endedAt: S.iso(S.now()), replacedBy: "pending" });
      const nl = { id: S.id("ln"), tool: l.tool, planId: l.planId, cycle: l.cycle, state: "active", startedAt: S.iso(S.now()), periodStart: l.periodStart ?? S.iso(S.now()), periodEnd: l.periodEnd ?? S.iso(S.now() + periodDays(l.cycle) * DAY), snapshot: { amount: l.amount, unit: l.unit, quantity: l.quantity, periodAmount: l.periodAmount, currency: q.currency, source: l.source, priceVersion: q.priceVersion ?? db.priceVersion }, trialUsed: Boolean(old?.trialUsed || old?.trialEndsAt), autoRenew: old?.autoRenew !== false };
      if (old) old.replacedBy = nl.id;
      const at = ws.lines.findIndex((x) => x.tool === l.tool); // in front of the tool's older lines (toolState reads the first)
      ws.lines.splice(at < 0 ? ws.lines.length : at, 0, nl);
      created.push(nl);
      for (const invoiceLine of inv.lines) if (invoiceLine.planId === l.planId) invoiceLine.lineId = nl.id;
      const custom = db.customPlanRequests.find(r => r.workspaceId === ws.id && r.privatePlanIds?.includes(l.planId));
      if (custom) { custom.lineIds ??= []; if (!custom.lineIds.includes(nl.id)) custom.lineIds.push(nl.id); }
    }
    if (q.coupon) db.coupons.find((c) => c.code === q.coupon.code).redeemed += 1;
    ws.billingCredit = money((ws.billingCredit ?? 0) - q.accountCreditUsed + q.creditRemaining, q.currency);
    ws.billingCreditCurrency = q.currency;
    ws.currencyLocked = true; // R03-C2: the first payment locks the currency
    if (held) { held.consumed = true; held.invoiceId = inv.id; }
    S.log(req.p.key, "checkout", ws.id, { invoice: inv.number });
    const result = { invoice: { id: inv.id, number: inv.number, total: inv.total, currency: inv.currency }, lines: created };
    if (operation) { db.checkoutOperations ??= []; db.checkoutOperations.push({ ...operation, result: JSON.parse(JSON.stringify(result)) }); }
    ok(res, result, {}, 201);
  });
  function invoiceFrom(ws, q, state, pm) {
    const r = S.usdRate(q.currency);
    if (!r) throw Object.assign(new Error("The USD reporting rate is unavailable; no invoice was created."), { status: 503, code: "payment_rate_unavailable" });
    const n = S.allocateInvoiceNumber?.() ?? 1040 + db.invoices.length + 1;
    const invoiceLines = [];
    q.lines.forEach((l, i) => {
      const label = `${l.name?.en ?? l.planId}${l.contractedCapacity ? ` · capacity ${l.contractedCapacity}` : l.quantity > 1 ? ` × ${l.quantity}` : ""}`;
      const factor = l.prorationFactor ?? 1;
      const charge = money(l.amount * factor, q.currency);
      invoiceLines.push({ label, amount: charge, planId: l.planId, kind: "charge", credit: l.credit ?? 0, prorationFactor: factor });
      const details = q.lineAmounts?.[i];
      if (details) {
        const discount = money(charge - money(details.discounted * factor, q.currency), q.currency);
        const bundle = Math.min(discount, money(details.bundleDiscount * factor, q.currency));
        if (bundle) invoiceLines.push({ label: "Bundle", kind: "bundle_discount", planId: l.planId, amount: -bundle });
        if (discount - bundle) invoiceLines.push({ label: q.coupon?.code ?? "Coupon", kind: "coupon_discount", planId: l.planId, amount: -money(discount - bundle, q.currency) });
      }
      if (l.credit) invoiceLines.push({ label: "Unused period credit", kind: "period_credit", planId: l.planId, amount: -l.credit });
    });
    if (q.creditRemaining) invoiceLines.push({ label: "Unused credit carried forward", kind: "credit_carried", amount: q.creditRemaining });
    if (q.accountCreditUsed) invoiceLines.push({ label: "Workspace credit applied", kind: "account_credit", amount: -q.accountCreditUsed });
    if (q.taxDisplay === "inclusive" && q.taxRate > 0) for (const line of invoiceLines) line.amount = money(line.amount / (1 + q.taxRate / 100), q.currency);
    const subtotal = q.net ?? q.subtotal;
    const rounding = money(subtotal - invoiceLines.reduce((sum, line) => sum + line.amount, 0), q.currency);
    if (rounding) { const last = invoiceLines.filter(line => line.kind === "charge").at(-1); last.amount = money(last.amount + rounding, q.currency); last.roundingAdjustment = rounding; }
    const inv = { id: S.id("inv"), number: `INV-2026-${String(n).padStart(6, "0")}`, workspaceId: ws.id, kind: "subscription", state, currency: q.currency, issuedAt: S.iso(S.now()), dueAt: S.iso(S.now()), lines: invoiceLines, subtotal, quotedSubtotal: q.subtotal, bundleDiscount: q.bundleDiscount, couponDiscount: q.couponDiscount, taxLabel: q.taxLabel, taxDisplay: q.taxDisplay, taxRate: q.taxRate ?? 0, reverseCharge: Boolean(q.reverseCharge), tax: q.tax, total: q.total, creditRemaining: q.creditRemaining ?? 0, accountCreditUsed: q.accountCreditUsed ?? 0, payments: [{ id: S.id("pay"), amount: q.total, currency: q.currency, method: pm.kind, gateway: pm.gateway, at: S.iso(S.now()), status: state === "paid" ? "succeeded" : "failed", usdRate: r, usdAmount: money(q.total / r, "USD") }], creditNotes: [], refunded: 0 };
    if (state === "paid") inv.paidAt = S.iso(S.now());
    db.invoices.push(inv);
    return inv;
  }

  // ---- USR-09 subscriptions: change plan, cycle, seats; cancel; resume; cancel a scheduled downgrade ----
  const lineOut = (ws, l) => ({ ...l, tool: l.tool, toolName: db.tools.find((t) => t.key === l.tool)?.name, planName: db.plans.find((p) => p.id === l.planId)?.name, tier: db.plans.find((p) => p.id === l.planId)?.tier, perUser: db.plans.find((p) => p.id === l.planId)?.perUser ?? false });
  app.get("/v1/app/subscriptions", as("admin"), (req, res) => {
    const { ws } = req.p;
    const lines = ws.lines.filter((l) => l.state !== "deleted" && !(l.state === "ended" && l.replacedBy));
    const monthly = lines.filter((l) => ["active", "cancelling", "past_due"].includes(l.state)).reduce((s, l) => s + S.pricing.monthlyAmount(l), 0);
    ok(res, { currency: ws.currency, currencyLocked: ws.currencyLocked, seats: S.seats(ws), monthlyTotal: money(monthly, ws.currency), lines: lines.map((l) => lineOut(ws, l)) });
  });
  app.post("/v1/app/subscriptions/:id/:action(cancel|resume|downgrade|cancel-downgrade|retry)", as("owner", { write: true }), (req, res) => {
    const { ws } = req.p;
    const l = ws.lines.find((x) => x.id === req.params.id);
    if (!l) return fail(res, 404, "not_found", "No such subscription.");
    const a = req.params.action;
    if (db.tools.find((t) => t.key === l.tool)?.mandatory && a === "cancel") return fail(res, 409, "mandatory", "General can't be cancelled; it's the workspace itself.");
    if (a === "cancel") {
      if (l.state === "trialing") Object.assign(l, { state: "ended", endedAt: S.iso(S.now()) });
      else if (l.state === "active") Object.assign(l, { state: "cancelling", cancelAt: l.periodEnd, cancelReason: req.body?.reason ?? null });
      else return fail(res, 409, "wrong_state", "Only an active subscription or a trial can be cancelled.");
    } else if (a === "resume") {
      if (l.state !== "cancelling") return fail(res, 409, "wrong_state", "Only a cancelled subscription that hasn't ended can resume.");
      Object.assign(l, { state: "active", cancelAt: null });
    } else if (a === "downgrade") {
      const p = db.plans.find((x) => x.id === req.body?.planId && x.tool === l.tool);
      const nextPrice = p && availablePlan(p, ws) && S.resolveForWorkspace(p.id, ws, l.cycle, l.snapshot.quantity);
      if (!nextPrice || l.state !== "active" || nextPrice.amount >= l.snapshot.amount) return fail(res, 422, "invalid", "Choose a lower plan of the same tool.", { fieldErrors: { planId: "required" } });
      // Downgrades wait for the period's end (no refunds mid-period, spec 06 F-07).
      if (l.scheduled?.kind === "price_change") l.scheduledPrice = l.scheduled;
      l.scheduled = { kind: "downgrade", planId: p.id, effectiveAt: l.periodEnd, overLimits: overLimits(S, ws, p) };
    } else if (a === "cancel-downgrade") {
      if (l.scheduled?.kind !== "downgrade") return fail(res, 409, "wrong_state", "Nothing scheduled.");
      delete l.scheduled;
    } else if (a === "retry") {
      if (l.state !== "past_due" && l.state !== "read_only") return fail(res, 409, "wrong_state", "This subscription isn't waiting for a payment.");
      const inv = db.invoices.find((i) => i.workspaceId === ws.id && i.state === "past_due" && i.lines.some((x) => x.lineId === l.id)) ?? db.invoices.find((i) => i.workspaceId === ws.id && i.state === "past_due");
      const pm = ws.paymentMethods.find((m) => m.id === req.body?.paymentMethodId && !m.expired) ?? ws.paymentMethods.find((m) => m.isDefault && !m.expired);
      if (!pm) return fail(res, 422, "invalid", "Add a working card first.", { fieldErrors: { paymentMethodId: "required" } });
      const failed = S.failNext > 0 ? (S.failNext--, true) : pm.last4 === "0002";
      if (inv) inv.payments.push({ id: S.id("pay"), amount: inv.total, currency: inv.currency, method: pm.kind, gateway: pm.gateway, at: S.iso(S.now()), status: failed ? "failed" : "succeeded", usdRate: S.usdRate(inv.currency), usdAmount: money(inv.total / S.usdRate(inv.currency), "USD") });
      if (failed) return fail(res, 402, "payment_failed", "The payment didn't go through. Try another card.");
      if (inv) Object.assign(inv, { state: "paid", paidAt: S.iso(S.now()) });
      Object.assign(l, { state: "active", graceEndsAt: null, readOnlySince: null, lastFailure: null, periodEnd: S.iso(S.now() + 30 * DAY) });
      if (ws.state === "past_due" && !ws.lines.some((x) => x.state === "past_due" || x.state === "read_only")) ws.state = "active";
    }
    S.log(req.p.key, `line_${a}`, ws.id, { line: l.id });
    ok(res, lineOut(ws, l));
  });

  // ---- USR-10 invoices; USR-11 payment methods; USR-12 billing details ----
  app.get("/v1/app/invoices", as("owner"), (req, res) => page(req, res, db.invoices.filter((i) => i.workspaceId === req.p.ws.id && i.state !== "draft").sort((a, b) => String(b.issuedAt).localeCompare(String(a.issuedAt))).map(({ id, number, state, total, currency, issuedAt, dueAt, paidAt, refunded }) => ({ id, number, state, total, currency, issuedAt, dueAt, paidAt, refunded }))));
  app.get("/v1/app/invoices/:id", as("owner"), (req, res) => {
    const i = db.invoices.find((x) => x.id === req.params.id && x.workspaceId === req.p.ws.id && x.state !== "draft");
    if (!i) return fail(res, 404, "not_found", "No such invoice.");
    ok(res, { ...i, seller: { name: db.settings.company.legalName }, buyer: req.p.ws.billing });
  });
  app.get("/v1/app/payment-methods", as("owner"), (req, res) => ok(res, req.p.ws.paymentMethods));
  app.post("/v1/app/payment-methods", as("owner", { write: true }), (req, res) => {
    const { ws } = req.p;
    const b = req.body ?? {};
    // The real card form is the gateway's (hosted fields); the mock takes a test card's last 4 and expiry.
    const e = {};
    if (!/^\d{4}$/.test(b.last4 ?? "")) e.last4 = "invalid";
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(b.expires ?? "")) e.expires = "invalid";
    else { const [mm, yy] = b.expires.split("/").map(Number); if (new Date(2000 + yy, mm, 1).getTime() <= S.now()) e.expires = "expired"; }
    if (Object.keys(e).length) return fail(res, 422, "invalid", "Check the card details.", { fieldErrors: e });
    const gw = S.routeGateways(ws, { method: b.kind ?? "card", recurring: true })[0];
    if (!gw) return fail(res, 409, "no_gateway", "No configured payment gateway supports this workspace currency.");
    const pm = { id: S.id("pm"), kind: b.kind ?? "card", brand: b.brand ?? "Visa", last4: b.last4, expires: b.expires, country: ws.country, gateway: gw.id, isDefault: !ws.paymentMethods.some((m) => m.isDefault && !m.expired) };
    if (b.makeDefault) for (const m of ws.paymentMethods) m.isDefault = false, pm.isDefault = true;
    ws.paymentMethods.push(pm);
    ok(res, pm, {}, 201);
  });
  app.patch("/v1/app/payment-methods/:id", as("owner", { write: true }), (req, res) => {
    const pm = req.p.ws.paymentMethods.find((m) => m.id === req.params.id);
    if (!pm) return fail(res, 404, "not_found", "No such payment method.");
    if (req.body?.isDefault) { if (pm.expired) return fail(res, 409, "expired", "An expired card can't be the default."); for (const m of req.p.ws.paymentMethods) m.isDefault = m.id === pm.id; }
    ok(res, pm);
  });
  app.delete("/v1/app/payment-methods/:id", as("owner", { write: true }), (req, res) => {
    const { ws } = req.p;
    const pm = ws.paymentMethods.find((m) => m.id === req.params.id);
    if (!pm) return fail(res, 404, "not_found", "No such payment method.");
    const renewing = ws.lines.some((l) => ["active", "past_due"].includes(l.state) && l.snapshot.amount > 0);
    if (pm.isDefault && renewing && ws.paymentMethods.filter((m) => !m.expired).length === 1) return fail(res, 409, "last_method", "Add another card before removing the one your renewals use.");
    ws.paymentMethods = ws.paymentMethods.filter((m) => m.id !== pm.id);
    if (pm.isDefault) { const next = ws.paymentMethods.find((m) => !m.expired); if (next) next.isDefault = true; }
    res.status(204).end();
  });
  app.get("/v1/app/billing", as("owner"), (req, res) => ok(res, { ...req.p.ws.billing, currency: req.p.ws.currency, currencyLocked: req.p.ws.currencyLocked, tax: taxFor(req.p.ws), migration: db.migrations.find((m) => m.workspaceId === req.p.ws.id && m.state === "queued") ?? null }));
  app.put("/v1/app/billing", as("owner", { write: true }), (req, res) => {
    const { ws } = req.p;
    const b = req.body ?? {};
    const e = {};
    if (!b.legalName?.trim()) e.legalName = "required";
    if (!/^\S+@\S+\.\S+$/.test(b.email ?? "")) e.email = "invalid";
    if (b.country && !db.countries[b.country]) e.country = "invalid";
    if (Object.keys(e).length) return fail(res, 422, "invalid", "Some fields need attention.", { fieldErrors: e });
    // R03-C4: once the currency is locked, a new billing country goes to support as a migration.
    if (b.country && b.country !== ws.billing.country && ws.currencyLocked) {
      if (!db.migrations.some((m) => m.workspaceId === ws.id && m.state === "queued")) db.migrations.push({ id: S.id("mig"), workspaceId: ws.id, from: { country: ws.country, currency: ws.currency }, to: { country: b.country, currency: db.countries[b.country].currency }, requestedAt: S.iso(S.now()), state: "queued", requestedBy: req.p.key, reason: "Billing country changed by the owner" });
      ws.billing = { ...ws.billing, ...b, country: ws.billing.country };
      return ok(res, { ...ws.billing, migrationQueued: true });
    }
    if (b.country && !ws.currencyLocked) { ws.country = b.country; ws.currency = db.countries[b.country].currency; ws.zone = S.pricing.zoneOf(db, b.country)?.id; }
    ws.billing = { ...ws.billing, ...b };
    ok(res, { ...ws.billing, currency: ws.currency });
  });

  // ---- USR-13/14 team and seats (G-04 seat model as a switch) ----
  app.get("/v1/app/team", as("member"), (req, res) => {
    const { ws } = req.p;
    ok(res, ws.members.filter((m) => m.status !== "removed").map((m) => ({ id: m.userKey ?? m.email, userKey: m.userKey, name: nameOf(m), email: emailOf(m), role: m.role, status: m.status, tools: m.tools, joinedAt: m.joinedAt })), { seats: S.seats(ws), seatModel: db.settings.switches.seatModel.value, perUserLines: ws.lines.filter((l) => live(l) && db.plans.find((p) => p.id === l.planId)?.perUser).map((l) => ({ id: l.id, tool: l.tool, unit: l.snapshot.unit, currency: l.snapshot.currency, cycle: l.cycle })) });
  });
  app.post("/v1/app/team/invite", as("admin", { write: true }), (req, res) => {
    const { ws } = req.p;
    const b = req.body ?? {};
    const e = {};
    if (!/^\S+@\S+\.\S+$/.test(b.email ?? "")) e.email = "invalid";
    if (ws.members.some((m) => (emailOf(m) ?? "").toLowerCase() === String(b.email).toLowerCase() && m.status !== "removed")) e.email = "taken";
    if (!["admin", "member", "guest"].includes(b.role)) e.role = "required";
    if (b.role === "admin" && req.p.role !== "owner") e.role = "owner_only";
    if (Object.keys(e).length) return fail(res, 422, "invalid", "Some fields need attention.", { fieldErrors: e });
    const m = { userKey: identity.findByEmail(b.email)?.key ?? null, email: b.email, name: b.name ?? b.email.split("@")[0], role: b.role, status: "invited", tools: b.tools ?? null, joinedAt: null, invitedAt: S.iso(S.now()) };
    ws.members.push(m);
    // Seat cost shows before accepting (USR-14): per-user lines grow by one seat when the invite is accepted.
    ok(res, { id: m.email, ...m, seatsAfter: S.seats(ws) + (b.role === "guest" ? 0 : 1) }, {}, 201);
  });
  app.patch("/v1/app/team/:id", as("admin", { write: true }), (req, res) => {
    const { ws } = req.p;
    const m = ws.members.find((x) => (x.userKey ?? x.email) === req.params.id);
    if (!m) return fail(res, 404, "not_found", "No such member.");
    if (m.role === "owner") return fail(res, 409, "owner", "The owner's role changes only by transferring ownership.");
    const b = req.body ?? {};
    if (b.role === "admin" && req.p.role !== "owner") return fail(res, 403, "forbidden", "Only the owner makes admins.", { required: "role:owner" });
    if (b.role) m.role = b.role;
    if (b.tools !== undefined) m.tools = b.tools;
    if (b.status === "removed") m.status = "removed";
    ok(res, m);
  });

  // Only the immutable server-confirmed payment can provision this workspace.
  app.post("/v1/app/website-orders", as("admin", { write: true }), (req, res) => {
    try {
      const result = linkWebsiteOrder(S, { workspace: req.p.ws, actor: { key: req.p.key, readOnly: Boolean(identity.decode(identity.tokenFrom(req))?.readOnly) } }, req.body);
      ok(res, result, {}, 201);
    } catch (error) {
      if (!error.status) throw error;
      fail(res, error.status, error.code, error.message);
    }
  });

  // ---- USR-16..20 services: catalogue, request, quote accept/decline, delivery approve/revise ----
  app.get("/v1/app/services", as("member"), (req, res) => {
    const { ws } = req.p;
    const subscriber = ws.lines.some((l) => ["active", "cancelling"].includes(l.state) && l.snapshot.amount > 0);
    ok(res, db.services.filter((s) => s.status === "active").map((s) => {
      const r = s.kind === "package" ? S.resolveForWorkspace(s.id, ws, s.billing, 1) : null;
      return { id: s.id, family: s.family, kind: s.kind, billing: s.billing, name: s.name, deliveryDays: s.deliveryDays, price: r ? { amount: r.amount, currency: r.currency } : null, subscriberDiscountPct: subscriber ? s.subscriberDiscountPct : 0 };
    }));
  });
  const srOut = (r) => ({ ...require('../../lib/service-delivery-files').projectRequest(r), service: db.services.find((s) => s.id === r.serviceId)?.name, messages: r.messages.filter((m) => !m.internal) });
  app.get("/v1/app/service-requests", as("member"), (req, res) => page(req, res, db.serviceRequests.filter((r) => r.workspaceId === req.p.ws.id).map(srOut)));
  app.get("/v1/app/service-requests/:id", as("member"), (req, res) => {
    const r = db.serviceRequests.find((x) => x.id === req.params.id && x.workspaceId === req.p.ws.id);
    if (!r) return fail(res, 404, "not_found", "No such request.");
    ok(res, srOut(r));
  });
  app.post("/v1/app/service-requests", as("admin", { write: true }), (req, res) => {
    const b = req.body ?? {};
    const s = db.services.find((x) => x.id === b.serviceId && x.status === "active");
    const e = {};
    if (!s) e.serviceId = "required";
    if (!b.title?.trim()) e.title = "required";
    if (!b.brief?.trim() || b.brief.trim().length < 20) e.brief = "too_short";
    if (Object.keys(e).length) return fail(res, 422, "invalid", "Some fields need attention.", { fieldErrors: e });
    const r = { id: S.id("sr"), number: `SR-${210 + db.serviceRequests.length + 1}`, workspaceId: req.p.ws.id, serviceId: s.id, title: b.title.trim(), brief: b.brief.trim(), budget: b.budget ?? null, deadline: b.deadline ?? null, state: "new", createdAt: S.iso(S.now()), assignee: null, quote: null, milestones: [], deliveries: [], messages: [] };
    db.serviceRequests.push(r);
    ok(res, srOut(r), {}, 201);
  });
  app.post("/v1/app/service-requests/:id/actions", as("member", { write: true }), (req, res) => {
    const r = db.serviceRequests.find((x) => x.id === req.params.id && x.workspaceId === req.p.ws.id);
    if (!r) return fail(res, 404, "not_found", "No such request.");
    const b = req.body ?? {};
    const owner = req.p.role === "owner";
    switch (b.action) {
      case "accept":
        if (!owner) return fail(res, 403, "forbidden", "Only the owner accepts quotes (they're payments).", { required: "role:owner" });
        if (r.state !== "quoted") return fail(res, 409, "wrong_state", "There's no quote to accept.");
        if (Date.parse(r.quote.validUntil) < S.now()) { r.state = "expired"; return fail(res, 409, "expired", "This quote has expired. Ask for a new one."); }
        r.state = "awaiting_payment"; r.acceptedAt = S.iso(S.now()); break;
      case "pay": {
        if (!owner) return fail(res, 403, "forbidden", "Only the owner pays.", { required: "role:owner" });
        if (r.state !== "awaiting_payment") return fail(res, 409, "wrong_state", "Nothing to pay yet.");
        const pm = req.p.ws.paymentMethods.find((m) => m.isDefault && !m.expired);
        if (!pm) return fail(res, 422, "invalid", "Add a working card first.", { fieldErrors: { paymentMethodId: "required" } });
        const failed = S.failNext > 0 ? (S.failNext--, true) : false;
        if (failed) return fail(res, 402, "payment_failed", "The payment didn't go through. Try another card.");
        const q = { currency: r.quote.currency, lines: r.quote.lines.map((l) => ({ name: { en: l.label }, amount: l.amount, quantity: 1, credit: 0 })), subtotal: r.quote.total, bundleDiscount: 0, couponDiscount: 0, taxLabel: null, tax: 0, total: r.quote.total };
        const inv = invoiceFrom(req.p.ws, q, "paid", pm);
        inv.kind = "service";
        r.invoiceId = inv.id; r.state = "in_progress"; break;
      }
      case "decline":
        if (!owner) return fail(res, 403, "forbidden", "Only the owner declines quotes.", { required: "role:owner" });
        if (r.state !== "quoted") return fail(res, 409, "wrong_state", "There's no quote to decline.");
        r.state = "rejected"; r.declineReason = b.reason ?? null; break;
      case "approve":
        if (r.state !== "in_review") return fail(res, 409, "wrong_state", "Nothing delivered to approve.");
        r.state = "completed"; r.completedAt = S.iso(S.now()); break;
      case "revise":
        if (r.state !== "in_review") return fail(res, 409, "wrong_state", "Nothing delivered to revise.");
        if (!b.text?.trim()) return fail(res, 422, "invalid", "Say what needs to change.", { fieldErrors: { text: "required" } });
        r.messages.push({ by: "customer", author: req.p.key, at: S.iso(S.now()), text: b.text.trim() });
        r.state = "in_progress"; break;
      case "message":
        if (!b.text?.trim()) return fail(res, 422, "invalid", "Write the message.", { fieldErrors: { text: "required" } });
        r.messages.push({ by: "customer", author: req.p.key, at: S.iso(S.now()), text: b.text.trim() }); break;
      case "cancel":
        if (!["new", "under_review", "quoted"].includes(r.state)) return fail(res, 409, "wrong_state", "Work has started; talk to us to stop it.");
        r.state = "cancelled"; break;
      default: return fail(res, 422, "invalid", "Unknown action.", { fieldErrors: { action: "required" } });
    }
    ok(res, srOut(r));
  });

  // ---- USR-21..23 support tickets ----
  const tkOut = (t) => ({ ...t, messages: t.messages.filter((m) => !m.internal).map((m) => ({ ...m, authorName: m.by === "staff" ? "OrgTik support" : identity.findByKey(m.author) ? identity.fullName(identity.findByKey(m.author)) : m.author })) });
  app.get("/v1/app/tickets", as("member"), (req, res) => page(req, res, db.tickets.filter((t) => t.workspaceId === req.p.ws.id && (ROLE_RANK[req.p.role] >= 2 || t.openedBy === req.p.key)).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).map(tkOut)));
  app.get("/v1/app/tickets/:id", as("member"), (req, res) => {
    const t = db.tickets.find((x) => x.id === req.params.id && x.workspaceId === req.p.ws.id);
    if (!t) return fail(res, 404, "not_found", "No such ticket.");
    ok(res, tkOut(t));
  });
  app.post("/v1/app/tickets", as("member"), (req, res) => {
    const b = req.body ?? {};
    const e = {};
    if (!b.subject?.trim()) e.subject = "required";
    if (!b.text?.trim()) e.text = "required";
    if (!["billing", "product", "sales", "technical", "other"].includes(b.category)) e.category = "required";
    if (Object.keys(e).length) return fail(res, 422, "invalid", "Some fields need attention.", { fieldErrors: e });
    const t = { id: S.id("tk"), number: `TK-${3300 + db.tickets.length + 1}`, workspaceId: req.p.ws.id, openedBy: req.p.key, subject: b.subject.trim(), category: b.category, priority: "normal", state: "open", assignee: null, createdAt: S.iso(S.now()), updatedAt: S.iso(S.now()), messages: [{ by: "customer", author: req.p.key, at: S.iso(S.now()), text: b.text.trim() }] };
    db.tickets.push(t);
    ok(res, tkOut(t), {}, 201);
  });
  app.post("/v1/app/tickets/:id/actions", as("member"), (req, res) => {
    const t = db.tickets.find((x) => x.id === req.params.id && x.workspaceId === req.p.ws.id);
    if (!t) return fail(res, 404, "not_found", "No such ticket.");
    const b = req.body ?? {};
    if (b.action === "reply") {
      if (t.state === "closed") return fail(res, 409, "closed", "This ticket is closed. Open a new one.");
      if (!b.text?.trim()) return fail(res, 422, "invalid", "Write the reply.", { fieldErrors: { text: "required" } });
      t.messages.push({ by: "customer", author: req.p.key, at: S.iso(S.now()), text: b.text.trim() });
      if (t.state === "waiting_for_you" || t.state === "resolved") t.state = "open"; // a reply reopens
    } else if (b.action === "resolve") t.state = "resolved", t.resolvedAt = S.iso(S.now()), t.reopenUntil = S.iso(S.now() + 7 * DAY);
    else return fail(res, 422, "invalid", "Unknown action.", { fieldErrors: { action: "required" } });
    t.updatedAt = S.iso(S.now());
    ok(res, tkOut(t));
  });

  // ---- USR-24 notifications; USR-25 custom plan request ----
  app.get("/v1/app/notifications", as("guest"), (req, res) => page(req, res, db.notifications.filter((n) => n.workspaceId === req.p.ws.id && n.userKey === req.p.key).sort((a, b) => String(b.at).localeCompare(String(a.at)))));
  app.post("/v1/app/notifications/read", as("guest"), (req, res) => {
    const ids = req.body?.ids;
    for (const n of db.notifications) if (n.workspaceId === req.p.ws.id && n.userKey === req.p.key && (!ids || ids.includes(n.id))) n.read = true;
    ok(res, { ok: true });
  });
  app.get("/v1/app/custom-plans", as("owner"), (req, res) => ok(res, db.customPlanRequests.filter((r) => r.workspaceId === req.p.ws.id)));
  app.post("/v1/app/custom-plans", as("owner", { write: true }), (req, res) => {
    const b = req.body ?? {};
    const e = {};
    if (!Array.isArray(b.tools) || !b.tools.length || b.tools.some((t) => !db.tools.some((x) => x.key === t))) e.tools = "required";
    if (!(Number.isSafeInteger(b.seats) && b.seats >= 1)) e.seats = "min";
    if (Object.keys(e).length) return fail(res, 422, "invalid", "Some fields need attention.", { fieldErrors: e });
    const r = { id: S.id("cpr"), workspaceId: req.p.ws.id, tools: b.tools, seats: b.seats, cycle: b.cycle === "monthly" ? "monthly" : "yearly", notes: b.notes ?? "", state: "new", createdAt: S.iso(S.now()) };
    db.customPlanRequests.push(r);
    ok(res, r, {}, 201);
  });
  app.post("/v1/app/custom-plans/:id/accept", as("owner", { write: true }), (req, res) => {
    const r = db.customPlanRequests.find((x) => x.id === req.params.id && x.workspaceId === req.p.ws.id);
    if (r?.state === "accepted") return ok(res, r);
    if (!r || r.state !== "quoted") return fail(res, 409, "wrong_state", "There's no quote to accept.");
    if (!Number.isFinite(Date.parse(r.quote.validUntil)) || Date.parse(r.quote.validUntil) <= S.now()) return fail(res, 409, "expired", "This quote has expired.");
    const ws = req.p.ws;
    if (r.quote.currency !== ws.currency) return fail(res, 409, "currency_mismatch", "Request a new quote in the workspace billing currency.");
    const allocations = r.quote.lines ?? (r.tools.length === 1 ? [{ tool: r.tools[0], amount: r.quote.amount }] : null);
    if (!allocations || allocations.length !== r.tools.length || new Set(allocations.map(l => l.tool)).size !== r.tools.length || allocations.some(l => !r.tools.includes(l.tool) || !Number.isFinite(l.amount) || l.amount < 0) || money(allocations.reduce((n, l) => n + l.amount, 0), ws.currency) !== money(r.quote.amount, ws.currency)) return fail(res, 422, "allocation_required", "Staff must allocate the total explicitly to every tool before acceptance.");
    r.privatePlanIds = allocations.map(allocation => {
      const planId = `private_${r.id}_${allocation.tool}`;
      if (!db.plans.some(p => p.id === planId)) {
        const base = db.plans.find(p => p.tool === allocation.tool && p.tier === "pro") ?? db.plans.find(p => p.tool === allocation.tool);
        db.plans.push({ ...JSON.parse(JSON.stringify(base ?? {})), id: planId, tool: allocation.tool, tier: "custom", name: { en: "Custom", ar: "مخصص", de: "Individuell", fr: "Personnalisé", it: "Personalizzato" }, visibility: "private", status: "active", workspaceId: ws.id, perUser: false, contractedQuantity: r.seats, minSeats: 1, trialDays: 0, private: { amount: allocation.amount, currency: ws.currency, cycle: r.cycle }, customRequestId: r.id });
      }
      return planId;
    });
    // Acceptance exposes the private plans for normal checkout (F-12); no unpaid active line.
    r.lineIds = [];
    r.state = "accepted"; r.acceptedAt = S.iso(S.now());
    ok(res, r);
  });

  // ---- USR-26/27 workspace settings and deletion ----
  app.patch("/v1/app/workspace", as("owner", { write: true }), (req, res) => {
    const { ws } = req.p;
    const b = req.body ?? {};
    if (b.name !== undefined && !String(b.name).trim()) return fail(res, 422, "invalid", "The workspace needs a name.", { fieldErrors: { name: "required" } });
    if (b.name) ws.name = String(b.name).trim();
    ok(res, { id: ws.id, name: ws.name });
  });
  app.post("/v1/app/workspace/delete", as("owner", { write: true }), (req, res) => {
    const { ws } = req.p;
    if (req.body?.confirm !== ws.name) return fail(res, 422, "invalid", "Type the workspace name to confirm.", { fieldErrors: { confirm: "mismatch" } });
    if (db.invoices.some((i) => i.workspaceId === ws.id && ["open", "past_due"].includes(i.state))) return fail(res, 409, "unpaid", "Pay or settle the open invoices first.");
    // Retention (G-22): cancelled now, data kept for the setting's days, then deleted.
    ws.state = "cancelled"; ws.cancelledAt = S.iso(S.now()); ws.deleteAt = S.iso(S.now() + db.settings.retention.workspaceDays * DAY);
    for (const l of ws.lines) if (["active", "trialing", "free"].includes(l.state)) Object.assign(l, l.state === "active" ? { state: "cancelling", cancelAt: l.periodEnd } : { state: "ended", endedAt: S.iso(S.now()) });
    S.log(req.p.key, "workspace_delete", ws.id);
    ok(res, { state: ws.state, deleteAt: ws.deleteAt });
  });
};
