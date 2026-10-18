// Attendance (Discord voice sessions, voice leaves, absences, days off), time off, calendar and meetings.
module.exports = function attendanceRoutes(app, h) {
  const { db, V, C, L } = h;
  const { send, err } = L;
  const today = () => L.todayStr();

  // Employees in scope for the current user + common filters (departmentId, managerUserId, employeeType, search, employeeId).
  function scopedEmps(req, { forceSelf = false } = {}) {
    const q = req.query;
    const visible = V.visibleEmpIds(req.user);
    let list = V.activeEmps();
    if (forceSelf || (visible && !V.isManager(req.user))) {
      const me = h.me(req);
      list = me ? [me] : [];
    } else if (visible) list = list.filter((e) => visible.has(e.id));
    if (q.employeeId) list = list.filter((e) => String(e.id) === String(q.employeeId));
    if (q.departmentId && q.departmentId !== "all") list = list.filter((e) => String(e.departmentId) === String(q.departmentId));
    const mgr = q.managerUserId || q.managerId;
    if (mgr) { const team = V.teamIds(Number(mgr)); list = list.filter((e) => team.has(e.id)); }
    if (q.employeeType) list = list.filter((e) => e.employeeType === q.employeeType);
    if (q.search) { const s = String(q.search).toLowerCase(); list = list.filter((e) => `${V.fullName(e)} ${e.email} ${e.employeeCode}`.toLowerCase().includes(s)); }
    return list;
  }

  // ---------------- summary ----------------
  app.get("/api/attendance/summary", (req, res) => {
    const emps = scopedEmps(req);
    const t = today();
    const from = L.normDate(req.query.startDate || req.query.from) || L.monthStart(t);
    const to = L.normDate(req.query.endDate || req.query.to) || t;
    send(res, C.summary(emps, from, to), "Attendance summary fetched");
  });

  // ---------------- sessions ----------------
  const sessionView = (s) => {
    const e = V.empAny(s.employeeId);
    return {
      id: s.id, employeeId: s.employeeId, employee: V.attEmployee(e), discordUserId: s.discordUserId, channelId: s.channelId,
      checkInAt: s.checkInAt, checkOutAt: s.checkOutAt, durationSeconds: s.durationSeconds, breakBeforeSeconds: s.breakBeforeSeconds,
      lateSeconds: s.lateSeconds, isLate: s.isLate, startWork: L.clock12(s.checkInAt), endWork: s.checkOutAt ? L.clock12(s.checkOutAt) : "In progress",
      status: s.isLate ? "late" : "approved", logHours: L.durLabel(s.durationSeconds), overtime: s.overtimeMinutes || 0, late: Math.round(s.lateSeconds / 60),
      date: s.date, createdAt: s.createdAt, updatedAt: s.updatedAt,
    };
  };
  app.get("/api/attendance/sessions", (req, res) => {
    const q = req.query;
    const ids = new Set(scopedEmps(req).map((e) => e.id));
    const from = L.normDate(q.startDate), to = L.normDate(q.endDate);
    let list = db.sessions.filter((s) => !s.supersededBy && ids.has(s.employeeId) && (!from || s.date >= from) && (!to || s.date <= to));
    if (q.discordUserId) list = list.filter((s) => s.discordUserId === q.discordUserId);
    if (q.isLate !== undefined && q.isLate !== "") list = list.filter((s) => s.isLate === L.bool(q.isLate));
    list = L.sortBy(list, q.sortBy || "checkInAt", q.order || "DESC");
    const { items, meta } = L.pageOf(list, q);
    send(res, { items: items.map(sessionView), meta }, "Attendance sessions fetched");
  });

  // ---------------- voice leaves ----------------
  const leaveView = (l) => {
    const e = V.empAny(l.employeeId);
    return {
      id: l.id, employeeId: l.employeeId, employee: V.attEmployee(e), leaveDate: l.leaveDate,
      startWorkAt: L.cairoIso(l.leaveDate, Math.floor(l.startMin / 60), l.startMin % 60), endWorkAt: L.cairoIso(l.leaveDate, Math.floor(l.endMin / 60), l.endMin % 60),
      status: l.status, logHoursSeconds: (l.endMin - l.startMin) * 60, leaveType: l.leaveType, note: l.note || "",
      createdAt: L.cairoIso(l.leaveDate, Math.floor(l.endMin / 60), l.endMin % 60),
    };
  };
  app.get("/api/attendance/leaves", (req, res) => {
    const q = req.query;
    const ids = new Set(scopedEmps(req).map((e) => e.id));
    const from = L.normDate(q.startDate), to = L.normDate(q.endDate);
    let list = db.voiceLeaves.filter((l) => ids.has(l.employeeId) && (!from || l.leaveDate >= from) && (!to || l.leaveDate <= to));
    if (q.status && q.status !== "all") list = list.filter((l) => l.status === q.status);
    if (q.leaveType) list = list.filter((l) => l.leaveType === q.leaveType);
    list = [...list].sort((a, b) => (a.leaveDate === b.leaveDate ? b.startMin - a.startMin : a.leaveDate < b.leaveDate ? 1 : -1));
    const { items, meta } = L.pageOf(list, q);
    send(res, { items: items.map(leaveView), meta }, "Attendance leaves fetched");
  });

  // ---------------- absences ----------------
  app.get("/api/attendance/absences", (req, res) => {
    const q = req.query;
    const t = today();
    const from = L.normDate(q.from || q.startDate) || L.monthStart(t);
    const to = L.normDate(q.to || q.endDate) || t;
    const emps = scopedEmps(req);
    const all = C.absences(emps, from, to);
    const { items, meta } = L.pageOf(all, q);
    send(res, { from, to, totalEmployees: emps.length, totalDays: L.dateRange(from, to).length, totalAbsences: all.length, items, meta }, "Absences fetched");
  });

  // ---------------- days off ----------------
  app.get("/api/attendance/days-off", (req, res) => {
    const q = req.query;
    const t = today();
    const from = L.normDate(q.startDate) || L.monthStart(t);
    const to = L.normDate(q.endDate) || L.monthEnd(t);
    let list = C.daysOff(scopedEmps(req), from, to);
    if (q.type) list = list.filter((x) => x.type === q.type);
    if (q.sourceType) list = list.filter((x) => x.sourceType === q.sourceType);
    L.paged(res, list, q, "Days off fetched");
  });

  // ---------------- time off ----------------
  const visibleRequest = (req, t) => {
    const vis = V.visibleEmpIds(req.user);
    return !vis || vis.has(t.employeeId);
  };
  const recompute = (t) => {
    if (t.status === "cancelled") return;
    t.status = t.managerActionStatus === "rejected" || t.hrActionStatus === "rejected" ? "rejected" : t.hrActionStatus === "approved" ? "approved" : "pending";
    if (t.status === "approved" || t.status === "rejected") { t.decidedAt = t.hrDecidedAt || t.managerDecidedAt; t.decidedByUserId = t.hrActionStatus !== "pending" ? t.hrDecidedByUserId : t.managerDecidedByUserId; }
    else { t.decidedAt = null; t.decidedByUserId = null; }
  };
  const typeLabel = (x) => L.labelize(x);

  app.post("/api/attendance/time-offs/requests", h.anyFiles, async (req, res) => {
    const b = h.body(req);
    if (h.identity.workspaceMode) {
      try { return send(res, await h.command(req, 'hr.leave.create', b), 'Time off request submitted successfully', 201); }
      catch (error) { return res.status(error.status || 503).json({ success: false, code: error.code || 'workspace_command_required', message: error.message }); }
    }
    const targetId = Number(b.employeeUserId || b.employeeId || 0);
    let target = h.me(req);
    if (targetId && targetId !== req.user.id) {
      if (!V.has(req.user, "hr", "manager")) return err(res, 403, "Only HR or managers can request time off for other employees.");
      target = V.emp(targetId);
    }
    if (!target) return err(res, 400, "Your account has no employee record in the HR system.");
    const timeOffType = b.timeOffType || "annual_leave";
    let durationType = String(b.durationType || "full_day");
    if (["custom_hours", "partial_day"].includes(durationType)) durationType = "partial";
    const startDate = L.normDate(b.startDate);
    let endDate = L.normDate(b.endDate) || startDate;
    if (!startDate) return err(res, 400, "Start date is required.");
    if (durationType !== "full_day") endDate = startDate;
    if (endDate < startDate) return err(res, 400, "End date must be on or after the start date.");
    let minutes;
    if (durationType === "full_day") {
      const n = L.dateRange(startDate, endDate).filter((d) => C.isWorkingDay(d)).length;
      if (!n) return err(res, 400, "The selected dates are weekends or public holidays.");
      minutes = n * 1440;
    } else if (durationType === "half_day") minutes = 240;
    else {
      const toMin = (s) => { const m = String(s || "").match(/^(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
      const a = toMin(b.partialStartTime), z = toMin(b.partialEndTime);
      if (a == null || z == null || z <= a) return err(res, 400, "Start and end time are required and the end time must be after the start time.");
      minutes = z - a;
    }
    const overlap = db.timeOffs.rows.find((t) => t.employeeId === target.id && ["pending", "approved"].includes(t.status) && t.durationType === "full_day" && durationType === "full_day" && t.startDate <= endDate && t.endDate >= startDate);
    if (overlap) return err(res, 409, `${target.id === req.user.id ? "You already have" : `${V.fullName(target)} already has`} a ${overlap.status} time-off request (${overlap.requestCode}) for these dates.`);
    const now = L.nowIso();
    const byManager = target.id !== req.user.id && V.isManager(req.user) && !V.has(req.user, "hr");
    const id = db.timeOffs.nextId();
    const t = db.timeOffs.insert({
      requestCode: `TOR-${startDate.slice(0, 4)}-${String(id).padStart(4, "0")}`, employeeId: target.id, timeOffType, durationType,
      halfDayPeriod: durationType === "half_day" ? b.halfDayPeriod || "morning" : null, startDate, endDate,
      partialStartTime: durationType === "partial" ? b.partialStartTime : null, partialEndTime: durationType === "partial" ? b.partialEndTime : null,
      totalDurationMinutes: minutes, employeeNote: b.employeeNote || "", attachments: (req.files || []).map((f) => { const m = h.fileMeta(f); return { fileName: m.fileName, fileUrl: m.url, fileSizeBytes: m.fileSize, mimeType: m.mimeType }; }),
      status: "pending",
      managerActionStatus: !target.managerId || byManager ? "approved" : "pending", managerDecisionNote: byManager ? "Created by manager." : null, managerDecidedByUserId: byManager ? req.user.id : null, managerDecidedAt: byManager ? now : null,
      hrActionStatus: "pending", hrDecisionNote: null, hrDecidedByUserId: null, hrDecidedAt: null, decidedByUserId: null, decidedAt: null, createdByUserId: req.user.id,
    });
    h.log("requested", "TimeOffRequest", t.id, req.user.id, { timeOffType, employeeId: target.id });
    const who = V.fullName(target);
    const when = startDate === endDate ? startDate : `${startDate} - ${endDate}`;
    if (target.managerId && t.managerActionStatus === "pending") h.notify({ to: target.managerId, actor: req.user.id, action: "time_off.requested", title: "Time-off request awaiting your approval", body: `${who} requested ${typeLabel(timeOffType).toLowerCase()} (${when}).`, entityType: "AttendanceTimeOff", entityId: t.id });
    h.notify({ to: h.usersWithRole("hr"), actor: req.user.id, action: "time_off.requested", title: "New time-off request", body: `${who} requested ${typeLabel(timeOffType).toLowerCase()} (${when}).`, priority: timeOffType === "sick_leave" ? "high" : "normal", entityType: "AttendanceTimeOff", entityId: t.id });
    send(res, { ...V.timeOffDetail(t), status: { hrAction: t.hrActionStatus, managerAction: t.managerActionStatus, overall: t.status }, overallStatus: t.status }, "Time off request submitted successfully", 201);
  });

  app.get("/api/attendance/time-offs/requests", (req, res) => {
    const q = req.query;
    const vis = V.visibleEmpIds(req.user);
    let list = db.timeOffs.rows.filter((t) => !vis || vis.has(t.employeeId));
    if (q.status && q.status !== "all") list = list.filter((t) => t.status === q.status);
    if (q.timeOffType) list = list.filter((t) => t.timeOffType === q.timeOffType);
    const from = L.normDate(q.fromDate), to = L.normDate(q.toDate);
    if (from) list = list.filter((t) => t.endDate >= from);
    if (to) list = list.filter((t) => t.startDate <= to);
    if (q.employeeId) list = list.filter((t) => String(t.employeeId) === String(q.employeeId));
    if (q.departmentId) list = list.filter((t) => String(V.empAny(t.employeeId)?.departmentId) === String(q.departmentId));
    if (q.managerUserId) { const team = V.teamIds(Number(q.managerUserId)); list = list.filter((t) => team.has(t.employeeId)); }
    if (q.employeeType) list = list.filter((t) => V.empAny(t.employeeId)?.employeeType === q.employeeType);
    if (q.search) { const s = String(q.search).toLowerCase(); list = list.filter((t) => `${V.fullName(V.empAny(t.employeeId))} ${t.requestCode} ${t.timeOffType}`.toLowerCase().includes(s)); }
    list = L.sortBy(list, q.sortBy || "createdAt", q.order || "DESC");
    const { items, meta } = L.pageOf(list, q);
    send(res, { items: items.map(V.timeOffItem), meta }, "Time off requests fetched");
  });

  app.get("/api/attendance/time-offs/overview", (req, res) => {
    const vis = V.visibleEmpIds(req.user);
    const list = db.timeOffs.rows.filter((t) => !vis || vis.has(t.employeeId));
    const c = (s) => list.filter((t) => t.status === s).length;
    const me = h.me(req);
    const summary = me ? C.leaveSummary(me) : null;
    send(res, {
      totalRequests: list.length, approvedRequests: c("approved"), pendingRequests: c("pending"), rejectedRequests: c("rejected"), cancelledRequests: c("cancelled"),
      approvedDurationMinutes: list.filter((t) => t.status === "approved").reduce((s, t) => s + t.totalDurationMinutes, 0),
      employeeSummary: me ? { employeeId: me.id, ptoBalanceDays: summary.availableToBookDays, pendingRequestsCount: db.timeOffs.rows.filter((t) => t.employeeId === me.id && t.status === "pending").length, usedDays: summary.usedDays, contractDaysPerYear: summary.contractDaysPerYear, nationalDays: summary.nationalHolidaysDays } : null,
      balances: me ? C.balances(me) : [],
    }, "Time off overview fetched");
  });

  app.get("/api/attendance/time-offs/requests/:id", (req, res) => {
    const t = db.timeOffs.find(req.params.id);
    if (!t) return err(res, 404, "Time off request not found");
    if (!visibleRequest(req, t)) return err(res, 403, "You don't have access to this request.");
    send(res, h.leave ? h.leave.detail(t, req.user.id) : V.timeOffDetail(t), "Time off request fetched");
  });

  app.patch("/api/attendance/time-offs/requests/:id/decision", async (req, res) => {
    const t = db.timeOffs.find(req.params.id);
    if (!t) return err(res, 404, "Time off request not found");
    const { status, decisionNote } = h.body(req);
    if (h.identity.workspaceMode) {
      if (Object.keys(h.body(req)).some(key => !['status', 'decisionNote'].includes(key))) return res.status(422).json({ success: false, code: 'invalid_leave_payload', message: 'Only the leave decision and note can be supplied.' });
      try { return send(res, await h.command(req, "hr.leave.approve", { ...h.body(req), requestId: t.id }), "Leave decision recorded"); }
      catch (error) { return res.status(error.status || 503).json({ success: false, code: error.code || "workspace_command_required", message: error.message }); }
    }
    if (!["approved", "rejected", "pending"].includes(status)) return err(res, 400, "Status must be approved, rejected or pending.");
    if (t.status === "cancelled") return err(res, 400, "This request was cancelled by the employee.");
    const now = L.nowIso();
    const e = V.empAny(t.employeeId);
    let role;
    if (V.has(req.user, "hr")) role = "hr";
    else if (V.isManager(req.user)) {
      const me = h.me(req);
      if (!me || !(e.managerId === me.id || V.teamIds(me.id).has(e.id))) return err(res, 403, "You can only decide on requests from your team.");
      role = "manager";
    } else return err(res, 403, "Only managers and HR can decide on time-off requests.");
    const before = t.status;
    if (role === "hr") Object.assign(t, { hrActionStatus: status, hrDecisionNote: decisionNote || null, hrDecidedByUserId: status === "pending" ? null : req.user.id, hrDecidedAt: status === "pending" ? null : now });
    else Object.assign(t, { managerActionStatus: status, managerDecisionNote: decisionNote || null, managerDecidedByUserId: status === "pending" ? null : req.user.id, managerDecidedAt: status === "pending" ? null : now });
    recompute(t);
    t.updatedAt = now;
    h.log(status, "TimeOffRequest", t.id, req.user.id, { decidedAs: role, note: decisionNote });
    const label = `${typeLabel(t.timeOffType)} (${t.startDate === t.endDate ? t.startDate : `${t.startDate} - ${t.endDate}`})`;
    if (t.status !== before && (t.status === "approved" || t.status === "rejected")) {
      h.notify({ to: e.authUserId, actor: req.user.id, action: "time_off.decided", title: `Time-off request ${t.status}`, body: `Your ${label.toLowerCase()} was ${t.status}${role === "hr" ? " by HR" : " by your manager"}.${decisionNote ? ` Note: ${decisionNote}` : ""}`, priority: t.status === "rejected" ? "high" : "normal", entityType: "AttendanceTimeOff", entityId: t.id });
    } else if (role === "manager" && status === "approved" && t.hrActionStatus === "pending") {
      h.notify({ to: h.usersWithRole("hr"), actor: req.user.id, action: "time_off.manager_approved", title: "Awaiting HR decision", body: `${V.fullName(V.empAny(req.user.id))} approved ${V.fullName(e)}'s ${label.toLowerCase()}.`, entityType: "AttendanceTimeOff", entityId: t.id });
      h.notify({ to: e.authUserId, actor: req.user.id, action: "time_off.manager_approved", title: "Manager approved your request", body: `${label} is waiting for HR approval.`, entityType: "AttendanceTimeOff", entityId: t.id });
    }
    send(res, V.timeOffDetail(t), status === "pending" ? "Decision reset to pending" : `Time off request ${status}`);
  });

  app.patch("/api/attendance/time-offs/requests/:id/cancel", async (req, res) => {
    const t = db.timeOffs.find(req.params.id);
    if (!t) return err(res, 404, "Time off request not found");
    if (t.employeeId !== req.user.id && !V.has(req.user, "hr")) return err(res, 403, "You can only cancel your own requests.");
    if (h.identity.workspaceMode) {
      if (Object.keys(h.body(req)).length) return res.status(422).json({ success: false, code: 'invalid_leave_payload', message: 'Cancellation does not accept additional details.' });
      try { return send(res, await h.command(req, 'hr.leave.cancel', { ...h.body(req), requestId: t.id }), 'Time off request cancelled'); }
      catch (error) { return res.status(error.status || 503).json({ success: false, code: error.code || 'workspace_command_required', message: error.message }); }
    }
    if (t.status !== "pending") return err(res, 400, "Only pending requests can be cancelled.");
    t.status = "cancelled";
    t.updatedAt = L.nowIso();
    h.log("cancelled", "TimeOffRequest", t.id, req.user.id, {});
    send(res, V.timeOffDetail(t), "Time off request cancelled");
  });

  // ---------------- meetings ----------------
  const meetingVisible = (req, m) => {
    if (m.deletedAt) return false;
    if (V.has(req.user, "hr")) return true;
    if (m.createdBy === req.user.id || m.targetType === "company" || m.sendToAll) return true;
    return V.meetingAttendees(m).some((e) => e.id === req.user.id);
  };
  const endTime = (time, minutes) => { const [hh, mm] = String(time).split(":").map(Number); const t = hh * 60 + mm + Number(minutes || 0); return `${L.pad(Math.floor(t / 60) % 24)}:${L.pad(t % 60)}`; };

  app.get("/api/meetings", (req, res) => {
    const list = db.meetings.rows.filter((m) => meetingVisible(req, m)).sort((a, b) => (`${a.date} ${a.time}` < `${b.date} ${b.time}` ? 1 : -1));
    L.paged(res, list.map(V.meetingView), req.query, "Meetings fetched");
  });
  app.post("/api/meetings", (req, res) => {
    if (!h.guard(req, res, "hr", "manager")) return;
    const b = h.body(req);
    const title = String(b.title || "").trim();
    const date = L.normDate(b.date);
    const time = String(b.time || "").slice(0, 5);
    if (!title || !date || !/^\d{2}:\d{2}$/.test(time)) return err(res, 400, "Title, date and time are required.");
    const targetType = ["company", "department", "employees", "employee"].includes(b.targetType) ? (b.targetType === "employee" ? "employees" : b.targetType) : "company";
    const departmentIds = [].concat(b.departmentIds || []).map(Number).filter(Boolean);
    const employeeIds = [].concat(b.employeeIds || []).map(Number).filter((id) => V.emp(id));
    if (targetType === "department" && !departmentIds.length) return err(res, 400, "Select at least one department.");
    if (targetType === "employees" && !employeeIds.length) return err(res, 400, "Select at least one employee.");
    const m = db.meetings.insert({ title, date, time, durationMinutes: Number(b.durationMinutes) || 60, link: b.link || null, description: b.description || null, targetType, departmentIds, employeeIds, sendToAll: targetType === "company", createdBy: req.user.id, updatedBy: null, deletedAt: null });
    h.log("scheduled", "Meeting", m.id, req.user.id, { title });
    h.notify({ to: V.meetingAttendees(m).map((e) => e.authUserId), actor: req.user.id, action: "meeting.created", title: `New meeting: ${title}`, body: `${date} at ${time} (${m.durationMinutes} min)${m.link ? ` - ${m.link}` : ""}`, entityType: "Meeting", entityId: m.id });
    send(res, V.meetingView(m), "Meeting scheduled successfully", 201);
  });
  app.get("/api/meetings/:id", (req, res) => {
    const m = db.meetings.find(req.params.id);
    if (!m || m.deletedAt) return err(res, 404, "Meeting not found");
    send(res, V.meetingView(m), "Meeting fetched");
  });
  app.delete("/api/meetings/:id", (req, res) => {
    const m = db.meetings.find(req.params.id);
    if (!m || m.deletedAt) return err(res, 404, "Meeting not found");
    if (!V.has(req.user, "hr") && m.createdBy !== req.user.id) return err(res, 403, "Only HR or the organizer can delete this meeting.");
    m.deletedAt = L.nowIso();
    h.log("cancelled", "Meeting", m.id, req.user.id, { title: m.title });
    h.notify({ to: V.meetingAttendees(m).map((e) => e.authUserId), actor: req.user.id, action: "meeting.cancelled", title: `Meeting cancelled: ${m.title}`, body: `${m.date} at ${m.time}`, entityType: "Meeting", entityId: m.id });
    send(res, null, "Meeting deleted successfully");
  });

  // ---------------- calendar ----------------
  app.get("/api/calendar", (req, res) => {
    const q = req.query;
    const period = ["month", "week", "day"].includes(q.period) ? q.period : "month";
    const date = L.normDate(q.date) || today();
    let from, to;
    if (period === "day") { from = date; to = date; }
    else if (period === "week") { from = L.weekStartSun(date); to = L.addDays(from, 6); }
    else { from = L.weekStartSun(L.monthStart(date)); to = L.addDays(L.weekStartSun(L.monthEnd(date)), 6); }
    const eventType = q.eventType || "";
    const dept = q.departmentId ? Number(q.departmentId) : null;
    const days = {};
    const push = (d, ev) => { (days[d] = days[d] || []).push(ev); };
    const summary = { meetings: 0, timeOff: 0, publicHolidays: 0 };
    if (!eventType || eventType === "meeting") {
      for (const m of db.meetings.rows) {
        if (m.date < from || m.date > to || !meetingVisible(req, m)) continue;
        if (dept && !(m.targetType === "company" || (m.departmentIds || []).includes(dept) || V.meetingAttendees(m).some((e) => e.departmentId === dept))) continue;
        summary.meetings++;
        push(m.date, { type: "meeting", id: m.id, date: m.date, title: m.title, time: m.time, startAt: m.time, endAt: endTime(m.time, m.durationMinutes), durationMinutes: m.durationMinutes, link: m.link, interviewWith: null, interviewLink: m.link, candidate: null, job: null, targetType: m.targetType });
      }
    }
    if (!eventType || eventType === "timeOff") {
      const vis = V.visibleEmpIds(req.user);
      const me = h.me(req);
      for (const t of db.timeOffs.rows) {
        if (!["approved", "pending"].includes(t.status) || t.endDate < from || t.startDate > to) continue;
        const e = V.empAny(t.employeeId);
        if (!e || e.deletedAt) continue;
        const ok = !vis || vis.has(e.id) || (me && e.departmentId === me.departmentId && t.status === "approved");
        if (!ok) continue;
        if (dept && e.departmentId !== dept) continue;
        let counted = false;
        for (const d of L.dateRange(t.startDate > from ? t.startDate : from, t.endDate < to ? t.endDate : to)) {
          if (!C.isWorkingDay(d) && t.startDate !== t.endDate) continue;
          counted = true;
          push(d, { type: "timeOff", id: t.id, date: d, title: `${V.fullName(e)} - ${typeLabel(t.timeOffType)}`, timeOffType: t.timeOffType, status: t.status, startDate: t.startDate, endDate: t.endDate, durationType: t.durationType, employee: { id: e.id, firstName: e.firstName, lastName: e.lastName, avatar: e.avatarUrl || "" } });
        }
        if (counted) summary.timeOff++;
      }
    }
    if (!eventType || eventType === "publicHoliday") {
      for (const hol of db.holidays()) {
        if (hol.date < from || hol.date > to) continue;
        summary.publicHolidays++;
        push(hol.date, { type: "publicHoliday", id: Number(hol.date.replace(/-/g, "")), date: hol.date, title: hol.name });
      }
    }
    const order = { publicHoliday: 0, meeting: 1, timeOff: 2 };
    for (const d of Object.keys(days)) days[d].sort((a, b) => order[a.type] - order[b.type] || String(a.startAt || "").localeCompare(String(b.startAt || "")));
    const sorted = Object.fromEntries(Object.keys(days).sort().map((k) => [k, days[k]]));
    send(res, { period, startDate: from, endDate: to, summary, days: sorted }, "Calendar fetched");
  });
};
