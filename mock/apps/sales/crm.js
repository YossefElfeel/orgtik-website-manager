// CRM: customers (KYC documents, notes, meetings, invites), salesmen (wallet, performance, notes),
// staff / user management (roles, access, invites, sign-in-as).
const H = require("./lib");

module.exports = function crm(S) {
  const { db, util, identity, config } = S;
  const { ok, fail } = util;
  const C = S.catalog;
  const K = S.core;
  const D = () => S.deals;
  const B = () => S.billing;
  const sosWeb = () => config.webUrl("sos");
  const nowIso = () => new Date().toISOString();

  // ------------------------------------------------------------------ customers
  function customerSummary(c) {
    const projects = db.projects.filter((p) => p.customerId === c.id);
    const pending = projects.filter((p) => ["pending", "confirmed"].includes(p.status));
    const cur = H.monthKey(new Date());
    const prev = H.monthKey(H.addMonths(new Date(), -1));
    const currentMonthPending = pending.filter((p) => H.monthKey(p.createdAt) === cur).length;
    const previousMonthPending = pending.filter((p) => H.monthKey(p.createdAt) === prev).length;
    const subs = db.subscriptions.filter((s) => s.customerId === c.id);
    const byZone = new Map();
    for (const s of subs) {
      const key = `${s.zoneId}|${s.currencyCode}`;
      const g = byZone.get(key) || { zoneId: s.zoneId, currencyCode: s.currencyCode, paid: 0, contracted: 0 };
      g.paid += H.num(s.paidAmount) - H.num(s.refundedAmount);
      g.contracted += H.num(s.totalAmount);
      byZone.set(key, g);
    }
    const lastAt = [c.lastActivityAt, ...projects.map((p) => p.updatedAt)].filter(Boolean).sort().slice(-1)[0] || c.createdAt;
    const daysSince = Math.max(0, H.daysBetween(lastAt, new Date()));
    return {
      projects: { total: projects.length, pending: pending.length, currentMonthPending, previousMonthPending, growthPercent: H.growth(projects.filter((p) => H.monthKey(p.createdAt) === cur).length, projects.filter((p) => H.monthKey(p.createdAt) === prev).length) },
      financials: [...byZone.values()].map((g) => ({ zoneId: g.zoneId, zoneName: C.zoneById(g.zoneId)?.name || "Unassigned", currencyCode: g.currencyCode, totalPaid: H.money(g.paid, g.currencyCode), contractedAmount: H.money(g.contracted, g.currencyCode), collectedPercentage: g.contracted ? H.pct((g.paid / g.contracted) * 100) : 0 })),
      lastActivity: { at: lastAt, daysSince },
      contactAttention: { needsCheckIn: daysSince > 14, daysSinceLastActivity: daysSince, thresholdDays: 14 },
    };
  }
  // D-028: one lead pipeline, whatever the source.
  const LEAD_STATES = ["new", "contacted", "qualified", "quoted", "won", "lost", "unqualified", "spam", "duplicate"];

  // Website leads (D-028): the website's contact and quote forms post here, server to server (the
  // WM mock forwards its public form). An existing email isn't duplicated: the request is noted on
  // that lead. The answer never says more than the id and whether it was new.
  function receiveIntake(b, { sourceKey, serviceRequestId } = {}) {
      const email = String(b.email || "").trim().toLowerCase();
      const name = String(b.name || "").trim();
      if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw Object.assign(new Error('A name and a valid email are required.'), { status: 422, code: 'invalid_lead' });
      if (sourceKey) {
        const previous = db.customers.find(row => row.intakeReceipts?.[sourceKey]);
        if (previous) return { leadId: previous.id, duplicate: previous.intakeReceipts[sourceKey].duplicate };
      }
      const ts = nowIso();
      const context = { page: b.page || null, bundle: b.bundle || null, utm: b.utm && typeof b.utm === "object" ? b.utm : null, message: b.message ? String(b.message).slice(0, 2000) : null, locale: b.locale || null, receivedAt: ts };
      const existing = db.customers.find((c) => String(c.email || "").toLowerCase() === email);
      if (existing) {
        existing.notes = existing.notes || [];
        existing.notes.unshift({ id: H.newId(), note: `Website request${context.page ? ` from ${context.page}` : ""}${context.message ? `: ${context.message}` : ""}`, createdAt: ts });
        existing.lastActivityAt = ts;
        if (sourceKey) { existing.intakeReceipts ??= {}; existing.intakeReceipts[sourceKey] = { duplicate: true, at: ts }; }
        if (serviceRequestId) existing.serviceRequestIds = [...new Set([...(existing.serviceRequestIds || []), serviceRequestId])];
        return { leadId: existing.id, duplicate: true };
      }
      const c = {
        id: H.newId(), key: null, authUserId: null, preferredLanguage: ["en", "ar", "de", "fr", "it"].includes(b.locale) ? b.locale : "en", status: "new",
        source: String(b.source || "website"), sourceContext: context, lostReason: null,
        fullName: name, email, phoneNumber: b.phone ? String(b.phone) : "", address: "", countryCode: b.countryCode || null,
        companyName: b.company ? String(b.company) : null, website: null, commercialRegistrationNumber: null, assignedSalesmanId: null,
        idDocument: null, businessDocument: null, notes: [], meetingAppointment: null, access: "no_account", invite: null,
        lastActivityAt: ts, createdBy: null, createdAt: ts, updatedAt: ts,
      };
      db.customers.push(c);
      if (sourceKey) c.intakeReceipts = { [sourceKey]: { duplicate: false, at: ts } };
      if (serviceRequestId) c.serviceRequestIds = [serviceRequestId];
      K.notify(K.adminIds(), "lead.created", { title: "New website lead", message: `${name}${c.companyName ? ` (${c.companyName})` : ""} asked to be contacted.`, data: { leadId: c.id, customerId: c.id, source: c.source } });
      return { leadId: c.id, duplicate: false };
  }
  function publicRoutes(app) {
    app.post("/api/leads/intake", (req, res, next) => {
      try { const data = receiveIntake(req.body || {}), status = data.duplicate ? 200 : 201; res.status(status).json({ success: true, statusCode: status, message: data.duplicate ? 'Lead updated' : 'Lead received', data }); }
      catch (error) { next(error); }
    });
  }

  function customerOut(c) {
    const s = K.staffById(c.assignedSalesmanId);
    return {
      id: c.id, fullName: c.fullName, email: c.email, phoneNumber: c.phoneNumber, address: c.address, countryCode: c.countryCode,
      preferredLanguage: c.preferredLanguage, commercialRegistrationNumber: c.commercialRegistrationNumber, status: c.status, createdAt: c.createdAt,
      source: c.source || "manual", sourceContext: c.sourceContext || null, lostReason: c.lostReason || null, authUserId: c.authUserId ?? null,
      companyName: c.companyName, website: c.website, assignedSalesmanId: c.assignedSalesmanId, salesName: s?.fullName || null, access: c.access,
      name: c.fullName, phone: c.phoneNumber, createdDate: c.createdAt, updatedAt: c.updatedAt,
    };
  }
  function customerProjects(req, c) {
    return H.sortDesc(db.projects.filter((p) => p.customerId === c.id)).map((p) => {
      const contracts = D().contractsOf(p.id);
      const latest = contracts.slice(-1)[0];
      return {
        id: p.id, projectName: p.projectName, status: p.status, priority: p.priority, createdAt: p.createdAt,
        plansCount: latest ? latest.plans.length : 0,
        plans: latest ? latest.plans.map((l) => {
          const sub = db.subscriptions.find((s) => s.contractPlanId === l.id);
          return { id: l.id, name: l.planName, dateRange: sub ? `${H.shortDate(sub.startDate)} – ${H.shortDate(sub.endDate)}` : `${l.durationMonths} month${l.durationMonths === 1 ? "" : "s"}`, price: H.fmtMoney(l.price, latest.currency) };
        }) : [],
        contracts: [...contracts].reverse().map((ct) => ({ id: ct.id, status: ct.status, createdAt: ct.createdAt, pdfPath: ct.signedPdfPath || ct.unsignedPdfPath || undefined, isSigntuerd: !!ct.isSigntuerd })),
      };
    });
  }
  function customerDetail(req, c) {
    const creator = K.staffById(c.createdBy);
    return {
      ...customerOut(c),
      idDocument: c.idDocument, businessDocument: c.businessDocument,
      notes: c.notes.map((n) => ({ id: n.id, note: n.note, content: n.note, createdAt: n.createdAt, createdBy: n.createdBy || null })),
      createdByUser: creator ? { id: creator.id, fullName: creator.fullName } : null, updatedByUser: null,
      projects: customerProjects(req, c),
      inviteLink: c.invite?.inviteUrl || null, invitationSent: c.access === "invited", invite: c.invite,
      meetingAppointment: c.meetingAppointment ? { createdAt: c.meetingAppointment.createdAt, createdBy: c.meetingAppointment.createdBy, scheduledAt: c.meetingAppointment.scheduledAt, notes: c.meetingAppointment.notes } : null,
      summary: customerSummary(c),
    };
  }
  const canSeeCustomer = (req, c) => (req.sc.role === "customer" ? c.id === req.sc.customer?.id : req.sc.role === "salesman" ? c.ownerUserId === req.sc.user.id || Boolean(req.sc.staff && c.assignedSalesmanId === req.sc.staff.id) : true);
  const getCustomer = (req, res) => {
    const c = K.customerById(req.params.id);
    if (!c || !canSeeCustomer(req, c)) {
      fail(res, 404, "Customer not found");
      return null;
    }
    return c;
  };
  function customerBody(req, b, existing) {
    const out = {};
    const str = (k) => (b[k] === undefined ? undefined : String(b[k] ?? "").trim());
    for (const k of ["fullName", "address", "companyName", "commercialRegistrationNumber", "website", "phoneNumber"]) {
      const v = str(k);
      if (v !== undefined) out[k] = v || (k === "commercialRegistrationNumber" || k === "website" ? null : v);
    }
    if (!existing && !out.fullName) return { error: "Full name is required" };
    if (b.email !== undefined) {
      const email = String(b.email).trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email" };
      if (db.customers.some((c) => c !== existing && c.email.toLowerCase() === email)) return { error: "A customer with this email already exists", status: 409 };
      out.email = email;
    } else if (!existing) return { error: "Email is required" };
    if (b.countryCode !== undefined) {
      const cc = String(b.countryCode || "").toUpperCase();
      if (cc && cc.length !== 2) return { error: "Country must be a 2-letter code" };
      out.countryCode = cc || null;
    }
    // All five suite languages, Arabic included (it was silently turned into English).
    if (b.preferredLanguage !== undefined) out.preferredLanguage = ["en", "ar", "de", "it", "fr"].includes(b.preferredLanguage) ? b.preferredLanguage : "en";
    if (b.status !== undefined) {
      const st = b.status === "scheduled" ? "contacted" : b.status;
      if (!LEAD_STATES.includes(st)) return { error: "Unknown status" };
      if (st === "lost" && !String(b.lostReason || "").trim()) return { error: "Say why the lead was lost", status: 422 };
      out.status = st;
      out.lostReason = st === "lost" ? String(b.lostReason).trim() : null;
    }
    if (req.sc.role === "salesman") {
      if (!existing) out.assignedSalesmanId = req.sc.staff?.id || null;
    } else if (b.assignedSalesmanId !== undefined) {
      if (!b.assignedSalesmanId) out.assignedSalesmanId = null;
      else {
        const sm = K.resolveSalesman(b.assignedSalesmanId);
        if (!sm) return { error: "Salesman not found", status: 404 };
        out.assignedSalesmanId = sm.id;
      }
    }
    return { value: out };
  }

  // ------------------------------------------------------------------ salesmen
  const salesmanProjects = (s) => db.projects.filter((p) => p.assignedSalesmanId === s.id);
  function salesmanListItem(s) {
    const w = B().wallet(s);
    const usd = (v) => H.round(H.toUsd(v, w.currencyCode), "USD");
    return { id: s.id, fullName: s.fullName, email: s.email, phoneNumber: s.phoneNumber, createdAt: s.createdAt, contractCount: w.contractCount, totalSalesAmount: usd(w.totalSalesAmount), totalCommission: usd(w.totalCommission), status: s.status, performance: s.performance };
  }
  function salesmanStats(s) {
    const projects = salesmanProjects(s);
    const contracts = db.contracts.filter((c) => projects.some((p) => p.id === c.projectId));
    const w = B().wallet(s);
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = H.addMonths(new Date(), -i);
      const key = H.monthKey(d);
      const amount = contracts.filter((c) => c.status === "approved" && H.monthKey(c.approvedAt || c.createdAt) === key).reduce((sum, c) => sum + H.convert(c.grandTotal, c.currency, w.currencyCode), 0);
      months.push({ month: H.MONTHS[new Date(d).getUTCMonth()], amount: H.round(amount, w.currencyCode) });
    }
    const last6 = months.slice(6).reduce((a, m) => a + m.amount, 0);
    const prev6 = months.slice(0, 6).reduce((a, m) => a + m.amount, 0);
    return {
      totalProjects: projects.length,
      totalCustomers: db.customers.filter((c) => c.assignedSalesmanId === s.id).length,
      dealStage: { approved: contracts.filter((c) => c.status === "approved").length, pending: contracts.filter((c) => c.status === "pending").length, rejected: contracts.filter((c) => c.status === "rejected").length },
      salesTrends: months, salesGrowth: H.growth(last6, prev6),
    };
  }
  function relation(req, kind, id) {
    if (!id) return null;
    const row = kind === "dept" ? C.deptById(id) : C.zoneById(id);
    if (!row) return null;
    return { id: row.id, name: kind === "dept" ? C.locStr(req, row.name) : row.name };
  }
  function salesmanDetail(req, s) {
    return {
      id: s.id, role: "salesman", fullName: s.fullName, email: s.email, phoneNumber: s.phoneNumber, address: s.address,
      departmentId: s.departmentId, zoneId: s.zoneId, performance: S.engage.salesmanPerformance(req, s),
      createdAt: s.createdAt, updatedAt: s.updatedAt, hasAccount: !!s.authUserId, authUserId: s.authUserId,
      department: relation(req, "dept", s.departmentId), zone: relation(req, "zone", s.zoneId),
      bankDetails: s.bankDetails || null, finance: B().wallet(s), stats: salesmanStats(s),
      access: s.status === "active" ? "active" : s.status === "invited" ? "invited" : "no_account",
      notes: H.sortDesc(db.salesmanNotes.filter((n) => n.salesmanId === s.id)),
      status: s.status, performanceLabel: s.performance,
    };
  }
  function salesmanContract(c) {
    const p = D().projectById(c.projectId);
    // Approved contracts carry the agreed commission; pending ones show the plan-based proposal.
    const proposed = c.commissionMode ? null : D().commissionFor(c);
    const mode = c.commissionMode || proposed.mode;
    const pctValue = c.commissionMode ? c.commissionPercentage : proposed.pct != null ? H.money(proposed.pct, "USD") : null;
    const fixedValue = c.commissionMode ? c.commissionValue : proposed.value;
    return {
      id: c.id, projectId: c.projectId, projectName: p?.projectName || "", status: c.status === "approved" && p && ["in_progress", "testing", "completed"].includes(p.status) ? p.status : c.status,
      createdBy: c.createdBy, createdByType: c.createdByType, confirmedBy: c.confirmedBy, confirmedAt: c.confirmedAt, approvedBy: c.approvedBy, approvedAt: c.approvedAt,
      commissionPercentage: pctValue || "0.00", commissionMode: mode,
      commissionValue: mode === "fixed" ? H.fmtMoney(fixedValue, c.currency) : pctValue || "0.00",
      isSigntuerd: !!c.isSigntuerd,
      plans: c.plans.map((l) => ({ id: l.id, name: l.name, planName: l.planName, durationMonths: l.durationMonths, price: l.price, isCustom: l.isCustom, paymentMethod: l.paymentMethod, installmentMonths: l.installmentMonths, installmentMonthlyAmount: l.installmentMonthlyAmount })),
      grandTotal: H.fmtMoney(c.grandTotal, c.currency), currency: c.currency, createdAt: c.createdAt, updatedAt: c.updatedAt,
    };
  }
  const salesmanCustomer = (c) => ({ id: c.id, fullName: c.fullName, email: c.email, phoneNumber: c.phoneNumber, commercialRegistrationNumber: c.commercialRegistrationNumber, companyName: c.companyName, website: c.website, assignedSalesmanId: c.assignedSalesmanId, address: c.address, status: c.status, createdAt: c.createdAt });
  function signInAs(res, s, label) {
    if (identity.workspaceMode) return res.status(403).json({ success: false, code: "staff_context_required", message: "Use the authorized OrgTik staff view-as flow." });
    const u = s.authUserId && identity.findUser(s.authUserId);
    if (!u) return fail(res, 400, `${s.fullName} has no login account yet – grant access first`);
    if (s.status === "disabled") return fail(res, 409, `${s.fullName} is disabled`);
    const tokens = identity.issueTokens(u, { impersonatedBy: label });
    return ok(res, { ...tokens, staff: staffOut(null, s) }, `Signed in as ${s.fullName}`);
  }

  // ------------------------------------------------------------------ staff
  function staffOut(req, s) {
    return {
      id: s.id, authUserId: s.authUserId, fullName: s.fullName, email: s.email, phoneNumber: s.phoneNumber, role: s.role, status: s.status,
      performance: s.performance, department: s.departmentId ? { id: s.departmentId, name: req ? C.loc(req, C.deptById(s.departmentId)?.name) : H.text(C.deptById(s.departmentId)?.name) } : null,
      zone: s.zoneId ? { id: s.zoneId, name: C.zoneById(s.zoneId)?.name || "" } : null, avatar: s.avatar, createdAt: s.createdAt, inviteLink: s.invite?.inviteUrl || null,
    };
  }
  function staffDetail(req, s) {
    return {
      ...staffOut(req, s), address: s.address, bankDetails: s.bankDetails ? { accountName: s.bankDetails.accountName || "", bankName: s.bankDetails.bankName || "", swiftBic: s.bankDetails.swiftBic || "", iban: s.bankDetails.iban || "" } : null,
      canSendPasswordReset: s.status === "active" && !!s.authUserId, canCopyInvite: s.status === "invited", canResendInvite: s.status === "invited",
      canEnable: s.status === "disabled", canDisable: s.status === "active" || s.status === "invited", canGrantAccess: s.status === "no_account",
      canSignInAs: s.status === "active" && !!s.authUserId, updatedAt: s.updatedAt,
    };
  }
  const newInvite = () => ({ inviteUrl: `${sosWeb()}/auth/invite?token=${H.token(18)}`, expiresAt: H.daysAhead(7) });

  // ------------------------------------------------------------------ routes
  function routes(app) {
    require('./v3')(S).routes(app);
    const staffRoles = (req, res) => K.requireRoles(req, res, ["admin", "manager", "salesman"], "Customers cannot access this resource");
    const approvers = (req, res) => K.requireRoles(req, res, ["admin", "manager"], "Only admins and managers can do this");
    const adminOnly = (req, res) => K.requireRoles(req, res, ["admin"], "Only admins can manage users");

    // ---------------- customers
    app.get("/api/customers/profile", (req, res) => {
      if (req.sc.role !== "customer" || !req.sc.customer) return fail(res, 404, "No customer profile for this account");
      ok(res, customerDetail(req, req.sc.customer), "Profile retrieved");
    });
    app.get("/api/customers/meetings/all", (req, res) => {
      const list = db.customers.filter((c) => c.meetingAppointment && canSeeCustomer(req, c)).sort((a, b) => String(a.meetingAppointment.scheduledAt).localeCompare(String(b.meetingAppointment.scheduledAt)));
      const { items } = util.paginate(list, req.query, { defaultLimit: 50 });
      ok(res, items.map((c) => ({ ...customerOut(c), meetingAppointment: c.meetingAppointment })), "Meetings retrieved");
    });
    app.get("/api/customers", (req, res) => {
      let list = db.customers.filter((c) => canSeeCustomer(req, c));
      const q = req.query;
      if (q.status) list = list.filter((c) => c.status === q.status);
      // The leads inbox filters (wave 6): source, owner and age.
      if (q.source) list = list.filter((c) => (c.source || "manual") === q.source);
      if (q.assignedSalesmanId) list = list.filter((c) => (q.assignedSalesmanId === "none" ? !c.assignedSalesmanId : c.assignedSalesmanId === q.assignedSalesmanId));
      if (q.createdAfter) list = list.filter((c) => new Date(c.createdAt) >= new Date(q.createdAfter));
      if (q.search) {
        const s = String(q.search).toLowerCase();
        list = list.filter((c) => [c.fullName, c.email, c.companyName, c.phoneNumber].some((v) => String(v || "").toLowerCase().includes(s)));
      }
      const { items, meta } = util.paginate(H.sortDesc(list), q, { defaultLimit: 10 });
      ok(res, { items: items.map(customerOut), meta }, "Customers retrieved");
    });
    app.get("/api/customers/:id", (req, res) => {
      const c = getCustomer(req, res);
      if (c) ok(res, customerDetail(req, c), "Customer retrieved");
    });
    app.post("/api/customers", (req, res) => {
      if (!staffRoles(req, res)) return;
      const b = req.body || {};
      if (identity.workspaceMode && (b.sendInvite || b.password)) return res.status(501).json({ success: false, code: "workspace_command_required", message: "Customer account access requires a shared workspace invitation command." });
      const r = customerBody(req, b);
      if (r.error) return fail(res, r.status || 422, r.error);
      const ts = nowIso();
      const c = {
        id: H.newId(), key: null, authUserId: null, preferredLanguage: "en", status: "new", source: "manual", sourceContext: null, lostReason: null, countryCode: null, companyName: null, website: null,
        commercialRegistrationNumber: null, assignedSalesmanId: null, idDocument: null, businessDocument: null, notes: [], meetingAppointment: null,
        ...r.value, access: b.sendInvite ? "invited" : b.password ? "active" : "no_account", invite: b.sendInvite ? newInvite() : null,
        lastActivityAt: ts, createdBy: req.sc.staff?.id || null, createdByUserId: req.sc.user.id, ownerUserId: req.sc.user.id, createdAt: ts, updatedAt: ts,
      };
      db.customers.push(c);
      K.notify([K.salesmanUserId(c.assignedSalesmanId)].filter((id) => id !== req.sc.user.id), "customer.registered", { title: "New customer assigned", message: `${c.fullName} (${c.companyName || "no company"}) was assigned to you.`, data: { customerId: c.id } });
      ok(res, customerDetail(req, c), b.sendInvite ? "Customer created and invitation generated" : "Customer created successfully", 201);
    });
    app.put("/api/customers/:id", (req, res) => {
      if (!staffRoles(req, res)) return;
      const c = getCustomer(req, res);
      if (!c) return;
      const r = customerBody(req, req.body || {}, c);
      if (r.error) return fail(res, r.status || 422, r.error);
      Object.assign(c, r.value, { updatedAt: nowIso(), lastActivityAt: nowIso() });
      ok(res, customerDetail(req, c), "Customer updated successfully");
    });
    app.delete("/api/customers/:id", (req, res) => {
      if (!approvers(req, res)) return;
      const c = getCustomer(req, res);
      if (!c) return;
      if (c.authUserId) return fail(res, 409, "This customer has an active login; disable it in SOS before deleting");
      db.customers.splice(db.customers.indexOf(c), 1);
      ok(res, null, "Customer deleted successfully");
    });
    app.patch("/api/customers/:id/status", (req, res) => {
      if (!staffRoles(req, res)) return;
      const c = getCustomer(req, res);
      if (!c) return;
      // D-028: one pipeline for every lead. "scheduled" became a meeting, not a stage; a lost lead
      // needs a reason.
      const status = req.body?.status === "scheduled" ? "contacted" : req.body?.status;
      if (!LEAD_STATES.includes(status)) return fail(res, 422, "Unknown status");
      const lostReason = String(req.body?.lostReason || "").trim();
      if (status === "lost" && !lostReason) return res.status(422).json({ success: false, statusCode: 422, code: "lost_reason_required", message: "Say why the lead was lost" });
      Object.assign(c, { status, lostReason: status === "lost" ? lostReason : null, updatedAt: nowIso(), lastActivityAt: nowIso() });
      ok(res, customerDetail(req, c), "Customer status updated");
    });
    for (const kind of ["id", "business"]) {
      const field = kind === "id" ? "idDocument" : "businessDocument";
      app.post(`/api/customers/:id/documents/${kind}`, S.ctx.upload.single("file"), (req, res) => {
        const c = getCustomer(req, res);
        if (!c) return;
        if (!req.file) return fail(res, 422, "Attach a document (PDF or image)");
        c[field] = K.uploaded(req.file);
        c.updatedAt = nowIso();
        K.notify([c.authUserId, K.salesmanUserId(c.assignedSalesmanId)], "customer.document_uploaded", { title: "Document uploaded", message: `${kind === "id" ? "ID" : "Business"} document "${req.file.originalname}" was added for ${c.companyName || c.fullName}.`, data: { customerId: c.id, documentType: kind } });
        ok(res, customerDetail(req, c), "Document uploaded successfully");
      });
      app.delete(`/api/customers/:id/documents/${kind}`, (req, res) => {
        const c = getCustomer(req, res);
        if (!c) return;
        if (!c[field]) return fail(res, 404, "No document to delete");
        c[field] = null;
        c.updatedAt = nowIso();
        ok(res, customerDetail(req, c), "Document deleted");
      });
    }
    app.post("/api/customers/:id/notes", (req, res) => {
      if (!staffRoles(req, res)) return;
      const c = getCustomer(req, res);
      if (!c) return;
      const note = String(req.body?.note || "").trim();
      if (!note) return fail(res, 422, "Note is required");
      c.notes.unshift({ id: H.newId(), note, createdAt: nowIso(), createdBy: K.userName(req.sc.user) });
      c.lastActivityAt = nowIso();
      ok(res, customerDetail(req, c), "Note added");
    });
    app.put("/api/customers/:id/notes", (req, res) => {
      if (!staffRoles(req, res)) return;
      const c = getCustomer(req, res);
      if (!c) return;
      // By id (wave 6); a list position is still accepted from older screens.
      const idx = req.body?.noteId ? c.notes.findIndex((n) => n.id === req.body.noteId) : Number(req.body?.noteIndex);
      const note = String(req.body?.note || "").trim();
      if (!c.notes[idx]) return fail(res, 404, "Note not found");
      if (!note) return fail(res, 422, "Note is required");
      c.notes[idx].note = note;
      ok(res, customerDetail(req, c), "Note updated");
    });
    app.delete("/api/customers/:id/notes/:noteIndex", (req, res) => {
      if (!staffRoles(req, res)) return;
      const c = getCustomer(req, res);
      if (!c) return;
      const byId = c.notes.findIndex((n) => n.id === req.params.noteIndex);
      const idx = byId >= 0 ? byId : Number(req.params.noteIndex);
      if (!c.notes[idx]) return fail(res, 404, "Note not found");
      c.notes.splice(idx, 1);
      ok(res, customerDetail(req, c), "Note deleted");
    });
    app.post("/api/customers/:id/meeting", (req, res) => {
      if (!staffRoles(req, res)) return;
      const c = getCustomer(req, res);
      if (!c) return;
      const at = req.body?.scheduledAt && new Date(req.body.scheduledAt);
      if (!at || Number.isNaN(at.getTime())) return fail(res, 422, "Meeting scheduled date and time is required");
      c.meetingAppointment = { createdAt: nowIso(), createdBy: K.userName(req.sc.user), scheduledAt: at.toISOString(), notes: req.body?.notes || null };
      // A meeting is an activity on the lead, not a stage (D-028); a new lead becomes contacted.
      Object.assign(c, { status: c.status === "new" ? "contacted" : c.status, updatedAt: nowIso(), lastActivityAt: nowIso() });
      K.notify([c.authUserId, K.salesmanUserId(c.assignedSalesmanId)].filter((id) => id !== req.sc.user.id), "customer.meeting_scheduled", { title: "Meeting scheduled", message: `Meeting with ${c.companyName || c.fullName} on ${H.shortDate(at)} at ${at.toISOString().slice(11, 16)} UTC.`, data: { customerId: c.id, scheduledAt: at.toISOString() } });
      ok(res, customerDetail(req, c), "Meeting scheduled");
    });

    // ---------------- salesmen
    const getSalesman = (req, res) => {
      const s = K.staffById(req.params.id);
      if (!s || s.role !== "salesman") {
        fail(res, 404, "Salesman not found");
        return null;
      }
      if (req.sc.role === "salesman" && req.sc.staff?.id !== s.id) {
        fail(res, 403, "You can only view your own profile");
        return null;
      }
      return s;
    };
    const salesmanContractsList = (req, res, s) => {
      const projectIds = new Set(salesmanProjects(s).map((p) => p.id));
      let list = db.contracts.filter((c) => projectIds.has(c.projectId)).map(salesmanContract);
      if (req.query.status) list = list.filter((c) => c.status === req.query.status);
      if (req.query.search) {
        const q = String(req.query.search).toLowerCase();
        list = list.filter((c) => c.projectName.toLowerCase().includes(q) || c.plans.some((l) => l.planName.toLowerCase().includes(q)));
      }
      const { items, meta } = util.paginate(H.sortDesc(list), req.query, { defaultLimit: 10 });
      ok(res, { items, meta }, "Contracts retrieved");
    };
    const salesmanCustomersList = (req, res, s) => {
      let list = db.customers.filter((c) => c.assignedSalesmanId === s.id);
      if (req.query.status) list = list.filter((c) => c.status === req.query.status);
      if (req.query.search) {
        const q = String(req.query.search).toLowerCase();
        list = list.filter((c) => [c.fullName, c.email, c.companyName].some((v) => String(v || "").toLowerCase().includes(q)));
      }
      const { items, meta } = util.paginate(H.sortDesc(list), req.query, { defaultLimit: 10 });
      ok(res, { items: items.map(salesmanCustomer), meta }, "Customers retrieved");
    };
    app.get("/api/salesman/profile", (req, res) => {
      if (!req.sc.staff || req.sc.staff.role !== "salesman") return fail(res, 404, "No salesman profile for this account");
      ok(res, salesmanDetail(req, req.sc.staff), "Profile retrieved");
    });
    app.get("/api/salesman/me/contracts", (req, res) => (req.sc.staff ? salesmanContractsList(req, res, req.sc.staff) : fail(res, 404, "No salesman profile for this account")));
    app.get("/api/salesman/me/customers", (req, res) => (req.sc.staff ? salesmanCustomersList(req, res, req.sc.staff) : fail(res, 404, "No salesman profile for this account")));
    app.get("/api/salesman", (req, res) => {
      if (!staffRoles(req, res)) return;
      let list = K.salesmen();
      if (req.query.search) {
        const q = String(req.query.search).toLowerCase();
        list = list.filter((s) => [s.fullName, s.email, s.phoneNumber].some((v) => String(v || "").toLowerCase().includes(q)));
      }
      const { items, meta } = util.paginate(H.sortDesc(list), req.query, { defaultLimit: 10 });
      ok(res, { items: items.map(salesmanListItem), meta }, "Salesmen retrieved");
    });
    app.get("/api/salesman/:id", (req, res) => {
      const s = getSalesman(req, res);
      if (s) ok(res, salesmanDetail(req, s), "Salesman retrieved");
    });
    function salesmanBody(b, existing) {
      const out = {};
      if (b.fullName !== undefined || !existing) {
        const v = String(b.fullName || "").trim();
        if (!v) return { error: "Full name is required" };
        out.fullName = v;
      }
      if (b.email !== undefined || !existing) {
        const e = String(b.email || "").trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return { error: "Enter a valid email" };
        if (db.staff.some((s) => s !== existing && s.email.toLowerCase() === e)) return { error: "A staff member with this email already exists", status: 409 };
        out.email = e;
      }
      if (b.phoneNumber !== undefined) out.phoneNumber = b.phoneNumber || null;
      if (b.address !== undefined) out.address = b.address || null;
      if (b.departmentId !== undefined) out.departmentId = b.departmentId && C.deptById(b.departmentId) ? b.departmentId : null;
      if (b.zoneId !== undefined) out.zoneId = b.zoneId && C.zoneById(b.zoneId) ? b.zoneId : null;
      if (b.bankDetails !== undefined) out.bankDetails = b.bankDetails ? { accountName: b.bankDetails.accountName || null, bankName: b.bankDetails.bankName || null, swiftBic: b.bankDetails.swiftBic || null, iban: b.bankDetails.iban || null } : null;
      return { value: out };
    }
    app.post("/api/salesman", (req, res) => {
      if (!approvers(req, res)) return;
      const b = req.body || {};
      const r = salesmanBody(b);
      if (r.error) return fail(res, r.status || 422, r.error);
      // No password here: a person's login and access come from SOS (wave 6).
      const ts = nowIso();
      const s = { id: H.newId(), key: null, authUserId: null, role: "salesman", status: "active", performance: "on_track", avatar: null, invite: null, departmentId: null, zoneId: null, bankDetails: null, address: null, phoneNumber: null, ...r.value, createdAt: ts, updatedAt: ts };
      db.staff.push(s);
      K.notify(K.adminIds().filter((id) => id !== req.sc.user.id), "salesman.created", { title: "New salesman", message: `${s.fullName} joined the sales team.`, data: { salesmanId: s.id } });
      ok(res, salesmanListItem(s), "Salesman created successfully", 201);
    });
    app.put("/api/salesman/:id", (req, res) => {
      const s = getSalesman(req, res);
      if (!s) return;
      if (req.sc.role === "customer") return fail(res, 403, "Not allowed");
      const r = salesmanBody(req.body || {}, s);
      if (r.error) return fail(res, r.status || 422, r.error);
      Object.assign(s, r.value, { updatedAt: nowIso() });
      ok(res, salesmanDetail(req, s), "Salesman updated successfully");
    });
    app.delete("/api/salesman/:id", (req, res) => {
      if (!approvers(req, res)) return;
      const s = getSalesman(req, res);
      if (!s) return;
      if (s.authUserId) return fail(res, 409, `${s.fullName} has a login account; disable them in User Management instead`);
      db.staff.splice(db.staff.indexOf(s), 1);
      for (const c of db.customers) if (c.assignedSalesmanId === s.id) c.assignedSalesmanId = null;
      ok(res, null, "Salesman deleted successfully");
    });
    app.get("/api/salesman/:id/notes", (req, res) => {
      const s = getSalesman(req, res);
      if (s) ok(res, H.sortDesc(db.salesmanNotes.filter((n) => n.salesmanId === s.id)).map(({ salesmanId, ...n }) => n), "Notes retrieved");
    });
    app.post("/api/salesman/:id/notes", (req, res) => {
      if (!approvers(req, res)) return;
      const s = getSalesman(req, res);
      if (!s) return;
      const content = String(req.body?.content || "").trim();
      if (!content) return fail(res, 422, "Note content is required");
      const ts = nowIso();
      const n = { id: H.newId(), salesmanId: s.id, content, createdBy: K.userName(req.sc.user), createdByType: req.sc.role, createdAt: ts, updatedAt: ts };
      db.salesmanNotes.push(n);
      const { salesmanId, ...out } = n;
      ok(res, out, "Note added", 201);
    });
    app.get("/api/salesman/:id/contracts", (req, res) => {
      const s = getSalesman(req, res);
      if (s) salesmanContractsList(req, res, s);
    });
    app.get("/api/salesman/:id/customers", (req, res) => {
      const s = getSalesman(req, res);
      if (s) salesmanCustomersList(req, res, s);
    });


    // ---------------- staff / user management
    const getStaff = (req, res) => {
      const s = K.staffById(req.params.id);
      if (!s) {
        fail(res, 404, "User not found");
        return null;
      }
      return s;
    };
    app.get("/api/admin/staff", (req, res) => {
      if (!approvers(req, res)) return;
      let list = db.staff;
      const q = req.query;
      if (q.role) list = list.filter((s) => s.role === q.role);
      if (q.status) list = list.filter((s) => s.status === q.status);
      if (q.search) {
        const t = String(q.search).toLowerCase();
        list = list.filter((s) => [s.fullName, s.email, s.phoneNumber].some((v) => String(v || "").toLowerCase().includes(t)));
      }
      const { items, meta } = util.paginate(H.sortDesc(list), q, { defaultLimit: 10 });
      ok(res, { items: items.map((s) => staffOut(req, s)), meta }, "Users retrieved");
    });
    app.get("/api/admin/staff/stats", (req, res) => {
      if (!approvers(req, res)) return;
      const n = (f) => db.staff.filter(f).length;
      ok(res, { total: db.staff.length, admins: n((s) => s.role === "admin"), managers: n((s) => s.role === "manager"), salesmen: n((s) => s.role === "salesman"), active: n((s) => s.status === "active"), invited: n((s) => s.status === "invited"), disabled: n((s) => s.status === "disabled"), noAccount: n((s) => s.status === "no_account") }, "User stats retrieved");
    });
    app.post("/api/admin/staff", (req, res) => {
      if (!adminOnly(req, res)) return;
      const b = req.body || {};
      if (!["admin", "manager", "salesman"].includes(b.role)) return fail(res, 422, "Role must be admin, manager or salesman");
      const r = salesmanBody({ fullName: b.fullName, email: b.email, phoneNumber: b.phoneNumber, departmentId: b.departmentId, zoneId: b.zoneId });
      if (r.error) return fail(res, r.status || 422, r.error);
      const ts = nowIso();
      const invite = b.accessMode === "active_now" ? null : newInvite();
      const s = { id: H.newId(), key: null, authUserId: null, role: b.role, status: invite ? "invited" : "active", performance: b.role === "admin" ? null : "on_track", avatar: null, address: null, bankDetails: null, departmentId: null, zoneId: null, ...r.value, invite, createdAt: ts, updatedAt: ts };
      db.staff.push(s);
      ok(res, { staff: staffDetail(req, s), invite }, invite ? "User invited successfully" : "User created successfully", 201);
    });
    app.get("/api/admin/staff/:id", (req, res) => {
      if (!approvers(req, res)) return;
      const s = getStaff(req, res);
      if (s) ok(res, staffDetail(req, s), "User retrieved");
    });
    app.patch("/api/admin/staff/:id", (req, res) => {
      if (!adminOnly(req, res)) return;
      const s = getStaff(req, res);
      if (!s) return;
      const b = req.body || {};
      if (b.role !== undefined && !["admin", "manager", "salesman"].includes(b.role)) return fail(res, 422, "Role must be admin, manager or salesman");
      const r = salesmanBody({ fullName: b.fullName, email: b.email, phoneNumber: b.phoneNumber, departmentId: b.departmentId, zoneId: b.zoneId }, s);
      if (r.error) return fail(res, r.status || 422, r.error);
      for (const k of Object.keys(r.value)) if (r.value[k] === undefined) delete r.value[k];
      Object.assign(s, r.value, b.role ? { role: b.role } : {}, { updatedAt: nowIso() });
      ok(res, staffDetail(req, s), "User updated successfully");
    });
    app.delete("/api/admin/staff/:id", (req, res) => {
      if (!adminOnly(req, res)) return;
      const s = getStaff(req, res);
      if (!s) return;
      if (s.authUserId === req.sc.user.id) return fail(res, 409, "You cannot delete your own account");
      if (s.authUserId) return fail(res, 409, `${s.fullName} has an SOS login; disable the account instead`);
      db.staff.splice(db.staff.indexOf(s), 1);
      for (const c of db.customers) if (c.assignedSalesmanId === s.id) c.assignedSalesmanId = null;
      ok(res, null, "User deleted successfully");
    });
    app.patch("/api/admin/staff/:id/performance", (req, res) => {
      if (!approvers(req, res)) return;
      const s = getStaff(req, res);
      if (!s) return;
      const perf = req.body?.performance;
      if (!["top_performance", "on_track", "under_performance", "inactive"].includes(perf)) return fail(res, 422, "Unknown performance value");
      Object.assign(s, { performance: perf, updatedAt: nowIso() });
      ok(res, staffDetail(req, s), "Performance updated");
    });
    app.post("/api/admin/staff/:id/access", (req, res) => {
      if (!adminOnly(req, res)) return;
      const s = getStaff(req, res);
      if (!s) return;
      const mode = req.body?.accessMode;
      if (mode === "active_now") {
        if (req.body?.password && String(req.body.password).length < 8) return fail(res, 422, "Password must be at least 8 characters");
        Object.assign(s, { status: "active", invite: null });
      } else Object.assign(s, { status: "invited", invite: newInvite() });
      s.updatedAt = nowIso();
      ok(res, staffDetail(req, s), mode === "active_now" ? "Access granted" : "Invitation created");
    });
    app.post("/api/admin/staff/:id/disable", (req, res) => {
      if (!adminOnly(req, res)) return;
      const s = getStaff(req, res);
      if (!s) return;
      if (s.authUserId === req.sc.user.id) return fail(res, 409, "You cannot disable your own account");
      Object.assign(s, { status: "disabled", invite: null, updatedAt: nowIso() });
      ok(res, staffDetail(req, s), `${s.fullName} was disabled`);
    });
    app.post("/api/admin/staff/:id/enable", (req, res) => {
      if (!adminOnly(req, res)) return;
      const s = getStaff(req, res);
      if (!s) return;
      Object.assign(s, { status: s.authUserId ? "active" : "no_account", updatedAt: nowIso() });
      ok(res, staffDetail(req, s), `${s.fullName} was enabled`);
    });

    app.post("/api/admin/staff/:id/password-reset", (req, res) => {
      if (!adminOnly(req, res)) return;
      const s = getStaff(req, res);
      if (!s) return;
      if (!s.authUserId) return fail(res, 409, `${s.fullName} has no login account`);
      ok(res, { email: s.email }, `Password reset email sent to ${s.email} (local mock – nothing was sent)`);
    });
    app.post("/api/admin/staff/:id/invites/resend", (req, res) => {
      if (!adminOnly(req, res)) return;
      const s = getStaff(req, res);
      if (!s) return;
      if (s.status !== "invited") return fail(res, 409, "This user has no pending invitation");
      s.invite = newInvite();
      ok(res, s.invite, `Invitation re-sent to ${s.email}`);
    });
    app.get("/api/admin/staff/:id/invites/active", (req, res) => {
      if (!approvers(req, res)) return;
      const s = getStaff(req, res);
      if (!s) return;
      if (!s.invite) return fail(res, 404, "No active invitation");
      ok(res, s.invite, "Invitation retrieved");
    });
  }

  return { routes, publicRoutes, receiveIntake, customerOut, customerDetail, salesmanDetail, staffOut, customerSummary, salesmanStats, LEAD_STATES };
};
