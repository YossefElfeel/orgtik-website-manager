// Attendance and leave calculations derived from the Discord sessions, the schedule, holidays and time off.
const L = require("./lib");

module.exports = function makeCalc(db, V) {
  const C = {};
  let index = null;
  C.reindex = () => {
    index = new Map();
    for (const s of db.sessions.filter(row => !row.supersededBy)) {
      const k = `${s.employeeId}|${s.date}`;
      if (!index.has(k)) index.set(k, []);
      index.get(k).push(s);
    }
  };
  C.sessionsOn = (empId, date) => { if (!index) C.reindex(); return index.get(`${empId}|${date}`) || []; };

  C.schedule = () => db.settings.attendance.schedule;
  C.holidayOn = (date, employee) => db.holidays(employee).find((h) => h.date === date) || null;
  C.isScheduleDay = (date) => (C.schedule().workingDays || []).map(Number).includes(L.isoWeekday(date));
  C.isWorkingDay = (date, employee) => C.isScheduleDay(date) && !C.holidayOn(date, employee);
  C.dayHours = (e) => (e.employeeType === "part_time" ? 4.5 : 8);

  // Working days an employee is expected to attend (excludes full-day approved leave).
  C.expectedDays = (e, from, to) => {
    const today = L.todayStr();
    const end = to < today ? to : today;
    const start = e.joinDate > from ? e.joinDate : from;
    return L.dateRange(start, end).filter((d) => {
      if (!C.isWorkingDay(d, e)) return false;
      const leave = db.approvedLeaveOn(e.id, d);
      return !(leave && leave.durationType === "full_day");
    });
  };

  function stats(emps, from, to) {
    let workingDays = 0, presentDays = 0, lateDays = 0, expectedSec = 0;
    let totalSessions = 0, closedSessions = 0, totalWork = 0, totalBreak = 0, totalLate = 0, lateOcc = 0;
    for (const e of emps) {
      const days = C.expectedDays(e, from, to);
      workingDays += days.length;
      expectedSec += days.length * C.dayHours(e) * 3600;
      for (const d of days) {
        const ss = C.sessionsOn(e.id, d);
        if (ss.length) presentDays++;
        if (ss.some((s) => s.isLate)) lateDays++;
      }
      for (const d of L.dateRange(from, to)) {
        for (const s of C.sessionsOn(e.id, d)) {
          totalSessions++;
          if (s.checkOutAt) closedSessions++;
          totalWork += s.durationSeconds;
          totalBreak += s.breakBeforeSeconds;
          totalLate += s.lateSeconds;
          if (s.isLate) lateOcc++;
        }
      }
    }
    return { workingDays, presentDays, lateDays, expectedSec, totalSessions, closedSessions, totalWork, totalBreak, totalLate, lateOcc };
  }

  C.summary = (emps, from, to) => {
    const s = stats(emps, from, to);
    const today = L.todayStr();
    const thisWeek = L.weekStartSun(today);
    const lastWeekStart = L.addDays(thisWeek, -7);
    const w1 = stats(emps, thisWeek, today);
    const w0 = stats(emps, lastWeekStart, L.addDays(thisWeek, -1));
    const rate = (x) => L.pct(x.presentDays, x.workingDays);
    const absentDays = Math.max(0, s.workingDays - s.presentDays);
    const attendanceRate = rate(s);
    const onTimeRate = L.pct(s.presentDays - s.lateDays, s.presentDays);
    const absenteeismRate = L.pct(absentDays, s.workingDays);
    const workCompletionRate = L.pct(s.totalWork, s.expectedSec);
    const lbl = (n) => `${n}%`;
    const deltaAtt = Math.round((rate(w1) - rate(w0)) * 10) / 10;
    const deltaHours = w0.totalWork ? Math.round(((w1.totalWork / Math.max(1, w1.workingDays) - w0.totalWork / Math.max(1, w0.workingDays)) / (w0.totalWork / Math.max(1, w0.workingDays))) * 1000) / 10 : 0;
    const totalWorkLabel = L.hmsLabel(s.totalWork);
    const expectedWorkLabel = L.hmsLabel(s.expectedSec);
    return {
      from, to, totalSessions: s.totalSessions, closedSessions: s.closedSessions,
      totalWorkSeconds: s.totalWork, totalBreakSeconds: s.totalBreak, totalLateSeconds: s.totalLate, lateOccurrences: s.lateOcc,
      attendanceRate, attendanceRateLabel: lbl(attendanceRate), presentDays: s.presentDays, absentDays, workingDays: s.workingDays,
      totalWorkLabel, onTimeRate, onTimeRateLabel: lbl(onTimeRate), absenteeismRate, absenteeismRateLabel: lbl(absenteeismRate),
      absenteeismDays: absentDays, absenteeismLabel: `${absentDays} ${absentDays === 1 ? "day" : "days"}`, totalWorkTime: totalWorkLabel,
      employeeAttendanceLabel: `${s.presentDays}/${s.workingDays}`, expectedWorkSeconds: s.expectedSec, expectedWorkLabel,
      workCompletionRate, workCompletionRateLabel: lbl(workCompletionRate),
      attendanceCard: { attendanceRate, attendanceRateLabel: lbl(attendanceRate), onTimeRate, onTimeRateLabel: lbl(onTimeRate), lateOccurrences: s.lateOcc, absentDays, absentDaysLabel: `${absentDays} ${absentDays === 1 ? "day" : "days"}` },
      employeeAttendance: { presentDays: s.presentDays, workingDays: s.workingDays, label: `${s.presentDays}/${s.workingDays}`, lastWeekPercentageDelta: deltaAtt },
      totalLogHours: { totalWorkSeconds: s.totalWork, totalWorkLabel, expectedWorkSeconds: s.expectedSec, expectedWorkLabel, label: `${totalWorkLabel}/${expectedWorkLabel}`, lastWeekPercentageDelta: deltaHours },
      workingHourPerformance: { performanceRate: onTimeRate, performanceRateLabel: lbl(onTimeRate), workCompletionRate, workCompletionRateLabel: lbl(workCompletionRate), workingHourSeconds: s.totalWork, workingHour: totalWorkLabel },
      insight: { absenteeismRate, absenteeismRateLabel: lbl(absenteeismRate), absenteeismDays: absentDays, absenteeismLabel: `${absentDays} ${absentDays === 1 ? "day" : "days"}`, lateOccurrences: s.lateOcc, totalWorkTime: totalWorkLabel, totalWorkSeconds: s.totalWork, attendanceRate, attendanceRateLabel: lbl(attendanceRate) },
      employeesCount: emps.length,
    };
  };

  // Absence rows (absent days + short "half" days) for the absence table and department stats.
  C.absences = (emps, from, to) => {
    const out = [];
    for (const e of emps) {
      for (const d of C.expectedDays(e, from, to)) {
        const ss = C.sessionsOn(e.id, d);
        const dur = ss.reduce((a, s) => a + s.durationSeconds, 0);
        const leave = db.approvedLeaveOn(e.id, d);
        const minimum = (C.dayHours(e) / 2) * 3600;
        const isAbsent = ss.length === 0;
        const isHalfDay = !isAbsent && dur < minimum && !leave && d !== L.todayStr();
        if (!isAbsent && !isHalfDay) continue;
        out.push({
          id: Number(d.replace(/-/g, "")) * 1000 + e.id, employeeId: e.id, employee: V.attEmployee(e), date: d,
          isPresent: !isAbsent, isAbsent, isLate: ss.some((s) => s.isLate), isWorkingDay: true, minimumRequiredSeconds: minimum,
          isHalfDay, attendanceClass: isAbsent ? "absent" : "half_day", totalDurationSeconds: dur,
          totalBreakSeconds: ss.reduce((a, s) => a + s.breakBeforeSeconds, 0), sessionsCount: ss.length,
        });
      }
    }
    return out.sort((a, b) => (a.date === b.date ? a.employeeId - b.employeeId : a.date < b.date ? 1 : -1));
  };

  const TYPE_LABEL = { weekend: "Weekend", public_holiday: "Public Holiday", company_closure: "Company Closure", approved_leave: "Approved Leave", approved_special_off: "Special Day Off", manual_override: "Manual Override" };
  C.daysOff = (emps, from, to) => {
    const out = [];
    for (const d of L.dateRange(from, to)) {
      const hol = C.holidayOn(d);
      const weekend = !C.isScheduleDay(d);
      for (const e of emps) {
        if (d < e.joinDate) continue;
        const employeeHoliday = C.holidayOn(d, e);
        const leave = db.approvedLeaveOn(e.id, d);
        let type = null, label = null, sourceType = null, sourceId = null;
        if (employeeHoliday && !weekend) { type = "public_holiday"; label = `${TYPE_LABEL.public_holiday} - ${employeeHoliday.name}`; sourceType = "calendar"; sourceId = `holiday-${d}`; }
        else if (weekend) { type = "weekend"; label = TYPE_LABEL.weekend; sourceType = "schedule"; }
        else if (leave && leave.durationType === "full_day") { type = "approved_leave"; label = `${TYPE_LABEL.approved_leave} - ${L.labelize(leave.timeOffType)}`; sourceType = "time_off_request"; sourceId = leave.id; }
        if (!type) continue;
        out.push({ id: Number(d.replace(/-/g, "")) * 1000 + e.id, employeeId: e.id, employee: V.attEmployee(e), date: d, type, typeLabel: label, sourceType, sourceId, createdAt: L.cairoIso(d, 0, 5) });
      }
    }
    const prio = { approved_leave: 0, public_holiday: 1, weekend: 2 };
    return out.sort((a, b) => (a.date === b.date ? prio[a.type] - prio[b.type] || a.employeeId - b.employeeId : a.date < b.date ? 1 : -1));
  };

  // Day-by-day attendance for one employee (employee details page).
  C.employeeDays = (e, from, to) => {
    const today = L.todayStr();
    const out = [];
    for (const d of L.dateRange(e.joinDate > from ? e.joinDate : from, to < today ? to : today).reverse()) {
      const ss = C.sessionsOn(e.id, d);
      const working = C.isWorkingDay(d, e);
      const leave = db.approvedLeaveOn(e.id, d);
      if (!ss.length && !working) continue;
      const dur = ss.reduce((a, s) => a + s.durationSeconds, 0);
      const first = ss[0], last = ss[ss.length - 1];
      const status = ss.length ? (ss.some((s) => s.isLate) ? "Late" : "Approved") : leave ? "On leave" : "Absent";
      out.push({
        id: `${e.id}-${d}`, dateFrom: d, startWork: first ? L.clock12(first.checkInAt) : "", endWork: last ? (last.checkOutAt ? L.clock12(last.checkOutAt) : "In progress") : "",
        status, logHours: ss.length ? L.durLabel(dur) : "", overtime: ss.reduce((a, s) => a + (s.overtimeMinutes || 0), 0), late: Math.round((first?.lateSeconds || 0) / 60),
        sessionsCount: ss.length,
      });
    }
    return out;
  };

  // Leave usage per employee for the current year.
  C.workDaysOf = (t) => {
    if (t.durationType === "half_day") return 0.5;
    if (t.durationType === "partial" || t.durationType === "custom_hours" || t.durationType === "partial_day") return L.round2((t.totalDurationMinutes || 0) / 60 / 8);
    const n = L.dateRange(t.startDate, t.endDate).filter((d) => C.isWorkingDay(d, V.empAny(t.employeeId))).length;
    return n || 1;
  };
  C.policyAllocation = (e) => {const p=db.settings.leavePolicy;if(!p)return null;const today=L.todayStr(),year=today.slice(0,4),start=e.joinDate>year+'-01-01'?e.joinDate:year+'-01-01',months=Math.max(0,Number(today.slice(5,7))-Number(start.slice(5,7))+(today.slice(8)>=start.slice(8)?1:0));return L.round2((p.accrual==='monthly'?p.annual*Math.min(12,months)/12:start<=today?p.annual:0)+p.carry);};
  C.leaveSummary = (e) => {
    const year = L.todayStr().slice(0, 4);
    const today = L.todayStr();
    const mine = db.timeOffs.rows.filter((t) => t.employeeId === e.id && t.startDate.startsWith(year));
    const paidTypes = ["annual_leave", "vacation_day", "personal_leave"];
    const sum = (list) => L.round2(list.reduce((s, t) => s + C.workDaysOf(t), 0));
    const d = V.daysOffInfo(e);
    const allocation = (C.policyAllocation(e) ?? d.annualLeave) + d.casualLeave + d.contractAdds;
    const approvedPaid = mine.filter((t) => t.status === "approved" && paidTypes.includes(t.timeOffType));
    const used = sum(approvedPaid.filter((t) => t.startDate <= today));
    const booked = sum(approvedPaid.filter((t) => t.startDate > today));
    const pending = sum(mine.filter((t) => t.status === "pending"));
    const available = L.round2(Math.max(0, allocation - used - booked));
    const holidays = db.holidays(e).filter((h) => h.date.startsWith(year)).length;
    return {
      paidTimeOffDays: allocation, pendingApprovalDays: pending, bookedDays: booked, availableToBookDays: available, awaitingApprovalDays: mine.filter((t) => t.status === "pending").length,
      usedDays: used, contractDaysPerYear: d.totalDaysOff, nationalHolidaysDays: holidays, inContractDays: d.contractAdds + d.annualLeave,
    };
  };
  C.balances = (e) => {
    const year = L.todayStr().slice(0, 4);
    const d = V.daysOffInfo(e);
    const mine = db.timeOffs.rows.filter((t) => t.employeeId === e.id && t.status === "approved" && t.startDate.startsWith(year));
    const used = (types) => L.round2(mine.filter((t) => types.includes(t.timeOffType)).reduce((s, t) => s + C.workDaysOf(t), 0));
    const row = (timeOffType, allocatedDays, types) => { const u = used(types); return { timeOffType, allocatedDays, usedDays: u, remainingDays: L.round2(Math.max(0, allocatedDays - u)) }; };
    return [
      row("annual_leave", (C.policyAllocation(e) ?? d.annualLeave) + d.contractAdds, ["annual_leave", "vacation_day"]),
      row("personal_leave", d.casualLeave, ["personal_leave"]),
      row("sick_leave", d.sickLeave, ["sick_leave", "medical_appointment"]),
      row("unpaid_leave", d.unpaidLeavePolicy === "allowed" ? 30 : 0, ["unpaid_leave"]),
    ];
  };

  // Absence per department for a date range (department overview cards).
  C.deptAbsence = (deptId, from, to) => {
    const emps = V.activeEmps().filter((e) => e.departmentId === deptId);
    let workingDays = 0, absent = 0;
    for (const e of emps) {
      const days = C.expectedDays(e, from, to);
      workingDays += days.length;
      absent += days.filter((d) => C.sessionsOn(e.id, d).length === 0).length;
    }
    return { employeeCount: emps.length, workingDays, absentDays: absent, absenceRate: L.pct(absent, workingDays) };
  };
  return C;
};
