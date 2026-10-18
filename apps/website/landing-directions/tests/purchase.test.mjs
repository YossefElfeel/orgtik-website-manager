import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import {
  CATALOG,
  BUNDLES,
  MONTHS,
  findItem,
  createGroup,
  groupFromIds,
  groupName,
  groupTerm,
  quoteGroup,
  quoteCart,
  countSaving,
  configurationHref,
  groupFromLocation,
  migrateLegacy,
  installPublicCatalog,
  getPricingSnapshot,
  money,
} from "../src/reference/purchase-catalog.js";
import {
  simulatePayment as simulatePaymentRequest,
  provisionCRM,
  validateCustomer,
  savePurchaseSession,
  loadPurchaseSession,
  ORDER_SESSION_KEY,
  quoteWebsite,
  getPendingPayment,
} from "../src/reference/purchase-adapter.js";
import {
  getPreviewCustomer,
  subscribePreviewCustomer,
  signInPreviewCustomer,
  signOutPreviewCustomer,
} from "../src/reference/purchase-identity.js";
import {
  normalizeTestPaymentInput,
  validateTestPaymentDetails,
  createTestPaymentAuthorization,
} from "../src/reference/purchase-payment.js";

// The fixture runs the actual platform pricing/order helpers in memory. The browser receives
// their JSON responses; no test or client-side helper can mint a paid order from cart totals.
const require = createRequire(import.meta.url);
const { makeStore } = require("../../../../mock/apps/admin/store.js");
const sharedIdentity = require("../../../../mock/lib/identity.js");
const { registerCatalog, publicCatalog, resolveRegion, createQuote, confirmOrder } = require("../../../../mock/apps/admin/website-offers.js");
const backend = makeStore({ identity: sharedIdentity });
backend.now = () => Date.parse("2026-10-07T09:00:00Z");
registerCatalog(backend);
const backendContext = { config: { hosted: false }, websiteOrderSecret: "isolated-website-test-order-key", identity: { userFromReq: () => null, tokenFrom: () => null } };
const backendRequest = (body = {}, headers = {}) => ({ body, headers, get: name => headers[name.toLowerCase()] });
const visitor = resolveRegion(backendRequest(), backendContext, backend);
const approvedCatalog = publicCatalog(backend, visitor);
installPublicCatalog(approvedCatalog);
const requests = [];
globalThis.fetch = async (url, options = {}) => {
  if (options.signal?.aborted) throw new DOMException("The operation was aborted", "AbortError");
  const route = new URL(url).pathname;
  const body = options.body ? JSON.parse(options.body) : undefined;
  requests.push({ route, body, headers: options.headers || {} });
  let status = 200, data, failure;
  try {
    if (route.endsWith("/v1/public/catalog")) data = publicCatalog(backend, visitor);
    else if (route.endsWith("/v1/public/website-quotes")) data = createQuote(backend, backendContext, body, visitor);
    else if (route.endsWith("/v1/public/website-orders")) data = confirmOrder(backend, backendContext, backendRequest(body, options.headers), visitor);
    else throw new Error(`Unexpected website purchase request: ${route}`);
  } catch (error) { if (!error.status) throw error; status = error.status; failure = { code: error.code, message: error.message }; }
  return { ok: status >= 200 && status < 300, status, json: async () => JSON.parse(JSON.stringify(failure ? { error: failure } : { data })) };
};
// Existing adapter scenarios begin after the synthetic payment-details step is completed.
const simulatePayment = (request) => {
  if (request.outcome === "declined") backend.failNext = 1;
  return simulatePaymentRequest({
    authorization: { method: request.paymentMethod || "card", approved: true },
    ...request,
  });
};
const local = new Map(),
  session = new Map(),
  events = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => local.get(k) || null,
    setItem: (k, v) => local.set(k, v),
  },
  sessionStorage: {
    getItem: (k) => session.get(k) || null,
    setItem: (k, v) => session.set(k, v),
    removeItem: (k) => session.delete(k),
  },
  addEventListener: (type, fn) => events.set(type, fn),
};
Object.defineProperty(globalThis, "localStorage", { value: window.localStorage, configurable: true, writable: true });
Object.defineProperty(globalThis, "sessionStorage", { value: window.sessionStorage, configurable: true, writable: true });
const store = await import("../src/reference/purchase-store.js");
const reset = (groups = []) =>
  events.get("storage")({
    key: store.CART_STORAGE_KEY,
    newValue: JSON.stringify({ version: 2, groups, messages: [] }),
  });
const graphic = "design/graphic-design",
  brand = "design/brand-development",
  seo = "marketing/seo-services";
const group = (ids = [graphic], months = 1) =>
  groupFromIds("service", ids, months);
const customer = {
  name: "Test Customer",
  email: "test@example.test",
  company: "Demo",
};

