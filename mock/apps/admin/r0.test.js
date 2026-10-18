// R0 regressions call the registered Express endpoints; no inline imitation of publish/checkout.
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { once } = require("node:events");
const express = require("express");
const { dispatch } = require("../../lib/dispatch");
const { makeStore } = require("./store");
const adminApi = require("./admin-api");
const appApi = require("./app-api");
const DAY = 86400000;

async function withApi(run) {
  const users = ["admin", "finance", "customer", "u8", "u7"].map(key => ({ key, id: key, firstName: key, lastName: "Fixture", email: `${key}@orgtik.test` }));
  const identity = { users, findByKey: key => users.find(u => u.key === key), findByEmail: email => users.find(u => u.email === email), fullName: u => u ? `${u.firstName} ${u.lastName}` : "", userFromReq: req => users.find(u => u.key === (req.get("x-test-user") || "admin")) };
  const S = makeStore({ identity });
  let now = Date.parse("2026-10-07T09:00:00.000Z");
  S.now = () => now;
  const app = express(); app.use(express.json());
  const H = {
    ok: (res, data, meta = {}, status = 200) => res.status(status).json({ data, meta }),
    fail: (res, status, code, message, extra = {}) => res.status(status).json({ error: { code, message, ...extra } }),
    page: (req, res, data) => res.json({ data, meta: { total: data.length } }),
  };
  adminApi(app, { identity }, S, H); appApi(app, { identity }, S, H);
  const server = app.listen(0, "127.0.0.1"); await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, url, body, { workspace, user = "admin", attemptId } = {}) => {
    const response = await dispatch(base, "admin", { method, url, headers: { "content-type": "application/json", "x-test-user": user, ...(workspace ? { "x-workspace": workspace } : {}), ...(attemptId ? { "idempotency-key": attemptId } : {}) }, body: body === undefined ? undefined : Buffer.from(JSON.stringify(body)) });
    return { status: response.statusCode, ...JSON.parse(response.rawPayload.toString()) };
  };
  const own = ws => { if (!ws.members.some(m => m.userKey === "admin")) ws.members.push({ userKey: "admin", role: "owner", status: "active", tools: null }); return ws; };
  const publish = async (key, to, applyMode, effectiveAt) => {
    const draft = await call("POST", "/v1/admin/price-drafts", { changes: [{ key, to }] });
    assert.equal(draft.status, 200);
    return call("POST", `/v1/admin/price-drafts/${draft.data.id}/publish`, { applyMode, effectiveAt, reason: "R0 regression" });
  };
  try { await run({ S, call, own, publish, now: () => now, setNow: t => { now = t; } }); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test("publish endpoint keeps a future price inactive until its exact effective instant", () => withApi(async ({ S, call, publish, now, setNow }) => {
  const future = now() + DAY;
  const result = await publish("chat_pro:monthly:gcc", 50, "new_only", S.iso(future));
  assert.equal(result.status, 200);
  assert.equal(S.db.grid["chat_pro:monthly:gcc"], 45);
  assert.equal(S.db.priceVersion, 1, "A future publication does not change the active quote version");
  assert.equal((await call("GET", "/v1/admin/price-preview?planId=chat_pro&country=SA")).data[0].unit, 45);
  setNow(future - 1); await call("GET", "/v1/admin/grid"); assert.equal(S.db.grid["chat_pro:monthly:gcc"], 45);
  setNow(future); await call("GET", "/v1/admin/grid"); assert.equal(S.db.grid["chat_pro:monthly:gcc"], 50);
  assert.equal(S.db.priceVersion, result.data.priceVersion);
  await call("GET", "/v1/admin/grid");
  assert.equal(S.db.audit.filter(a => a.action === "price_effective" && a.target === result.data.id).length, 1);
}));

test("actual publish preserves GCC grandfathering during a Europe-only decrease", () => withApi(async ({ S, call, publish }) => {
  const gulf = S.workspace("ws_gulf"); const chat = gulf.lines.find(l => l.planId === "chat_pro");
  const spree = S.workspace("ws_spree");
  spree.lines.push({ ...chat, id: "europe_chat", snapshot: { ...chat.snapshot, amount: 11, unit: 11, currency: "EUR" } });
  assert.equal((await publish("chat_pro:monthly:gcc", 50, "new_only")).status, 200);
  assert.equal(chat.snapshot.amount, 44);
  assert.equal((await publish("chat_pro:monthly:europe", 10, "existing_now")).status, 200);
  assert.equal(chat.snapshot.amount, 44);
  assert.equal(spree.lines.find(l => l.id === "europe_chat").snapshot.amount, 10);
  const stored = await call("GET", "/v1/admin/workspaces/ws_gulf");
  assert.equal(stored.status, 200); assert.equal(stored.data.lines.find(l => l.planId === "chat_pro").snapshot.amount, 44);
}));

test("new yearly cell and a decrease that increases a grandfathered line both need notice", () => withApi(async ({ S, publish }) => {
  assert.equal((await publish("chat_pro:yearly:gcc", 500, "existing_now")).status, 422);
  S.db.priceDrafts = [];
  await publish("chat_pro:monthly:gcc", 50, "new_only");
  const rejected = await publish("chat_pro:monthly:gcc", 48, "existing_now");
  assert.equal(rejected.status, 422);
  assert.equal(rejected.error.fieldErrors.applyMode, "increase_needs_notice");
}));

test("price notice is persisted once and waits for the first renewal outside its window", () => withApi(async ({ S, call, publish, own, now, setNow }) => {
  const ws = own(S.workspace("ws_gulf")); const line = ws.lines.find(l => l.planId === "chat_pro");
  line.periodEnd = S.iso(now() + 10 * DAY);
  const result = await publish("chat_pro:monthly:gcc", 50, "existing_next_renewal");
  assert.equal(result.status, 200);
  assert.equal(line.scheduled.effectiveAt, S.iso(now() + 40 * DAY));
  const count = () => S.db.notifications.filter(n => n.eventKey === `price:${result.data.id}:${line.id}`).length;
  assert.equal(count(), 1); assert.equal(S.db.mailbox.filter(m => m.eventKey === `price:${result.data.id}:${line.id}`).length, 1);
  const start = now(); setNow(start + 30 * DAY); await call("GET", "/v1/admin/grid"); assert.equal(line.snapshot.amount, 44);
  setNow(start + 40 * DAY); await call("GET", "/v1/admin/grid"); assert.equal(line.snapshot.amount, 49);
  await call("GET", "/v1/admin/grid"); assert.equal(count(), 1);
}));

test("ordinary checkout uses stored per-tool quantity; explicit capacity is validated", () => withApi(async ({ S, call }) => {
  const ws = S.workspace("ws_orgtik"); const line = ws.lines.find(l => l.tool === "tasks");
  line.snapshot.quantity = 7; line.snapshot.amount = line.snapshot.unit * 7;
  const preview = await call("POST", "/v1/app/checkout/preview", { items: [{ planId: "tasks_pro", cycle: "monthly", seats: 999 }] });
  assert.equal(preview.status, 200); assert.equal(preview.data.lines[0].quantity, 7);
  const item = { planId: "tasks_pro", cycle: "monthly", intent: "seat_purchase", quantity: 8 };
  assert.equal((await call("POST", "/v1/app/checkout/preview", { items: [item] })).data.lines[0].quantity, 8);
  for (const quantity of [1, 7.5, -3, 0]) assert.equal((await call("POST", "/v1/app/checkout/preview", { items: [{ ...item, quantity }] })).status, 422);
  ws.members.push({ email: "reserved@test.example", status: "invited", role: "member", tools: ["tasks"] });
  assert.equal((await call("POST", "/v1/app/checkout/preview", { items: [{ ...item, quantity: 4 }] })).status, 422);
  assert.equal((await call("POST", "/v1/app/checkout/preview", { items: [{ ...item, quantity: 1e100 }] })).status, 422);
}));

test("bundles and plan-specific coupons discount only eligible lines", () => withApi(async ({ S, call }) => {
  const ws = S.workspace("ws_orgtik"); ws.lines = ws.lines.filter(l => l.tool === "general");
  S.db.coupons.push({ code: "CHAT10", kind: "percent", value: 10, appliesTo: "chat_pro", active: true, maxRedemptions: 10, redeemed: 0, validFrom: S.iso(S.now() - DAY), validTo: S.iso(S.now() + DAY) });
  const items = ["tasks_pro", "files_pro", "hr_pro", "chat_pro"].map(planId => ({ planId, cycle: "monthly" }));
  assert.equal((await call("POST", "/v1/app/checkout/preview", { items, bundleId: "bnd_ops" })).status, 422);
  assert.equal((await call("POST", "/v1/app/checkout/preview", { items, bundleId: "missing" })).status, 422);
  const q = (await call("POST", "/v1/app/checkout/preview", { items, coupon: "CHAT10" })).data;
  const eligible = q.lines.filter(l => ["tasks_pro", "files_pro", "hr_pro"].includes(l.planId));
  assert.equal(q.bundleDiscount, S.pricing.toDecimals(eligible.reduce((n, l) => n + l.amount, 0) * 0.15, 2));
  assert.equal(q.couponDiscount, S.pricing.toDecimals(q.lines.find(l => l.planId === "chat_pro").amount * 0.1, 2));
}));

test("checkout discounts then prorates and credits, preserving same-cycle billing end", () => withApi(async ({ S, call, now }) => {
  S.db.bundles = [];
  const ws = S.workspace("ws_orgtik"); ws.members = ws.members.filter(m => m.userKey === "admin");
  const line = ws.lines.find(l => l.tool === "tasks");
  line.snapshot = { ...line.snapshot, amount: 100, unit: 50, quantity: 2 }; line.periodStart = S.iso(now() - 15 * DAY); line.periodEnd = S.iso(now() + 15 * DAY);
  const body = { items: [{ planId: "tasks_pro", cycle: "monthly" }], coupon: "LAUNCH20", paymentMethodId: ws.paymentMethods[0].id };
  const q = (await call("POST", "/v1/app/checkout/preview", body)).data;
  assert.deepEqual([q.subtotal, q.couponDiscount, q.lines[0].credit, q.prorated, q.total], [258, 51.6, 50, 53.2, 60.65]);
  const paid = await call("POST", "/v1/app/checkout/confirm", body);
  assert.equal(paid.status, 201); assert.equal(paid.data.invoice.total, q.total);
  assert.equal(paid.data.lines[0].periodEnd, line.periodEnd);
  const payment = S.db.invoices.find(i => i.id === paid.data.invoice.id).payments[0];
  assert.equal(payment.usdRate, S.usdRate("EGP")); assert.equal(payment.usdAmount, S.pricing.toDecimals(q.total / payment.usdRate, 2));
  const invoice = (await call("GET", `/v1/app/invoices/${paid.data.invoice.id}`)).data;
  assert.equal(invoice.subtotal, q.net); assert.equal(S.pricing.toDecimals(invoice.lines.reduce((sum, l) => sum + l.amount, 0) + invoice.tax, 2), q.total);
  assert.ok(invoice.lines.some(l => l.kind === "period_credit" && l.amount === -50));
  assert.equal(invoice.lines.find(l => l.kind === "charge").lineId, paid.data.lines[0].id);
}));

test("cycle switch credits the unused old period instead of silently ending it", () => withApi(async ({ S, call, now }) => {
  S.db.bundles = [];
  const ws = S.workspace("ws_orgtik"); ws.members = ws.members.filter(m => m.userKey === "admin");
  const line = ws.lines.find(l => l.tool === "tasks");
  line.snapshot = { ...line.snapshot, amount: 100, unit: 50, quantity: 2 }; line.periodStart = S.iso(now() - 15 * DAY); line.periodEnd = S.iso(now() + 15 * DAY);
  const q = (await call("POST", "/v1/app/checkout/preview", { items: [{ planId: "tasks_pro", cycle: "yearly" }] })).data;
  assert.equal(q.lines[0].credit, 50); assert.equal(q.lines[0].prorationFactor, 1); assert.equal(q.prorated, q.subtotal - 50);
}));

test("a switch preserves surplus credit and a later checkout consumes it once", () => withApi(async ({ S, call, now }) => {
  S.db.bundles = [];
  const ws = S.workspace("ws_orgtik"); ws.members = ws.members.filter(m => m.userKey === "admin"); ws.lines = ws.lines.filter(l => ["general", "tasks"].includes(l.tool));
  const line = ws.lines.find(l => l.tool === "tasks");
  line.cycle = "yearly"; line.snapshot = { ...line.snapshot, amount: 1200, quantity: 2, periodAmount: 1200 };
  line.periodStart = S.iso(now() - 182.5 * DAY); line.periodEnd = S.iso(now() + 182.5 * DAY);
  const body = { items: [{ planId: "tasks_pro", cycle: "monthly" }], paymentMethodId: ws.paymentMethods[0].id };
  const q = (await call("POST", "/v1/app/checkout/preview", body)).data;
  assert.equal(q.lines[0].credit, 600); assert.equal(q.total, 0); assert.equal(q.creditRemaining, 342);
  assert.equal((await call("POST", "/v1/app/checkout/confirm", body)).status, 201); assert.equal(ws.billingCredit, 342);
  const next = { items: [{ planId: "files_pro", cycle: "monthly" }], paymentMethodId: ws.paymentMethods[0].id };
  const nextQuote = (await call("POST", "/v1/app/checkout/preview", next)).data;
  assert.equal(nextQuote.accountCreditUsed, 99); assert.equal(nextQuote.total, 0);
  assert.equal((await call("POST", "/v1/app/checkout/confirm", next)).status, 201); assert.equal(ws.billingCredit, 243);
}));

test("regional tax handles GCC inclusive, EU mock reverse charge and CH exclusive default", () => withApi(async ({ S, call, own }) => {
  for (const [id, expected] of [["ws_quill", { inclusive: true, reverse: false }], ["ws_spree", { inclusive: false, reverse: true }]]) {
    const ws = own(S.workspace(id)); ws.lines = ws.lines.filter(l => l.tool === "general");
    const q = (await call("POST", "/v1/app/checkout/preview", { items: [{ planId: "chat_pro", cycle: "monthly" }] }, { workspace: ws.id })).data;
    assert.equal(q.taxDisplay, expected.inclusive ? "inclusive" : "exclusive"); assert.equal(q.reverseCharge, expected.reverse);
    if (expected.reverse) assert.equal(q.tax, 0); else {
      assert.equal(q.total, q.subtotal); assert.ok(q.tax > 0);
      const pm = await call("POST", "/v1/app/payment-methods", { last4: "4242", expires: "12/30" }, { workspace: ws.id });
      const paid = await call("POST", "/v1/app/checkout/confirm", { items: [{ planId: "chat_pro", cycle: "monthly" }], paymentMethodId: pm.data.id, billing: { legalName: "Quill Fixture" } }, { workspace: ws.id });
      assert.equal(paid.status, 201);
      const invoice = S.db.invoices.find(i => i.id === paid.data.invoice.id);
      assert.equal(invoice.subtotal, q.net); assert.equal(invoice.total, q.total);
      assert.equal(S.pricing.toDecimals(invoice.lines.reduce((sum, l) => sum + l.amount, 0) + invoice.tax, 2), q.total);
    }
  }
  const ws = S.createWorkspace({ ownerKey: "admin", name: "Swiss Fixture", email: "swiss@test.example", country: "CH", currency: "CHF" });
  const q = (await call("POST", "/v1/app/checkout/preview", { items: [{ planId: "chat_pro", cycle: "monthly" }] }, { workspace: ws.id })).data;
  assert.equal(q.currency, "CHF"); assert.equal(q.taxDisplay, "exclusive"); assert.equal(q.tax, 0);
  const spree = S.workspace("ws_spree"); spree.billing.taxIdValid = false;
  assert.equal(S.taxForWorkspace(spree).rate, 19);
}));

test("currency lock converts a country price into the workspace currency", () => withApi(async ({ S, call }) => {
  const ws = S.workspace("ws_orgtik"); ws.currency = "CHF"; ws.lines = ws.lines.filter(l => l.tool === "general");
  const q = await call("POST", "/v1/app/checkout/preview", { items: [{ planId: "chat_pro", cycle: "monthly" }] });
  assert.equal(q.status, 200); assert.equal(q.data.currency, "CHF"); assert.equal(q.data.lines[0].quantity, 1);
}));

test("KWD routes to Tap/HyperPay and never invents a Stripe fallback", () => withApi(async ({ S, call, own }) => {
  const ws = own(S.workspace("ws_quill")); ws.country = ws.billing.country = "KW"; ws.currency = "KWD";
  const routes = (await call("GET", "/v1/admin/gateways/route?country=KW&currency=KWD")).data;
  assert.deepEqual(routes.map(g => g.id), ["gw_tap", "gw_hyperpay"]);
  assert.deepEqual(S.routeGateways(ws, { method: "knet", recurring: true }), [], "KNET remains one-off/pay-link only");
  const card = await call("POST", "/v1/app/payment-methods", { last4: "4242", expires: "12/30" }, { workspace: ws.id });
  assert.equal(card.status, 201); assert.equal(card.data.gateway, "gw_tap");
  for (const g of S.db.gateways) if (["gw_tap", "gw_hyperpay"].includes(g.id)) g.active = false;
  assert.equal((await call("POST", "/v1/app/payment-methods", { last4: "4242", expires: "12/30" }, { workspace: ws.id })).status, 409);
}));

test("custom acceptance exposes scoped full-term private plans; only paid checkout activates them", () => withApi(async ({ S, call }) => {
  const ws = S.workspace("ws_orgtik"); const old = ws.lines.find(l => l.tool === "hr"); old.state = "ended";
  const before = ws.lines.length;
  const accepted = await call("POST", "/v1/app/custom-plans/cpr_2/accept", {});
  assert.equal(accepted.status, 200); assert.equal(ws.lines.length, before);
  const planId = accepted.data.privatePlanIds[0];
  assert.equal((await call("POST", "/v1/app/custom-plans/cpr_2/accept", {})).data.privatePlanIds[0], planId);
  assert.equal(S.db.plans.filter(p => p.id === planId).length, 1);
  const detail = (await call("GET", "/v1/app/tools/hr")).data;
  assert.ok(detail.plans.some(p => p.id === planId));
  const body = { items: [{ planId, cycle: "yearly" }], paymentMethodId: ws.paymentMethods[0].id };
  const q = (await call("POST", "/v1/app/checkout/preview", body)).data;
  assert.equal(q.subtotal, 21000); assert.equal(q.lines[0].quantity, 120);
  assert.equal((await call("POST", "/v1/app/checkout/preview", body, { user: "customer", workspace: "ws_nile" })).status, 422);
  const otherPlans = (await call("GET", "/v1/app/tools/hr", undefined, { user: "customer", workspace: "ws_nile" })).data.plans;
  assert.ok(!otherPlans.some(p => p.id === planId));
  S.failNext = 1; const invoices = S.db.invoices.length;
  assert.equal((await call("POST", "/v1/app/checkout/confirm", body)).status, 402);
  assert.equal(S.db.invoices.length, invoices); assert.equal(ws.lines.length, before);
  const paid = await call("POST", "/v1/app/checkout/confirm", body);
  assert.equal(paid.status, 201); assert.equal(paid.data.invoice.total, q.total);
  assert.equal(paid.data.lines[0].state, "active"); assert.equal(paid.data.lines[0].snapshot.amount, 21000); assert.equal(paid.data.lines[0].snapshot.quantity, 120);
  const savedQuote = JSON.stringify(S.db.customPlanRequests.find(r => r.id === "cpr_2").quote);
  assert.equal((await call("POST", "/v1/admin/custom-plans/cpr_2/quote", { amount: 1 })).status, 409);
  assert.equal(JSON.stringify(S.db.customPlanRequests.find(r => r.id === "cpr_2").quote), savedQuote, "Accepted contract history stays immutable");
}));

test("multi-tool custom quote requires explicit allocations with an exact rounded sum", () => withApi(async ({ S, call, own }) => {
  own(S.workspace("ws_gulf"));
  for (const lines of [undefined, [{ tool: "crm", amount: 300 }], [{ tool: "crm", amount: 100 }, { tool: "crm", amount: 100 }, { tool: "chat", amount: 100 }], [{ tool: "crm", amount: 100 }, { tool: "marketing", amount: 100 }, { tool: "chat", amount: 99 }]]) assert.equal((await call("POST", "/v1/admin/custom-plans/cpr_1/quote", { amount: 300, lines })).status, 422);
  const lines = ["crm", "marketing", "chat"].map(tool => ({ tool, amount: 100 }));
  assert.equal((await call("POST", "/v1/admin/custom-plans/cpr_1/quote", { amount: 300.01, lines: lines.map(l => ({ ...l, amount: 100.004 })) })).status, 422);
  assert.equal((await call("POST", "/v1/admin/custom-plans/cpr_1/quote", { amount: 300, lines })).status, 200);
  const accepted = await call("POST", "/v1/app/custom-plans/cpr_1/accept", {}, { workspace: "ws_gulf" });
  assert.equal(accepted.status, 200); assert.equal(accepted.data.privatePlanIds.length, 3);
  assert.equal(accepted.data.privatePlanIds.reduce((n, id) => n + S.db.plans.find(p => p.id === id).private.amount, 0), 300);
}));

test("downgrade applies at period end, lists recorded over-limit data and never deletes it", () => withApi(async ({ S, call, now, setNow }) => {
  const ws = S.workspace("ws_orgtik"); const line = ws.lines.find(l => l.tool === "tasks");
  ws.usage = { "tasks.projects": 12 }; line.periodEnd = S.iso(now() + DAY);
  const scheduled = await call("POST", `/v1/app/subscriptions/${line.id}/downgrade`, { planId: "tasks_free" });
  assert.equal(scheduled.status, 200); assert.equal(scheduled.data.scheduled.overLimits[0].excess, 9);
  setNow(now() + DAY); await call("GET", "/v1/app/subscriptions");
  assert.equal(line.planId, "tasks_free"); assert.equal(line.state, "free"); assert.equal(line.snapshot.amount, 0); assert.equal(ws.usage["tasks.projects"], 12);
  await call("GET", "/v1/app/subscriptions");
  assert.equal(S.db.audit.filter(a => a.action === "downgrade_applied" && a.line === line.id).length, 1);
}));

test("Service Team reads only assigned requests; broader combined roles retain authorized access", () => withApi(async ({ S, call }) => {
  const listed = await call("GET", "/v1/admin/service-requests", undefined, { user: "u8" });
  assert.equal(listed.status, 200); assert.ok(listed.data.length > 0); assert.ok(listed.data.every(r => r.assignee === "u8"));
  const foreign = S.db.serviceRequests.find(r => r.assignee === "u7");
  assert.equal((await call("GET", `/v1/admin/service-requests/${foreign.id}`, undefined, { user: "u8" })).status, 404);
  S.db.staffRoles.u8.push("service_mgr");
  assert.equal((await call("GET", `/v1/admin/service-requests/${foreign.id}`, undefined, { user: "u8" })).status, 200);
}));

test("confirmed subscription retry returns one paid invoice and never bypasses a revoked owner role", () => withApi(async ({ S, call, own }) => {
  const ws = own(S.workspace("ws_gulf"));
  const opts = { workspace: ws.id, attemptId: "one-confirmed-payment" };
  const body = { items: [{ planId: "tasks_pro", cycle: "monthly" }], paymentMethodId: ws.paymentMethods.find(pm => !pm.expired).id };
  const before = S.db.invoices.length;
  const first = await call("POST", "/v1/app/checkout/confirm", body, opts);
  assert.equal(first.status, 201);
  const again = await call("POST", "/v1/app/checkout/confirm", body, opts);
  assert.deepEqual(again.data, first.data);
  assert.equal(S.db.invoices.length, before + 1);
  assert.equal((await call("POST", "/v1/app/checkout/confirm", { ...body, coupon: "LAUNCH20" }, opts)).status, 409);
  ws.members.find(member => member.userKey === "admin").role = "member";
  assert.equal((await call("POST", "/v1/app/checkout/confirm", body, opts)).status, 403);
}));

test("website full-period subscriptions report a monthly equivalent, not six times the monthly cost", () => withApi(async ({ S, call, own, now }) => {
  const ws = own(S.workspace("ws_gulf")); Object.assign(ws, { country: "SA", currency: "SAR" }); ws.billing.country = "SA";
  ws.lines = [{ id: "six-month-billing", planId: "files_pro", tool: "files", state: "active", cycle: "monthly", termMonths: 6, renewalMonths: 6, periodEnd: S.iso(now() + 180 * DAY), snapshot: { amount: 540, unit: 540, quantity: 1, currency: "SAR" } }];
  const result = await call("GET", "/v1/app/subscriptions", undefined, { workspace: ws.id });
  assert.equal(result.status, 200); assert.equal(result.data.monthlyTotal, 90);
  assert.equal(result.data.lines[0].termMonths, 6); assert.equal(result.data.lines[0].snapshot.amount, 540);
}));

test("an unpaid workspace can choose billing country, then its first payment locks that currency", () => withApi(async ({ S, call }) => {
  const ws = S.createWorkspace({ wsId: "ws_unpaid", ownerKey: "admin", name: "New customer", email: "billing@fixture.test" });
  assert.equal(ws.currencyLocked, false);
  const billing = { legalName: "New customer", email: "billing@fixture.test", country: "EG" };
  assert.equal((await call("PUT", "/v1/app/billing", billing, { workspace: ws.id })).status, 200);
  assert.equal(ws.currency, "EGP"); assert.equal(ws.country, "EG");
  const card = await call("POST", "/v1/app/payment-methods", { last4: "4242", expires: "12/30" }, { workspace: ws.id });
  assert.equal(card.status, 201);
  const paid = await call("POST", "/v1/app/checkout/confirm", { items: [{ planId: "tasks_pro", cycle: "monthly" }], paymentMethodId: card.data.id }, { workspace: ws.id });
  assert.equal(paid.status, 201); assert.equal(ws.currencyLocked, true);
  const invoice = JSON.stringify(S.db.invoices.at(-1));
  assert.equal((await call("PUT", "/v1/app/billing", { ...billing, country: "CH" }, { workspace: ws.id })).data.migrationQueued, true);
  assert.equal(ws.currency, "EGP"); assert.equal(JSON.stringify(S.db.invoices.at(-1)), invoice);
}));

test("a replaced subscription cannot qualify the new basket for its old bundle", () => withApi(async ({ S, call }) => {
  const ws = S.workspace("ws_orgtik"); ws.lines.find(line => line.tool === "hr").planId = "hr_pro";
  const body = { items: [{ planId: "files_free", cycle: "monthly" }, { planId: "tasks_pro", cycle: "monthly" }] };
  const quote = await call("POST", "/v1/app/checkout/preview", body);
  assert.equal(quote.status, 200); assert.equal(quote.data.bundleDiscount, 0); assert.equal(quote.data.bundle, null);
}));

test("a persisted subscription quote keeps the agreed total through new-customer price publication", () => withApi(async ({ S, call, publish, now }) => {
  const ws = S.workspace("ws_orgtik"), body = { items: [{ planId: "tasks_pro", cycle: "monthly" }] };
  const preview = await call("POST", "/v1/app/checkout/preview", body);
  assert.equal(preview.status, 200); assert.ok(preview.data.quoteId);
  await publish("tasks_pro:monthly:egypt", 499, "new_only", S.iso(now()));
  const paid = await call("POST", "/v1/app/checkout/confirm", { ...body, quoteId: preview.data.quoteId, paymentMethodId: ws.paymentMethods[0].id });
  assert.equal(paid.status, 201); assert.equal(paid.data.invoice.total, preview.data.total);
  assert.equal(paid.data.lines[0].snapshot.priceVersion, preview.data.priceVersion);
  assert.equal((await call("POST", "/v1/app/checkout/confirm", { ...body, quoteId: preview.data.quoteId, paymentMethodId: ws.paymentMethods[0].id })).status, 409);
}));

test("successful nonce recovery survives quote expiry, while declined quotes remain reusable", () => withApi(async ({ S, call, now, setNow }) => {
  const ws = S.workspace("ws_orgtik"), body = { items: [{ planId: "tasks_pro", cycle: "yearly" }] };
  const quote = (await call("POST", "/v1/app/checkout/preview", body)).data;
  const pay = { ...body, quoteId: quote.quoteId, paymentMethodId: ws.paymentMethods[0].id }, opts = { attemptId: "quoted-one-payment" };
  S.failNext = 1; assert.equal((await call("POST", "/v1/app/checkout/confirm", pay, opts)).status, 402);
  const paid = await call("POST", "/v1/app/checkout/confirm", pay, opts); assert.equal(paid.status, 201);
  setNow(now() + 20 * 60000);
  assert.deepEqual((await call("POST", "/v1/app/checkout/confirm", pay, opts)).data, paid.data);
  const fresh = (await call("POST", "/v1/app/checkout/preview", body)).data;
  setNow(now() + 20 * 60000);
  assert.equal((await call("POST", "/v1/app/checkout/confirm", { ...pay, quoteId: fresh.quoteId })).status, 410);
}));

test("subscription quotes cannot cross workspaces or silently spend changed credit", () => withApi(async ({ S, call, own }) => {
  const ws = S.workspace("ws_orgtik"), body = { items: [{ planId: "tasks_pro", cycle: "monthly" }] };
  const quote = (await call("POST", "/v1/app/checkout/preview", body)).data;
  const pay = { ...body, quoteId: quote.quoteId, paymentMethodId: ws.paymentMethods[0].id };
  const other = own(S.workspace("ws_gulf"));
  assert.equal((await call("POST", "/v1/app/checkout/confirm", pay, { workspace: other.id })).status, 403);
  ws.billingCredit = 50; ws.billingCreditCurrency = ws.currency;
  const before = S.db.invoices.length;
  assert.equal((await call("POST", "/v1/app/checkout/confirm", pay)).status, 409);
  assert.equal(S.db.invoices.length, before);
}));

test("a missing USD reporting rate cannot be invented as1 on a paid invoice", () => withApi(async ({ S, call }) => {
  const ws = S.workspace("ws_orgtik");
  S.db.rates = S.db.rates.filter(rate => rate.from !== "EGP" && rate.to !== "EGP");
  assert.equal(S.usdRate("EGP"), null);
  const before = S.db.invoices.length;
  const response = await call("POST", "/v1/app/checkout/confirm", { items: [{ planId: "chat_pro", cycle: "monthly" }], paymentMethodId: ws.paymentMethods[0].id });
  assert.equal(response.status, 503); assert.equal(response.error.code, "payment_rate_unavailable");
  assert.equal(S.db.invoices.length, before);
}));
