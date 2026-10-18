const assert = require("node:assert/strict");
const http = require("node:http");
const net = require("node:net");
const { test } = require("node:test");
const express = require("express");
const { makeStore } = require("./store");
const mountAdmin = require("./admin-api");
const { registerCatalog, mountPublicRoutes, linkWebsiteOrder, priceLine, QUOTE_TTL } = require("./website-offers");

const group = (kind, ids, months = 1) => ({ id: `${kind}-fixture`, kind, lines: ids.map(catalogId => ({ catalogId, months, autoRenew: false })) });
function fixture({ hosted = false, orderSecret = "isolated-offer-fixture-secret" } = {}) {
  let now = Date.parse("2026-10-07T09:00:00Z");
  const users = [{ id: 1, key: "admin", firstName: "Mona", email: "mona@fixture.test" }, { id: 2, key: "manager", firstName: "Karim", email: "karim@fixture.test" }, { id: 3, key: "employee", firstName: "Salma", email: "salma@fixture.test" }, { id: 5, key: "customer", firstName: "Nour", email: "nour@fixture.test" }];
  const identity = { users, findByKey: key => users.find(row => row.key === key), tokenFrom: req => req.get("authorization")?.replace(/^Bearer /, ""), userFromReq: req => users.find(row => row.key === req.get("authorization")?.replace(/^Bearer /, "")), decode: () => ({}) };
  const S = makeStore({ identity }); S.now = () => now;
  const ws = S.createWorkspace({ wsId: "ws_web", ownerKey: "admin", name: "Website fixture", email: "billing@fixture.test", country: "CH", currency: "CHF", createdAt: S.iso(now) });
  const ctx = { identity, config: { hosted }, websiteOrderSecret: orderSecret };
  const app = express();
  const H = { ok: (res, data, meta = {}, status = 200) => res.status(status).json({ data, meta }), fail: (res, status, code, message) => res.status(status).json({ error: { code, message } }), page: (req, res, data) => res.json({ data, meta: {} }) };
  mountPublicRoutes(app, ctx, S, H);
  mountAdmin(app, ctx, S, H);
  app.post("/v1/app/website-orders", (req, res) => {
    const user = identity.userFromReq(req), workspace = S.workspace(req.get("x-workspace") || "ws_web");
    try { H.ok(res, linkWebsiteOrder(S, { workspace, actor: { key: user?.key, readOnly: req.get("x-fixture-read-only") === "1" } }, req.body)); }
    catch (e) { H.fail(res, e.status || 500, e.code || "unexpected", e.message); }
  });
  app.use((e, _req, res, _next) => H.fail(res, 500, "unexpected", e.message));
  // Real Express routing, request/response objects and JSON envelopes, without listening on a
  // port, creating a child process or reading any hosted credentials/data.
  const call = (method, url, body, headers = {}) => new Promise(resolve => {
    const req = new http.IncomingMessage(new net.Socket());
    req.method = method; req.url = url; req.headers = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])); req.body = body;
    const res = new http.ServerResponse(req);
    res.end = payload => { resolve({ status: res.statusCode, body: payload ? JSON.parse(String(payload)) : null }); return res; };
    app.handle(req, res);
  });
  const quote = async (groups, headers) => (await call("POST", "/v1/public/website-quotes", { groups }, headers));
  const pay = (quoteId, reference = "fixture-one", changes = {}, headers) => call("POST", "/v1/public/website-orders", { quoteId, reference, paymentMethod: "card", billing: { name: "Fixture Buyer", email: "buyer@fixture.test" }, ...changes }, headers);
  const link = (order, headers = {}) => call("POST", "/v1/app/website-orders", { reference: order.reference, claimToken: order.claimToken }, { authorization: "Bearer admin", "x-workspace": "ws_web", ...headers });
  return { S, ws, ctx, call, quote, pay, link, advance: ms => { now += ms; } };
}

