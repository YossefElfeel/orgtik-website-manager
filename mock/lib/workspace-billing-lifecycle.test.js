const { test } = require("node:test");
const assert = require("node:assert/strict");
const { makeStore } = require("../apps/admin/store");
const { executeBillingCommand, selectBillingDue } = require("./workspace-billing-lifecycle");
const DAY = 86400000, start = Date.parse("2026-10-07T09:00:00Z"), due = start + 30 * DAY;
const iso = value => new Date(value).toISOString();
const clone = value => JSON.parse(JSON.stringify(value));
function fixture({ cycle = "monthly", currency = "USD", country = "US", decline = false } = {}) {
  const S = makeStore({ identity: { users: [], findByKey: () => null } }), db = clone(S.db);
  db.plans.push({ id: "billing_plan", tool: "tasks", perUser: true, minSeats: 1, tier: "pro", status: "active", defaultUsd: { monthly: 10, yearly: 100 } });
  db.workspaces = [{ id: "ws_billing", name: "Billing fixture", state: "active", country, currency, currencyLocked: true, billing: { country, email: "owner@fixture.test", taxId: "" }, members: [{ userKey: "owner", role: "owner", status: "active", email: "owner@fixture.test", toolGrants: { tasks: { assigned: true } } }], invitations: [], paymentMethods: [{ id: "pm_fixture", kind: "card", isDefault: true, last4: decline ? "0002" : "4242" }], lines: [{ id: "line_fixture", tool: "tasks", planId: "billing_plan", state: "active", cycle, periodStart: iso(start), periodEnd: iso(cycle === "yearly" ? start + 365 * DAY : due), snapshot: { unit: cycle === "yearly" ? 100 : 10, amount: cycle === "yearly" ? 200 : 20, periodAmount: cycle === "yearly" ? 200 : 20, currency, quantity: 2, priceVersion: 1 }, autoRenew: true }] }];
  db.invoices = [{ id: "historical", number: "INV-2025-001999", workspaceId: "old_workspace", state: "paid", currency: "EUR", total: 99, lines: [], payments: [{ amount: 99, currency: "EUR", status: "succeeded", usdRate: 0.95 }], creditNotes: [{ amount: 1 }], refunded: 1 }];
  db.notifications = []; db.mailbox = []; db.audit = []; db.serviceRequests = []; db.tickets = []; db.priceDrafts = []; db.bundles = [];
  return db;
}
const system = { kind: "system", workspaceId: "ws_billing" };
const owner = { kind: "user", workspaceId: "ws_billing", userId: 1, canManageBilling: true };
function command(db, kind, time, fields = {}, authority = kind === "billing.run" ? system : owner) {
  return executeBillingCommand({ db, command: { kind, workspaceId: "ws_billing", operationId: `${kind}:${time}:${JSON.stringify(fields)}`, at: iso(time), ...fields }, authority });
}
const line = db => db.workspaces[0].lines[0];
const invoice = db => db.invoices.find(row => row.workspaceId === "ws_billing");

test("renewal preserves purchased quantity, billing anchor, account/history and pays once", () => {
  const original = fixture(), before = clone(original), first = command(original, "billing.run", due);
  assert.deepEqual(original, before); assert.deepEqual(first.db.invoices[0], before.invoices[0]);
  assert.equal(line(first.db).snapshot.quantity, 2); assert.equal(invoice(first.db).total, 20);
  assert.equal(invoice(first.db).payments[0].usdRate, 1); assert.equal(invoice(first.db).payments[0].usdAmount, 20);
  assert.equal(line(first.db).periodStart, iso(due)); assert.equal(line(first.db).periodEnd, iso(due + 30 * DAY));
  const repeated = command(first.db, "billing.run", due); assert.equal(repeated.duplicate, true); assert.equal(invoice(repeated.db).payments.length, 1);
  const later = command(first.db, "billing.run", due + 1); assert.equal(later.db.invoices.length, 2); assert.equal(later.db.mailbox.length, first.db.mailbox.length);
});

