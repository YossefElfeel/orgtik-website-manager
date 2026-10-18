// Time-based transitions (spec 06 state tables, G-15, G-17): the mock has no background jobs, so
// every API call first brings the data up to "now" (the mock clock), exactly once per call.
//
// Subscription line: trialing → (trial end) free | ended · past_due → (grace end) read_only ·
// read_only → (cancelAfterDays) ended · cancelling → (cancelAt) ended · ended → (retention) deleted.
// Workspace: past_due while any line is past_due or read_only; back to active when none is.
function changedTables(S, changes) {
  const next = { ...S.db, grid: { ...S.db.grid } };
  for (const c of changes) if (c.to == null) delete next.grid[c.key]; else next.grid[c.key] = c.to;
  return next;
}
function affectedPriceLines(S, changes) {
  const after = changedTables(S, changes);
  const affected = [];
  for (const ws of S.db.workspaces) for (const line of ws.lines) {
    if (!["active", "cancelling"].includes(line.state)) continue;
    const query = { planId: line.planId, cycle: line.cycle, workspace: ws, seats: line.snapshot.quantity };
    const before = periodPrice(S, S.db, query, line);
    const next = periodPrice(S, after, query, line);
    // Resolution comparison respects zone/currency, fixed country prices and derived yearly cells.
    if (next && before && (next.unit !== before.unit || next.currency !== before.currency || next.source !== before.source)) affected.push({ ws, line, next });
  }
  return affected;
}
function periodPrice(S, db, query, line) {
  const resolved = S.pricing.resolveWorkspaceLine(db, query);
  if (!resolved || line.source?.policy !== "website-offers-v1") return resolved;
  const reference = line.prepaidTerms?.at(-1)?.reference || line.source.reference;
  const order = db.publicWebsiteOrders?.find(row => row.snapshot.reference === reference)?.snapshot;
  const offer = order?.groups.flatMap(group => group.lines).find(row => row.tool === line.tool);
  if (!offer) throw Object.assign(new Error("The paid website renewal policy is unavailable."), { status: 503 });
  const factor = offer.months * (1 - offer.discount / 100), decimals = db.currencies[query.workspace.currency].decimals;
  return { ...resolved, unit: S.pricing.toDecimals(resolved.unit * factor, decimals), amount: S.pricing.toDecimals(resolved.amount * factor, decimals) };
}
function firstRenewalAfter(S, line, boundary) {
  const months = line.renewalMonths || line.termMonths;
  const period = (months ? months * 30 : S.pricing.periodDays(line.cycle)) * 86400000;
  const end = Date.parse(line.periodEnd);
  return new Date(end + Math.max(0, Math.ceil((boundary - end) / period)) * period).toISOString();
}
function schedulePricePublication(S, draft) {
  if (draft.noticesPreparedAt || draft.applyMode !== "existing_next_renewal") return;
  const boundary = Math.max(Date.parse(draft.effectiveAt), S.now() + S.db.settings.priceChange.noticeDays * 86400000);
  draft.notified = 0;
  for (const { ws, line, next } of affectedPriceLines(S, draft.changes)) {
    const scheduled = { kind: "price_change", draftId: draft.id, effectiveAt: firstRenewalAfter(S, line, boundary), priceVersion: draft.priceVersion, snapshot: { ...line.snapshot, ...next, priceVersion: draft.priceVersion } };
    if (line.scheduled?.kind === "downgrade") line.scheduledPrice = scheduled; else line.scheduled = scheduled;
    S.notifyOwner(ws, "price_change", { title: `Your ${line.tool} price changes on ${scheduled.effectiveAt.slice(0, 10)}`, lineId: line.id, effectiveAt: scheduled.effectiveAt, from: line.snapshot.amount, to: next.amount, currency: ws.currency }, `price:${draft.id}:${line.id}`);
    draft.notified++;
  }
  draft.noticesPreparedAt = S.iso(S.now());
}
function applyPublishedPrices(S) {
  const due = S.db.priceDrafts.filter(d => d.state === "published" && !d.appliedAt && Date.parse(d.effectiveAt) <= S.now()).sort((a, b) => Date.parse(a.effectiveAt) - Date.parse(b.effectiveAt));
  for (const draft of due) {
    const affected = affectedPriceLines(S, draft.changes);
    for (const c of draft.changes) if (c.to == null) delete S.db.grid[c.key]; else S.db.grid[c.key] = c.to;
    S.db.priceVersion = Math.max(S.db.priceVersion, draft.priceVersion);
    if (draft.applyMode === "existing_now") for (const { line, next } of affected) line.snapshot = { ...line.snapshot, ...next, priceVersion: draft.priceVersion };
    draft.appliedAt = S.iso(S.now());
    S.log("system", "price_effective", draft.id, { priceVersion: draft.priceVersion });
  }
}