test("catalog registers distinct service fulfilment and server matrices for all four terms", async () => {
  const f = fixture(), before = f.S.db.services.length;
  registerCatalog(f.S); assert.equal(f.S.db.services.length, before);
  const response = await f.call("GET", "/v1/public/catalog");
  assert.equal(response.status, 200);
  const catalog = response.body.data;
  assert.equal(catalog.currency, "CHF"); assert.equal(catalog.decimals, 2); assert.equal(catalog.region.country, "CH");
  assert.equal(catalog.items.length, 16);
  const graphic = catalog.items.find(row => row.id === "design/graphic-design");
  assert.equal(graphic.monthlyMinor, 90000);
  assert.deepEqual(Object.keys(graphic.prices), ["1", "3", "6", "12"]);
  assert.equal(graphic.prices[12][1].total, 918000);
  assert.equal(graphic.prices[1][2].total, 85500);
  assert.equal(graphic.prices[3][3].discount, 10);
  assert.equal(graphic.prices[6][3].reason, "duration", "Duration wins a tie");
  assert.equal(graphic.prices[1][5].discount, 15);
  const services = f.S.db.websiteOffers.filter(row => row.serviceId);
  assert.equal(new Set(services.map(row => row.serviceId)).size, 11);
  assert.equal(catalog.items.find(row => row.id === "website").fulfillment, "managed-service");
});

test("full-period totals round once and preserve two- and three-decimal currency precision", () => {
  for (const decimals of [2, 3]) {
    const base = { decimals, currency: decimals === 3 ? "KWD" : "CHF", monthly: 0.05555, unit: 0.05555, quantity: 1, perUser: false, name: { en: "Fixture" }, source: "fixture" };
    const offer = { id: "fixture", kind: "service", serviceId: "fixture-service", fulfillment: "managed-service" };
    for (const months of [1, 3, 6, 12]) for (const count of [1, 2, 3, 4, 5, 6]) {
      const line = priceLine(base, offer, months, count);
      assert.equal(line.total, Math.round(base.monthly * months * (100 - line.discount) / 100 * 10 ** decimals));
      assert.equal(line.saving, line.subtotal - line.total);
    }
  }
  const base = { decimals: 2, currency: "CHF", monthly: 0.055, unit: 0.055, quantity: 1, perUser: false, name: { en: "Fixture" } };
  assert.equal(priceLine(base, { id: "fixture" }, 3, 1).total, 16, "Rounding the monthly unit first would incorrectly yield17");
  assert.throws(() => priceLine({ ...base, monthly: 1e100 }, { id: "fixture" }, 12, 1), { code: "price_unavailable", status: 503 });
});

test("software uses monthly Pro prices and server-selected capacity without stacking annual savings", async () => {
  const f = fixture();
  const response = await f.quote([group("software", ["hr", "tasks"], 12)]);
  assert.equal(response.status, 200);
  for (const line of response.body.data.groups[0].lines) {
    const plan = f.S.db.plans.find(row => row.id === line.planId);
    const resolved = f.S.resolveForWorkspace(plan.id, { country: "CH", currency: "CHF", members: [], lines: [] }, "monthly", plan.minSeats);
    assert.equal(line.quantity, plan.minSeats);
    assert.equal(line.total, Math.round(resolved.amount * 12 * 0.85 * 100));
    assert.equal(line.discount, 15);
  }
});

test("mock region is independent of language and signed workspace billing context wins", async () => {
  const f = fixture();
  const anonymous = await f.call("GET", "/v1/public/catalog", null, { "accept-language": "ar", "x-mock-country": "KW" });
  assert.equal(anonymous.body.data.region.country, "KW"); assert.equal(anonymous.body.data.decimals, 3);
  f.ws.country = "CH"; f.ws.billing.country = "DE"; f.ws.currency = "EUR";
  const signed = await f.call("GET", "/v1/public/catalog", null, { authorization: "Bearer admin", "x-workspace": "ws_web", "x-mock-country": "KW", "accept-language": "ar" });
  assert.equal(signed.body.data.region.country, "DE"); assert.equal(signed.body.data.currency, "EUR");
  assert.equal(signed.body.data.policy.tax.inclusive, false);
  assert.equal((await f.call("GET", "/v1/public/catalog", null, { authorization: "Bearer admin", "x-workspace": "ws_nile" })).status, 403);
  assert.equal((await f.call("GET", "/v1/public/catalog", null, { authorization: "Bearer unknown" })).status, 401);
  const hosted = fixture({ hosted: true });
  const previous = process.env.MOCK_SANDBOX; process.env.MOCK_SANDBOX = "production";
  try {
    const production = await hosted.call("GET", "/v1/public/catalog", null, { "x-mock-country": "KW" });
    assert.equal(production.body.data.region.country, process.env.MOCK_VISITOR_COUNTRY || "CH");
  } finally { if (previous === undefined) delete process.env.MOCK_SANDBOX; else process.env.MOCK_SANDBOX = previous; }
});