test("renewal failures retry exactly days1/3/5 and become read-only at day7, ended at day37", () => {
  let db = command(fixture({ decline: true }), "billing.run", due).db;
  assert.equal(line(db).state, "past_due"); assert.equal(line(db).graceEndsAt, iso(due + 7 * DAY));
  for (const day of [1, 3, 5]) db = command(db, "billing.run", due + day * DAY).db;
  assert.equal(invoice(db).payments.length, 4); assert.equal(db.invoices.length, 2);
  db = command(db, "billing.run", due + 7 * DAY - 1).db; assert.equal(line(db).state, "past_due");
  db = command(db, "billing.run", due + 7 * DAY).db; assert.equal(line(db).state, "read_only"); assert.equal(line(db).readOnlySince, iso(due + 7 * DAY));
  db = command(db, "billing.run", due + 36 * DAY).db; assert.equal(line(db).state, "read_only");
  db = command(db, "billing.run", due + 37 * DAY).db; assert.equal(line(db).state, "ended"); assert.equal(line(db).endedAt, iso(due + 37 * DAY));
  assert.equal(invoice(db).payments.length, 4); assert.equal(db.notifications.filter(row => row.kind === "read_only").length, 1); assert.equal(db.notifications.filter(row => row.kind === "subscription_ended").length, 1);
  assert.equal(db.notifications.length, db.mailbox.length);
});

test("late lifecycle preserves cancellation/grace dates and never charges an ended subscription", () => {
  const failed = command(fixture({ decline: true }), "billing.run", due).db;
  const late = command(failed, "billing.run", due + 70 * DAY).db;
  assert.equal(line(late).state, "deleted"); assert.equal(line(late).endedAt, iso(due + 37 * DAY));
  assert.equal(invoice(late).payments.length, 1); assert.equal(late.invoices.length, 2);
  assert.equal(late.mailbox.find(row => row.kind === "read_only").at, iso(due + 7 * DAY));
});

test("recovery reuses exact invoice/currency and original period, repeated lost response recovers once", () => {
  let db = command(fixture({ decline: true, cycle: "yearly" }), "billing.run", start + 365 * DAY).db;
  const originalEnd = start + 365 * DAY;
  db = command(db, "billing.run", originalEnd + 7 * DAY).db;
  db.workspaces[0].paymentMethods[0].last4 = "4242";
  const fields = { lineId: "line_fixture", paymentMethodId: "pm_fixture", operationId: "stable-recovery" };
  const paid = command(db, "billing.recover", originalEnd + 8 * DAY, fields);
  assert.equal(paid.result.paymentStatus, "succeeded"); assert.equal(line(paid.db).state, "active");
  assert.equal(line(paid.db).periodEnd, iso(originalEnd + 365 * DAY)); assert.equal(paid.db.invoices.length, 2);
  const replay = command(paid.db, "billing.recover", originalEnd + 70 * DAY, fields);
  assert.equal(replay.duplicate, true); assert.deepEqual(replay.result, paid.result); assert.equal(invoice(replay.db).payments.length, invoice(paid.db).payments.length);
  assert.throws(() => command(paid.db, "billing.recover", originalEnd + 70 * DAY, { ...fields, paymentMethodId: "different" }), error => error.code === "billing_operation_changed");
});

test("current revoked/foreign/view-as authority is checked before payment receipts", () => {
  const db = command(fixture(), "billing.run", due).db;
  for (const authority of [owner, { ...system, revoked: true }, { ...system, readOnly: true }, { ...system, workspaceId: "foreign" }]) assert.throws(() => command(db, "billing.run", due, {}, authority), error => error.status === 403);
  assert.throws(() => command(db, "billing.seats.quote", due, { lineId: "line_fixture", quantity: 4 }, { ...owner, canManageBilling: false }), error => error.status === 403);
});

test("missing USD rate fails closed without a charge or mutation", () => {
  const db = fixture({ currency: "CHF", country: "CH" }); db.rates = [];
  const snapshot = clone(db);
  assert.throws(() => command(db, "billing.run", due), error => error.code === "payment_rate_unavailable");
  assert.deepEqual(db, snapshot);
});

test("scheduled prices and free downgrade compose existing R0 transitions", () => {
  const db = fixture();
  db.plans.push({ id: "billing_free", tool: "tasks", tier: "free", perUser: true, minSeats: 1, status: "active", defaultUsd: { monthly: 0 } });
  line(db).scheduled = { kind: "downgrade", planId: "billing_free", effectiveAt: iso(due) };
  const reduced = command(db, "billing.run", due).db;
  assert.equal(line(reduced).state, "free"); assert.equal(line(reduced).planId, "billing_free"); assert.equal(reduced.invoices.length, 1);
  const priced = fixture(); line(priced).scheduled = { kind: "price_change", effectiveAt: iso(due), draftId: "pd", snapshot: { amount: 24, unit: 12, quantity: 2, currency: "USD", priceVersion: 2 } };
  assert.equal(invoice(command(priced, "billing.run", due).db).total, 24);
});

