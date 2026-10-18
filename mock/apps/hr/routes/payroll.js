// Payroll: run lifecycle (open -> frozen -> submitted -> approved/change_requested -> queued -> paid),
// adjustments, loans & instalments, admin review, finance queue, payslips (PDF), sheets (XLSX/CSV), ZIP export.
module.exports = function payrollRoutes(app, h) {
  const { db, V, L, F } = h;
  const { send, err } = L;
  const FREQS = ["monthly", "biweekly", "weekly", "hourly"];

  // ---------------- lookups ----------------
  const findRun = (req, res, key = "id") => {
    const run = db.runs.find(req.params[key]);
    if (!run || run.cancelledAt) err(res, 404, "Payroll run not found");
    return run && !run.cancelledAt ? run : null;
  };
  // Item ids, adjustment ids (5xxxx) and loan-application ids (7xxxx) live in separate ranges; resolve any of them.
  const resolveItem = (id) => {
    const n = Number(id);
    return db.items.find(n) || (db.adjustments.find(n) && db.items.find(db.adjustments.find(n).runItemId)) || (db.loanApps.find(n)?.runItemId && db.items.find(db.loanApps.find(n).runItemId)) || null;
  };
  const editable = (item) => {
    const run = db.runs.find(item.runId);
    if (item.status === "change_requested") return null;
    if (item.status !== "draft") return `This payroll row is locked (status: ${item.status.replace("_", " ")}).`;
    if (!run.isOpen) return "The payroll run is frozen. Re-open it to make changes.";
    return null;
  };
  const empOf = (item) => V.empAny(item.employeeId);
  const nameOf = (item) => V.fullName(empOf(item));
  const plog = (run, action, userId, metadata = {}) => h.log(action, "PayrollBatch", run.id, userId, metadata);

  // ---------------- payslip PDF ----------------
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  h.payslipFile = (item) => {
    const run = db.runs.find(item.runId);
    const e = empOf(item);
    const t = V.itemTotals(item);
    const adjs = V.itemAdjustments(item.id);
    const apps = V.itemLoanApps(item.id);
    const p = e?.payment || {};
    const last4 = (s) => String(s || "").slice(-4);
    const paymentLabel = item.paymentMethod === "bank" ? `${(p.bank?.bankName || "Bank").replace(/\s*\(.*\)/, "")} ****${last4(p.bank?.accountNumber)}` : item.paymentMethod === "instapay" ? `InstaPay ${p.instapay?.registeredNumber || ""}` : `${L.labelize(p.wallet?.walletName || "Wallet")} Cash ${p.wallet?.phoneNumber || ""}`;
    const sal = V.salaryInfo(e || { salary: {} });
    const pctOrFixed = (v, type, of) => (type === "percentage" ? (of * v) / 100 : v);
    const buf = F.payslipPdf({
      company: db.company.name, companyAddress: db.company.address, periodTitle: run.title, currency: item.currency || "EGP",
      employeeName: V.fullName(e), employeeCode: e?.employeeCode, department: V.deptName(e?.departmentId) || "-", jobTitle: e?.jobTitle || "-",
      periodStart: run.periodStart, periodEnd: run.periodEnd, paymentLabel, number: `PS-${run.id}-${item.id}`,
      status: L.labelize(item.status), paidAt: item.paidAt ? L.dateOf(item.paidAt) : null,
      watermark: item.status === "paid" ? null : `DRAFT - this row is not paid yet (status: ${item.status.replace("_", " ")})`,
      earnings: [
        { label: `Basic salary (${run.frequency === "monthly" ? "month" : run.frequency})${item.periodBaseSalary !== item.baseSalary && run.frequency === "monthly" ? " - prorated" : ""}`, amount: L.money(item.periodBaseSalary) },
        ...adjs.filter((a) => a.type === "bonus").map((a) => ({ label: `Bonus: ${a.reason}`, amount: L.money(a.amount) })),
      ],
      deductions: [
        ...adjs.filter((a) => a.type === "deduction").map((a) => ({ label: `Deduction: ${a.reason}`, amount: L.money(a.amount) })),
        ...apps.map((a) => ({ label: `Loan instalment: ${db.loans.find(a.loanId)?.title || "Loan"}`, amount: L.money(a.appliedAmount) })),
      ],
      netPayable: L.money(t.netPayable),
      reference: e ? [
        { label: "Basic salary (monthly)", amount: L.money(sal.baseSalary) },
        { label: "Housing + transport + other allowances", amount: L.money(sal.totalSalary - sal.baseSalary) },
        { label: "Gross salary per contract", amount: L.money(sal.totalSalary) },
        { label: `Social insurance (${sal.insuranceType === "percentage" ? `${sal.insuranceValue}%` : "fixed"})`, amount: `-${L.money(pctOrFixed(sal.insuranceValue, sal.insuranceType, sal.totalSalary))}` },
        { label: `Income tax (${sal.taxType === "percentage" ? `${sal.taxValue}%` : "fixed"})`, amount: `-${L.money(pctOrFixed(sal.taxValue, sal.taxType, sal.totalSalary))}` },
        { label: "Net salary per contract", amount: L.money(sal.netSalary) },
      ] : [],
    });
    return { buf, name: `payslip-${e?.employeeCode || item.id}-${slug(run.title)}.pdf` };
  };
  const canSeePayslip = (req, item) => V.has(req.user, "hr", "finance_manager") || item.employeeId === req.user.id;

  // ---------------- run helpers ----------------
  function periodFor(frequency, anchor) {
    if (frequency === "monthly") return [L.monthStart(anchor), L.monthEnd(anchor)];
    if (frequency === "biweekly") { const d = Number(anchor.slice(8)); return d <= 15 ? [L.monthStart(anchor), `${anchor.slice(0, 8)}15`] : [`${anchor.slice(0, 8)}16`, L.monthEnd(anchor)]; }
    if (frequency === "weekly") { const s = L.weekStartMon(anchor); return [s, L.addDays(s, 6)]; }
    return [anchor, anchor];
  }
  function titleFor(frequency, start, end) {
    const [y, m, d] = start.split("-").map(Number);
    const [, m2, d2] = end.split("-").map(Number);
    const range = m === m2 ? `${L.MON3[m - 1]} ${d} – ${d2}, ${y}` : `${L.MON3[m - 1]} ${d} – ${L.MON3[m2 - 1]} ${d2}, ${y}`;
    if (frequency === "monthly") return `${L.MONTHS[m - 1]} ${y}`;
    if (frequency === "weekly") {
      const jan1 = `${y}-01-01`;
      const week = Math.ceil((L.daysBetween(jan1, start) + L.weekday(jan1) + 1) / 7);
      return `Week ${week} · ${range}`;
    }
    if (frequency === "hourly") return `${start.slice(8)}/${start.slice(5, 7)}/${y}`;
    return range;
  }
  const loanRemaining = (loan) => L.round2(Math.max(0, loan.principalAmount - V.loanPaid(loan)));
  function addInstalment(loan, item, run) {
    if (db.loanApps.rows.some((a) => a.loanId === loan.id && a.runItemId === item.id)) return null;
    const remaining = loanRemaining(loan);
    if (remaining <= 0) return null;
    return db.loanApps.insert({ loanId: loan.id, runId: run.id, runItemId: item.id, employeeId: item.employeeId, periodStart: run.periodStart, periodEnd: run.periodEnd, frequency: run.frequency, suggestedAmount: loan.installmentAmount, appliedAmount: Math.min(loan.installmentAmount, remaining), remainingBeforeAmount: remaining, isOverride: false, isPaid: false, paidAt: null, notes: "Loan installment (auto)" });
  }
  function payItem(item, userId, now) {
    item.status = "paid";
    item.paidAt = now;
    item.payslipGeneratedAt = now;
    item.queuedAt = item.queuedAt || now;
    item.approvedAt = item.approvedAt || now;
    for (const a of V.itemLoanApps(item.id)) {
      a.isPaid = true;
      a.paidAt = now;
      const loan = db.loans.find(a.loanId);
      if (loan && loanRemaining(loan) <= 0 && loan.status === "active") loan.status = "closed";
    }
    const run = db.runs.find(item.runId);
    h.notify({ to: item.employeeId, actor: userId, action: "payroll.paid", title: `Salary paid - ${run.title}`, body: `Your payslip for ${run.title} is ready (${L.money(V.itemTotals(item).netPayable)} ${item.currency || "EGP"}).`, entityType: "Payslip", entityId: item.id });
  }
  const afterStatusChange = (run) => {
    const s = V.runStatus(run);
    const now = L.nowIso();
    if (s === "approved" && !run.approvedAt) run.approvedAt = now;
    if (s === "paid") run.paidAt = run.paidAt || now;
    run.updatedAt = now;
  };

  // ---------------- runs ----------------
  app.get("/api/payroll/runs", (req, res) => {
    const q = req.query;
    let list = db.runs.rows.filter((r) => !r.cancelledAt);
    if (q.frequency) list = list.filter((r) => r.frequency === q.frequency);
    const ps = L.normDate(q.periodStart), pe = L.normDate(q.periodEnd);
    if (ps || pe) list = list.filter((r) => r.periodStart <= (pe || ps) && r.periodEnd >= (ps || pe));
    let rows = list.map(V.runSummary);
    if (q.status) rows = rows.filter((r) => r.status === q.status);
    rows = L.sortBy(rows, q.sortBy || "periodStart", q.order || "DESC");
    L.paged(res, rows, q, "Payroll runs fetched");
  });

  app.post("/api/payroll/runs", (req, res) => {
    if (!h.guard(req, res, "hr")) return;
    const b = h.body(req);
    const frequency = FREQS.includes(b.frequency) ? b.frequency : "monthly";
    const today = L.todayStr();
    const month = Number(b.month), year = Number(b.year);
    const isCurrentMonth = month && year && `${year}-${L.pad(month)}` === today.slice(0, 7);
    const anchor = frequency !== "monthly" && isCurrentMonth ? today : L.normDate(b.referenceDate) || (year && month ? `${year}-${L.pad(month)}-01` : today);
    const [start, end] = periodFor(frequency, anchor);
    const title = titleFor(frequency, start, end);
    const dup = db.runs.rows.find((r) => !r.cancelledAt && r.frequency === frequency && r.periodStart === start && r.periodEnd === end);
    if (dup) return err(res, 409, `A ${frequency} payroll run already exists for ${dup.title}.`);
    const now = L.nowIso();
    const run = db.runs.insert({ frequency, periodStart: start, periodEnd: end, referenceDate: start, title, isOpen: true, note: b.note || `Started ${frequency} payroll run for ${title}`, createdBy: req.user.id, frozenAt: null, submittedAt: null, approvedAt: null, paidAt: null, cancelledAt: null });
    const members = V.activeEmps().filter((e) => e.payment?.paymentCycle === frequency && e.joinDate <= end && (e.salary?.baseSalary || 0) > 0);
    for (const e of members) {
      const { totalSalary, netSalary } = db.calcSalary(e.salary);
      const item = db.items.insert({
        runId: run.id, employeeId: e.id, currency: e.salary.currency || "EGP", paymentMethod: e.payment.paymentMethod, paymentCycle: frequency,
        baseSalary: e.salary.baseSalary, periodBaseSalary: db.periodBase(e, run), grossSalarySnapshot: totalSalary, netSalarySnapshot: netSalary,
        dailyRate: L.round2(e.salary.baseSalary / 30), hourlyRate: L.round2(e.salary.baseSalary / 176), ...db.itemMetrics(e, run),
        status: "draft", changeRequestNote: null, submittedAt: null, approvedAt: null, queuedAt: null, paidAt: null, payslipGeneratedAt: null, payslipSentAt: null,
      });
      for (const loan of db.loans.rows.filter((l) => l.employeeId === e.id && l.status === "active" && l.startDate <= end)) addInstalment(loan, item, run);
    }
    plog(run, "Payroll run started", req.user.id, { note: run.note });
    send(res, V.runSummary(run), `Payroll run started for ${title} (${members.length} employee${members.length === 1 ? "" : "s"})`, 201);
  });

  app.get("/api/payroll/runs/current", (req, res) => {
    const q = req.query;
    const frequency = FREQS.includes(q.frequency) ? q.frequency : "monthly";
    const anchor = L.normDate(q.referenceDate) || (q.year && q.month ? `${q.year}-${L.pad(q.month)}-01` : L.todayStr());
    const run = db.runs.rows.find((r) => !r.cancelledAt && r.frequency === frequency && r.periodStart <= anchor && r.periodEnd >= anchor);
    send(res, run ? V.runSummary(run) : null, run ? "Current payroll run fetched" : "No payroll run for this period");
  });

  app.get("/api/payroll/runs/:id", (req, res) => {
    const run = findRun(req, res);
    if (run) send(res, V.runSummary(run), "Payroll run fetched");
  });

  app.get("/api/payroll/runs/:id/items", (req, res) => {
    const run = findRun(req, res);
    if (!run) return;
    const q = req.query;
    const tab = String(q.tab || "all").toLowerCase();
    const s = q.search ? String(q.search).toLowerCase() : "";
    const hit = (item) => !s || `${nameOf(item)} ${empOf(item)?.employeeCode || ""}`.toLowerCase().includes(s);
    let items = V.runItems(run.id).filter(hit);
    if (q.status) items = items.filter((i) => i.status === q.status);
    const byName = (a, b) => nameOf(a).localeCompare(nameOf(b));
    let rows;
    if (tab === "bonus" || tab === "deduction") {
      const ids = new Map(items.map((i) => [i.id, i]));
      rows = db.adjustments.rows.filter((a) => a.runId === run.id && a.type === tab && ids.has(a.runItemId)).sort((a, b) => byName(ids.get(a.runItemId), ids.get(b.runItemId)) || a.id - b.id).map((a) => {
        const item = ids.get(a.runItemId);
        return { id: a.id, adjustmentId: a.id, runItemId: item.id, employeeId: item.employeeId, employee: V.payrollEmp(empOf(item)), type: a.type, amount: a.amount, mode: a.mode, value: a.value, reason: a.reason, date: L.dateOf(a.createdAt), status: item.status };
      });
    } else if (tab === "loans") {
      const ids = new Map(items.map((i) => [i.id, i]));
      rows = db.loanApps.rows.filter((a) => a.runId === run.id && ids.has(a.runItemId)).sort((a, b) => byName(ids.get(a.runItemId), ids.get(b.runItemId))).map((a) => {
        const item = ids.get(a.runItemId);
        const loan = db.loans.find(a.loanId);
        const lv = V.loanView(loan);
        return { id: a.id, loanApplicationId: a.id, loanId: loan.id, runItemId: item.id, employeeId: item.employeeId, employee: V.payrollEmp(empOf(item)), loanTitle: loan.title, totalLoan: loan.principalAmount, paid: lv.paidAmount, remaining: lv.remainingAmount, monthly: loan.installmentAmount, appliedAmount: a.appliedAmount, reason: loan.reason, date: loan.startDate, status: item.status };
      });
    } else rows = items.sort(byName).map(V.itemRow);
    const { items: page, meta } = L.pageOf(rows, q);
    send(res, { run: V.runSummary(run), items: page, meta }, "Payroll items fetched");
  });

  app.patch("/api/payroll/runs/:id/freeze", (req, res) => {
    if (!h.guard(req, res, "hr")) return;
    const run = findRun(req, res);
    if (!run) return;
    if (!run.isOpen) return err(res, 400, "This payroll run is already frozen.");
    Object.assign(run, { isOpen: false, frozenAt: L.nowIso(), updatedAt: L.nowIso() });
    plog(run, "Run frozen", req.user.id);
    send(res, V.runSummary(run), `Payroll run ${run.title} frozen`);
  });

  app.patch("/api/payroll/runs/:id/reopen", (req, res) => {
    if (!h.guard(req, res, "hr")) return;
    const run = findRun(req, res);
    if (!run) return;
    if (run.isOpen) return err(res, 400, "This payroll run is already open.");
    const items = V.runItems(run.id);
    if (items.some((i) => ["queued", "paid"].includes(i.status))) return err(res, 400, "This run already has payouts queued or paid and can't be re-opened.");
    let withdrawn = 0;
    for (const i of items) if (i.status === "submitted") { i.status = "draft"; i.submittedAt = null; withdrawn++; }
    Object.assign(run, { isOpen: true, frozenAt: null, updatedAt: L.nowIso() });
    plog(run, withdrawn ? `Run re-opened (${withdrawn} submissions withdrawn)` : "Run re-opened", req.user.id);
    send(res, V.runSummary(run), `Payroll run ${run.title} re-opened`);
  });

  app.post("/api/payroll/runs/:id/submit", (req, res) => {
    if (!h.guard(req, res, "hr")) return;
    const run = findRun(req, res);
    if (!run) return;
    if (run.isOpen) return err(res, 400, "Freeze the run before submitting it for approval.");
    const { employeeIds = [], note } = h.body(req);
    const wanted = new Set([].concat(employeeIds).map(Number));
    const eligible = V.runItems(run.id).filter((i) => wanted.has(i.employeeId) && ["draft", "change_requested"].includes(i.status));
    if (!eligible.length) return err(res, 400, "Select at least one draft or change-requested employee to submit.");
    const now = L.nowIso();
    for (const i of eligible) Object.assign(i, { status: "submitted", submittedAt: now, changeRequestNote: null, updatedAt: now });
    Object.assign(run, { submittedAt: now, note: note || run.note, updatedAt: now });
    plog(run, `Submitted ${eligible.length} employee${eligible.length > 1 ? "s" : ""} for approval`, req.user.id, { note: note || undefined });
    h.notify({ to: h.usersWithRole("super_admin"), actor: req.user.id, action: "payroll.submitted", title: "Payroll submitted for approval", body: `${run.title} (${run.frequency}): ${eligible.length} employee${eligible.length > 1 ? "s" : ""} waiting for your review.`, priority: "high", entityType: "PayrollBatch", entityId: run.id });
    send(res, V.runSummary(run), `${eligible.length} employee${eligible.length > 1 ? "s" : ""} submitted for approval`);
  });

  // ---------------- admin review ----------------
  app.get("/api/payroll/approvals", (req, res) => {
    send(res, db.runs.rows.filter((r) => !r.cancelledAt).map(V.runSummary).filter((s) => s.submittedCount > 0), "Pending approvals fetched");
  });

  app.get("/api/payroll/admin/runs", (req, res) => {
    if (!h.guard(req, res, "super_admin", "hr", "finance_manager")) return;
    const q = req.query;
    const all = db.runs.rows.filter((r) => !r.cancelledAt).map(V.runSummary);
    let list = all;
    if (q.frequency) list = list.filter((r) => r.frequency === q.frequency);
    if (q.status) list = list.filter((r) => r.status === q.status);
    const ps = L.normDate(q.periodStart);
    const pe = L.normDate(q.periodEnd) || (ps ? L.monthEnd(ps) : null);
    if (ps) list = list.filter((r) => r.periodStart <= pe && r.periodEnd >= ps);
    if (q.month && q.year) { const m = `${q.year}-${L.pad(q.month)}`; list = list.filter((r) => r.periodStart.slice(0, 7) <= m && r.periodEnd.slice(0, 7) >= m); }
    if (q.search) { const s = String(q.search).toLowerCase(); list = list.filter((r) => r.title.toLowerCase().includes(s)); }
    const reviewState = q.reviewState || (q.status ? "all" : "open");
    if (reviewState === "open") list = list.filter((r) => ["submitted", "partially_approved", "approved"].includes(r.status) || r.changeRequestedCount > 0);
    if (reviewState === "pending_review") list = list.filter((r) => r.submittedCount > 0);
    if (reviewState === "decided") list = list.filter((r) => r.decidedCount > 0);
    if (reviewState === "changed") list = list.filter((r) => r.changeRequestedCount > 0);
    if (reviewState === "payout_ready") list = list.filter((r) => r.approvedCount > 0);
    if (L.bool(q.needsReview)) list = list.filter((r) => r.submittedCount > 0);
    if (L.bool(q.hasChangeRequests)) list = list.filter((r) => r.changeRequestedCount > 0);
    list = [...list].sort((a, b) => (b.pendingReviewCount > 0) - (a.pendingReviewCount > 0) || (a.periodStart < b.periodStart ? 1 : -1));
    const { items, meta } = L.pageOf(list, q);
    const sumItems = (f) => all.reduce((s, r) => s + f(r), 0);
    send(res, {
      items, meta,
      stats: {
        totalRuns: all.length, pendingReviewRuns: all.filter((r) => r.submittedCount > 0).length, changedRuns: all.filter((r) => r.changeRequestedCount > 0).length, payoutReadyRuns: all.filter((r) => r.approvedCount > 0).length,
        totalEmployees: sumItems((r) => r.itemCount), pendingReviewEmployees: sumItems((r) => r.submittedCount), approvedEmployees: sumItems((r) => r.approvedCount), flaggedEmployees: sumItems((r) => r.changeRequestedCount),
        netPayableTotal: L.round2(sumItems((r) => r.netPayableTotal)),
      },
    }, "Payroll runs fetched");
  });

  app.get("/api/payroll/admin/runs/:id", (req, res) => {
    if (!h.guard(req, res, "super_admin", "hr", "finance_manager")) return;
    const run = findRun(req, res);
    if (!run) return;
    const order = { submitted: 0, change_requested: 1, approved: 2, draft: 3, queued: 4, paid: 5 };
    const items = V.runItems(run.id).sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || nameOf(a).localeCompare(nameOf(b))).map((i) => V.itemFull(i, { signed: false }));
    const logs = db.logs.rows.filter((l) => l.entityType === "PayrollBatch" && l.entityId === String(run.id)).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map((l) => V.activityView(l));
    const { meta } = L.pageOf(items, { page: 1, limit: Math.max(1, items.length) });
    send(res, { run: V.runSummary(run), items, activityLogs: logs, meta }, "Payroll run fetched");
  });

  app.post("/api/payroll/runs/:id/approve-all", (req, res) => {
    if (!h.guard(req, res, "super_admin")) return;
    const run = findRun(req, res);
    if (!run) return;
    const items = V.runItems(run.id).filter((i) => i.status === "submitted");
    if (!items.length) return err(res, 400, "There are no submitted rows waiting for approval in this run.");
    const now = L.nowIso();
    for (const i of items) Object.assign(i, { status: "approved", approvedAt: now, changeRequestNote: null, updatedAt: now });
    const note = h.body(req).note;
    plog(run, `Approved ${items.length} row${items.length > 1 ? "s" : ""}`, req.user.id, { note: note || undefined });
    afterStatusChange(run);
    h.notify({ to: h.usersWithRole("hr"), actor: req.user.id, action: "payroll.approved", title: "Payroll approved", body: `${run.title}: ${items.length} row${items.length > 1 ? "s" : ""} approved${note ? ` - "${note}"` : ""}. You can queue the payout now.`, entityType: "PayrollBatch", entityId: run.id });
    send(res, V.runSummary(run), `${items.length} payroll row${items.length > 1 ? "s" : ""} approved`);
  });

  app.post("/api/payroll/runs/:runId/submit-review", (req, res) => {
    if (!h.guard(req, res, "super_admin")) return;
    const run = findRun(req, res, "runId");
    if (!run) return;
    const list = [].concat(h.body(req).items || []);
    if (!list.length) return err(res, 400, "No review decisions were sent.");
    const now = L.nowIso();
    let approved = 0, changed = 0;
    const errors = [];
    for (const d of list) {
      const item = db.items.find(d.runItemId);
      if (!item || item.runId !== run.id) { errors.push(`Row ${d.runItemId} is not part of this run`); continue; }
      if (!["submitted", "approved", "change_requested"].includes(item.status)) { errors.push(`${nameOf(item)} is ${item.status} and can't be reviewed`); continue; }
      if (d.action === "approved") { Object.assign(item, { status: "approved", approvedAt: now, changeRequestNote: null, updatedAt: now }); approved++; }
      else if (d.action === "change_requested") {
        Object.assign(item, { status: "change_requested", approvedAt: null, changeRequestNote: d.note || "Please review this row.", updatedAt: now });
        changed++;
        plog(run, `Change requested for ${nameOf(item)}`, req.user.id, { note: d.note });
      }
    }
    if (approved) plog(run, `Approved ${approved} row${approved > 1 ? "s" : ""}`, req.user.id);
    afterStatusChange(run);
    if (changed) h.notify({ to: h.usersWithRole("hr"), actor: req.user.id, action: "payroll.change_requested", title: "Payroll change requested", body: `${run.title}: ${changed} row${changed > 1 ? "s need" : " needs"} changes${approved ? `, ${approved} approved` : ""}.`, priority: "high", entityType: "PayrollBatch", entityId: run.id });
    else if (approved) h.notify({ to: h.usersWithRole("hr"), actor: req.user.id, action: "payroll.approved", title: "Payroll approved", body: `${run.title}: ${approved} row${approved > 1 ? "s" : ""} approved.`, entityType: "PayrollBatch", entityId: run.id });
    if (!approved && !changed) return err(res, 400, errors[0] || "Nothing was reviewed.");
    send(res, { ...V.runSummary(run), errors }, `Review submitted: ${approved} approved, ${changed} change request${changed === 1 ? "" : "s"}`);
  });

  app.post("/api/payroll/items/:id/request-change", (req, res) => {
    if (!h.guard(req, res, "super_admin")) return;
    const item = resolveItem(req.params.id);
    if (!item) return err(res, 404, "Payroll row not found");
    if (!["submitted", "approved"].includes(item.status)) return err(res, 400, `Rows that are ${item.status} can't be sent back.`);
    const note = h.body(req).note || "Please review this row.";
    Object.assign(item, { status: "change_requested", approvedAt: null, changeRequestNote: note, updatedAt: L.nowIso() });
    const run = db.runs.find(item.runId);
    plog(run, `Change requested for ${nameOf(item)}`, req.user.id, { note });
    h.notify({ to: h.usersWithRole("hr"), actor: req.user.id, action: "payroll.change_requested", title: "Payroll change requested", body: `${run.title}: ${nameOf(item)} - ${note}`, priority: "high", entityType: "PayrollItem", entityId: run.id });
    send(res, V.itemFull(item), "Change requested");
  });

  // ---------------- items & adjustments ----------------
  app.get("/api/payroll/items/:id", (req, res) => {
    const item = resolveItem(req.params.id);
    if (!item) return err(res, 404, "Payroll row not found");
    if (!V.has(req.user, "hr", "finance_manager") && item.employeeId !== req.user.id) return err(res, 403, "You don't have access to this payroll row.");
    send(res, { ...V.itemFull(item), run: V.runSummary(db.runs.find(item.runId)) }, "Payroll row fetched");
  });

  app.put("/api/payroll/:id", (req, res) => {
    if (!h.guard(req, res, "hr")) return;
    const item = resolveItem(req.params.id);
    if (!item) return err(res, 404, "Payroll row not found");
    const lock = editable(item);
    if (lock) return err(res, 400, lock);
    const list = [].concat(h.body(req).adjustments || []);
    for (const a of V.itemAdjustments(item.id)) db.adjustments.remove(a.id);
    for (const a of list) {
      const mode = a.inputMode || a.mode || "fixed";
      const value = mode === "days" || mode === "months" ? Number(a.dayUnits ?? a.value) || 0 : Math.abs(Number(a.amount ?? a.value) || 0);
      db.adjustments.insert({ runId: item.runId, runItemId: item.id, employeeId: item.employeeId, type: a.type === "deduction" ? "deduction" : "bonus", mode, value, amount: db.adjAmount(item, mode, value), reason: a.description || a.notes || "Adjustment", createdBy: req.user.id });
    }
    send(res, V.itemFull(item), "Payroll row updated");
  });

  app.post("/api/payroll/runs/:runId/adjustments", (req, res) => {
    if (!h.guard(req, res, "hr")) return;
    const run = findRun(req, res, "runId");
    if (!run) return;
    const b = h.body(req);
    const item = V.runItems(run.id).find((i) => i.employeeId === Number(b.employeeId));
    if (!item) return err(res, 404, "This employee is not part of the payroll run.");
    const lock = editable(item);
    if (lock) return err(res, 400, lock);
    const type = b.type === "deduction" ? "deduction" : "bonus";
    const mode = ["fixed", "percent", "days", "months"].includes(b.mode) ? b.mode : "fixed";
    const value = Math.abs(Number(b.value) || 0);
    if (!value) return err(res, 400, "Value must be greater than zero.");
    const a = db.adjustments.insert({ runId: run.id, runItemId: item.id, employeeId: item.employeeId, type, mode, value, amount: db.adjAmount(item, mode, value), reason: b.reason || (type === "bonus" ? "Bonus" : "Deduction"), createdBy: req.user.id });
    plog(run, `${type === "bonus" ? "Bonus" : "Deduction"} added for ${nameOf(item)}`, req.user.id, { reason: a.reason });
    send(res, { adjustment: { ...a, amount: a.amount }, item: V.itemRow(item) }, `${type === "bonus" ? "Bonus" : "Deduction"} of ${L.money(a.amount)} EGP added for ${nameOf(item)}`, 201);
  });

  app.patch("/api/payroll/adjustments/:id", (req, res) => {
    if (!h.guard(req, res, "hr")) return;
    const a = db.adjustments.find(req.params.id);
    if (!a) return err(res, 404, "Adjustment not found");
    const item = db.items.find(a.runItemId);
    const lock = editable(item);
    if (lock) return err(res, 400, lock);
    const b = h.body(req);
    const mode = ["fixed", "percent", "days", "months"].includes(b.mode) ? b.mode : a.mode;
    const value = b.value !== undefined ? Math.abs(Number(b.value) || 0) : a.value;
    db.adjustments.update(a.id, { mode, value, amount: db.adjAmount(item, mode, value), reason: b.reason ?? a.reason });
    send(res, { adjustment: a, item: V.itemRow(item) }, "Adjustment updated");
  });

  app.delete("/api/payroll/adjustments/:id", (req, res) => {
    if (!h.guard(req, res, "hr")) return;
    const a = db.adjustments.find(req.params.id);
    if (!a) return err(res, 404, "Adjustment not found");
    const item = db.items.find(a.runItemId);
    const lock = editable(item);
    if (lock) return err(res, 400, lock);
    db.adjustments.remove(a.id);
    send(res, { id: a.id, item: V.itemRow(item) }, `${a.type === "bonus" ? "Bonus" : "Deduction"} removed`);
  });

  // ---------------- payout ----------------
  app.post("/api/payroll/runs/:id/queue-all", (req, res) => {
    if (!h.guard(req, res, "hr", "finance_manager")) return;
    const run = findRun(req, res);
    if (!run) return;
    const items = V.runItems(run.id).filter((i) => i.status === "approved");
    if (!items.length) return err(res, 400, "Only approved rows can be queued for payout.");
    const now = L.nowIso();
    for (const i of items) Object.assign(i, { status: "queued", queuedAt: now, updatedAt: now });
    plog(run, `Queued ${items.length} payment${items.length > 1 ? "s" : ""} for payout`, req.user.id);
    afterStatusChange(run);
    h.notify({ to: h.usersWithRole("finance_manager"), actor: req.user.id, action: "payroll.queued", title: "Payroll ready for payout", body: `${run.title}: ${items.length} payment${items.length > 1 ? "s" : ""} queued (${L.money(items.reduce((s, i) => s + V.itemTotals(i).netPayable, 0))} EGP).`, priority: "high", entityType: "PayrollBatch", entityId: run.id });
    send(res, V.runSummary(run), `${items.length} payment${items.length > 1 ? "s" : ""} queued for payout`);
  });

  app.post("/api/payroll/runs/:id/pay-all", (req, res) => {
    if (!h.guard(req, res, "finance_manager", "hr")) return;
    const run = findRun(req, res);
    if (!run) return;
    const items = V.runItems(run.id).filter((i) => ["approved", "queued"].includes(i.status));
    if (!items.length) return err(res, 400, "There are no approved or queued payments in this run.");
    const now = L.nowIso();
    for (const i of items) payItem(i, req.user.id, now);
    plog(run, `Marked ${items.length} payment${items.length > 1 ? "s" : ""} as paid`, req.user.id);
    afterStatusChange(run);
    send(res, V.runSummary(run), `${items.length} payment${items.length > 1 ? "s" : ""} marked as paid`);
  });

  app.post("/api/payroll/items/:id/mark-paid", (req, res) => {
    if (!h.guard(req, res, "finance_manager", "hr")) return;
    const item = resolveItem(req.params.id);
    if (!item) return err(res, 404, "Payroll row not found");
    if (!["approved", "queued"].includes(item.status)) return err(res, 400, `Only approved or queued rows can be paid (this one is ${item.status}).`);
    payItem(item, req.user.id, L.nowIso());
    const run = db.runs.find(item.runId);
    plog(run, `Paid ${nameOf(item)}`, req.user.id);
    afterStatusChange(run);
    send(res, V.payoutRow(item), `Payment to ${nameOf(item)} marked as paid`);
  });

  app.get("/api/payroll/payouts", (req, res) => {
    const q = req.query;
    const statuses = L.bool(q.showAll) ? ["approved", "partially_approved", "payout_queued", "partially_paid", "paid"] : ["approved", "payout_queued", "partially_paid"];
    let list = db.runs.rows.filter((r) => !r.cancelledAt).map(V.runSummary).filter((r) => statuses.includes(r.status) && (r.status !== "partially_approved" || r.approvedCount > 0));
    if (q.frequency) list = list.filter((r) => r.frequency === q.frequency);
    list = L.sortBy(list, q.sortBy || "periodStart", q.order || "DESC");
    L.paged(res, list, q, "Payouts fetched");
  });

  app.get("/api/payroll/runs/:id/payout", (req, res) => {
    const run = findRun(req, res);
    if (!run) return;
    const q = req.query;
    let items = V.runItems(run.id).filter((i) => ["approved", "queued", "paid"].includes(i.status));
    if (q.status) items = items.filter((i) => i.status === q.status);
    if (q.q || q.search) { const s = String(q.q || q.search).toLowerCase(); items = items.filter((i) => `${nameOf(i)} ${empOf(i)?.employeeCode || ""}`.toLowerCase().includes(s)); }
    items.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
    const { items: page, meta } = L.pageOf(items.map(V.payoutRow), q);
    send(res, { run: V.runSummary(run), items: page, meta }, "Payout rows fetched");
  });

  app.post("/api/payroll/runs/:id/export-bank-file", (req, res) => {
    if (!h.guard(req, res, "finance_manager", "hr")) return;
    const run = findRun(req, res);
    if (!run) return;
    const country = req.body?.country || "generic";
    if (!["generic", "CH", "AE"].includes(country)) return err(res, 400, "Choose CH, AE or generic export.");
    const header = country === "CH" ? ["Creditor name", "IBAN", "BIC", "Amount", "Currency", "Reference"] : country === "AE" ? ["Employee code", "IBAN", "Bank routing code", "Period start", "Period end", "Net amount", "Currency", "Reference"] : ["Employee Code", "Beneficiary", "Method", "Bank", "IBAN / Number", "Amount", "Currency", "Reference"];
    const rows = [["NOT-FOR-BANK-SUBMISSION", "SAMPLE", country], header];
    for (const i of V.runItems(run.id).filter((x) => ["approved", "queued"].includes(x.status))) {
      const p = V.payoutRow(i);
      const bank = V.empAny(i.employeeId)?.payment?.bank || {}, reference = `PAYROLL-${run.id}-${i.id}`;
      rows.push(country === "CH" ? [p.employee.name, p.iban || "", bank.swiftCode || bank.bic || "", p.amount.toFixed(2), p.currency, reference] : country === "AE" ? [p.employee.employeeCode, p.iban || "", bank.routingCode || "", run.periodStart, run.periodEnd, p.amount.toFixed(2), p.currency, reference] : [p.employee.employeeCode, p.employee.name, p.paymentMethod, p.bankName || "", p.iban || "", p.amount.toFixed(2), p.currency, reference]);
    }
    const filename = `sample-bank-file-${country}-${slug(run.title)}.csv`;
    plog(run, "Bank file exported", req.user.id);
    send(res, { filename, contentType: "text/csv", content: F.csv(rows), rows: rows.length - 2, simulated: true, country }, `Bank file generated (${rows.length - 2} payments)`);
  });

  // ---------------- payslips ----------------
  for (const kind of ["preview", "download"]) {
    app.get(`/api/payroll/items/:id/payslip/${kind}`, (req, res) => {
      const item = resolveItem(req.params.id);
      if (!item) return err(res, 404, "Payroll row not found");
      if (!canSeePayslip(req, item)) return err(res, 403, "You don't have access to this payslip.");
      const { buf, name } = h.payslipFile(item);
      h.sendFile(res, buf, { type: "application/pdf", name, inline: kind === "preview" });
    });
    app.get(`/api/payroll/me/payslips/:id/${kind}`, (req, res) => {
      const item = db.items.find(req.params.id);
      if (!item || item.employeeId !== req.user.id) return err(res, 404, "Payslip not found");
      const { buf, name } = h.payslipFile(item);
      h.sendFile(res, buf, { type: "application/pdf", name, inline: kind === "preview" });
    });
  }
  app.get("/api/payroll/me/payslips", (req, res) => {
    const q = req.query;
    const list = db.items.rows.filter((i) => i.employeeId === req.user.id && ["paid", "queued", "approved"].includes(i.status)).map(V.payslipItem).sort((a, b) => (a.periodStart < b.periodStart ? 1 : -1));
    if (String(q.order).toUpperCase() === "ASC") list.reverse();
    L.paged(res, list, q, "Payslips fetched");
  });
  app.post("/api/payroll/items/:id/payslip/send", (req, res) => {
    if (!h.guard(req, res, "hr", "finance_manager")) return;
    const item = resolveItem(req.params.id);
    if (!item) return err(res, 404, "Payroll row not found");
    if (item.status !== "paid") return err(res, 400, "Payslips can only be sent for paid rows.");
    item.payslipSentAt = L.nowIso();
    const e = empOf(item);
    const run = db.runs.find(item.runId);
    h.notify({ to: item.employeeId, actor: req.user.id, action: "payslip.sent", title: `Payslip - ${run.title}`, body: `Your payslip for ${run.title} was sent to ${e?.email}.`, entityType: "Payslip", entityId: item.id });
    send(res, { id: item.id, payslipSentAt: item.payslipSentAt }, `Payslip sent to ${e?.email}`);
  });
  app.post("/api/payroll/runs/:runId/payslips/send-all", (req, res) => {
    if (!h.guard(req, res, "hr", "finance_manager")) return;
    const run = findRun(req, res, "runId");
    if (!run) return;
    const items = V.runItems(run.id).filter((i) => i.status === "paid");
    if (!items.length) return err(res, 400, "There are no paid rows in this run yet.");
    const now = L.nowIso();
    for (const i of items) {
      i.payslipSentAt = now;
      h.notify({ to: i.employeeId, actor: req.user.id, action: "payslip.sent", title: `Payslip - ${run.title}`, body: `Your payslip for ${run.title} was sent by email.`, entityType: "Payslip", entityId: i.id });
    }
    plog(run, `Sent ${items.length} payslips by email`, req.user.id);
    send(res, { sent: items.length }, `${items.length} payslip${items.length > 1 ? "s" : ""} sent by email`);
  });

  // ---------------- finance sheets ----------------
  const TEMPLATE_HEADER = ["Run ID", "Employee Code", "Employee Name", "Type (bonus/deduction)", "Mode (fixed/percent/days/months)", "Value", "Reason"];
  app.get("/api/payroll/finance/sheets/template", (req, res) => {
    const open = db.runs.rows.filter((r) => r.isOpen && !r.cancelledAt).sort((a, b) => (a.periodStart < b.periodStart ? 1 : -1))[0];
    const rows = [TEMPLATE_HEADER];
    if (open) {
      const items = V.runItems(open.id).slice(0, 3);
      const samples = [["bonus", "fixed", 1000, "Referral bonus"], ["deduction", "fixed", 250, "Parking fine"], ["bonus", "percent", 5, "Performance bonus"]];
      items.forEach((i, k) => rows.push([open.id, empOf(i)?.employeeCode, nameOf(i), ...samples[k]]));
    }
    h.sendFile(res, F.xlsx(rows, { sheetName: "Adjustments" }), { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name: "payroll-finance-import-template.xlsx" });
  });

  app.post("/api/payroll/finance/sheets/import", h.anyFiles, (req, res) => {
    if (!h.guard(req, res, "finance_manager", "hr")) return;
    const f = (req.files || [])[0];
    if (!f) return err(res, 400, "No file was uploaded (field name: file).");
    const fs = require("fs");
    const ext = (f.originalname.split(".").pop() || "").toLowerCase();
    let rows;
    try {
      const buf = fs.readFileSync(f.path);
      if (ext === "csv" || /csv/.test(f.mimetype)) rows = F.readCsv(buf.toString("utf8"));
      else if (ext === "xlsx") rows = F.readXlsx(buf);
      else return err(res, 400, "Unsupported file type. Please upload an .xlsx or .csv file.");
    } catch (e) {
      return err(res, 400, `Could not read the file: ${e.message}`);
    }
    if (rows.length && /employee|run/i.test(rows[0].join(" "))) rows = rows.slice(1);
    const errors = [];
    let created = 0;
    const defaultRun = db.runs.rows.filter((r) => r.isOpen && !r.cancelledAt).sort((a, b) => (a.periodStart < b.periodStart ? 1 : -1))[0];
    const touched = new Set();
    rows.forEach((r, idx) => {
      const line = idx + 2;
      const [runIdRaw, code, , typeRaw, modeRaw, valueRaw, reason] = r.map((c) => String(c ?? "").trim());
      const run = runIdRaw ? db.runs.find(Number(runIdRaw)) : defaultRun;
      if (!run) return errors.push(`Row ${line}: payroll run ${runIdRaw || "(open)"} not found`);
      const e = db.employees.rows.find((x) => x.employeeCode.toLowerCase() === String(code).toLowerCase());
      if (!e) return errors.push(`Row ${line}: employee ${code || "(empty)"} not found`);
      const item = V.runItems(run.id).find((i) => i.employeeId === e.id);
      if (!item) return errors.push(`Row ${line}: ${V.fullName(e)} is not part of run ${run.id}`);
      if (!["draft", "change_requested"].includes(item.status)) return errors.push(`Row ${line}: ${V.fullName(e)} is ${item.status} in run ${run.id}`);
      const type = String(typeRaw).toLowerCase().startsWith("d") ? "deduction" : String(typeRaw).toLowerCase().startsWith("b") ? "bonus" : null;
      if (!type) return errors.push(`Row ${line}: type must be bonus or deduction`);
      const mode = ["fixed", "percent", "days", "months"].includes(String(modeRaw).toLowerCase()) ? String(modeRaw).toLowerCase() : "fixed";
      const value = Math.abs(Number(String(valueRaw).replace(/,/g, "")) || 0);
      if (!value) return errors.push(`Row ${line}: value must be a positive number`);
      db.adjustments.insert({ runId: run.id, runItemId: item.id, employeeId: e.id, type, mode, value, amount: db.adjAmount(item, mode, value), reason: reason || `Imported ${type}`, createdBy: req.user.id });
      touched.add(run.id);
      created++;
    });
    const runId = [...touched][0] || defaultRun?.id || null;
    const batch = db.importBatches.insert({ runId, filename: f.originalname, format: ext, rowCount: rows.length, createdCount: created, errorCount: errors.length, importedByUserId: String(req.user.id), errors });
    for (const id of touched) plog(db.runs.find(id), `Imported ${created} adjustment${created === 1 ? "" : "s"} from ${f.originalname}`, req.user.id);
    send(res, batch, `Imported ${created} of ${rows.length} row${rows.length === 1 ? "" : "s"}${errors.length ? ` (${errors.length} error${errors.length > 1 ? "s" : ""}: ${errors[0]})` : ""}`);
  });

  app.get("/api/payroll/finance/sheets/export", (req, res) => {
    if (!h.guard(req, res, "finance_manager", "hr")) return;
    const run = db.runs.find(req.query.runId);
    if (!run) return err(res, 404, "Payroll run not found");
    const rows = [["Employee Code", "Employee Name", "Department", "Payment Method", "Bank", "IBAN / InstaPay / Wallet", "Base (period)", "Bonuses", "Deductions", "Loans", "Net Payable", "Currency", "Status", "Paid At"]];
    for (const i of V.runItems(run.id).sort((a, b) => nameOf(a).localeCompare(nameOf(b)))) {
      const p = V.payoutRow(i);
      rows.push([p.employee.employeeCode, p.employee.name, p.employee.departmentName || "", p.paymentMethod, p.bankName || "", p.iban || "", p.periodBaseSalary, p.bonusTotal, p.deductionTotal, p.loanTotal, p.amount, p.currency, i.status, i.paidAt ? L.dateOf(i.paidAt) : ""]);
    }
    const base = `payroll-finance-run-${run.id}-${slug(run.title)}`;
    if (String(req.query.format).toLowerCase() === "csv") return h.sendFile(res, Buffer.from(F.csv(rows), "utf8"), { type: "text/csv; charset=utf-8", name: `${base}.csv` });
    h.sendFile(res, F.xlsx(rows, { sheetName: run.title.replace(/[^\w ]/g, " ").slice(0, 31) }), { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name: `${base}.xlsx` });
  });

  app.get("/api/payroll/finance/runs/:runId/payslips/export", (req, res) => {
    if (!h.guard(req, res, "finance_manager", "hr")) return;
    const run = findRun(req, res, "runId");
    if (!run) return;
    let items = V.runItems(run.id).filter((i) => i.status === "paid");
    if (!items.length) items = V.runItems(run.id);
    const files = items.map((i) => { const { buf, name } = h.payslipFile(i); return { name, data: buf }; });
    const summary = [["Payslip", "Employee", "Net Payable", "Status"], ...items.map((i, k) => [files[k].name, nameOf(i), V.itemTotals(i).netPayable, i.status])];
    files.push({ name: "summary.csv", data: F.csv(summary) });
    h.sendFile(res, F.zip(files), { type: "application/zip", name: `payroll-run-${run.id}-payslips.zip` });
  });

  app.get("/api/payroll/finance/import-batches", (req, res) => {
    const list = [...db.importBatches.rows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    L.paged(res, list, req.query, "Import batches fetched");
  });

  // ---------------- loans ----------------
  const findLoan = (req, res) => { const l = db.loans.find(req.params.id); if (!l) err(res, 404, "Loan not found"); return l; };
  const dropUnpaidApps = (loan) => { for (const a of db.loanApps.rows.filter((x) => x.loanId === loan.id && !x.isPaid && x.runItemId)) { const item = db.items.find(a.runItemId); if (item && ["draft", "change_requested"].includes(item.status)) db.loanApps.remove(a.id); } };
  const attachToOpenRuns = (loan) => {
    const e = V.empAny(loan.employeeId);
    for (const run of db.runs.rows.filter((r) => r.isOpen && !r.cancelledAt && r.frequency === e?.payment?.paymentCycle && r.periodEnd >= loan.startDate)) {
      const item = V.runItems(run.id).find((i) => i.employeeId === loan.employeeId && i.status === "draft");
      if (item) addInstalment(loan, item, run);
    }
  };

  app.get("/api/payroll/loans", (req, res) => {
    const q = req.query;
    let list = db.loans.rows;
    if (!V.has(req.user, "hr", "finance_manager")) list = list.filter((l) => l.employeeId === req.user.id);
    if (q.status && q.status !== "all") list = list.filter((l) => l.status === q.status);
    if (q.employeeId) list = list.filter((l) => String(l.employeeId) === String(q.employeeId));
    let rows = list.map(V.loanView);
    if (q.search) { const s = String(q.search).toLowerCase(); rows = rows.filter((l) => `${l.employee.name} ${l.employee.employeeCode} ${l.title}`.toLowerCase().includes(s)); }
    rows = L.sortBy(rows, q.sortBy || "createdAt", q.order || "DESC");
    L.paged(res, rows, q, "Loans fetched");
  });

  app.post("/api/payroll/loans", (req, res) => {
    if (!h.guard(req, res, "hr", "finance_manager")) return;
    const b = h.body(req);
    const e = V.emp(Number(b.employeeId));
    if (!e) return err(res, 400, "Select a valid employee.");
    const principal = Math.abs(Number(b.principalAmount) || 0);
    const months = Math.max(1, Number(b.durationMonths) || 1);
    if (!principal) return err(res, 400, "Loan amount must be greater than zero.");
    const installment = Math.abs(Number(b.installmentAmount) || 0) || L.round2(principal / months);
    const loan = db.loans.insert({ employeeId: e.id, title: b.title || "Employee Loan", principalAmount: principal, installmentAmount: installment, durationMonths: months, currency: e.salary?.currency || "EGP", startDate: L.normDate(b.startDate) || L.todayStr(), status: "active", reason: b.reason || "", createdBy: req.user.id });
    attachToOpenRuns(loan);
    h.log("created a loan for", "EmployeeLoan", loan.id, req.user.id, { employeeId: e.id, principal });
    h.notify({ to: e.authUserId, actor: req.user.id, action: "loan.created", title: "Loan approved", body: `${loan.title}: ${L.money(principal)} ${loan.currency}, ${L.money(installment)} per instalment.`, entityType: "EmployeeLoan", entityId: loan.id });
    send(res, V.loanDetail(loan), `Loan of ${L.money(principal)} ${loan.currency} created for ${V.fullName(e)}`, 201);
  });

  app.get("/api/payroll/loans/:id", (req, res) => {
    const loan = findLoan(req, res);
    if (!loan) return;
    if (!V.has(req.user, "hr", "finance_manager") && loan.employeeId !== req.user.id) return err(res, 403, "You don't have access to this loan.");
    send(res, V.loanDetail(loan), "Loan fetched");
  });

  app.patch("/api/payroll/loans/:id", (req, res) => {
    if (!h.guard(req, res, "hr", "finance_manager")) return;
    const loan = findLoan(req, res);
    if (!loan) return;
    const b = h.body(req);
    if (b.title !== undefined) loan.title = b.title;
    if (b.reason !== undefined) loan.reason = b.reason;
    if (b.installmentAmount !== undefined && Number(b.installmentAmount) > 0) {
      loan.installmentAmount = Number(b.installmentAmount);
      for (const a of db.loanApps.rows.filter((x) => x.loanId === loan.id && !x.isPaid && !x.isOverride)) { a.suggestedAmount = loan.installmentAmount; a.appliedAmount = Math.min(loan.installmentAmount, a.remainingBeforeAmount || loan.installmentAmount); }
    }
    if (b.remainingAmount !== undefined && Number(b.remainingAmount) >= 0) loan.principalAmount = L.round2(V.loanPaid(loan) + Number(b.remainingAmount));
    const prevStatus = loan.status;
    if (b.status && b.status !== loan.status && ["active", "paused", "closed", "cancelled"].includes(b.status)) {
      loan.status = b.status;
      if (b.status === "active") attachToOpenRuns(loan); else dropUnpaidApps(loan);
    }
    loan.updatedAt = L.nowIso();
    h.log("updated the loan", "EmployeeLoan", loan.id, req.user.id, { status: loan.status, previousStatus: prevStatus });
    send(res, V.loanDetail(loan), "Loan updated successfully");
  });

  app.patch("/api/payroll/loans/:id/status", (req, res) => {
    if (!h.guard(req, res, "hr", "finance_manager")) return;
    const loan = findLoan(req, res);
    if (!loan) return;
    const status = h.body(req).status;
    if (!["active", "paused", "closed", "cancelled"].includes(status)) return err(res, 400, "Status must be active, paused, closed or cancelled.");
    loan.status = status;
    if (status === "active") attachToOpenRuns(loan); else dropUnpaidApps(loan);
    loan.updatedAt = L.nowIso();
    h.log(`${status === "active" ? "activated" : status} the loan`, "EmployeeLoan", loan.id, req.user.id, {});
    h.notify({ to: loan.employeeId, actor: req.user.id, action: `loan.${status}`, title: `Loan ${status === "active" ? "re-activated" : status}`, body: `Your '${loan.title}' loan is now ${status}.`, entityType: "EmployeeLoan", entityId: loan.id });
    send(res, V.loanDetail(loan), `Loan ${status === "active" ? "activated" : status}`);
  });

  app.post("/api/payroll/runs/:runId/loans", (req, res) => {
    if (!h.guard(req, res, "hr")) return;
    const run = findRun(req, res, "runId");
    if (!run) return;
    const b = h.body(req);
    const item = V.runItems(run.id).find((i) => i.employeeId === Number(b.employeeId));
    if (!item) return err(res, 404, "This employee is not part of the payroll run.");
    const lock = editable(item);
    if (lock) return err(res, 400, lock);
    let loan = db.loans.find(b.loanId);
    if (!loan || loan.employeeId !== item.employeeId) loan = db.loans.rows.find((l) => l.employeeId === item.employeeId && l.status === "active");
    if (!loan) return err(res, 400, "This employee has no active loan.");
    const amount = Math.abs(Number(b.amount) || 0);
    let a = db.loanApps.rows.find((x) => x.loanId === loan.id && x.runItemId === item.id);
    if (!a) a = addInstalment(loan, item, run);
    if (!a) return err(res, 400, "This loan is already fully paid.");
    if (amount) Object.assign(a, { appliedAmount: Math.min(amount, a.remainingBeforeAmount || amount), isOverride: amount !== a.suggestedAmount, notes: b.notes || a.notes, updatedAt: L.nowIso() });
    send(res, V.loanAppView(a), "Loan instalment updated for this run");
  });

  app.patch("/api/payroll/loan-applications/:id", (req, res) => {
    if (!h.guard(req, res, "hr")) return;
    const a = db.loanApps.find(req.params.id);
    if (!a) return err(res, 404, "Loan instalment not found");
    const item = a.runItemId ? db.items.find(a.runItemId) : null;
    if (!item) return err(res, 400, "This instalment is not attached to a payroll run.");
    const lock = editable(item);
    if (lock) return err(res, 400, lock);
    const b = h.body(req);
    if (b.appliedAmount !== undefined) {
      const amt = Math.abs(Number(b.appliedAmount) || 0);
      a.appliedAmount = Math.min(amt, a.remainingBeforeAmount || amt);
      a.isOverride = a.appliedAmount !== a.suggestedAmount;
    }
    if (b.notes !== undefined) a.notes = b.notes;
    a.updatedAt = L.nowIso();
    send(res, V.loanAppView(a), "Loan instalment updated");
  });
};
