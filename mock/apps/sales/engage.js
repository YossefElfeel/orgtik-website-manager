// Engagement: notifications (+ preferences), activity feed, tickets, dashboards, currency & VAT catalogs,
// sales-port auth helpers. Contract of notifications/activity feed follows spec/notifications-api.md.
const H = require("./lib");
const { CURRENCIES, RATES_AS_OF, VAT_COUNTRIES } = require("./reference");

const CATEGORY_TABS = [
  ["all", "All"], ["subscriptions", "Subscriptions"], ["projects", "Projects"], ["customers", "Customers"], ["invoices", "Invoices"],
  ["commissions", "Commissions"], ["salesman", "Salesman"], ["tickets", "Tickets"], ["offers", "Offers"],
];
function categoryOf(type) {
  const p = String(type).split(".")[0];
  if (p === "project" || p === "contract") return "projects";
  if (p === "invoice" || p === "custom_invoice" || p === "payment") return "invoices";
  if (p === "wallet") return "commissions";
  if (p === "customer" || p === "coupon" || p === "loyalty") return "customers";
  if (p === "subscription") return "subscriptions";
  if (p === "ticket") return "tickets";
  if (p === "offer") return "offers";
  if (p === "salesman") return "salesman";
  return "projects";
}
const ICONS = { projects: "folder", invoices: "file-text", commissions: "wallet", customers: "users", subscriptions: "refresh-cw", tickets: "life-buoy", offers: "tag", salesman: "user-check" };
function toneOf(n) {
  if (/(paid|approved|accepted|received|confirmed|resumed|renewed)$/.test(n.type)) return "success";
  if (n.priority === "critical") return "danger";
  if (n.priority === "high") return /(overdue|rejected|cancelled)$/.test(n.type) ? "danger" : "warning";
  return n.priority === "low" ? "neutral" : "info";
}
const TARGET_KEYS = [["invoiceId", "invoice"], ["subscriptionId", "subscription"], ["commissionId", "commission"], ["ticketId", "ticket"], ["offerId", "offer"], ["projectId", "project"], ["contractId", "contract"], ["customerId", "customer"], ["salesmanId", "salesman"], ["couponId", "coupon"]];