test("paid downgrade renews the new plan at its original boundary; trial expiry does not charge", () => {
  const db = fixture(); db.plans.push({ id: "billing_starter", tool: "tasks", perUser: true, minSeats: 1, tier: "starter", status: "active", defaultUsd: { monthly: 4 } });
  line(db).scheduled = { kind: "downgrade", planId: "billing_starter", effectiveAt: iso(due) };
  const renewed = command(db, "billing.run", due).db;
  assert.equal(line(renewed).planId, "billing_starter"); assert.equal(invoice(renewed).total, 8); assert.equal(line(renewed).periodStart, iso(due));
  const trial = fixture(); Object.assign(line(trial), { state: "trialing", trialEndsAt: iso(due) });
  assert.equal(command(trial, "billing.run", due).db.invoices.length, 1);
});

test("renewal discounts use eligible current bundles and do not reapply a one-time checkout coupon", () => {
  const db = fixture(); line(db).snapshot.periodAmount = 10;
  db.bundles = [{ id: "fixture_bundle", active: true, pct: 15, planIds: ["billing_plan", "files_pro"] }];
  db.workspaces[0].lines.push({ id: "file_line", planId: "files_pro", tool: "files", state: "active", cycle: "monthly", periodEnd: iso(due + DAY), snapshot: { amount: 1, unit: 1, quantity: 1, currency: "USD" } });
  const renewed = command(db, "billing.run", due).db;
  assert.equal(invoice(renewed).total, 17); assert.equal(invoice(renewed).couponDiscount, 0); assert.equal(line(renewed).snapshot.periodAmount, 17);
  assert.equal(invoice(renewed).lines.find(row => row.kind === "bundle_discount").amount, -3);
});

test("zero credit-covered renewal, expired card and non-recurring method have honest outcomes", () => {
  const credit = fixture(); credit.workspaces[0].billingCredit = 25; credit.workspaces[0].billingCreditCurrency = "USD";
  const settled = command(credit, "billing.run", due).db;
  assert.equal(invoice(settled).total, 0); assert.equal(invoice(settled).payments.length, 0); assert.equal(settled.workspaces[0].billingCredit, 5);
  const expired = fixture(); expired.workspaces[0].paymentMethods[0].expires = "09/26";
  assert.equal(invoice(command(expired, "billing.run", due).db).payments[0].reason, "card_expired");
  const manual = fixture(); manual.workspaces[0].paymentMethods[0].kind = "cash_code";
  assert.equal(invoice(command(manual, "billing.run", due).db).payments[0].reason, "payment_link_required");
});

test("KWD precision and regional tax invoice lines reconcile; reductions can be cancelled", () => {
  const kw = fixture({ currency: "KWD", country: "KW" });
  Object.assign(line(kw).snapshot, { unit: 3.701, amount: 7.402, periodAmount: 7.402 });
  const quoted = command(kw, "billing.seats.quote", start + 10 * DAY, { lineId: "line_fixture", quantity: 3 });
  assert.equal(quoted.result.decimals, 3);
  const paid = command(quoted.db, "billing.seats.confirm", start + 10 * DAY + 1, { quoteId: quoted.result.quoteId, paymentMethodId: "pm_fixture" });
  const inv = invoice(paid.db); assert.equal(Math.round(inv.total * 1000), inv.total * 1000); assert.equal(Math.round((inv.lines.reduce((sum, row) => sum + row.amount, 0) + inv.tax) * 1000), Math.round(inv.total * 1000));
  const gulf = fixture({ currency: "AED", country: "AE" });
  const renewed = command(gulf, "billing.run", due).db; assert.equal(invoice(renewed).taxDisplay, "inclusive"); assert.equal(invoice(renewed).total, 20); assert.equal(invoice(renewed).subtotal + invoice(renewed).tax, 20);
  const scheduled = command(fixture(), "billing.seats.reduce", start + DAY, { lineId: "line_fixture", quantity: 1 });
  const cancelled = command(scheduled.db, "billing.seats.cancel-reduction", start + 2 * DAY, { lineId: "line_fixture" });
  assert.equal(line(cancelled.db).scheduledSeatChange, undefined); assert.equal(line(cancelled.db).snapshot.quantity, 2);
});