test("entered identity is shared during navigation, defaults to guest, and never persists on reload", async () => {
  assert.equal(getPreviewCustomer(), null);
  const persisted = [local.size, session.size];
  let updates = 0;
  const unsubscribe = subscribePreviewCustomer(() => updates++);
  assert.throws(() => signInPreviewCustomer({ email: "invalid" }));
  assert.equal(getPreviewCustomer(), null);
  const signedIn = signInPreviewCustomer({
    ...customer,
    password: "discard-me",
  });
  assert.equal(getPreviewCustomer(), signedIn);
  assert.equal(signedIn.email, customer.email);
  assert.equal(signedIn.name, customer.name);
  assert.equal("password" in signedIn, false);
  assert.ok(Object.isFrozen(signedIn));
  const reloaded =
    await import("../src/reference/purchase-identity.js?reload-test");
  assert.equal(reloaded.getPreviewCustomer(), null);
  signOutPreviewCustomer();
  assert.equal(getPreviewCustomer(), null);
  assert.equal(updates, 2);
  unsubscribe();
  signOutPreviewCustomer();
  assert.equal(updates, 2);
  assert.deepEqual([local.size, session.size], persisted);
});

test("catalog has exactly the approved purchasable items, prices, and capabilities", () => {
  assert.equal(CATALOG.length, 16);
  assert.equal(CATALOG.filter((i) => i.kind === "service").length, 10);
  assert.equal(findItem(graphic).monthlyMinor, 90000);
  assert.equal(findItem("hr").monthlyMinor, 6500);
  assert.equal(getPricingSnapshot().items.find(item => item.id === "hr").quantity, 5);
  assert.ok(
    CATALOG.every(
      (i) => i.capabilities.length === 3 && Number.isInteger(i.monthlyMinor),
    ),
  );
  assert.ok(!CATALOG.some((i) => i.department === "hosting"));
  assert.equal(BUNDLES.length, 11);
  assert.ok(BUNDLES.every((b) => b.ids.every((id) => findItem(id, b.kind))));
});
test("single-package features do not change across all four durations", () => {
  for (const item of CATALOG)
    for (const months of MONTHS) {
      const q = quoteGroup(groupFromIds(item.kind, [item.id], months));
      assert.equal(q.lines.length, 1);
      assert.equal(q.lines[0].monthlyMinor, item.monthlyMinor);
      assert.equal(q.valid, true);
    }
});
test("duration prices use minor units and round only the full period", () => {
  assert.equal(quoteGroup(group([graphic], 3)).total, 256500);
  assert.equal(quoteGroup(groupFromIds("software", ["hr"], 3)).total, 18525);
  assert.equal(quoteGroup(groupFromIds("software", ["hr"], 12)).total, 66300);
});
test("best discount wins; rates never stack and duration wins a tie", () => {
  const g = group([graphic, brand], 3);
  const q = quoteGroup(g);
  assert.equal(q.total, 598500);
  assert.ok(q.lines.every((l) => l.discount === 5 && l.reason === "duration"));
  const six = quoteGroup(group([graphic, brand], 6));
  assert.ok(six.lines.every((l) => l.discount === 10));
  const one = quoteGroup(group([graphic, brand], 1));
  assert.ok(one.lines.every((l) => l.discount === 5 && l.reason === "bundle"));
});
test("mixed periods price independently and totals sum every purchased period", () => {
  const g = group([graphic, seo]);
  g.lines[0].months = 3;
  g.lines[1].months = 12;
  assert.equal(groupTerm(g), "Mixed durations");
  assert.equal(quoteGroup(g).total, 1276500);
  assert.equal(
    quoteCart([g, groupFromIds("software", ["files"], 6)]).total,
    1279740,
  );
});
test("count thresholds and savings stay monotonic for every available subset", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(countSaving), [0, 5, 10, 10, 15, 15]);
  for (const kind of ["service", "software"]) {
    const ids = CATALOG.filter((i) => i.kind === kind).map((i) => i.id);
    for (let mask = 1; mask < 1 << ids.length; mask++) {
      const selected = ids.filter((_, i) => mask & (1 << i));
      for (const months of MONTHS) {
        const q = quoteGroup(groupFromIds(kind, selected, months));
        assert.ok(
          q.lines.every(
            (l) =>
              l.discount ===
              Math.max(
                countSaving(selected.length),
                { 1: 0, 3: 5, 6: 10, 12: 15 }[months],
              ),
          ),
        );
      }
    }
  }
});
test("group count does not leak into unrelated groups", () => {
  assert.equal(quoteCart([group([graphic]), group([seo])]).saving, 0);
  assert.equal(quoteGroup(group([graphic, seo])).saving, 9500);
});
test("invalid terms, Hosting, cross-kind IDs and duplicate input are sanitized", () => {
  const g = createGroup({
    kind: "service",
    lines: [
      { catalogId: graphic, months: 24 },
      { catalogId: graphic, months: 12 },
      { catalogId: "hr", months: 1 },
      { catalogId: "hosting/managed-hosting", months: 1 },
    ],
  });
  assert.equal(g.lines.length, 1);
  assert.equal(g.lines[0].months, null);
  assert.equal(quoteGroup(g).valid, false);
});
test("configuration URLs round-trip mixed durations, renewals and template origin", () => {
  const g = groupFromIds("service", [graphic, brand], 3, "brand-presence");
  g.lines[1].months = 12;
  g.lines[1].autoRenew = true;
  const loaded = groupFromLocation(
    "service",
    new URL(configurationHref(g), "https://example.test"),
  );
  assert.deepEqual(loaded.lines, g.lines);
  assert.equal(loaded.bundleId, "brand-presence");
  assert.equal(loaded.defaultMonths, 3);
  assert.equal(quoteGroup(loaded).total, quoteGroup(g).total);
});
test("legacy durations and plan links keep valid selections without silently shortening 24 months", () => {
  const old = groupFromLocation(
    "software",
    new URL(
      "https://example.test/software?modules=hr,crm&duration=biennial&plan=complete",
    ),
  );
  assert.ok(old.lines.every((l) => l.months === null));
  assert.equal(quoteGroup(old).valid, false);
  const annual = groupFromLocation(
    "software",
    new URL("https://example.test/software?modules=hr&duration=annual"),
  );
  assert.equal(annual.lines[0].months, 12);
});
test("migration preserves known selections, excludes Hosting, and requires scope review", () => {
  const result = migrateLegacy([
    {
      kind: "service",
      selections: [{ id: graphic }, { id: "hosting/managed-hosting" }],
      commitmentMonths: 6,
      billing: "monthly",
    },
    { kind: "software", selections: [{ id: "hr" }], termId: "biennial" },
  ]);
  assert.equal(result.groups[0].lines[0].months, 6);
  assert.equal(result.groups[1].lines[0].months, null);
  assert.ok(result.groups.every((g) => g.needsReview));
  assert.ok(result.messages.some((m) => m.includes("Hosting")));
});
test("legacy project terms require a new commitment and duplicate selections need review", () => {
  const result = migrateLegacy([
    {
      kind: "service",
      selections: [{ id: graphic }],
      billing: "project",
      commitmentMonths: 1,
    },
    {
      kind: "service",
      selections: [{ id: graphic }, { id: brand }],
      commitmentMonths: 3,
    },
  ]);
  assert.equal(result.groups[0].lines[0].months, null);
  assert.equal(result.groups[1].lines.length, 1);
  assert.ok(result.messages.some((m) => m.includes("Overlapping")));
});
test("bundle naming distinguishes edited contents without changing its stable group identity", () => {
  const g = groupFromIds("service", [graphic, brand], 1, "brand-presence");
  assert.equal(groupName(g), "Brand Presence");
  g.lines.pop();
  assert.equal(groupName(g), "Brand Presence · customized");
});
test("add, line updates, undo and storage retain independent durations and renewals", () => {
  reset();
  const g = group([graphic, brand], 3);
  assert.equal(store.addCartItem(g), true);
  store.updateLine(g.id, graphic, { months: 12, autoRenew: true });
  assert.equal(store.getCartSnapshot().items[0].lines[1].months, 3);
  assert.equal(
    JSON.parse(local.get(store.CART_STORAGE_KEY)).groups[0].lines[0].autoRenew,
    true,
  );
  store.undoCartUpdate();
  assert.deepEqual(store.getCartSnapshot().items[0].lines, g.lines);
});
test("duplicate add waits for a choice; keeping existing adds only other items", () => {
  const a = group([graphic], 3),
    b = group([graphic, brand], 12);
  reset([a]);
  assert.equal(store.addCartItem(b), false);
  assert.equal(store.getCartSnapshot().items.length, 1);
  store.resolveOverlap("keep");
  const items = store.getCartSnapshot().items;
  assert.equal(items.length, 2);
  assert.equal(items[0].lines[0].months, 3);
  assert.deepEqual(
    items[1].lines.map((l) => l.catalogId),
    [brand],
  );
  store.undoCartUpdate();
  assert.equal(store.getCartSnapshot().items.length, 1);
});
test("replacing overlaps recalculates both groups and Undo restores their complete configuration", () => {
  const a = group([graphic, brand], 3),
    b = group([graphic, seo], 12);
  reset([a]);
  store.addCartItem(b);
  store.resolveOverlap("replace");
  const items = store.getCartSnapshot().items;
  assert.deepEqual(
    items[0].lines.map((l) => l.catalogId),
    [brand],
  );
  assert.equal(quoteGroup(items[0]).lines[0].reason, "duration");
  assert.equal(
    items.flatMap((g) => g.lines).filter((l) => l.catalogId === graphic).length,
    1,
  );
  store.undoCartUpdate();
  assert.deepEqual(store.getCartSnapshot().items, [a]);
});
test("cancelled overlap does not change cart and editing replaces the original in place", () => {
  const a = group([graphic]),
    b = group([seo]);
  reset([a, b]);
  store.addCartItem(group([graphic, brand]));
  store.resolveOverlap("cancel");
  assert.deepEqual(store.getCartSnapshot().items, [a, b]);
  store.addCartItem(
    { ...a, lines: [{ catalogId: brand, months: 6, autoRenew: false }] },
    { replaceId: a.id },
  );
  assert.equal(store.getCartSnapshot().items[0].id, a.id);
  assert.equal(store.getCartSnapshot().items.length, 2);
});
test("remove last item and clear support Undo", () => {
  const a = group();
  reset([a]);
  store.updateGroup(a.id, { lines: [] });
  assert.equal(store.getCartSnapshot().items.length, 0);
  store.undoCartUpdate();
  assert.equal(store.getCartSnapshot().items.length, 1);
  store.clearCart();
  store.undoCartUpdate();
  assert.deepEqual(store.getCartSnapshot().items, [a]);
});
test("removing a matching plan preserves other groups and Undo restores its exact terms and renewal", () => {
  const added = group([graphic, brand], 3);
  added.lines[0] = { ...added.lines[0], months: 12, autoRenew: true };
  const other = group([seo], 6);
  reset([added, other]);
  const incoming = createGroup({ ...added, id: "different-entry-id" });
  const match = store.containsConfiguration(incoming);
  assert.equal(match.id, added.id);
  store.removeCartItem(match.id);
  assert.deepEqual(store.getCartSnapshot().items, [other]);
  assert.deepEqual(JSON.parse(local.get(store.CART_STORAGE_KEY)).groups, [
    other,
  ]);
  store.undoCartUpdate();
  assert.deepEqual(store.getCartSnapshot().items, [added, other]);
  assert.deepEqual(JSON.parse(local.get(store.CART_STORAGE_KEY)).groups, [
    added,
    other,
  ]);
});
test("successful purchase removes only purchased groups and cannot be undone into another charge", () => {
  const a = group(),
    b = group([brand]);
  reset([a, b]);
  store.completeCartPurchase([a.id]);
  store.undoCartUpdate();
  assert.deepEqual(store.getCartSnapshot().items, [b]);
});
test("storage failure preserves live cart, and malformed cross-tab writes do not discard it", () => {
  reset();
  const writer = window.localStorage.setItem;
  window.localStorage.setItem = () => {
    throw Error("blocked");
  };
  const a = group();
  store.addCartItem(a);
  assert.equal(store.getCartSnapshot().persistent, false);
  assert.equal(store.getCartSnapshot().items.length, 1);
  window.localStorage.setItem = writer;
  events.get("storage")({ key: store.CART_STORAGE_KEY, newValue: "bad json" });
  assert.equal(store.getCartSnapshot().items.length, 1);
});
test("checkout requires name and valid email, not a project enquiry", () => {
  assert.deepEqual(validateCustomer(customer), {});
  assert.ok(validateCustomer({ name: "", email: "no" }).name);
  assert.ok(validateCustomer({ name: "A", email: "no" }).email);
});

