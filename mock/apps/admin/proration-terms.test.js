const { test } = require("node:test");
const assert = require("node:assert/strict");
const { proration } = require("./pricing");
const DAY = 86400000, start = Date.parse("2026-10-07T09:00:00Z");
const at = days => new Date(start + days * DAY).toISOString();

test("switching a six-month website offer starts one monthly period and credits unused paid time", () => {
  const current = { cycle: "monthly", termMonths: 6, periodStart: at(0), periodEnd: at(180), snapshot: { amount: 540, periodAmount: 540 } };
  assert.deepEqual(proration(current, "monthly", start + 90 * DAY, 2), { factor: 1, credit: 270, periodEnd: null, periodStart: null });
});

test("changing subscription credits future website terms without multiplying the original period", () => {
  const current = { cycle: "monthly", termMonths: 3, periodStart: at(0), periodEnd: at(270), snapshot: { amount: 285 }, prepaidTerms: [{ start: at(90), end: at(270), amount: 540 }] };
  assert.equal(proration(current, "yearly", start + 45 * DAY, 2).credit, 682.5);
  assert.equal(proration(current, "monthly", start + 180 * DAY, 2).credit, 270);
  assert.equal(proration(current, "monthly", start + 270 * DAY, 2).credit, 0);
});

test("legacy monthly periods and three-decimal unused credits retain their boundaries", () => {
  const current = { cycle: "monthly", periodEnd: at(30), snapshot: { periodAmount: 3.7, amount: 5 } };
  assert.deepEqual(proration(current, "monthly", start + 15 * DAY, 3), { factor: 0.5, credit: 1.85, periodEnd: at(30), periodStart: at(0) });
});