test("seat quote uses shared proration, paid capacity only, held price and currency rounding", () => {
  const db = fixture(), time = start + 15 * DAY;
  const quoted = command(db, "billing.seats.quote", time, { lineId: "line_fixture", quantity: 3 }); assert.equal(quoted.result.total, 5);
  assert.equal(line(quoted.db).snapshot.quantity, 2);
  quoted.db.plans.find(plan => plan.id === "billing_plan").defaultUsd.monthly = 50;
  const fields = { quoteId: quoted.result.quoteId, paymentMethodId: "pm_fixture", operationId: "stable-capacity" };
  const paid = command(quoted.db, "billing.seats.confirm", time + 1, fields);
  assert.equal(paid.result.total, 5); assert.equal(line(paid.db).snapshot.quantity, 3); assert.equal(line(paid.db).periodEnd, iso(due));
  assert.equal(line(paid.db).snapshot.periodAmount, 30);
  const recovered = command(paid.db, "billing.seats.confirm", time + 2 * DAY, fields); assert.equal(recovered.duplicate, true); assert.equal(recovered.db.invoices.length, 2);
  assert.equal(invoice(paid.db).lines.reduce((sum, row) => sum + row.amount, 0) + invoice(paid.db).tax, invoice(paid.db).total);
});

test("capacity refuses stale reservations, expired quote, immutable private allocation and flat plan", () => {
  const db = fixture(), time = start + 15 * DAY;
  const quoted = command(db, "billing.seats.quote", time, { lineId: "line_fixture", quantity: 3 });
  const fields = { quoteId: quoted.result.quoteId, paymentMethodId: "pm_fixture" };
  assert.throws(() => command(quoted.db, "billing.seats.confirm", time + 900000, fields), error => error.code === "quote_expired");
  quoted.db.workspaces[0].invitations.push({ status: "pending", expiresAt: iso(due), reservations: ["tasks"] });
  assert.throws(() => command(quoted.db, "billing.seats.confirm", time + 1, fields), error => error.code === "checkout_changed");
  const contracted = fixture(); contracted.plans.find(plan => plan.id === "billing_plan").contractedQuantity = 2;
  assert.throws(() => command(contracted, "billing.seats.quote", time, { lineId: "line_fixture", quantity: 3 }), error => error.code === "capacity_quote_required");
});

test("declined capacity attempt preserves quantity and has no paid invoice; a new attempt can succeed", () => {
  const quoted = command(fixture({ decline: true }), "billing.seats.quote", start + 15 * DAY, { lineId: "line_fixture", quantity: 3 });
  const fields = { quoteId: quoted.result.quoteId, paymentMethodId: "pm_fixture", operationId: "declined-seat" };
  const failed = command(quoted.db, "billing.seats.confirm", start + 15 * DAY + 1, fields);
  assert.equal(failed.result.paymentStatus, "failed"); assert.equal(line(failed.db).snapshot.quantity, 2); assert.equal(failed.db.invoices.length, 1);
  assert.equal(command(failed.db, "billing.seats.confirm", start + 15 * DAY + 2, fields).duplicate, true);
  failed.db.workspaces[0].paymentMethods[0].last4 = "4242";
  assert.equal(command(failed.db, "billing.seats.confirm", start + 15 * DAY + 3, { ...fields, operationId: "retry-seat" }).result.paymentStatus, "succeeded");
});

test("reductions apply at renewal only, cover reservations and use the lower stored quantity", () => {
  const db = fixture(), scheduled = command(db, "billing.seats.reduce", start + DAY, { lineId: "line_fixture", quantity: 1 });
  assert.equal(line(scheduled.db).snapshot.quantity, 2);
  const renewed = command(scheduled.db, "billing.run", due).db; assert.equal(line(renewed).snapshot.quantity, 1); assert.equal(invoice(renewed).total, 10);
  const stale = clone(scheduled.db); stale.workspaces[0].invitations.push({ status: "pending", expiresAt: iso(due + DAY), reservations: ["tasks"] });
  assert.throws(() => command(stale, "billing.run", due), error => error.code === "invalid_capacity");
  assert.equal(stale.invoices.length, 1);
});

