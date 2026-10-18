const assert = require("node:assert/strict");
const { test } = require("node:test");
const { makeStore } = require("./store");
const { advance, schedulePricePublication } = require("./lifecycle");
const DAY = 86400000;

function fixture(line) {
  const identity = { users: [], findByKey: () => null };
  const S = makeStore({ identity });
  let now = Date.parse("2026-10-07T09:00:00Z");
  S.now = () => now;
  const ws = S.workspace("ws_gulf"); ws.lines = [line]; ws.members = [{ userKey: null, email: "owner@fixture.test", role: "owner", status: "active" }];
  S.db.workspaces = [ws]; S.db.serviceRequests = []; S.db.tickets = [];
  return { S, ws, line, now: () => now, setNow: t => { now = t; } };
}

test("grace remains writable until its exact end, then read-only without duplicate transitions", () => {
  const f = fixture({ id: "ln_due", tool: "tasks", planId: "tasks_pro", cycle: "monthly", state: "past_due", snapshot: { amount: 60, unit: 30, quantity: 2, currency: "AED" } });
  const deadline = f.now() + 7 * DAY; f.line.graceEndsAt = f.S.iso(deadline);
  f.setNow(deadline - 1); advance(f.S); assert.equal(f.line.state, "past_due");
  f.setNow(deadline); advance(f.S); assert.equal(f.line.state, "read_only"); assert.equal(f.line.readOnlySince, f.S.iso(deadline));
  advance(f.S); assert.equal(f.S.db.audit.filter(a => a.action === "line_read_only").length, 1);
  f.setNow(deadline + 30 * DAY); advance(f.S); assert.equal(f.line.state, "ended");
  f.setNow(deadline + 60 * DAY); advance(f.S); assert.equal(f.line.state, "deleted");
});

test("late lifecycle execution preserves real grace/cancellation dates rather than extending retention", () => {
  const f = fixture({ id: "ln_late", tool: "files", planId: "files_pro", cycle: "monthly", state: "past_due", snapshot: { amount: 25, unit: 25, quantity: 1, currency: "AED" } });
  const start = f.now(); f.line.graceEndsAt = f.S.iso(start + 7 * DAY);
  f.setNow(start + 70 * DAY); advance(f.S);
  assert.equal(f.line.state, "deleted"); assert.equal(f.line.endedAt, f.S.iso(start + 37 * DAY));
});

test("downgrading never applies the previous plan's pending price or deletes recorded data", () => {
  const f = fixture({ id: "ln_dg", tool: "tasks", planId: "tasks_pro", cycle: "monthly", state: "active", snapshot: { amount: 58, unit: 29, quantity: 2, currency: "AED" } });
  f.ws.usage = { "tasks.projects": 12 };
  f.line.scheduled = { kind: "downgrade", planId: "tasks_free", effectiveAt: f.S.iso(f.now()) };
  f.line.scheduledPrice = { kind: "price_change", effectiveAt: f.S.iso(f.now() + DAY), snapshot: { amount: 100, unit: 50, quantity: 2, currency: "AED" } };
  advance(f.S); assert.equal(f.line.planId, "tasks_free"); assert.equal(f.line.snapshot.amount, 0);
  assert.equal(f.line.overLimits[0].excess, 9); assert.equal(f.ws.usage["tasks.projects"], 12); assert.equal(f.line.scheduledPrice, undefined);
  f.setNow(f.now() + DAY); advance(f.S); assert.equal(f.line.snapshot.amount, 0);
});

test("price notices use real renewal intervals and do not reserve duplicate notifications", () => {
  const f = fixture({ id: "ln_notice", tool: "chat", planId: "chat_pro", cycle: "monthly", state: "active", periodEnd: "2026-10-17T09:00:00Z", snapshot: { amount: 44, unit: 44, quantity: 1, currency: "AED" } });
  const draft = { id: "pd_fixture", changes: [{ key: "chat_pro:monthly:gcc", from: 45, to: 50 }], state: "published", applyMode: "existing_next_renewal", priceVersion: 2, effectiveAt: f.S.iso(f.now()) };
  schedulePricePublication(f.S, draft); schedulePricePublication(f.S, draft);
  assert.equal(f.line.scheduled.effectiveAt, "2026-11-16T09:00:00.000Z");
  assert.equal(f.S.db.notifications.filter(n => n.eventKey === "price:pd_fixture:ln_notice").length, 1);
  assert.equal(f.S.db.mailbox.filter(n => n.eventKey === "price:pd_fixture:ln_notice").length, 1);
});

