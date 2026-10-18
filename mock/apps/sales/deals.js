// Deals: contract pricing, projects (a.k.a. deals), contracts (approval / signing / PDFs) and offers.
const H = require("./lib");
const { vatRateOf, countryByCode } = require("./reference");

module.exports = function deals(S) {
  const { db, util } = S;
  const { ok, fail } = util;
  const C = S.catalog;
  const K = S.core;

  // ------------------------------------------------------------------ lookups & scope
  const projectById = (id) => db.projects.find((p) => p.id === id);
  const contractById = (id) => db.contracts.find((c) => c.id === id);
  const offerById = (id) => db.offers.find((o) => o.id === id);
  const contractsOf = (projectId) => db.contracts.filter((c) => c.projectId === projectId).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const latestContract = (projectId) => contractsOf(projectId).slice(-1)[0] || null;
  function canSeeProject(req, p) {
    const sc = req.sc;
    if (sc.role === "customer") return Boolean(sc.customer && p.customerId === sc.customer.id);
    if (sc.role === "salesman") return p.ownerUserId === sc.user.id || Boolean(sc.staff && p.assignedSalesmanId === sc.staff.id);
    return true;
  }
  const visibleProjects = (req) => db.projects.filter((p) => canSeeProject(req, p));

  // ------------------------------------------------------------------ pricing
  function resolveZone({ zoneId, countryCode, vatCountryCode, customer }) {
    const candidates = [countryCode, vatCountryCode, customer?.countryCode].map((x) => String(x || "").toUpperCase()).filter(Boolean);
    const zone = (zoneId && C.zoneById(zoneId)) || (candidates[0] && C.zoneForCountry(candidates[0])) || C.zoneById(H.uid("zone", "eg")) || C.fallbackZone();
    const cc = candidates.find((c) => zone.countryCodes.includes(c)) || null;
    return { zone, countryCode: cc };
  }
  const isInstallment = (m) => m === "installment" || m === "installments";

  function priceStandard(sel, zone, countryCode, lang, fallbackInstallmentId) {
    const plan = C.planById(sel.planId);
    if (!plan || plan.archivedAt) return { error: `Plan ${sel.planId} not found` };
    const base = C.planZoneBase(plan, zone.id, countryCode);
    if (!base || base.amount == null) return { error: `${H.text(plan.name, lang)} is not sold in ${zone.name}` };
    const durations = C.sortedDurations(plan.planDurationIds, "plan").filter((d) => d.isActive);
    const duration = durations.find((d) => d.id === sel.durationId) || durations.find((d) => d.months === sel.durationMonths) || durations[0];
    if (!duration) return { error: `${H.text(plan.name, lang)} has no active durations` };
    const terms = C.installmentTerms(plan);
    const pricing = C.durationPricing(base.amount, duration, zone.currencyCode, terms);
    const wantsInstallment = isInstallment(sel.paymentMethod);
    const term = wantsInstallment ? terms.find((t) => t.id === (sel.installmentDurationId || fallbackInstallmentId)) || terms.find((t) => t.months === sel.installmentMonths) || terms[0] : null;
    return {
      value: lineFrom({
        planId: plan.id, name: plan.name, planName: H.text(plan.name, lang), isCustom: false,
        features: plan.featureIds.map(C.featureById).filter(Boolean).map((f) => ({ id: f.id, name: C.featureText(f, lang).name })),
        categoryIds: plan.categoryIds, departmentId: plan.departmentId, commission: plan.commission,
        duration, base: base.amount, pricing, term, priceOverride: sel.priceOverride, currency: zone.currencyCode,
      }),
    };
  }
  function priceCustom(cp, zone, countryCode, lang, fallbackInstallmentId) {
    const feats = H.listParam(cp.featureIds).map(C.featureById).filter((f) => f && !f.archivedAt);
    if (!feats.length) return { error: "A custom plan needs at least one feature" };
    let base = 0;
    for (const f of feats) {
      const price = C.featurePrice(f, zone.id, countryCode);
      if (price == null) return { error: `${C.featureText(f, lang).name} is not priced in ${zone.name}` };
      base += price;
    }
    const planDurations = db.durations.filter((d) => d.type === "plan" && !d.archivedAt && d.isActive).sort((a, b) => a.months - b.months);
    const duration = planDurations.find((d) => d.id === cp.durationId) || planDurations.find((d) => d.months === cp.durationMonths) || planDurations[0];
    const instDurations = db.durations.filter((d) => d.type === "installment" && !d.archivedAt && d.isActive);
    const pricing = C.durationPricing(base, duration, zone.currencyCode, instDurations);
    const term = isInstallment(cp.paymentMethod) ? instDurations.find((d) => d.id === (cp.installmentDurationId || fallbackInstallmentId)) || instDurations.find((d) => d.months === cp.installmentMonths) || instDurations.sort((a, b) => a.months - b.months)[0] : null;
    const label = String(cp.label || "").trim() || "Custom Plan";
    return {
      value: lineFrom({
        planId: null, name: { en: label }, planName: label, isCustom: true,
        features: feats.map((f) => ({ id: f.id, name: C.featureText(f, lang).name })),
        categoryIds: [...new Set(feats.map((f) => f.categoryId))], departmentId: C.catById(feats[0].categoryId)?.departmentId || null, commission: null,
        duration, base, pricing, term, priceOverride: cp.priceOverride, currency: zone.currencyCode,
      }),
    };
  }
  function lineFrom({ planId, name, planName, isCustom, features, categoryIds, departmentId, commission, duration, base, pricing, term, priceOverride, currency }) {
    const listTotal = H.num(pricing.discountedTotal);
    const total = priceOverride != null && priceOverride !== "" && H.num(priceOverride) > 0 ? H.num(priceOverride) : listTotal;
    const markupPct = term ? H.num(term.percentage) : 0;
    const markupAmount = term ? (total * markupPct) / 100 : 0;
    const payable = total + markupAmount;
    return {
      id: H.newId(), planId, name, planName, isCustom, features, categoryIds, departmentId, commission,
      durationId: duration.id, durationMonths: duration.months, discountPercentage: H.money(duration.percentage, "USD"),
      monthlyPrice: H.money(total / duration.months, currency), listMonthlyPrice: H.money(base, currency),
      undiscountedTotal: pricing.undiscountedTotal, discountAmount: pricing.discountAmount,
      price: H.money(total, currency), listTotal: H.money(listTotal, currency),
      paymentMethod: term ? "installment" : "cash",
      installmentDurationId: term ? term.id : null, installmentMonths: term ? term.months : null,
      installmentMarkupPercentage: term ? H.money(markupPct, "USD") : null, installmentMarkupAmount: H.money(markupAmount, currency),
      payableTotal: H.money(payable, currency), installmentMonthlyAmount: term ? H.money(payable / term.months, currency) : null,
      planBundleName: null,
    };
  }

  // Coupons (percentage or fixed-USD) that apply to the lines' categories.
  function couponDiscount(code, lines, currency, subtotal) {
    if (!code) return { amount: 0 };
    const r = S.billing.validateCoupon(code, { categoryIds: [...new Set(lines.flatMap((l) => l.categoryIds))], subtotal, currency });
    if (!r.valid) return { error: r.reason };
    return { amount: r.discountAmount, coupon: r.coupon };
  }

  // Builds lines + totals for a deal (used by projects, offers and customer self-subscriptions).
  function buildDeal(body, { customer, lang = "en" }) {
    const { zone, countryCode } = resolveZone({ zoneId: body.zoneId, countryCode: body.countryCode, vatCountryCode: body.vatCountryCode, customer });
    const lines = [];
    const sels = Array.isArray(body.planSelections) && body.planSelections.length
      ? body.planSelections
      : H.listParam(body.planIds).map((planId) => ({ planId, paymentMethod: "cash" }));
    for (const sel of sels) {
      const r = priceStandard(sel, zone, countryCode, lang, body.installmentDurationId);
      if (r.error) return { error: r.error };
      lines.push(r.value);
    }
    const customs = Array.isArray(body.customPlans) ? body.customPlans : body.customPlan ? [body.customPlan] : [];
    for (const cp of customs) {
      if (!cp || !H.listParam(cp.featureIds).length) continue;
      const r = priceCustom(cp, zone, countryCode, lang, body.installmentDurationId);
      if (r.error) return { error: r.error };
      lines.push(r.value);
    }
    return { value: { zone, countryCode, lines, totals: totalsFor(lines, zone.currencyCode, body.vatCountryCode, body.couponCode) } };
  }
  function totalsFor(lines, currency, vatCountryCode, couponCode) {
    const subtotal = lines.reduce((s, l) => s + H.num(l.price), 0);
    const markup = lines.reduce((s, l) => s + H.num(l.installmentMarkupAmount), 0);
    const cd = couponDiscount(couponCode, lines, currency, subtotal);
    if (cd.error) return { error: cd.error };
    const net = Math.max(0, subtotal + markup - cd.amount);
    const vatRate = vatCountryCode ? vatRateOf(vatCountryCode) : 0;
    const vat = (net * vatRate) / 100;
    const cash = lines.filter((l) => l.paymentMethod === "cash").reduce((s, l) => s + H.num(l.price), 0);
    const inst = lines.filter((l) => l.paymentMethod === "installment").reduce((s, l) => s + H.num(l.payableTotal), 0);
    const instMonthly = lines.filter((l) => l.paymentMethod === "installment").reduce((s, l) => s + H.num(l.installmentMonthlyAmount), 0);
    return {
      currency, subtotal, markup, discount: cd.amount, net, vatCountryCode: vatCountryCode || null, vatRate, vat, grand: net + vat,
      cash, inst, instMonthly, coupon: cd.coupon || null, couponCode: cd.coupon ? cd.coupon.code : null,
    };
  }

  // ------------------------------------------------------------------ contracts
  function contractPdf(contract, artifactFilename) {
    const p = projectById(contract.projectId);
    const c = p && K.customerById(p.customerId);
    const cur = contract.currency;
    const lines = [
      { text: `Project: ${p?.projectName || "-"} (${p ? `#${p.referenceNumber}` : ""})`, bold: true },
      `Customer: ${c ? `${c.fullName} - ${c.companyName}` : "-"}`,
      `Address: ${c?.address || "-"}`,
      `Contract status: ${contract.status}    Created: ${H.shortDate(contract.createdAt)}`,
      "---",
      { text: "Plans", bold: true, size: 12 },
      ...contract.plans.flatMap((l) => [
        { text: `${l.planName}${l.isCustom ? " (custom)" : ""} - ${l.durationMonths} month(s)`, right: H.fmtMoney(l.price, cur) },
        { text: `   ${l.paymentMethod === "installment" ? `Installments: ${l.installmentMonths} x ${H.fmtMoney(l.installmentMonthlyAmount, cur)} (+${H.num(l.installmentMarkupPercentage)}% markup)` : "Paid upfront"}`, size: 9 },
        { text: `   Includes: ${l.features.map((f) => f.name).join(", ")}`.slice(0, 110), size: 9 },
      ]),
      "---",
      { text: "Subtotal", right: H.fmtMoney(contract.subtotal, cur) },
      ...(H.num(contract.installmentMarkupTotal) ? [{ text: "Installment markup", right: H.fmtMoney(contract.installmentMarkupTotal, cur) }] : []),
      ...(H.num(contract.discountAmount) ? [{ text: `Discount${contract.couponCode ? ` (${contract.couponCode})` : ""}`, right: `- ${H.fmtMoney(contract.discountAmount, cur)}` }] : []),
      { text: `VAT ${H.num(contract.vatRate)}% (${contract.vatCountryCode || "n/a"})`, right: H.fmtMoney(contract.vatAmount, cur) },
      { text: "Grand total", bold: true, right: H.fmtMoney(contract.grandTotal, cur) },
      "",
      "Signed for OrgTik: ____________________        Signed for the customer: ____________________",
    ];
    return K.writePdf(artifactFilename || `contract-${contract.id}.pdf`, "Service Contract", lines, `Contract-${p ? p.referenceNumber : contract.id.slice(0, 8)}.pdf`);
  }
  function applyTotals(contract, t) {
    const cur = contract.currency;
    Object.assign(contract, {
      subtotal: H.money(t.subtotal, cur), installmentMarkupTotal: H.money(t.markup, cur), discountAmount: H.money(t.discount, cur),
      couponCode: t.couponCode, couponDiscountType: t.coupon?.discountType || null, couponDiscountValue: t.coupon ? t.coupon.discountValue : null,
      couponDiscountAmount: t.coupon ? H.money(t.discount, cur) : null,
      totalAmount: H.money(t.net, cur), vatCountryCode: t.vatCountryCode, vatRate: H.money(t.vatRate, "USD"), vatAmount: H.money(t.vat, cur), grandTotal: H.money(t.grand, cur),
      cashDueTotal: H.money(t.cash, cur), installmentTotal: H.money(t.inst, cur), installmentMonthlyTotal: H.money(t.instMonthly, cur),
    });
  }
  function createContract(project, deal, { actor, actorType, at, status = "pending" } = {}) {
    const ts = at || new Date().toISOString();
    const contract = {
      id: H.newId(), projectId: project.id, status, currency: deal.zone.currencyCode, zoneId: deal.zone.id, countryCode: deal.countryCode,
      plans: deal.lines, commissionMode: null, commissionPercentage: null, commissionValue: null, commissionAmount: null,
      signedPdfPath: null, unsignedPdfPath: null, isSigntuerd: false, rejectionReason: null,
      createdBy: actor || "System", createdByType: actorType || "admin", confirmedBy: null, confirmedAt: null, approvedBy: null, approvedAt: null, rejectedAt: null,
      createdAt: ts, updatedAt: ts,
    };
    applyTotals(contract, deal.totals);
    db.contracts.push(contract);
    contract.unsignedPdfPath = contractPdf(contract);
    project.zoneId = deal.zone.id;
    return contract;
  }
  function commissionFor(contract, mode, value) {
    const net = H.num(contract.totalAmount);
    if (mode === "fixed") return { mode: "fixed", pct: null, value: H.num(value), amount: H.num(value) };
    if (mode === "percentage") return { mode: "percentage", pct: H.num(value), value: H.num(value), amount: (net * H.num(value)) / 100 };
    // No explicit commission: use the plans' commission settings (fixed plan commissions are USD).
    let amount = 0;
    let pctSeen = null;
    for (const l of contract.plans) {
      const c = l.commission;
      if (!c) { amount += (H.num(l.price) * 10) / 100; pctSeen = pctSeen ?? 10; continue; }
      if (c.type === "fixed") amount += H.convert(c.amount, "USD", contract.currency);
      else { amount += (H.num(l.price) * H.num(c.amount)) / 100; pctSeen = pctSeen ?? H.num(c.amount); }
    }
    const allPct = contract.plans.every((l) => !l.commission || l.commission.type === "percentage");
    return allPct ? { mode: "percentage", pct: net ? H.round((amount / net) * 100, "USD") : pctSeen || 10, value: pctSeen || 10, amount } : { mode: "fixed", pct: null, value: amount, amount };
  }
  function approveContract(contract, { mode, value, actorUser, at } = {}) {
    const project = projectById(contract.projectId);
    const ts = at || new Date().toISOString();
    const hasSalesman = !!project?.assignedSalesmanId;
    const com = hasSalesman ? commissionFor(contract, mode, value) : null;
    Object.assign(contract, {
      status: "approved", approvedAt: ts, approvedBy: actorUser ? K.userName(actorUser) : "System", updatedAt: ts,
      commissionMode: com ? com.mode : null, commissionPercentage: com && com.mode === "percentage" ? H.money(com.pct, "USD") : null,
      commissionValue: com ? H.money(com.value, com.mode === "fixed" ? contract.currency : "USD") : null,
      commissionAmount: com ? H.money(com.amount, contract.currency) : null,
    });
    if (project) Object.assign(project, { status: ["pending", "confirmed", "rejected"].includes(project.status) ? "approved" : project.status, updatedAt: ts });
    contract.unsignedPdfPath = contractPdf(contract);
    S.billing.onContractApproved(contract, project, { at, commission: com });
    if (!at && project) {
      const cu = K.customerUserId(project.customerId);
      const su = K.salesmanUserId(project.assignedSalesmanId);
      const data = { projectId: project.id, contractId: contract.id, projectName: project.projectName };
      K.notify([cu], "contract.approved", { title: "Contract approved", message: `Your contract for "${project.projectName}" was approved. Your first invoice is ready.`, data });
      K.notify([su], "contract.approved", { title: "Contract approved", message: `The contract for "${project.projectName}" was approved.`, data });
    }
    return contract;
  }
  function rejectContract(contract, { reason, at } = {}) {
    const project = projectById(contract.projectId);
    const ts = at || new Date().toISOString();
    Object.assign(contract, { status: "rejected", rejectedAt: ts, rejectionReason: reason || null, updatedAt: ts });
    if (project) Object.assign(project, { status: "rejected", updatedAt: ts });
    if (!at && project) {
      const data = { projectId: project.id, contractId: contract.id, projectName: project.projectName, reason: reason || null };
      K.notify([K.customerUserId(project.customerId), K.salesmanUserId(project.assignedSalesmanId)], "contract.rejected", { title: "Contract rejected", message: `The contract for "${project.projectName}" was rejected${reason ? `: ${reason}` : "."}`, data });
    }
    return contract;
  }

  // ------------------------------------------------------------------ projections
  function planLineOut(contract, l) {
    const sub = db.subscriptions.find((s) => s.contractPlanId === l.id);
    let paymentStatus = "unpaid";
    let installmentProgress;
    if (sub) {
      const paid = H.num(sub.paidAmount);
      paymentStatus = paid >= H.num(sub.totalAmount) - 0.01 && H.num(sub.totalAmount) > 0 ? "paid" : "unpaid";
      if (l.paymentMethod === "installment" && sub.installments.length) installmentProgress = Math.round((sub.installments.filter((i) => i.status === "paid").length / sub.installments.length) * 100);
    }
    const { commission, categoryIds, departmentId, ...rest } = l;
    return { ...rest, paymentStatus, ...(installmentProgress != null ? { installmentProgress } : {}), subscriptionId: sub?.id || null, currency: contract.currency };
  }
  function contractOut(c) {
    if (!c) return null;
    const z = C.zoneById(c.zoneId);
    return {
      id: c.id, projectId: c.projectId, status: c.status,
      commissionPercentage: c.commissionPercentage, commissionMode: c.commissionMode, commissionValue: c.commissionValue, commissionAmount: c.commissionAmount,
      grandTotal: c.grandTotal, subtotal: c.subtotal, discountAmount: c.discountAmount, totalAmount: c.totalAmount,
      installmentMarkupTotal: c.installmentMarkupTotal, cashDueTotal: c.cashDueTotal, installmentTotal: c.installmentTotal,
      couponCode: c.couponCode, couponDiscountType: c.couponDiscountType, couponDiscountValue: c.couponDiscountValue, couponDiscountAmount: c.couponDiscountAmount,
      vatCountryCode: c.vatCountryCode, vatRate: c.vatRate, vatAmount: c.vatAmount,
      signedPdfPath: c.signedPdfPath, unsignedPdfPath: c.unsignedPdfPath, isSigntuerd: c.isSigntuerd,
      rejectionReason: c.rejectionReason, confirmedAt: c.confirmedAt, approvedAt: c.approvedAt, approvedBy: c.approvedBy,
      plans: c.plans.map((l) => planLineOut(c, l)),
      zoneId: c.zoneId, zoneName: z?.name || null, currency: c.currency,
      createdBy: c.createdBy, createdByType: c.createdByType, createdAt: c.createdAt, updatedAt: c.updatedAt,
    };
  }
  function projectOut(req, p) {
    const c = K.customerById(p.customerId);
    const s = K.staffById(p.assignedSalesmanId);
    const d = C.deptById(p.departmentId);
    const contract = latestContract(p.id);
    const z = contract ? C.zoneById(contract.zoneId) : p.zoneId ? C.zoneById(p.zoneId) : null;
    const cur = contract?.currency || z?.currencyCode || "USD";
    const commissionAmount = contract ? H.num(contract.commissionAmount ?? (s ? commissionFor(contract).amount : 0)) : 0;
    return {
      id: p.id, referenceNumber: p.referenceNumber, displayId: `#${p.referenceNumber}`,
      projectName: p.projectName, projectDescription: p.projectDescription, projectType: p.projectType, priority: p.priority, status: p.status,
      customerId: p.customerId, customerName: c?.fullName || null, customer: K.customerMini(c),
      assignedSalesmanId: p.assignedSalesmanId, salesmanName: s?.fullName || null, assignedSalesman: K.staffMini(s),
      departmentId: p.departmentId, departmentName: d ? C.locStr(req, d.name) : null, department: d ? { id: d.id, name: C.locStr(req, d.name) } : null,
      totalCommission: contract && s ? [{ zoneId: z?.id || null, zoneName: z?.name || "Unassigned", currencyCode: cur, amount: H.money(commissionAmount, cur) }] : [],
      totalPlansCount: contract ? contract.plans.length : 0,
      contractTotalsByZone: contract ? [{
        zoneId: z?.id || null, zoneName: z?.name || "Unassigned", currencyCode: cur,
        totalContractsCost: H.round(contract.totalAmount, cur), totalVatAmount: H.round(contract.vatAmount, cur), totalWithVat: H.round(contract.grandTotal, cur),
        totalCashDue: H.round(contract.cashDueTotal, cur), totalOnInstallments: H.round(contract.installmentTotal, cur),
      }] : [],
      totalContractsCost: contract ? H.round(contract.totalAmount, cur) : 0,
      latestContract: contractOut(contract),
      dueDate: p.dueDate, vatCountryCode: contract?.vatCountryCode || p.vatCountryCode || undefined,
      zoneId: z?.id || null, zoneName: z?.name || null,
      salesCommission: H.round(commissionAmount, cur),
      createdAt: p.createdAt, updatedAt: p.updatedAt,
    };
  }
  function projectsQuery(req, list) {
    const q = req.query;
    const s = String(q.search || q.q || "").toLowerCase().trim();
    if (s) {
      list = list.filter((p) => {
        const c = K.customerById(p.customerId);
        return [p.projectName, p.projectDescription, `#${p.referenceNumber}`, c?.fullName, c?.companyName].some((v) => String(v || "").toLowerCase().includes(s));
      });
    }
    if (q.status) {
      const want = String(q.status);
      list = list.filter((p) => p.status === want || (want === "in_progress" && p.status === "inProgress"));
    }
    if (q.priority) list = list.filter((p) => p.priority === q.priority);
    return H.sortDesc(list);
  }

  // ------------------------------------------------------------------ project creation / plans
  function createProject(req, body, { at, status, actorUser } = {}) {
    const sc = req.sc;
    const actor = actorUser || sc.user;
    const projectType = body.projectType === "internal_project" ? "internal_project" : "client_project";
    let customer = null;
    if (sc.role === "customer") customer = sc.customer;
    else if (body.customerId) {
      customer = K.customerById(body.customerId);
      if (!customer) return { error: "Customer not found", status: 404 };
    }
    if (projectType === "client_project" && !customer) return { error: "Select a customer for this project" };
    if (!String(body.projectName || "").trim()) return { error: "Project name is required" };
    let salesmanId = null;
    if (sc.role === "salesman") salesmanId = sc.staff?.id || null;
    else if (body.assignedSalesmanId) {
      const sm = K.resolveSalesman(body.assignedSalesmanId);
      if (!sm) return { error: "Salesman not found", status: 404 };
      salesmanId = sm.id;
    } else if (customer?.assignedSalesmanId) salesmanId = customer.assignedSalesmanId;
    const ts = at || new Date().toISOString();
    const hasPlans = (Array.isArray(body.planSelections) && body.planSelections.length) || H.listParam(body.planIds).length || (Array.isArray(body.customPlans) && body.customPlans.some((c) => H.listParam(c?.featureIds).length));
    let deal = null;
    if (hasPlans) {
      const r = buildDeal(body, { customer, lang: sc.lang });
      if (r.error) return { error: r.error };
      if (r.value.totals.error) return { error: r.value.totals.error };
      deal = r.value;
    }
    const departmentId = body.departmentId && C.deptById(body.departmentId) ? body.departmentId : deal?.lines[0]?.departmentId || null;
    const project = {
      id: H.newId(), referenceNumber: ++db.counters.project, projectName: String(body.projectName).trim(),
      projectDescription: String(body.projectDescription || "").trim(), projectType, priority: ["low", "medium", "high"].includes(body.priority) ? body.priority : "medium",
      status: status || (projectType === "internal_project" && !deal ? "in_progress" : "pending"),
      customerId: customer?.id || null, assignedSalesmanId: salesmanId, departmentId, dueDate: body.dueDate || null,
      vatCountryCode: body.vatCountryCode || null, zoneId: deal?.zone.id || null, contactNotes: [],
      createdByUserId: actor?.id || null, ownerUserId: actor?.id || null, createdAt: ts, updatedAt: ts,
    };
    db.projects.push(project);
    let contract = null;
    if (deal) contract = createContract(project, deal, { actor: K.userName(actor), actorType: sc.role, at: ts });
    if (deal?.totals.coupon) S.billing.useCoupon(deal.totals.coupon, customer?.id);
    if (customer) customer.lastActivityAt = ts;
    if (!at) {
      const data = { projectId: project.id, projectName: project.projectName };
      K.notify([actor?.id], "project.created", { title: "Project created", message: `"${project.projectName}" was created${customer ? ` for ${customer.companyName}` : ""}.`, data });
      if (contract) {
        K.notify([K.salesmanUserId(salesmanId), ...K.adminIds()], "contract.created", { title: "New contract awaiting review", message: `A ${H.fmtMoney(contract.grandTotal, contract.currency)} contract was created for "${project.projectName}".`, data: { ...data, contractId: contract.id } });
      }
    }
    return { value: project, contract };
  }
  function setProjectPlans(req, project, body) {
    const customer = K.customerById(project.customerId);
    const r = buildDeal({ ...body, vatCountryCode: body.vatCountryCode ?? project.vatCountryCode }, { customer, lang: req.sc.lang });
    if (r.error) return { error: r.error };
    if (r.value.totals.error) return { error: r.value.totals.error };
    const deal = r.value;
    const current = latestContract(project.id);
    if (!deal.lines.length) return { error: "Keep at least one plan on the project" };
    if (current && current.status === "pending") {
      Object.assign(current, { plans: deal.lines, currency: deal.zone.currencyCode, zoneId: deal.zone.id, countryCode: deal.countryCode, updatedAt: new Date().toISOString(), isSigntuerd: false, signedPdfPath: null });
      applyTotals(current, deal.totals);
      current.unsignedPdfPath = contractPdf(current);
    } else {
      createContract(project, deal, { actor: K.userName(req.sc.user), actorType: req.sc.role });
      project.status = "pending";
    }
    if (body.vatCountryCode) project.vatCountryCode = body.vatCountryCode;
    project.zoneId = deal.zone.id;
    project.updatedAt = new Date().toISOString();
    return { value: latestContract(project.id) };
  }
  function changeProjectStatus(req, project, status) {
    const allowed = ["pending", "confirmed", "rejected", "approved", "in_progress", "inProgress", "testing", "completed"];
    if (!allowed.includes(status)) return { error: `Unknown status ${status}` };
    const contract = latestContract(project.id);
    if (status === "approved" && contract && contract.status === "pending") approveContract(contract, { actorUser: req.sc.user });
    else if (status === "rejected" && contract && contract.status === "pending") rejectContract(contract, {});
    const before = project.status;
    project.status = status === "inProgress" ? "in_progress" : status;
    project.updatedAt = new Date().toISOString();
    if (before !== project.status) {
      K.notify([project.createdByUserId, K.salesmanUserId(project.assignedSalesmanId), K.customerUserId(project.customerId)], "project.status_changed", {
        title: "Project status updated", message: `"${project.projectName}" moved from ${before.replace("_", " ")} to ${project.status.replace("_", " ")}.`, data: { projectId: project.id, from: before, to: project.status },
      });
    }
    return { value: project };
  }

  // ------------------------------------------------------------------ offers
  function offerName(lines) {
    if (!lines.length) return "Offer";
    if (lines.length === 1) return lines[0].planName;
    return `${lines[0].planName} + ${lines.length - 1} more`;
  }
  function offerSummary(o) {
    const cur = o.currencyCode;
    return {
      currencyCode: cur,
      lines: o.lines.map((l) => ({
        planId: l.planId || l.id, planName: l.planName, isCustom: l.isCustom, customGroupId: l.isCustom ? l.id : null, customLabel: l.isCustom ? l.planName : null,
        customPortion: l.paymentMethod === "installment" ? "installment" : "cash",
        monthlyPrice: l.monthlyPrice, listMonthlyPrice: l.listMonthlyPrice, priceSource: "zone_override", durationMonths: l.durationMonths,
        discountPercentage: l.discountPercentage, discountAmount: l.discountAmount, total: l.price,
        paymentMethod: l.paymentMethod === "installment" ? "installments" : "cash", installmentMonths: l.installmentMonths,
        installmentMarkupPercentage: l.installmentMarkupPercentage, installmentMarkupAmount: l.installmentMarkupAmount, payableTotal: l.payableTotal,
        installmentMonthlyAmount: l.installmentMonthlyAmount,
      })),
      subtotal: o.totals.subtotal, installmentMarkupTotal: o.totals.installmentMarkupTotal, discountAmount: o.totals.discountAmount, netAmount: o.totals.netAmount,
      vatRate: o.totals.vatRate, vatAmount: o.totals.vatAmount, total: o.totals.total, cashDueTotal: o.totals.cashDueTotal, installmentTotal: o.totals.installmentTotal,
      installmentMonthlyTotal: o.totals.installmentMonthlyTotal, totalUsd: H.money(H.toUsd(o.totals.total, cur), "USD"),
    };
  }
  function offerTotals(t) {
    const cur = t.currency;
    return {
      subtotal: H.money(t.subtotal, cur), installmentMarkupTotal: H.money(t.markup, cur), discountAmount: H.money(t.discount, cur), netAmount: H.money(t.net, cur),
      vatRate: H.money(t.vatRate, "USD"), vatAmount: H.money(t.vat, cur), total: H.money(t.grand, cur), cashDueTotal: H.money(t.cash, cur),
      installmentTotal: H.money(t.inst, cur), installmentMonthlyTotal: H.money(t.instMonthly, cur), couponCode: t.couponCode,
    };
  }
  const agreedTotal = (o) => H.num(o.counterTotal ?? o.totals.total);
  function offerListItem(o) {
    const c = K.customerById(o.customerId);
    return {
      id: o.id, name: o.name, composition: o.lines.some((l) => l.isCustom) ? "custom" : "standard", planCount: o.lines.length,
      customerId: o.customerId, customerName: c ? `${c.fullName} (${c.companyName})` : null,
      total: H.money(agreedTotal(o), o.currencyCode), currencyCode: o.currencyCode, status: o.status,
      submittedAt: H.dateOnly(o.submittedAt), contractId: o.contractId, projectId: o.projectId, createdAt: o.createdAt,
    };
  }
  function offerDetail(req, o) {
    const c = K.customerById(o.customerId);
    const open = o.status === "pending" || o.status === "countered";
    return {
      id: o.id, name: o.name, composition: o.lines.some((l) => l.isCustom) ? "custom" : "standard", status: o.status,
      contractId: o.contractId, projectId: o.projectId,
      customer: c ? { id: c.id, fullName: c.fullName, email: c.email, phoneNumber: c.phoneNumber, companyName: c.companyName, address: c.address } : { id: "", fullName: "", email: "", phoneNumber: "", companyName: "", address: "" },
      noteToCustomer: o.noteToCustomer,
      deal: o.lines.map((l) => ({ planId: l.planId || l.id, planName: l.planName, isCustom: l.isCustom, durationMonths: l.durationMonths, paymentMethod: l.paymentMethod === "installment" ? "installments" : "cash", installmentMonths: l.installmentMonths, total: l.price, listTotal: l.listTotal })),
      dealTotal: o.totals.total, currencyCode: o.currencyCode, quotedTotal: o.totals.total,
      counterTotal: o.counterTotal, counterNote: o.counterNote,
      summary: offerSummary(o),
      events: o.events,
      lastTermsBy: o.lastTermsBy, awaitingResponseFrom: open ? o.awaitingResponseFrom : null,
      canRespond: open, canAccept: open, canCounter: open, canReject: open, canEdit: open, canDelete: o.status !== "accepted",
      submittedAt: H.dateOnly(o.submittedAt), respondedAt: o.respondedAt, createdBy: o.createdBy, createdByType: o.createdByType,
      createdAt: o.createdAt, updatedAt: o.updatedAt, vatCountryCode: o.vatCountryCode, zoneId: o.zoneId,
    };
  }
  const canSeeOffer = (req, o) => {
    const customer = K.customerById(o.customerId);
    return req.sc.role === "customer" ? Boolean(req.sc.customer && o.customerId === req.sc.customer.id) : req.sc.role === "salesman" ? o.ownerUserId === req.sc.user.id || Boolean(customer && (customer.ownerUserId === req.sc.user.id || req.sc.staff && customer.assignedSalesmanId === req.sc.staff.id)) : true;
  };
  function createOffer(req, body, { at, actorUser } = {}) {
    const sc = req.sc;
    const actor = actorUser || sc.user;
    const side = sc.role === "customer" ? "customer" : "staff";
    const customer = sc.role === "customer" ? sc.customer : K.customerById(body.customerId);
    if (!customer) return { error: "Select a customer for this offer" };
    const r = buildDeal(body, { customer, lang: sc.lang });
    if (r.error) return { error: r.error };
    if (r.value.totals.error) return { error: r.value.totals.error };
    if (!r.value.lines.length) return { error: "Add at least one plan to the offer" };
    const ts = at || new Date().toISOString();
    const o = {
      id: H.newId(), code: `OFR-${++db.counters.offer}`, name: offerName(r.value.lines), status: "pending", customerId: customer.id,
      zoneId: r.value.zone.id, currencyCode: r.value.zone.currencyCode, vatCountryCode: body.vatCountryCode || null,
      noteToCustomer: body.noteToCustomer || null, lines: r.value.lines, totals: offerTotals(r.value.totals),
      counterTotal: null, counterNote: null, lastTermsBy: side, awaitingResponseFrom: side === "customer" ? "staff" : "customer",
      events: [], contractId: null, projectId: null, submittedAt: ts, respondedAt: null,
      createdBy: K.userName(actor), createdByType: sc.role, createdAt: ts, updatedAt: ts,
    };
    o.events.push({ id: H.newId(), type: "quote_created", amount: o.totals.total, currencyCode: o.currencyCode, note: o.noteToCustomer, actorId: String(actor?.id || ""), actorType: side, createdAt: ts });
    db.offers.push(o);
    // D-028: an offer moves an open lead to "quoted".
    if (["new", "contacted", "qualified"].includes(customer.status)) Object.assign(customer, { status: "quoted", updatedAt: ts });
    if (!at) {
      const target = side === "customer" ? [K.salesmanUserId(customer.assignedSalesmanId), ...K.adminIds()] : [customer.authUserId];
      K.notify(target, "offer.created", { title: side === "customer" ? "New offer request" : "You received a new offer", message: `${o.name} – ${H.fmtMoney(o.totals.total, o.currencyCode)}`, data: { offerId: o.id } });
    }
    return { value: o };
  }
  function respondOffer(req, o, action, { total, note, at, actorUser } = {}) {
    if (!["pending", "countered"].includes(o.status)) return { error: `This offer is already ${o.status}` };
    const side = (actorUser ? K.appRole(actorUser) === "customer" : req.sc.role === "customer") ? "customer" : "staff";
    const actor = actorUser || req.sc.user;
    const ts = at || new Date().toISOString();
    const ev = { id: H.newId(), type: action === "counter" ? "counter_offer" : action === "accept" ? "accepted" : "rejected", amount: H.money(action === "counter" ? total : agreedTotal(o), o.currencyCode), currencyCode: o.currencyCode, note: note || null, actorId: String(actor?.id || ""), actorType: side, createdAt: ts };
    o.events.push(ev);
    o.updatedAt = ts;
    o.respondedAt = ts;
    if (action === "counter") {
      if (!(H.num(total) > 0)) return { error: "Enter a counter amount" };
      Object.assign(o, { status: "countered", counterTotal: H.money(total, o.currencyCode), counterNote: note || null, lastTermsBy: side, awaitingResponseFrom: side === "customer" ? "staff" : "customer" });
    } else if (action === "reject") {
      Object.assign(o, { status: "rejected", awaitingResponseFrom: null });
    } else {
      Object.assign(o, { status: "accepted", awaitingResponseFrom: null });
      // Accepting turns the offer into a project with a pending contract at the agreed total.
      const customer = K.customerById(o.customerId);
      // D-028: an accepted offer wins the lead.
      if (customer && !["won", "lost"].includes(customer.status)) Object.assign(customer, { status: "won", lostReason: null, updatedAt: ts });
      const project = {
        id: H.newId(), referenceNumber: ++db.counters.project, projectName: o.name, projectDescription: o.noteToCustomer || `Created from offer ${o.code}`,
        projectType: "client_project", priority: "medium", status: "pending", customerId: o.customerId,
        assignedSalesmanId: customer?.assignedSalesmanId || null, departmentId: o.lines[0]?.departmentId || null, dueDate: null,
        vatCountryCode: o.vatCountryCode, zoneId: o.zoneId, contactNotes: [], createdByUserId: actor?.id || null, ownerUserId: o.ownerUserId ?? customer?.ownerUserId ?? actor?.id ?? null, createdAt: ts, updatedAt: ts,
      };
      db.projects.push(project);
      const zone = C.zoneById(o.zoneId);
      const totals = totalsFor(o.lines, o.currencyCode, o.vatCountryCode, null);
      const agreed = agreedTotal(o);
      if (Math.abs(agreed - totals.grand) > 0.009) {
        const net = agreed / (1 + totals.vatRate / 100);
        totals.discount = Math.max(0, totals.subtotal + totals.markup - net);
        totals.net = net;
        totals.vat = agreed - net;
        totals.grand = agreed;
      }
      const contract = createContract(project, { zone, countryCode: null, lines: o.lines.map((l) => ({ ...l, id: H.newId() })), totals }, { actor: K.userName(actor), actorType: side, at });
      Object.assign(o, { contractId: contract.id, projectId: project.id });
    }
    if (!at) {
      const c = K.customerById(o.customerId);
      const target = side === "customer" ? [K.salesmanUserId(c?.assignedSalesmanId), ...K.adminIds()] : [c?.authUserId];
      const verb = action === "counter" ? "countered" : action === "accept" ? "accepted" : "rejected";
      K.notify(target, `offer.${verb}`, { title: `Offer ${verb}`, message: `${o.name} was ${verb}${action === "counter" ? ` at ${H.fmtMoney(total, o.currencyCode)}` : ""}.`, data: { offerId: o.id, projectId: o.projectId } });
    }
    return { value: o };
  }

  // ------------------------------------------------------------------ routes
  function routes(app) {
    const getProject = (req, res) => {
      const p = projectById(req.params.id);
      if (!p || !canSeeProject(req, p)) {
        fail(res, 404, "Project not found");
        return null;
      }
      return p;
    };
    const staffOnly = (req, res) => K.requireRoles(req, res, ["admin", "manager", "salesman"], "Customers cannot perform this action");
    const approvers = (req, res) => K.requireRoles(req, res, ["admin", "manager"], "Only admins and managers can do this");

    app.get("/api/projects", (req, res) => {
      const { items, meta } = util.paginate(projectsQuery(req, visibleProjects(req)), req.query, { defaultLimit: 10 });
      ok(res, { items: items.map((p) => projectOut(req, p)), meta }, "Projects retrieved");
    });
    app.get("/api/projects/customer/:customerId", (req, res) => {
      const list = visibleProjects(req).filter((p) => p.customerId === req.params.customerId);
      const { items, meta } = util.paginate(projectsQuery(req, list), req.query, { defaultLimit: 10 });
      ok(res, { items: items.map((p) => projectOut(req, p)), meta }, "Projects retrieved");
    });
    app.get("/api/projects/:id", (req, res) => {
      const p = getProject(req, res);
      if (p) ok(res, projectOut(req, p), "Project retrieved");
    });
    app.get("/api/projects/:id/summary", (req, res) => {
      const p = getProject(req, res);
      if (!p) return;
      const o = projectOut(req, p);
      ok(res, { id: p.id, status: p.status, totalPlansCount: o.totalPlansCount, contractTotalsByZone: o.contractTotalsByZone, totalCommission: o.totalCommission, dueDate: p.dueDate }, "Project summary retrieved");
    });
    app.get("/api/projects/:id/plans", (req, res) => {
      const p = getProject(req, res);
      if (!p) return;
      const c = latestContract(p.id);
      ok(res, { projectId: p.id, contractId: c?.id || null, currency: c?.currency || null, items: c ? c.plans.map((l) => planLineOut(c, l)) : [] }, "Project plans retrieved");
    });
    app.get("/api/projects/:id/pending-custom-plan", (req, res) => {
      const p = getProject(req, res);
      if (!p) return;
      const c = latestContract(p.id);
      const custom = c && c.status === "pending" ? c.plans.filter((l) => l.isCustom).map((l) => planLineOut(c, l)) : [];
      ok(res, custom[0] || null, "Pending custom plan retrieved");
    });
    app.post("/api/projects", (req, res) => {
      const r = createProject(req, req.body || {});
      if (r.error) return fail(res, r.status || 422, r.error);
      ok(res, projectOut(req, r.value), "Project created successfully", 201);
    });
    app.patch("/api/projects/:id", (req, res) => {
      const p = getProject(req, res);
      if (!p) return;
      const b = req.body || {};
      if (b.projectName !== undefined) p.projectName = String(b.projectName).trim() || p.projectName;
      if (b.projectDescription !== undefined) p.projectDescription = String(b.projectDescription || "");
      if (b.priority !== undefined && ["low", "medium", "high"].includes(b.priority)) p.priority = b.priority;
      if (b.departmentId !== undefined) p.departmentId = b.departmentId && C.deptById(b.departmentId) ? b.departmentId : null;
      if (b.assignedSalesmanId !== undefined && req.sc.role !== "customer" && req.sc.role !== "salesman") {
        const sm = b.assignedSalesmanId ? K.resolveSalesman(b.assignedSalesmanId) : null;
        if (b.assignedSalesmanId && !sm) return fail(res, 404, "Salesman not found");
        p.assignedSalesmanId = sm ? sm.id : null;
      }
      p.updatedAt = new Date().toISOString();
      if (b.status !== undefined && b.status !== p.status) {
        if (req.sc.role === "salesman" || req.sc.role === "customer") return fail(res, 403, "You cannot change the project status");
        const r = changeProjectStatus(req, p, b.status);
        if (r.error) return fail(res, 422, r.error);
      }
      ok(res, projectOut(req, p), "Project updated successfully");
    });
    app.delete("/api/projects/:id", (req, res) => {
      if (!approvers(req, res)) return;
      const p = getProject(req, res);
      if (!p) return;
      db.projects.splice(db.projects.indexOf(p), 1);
      db.contracts = db.contracts.filter((c) => c.projectId !== p.id || c.status === "approved");
      ok(res, null, "Project deleted successfully");
    });
    app.patch("/api/projects/:id/priority", (req, res) => {
      if (!staffOnly(req, res)) return;
      const p = getProject(req, res);
      if (!p) return;
      const priority = req.body?.priority;
      if (!["low", "medium", "high"].includes(priority)) return fail(res, 422, "Priority must be low, medium or high");
      const before = p.priority;
      Object.assign(p, { priority, updatedAt: new Date().toISOString() });
      if (before !== priority) K.notify([p.createdByUserId], "project.priority_changed", { title: "Project priority changed", message: `"${p.projectName}" priority changed from ${before} to ${priority}.`, data: { projectId: p.id } });
      ok(res, projectOut(req, p), "Priority updated successfully");
    });
    app.patch("/api/projects/:id/due-date", (req, res) => {
      if (!staffOnly(req, res)) return;
      const p = getProject(req, res);
      if (!p) return;
      const due = req.body?.dueDate;
      if (!due || Number.isNaN(new Date(due).getTime())) return fail(res, 422, "Enter a valid due date");
      Object.assign(p, { dueDate: new Date(due).toISOString(), updatedAt: new Date().toISOString() });
      ok(res, projectOut(req, p), "Due date updated successfully");
    });
    app.patch("/api/projects/:id/status", (req, res) => {
      if (!approvers(req, res)) return;
      const p = getProject(req, res);
      if (!p) return;
      const r = changeProjectStatus(req, p, req.body?.status);
      if (r.error) return fail(res, 422, r.error);
      ok(res, projectOut(req, p), "Project status updated successfully");
    });
    app.post("/api/projects/:id/plans", (req, res) => {
      const p = getProject(req, res);
      if (!p) return;
      const r = setProjectPlans(req, p, req.body || {});
      if (r.error) return fail(res, 422, r.error);
      ok(res, { projectId: p.id, contract: contractOut(r.value), items: r.value.plans.map((l) => planLineOut(r.value, l)) }, "Project plans updated successfully");
    });
    // contact notes
    const noteOut = (n) => ({ id: n.id, content: n.content, createdBy: n.createdBy, createdByType: n.createdByType, createdAt: n.createdAt, updatedAt: n.updatedAt });
    app.get("/api/projects/:id/contact-notes", (req, res) => {
      const p = getProject(req, res);
      if (p) ok(res, H.sortDesc(p.contactNotes).map(noteOut), "Contact notes retrieved");
    });
    app.post("/api/projects/:id/contact-notes", (req, res) => {
      const p = getProject(req, res);
      if (!p) return;
      const content = String(req.body?.content || "").trim();
      if (!content) return fail(res, 422, "Note content is required");
      const ts = new Date().toISOString();
      const n = { id: H.newId(), content, createdBy: K.userName(req.sc.user), createdByType: req.sc.role, createdByUserId: req.sc.user.id, createdAt: ts, updatedAt: ts };
      p.contactNotes.push(n);
      ok(res, noteOut(n), "Note added successfully", 201);
    });
    app.patch("/api/projects/:id/contact-notes/:noteId", (req, res) => {
      const p = getProject(req, res);
      if (!p) return;
      const n = p.contactNotes.find((x) => x.id === req.params.noteId);
      if (!n) return fail(res, 404, "Note not found");
      const content = String(req.body?.content || "").trim();
      if (!content) return fail(res, 422, "Note content is required");
      Object.assign(n, { content, updatedAt: new Date().toISOString() });
      ok(res, noteOut(n), "Note updated successfully");
    });
    app.delete("/api/projects/:id/contact-notes/:noteId", (req, res) => {
      const p = getProject(req, res);
      if (!p) return;
      const i = p.contactNotes.findIndex((x) => x.id === req.params.noteId);
      if (i === -1) return fail(res, 404, "Note not found");
      p.contactNotes.splice(i, 1);
      ok(res, null, "Note deleted successfully");
    });

    // ---------------- contracts
    const getContract = (req, res) => {
      const c = contractById(req.params.contractId);
      const p = c && projectById(c.projectId);
      if (!c || (p && !canSeeProject(req, p))) {
        fail(res, 404, "Contract not found");
        return null;
      }
      return c;
    };
    app.get("/api/contracts", (req, res) => {
      const ids = new Set(visibleProjects(req).map((p) => p.id));
      let list = db.contracts.filter((c) => ids.has(c.projectId));
      if (req.query.status) list = list.filter((c) => c.status === req.query.status);
      const { items, meta } = util.paginate(H.sortDesc(list), req.query, { defaultLimit: 10 });
      ok(res, { items: items.map(contractOut), meta }, "Contracts retrieved");
    });
    app.get("/api/contracts/:contractId", (req, res) => {
      const c = getContract(req, res);
      if (c) ok(res, contractOut(c), "Contract retrieved");
    });
    app.get("/api/contracts/:contractId/pdf", (req, res) => {
      const c = getContract(req, res);
      if (!c) return;
      if (!c.signedPdfPath) c.unsignedPdfPath = contractPdf(c);
      ok(res, c.signedPdfPath || c.unsignedPdfPath, "Contract document retrieved");
    });
    app.post("/api/contracts/:contractId/approve", (req, res) => {
      if (!approvers(req, res)) return;
      const c = getContract(req, res);
      if (!c) return;
      if (c.status !== "pending") return fail(res, 409, `Contract is already ${c.status}`);
      const b = req.body || {};
      if (!c.isSigntuerd) return res.status(409).json({ success: false, statusCode: 409, code: "unsigned", message: "The customer hasn't signed this contract yet" });
      const project = projectById(c.projectId);
      if (project?.assignedSalesmanId && !b.commissionMode) return res.status(422).json({ success: false, statusCode: 422, code: "commission_required", message: "Set the salesperson's commission" });
      if (b.commissionMode && !["percentage", "fixed"].includes(b.commissionMode)) return fail(res, 422, "Commission mode must be percentage or fixed");
      if (b.commissionMode === "percentage" && (H.num(b.commissionValue) < 0 || H.num(b.commissionValue) > 100)) return fail(res, 422, "Commission percentage must be between 0 and 100");
      approveContract(c, { mode: b.commissionMode || null, value: b.commissionValue, actorUser: req.sc.user });
      ok(res, contractOut(c), "Contract approved successfully");
    });
    app.post("/api/contracts/:contractId/reject", (req, res) => {
      if (!approvers(req, res)) return;
      const c = getContract(req, res);
      if (!c) return;
      if (c.status !== "pending") return fail(res, 409, `Contract is already ${c.status}`);
      rejectContract(c, { reason: req.body?.rejectionReason });
      ok(res, contractOut(c), "Contract rejected");
    });
    function confirm(req, c, file) {
      const p = projectById(c.projectId);
      const ts = new Date().toISOString();
      Object.assign(c, { isSigntuerd: true, confirmedAt: ts, confirmedBy: K.userName(req.sc.user), updatedAt: ts });
      if (file) c.signedPdfPath = K.uploaded(file);
      if (p && p.status === "pending") Object.assign(p, { status: "confirmed", updatedAt: ts });
      if (p) {
        K.notify([K.salesmanUserId(p.assignedSalesmanId), ...K.adminIds()], "contract.confirmed", { title: "Contract signed", message: `${K.customerById(p.customerId)?.companyName || "The customer"} signed the contract for "${p.projectName}".`, data: { projectId: p.id, contractId: c.id } });
      }
    }
    app.post("/api/contracts/:contractId/sign/upload", S.ctx.upload.single("signedContract"), (req, res) => {
      const c = getContract(req, res);
      if (!c) return;
      if (!req.file) return fail(res, 422, "Attach the signed contract (PDF or image)");
      if (c.status === "rejected") return fail(res, 409, "This contract was rejected");
      confirm(req, c, req.file);
      ok(res, contractOut(c), "Signed contract uploaded successfully");
    });
    app.post("/api/contracts/:contractId/confirm", (req, res) => {
      const c = getContract(req, res);
      if (!c) return;
      confirm(req, c, null);
      ok(res, contractOut(c), "Contract confirmed");
    });

    // ---------------- offers
    const getOffer = (req, res) => {
      const o = offerById(req.params.offerId);
      if (!o || !canSeeOffer(req, o)) {
        fail(res, 404, "Offer not found");
        return null;
      }
      return o;
    };
    app.get("/api/offers", (req, res) => {
      let list = db.offers.filter((o) => canSeeOffer(req, o));
      if (req.query.status && req.query.status !== "all") list = list.filter((o) => o.status === req.query.status);
      if (req.query.search) {
        const s = String(req.query.search).toLowerCase();
        list = list.filter((o) => o.name.toLowerCase().includes(s) || (K.customerById(o.customerId)?.companyName || "").toLowerCase().includes(s));
      }
      const { items, meta } = util.paginate(H.sortDesc(list, "submittedAt"), req.query, { defaultLimit: 10 });
      ok(res, { items: items.map(offerListItem), meta }, "Offers retrieved");
    });
    app.get("/api/offers/status-counts", (req, res) => {
      const list = db.offers.filter((o) => canSeeOffer(req, o));
      const count = (s) => list.filter((o) => o.status === s).length;
      ok(res, { all: list.length, pending: count("pending"), countered: count("countered"), accepted: count("accepted"), rejected: count("rejected") }, "Offer counts retrieved");
    });
    app.get("/api/offers/:offerId", (req, res) => {
      const o = getOffer(req, res);
      if (o) ok(res, offerDetail(req, o), "Offer retrieved");
    });
    app.post("/api/offers", (req, res) => {
      // Salespeople make offers for their own customers only (user decision, wave 6).
      if (req.sc.role === "salesman" && K.customerById(req.body?.customerId)?.assignedSalesmanId !== req.sc.staff?.id) {
        return res.status(403).json({ success: false, statusCode: 403, code: "forbidden", message: "You can make offers only for your own customers" });
      }
      const r = createOffer(req, req.body || {});
      if (r.error) return fail(res, 422, r.error);
      ok(res, offerDetail(req, r.value), "Offer created successfully", 201);
    });
    app.patch("/api/offers/:offerId", (req, res) => {
      const o = getOffer(req, res);
      if (!o) return;
      if (!["pending", "countered"].includes(o.status)) return fail(res, 409, `An ${o.status} offer cannot be edited`);
      const b = req.body || {};
      const customer = req.sc.role === "customer" ? req.sc.customer : K.customerById(b.customerId || o.customerId);
      const hasPlans = (Array.isArray(b.planSelections) && b.planSelections.length) || H.listParam(b.planIds).length || (Array.isArray(b.customPlans) && b.customPlans.length);
      if (hasPlans) {
        const r = buildDeal({ ...b, vatCountryCode: b.vatCountryCode ?? o.vatCountryCode }, { customer, lang: req.sc.lang });
        if (r.error) return fail(res, 422, r.error);
        if (r.value.totals.error) return fail(res, 422, r.value.totals.error);
        Object.assign(o, { lines: r.value.lines, totals: offerTotals(r.value.totals), zoneId: r.value.zone.id, currencyCode: r.value.zone.currencyCode, name: offerName(r.value.lines) });
      }
      if (customer && req.sc.role !== "customer") o.customerId = customer.id;
      if (b.noteToCustomer !== undefined) o.noteToCustomer = b.noteToCustomer || null;
      if (b.vatCountryCode !== undefined) o.vatCountryCode = b.vatCountryCode || null;
      o.updatedAt = new Date().toISOString();
      o.events.push({ id: H.newId(), type: "quote_updated", amount: o.totals.total, currencyCode: o.currencyCode, note: null, actorId: String(req.sc.user.id), actorType: req.sc.role === "customer" ? "customer" : "staff", createdAt: o.updatedAt });
      ok(res, offerDetail(req, o), "Offer updated successfully");
    });
    app.delete("/api/offers/:offerId", (req, res) => {
      if (!K.requireRoles(req, res, ["admin", "manager", "salesman"], "Customers can't delete offers")) return;
      const o = getOffer(req, res);
      if (!o) return;
      if (o.status === "accepted") return fail(res, 409, "Accepted offers cannot be deleted");
      db.offers.splice(db.offers.indexOf(o), 1);
      ok(res, null, "Offer deleted successfully");
    });
    for (const action of ["counter", "accept", "reject"]) {
      app.post(`/api/offers/:offerId/${action}`, (req, res) => {
        const o = getOffer(req, res);
        if (!o) return;
        const r = respondOffer(req, o, action, { total: req.body?.total, note: req.body?.note });
        if (r.error) return fail(res, 409, r.error);
        const msg = { counter: "Counter offer sent", accept: "Offer accepted", reject: "Offer rejected" }[action];
        ok(res, offerDetail(req, o), msg);
      });
    }
  }

  return {
    routes, projectById, contractById, offerById, latestContract, contractsOf, canSeeProject, canSeeOffer, visibleProjects,
    buildDeal, createProject, createContract, approveContract, rejectContract, createOffer, respondOffer, contractOut, projectOut, planLineOut,
    commissionFor, contractPdf, resolveZone, totalsFor,
  };
};