test("website prepaid capacity proration preserves full-term arithmetic and original paid orders", () => {
  const db = fixture(); Object.assign(line(db), { termMonths: 3, renewalMonths: 6, periodEnd: iso(start + 270 * DAY), source: { policy: "website-offers-v1", reference: "old" }, prepaidTerms: [{ reference: "future", start: iso(start + 90 * DAY), end: iso(start + 270 * DAY), amount: 540 }], snapshot: { amount: 285, periodAmount: 285, unit: 142.5, quantity: 2, currency: "USD", priceVersion: 1 } });
  db.publicWebsiteOrders = [{ snapshot: { reference: "future", policy: { priceVersion: 1 }, paymentStatus: "succeeded" } }];
  const historical = clone(db.publicWebsiteOrders), quoted = command(db, "billing.seats.quote", start + 180 * DAY, { lineId: "line_fixture", quantity: 3 });
  assert.equal(quoted.result.total, 135);
  const paid = command(quoted.db, "billing.seats.confirm", start + 180 * DAY + 1, { quoteId: quoted.result.quoteId, paymentMethodId: "pm_fixture" });
  assert.equal(line(paid.db).prepaidTerms[0].amount, 810); assert.equal(line(paid.db).prepaidTerms[0].originalAmount, 540); assert.deepEqual(paid.db.publicWebsiteOrders, historical);
  const renewed = command(paid.db, "billing.run", start + 270 * DAY).db; assert.equal(renewed.invoices.at(-1).total, 810); assert.equal(line(renewed).periodEnd, iso(start + 450 * DAY));
  assert.equal(line(renewed).termMonths, 6); assert.equal(line(renewed).prepaidTerms, undefined); assert.equal(line(renewed).paidTermHistory[0].originalAmount, 540);
  assert.equal(command(renewed, "billing.seats.quote", start + 360 * DAY, { lineId: "line_fixture", quantity: 4 }).result.total, 135);
});

test("legacy multi-line invoice charges once and recovers every allocated subscription together", () => {
  const db = fixture({ decline: true }), ws = db.workspaces[0];
  ws.lines.push({ ...clone(line(db)), id: "second_line", tool: "hr", snapshot: { ...line(db).snapshot, amount: 30, periodAmount: 30, unit: 15 } });
  db.invoices.push({ id: "legacy_open", number: "INV-2026-002000", workspaceId: ws.id, state: "open", kind: "subscription", currency: "USD", dueAt: iso(due), lines: [{ lineId: "line_fixture", amount: 20 }, { lineId: "second_line", amount: 30 }], total: 50, subtotal: 50, tax: 0, payments: [], creditNotes: [], refunded: 0 });
  const failed = command(db, "billing.run", due).db;
  assert.equal(failed.invoices.length, 2); assert.equal(failed.invoices[1].payments.length, 1); assert.equal(failed.workspaces[0].lines.every(row => row.state === "past_due"), true);
  failed.workspaces[0].paymentMethods[0].last4 = "4242";
  const recovered = command(failed, "billing.recover", due + DAY, { lineId: "line_fixture", paymentMethodId: "pm_fixture" }).db;
  assert.equal(recovered.invoices.length, 2); assert.equal(recovered.invoices[1].payments.filter(row => row.status === "succeeded").length, 1);
  assert.equal(recovered.workspaces[0].lines.every(row => row.state === "active" && row.periodEnd === iso(due + 30 * DAY)), true);
  assert.equal(command(recovered, "billing.run", due + DAY).db.invoices.length, 2);
  assert.equal(recovered.mailbox.filter(row => row.template === "payment_recovered").length, 1);
});

test("inconsistent legacy invoice allocations fail closed and suspended reductions do not write", () => {
  const db = fixture(); db.invoices.push({ id: "bad_open", number: "INV-2026-002000", workspaceId: "ws_billing", state: "open", currency: "USD", dueAt: iso(due), lines: [{ lineId: "line_fixture", amount: 20 }, { lineId: "foreign_line", amount: 30 }], total: 50, payments: [] });
  const before = clone(db); assert.throws(() => command(db, "billing.run", due), error => error.code === "billing_invoice_allocation_required"); assert.deepEqual(db, before);
  const suspended = fixture(); suspended.workspaces[0].state = "suspended";
  assert.throws(() => command(suspended, "billing.seats.reduce", start + DAY, { lineId: "line_fixture", quantity: 1 }), error => error.status === 423);
});