test("quote rejects duplicate/unsupported selections and ignores browser monetary guesses", async () => {
  const f = fixture();
  for (const groups of [[group("software", ["files"], 2)], [group("software", ["files", "files"])], [group("service", ["unknown"])], [group("software", ["files"]), { ...group("software", ["files"]), id: "second" }]]) assert.equal((await f.quote(groups)).status, 422);
  const cart = group("service", ["design/graphic-design"], 3); cart.lines[0].total = 1; cart.lines[0].monthlyMinor = 1;
  const response = await f.quote([cart]);
  assert.equal(response.body.data.quote.total, 256500);
  const wrong = await f.pay(response.body.data.quoteId, "tampered-total", { total: 1 });
  assert.equal(wrong.status, 422); assert.equal(wrong.body.error.code, "server_quote_required");
  assert.equal(f.S.db.publicWebsiteOrders.length, 0);
});

test("payment is server-confirmed before linking, retries are immutable, and failed attempts provision nothing", async () => {
  const f = fixture(), invoiceCount = f.S.db.invoices.length, requests = f.S.db.serviceRequests.length;
  const q = (await f.quote([group("software", ["files"])] )).body.data;
  f.S.failNext = 1;
  const failed = await f.pay(q.quoteId, "failed-attempt");
  assert.equal(failed.status, 200); assert.equal(failed.body.data.paymentStatus, "failed"); assert.equal(failed.body.data.claimToken, undefined);
  assert.equal(f.S.failNext, 0);
  assert.equal((await f.pay(q.quoteId, "failed-attempt")).body.data.paymentStatus, "failed");
  assert.equal(f.S.db.invoices.length, invoiceCount); assert.equal(f.S.db.serviceRequests.length, requests);
  assert.equal((await f.link({ reference: "failed-attempt", claimToken: "forged" })).status, 403);
  const paid = await f.pay(q.quoteId, "paid-attempt");
  assert.equal(paid.status, 200); assert.equal(paid.body.data.paymentStatus, "succeeded"); assert.ok(paid.body.data.claimToken);
  assert.equal(paid.body.data.groups[0].lines[0].activation, "awaiting-link");
  f.advance(QUOTE_TTL + 1);
  assert.deepEqual((await f.pay(q.quoteId, "paid-attempt")).body.data, paid.body.data, "Lost-response recovery survives quote expiry");
  assert.equal((await f.pay(q.quoteId, "new-after-expiry")).status, 410);
  assert.equal((await f.pay(q.quoteId, "paid-attempt", { billing: { name: "Different", email: "different@fixture.test" } })).status, 409);
});

test("linking uses server amounts, is idempotent, and cannot turn website service into WM access", async () => {
  const f = fixture(), historical = JSON.parse(JSON.stringify(f.S.db.invoices));
  const quote = (await f.quote([group("software", ["files", "website"], 6), group("service", ["marketing/seo-services"], 3)])).body.data;
  const paid = (await f.pay(quote.quoteId)).body.data;
  const first = await f.link(paid), again = await f.link(paid);
  assert.equal(first.status, 200); assert.deepEqual(again.body.data, first.body.data);
  assert.equal(first.body.data.tools.length, 1); assert.equal(first.body.data.requests.length, 2);
  assert.equal(f.ws.currencyLocked, true, "The first linked paid order locks workspace billing currency");
  assert.equal(f.ws.lines.some(row => row.tool === "website" || row.tool === "wm"), false);
  assert.equal(f.S.db.services.find(row => row.websiteCatalogId === "website").id, f.S.db.serviceRequests.find(row => row.catalogId === "website").serviceId);
  const invoice = f.S.db.invoices.find(row => row.reference === paid.reference);
  assert.equal(invoice.total, paid.quote.total / 100);
  assert.equal(invoice.payments[0].usdRate, f.S.usdRate("CHF"));
  assert.deepEqual(f.S.db.invoices.slice(0, historical.length), historical);
  assert.equal(f.S.db.notifications.filter(row => row.eventKey === `website-order:${paid.reference}`).length, 1);
  assert.equal(f.S.db.mailbox.filter(row => row.eventKey === `website-order:${paid.reference}`).length, 1);
  f.S.createWorkspace({ wsId: "ws_other", ownerKey: "admin", name: "Other", email: "other@fixture.test", country: "CH", currency: "CHF" });
  assert.equal((await f.link(paid, { "x-workspace": "ws_other" })).status, 409);
});