test('scoped advancement preserves other workspace schedules, service deliveries and ticket deadlines', () => {
  const f = fixture({ id: 'trial_a', tool: 'tasks', planId: 'tasks_pro', cycle: 'monthly', state: 'trialing', trialEndsAt: '2026-10-07T09:00:00.000Z', snapshot: { amount: 58, unit: 29, quantity: 2, currency: 'AED' } });
  const other = structuredClone(f.ws); other.id = 'ws_other'; other.lines[0].id = 'trial_b'; f.S.db.workspaces.push(other);
  const deadline = f.S.iso(f.now());
  f.S.db.serviceRequests = [f.ws, other].map(ws => ({ id: `service:${ws.id}`, workspaceId: ws.id, state: 'in_review', deliveries: [{ autoApproveAt: deadline }] }));
  f.S.db.tickets = [f.ws, other].map(ws => ({ id: `ticket:${ws.id}`, workspaceId: ws.id, state: 'waiting_for_you', autoCloseAt: deadline }));
  advance(f.S, { workspaceId: f.ws.id });
  assert.equal(f.ws.lines[0].state, 'free'); assert.equal(other.lines[0].state, 'trialing');
  assert.equal(f.S.db.serviceRequests[0].state, 'completed'); assert.equal(f.S.db.serviceRequests[1].state, 'in_review');
  assert.equal(f.S.db.tickets[0].state, 'closed'); assert.equal(f.S.db.tickets[1].state, 'waiting_for_you');
  advance(f.S, { workspaceId: other.id });
  assert.equal(other.lines[0].state, 'free'); assert.equal(f.S.db.serviceRequests[1].state, 'completed'); assert.equal(f.S.db.tickets[1].state, 'closed');
});

test('a scoped billing pass applies a published global price to every affected workspace once', () => {
  const f = fixture({ id: 'price_a', tool: 'tasks', planId: 'tasks_pro', cycle: 'monthly', state: 'active', periodEnd: '2026-11-06T09:00:00.000Z', snapshot: { amount: 58, unit: 29, quantity: 2, currency: 'AED' } });
  Object.assign(f.line.snapshot, f.S.resolveForWorkspace('tasks_pro', f.ws, 'monthly', 2));
  const other = structuredClone(f.ws); other.id = 'ws_other'; other.lines[0].id = 'price_b';
  Object.assign(other.lines[0].snapshot, f.S.resolveForWorkspace('tasks_pro', other, 'monthly', 3));
  other.lines[0].scheduled = { kind: 'downgrade', planId: 'tasks_free', effectiveAt: f.S.iso(f.now()) }; f.S.db.workspaces.push(other);
  const cell = 'tasks_pro:monthly:gcc';
  const draft = { id: 'pd_global', state: 'published', applyMode: 'existing_now', priceVersion: f.S.db.priceVersion + 1, effectiveAt: f.S.iso(f.now()), changes: [{ key: cell, from: f.S.db.grid[cell], to: f.S.db.grid[cell] + 5 }] };
  f.S.db.priceDrafts = [draft];
  advance(f.S, { workspaceId: f.ws.id });
  assert.equal(f.line.snapshot.amount, f.S.resolveForWorkspace('tasks_pro', f.ws, 'monthly', 2).amount);
  assert.equal(other.lines[0].snapshot.amount, f.S.resolveForWorkspace('tasks_pro', other, 'monthly', 3).amount);
  assert.equal(other.lines[0].snapshot.quantity, 3); assert.equal(other.lines[0].scheduled.kind, 'downgrade');
  const appliedAt = draft.appliedAt; advance(f.S, { workspaceId: f.ws.id });
  assert.equal(draft.appliedAt, appliedAt); assert.equal(f.S.db.audit.filter(row => row.action === 'price_effective').length, 1);
});