test("missing historical debt invoice never becomes a replacement current-price charge", () => {
  const db = fixture(); Object.assign(line(db), { state: "past_due", lastFailure: { at: iso(due), reason: "card_declined" } });
  const before = clone(db);
  assert.throws(() => command(db, "billing.recover", due + DAY, { lineId: "line_fixture", paymentMethodId: "pm_fixture" }), error => error.code === "billing_invoice_unavailable");
  assert.deepEqual(db, before);
});

const runWorkspace = (db, workspaceId, at, operationId) => executeBillingCommand({ db, command: { kind: 'billing.run', workspaceId, at: iso(at), operationId }, authority: { kind: 'system', workspaceId } });
function runSelected(db, at) {
  for (const selected of selectBillingDue({ db, at })) {
    const fresh = selectBillingDue({ db, at, workspaceId: selected.workspaceId })[0];
    if (fresh) db = runWorkspace(db, fresh.workspaceId, at, fresh.operationId).db;
  }
  return db;
}

test('workspace billing runs cannot consume another workspace paid-downgrade renewal anchor', () => {
  for (const order of [['ws_billing', 'ws_second'], ['ws_second', 'ws_billing']]) {
    let db = fixture();
    db.plans.push({ id: 'billing_starter', tool: 'tasks', perUser: true, minSeats: 1, tier: 'starter', status: 'active', defaultUsd: { monthly: 4 } });
    const second = clone(db.workspaces[0]); second.id = 'ws_second'; second.lines[0].id = 'line_second';
    second.lines[0].scheduled = { kind: 'downgrade', planId: 'billing_starter', effectiveAt: iso(due) }; db.workspaces.push(second);
    const untouchedId = order[1], untouched = clone(db.workspaces.find(ws => ws.id === untouchedId));
    db = runWorkspace(db, order[0], due, `ordered:${order[0]}`).db;
    assert.deepEqual(db.workspaces.find(ws => ws.id === untouchedId), untouched);
    db = runWorkspace(db, order[1], due, `ordered:${order[1]}`).db;
    const firstInvoice = db.invoices.find(row => row.workspaceId === 'ws_billing'), secondInvoice = db.invoices.find(row => row.workspaceId === 'ws_second');
    assert.equal(firstInvoice.total, 20); assert.equal(secondInvoice.total, 8);
    assert.equal(secondInvoice.dueAt, iso(due)); assert.equal(db.workspaces[1].lines[0].periodStart, iso(due));
    assert.equal(db.workspaces[1].lines[0].periodEnd, iso(due + 30 * DAY));
    const paid = clone(db.invoices), notices = db.mailbox.length;
    for (const workspaceId of order) db = runWorkspace(db, workspaceId, due, `ordered:${workspaceId}`).db;
    assert.deepEqual(db.invoices, paid); assert.equal(db.mailbox.length, notices);
  }
});

test('recorded earlier debt is processed even when a legacy line still has a future period end', () => {
  const db = fixture({ decline: true });
  Object.assign(line(db), { state: 'past_due', periodEnd: iso(due + 30 * DAY), lastFailure: { at: iso(due), reason: 'card_declined' } });
  db.invoices.push({ id: 'recorded_debt', number: 'INV-2026-002000', workspaceId: 'ws_billing', state: 'past_due', currency: 'USD', dueAt: iso(due), lines: [{ lineId: 'line_fixture', amount: 20 }], total: 20, subtotal: 20, tax: 0, payments: [{ id: 'recorded_failed', amount: 20, currency: 'USD', status: 'failed', at: iso(due) }], creditNotes: [], refunded: 0 });
  const before = clone(db), jobs = selectBillingDue({ db, at: due + DAY });
  assert.equal(jobs.length, 1); assert.ok(jobs[0].events.some(event => event.kind === 'debt_reconcile'));
  const next = runSelected(db, due + DAY);
  assert.deepEqual(db, before); assert.equal(next.invoices.length, 2); assert.equal(next.invoices[1].id, 'recorded_debt');
  assert.equal(next.invoices[1].total, 20); assert.equal(next.invoices[1].payments.length, 2);
  assert.equal(next.invoices[1].payments.at(-1).scheduledAt, iso(due + DAY));
  assert.deepEqual(next.invoices[0], before.invoices[0]); assert.deepEqual(selectBillingDue({ db: next, at: due + DAY }), []);
});