module.exports = function engage(S) {
  const { db, util, identity } = S;
  const { ok, fail } = util;
  const C = S.catalog;
  const K = S.core;
  const D = () => S.deals;
  const B = () => S.billing;
  const nowIso = () => new Date().toISOString();

  // ------------------------------------------------------------------ notifications
  const isRead = (n) => n.status === "read";
  const live = (n) => !n.expiresAt || new Date(n.expiresAt).getTime() > Date.now();
  const mine = (req) => db.notifications.filter((n) => n.userId === req.sc.user.id && live(n));
  const notificationOut = (n) => ({ id: n.id, userId: n.userId, userType: n.userType, type: n.type, priority: n.priority, title: n.title, message: n.message, data: n.data, channels: n.channels, status: n.status, isRead: isRead(n), readAt: n.readAt, expiresAt: n.expiresAt, createdAt: n.createdAt, updatedAt: n.updatedAt });
  function contextLabel(n) {
    const d = n.data || {};
    if (d.invoiceNumber || d.invoiceId) return `Invoice ${d.invoiceNumber || d.invoiceId}`;
    if (d.projectName) return `Project · ${d.projectName}`;
    if (d.commissionId) return "Commission";
    if (d.subscriptionId) return "Subscription";
    if (d.ticketId) return d.subject ? `Ticket · ${d.subject}` : "Ticket";
    if (d.offerId) return "Offer";
    if (d.customerId) return "Customer";
    if (d.salesmanId) return "Salesman";
    return "Notification";
  }
  function feedItem(n) {
    const category = categoryOf(n.type);
    const d = n.data || {};
    const tk = TARGET_KEYS.find(([k]) => d[k]);
    return { id: n.id, category, type: n.type, priority: n.priority, icon: ICONS[category] || "bell", tone: toneOf(n), title: n.title, message: n.message, contextLabel: contextLabel(n), isRead: isRead(n), occurredAt: n.createdAt, target: tk ? { resource: tk[1], id: String(d[tk[0]]) } : { resource: "none", id: "" } };
  }
  function markRead(n) {
    if (isRead(n)) return;
    const ts = nowIso();
    Object.assign(n, { status: "read", readAt: ts, updatedAt: ts });
  }

  // ------------------------------------------------------------------ tickets
  const ticketById = (id) => db.tickets.find((t) => t.id === id);
  const canSeeTicket = (req, t) => {
    const customer = K.customerById(t.customerId);
    return req.sc.role === "customer" ? Boolean(req.sc.customer && t.customerId === req.sc.customer.id) : req.sc.role === "salesman" ? t.assigneeId === req.sc.user.id || Boolean(customer && (customer.ownerUserId === req.sc.user.id || req.sc.staff && customer.assignedSalesmanId === req.sc.staff.id)) : true;
  };
  function ticketOut(t) {
    const c = K.customerById(t.customerId);
    const a = t.assigneeId && identity.findUser(t.assigneeId);
    return { id: t.id, subject: t.subject, customerName: c ? `${c.fullName} (${c.companyName})` : "—", status: t.status, priority: t.priority, assigneeName: a ? identity.fullName(a) : null, createdAt: t.createdAt, updatedAt: t.updatedAt };
  }
  function ticketDetail(t) {
    const c = K.customerById(t.customerId);
    const a = t.assigneeId && identity.findUser(t.assigneeId);
    return {
      id: t.id, subject: t.subject, note: t.note,
      customer: c ? { id: c.id, name: `${c.fullName} – ${c.companyName}`, email: c.email, phone: c.phoneNumber, address: c.address } : { id: "", name: "", email: "", phone: "", address: "" },
      status: t.status, priority: t.priority, assigneeId: t.assigneeId || null, assigneeName: a ? identity.fullName(a) : null, createdAt: t.createdAt, updatedAt: t.updatedAt,
    };
  }
  const noteOut = (req, n) => ({ id: n.id, authorName: n.authorName, note: n.note, createdAt: n.createdAt, updatedAt: n.updatedAt, fileUrl: n.fileUrl || null, isMe: n.authorId === req.sc.user.id });

  // ------------------------------------------------------------------ dashboards
  function scopeFor(req, forSalesman) {
    const sc = req.sc;
    let projects = db.projects;
    let customers = db.customers;
    let share = { default: 1 };
    if (forSalesman) {
      projects = projects.filter((p) => p.assignedSalesmanId === forSalesman.id);
      customers = customers.filter((c) => c.assignedSalesmanId === forSalesman.id);
      share = { default: 0, [forSalesman.zoneId]: 0.22 };
    } else if (sc.role === "salesman") {
      projects = projects.filter((p) => p.ownerUserId === sc.user.id || Boolean(sc.staff && p.assignedSalesmanId === sc.staff.id));
      customers = customers.filter((c) => c.ownerUserId === sc.user.id || Boolean(sc.staff && c.assignedSalesmanId === sc.staff.id));
      share = { default: 0, [sc.staff?.zoneId]: 0.22 };
    } else if (sc.role === "manager") {
      const depts = db.departments.filter((d) => d.managerId === sc.user.id).map((d) => d.id);
      if (depts.length) {
        projects = projects.filter((p) => depts.includes(p.departmentId));
        const ids = new Set(projects.map((p) => p.customerId));
        customers = customers.filter((c) => ids.has(c.id) || !c.assignedSalesmanId);
        share = { default: 0.45 };
      }
    }
    const pids = new Set(projects.map((p) => p.id));
    const contracts = db.contracts.filter((c) => pids.has(c.projectId));
    const commissions = db.commissions.filter((c) => pids.has(c.projectId));
    const subs = db.subscriptions.filter((s) => pids.has(s.projectId));
    const invoices = db.invoices.filter((i) => i.kind === "subscription" && pids.has(i.projectId));
    return { projects, customers, contracts, commissions, subs, invoices, share };
  }
  const thisMonth = () => H.monthKey(new Date());
  const lastMonth = () => H.monthKey(H.addMonths(new Date(), -1));
  function countMetric(rows, dateOf) {
    const cur = rows.filter((r) => H.monthKey(dateOf(r)) === thisMonth()).length;
    const prev = rows.filter((r) => H.monthKey(dateOf(r)) === lastMonth()).length;
    return { total: rows.length, currentPeriod: cur, previousPeriod: prev, growthPercent: H.growth(cur, prev), comparisonPeriod: "month" };
  }
  const shareFor = (share, zoneId) => (share[zoneId] != null ? share[zoneId] : share.default);
  // 12 months of sales per zone: approved contract totals + seeded historical baseline (older, not individually seeded deals).
  function salesSeries(scope) {
    const months = [];
    for (let i = 11; i >= 0; i--) months.push(H.monthKey(H.addMonths(new Date(), -i)));
    const approved = scope.contracts.filter((c) => c.status === "approved");
    return db.zones.map((z) => {
      const f = shareFor(scope.share, z.id);
      const points = months.map((m) => {
        const real = approved.filter((c) => c.zoneId === z.id && H.monthKey(c.approvedAt || c.createdAt) === m).reduce((s, c) => s + H.num(c.grandTotal), 0);
        const base = (db.salesHistory[z.id]?.[m] || 0) * f;
        return { month: `${H.MONTHS[Number(m.slice(5)) - 1]} ${m.slice(2, 4)}`, key: m, amount: H.round(real + base, z.currencyCode) };
      });
      return { zoneId: z.id, zoneName: z.name, currencyCode: z.currencyCode, points };
    }).filter((s) => s.points.some((p) => p.amount > 0));
  }
  function zoneGrowth(series, allTimeExtra = {}) {
    return series.map((s) => {
      const cur = s.points[11]?.amount || 0;
      const prev = s.points[10]?.amount || 0;
      return { zoneId: s.zoneId, zoneName: s.zoneName, currencyCode: s.currencyCode, total: H.round(s.points.reduce((a, p) => a + p.amount, 0) + (allTimeExtra[s.zoneId] || 0), s.currencyCode), currentPeriod: cur, previousPeriod: prev, growthPercent: H.growth(cur, prev), comparisonPeriod: "month" };
    });
  }
  function commissionGrowth(scope) {
    return db.zones.map((z) => {
      const rows = scope.commissions.filter((c) => c.zoneId === z.id);
      if (!rows.length) return null;
      const cur = rows.filter((c) => H.monthKey(c.earnedAt) === thisMonth()).reduce((s, c) => s + H.num(c.amount), 0);
      const prev = rows.filter((c) => H.monthKey(c.earnedAt) === lastMonth()).reduce((s, c) => s + H.num(c.amount), 0);
      return { zoneId: z.id, zoneName: z.name, currencyCode: z.currencyCode, total: H.round(rows.reduce((s, c) => s + H.num(c.amount), 0), z.currencyCode), currentPeriod: H.round(cur, z.currencyCode), previousPeriod: H.round(prev, z.currencyCode), growthPercent: H.growth(cur, prev), comparisonPeriod: "month" };
    }).filter(Boolean);
  }
  function topPlans(req, scope) {
    const approved = scope.contracts.filter((c) => c.status === "approved");
    return db.zones.map((z) => {
      const map = new Map();
      for (const c of approved.filter((x) => x.zoneId === z.id)) {
        for (const l of c.plans) {
          const key = l.planId || "custom";
          const g = map.get(key) || { planId: l.planId || "custom", name: l.planId ? H.text(C.planById(l.planId)?.name || l.name, req.sc.lang) : "Custom plans", revenue: 0, salesCount: 0 };
          g.revenue += H.num(l.price);
          g.salesCount += 1;
          map.set(key, g);
        }
      }
      const rows = [...map.values()].sort((a, b) => b.revenue - a.revenue);
      const total = rows.reduce((s, r) => s + r.revenue, 0) || 1;
      if (!rows.length) return null;
      return { zoneId: z.id, zoneName: z.name, currencyCode: z.currencyCode, plans: rows.slice(0, 5).map((r, i) => ({ rank: i + 1, planId: r.planId, name: r.name, revenue: H.round(r.revenue, z.currencyCode), salesCount: r.salesCount, percentage: H.pct((r.revenue / total) * 100) })) };
    }).filter(Boolean);
  }
  function breakdown(rows, statuses, statusOf) {
    const total = rows.length || 1;
    return statuses.map((s) => {
      const count = rows.filter((r) => statusOf(r) === s).length;
      return { status: s, count, percentage: H.pct((count / total) * 100) };
    });
  }
  function customerStatus(customers) {
    // D-028: every stage of the one lead pipeline.
    const q = customers.filter((c) => ["qualified", "quoted", "won"].includes(c.status)).length;
    const u = customers.filter((c) => ["unqualified", "lost", "spam", "duplicate"].includes(c.status)).length;
    return { qualifiedCustomers: q, unqualifiedCustomers: u, qualifiedPercentage: q + u ? H.pct((q / (q + u)) * 100) : 0, breakdown: breakdown(customers, ["new", "contacted", "qualified", "quoted", "won", "lost", "unqualified", "spam", "duplicate"], (c) => c.status) };
  }
  function staffDashboard(req) {
    B().refreshSchedules();
    const scope = scopeFor(req);
    const series = salesSeries(scope);
    const sales = zoneGrowth(series);
    const commission = commissionGrowth(scope);
    const netProfit = sales.map((s) => {
      const c = commission.find((x) => x.zoneId === s.zoneId);
      return { ...s, total: H.round(s.total - (c?.total || 0), s.currencyCode), currentPeriod: H.round(s.currentPeriod - (c?.currentPeriod || 0), s.currencyCode), previousPeriod: H.round(s.previousPeriod - (c?.previousPeriod || 0), s.currencyCode), growthPercent: H.growth(s.currentPeriod - (c?.currentPeriod || 0), s.previousPeriod - (c?.previousPeriod || 0)) };
    });
    const lines = scope.contracts.filter((c) => c.status === "approved").flatMap((c) => c.plans.map((l) => ({ at: c.approvedAt || c.createdAt })));
    const planSalesBase = req.sc.role === "salesman" ? 6 : req.sc.role === "manager" ? 18 : 41;
    const pendingCommissions = scope.commissions.filter((c) => B().payoutStatus(c) !== "paid");
    const overdue = db.invoices.filter((i) => i.kind === "subscription" && scope.invoices.includes(i) && B().invoiceStatus(i) === "overdue");
    const salesmen = K.salesmen();
    return {
      userType: req.sc.role,
      period: { month: thisMonth(), start: H.iso(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)), end: nowIso() },
      totalProjects: countMetric(scope.projects, (p) => p.createdAt),
      totalSales: sales,
      totalPlanSales: (() => { const m = countMetric(lines, (l) => l.at); return { ...m, total: m.total + planSalesBase }; })(),
      netProfit,
      projectStageBreakdown: breakdown(scope.projects, ["pending", "confirmed", "approved", "in_progress", "testing", "completed", "rejected"], (p) => (p.status === "inProgress" ? "in_progress" : p.status)),
      topPlans: topPlans(req, scope),
      salesTrend: {
        from: H.iso(H.addMonths(new Date(), -11)), to: nowIso(),
        // Points keep their month key (YYYY-MM), so the app labels months in the reader's language.
        series,
        growth: series.map((s) => {
          const cur6 = s.points.slice(6).reduce((a, p) => a + p.amount, 0);
          const prev6 = s.points.slice(0, 6).reduce((a, p) => a + p.amount, 0);
          return { zoneId: s.zoneId, zoneName: s.zoneName, currencyCode: s.currencyCode, currentSixMonthsAmount: H.round(cur6, s.currencyCode), previousSixMonthsAmount: H.round(prev6, s.currencyCode), growthPercent: H.growth(cur6, prev6) };
        }),
      },
      totalSalesmen: countMetric(salesmen, (s) => s.createdAt),
      totalCustomers: countMetric(scope.customers, (c) => c.createdAt),
      totalCommission: commission,
      customerStatus: customerStatus(scope.customers),
      needAttention: {
        commissionsReadyToPay: { count: pendingCommissions.length, totalAmount: B().zoneGroups(pendingCommissions.map((c) => ({ zoneId: c.zoneId, currencyCode: c.currency, v: H.num(c.amount) - H.num(c.paidAmount) })), (r) => r.v) },
        overdueInvoices: { count: overdue.length, totalAmount: B().zoneGroups(overdue.map((i) => ({ zoneId: B().subById(i.subscriptionId)?.zoneId, currencyCode: i.currencyCode, v: H.num(i.totalAmount) - H.num(i.paidAmount) })), (r) => r.v) },
      },
      user: { fullName: K.userName(req.sc.user) },
    };
  }
  function customerDashboard(req) {
    B().refreshSchedules();
    const c = req.sc.customer;
    const projects = db.projects.filter((p) => p.customerId === c.id);
    const subs = db.subscriptions.filter((s) => s.customerId === c.id);
    const invoices = db.invoices.filter((i) => i.customerId === c.id && (i.kind === "subscription" || i.kind === "custom"));
    const open = invoices.filter((i) => ["pending", "partial", "overdue"].includes(B().invoiceStatus(i)));
    const zoneOf = (i) => (i.subscriptionId ? B().subById(i.subscriptionId)?.zoneId : C.zoneForCountry(c.countryCode)?.id);
    const contracts = db.contracts.filter((ct) => projects.some((p) => p.id === ct.projectId) && ct.status === "approved");
    const next = subs.filter((s) => B().lifecycle(s) !== "cancelled").flatMap((s) => s.installments.filter((i) => i.status !== "paid").map((i) => i.dueDate)).sort()[0] || null;
    return {
      totalProjects: projects.length,
      totalSubscriptions: subs.length,
      totalPaymentRows: subs.reduce((n, s) => n + Math.max(1, s.installments.length), 0),
      totalContractAmounts: B().zoneGroups(contracts.map((ct) => ({ zoneId: ct.zoneId, currencyCode: ct.currency, v: ct.grandTotal })), (r) => r.v),
      pendingPaymentInvoices: open.length,
      pendingPaymentAmount: B().zoneGroups(open.map((i) => ({ zoneId: zoneOf(i), currencyCode: i.currencyCode, v: H.num(i.totalAmount) - H.num(i.paidAmount) })), (r) => r.v),
      totalPaidInvoicesAmounts: B().zoneGroups(invoices.filter((i) => H.num(i.paidAmount) > 0).map((i) => ({ zoneId: zoneOf(i), currencyCode: i.currencyCode, v: i.paidAmount })), (r) => r.v),
      installmentContracts: subs.filter((s) => s.paymentType === "installment").length,
      nextInstallmentPaymentDueDate: next,
      overdueInvoices: open.filter((i) => B().invoiceStatus(i) === "overdue").length,
      subscriptionsExpiringSoon: subs.filter((s) => B().lifecycle(s) === "expiring_soon").length,
    };
  }
  function salesmanPerformance(req, s) {
    const scope = scopeFor(req, s);
    const series = salesSeries(scope);
    const sales = zoneGrowth(series);
    const lines = scope.contracts.filter((c) => c.status === "approved").flatMap((c) => c.plans.map(() => ({ at: c.approvedAt || c.createdAt })));
    const top = topPlans(req, scope);
    return {
      userType: "salesman",
      totalProjects: countMetric(scope.projects, (p) => p.createdAt),
      totalSales: sales,
      totalPlanSales: countMetric(lines, (l) => l.at),
      totalCustomers: countMetric(scope.customers, (c) => c.createdAt),
      totalCommission: commissionGrowth(scope),
      projectStatusBreakdown: breakdown(scope.projects, ["pending", "confirmed", "approved", "in_progress", "testing", "completed", "rejected"], (p) => p.status),
      dealStageBreakdown: breakdown(scope.contracts, ["approved", "pending", "rejected"], (c) => c.status),
      customerStatusBreakdown: customerStatus(scope.customers).breakdown,
      customerStatus: customerStatus(scope.customers),
      salesTrend12Months: series.map((x) => ({ ...x, points: x.points.map(({ key, ...p }) => p) })),
      salesGrowthLastSemester: series.map((x) => {
        const cur6 = x.points.slice(6).reduce((a, p) => a + p.amount, 0);
        const prev6 = x.points.slice(0, 6).reduce((a, p) => a + p.amount, 0);
        return { zoneId: x.zoneId, zoneName: x.zoneName, currencyCode: x.currencyCode, currentSixMonthsAmount: H.round(cur6, x.currencyCode), previousSixMonthsAmount: H.round(prev6, x.currencyCode), growthPercent: H.growth(cur6, prev6) };
      }),
      topPlans: top,
      topPlansByRevenue: top,
    };
  }

  // ------------------------------------------------------------------ routes
  function publicRoutes(app) {
    // The app's baseApi also exposes /auth/* on this API (login, me, password reset). Delegate to the shared identity.
    app.post("/api/auth/login", (req, res) => {
      const { email, password } = req.body || {};
      const u = identity.findByEmail(email);
      if (!u || password !== u.password) return fail(res, 401, "Invalid email or password. Please try again.");
      ok(res, identity.authPayload(u), "Login successful");
    });
    app.post("/api/auth/forgot-password", (req, res) => ok(res, { message: "If the email exists, a reset code was sent (local mock – use code 123456)." }, "Reset code sent"));
    app.post("/api/auth/reset-password", (req, res) => {
      if (String(req.body?.otp || "") !== "123456") return fail(res, 400, "Invalid or expired code (the local mock accepts 123456)");
      ok(res, { message: "Password updated (local mock – the shared local password is unchanged)." }, "Password reset");
    });
    app.get("/api/auth/me", (req, res) => {
      const u = identity.requireUser(req, res);
      if (!u) return;
      ok(res, { user: identity.publicUser(u), scopes: identity.userScopes(u) }, "Profile fetched");
    });
  }

  function routes(app) {
    // ---------------- notifications
    app.get("/api/notifications", (req, res) => {
      let list = mine(req);
      const q = req.query;
      if (q.status) list = list.filter((n) => n.status === q.status);
      if (q.type) list = list.filter((n) => n.type === q.type);
      const read = H.boolParam(q.isRead);
      if (read !== undefined) list = list.filter((n) => isRead(n) === read);
      const { items, meta } = util.paginate(H.sortDesc(list), q, { defaultLimit: 20 });
      ok(res, { items: items.map(notificationOut), meta }, "Notifications retrieved successfully");
    });
    app.get("/api/notifications/unread-count", (req, res) => ok(res, { count: mine(req).filter((n) => !isRead(n)).length }, "Unread count retrieved successfully"));
    app.patch("/api/notifications/read-all", (req, res) => {
      mine(req).forEach(markRead);
      ok(res, null, "All notifications marked as read");
    });
    app.get("/api/notifications/preferences", (req, res) => {
      const saved = db.notificationPrefs[req.sc.user.id];
      if (saved) return ok(res, saved, "Preferences retrieved successfully");
      ok(res, Object.entries(K.TYPE_DEFAULTS).map(([notificationType, enabledChannels]) => ({ notificationType, enabledChannels, isDefault: true })), "Default preferences retrieved successfully");
    });
    app.patch("/api/notifications/preferences", (req, res) => {
      const prefs = Array.isArray(req.body?.preferences) ? req.body.preferences : null;
      if (!prefs) return fail(res, 400, "preferences must be an array");
      for (const p of prefs) {
        if (!p.notificationType || !Array.isArray(p.enabledChannels) || !p.enabledChannels.length || p.enabledChannels.some((c) => !["in_app", "email", "websocket"].includes(c))) {
          return fail(res, 400, `Invalid channels for ${p.notificationType || "a notification type"}`);
        }
      }
      const u = req.sc.user;
      const ts = nowIso();
      const current = new Map((db.notificationPrefs[u.id] || Object.entries(K.TYPE_DEFAULTS).map(([notificationType, enabledChannels]) => ({ notificationType, enabledChannels }))).map((p) => [p.notificationType, p]));
      for (const p of prefs) current.set(p.notificationType, { ...current.get(p.notificationType), notificationType: p.notificationType, enabledChannels: [...new Set(p.enabledChannels)] });
      db.notificationPrefs[u.id] = [...current.values()].map((p) => ({ id: p.id || H.newId(), userId: u.id, userType: u.userType === "salesman" ? "salesman" : u.userType === "customer" ? "customer" : "admin", notificationType: p.notificationType, enabledChannels: p.enabledChannels, createdAt: p.createdAt || ts, updatedAt: ts }));
      ok(res, db.notificationPrefs[u.id], "Preferences updated successfully");
    });
    app.patch("/api/notifications/:id/read", (req, res) => {
      const n = mine(req).find((x) => x.id === req.params.id);
      if (!n) return fail(res, 404, "Notification not found");
      markRead(n);
      ok(res, notificationOut(n), "Notification marked as read");
    });

    // ---------------- activity feed
    app.get("/api/activity-feed", (req, res) => {
      const q = req.query;
      const category = CATEGORY_TABS.some(([c]) => c === q.category) ? q.category : "all";
      const includeRead = H.boolParam(q.includeRead) !== false;
      const base = H.sortDesc(mine(req)).filter((n) => includeRead || !isRead(n));
      const items = base.map(feedItem);
      const tabs = CATEGORY_TABS.map(([c, label]) => ({ category: c, label, count: c === "all" ? items.length : items.filter((i) => i.category === c).length }));
      const filtered = category === "all" ? items : items.filter((i) => i.category === category);
      const { items: pageItems, meta } = util.paginate(filtered, q, { defaultLimit: 20 });
      const groups = [];
      for (const it of pageItems) {
        const date = it.occurredAt.slice(0, 10);
        let g = groups.find((x) => x.date === date);
        if (!g) groups.push((g = { date, count: 0, items: [] }));
        g.items.push(it);
        g.count++;
      }
      ok(res, { category, includeRead, tabs, groups, meta }, "Activity feed retrieved");
    });
    app.patch("/api/activity-feed/read-all", (req, res) => {
      mine(req).forEach(markRead);
      ok(res, null, "All activity marked as read");
    });
    app.patch("/api/activity-feed/:id/read", (req, res) => {
      const n = mine(req).find((x) => x.id === req.params.id);
      if (!n) return fail(res, 404, "Activity not found");
      markRead(n);
      ok(res, feedItem(n), "Marked as read");
    });
    app.post("/api/activity-feed/seed", (req, res) => {
      const u = req.sc.user;
      const samples = [
        ["project.status_changed", "Project moved to testing", "A demo project moved to testing.", { projectName: "Demo project" }],
        ["invoice.due_soon", "Invoice due soon", "A demo invoice is due in 5 days.", { invoiceNumber: "INV-DEMO" }],
        ["ticket.created", "New support ticket", "A demo ticket was opened.", { subject: "Demo ticket" }],
      ];
      samples.forEach(([type, title, message, data]) => K.notify([u.id], type, { title, message, data }));
      ok(res, { created: samples.length }, "Demo activity created");
    });

    // ---------------- tickets
    app.get("/api/tickets/users", (req, res) => {
      if (req.sc.role === "customer") return fail(res, 403, "Customers cannot list assignees");
      const users = identity.users.filter((u) => ["admin", "manager", "salesman"].includes(K.appRole(u)) && u.isActive).map((u) => ({ id: u.id, username: u.username, firstName: u.firstName, lastName: u.lastName, userType: u.userType }));
      ok(res, users, "Users retrieved");
    });
    app.get("/api/tickets", (req, res) => {
      let list = db.tickets.filter((t) => canSeeTicket(req, t));
      if (req.query.priority) list = list.filter((t) => t.priority === req.query.priority);
      const statusCounts = { open: list.filter((t) => t.status === "open").length, in_progress: list.filter((t) => t.status === "in_progress").length, resolved: list.filter((t) => t.status === "resolved").length };
      if (req.query.status) list = list.filter((t) => t.status === req.query.status);
      const { items, meta } = util.paginate(H.sortDesc(list, "updatedAt"), req.query, { defaultLimit: 10 });
      ok(res, { items: items.map(ticketOut), meta: { ...meta, statusCounts } }, "Tickets retrieved");
    });
    app.get("/api/tickets/:id", (req, res) => {
      const t = ticketById(req.params.id);
      if (!t || !canSeeTicket(req, t)) return fail(res, 404, "Ticket not found");
      ok(res, ticketDetail(t), "Ticket retrieved");
    });
    app.post("/api/tickets", (req, res) => {
      const b = req.body || {};
      const customer = req.sc.role === "customer" ? req.sc.customer : K.customerById(b.customerId);
      if (!customer) return fail(res, 422, "Select the customer this ticket is for");
      const subject = String(b.subject || "").trim();
      if (!subject) return fail(res, 422, "Subject is required");
      const ts = nowIso();
      const t = { id: H.newId(), number: ++db.counters.ticket, subject, note: String(b.note || "").trim() || null, customerId: customer.id, status: "open", priority: ["low", "medium", "high", "urgent"].includes(b.priority) ? b.priority : "medium", assigneeId: null, notes: [], createdByUserId: req.sc.user.id, createdAt: ts, updatedAt: ts };
      db.tickets.push(t);
      const data = { ticketId: t.id, subject };
      if (req.sc.role === "customer") K.notify(K.adminIds(), "ticket.created", { title: "New support ticket", message: `${customer.companyName}: ${subject}`, data });
      else K.notify([customer.authUserId], "ticket.created", { title: "A ticket was opened for you", message: subject, data });
      ok(res, ticketDetail(t), "Ticket created successfully", 201);
    });
    app.patch("/api/tickets/:id", (req, res) => {
      if (req.sc.role === "customer") return fail(res, 403, "Only internal users can update tickets");
      const t = ticketById(req.params.id);
      if (!t || !canSeeTicket(req, t)) return fail(res, 404, "Ticket not found");
      const b = req.body || {};
      if (b.priority !== undefined && !["low", "medium", "high", "urgent"].includes(b.priority)) return fail(res, 422, "Unknown priority");
      if (b.status !== undefined && !["open", "in_progress", "resolved"].includes(b.status)) return fail(res, 422, "Unknown status");
      if (b.assigneeId !== undefined && b.assigneeId !== null && !identity.findUser(b.assigneeId)) return fail(res, 404, "Assignee not found");
      const before = t.status;
      if (b.priority !== undefined) t.priority = b.priority;
      if (b.status !== undefined) t.status = b.status;
      if (b.assigneeId !== undefined) {
        t.assigneeId = b.assigneeId ? Number(b.assigneeId) : null;
        if (t.status === "open" && t.assigneeId) t.status = "in_progress";
      }
      t.updatedAt = nowIso();
      if (before !== t.status) K.notify([K.customerUserId(t.customerId)], "ticket.status_changed", { title: "Ticket updated", message: `"${t.subject}" is now ${t.status.replace("_", " ")}.`, data: { ticketId: t.id, subject: t.subject } });
      if (b.assigneeId && Number(b.assigneeId) !== req.sc.user.id) K.notify([Number(b.assigneeId)], "ticket.assigned", { title: "Ticket assigned to you", message: t.subject, data: { ticketId: t.id, subject: t.subject } });
      ok(res, ticketDetail(t), "Ticket updated successfully");
    });
    app.get("/api/tickets/:id/notes", (req, res) => {
      const t = ticketById(req.params.id);
      if (!t || !canSeeTicket(req, t)) return fail(res, 404, "Ticket not found");
      const { items, meta } = util.paginate(H.sortDesc(t.notes), req.query, { defaultLimit: 20 });
      ok(res, { items: items.map((n) => noteOut(req, n)), meta }, "Notes retrieved");
    });
    app.post("/api/tickets/:id/notes", S.ctx.upload.single("file"), (req, res) => {
      const t = ticketById(req.params.id);
      if (!t || !canSeeTicket(req, t)) return fail(res, 404, "Ticket not found");
      const note = String(req.body?.note || "").trim();
      if (!note && !req.file) return fail(res, 422, "Write a note or attach a file");
      if (req.file && req.file.size > 10 * 1024 * 1024) return fail(res, 413, "Attachment exceeds the 10 MB limit");
      const ts = nowIso();
      const fileUrl = req.file ? `${S.ctx.fileUrl(req.file.filename)}?key=${encodeURIComponent(`tickets/${t.id}/${req.file.originalname}`)}` : null;
      const n = { id: H.newId(), authorId: req.sc.user.id, authorName: K.userName(req.sc.user), note, fileUrl, createdAt: ts, updatedAt: ts };
      t.notes.push(n);
      t.updatedAt = ts;
      if (req.sc.role === "customer") K.notify(t.assigneeId ? [t.assigneeId] : K.adminIds(), "ticket.note_added", { title: "Customer replied", message: `${t.subject}: ${note.slice(0, 80) || "sent an attachment"}`, data: { ticketId: t.id, subject: t.subject } });
      else K.notify([K.customerUserId(t.customerId)], "ticket.note_added", { title: "New reply on your ticket", message: `${t.subject}: ${note.slice(0, 80) || "sent an attachment"}`, data: { ticketId: t.id, subject: t.subject } });
      ok(res, noteOut(req, n), "Note added", 201);
    });

    // ---------------- dashboard
    app.get("/api/dashboard/overview", (req, res) => ok(res, req.sc.role === "customer" ? customerDashboard(req) : staffDashboard(req), "Dashboard retrieved"));
    app.get("/api/dashboard", (req, res) => ok(res, req.sc.role === "customer" ? customerDashboard(req) : staffDashboard(req), "Dashboard retrieved"));
    app.get("/api/dashboard/latest-projects", (req, res) => {
      const { items, meta } = util.paginate(H.sortDesc(D().visibleProjects(req)), req.query, { defaultLimit: 5 });
      ok(res, { items: items.map((p) => D().projectOut(req, p)), meta }, "Latest projects retrieved");
    });
    app.get("/api/dashboard/admin/finance-summary", (req, res) => {
      if (!K.requireRoles(req, res, ["admin", "manager"])) return;
      const d = staffDashboard(req);
      ok(res, { totalSales: d.totalSales, netProfit: d.netProfit, totalCommission: d.totalCommission, needAttention: d.needAttention, invoices: B().visibleInvoices(req).length }, "Finance summary retrieved");
    });
    app.get("/api/dashboard/admin/subscriptions-dashboard", (req, res) => {
      if (!K.requireRoles(req, res, ["admin", "manager"])) return;
      const subs = db.subscriptions;
      const count = (s) => subs.filter((x) => B().lifecycle(x) === s).length;
      ok(res, { total: subs.length, active: count("active"), expiringSoon: count("expiring_soon"), expired: count("expired"), paused: count("paused"), cancelled: count("cancelled"), pending: count("pending") }, "Subscriptions dashboard retrieved");
    });
    app.get("/api/dashboard/admin/customers/:customerId", (req, res) => {
      const c = K.customerById(req.params.customerId);
      if (!c) return fail(res, 404, "Customer not found");
      ok(res, S.crm.customerSummary(c), "Customer dashboard retrieved");
    });
    app.get("/api/dashboard/admin/salesmen/:salesmanId", (req, res) => {
      const s = K.resolveSalesman(req.params.salesmanId);
      if (!s) return fail(res, 404, "Salesman not found");
      ok(res, salesmanPerformance(req, s), "Salesman dashboard retrieved");
    });

    // ---------------- currency & VAT catalogs
    const supported = (c) => ({ code: c.code, name: c.name, nativeName: c.nativeName, symbol: c.symbol, symbolNative: c.symbolNative, minorUnits: c.minorUnits, countryCodes: c.countryCodes, usdRate: c.usdRate == null ? null : String(c.usdRate), rateUpdatedAt: c.rateUpdatedAt, isSelectable: c.usdRate != null });
    app.get("/api/currency/options", (req, res) => ok(res, Object.values(CURRENCIES).filter((c) => c.usdRate != null).map((c) => ({ code: c.code, name: c.name, symbol: c.symbol })), "Currency options retrieved"));
    app.get("/api/currency/supported", (req, res) => {
      let list = Object.values(CURRENCIES).map(supported);
      const sel = H.boolParam(req.query.selectable);
      if (sel !== undefined) list = list.filter((c) => c.isSelectable === sel);
      list = util.search(list, req.query.search, ["code", "name", "nativeName"]);
      const { items, meta } = util.paginate(list, req.query, { defaultLimit: 50 });
      ok(res, { items, meta }, "Supported currencies retrieved");
    });
    app.get("/api/currency/convert", (req, res) => {
      const from = String(req.query.from || "").toUpperCase();
      const to = String(req.query.to || "").toUpperCase();
      if (!CURRENCIES[from] || !CURRENCIES[to]) return fail(res, 400, `Unsupported currency code: ${!CURRENCIES[from] ? req.query.from : req.query.to}`);
      if (!CURRENCIES[from].usdRate || !CURRENCIES[to].usdRate) return fail(res, 503, "Exchange rate unavailable");
      ok(res, { fromAmount: H.money(req.query.amount, from), fromCurrency: from, toAmount: H.money(H.convert(req.query.amount, from, to), to), toCurrency: to, baseCurrency: "USD", ratesAsOf: RATES_AS_OF }, "Converted");
    });
    app.get("/api/currency/rates", (req, res) => {
      let list = Object.values(CURRENCIES).filter((c) => c.usdRate != null).map((c) => ({ currencyCode: c.code, usdRate: String(c.usdRate), updatedAt: RATES_AS_OF, isStale: false }));
      list = util.search(list, req.query.search, ["currencyCode"]);
      const { items, meta } = util.paginate(list, req.query, { defaultLimit: 50 });
      ok(res, { items, meta, baseCurrency: "USD" }, "Exchange rates retrieved");
    });
    app.post("/api/currency/rates/refresh", (req, res) => {
      if (!K.requireRoles(req, res, ["admin"])) return;
      ok(res, { jobId: `rates-${H.token(6)}`, status: "queued" }, "Exchange-rate refresh queued (local mock rates are static)");
    });
    app.get("/api/admin/management/currencies", (req, res) => ok(res, Object.values(CURRENCIES).filter((c) => c.usdRate != null).map((c) => ({ code: c.code, name: c.name, symbol: c.symbol })), "Currencies retrieved"));
    app.get("/api/vat/countries", (req, res) => ok(res, VAT_COUNTRIES, "VAT countries retrieved"));
  }

  return { routes, publicRoutes, staffDashboard, customerDashboard, salesmanPerformance, feedItem, notificationOut, categoryOf };
};