test("claim validation refuses changed currency, bad proof, legacy amounts and insufficient current role", async () => {
  const f = fixture(), q = (await f.quote([group("software", ["files"])] )).body.data;
  const paid = (await f.pay(q.quoteId)).body.data;
  assert.equal((await f.link({ ...paid, claimToken: "tampered" })).status, 403);
  assert.equal((await f.call("POST", "/v1/app/website-orders", { reference: paid.reference, lines: paid.groups[0].lines, currency: "CHF", total: 1 }, { authorization: "Bearer admin" })).status, 422);
  f.ws.currency = "EUR";
  assert.equal((await f.link(paid)).status, 409); f.ws.currency = "CHF";
  f.ws.members.push({ userKey: "employee", status: "active", role: "member" });
  assert.equal((await f.link(paid, { authorization: "Bearer employee" })).status, 403);
  assert.equal((await f.link(paid, { "x-fixture-read-only": "1" })).status, 403);
  assert.equal(f.S.db.websiteOrderLinks.length, 0);
});

test("Gulf and EU tax display is server-calculated and invoices match confirmed totals", async () => {
  for (const country of ["SA", "DE"]) {
    const f = fixture();
    f.ws.country = country; f.ws.billing.country = country; f.ws.currency = f.S.db.countries[country].currency;
    const headers = { authorization: "Bearer admin", "x-workspace": "ws_web" };
    const q = (await f.quote([group("software", ["files"], 3)], headers)).body.data;
    assert.equal(q.quote.taxInclusive, country === "SA");
    assert.equal(q.quote.total, country === "SA" ? q.quote.offerTotal : q.quote.offerTotal + q.quote.tax);
    const paid = (await f.pay(q.quoteId, `tax-${country}`, {}, headers)).body.data;
    const linked = await f.link(paid); assert.equal(linked.status, 200);
    assert.equal(linked.body.data.invoice.total, q.quote.total / 10 ** q.decimals);
    if (country === "SA") assert.equal(f.S.db.invoices.find(row => row.reference === paid.reference).payments[0].gateway, "gw_tap");
  }
});

test("pinned replay reproduces immutable quotes/orders and opaque claims without old login tokens", async () => {
  const original = fixture(), cold = fixture();
  const groups = [group("software", ["tasks", "website"], 3)];
  const a = (await original.quote(groups)).body.data, b = (await cold.quote(groups)).body.data;
  assert.deepEqual(a, b);
  const order = (await original.pay(a.quoteId, "replay-one")).body.data;
  assert.deepEqual((await cold.pay(b.quoteId, "replay-one")).body.data, order);
  assert.equal((await cold.link(order)).status, 200);
});

test("signed quotes retain purchased capacity and services use platform unit rounding before full-term savings", async () => {
  const f = fixture();
  f.ws.lines.push({ id: "capacity-fixture", tool: "tasks", planId: "tasks_pro", state: "active", snapshot: { quantity: 7 } });
  const headers = { authorization: "Bearer admin", "x-workspace": "ws_web" };
  const quote = (await f.quote([group("software", ["tasks"], 3)], headers)).body.data;
  assert.equal(quote.groups[0].lines[0].quantity, 7);
  const service = (await f.quote([group("service", ["design/graphic-design"], 3)], { "x-mock-country": "KW" })).body.data;
  const resolved = f.S.resolveForWorkspace("svc_web_graphic_design", { country: "KW", currency: "KWD" }, "monthly", 1);
  assert.equal(resolved.unit, 321.3, "KWD rounds the resolved platform unit up to a0.050 step");
  assert.equal(service.groups[0].lines[0].total, Math.round(resolved.amount * 3 * 0.95 * 1000));
  assert.equal(service.decimals, 3);
});