test("test card entry accepts only synthetic values and requires all payment details", () => {
  const visa = {
    cardNumber: "4242 4242 4242 4242",
    expiry: "12/30",
    securityCode: "123",
  };
  const mastercard = { ...visa, cardNumber: "5555 5555 5555 4444" };
  assert.deepEqual(validateTestPaymentDetails("card", visa), {});
  assert.deepEqual(validateTestPaymentDetails("card", mastercard), {});
  assert.equal(Object.keys(validateTestPaymentDetails("card", {})).length, 3);
  assert.ok(
    validateTestPaymentDetails("card", { ...visa, securityCode: "" })
      .securityCode,
  );
  assert.ok(
    validateTestPaymentDetails("card", { ...visa, expiry: "01/29" }).expiry,
  );
  assert.ok(
    validateTestPaymentDetails("card", {
      ...visa,
      cardNumber: "4111111111111111",
    }).cardNumber,
  );
  assert.equal(
    normalizeTestPaymentInput("cardNumber", "4242424242424242"),
    visa.cardNumber,
  );
  assert.equal(
    normalizeTestPaymentInput("cardNumber", "5555555555554444"),
    mastercard.cardNumber,
  );
  assert.equal(
    normalizeTestPaymentInput("cardNumber", "4111111111111111"),
    null,
  );
  assert.equal(normalizeTestPaymentInput("cardNumber", "4242a"), null);
  assert.equal(normalizeTestPaymentInput("expiry", "1230"), "12/30");
  assert.equal(normalizeTestPaymentInput("expiry", "11/30"), null);
  assert.equal(normalizeTestPaymentInput("securityCode", "999"), null);
  assert.throws(
    () => createTestPaymentAuthorization("card", {}),
    /payment details/,
  );
  assert.deepEqual(createTestPaymentAuthorization("card", visa), {
    method: "card",
    approved: true,
  });
});