function overLimits(S, ws, plan) {
  const usage = ws.usage ?? {};
  return Object.entries(plan.limits ?? {}).filter(([key, limit]) => Number.isFinite(limit) && (usage[key] ?? 0) > limit).map(([key, limit]) => ({ key, limit, used: usage[key], excess: usage[key] - limit, state: "read_only" }));
}
function advance(S, { workspaceId } = {}) {
  const { db } = S;
  const t = S.now();
  const set = db.settings;
  const suspendedScope = workspaceId !== undefined && db.workspaces.find(ws => ws.id === workspaceId)?.state === 'suspended';
  applyPublishedPrices(S);
  for (const ws of db.workspaces) {
    if (workspaceId !== undefined && ws.id !== workspaceId) continue;
    const dunningOnly = workspaceId !== undefined && ws.state === 'suspended';
    for (const l of ws.lines) {
      const downgrade = l.scheduled?.kind === "downgrade" ? l.scheduled : null;
      if (!dunningOnly && downgrade && Date.parse(downgrade.effectiveAt) <= t && l.state === "active") {
        const plan = db.plans.find(p => p.id === downgrade.planId && p.tool === l.tool && (!p.workspaceId || p.workspaceId === ws.id));
        const priced = plan && S.resolveForWorkspace(plan.id, ws, l.cycle, l.snapshot.quantity);
        if (priced) {
          l.planId = plan.id;
          l.snapshot = { ...l.snapshot, ...priced, periodAmount: priced.amount, priceVersion: db.priceVersion };
          l.state = plan.tier === "free" ? "free" : "active";
          l.overLimits = overLimits(S, ws, plan);
          l.periodStart = downgrade.effectiveAt;
          l.periodEnd = S.iso(Date.parse(downgrade.effectiveAt) + S.pricing.periodDays(l.cycle) * 86400000);
          if (l.termMonths) {
            l.previousWebsiteTerms = { months: l.termMonths, prepaid: l.prepaidTerms ?? [], source: l.source };
            delete l.termMonths; delete l.renewalMonths; delete l.prepaidTerms;
            l.source = { kind: "subscription", previousWebsiteReference: l.source?.reference };
          }
          delete l.scheduled;
          delete l.scheduledPrice;
          S.log("system", "downgrade_applied", ws.id, { line: l.id, plan: plan.id, overLimits: l.overLimits });
        } else if (workspaceId !== undefined) throw Object.assign(new Error('The scheduled downgrade price is unavailable; nothing was committed.'), { status: 503, code: 'scheduled_downgrade_unavailable' });
      }
      const priceChange = l.scheduledPrice ?? (l.scheduled?.kind === "price_change" ? l.scheduled : null);
      if (!dunningOnly && priceChange?.snapshot && Date.parse(priceChange.effectiveAt) <= t && ["active", "cancelling"].includes(l.state)) {
        // A later downgrade must not inherit the former plan's pending price.
        if (!downgrade) l.snapshot = { ...l.snapshot, ...priceChange.snapshot };
        if (l.scheduledPrice) delete l.scheduledPrice; else delete l.scheduled;
        S.log("system", "line_price_effective", ws.id, { line: l.id, draft: priceChange.draftId });
      }
      if (!dunningOnly && l.state === "trialing" && l.trialEndsAt && Date.parse(l.trialEndsAt) <= t) {
        // G-17: at the end the tool goes to its Free plan if it has one, else it ends.
        const free = db.plans.find((p) => p.tool === l.tool && p.tier === "free");
        if (free) Object.assign(l, { state: "free", planId: free.id, snapshot: { ...l.snapshot, amount: 0, unit: 0 } });
        else Object.assign(l, { state: "ended", endedAt: l.trialEndsAt });
        S.log("system", "trial_ended", ws.id, { line: l.id });
      }
      if (l.state === "past_due" && l.graceEndsAt && Date.parse(l.graceEndsAt) <= t) {
        Object.assign(l, { state: "read_only", readOnlySince: l.graceEndsAt });
        S.log("system", "line_read_only", ws.id, { line: l.id });
      }
      if (l.state === "read_only" && l.readOnlySince && Date.parse(l.readOnlySince) + (set.dunning.cancelAfterDays - set.dunning.graceDays) * 86400000 <= t) {
        Object.assign(l, { state: "ended", endedAt: S.iso(Date.parse(l.readOnlySince) + (set.dunning.cancelAfterDays - set.dunning.graceDays) * 86400000) });
      }
      if (!dunningOnly && l.state === "cancelling" && l.cancelAt && Date.parse(l.cancelAt) <= t) Object.assign(l, { state: "ended", endedAt: l.cancelAt });
      if (l.state === "ended" && l.endedAt && Date.parse(l.endedAt) + set.retention.toolDays * 86400000 <= t) l.state = "deleted";
    }
    if (ws.state === "active" || ws.state === "past_due") {
      const owing = ws.lines.some((l) => l.state === "past_due" || l.state === "read_only");
      ws.state = owing ? "past_due" : "active";
    }
  }
  // Delivered service work is approved by itself after the setting's days (G-30).
  for (const r of db.serviceRequests) {
    if (workspaceId !== undefined && (r.workspaceId !== workspaceId || suspendedScope)) continue;
    const d = r.deliveries.at(-1);
    if (r.state === "in_review" && d?.autoApproveAt && Date.parse(d.autoApproveAt) <= t) {
      r.state = "completed";
      r.completedAt = S.iso(t);
      r.autoApproved = true;
    }
  }
  // Tickets waiting for the customer close after 7 days; resolved ones after the reopen window.
  for (const k of db.tickets) {
    if (workspaceId !== undefined && (k.workspaceId !== workspaceId || suspendedScope)) continue;
    if (k.state === "waiting_for_you" && k.autoCloseAt && Date.parse(k.autoCloseAt) <= t) k.state = "closed";
    if (k.state === "resolved" && k.reopenUntil && Date.parse(k.reopenUntil) <= t) k.state = "closed";
  }
}