test("preview decline is a persisted server attempt and production ignores the fixture header", async () => {
  const previous = process.env.MOCK_SANDBOX; process.env.MOCK_SANDBOX = "production";
  try {
    const local = fixture(), q = (await local.quote([group("software", ["files"])] )).body.data;
    const failed = await local.pay(q.quoteId, "controlled-failure", {}, { "x-mock-payment": "declined" });
    assert.equal(failed.status, 200); assert.equal(failed.body.data.paymentStatus, "failed");
    assert.equal(local.S.db.publicWebsiteOrders.length, 1);
    const hosted = fixture({ hosted: true }), hq = (await hosted.quote([group("software", ["files"])] )).body.data;
    const succeeded = await hosted.pay(hq.quoteId, "production-fixture", {}, { "x-mock-payment": "declined" });
    assert.equal(succeeded.body.data.paymentStatus, "succeeded");
  } finally { if (previous === undefined) delete process.env.MOCK_SANDBOX; else process.env.MOCK_SANDBOX = previous; }
});

test("an additional paid same-plan term preserves the existing price snapshot and appends prepaid time", async () => {
  const f = fixture();
  const periodEnd = f.S.iso(f.S.now() + 20 * 86400000);
  const snapshot = { amount: 123, unit: 123, quantity: 1, currency: "CHF", priceVersion: 1 };
  f.ws.lines.push({ id: "already-paid", tool: "files", planId: "files_pro", state: "active", periodEnd, snapshot: { ...snapshot } });
  const headers = { authorization: "Bearer admin", "x-workspace": "ws_web" };
  const q = (await f.quote([group("software", ["files"], 3)], headers)).body.data;
  const paid = (await f.pay(q.quoteId, "prepaid-extension", {}, headers)).body.data;
  assert.equal((await f.link(paid)).status, 200);
  const line = f.ws.lines.find(row => row.id === "already-paid");
  assert.deepEqual(line.snapshot, snapshot);
  assert.equal(line.prepaidTerms[0].start, periodEnd);
  assert.equal(Date.parse(line.periodEnd) - Date.parse(periodEnd), 90 * 86400000);
  assert.equal(line.prepaidTerms[0].amount, paid.groups[0].lines[0].total / 100);
});

test("hosted claims reuse the configured store credential without requiring another setup", async () => {
  const names = ["MOCK_HANDOFF_SECRET", "MOCK_WEBSITE_ORDER_SECRET", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_TOKEN"];
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  try {
    names.forEach(name => delete process.env[name]);
    process.env.KV_REST_API_TOKEN = "fixture-kv-key";
    const f = fixture({ hosted: true, orderSecret: null });
    const q = await f.quote([group("software", ["files"])]);
    assert.equal(q.status, 200);
    const order = await f.pay(q.body.data.quoteId, "existing-store-key");
    assert.equal(order.body.data.paymentStatus, "succeeded");
    assert.equal(JSON.stringify(order.body).includes(process.env.KV_REST_API_TOKEN), false);
    assert.equal((await f.link(order.body.data)).status, 200);
  } finally { for (const name of names) { if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name]; } }
});