test("wallets need no extra details and retain method-specific test payment intent", async () => {
  for (const method of ["twint", "paypal"]) {
    assert.deepEqual(validateTestPaymentDetails(method), {});
    const authorization = createTestPaymentAuthorization(method);
    assert.deepEqual(authorization, {
      method,
      approved: true,
    });
    await assert.rejects(
      simulatePaymentRequest({
        groups: [group()],
        customer,
        reference: `missing-${method}`,
        paymentMethod: method,
      }),
      /payment details or approval/,
    );
    await assert.rejects(
      simulatePaymentRequest({
        groups: [group()],
        customer,
        reference: `mismatch-${method}`,
        paymentMethod: "card",
        authorization,
      }),
      /payment details or approval/,
    );
    const order = await simulatePaymentRequest({
      groups: [group()],
      customer,
      reference: `approved-${method}`,
      paymentMethod: method,
      authorization,
    });
    assert.equal(order.paymentStatus, "succeeded");
    assert.equal(order.paymentMethod, method);
    assert.equal("authorization" in order, false);
    const crm = await provisionCRM(order);
    assert.equal(crm.status, "ready");
    savePurchaseSession(order, crm);
    assert.equal(
      session.get(ORDER_SESSION_KEY).includes("authorization"),
      false,
    );
  }
});

