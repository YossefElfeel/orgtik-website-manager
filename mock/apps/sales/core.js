// Core services shared by every route group: request context, people lookups, notifications, files.
const fs = require("fs");
const path = require("path");
const H = require("./lib");
const { NOTIFICATION_TYPES } = require("./seed");
const { CURRENCIES } = require("./reference");

module.exports = function core(S) {
  const { db, identity, util, ctx } = S;

  // ------------------------------------------------------------------ files
  function fileDoc(filename, originalName) {
    const full = path.join(ctx.uploadsDir, filename);
    const size = fs.existsSync(full) ? fs.statSync(full).size : 0;
    return { name: originalName || filename, size, url: ctx.fileUrl(filename) };
  }
  function writeSeed(filename, kind, { title = filename, lines = [], rgb, displayName } = {}) {
    const buf = kind === "png" ? H.makePng(360, 228, rgb || [129, 53, 205]) : H.makePdf(title, lines, { subtitle: "OrgTik Sales" });
    fs.writeFileSync(path.join(ctx.uploadsDir, filename), buf);
    return fileDoc(filename, displayName || filename);
  }
  function writePdf(filename, title, lines, displayName) {
    fs.writeFileSync(path.join(ctx.uploadsDir, filename), H.makePdf(title, lines, { subtitle: "OrgTik Sales" }));
    return fileDoc(filename, displayName || filename);
  }
  const uploaded = (file) => (file ? fileDoc(file.filename, file.originalname) : null);

  // ------------------------------------------------------------------ people
  const customerById = (id) => db.customers.find((c) => c.id === id);
  const customerByAuth = (authId) => db.customers.find((c) => c.authUserId != null && String(c.authUserId) === String(authId));
  const staffById = (id) => db.staff.find((s) => s.id === id);
  const staffByAuth = (authId) => db.staff.find((s) => s.authUserId != null && String(s.authUserId) === String(authId));
  // Accepts a staff id or an auth user id (the customer edit dialog sends the auth id for salesmen).
  const resolveSalesman = (value) => {
    if (value == null || value === "") return null;
    const s = staffById(String(value)) || staffByAuth(value);
    return s && s.role === "salesman" ? s : null;
  };
  const salesmen = () => db.staff.filter((s) => s.role === "salesman");
  const customerMini = (c) => (c ? { id: c.id, fullName: c.fullName, email: c.email, phoneNumber: c.phoneNumber, address: c.address, companyName: c.companyName } : null);
  const staffMini = (s) => (s ? { id: s.id, fullName: s.fullName, email: s.email, authUserId: s.authUserId } : null);
  const userName = (u) => (u ? identity.fullName(u) : "System");

  // The person's Sales role from the `sales` scope (the organisation's super admin is admin), or null
  // when Sales isn't theirs. It came from the global userType, and unknown types fell back to admin,
  // so anyone signed in to the suite got the whole of Sales (SAL-005, wave 6).
  function appRole(user) {
    const scopes = identity.userScopes(user);
    const own = scopes.find((s) => s.scope === "sales")?.roles || [];
    return ["admin", "manager", "salesman", "customer"].find((r) => own.includes(r)) || null;
  }
  function ensureCustomerFor(user) {
    let c = customerByAuth(user.id);
    if (!c) {
      c = {
        id: H.newId(), key: null, authUserId: user.id, fullName: identity.fullName(user), email: user.email, phoneNumber: user.phone || "",
        address: "", countryCode: "EG", preferredLanguage: "en", commercialRegistrationNumber: null, status: "qualified",
        companyName: user.profile?.department || identity.fullName(user), website: null, assignedSalesmanId: null, access: "active",
        idDocument: null, businessDocument: null, notes: [], invite: null, meetingAppointment: null, lastActivityAt: H.iso(Date.now()),
        createdBy: null, createdAt: H.iso(Date.now()), updatedAt: H.iso(Date.now()),
      };
      db.customers.push(c);
    }
    return c;
  }

  // Request context: req.sc = { user, role, lang, catAdmin, customer, staff, displayCurrency }.
  function contextMiddleware(req, res, next) {
    const user = identity.requireUser(req, res);
    if (!user) return;
    const role = appRole(user);
    if (!role) return res.status(403).json({ success: false, statusCode: 403, code: "forbidden", message: "CRM isn't one of your apps" });
    let displayCurrency = null;
    const hx = req.headers["x-currency"];
    if (hx && req.method === "GET" && req.query.mode !== "edit") {
      const code = String(hx).trim().toUpperCase();
      if (!CURRENCIES[code]) return res.status(400).json({ success: false, statusCode: 400, message: `Unsupported currency code: ${hx}`, error: "Bad Request" });
      if (!CURRENCIES[code].usdRate) return res.status(503).json({ success: false, statusCode: 503, message: `No current exchange rate for ${code}`, error: "Service Unavailable" });
      displayCurrency = code;
    }
    req.sc = {
      user, role, lang: H.langOf(req), catAdmin: role === "admin" || role === "manager",
      customer: role === "customer" ? (identity.workspaceMode ? customerByAuth(user.id) : ensureCustomerFor(user)) : null,
      staff: staffByAuth(user.id) || null,
      displayCurrency,
    };
    if (displayCurrency) wrapJsonForCurrency(res, displayCurrency);
    next();
  }

  // x-currency display conversion (spec/currency-display.md): convert money fields of any object that
  // carries currencyCode/currency, leaving explicitly source-labelled fields (priceUsd, totalUsd...) untouched.
  const MONEY_KEYS = new Set([
    "amount", "total", "price", "basePrice", "overridePrice", "suggestedPrice", "suggestedBasePrice", "baseMonthlyPrice", "undiscountedTotal",
    "discountAmount", "discountedTotal", "effectiveMonthlyPrice", "monthlyPayment", "totalPrice", "totalAmount", "paidAmount", "remainingAmount",
    "dueAmount", "subtotal", "subtotalAmount", "taxAmount", "vatAmount", "grandTotal", "netAmount", "installmentMarkupTotal", "cashDueTotal",
    "installmentTotal", "installmentMonthlyTotal", "monthlyPrice", "listMonthlyPrice", "payableTotal", "installmentMarkupAmount",
    "installmentMonthlyAmount", "listTotal", "quotedTotal", "counterTotal", "dealTotal", "totalPaid", "contractedAmount", "totalContractsCost",
    "totalVatAmount", "totalWithVat", "totalCashDue", "totalOnInstallments", "currentPeriod", "previousPeriod", "revenue", "pendingPayoutAmount",
    "totalEarned", "effectivePrice", "derivedPlansTotal", "originalAmount", "bundlePrice", "savingsAmount", "baseAmount", "durationDiscountAmount",
    "couponDiscountAmount", "installmentAmount", "walletBalance", "totalSalesAmount", "totalCommission", "totalWithdrawAmount",
    "currentSixMonthsAmount", "previousSixMonthsAmount", "refundAmount", "couponDiscountValue",
  ]);
  function convertDeep(value, target, inherited) {
    if (Array.isArray(value)) return value.map((v) => convertDeep(v, target, inherited));
    if (!value || typeof value !== "object") return value;
    const own = typeof value.currencyCode === "string" && CURRENCIES[value.currencyCode] ? value.currencyCode : typeof value.currency === "string" && CURRENCIES[value.currency] ? value.currency : null;
    const source = own || inherited;
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (source && MONEY_KEYS.has(k) && (typeof v === "number" || (typeof v === "string" && v !== "" && !Number.isNaN(Number(v))))) {
        const converted = H.convert(v, source, target);
        out[k] = typeof v === "number" ? H.round(converted, target) : H.money(converted, target);
      } else if (v && typeof v === "object") {
        out[k] = convertDeep(v, target, source);
      } else out[k] = v;
    }
    if (own) {
      if ("currencyCode" in out) out.currencyCode = target;
      if ("currency" in out && typeof out.currency === "string") out.currency = target;
      if ("currencyName" in out) out.currencyName = H.cur(target).name;
      if ("currencySymbol" in out) out.currencySymbol = H.cur(target).symbol;
    }
    return out;
  }
  function wrapJsonForCurrency(res, target) {
    const orig = res.json.bind(res);
    res.json = (body) => orig(body && body.success && body.data !== undefined ? { ...body, data: convertDeep(body.data, target, null) } : body);
  }

  const isStaff = (req) => req.sc.role !== "customer";
  function requireRoles(req, res, roles, message) {
    if (identity.workspaceMode && req.sc.role === "customer" && roles.includes("customer") && !req.sc.customer) {
      util.fail(res, 404, "No customer profile has been created in this workspace", { code: "customer_profile_missing" });
      return false;
    }
    if (roles.includes(req.sc.role)) return true;
    util.fail(res, 403, message || "You do not have permission to perform this action");
    return false;
  }

  // ------------------------------------------------------------------ counters / codes
  db.counters = db.counters || { project: 1000, invoice: 0, customInvoice: 0, subscription: 0, commission: 0, offer: 1040, ticket: 0, refund: 0 };
  const nextCode = (kind, prefix, pad = 4) => `${prefix}-${String(++db.counters[kind]).padStart(pad, "0")}`;

  // ------------------------------------------------------------------ notifications
  const TYPE_DEFAULTS = Object.fromEntries(NOTIFICATION_TYPES);
  const PRIORITY = {
    "invoice.overdue": "high", "contract.rejected": "high", "contract.created": "medium", "invoice.created": "high", "payment.received": "medium",
    "invoice.paid": "medium", "wallet.commission_added": "medium", "wallet.commission_paid": "high", "contract.approved": "high",
    "customer.meeting_scheduled": "medium", "customer.document_uploaded": "low", "project.created": "low", "project.status_changed": "low",
    "project.priority_changed": "low", "invoice.due_soon": "medium", "custom_invoice.created": "high", "custom_invoice.paid": "medium",
    "contract.confirmed": "medium", "offer.countered": "high", "offer.accepted": "high", "offer.rejected": "medium", "offer.created": "medium",
    "ticket.created": "medium", "ticket.note_added": "low", "ticket.status_changed": "low", "subscription.renewed": "medium",
    "subscription.cancelled": "high", "subscription.paused": "medium", "subscription.resumed": "low", "subscription.refunded": "medium",
    "salesman.created": "low", "salesman.note_added": "low",
  };
  function channelsFor(userId, type) {
    const saved = db.notificationPrefs[userId];
    const row = saved?.find((p) => p.notificationType === type);
    return row ? row.enabledChannels : TYPE_DEFAULTS[type] || ["in_app", "websocket"];
  }
  function notificationUserType(u) {
    return u.userType === "salesman" ? "salesman" : u.userType === "customer" ? "customer" : "admin";
  }
  function notify(userIds, type, { title, message, data = null, priority, at } = {}) {
    const ids = [...new Set((Array.isArray(userIds) ? userIds : [userIds]).filter((x) => x != null).map(Number))];
    const created = [];
    for (const userId of ids) {
      const u = identity.findUser(userId);
      if (!u) continue;
      const createdAt = at || new Date().toISOString();
      const n = {
        id: H.newId(), userId, userType: notificationUserType(u), type, priority: priority || PRIORITY[type] || "medium",
        title, message, data, channels: channelsFor(userId, type), status: "sent", readAt: null,
        expiresAt: H.iso(new Date(createdAt).getTime() + 120 * H.DAY), createdAt, updatedAt: createdAt,
      };
      db.notifications.push(n);
      created.push(n);
      if (!at && n.channels.includes("websocket") && S.io) {
        S.io.of("/notifications").to(`user:${userId}`).emit("notification", { id: n.id, type: n.type, title: n.title, message: n.message, data: n.data, priority: n.priority, createdAt: n.createdAt });
      }
    }
    return created;
  }
  const adminIds = () => identity.users.filter((u) => appRole(u) === "admin" && u.isActive).map((u) => u.id);
  const managerIdsFor = (departmentId) => {
    const d = db.departments.find((x) => x.id === departmentId);
    return d?.managerId ? [d.managerId] : [];
  };
  const customerUserId = (customerId) => customerById(customerId)?.authUserId ?? null;
  const salesmanUserId = (staffId) => staffById(staffId)?.authUserId ?? null;

  return {
    fileDoc, writeSeed, writePdf, uploaded,
    customerById, customerByAuth, staffById, staffByAuth, resolveSalesman, salesmen, customerMini, staffMini, userName,
    appRole, contextMiddleware, convertDeep, isStaff, requireRoles, nextCode,
    notify, adminIds, managerIdsFor, customerUserId, salesmanUserId, channelsFor, TYPE_DEFAULTS,
  };
};