test('paid downgrade reuses an already issued invoice at the preserved original renewal boundary', () => {
  const db = fixture();
  db.plans.push({ id: 'billing_starter', tool: 'tasks', perUser: true, minSeats: 1, tier: 'starter', status: 'active', defaultUsd: { monthly: 4 } });
  line(db).scheduled = { kind: 'downgrade', planId: 'billing_starter', effectiveAt: iso(due) };
  const issued = { id: 'previously_issued', number: 'INV-2026-002000', workspaceId: 'ws_billing', state: 'open', kind: 'subscription', currency: 'USD', dueAt: iso(due), lines: [{ lineId: 'line_fixture', planId: 'billing_plan', amount: 20 }], total: 20, subtotal: 20, tax: 0, payments: [], creditNotes: [], refunded: 0 };
  db.invoices.push(issued);
  const paid = runSelected(db, due);
  assert.equal(paid.invoices.length, 2); assert.equal(paid.invoices[1].id, issued.id); assert.equal(paid.invoices[1].number, issued.number);
  assert.equal(paid.invoices[1].total, issued.total); assert.deepEqual(paid.invoices[1].lines, issued.lines);
  assert.equal(paid.invoices[1].payments.length, 1); assert.equal(paid.invoices[1].payments[0].amount, issued.total);
  assert.equal(line(paid).planId, 'billing_starter'); assert.equal(line(paid).periodStart, iso(due));
  assert.deepEqual(selectBillingDue({ db: paid, at: due }), []); assert.deepEqual(runSelected(paid, due).invoices, paid.invoices);
});

test('due selection is pure, deterministic and empty after a successful frozen-time renewal', () => {
  const db = fixture(), before = clone(db);
  assert.deepEqual(selectBillingDue({ db, at: start }), []);
  const jobs = selectBillingDue({ db, at: due });
  assert.deepEqual(selectBillingDue({ db, at: iso(due) }), jobs); assert.deepEqual(db, before);
  assert.equal(jobs.length, 1); assert.equal(jobs[0].workspaceId, 'ws_billing'); assert.equal(jobs[0].dueAt, iso(due));
  assert.match(jobs[0].operationId, /^auto-billing:[a-f0-9]{40}$/);
  const paid = runSelected(db, due), count = Object.keys(paid.billingLifecycle.operations).length;
  for (let attempt = 0; attempt < 3; attempt++) {
    assert.deepEqual(selectBillingDue({ db: paid, at: due }), []);
    assert.deepEqual(selectBillingDue({ db: paid, at: due + 1 }), []);
  }
  assert.equal(Object.keys(paid.billingLifecycle.operations).length, count); assert.equal(count, 1);
});

test('failed cycles select only unprocessed retries and exact dunning/retention boundaries', () => {
  let db = runSelected(fixture({ decline: true }), due);
  assert.deepEqual(selectBillingDue({ db, at: due }), []);
  for (const day of [1, 3, 5]) {
    const jobs = selectBillingDue({ db, at: due + day * DAY });
    assert.equal(jobs.length, 1); assert.ok(jobs[0].events.some(event => event.kind === 'payment_retry'));
    db = runSelected(db, due + day * DAY); assert.deepEqual(selectBillingDue({ db, at: due + day * DAY }), []);
  }
  assert.deepEqual(selectBillingDue({ db, at: due + 7 * DAY - 1 }), []);
  assert.ok(selectBillingDue({ db, at: due + 7 * DAY })[0].events.some(event => event.kind === 'read_only'));
  db = runSelected(db, due + 7 * DAY); assert.equal(line(db).state, 'read_only'); assert.deepEqual(selectBillingDue({ db, at: due + 7 * DAY }), []);
  db = runSelected(db, due + 37 * DAY); assert.equal(line(db).state, 'ended'); assert.equal(invoice(db).payments.length, 4);
  assert.deepEqual(selectBillingDue({ db, at: due + 37 * DAY }), []);
  const retentionAt = due + (37 + db.settings.retention.toolDays) * DAY;
  db = runSelected(db, retentionAt); assert.equal(line(db).state, 'deleted'); assert.deepEqual(selectBillingDue({ db, at: retentionAt }), []);
});