test("card authorization never passes card details into receipts or CRM and refresh needs new entry", async () => {
  const details = {
    cardNumber: "4242 4242 4242 4242",
    expiry: "12/30",
    securityCode: "123",
  };
  const authorization = createTestPaymentAuthorization("card", details);
  const order = await simulatePaymentRequest({
    groups: [group()],
    customer,
    reference: "card-details-complete",
    paymentMethod: "card",
    authorization,
  });
  const crm = await provisionCRM(order);
  savePurchaseSession(order, crm);
  const receipt = session.get(ORDER_SESSION_KEY);
  assert.equal(receipt.includes(details.cardNumber), false);
  assert.equal(receipt.includes("cardNumber"), false);
  assert.equal(receipt.includes("securityCode"), false);
  assert.ok(validateTestPaymentDetails("card", {}).cardNumber);
  await assert.rejects(
    simulatePaymentRequest({
      groups: [group()],
      customer,
      reference: "card-details-empty",
      paymentMethod: "card",
    }),
    /payment details or approval/,
  );
});
test("declined and cancelled payment never produce a paid receipt or account", async () => {
  await assert.rejects(
    simulatePayment({
      groups: [group()],
      customer,
      reference: "declined",
      outcome: "declined",
    }),
    /declined/,
  );
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    simulatePayment({
      groups: [group()],
      customer,
      reference: "cancelled",
      signal: controller.signal,
    }),
    error => error.name === "AbortError" || error.message === "cancelled",
  );
  await assert.rejects(
    provisionCRM({ paymentStatus: "failed" }),
    /successful payment/,
  );
});

test("quotes and confirmations send configuration and proof only, never browser prices or credentials", async () => {
  const configured = group([graphic], 3);
  configured.lines[0].total = 1;
  const displayed = await quoteWebsite({ groups: [configured] });
  const quoting = requests.at(-1);
  assert.deepEqual(Object.keys(quoting.body), ["groups"]);
  assert.deepEqual(quoting.body.groups[0].lines[0], { catalogId: graphic, months: 3, autoRenew: false });
  const order = await simulatePayment({ groups: [configured], customer, reference: "server-proof-only", quote: displayed, paymentDetails: { cardNumber: "must-not-send", cvv: "must-not-send" } });
  const confirming = requests.at(-1);
  assert.deepEqual(Object.keys(confirming.body).sort(), ["billing", "paymentMethod", "quoteId", "reference"]);
  assert.equal(confirming.body.quoteId, displayed.quoteId);
  assert.equal(JSON.stringify(confirming.body).includes("must-not-send"), false);
  assert.deepEqual(order.quote, displayed.quote);
  assert.equal(order.currency, displayed.currency); assert.equal(order.decimals, displayed.decimals);
});

test("raw cart totals cannot be promoted to a paid purchase snapshot", async () => {
  const { createPurchaseSnapshot } = await import("../src/reference/purchase-adapter.js");
  assert.throws(() => createPurchaseSnapshot([group()], "client-reference"), error => error.code === "server_order_required");
  assert.throws(() => createPurchaseSnapshot({ version: 1, paymentStatus: "succeeded", groups: [group()], quote: { total: 1 }, currency: "CHF", decimals: 2 }), error => error.code === "server_order_required");
  const paid = await simulatePayment({ groups: [groupFromIds("software", ["website"])], customer, reference: "managed-website-proof" });
  assert.equal(paid.groups[0].lines[0].activation, "awaiting-onboarding");
  assert.equal(paid.groups[0].lines[0].fulfillment, "managed-service");
  assert.ok(Object.isFrozen(paid.quote));
});

