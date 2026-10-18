// Billing: subscriptions (installment schedules, renew/pay/pause/cancel/refund), invoices (subscription,
// salesman, custom + PDFs), commissions (payouts, wallets), coupons, loyalty programme.
const H = require("./lib");

module.exports = function billing(S) {
  const { db, util, identity } = S;
  const { ok, fail } = util;
  const C = S.catalog;
  const K = S.core;
  const D = () => S.deals;

  const subById = (id) => db.subscriptions.find((s) => s.id === id);
  const invoiceById = (id) => db.invoices.find((i) => i.invoiceId === id || i.id === id);
  const commissionById = (id) => db.commissions.find((c) => c.id === id);
  const couponById = (id) => db.coupons.find((c) => c.id === id);
  const nowIso = () => new Date().toISOString();
  const nowMs = () => Date.now();

  // ------------------------------------------------------------------ status helpers
  function invoiceStatus(inv) {
    if (inv.status === "paid" || inv.status === "void") return inv.status;
    if (inv.kind === "custom") return new Date(inv.dueDate).getTime() < nowMs() ? "overdue" : "pending";
    if (new Date(inv.dueDate).getTime() < nowMs()) return "overdue";
    return inv.status; // pending | partial
  }
  function installmentStatus(sub, inst) {
    if (inst.status === "paid") return "paid";
    const inv = inst.invoiceId && invoiceById(inst.invoiceId);
    if (inv && invoiceStatus(inv) === "overdue") return "overdue";
    if (inv) return "pending";
    return "upcoming";
  }
  function lifecycle(sub) {
    if (["cancelled", "paused", "pending"].includes(sub.status)) return sub.status;
    const end = new Date(sub.endDate).getTime();
    if (end < nowMs()) return "expired";
    if (end - nowMs() <= 30 * H.DAY) return "expiring_soon";
    return "active";
  }
  const subInvoices = (sub) => db.invoices.filter((i) => i.subscriptionId === sub.id && i.kind === "subscription");
  function paymentStatus(sub) {
    const paid = H.num(sub.paidAmount);
    const total = H.num(sub.totalAmount);
    if (H.num(sub.refundedAmount) > 0 && H.num(sub.refundedAmount) >= paid - 0.01) return "refunded";
    if (paid >= total - 0.01 && total > 0) return "paid";
    if (subInvoices(sub).some((i) => invoiceStatus(i) === "overdue")) return "overdue";
    if (paid > 0) return sub.partialVariant || "partially_paid";
    if (sub.status === "pending") return "pending";
    return "unpaid";
  }

  // ------------------------------------------------------------------ invoices
  function newInvoice(fields, at) {
    const ts = at || nowIso();
    const inv = {
      id: H.newId(), invoiceId: K.nextCode("invoice", `INV-${new Date(ts).getUTCFullYear()}`), status: "pending", paidAmount: 0,
      paidAt: null, paymentMethod: null, paymentReference: null, voidReason: null, voidAt: null, createdAt: ts, issuedAt: ts, ...fields,
    };
    db.invoices.push(inv);
    return inv;
  }
  function issueInstallmentInvoice(sub, inst, at) {
    const vatRate = H.num(sub.vatRate);
    const total = H.num(inst.amount);
    const subtotal = total / (1 + vatRate / 100);
    const issuedAt = at || H.iso(Math.min(nowMs(), new Date(inst.dueDate).getTime() - 14 * H.DAY));
    const inv = newInvoice({
      kind: "subscription", type: "subscription", subscriptionId: sub.id, projectId: sub.projectId, projectName: sub.projectName, customerId: sub.customerId,
      planName: sub.planName, planTag: sub.paymentType === "installment" ? "installment" : "cash_only", paymentType: "subscription",
      currencyCode: sub.currencyCode, installmentNumber: inst.number, dueDate: inst.dueDate,
      lineItems: [{ id: H.newId(), description: sub.paymentType === "installment" ? `${H.text(sub.planName)} – installment ${inst.number} of ${sub.installments.length}` : `${H.text(sub.planName)} – ${sub.months} month${sub.months === 1 ? "" : "s"}`, quantity: 1, amount: H.round(subtotal, sub.currencyCode) }],
      subtotalAmount: H.round(subtotal, sub.currencyCode), taxRate: vatRate, taxAmount: H.round(total - subtotal, sub.currencyCode), totalAmount: H.round(total, sub.currencyCode),
    }, issuedAt);
    inst.invoiceId = inv.invoiceId;
    return inv;
  }
  // Issue invoices for installments that are due within 30 days (time moves on while the mock runs).
  function refreshSchedules({ system = false } = {}) {
    if (identity.workspaceMode && !S.seeding && !system) return;
    const horizon = nowMs() + 30 * H.DAY;
    for (const sub of db.subscriptions) {
      if (sub.status === "cancelled") continue;
      for (const inst of sub.installments) {
        if (!inst.invoiceId && inst.status !== "paid" && new Date(inst.dueDate).getTime() <= horizon) issueInstallmentInvoice(sub, inst);
      }
    }
  }
  function markInvoicePaid(inv, { method = "bank_transfer", reference = null, at, amount } = {}) {
    const ts = at || nowIso();
    const due = H.num(inv.totalAmount) - H.num(inv.paidAmount);
    const pay = amount == null ? due : Math.min(due, H.num(amount));
    inv.paidAmount = H.round(H.num(inv.paidAmount) + pay, inv.currencyCode);
    inv.status = inv.paidAmount >= H.num(inv.totalAmount) - 0.01 ? "paid" : "partial";
    inv.paymentMethod = method;
    inv.paymentReference = reference || inv.paymentReference;
    if (inv.status === "paid") inv.paidAt = ts;
    const sub = inv.subscriptionId && subById(inv.subscriptionId);
    if (sub) {
      sub.paidAmount = H.round(H.num(sub.paidAmount) + pay, sub.currencyCode);
      const inst = sub.installments.find((i) => i.invoiceId === inv.invoiceId);
      if (inst && inv.status === "paid") Object.assign(inst, { status: "paid", paidDate: ts });
      if (sub.status === "pending" && sub.paidAmount > 0) sub.status = "active";
      sub.updatedAt = ts;
    }
    if (inv.customerId && pay > 0) earnPoints(inv.customerId, pay, inv.currencyCode, `Payment for ${inv.invoiceId}`, ts);
    if (!at && inv.customerId) {
      const cu = K.customerUserId(inv.customerId);
      const data = { invoiceId: inv.invoiceId, invoiceNumber: inv.invoiceId, amount: H.money(pay, inv.currencyCode), currency: inv.currencyCode, subscriptionId: inv.subscriptionId || null };
      if (inv.status === "paid") K.notify([cu], inv.kind === "custom" ? "custom_invoice.paid" : "invoice.paid", { title: "Invoice paid", message: `Invoice ${inv.invoiceNumber || inv.invoiceId} is fully paid. Thank you!`, data });
      K.notify([cu], "payment.received", { title: "Payment received", message: `We received ${H.fmtMoney(pay, inv.currencyCode)} for ${inv.invoiceNumber || inv.invoiceId}.`, data });
    }
    return pay;
  }
  // Apply an amount to a subscription: oldest open invoices first, then upcoming installments.
  function applyPayment(sub, amount, { method = "bank_transfer", reference, at } = {}) {
    let left = H.num(amount);
    const codes = [];
    const open = () => subInvoices(sub).filter((i) => i.status !== "paid" && i.status !== "void").sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
    for (const inv of open()) {
      if (left <= 0.001) break;
      const paid = markInvoicePaid(inv, { method, reference, at, amount: left });
      left -= paid;
      codes.push(inv.invoiceId);
    }
    for (const inst of sub.installments) {
      if (left <= 0.001) break;
      if (inst.status === "paid" || inst.invoiceId) continue;
      const inv = issueInstallmentInvoice(sub, inst, at);
      const paid = markInvoicePaid(inv, { method, reference, at, amount: left });
      left -= paid;
      codes.push(inv.invoiceId);
    }
    return { applied: H.num(amount) - left, codes };
  }

  // ------------------------------------------------------------------ subscriptions from approved contracts
  function onContractApproved(contract, project, { at, commission } = {}) {
    const ts = at || nowIso();
    const totalPayable = contract.plans.reduce((s, l) => s + H.num(l.payableTotal), 0) || 1;
    const vat = H.num(contract.vatRate);
    const discount = H.num(contract.discountAmount);
    const created = [];
    for (const l of contract.plans) {
      const share = (H.num(l.payableTotal) / totalPayable) * discount;
      const net = Math.max(0, H.num(l.payableTotal) - share);
      const total = H.round(net * (1 + vat / 100), contract.currency);
      const start = ts;
      const n = l.paymentMethod === "installment" ? l.installmentMonths || 1 : 1;
      const firstDue = new Date(start).getTime() + 7 * H.DAY;
      const each = H.round(total / n, contract.currency);
      const installments = [];
      for (let i = 0; i < n; i++) {
        installments.push({ number: i + 1, dueDate: i === 0 ? H.iso(firstDue) : H.addMonths(H.iso(firstDue), i), amount: i === n - 1 ? H.round(total - each * (n - 1), contract.currency) : each, status: "pending", paidDate: null, invoiceId: null });
      }
      const sub = {
        id: H.newId(), number: K.nextCode("subscription", `SUB-${new Date(ts).getUTCFullYear()}`), projectId: project?.id || null, projectName: project?.projectName || "",
        contractId: contract.id, contractPlanId: l.id, customerId: project?.customerId || null, planId: l.planId, planName: l.name, isCustom: l.isCustom,
        zoneId: contract.zoneId, currencyCode: contract.currency, vatRate: vat, months: l.durationMonths, durationId: l.durationId,
        baseMonthlyPrice: H.num(l.listMonthlyPrice), startDate: start, endDate: H.addMonths(start, l.durationMonths),
        paymentType: l.paymentMethod === "installment" ? "installment" : "full_payment", installmentMonths: l.installmentMonths, installmentDurationId: l.installmentDurationId,
        totalAmount: total, paidAmount: 0, refundedAmount: 0, status: "active", pausedAt: null, cancelReason: null, cancelledAt: null, autoRenew: l.paymentMethod !== "installment",
        partialVariant: db.subscriptions.length % 2 ? "partial_paid" : "partially_paid", installments: l.paymentMethod === "installment" ? installments : [],
        _cashSchedule: l.paymentMethod === "installment" ? null : installments[0], refunds: [], renewals: [], createdAt: ts, updatedAt: ts,
      };
      db.subscriptions.push(sub);
      if (sub.paymentType === "full_payment") {
        issueInstallmentInvoice(sub, sub._cashSchedule, ts);
      } else {
        for (const inst of sub.installments) if (new Date(inst.dueDate).getTime() <= Math.max(nowMs(), new Date(ts).getTime()) + 30 * H.DAY) issueInstallmentInvoice(sub, inst, H.iso(Math.min(nowMs(), Math.max(new Date(ts).getTime(), new Date(inst.dueDate).getTime() - 14 * H.DAY))));
      }
      created.push(sub);
    }
    if (commission && project?.assignedSalesmanId) createCommission(contract, project, commission, ts);
    if (!at && project) {
      const cu = K.customerUserId(project.customerId);
      const first = created.flatMap((s) => subInvoices(s))[0];
      if (first) K.notify([cu], "invoice.created", { title: "New invoice", message: `Invoice ${first.invoiceId} for ${H.fmtMoney(first.totalAmount, first.currencyCode)} is ready for payment.`, data: { invoiceId: first.invoiceId, invoiceNumber: first.invoiceId, amount: H.money(first.totalAmount, first.currencyCode), currency: first.currencyCode } });
    }
    return created;
  }
  function subscriptionListItem(req, sub) {
    return {
      id: sub.id, projectName: sub.projectName, planName: C.loc(req, sub.planName),
      totalPrice: H.fmtMoney(sub.totalAmount, sub.currencyCode), totalAmount: H.money(sub.totalAmount, sub.currencyCode), currencyCode: sub.currencyCode,
      endDate: sub.endDate, startDate: sub.startDate, status: lifecycle(sub), paymentStatus: paymentStatus(sub), subscriptionNumber: sub.number,
    };
  }
  function subscriptionDetail(req, sub) {
    const end = new Date(sub.endDate).getTime();
    const invoices = H.sortDesc(subInvoices(sub).concat(db.invoices.filter((i) => i.kind === "refund" && i.subscriptionId === sub.id)));
    return {
      id: sub.id, subscriptionNumber: sub.number, projectId: sub.projectId, projectName: sub.projectName, planId: sub.planId, planName: C.loc(req, sub.planName),
      totalAmount: H.money(sub.totalAmount, sub.currencyCode), paidAmount: H.money(sub.paidAmount, sub.currencyCode),
      remainingAmount: H.money(Math.max(0, H.num(sub.totalAmount) - H.num(sub.paidAmount)), sub.currencyCode), refundedAmount: H.money(sub.refundedAmount, sub.currencyCode),
      currencyCode: sub.currencyCode, startDate: sub.startDate, endDate: sub.endDate,
      daysLeft: ["cancelled"].includes(sub.status) ? null : Math.max(0, Math.ceil((end - nowMs()) / H.DAY)),
      lifecycleStatus: lifecycle(sub), paymentStatus: paymentStatus(sub), autoRenew: !!sub.autoRenew, paymentType: sub.paymentType,
      pausedAt: sub.pausedAt, cancelReason: sub.cancelReason, cancelledAt: sub.cancelledAt,
      invoices: invoices.map((i) => ({ invoiceId: i.invoiceId, invoiceCode: i.invoiceId, amount: H.money(i.kind === "refund" ? -H.num(i.totalAmount) : i.totalAmount, i.currencyCode), currencyCode: i.currencyCode, status: invoiceStatus(i), paymentMethod: i.paymentMethod, createdAt: i.createdAt, dueDate: i.dueDate })),
      installments: sub.installments.map((i) => ({ number: i.number, dueDate: i.dueDate, amount: H.money(i.amount, sub.currencyCode), status: installmentStatus(sub, i), paidDate: i.paidDate, invoiceId: i.invoiceId })),
    };
  }
  function zoneGroups(rows, pick) {
    const map = new Map();
    for (const r of rows) {
      const key = `${r.zoneId}|${r.currencyCode}`;
      const z = C.zoneById(r.zoneId);
      const g = map.get(key) || { zoneId: r.zoneId || null, zoneName: z?.name || "Unassigned", currencyCode: r.currencyCode, amount: 0, count: 0 };
      g.amount += H.num(pick(r));
      g.count += 1;
      map.set(key, g);
    }
    return [...map.values()].sort((a, b) => db.zones.findIndex((z) => z.id === a.zoneId) - db.zones.findIndex((z) => z.id === b.zoneId)).map((g) => ({ ...g, amount: H.money(g.amount, g.currencyCode) }));
  }
  function visibleSubscriptions(req) {
    const sc = req.sc;
    if (sc.role === "customer") return db.subscriptions.filter((s) => s.customerId === sc.customer?.id);
    if (sc.role === "salesman") {
      const ids = new Set(D().visibleProjects(req).map((p) => p.id));
      return db.subscriptions.filter((s) => ids.has(s.projectId));
    }
    return db.subscriptions;
  }
  function filterSubs(req, list) {
    const q = req.query;
    if (q.status) list = list.filter((s) => lifecycle(s) === q.status);
    if (q.search) {
      const s = String(q.search).toLowerCase();
      list = list.filter((x) => [x.projectName, H.text(x.planName), x.number].some((v) => String(v).toLowerCase().includes(s)));
    }
    if (q.month) list = list.filter((x) => H.monthKey(x.startDate) === q.month || H.monthKey(x.endDate) === q.month);
    return H.sortDesc(list, "startDate");
  }
  function renewalDurations(sub) {
    const plan = sub.planId && C.planById(sub.planId);
    const ids = plan ? plan.planDurationIds : db.durations.filter((d) => d.type === "plan").map((d) => d.id);
    return C.sortedDurations(ids, "plan").filter((d) => d.isActive).map((d) => ({ id: d.id, type: "plan", months: d.months, percentage: d.percentage, isActive: d.isActive }));
  }
  function renewalPreflight(sub, body) {
    const d = C.durationById(body.durationId);
    if (!d || d.type !== "plan") return { error: "Select a renewal duration" };
    const plan = sub.planId && C.planById(sub.planId);
    const base = plan ? C.planZoneBase(plan, sub.zoneId)?.amount ?? sub.baseMonthlyPrice : sub.baseMonthlyPrice;
    const cur = sub.currencyCode;
    const baseAmount = base * d.months;
    const discountAmount = (baseAmount * H.num(d.percentage)) / 100;
    let total = baseAmount - discountAmount;
    const paymentType = body.paymentType === "installment" ? "installment" : "full_payment";
    let installmentMonths = null;
    let installmentAmount = null;
    if (paymentType === "installment") {
      const term = (body.installmentDurationId && C.durationById(body.installmentDurationId)) || db.durations.filter((x) => x.type === "installment" && x.isActive && !x.archivedAt).sort((a, b) => a.months - b.months).find((x) => x.months >= Math.min(d.months, 3)) || null;
      if (term) {
        total = total * (1 + H.num(term.percentage) / 100);
        installmentMonths = term.months;
        installmentAmount = H.money(total / term.months, cur);
      }
    }
    const startMs = Math.max(nowMs(), new Date(sub.endDate).getTime());
    return {
      value: {
        subscriptionId: sub.id, durationId: d.id, months: d.months, newStartDate: H.iso(startMs), newEndDate: H.addMonths(H.iso(startMs), d.months),
        baseMonthlyPrice: H.money(base, cur), baseAmount: H.money(baseAmount, cur), durationDiscount: H.money(d.percentage, "USD"), durationDiscountAmount: H.money(discountAmount, cur),
        totalAmount: H.money(total, cur), paymentType, installmentMonths, installmentAmount, currency: cur,
      },
    };
  }
  function renew(req, sub, body) {
    const r = renewalPreflight(sub, body);
    if (r.error) return r;
    const p = r.value;
    const ts = nowIso();
    const n = p.paymentType === "installment" && p.installmentMonths ? p.installmentMonths : 1;
    const total = H.num(p.totalAmount) * (1 + H.num(sub.vatRate) / 100);
    const each = H.round(total / n, sub.currencyCode);
    const firstDue = Math.max(nowMs() + 7 * H.DAY, new Date(p.newStartDate).getTime());
    const newInst = [];
    for (let i = 0; i < n; i++) newInst.push({ number: sub.installments.length + i + 1, dueDate: i === 0 ? H.iso(firstDue) : H.addMonths(H.iso(firstDue), i), amount: i === n - 1 ? H.round(total - each * (n - 1), sub.currencyCode) : each, status: "pending", paidDate: null, invoiceId: null });
    if (sub.paymentType === "installment" || n > 1) {
      if (sub.paymentType !== "installment" && !sub.installments.length) sub.paymentType = "installment";
      sub.installments.push(...newInst);
    } else {
      issueInstallmentInvoice(sub, newInst[0], ts);
    }
    Object.assign(sub, {
      endDate: p.newEndDate, totalAmount: H.round(H.num(sub.totalAmount) + total, sub.currencyCode), months: sub.months + p.months,
      status: sub.status === "cancelled" ? "active" : sub.status, cancelReason: null, cancelledAt: null, updatedAt: ts,
    });
    sub.renewals.push({ ...p, renewedAt: ts, by: K.userName(req.sc.user) });
    refreshSchedules();
    K.notify([K.customerUserId(sub.customerId)], "subscription.renewed", { title: "Subscription renewed", message: `${sub.projectName} was renewed until ${H.shortDate(p.newEndDate)}.`, data: { subscriptionId: sub.id } });
    return r;
  }

  // ------------------------------------------------------------------ commissions
  const commissionMode = (mode) => (mode === "fixed" ? "flat_rate" : "percentage");
  function createCommission(contract, project, com, at) {
    const ts = at || nowIso();
    const salesman = K.staffById(project.assignedSalesmanId);
    const cm = {
      id: H.newId(), reference: K.nextCode("commission", "COM"), salesmanId: project.assignedSalesmanId, projectId: project.id, projectName: project.projectName,
      contractId: contract.id, zoneId: contract.zoneId, amount: H.round(com.amount, contract.currency), paidAmount: 0, currency: contract.currency,
      commissionMode: commissionMode(com.mode), commissionValue: H.num(com.value), commissionRate: com.mode === "percentage" ? H.money(com.pct, "USD") : H.money(com.value, contract.currency),
      approvalStatus: "approved", createdAt: ts, earnedAt: ts, paidAt: null, receiptUrl: null, payments: [], salesInvoiceId: null,
    };
    db.commissions.push(cm);
    const inv = newInvoice({
      kind: "salesman", type: "salesman", salesmanId: cm.salesmanId, salesmanName: salesman?.fullName || "", commissionId: cm.id, projectId: project.id, projectName: project.projectName,
      currencyCode: cm.currency, dueDate: H.iso(new Date(ts).getTime() + 30 * H.DAY), planName: null,
      lineItems: [{ id: H.newId(), description: `Sales commission – ${project.projectName} (${cm.reference})`, quantity: 1, amount: cm.amount }],
      subtotalAmount: cm.amount, taxRate: 0, taxAmount: 0, totalAmount: cm.amount,
    }, ts);
    cm.salesInvoiceId = inv.invoiceId;
    if (!at) K.notify([salesman?.authUserId], "wallet.commission_added", { title: "Commission credited", message: `${H.fmtMoney(cm.amount, cm.currency)} commission for "${project.projectName}" was added to your wallet.`, data: { commissionId: cm.id, projectId: project.id } });
    return cm;
  }
  const payoutStatus = (cm) => (H.num(cm.paidAmount) >= H.num(cm.amount) - 0.01 ? "paid" : H.num(cm.paidAmount) > 0 ? "partially_paid" : "unpaid");
  function payCommission(cm, amount, { receipt, at, method = "bank_transfer", reference = null } = {}) {
    const ts = at || nowIso();
    const due = H.num(cm.amount) - H.num(cm.paidAmount);
    const pay = Math.min(due, H.num(amount));
    cm.paidAmount = H.round(H.num(cm.paidAmount) + pay, cm.currency);
    cm.payments.push({ amount: pay, paidAt: ts, receiptUrl: receipt?.url || null, method, reference: reference ? String(reference).slice(0, 120) : null });
    if (receipt) cm.receiptUrl = receipt.url;
    if (payoutStatus(cm) === "paid") cm.paidAt = ts;
    const inv = cm.salesInvoiceId && invoiceById(cm.salesInvoiceId);
    if (inv) markInvoicePaid(inv, { method, at: at || ts, amount: pay });
    if (!at) {
      const s = K.staffById(cm.salesmanId);
      K.notify([s?.authUserId], "wallet.commission_paid", { title: "Commission paid out", message: `${H.fmtMoney(pay, cm.currency)} was paid for ${cm.reference} (${cm.projectName}).`, data: { commissionId: cm.id } });
    }
    return pay;
  }
  function commissionOut(cm) {
    const s = K.staffById(cm.salesmanId);
    return {
      id: cm.id, reference: cm.reference, salesmanId: cm.salesmanId, salesmanName: s?.fullName || "", salesmanAvatarUrl: s?.avatar || undefined,
      projectId: cm.projectId, projectName: cm.projectName, contractId: cm.contractId,
      amount: H.money(cm.amount, cm.currency), paidAmount: H.money(cm.paidAmount, cm.currency), dueAmount: H.money(H.num(cm.amount) - H.num(cm.paidAmount), cm.currency),
      currency: cm.currency, commissionMode: cm.commissionMode, commissionValue: cm.commissionValue, commissionRate: cm.commissionRate,
      payoutStatus: payoutStatus(cm), approvalStatus: cm.approvalStatus, createdAt: cm.createdAt, earnedAt: cm.earnedAt, paidAt: cm.paidAt, receiptUrl: cm.receiptUrl,
      zoneId: cm.zoneId,
    };
  }
  function trend(rows, dateOf, valueOf) {
    const cur = H.monthKey(new Date());
    const prev = H.monthKey(H.addMonths(new Date(), -1));
    const currentPeriod = rows.filter((r) => dateOf(r) && H.monthKey(dateOf(r)) === cur).reduce((s, r) => s + valueOf(r), 0);
    const previousPeriod = rows.filter((r) => dateOf(r) && H.monthKey(dateOf(r)) === prev).reduce((s, r) => s + valueOf(r), 0);
    return { total: rows.reduce((s, r) => s + valueOf(r), 0), currentPeriod, previousPeriod, growthPercent: H.growth(currentPeriod, previousPeriod) };
  }
  function commissionSummary(list) {
    const pending = list.filter((c) => payoutStatus(c) !== "paid");
    const zones = [...new Set(list.map((c) => `${c.zoneId}|${c.currency}`))].map((key) => {
      const [zoneId, currencyCode] = key.split("|");
      const rows = list.filter((c) => `${c.zoneId}|${c.currency}` === key);
      const z = C.zoneById(zoneId);
      const earned = rows.reduce((s, c) => s + H.num(c.amount), 0);
      const paid = rows.reduce((s, c) => s + H.num(c.paidAmount), 0);
      const pend = rows.filter((c) => payoutStatus(c) !== "paid");
      const payments = rows.flatMap((c) => c.payments.map((p) => ({ ...p })));
      return {
        zoneId, zoneName: z?.name || "Unassigned", currencyCode, pendingPayoutCount: pend.length,
        pendingPayoutAmount: H.round(pend.reduce((s, c) => s + H.num(c.amount) - H.num(c.paidAmount), 0), currencyCode),
        totalPaid: H.round(paid, currencyCode), totalEarned: H.round(earned, currencyCode), collectedPercent: earned ? H.pct((paid / earned) * 100) : 0,
        paidTrend: trend(payments, (p) => p.paidAt, (p) => H.num(p.amount)), earnedTrend: trend(rows, (c) => c.earnedAt, (c) => H.num(c.amount)),
      };
    });
    return {
      pendingPayoutCount: pending.length, paidCount: list.filter((c) => payoutStatus(c) === "paid").length,
      pendingPayoutTrend: trend(pending, (c) => c.earnedAt, () => 1), zones,
    };
  }
  function wallet(staff) {
    const list = db.commissions.filter((c) => c.salesmanId === staff.id);
    const currencyCode = C.zoneById(staff.zoneId)?.currencyCode || "USD";
    const conv = (v, from) => H.round(H.convert(v, from, currencyCode), currencyCode);
    const contracts = db.contracts.filter((c) => D().projectById(c.projectId)?.assignedSalesmanId === staff.id && c.status === "approved");
    const totalCommission = list.reduce((s, c) => s + conv(c.amount, c.currency), 0);
    const totalWithdrawAmount = list.reduce((s, c) => s + conv(c.paidAmount, c.currency), 0);
    return {
      contractCount: contracts.length,
      totalSalesAmount: H.round(contracts.reduce((s, c) => s + conv(c.grandTotal, c.currency), 0), currencyCode),
      totalCommission: H.round(totalCommission, currencyCode), totalWithdrawAmount: H.round(totalWithdrawAmount, currencyCode),
      walletBalance: H.round(totalCommission - totalWithdrawAmount, currencyCode), currencyCode,
      salesByZone: zoneGroups(contracts.map((c) => ({ zoneId: c.zoneId, currencyCode: c.currency, v: c.grandTotal })), (r) => r.v),
      commissionByZone: zoneGroups(list.map((c) => ({ zoneId: c.zoneId, currencyCode: c.currency, v: c.amount })), (r) => r.v),
    };
  }

  // ------------------------------------------------------------------ coupons
  function couponStatus(c) {
    const now = nowMs();
    if (c.usageLimit != null && c.usageCount >= c.usageLimit) return "exhausted";
    if (new Date(c.startDate).getTime() > now) return "upcoming_soon";
    if (new Date(c.endDate).getTime() < now) return "expired";
    if (new Date(c.endDate).getTime() - now <= 7 * H.DAY) return "expired_soon";
    return "active";
  }
  const couponOut = (c) => ({ ...c, status: couponStatus(c) });
  function validateCoupon(code, { categoryIds = [], subtotal = 0, currency = "USD", customerId } = {}) {
    const wanted = String(code || "").trim().toUpperCase();
    if (!wanted) return { valid: false, reason: "Enter a coupon code", discountAmount: 0 };
    const c = db.coupons.find((x) => x.code.toUpperCase() === wanted);
    const lc = !c && db.loyalty.coupons.find((x) => x.couponCode.toUpperCase() === wanted);
    if (!c && !lc) return { valid: false, reason: "Coupon code not found", discountAmount: 0 };
    const src = c || { code: lc.couponCode, categoryId: lc.categoryId, discountType: lc.discountType, discountValue: lc.discountValue };
    if (c) {
      const st = couponStatus(c);
      if (st === "expired") return { valid: false, reason: "This coupon has expired", discountAmount: 0 };
      if (st === "upcoming_soon") return { valid: false, reason: "This coupon is not active yet", discountAmount: 0 };
      if (st === "exhausted") return { valid: false, reason: "This coupon has reached its usage limit", discountAmount: 0 };
      if (c.hasPerUserLimit && customerId && db.couponUses.filter((u) => u.couponId === c.id && u.customerId === customerId).length >= (c.perUserLimit || 1)) return { valid: false, reason: "You already used this coupon", discountAmount: 0 };
    } else {
      if (lc.status !== "active" || new Date(lc.expiresAt).getTime() < nowMs()) return { valid: false, reason: "This reward coupon is no longer valid", discountAmount: 0 };
      if (customerId && lc.customerId !== customerId) return { valid: false, reason: "This reward coupon belongs to another customer", discountAmount: 0 };
    }
    if (src.categoryId && categoryIds.length && !categoryIds.includes(src.categoryId)) {
      const cat = C.catById(src.categoryId);
      return { valid: false, reason: `This coupon only applies to ${H.text(cat?.name) || "another category"}`, discountAmount: 0 };
    }
    const sub = H.num(subtotal);
    const amount = src.discountType === "percentage" ? (sub * H.num(src.discountValue)) / 100 : Math.min(sub || Infinity, H.convert(src.discountValue, "USD", currency));
    return { valid: true, reason: "Coupon applied", discountAmount: H.round(Number.isFinite(amount) ? amount : 0, currency), coupon: { ...src, id: c?.id || lc.id, isLoyalty: !c } };
  }
  function useCoupon(coupon, customerId) {
    if (!coupon) return;
    if (coupon.isLoyalty) {
      const lc = db.loyalty.coupons.find((x) => x.id === coupon.id);
      if (lc) lc.status = "used";
      return;
    }
    const c = couponById(coupon.id);
    if (!c) return;
    c.usageCount += 1;
    db.couponUses.push({ couponId: c.id, customerId: customerId || null, at: nowIso() });
  }

  // ------------------------------------------------------------------ loyalty
  const L = () => db.loyalty;
  const txOf = (customerId) => L().transactions.filter((t) => t.customerId === customerId);
  function account(customerId) {
    const tx = txOf(customerId);
    const now = nowMs();
    const lots = tx.filter((t) => t.points > 0);
    const balance = tx.reduce((s, t) => s + t.points, 0);
    const expSoonLots = lots.filter((t) => t.expiresAt && new Date(t.expiresAt).getTime() > now && new Date(t.expiresAt).getTime() - now <= 60 * H.DAY);
    const future = lots.filter((t) => t.expiresAt && new Date(t.expiresAt).getTime() > now).map((t) => t.expiresAt).sort();
    return {
      points: Math.max(0, balance),
      lifetimeEarned: tx.filter((t) => t.type === "earned" || (t.type === "adjusted" && t.points > 0)).reduce((s, t) => s + t.points, 0),
      lifetimeRedeemed: tx.filter((t) => t.type === "redeemed").reduce((s, t) => s - t.points, 0),
      lifetimeExpired: tx.filter((t) => t.source === "expiry").reduce((s, t) => s - t.points, 0),
      expiringSoon: Math.min(Math.max(0, balance), expSoonLots.reduce((s, t) => s + t.points, 0)),
      nextExpiryAt: future[0] || null,
    };
  }
  function addTx(customerId, { type, source, reason, points, expiresAt = null, at }) {
    const ts = at || nowIso();
    const before = txOf(customerId).reduce((s, t) => s + t.points, 0);
    const t = { id: H.newId(), customerId, type, source, reason, points, remainingPoints: Math.max(0, before + points), expiresAt, createdAt: ts };
    L().transactions.push(t);
    return t;
  }
  function earnPoints(customerId, amount, currency, reason, at) {
    const s = L().settings;
    if (!s.isActive) return null;
    const baseRate = s.rates.find((r) => r.currencyCode === s.baseCurrency);
    const inBase = H.convert(amount, currency, s.baseCurrency) / (baseRate ? H.num(baseRate.rate) || 1 : 1);
    const points = Math.floor(inBase * H.num(s.pointsPerUnit));
    if (points <= 0) return null;
    return addTx(customerId, { type: "earned", source: "invoice_payment", reason, points, expiresAt: H.addMonths(at || nowIso(), s.pointsExpireAfterMonths), at });
  }
  const txOut = ({ customerId, ...t }) => t;
  function loyaltyCustomerRow(c) {
    const a = account(c.id);
    return { customerId: c.id, customerName: c.fullName, companyName: c.companyName, email: c.email, points: a.points, lifetimeEarned: a.lifetimeEarned, lifetimeRedeemed: a.lifetimeRedeemed };
  }
  function rewardOut(r) {
    const cat = r.categoryId && C.catById(r.categoryId);
    return { ...r, categoryName: cat ? H.text(cat.name) : null, sampleCode: `${r.couponCodePrefix}-7K2Q9X` };
  }

  // ------------------------------------------------------------------ PDFs
  function invoicePdfLines(inv) {
    const cur = inv.currencyCode;
    const c = inv.customerId && K.customerById(inv.customerId);
    const s = inv.salesmanId && K.staffById(inv.salesmanId);
    const billName = inv.kind === "custom" ? inv.billingName || c?.companyName : inv.kind === "salesman" ? s?.fullName : c ? `${c.fullName} – ${c.companyName}` : "-";
    return [
      { text: `Invoice ${inv.invoiceNumber || inv.invoiceId}`, bold: true, size: 13 },
      `Status: ${invoiceStatus(inv).toUpperCase()}    Issued: ${H.shortDate(inv.issuedAt || inv.createdAt)}    Due: ${H.shortDate(inv.dueDate)}`,
      `Bill to: ${billName || "-"}`,
      ...(inv.projectName ? [`Project: ${inv.projectName}`] : []),
      "---",
      ...(inv.lineItems || []).map((li) => ({ text: `${String(li.description || "").replace(/<[^>]*>/g, "").slice(0, 70)}  x${li.quantity}`, right: H.fmtMoney(li.amount ?? H.num(li.quantity) * H.num(li.unitPrice), cur) })),
      "---",
      { text: "Subtotal", right: H.fmtMoney(inv.subtotalAmount, cur) },
      { text: `Tax (${H.num(inv.taxRate)}%)`, right: H.fmtMoney(inv.taxAmount, cur) },
      { text: "Total", bold: true, right: H.fmtMoney(inv.totalAmount, cur) },
      ...(H.num(inv.paidAmount) ? [{ text: "Paid", right: H.fmtMoney(inv.paidAmount, cur) }] : []),
      ...(inv.paidAt ? [`Paid on ${H.shortDate(inv.paidAt)} via ${String(inv.paymentMethod || "").replace("_", " ")}`] : []),
      ...(inv.voidReason ? [`Voided: ${inv.voidReason}`] : []),
      "",
    ];
  }
  function sendPdf(res, invoices, disposition, filename) {
    const lines = invoices.flatMap((inv, i) => [...(i ? [{ text: "---" }, ""] : []), ...invoicePdfLines(inv)]);
    const buf = H.makePdf(invoices.length === 1 ? "Invoice" : "Invoices", lines, { subtitle: "OrgTik Sales – Cairo, Egypt – billing@orgtik.test" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${disposition === "inline" ? "inline" : "attachment"}; filename="${filename}"`);
    res.setHeader("Content-Length", buf.length);
    res.end(buf);
  }

  // ------------------------------------------------------------------ invoice projections
  function invoiceListItem(req, inv) {
    const base = {
      invoiceId: inv.invoiceId, type: inv.kind, totalPrice: H.money(inv.totalAmount, inv.currencyCode), status: invoiceStatus(inv), projectName: inv.projectName || "",
      dueDate: inv.dueDate, createdAt: inv.createdAt, currencyCode: inv.currencyCode, paymentCurrency: inv.status === "paid" ? inv.currencyCode : undefined,
      subscriptionId: inv.subscriptionId || null,
    };
    if (inv.kind === "salesman") {
      const s = K.staffById(inv.salesmanId);
      return { ...base, salesmanName: s?.fullName || inv.salesmanName || "", salesmanAvatarUrl: s?.avatar || undefined };
    }
    return { ...base, plan: H.text(inv.planName, req.sc.lang) || "-", planTag: inv.planTag, paymentType: "subscription" };
  }
  function invoiceDetail(req, inv) {
    const c = inv.customerId && K.customerById(inv.customerId);
    const s = inv.salesmanId && K.staffById(inv.salesmanId);
    const billTo = inv.kind === "salesman" ? { name: s?.fullName || "", email: s?.email || "", address: s?.address || "" } : { name: c ? `${c.fullName} – ${c.companyName}` : "", email: c?.email || "", address: c?.address || "" };
    const payment = inv.paidAt ? { paidAt: inv.paidAt, method: inv.paymentMethod, reference: inv.paymentReference || undefined } : undefined;
    return {
      invoiceId: inv.invoiceId, type: inv.kind, status: invoiceStatus(inv), projectName: inv.projectName || "", plan: H.text(inv.planName, req.sc.lang) || undefined,
      salesmanName: s?.fullName, totalPrice: H.money(inv.totalAmount, inv.currencyCode), totalAmount: H.round(inv.totalAmount, inv.currencyCode),
      paidAmount: H.round(inv.paidAmount, inv.currencyCode), dueDate: inv.dueDate, createdAt: inv.createdAt, issuedAt: inv.issuedAt,
      paidAt: inv.paidAt || undefined, paidDate: inv.paidAt || undefined, paymentMethod: inv.paymentMethod || undefined, paymentReference: inv.paymentReference || undefined,
      voidReason: inv.voidReason || undefined, voidAt: inv.voidAt || undefined, currencyCode: inv.currencyCode, paymentCurrency: inv.status === "paid" ? inv.currencyCode : undefined,
      billTo, customer: billTo, lineItems: (inv.lineItems || []).map((l) => ({ id: l.id, description: l.description, quantity: l.quantity, amount: H.round(l.amount, inv.currencyCode) })),
      subtotalAmount: H.round(inv.subtotalAmount, inv.currencyCode), taxRate: H.num(inv.taxRate), taxAmount: H.round(inv.taxAmount, inv.currencyCode),
      method: inv.paymentMethod || undefined, details: inv.paymentReference || undefined, payment, subscriptionId: inv.subscriptionId || null,
    };
  }
  function customOut(inv) {
    const c = inv.customerId && K.customerById(inv.customerId);
    const total = H.round(inv.totalAmount, inv.currencyCode);
    return {
      invoiceId: inv.invoiceId, invoiceNumber: inv.invoiceNumber, invoiceType: "custom", type: "custom", paymentType: "custom", status: invoiceStatus(inv),
      customerId: inv.customerId || undefined, clientName: inv.billingName || c?.companyName, customerName: c?.fullName || inv.billingName, email: c?.email || inv.billingEmail, phone: c?.phoneNumber || inv.billingPhone,
      billingName: inv.billingName, billingContactPerson: inv.billingContactPerson, billingAddress: inv.billingAddress, billingEmail: inv.billingEmail, billingPhone: inv.billingPhone,
      contactPerson: inv.contactPerson, contactEmail: inv.contactEmail, contactPhone: inv.contactPhone,
      currencyCode: inv.currencyCode, currency: inv.currencyCode, paymentCurrency: inv.status === "paid" ? inv.currencyCode : undefined,
      amount: H.money(total, inv.currencyCode), totalAmount: total, totalPrice: total, subtotalAmount: H.round(inv.subtotalAmount, inv.currencyCode),
      taxRate: H.num(inv.taxRate), taxAmount: H.round(inv.taxAmount, inv.currencyCode), description: inv.description, closingText: inv.closingText,
      lineItems: inv.lineItems.map((l) => ({ description: l.description, quantity: l.quantity, unitPrice: H.round(l.unitPrice, inv.currencyCode), amount: H.round(l.amount, inv.currencyCode) })),
      dueDate: inv.dueDate, issuedAt: inv.issuedAt, createdAt: inv.createdAt, updatedAt: inv.updatedAt || inv.createdAt,
      canMarkPaidManually: inv.status !== "paid" && inv.status !== "void", isCouponApplicable: false,
      invoicePdfUrl: `${S.ctx.apiUrl("sales")}/api/invoices/${inv.invoiceId}/custom/generate-pdf`,
      metadata: inv.metadata || {}, paidAt: inv.paidAt || undefined, paymentReference: inv.paymentReference || undefined, paymentNotes: inv.paymentNotes || undefined,
      paymentProof: inv.paymentProof || undefined, sentTo: inv.sentTo || [],
    };
  }
  function customBody(b, existing) {
    const items = Array.isArray(b.lineItems) ? b.lineItems : existing?.lineItems;
    if (!items || !items.length) return { error: "Add at least one line item" };
    const cur = String(b.currency || existing?.currencyCode || "USD").toUpperCase();
    const lineItems = items.map((l) => ({ description: String(l.description || "").trim() || "Item", quantity: H.num(l.quantity) || 1, unitPrice: H.num(l.unitPrice), amount: H.round((H.num(l.quantity) || 1) * H.num(l.unitPrice), cur) }));
    const subtotal = lineItems.reduce((s, l) => s + l.amount, 0);
    const taxRate = b.taxRate != null ? H.num(b.taxRate) : H.num(existing?.taxRate);
    const tax = (subtotal * taxRate) / 100;
    const customer = b.customerId ? K.customerById(b.customerId) : existing?.customerId ? K.customerById(existing.customerId) : null;
    const pick = (k, fallback) => (b[k] !== undefined ? b[k] || null : existing ? existing[k] : fallback);
    return {
      value: {
        customerId: customer?.id || null, invoiceNumber: pick("invoiceNumber", null), currencyCode: cur,
        billingName: pick("billingName", customer?.companyName || null), billingContactPerson: pick("billingContactPerson", customer?.fullName || null),
        billingAddress: pick("billingAddress", customer ? `<p>${customer.address}</p>` : null), billingEmail: pick("billingEmail", customer?.email || null), billingPhone: pick("billingPhone", customer?.phoneNumber || null),
        contactPerson: pick("contactPerson", "Hany Samir"), contactEmail: pick("contactEmail", "billing@orgtik.test"), contactPhone: pick("contactPhone", "+20 2 2735 0000"),
        closingText: pick("closingText", null), description: pick("description", null), lineItems,
        subtotalAmount: H.round(subtotal, cur), taxRate, taxAmount: H.round(tax, cur), totalAmount: H.round(subtotal + tax, cur),
        dueDate: b.dueDate ? new Date(b.dueDate).toISOString() : existing?.dueDate || H.daysAhead(14),
        metadata: b.metadata !== undefined ? b.metadata || {} : existing?.metadata || {},
      },
    };
  }
  function visibleInvoices(req) {
    const sc = req.sc;
    if (sc.role === "customer") return db.invoices.filter((i) => i.customerId === sc.customer?.id && i.kind !== "salesman" && i.kind !== "refund");
    if (sc.role === "salesman") return db.invoices.filter((i) => (i.kind === "salesman" && sc.staff && i.salesmanId === sc.staff.id) || (i.kind === "subscription" && D().visibleProjects(req).some((p) => p.id === i.projectId)));
    return db.invoices.filter((i) => i.kind !== "refund");
  }
  function invoiceStats(req) {
    const list = visibleInvoices(req).filter((i) => i.kind !== "custom");
    const subsInv = list.filter((i) => i.kind === "subscription");
    const count = (s) => subsInv.filter((i) => invoiceStatus(i) === s).length;
    const zoneOf = (i) => (i.subscriptionId ? subById(i.subscriptionId)?.zoneId : null) || (i.commissionId ? commissionById(i.commissionId)?.zoneId : null) || C.zoneForCountry(K.customerById(i.customerId)?.countryCode)?.id || null;
    return {
      totalInvoices: list.length, paidSubscriptions: count("paid") + count("partial"), pendingSubscriptions: count("pending"), overdueSubscriptions: count("overdue"), voidSubscriptions: count("void"),
      totalRevenue: zoneGroups(subsInv.filter((i) => i.status !== "void").map((i) => ({ zoneId: zoneOf(i), currencyCode: i.currencyCode, v: i.paidAmount })), (r) => r.v),
      totalCommissions: zoneGroups(list.filter((i) => i.kind === "salesman").map((i) => ({ zoneId: zoneOf(i), currencyCode: i.currencyCode, v: i.totalAmount })), (r) => r.v),
    };
  }

  // ------------------------------------------------------------------ routes
  function routes(app) {
    const staff = (req, res) => K.requireRoles(req, res, ["admin", "manager", "salesman"], "Customers cannot perform this action");
    const approvers = (req, res) => K.requireRoles(req, res, ["admin", "manager"], "Only admins and managers can do this");
    const customerOnly = (req, res) => K.requireRoles(req, res, ["customer"], "This endpoint is for customers");
    const getSub = (req, res) => {
      refreshSchedules();
      const s = subById(req.params.id);
      if (!s || !visibleSubscriptions(req).includes(s)) {
        fail(res, 404, "Subscription not found");
        return null;
      }
      return s;
    };

    // ---------------- subscriptions
    const listSubs = (req, res) => {
      refreshSchedules();
      const { items, meta } = util.paginate(filterSubs(req, visibleSubscriptions(req)), req.query, { defaultLimit: 10 });
      ok(res, { items: items.map((s) => subscriptionListItem(req, s)), meta }, "Subscriptions retrieved");
    };
    app.get("/api/subscriptions/admin", (req, res) => { if (staff(req, res)) listSubs(req, res); });
    app.get("/api/subscriptions/customer", listSubs);
    app.get("/api/subscriptions", listSubs);
    app.get("/api/subscriptions/summary/admin", (req, res) => {
      if (!staff(req, res)) return;
      refreshSchedules();
      const list = visibleSubscriptions(req);
      const withZone = (s, v) => ({ zoneId: s.zoneId, currencyCode: s.currencyCode, v });
      ok(res, {
        totalSubscriptions: list.length,
        totalValue: zoneGroups(list.map((s) => withZone(s, s.totalAmount)), (r) => r.v),
        installmentPlans: list.filter((s) => s.paymentType === "installment").length,
        paidAmount: zoneGroups(list.map((s) => withZone(s, s.paidAmount)), (r) => r.v),
        activeSubscriptions: list.filter((s) => lifecycle(s) === "active").length,
        pendingPayments: zoneGroups(list.filter((s) => lifecycle(s) !== "cancelled").map((s) => withZone(s, Math.max(0, H.num(s.totalAmount) - H.num(s.paidAmount)))), (r) => r.v),
        expiringSoon: list.filter((s) => lifecycle(s) === "expiring_soon").length,
        expiredSubscriptions: list.filter((s) => lifecycle(s) === "expired").length,
        cancelled: list.filter((s) => lifecycle(s) === "cancelled").length,
      }, "Subscription summary retrieved");
    });
    app.get("/api/subscriptions/summary/customer", (req, res) => {
      refreshSchedules();
      const list = visibleSubscriptions(req);
      const withZone = (s, v) => ({ zoneId: s.zoneId, currencyCode: s.currencyCode, v });
      const next = list.flatMap((s) => s.installments.filter((i) => i.status !== "paid").map((i) => i.dueDate)).concat(list.flatMap((s) => subInvoices(s).filter((i) => i.status !== "paid" && i.status !== "void").map((i) => i.dueDate))).sort()[0] || null;
      ok(res, {
        totalSubscriptions: list.length,
        totalCost: zoneGroups(list.map((s) => withZone(s, s.totalAmount)), (r) => r.v),
        pendingPayments: zoneGroups(list.filter((s) => lifecycle(s) !== "cancelled").map((s) => withZone(s, Math.max(0, H.num(s.totalAmount) - H.num(s.paidAmount)))), (r) => r.v),
        paidSubscriptions: list.filter((s) => paymentStatus(s) === "paid").length,
        installmentPlans: list.filter((s) => s.paymentType === "installment").length,
        nextInstallmentPayment: next,
      }, "Subscription summary retrieved");
    });
    app.post("/api/subscriptions/preflight", (req, res) => {
      const b = req.body || {};
      const plan = C.planById(b.planId);
      if (!plan || plan.archivedAt) return fail(res, 404, "Plan not found");
      const customer = req.sc.customer;
      const r = D().buildDeal({ planSelections: [{ planId: plan.id, durationId: b.durationId, paymentMethod: b.installmentDurationId ? "installment" : "cash", installmentDurationId: b.installmentDurationId }], couponCode: b.couponCode }, { customer, lang: req.sc.lang });
      if (r.error) return fail(res, 422, r.error);
      if (r.value.totals.error) return fail(res, 400, r.value.totals.error);
      const l = r.value.lines[0];
      const t = r.value.totals;
      const cur = t.currency;
      const baseAmount = H.num(l.listMonthlyPrice) * l.durationMonths;
      ok(res, {
        planId: plan.id, planName: H.text(plan.name, req.sc.lang), durationId: l.durationId, months: l.durationMonths,
        monthlyPrice: l.listMonthlyPrice, baseAmount: H.money(baseAmount, cur), durationDiscount: l.discountPercentage, durationDiscountAmount: l.discountAmount,
        couponDiscount: t.coupon ? (t.coupon.discountType === "percentage" ? H.money(t.coupon.discountValue, "USD") : H.money(t.discount, cur)) : undefined,
        couponDiscountAmount: t.coupon ? H.money(t.discount, cur) : undefined,
        totalAmount: H.money(t.net, cur), currency: cur, couponCode: t.couponCode || undefined,
      }, "Subscription preview calculated");
    });
    app.post("/api/subscriptions/customer", (req, res) => {
      if (!customerOnly(req, res)) return;
      const b = req.body || {};
      const plan = C.planById(b.planId);
      if (!plan || plan.archivedAt || !plan.isActive) return fail(res, 404, "Plan not found");
      const r = D().createProject(req, {
        projectName: b.projectName || H.text(plan.name, req.sc.lang), projectDescription: b.projectDescription || "", projectType: "client_project",
        departmentId: plan.departmentId, priority: "medium", couponCode: b.couponCode,
        planSelections: [{ planId: plan.id, durationId: b.durationId, paymentMethod: b.installmentDurationId ? "installment" : "cash", installmentDurationId: b.installmentDurationId }],
      });
      if (r.error) return fail(res, r.error.includes("oupon") ? 400 : 422, r.error);
      D().approveContract(r.contract, { actorUser: req.sc.user });
      const subs = db.subscriptions.filter((s) => s.contractId === r.contract.id);
      if (b.paymentMode === "pay_now") {
        for (const s of subs) {
          const due = subInvoices(s).filter((i) => i.status !== "paid").reduce((sum, i) => sum + H.num(i.totalAmount) - H.num(i.paidAmount), 0);
          applyPayment(s, due, { method: "credit_card", reference: `card-${H.token(4)}` });
        }
      } else {
        for (const s of subs) s.status = "pending";
      }
      ok(res, { subscriptionId: subs[0]?.id, projectId: r.value.id }, b.paymentMode === "pay_now" ? "Subscription created and paid" : "Subscription created – pay any time from your invoices", 201);
    });
    app.get("/api/subscriptions/:id/admin", (req, res) => {
      if (!staff(req, res)) return;
      const s = getSub(req, res);
      if (s) ok(res, subscriptionDetail(req, s), "Subscription retrieved");
    });
    app.get("/api/subscriptions/:id/durations", (req, res) => {
      const s = getSub(req, res);
      if (!s) return;
      ok(res, { subscriptionId: s.id, planId: s.planId, planName: H.text(s.planName, req.sc.lang), durations: renewalDurations(s) }, "Renewal durations retrieved");
    });
    app.get("/api/subscriptions/:id", (req, res) => {
      const s = getSub(req, res);
      if (s) ok(res, subscriptionDetail(req, s), "Subscription retrieved");
    });
    for (const prefix of ["/admin", ""]) {
      // The customer path is for the customer themselves; staff go through the admin path, which
      // needs an admin or manager. It used to let anyone through, so a salesman could refund,
      // cancel or pause a subscription (SAL-021, wave 6).
      const guard = prefix ? approvers : (req, res) => req.sc.role === "customer" || approvers(req, res);
      app.post(`/api/subscriptions/:id${prefix}/renew/preflight`, (req, res) => {
        if (!guard(req, res)) return;
        const s = getSub(req, res);
        if (!s) return;
        const r = renewalPreflight(s, req.body || {});
        if (r.error) return fail(res, 422, r.error);
        ok(res, r.value, "Renewal preview calculated");
      });
      app.post(`/api/subscriptions/:id${prefix}/renew`, (req, res) => {
        if (!guard(req, res)) return;
        const s = getSub(req, res);
        if (!s) return;
        const r = renew(req, s, req.body || {});
        if (r.error) return fail(res, 422, r.error);
        ok(res, r.value, "Subscription renewed successfully");
      });
      app.post(`/api/subscriptions/:id${prefix}/pay`, S.ctx.upload.none(), (req, res) => {
        if (!guard(req, res)) return;
        const s = getSub(req, res);
        if (!s) return;
        const remaining = Math.max(0, H.num(s.totalAmount) - H.num(s.paidAmount));
        const amount = H.num(req.body?.amount);
        if (!(amount > 0)) return fail(res, 422, "Enter an amount greater than zero");
        if (amount > remaining + 0.01) return fail(res, 422, `Amount exceeds the remaining balance of ${H.fmtMoney(remaining, s.currencyCode)}`);
        const r = applyPayment(s, amount, { method: req.body?.paymentMethod || (prefix ? "bank_transfer" : "credit_card"), reference: req.body?.reference });
        ok(res, { subscriptionId: s.id, invoiceCode: r.codes.join(", "), paidAmount: H.money(s.paidAmount, s.currencyCode), remainingAmount: H.money(Math.max(0, H.num(s.totalAmount) - H.num(s.paidAmount)), s.currencyCode), status: paymentStatus(s) }, "Payment recorded successfully");
      });
      app.post(`/api/subscriptions/:id${prefix}/cancel`, (req, res) => {
        if (!guard(req, res)) return;
        const s = getSub(req, res);
        if (!s) return;
        if (s.status === "cancelled") return fail(res, 409, "Subscription is already cancelled");
        const ts = nowIso();
        Object.assign(s, { status: "cancelled", cancelReason: req.body?.reason || "Cancelled", cancelledAt: ts, autoRenew: false, updatedAt: ts });
        for (const inv of subInvoices(s)) if (inv.status === "pending" && new Date(inv.dueDate).getTime() > nowMs()) Object.assign(inv, { status: "void", voidReason: "Subscription cancelled", voidAt: ts });
        K.notify([K.customerUserId(s.customerId), ...K.adminIds()], "subscription.cancelled", { title: "Subscription cancelled", message: `${s.projectName} (${s.number}) was cancelled: ${s.cancelReason}.`, data: { subscriptionId: s.id } });
        ok(res, { subscriptionId: s.id, status: "cancelled", cancelReason: s.cancelReason, cancelledAt: ts }, "Subscription cancelled");
      });
      app.post(`/api/subscriptions/:id${prefix}/refund`, (req, res) => {
        if (!guard(req, res)) return;
        const s = getSub(req, res);
        if (!s) return;
        const amount = H.num(req.body?.amount);
        const refundable = H.num(s.paidAmount) - H.num(s.refundedAmount);
        if (!(amount > 0)) return fail(res, 422, "Enter a refund amount");
        if (amount > refundable + 0.01) return fail(res, 422, `You can refund at most ${H.fmtMoney(refundable, s.currencyCode)}`);
        const ts = nowIso();
        const code = K.nextCode("refund", `RF-${new Date().getUTCFullYear()}`);
        db.invoices.push({ id: H.newId(), invoiceId: code, kind: "refund", subscriptionId: s.id, customerId: s.customerId, projectName: s.projectName, currencyCode: s.currencyCode, totalAmount: amount, paidAmount: amount, status: "paid", paymentMethod: req.body?.refundTo || "original_payment_method", createdAt: ts, issuedAt: ts, dueDate: ts, paidAt: ts, lineItems: [{ id: H.newId(), description: `Refund – ${req.body?.note || s.projectName}`, quantity: 1, amount }], subtotalAmount: amount, taxRate: 0, taxAmount: 0 });
        s.refundedAmount = H.round(H.num(s.refundedAmount) + amount, s.currencyCode);
        s.refunds.push({ code, amount, refundTo: req.body?.refundTo, note: req.body?.note || null, at: ts });
        s.updatedAt = ts;
        K.notify([K.customerUserId(s.customerId)], "subscription.refunded", { title: "Refund issued", message: `${H.fmtMoney(amount, s.currencyCode)} was refunded for ${s.projectName}.`, data: { subscriptionId: s.id, refundCode: code } });
        ok(res, { subscriptionId: s.id, refundAmount: H.money(amount, s.currencyCode), refundTo: req.body?.refundTo || "original_payment_method", refundInvoiceCode: code }, "Refund issued successfully");
      });
      for (const action of ["pause", "resume"]) {
        app.post(`/api/subscriptions/:id${prefix}/${action}`, (req, res) => {
          if (!guard(req, res)) return;
          const s = getSub(req, res);
          if (!s) return;
          const ts = nowIso();
          if (action === "pause") {
            if (s.status !== "active") return fail(res, 409, `Only active subscriptions can be paused (current: ${lifecycle(s)})`);
            Object.assign(s, { status: "paused", pausedAt: ts, updatedAt: ts });
          } else {
            if (s.status !== "paused") return fail(res, 409, "Subscription is not paused");
            const pausedMs = nowMs() - new Date(s.pausedAt).getTime();
            Object.assign(s, { status: "active", endDate: H.iso(new Date(s.endDate).getTime() + pausedMs), pausedAt: null, updatedAt: ts });
          }
          K.notify([K.customerUserId(s.customerId)], `subscription.${action === "pause" ? "paused" : "resumed"}`, { title: `Subscription ${action === "pause" ? "paused" : "resumed"}`, message: `${s.projectName} (${s.number}) is ${action === "pause" ? "paused" : "active again"}.`, data: { subscriptionId: s.id } });
          ok(res, { subscriptionId: s.id, status: lifecycle(s), pausedAt: s.pausedAt }, action === "pause" ? "Subscription paused" : "Subscription resumed");
        });
      }
    }
    app.patch("/api/subscriptions/:id/admin/auto-renew", (req, res) => {
      if (!staff(req, res)) return;
      const s = getSub(req, res);
      if (!s) return;
      s.autoRenew = !!req.body?.enabled;
      s.updatedAt = nowIso();
      ok(res, { subscriptionId: s.id, autoRenew: s.autoRenew }, s.autoRenew ? "Auto-renew enabled" : "Auto-renew disabled");
    });

    // ---------------- invoices
    app.get("/api/invoices", (req, res) => {
      refreshSchedules();
      const q = req.query;
      const s = String(q.q || q.search || "").toLowerCase().trim();
      if (q.invoiceType === "custom") {
        if (!staff(req, res)) return;
        let list = db.invoices.filter((i) => i.kind === "custom");
        if (s) list = list.filter((i) => [i.invoiceId, i.invoiceNumber, i.billingName, K.customerById(i.customerId)?.fullName].some((v) => String(v || "").toLowerCase().includes(s)));
        if (q.status) list = list.filter((i) => invoiceStatus(i) === q.status);
        const { items, meta } = util.paginate(H.sortDesc(list), q, { defaultLimit: 10 });
        return ok(res, { items: items.map(customOut), meta }, "Custom invoices retrieved");
      }
      const all = visibleInvoices(req).filter((i) => i.kind === "subscription" || i.kind === "salesman");
      const type = req.sc.role === "customer" ? "subscription" : q.type || "subscription";
      let list = all.filter((i) => i.kind === type);
      if (q.subscriptionId) list = list.filter((i) => i.subscriptionId === q.subscriptionId);
      if (q.status) list = list.filter((i) => invoiceStatus(i) === q.status);
      if (s) list = list.filter((i) => [i.invoiceId, i.projectName, H.text(i.planName), K.staffById(i.salesmanId)?.fullName].some((v) => String(v || "").toLowerCase().includes(s)));
      const { items, meta } = util.paginate(H.sortDesc(list), q, { defaultLimit: 10 });
      ok(res, { items: items.map((i) => invoiceListItem(req, i)), meta: { ...meta, subscriptionTotal: all.filter((i) => i.kind === "subscription").length, salesmanTotal: all.filter((i) => i.kind === "salesman").length } }, "Invoices retrieved");
    });
    app.get("/api/invoices/customer/me", (req, res) => {
      refreshSchedules();
      const list = visibleInvoices(req).filter((i) => i.kind === "subscription" || i.kind === "custom");
      const { items, meta } = util.paginate(H.sortDesc(list), req.query, { defaultLimit: 10 });
      ok(res, { items: items.map((i) => (i.kind === "custom" ? customOut(i) : invoiceListItem(req, i))), meta }, "Invoices retrieved");
    });
    app.get("/api/invoices/status", (req, res) => { refreshSchedules(); ok(res, invoiceStats(req), "Invoice summary retrieved"); });
    app.get("/api/invoices/table-counts", (req, res) => {
      const list = visibleInvoices(req);
      ok(res, { subscriptions: list.filter((i) => i.kind === "subscription").length, salesMan: list.filter((i) => i.kind === "salesman").length, customInvoices: db.invoices.filter((i) => i.kind === "custom").length }, "Invoice counts retrieved");
    });
    app.post("/api/invoices/generate-pdf", (req, res) => {
      const b = req.body || {};
      const visible = new Set(visibleInvoices(req));
      let list = [];
      if (Array.isArray(b.invoiceIds) && b.invoiceIds.length) list = b.invoiceIds.map(invoiceById).filter((i) => i && visible.has(i));
      else if (b.subscriptionId) list = db.invoices.filter((i) => i.subscriptionId === b.subscriptionId && i.kind === "subscription" && visible.has(i));
      if (!list.length) return fail(res, 404, "No invoices found for this request");
      sendPdf(res, list, b.disposition, list.length === 1 ? `invoice-${list[0].invoiceId}.pdf` : `invoices-${b.subscriptionId || "bundle"}.pdf`);
    });
    app.post("/api/invoices/custom", (req, res) => {
      if (!approvers(req, res)) return;
      const r = customBody(req.body || {});
      if (r.error) return fail(res, 422, r.error);
      const ts = nowIso();
      const code = K.nextCode("customInvoice", `CINV-${new Date().getUTCFullYear()}`);
      const inv = { id: H.newId(), invoiceId: code, kind: "custom", type: "custom", status: "pending", paidAmount: 0, createdAt: ts, issuedAt: ts, updatedAt: ts, sentTo: [], ...r.value, invoiceNumber: r.value.invoiceNumber || code };
      db.invoices.push(inv);
      if (inv.customerId) K.notify([K.customerUserId(inv.customerId)], "custom_invoice.created", { title: "New invoice", message: `Invoice ${inv.invoiceNumber} for ${H.fmtMoney(inv.totalAmount, inv.currencyCode)} was issued to you.`, data: { invoiceId: inv.invoiceId, invoiceNumber: inv.invoiceNumber, amount: H.money(inv.totalAmount, inv.currencyCode), currency: inv.currencyCode } });
      ok(res, customOut(inv), "Custom invoice created successfully", 201);
    });
    const getInvoice = (req, res) => {
      refreshSchedules();
      const inv = invoiceById(req.params.invoiceId);
      if (!inv || !(visibleInvoices(req).includes(inv) || (inv.kind === "custom" && req.sc.role !== "customer") || (inv.kind === "custom" && inv.customerId === req.sc.customer?.id))) {
        fail(res, 404, "Invoice not found");
        return null;
      }
      return inv;
    };
    app.get("/api/invoices/:invoiceId", (req, res) => {
      const inv = getInvoice(req, res);
      if (inv) ok(res, inv.kind === "custom" ? customOut(inv) : invoiceDetail(req, inv), "Invoice retrieved");
    });
    app.patch("/api/invoices/:invoiceId/custom", (req, res) => {
      if (!approvers(req, res)) return;
      const inv = getInvoice(req, res);
      if (!inv) return;
      if (inv.kind !== "custom") return fail(res, 422, "Only custom invoices can be edited");
      if (inv.status === "paid") return fail(res, 409, "Paid invoices cannot be edited");
      const r = customBody(req.body || {}, inv);
      if (r.error) return fail(res, 422, r.error);
      Object.assign(inv, r.value, { invoiceNumber: r.value.invoiceNumber || inv.invoiceNumber, updatedAt: nowIso() });
      ok(res, customOut(inv), "Custom invoice updated successfully");
    });
    app.delete("/api/invoices/:invoiceId/custom", (req, res) => {
      if (!approvers(req, res)) return;
      const inv = getInvoice(req, res);
      if (!inv) return;
      if (inv.kind !== "custom") return fail(res, 422, "Only custom invoices can be deleted");
      db.invoices.splice(db.invoices.indexOf(inv), 1);
      ok(res, null, "Custom invoice deleted successfully");
    });
    app.post("/api/invoices/:invoiceId/mark-paid-manually", S.ctx.upload.single("paymentProof"), (req, res) => {
      if (!approvers(req, res)) return;
      const inv = getInvoice(req, res);
      if (!inv) return;
      if (inv.status === "paid") return fail(res, 409, "Invoice is already paid");
      const paidAt = req.body?.paidAt ? new Date(req.body.paidAt).toISOString() : nowIso();
      if (req.file) inv.paymentProof = K.uploaded(req.file);
      inv.paymentNotes = req.body?.notes || null;
      markInvoicePaid(inv, { method: "bank_transfer", reference: req.body?.paymentReference || null });
      inv.paidAt = paidAt;
      ok(res, inv.kind === "custom" ? customOut(inv) : invoiceDetail(req, inv), "Invoice marked as paid");
    });
    app.post("/api/invoices/:invoiceId/custom/send", (req, res) => {
      if (!approvers(req, res)) return;
      const inv = getInvoice(req, res);
      if (!inv) return;
      const emails = (Array.isArray(req.body?.emails) ? req.body.emails : []).map((e) => String(e).trim()).filter(Boolean);
      if (!emails.length) return fail(res, 422, "Add at least one email address");
      const bad = emails.find((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
      if (bad) return fail(res, 422, `Invalid email address: ${bad}`);
      inv.sentTo = [...new Set([...(inv.sentTo || []), ...emails])];
      inv.lastSentAt = nowIso();
      ok(res, null, `Invoice sent to ${emails.join(", ")} (local mock – no email was delivered)`);
    });
    app.get("/api/invoices/:invoiceId/custom/generate-pdf", (req, res) => {
      const inv = getInvoice(req, res);
      if (!inv) return;
      sendPdf(res, [inv], req.query.disposition || "attachment", `${inv.invoiceNumber || inv.invoiceId}.pdf`);
    });
    app.post("/api/invoices/:invoiceId/mark-paid", (req, res) => {
      if (!approvers(req, res)) return;
      const inv = getInvoice(req, res);
      if (!inv) return;
      if (inv.status === "paid" || inv.status === "void") return fail(res, 409, `Invoice is already ${inv.status}`);
      const b = req.body || {};
      if (b.paymentMethod && !["bank_transfer", "credit_card", "cash", "other"].includes(b.paymentMethod)) return fail(res, 422, "Unknown payment method");
      // Never keep a card number: anything that looks like one is stored as its last 4 digits (SAL-020).
      const raw = b.transferReference || b.cardNumber || b.paymentDetails || null;
      const digits = String(raw ?? "").replace(/[\s-]/g, "");
      const reference = /^\d{12,19}$/.test(digits) ? `card ending ${digits.slice(-4)}` : raw;
      markInvoicePaid(inv, { method: b.paymentMethod || "bank_transfer", reference });
      if (b.paidAt) inv.paidAt = new Date(b.paidAt).toISOString();
      if (inv.commissionId) {
        const cm = commissionById(inv.commissionId);
        if (cm && payoutStatus(cm) !== "paid") payCommission(cm, H.num(cm.amount) - H.num(cm.paidAmount), { at: undefined });
      }
      ok(res, inv.kind === "custom" ? customOut(inv) : invoiceDetail(req, inv), "Invoice marked as paid");
    });
    app.post("/api/invoices/:invoiceId/void", (req, res) => {
      if (!approvers(req, res)) return;
      const inv = getInvoice(req, res);
      if (!inv) return;
      if (inv.status === "paid") return fail(res, 409, "Paid invoices cannot be voided");
      if (inv.status === "void") return fail(res, 409, "Invoice is already void");
      const reason = String(req.body?.reason || "").trim();
      if (!reason) return fail(res, 422, "Enter a reason for voiding the invoice");
      Object.assign(inv, { status: "void", voidReason: reason, voidAt: nowIso() });
      const sub = inv.subscriptionId && subById(inv.subscriptionId);
      if (sub) {
        const inst = sub.installments.find((i) => i.invoiceId === inv.invoiceId);
        if (inst) inst.invoiceId = null;
      }
      ok(res, invoiceDetail(req, inv), "Invoice voided");
    });
    app.post("/api/invoices/:invoiceId/unvoid", (req, res) => {
      if (!approvers(req, res)) return;
      const inv = getInvoice(req, res);
      if (!inv) return;
      if (inv.status !== "void") return fail(res, 409, "Invoice is not void");
      Object.assign(inv, { status: H.num(inv.paidAmount) > 0 ? "partial" : "pending", voidReason: null, voidAt: null });
      ok(res, invoiceDetail(req, inv), "Invoice restored");
    });
    // Checkout stand-ins (spec'd payment endpoints; settle immediately with a fake card payment).
    app.post("/api/payments/checkout/bulk", (req, res) => {
      const ids = Array.isArray(req.body?.invoiceIds) ? req.body.invoiceIds : [];
      const list = ids.map(invoiceById).filter((i) => i && visibleInvoices(req).includes(i) && i.status !== "paid" && i.status !== "void");
      if (!list.length) return fail(res, 404, "No payable invoices found");
      list.forEach((i) => markInvoicePaid(i, { method: "credit_card", reference: `mock-checkout-${H.token(4)}` }));
      ok(res, { sessionId: `cs_local_${H.token(8)}`, checkoutUrl: null, status: "paid", invoiceIds: list.map((i) => i.invoiceId) }, "Payment completed (local mock checkout)");
    });
    app.post("/api/payments/checkout/:invoiceId", (req, res) => {
      const inv = invoiceById(req.params.invoiceId);
      if (!inv || !visibleInvoices(req).includes(inv)) return fail(res, 404, "Invoice not found");
      if (inv.status === "paid" || inv.status === "void") return fail(res, 409, `Invoice is already ${inv.status}`);
      markInvoicePaid(inv, { method: "credit_card", reference: `mock-checkout-${H.token(4)}` });
      ok(res, { sessionId: `cs_local_${H.token(8)}`, checkoutUrl: null, status: "paid", invoiceId: inv.invoiceId }, "Payment completed (local mock checkout)");
    });

    // ---------------- commissions & wallets
    const commissionQuery = (req, list) => {
      const q = req.query;
      const statuses = H.listParam(q.payoutStatus);
      if (statuses.length) list = list.filter((c) => statuses.includes(payoutStatus(c)));
      if (q.salesmanId) list = list.filter((c) => c.salesmanId === q.salesmanId || K.staffById(c.salesmanId)?.authUserId === Number(q.salesmanId));
      if (q.search) {
        const s = String(q.search).toLowerCase();
        list = list.filter((c) => [c.projectName, c.reference, K.staffById(c.salesmanId)?.fullName].some((v) => String(v || "").toLowerCase().includes(s)));
      }
      return H.sortDesc(list);
    };
    const ownCommissions = (req) => db.commissions.filter((c) => req.sc.staff && c.salesmanId === req.sc.staff.id);
    app.get("/api/commissions", (req, res) => {
      const base = req.sc.role === "salesman" ? ownCommissions(req) : req.sc.role === "customer" ? [] : db.commissions;
      const { items, meta } = util.paginate(commissionQuery(req, base), req.query, { defaultLimit: 10 });
      ok(res, { items: items.map(commissionOut), meta }, "Commissions retrieved");
    });
    app.get("/api/commissions/me", (req, res) => {
      const { items, meta } = util.paginate(commissionQuery(req, ownCommissions(req)), req.query, { defaultLimit: 10 });
      ok(res, { items: items.map(commissionOut), meta }, "Commissions retrieved");
    });
    app.get("/api/commissions/me/summary", (req, res) => ok(res, commissionSummary(ownCommissions(req)), "Commission summary retrieved"));
    app.get("/api/commissions/summary", (req, res) => {
      if (!approvers(req, res)) return;
      ok(res, commissionSummary(db.commissions), "Commission summary retrieved");
    });
    app.get("/api/commissions/:commissionId", (req, res) => {
      const cm = commissionById(req.params.commissionId);
      if (!cm || (req.sc.role === "salesman" && cm.salesmanId !== req.sc.staff?.id) || req.sc.role === "customer") return fail(res, 404, "Commission not found");
      ok(res, { ...commissionOut(cm), payments: cm.payments }, "Commission retrieved");
    });
    app.post("/api/commissions/:commissionId/pay", S.ctx.upload.single("receiptDocument"), (req, res) => {
      if (!K.requireRoles(req, res, ["admin"], "Only admins can pay commissions")) return;
      const cm = commissionById(req.params.commissionId);
      if (!cm) return fail(res, 404, "Commission not found");
      const due = H.num(cm.amount) - H.num(cm.paidAmount);
      const amount = H.num(req.body?.amount);
      if (!(amount > 0)) return fail(res, 422, "Enter a valid amount");
      if (amount > due + 0.01) return fail(res, 422, `Amount exceeds the commission due (${H.fmtMoney(due, cm.currency)})`);
      payCommission(cm, amount, { receipt: K.uploaded(req.file), reference: req.body?.reference });
      ok(res, commissionOut(cm), "Commission payment recorded");
    });
    app.get("/api/wallets/salesmen/:salesmanId", (req, res) => {
      const s = K.resolveSalesman(req.params.salesmanId) || K.staffById(req.params.salesmanId);
      if (!s) return fail(res, 404, "Salesman not found");
      if (req.sc.role === "salesman" && req.sc.staff?.id !== s.id) return fail(res, 403, "You can only view your own wallet");
      ok(res, { salesmanId: s.id, ...wallet(s), transactions: db.commissions.filter((c) => c.salesmanId === s.id).flatMap((c) => [{ type: "credit", amount: H.money(c.amount, c.currency), currency: c.currency, reference: c.reference, at: c.earnedAt }, ...c.payments.map((p) => ({ type: "withdrawal", amount: H.money(p.amount, c.currency), currency: c.currency, reference: c.reference, at: p.paidAt }))]).sort((a, b) => String(b.at).localeCompare(String(a.at))) }, "Wallet retrieved");
    });
    app.post("/api/wallets/salesmen/:salesmanId/withdraw", (req, res) => {
      if (!K.requireRoles(req, res, ["admin"], "Only admins can pay out wallets")) return;
      const s = K.resolveSalesman(req.params.salesmanId);
      if (!s) return fail(res, 404, "Salesman not found");
      let left = H.num(req.body?.amount);
      if (!(left > 0)) return fail(res, 422, "Enter a valid amount");
      const code = String(req.headers["x-currency"] || wallet(s).currencyCode).toUpperCase();
      for (const cm of H.sortDesc(db.commissions.filter((c) => c.salesmanId === s.id && payoutStatus(c) !== "paid")).reverse()) {
        if (left <= 0.001) break;
        const dueNative = H.num(cm.amount) - H.num(cm.paidAmount);
        const leftNative = H.convert(left, code, cm.currency);
        const paid = payCommission(cm, Math.min(dueNative, leftNative), { reference: req.body?.reference });
        left -= H.convert(paid, cm.currency, code);
      }
      ok(res, { salesmanId: s.id, ...wallet(s) }, "Withdrawal recorded");
    });

    // ---------------- coupons
    app.get("/api/coupons/validate/:code", (req, res) => {
      const categoryIds = [...H.listParam(req.query.categoryId), ...H.listParam(req.query.categoryIds)];
      const r = validateCoupon(req.params.code, { categoryIds, subtotal: req.query.subtotal, currency: req.query.currency || "USD", customerId: req.sc.customer?.id });
      ok(res, { valid: r.valid, reason: r.reason, discountAmount: r.discountAmount, code: String(req.params.code).toUpperCase(), discountType: r.coupon?.discountType, discountValue: r.coupon?.discountValue, scope: req.query.scope || "invoice" }, r.valid ? "Coupon is valid" : r.reason);
    });
    app.get("/api/coupons", (req, res) => {
      let list = db.coupons;
      if (req.query.search) list = list.filter((c) => c.code.toLowerCase().includes(String(req.query.search).toLowerCase()));
      if (req.query.status) list = list.filter((c) => couponStatus(c) === req.query.status);
      const { items, meta } = util.paginate(H.sortDesc(list), req.query, { defaultLimit: 10 });
      ok(res, { items: items.map(couponOut), meta }, "Coupons retrieved");
    });
    app.get("/api/coupons/:id", (req, res) => {
      const c = couponById(req.params.id);
      if (!c) return fail(res, 404, "Coupon not found");
      ok(res, couponOut(c), "Coupon retrieved");
    });
    function couponBody(b, existing) {
      const code = String(b.code ?? existing?.code ?? "").trim().toUpperCase();
      if (!/^[A-Z0-9_-]{3,32}$/.test(code)) return { error: "Coupon code must be 3–32 letters, numbers, dashes or underscores" };
      if (db.coupons.some((c) => c !== existing && c.code === code)) return { error: "A coupon with this code already exists", status: 409 };
      const categoryId = b.categoryId ?? existing?.categoryId;
      if (!C.catById(categoryId)) return { error: "Select a category" };
      const discountType = b.discountType ?? existing?.discountType;
      if (!["percentage", "fixed"].includes(discountType)) return { error: "Discount type must be percentage or fixed" };
      const value = H.num(b.discountValue ?? existing?.discountValue);
      if (!(value > 0) || (discountType === "percentage" && value > 100)) return { error: "Enter a valid discount value" };
      const startDate = new Date(b.startDate ?? existing?.startDate);
      const endDate = new Date(b.endDate ?? existing?.endDate);
      if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) return { error: "End date must be after the start date" };
      const isMultipleUse = b.isMultipleUse ?? existing?.isMultipleUse ?? false;
      const hasPerUserLimit = b.hasPerUserLimit ?? existing?.hasPerUserLimit ?? false;
      return {
        value: {
          code, categoryId, discountType, discountValue: H.money(value, "USD"), isMultipleUse: !!isMultipleUse,
          usageLimit: isMultipleUse ? (b.usageLimit ?? existing?.usageLimit ?? null) : 1,
          hasPerUserLimit: !!hasPerUserLimit, perUserLimit: hasPerUserLimit ? Number(b.perUserLimit ?? existing?.perUserLimit ?? 1) : null,
          startDate: startDate.toISOString(), endDate: endDate.toISOString(),
        },
      };
    }
    app.post("/api/coupons", (req, res) => {
      if (!approvers(req, res)) return;
      const r = couponBody(req.body || {});
      if (r.error) return fail(res, r.status || 422, r.error);
      const c = { id: H.newId(), usageCount: 0, ...r.value, createdAt: nowIso(), updatedAt: nowIso() };
      db.coupons.push(c);
      ok(res, couponOut(c), "Coupon created successfully", 201);
    });
    app.patch("/api/coupons/:id", (req, res) => {
      if (!approvers(req, res)) return;
      const c = couponById(req.params.id);
      if (!c) return fail(res, 404, "Coupon not found");
      const r = couponBody(req.body || {}, c);
      if (r.error) return fail(res, r.status || 422, r.error);
      Object.assign(c, r.value, { updatedAt: nowIso() });
      ok(res, couponOut(c), "Coupon updated successfully");
    });
    app.delete("/api/coupons/:id", (req, res) => {
      if (!approvers(req, res)) return;
      const c = couponById(req.params.id);
      if (!c) return fail(res, 404, "Coupon not found");
      db.coupons.splice(db.coupons.indexOf(c), 1);
      ok(res, null, "Coupon deleted successfully");
    });
    app.post("/api/coupons/:id/send", (req, res) => {
      if (!staff(req, res)) return;
      const c = couponById(req.params.id);
      if (!c) return fail(res, 404, "Coupon not found");
      const customer = K.customerById(req.body?.customerId);
      if (!customer) return fail(res, 422, "Select a customer");
      const cat = C.catById(c.categoryId);
      K.notify([customer.authUserId], "coupon.shared", { title: "You received a coupon", message: `Use ${c.code} for ${c.discountType === "percentage" ? `${H.num(c.discountValue)}%` : `USD ${c.discountValue}`} off ${H.text(cat?.name)} until ${H.shortDate(c.endDate)}.`, data: { couponId: c.id, code: c.code } });
      ok(res, null, `Coupon ${c.code} shared with ${customer.fullName}`);
    });

    // ---------------- loyalty (admin)
    const L2 = L;
    app.get("/api/loyalty/settings", (req, res) => ok(res, L2().settings, "Loyalty settings retrieved"));
    app.patch("/api/loyalty/settings", (req, res) => {
      if (!K.requireRoles(req, res, ["admin"], "Only admins can change the loyalty programme")) return;
      const b = req.body || {};
      const s = L2().settings;
      if (b.pointsPerUnit !== undefined && !(H.num(b.pointsPerUnit) > 0)) return fail(res, 422, "Points per unit must be greater than zero");
      if (b.pointsExpireAfterMonths !== undefined && !(Number(b.pointsExpireAfterMonths) >= 1)) return fail(res, 422, "Points must expire after at least one month");
      const ts = nowIso();
      if (b.isActive !== undefined) s.isActive = !!b.isActive;
      if (b.pointsPerUnit !== undefined) s.pointsPerUnit = H.money(b.pointsPerUnit, "USD");
      if (b.baseCurrency) { s.baseCurrency = b.baseCurrency; s.baseCurrencyName = H.cur(b.baseCurrency).name; }
      if (b.pointsExpireAfterMonths !== undefined) s.pointsExpireAfterMonths = Number(b.pointsExpireAfterMonths);
      if (Array.isArray(b.rates)) {
        const map = new Map(s.rates.map((r) => [r.currencyCode, r]));
        for (const r of b.rates) {
          if (!r.currencyCode || !(H.num(r.rate) > 0)) return fail(res, 422, `Invalid rate for ${r.currencyCode || "currency"}`);
          const existing = map.get(r.currencyCode);
          map.set(r.currencyCode, { currencyCode: r.currencyCode, currencyName: H.cur(r.currencyCode).name, rate: String(r.rate), isBase: r.currencyCode === s.baseCurrency, updatedAt: existing && existing.rate === String(r.rate) ? existing.updatedAt : ts });
        }
        if (!map.has(s.baseCurrency)) map.set(s.baseCurrency, { currencyCode: s.baseCurrency, currencyName: H.cur(s.baseCurrency).name, rate: "1", isBase: true, updatedAt: ts });
        s.rates = [...map.values()].map((r) => ({ ...r, isBase: r.currencyCode === s.baseCurrency }));
      }
      s.updatedAt = ts;
      ok(res, s, "Loyalty settings updated");
    });
    app.delete("/api/loyalty/settings/rates/:currencyCode", (req, res) => {
      if (!K.requireRoles(req, res, ["admin"], "Only admins can change the loyalty programme")) return;
      const s = L2().settings;
      if (req.params.currencyCode === s.baseCurrency) return fail(res, 409, "The base currency rate cannot be removed");
      const before = s.rates.length;
      s.rates = s.rates.filter((r) => r.currencyCode !== req.params.currencyCode);
      if (s.rates.length === before) return fail(res, 404, "Rate not found");
      s.updatedAt = nowIso();
      ok(res, null, "Rate removed");
    });
    app.get("/api/loyalty/rewards", (req, res) => {
      const { items, meta } = util.paginate(H.sortDesc(L2().rewards), req.query, { defaultLimit: 10 });
      ok(res, { items: items.map(rewardOut), meta }, "Rewards retrieved");
    });
    app.get("/api/loyalty/rewards/:id", (req, res) => {
      const r = L2().rewards.find((x) => x.id === req.params.id);
      if (!r) return fail(res, 404, "Reward not found");
      ok(res, rewardOut(r), "Reward retrieved");
    });
    function rewardBody(b, existing) {
      const name = String(b.name ?? existing?.name ?? "").trim();
      if (!name) return { error: "Reward name is required" };
      const pointCost = Number(b.pointCost ?? existing?.pointCost);
      if (!(pointCost > 0)) return { error: "Point cost must be greater than zero" };
      const discountType = b.discountType ?? existing?.discountType;
      if (!["percentage", "fixed"].includes(discountType)) return { error: "Discount type must be percentage or fixed" };
      const categoryId = b.categoryId !== undefined ? b.categoryId || null : existing?.categoryId ?? null;
      if (categoryId && !C.catById(categoryId)) return { error: "Unknown category" };
      return {
        value: {
          name, pointCost, validForDays: Number(b.validForDays ?? existing?.validForDays ?? 30), discountType, discountValue: H.money(b.discountValue ?? existing?.discountValue ?? 0, "USD"),
          categoryId, couponCodePrefix: String(b.couponCodePrefix ?? existing?.couponCodePrefix ?? (name.replace(/[^A-Za-z]/g, "").slice(0, 6) || "REWARD")).toUpperCase(),
          isActive: b.isActive !== undefined ? !!b.isActive : existing ? existing.isActive : true,
        },
      };
    }
    app.post("/api/loyalty/rewards", (req, res) => {
      if (!K.requireRoles(req, res, ["admin"], "Only admins can manage rewards")) return;
      const r = rewardBody(req.body || {});
      if (r.error) return fail(res, 422, r.error);
      const reward = { id: H.newId(), redemptionCount: 0, ...r.value, createdAt: nowIso(), updatedAt: nowIso() };
      L2().rewards.push(reward);
      ok(res, rewardOut(reward), "Reward created successfully", 201);
    });
    app.patch("/api/loyalty/rewards/:id", (req, res) => {
      if (!K.requireRoles(req, res, ["admin"], "Only admins can manage rewards")) return;
      const reward = L2().rewards.find((x) => x.id === req.params.id);
      if (!reward) return fail(res, 404, "Reward not found");
      const r = rewardBody(req.body || {}, reward);
      if (r.error) return fail(res, 422, r.error);
      Object.assign(reward, r.value, { updatedAt: nowIso() });
      ok(res, rewardOut(reward), "Reward updated successfully");
    });
    app.delete("/api/loyalty/rewards/:id", (req, res) => {
      if (!K.requireRoles(req, res, ["admin"], "Only admins can manage rewards")) return;
      const i = L2().rewards.findIndex((x) => x.id === req.params.id);
      if (i === -1) return fail(res, 404, "Reward not found");
      L2().rewards.splice(i, 1);
      ok(res, null, "Reward deleted successfully");
    });
    const loyaltyCustomers = () => db.customers.filter((c) => txOf(c.id).length > 0 || c.status === "qualified");
    app.get("/api/loyalty/customers", (req, res) => {
      if (!approvers(req, res)) return;
      const list = loyaltyCustomers().map(loyaltyCustomerRow).sort((a, b) => b.points - a.points);
      const { items, meta } = util.paginate(list, req.query, { defaultLimit: 10 });
      ok(res, { items, meta }, "Loyalty customers retrieved");
    });
    app.get("/api/loyalty/customers/:customerId", (req, res) => {
      if (!approvers(req, res)) return;
      const c = K.customerById(req.params.customerId);
      if (!c) return fail(res, 404, "Customer not found");
      const a = account(c.id);
      ok(res, { ...loyaltyCustomerRow(c), lifetimeExpired: a.lifetimeExpired, expiringSoon: a.expiringSoon, nextExpiryAt: a.nextExpiryAt }, "Loyalty customer retrieved");
    });
    const txList = (req, res, customerId) => {
      const { items, meta } = util.paginate(H.sortDesc(txOf(customerId)), req.query, { defaultLimit: 10 });
      ok(res, { items: items.map(txOut), meta }, "Transactions retrieved");
    };
    app.get("/api/loyalty/customers/:customerId/transactions", (req, res) => { if (approvers(req, res)) txList(req, res, req.params.customerId); });
    app.post("/api/loyalty/customers/:customerId/adjust", (req, res) => {
      if (!K.requireRoles(req, res, ["admin"], "Only admins can adjust points")) return;
      const c = K.customerById(req.params.customerId);
      if (!c) return fail(res, 404, "Customer not found");
      const b = req.body || {};
      const points = Math.round(H.num(b.points));
      if (!(points > 0)) return fail(res, 422, "Enter a positive number of points");
      if (!String(b.reason || "").trim()) return fail(res, 422, "Enter a reason for the adjustment");
      const a = account(c.id);
      if (b.direction === "deduct" && points > a.points) return fail(res, 422, `Customer only has ${a.points} points`);
      const signed = b.direction === "deduct" ? -points : points;
      const days = Number(b.validForDays) || L2().settings.pointsExpireAfterMonths * 30;
      addTx(c.id, { type: "adjusted", source: "manual_adjustment", reason: String(b.reason).trim(), points: signed, expiresAt: signed > 0 ? H.daysAhead(days) : null });
      K.notify([c.authUserId], "loyalty.points_adjusted", { title: signed > 0 ? "Bonus points added" : "Points adjusted", message: `${Math.abs(signed)} points were ${signed > 0 ? "added to" : "deducted from"} your balance: ${String(b.reason).trim()}`, data: { customerId: c.id } });
      ok(res, null, `${Math.abs(signed)} points ${signed > 0 ? "added" : "deducted"}`);
    });
    app.get("/api/loyalty/manager/overview", (req, res) => {
      const rows = loyaltyCustomers().map(loyaltyCustomerRow);
      ok(res, { outstandingPoints: rows.reduce((s, r) => s + r.points, 0), customersWithBalance: rows.filter((r) => r.points > 0).length }, "Loyalty overview retrieved");
    });
    app.get("/api/loyalty/manager/customers", (req, res) => {
      if (!approvers(req, res)) return;
      const list = loyaltyCustomers().map((c) => { const r = loyaltyCustomerRow(c); return { customerId: r.customerId, customerName: r.customerName, companyName: r.companyName, points: r.points }; }).sort((a, b) => b.points - a.points);
      const { items, meta } = util.paginate(list, req.query, { defaultLimit: 10 });
      ok(res, { items, meta }, "Loyalty customers retrieved");
    });
    app.get("/api/loyalty/manager/customers/:customerId/transactions", (req, res) => { if (approvers(req, res)) txList(req, res, req.params.customerId); });

    // ---------------- loyalty (customer)
    app.get("/api/loyalty/me", (req, res) => {
      if (!customerOnly(req, res)) return;
      const a = account(req.sc.customer.id);
      const s = L2().settings;
      ok(res, { programActive: s.isActive, balance: a.points, lifetimeEarned: a.lifetimeEarned, lifetimeRedeemed: a.lifetimeRedeemed, expiringSoon: a.expiringSoon, nextExpiryAt: a.nextExpiryAt, pointsPerUnit: s.pointsPerUnit, baseCurrency: s.baseCurrency }, "Loyalty overview retrieved");
    });
    app.get("/api/loyalty/me/transactions", (req, res) => { if (customerOnly(req, res)) txList(req, res, req.sc.customer.id); });
    app.get("/api/loyalty/me/rewards", (req, res) => {
      if (!customerOnly(req, res)) return;
      const bal = account(req.sc.customer.id).points;
      const list = L2().rewards.filter((r) => r.isActive).sort((a, b) => a.pointCost - b.pointCost).map((r) => ({ ...rewardOut(r), affordable: bal >= r.pointCost, pointsShort: Math.max(0, r.pointCost - bal) }));
      const { items, meta } = util.paginate(list, req.query, { defaultLimit: 10 });
      ok(res, { items, meta }, "Rewards retrieved");
    });
    app.post("/api/loyalty/me/rewards/:rewardId/redeem", (req, res) => {
      if (!customerOnly(req, res)) return;
      if (!L2().settings.isActive) return fail(res, 409, "The loyalty programme is currently paused");
      const reward = L2().rewards.find((r) => r.id === req.params.rewardId && r.isActive);
      if (!reward) return fail(res, 404, "Reward not found");
      const cid = req.sc.customer.id;
      const bal = account(cid).points;
      if (bal < reward.pointCost) return fail(res, 422, `You need ${reward.pointCost - bal} more points for this reward`);
      const ts = nowIso();
      addTx(cid, { type: "redeemed", source: "reward_redemption", reason: `Redeemed "${reward.name}"`, points: -reward.pointCost, at: ts });
      reward.redemptionCount += 1;
      const coupon = { id: H.newId(), customerId: cid, rewardId: reward.id, rewardName: reward.name, pointsSpent: reward.pointCost, couponCode: `${reward.couponCodePrefix}-${H.token(4).toUpperCase().replace(/[^A-Z0-9]/g, "X")}`, discountType: reward.discountType, discountValue: reward.discountValue, categoryId: reward.categoryId, expiresAt: H.daysAhead(reward.validForDays), status: "active", createdAt: ts };
      L2().coupons.push(coupon);
      ok(res, { id: coupon.id, rewardName: coupon.rewardName, pointsSpent: coupon.pointsSpent, balance: account(cid).points, couponCode: coupon.couponCode, discountType: coupon.discountType, discountValue: coupon.discountValue, categoryId: coupon.categoryId, expiresAt: coupon.expiresAt, createdAt: ts }, `Reward redeemed – your code is ${coupon.couponCode}`);
    });
    app.get("/api/loyalty/me/coupons", (req, res) => {
      if (!customerOnly(req, res)) return;
      const list = H.sortDesc(L2().coupons.filter((c) => c.customerId === req.sc.customer.id)).map(({ customerId, rewardId, ...c }) => {
        const cat = c.categoryId && C.catById(c.categoryId);
        const status = c.status === "used" ? "used" : new Date(c.expiresAt).getTime() < nowMs() ? "expired" : "active";
        return { ...c, categoryName: cat ? H.text(cat.name, req.sc.lang) : null, status };
      });
      const { items, meta } = util.paginate(list, req.query, { defaultLimit: 10 });
      ok(res, { items, meta }, "Reward coupons retrieved");
    });
  }

  return {
    routes, refreshSchedules, onContractApproved, applyPayment, markInvoicePaid, createCommission, payCommission,
    validateCoupon, useCoupon, lifecycle, paymentStatus, invoiceStatus, subInvoices, wallet, payoutStatus, commissionOut, commissionSummary,
    zoneGroups, addTx, earnPoints, account, subById, invoiceById, visibleSubscriptions, visibleInvoices, trend, installmentStatus,
  };
};
