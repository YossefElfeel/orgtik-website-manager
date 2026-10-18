// The platform mock's data (Phase E): catalogue, pricing, customers, money, services, support and
// system settings, all in memory and rebuilt on every /__mock/reset. Seeded so that every state in
// spec 06's tables shows up somewhere: an active customer, a trial ending, a failed payment, a
// read-only line, a cancelling one, a suspended workspace, a currency migration, open quotes,
// tickets waiting for the customer.
const pricing = require("./pricing");
const seedPricing = require("./seed-pricing");
const seedCatalog = require("./seed-catalog");

const L = (en, ar, de, fr, it) => ({ en, ar, de, fr, it });
const clone = (x) => JSON.parse(JSON.stringify(x));
const DAY = 86400000;

function makeStore({ identity }) {
  const now = () => Date.now();
  const iso = (t) => new Date(t).toISOString();
  const at = (days) => iso(now() + days * DAY);
  let seq = 1000;
  const id = (p) => `${p}_${++seq}`;

  const db = {
    ...clone(seedPricing),
    tools: clone(seedCatalog.tools),
    features: clone(seedCatalog.features),
    plans: clone(seedCatalog.plans),
    waitlist: clone(seedCatalog.waitlist),
    priceVersion: 1,
    priceDrafts: [],
    pricingLog: [],
    bundles: [],
    coupons: [],
    workspaces: [],
    invoices: [],
    customPlanRequests: [],
    services: [],
    serviceRequests: [],
    tickets: [],
    taxRules: [],
    gateways: [],
    templates: [],
    notifications: [],
    audit: [],
    migrations: [],
    staffRoles: {},
    settings: {},
  };

  // ---- services: packages on the zone grid (R03-V1), quote-only ones without a public price ----
  const svc = (id, family, kind, billing, name, o = {}) => ({ id, family, kind, billing, name, status: "active", subscriberDiscountPct: 10, ...o });
  db.services = [
    svc("svc_brand", "design", "package", "once", L("Brand identity", "الهوية البصرية", "Markenidentität", "Identité de marque", "Identità di marca"), { deliveryDays: 21, milestones: ["Discovery", "Concepts", "Final files"] }),
    svc("svc_website", "development", "quote", "once", L("Website build", "تطوير موقع", "Website-Entwicklung", "Création de site", "Sviluppo sito"), { deliveryDays: 45, milestones: ["Scope", "Design", "Build", "Launch"] }),
    svc("svc_social", "marketing", "package", "monthly", L("Social media management", "إدارة السوشيال ميديا", "Social-Media-Betreuung", "Gestion des réseaux sociaux", "Gestione social"), { deliveryDays: 30, milestones: ["Plan", "Monthly report"] }),
    svc("svc_support", "it-support", "package", "monthly", L("Software support", "دعم البرمجيات", "Software-Support", "Support logiciel", "Supporto software"), { deliveryDays: 30, milestones: ["Onboarding", "Monthly review"] }),
  ];
  for (const s of db.services.filter((x) => x.kind === "package")) db.plans.push({ id: s.id, tool: null, service: true, perUser: false, minSeats: 1, yearlyDiscountPct: 0, defaultUsd: { [s.billing]: { svc_brand: 900, svc_social: 400, svc_support: 300 }[s.id] } });
  Object.assign(db.grid, {
    "svc_brand:once:gcc": 3300, "svc_brand:once:europe": 820, "svc_brand:once:egypt": 39000,
    "svc_social:monthly:gcc": 1500, "svc_social:monthly:europe": 370, "svc_social:monthly:egypt": 17500,
    "svc_support:monthly:gcc": 1100, "svc_support:monthly:europe": 280, "svc_support:monthly:egypt": 13000,
  });

  // ---- bundles and coupons ----
  db.bundles = [
    { id: "bnd_ops", name: L("Operations bundle", "باقة العمليات", "Operations-Paket", "Pack Opérations", "Pacchetto Operazioni"), planIds: ["tasks_pro", "files_pro", "hr_pro"], pct: 15, active: true },
    { id: "bnd_growth", name: L("Growth bundle", "باقة النمو", "Wachstums-Paket", "Pack Croissance", "Pacchetto Crescita"), planIds: ["crm_pro", "marketing_pro", "chat_pro"], pct: 15, active: true },
  ];
  db.coupons = [
    { code: "LAUNCH20", kind: "percent", value: 20, appliesTo: "all", maxRedemptions: 500, redeemed: 37, validFrom: at(-30), validTo: at(60), active: true, note: "Beta launch discount" },
    { code: "WELCOME100", kind: "fixed", amounts: { SAR: 100, AED: 100, EGP: 1000 }, appliesTo: "all", maxRedemptions: 200, redeemed: 12, validFrom: at(-10), validTo: at(80), active: true, note: "G-06: one amount per currency" },
    { code: "SUMMER10", kind: "percent", value: 10, appliesTo: "chat_pro", maxRedemptions: 100, redeemed: 100, validFrom: at(-120), validTo: at(-30), active: false, note: "Used up" },
  ];

  // ---- tax rules (R03-TAX; G-12 open: whether prices show tax-inclusive is not decided) ----
  db.taxRules = [
    { country: "SA", name: "VAT", rate: 15, inclusive: null, b2bReverseCharge: false, eInvoicing: "ZATCA (Fatoora): QR on simplified invoices; B2B clearance in phase 2", active: true },
    { country: "AE", name: "VAT", rate: 5, inclusive: null, b2bReverseCharge: false, eInvoicing: "OrgTik TRN and customer TRN on tax invoices", active: true },
    { country: "EG", name: "VAT", rate: 14, inclusive: null, b2bReverseCharge: false, eInvoicing: "ETA e-invoice (B2B) / e-receipt (B2C) if registered in Egypt", active: true },
    { country: "DE", name: "MwSt", rate: 19, inclusive: null, b2bReverseCharge: true, eInvoicing: "B2C: customer-country VAT; B2B with a valid VAT ID (VIES): reverse charge", active: true },
    { country: "FR", name: "TVA", rate: 20, inclusive: null, b2bReverseCharge: true, eInvoicing: "As Germany (EU rule)", active: true },
    { country: "IT", name: "IVA", rate: 22, inclusive: null, b2bReverseCharge: true, eInvoicing: "As Germany (EU rule)", active: true },
  ];

  // ---- gateways and routing (R03-PAY, G-11; simulated) ----
  db.gateways = [
    { id: "gw_paymob", name: "Paymob", methods: ["card", "wallet"], countries: ["EG"], currencies: ["EGP"], recurring: true, priority: 1, active: true },
    { id: "gw_fawry", name: "Fawry", methods: ["cash_code"], countries: ["EG"], currencies: ["EGP"], recurring: false, priority: 2, active: true, note: "Cash: renews by a pay link before the renewal date" },
    { id: "gw_moyasar", name: "Moyasar", methods: ["mada", "card", "apple_pay"], countries: ["SA"], currencies: ["SAR"], recurring: true, priority: 1, active: true, note: "mada must be supported" },
    { id: "gw_checkout", name: "Checkout.com", methods: ["card", "apple_pay"], countries: ["AE", "QA", "BH", "OM"], currencies: ["AED", "QAR", "BHD", "OMR"], recurring: true, priority: 1, active: true },
    { id: "gw_knet", name: "KNET", methods: ["knet", "card"], countries: ["KW"], currencies: ["KWD"], recurring: false, priority: 1, active: true, note: "KNET renews by a pay link" },
    { id: "gw_stripe", name: "Stripe", methods: ["card", "apple_pay", "google_pay"], countries: ["*"], currencies: ["EUR", "CHF", "USD"], recurring: true, priority: 9, active: true, note: "Europe and the rest of the world; the fallback" },
  ];

  // ---- templates (ADM-31): the messages the platform sends, in the 5 languages ----
  const T = (key, channel, name, subjectEn) => ({ key, channel, name, subject: L(subjectEn, "", "", "", ""), body: L(`${subjectEn}\n\n{{workspace}} · {{link}}`, "", "", "", ""), variables: ["workspace", "owner", "link"], updatedAt: at(-20), updatedBy: "seed" });
  db.templates = [
    T("trial_ending", "email", "Trial ending", "Your trial ends in {{days}} days"),
    T("payment_failed", "email", "Payment failed", "We couldn't renew your subscription"),
    T("read_only", "email", "Read-only", "Your workspace is read-only"),
    T("invoice_issued", "email", "Invoice issued", "Your invoice {{number}}"),
    T("price_change", "email", "Price change notice", "Your price changes on {{date}}"),
    T("quote_ready", "email", "Quote ready", "Your quote for {{service}} is ready"),
    T("ticket_reply", "in_app", "Ticket reply", "New reply on ticket {{number}}"),
    T("invite", "email", "Team invitation", "You're invited to {{workspace}}"),
  ];
  // Arabic for the ones a customer sees first (MSA, D-015); the others are marked untranslated in ADM-31.
  db.templates[0].subject.ar = "تنتهي فترتك التجريبية خلال {{days}} أيام";
  db.templates[1].subject.ar = "تعذّر تجديد اشتراكك";
  db.templates[3].subject.ar = "فاتورتك رقم {{number}}";

  // ---- settings (ADM-33) and the open gaps as switches ----
  db.settings = {
    retention: { toolDays: 30, workspaceDays: 30, trashDays: 30, backupDays: 30 }, // G-22
    dunning: { graceDays: 7, readOnlyAfterDays: 7, cancelAfterDays: 37 }, // G-15, line "Past due" 7 days
    trial: { remindDaysBefore: [3, 1], onePerToolPerWorkspace: true }, // G-17
    services: { autoApproveDays: 7 }, // G-30
    limits: { warnAtPct: [80, 100] }, // G-19
    priceChange: { noticeDays: 30 }, // G-02
    cardCountryReviewAbove: { USD: 1000 }, // R03-X7
    switches: {
      seatModel: { value: "A", decided: false, gap: "G-04", options: ["A", "B"], note: "A: one workspace seat count on every per-user line (as the files). B: each per-user tool bills only the users with access." },
      taxDisplay: { value: null, decided: false, gap: "G-12", options: ["inclusive", "exclusive"], note: "Prices shown with or without tax; e-invoicing depends on OrgTik's legal entities." },
      addOns: { value: false, decided: false, gap: "G-18", options: [true, false], note: "Add-ons and overage (storage, mailboxes, SMS/WhatsApp credits)." },
      generalPaid: { value: null, decided: false, gap: "G-21", options: ["more users, custom roles, 2FA enforcement, longer audit log"], note: "What General's paid plans unlock." },
      hostingOps: { value: "out_of_scope", decided: false, gap: "G-24", options: ["out_of_scope"], note: "Hosting and email infrastructure need their own ops spec." },
      mailboxes: { value: "email_tool", decided: false, gap: "G-28", options: ["email_tool", "hosting"], note: "Recommended: the Email tool owns all mailboxes; Hosting links to it." },
    },
    company: { legalName: "OrgTik", supportEmail: "support@orgtik.test", defaultLocale: "en" },
  };

  // ---- staff roles (editable in ADM-30) ----
  db.staffRoles = clone(require("./permissions").GRANTS);

  // ---- customers ----
  const userKey = (k) => k;
  const member = (key, role, tools = null) => ({ userKey: key, role, status: "active", tools, joinedAt: at(-200) });
  const resolve = (planId, country, cycle = "monthly", seats = 1) => pricing.resolveLine({ ...db }, { planId, cycle, country, seats });
  const line = (ws, planId, state, o = {}) => {
    const plan = db.plans.find((p) => p.id === planId);
    const cycle = o.cycle ?? "monthly";
    const priced = resolve(planId, ws.country, cycle, ws.members.filter((m) => m.role !== "guest" && m.status === "active").length);
    return {
      id: id("ln"), tool: plan.tool, planId, cycle, state,
      snapshot: { amount: priced?.amount ?? 0, unit: priced?.unit ?? 0, quantity: priced?.quantity ?? 1, currency: priced?.currency ?? ws.currency, source: priced?.source ?? "Default", priceVersion: db.priceVersion },
      startedAt: at(-120), periodEnd: at(18), ...o,
    };
  };
  const workspace = (o) => ({ id: o.id, name: o.name, slug: o.slug, country: o.country, currency: o.currency, currencyLocked: o.currencyLocked ?? true, zone: pricing.zoneOf(db, o.country)?.id, state: o.state ?? "active", createdAt: o.createdAt ?? at(-300), members: o.members, lines: [], paymentMethods: o.paymentMethods ?? [], billing: o.billing, notes: [], flags: o.flags ?? {} });

  const people = identity.users ?? [];
  const orgtik = workspace({
    id: "ws_orgtik", name: "OrgTik Egypt", slug: "orgtik-egypt", country: "EG", currency: "EGP",
    members: people.filter((p) => p.key !== "customer").map((p) => member(p.key, p.key === "admin" ? "owner" : p.key === "manager" ? "admin" : "member")),
    paymentMethods: [{ id: "pm_1", kind: "card", brand: "Visa", last4: "4242", expires: "08/28", country: "EG", gateway: "gw_paymob", isDefault: true }],
    billing: { legalName: "OrgTik Egypt LLC", email: "billing@orgtik.test", address: "Nasr City, Cairo", taxId: "EG-312-445-110", country: "EG" },
  });
  orgtik.members.push({ userKey: null, email: "auditor@kpmg.test", name: "External auditor", role: "guest", status: "active", tools: ["files"], joinedAt: at(-40) });
  orgtik.lines = [
    line(orgtik, "general_free", "free"),
    line(orgtik, "tasks_pro", "active"),
    line(orgtik, "files_pro", "active"),
    line(orgtik, "hr_pro", "active", { cycle: "yearly", periodEnd: at(140) }),
    line(orgtik, "crm_pro", "active"),
    line(orgtik, "marketing_pro", "active", { scheduled: { kind: "price_change", from: null, effectiveAt: at(25), note: "New price from the next renewal (30-day notice)" } }),
    line(orgtik, "chat_pro", "trialing", { trialEndsAt: at(9), periodEnd: at(9) }),
  ];

  const nile = workspace({
    id: "ws_nile", name: "Nile Foods", slug: "nile-foods", country: "EG", currency: "EGP",
    members: [member("customer", "owner"), { userKey: null, email: "ahmed@nilefoods.test", name: "Ahmed Saber", role: "admin", status: "active", tools: null, joinedAt: at(-90) }, { userKey: null, email: "mai@nilefoods.test", name: "Mai Fouad", role: "member", status: "invited", tools: ["tasks"], joinedAt: null }],
    paymentMethods: [{ id: "pm_2", kind: "card", brand: "Mastercard", last4: "0005", expires: "01/27", country: "EG", gateway: "gw_paymob", isDefault: true }],
    billing: { legalName: "Nile Foods S.A.E.", email: "finance@nilefoods.test", address: "6th of October City, Giza", taxId: "", country: "EG" },
  });
  nile.lines = [
    line(nile, "general_free", "free"),
    line(nile, "tasks_free", "free"),
    line(nile, "chat_starter", "trialing", { trialEndsAt: at(2), periodEnd: at(2) }),
    line(nile, "files_pro", "past_due", { graceEndsAt: at(4), periodEnd: at(-3), lastFailure: { at: at(-3), reason: "card_declined" } }),
  ];

  const gulf = workspace({
    id: "ws_gulf", name: "Gulf Retail", slug: "gulf-retail", country: "AE", currency: "AED",
    members: [{ userKey: null, email: "owner@gulfretail.test", name: "Khalid Al Mansoori", role: "owner", status: "active", tools: null, joinedAt: at(-150) }, ...["sara", "omar", "lina", "faisal", "noor"].map((n) => ({ userKey: null, email: `${n}@gulfretail.test`, name: n[0].toUpperCase() + n.slice(1), role: "member", status: "active", tools: null, joinedAt: at(-100) }))],
    paymentMethods: [{ id: "pm_3", kind: "card", brand: "Visa", last4: "1881", expires: "11/27", country: "AE", gateway: "gw_checkout", isDefault: true }],
    billing: { legalName: "Gulf Retail Trading LLC", email: "accounts@gulfretail.test", address: "Business Bay, Dubai", taxId: "TRN 100123456700003", country: "AE" },
  });
  gulf.lines = [line(gulf, "general_free", "free"), line(gulf, "chat_pro", "active"), line(gulf, "tasks_pro", "active"), line(gulf, "crm_pro", "cancelling", { cancelAt: at(12) })];

  const spree = workspace({
    id: "ws_spree", name: "Spree Studio", slug: "spree-studio", country: "DE", currency: "EUR", state: "past_due",
    members: [{ userKey: null, email: "anna@spree.test", name: "Anna Weber", role: "owner", status: "active", tools: null, joinedAt: at(-250) }, { userKey: null, email: "jonas@spree.test", name: "Jonas Klein", role: "member", status: "active", tools: null, joinedAt: at(-200) }],
    paymentMethods: [{ id: "pm_4", kind: "card", brand: "Visa", last4: "3184", expires: "05/26", country: "DE", gateway: "gw_stripe", isDefault: true, expired: true }],
    billing: { legalName: "Spree Studio GmbH", email: "anna@spree.test", address: "Kreuzberg, Berlin", taxId: "DE811907980", country: "DE" },
  });
  spree.lines = [line(spree, "general_free", "free"), line(spree, "tasks_pro", "read_only", { readOnlySince: at(-2), periodEnd: at(-16), lastFailure: { at: at(-16), reason: "card_expired" } }), line(spree, "files_pro", "ended", { endedAt: at(-10) })];

  const desert = workspace({
    id: "ws_desert", name: "Desert Logistics", slug: "desert-logistics", country: "KW", currency: "KWD", state: "suspended", flags: { suspendedReason: "Payment fraud review" },
    members: [{ userKey: null, email: "ops@desertlog.test", name: "Yousef Al Sabah", role: "owner", status: "active", tools: null, joinedAt: at(-60) }],
    billing: { legalName: "Desert Logistics Co.", email: "ops@desertlog.test", address: "Kuwait City", taxId: "", country: "KW" },
  });
  desert.lines = [line(desert, "general_free", "free"), line(desert, "chat_pro", "active")];

  const quill = workspace({
    id: "ws_quill", name: "Quill & Co", slug: "quill-co", country: "SA", currency: "SAR", currencyLocked: false,
    members: [{ userKey: null, email: "hello@quill.test", name: "Reem Al Qahtani", role: "owner", status: "active", tools: null, joinedAt: at(-5) }],
    billing: { legalName: "", email: "hello@quill.test", address: "", taxId: "", country: "SA" },
  });
  quill.lines = [line(quill, "general_free", "free"), line(quill, "tasks_free", "free"), line(quill, "chat_pro", "trialing", { trialEndsAt: at(11), periodEnd: at(11) })];
  db.workspaces = [orgtik, nile, gulf, spree, desert, quill];

  // A currency migration waiting (R03-C4, ADM-21): Gulf Retail asked to bill from Saudi Arabia.
  db.migrations = [{ id: "mig_1", workspaceId: "ws_gulf", from: { country: "AE", currency: "AED" }, to: { country: "SA", currency: "SAR" }, requestedAt: at(-3), effectiveAt: gulf.lines[1].periodEnd, state: "queued", requestedBy: "support", reason: "Company moved its billing entity to Riyadh" }];

  // ---- invoices and payments (state table "Invoice", R03-R1) ----
  let invNo = 1040;
  const usdRate = (cur) => (cur === "USD" ? 1 : pricing.rate(db, "USD", cur) ?? 1);
  const invoice = (ws, state, lineItems, o = {}) => {
    const cur = ws.currency, dec = db.currencies[cur]?.decimals ?? 2;
    const rule = db.taxRules.find((t) => t.country === ws.country && t.active);
    const subtotal = pricing.toDecimals(lineItems.reduce((s, l) => s + l.amount, 0), dec);
    const tax = rule ? pricing.toDecimals(subtotal * rule.rate / 100, dec) : 0;
    const inv = { id: id("inv"), number: `INV-2026-${String(++invNo).padStart(6, "0")}`, workspaceId: ws.id, kind: o.kind ?? "subscription", state, currency: cur, issuedAt: "issuedAt" in o ? o.issuedAt : at(-12), dueAt: "dueAt" in o ? o.dueAt : at(2), lines: lineItems, subtotal, taxLabel: rule ? `${rule.name} ${rule.rate}%` : null, tax, total: pricing.toDecimals(subtotal + tax, dec), payments: [], creditNotes: [], refunded: 0 };
    if (state === "paid" || state === "partially_refunded" || state === "refunded") {
      const r = usdRate(cur);
      inv.paidAt = o.paidAt ?? at(-11);
      inv.payments.push({ id: id("pay"), amount: inv.total, currency: cur, method: ws.paymentMethods[0]?.kind ?? "card", gateway: ws.paymentMethods[0]?.gateway ?? "gw_stripe", at: inv.paidAt, status: "succeeded", usdRate: r, usdAmount: pricing.toDecimals(inv.total / r, 2) });
    }
    if (state === "past_due") inv.payments.push({ id: id("pay"), amount: inv.total, currency: cur, method: "card", gateway: ws.paymentMethods[0]?.gateway, at: o.failedAt ?? at(-3), status: "failed", reason: o.reason ?? "card_declined" });
    return inv;
  };
  const items = (ws, ln) => ln.filter((l) => l.snapshot.amount > 0).map((l) => ({ label: `${db.tools.find((t) => t.key === l.tool)?.name.en ?? l.tool} · ${db.plans.find((p) => p.id === l.planId)?.name?.en ?? ""}${l.snapshot.quantity > 1 ? ` × ${l.snapshot.quantity}` : ""}`, amount: l.snapshot.amount, lineId: l.id }));
  for (let m = 3; m >= 1; m--) db.invoices.push(invoice(orgtik, "paid", items(orgtik, orgtik.lines.filter((l) => l.state === "active" && l.cycle === "monthly")), { issuedAt: at(-30 * m), paidAt: at(-30 * m + 1), dueAt: at(-30 * m + 7) }));
  db.invoices.push(invoice(orgtik, "open", items(orgtik, orgtik.lines.filter((l) => l.state === "active" && l.cycle === "monthly")), { issuedAt: at(-1), dueAt: at(6) }));
  db.invoices.push(invoice(nile, "past_due", items(nile, nile.lines.filter((l) => l.planId === "files_pro")), { issuedAt: at(-4), dueAt: at(-3), failedAt: at(-3) }));
  const gulfPaid = invoice(gulf, "partially_refunded", items(gulf, gulf.lines.filter((l) => l.state !== "free")), { issuedAt: at(-40), paidAt: at(-39) });
  gulfPaid.creditNotes.push({ id: id("cn"), number: "CN-2026-000014", amount: 30, reason: "Duplicate seat charged in September", at: at(-30), by: "finance" });
  gulfPaid.refunded = 30;
  db.invoices.push(gulfPaid);
  db.invoices.push(invoice(spree, "past_due", items(spree, spree.lines.filter((l) => l.planId === "tasks_pro")), { issuedAt: at(-17), dueAt: at(-16), failedAt: at(-16), reason: "card_expired" }));
  db.invoices.push({ ...invoice(desert, "void", items(desert, desert.lines.filter((l) => l.state === "active"))), voidedAt: at(-5), voidReason: "Suspended for review" });
  db.invoices.push(invoice(gulf, "draft", [{ label: "Onboarding workshop (manual)", amount: 1500 }], { kind: "manual", issuedAt: null, dueAt: null }));

  // ---- custom plan requests (ADM-22) ----
  db.customPlanRequests = [
    { id: "cpr_1", workspaceId: "ws_gulf", tools: ["crm", "marketing", "chat"], seats: 60, cycle: "yearly", notes: "Retail chain with 12 branches; wants one annual contract.", state: "new", createdAt: at(-2) },
    { id: "cpr_2", workspaceId: "ws_orgtik", tools: ["hr"], seats: 120, cycle: "yearly", notes: "Payroll for two entities.", state: "quoted", createdAt: at(-14), quote: { amount: 21000, currency: "EGP", validUntil: at(16) } },
  ];

  // ---- service requests (state table "Service request") ----
  let srNo = 210;
  const sr = (ws, serviceId, state, o = {}) => ({ id: id("sr"), number: `SR-${++srNo}`, workspaceId: ws.id, serviceId, title: o.title, brief: o.brief ?? "", state, createdAt: o.createdAt ?? at(-10), assignee: o.assignee ?? null, quote: o.quote ?? null, milestones: o.milestones ?? [], deliveries: o.deliveries ?? [], messages: o.messages ?? [], budget: o.budget ?? null, deadline: o.deadline ?? null });
  db.serviceRequests = [
    sr(nile, "svc_website", "new", { title: "New website for Nile Foods", brief: "Bilingual (Arabic/English) website with a product catalogue and a store locator.", budget: "60,000–90,000 EGP", deadline: at(60), createdAt: at(-1) }),
    sr(gulf, "svc_brand", "quoted", { title: "Refresh of the Gulf Retail brand", brief: "Logo refinement and store signage system.", assignee: "u15", quote: { currency: "AED", lines: [{ label: "Brand identity package", amount: 3234 }, { label: "Subscriber discount 10%", amount: -323.4 }], total: 2910.6, validUntil: at(10), sentAt: at(-2) } }),
    sr(orgtik, "svc_social", "in_progress", { title: "Social media for the HR launch", assignee: "u8", milestones: [{ title: "Plan", state: "done", due: at(-5) }, { title: "Monthly report", state: "open", due: at(20) }], messages: [{ by: "staff", author: "u8", at: at(-4), text: "The content calendar for October is in the project files." }] }),
    sr(gulf, "svc_support", "in_review", { title: "Software support onboarding", assignee: "u7", milestones: [{ title: "Onboarding", state: "delivered", due: at(-1) }], deliveries: [{ id: "dl_1", at: at(-1), note: "Runbook and access checklist delivered.", files: ["onboarding-runbook.pdf"], autoApproveAt: at(6) }] }),
    sr(spree, "svc_brand", "on_hold", { title: "Packaging design", assignee: "u8", messages: [{ by: "staff", author: "u15", at: at(-6), text: "Waiting for the product photos and the first payment." }] }),
    sr(orgtik, "svc_brand", "completed", { title: "OrgTik suite icons", assignee: "u8", createdAt: at(-60), milestones: [{ title: "Final files", state: "done", due: at(-20) }] }),
  ];

  // ---- support tickets (state table "Support ticket") ----
  let tkNo = 3300;
  const tk = (ws, by, subject, state, o = {}) => ({ autoCloseAt: o.autoCloseAt ?? null, resolvedAt: o.resolvedAt ?? null, reopenUntil: o.reopenUntil ?? null, id: id("tk"), number: `TK-${++tkNo}`, workspaceId: ws.id, openedBy: by, subject, category: o.category ?? "billing", priority: o.priority ?? "normal", state, assignee: o.assignee ?? null, createdAt: o.createdAt ?? at(-3), updatedAt: o.updatedAt ?? at(-1), messages: o.messages ?? [{ by: "customer", author: by, at: at(-3), text: subject }] });
  db.tickets = [
    tk(nile, "customer", "My card was declined but the bank says it's fine", "open", { priority: "high" }),
    tk(orgtik, "admin", "Can we get HR payroll for a second entity?", "in_progress", { category: "sales", assignee: "sales", messages: [{ by: "customer", author: "admin", at: at(-5), text: "We are opening a second legal entity next month." }, { by: "staff", author: "sales", at: at(-4), text: "Yes: a custom plan request is open (cpr_2). I'll send the quote this week." }] }),
    tk(gulf, "owner@gulfretail.test", "Invoice needs our TRN on it", "waiting_for_you", { assignee: "u10", messages: [{ by: "customer", author: "owner@gulfretail.test", at: at(-6), text: "Please add our TRN." }, { by: "staff", author: "u10", at: at(-5), text: "Could you confirm the TRN in Billing details? Then we reissue the invoice." }], autoCloseAt: at(2) }),
    tk(spree, "anna@spree.test", "How do we export our tasks?", "resolved", { category: "product", assignee: "u11", resolvedAt: at(-2), reopenUntil: at(5) }),
    tk(orgtik, "u14", "Dark mode in Files", "closed", { category: "product", assignee: "u11", createdAt: at(-30) }),
  ];

  // ---- notifications for the customer (USR-24) ----
  db.notifications = [
    { id: id("nt"), workspaceId: "ws_nile", userKey: "customer", kind: "trial_ending", title: "Chat trial ends in 2 days", at: at(-0.2), read: false },
    { id: id("nt"), workspaceId: "ws_nile", userKey: "customer", kind: "payment_failed", title: "Files renewal failed: card declined", at: at(-3), read: false },
    { id: id("nt"), workspaceId: "ws_orgtik", userKey: "admin", kind: "price_change", title: "Marketing's price changes at your next renewal", at: at(-5), read: true },
    { id: id("nt"), workspaceId: "ws_orgtik", userKey: "admin", kind: "service_update", title: "SR-213: the October content calendar is ready", at: at(-4), read: false },
  ];

  db.pricingLog = [
    { id: id("pl"), at: at(-40), by: "admin", action: "publish", summary: "Chat Pro GCC 40 → 45 SAR, new customers only", priceVersion: 1, applyMode: "new_only", reason: "Beta to launch" },
    { id: id("pl"), at: at(-5), by: "finance", action: "schedule", summary: "Marketing Pro, existing customers at next renewal (30-day notice)", priceVersion: 1, applyMode: "existing_next_renewal", reason: "Ads module included" },
  ];
  db.audit = [{ at: at(-1), by: "u10", action: "view_as", target: "ws_gulf", reason: "Ticket TK-3303: check what the owner sees on the invoice" }];

  const S = {
    db, id, iso, at, now, usdRate, pricing,
    tables: () => db,
    workspace: (wid) => db.workspaces.find((w) => w.id === wid),
    workspaceOfUser: (key) => db.workspaces.find((w) => w.members.some((m) => m.userKey === key && m.status === "active")),
    seats: (ws) => ws.members.filter((m) => m.role !== "guest" && m.status === "active").length,
    log: (by, action, target, extra = {}) => db.audit.unshift({ at: iso(now()), by, action, target, ...extra }),
    resolve: (planId, country, cycle, seats) => pricing.resolveLine(db, { planId, cycle, country, seats }),
    // A customer who signs up on the website: their own workspace on the free General plan.
    createWorkspace: ({ wsId, ownerKey, name, email, country = "CH", currency = "CHF", createdAt }) => {
      const slug = `${String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workspace"}-${seq + 1}`;
      const joinedAt = createdAt ?? iso(now());
      const ws = workspace({ id: wsId ?? id("ws"), name, slug, country, currency, createdAt: joinedAt, members: [{ userKey: ownerKey, role: "owner", status: "active", tools: null, joinedAt }], billing: { legalName: name, email, address: "", taxId: "", country } });
      ws.lines = [line(ws, "general_free", "free", { startedAt: joinedAt })];
      db.workspaces.push(ws);
      return ws;
    },
  };
  return S;
}

module.exports = { makeStore, L };
