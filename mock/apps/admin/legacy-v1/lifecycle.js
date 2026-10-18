// Time-based transitions (spec 06 state tables, G-15, G-17): the mock has no background jobs, so
// every API call first brings the data up to "now" (the mock clock), exactly once per call.
//
// Subscription line: trialing → (trial end) free | ended · past_due → (grace end) read_only ·
// read_only → (cancelAfterDays) ended · cancelling → (cancelAt) ended · ended → (retention) deleted.
// Workspace: past_due while any line is past_due or read_only; back to active when none is.
function advance(S) {
  const { db } = S;
  const t = S.now();
  const set = db.settings;
  for (const ws of db.workspaces) {
    for (const l of ws.lines) {
      if (l.state === "trialing" && l.trialEndsAt && Date.parse(l.trialEndsAt) <= t) {
        // G-17: at the end the tool goes to its Free plan if it has one, else it ends.
        const free = db.plans.find((p) => p.tool === l.tool && p.tier === "free");
        if (free) Object.assign(l, { state: "free", planId: free.id, snapshot: { ...l.snapshot, amount: 0, unit: 0 } });
        else Object.assign(l, { state: "ended", endedAt: S.iso(t) });
        S.log("system", "trial_ended", ws.id, { line: l.id });
      }
      if (l.state === "past_due" && l.graceEndsAt && Date.parse(l.graceEndsAt) <= t) {
        Object.assign(l, { state: "read_only", readOnlySince: S.iso(t) });
        S.log("system", "line_read_only", ws.id, { line: l.id });
      }
      if (l.state === "read_only" && l.readOnlySince && Date.parse(l.readOnlySince) + (set.dunning.cancelAfterDays - set.dunning.graceDays) * 86400000 <= t) {
        Object.assign(l, { state: "ended", endedAt: S.iso(t) });
      }
      if (l.state === "cancelling" && l.cancelAt && Date.parse(l.cancelAt) <= t) Object.assign(l, { state: "ended", endedAt: S.iso(t) });
      if (l.state === "ended" && l.endedAt && Date.parse(l.endedAt) + set.retention.toolDays * 86400000 <= t) l.state = "deleted";
    }
    if (ws.state === "active" || ws.state === "past_due") {
      const owing = ws.lines.some((l) => l.state === "past_due" || l.state === "read_only");
      ws.state = owing ? "past_due" : "active";
    }
  }
  // Delivered service work is approved by itself after the setting's days (G-30).
  for (const r of db.serviceRequests) {
    const d = r.deliveries.at(-1);
    if (r.state === "in_review" && d?.autoApproveAt && Date.parse(d.autoApproveAt) <= t) {
      r.state = "completed";
      r.completedAt = S.iso(t);
      r.autoApproved = true;
    }
  }
  // Tickets waiting for the customer close after 7 days; resolved ones after the reopen window.
  for (const k of db.tickets) {
    if (k.state === "waiting_for_you" && k.autoCloseAt && Date.parse(k.autoCloseAt) <= t) k.state = "closed";
    if (k.state === "resolved" && k.reopenUntil && Date.parse(k.reopenUntil) <= t) k.state = "closed";
  }
}

// Customer-side tool state (USR-00) from the catalogue, the workspace's line and the person's role.
function toolState(S, ws, tool, member) {
  if (tool.status === "coming_soon") return "coming_soon";
  if (tool.status === "retired") return null;
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
  const pc = ws.lines.find((l) => l.scheduled?.kind === "price_change");
  if (pc && owner) out.push({ kind: "price_change", tone: "warning", audience: "owner", tool: pc.tool, effectiveAt: pc.scheduled.effectiveAt, action: "details" });
  const dg = ws.lines.find((l) => l.scheduled?.kind === "downgrade");
  if (dg && owner) out.push({ kind: "downgrade_scheduled", tone: "neutral", audience: "owner", tool: dg.tool, effectiveAt: dg.scheduled.effectiveAt, action: "cancel_downgrade" });
  return out.sort((a, b) => BANNER_ORDER.indexOf(a.kind) - BANNER_ORDER.indexOf(b.kind));
}

module.exports = { advance, toolState, banners, BANNER_ORDER };