test("published service cells reach public quotes only at effectiveAt, while country overrides retain precedence", async () => {
  const f = fixture(), staff = { authorization: "Bearer admin" }, visitor = { "x-mock-country": "SA" };
  const planId = "svc_web_graphic_design", cart = [group("service", ["design/graphic-design"], 3)];
  const before = (await f.quote(cart, visitor)).body.data;
  const draft = await f.call("POST", "/v1/admin/price-drafts", { changes: [{ key: `${planId}:monthly:gcc`, to: 1000 }] }, staff);
  assert.equal(draft.status, 200);
  const effectiveAt = f.S.iso(f.S.now() + 60000);
  const published = await f.call("POST", `/v1/admin/price-drafts/${draft.body.data.id}/publish`, { effectiveAt, applyMode: "new_only", reason: "Scheduled public service pricing fixture" }, staff);
  assert.equal(published.status, 200);
  assert.equal((await f.quote(cart, visitor)).body.data.groups[0].lines[0].total, before.groups[0].lines[0].total);
  f.advance(60000);
  const after = (await f.quote(cart, visitor)).body.data;
  assert.equal(after.groups[0].lines[0].monthlyMinor, 100000);
  assert.equal(after.groups[0].lines[0].total, 285000);
  assert.equal(after.policy.priceVersion, 2);
  assert.equal((await f.call("PATCH", "/v1/admin/countries/SA", { fixed: { [`${planId}:monthly`]: 900 } }, staff)).status, 200);
  assert.equal((await f.quote(cart, visitor)).body.data.groups[0].lines[0].monthlyMinor, 90000);
  const kw = await f.call("PATCH", "/v1/admin/countries/KW", { fixed: { [`${planId}:monthly`]: 123.456 } }, staff);
  assert.equal(kw.status, 200);
  const kuwait = (await f.quote(cart, { "x-mock-country": "KW" })).body.data;
  assert.equal(kuwait.groups[0].lines[0].monthlyMinor, 123500);
  assert.equal(kuwait.groups[0].lines[0].total, 351975);
});

test("ws token claim selects prices; signed workspace confirmation is owner-only and private plans are unavailable publicly", async () => {
  const f = fixture();
  f.ctx.identity.decode = () => ({ ws: "ws_web" });
  const owner = { authorization: "Bearer admin" };
  const q = (await f.quote([group("software", ["files"])], owner)).body.data;
  assert.equal(q.region.workspaceId, "ws_web");
  f.ws.members.push({ userKey: "manager", status: "active", role: "admin" });
  const adminHeaders = { authorization: "Bearer manager", "x-workspace": "ws_web" };
  const aq = (await f.quote([group("software", ["files"])], adminHeaders)).body.data;
  const refused = await f.pay(aq.quoteId, "admin-cannot-pay", {}, adminHeaders);
  assert.equal(refused.status, 403); assert.equal(refused.body.error.code, "owner_required");
  assert.equal(f.S.db.publicWebsiteOrders.length, 0);
  f.S.db.plans.find(row => row.id === "files_pro").private = { amount: 1, currency: "CHF" };
  const publicCatalog = await f.call("GET", "/v1/public/catalog");
  assert.equal(publicCatalog.status, 200);
  assert.equal(publicCatalog.body.data.items.some(row => row.id === "files"), false);
  const privateQuote = await f.quote([group("software", ["files"])]);
  assert.equal(privateQuote.status, 409);
  assert.equal(privateQuote.body.error.code, "offer_unavailable");
});

test("inclusive GCC paid invoices reconcile net lines plus tax to the immutable payment", async () => {
  for (const country of ["SA", "AE"]) {
    const f = fixture();
    f.ws.country = country; f.ws.billing.country = country; f.ws.currency = f.S.db.countries[country].currency;
    const headers = { authorization: "Bearer admin", "x-workspace": "ws_web" };
    const cart = group("software", ["files", "website"], 3); cart.lines[0].months = 1;
    const q = (await f.quote([cart], headers)).body.data;
    const paid = (await f.pay(q.quoteId, `gcc-ledger-${country}`, {}, headers)).body.data;
    assert.equal((await f.link(paid)).status, 200);
    const invoice = f.S.db.invoices.find(row => row.reference === paid.reference), scale = 10 ** paid.decimals;
    const minor = amount => Math.round(amount * scale);
    const net = invoice.lines.reduce((sum, line) => sum + minor(line.amount), 0);
    const tax = invoice.lines.reduce((sum, line) => sum + minor(line.taxAmount), 0);
    const gross = invoice.lines.reduce((sum, line) => sum + minor(line.grossAmount), 0);
    assert.equal(net, q.quote.net); assert.equal(net, minor(invoice.subtotal));
    assert.equal(tax, q.quote.tax); assert.equal(tax, minor(invoice.tax));
    assert.equal(net + tax, minor(invoice.total)); assert.equal(gross, minor(invoice.payments[0].amount));
    assert.equal(invoice.taxDisplay, "inclusive"); assert.equal(invoice.taxRate, q.policy.tax.rate);
    assert.equal(invoice.chargeKind, "website_offer"); assert.equal(invoice.reverseCharge, false);
    assert.equal(invoice.rounding.method, "largest-remainder");
    for (const line of invoice.lines) {
      assert.ok(line.amount >= 0 && line.amount <= line.quotedAmount);
      assert.ok(Math.abs(minor(line.amount) - minor(line.quotedAmount) / (1 + invoice.taxRate / 100)) < 1);
    }
  }
});