// Customer-side tool state (USR-00) from the catalogue, the workspace's line and the person's role.
function toolState(S, ws, tool, member) {
  if (tool.status === "coming_soon") return "coming_soon";
  if (tool.status === "retired") return null;
  if (S.db.workspaceAuthorityVersion === 1 && require('../../lib/workspace-context').TOOL_DEFINITIONS[tool.key]) {
    if (!member || member.status !== 'active' || !member.userKey) return 'no_access';
    const context = require('../../lib/workspace-context').resolveWorkspaceContext(S, {}, { id: 1, key: member.userKey, isActive: true }, { workspaceId: ws.id });
    const access = context.tools[tool.key].access;
    return tool.status === 'beta' && access === 'active' ? 'beta' : access === 'free' ? 'active' : access;
  }
  if (member?.role === "member" || member?.role === "guest") {
    if (member.tools && !member.tools.includes(tool.key) && !tool.mandatory) return "no_access";
  }
  // The live line decides (a tool bought again has an ended line before it); else not subscribed.
  const l = ws.lines.find((x) => x.tool === tool.key && x.state !== "deleted" && x.state !== "ended");
  if (!l) return "not_subscribed";
  if (l.state === "trialing") return "trial";
  if (l.state === "read_only") return "read_only";
  if (tool.status === "beta") return "beta";
  return "active";
}

// Banners for a person (USR-00, D-026 priority; staff ribbon outside it). Only the first shows.
const BANNER_ORDER = ["suspended", "read_only", "payment_failed", "trial_ending", "beta_billing", "price_change", "downgrade_scheduled"];
function banners(S, ws, member) {
  const out = [];
  const owner = member?.role === "owner";
  const admin = owner || member?.role === "admin";
  const t = S.now();
  if (ws.state === "suspended") out.push({ kind: "suspended", tone: "danger", audience: "everyone", action: "contact_support", reason: ws.flags?.suspendedReason ?? null });
  const ro = ws.lines.find((l) => l.state === "read_only");
  if (ro) out.push({ kind: "read_only", tone: "danger", audience: "everyone", tool: ro.tool, action: owner ? "pay_now" : null });
  const pd = ws.lines.find((l) => l.state === "past_due");
  if (pd && admin) out.push({ kind: "payment_failed", tone: owner ? "danger" : "warning", audience: owner ? "owner" : "admin", tool: pd.tool, graceEndsAt: pd.graceEndsAt, action: owner ? "pay_now" : null });
  const tr = ws.lines.find((l) => l.state === "trialing" && l.trialEndsAt && Date.parse(l.trialEndsAt) - t <= 3 * 86400000);
  if (tr && owner) out.push({ kind: "trial_ending", tone: "info", audience: "owner", tool: tr.tool, endsAt: tr.trialEndsAt, action: "choose_plan" });
  const beta = ws.lines.find((l) => S.db.tools.find((x) => x.key === l.tool)?.status === "beta" && l.state === "trialing");
  if (beta && owner) out.push({ kind: "beta_billing", tone: "warning", audience: "owner", tool: beta.tool, action: "view_plans", coupon: "LAUNCH20" });
  const pc = ws.lines.find((l) => l.scheduled?.kind === "price_change" || l.scheduledPrice);
  if (pc && owner) out.push({ kind: "price_change", tone: "warning", audience: "owner", tool: pc.tool, effectiveAt: (pc.scheduledPrice ?? pc.scheduled).effectiveAt, action: "details" });
  const dg = ws.lines.find((l) => l.scheduled?.kind === "downgrade");
  if (dg && owner) out.push({ kind: "downgrade_scheduled", tone: "neutral", audience: "owner", tool: dg.tool, effectiveAt: dg.scheduled.effectiveAt, action: "cancel_downgrade" });
  return out.sort((a, b) => BANNER_ORDER.indexOf(a.kind) - BANNER_ORDER.indexOf(b.kind));
}

module.exports = { advance, toolState, banners, BANNER_ORDER, affectedPriceLines, schedulePricePublication, overLimits };