test('suspended and closed workspaces cannot select active renewal, trial or seat charges', () => {
  const db = fixture(), ws = db.workspaces[0]; ws.state = 'suspended';
  line(db).scheduledSeatChange = { quantity: 1, effectiveAt: iso(due), operationId: 'reduce' };
  ws.lines.push({ ...clone(line(db)), id: 'trial_suspended', state: 'trialing', trialEndsAt: iso(due), scheduledSeatChange: undefined });
  db.serviceRequests.push({ id: 'service_suspended', workspaceId: ws.id, state: 'in_review', deliveries: [{ autoApproveAt: iso(due) }] });
  assert.deepEqual(selectBillingDue({ db, at: due }), []);
  const unchanged = command(db, 'billing.run', due).db;
  assert.equal(unchanged.invoices.length, 1); assert.equal(line(unchanged).snapshot.quantity, 2);
  assert.equal(unchanged.workspaces[0].lines[1].state, 'trialing'); assert.equal(unchanged.serviceRequests[0].state, 'in_review');
  for (const state of ['cancelled', 'deleted']) { ws.state = state; assert.deepEqual(selectBillingDue({ db, at: due }), []); }
});

test('completed trial, cancellation, service and ticket markers do not create repeated jobs', () => {
  const db = fixture();
  Object.assign(line(db), { state: 'trialing', trialEndsAt: iso(due) });
  db.workspaces[0].lines.push({ ...clone(line(db)), id: 'cancel_fixture', state: 'cancelling', cancelAt: iso(due) });
  db.serviceRequests.push({ id: 'service_due', workspaceId: 'ws_billing', state: 'in_review', deliveries: [{ autoApproveAt: iso(due) }] });
  db.tickets.push({ id: 'ticket_due', workspaceId: 'ws_billing', state: 'waiting_for_you', autoCloseAt: iso(due) });
  const jobs = selectBillingDue({ db, at: due });
  assert.ok(jobs[0].events.some(event => event.kind === 'trial_end')); assert.ok(jobs[0].events.some(event => event.kind === 'ticket_close'));
  const next = runSelected(db, due);
  assert.equal(next.serviceRequests[0].state, 'completed'); assert.equal(next.tickets[0].state, 'closed');
  assert.equal(next.invoices.length, 1); assert.deepEqual(selectBillingDue({ db: next, at: due }), []);
});

test('global price publication selects one host job and completed markers settle every scoped poll', () => {
  const db = fixture(), second = clone(db.workspaces[0]); second.id = 'ws_second'; second.lines[0].id = 'line_second'; db.workspaces.push(second);
  const cell = 'tasks_pro:monthly:gcc', old = db.grid[cell];
  db.priceDrafts.push({ id: 'global_due', state: 'published', applyMode: 'existing_now', priceVersion: db.priceVersion + 1, effectiveAt: iso(start), changes: [{ key: cell, from: old, to: old + 1 }] });
  const jobs = selectBillingDue({ db, at: start });
  assert.equal(jobs.length, 1); assert.equal(jobs[0].events[0].kind, 'price_publication');
  assert.equal(selectBillingDue({ db, at: start, workspaceId: 'ws_second' }).length, 1);
  const published = runSelected(db, start);
  assert.equal(published.grid[cell], old + 1); assert.equal(published.priceDrafts[0].appliedAt, iso(start));
  assert.deepEqual(selectBillingDue({ db: published, at: start }), []);
  assert.deepEqual(selectBillingDue({ db: published, at: start, workspaceId: 'ws_second' }), []);
  assert.equal(Object.keys(published.billingLifecycle.operations).length, 1);
});

test('an unavailable scheduled downgrade fails without consuming its marker or issuing a replacement charge', () => {
  const db = fixture(), before = clone(db);
  line(db).scheduled = { kind: 'downgrade', planId: 'missing_plan', effectiveAt: iso(due) };
  before.workspaces[0].lines[0].scheduled = clone(line(db).scheduled);
  assert.throws(() => runSelected(db, due), { status: 503, code: 'scheduled_downgrade_unavailable' });
  assert.deepEqual(db, before);
});
