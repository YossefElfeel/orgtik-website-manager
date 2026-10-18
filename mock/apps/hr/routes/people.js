// Employees (8-step onboarding wizard), attachments, notes, activity logs, departments, org chart.
module.exports = function peopleRoutes(app, h) {
  const { db, V, C, L, identity, ctx } = h;
  const { send, err } = L;
  const STEPS = ["user_base_info", "employee_info", "payment_method", "salary", "contract", "days_off", "permissions", "attachments"];
  const STEP_LABEL = { user_base_info: "Personal information", employee_info: "Employee information", payment_method: "Payment details", salary: "Salary", contract: "Contract", days_off: "Days off", permissions: "Permissions", attachments: "Attachments" };

  const findEmp = (req, res) => {
    const e = V.emp(Number(req.params.id));
    if (!e) err(res, 404, "Employee not found");
    if (e && identity.workspaceMode && !canSee(req, e)) { err(res, 404, "Employee not found"); return null; }
    return e;
  };
  const canSee = (req, e) => V.has(req.user, "hr", "finance_manager") || req.user.id === e.authUserId || (V.isManager(req.user) && V.teamIds(req.user.id).has(e.id));
  const matches = (e, q) => !q || `${V.fullName(e)} ${e.email} ${e.employeeCode} ${e.jobTitle || ""}`.toLowerCase().includes(String(q).toLowerCase().trim());
  const touch = (e) => { e.updatedAt = L.nowIso(); };
  const markStep = (e, step) => {
    if (!e.completedSteps.includes(step)) e.completedSteps.push(step);
    e.completedSteps.sort((a, b) => STEPS.indexOf(a) - STEPS.indexOf(b));
    e.onboardingComplete = STEPS.every((s) => e.completedSteps.includes(s));
  };

  // ---------------- lists ----------------
  app.get("/api/employees/select-options", (req, res) => {
    const list = V.activeEmps().filter((e) => e.isActive !== false && matches(e, req.query.search)).sort((a, b) => V.fullName(a).localeCompare(V.fullName(b)));
    const { items, meta } = L.pageOf(list.map(V.empSelect), req.query, 50);
    send(res, { items, meta }, "Employees fetched");
  });

  app.get("/api/employees/org-chart", (req, res) => {
    let list = V.activeEmps();
    const root = req.query.rootManagerId ? Number(req.query.rootManagerId) : null;
    if (root) {
      const depth = req.query.depth ? Number(req.query.depth) : 99;
      const keep = new Set([root]);
      let frontier = [root];
      for (let d = 0; d < depth && frontier.length; d++) {
        frontier = list.filter((e) => frontier.includes(e.managerId)).map((e) => e.id);
        frontier.forEach((id) => keep.add(id));
      }
      list = list.filter((e) => keep.has(e.id));
    }
    const ids = new Set(list.map((e) => e.id));
    const nodes = list.map((e) => ({
      id: e.id, employeeCode: e.employeeCode, fullName: V.fullName(e), jobTitle: e.jobTitle || "", departmentName: V.deptName(e.departmentId) || "",
      avatarUrl: e.avatarUrl || "", status: e.status, managerId: ids.has(e.managerId) ? e.managerId : null,
      children: list.filter((c) => c.managerId === e.id).map((c) => String(c.id)),
    }));
    send(res, nodes, "Org chart fetched");
  });

  app.get("/api/employees", (req, res) => {
    const q = req.query;
    let list = V.activeEmps().filter((e) => matches(e, q.search));
    if (q.departmentId && q.departmentId !== "all") list = list.filter((e) => String(e.departmentId) === String(q.departmentId));
    if (q.status) list = list.filter((e) => e.status === q.status);
    if (q.employeeType) list = list.filter((e) => e.employeeType === q.employeeType);
    list = L.sortBy(list, q.sortBy || "createdAt", q.order || "DESC");
    L.paged(res, list.map(V.empListItem), q, "Employees fetched");
  });

  // ---------------- create (wizard step 1) ----------------
  app.post("/api/employees", async (req, res) => {
    if (!h.guard(req, res, "hr")) return;
    const b = h.body(req);
    if (identity.workspaceMode) {
      const fields = ["firstName", "lastName", "email", "phoneNumber", "birthday", "gender", "nationality", "nationalIdOrPassport", "personalTaxId", "accommodationType", "country", "city", "street", "postCode", "tools"];
      const payload = Object.fromEntries(fields.filter(key => b[key] !== undefined).map(key => [key, b[key]]));
      try { return send(res, await h.command(req, "hr.hire", payload), "Hiring command staged", 201); }
      catch (error) { return res.status(error.status || 503).json({ success: false, code: error.code || "workspace_command_required", message: error.message }); }
    }
    const email = String(b.email || "").trim().toLowerCase();
    if (!b.firstName || !b.lastName || !email) return err(res, 400, "First name, last name and email are required.");
    const clash = db.employees.rows.find((e) => e.email.toLowerCase() === email && !e.deletedAt);
    if (clash) return err(res, 409, "An employee with this email already exists.");
    const now = L.nowIso();
    let user = identity.findByEmail(email);
    if (!user) {
      const id = Math.max(...identity.users.map((u) => u.id)) + 1;
      user = {
        id, key: `hr-${id}`, email, username: `${b.firstName}.${b.lastName}`.toLowerCase().replace(/\s+/g, ""), firstName: b.firstName, lastName: b.lastName,
        avatar: null, isActive: true, isEmailVerified: true, managerId: null, userType: "employee", phone: b.phoneNumber || null,
        password: b.password || identity.LOCAL_PASSWORD, createdAt: now, updatedAt: now,
        profile: { id, jobTitle: null, department: null, about: null, language: "en", timeZone: "Africa/Cairo", weekStartDay: "saturday", dateFormat: "DD/MM/YYYY", timeFormat: "24h", flyoutToastMessage: true, timezoneChangeNotification: true, createdAt: now, updatedAt: now },
      };
      identity.users.push(user);
      (identity.grants.global = identity.grants.global || {})[user.key] = { roles: [], permissions: [] };
      (identity.grants.hr_system = identity.grants.hr_system || {})[user.key] = { roles: ["employee"], permissions: [] };
    } else if (b.password) user.password = b.password;
    const existing = db.employees.find(user.id);
    if (existing) db.employees.remove(existing.id); // re-hire of a soft-deleted employee
    const e = {
      id: user.id, authUserId: user.id, userKey: user.key, employeeCode: `EMP-${1000 + user.id}`,
      firstName: b.firstName, lastName: b.lastName, email, phoneNumber: b.phoneNumber || "",
      birthday: L.normDate(b.birthday) || "", gender: b.gender || "", nationality: b.nationality || "", nationalIdOrPassport: b.nationalIdOrPassport || "",
      personalTaxId: b.personalTaxId || "", accommodationType: b.accommodationType || "own_accommodation",
      address: { country: b.country || "", city: b.city || "", street: b.street || "", postCode: b.postCode || "" },
      jobTitle: user.profile?.jobTitle || "", departmentId: null, managerId: null, employeeType: "", workLocation: "", status: "active", experienceLevel: "", joinDate: L.todayStr(), skills: [],
      payment: { paymentMethod: "bank", paymentCycle: "monthly", bank: null, instapay: null, wallet: null },
      salary: { baseSalary: 0, housingAllowanceValue: 0, housingAllowanceType: "percentage", transportationAllowanceValue: 0, transportationAllowanceType: "percentage", otherAllowancesValue: 0, otherAllowancesType: "percentage", insuranceValue: 0, insuranceType: "percentage", taxValue: 0, taxType: "percentage", currency: "EGP" },
      salaryHistory: [], daysOff: { annualLeave: 0, casualLeave: 0, sickLeave: 0, unpaidLeavePolicy: "", contractAdds: 0 },
      contract: { contractType: "", startDate: "", endDate: null, trainingPeriod: "", noticePeriod: "", sendForSignature: false, companyLogoFileId: null, contractSections: [] },
      permissions: { roleIds: [], scopeDepartmentIds: [], scopeEntityIds: [], customPermissions: [] },
      completedSteps: ["user_base_info"], onboardingComplete: false, avatarUrl: "", isActive: true,
      discordUserId: `11893${String(Date.now()).slice(-9)}${String(user.id).padStart(4, "0")}`, discordUsername: `${b.firstName}.${b.lastName}`.toLowerCase().replace(/\s+/g, ""),
      lastClockedIn: null, lastMessaged: null, createdAt: now, updatedAt: now, deletedAt: null,
    };
    db.employees.rows.push(e);
    h.log("created", "Employee", e.id, req.user.id, { employeeCode: e.employeeCode });
    send(res, { ...V.empListItem(e), completedSteps: e.completedSteps }, "Employee created successfully", 201);
  });

  app.get("/api/employees/:id", (req, res) => {
    const e = findEmp(req, res);
    if (e) send(res, V.empDetail(e), "Employee fetched");
  });

  app.patch("/api/employees/:id", (req, res) => {
    if (!h.guard(req, res, "hr")) return;
    const e = findEmp(req, res);
    if (!e) return;
    const b = h.body(req);
    for (const k of ["jobTitle", "status", "employeeType", "workLocation", "experienceLevel", "phoneNumber"]) if (b[k] !== undefined) e[k] = b[k];
    if (b.departmentId !== undefined) e.departmentId = b.departmentId ? Number(b.departmentId) : null;
    if (b.managerId !== undefined) e.managerId = b.managerId ? Number(b.managerId) : null;
    touch(e);
    h.log("updated", "Employee", e.id, req.user.id, {});
    send(res, V.empDetail(e), "Employee updated successfully");
  });

  app.get('/api/employees/:id/offboarding-options', async (req, res) => {
    if (!h.guard(req, res, 'hr')) return;
    const e = findEmp(req, res); if (!e) return;
    try { return send(res, await h.command(req, 'hr.offboarding.options', { employeeId: e.id }), 'Offboarding options fetched'); }
    catch (error) { return res.status(error.status || 503).json({ success: false, code: error.code, message: error.message }); }
  });
  app.post('/api/employees/:id/offboarding-actions', async (req, res) => {
    if (!h.guard(req, res, 'hr')) return;
    const e = findEmp(req, res); if (!e) return;
    try { return send(res, await h.command(req, 'hr.offboarding.action', { employeeId: e.id, offboardingId: req.body?.offboardingId, action: req.body?.action, ...(req.body?.note !== undefined ? { note: req.body.note } : {}) }), 'Offboarding action recorded'); }
    catch (error) { return res.status(error.status || 503).json({ success: false, code: error.code, message: error.message }); }
  });
  app.delete("/api/employees/:id", async (req, res) => {
    if (!h.guard(req, res, "hr")) return;
    const e = findEmp(req, res);
    if (!e) return;
    if (e.id === req.user.id) return err(res, 400, "You can't delete your own employee record.");
    if (identity.workspaceMode) {
      try { return send(res, await h.command(req, "hr.offboard", { employeeId: e.id, effectiveAt: req.body?.effectiveAt, transfer: req.body?.transfer }), "Offboarding command staged"); }
      catch (error) { return res.status(error.status || 503).json({ success: false, code: error.code || "workspace_command_required", message: error.message }); }
    }
    e.deletedAt = L.nowIso();
    e.isActive = false;
    for (const d of db.departments.rows) if (Number(d.managerUserId) === e.id) d.managerUserId = null;
    for (const x of db.employees.rows) if (x.managerId === e.id) x.managerId = null;
    h.log("deleted", "Employee", e.id, req.user.id, {});
    send(res, { id: e.id, deletedAt: e.deletedAt }, "Employee deleted successfully");
  });

  // ---------------- onboarding wizard ----------------
  const normStep = (s) => (s === "bank_info" ? "payment_method" : s);
  function stepData(e, rawStep) {
    const step = normStep(rawStep);
    if (!STEPS.includes(step)) return undefined;
    if (!e.completedSteps.includes(step) && step !== "user_base_info") return null;
    switch (step) {
      case "user_base_info":
        return { firstName: e.firstName, lastName: e.lastName, birthday: e.birthday, gender: e.gender, nationality: e.nationality, nationalIdOrPassport: e.nationalIdOrPassport, phoneNumber: e.phoneNumber, email: e.email, country: e.address.country, city: e.address.city, street: e.address.street, postCode: e.address.postCode, personalTaxId: e.personalTaxId, accommodationType: e.accommodationType };
      case "employee_info":
        return { jobTitle: e.jobTitle, departmentId: e.departmentId, employeeType: e.employeeType, experienceLevel: e.experienceLevel, managerId: e.managerId, status: e.status, workLocation: e.workLocation, joinDate: e.joinDate, skills: e.skills };
      case "payment_method":
      case "bank_info": {
        const p = V.paymentDetails(e);
        return { paymentMethod: p.paymentMethod, paymentCycle: p.paymentCycle, bank: p.bank || null, instapay: p.instapay || null, wallet: p.wallet || null };
      }
      case "salary": {
        const s = V.salaryInfo(e);
        delete s.salaryUpgradeHistory;
        return s;
      }
      case "contract":
        return { ...e.contract, contractSections: (e.contract.contractSections || []).map((c, i) => ({ id: c.id || `clause-${i + 1}`, title: c.title, content: c.content, order: c.order ?? i + 1 })) };
      case "days_off":
        return V.daysOffInfo(e);
      case "permissions":
        return { roleIds: e.permissions?.roleIds || [], scopes: {} };
      case "attachments":
        return { items: db.attachments.rows.filter((a) => a.employeeId === e.id).map(V.attachment) };
      default:
        return undefined;
    }
  }

  app.get("/api/employees/:id/onboarding/:step", (req, res) => {
    const e = findEmp(req, res);
    if (!e) return;
    const data = stepData(e, req.params.step);
    if (data === undefined) return err(res, 400, `Unknown onboarding step "${req.params.step}"`);
    send(res, { step: req.params.step, completed: e.completedSteps.includes(normStep(req.params.step)), data }, "Onboarding step fetched");
  });

  app.patch("/api/employees/:id/onboarding", (req, res) => {
    if (!h.guard(req, res, "hr")) return;
    const e = findEmp(req, res);
    if (!e) return;
    const { step } = h.body(req);
    const d = h.body(req).data || {};
    const u = identity.findUser(e.authUserId);
    switch (step) {
      case "user_base_info": {
        const email = d.email ? String(d.email).trim().toLowerCase() : e.email;
        if (email !== e.email) {
          if (db.employees.rows.some((x) => x.id !== e.id && !x.deletedAt && x.email.toLowerCase() === email)) return err(res, 409, "An employee with this email already exists.");
          if (identity.users.some((x) => x.id !== e.authUserId && x.email.toLowerCase() === email)) return err(res, 409, "This email is already used by another account.");
        }
        Object.assign(e, {
          firstName: d.firstName ?? e.firstName, lastName: d.lastName ?? e.lastName, email, phoneNumber: d.phoneNumber ?? e.phoneNumber,
          birthday: L.normDate(d.birthday) || e.birthday, gender: d.gender ?? e.gender, nationality: d.nationality ?? e.nationality,
          nationalIdOrPassport: d.nationalIdOrPassport ?? e.nationalIdOrPassport, personalTaxId: d.personalTaxId ?? e.personalTaxId,
          accommodationType: d.accommodationType ?? e.accommodationType,
          address: { country: d.country ?? e.address.country, city: d.city ?? e.address.city, street: d.street ?? e.address.street, postCode: d.postCode ?? e.address.postCode },
        });
        if (u && !identity.workspaceMode) Object.assign(u, { firstName: e.firstName, lastName: e.lastName, email: e.email, phone: e.phoneNumber || u.phone, updatedAt: L.nowIso(), ...(d.password ? { password: d.password } : {}) });
        break;
      }
      case "employee_info": {
        if (d.departmentId && !V.dept(Number(d.departmentId))) return err(res, 400, "Department not found.");
        if (d.managerId && Number(d.managerId) === e.id) return err(res, 400, "An employee can't be their own manager.");
        if (d.managerId && !V.emp(Number(d.managerId))) return err(res, 400, "Manager not found.");
        Object.assign(e, {
          jobTitle: d.jobTitle ?? e.jobTitle, departmentId: d.departmentId ? Number(d.departmentId) : e.departmentId, employeeType: d.employeeType ?? e.employeeType,
          joinDate: L.normDate(d.joinDate) || e.joinDate, workLocation: d.workLocation ?? e.workLocation, managerId: d.managerId ? Number(d.managerId) : d.managerId === null ? null : e.managerId,
          status: d.status ?? e.status, experienceLevel: d.experienceLevel ?? e.experienceLevel, skills: Array.isArray(d.skills) ? d.skills : e.skills,
        });
        if (u?.profile && !identity.workspaceMode) Object.assign(u.profile, { jobTitle: e.jobTitle, department: V.deptName(e.departmentId) });
        break;
      }
      case "payment_method":
      case "bank_info": {
        const method = d.paymentMethod || e.payment.paymentMethod || "bank";
        const src = d.bank || d.instapay || d.wallet || {};
        const prev = e.payment;
        e.payment = {
          paymentMethod: method, paymentCycle: src.paymentCycle || prev.paymentCycle || "monthly",
          bank: d.bank ? { bankName: d.bank.bankName || "", bankCode: d.bank.bankCode || prev.bank?.bankCode || "", accountNumber: d.bank.accountNumber || "", iban: d.bank.iban || "", accountHolder: d.bank.accountHolderName || d.bank.accountHolder || "", currency: d.bank.currency || "EGP", paymentCycle: d.bank.paymentCycle || "monthly" } : method === "bank" ? prev.bank : null,
          instapay: d.instapay ? { registeredNumber: d.instapay.registeredNumber || "", accountName: d.instapay.accountName || "", linkedAccount: d.instapay.linkedAccount || "", paymentCycle: d.instapay.paymentCycle || "monthly" } : method === "instapay" ? prev.instapay : null,
          wallet: d.wallet ? { walletName: d.wallet.walletName || "", phoneNumber: d.wallet.phoneNumber || "", accountName: d.wallet.accountName || "", paymentCycle: d.wallet.paymentCycle || "monthly" } : method === "wallet" ? prev.wallet : null,
        };
        break;
      }
      case "salary": {
        const n = (v, dflt) => (v === undefined || v === null || v === "" ? dflt : Number(v) || 0);
        const s = e.salary;
        const next = {
          baseSalary: n(d.baseSalary, s.baseSalary), housingAllowanceValue: n(d.housingAllowanceValue, s.housingAllowanceValue), housingAllowanceType: d.housingAllowanceType || s.housingAllowanceType,
          transportationAllowanceValue: n(d.transportationAllowanceValue, s.transportationAllowanceValue), transportationAllowanceType: d.transportationAllowanceType || s.transportationAllowanceType,
          otherAllowancesValue: n(d.otherAllowancesValue, s.otherAllowancesValue), otherAllowancesType: d.otherAllowancesType || s.otherAllowancesType,
          insuranceValue: n(d.insuranceValue, s.insuranceValue), insuranceType: d.insuranceType || s.insuranceType,
          taxValue: n(d.taxValue, s.taxValue), taxType: d.taxType || s.taxType, currency: s.currency || "EGP",
        };
        const changed = JSON.stringify(next) !== JSON.stringify(s) || !e.salaryHistory.length;
        e.salary = next;
        if (d.paymentMethod && ["bank", "instapay", "wallet"].includes(d.paymentMethod) && !e.completedSteps.includes("payment_method")) e.payment.paymentMethod = d.paymentMethod;
        if (changed) e.salaryHistory.push({ id: e.id * 10 + e.salaryHistory.length + 1, ...next, paymentMethod: e.payment.paymentMethod, ...db.calcSalary(next), changedByUserId: req.user.id, recordedAt: L.nowIso() });
        break;
      }
      case "contract":
        e.contract = {
          contractType: d.contractType ?? e.contract.contractType, startDate: L.normDate(d.startDate) || e.contract.startDate, endDate: d.endDate ? L.normDate(d.endDate) : null,
          trainingPeriod: d.trainingPeriod ?? e.contract.trainingPeriod, noticePeriod: d.noticePeriod ?? e.contract.noticePeriod,
          sendForSignature: !!d.sendForSignature, companyLogoFileId: d.companyLogoFileId ?? null,
          contractSections: Array.isArray(d.contractSections) ? d.contractSections.map((c, i) => ({ id: c.id || `clause-${i + 1}`, title: c.title || "", content: c.content || "", order: c.order ?? i + 1 })) : e.contract.contractSections,
        };
        break;
      case "days_off":
        e.daysOff = { annualLeave: Number(d.annualLeave) || 0, casualLeave: Number(d.casualLeave) || 0, sickLeave: Number(d.sickLeave) || 0, unpaidLeavePolicy: d.unpaidLeavePolicy || "", contractAdds: Number(d.contractAdds) || 0 };
        break;
      case "permissions":
        if (d && Array.isArray(d.roleIds)) e.permissions.roleIds = d.roleIds;
        break;
      case "attachments":
        break;
      default:
        return err(res, 400, `Unknown onboarding step "${step}"`);
    }
    markStep(e, step === "bank_info" ? "payment_method" : step);
    touch(e);
    h.log("updated", "Employee", e.id, req.user.id, { step });
    send(res, { id: e.id, step, completedSteps: [...e.completedSteps], onboardingComplete: e.onboardingComplete }, `${STEP_LABEL[step] || "Step"} saved successfully`);
  });

  // ---------------- avatar ----------------
  app.post("/api/employees/:id/onboarding/avatar", ctx.upload.single("avatar"), (req, res) => {
    if (!h.guard(req, res, "hr")) return;
    const e = findEmp(req, res);
    if (!e) return;
    const f = req.file || (req.files || [])[0];
    if (!f) return err(res, 400, "No avatar file was uploaded (field name: avatar).");
    e.avatarUrl = ctx.fileUrl(f.filename);
    touch(e);
    send(res, { id: e.id, avatarUrl: e.avatarUrl, url: e.avatarUrl }, "Avatar uploaded successfully");
  });
  app.delete("/api/employees/:id/onboarding/avatar", (req, res) => {
    if (!h.guard(req, res, "hr")) return;
    const e = findEmp(req, res);
    if (!e) return;
    e.avatarUrl = "";
    touch(e);
    send(res, { id: e.id, avatarUrl: null }, "Avatar deleted successfully");
  });

  // ---------------- attachments ----------------
  app.get("/api/employees/:id/attachments", (req, res) => {
    const e = findEmp(req, res);
    if (!e) return;
    const list = db.attachments.rows.filter((a) => a.employeeId === e.id).sort((a, b) => ((a.uploadedAt || a.createdAt) < (b.uploadedAt || b.createdAt) ? 1 : -1)).map(V.attachment);
    const { items, meta } = L.pageOf(list, req.query, 100);
    send(res, { items, meta }, "Attachments fetched");
  });
  app.post("/api/employees/:id/attachments", h.anyFiles, (req, res) => {
    if (!h.guard(req, res, "hr")) return;
    const e = findEmp(req, res);
    if (!e) return;
    const files = req.files || [];
    if (!files.length) return err(res, 400, "No files were uploaded (field name: files).");
    const created = files.map((f) => db.attachments.insert({ employeeId: e.id, ...h.fileMeta(f), category: "document", uploadedAt: L.nowIso() }));
    markStep(e, "attachments");
    touch(e);
    h.log("uploaded an attachment to", "Employee", e.id, req.user.id, { count: created.length });
    send(res, { items: created.map(V.attachment), completedSteps: e.completedSteps }, files.length > 1 ? `${files.length} attachments uploaded successfully` : "Attachment uploaded successfully", 201);
  });
  app.delete("/api/employees/:id/attachments/:attachmentId", (req, res) => {
    if (!h.guard(req, res, "hr")) return;
    const a = db.attachments.find(req.params.attachmentId);
    if (!a || String(a.employeeId) !== String(req.params.id)) return err(res, 404, "Attachment not found");
    db.attachments.remove(a.id);
    send(res, { id: a.id }, "Attachment deleted successfully");
  });

  // ---------------- attendance / leaves of one employee ----------------
  app.get("/api/employees/:id/attendance", (req, res) => {
    const e = findEmp(req, res);
    if (!e) return;
    const today = L.todayStr();
    const from = L.normDate(req.query.from || req.query.startDate) || L.addDays(today, -120);
    const to = L.normDate(req.query.to || req.query.endDate) || today;
    L.paged(res, C.employeeDays(e, from, to), req.query, "Attendance fetched");
  });
  app.get("/api/employees/:id/leaves", (req, res) => {
    const e = findEmp(req, res);
    if (!e) return;
    const list = db.timeOffs.rows.filter((t) => t.employeeId === e.id).sort((a, b) => (a.startDate < b.startDate ? 1 : -1)).map((t) => {
      const days = C.workDaysOf(t);
      return {
        id: t.id, leaveType: t.timeOffType, dateFrom: t.startDate, dateTo: t.endDate,
        duration: t.durationType === "full_day" ? `${days} ${days === 1 ? "day" : "days"}` : `${Math.round((t.totalDurationMinutes / 60) * 10) / 10} hours`,
        status: L.labelize(t.status), note: t.employeeNote || "",
      };
    });
    const { items, meta } = L.pageOf(list, req.query);
    send(res, { summary: C.leaveSummary(e), items, meta }, "Leaves fetched");
  });

  // ---------------- notes ----------------
  const noteView = (n) => {
    const u = V.userMini(n.createdByUserId);
    return { id: n.id, content: n.content, createdByUser: u ? { id: u.id, firstName: u.firstName, lastName: u.lastName, username: u.username, email: u.email, avatar: u.avatar || "" } : null, createdAt: n.createdAt, updatedAt: n.updatedAt };
  };
  app.get("/api/employees/:id/notes", (req, res) => {
    const e = findEmp(req, res);
    if (!e) return;
    send(res, db.notes.rows.filter((n) => n.employeeId === e.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map(noteView), "Notes fetched");
  });
  app.post("/api/employees/:id/notes", (req, res) => {
    const e = findEmp(req, res);
    if (!e) return;
    const content = String(h.body(req).content || "").trim();
    if (!content) return err(res, 400, "Note content is required.");
    const n = db.notes.insert({ employeeId: e.id, createdByUserId: req.user.id, content });
    h.log("added a note to", "Employee", e.id, req.user.id, { noteId: n.id });
    send(res, noteView(n), "Note added successfully", 201);
  });
  app.put("/api/employees/:id/notes/:noteId", (req, res) => {
    const n = db.notes.find(req.params.noteId);
    if (!n || String(n.employeeId) !== String(req.params.id)) return err(res, 404, "Note not found");
    if (n.createdByUserId !== req.user.id && !V.has(req.user, "hr")) return err(res, 403, "You can only edit your own notes.");
    const content = String(h.body(req).content || "").trim();
    if (!content) return err(res, 400, "Note content is required.");
    db.notes.update(n.id, { content });
    send(res, noteView(n), "Note updated successfully");
  });
  app.delete("/api/employees/:id/notes/:noteId", (req, res) => {
    const n = db.notes.find(req.params.noteId);
    if (!n || String(n.employeeId) !== String(req.params.id)) return err(res, 404, "Note not found");
    if (n.createdByUserId !== req.user.id && !V.has(req.user, "hr")) return err(res, 403, "You can only delete your own notes.");
    db.notes.remove(n.id);
    send(res, { id: n.id }, "Note deleted successfully");
  });

  // ---------------- payslips of one employee ----------------
  const employeePayslips = (e) => db.items.rows.filter((i) => i.employeeId === e.id && ["paid", "queued", "approved"].includes(i.status));
  app.get("/api/employees/:id/payslips", (req, res) => {
    const e = findEmp(req, res);
    if (!e) return;
    if (!canSee(req, e) || (V.isManager(req.user) && !V.has(req.user, "hr", "finance_manager") && req.user.id !== e.authUserId)) return err(res, 403, "You don't have permission to view these payslips.");
    const list = employeePayslips(e).map(V.payslipItem).sort((a, b) => (a.periodStart < b.periodStart ? 1 : -1));
    if (String(req.query.order).toUpperCase() === "ASC") list.reverse();
    L.paged(res, list, req.query, "Payslips fetched");
  });
  for (const kind of ["preview", "download"]) {
    app.get(`/api/employees/:id/payslips/:payslipId/${kind}`, (req, res) => {
      const e = findEmp(req, res);
      if (!e) return;
      if (!V.has(req.user, "hr", "finance_manager") && req.user.id !== e.authUserId) return err(res, 403, "You don't have permission to view this payslip.");
      const item = db.items.find(req.params.payslipId);
      if (!item || item.employeeId !== e.id) return err(res, 404, "Payslip not found");
      const { buf, name } = h.payslipFile(item);
      h.sendFile(res, buf, { type: "application/pdf", name, inline: kind === "preview" });
    });
  }

  // ---------------- activity logs ----------------
  app.get("/api/activity-logs", (req, res) => {
    const q = req.query;
    let list = db.logs.rows;
    if (q.performedBy) list = list.filter((l) => String(l.performedBy) === String(q.performedBy) || (l.entityType === "Employee" && l.entityId === String(q.performedBy)));
    if (q.entityType) list = list.filter((l) => l.entityType === q.entityType);
    if (q.entityId) list = list.filter((l) => l.entityId === String(q.entityId));
    if (q.action) list = list.filter((l) => l.action === q.action);
    list = [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : b.id - a.id));
    L.paged(res, list.map((l) => V.activityView(l, { friendly: true })), q, "Activity logs fetched");
  });

  // ---------------- departments ----------------
  const activeDepts = () => db.departments.rows.filter((d) => !d.deletedAt);
  const deptRate = (d) => { const today = L.todayStr(); return C.deptAbsence(d.id, L.addDays(today, -29), today).absenceRate; };
  const findDept = (req, res) => { const d = V.dept(Number(req.params.id)); if (!d) err(res, 404, "Department not found"); return d; };
  const setMembers = (d, ids, { exclusive = false } = {}) => {
    const set = new Set(ids.map(Number).filter(Boolean));
    for (const e of V.activeEmps()) {
      if (set.has(e.id)) e.departmentId = d.id;
      else if (exclusive && e.departmentId === d.id && e.id !== Number(d.managerUserId)) e.departmentId = null;
    }
  };

  app.get("/api/departments/all", (req, res) => {
    send(res, { data: activeDepts().map((d) => ({ id: d.id, name: d.name })) }, "Departments fetched");
  });

  app.get("/api/departments/overview", (req, res) => {
    const today = L.todayStr();
    const from = L.normDate(req.query.from) || L.monthStart(today);
    const to = L.normDate(req.query.to) || L.monthEnd(today);
    const depts = activeDepts();
    const items = depts.map((d) => ({ departmentId: d.id, departmentName: d.name, ...C.deptAbsence(d.id, from, to) })).sort((a, b) => b.absenceRate - a.absenceRate);
    const totalWorking = items.reduce((s, x) => s + x.workingDays, 0);
    const totalAbsent = items.reduce((s, x) => s + x.absentDays, 0);
    const totalEmployees = V.activeEmps().filter((e) => e.departmentId && V.dept(e.departmentId)).length;
    const most = depts.map((d) => { const c = V.deptEmployees(d.id).length; return { departmentId: d.id, departmentName: d.name, employeeCount: c, employeeShare: L.pct(c, totalEmployees) }; }).sort((a, b) => b.employeeCount - a.employeeCount);
    send(res, {
      period: { from, to },
      summary: { totalDepartments: depts.length, newDepartments: depts.filter((d) => { const c = L.dateOf(d.createdAt); return c >= from && c <= to; }).length },
      absenceByDepartment: { overallAbsenceRate: L.pct(totalAbsent, totalWorking), totalWorkingDays: totalWorking, totalAbsentDays: totalAbsent, topDepartment: items[0] || null, items },
      mostEmployees: { totalEmployees, topDepartment: most[0] || null, items: most },
    }, "Department overview fetched");
  });

  app.get("/api/departments", (req, res) => {
    const q = req.query;
    let list = activeDepts();
    if (q.search) list = list.filter((d) => d.name.toLowerCase().includes(String(q.search).toLowerCase()));
    list = [...list].sort((a, b) => a.id - b.id);
    L.paged(res, list.map((d) => V.deptView(d, deptRate(d))), q, "Departments fetched");
  });

  app.get("/api/departments/:id", (req, res) => {
    const d = findDept(req, res);
    if (d) send(res, V.deptView(d, deptRate(d)), "Department fetched");
  });

  app.post("/api/departments", (req, res) => {
    if (!h.guard(req, res, "hr")) return;
    const b = h.body(req);
    const name = String(b.name || "").trim();
    if (!name) return err(res, 400, "Department name is required.");
    if (activeDepts().some((d) => d.name.toLowerCase() === name.toLowerCase())) return err(res, 409, "A department with this name already exists.");
    const managerId = b.managerId || b.managerUserId ? Number(b.managerId || b.managerUserId) : null;
    if (managerId && !V.emp(managerId)) return err(res, 400, "Manager not found.");
    const d = db.departments.insert({ name, description: b.description || "", managerUserId: managerId, budget: null, deletedAt: null });
    setMembers(d, b.employeeIds || []);
    h.log("created", "Department", d.id, req.user.id, { name });
    if (managerId) h.notify({ to: managerId, actor: req.user.id, action: "department.manager_assigned", title: "You are now a department manager", body: `You were assigned as manager of ${d.name}.`, entityType: "Department", entityId: d.id });
    send(res, V.deptView(d, 0), "Department created successfully", 201);
  });

  app.put("/api/departments/:id", (req, res) => {
    if (!h.guard(req, res, "hr")) return;
    const d = findDept(req, res);
    if (!d) return;
    const b = h.body(req);
    const name = b.name != null ? String(b.name).trim() : d.name;
    if (activeDepts().some((x) => x.id !== d.id && x.name.toLowerCase() === name.toLowerCase())) return err(res, 409, "A department with this name already exists.");
    const managerId = b.managerId != null || b.managerUserId != null ? Number(b.managerId ?? b.managerUserId) || null : d.managerUserId;
    db.departments.update(d.id, { name, description: b.description ?? d.description, managerUserId: managerId });
    if (Array.isArray(b.employeeIds)) setMembers(d, b.employeeIds, { exclusive: true });
    h.log("updated", "Department", d.id, req.user.id, {});
    send(res, V.deptView(d, deptRate(d)), "Department updated successfully");
  });

  app.delete("/api/departments/:id", (req, res) => {
    if (!h.guard(req, res, "hr")) return;
    const d = findDept(req, res);
    if (!d) return;
    d.deletedAt = L.nowIso();
    for (const e of db.employees.rows) if (e.departmentId === d.id) e.departmentId = null;
    h.log("deleted", "Department", d.id, req.user.id, {});
    send(res, null, "Department deleted successfully");
  });

  app.get("/api/departments/:id/employees", (req, res) => {
    const d = findDept(req, res);
    if (!d) return;
    const list = V.deptEmployees(d.id).filter((e) => matches(e, req.query.search)).sort((a, b) => V.fullName(a).localeCompare(V.fullName(b)));
    L.paged(res, list.map(V.empListItem), req.query, "Department employees fetched");
  });

  app.patch("/api/departments/:id/manager", (req, res) => {
    if (!h.guard(req, res, "hr")) return;
    const d = findDept(req, res);
    if (!d) return;
    const id = Number(h.body(req).managerUserId);
    const e = V.emp(id);
    if (!e) return err(res, 400, "Employee not found.");
    db.departments.update(d.id, { managerUserId: id });
    if (e.departmentId !== d.id) e.departmentId = d.id;
    h.log("assigned a manager to", "Department", d.id, req.user.id, { managerUserId: id });
    h.notify({ to: id, actor: req.user.id, action: "department.manager_assigned", title: "You are now a department manager", body: `You were assigned as manager of ${d.name}.`, entityType: "Department", entityId: d.id });
    send(res, V.deptView(d, deptRate(d)), "Manager assigned successfully");
  });

  app.post("/api/departments/:id/employees", (req, res) => {
    if (!h.guard(req, res, "hr")) return;
    const d = findDept(req, res);
    if (!d) return;
    const ids = (h.body(req).employeeIds || []).map(Number).filter((id) => V.emp(id));
    if (!ids.length) return err(res, 400, "Select at least one employee.");
    setMembers(d, ids);
    h.log("added employees to", "Department", d.id, req.user.id, { employeeIds: ids });
    send(res, V.deptView(d, deptRate(d)), `${ids.length} employee${ids.length > 1 ? "s" : ""} added to ${d.name}`);
  });

  app.delete("/api/departments/:id/employees", (req, res) => {
    if (!h.guard(req, res, "hr")) return;
    const d = findDept(req, res);
    if (!d) return;
    const ids = [].concat(h.body(req).employeeIds || req.query.employeeIds || []).map(Number);
    if (ids.includes(Number(d.managerUserId))) return err(res, 400, "The department manager can't be removed. Assign another manager first.");
    let n = 0;
    for (const id of ids) { const e = V.emp(id); if (e && e.departmentId === d.id) { e.departmentId = null; n++; } }
    h.log("removed employees from", "Department", d.id, req.user.id, { employeeIds: ids });
    send(res, V.deptView(d, deptRate(d)), n ? "Employee removed from the department" : "Nothing to remove");
  });
};
