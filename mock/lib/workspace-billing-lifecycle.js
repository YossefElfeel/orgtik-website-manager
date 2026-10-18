// Deterministic candidate reducer. The shared writer authorizes the actor and atomically
// persists the returned DB; this module never commits, calls a provider or changes a clock.
const crypto = require("node:crypto");
const pricing = require("../apps/admin/pricing");
const { advance } = require("../apps/admin/lifecycle");
const DAY = 86400000;
const RETRY_DAYS = [1, 3, 5];
const clone = value => JSON.parse(JSON.stringify(value));
const failure = (status, code, message) => Object.assign(new Error(message), { status, code });
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const hash = value => crypto.createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
const id = (kind, value) => `r1_${kind}_${hash(value).slice(0, 24)}`;
const iso = value => new Date(value).toISOString();
const live = line => !["ended", "deleted"].includes(line.state);
const permitted = new Set(["billing.run", "billing.recover", "billing.seats.quote", "billing.seats.confirm", "billing.seats.reduce", "billing.seats.cancel-reduction"]);
const debt = line => ['past_due', 'read_only'].includes(line.state);
function unpaidInvoiceFor(db, workspace, line) {
  const anchor = Date.parse(line.billingRenewalDueAt || line.periodEnd);
  return (db.invoices || []).find(invoice => {
    if (invoice.workspaceId !== workspace.id || !['open', 'past_due'].includes(invoice.state)) return false;
    if (!Array.isArray(invoice.lines)) throw failure(503, 'billing_invoice_allocation_required', 'The recorded invoice allocation is unavailable; no replacement charge was created.');
    return invoice.lines.some(row => row.lineId === line.id) && (debt(line) || Date.parse(invoice.dueAt) === anchor);
  });
}
function renewalBoundary(db, workspace, line) {
  return Date.parse(debt(line) ? line.lastFailure?.at || unpaidInvoiceFor(db, workspace, line)?.dueAt || line.periodEnd : line.billingRenewalDueAt || line.periodEnd);
}

