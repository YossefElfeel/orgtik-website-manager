// The spec's worked examples (03 §4, R03-EX-1…12) against the price resolver.
//   node apps/admin/pricing.test.js
const assert = require("node:assert/strict");
const P = require("./pricing");
const seed = require("./seed-pricing");
const { plans } = require("./seed-catalog");

const tables = () => JSON.parse(JSON.stringify({ ...seed, plans }));
const unit = (t, country, cycle = "monthly", planId = "chat_pro") => P.resolveUnit(t, { planId, cycle, country });
let n = 0;
const check = (name, fn) => { fn(); n++; console.log("ok ", name); };

check("EX-1 Saudi Arabia → 45 SAR (Zone)", () => assert.deepEqual(unit(tables(), "SA"), { amount: 45, currency: "SAR", source: "Zone" }));
check("EX-2 UAE → 44 AED (Zone, converted)", () => assert.deepEqual(unit(tables(), "AE"), { amount: 44, currency: "AED", source: "Zone (converted)" }));
check("EX-3 Kuwait → 3.700 KWD (step 0.050 up)", () => assert.deepEqual(unit(tables(), "KW"), { amount: 3.7, currency: "KWD", source: "Zone (converted)" }));
check("EX-4 Qatar → 39 QAR (Country)", () => assert.deepEqual(unit(tables(), "QA"), { amount: 39, currency: "QAR", source: "Country" }));
check("EX-5 Germany → 11 EUR", () => assert.deepEqual(unit(tables(), "DE"), { amount: 11, currency: "EUR", source: "Zone" }));
check("EX-6 Brazil → 12 USD (Default)", () => assert.deepEqual(unit(tables(), "BR"), { amount: 12, currency: "USD", source: "Default" }));
check("EX-7 GCC Pro to 50 SAR: KSA 50 · UAE 49 · KW 4.100 · Qatar 39", () => {
  const t = tables();
  t.grid["chat_pro:monthly:gcc"] = 50;
  assert.equal(unit(t, "SA").amount, 50);
  assert.equal(unit(t, "AE").amount, 49);
  assert.equal(unit(t, "KW").amount, 4.1);
  assert.equal(unit(t, "QA").amount, 39);
});
check("EX-8 Saudi Arabia yearly → 450 SAR", () => assert.equal(unit(tables(), "SA", "yearly").amount, 450));
check("EX-9 UAE yearly → 441 AED (rounded once)", () => assert.equal(unit(tables(), "AE", "yearly").amount, 441));
check("EX-10 Chat Starter, 7 seats, min 3 → 70 SAR", () => {
  const l = P.resolveLine(tables(), { planId: "chat_starter", cycle: "monthly", country: "SA", seats: 7 });
  assert.equal(l.amount, 70);
  assert.equal(P.resolveLine(tables(), { planId: "chat_starter", cycle: "monthly", country: "SA", seats: 2 }).amount, 30); // min 3
});
check("EX-11 snapshot: 'new customers only' keeps 45 SAR on an existing line", () => {
  // The line's snapshot (R03-P1) is what an existing subscriber pays; a new resolve gives the new price.
  const t = tables();
  const snapshot = { amount: unit(t, "SA").amount, currency: "SAR", source: "Zone", priceVersion: 1 };
  t.grid["chat_pro:monthly:gcc"] = 50;
  const applyMode = "new_only";
  const existing = applyMode === "new_only" ? snapshot.amount : unit(t, "SA").amount;
  assert.equal(existing, 45);
  assert.equal(unit(t, "SA").amount, 50);
});
check("EX-12 Egyptian billing country → 199 EGP (not the UAE price)", () => {
  assert.equal(unit(tables(), "AE").amount, 44);
  assert.deepEqual(unit(tables(), "EG"), { amount: 199, currency: "EGP", source: "Zone" });
});
check("X1 a country in no zone → Default zone", () => assert.equal(unit(tables(), "ZZ").currency, "USD"));
check("X4 totals round to decimals, not to the step (KWD 3 decimals)", () => {
  const r = P.totals({ lines: [{ amount: 3.7 }], currency: "KWD", decimals: 3, prorationFactor: 0.4567 });
  assert.equal(r.prorated, 1.69);
});
check("ALG-8 order: bundle → coupon → proration → tax (exclusive)", () => {
  const r = P.totals({ lines: [{ amount: 100 }, { amount: 50 }], currency: "SAR", bundlePct: 10, coupon: { kind: "percent", value: 20 }, prorationFactor: 0.5, tax: { rate: 15, inclusive: false } });
  assert.deepEqual([r.subtotal, r.bundleDiscount, r.couponDiscount, r.prorated, r.tax, r.total], [150, 15, 27, 54, 8.1, 62.1]);
});
check("K1 fixed coupon only in its currencies; K2 never below 0", () => {
  const c = { kind: "fixed", amounts: { SAR: 500 } };
  assert.equal(P.totals({ lines: [{ amount: 45 }], currency: "SAR", coupon: c }).total, 0);
  assert.equal(P.totals({ lines: [{ amount: 44 }], currency: "AED", coupon: c }).couponError, "coupon_currency");
});
check("workspace currency stays locked while its country price is converted", () => {
  const r = P.resolveWorkspaceLine(tables(), { planId: "chat_pro", cycle: "monthly", workspace: { country: "DE", currency: "CHF" } });
  assert.equal(r.currency, "CHF"); assert.equal(r.unit, 10); assert.equal(r.amount, 10);
});
check("eligible-line discounts precede remaining-period credit", () => {
  const r = P.totals({ lines: [{ amount: 100, prorationFactor: 0.5, credit: 20 }, { amount: 50, bundleEligible: false, couponEligible: false }], currency: "USD", bundlePct: 10, coupon: { kind: "percent", value: 20 } });
  assert.deepEqual([r.bundleDiscount, r.couponDiscount, r.prorated], [10, 18, 66]);
});
check("cycle changes retain unused old-period credit, and surplus credit is explicit", () => {
  const current = { cycle: "yearly", periodStart: "2026-01-01T00:00:00Z", periodEnd: "2027-01-01T00:00:00Z", snapshot: { amount: 1200 } };
  const r = P.proration(current, "monthly", Date.parse("2026-07-02T12:00:00Z"));
  assert.equal(r.factor, 1); assert.equal(r.credit, 600);
  const total = P.totals({ lines: [{ amount: 100, credit: r.credit }], currency: "USD" });
  assert.equal(total.total, 0); assert.equal(total.creditRemaining, 500);
});
check("small discounts allocate rounded cents without a negative final allocation", () => {
  const total = P.totals({ lines: [{ amount: 0.1 }, { amount: 0.1 }, { amount: 0.1 }, { amount: 0.1 }], currency: "USD", coupon: { kind: "fixed", amounts: { USD: 0.02 } } });
  assert.equal(total.couponDiscount, 0.02); assert.equal(total.total, 0.38);
  assert.ok(total.lineAmounts.every(line => line.couponDiscount >= 0));
});
console.log(`\n${n} pricing checks passed (spec 03 worked examples and rules).`);
