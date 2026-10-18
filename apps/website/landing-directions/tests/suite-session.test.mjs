import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import { createRequire } from "node:module";
import {
  setupPurchaseAccount,
  hasSuiteSession,
  validatePurchasePassword,
} from "../src/reference/suite-session.js";
import {
  signOutPreviewCustomer,
  getPreviewCustomer,
} from "../src/reference/purchase-identity.js";
import {
  savePurchaseSession,
  loadPurchaseSession,
  ORDER_SESSION_KEY,
} from "../src/reference/purchase-adapter.js";
import { headFor } from "../src/content/heads.js";
import { msg } from "../src/content/strings.js";
import { content } from "../src/content/index.js";

const storage = () => {
  const values = new Map();
  return {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v),
    removeItem: (k) => values.delete(k),
  };
};
const customer = {
  name: "Test Customer",
  email: "checkout@example.test",
  company: "Test Studio",
};
// Financial proof comes from the actual platform helper; identity/handoff transport remains
// a strict local fixture so the password and retry cases never access a provider or account.
const require = createRequire(import.meta.url);
const { makeStore } = require("../../../../mock/apps/admin/store.js");
const identity = require("../../../../mock/lib/identity.js");
const { registerCatalog, resolveRegion, createQuote, confirmOrder } = require("../../../../mock/apps/admin/website-offers.js");
const backend = makeStore({ identity });
backend.now = () => Date.parse("2026-10-07T09:00:00Z");
registerCatalog(backend);
const context = { config: { hosted: false }, websiteOrderSecret: "isolated-account-setup-order-key", identity: { userFromReq: () => null, tokenFrom: () => null } };
const region = resolveRegion({ get: () => null }, context, backend);
const quoted = createQuote(backend, context, { groups: [{ id: "software-hr", kind: "software", lines: [{ catalogId: "hr", months: 1, autoRenew: false }] }] }, region);
const order = confirmOrder(backend, context, { get: () => null, body: { quoteId: quoted.quoteId, reference: "ORG-ACCOUNT-SETUP", paymentMethod: "twint", billing: customer } }, region);
const response = (status, data = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => ({ data }),
});
let calls;
beforeEach(() => {
  globalThis.localStorage = storage();
  globalThis.sessionStorage = storage();
  globalThis.window = { sessionStorage: globalThis.sessionStorage };
  signOutPreviewCustomer();
  calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({
      url,
      ...options,
      body: options.body && JSON.parse(options.body),
    });
    if (url.endsWith("/auth/register"))
      return response(201, {
        tokens: { accessToken: "test-access-token" },
        user: { email: customer.email },
      });
    if (url.endsWith("/website-orders")) {
      assert.deepEqual(JSON.parse(options.body), { reference: order.reference, claimToken: order.claimToken }, "Only server order proof crosses the authenticated claim boundary");
      return response(201);
    }
    if (url.endsWith("/auth/handoff"))
      return response(200, { code: "one-time-code" });
    throw new Error(`Unexpected request: ${url}`);
  };
});

test("password setup creates the billing customer's account, links the exact purchase, and hands off signed in", async () => {
  const { href } = await setupPurchaseAccount(order, customer, "test-password");
  assert.deepEqual(
    calls.map((c) => new URL(c.url).pathname),
    ["/api/auth/register", "/v1/app/website-orders", "/api/auth/handoff"],
  );
  assert.deepEqual(calls[0].body, {
    name: customer.name,
    email: customer.email,
    password: "test-password",
  });
  assert.deepEqual(calls[1].body, { reference: order.reference, claimToken: order.claimToken });
  assert.equal(calls[1].headers.authorization, "Bearer test-access-token");
  assert.equal(href, "http://localhost:3013/auth/handoff?code=one-time-code");
  assert.ok(!href.includes("test-access-token"));
  assert.equal(getPreviewCustomer().email, customer.email);
  assert.ok(hasSuiteSession());
  assert.ok(
    !localStorage.getItem("orgtik.suite-session.v1").includes("test-password"),
  );
  assert.ok(
    !sessionStorage.getItem(ORDER_SESSION_KEY).includes("test-password"),
  );
  assert.equal(calls[1].body.lines, undefined);
  assert.equal(calls[1].body.total, undefined);
  assert.equal(calls[1].body.currency, undefined);
});