// A read-only planner for the trusted preflight. A pending obligation is not necessarily
// work: failed cycles wait for their next unprocessed retry or dunning deadline.
function selectBillingDue({ db, at, workspaceId }) {
  const observed = typeof at === 'number' ? at : Date.parse(at);
  if (!Number.isFinite(observed) || !Array.isArray(db?.workspaces)) throw failure(503, 'billing_state_unavailable', 'A valid billing snapshot and server instant are required.');
  const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  const workspaces = db.workspaces.filter(ws => (workspaceId === undefined || ws.id === workspaceId) && !['cancelled', 'deleted'].includes(ws.state)).sort((a, b) => compare(a.id, b.id));
  const deadlines = value => {
    const parsed = typeof value === 'number' ? value : Date.parse(value);
    if (!Number.isFinite(parsed)) throw failure(503, 'renewal_boundary_unavailable', 'A recorded billing transition boundary is unavailable.');
    return parsed;
  };
  const published = (db.priceDrafts || []).filter(draft => draft.state === 'published' && !draft.appliedAt && deadlines(draft.effectiveAt) <= observed);
  const noticed = key => (db.notifications || []).some(row => row.eventKey === key);
  const jobs = [];
  for (const ws of workspaces) {
    const events = [], suspended = ws.state === 'suspended';
    const add = (kind, key, when, lineId) => {
      const time = deadlines(when);
      if (time <= observed && !events.some(event => event.key === key)) events.push({ kind, key, at: iso(time), ...(lineId ? { lineId } : {}) });
    };
    // Price publication is global, and the full DB is passed to advance. Assign it
    // once in an all-workspace scan; a scoped caller can also trigger the same work.
    if (ws === workspaces[0]) for (const draft of published) add('price_publication', `price:${draft.id}:${draft.priceVersion}:${draft.effectiveAt}`, draft.effectiveAt);
    for (const line of ws.lines || []) {
      if (!suspended) {
        if (line.state === 'active' && line.scheduled?.kind === 'downgrade') add('downgrade', `${line.id}:downgrade:${line.scheduled.planId}:${line.scheduled.effectiveAt}`, line.scheduled.effectiveAt, line.id);
        const priceChange = line.scheduledPrice || (line.scheduled?.kind === 'price_change' ? line.scheduled : null);
        if (['active', 'cancelling'].includes(line.state) && priceChange?.snapshot) add('line_price', `${line.id}:price:${priceChange.draftId}:${priceChange.effectiveAt}`, priceChange.effectiveAt, line.id);
        if (line.state === 'trialing') add('trial_end', `${line.id}:trial:${line.trialEndsAt}`, line.trialEndsAt, line.id);
        if (line.state === 'cancelling') add('term_end', `${line.id}:cancel:${line.cancelAt}`, line.cancelAt, line.id);
        if (line.state === 'active' && line.scheduledSeatChange) add('seat_reduction', `${line.id}:seats:${line.scheduledSeatChange.operationId}:${line.scheduledSeatChange.effectiveAt}`, line.scheduledSeatChange.effectiveAt, line.id);
        if (line.state === 'active') add(line.autoRenew === false ? 'term_end' : 'renewal', `${line.id}:renewal:${iso(deadlines(renewalBoundary(db, ws, line)))}`, renewalBoundary(db, ws, line), line.id);
      }
      if (debt(line)) {
        const dueAt = deadlines(renewalBoundary(db, ws, line)), cycleKey = `renewal:${ws.id}:${line.id}:${iso(dueAt)}`;
        const cycle = db.billingLifecycle?.cycles?.[cycleKey];
        if (!cycle) add('debt_reconcile', `${cycleKey}:reconcile`, dueAt, line.id);
        const policy = db.settings?.dunning;
        if (!Number.isSafeInteger(policy?.graceDays) || policy.graceDays < 0 || !Number.isSafeInteger(policy?.cancelAfterDays) || policy.cancelAfterDays <= policy.graceDays) throw failure(503, 'dunning_policy_unavailable', 'A valid grace and cancellation policy is required.');
        const graceAt = dueAt + policy.graceDays * DAY, endAt = dueAt + policy.cancelAfterDays * DAY;
        if (cycle) {
          if (!Array.isArray(cycle.retriesDone)) throw failure(503, 'billing_ledger_unavailable', 'The recorded retry markers are unavailable.');
          if (line.graceEndsAt !== iso(graceAt)) add('debt_metadata', `${cycleKey}:grace`, dueAt, line.id);
          if (!suspended && observed < endAt && !cycle.paid) {
            if (!cycle.initialDone) add('payment_initial', `${cycle.paymentKey || cycleKey}:initial`, dueAt, line.id);
            for (const day of RETRY_DAYS) if (!cycle.retriesDone.includes(day)) add('payment_retry', `${cycle.paymentKey || cycleKey}:retry:${day}`, dueAt + day * DAY, line.id);
          }
        }
        if (line.state !== 'read_only' || line.readOnlySince !== iso(graceAt) || !noticed(`${cycleKey}:read_only`)) add('read_only', `${cycleKey}:read_only`, graceAt, line.id);
        add('subscription_end', `${cycleKey}:ended`, endAt, line.id);
      }
      if (line.state === 'ended') {
        const days = db.settings?.retention?.toolDays;
        if (!Number.isFinite(days) || days < 0) throw failure(503, 'retention_policy_unavailable', 'A valid subscription retention policy is required.');
        add('line_retention', `${line.id}:retention:${line.endedAt}`, deadlines(line.endedAt) + days * DAY, line.id);
      }
    }
    if (!suspended) {
      for (const request of db.serviceRequests || []) if (request.workspaceId === ws.id && request.state === 'in_review' && request.deliveries?.at(-1)?.autoApproveAt) add('service_approval', `service:${request.id}:${request.deliveries.at(-1).autoApproveAt}`, request.deliveries.at(-1).autoApproveAt);
      for (const ticket of db.tickets || []) if (ticket.workspaceId === ws.id) {
        if (ticket.state === 'waiting_for_you' && ticket.autoCloseAt) add('ticket_close', `ticket:${ticket.id}:${ticket.autoCloseAt}`, ticket.autoCloseAt);
        if (ticket.state === 'resolved' && ticket.reopenUntil) add('ticket_close', `ticket:${ticket.id}:${ticket.reopenUntil}`, ticket.reopenUntil);
      }
    }
    if (events.length) {
      events.sort((a, b) => compare(a.at, b.at) || compare(a.key, b.key));
      jobs.push({ workspaceId: ws.id, dueAt: events[0].at, events, operationId: `auto-billing:${hash([ws.id, iso(observed), events.map(event => event.key)]).slice(0, 40)}` });
    }
  }
  return jobs;
}