test("unknown payment outcome recovers the immutable server attempt without requoting or recharging", async () => {
  const transport = globalThis.fetch, reference = "lost-response-recovery";
  const request = { groups: [group([graphic], 3)], customer, reference, paymentMethod: "paypal" };
  let lost = false, submitted;
  globalThis.fetch = async (url, options) => {
    const response = await transport(url, options);
    if (new URL(url).pathname.endsWith("/v1/public/website-orders") && !lost) {
      lost = true; submitted = JSON.parse(options.body); throw new TypeError("Isolated lost payment response");
    }
    return response;
  };
  try { await assert.rejects(simulatePayment(request), error => error.code === "transport_unavailable"); }
  finally { globalThis.fetch = transport; }
  assert.deepEqual(getPendingPayment().payload, submitted);
  const beforeQuotes = backend.db.publicWebsiteQuotes.length, beforeOrders = backend.db.publicWebsiteOrders.length;
  const recovered = await simulatePayment({ ...request, groups: [group([brand], 12)], paymentMethod: "card" });
  assert.deepEqual(requests.at(-1).body, submitted);
  assert.equal(recovered.paymentMethod, "paypal");
  assert.equal(backend.db.publicWebsiteQuotes.length, beforeQuotes); assert.equal(backend.db.publicWebsiteOrders.length, beforeOrders);
  assert.equal(getPendingPayment(), null);
});

test("a first owner-policy rejection confirms no payment and clears the pending attempt", async () => {
  const transport = globalThis.fetch, reference = "first-owner-policy-rejection";
  const ordersBefore = backend.db.publicWebsiteOrders.length;
  globalThis.fetch = async (url, options) => new URL(url).pathname.endsWith("/v1/public/website-orders")
    ? { ok: false, status: 403, json: async () => ({ error: { code: "owner_required", message: "Only the owner can confirm payment." } }) }
    : transport(url, options);
  try {
    await assert.rejects(
      simulatePayment({ groups: [group([graphic], 3)], customer, reference }),
      error => error.code === "owner_required" && error.status === 403 && error.confirmed === true,
    );
    assert.equal(backend.db.publicWebsiteOrders.length, ordersBefore);
    assert.equal(getPendingPayment(), null);
    assert.equal(session.has("orgtik.purchase-attempt.v1"), false);
  } finally { globalThis.fetch = transport; }
});

test("a recovery permission rejection preserves a previously uncertain paid attempt", async () => {
  const transport = globalThis.fetch, reference = "lost-response-owner-recovery";
  const request = { groups: [group([graphic], 3)], customer, reference, paymentMethod: "paypal" };
  let submitted;
  globalThis.fetch = async (url, options) => {
    const response = await transport(url, options);
    if (new URL(url).pathname.endsWith("/v1/public/website-orders")) {
      submitted = JSON.parse(options.body);
      throw new TypeError("Isolated paid-response loss before permission recovery");
    }
    return response;
  };
  try {
    await assert.rejects(simulatePayment(request), error => error.code === "transport_unavailable");
    const stored = backend.db.publicWebsiteOrders.find(row => row.snapshot.reference === reference);
    assert.equal(stored.snapshot.paymentStatus, "succeeded");
    assert.deepEqual(getPendingPayment().payload, submitted);
    const quotesBefore = backend.db.publicWebsiteQuotes.length, ordersBefore = backend.db.publicWebsiteOrders.length;
    let rejectedPayload;
    globalThis.fetch = async (url, options) => {
      assert.ok(new URL(url).pathname.endsWith("/v1/public/website-orders"), "Recovery must reuse the original quote, not request another.");
      rejectedPayload = JSON.parse(options.body);
      return { ok: false, status: 403, json: async () => ({ error: { code: "owner_required", message: "Owner permission was temporarily unavailable." } }) };
    };
    await assert.rejects(
      simulatePayment({ ...request, groups: [group([brand], 12)], paymentMethod: "card" }),
      error => error.code === "owner_required" && error.status === 403 && error.confirmed !== true,
    );
    assert.deepEqual(rejectedPayload, submitted);
    assert.deepEqual(getPendingPayment().payload, submitted);
    assert.equal(session.has("orgtik.purchase-attempt.v1"), true);
    assert.equal(backend.db.publicWebsiteQuotes.length, quotesBefore);
    assert.equal(backend.db.publicWebsiteOrders.length, ordersBefore);
    globalThis.fetch = transport;
    const recovered = await simulatePayment({ ...request, groups: [group([brand], 12)], paymentMethod: "card" });
    assert.equal(recovered.quoteId, stored.snapshot.quoteId);
    assert.equal(recovered.claimToken, stored.snapshot.claimToken);
    assert.equal(recovered.paymentMethod, "paypal");
    assert.deepEqual(requests.at(-1).body, submitted);
    assert.equal(backend.db.publicWebsiteQuotes.length, quotesBefore);
    assert.equal(backend.db.publicWebsiteOrders.length, ordersBefore);
    assert.equal(getPendingPayment(), null);
  } finally { globalThis.fetch = transport; }
});