test("order connection failure keeps the new account and retries without registration or payment", async () => {
  const normalFetch = fetch;
  let fail = true;
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/website-orders") && fail) {
      fail = false;
      return response(503);
    }
    return normalFetch(url, options);
  };
  await assert.rejects(
    setupPurchaseAccount(order, customer, "test-password"),
    /order/,
  );
  assert.ok(hasSuiteSession());
  await setupPurchaseAccount(order, customer);
  assert.equal(calls.filter((c) => c.url.endsWith("/auth/register")).length, 1);
});

test("handoff retry reuses the account and already connected order", async () => {
  const normalFetch = fetch;
  let fail = true;
  globalThis.fetch = async (url, options) => {
    if (url.endsWith("/auth/handoff") && fail) {
      fail = false;
      return response(503);
    }
    return normalFetch(url, options);
  };
  await assert.rejects(
    setupPurchaseAccount(order, customer, "test-password"),
    /unavailable/,
  );
  await setupPurchaseAccount(order, customer);
  assert.equal(calls.filter((c) => c.url.endsWith("/auth/register")).length, 1);
  assert.equal(
    calls.filter((c) => c.url.endsWith("/website-orders")).length,
    1,
  );
});

test("an existing email requires sign-in and never changes its password or links an unauthenticated order", async () => {
  globalThis.fetch = async () => response(409);
  await assert.rejects(
    setupPurchaseAccount(order, customer, "test-password"),
    /exists/,
  );
  assert.equal(hasSuiteSession(), false);
  assert.equal(getPreviewCustomer(), null);
});

test("invalid password or unsuccessful purchase cannot create an account", async () => {
  await assert.rejects(
    setupPurchaseAccount(order, customer, "short"),
    /password/,
  );
  await assert.rejects(
    setupPurchaseAccount(
      { ...order, paymentStatus: "failed" },
      customer,
      "test-password",
    ),
    /purchase/,
  );
  assert.equal(calls.length, 0);
});

test("an unverified local receipt cannot create an account or submit monetary claims", async () => {
  for (const field of ["quoteId", "claimToken"]) {
    const unverified = { ...order }; delete unverified[field];
    await assert.rejects(setupPurchaseAccount(unverified, customer, "test-password"), /purchase|order/);
  }
  assert.equal(calls.length, 0);
  assert.equal(hasSuiteSession(), false);
});

test("account setup requires a confirmation that exactly matches a valid password", () => {
  assert.equal(validatePurchasePassword("short", "short"), "password");
  assert.equal(validatePurchasePassword("TestPassword123", ""), "confirmation");
  assert.equal(
    validatePurchasePassword("TestPassword123", "TestPassword123 "),
    "confirmation",
  );
  assert.equal(
    validatePurchasePassword("TestPassword123", "TestPassword123"),
    null,
  );
  assert.equal(calls.length, 0);
});

test("blocked persistent storage still lets the account and purchase connection retry in this tab", async () => {
  globalThis.localStorage = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
    removeItem() {
      throw new Error("blocked");
    },
  };
  await setupPurchaseAccount(order, customer, "test-password");
  await setupPurchaseAccount(order, customer);
  assert.equal(calls.filter((c) => c.url.endsWith("/auth/register")).length, 1);
});

test("receipt restoration keeps only billing fields for password setup and never authenticates a customer", () => {
  savePurchaseSession(
    order,
    { status: "ready", access: "verified-existing" },
    { ...customer, password: "discard-me", token: "discard-me" },
  );
  const restored = loadPurchaseSession();
  assert.deepEqual(restored.customer, customer);
  assert.equal(restored.crm.access, "setup-required");
  assert.ok(!sessionStorage.getItem(ORDER_SESSION_KEY).includes("discard-me"));
  assert.equal(hasSuiteSession(), false);
});

test("public footer links to Imprint and the deleted HTML sitemap has no address record", () => {
  const imprint = content.FOOT_START().find((link) => link.label === "Imprint");
  assert.equal(imprint.href, "/legal/imprint");
  assert.ok(headFor(imprint.href));
  assert.equal(headFor("/legal/sitemap"), null);
  assert.ok(!content.FOOT_START().some((link) => /sitemap/i.test(link.href)));
  assert.ok(msg("PurchaseSetup:2", [customer.email]).includes(customer.email));
});