test("raw card/CVV or nested ignored billing fields are rejected before payment state changes", async () => {
  const f = fixture(), q = (await f.quote([group("software", ["files"])] )).body.data;
  const before = { quotes: f.S.db.publicWebsiteQuotes.length, orders: f.S.db.publicWebsiteOrders.length, invoices: f.S.db.invoices.length, requests: f.S.db.serviceRequests.length };
  f.S.failNext = 1;
  for (const extra of [{ cardNumber: "4242424242424242" }, { cvv: "123" }, { securityCode: "123" }, { paymentDetails: { card: "fixture", cvv: "123" } }, { address: { cardNumber: "fixture", cvv: "123" } }]) {
    const response = await f.pay(q.quoteId, "billing-rejection", { billing: { name: "Fixture Buyer", email: "buyer@fixture.test", ...extra } });
    assert.equal(response.status, 422); assert.equal(response.body.error.code, "invalid_billing_fields");
  }
  assert.equal(f.S.failNext, 1);
  assert.deepEqual({ quotes: f.S.db.publicWebsiteQuotes.length, orders: f.S.db.publicWebsiteOrders.length, invoices: f.S.db.invoices.length, requests: f.S.db.serviceRequests.length }, before);
});

test("only server-known bundle IDs with exact members retain their presentation", async () => {
  const f = fixture(), cart = { ...group("software", ["files", "tasks", "hr"], 3), bundleId: "team-workspace", name: "Client cannot inject this name" };
  const recognized = (await f.quote([cart])).body.data;
  assert.equal(recognized.groups[0].bundleId, "team-workspace"); assert.equal(recognized.groups[0].name, "Team Workspace");
  const withoutPreset = (await f.quote([{ ...cart, bundleId: "unknown-client-preset" }])).body.data;
  assert.equal(withoutPreset.groups[0].bundleId, undefined); assert.equal(withoutPreset.groups[0].name, "Custom software plan");
  assert.deepEqual(withoutPreset.quote, recognized.quote, "Presentation metadata never changes arithmetic");
  const customized = (await f.quote([{ ...cart, lines: cart.lines.slice(0, 2) }])).body.data;
  assert.equal(customized.groups[0].bundleId, undefined); assert.equal(customized.groups[0].name, "Custom software plan");
});

test("website price notices preserve the six-month renewal and full-period offer policy", async () => {
  const f = fixture(); Object.assign(f.ws, { country: "SA", currency: "SAR" }); f.ws.billing.country = "SA";
  const headers = { authorization: "Bearer admin", "x-workspace": "ws_web" };
  const quote = (await f.quote([group("software", ["files"], 6)], headers)).body.data;
  const paid = (await f.pay(quote.quoteId, "six-month-notice", {}, headers)).body.data;
  await f.link(paid);
  const invoice = JSON.stringify(f.S.db.invoices.at(-1)), line = f.ws.lines.find(row => row.tool === "files");
  const start = f.S.now(), draft = await f.call("POST", "/v1/admin/price-drafts", { changes: [{ key: "files_pro:monthly:gcc", to: 100 }] }, headers);
  const published = await f.call("POST", `/v1/admin/price-drafts/${draft.body.data.id}/publish`, { effectiveAt: f.S.iso(start + 220 * 86400000), applyMode: "existing_next_renewal", reason: "Keep six-month website renewal boundaries" }, headers);
  assert.equal(published.status, 200);
  assert.equal(line.scheduled.effectiveAt, f.S.iso(start + 360 * 86400000));
  assert.equal(line.scheduled.snapshot.amount, 540, "Six months at100 with10% duration savings, without subscription annual/bundle savings");
  assert.equal(JSON.stringify(f.S.db.invoices.at(-1)), invoice, "The original paid invoice stays immutable");
});