test("expired displayed quotes cannot silently fetch and charge a different price", async () => {
  const configured = [group([graphic], 3)], displayed = await quoteWebsite({ groups: configured });
  const now = backend.now, count = backend.db.publicWebsiteOrders.length;
  backend.now = () => Date.parse(displayed.expiresAt) + 1;
  try {
    await assert.rejects(simulatePayment({ groups: configured, customer, reference: "expired-displayed-quote", quote: displayed }), error => error.code === "quote_expired");
    assert.equal(backend.db.publicWebsiteOrders.length, count);
    assert.equal(getPendingPayment(), null);
  } finally { backend.now = now; }
});

test("missing catalog prices stay unavailable and KWD matrices preserve server precision", () => {
  try {
    installPublicCatalog({ ...approvedCatalog, items: approvedCatalog.items.filter(item => item.id !== "files") });
    assert.equal(findItem("files").monthlyMinor, null);
    assert.equal(quoteGroup(groupFromIds("software", ["files"])).valid, false);
    assert.equal(quoteGroup(groupFromIds("software", ["files"])).total, null);
    const kuwait = { workspace: { country: "KW", currency: "KWD", billing: { country: "KW" }, members: [], lines: [] }, buyerKey: null, region: { country: "KW", currency: "KWD", source: "fixture" } };
    const matrix = publicCatalog(backend, kuwait); installPublicCatalog(matrix);
    const configured = groupFromIds("software", ["files"], 6);
    const approved = createQuote(backend, backendContext, { groups: [configured] }, kuwait);
    assert.equal(quoteGroup(configured).total, approved.quote.offerTotal);
    assert.equal(getPricingSnapshot().decimals, 3);
    assert.ok(money(approved.quote.total).startsWith("KWD "));
  } finally { installPublicCatalog(approvedCatalog); }
});
test("successful payment is idempotent, immutable, and records different activation states", async () => {
  const request = {
    groups: [group(), groupFromIds("software", ["hr"], 3)],
    customer,
    reference: "success",
  };
  const [a, b] = await Promise.all([
    simulatePayment(request),
    simulatePayment(request),
  ]);
  assert.equal(a, b);
  assert.ok(Object.isFrozen(a.groups[0].lines));
  assert.equal(a.groups[0].lines[0].activation, "awaiting-onboarding");
  assert.equal(a.groups[1].lines[0].activation, "awaiting-link");
  assert.equal("customer" in a, false);
});
test("all payment methods survive receipt refresh and CRM handoff without payment credentials", async () => {
  const { createCRMHandoffRequest } =
    await import("../src/reference/purchase-adapter.js");
  for (const paymentMethod of ["card", "twint", "paypal"]) {
    const order = await simulatePayment({
      groups: [group()],
      customer,
      reference: `method-${paymentMethod}`,
      paymentMethod,
      paymentDetails: "credential-never-persisted",
    });
    assert.equal(order.paymentMethod, paymentMethod);
    assert.ok(Object.isFrozen(order));
    assert.equal(createCRMHandoffRequest(order).paymentMethod, paymentMethod);
    savePurchaseSession(order, { status: "ready" });
    assert.equal(loadPurchaseSession().order.paymentMethod, paymentMethod);
    const receipt = session.get(ORDER_SESSION_KEY);
    assert.equal(receipt.includes("credential-never-persisted"), false);
    assert.equal(receipt.includes(customer.email), false);
  }
});
test("a declined payment can switch method on retry and never changes after success", async () => {
  const request = {
    groups: [group()],
    customer,
    reference: "method-retry",
  };
  await assert.rejects(
    simulatePayment({
      ...request,
      paymentMethod: "twint",
      outcome: "declined",
    }),
    /declined/,
  );
  const order = await simulatePayment({ ...request, reference: "method-retry-new-attempt", paymentMethod: "paypal" });
  const repeated = await simulatePayment({ ...request, reference: "method-retry-new-attempt", paymentMethod: "card" });
  assert.equal(repeated, order);
  assert.equal(repeated.paymentMethod, "paypal");
});
test("unsupported methods cannot create a purchase; older card receipts remain readable", async () => {
  const { createPurchaseSnapshot } =
    await import("../src/reference/purchase-adapter.js");
  await assert.rejects(
    simulatePayment({
      groups: [group()],
      customer,
      reference: "unknown-method",
      paymentMethod: "unsupported",
    }),
    /available payment method/,
  );
  const approved = await simulatePayment({ groups: [group()], customer, reference: "legacy-method" });
  const legacy = { ...createPurchaseSnapshot(approved) };
  delete legacy.paymentMethod;
  session.set(ORDER_SESSION_KEY, JSON.stringify({ order: legacy }));
  assert.equal(loadPurchaseSession().order.paymentMethod, "card");
  session.set(
    ORDER_SESSION_KEY,
    JSON.stringify({ order: { ...legacy, paymentMethod: "unsupported" } }),
  );
  assert.equal(loadPurchaseSession(), null);
});
test("CRM failure and pending states recover idempotently without another payment", async () => {
  const order = await simulatePayment({
    groups: [group()],
    customer,
    reference: "crm-retry",
  });
  assert.equal(
    (await provisionCRM(order, { scenario: "failed" })).status,
    "failed",
  );
  assert.equal(
    (await provisionCRM(order, { scenario: "pending" })).status,
    "pending",
  );
  const ready = await provisionCRM(order);
  assert.equal(ready.access, "setup-required");
  assert.deepEqual(await provisionCRM(order), ready);
});
test("verified demo customers reuse their account; session restoration never implies verified identity", async () => {
  const order = await simulatePayment({
    groups: [group()],
    customer,
    reference: "existing",
  });
  const crm = await provisionCRM(order, { verified: true });
  assert.equal(crm.access, "verified-existing");
  assert.equal(savePurchaseSession(order, crm), true);
  const text = session.get(ORDER_SESSION_KEY);
  assert.ok(!text.includes(customer.email));
  assert.ok(!text.includes(customer.name));
  const restored = loadPurchaseSession();
  assert.equal(restored.order.reference, order.reference);
  assert.equal(restored.crm.access, "setup-required");
  const unverifiedRetry = await provisionCRM(order, { verified: false });
  assert.equal(unverifiedRetry.access, "setup-required");
});

