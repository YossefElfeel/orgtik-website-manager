// Serializers: turn internal rows into the exact shapes the HR frontend reads, plus role/scope helpers.
const L = require("./lib");

module.exports = function makeViews(db, identity) {
  const V = {};

  // ---------------- people ----------------
  V.user = (id) => identity.findUser(id);
  V.emp = (id) => { const e = db.employees.find(id); return e && !e.deletedAt ? e : null; };
  V.empAny = (id) => db.employees.find(id) || null;
  V.empByUser = (userId) => V.emp(userId); // employee id == auth user id
  V.activeEmps = () => db.employees.rows.filter((e) => !e.deletedAt);
  V.fullName = (e) => (e ? `${e.firstName} ${e.lastName}`.trim() : "");
  V.dept = (id) => { const d = id != null ? db.departments.find(id) : null; return d && !d.deletedAt ? d : null; };
  V.deptName = (id) => V.dept(id)?.name || null;

  V.userMini = (userId) => {
    const u = V.user(userId);
    if (!u) return null;
    const e = db.employees.find(u.id);
    return { id: u.id, username: u.username, email: u.email, firstName: u.firstName, lastName: u.lastName, avatar: e?.avatarUrl || u.avatar || null, isActive: u.isActive, userType: u.userType || null, employeeId: e ? e.id : null };
  };

  // ---------------- roles ----------------
  V.rolesOf = (user) => {
    if (!user) return [];
    const r = new Set(identity.userScopes(user).find(scope => scope.scope === "hr_system")?.roles || []);
    return [...r];
  };
  V.has = (user, ...roles) => { const r = V.rolesOf(user); return r.includes("super_admin") || roles.some((x) => r.includes(x)); };
  V.isHR = (user) => V.has(user, "hr");
  V.isAdmin = (user) => V.rolesOf(user).includes("super_admin");
  V.isManager = (user) => V.rolesOf(user).includes("manager");
  // Everyone reporting (directly or indirectly) to this employee, plus members of departments they manage.
  V.teamIds = (empId) => {
    const out = new Set();
    const stack = [empId];
    while (stack.length) {
      const cur = stack.pop();
      for (const e of V.activeEmps()) if (e.managerId === cur && !out.has(e.id)) { out.add(e.id); stack.push(e.id); }
    }
    for (const d of db.departments.rows) if (!d.deletedAt && Number(d.managerUserId) === empId) for (const e of V.activeEmps()) if (e.departmentId === d.id && e.id !== empId) out.add(e.id);
    return out;
  };
  // Employee ids a user may see in people-scoped lists (attendance, time off...). null = everyone.
  V.visibleEmpIds = (user) => {
    if (V.has(user, "hr")) return null;
    const self = V.empByUser(user.id);
    const ids = new Set(self ? [self.id] : []);
    if (V.isManager(user) && self) for (const id of V.teamIds(self.id)) ids.add(id);
    return ids;
  };

  // ---------------- employees ----------------
  V.empListItem = (e) => {
    const mgr = e.managerId ? V.empAny(e.managerId) : null;
    return {
      id: e.id, authUserId: e.authUserId, employeeCode: e.employeeCode,
      firstName: e.firstName, lastName: e.lastName, fullName: V.fullName(e), email: e.email, phoneNumber: e.phoneNumber,
      jobTitle: e.jobTitle || "", departmentId: e.departmentId ?? null, departmentName: V.deptName(e.departmentId),
      managerId: e.managerId ?? null, managerName: mgr ? V.fullName(mgr) : null,
      status: e.status || "active", employeeType: e.employeeType || "", workLocation: e.workLocation || "", experienceLevel: e.experienceLevel || "",
      joinDate: e.joinDate || "", avatarUrl: e.avatarUrl || "", isActive: e.isActive !== false,
      onboardingComplete: !!e.onboardingComplete, completedSteps: [...(e.completedSteps || [])],
      createdAt: e.createdAt, updatedAt: e.updatedAt,
      user: V.userMini(e.authUserId),
    };
  };
  V.empSelect = (e) => ({ id: e.id, fullName: V.fullName(e), avatarUrl: e.avatarUrl || "", avatar: e.avatarUrl || null, jobTitle: e.jobTitle || null, employeeType: e.employeeType || null, employeeCode: e.employeeCode, departmentName: V.deptName(e.departmentId) });
  V.salaryInfo = (e) => {
    const s = e.salary || {};
    const { totalSalary, netSalary } = db.calcSalary(s);
    return {
      baseSalary: Number(s.baseSalary) || 0, paymentMethod: e.payment?.paymentMethod || "bank", currency: s.currency || "EGP",
      housingAllowanceValue: Number(s.housingAllowanceValue) || 0, housingAllowanceType: s.housingAllowanceType || "percentage",
      transportationAllowanceValue: Number(s.transportationAllowanceValue) || 0, transportationAllowanceType: s.transportationAllowanceType || "percentage",
      otherAllowancesValue: Number(s.otherAllowancesValue) || 0, otherAllowancesType: s.otherAllowancesType || "percentage",
      insuranceValue: Number(s.insuranceValue) || 0, insuranceType: s.insuranceType || "percentage",
      taxValue: Number(s.taxValue) || 0, taxType: s.taxType || "percentage",
      totalSalary, netSalary,
      salaryUpgradeHistory: [...(e.salaryHistory || [])].sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1)),
    };
  };
  V.paymentDetails = (e) => {
    const p = e.payment || {};
    return {
      paymentMethod: p.paymentMethod || "bank",
      paymentCycle: p.paymentCycle || "monthly",
      bank: p.bank ? { ...p.bank, accountHolder: p.bank.accountHolder || p.bank.accountHolderName || "", accountHolderName: p.bank.accountHolder || p.bank.accountHolderName || "" } : undefined,
      instapay: p.instapay || undefined,
      wallet: p.wallet || undefined,
    };
  };
  V.daysOffInfo = (e) => {
    const d = e.daysOff || {};
    const n = (x) => Number(x) || 0;
    return { annualLeave: n(d.annualLeave), casualLeave: n(d.casualLeave), sickLeave: n(d.sickLeave), unpaidLeavePolicy: d.unpaidLeavePolicy || "", contractAdds: n(d.contractAdds), totalDaysOff: n(d.annualLeave) + n(d.casualLeave) + n(d.sickLeave) + n(d.contractAdds) };
  };
  V.empDetail = (e) => {
    const base = V.empListItem(e);
    const u = V.user(e.authUserId);
    const roleIds = [];
    return {
      id: e.id, authUserId: e.authUserId, employeeCode: e.employeeCode, avatarUrl: e.avatarUrl || "",
      isActive: e.isActive !== false, lastClockedIn: e.lastClockedIn || null, lastMessaged: e.lastMessaged || null,
      onboardingComplete: !!e.onboardingComplete, completedSteps: [...(e.completedSteps || [])],
      createdAt: e.createdAt, updatedAt: e.updatedAt, deletedAt: e.deletedAt || null,
      personalInformation: {
        firstName: e.firstName, lastName: e.lastName, fullName: V.fullName(e), birthday: e.birthday || "", gender: e.gender || "",
        nationality: e.nationality || "", nationalIdOrPassport: e.nationalIdOrPassport || "", phoneNumber: e.phoneNumber || "", email: e.email,
        personalTaxId: e.personalTaxId || "", accommodationType: e.accommodationType || "",
        address: { country: e.address?.country || "", city: e.address?.city || "", street: e.address?.street || "", postCode: e.address?.postCode || "" },
      },
      employeeInformation: {
        jobTitle: base.jobTitle, departmentId: base.departmentId, departmentName: base.departmentName, employeeType: base.employeeType,
        workLocation: base.workLocation, managerId: base.managerId, managerName: base.managerName, status: base.status,
        experienceLevel: e.experienceLevel || "", joinDate: e.joinDate || "", skills: [...(e.skills || [])],
      },
      paymentDetails: V.paymentDetails(e),
      salaryInformation: V.salaryInfo(e),
      daysOffInformation: V.daysOffInfo(e),
      contract: {
        contractType: e.contract?.contractType || "", startDate: e.contract?.startDate || "", endDate: e.contract?.endDate || "",
        trainingPeriod: e.contract?.trainingPeriod || "", noticePeriod: e.contract?.noticePeriod || "",
        companyLogoFileId: e.contract?.companyLogoFileId || null, sendForSignature: !!e.contract?.sendForSignature,
        contractSections: e.contract?.contractSections || [],
      },
      permissions: { roleIds, scopeDepartmentIds: [], scopeEntityIds: [], customPermissions: [], ...(e.permissions || {}) },
      attachmentCount: db.attachments.rows.filter((a) => a.employeeId === e.id).length,
      user: u ? V.userMini(u.id) : null,
    };
  };
  V.attachment = (a) => ({ id: a.id, employeeId: a.employeeId, fileName: a.fileName, filePath: a.filePath, url: a.url, mimeType: a.mimeType, fileSize: a.fileSize, category: a.category || "document", uploadedAt: a.uploadedAt || a.createdAt });
  V.attEmployee = (e) => (e ? { id: e.id, name: V.fullName(e), avatar: e.avatarUrl || "", jobTitle: e.jobTitle || null, department: e.departmentId ? { id: e.departmentId, name: V.deptName(e.departmentId) } : null, employeeCode: e.employeeCode } : null);

  // ---------------- departments ----------------
  V.deptEmployees = (deptId) => V.activeEmps().filter((e) => e.departmentId === deptId);
  V.deptView = (d, absenteeRate = 0) => {
    const members = V.deptEmployees(d.id);
    const mgrUser = d.managerUserId ? V.user(d.managerUserId) : null;
    const mgrEmp = d.managerUserId ? V.empAny(Number(d.managerUserId)) : null;
    const budget = L.round2(members.reduce((s, e) => s + db.calcSalary(e.salary || {}).totalSalary, 0));
    return {
      id: d.id, name: d.name, description: d.description || "", managerUserId: d.managerUserId != null ? String(d.managerUserId) : null,
      createdAt: d.createdAt, updatedAt: d.updatedAt, deletedAt: d.deletedAt || null,
      employees: members.map((e) => ({ id: e.id, jobTitle: e.jobTitle || "", employeeType: e.employeeType || "", departmentId: e.departmentId, employeeCode: e.employeeCode, fullName: V.fullName(e), avatarUrl: e.avatarUrl || "", user: V.userMini(e.authUserId) })),
      absenteeRate,
      manager: mgrUser ? { id: String(mgrUser.id), username: mgrUser.username, email: mgrUser.email, avatar: mgrEmp?.avatarUrl || mgrUser.avatar || "", firstName: mgrUser.firstName, lastName: mgrUser.lastName, fullName: `${mgrUser.firstName} ${mgrUser.lastName}` } : null,
      stats: { totalEmployees: members.length, absenteeRate, budget, budgetCurrency: "EGP" },
    };
  };

  // ---------------- time off ----------------
  V.timeOffBase = (t) => {
    const e = V.empAny(t.employeeId);
    const reason = t.hrDecisionNote || t.managerDecisionNote || null;
    return {
      id: t.id, requestCode: t.requestCode, employeeId: t.employeeId,
      employeeDiscordUsername: e?.discordUsername || null, employeeDepartment: e ? V.deptName(e.departmentId) : null,
      timeOffType: t.timeOffType, status: t.status, hrActionStatus: t.hrActionStatus, managerActionStatus: t.managerActionStatus,
      durationType: t.durationType, halfDayPeriod: t.halfDayPeriod || null, startDate: t.startDate, endDate: t.endDate,
      totalDurationMinutes: t.totalDurationMinutes, partialStartTime: t.partialStartTime || null, partialEndTime: t.partialEndTime || null,
      employeeNote: t.employeeNote || "", decisionNote: reason ? { reason } : null, attachments: t.attachments || [],
      createdAt: t.createdAt, updatedAt: t.updatedAt,
    };
  };
  V.timeOffItem = (t) => {
    const e = V.empAny(t.employeeId);
    return { ...V.timeOffBase(t), employee: e ? { id: e.id, fullName: V.fullName(e), avatar: e.avatarUrl || "", departmentName: V.deptName(e.departmentId) } : null };
  };
  V.timeOffDetail = (t) => {
    const e = V.empAny(t.employeeId);
    return {
      ...V.timeOffBase(t),
      decisionNote: { reason: t.hrDecisionNote || t.managerDecisionNote || "" },
      hrDecisionNote: t.hrDecisionNote || "", managerDecisionNote: t.managerDecisionNote || "",
      decidedByUserId: t.decidedByUserId ?? null, hrDecidedByUserId: t.hrDecidedByUserId ?? null, managerDecidedByUserId: t.managerDecidedByUserId ?? null,
      decidedAt: t.decidedAt || null, hrDecidedAt: t.hrDecidedAt || null, managerDecidedAt: t.managerDecidedAt || null,
      employee: e ? { id: e.id, avatar: e.avatarUrl || null, fullName: V.fullName(e), discordUsername: e.discordUsername || null, departmentName: V.deptName(e.departmentId) } : null,
    };
  };

  // ---------------- meetings ----------------
  V.meetingEmp = (e) => (e ? { id: e.id, employeeCode: e.employeeCode, firstName: e.firstName, lastName: e.lastName, avatar: e.avatarUrl || null, departmentName: V.deptName(e.departmentId) } : null);
  V.meetingAttendees = (m) => {
    if (m.targetType === "company" || m.sendToAll) return V.activeEmps();
    const ids = new Set((m.employeeIds || []).map(Number));
    if (m.targetType === "department") for (const e of V.activeEmps()) if ((m.departmentIds || []).map(Number).includes(e.departmentId)) ids.add(e.id);
    return [...ids].map((id) => V.emp(id)).filter(Boolean);
  };
  V.meetingView = (m) => ({
    id: m.id, title: m.title, date: m.date, time: m.time, durationMinutes: m.durationMinutes, link: m.link || null, description: m.description || null,
    targetType: m.targetType, departmentIds: m.departmentIds || [], employeeIds: m.employeeIds || [],
    employees: m.targetType === "company" || m.sendToAll ? [] : V.meetingAttendees(m).map(V.meetingEmp),
    createdByEmployee: V.meetingEmp(V.empAny(m.createdBy)), sendToAll: !!m.sendToAll,
    createdBy: m.createdBy, updatedBy: m.updatedBy ?? null, createdAt: m.createdAt, updatedAt: m.updatedAt, deletedAt: m.deletedAt || null,
  });

  // ---------------- payroll ----------------
  V.runItems = (runId) => db.items.rows.filter((i) => i.runId === runId);
  V.itemAdjustments = (itemId) => db.adjustments.rows.filter((a) => a.runItemId === itemId);
  V.itemLoanApps = (itemId) => db.loanApps.rows.filter((a) => a.runItemId === itemId);
  V.itemTotals = (item) => {
    const adjs = V.itemAdjustments(item.id);
    const bonusTotal = L.round2(adjs.filter((a) => a.type === "bonus").reduce((s, a) => s + a.amount, 0));
    const deductionTotal = L.round2(adjs.filter((a) => a.type === "deduction").reduce((s, a) => s + a.amount, 0));
    const loanTotal = L.round2(V.itemLoanApps(item.id).reduce((s, a) => s + (Number(a.appliedAmount) || 0), 0));
    return { bonusTotal, deductionTotal, loanTotal, netPayable: L.round2((Number(item.periodBaseSalary) || 0) + bonusTotal - deductionTotal - loanTotal) };
  };
  V.payrollEmp = (e) => ({ id: e?.id ?? null, employeeCode: e?.employeeCode || "", name: V.fullName(e) || "Former employee", departmentName: e ? V.deptName(e.departmentId) : null, jobTitle: e?.jobTitle || "", avatarUrl: e?.avatarUrl || "" });
  V.runStatus = (run) => {
    if (run.cancelledAt) return "cancelled";
    if (run.isOpen) return "open";
    const items = V.runItems(run.id);
    const c = (s) => items.filter((i) => i.status === s).length;
    const n = items.length;
    if (n && c("paid") === n) return "paid";
    if (c("paid") > 0) return "partially_paid";
    if (c("queued") > 0) return "payout_queued";
    if (n && c("approved") === n) return "approved";
    if (c("approved") > 0) return "partially_approved";
    if (c("submitted") > 0 || c("change_requested") > 0) return "submitted";
    return "frozen";
  };
  V.runSummary = (run) => {
    const items = V.runItems(run.id);
    const tot = items.map((i) => ({ i, t: V.itemTotals(i) }));
    const c = (s) => items.filter((i) => i.status === s).length;
    const sum = (f) => L.round2(tot.reduce((s, x) => s + f(x), 0));
    const status = V.runStatus(run);
    const approvedAmt = sum((x) => (x.i.status === "approved" ? x.t.netPayable : 0));
    const queuedAmt = sum((x) => (x.i.status === "queued" ? x.t.netPayable : 0));
    const paidAmt = sum((x) => (x.i.status === "paid" ? x.t.netPayable : 0));
    return {
      id: run.id, frequency: run.frequency, periodStart: run.periodStart, periodEnd: run.periodEnd, referenceDate: run.referenceDate, status,
      itemCount: items.length, draftCount: c("draft"), submittedCount: c("submitted"), approvedCount: c("approved"), changeRequestedCount: c("change_requested"),
      queuedCount: c("queued"), paidCount: c("paid"),
      baseSalaryTotal: sum((x) => Number(x.i.periodBaseSalary) || 0), bonusTotal: sum((x) => x.t.bonusTotal), deductionTotal: sum((x) => x.t.deductionTotal),
      loanTotal: sum((x) => x.t.loanTotal), netPayableTotal: sum((x) => x.t.netPayable),
      title: run.title, pendingReviewCount: c("submitted"), pendingPayoutTotal: L.round2(approvedAmt + queuedAmt),
      decidedCount: c("approved") + c("change_requested") + c("queued") + c("paid"), flaggedCount: c("change_requested"),
      currencies: ["EGP"], displayCurrency: "EGP", note: run.note || null,
      frozenAt: run.frozenAt || null, submittedAt: run.submittedAt || null, approvedAt: run.approvedAt || null, paidAt: run.paidAt || null,
      // finance queue extras (IPayrollRunItem)
      pendingCount: c("approved"), pendingAmount: approvedAmt, queuedAmount: queuedAmt, paidAmount: paidAmt, payableAmount: L.round2(approvedAmt + queuedAmt),
      totalAmount: sum((x) => x.t.netPayable), canQueueAll: c("approved") > 0, canPayAll: c("approved") + c("queued") > 0, isClosed: ["paid", "cancelled"].includes(status),
      createdAt: run.createdAt, updatedAt: run.updatedAt,
    };
  };
  V.itemRow = (item) => {
    const e = V.empAny(item.employeeId);
    const t = V.itemTotals(item);
    return {
      id: item.id, runId: item.runId, employeeId: item.employeeId, employee: V.payrollEmp(e), currency: item.currency || "EGP",
      paymentMethod: item.paymentMethod, paymentCycle: item.paymentCycle, baseSalary: item.baseSalary, periodBaseSalary: item.periodBaseSalary,
      bonusTotal: t.bonusTotal, deductionTotal: t.deductionTotal, loanTotal: t.loanTotal, netPayable: t.netPayable,
      status: item.status, changeRequestNote: item.changeRequestNote || null,
      grossSalarySnapshot: item.grossSalarySnapshot, netSalarySnapshot: item.netSalarySnapshot, dailyRate: item.dailyRate, hourlyRate: item.hourlyRate,
      workingDaysCount: item.workingDaysCount, workedDaysCount: item.workedDaysCount, workedHours: item.workedHours,
      submittedAt: item.submittedAt || null, approvedAt: item.approvedAt || null, queuedAt: item.queuedAt || null, paidAt: item.paidAt || null,
      payslipGeneratedAt: item.payslipGeneratedAt || null, payslipSentAt: item.payslipSentAt || null,
    };
  };
  V.loanAppView = (a) => {
    const loan = db.loans.find(a.loanId);
    const run = a.runId ? db.runs.find(a.runId) : null;
    const item = a.runItemId ? db.items.find(a.runItemId) : null;
    return {
      id: a.id, loanId: a.loanId, loanTitle: loan?.title || "Loan", runId: a.runId, runItemId: a.runItemId, frequency: a.frequency,
      periodStart: a.periodStart, periodEnd: a.periodEnd, referenceDate: run?.referenceDate || a.periodStart,
      runStatus: run ? V.runStatus(run) : "paid", itemStatus: item?.status || (a.isPaid ? "paid" : "draft"),
      suggestedAmount: a.suggestedAmount, appliedAmount: a.appliedAmount, remainingBeforeAmount: a.remainingBeforeAmount,
      projectedRemainingAfterAmount: L.round2(Math.max(0, (a.remainingBeforeAmount || 0) - (a.appliedAmount || 0))),
      isOverride: !!a.isOverride, isPaid: !!a.isPaid, paidAt: a.paidAt || null, notes: a.notes || null,
    };
  };
  // Full item for the HR draft sheet: deductions carry negative amounts (the sheet adds them).
  V.itemFull = (item, { signed = true } = {}) => ({
    ...V.itemRow(item),
    adjustments: V.itemAdjustments(item.id).map((a) => ({ id: a.id, type: a.type, mode: a.mode, value: a.value, amount: signed && a.type === "deduction" ? -Math.abs(a.amount) : Math.abs(a.amount), reason: a.reason, createdAt: a.createdAt })),
    loanApplications: V.itemLoanApps(item.id).map(V.loanAppView),
  });
  V.payoutRow = (item) => {
    const e = V.empAny(item.employeeId);
    const r = V.itemRow(item);
    const p = e?.payment || {};
    const target = p.paymentMethod === "bank" ? p.bank?.iban : p.paymentMethod === "instapay" ? `InstaPay ${p.instapay?.registeredNumber || ""}` : `${L.labelize(p.wallet?.walletName || "wallet")} Cash ${p.wallet?.phoneNumber || ""}`;
    return {
      id: item.id, runId: item.runId, employee: r.employee, paymentMethod: item.paymentMethod, paymentCycle: item.paymentCycle, currency: item.currency || "EGP",
      iban: target || null, bankName: p.bank?.bankName || null, accountNumber: p.bank?.accountNumber || null, accountHolderName: p.bank?.accountHolder || null,
      instapayRegisteredNumber: p.instapay?.registeredNumber || null, walletPhoneNumber: p.wallet?.phoneNumber || null,
      baseSalary: r.baseSalary, periodBaseSalary: r.periodBaseSalary, bonusTotal: r.bonusTotal, deductionTotal: r.deductionTotal, loanTotal: r.loanTotal,
      amount: r.netPayable, status: item.status, approvedAt: item.approvedAt || null, queuedAt: item.queuedAt || null, paidAt: item.paidAt || null,
    };
  };
  V.payslipItem = (item) => {
    const run = db.runs.find(item.runId);
    return {
      id: item.id, runId: item.runId, periodTitle: run?.title || "", periodStart: run?.periodStart || "", periodEnd: run?.periodEnd || "",
      netPayable: V.itemTotals(item).netPayable, currency: item.currency || "EGP", paidAt: item.paidAt || null,
      payslipGeneratedAt: item.payslipGeneratedAt || null, hasPayslip: item.status === "paid", status: item.status, frequency: run?.frequency,
      createdAt: item.createdAt,
    };
  };

  // ---------------- loans ----------------
  V.loanPaid = (loan) => L.round2(db.loanApps.rows.filter((a) => a.loanId === loan.id && a.isPaid).reduce((s, a) => s + (Number(a.appliedAmount) || 0), 0));
  V.loanView = (loan) => {
    const e = V.empAny(loan.employeeId);
    const paid = V.loanPaid(loan);
    const remaining = loan.remainingOverride != null ? loan.remainingOverride : L.round2(Math.max(0, loan.principalAmount - paid));
    return {
      id: loan.id, employeeId: loan.employeeId, employee: { id: e?.id ?? loan.employeeId, employeeCode: e?.employeeCode || "", name: V.fullName(e), departmentName: e ? V.deptName(e.departmentId) : null, jobTitle: e?.jobTitle || null },
      title: loan.title, principalAmount: loan.principalAmount, installmentAmount: loan.installmentAmount, paidAmount: paid, remainingAmount: remaining,
      currency: loan.currency || "EGP", startDate: loan.startDate, status: loan.status, reason: loan.reason || "", durationMonths: loan.durationMonths,
      createdAt: loan.createdAt, updatedAt: loan.updatedAt,
    };
  };
  V.loanDetail = (loan) => {
    const apps = db.loanApps.rows.filter((a) => a.loanId === loan.id).sort((a, b) => (a.periodStart < b.periodStart ? -1 : 1));
    return { ...V.loanView(loan), installmentCount: apps.length, paidInstallmentCount: apps.filter((a) => a.isPaid).length, pendingInstallmentCount: apps.filter((a) => !a.isPaid).length, installments: apps.map(V.loanAppView) };
  };

  // ---------------- recruitment ----------------
  V.jobUser = (userId) => { const m = V.userMini(Number(userId)); return m ? { id: m.id, username: m.username, email: m.email, firstName: m.firstName, lastName: m.lastName, avatar: m.avatar || "", isActive: m.isActive, userType: m.userType } : null; };
  V.jobDept = (id) => { const d = db.departments.find(id); return d ? { id: d.id, name: d.name, description: d.description, managerUserId: String(d.managerUserId ?? ""), createdAt: d.createdAt, updatedAt: d.updatedAt, deletedAt: d.deletedAt || null } : null; };
  V.jobView = (j) => {
    const apps = db.applications.rows.filter((a) => a.jobId === j.id && !a.deletedAt);
    const appIds = new Set(apps.map((a) => a.id));
    return {
      ...j, department: V.jobDept(j.departmentId), createdByUser: V.jobUser(j.createdBy), updatedByUser: V.jobUser(j.updatedBy),
      totalApplied: apps.length, totalInterviews: db.appointments.rows.filter((a) => appIds.has(a.applicationId) && !a.deletedAt).length,
    };
  };
  V.appointmentView = (a) => ({ id: a.id, applicationId: a.applicationId, startAt: a.startAt, endAt: a.endAt, interviewWith: a.interviewWith, interviewLink: a.interviewLink || "", note: a.note || "", createdBy: a.createdBy, createdAt: a.createdAt, updatedAt: a.updatedAt, deletedAt: a.deletedAt || null, createdByUser: V.jobUser(a.createdBy) });
  V.applicationView = (a) => {
    const job = db.jobs.find(a.jobId);
    const stages = db.stages.rows.filter((s) => s.applicationId === a.id).sort((x, y) => (x.stageAt < y.stageAt ? -1 : x.stageAt > y.stageAt ? 1 : x.id - y.id));
    const appts = db.appointments.rows.filter((x) => x.applicationId === a.id && !x.deletedAt).sort((x, y) => (x.startAt < y.startAt ? 1 : -1));
    return {
      ...a, job: job ? V.jobView(job) : undefined,
      stages: stages.map((s) => ({ id: s.id, applicationId: s.applicationId, stage: s.stage, stageAt: s.stageAt, note: s.note || "", updatedBy: s.updatedBy, createdAt: s.createdAt, updatedByUser: s.updatedBy ? V.jobUser(s.updatedBy) : undefined })),
      appointment: appts[0] ? V.appointmentView(appts[0]) : null,
    };
  };
  V.appNoteView = (n) => ({ id: n.id, applicationId: n.applicationId, authorUserId: n.authorUserId, authorName: n.authorName, note: n.note, createdAt: n.createdAt, updatedAt: n.updatedAt, deletedAt: n.deletedAt || null, author: V.jobUser(n.authorUserId) });

  // ---------------- tickets ----------------
  V.ticketUser = (userId) => { const m = V.userMini(userId); return m ? { id: m.id, username: m.username, email: m.email, firstName: m.firstName, lastName: m.lastName, avatar: m.avatar || "", employeeId: m.employeeId } : null; };
  V.ticketItem = (t) => {
    const c = V.userMini(t.createdByUserId);
    return {
      id: t.id, subject: t.subject, status: t.status, createdAt: t.createdAt, updatedAt: t.updatedAt, departmentId: t.departmentId,
      createdBy: c ? { id: c.id, email: c.email, avatar: c.avatar || "", name: `${c.firstName} ${c.lastName}` } : null,
      assignedTo: (t.assignedUserIds || []).map((id) => V.userMini(id)).filter(Boolean).map((u) => ({ id: u.id, avatar: u.avatar || "", name: `${u.firstName} ${u.lastName}` })),
    };
  };
  V.ticketDetail = (t) => {
    const d = db.departments.find(t.departmentId);
    return {
      id: t.id, subject: t.subject, description: t.description, departmentId: t.departmentId != null ? String(t.departmentId) : null, status: t.status,
      assignedUserIds: (t.assignedUserIds || []).map(String), assignees: (t.assignedUserIds || []).map(V.ticketUser).filter(Boolean),
      createdAt: t.createdAt, updatedAt: t.updatedAt, attachments: t.attachments || [],
      messageMeta: { total: db.messages.rows.filter((m) => m.ticketId === t.id).length },
      department: d ? V.deptView(d) : null, createdBy: V.ticketUser(t.createdByUserId),
    };
  };
  V.messageView = (m) => ({ id: m.id, ticketId: m.ticketId, senderUserId: m.senderUserId, sender: V.ticketUser(m.senderUserId), content: m.content, createdAt: m.createdAt, attachments: m.attachments || [] });

  // ---------------- activity & notifications ----------------
  const VERBS = { TICKET_CREATED: "created", TICKET_USERS_ASSIGNED: "assigned people on", TICKET_STATUS_UPDATED: "updated the status of", TICKET_MESSAGE_ADDED: "replied on" };
  V.activityView = (l, { friendly = false } = {}) => {
    const u = V.userMini(l.performedBy);
    return {
      id: l.id, action: friendly ? VERBS[l.action] || l.action : l.action, entityType: l.entityType, entityId: String(l.entityId), performedBy: l.performedBy,
      performedByUser: u ? { id: u.id, employeeId: u.employeeId, username: u.username, email: u.email, firstName: u.firstName, lastName: u.lastName, avatar: u.avatar || "", isActive: u.isActive, userType: u.userType } : null,
      metadata: l.metadata || {}, createdAt: l.createdAt,
    };
  };
  V.notificationView = (n) => ({ id: n.id, recipientUserId: n.recipientUserId, actorUserId: n.actorUserId ?? null, action: n.action, title: n.title, body: n.body, priority: n.priority, channels: n.channels, deliveredChannels: n.deliveredChannels, failedChannels: n.failedChannels, entityType: n.entityType ?? null, entityId: n.entityId ?? null, data: n.data ?? null, readAt: n.readAt ?? null, createdAt: n.createdAt });

  return V;
};