function executeBillingCommand({ db: original, command, authority }) {
  if (!command || !permitted.has(command.kind) || typeof command.operationId !== "string" || !command.operationId || !command.workspaceId || !Number.isFinite(Date.parse(command.at))) throw failure(422, "invalid_billing_command", "Supply a recorded billing command and operation ID.");
  if (!authority || authority.workspaceId !== command.workspaceId || authority.readOnly || authority.revoked || (command.kind === "billing.run" ? authority.kind !== "system" : authority.canManageBilling !== true)) throw failure(403, "billing_forbidden", "Current workspace billing authority is required.");
  const allowed = new Set(["kind", "workspaceId", "operationId", "at", "lineId", "paymentMethodId", "quantity", "quoteId", "outcomes"]);
  if (Object.keys(command).some(key => !allowed.has(key))) throw failure(422, "invalid_billing_command", "Only server command fields are accepted; browser totals are not billing input.");
  const db = clone(original), ws = db.workspaces?.find(row => row.id === command.workspaceId);
  if (!ws || ["cancelled", "deleted"].includes(ws.state)) throw failure(404, "workspace_not_found", "This billing workspace is unavailable.");
  const at = Date.parse(command.at), decimals = db.currencies?.[ws.currency]?.decimals;
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 4) throw failure(503, "billing_currency_unavailable", "Workspace currency precision is unavailable.");
  const money = value => pricing.toDecimals(value, decimals);
  const validAmount = value => Number.isFinite(value) && value >= 0 && Number.isSafeInteger(Math.round(value * 10 ** decimals));
  const number = invoice => Number(String(invoice.number || "").match(/^INV-\d{4}-(\d+)$/)?.[1]) || 0;
  const minimumNumber = Math.max(1040, ...(db.invoices || []).map(number)) + 1;
  db.billingLifecycle ??= { version: 1, nextInvoiceNumber: minimumNumber, operations: {}, cycles: {}, seatQuotes: {} };
  const ledger = db.billingLifecycle;
  if (ledger.version !== 1 || !Number.isSafeInteger(ledger.nextInvoiceNumber) || ledger.nextInvoiceNumber < minimumNumber || !ledger.operations || !ledger.cycles || !ledger.seatQuotes) throw failure(503, "billing_ledger_unavailable", "The billing ledger is incomplete.");
  db.invoices ??= []; db.notifications ??= []; db.mailbox ??= []; db.audit ??= [];
  const actor = authority.kind === "system" ? "system" : authority.userId;
  if (actor === undefined || actor === null) throw failure(403, "billing_forbidden", "A verified billing actor is required.");
  const operationKey = hash([ws.id, actor, command.operationId]);
  const payload = { ...command }; if (command.kind !== "billing.run") delete payload.at;
  const fingerprint = hash(payload), receipt = ledger.operations[operationKey];
  if (receipt) {
    if (receipt.fingerprint !== fingerprint) throw failure(409, "billing_operation_changed", "Retry the original billing attempt unchanged.");
    return { db, effects: [], result: clone(receipt.result), duplicate: true };
  }
  const effects = [];
  function notice(kind, line, eventKey, when, details = {}, workspace = ws) {
    if (db.notifications.some(row => row.eventKey === eventKey)) return;
    const owner = workspace.members?.find(member => member.role === "owner" && member.status === "active");
    const data = { workspaceId: workspace.id, kind, lineId: line.id, tool: line.tool, eventKey, at: iso(when), ...details };
    db.notifications.push({ id: id("notice", eventKey), ...data, userKey: owner?.userKey ?? null, read: false });
    db.mailbox.push({ id: id("mail", eventKey), ...data, to: owner?.email || workspace.billing?.email || null, template: kind, delivery: "mock" });
    effects.push({ kind: "billing.notice", eventKey, workspaceId: workspace.id, lineId: line.id });
  }
  function audit(action, line, eventKey, when, details = {}) {
    if (db.audit.some(row => row.eventKey === eventKey)) return;
    db.audit.push({ at: iso(when), by: actor, action, target: line.id, workspaceId: ws.id, eventKey, ...details });
  }
  function counts(line) {
    return {
      assigned: (ws.members || []).filter(member => member.status === "active" && member.toolGrants?.[line.tool]?.assigned === true).length,
      reserved: (ws.invitations || []).filter(invite => invite.status === "pending" && Date.parse(invite.expiresAt) > at && invite.reservations?.includes(line.tool)).length,
    };
  }
  function getLine() {
    const line = ws.lines.find(row => row.id === command.lineId && live(row));
    if (!line) throw failure(404, "line_not_found", "The subscription line is unavailable.");
    return line;
  }
  function planFor(line) {
    if (!line || !live(line)) throw failure(404, "line_not_found", "The subscription line is unavailable.");
    const plan = db.plans.find(row => row.id === line.planId && (!row.workspaceId || row.workspaceId === ws.id));
    if (!plan || !line.snapshot || line.snapshot.currency !== ws.currency || !Number.isSafeInteger(line.snapshot.quantity) || line.snapshot.quantity < 1 || !validAmount(line.snapshot.amount)) throw failure(503, "line_price_unavailable", "The stored subscription price is unavailable.");
    return plan;
  }
  function quoteFor(line, amount, { bundle = true, credit = 0, factor = 1 } = {}) {
    const offered = bundle && db.bundles?.find(row => row.active && row.planIds.includes(line.planId) && row.planIds.every(planId => ws.lines.some(candidate => candidate.planId === planId && ["active", "past_due", "read_only", "cancelling"].includes(candidate.state))));
    const tax = pricing.taxForWorkspace(db, ws);
    const totals = pricing.totals({ lines: [{ amount, prorationFactor: factor, credit }], currency: ws.currency, decimals, bundlePct: offered?.pct || 0, tax });
    if (ws.billingCredit > 0 && ws.billingCreditCurrency && ws.billingCreditCurrency !== ws.currency) throw failure(409, "credit_migration_required", "Workspace credit must retain its recorded currency.");
    const accountCreditUsed = money(Math.min(ws.billingCredit || 0, totals.prorated));
    if (accountCreditUsed) {
      const reduced = pricing.totals({ lines: [{ amount: money(totals.prorated - accountCreditUsed) }], currency: ws.currency, decimals, tax });
      Object.assign(totals, { prorated: reduced.prorated, net: reduced.net, tax: reduced.tax, total: reduced.total });
    }
    if (![totals.total, totals.net, totals.tax].every(validAmount)) throw failure(503, "billing_amount_unavailable", "The billing amount exceeds currency limits.");
    return { ...totals, amount, factor, credit, accountCreditUsed, taxRate: tax.rate, taxDisplay: tax.inclusive ? "inclusive" : "exclusive", taxLabel: tax.label, reverseCharge: tax.reverseCharge };
  }
  function invoiceFor(line, key, due, quote, kind) {
    const charge = money(quote.amount * quote.factor), discounted = money(quote.lineAmounts[0].discounted * quote.factor);
    const lines = [{ label: line.planId, lineId: line.id, planId: line.planId, kind: "charge", amount: charge, quantity: line.snapshot.quantity }];
    if (charge - discounted) lines.push({ label: "Bundle", lineId: line.id, kind: "bundle_discount", amount: -money(charge - discounted) });
    if (quote.credit) lines.push({ label: "Unused period credit", lineId: line.id, kind: "period_credit", amount: -quote.credit });
    if (quote.accountCreditUsed) lines.push({ label: "Workspace credit applied", lineId: line.id, kind: "account_credit", amount: -quote.accountCreditUsed });
    if (quote.creditRemaining) lines.push({ label: "Credit carried forward", lineId: line.id, kind: "credit_carried", amount: quote.creditRemaining });
    if (quote.taxDisplay === "inclusive" && quote.taxRate) for (const row of lines) row.amount = money(row.amount / (1 + quote.taxRate / 100));
    const rounding = money(quote.net - lines.reduce((sum, row) => sum + row.amount, 0));
    if (rounding) { lines[0].amount = money(lines[0].amount + rounding); lines[0].roundingAdjustment = rounding; }
    const invoice = { id: id("invoice", key), number: `INV-${new Date(due).getUTCFullYear()}-${String(ledger.nextInvoiceNumber++).padStart(6, "0")}`, workspaceId: ws.id, kind, state: "open", currency: ws.currency, issuedAt: iso(at), dueAt: iso(due), lines, subtotal: quote.net, quotedSubtotal: quote.subtotal, bundleDiscount: quote.bundleDiscount, couponDiscount: 0, tax: quote.tax, taxRate: quote.taxRate, taxDisplay: quote.taxDisplay, taxLabel: quote.taxLabel, reverseCharge: quote.reverseCharge, total: quote.total, accountCreditUsed: quote.accountCreditUsed, creditRemaining: quote.creditRemaining, payments: [], creditNotes: [], refunded: 0, billingEventKey: key };
    db.invoices.push(invoice);
    return invoice;
  }
  function creditUsed(quote) {
    ws.billingCredit = money((ws.billingCredit || 0) - quote.accountCreditUsed + quote.creditRemaining);
    ws.billingCreditCurrency = ws.currency;
  }
  function methodFor(explicit) {
    return ws.paymentMethods?.find(method => method.id === explicit) || (!explicit && ws.paymentMethods?.find(method => method.isDefault));
  }
  function payment(invoice, eventKey, scheduledAt, explicitMethod, recurring) {
    const existing = invoice.payments.find(row => row.billingEventKey === eventKey); if (existing) return existing.status === "succeeded";
    if (invoice.total === 0) { invoice.state = "paid"; invoice.paidAt = iso(at); return true; }
    const method = methodFor(explicitMethod), gateway = method && db.gateways?.filter(row => row.active && row.methods.includes(method.kind) && row.currencies.includes(invoice.currency) && (row.countries.includes(ws.country) || row.countries.includes("*")) && (!recurring || row.recurring && !["cash_code", "knet"].includes(method.kind))).sort((a, b) => a.priority - b.priority)[0];
    const expiry = method?.expires && /^(0[1-9]|1[0-2])\/(\d{2}|\d{4})$/.exec(method.expires);
    const expired = method?.expired || expiry && Date.UTC(Number(expiry[2]) + (expiry[2].length === 2 ? 2000 : 0), Number(expiry[1]), 1) <= at;
    const forced = command.outcomes?.[eventKey], failed = forced === "failed" || !method || expired || method.last4 === "0002" || !gateway;
    if (forced !== undefined && !["failed", "succeeded"].includes(forced)) throw failure(422, "invalid_mock_payment", "Use a deterministic mock payment outcome.");
    const usdRate = invoice.currency === "USD" ? 1 : pricing.rate(db, "USD", invoice.currency);
    if (!failed && (!Number.isFinite(usdRate) || usdRate <= 0)) throw failure(503, "payment_rate_unavailable", "The recorded USD payment rate is unavailable; nothing was charged.");
    const record = { id: id("payment", eventKey), amount: invoice.total, currency: invoice.currency, method: method?.kind || null, gateway: gateway?.id || null, paymentMethodId: method?.id || null, at: iso(at), scheduledAt: iso(scheduledAt), status: failed ? "failed" : "succeeded", billingEventKey: eventKey, ...(failed ? { reason: !method ? "payment_method_missing" : expired ? "card_expired" : !gateway ? "payment_link_required" : "card_declined" } : { usdRate, usdAmount: pricing.toDecimals(invoice.total / usdRate, 2) }) };
    invoice.payments.push(record); effects.push({ kind: "billing.payment", workspaceId: ws.id, invoiceId: invoice.id, paymentId: record.id, status: record.status });
    invoice.state = failed ? "past_due" : "paid"; if (!failed) invoice.paidAt = iso(at);
    return !failed;
  }
  function policy() {
    const dunning = db.settings?.dunning;
    if (!dunning || !Number.isSafeInteger(dunning.graceDays) || dunning.graceDays < 0 || !Number.isSafeInteger(dunning.cancelAfterDays) || dunning.cancelAfterDays <= dunning.graceDays) throw failure(503, "dunning_policy_unavailable", "A valid grace and cancellation policy is required.");
    return dunning;
  }
  function progress(line, cycle) {
    const dunning = policy(), grace = Date.parse(cycle.dueAt) + dunning.graceDays * DAY, end = Date.parse(cycle.dueAt) + dunning.cancelAfterDays * DAY;
    line.graceEndsAt = iso(grace);
    if (at >= grace) {
      notice("read_only", line, `${cycle.key}:read_only`, grace);
      audit("line_read_only", line, `${cycle.key}:read_only`, grace);
    }
    if (at >= end) {
      if (live(line)) { line.state = "ended"; line.endedAt = iso(end); }
      notice("subscription_ended", line, `${cycle.key}:ended`, end); audit("subscription_ended", line, `${cycle.key}:ended`, end);
    } else if (at >= grace && (line.state !== "read_only" || line.readOnlySince !== iso(grace))) {
      line.state = "read_only"; line.readOnlySince = iso(grace);
      notice("read_only", line, `${cycle.key}:read_only`, grace); audit("line_read_only", line, `${cycle.key}:read_only`, grace);
    }
  }
  function restoreOne(line, cycle, invoice) {
    line.state = "active"; line.periodStart = cycle.dueAt; line.periodEnd = cycle.periodEnd;
    line.snapshot = { ...line.snapshot, amount: cycle.amount, unit: cycle.amount / line.snapshot.quantity, periodAmount: cycle.periodAmount };
    if (cycle.months) {
      if (line.prepaidTerms?.length) { line.paidTermHistory ??= []; line.paidTermHistory.push(...clone(line.prepaidTerms)); delete line.prepaidTerms; }
      line.termMonths = cycle.months;
      if (cycle.sourceReference) line.source.reference = cycle.sourceReference;
    }
    delete line.graceEndsAt; delete line.readOnlySince; delete line.lastFailure;
    cycle.paid = true; cycle.paidAt = invoice.paidAt;
    delete line.billingRenewalDueAt;
    ws.currencyLocked = true;
    notice(invoice.payments.some(row => row.status === "failed") ? "payment_recovered" : "renewal_paid", line, `${cycle.paymentKey || cycle.key}:paid`, at, { invoiceId: invoice.id });
    audit("renewal_paid", line, `${cycle.key}:paid`, at, { invoiceId: invoice.id });
  }
  function restore(line, cycle, invoice) {
    const linked = Object.values(ledger.cycles).filter(row => row.workspaceId === ws.id && row.invoiceId === invoice.id);
    for (const row of linked) {
      const target = ws.lines.find(candidate => candidate.id === row.lineId);
      if (!target || !live(target)) throw failure(503, "billing_invoice_allocation_required", "Review the recorded invoice allocation before restoring subscription access.");
      restoreOne(target, row, invoice);
    }
  }
  function cycleFor(line) {
    const unpaid = unpaidInvoiceFor(db, ws, line);
    const due = renewalBoundary(db, ws, line);
    if (!Number.isFinite(due)) throw failure(503, "renewal_boundary_unavailable", "The subscription renewal boundary is unavailable.");
    const key = `renewal:${ws.id}:${line.id}:${iso(due)}`;
    if (ledger.cycles[key]) return ledger.cycles[key];
    if (!unpaid && ["past_due", "read_only"].includes(line.state)) throw failure(503, "billing_invoice_unavailable", "The historical unpaid invoice is missing; no replacement charge was created.");
    const billedIds = unpaid ? [...new Set(unpaid.lines.filter(row => row.lineId && (!row.kind || row.kind === "charge")).map(row => row.lineId))] : [line.id];
    if (unpaid && (!Array.isArray(unpaid.payments) || unpaid.payments.some(row => row.status === "succeeded") || billedIds.some(lineId => {
      const target = ws.lines.find(candidate => candidate.id === lineId);
      const boundary = target && Date.parse(["past_due", "read_only"].includes(target.state) ? target.lastFailure?.at || unpaid.dueAt || target.periodEnd : target.billingRenewalDueAt || target.periodEnd);
      return !target || !live(target) || boundary !== due;
    }))) throw failure(503, "billing_invoice_allocation_required", "Review the recorded invoice allocation before attempting payment.");
    planFor(line);
    const days = line.renewalMonths || line.termMonths ? (line.renewalMonths || line.termMonths) * 30 : pricing.periodDays(line.cycle);
    const newestPrepaid = line.prepaidTerms?.at(-1);
    const paidOrder = newestPrepaid && db.publicWebsiteOrders?.find(row => row.snapshot?.reference === newestPrepaid.reference)?.snapshot;
    const currentPriceVersion = line.snapshot.priceVersion || 0;
    const renewalAmount = newestPrepaid && currentPriceVersion <= (paidOrder?.policy?.priceVersion || currentPriceVersion) ? newestPrepaid.amount : line.snapshot.amount;
    const quote = unpaid ? null : quoteFor(line, renewalAmount, { bundle: line.source?.policy !== "website-offers-v1" });
    const invoice = unpaid || invoiceFor(line, key, due, quote, "subscription");
    if (quote) creditUsed(quote); // Credit settles part of this issued obligation once, even when the remainder fails.
    const cycle = { key, paymentKey: billedIds.length > 1 ? `legacy-invoice:${ws.id}:${invoice.id}` : key, workspaceId: ws.id, lineId: line.id, dueAt: iso(due), periodEnd: iso(due + days * DAY), invoiceId: invoice.id, amount: renewalAmount, periodAmount: quote?.lineAmounts[0].discounted ?? line.snapshot.periodAmount ?? line.snapshot.amount, months: line.renewalMonths || line.termMonths || null, sourceReference: newestPrepaid?.reference || line.source?.reference || null, retriesDone: [], initialDone: invoice.payments.length > 0, paid: false };
    ledger.cycles[key] = cycle;
    for (const lineId of billedIds) if (lineId !== line.id) cycleFor(ws.lines.find(candidate => candidate.id === lineId));
    notice("invoice_issued", line, `${cycle.paymentKey}:invoice`, due, { invoiceId: invoice.id });
    return cycle;
  }
  function runLine(line) {
    let iterations = 0;
    while (live(line) && ["active", "past_due", "read_only"].includes(line.state) && renewalBoundary(db, ws, line) <= at) {
      if (++iterations > 24) throw failure(503, "billing_backlog_review_required", "Review the renewal backlog before charging additional periods.");
      if (line.autoRenew === false && line.state === "active") {
        const endedAt = iso(renewalBoundary(db, ws, line));
        line.state = "ended"; line.endedAt = endedAt;
        notice("subscription_ended", line, `term:${ws.id}:${line.id}:${endedAt}`, Date.parse(endedAt)); break;
      }
      const cycle = cycleFor(line), invoice = db.invoices.find(row => row.id === cycle.invoiceId);
      if (!invoice) throw failure(503, "billing_invoice_unavailable", "The recorded renewal invoice is unavailable.");
      if (!cycle.initialDone) {
        cycle.initialDone = true;
        if (payment(invoice, `${cycle.paymentKey || cycle.key}:initial`, Date.parse(cycle.dueAt), null, true)) { restore(line, cycle, invoice); continue; }
      }
      line.state = line.state === "read_only" ? "read_only" : "past_due";
      line.periodEnd = cycle.dueAt;
      line.lastFailure ??= { at: cycle.dueAt, reason: invoice.payments.at(-1)?.reason || "payment_failed" };
      notice("payment_failed", line, `${cycle.paymentKey || cycle.key}:failed`, Date.parse(cycle.dueAt), { invoiceId: invoice.id });
      progress(line, cycle); if (!live(line)) break;
      for (const day of RETRY_DAYS) {
        const scheduled = Date.parse(cycle.dueAt) + day * DAY;
        if (scheduled > at || cycle.retriesDone.includes(day)) continue;
        cycle.retriesDone.push(day);
        if (payment(invoice, `${cycle.paymentKey || cycle.key}:retry:${day}`, scheduled, null, true)) { restore(line, cycle, invoice); break; }
        notice("payment_retry_failed", line, `${cycle.paymentKey || cycle.key}:retry:${day}:failed`, scheduled, { invoiceId: invoice.id, retryDay: day });
      }
      if (!cycle.paid) { progress(line, cycle); break; }
    }
  }
  function seatContext(line) { return hash({ workspace: ws.id, state: ws.state, country: ws.country, currency: ws.currency, billing: ws.billing, credit: ws.billingCredit, creditCurrency: ws.billingCreditCurrency, line, counts: counts(line) }); }
  function assertSeatQuantity(line, quantity, { increase = false } = {}) {
    const plan = planFor(line), used = counts(line);
    if (!plan.perUser || plan.private || plan.contractedQuantity) throw failure(409, "capacity_quote_required", "This contracted or fixed-price capacity needs its own approved plan quote.");
    if (!Number.isSafeInteger(quantity) || quantity < Math.max(plan.minSeats || 1, used.assigned + used.reserved) || increase && quantity <= line.snapshot.quantity) throw failure(422, "invalid_capacity", "Purchased capacity must cover assigned and reserved seats.");
    return plan;
  }
  let result;
  if (command.kind === "billing.run") {
    const dueDowngrades = new Map(ws.lines.filter(line => ws.state !== 'suspended' && line.state === "active" && line.scheduled?.kind === "downgrade" && Date.parse(line.scheduled.effectiveAt) <= at).map(line => [line.id, line.scheduled.effectiveAt]));
    // Existing R0 publication, downgrade, trial, service/ticket and retention reducers run
    // only here, under system authority, against this command's private candidate.
    for (const line of ws.lines.filter(line => ["past_due", "read_only"].includes(line.state))) progress(line, cycleFor(line));
    advance({ db, pricing, now: () => at, iso, resolveForWorkspace: (planId, workspace, cycle, quantity) => {
      const plan = db.plans.find(row => row.id === planId);
      if (plan?.private && (plan.workspaceId !== workspace.id || plan.private.currency !== workspace.currency || plan.private.cycle && plan.private.cycle !== cycle)) return null;
      return pricing.resolveWorkspaceLine(db, { planId, cycle, workspace, seats: quantity });
    },
      log(by, action, target, extra = {}) { const eventKey = id("transition", [action, target, extra, at]); if (!db.audit.some(row => row.eventKey === eventKey)) db.audit.push({ at: iso(at), by, action, target, ...extra, eventKey }); },
      notifyOwner(workspace, kind, details, eventKey) { notice(kind, { id: details.lineId, tool: workspace.lines.find(line => line.id === details.lineId)?.tool }, eventKey, at, details, workspace); },
    }, { workspaceId: ws.id });
    for (const line of ws.lines) {
      if (dueDowngrades.has(line.id) && line.state === "active") line.billingRenewalDueAt = dueDowngrades.get(line.id);
      if (ws.state !== 'suspended' && line.scheduledSeatChange && Date.parse(line.scheduledSeatChange.effectiveAt) <= at && line.state === "active") {
        const change = line.scheduledSeatChange; assertSeatQuantity(line, change.quantity);
        const ratio = change.quantity / line.snapshot.quantity;
        line.snapshot = { ...line.snapshot, quantity: change.quantity, amount: money(line.snapshot.amount * ratio), periodAmount: money((line.snapshot.periodAmount ?? line.snapshot.amount) * ratio) };
        delete line.scheduledSeatChange;
        notice("capacity_reduced", line, `reduction:${ws.id}:${line.id}:${change.operationId}`, Date.parse(change.effectiveAt), { quantity: change.quantity });
      }
    }
    for (const line of ws.lines) {
      if (ws.state !== "suspended") runLine(line);
      else if (["past_due", "read_only"].includes(line.state)) progress(line, cycleFor(line));
    }
    result = { workspaceId: ws.id, invoices: effects.filter(row => row.kind === "billing.payment").map(row => row.invoiceId), states: ws.lines.map(line => ({ id: line.id, state: line.state, quantity: line.snapshot?.quantity })) };
  } else if (command.kind === "billing.recover") {
    if (ws.state === "suspended") throw failure(423, "workspace_read_only", "Suspended workspace billing requires authorized review.");
    const line = getLine(); if (!["past_due", "read_only"].includes(line.state)) throw failure(409, "payment_not_due", "This subscription is not waiting for payment.");
    const cycle = cycleFor(line); progress(line, cycle); if (!live(line)) throw failure(409, "subscription_ended", "Start a new subscription after cancellation; the old invoice is preserved.");
    if (!methodFor(command.paymentMethodId)) throw failure(422, "payment_method_required", "Choose a saved payment method.");
    const invoice = db.invoices.find(row => row.id === cycle.invoiceId), succeeded = payment(invoice, `${cycle.key}:recover:${operationKey}`, at, command.paymentMethodId, false);
    if (succeeded) restore(line, cycle, invoice);
    result = { workspaceId: ws.id, lineId: line.id, invoiceId: invoice.id, paymentStatus: succeeded ? "succeeded" : "failed", state: line.state, total: invoice.total, currency: invoice.currency };
  } else if (command.kind === "billing.seats.cancel-reduction") {
    if (ws.state === "suspended") throw failure(423, "workspace_read_only", "This workspace is read-only.");
    const line = getLine();
    if (!line.scheduledSeatChange) throw failure(409, "reduction_not_scheduled", "No capacity reduction is scheduled.");
    delete line.scheduledSeatChange;
    result = { lineId: line.id, scheduled: null };
  } else if (command.kind === "billing.seats.reduce") {
    if (ws.state === "suspended") throw failure(423, "workspace_read_only", "This workspace is read-only.");
    const line = getLine(); assertSeatQuantity(line, command.quantity);
    if (line.state !== "active" || command.quantity >= line.snapshot.quantity) throw failure(409, "invalid_reduction", "Only a lower active capacity can be scheduled for renewal.");
    line.scheduledSeatChange = { quantity: command.quantity, effectiveAt: line.periodEnd, operationId: command.operationId };
    result = { lineId: line.id, scheduled: clone(line.scheduledSeatChange) };
  } else if (command.kind === "billing.seats.quote") {
    if (ws.state === "suspended") throw failure(423, "workspace_read_only", "This workspace is read-only.");
    const line = getLine(), plan = assertSeatQuantity(line, command.quantity, { increase: true });
    if (line.state !== "active" || Date.parse(line.periodEnd) <= at || line.scheduledSeatChange) throw failure(409, "capacity_change_unavailable", "Recover billing or cancel the scheduled reduction before purchasing capacity.");
    const website = line.source?.policy === "website-offers-v1";
    const resolved = website ? { amount: money(line.snapshot.amount * command.quantity / line.snapshot.quantity), unit: line.snapshot.unit, quantity: command.quantity, currency: ws.currency } : pricing.resolveWorkspaceLine(db, { planId: plan.id, cycle: line.cycle, workspace: ws, seats: command.quantity });
    if (!resolved || resolved.currency !== ws.currency || !validAmount(resolved.amount)) throw failure(503, "line_price_unavailable", "No server price is available for this capacity.");
    const originalProration = pricing.proration(line, line.cycle, at, decimals);
    const coreEnd = line.prepaidTerms?.length ? Math.min(...line.prepaidTerms.map(term => Date.parse(term.start))) : Date.parse(line.periodEnd);
    const core = { ...line, termMonths: undefined, prepaidTerms: [], periodEnd: iso(coreEnd) };
    const factor = coreEnd <= at ? 0 : pricing.proration(core, line.cycle, at, decimals).factor;
    const futureCharge = (line.prepaidTerms || []).reduce((sum, term) => sum + term.amount * command.quantity / line.snapshot.quantity * Math.max(0, Math.min(1, (Date.parse(term.end) - at) / (Date.parse(term.end) - Date.parse(term.start)))), 0);
    const quote = quoteFor(line, money(resolved.amount * factor + futureCharge), { bundle: !website, credit: originalProration.credit });
    const quoteId = id("seatquote", [ws.id, actor, command.operationId]);
    const held = { quoteId, workspaceId: ws.id, actor, lineId: line.id, quantity: command.quantity, originalQuantity: line.snapshot.quantity, price: resolved, quote, context: seatContext(line), expiresAt: iso(Math.min(at + 900000, coreEnd > at ? coreEnd : Date.parse(line.periodEnd))), createdAt: iso(at), used: false };
    ledger.seatQuotes[quoteId] = held;
    result = { quoteId, lineId: line.id, quantity: held.quantity, currency: ws.currency, decimals, total: quote.total, net: quote.net, tax: quote.tax, taxDisplay: quote.taxDisplay, expiresAt: held.expiresAt, expiresIn: Math.max(0, Math.floor((Date.parse(held.expiresAt) - at) / 1000)) };
  } else if (command.kind === "billing.seats.confirm") {
    if (ws.state === "suspended") throw failure(423, "workspace_read_only", "This workspace is read-only.");
    const held = ledger.seatQuotes[command.quoteId];
    if (!held || held.workspaceId !== ws.id || held.actor !== actor) throw failure(404, "quote_not_found", "Review a server capacity quote first.");
    if (held.used) throw failure(409, "quote_used", "This capacity quote was already paid.");
    if (at >= Date.parse(held.expiresAt)) throw failure(410, "quote_expired", "Review the updated capacity quote before payment.");
    const line = ws.lines.find(row => row.id === held.lineId); assertSeatQuantity(line, held.quantity, { increase: true });
    if (held.context !== seatContext(line)) throw failure(409, "checkout_changed", "Workspace billing or seat reservations changed; review a new quote.");
    if (!methodFor(command.paymentMethodId)) throw failure(422, "payment_method_required", "Choose a saved payment method.");
    // Seat invoices exist only for successful payment, unlike renewal obligations.
    const before = clone(db), quote = held.quote, invoice = invoiceFor(line, `capacity:${operationKey}`, at, quote, "subscription");
    const succeeded = payment(invoice, `capacity:${operationKey}:payment`, at, command.paymentMethodId, false);
    if (!succeeded) {
      db.invoices = before.invoices; ledger.nextInvoiceNumber = before.billingLifecycle.nextInvoiceNumber;
      effects.length = 0;
      result = { paymentStatus: "failed", quoteId: held.quoteId, lineId: line.id, quantity: line.snapshot.quantity };
    } else {
      const ratio = held.quantity / line.snapshot.quantity;
      line.snapshot = { ...line.snapshot, ...held.price, periodAmount: line.source?.policy === "website-offers-v1" ? money((line.snapshot.periodAmount ?? line.snapshot.amount) * ratio) : pricing.totals({ lines: [{ amount: held.price.amount }], currency: ws.currency, decimals, bundlePct: held.quote.amount ? held.quote.bundleDiscount / held.quote.amount * 100 : 0 }).lineAmounts[0].discounted };
      for (const term of line.prepaidTerms || []) { term.originalAmount ??= term.amount; term.amount = money(term.amount * ratio); term.capacityPurchases ??= []; term.capacityPurchases.push({ invoiceId: invoice.id, quantity: held.quantity, at: iso(at) }); }
      invoice.lines[0].quantity = held.quantity;
      creditUsed(quote); ws.currencyLocked = true; held.used = true; held.invoiceId = invoice.id;
      notice("capacity_purchased", line, `capacity:${operationKey}:paid`, at, { invoiceId: invoice.id, quantity: held.quantity });
      result = { paymentStatus: "succeeded", quoteId: held.quoteId, lineId: line.id, invoiceId: invoice.id, quantity: held.quantity, total: invoice.total, currency: invoice.currency };
    }
  }
  if (["active", "past_due"].includes(ws.state)) ws.state = ws.lines.some(line => ["past_due", "read_only"].includes(line.state)) ? "past_due" : "active";
  ledger.operations[operationKey] = { fingerprint, result: clone(result), at: command.at };
  return { db, effects, result, duplicate: false };
}

module.exports = { executeBillingCommand, selectBillingDue, RETRY_DAYS };