test("legacy module, mode and hash links retain their selected software and periods", () => {
  const read = (path) =>
    groupFromLocation("software", new URL(path, "https://example.test"));
  assert.equal(read("/software?module=crm&duration=6").lines[0].months, 6);
  assert.deepEqual(
    read("/software?mode=operations").lines.map((l) => l.catalogId),
    ["hr", "tasks", "files"],
  );
  assert.equal(
    read("/software#/plans/custom/annual/hr,crm").lines[0].months,
    12,
  );
  assert.equal(
    read("/software#/plans/custom/biennial/hr,crm").lines[0].months,
    null,
  );
});
test("malformed groups cannot crash pricing and duplicate stored purchases require review", () => {
  assert.deepEqual(createGroup(null).lines, []);
  assert.deepEqual(createGroup({ lines: {} }).lines, []);
  assert.deepEqual(createGroup({ lines: [null, 42] }).lines, []);
  assert.equal(quoteCart([group(), group()]).valid, false);
});
test("explicit simulated cancellation permits a later successful retry", async () => {
  const reference = "DEMO-CANCEL-RETRY";
  await assert.rejects(
    simulatePayment({
      groups: [group()],
      customer,
      reference,
      outcome: "cancelled",
    }),
    /cancelled/,
  );
  const order = await simulatePayment({
    groups: [group()],
    customer,
    reference,
  });
  assert.equal(order.paymentStatus, "succeeded");
});
test("CRM handoff contract carries customer context and canonical purchase amounts without persisting identity", async () => {
  const { createCRMHandoffRequest, createPurchaseSnapshot } =
    await import("../src/reference/purchase-adapter.js");
  const paid = await simulatePayment({ groups: [group([graphic], 6)], customer, reference: "DEMO-CONTRACT" });
  const order = createPurchaseSnapshot(paid);
  const request = createCRMHandoffRequest(order, customer, true);
  assert.equal(request.customerContext.email, customer.email);
  assert.equal(request.customerContext.verified, true);
  assert.equal(request.purchaseReference, order.reference);
  assert.equal(request.purchases[0].lines[0].months, 6);
  assert.deepEqual(request.amounts, order.quote);
  assert.throws(
    () =>
      createCRMHandoffRequest({ ...order, paymentStatus: "failed" }, customer),
    /successful payment/,
  );
  savePurchaseSession(order, { status: "ready" });
  assert.equal(session.get(ORDER_SESSION_KEY).includes(customer.email), false);
});
test("cross-tab storage ignores malformed migration notes without breaking the cart", () => {
  for (const messages of [
    "invalid",
    { text: "invalid" },
    [null, 42, "Review packages"],
  ]) {
    events.get("storage")({
      key: store.CART_STORAGE_KEY,
      newValue: JSON.stringify({ version: 2, groups: [group()], messages }),
    });
    assert.equal(store.getCartSnapshot().items.length, 1);
    assert.deepEqual(
      store.getCartSnapshot().messages,
      Array.isArray(messages) ? ["Review packages"] : [],
    );
  }
});

test("legacy storage migration still works in memory when browser writes are blocked", async () => {
  local.delete(store.CART_STORAGE_KEY);
  const original = JSON.stringify([
    { kind: "service", selections: [{ id: graphic }], commitmentMonths: 3 },
  ]);
  local.set("orgtik.cart.v1", original);
  const setItem = window.localStorage.setItem;
  window.localStorage.setItem = () => {
    throw new Error("blocked");
  };
  try {
    const isolated =
      await import("../src/reference/purchase-store.js?blocked-migration");
    assert.equal(isolated.getCartSnapshot().items[0].lines[0].months, 3);
    assert.equal(isolated.getCartSnapshot().persistent, false);
    assert.equal(local.get("orgtik.cart.v1"), original);
  } finally {
    window.localStorage.setItem = setItem;
    local.delete("orgtik.cart.v1");
  }
});
