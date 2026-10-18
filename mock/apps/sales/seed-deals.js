// Phase 2 seed: projects / contracts / subscriptions / invoices / commissions / offers / tickets /
// notifications / loyalty history, built through the same services the API uses (so totals stay consistent).
const H = require("./lib");
const { PACKAGES } = require("./catalog-data");

module.exports = function seedDeals(S, { referencesOnly = false } = {}) {
  const { db, identity, util } = S;
  const C = S.catalog;
  const K = S.core;
  const D = S.deals;
  const B = S.billing;
  const uid = H.uid;
  const ago = (d, h = 0) => H.daysAgo(d, h);

  // ---------------------------------------------------------------- catalog finishing touches
  for (const p of db.plans) {
    for (const zp of p.zonePrices) {
      if (zp._overrideFactors) {
        const base = C.planZoneBase(p, zp.zoneId)?.amount;
        const cur = C.zoneById(zp.zoneId).currencyCode;
        zp.countryOverrides = Object.entries(zp._overrideFactors).map(([cc, f]) => ({ countryCode: cc, price: H.money(Math.round((base * f) / 50) * 50, cur) }));
      }
      delete zp._overrideFactors;
    }
  }
  db.packages = PACKAGES.map((pk) => {
    const planIds = pk.plans.map((k) => uid("plan", k));
    const zones = Object.entries(pk.zones).map(([zk, factor]) => {
      const zoneId = uid("zone", zk);
      const cur = C.zoneById(zoneId).currencyCode;
      const sum = planIds.reduce((s, id) => s + (C.planZoneBase(C.planById(id), zoneId)?.amount || 0), 0);
      const price = Math.round((sum * factor) / 50) * 50;
      const overrides = Object.entries(pk.overrides?.[zk] || {}).map(([cc, f]) => ({ countryCode: cc, price: Math.round((price * f) / 50) * 50 }));
      return { zoneId, price: H.round(price, cur), countryOverrides: overrides };
    });
    return { id: uid("package", pk.key), key: pk.key, name: pk.name, description: pk.description, planIds, zones, status: pk.archivedDaysAgo ? "archived" : "active", archivedAt: pk.archivedDaysAgo ? ago(pk.archivedDaysAgo) : null, createdAt: ago(pk.createdDaysAgo), updatedAt: ago(Math.floor(pk.createdDaysAgo / 4)) };
  });
  if (referencesOnly) return;

  // Historical sales baseline per zone (older deals that are not individually seeded) for the trend charts.
  const rnd = util.seeded(2026);
  const baseline = { eg: [260000, 90000], gcc: [42000, 16000], eu: [9000, 4200], row: [3200, 1800] };
  db.salesHistory = {};
  for (const [zk, [start, step]] of Object.entries(baseline)) {
    const zoneId = uid("zone", zk);
    db.salesHistory[zoneId] = {};
    for (let i = 12; i >= 1; i--) {
      const m = H.monthKey(H.addMonths(new Date(), -i));
      const trendF = 1 + ((12 - i) / 12) * 0.9;
      db.salesHistory[zoneId][m] = Math.round((start * trendF + step * (rnd.rnd() - 0.3)) / 100) * 100;
    }
  }

  // ---------------------------------------------------------------- helpers
  function fakeReq(userKey) {
    const u = identity.findByKey(userKey);
    const role = K.appRole(u);
    return { sc: { user: u, role, lang: "en", catAdmin: role === "admin" || role === "manager", customer: role === "customer" ? K.customerByAuth(u.id) : null, staff: K.staffByAuth(u.id), displayCurrency: null }, query: {}, headers: {}, body: {} };
  }
  const admin = fakeReq("admin");
  const dur = (type, m) => uid("duration", `${type}-${m}`);
  const sel = (planKey, months, inst) => ({ planId: uid("plan", planKey), durationId: dur("plan", months), paymentMethod: inst ? "installment" : "cash", installmentDurationId: inst ? dur("installment", inst) : undefined });
  const custom = (label, keys, months, inst) => ({ label, featureIds: keys.map((k) => uid("feature", k)), durationId: dur("plan", months), paymentMethod: inst ? "installment" : "cash", installmentDurationId: inst ? dur("installment", inst) : undefined });
  const cust = (k) => K.customerById(uid("customer", k));
  const payDate = (due) => H.iso(Math.min(new Date(due).getTime() - 2 * H.DAY + 3 * 36e5, Date.now() - 36e5));
  function payInstallments(sub, n, method = "bank_transfer") {
    const rows = sub.installments.length ? sub.installments.slice(0, n) : n > 0 ? [sub._cashSchedule] : [];
    for (const inst of rows) {
      if (!inst) continue;
      const at = payDate(inst.dueDate);
      if (new Date(at).getTime() < new Date(sub.startDate).getTime()) continue;
      B.applyPayment(sub, inst.amount, { method, reference: method === "bank_transfer" ? `TRX-${H.token(4).toUpperCase()}` : null, at });
    }
  }
  const signedDoc = (p) => K.writeSeed(`signed-contract-${p.referenceNumber}.pdf`, "pdf", { title: "Service Contract (signed)", lines: [`Project #${p.referenceNumber}: ${p.projectName}`, "Signed and stamped copy uploaded by the customer.", "", "Signature: ______________________"], displayName: `Signed-Contract-${p.referenceNumber}.pdf` });

  // ---------------------------------------------------------------- projects
  // [key, customer, name, description, dept, priority, createdAgo, approvedAgo|null, finalStatus, selections, customPlans, vat, opts]
  const P = [
    ["p1", "nile", "Nile Foods Rebrand 2026", "New visual identity and always-on social presence for the 2026 product line.", "design", "high", 118, 110, "in_progress", [sel("starter-brand", 6), sel("social-always-on", 6)], [], "EG", { pay: "all", signed: true, due: 45 }],
    ["p2", "nile", "Nile Foods E-shop", "Direct-to-consumer online store with Paymob payments and delivery integration.", "dev", "medium", 178, 170, "testing", [sel("ecom-growth", 12, 12)], [], "EG", { pay: 5, signed: true, due: 20 }],
    ["p3", "nile", "Ramadan Campaign Landing Pages", "Performance landing pages and paid media for the Ramadan 2027 campaign.", "mkt", "high", 3, null, "pending", [], [custom("Ramadan Performance Pack", ["ab-testing", "google-ads", "meta-ads"], 3)], "EG", {}],
    ["p4", "delta", "Delta Pharma Patient App", "Patient companion app with prescription reminders and pharmacy locator.", "dev", "high", 16, 5, "approved", [sel("mobile-launch", 12, 12)], [], "EG", { pay: 0, signed: true, due: 160 }],
    ["p5", "cairomart", "Cairo Mart Loyalty Website", "Website with loyalty card sign-up and store locator.", "dev", "medium", 6, null, "confirmed", [sel("corp-web", 6)], [], "EG", { signed: true }],
    ["p6", "alexlog", "Fleet Tracking Portal", "Customer portal for real-time shipment tracking.", "dev", "low", 40, null, "rejected", [sel("corp-web", 12, 12)], [], "EG", { reject: 35, reason: "Budget moved to 2027" }],
    ["p7", "redsea", "Red Sea Resorts Booking Revamp", "UX sprint and new booking website for three resorts.", "design", "medium", 250, 243, "completed", [sel("ux-sprint", 3), sel("corp-web", 6)], [], "EG", { pay: "all", signed: true, refund: 5000 }],
    ["p8", "pyramids", "Pyramids Listings SEO", "Organic growth programme for 1,200 property listings.", "mkt", "medium", 235, 228, "in_progress", [sel("seo-accelerator", 12, 6)], [], "EG", { pay: "all", signed: true }],
    ["p9", "riyadhretail", "Riyadh Retail Omnichannel Store", "Online store plus social media for 14 branches.", "dev", "high", 200, 195, "in_progress", [sel("ecom-growth", 12, 12), sel("social-always-on", 6)], [], "SA", { pay: 7, signed: true, cancelSecond: "Customer moved social media in-house" }],
    ["p10", "jeddahcoffee", "Jeddah Coffee Brand Refresh", "Brand refresh ahead of two new cafés.", "design", "medium", 1, null, "pending", [sel("starter-brand", 3)], [], "SA", { coupon: "BRAND500" }],
    ["p11", "marina", "Marina Hospitality Guest App", "Guest app for check-in, room service and concierge chat.", "dev", "high", 26, 20, "approved", [sel("mobile-launch", 12, 24)], [], "AE", { pay: 1, partialNext: 0.4, signed: true, commission: ["percentage", 7] }],
    ["p12", "adenergy", "ADES Corporate Website", "Corporate website with investor relations section.", "dev", "medium", 62, 58, "testing", [sel("corp-web", 6)], [], "AE", { pay: "all", signed: true }],
    ["p13", "sharjahtex", "Sharjah Textiles Catalog", "B2B catalog with wholesale price lists.", "dev", "low", 150, null, "rejected", [sel("ecom-growth", 6)], [], "AE", { reject: 145, reason: "Customer chose an in-house team" }],
    ["p14", "dohamotors", "Doha Motors Launch Campaign", "Launch campaign for the new showroom in West Bay.", "mkt", "high", 180, 172, "completed", [sel("launch-360", 6, 6)], [], "QA", { pay: "all", signed: true }],
    ["p16", "manama", "Manama FinTech Design System", "Design system for the wallet app and marketing site.", "design", "high", 140, 135, "in_progress", [sel("design-system-pro", 12, 12)], [], "BH", { pay: 5, signed: true, pause: 10 }],
    ["p17", "zurich", "Zurich Precision Web Platform", "Multilingual corporate platform plus SEO for the DACH market.", "dev", "medium", 30, 25, "approved", [sel("corp-web", 12, 12), sel("seo-accelerator", 6)], [], "CH", { pay: 1, signed: true, voidSecond: "Issued with the wrong VAT rate" }],
    ["p18", "lyon", "Lyon Gastronomie Social Kit", "Social content kit for three restaurants.", "mkt", "low", 8, null, "pending", [], [custom("Restaurant Social Kit", ["social-mgmt", "content-cal", "reels"], 3)], "FR", {}],
    ["p19", null, "OrgTik Website Refresh", "Internal refresh of the OrgTik marketing website.", "design", "medium", 45, null, "in_progress", [], [], null, { internal: true, due: 20 }],
    ["p20", "muscatfish", "Muscat Fisheries Export Site", "Export-focused website with product spec sheets.", "dev", "medium", 9, null, "confirmed", [sel("corp-web", 3)], [], "OM", { signed: true }],
    ["p21", "ainshams", "Clinic Appointment Booking", "Online booking for five clinics.", "dev", "medium", 92, 86, "completed", [sel("corp-web", 3)], [], "EG", { pay: "all", signed: true }],
    ["p22", "nile", "Nile Foods Product Photography", "Studio photography and reels for the snack range.", "design", "low", 145, 140, "completed", [], [custom("Snack Range Shoot", ["photo-day", "reels"], 1)], "EG", { pay: "all", signed: true }],
  ];
  const projects = {};
  for (const [key, ck, name, desc, dept, priority, createdAgo, approvedAgo, finalStatus, selections, customs, vat, o] of P) {
    const c = ck ? cust(ck) : null;
    const req = admin;
    const r = D.createProject(req, {
      projectName: name, projectDescription: desc, projectType: o.internal ? "internal_project" : "client_project", customerId: c?.id, assignedSalesmanId: c?.assignedSalesmanId || undefined,
      departmentId: uid("dept", dept), priority, planSelections: selections, customPlans: customs, vatCountryCode: vat || undefined, couponCode: o.coupon,
    }, { at: ago(createdAgo, 2), status: o.internal ? "in_progress" : "pending", actorUser: identity.findByKey(c?.assignedSalesmanId ? ({ [uid("staff", "omar")]: "sales", [uid("staff", "tamer")]: "u13" }[c.assignedSalesmanId] || "admin") : "admin") });
    if (r.error) throw new Error(`seed ${key}: ${r.error}`);
    const p = r.value;
    p.key = key;
    projects[key] = p;
    if (o.due) p.dueDate = H.daysAhead(o.due);
    const ct = r.contract;
    if (ct && o.signed) Object.assign(ct, { isSigntuerd: true, signedPdfPath: signedDoc(p), confirmedAt: ago(createdAgo - 1 > 0 ? createdAgo - 1 : 0, 1), confirmedBy: c?.fullName || "Customer" });
    if (ct && approvedAgo != null) {
      D.approveContract(ct, { at: ago(approvedAgo, 1), mode: o.commission?.[0], value: o.commission?.[1] });
      const subs = db.subscriptions.filter((s) => s.contractId === ct.id);
      subs.forEach((sub, i) => {
        if (o.pay === "all") payInstallments(sub, sub.installments.length || 1);
        else if (typeof o.pay === "number") payInstallments(sub, i === 0 ? o.pay : sub.installments.length ? Math.min(o.pay, sub.installments.length) : 0);
      });
      if (o.partialNext && subs[0]) {
        const next = subs[0].installments.find((i) => i.status !== "paid");
        if (next) B.applyPayment(subs[0], H.round(next.amount * o.partialNext, subs[0].currencyCode), { method: "bank_transfer", reference: "TRX-PARTIAL", at: ago(2, 6) });
      }
      if (o.cancelSecond && subs[1]) {
        payInstallments(subs[1], 1);
        Object.assign(subs[1], { status: "cancelled", cancelReason: o.cancelSecond, cancelledAt: ago(20), autoRenew: false });
      }
      if (o.pause && subs[0]) Object.assign(subs[0], { status: "paused", pausedAt: ago(o.pause) });
      if (o.refund && subs[0]) {
        const s0 = subs[0];
        const at = ago(200);
        db.invoices.push({ id: H.newId(), invoiceId: K.nextCode("refund", "RF-2026"), kind: "refund", subscriptionId: s0.id, customerId: s0.customerId, projectName: s0.projectName, currencyCode: s0.currencyCode, totalAmount: o.refund, paidAmount: o.refund, status: "paid", paymentMethod: "bank_transfer", createdAt: at, issuedAt: at, dueDate: at, paidAt: at, lineItems: [{ id: H.newId(), description: "Refund – usability testing round cancelled", quantity: 1, amount: o.refund }], subtotalAmount: o.refund, taxRate: 0, taxAmount: 0 });
        s0.refundedAmount = o.refund;
        s0.refunds.push({ code: "RF-2026-0001", amount: o.refund, refundTo: "bank_transfer", note: "Usability testing round cancelled", at });
      }
      if (o.voidSecond && subs[1]) {
        const s1 = subs[1];
        const inv = B.subInvoices(s1)[0];
        if (inv) {
          Object.assign(inv, { status: "void", voidReason: o.voidSecond, voidAt: ago(18) });
          const replacement = { ...s1._cashSchedule, dueDate: ago(4) };
          s1._cashSchedule = replacement;
          const vatRate = H.num(s1.vatRate);
          const total = H.num(replacement.amount);
          db.invoices.push({ id: H.newId(), invoiceId: K.nextCode("invoice", "INV-2026"), kind: "subscription", type: "subscription", subscriptionId: s1.id, projectId: s1.projectId, projectName: s1.projectName, customerId: s1.customerId, planName: s1.planName, planTag: "cash_only", paymentType: "subscription", currencyCode: s1.currencyCode, dueDate: replacement.dueDate, status: "pending", paidAmount: 0, createdAt: ago(18), issuedAt: ago(18), lineItems: [{ id: H.newId(), description: `${H.text(s1.planName)} – ${s1.months} months (corrected VAT)`, quantity: 1, amount: H.round(total / (1 + vatRate / 100), s1.currencyCode) }], subtotalAmount: H.round(total / (1 + vatRate / 100), s1.currencyCode), taxRate: vatRate, taxAmount: H.round(total - total / (1 + vatRate / 100), s1.currencyCode), totalAmount: total, paidAt: null, paymentMethod: null, paymentReference: null, voidReason: null, voidAt: null });
        }
      }
    }
    if (ct && o.reject) D.rejectContract(ct, { at: ago(o.reject, 3), reason: o.reason });
    p.status = finalStatus;
    // Last activity roughly a third of the project's age ago (older completed projects look quiet).
    p.updatedAt = ago(Math.floor((approvedAgo ?? createdAgo) / 3), 4);
    if (p.createdAt > p.updatedAt) p.updatedAt = p.createdAt;
  }
  // Project contact notes.
  const note = (p, author, days, content) => p.contactNotes.push({ id: H.newId(), content, createdBy: author, createdByType: author === "Nour Khaled" ? "customer" : author === "Mona Adel" ? "admin" : "salesman", createdAt: ago(days), updatedAt: ago(days) });
  note(projects.p1, "Omar Farouk", 100, "Kick-off done – moodboard approved by Nour on the call.");
  note(projects.p1, "Nour Khaled", 60, "Please prioritise the Arabic logotype before the trade fair.");
  note(projects.p1, "Omar Farouk", 12, "Social calendar for October shared; waiting for product photos.");
  note(projects.p2, "Omar Farouk", 30, "UAT scheduled; customer wants Fawry as a second payment option.");
  note(projects.p4, "Mona Adel", 5, "Commission agreed at the plan default (USD 500 fixed).");
  note(projects.p9, "Tamer Wagdy", 21, "Social media cancelled at customer request; store work continues.");
  note(projects.p17, "Mona Adel", 18, "Replaced the SEO invoice – Swiss VAT must be 8.1%.");

  // Customer self-service subscription (pay later).
  const nourReq = fakeReq("customer");
  const r23 = D.createProject(nourReq, { projectName: "Nile Foods SEO Boost", projectDescription: "Quarterly SEO push for the new product pages.", projectType: "client_project", departmentId: uid("dept", "mkt"), priority: "medium", planSelections: [sel("seo-accelerator", 3)] }, { at: ago(2, 5) });
  D.approveContract(r23.contract, { at: ago(2, 4) });
  projects.p23 = r23.value;
  r23.value.status = "approved";
  for (const s of db.subscriptions.filter((x) => x.contractId === r23.contract.id)) s.status = "pending";

  // Commission payouts with receipts.
  const receipt = (cm) => K.writeSeed(`receipt-${cm.reference}.pdf`, "pdf", { title: "Commission payout receipt", lines: [`Reference: ${cm.reference}`, `Project: ${cm.projectName}`, `Amount: ${H.fmtMoney(cm.amount, cm.currency)}`, "Paid by bank transfer."], displayName: `receipt-${cm.reference}.pdf` });
  const cmOf = (pk) => db.commissions.find((c) => c.projectId === projects[pk].id);
  for (const [pk, share, daysAgoPaid] of [["p7", 1, 200], ["p8", 1, 150], ["p14", 1, 60], ["p21", 1, 40], ["p22", 1, 120], ["p9", 0.4, 90], ["p1", 0.5, 30], ["p12", 0.3, 14]]) {
    const cm = cmOf(pk);
    if (!cm) continue;
    const doc = receipt(cm);
    B.payCommission(cm, H.round(cm.amount * share, cm.currency), { receipt: doc, at: ago(daysAgoPaid) });
  }

  // ---------------------------------------------------------------- offers
  const ofr = (customerKey, actorKey, days, body) => {
    const req = fakeReq(actorKey);
    if (req.sc.role !== "customer") req.sc.customer = null;
    const r = D.createOffer(req, { customerId: uid("customer", customerKey), vatCountryCode: cust(customerKey).countryCode, ...body }, { at: ago(days, 3) });
    if (r.error) throw new Error(`seed offer: ${r.error}`);
    return r.value;
  };
  const respond = (o, actorKey, action, days, extra = {}) => {
    const actor = identity.findByKey(actorKey);
    return D.respondOffer(fakeReq(actorKey), o, action, { ...extra, at: ago(days, 1), actorUser: actor });
  };
  const o1 = ofr("nile", "customer", 2, { planSelections: [sel("design-system-pro", 6, 6)], noteToCustomer: "We'd like to start the design system in November." });
  const o2 = ofr("nile", "customer", 9, { planSelections: [sel("mobile-launch", 12, 12)], noteToCustomer: "Looking for a loyalty app for our retail customers." });
  respond(o2, "admin", "counter", 6, { total: H.round(H.num(o2.totals.total) * 0.9, o2.currencyCode), note: "We can do 10% off if you sign before October 15." });
  const o3 = ofr("kuwaitgourmet", "u13", 7, { planSelections: [sel("social-always-on", 3)], noteToCustomer: "Three-month trial of our always-on social package." });
  respond(o3, "u13", "accept", 4, { note: "Accepted by Yousef on the phone – confirmation email attached to CRM." });
  const p15 = D.projectById(o3.projectId);
  if (p15) Object.assign(p15, { projectName: "Kuwait Gourmet Social Growth", projectDescription: "Three-month social media trial for four restaurants.", departmentId: uid("dept", "mkt"), key: "p15" });
  const o4 = ofr("sharjahtex", "u13", 160, { planSelections: [sel("ecom-growth", 6)] });
  respond(o4, "u13", "reject", 152, { note: "Customer declined – in-house team." });
  const o5 = ofr("milano", "admin", 5, { planSelections: [sel("launch-360", 3, 3)], noteToCustomer: "Private launch programme for your Milan flagship." });
  const o6 = ofr("manama", "u13", 12, { planSelections: [sel("seo-accelerator", 6, 6)] });
  respond(o6, "u13", "counter", 8, { total: H.round(H.num(o6.totals.total) * 0.95, o6.currencyCode), note: "Noora asked for a 5% loyalty discount." });
  o6.lastTermsBy = "customer";
  o6.awaitingResponseFrom = "staff";
  o6.events[o6.events.length - 1].actorType = "customer";
  const o7 = ofr("nile", "sales", 40, { planSelections: [sel("ux-sprint", 3)], noteToCustomer: "UX sprint for the e-shop checkout." });
  respond(o7, "customer", "reject", 35, { note: "Timing doesn't work for us this quarter." });
  ofr("delta", "sales", 1, { planSelections: [sel("starter-brand", 6)], noteToCustomer: "Brand refresh to match the new patient app." });

  // ---------------------------------------------------------------- custom invoices
  const ci = (customerKey, number, currency, taxRate, dueDays, items, status, description, extra = {}) => {
    const c = cust(customerKey);
    const lineItems = items.map(([d, q, u]) => ({ description: d, quantity: q, unitPrice: u, amount: q * u }));
    const subtotal = lineItems.reduce((s, l) => s + l.amount, 0);
    const at = ago(Math.max(1, (dueDays < 0 ? -dueDays : 0) + 20));
    const inv = {
      id: H.newId(), invoiceId: K.nextCode("customInvoice", "CINV-2026"), kind: "custom", type: "custom", invoiceNumber: number, status: status === "paid" ? "paid" : "pending", paidAmount: 0,
      customerId: c.id, currencyCode: currency, billingName: c.companyName, billingContactPerson: c.fullName, billingAddress: `<p>${c.address}</p>`, billingEmail: c.email, billingPhone: c.phoneNumber,
      contactPerson: "Hany Samir", contactEmail: "billing@orgtik.test", contactPhone: "+20 2 2735 0000", closingText: "<p>Thank you for your business. Payment within 14 days by bank transfer.</p>", description: `<p>${description}</p>`,
      lineItems, subtotalAmount: subtotal, taxRate, taxAmount: H.round((subtotal * taxRate) / 100, currency), totalAmount: H.round(subtotal * (1 + taxRate / 100), currency),
      dueDate: dueDays >= 0 ? H.daysAhead(dueDays) : H.daysAgo(-dueDays), issuedAt: at, createdAt: at, updatedAt: at, metadata: { projectReference: extra.ref || "", notes: extra.notes || "" }, sentTo: [c.email],
      paidAt: null, paymentMethod: null, paymentReference: null, voidReason: null, voidAt: null,
    };
    db.invoices.push(inv);
    if (status === "paid") {
      inv.paymentProof = K.writeSeed(`proof-${inv.invoiceId}.pdf`, "pdf", { title: "Bank transfer confirmation", lines: [`Invoice ${number}`, `Amount: ${H.fmtMoney(inv.totalAmount, currency)}`, "Status: settled"], displayName: `transfer-${number}.pdf` });
      B.markInvoicePaid(inv, { method: "bank_transfer", reference: `SWIFT-${H.token(4).toUpperCase()}`, at: ago(8) });
    }
    return inv;
  };
  ci("nile", "ORG-2026-031", "EGP", 14, 10, [["Emergency hosting migration to AWS Bahrain", 1, 15500], ["Weekend on-call engineer", 2, 1500]], "pending", "Out-of-scope migration requested on 12 September.", { ref: `#${projects.p2.referenceNumber}` });
  ci("riyadhretail", "ORG-2026-027", "SAR", 15, -20, [["On-site training workshop (2 days)", 2, 6000]], "paid", "Store manager training in Riyadh.", { ref: `#${projects.p9.referenceNumber}` });
  ci("zurich", "ORG-2026-033", "EUR", 8.1, -5, [["Hardware procurement pass-through (kiosk tablets)", 6, 700]], "pending", "Pass-through cost for showroom kiosks.");
  ci("pyramids", "ORG-2026-034", "EGP", 14, 12, [["Drone photography session", 1, 16000], ["Photo retouching (40 images)", 40, 150]], "pending", "Aerial shots for the Sheikh Zayed compound.");

  // ---------------------------------------------------------------- tickets
  const people = (k) => identity.findByKey(k);
  const tk = (customerKey, subject, note, priority, status, assigneeKey, days, notes = []) => {
    const t = { id: uid("ticket", subject), number: ++db.counters.ticket, subject, note, customerId: uid("customer", customerKey), status, priority, assigneeId: assigneeKey ? people(assigneeKey).id : null, notes: [], createdByUserId: people(customerKey === "nile" ? "customer" : "admin").id, createdAt: ago(days, 2), updatedAt: ago(Math.max(0, days - 1)) };
    for (const [authorKey, text, d, file] of notes) {
      const u = people(authorKey);
      t.notes.push({ id: H.newId(), authorId: u.id, authorName: identity.fullName(u), note: text, fileUrl: file || null, createdAt: ago(d, 1), updatedAt: ago(d, 1) });
      if (ago(d, 1) > t.updatedAt) t.updatedAt = ago(d, 1);
    }
    db.tickets.push(t);
    return t;
  };
  const attach = (name, kind, title) => {
    const doc = K.writeSeed(`ticket-${name}`, kind, { title, lines: ["Attachment uploaded to the support ticket."], displayName: name, rgb: [41, 128, 185] });
    return `${doc.url}?key=${encodeURIComponent(`tickets/${name}`)}`;
  };
  const nileInvoice = db.invoices.find((i) => i.projectId === projects.p2.id && i.kind === "subscription");
  tk("nile", `Invoice ${nileInvoice?.invoiceId || "INV"} shows the wrong VAT`, "The VAT line on our September installment looks like 15% instead of 14%.", "high", "in_progress", "finance", 6, [
    ["customer", "Attaching the invoice we received.", 6, attach("september-invoice.pdf", "pdf", "Invoice copy")],
    ["finance", "Thanks Nour – checking with the billing team now.", 5],
    ["finance", "Confirmed: the PDF template used the Saudi rate. A corrected copy will follow today.", 1],
  ]);
  tk("nile", "Add the Arabic typeface to the brand guidelines", "Please include the Arabic font pairing and usage rules.", "medium", "open", null, 2, [["customer", "Our print shop needs this before Thursday.", 2]]);
  tk("nile", "E-shop checkout error on Safari", "Customers on iPhone see a blank page after choosing Paymob.", "urgent", "in_progress", "u7", 3, [
    ["customer", "Screenshot from our marketing manager's phone.", 3, attach("safari-checkout.png", "png", "Screenshot")],
    ["u7", "Reproduced on iOS 18 – a third-party cookie issue in the payment iframe. Fix in review.", 2],
  ]);
  tk("delta", "Access for our regulatory team", "Two colleagues need read access to the app staging build.", "low", "resolved", "manager", 12, [["manager", "Invites sent to both colleagues.", 11]]);
  tk("riyadhretail", "Arabic product descriptions missing", "About 120 SKUs show English text on the Arabic storefront.", "high", "open", null, 1);
  tk("marina", "Push notification certificates", "Apple push certificate expires next week.", "medium", "in_progress", "u11", 4, [["u11", "New APNs key generated; rolling out Monday.", 2]]);
  tk("zurich", "Swiss VAT invoice format", "Invoices must show our UID number and 8.1% VAT.", "medium", "resolved", "finance", 19, [["finance", "Template updated and the SEO invoice was reissued.", 18]]);
  tk("redsea", "German translation of the booking widget", "Some labels still appear in English on the German site.", "low", "resolved", "u8", 60, [["u8", "All labels translated and deployed.", 57]]);
  tk("manama", "Pause request for the design system retainer", "We need to pause for Q4 while the board reviews budgets.", "medium", "in_progress", "manager", 11, [["manager", "Subscription paused – we'll resume in January.", 10]]);

  // ---------------------------------------------------------------- loyalty history & coupons
  const nile = cust("nile");
  B.addTx(nile.id, { type: "earned", source: "invoice_payment", reason: "Payment for legacy invoice INV-2025-0412", points: 300, expiresAt: ago(35), at: ago(400) });
  B.addTx(nile.id, { type: "adjusted", source: "expiry", reason: "Points expired", points: -300, at: ago(35) });
  B.addTx(nile.id, { type: "earned", source: "invoice_payment", reason: "Payment for legacy invoice INV-2025-0533", points: 500, expiresAt: H.daysAhead(35), at: ago(330) });
  B.addTx(nile.id, { type: "adjusted", source: "manual_adjustment", reason: "Welcome bonus for joining the rewards programme", points: 250, expiresAt: H.daysAhead(200), at: ago(160) });
  const redeem = (rewardKey, days, status) => {
    const reward = db.loyalty.rewards.find((r) => r.id === uid("reward", rewardKey));
    B.addTx(nile.id, { type: "redeemed", source: "reward_redemption", reason: `Redeemed "${reward.name}"`, points: -reward.pointCost, at: ago(days) });
    reward.redemptionCount += 1;
    db.loyalty.coupons.push({ id: H.newId(), customerId: nile.id, rewardId: reward.id, rewardName: reward.name, pointsSpent: reward.pointCost, couponCode: `${reward.couponCodePrefix}-${H.token(4).toUpperCase().replace(/[^A-Z0-9]/g, "Q")}`, discountType: reward.discountType, discountValue: reward.discountValue, categoryId: reward.categoryId, expiresAt: status === "expired" ? ago(days - reward.validForDays) : H.daysAhead(reward.validForDays - days), status: status === "used" ? "used" : "active", createdAt: ago(days) });
  };
  redeem("r-10off", 20, "active");
  redeem("r-seo", 70, "used");
  redeem("r-500", 150, "expired");

  // ---------------------------------------------------------------- notifications (history)
  const N = (userKey, type, days, title, message, data, read = false) => {
    const u = identity.findByKey(userKey);
    const [n] = K.notify([u.id], type, { title, message, data, at: ago(days, (days * 7) % 11) });
    if (n && read) Object.assign(n, { status: "read", readAt: ago(Math.max(0, days - 1)) });
  };
  const pj = (k) => ({ projectId: projects[k].id, projectName: projects[k].projectName });
  const nileOverdue = db.invoices.filter((i) => i.projectId === projects.p2.id && B.invoiceStatus(i) === "overdue")[0];
  const nourInv = db.invoices.find((i) => i.projectId === projects.p23.id);
  // Admin
  N("admin", "contract.created", 3, "New contract awaiting review", `Ramadan Campaign Landing Pages – awaiting your approval.`, pj("p3"));
  N("admin", "contract.created", 1, "New contract awaiting review", `Jeddah Coffee Brand Refresh – awaiting your approval.`, pj("p10"));
  N("admin", "contract.confirmed", 5, "Contract signed", "Cairo Mart signed the contract for \"Cairo Mart Loyalty Website\".", pj("p5"));
  N("admin", "contract.confirmed", 8, "Contract signed", "Muscat Fisheries signed the contract for \"Muscat Fisheries Export Site\".", pj("p20"), true);
  N("admin", "offer.created", 2, "New offer request", `${o1.name} – requested by Nile Foods.`, { offerId: o1.id });
  N("admin", "offer.countered", 8, "Offer countered", `${o6.name} – Manama FinTech asked for 5% off.`, { offerId: o6.id });
  N("admin", "ticket.created", 1, "New support ticket", "Riyadh Retail Co.: Arabic product descriptions missing", { ticketId: uid("ticket", "Arabic product descriptions missing"), subject: "Arabic product descriptions missing" });
  N("admin", "ticket.created", 2, "New support ticket", "Nile Foods: Add the Arabic typeface to the brand guidelines", { ticketId: uid("ticket", "Add the Arabic typeface to the brand guidelines"), subject: "Add the Arabic typeface to the brand guidelines" }, true);
  if (nileOverdue) N("admin", "invoice.overdue", 10, "Invoice overdue", `${nileOverdue.invoiceId} for Nile Foods E-shop is overdue.`, { invoiceId: nileOverdue.invoiceId, invoiceNumber: nileOverdue.invoiceId });
  N("admin", "subscription.cancelled", 20, "Subscription cancelled", "Riyadh Retail cancelled Social Media Always-On.", { subscriptionId: db.subscriptions.find((s) => s.status === "cancelled")?.id }, true);
  N("admin", "customer.meeting_scheduled", 3, "Meeting scheduled", "Discovery call with Abu Dhabi Energy Services this week.", { customerId: uid("customer", "adenergy") }, true);
  N("admin", "salesman.created", 30, "New salesman", "Khaled Mansour joined the Europe sales team.", { salesmanId: uid("staff", "khaled") }, true);
  N("admin", "payment.received", 4, "Payment received", "Riyadh Retail paid invoice ORG-2026-027.", { invoiceNumber: "ORG-2026-027" }, true);
  // Managers
  N("manager", "contract.created", 1, "New contract awaiting review", "Jeddah Coffee Brand Refresh (Design).", pj("p10"));
  N("manager", "subscription.paused", 10, "Subscription paused", "Manama FinTech Design System is paused.", pj("p16"));
  N("manager", "ticket.assigned", 11, "Ticket assigned to you", "Pause request for the design system retainer", { ticketId: uid("ticket", "Pause request for the design system retainer") }, true);
  N("manager", "project.status_changed", 40, "Project status updated", "Red Sea Resorts Booking Revamp moved to completed.", pj("p7"), true);
  N("u15", "contract.confirmed", 5, "Contract signed", "Cairo Mart Loyalty Website is ready for approval.", pj("p5"));
  N("u15", "contract.confirmed", 8, "Contract signed", "Muscat Fisheries Export Site is ready for approval.", pj("p20"));
  N("u15", "project.status_changed", 15, "Project status updated", "Nile Foods E-shop moved to testing.", pj("p2"), true);
  N("u15", "project.status_changed", 9, "Project status updated", "ADES Corporate Website moved to testing.", pj("p12"));
  // Salesmen
  const cm = (k) => db.commissions.find((c) => c.projectId === projects[k].id);
  N("sales", "wallet.commission_added", 5, "Commission credited", `${H.fmtMoney(cm("p4")?.amount || 0, cm("p4")?.currency || "EGP")} commission for Delta Pharma Patient App.`, { commissionId: cm("p4")?.id, ...pj("p4") });
  N("sales", "wallet.commission_added", 2, "Commission credited", "Commission for Nile Foods SEO Boost added to your wallet.", { commissionId: cm("p23")?.id, ...pj("p23") });
  N("sales", "wallet.commission_paid", 40, "Commission paid out", `${cm("p21")?.reference} for Clinic Appointment Booking was paid.`, { commissionId: cm("p21")?.id }, true);
  N("sales", "wallet.commission_paid", 30, "Commission paid out", `Half of ${cm("p1")?.reference} (Nile Foods Rebrand 2026) was paid.`, { commissionId: cm("p1")?.id }, true);
  N("sales", "contract.approved", 5, "Contract approved", "Delta Pharma Patient App was approved.", pj("p4"));
  N("sales", "contract.created", 3, "New contract awaiting review", "Ramadan Campaign Landing Pages was submitted.", pj("p3"), true);
  N("sales", "contract.confirmed", 5, "Contract signed", "Cairo Mart signed the Loyalty Website contract.", pj("p5"));
  N("sales", "offer.rejected", 35, "Offer rejected", `${o7.name} was rejected by Nile Foods.`, { offerId: o7.id }, true);
  N("u13", "wallet.commission_added", 20, "Commission credited", "Commission for Marina Hospitality Guest App added to your wallet.", { commissionId: cm("p11")?.id, ...pj("p11") });
  N("u13", "wallet.commission_paid", 60, "Commission paid out", `${cm("p14")?.reference} for Doha Motors Launch Campaign was paid.`, { commissionId: cm("p14")?.id }, true);
  N("u13", "contract.approved", 20, "Contract approved", "Marina Hospitality Guest App was approved.", pj("p11"), true);
  N("u13", "offer.accepted", 4, "Offer accepted", "Kuwait Gourmet accepted the social media trial.", { offerId: o3.id, projectId: o3.projectId });
  N("u13", "customer.meeting_scheduled", 3, "Meeting scheduled", "Discovery call with Abu Dhabi Energy Services.", { customerId: uid("customer", "adenergy") });
  N("u13", "contract.rejected", 145, "Contract rejected", "Sharjah Textiles Catalog was rejected.", pj("p13"), true);
  // Customer (Nour – Nile Foods)
  if (nourInv) N("customer", "invoice.created", 2, "New invoice", `Invoice ${nourInv.invoiceId} for ${H.fmtMoney(nourInv.totalAmount, nourInv.currencyCode)} is ready.`, { invoiceId: nourInv.invoiceId, invoiceNumber: nourInv.invoiceId, amount: H.money(nourInv.totalAmount, nourInv.currencyCode), currency: nourInv.currencyCode });
  if (nileOverdue) N("customer", "invoice.overdue", 10, "Invoice overdue", `Invoice ${nileOverdue.invoiceId} is overdue – please pay to avoid service interruption.`, { invoiceId: nileOverdue.invoiceId, invoiceNumber: nileOverdue.invoiceId });
  N("customer", "offer.countered", 6, "Counter offer received", `${o2.name}: 10% off if signed before October 15.`, { offerId: o2.id });
  N("customer", "ticket.note_added", 1, "New reply on your ticket", "Confirmed: the PDF template used the Saudi rate.", { ticketId: uid("ticket", `Invoice ${nileInvoice?.invoiceId || "INV"} shows the wrong VAT`) });
  N("customer", "project.status_changed", 15, "Project status updated", "Nile Foods E-shop moved to testing.", pj("p2"), true);
  N("customer", "invoice.paid", 25, "Invoice paid", "Your latest Nile Foods Rebrand invoice is fully paid. Thank you!", pj("p1"), true);
  N("customer", "payment.received", 25, "Payment received", "We received your payment for Nile Foods Rebrand 2026.", pj("p1"), true);
  N("customer", "coupon.shared", 12, "You received a coupon", "Use WELCOME10 for 10% off UI/UX Design plans.", { couponId: uid("coupon", "WELCOME10"), code: "WELCOME10" });
  N("customer", "contract.approved", 110, "Contract approved", "Nile Foods Rebrand 2026 was approved.", pj("p1"), true);
  N("customer", "loyalty.points_adjusted", 160, "Bonus points added", "250 welcome points were added to your balance.", { customerId: nile.id }, true);

  // Saved notification preferences for Omar (exercises the "saved rows" response shape).
  const omar = identity.findByKey("sales");
  db.notificationPrefs[omar.id] = Object.entries(K.TYPE_DEFAULTS).map(([notificationType, enabledChannels]) => ({
    id: uid("pref", `${omar.id}-${notificationType}`), userId: omar.id, userType: "salesman", notificationType,
    enabledChannels: notificationType.startsWith("project.") ? enabledChannels.filter((c) => c !== "email") : enabledChannels, createdAt: ago(50), updatedAt: ago(50),
  }));

  B.refreshSchedules();
};
