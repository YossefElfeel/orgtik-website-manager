const { createBusinessCalendar } = require('../../lib/business-calendar');
const { RealDate } = require('../../lib/clock');
const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const DAY = 864e5;
const TYPES = ['annual_leave', 'sick_leave', 'personal_leave', 'vacation_day', 'bereavement_leave', 'medical_appointment', 'mental_health_day', 'training_day', 'public_holiday', 'unpaid_leave', 'casual_leave', 'other'];
function civilDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw fail(422, 'invalid_leave_date', 'Choose a valid calendar date.');
  const instant = RealDate.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(instant) || new RealDate(instant).toISOString().slice(0, 10) !== value) throw fail(422, 'invalid_leave_date', 'Choose a valid calendar date.');
  return instant;
}
function clockMinute(value) {
  if (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) throw fail(422, 'invalid_leave_time', 'Choose a valid time.');
  const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute;
}
function wallAt(calendar, date, minute = 0) {
  const parsed = new RealDate(civilDate(date));
  return calendar.fromWall({ year: parsed.getUTCFullYear(), month: parsed.getUTCMonth() + 1, day: parsed.getUTCDate(), hour: Math.floor(minute / 60), minute: Math.floor(minute % 60), second: minute % 1 ? 30 : 0 });
}
function civilStart(calendar, date) {
  const parsed = new RealDate(civilDate(date));
  return calendar.civilDayStart({ year: parsed.getUTCFullYear(), month: parsed.getUTCMonth() + 1, day: parsed.getUTCDate() });
}
function availabilityBounds(request, settings, timeZone) {
  const calendar = createBusinessCalendar(timeZone), start = civilDate(request.startDate), end = civilDate(request.endDate);
  if (end < start) throw fail(422, 'invalid_leave_date', 'The end date must follow the start date.');
  let from, to;
  if (request.durationType === 'full_day') {
    from = civilStart(calendar, request.startDate);
    to = civilStart(calendar, new RealDate(end + DAY).toISOString().slice(0, 10));
  } else {
    if (request.startDate !== request.endDate) throw fail(422, 'invalid_leave_date', 'Partial leave must use one calendar day.');
    if (request.durationType === 'half_day') {
      const schedule = settings.attendance.schedule, first = clockMinute(schedule.dayStartTime), last = clockMinute(schedule.dayEndTime);
      if (last <= first) throw fail(503, 'invalid_work_schedule', 'The workspace work schedule needs review.');
      const middle = first + (last - first) / 2;
      if (!['morning', 'afternoon'].includes(request.halfDayPeriod)) throw fail(422, 'invalid_leave_period', 'Choose morning or afternoon.');
      from = wallAt(calendar, request.startDate, request.halfDayPeriod === 'morning' ? first : middle);
      to = wallAt(calendar, request.startDate, request.halfDayPeriod === 'morning' ? middle : last);
    } else if (request.durationType === 'partial') {
      const first = clockMinute(request.partialStartTime), last = clockMinute(request.partialEndTime);
      if (last <= first) throw fail(422, 'invalid_leave_time', 'The end time must follow the start time.');
      from = wallAt(calendar, request.startDate, first); to = wallAt(calendar, request.startDate, last);
    } else throw fail(422, 'invalid_leave_duration', 'Choose a valid leave duration.');
  }
  if (to <= from) throw fail(422, 'invalid_leave_time', 'The end time must follow the start time.');
  return { startAt: calendar.iso(from), endAt: calendar.iso(to) };
}
function overall(request) {
  if (request.status === 'cancelled') return 'cancelled';
  return request.managerActionStatus === 'rejected' || request.hrActionStatus === 'rejected' ? 'rejected' : request.hrActionStatus === 'approved' ? 'approved' : 'pending';
}
function checkFields(payload, fields) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || Object.keys(payload).some(key => !fields.includes(key))) throw fail(422, 'invalid_leave_payload', 'Only the requested leave details can be supplied.');
}
function numericId(value) {
  const parsed = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw fail(422, 'invalid_employee', 'Choose a valid employee.');
  return parsed;
}
function createLeaveService({ db, V, C, L, identity, workspace, context = () => identity.currentContext?.(), notify = () => {}, log = () => {} }) {
  const current = actorId => {
    const actor = identity.findUser(actorId);
    if (!actor || actor.isActive === false || !V.rolesOf(actor).length) throw fail(403, 'leave_forbidden', 'Your current HR access is required.');
    return actor;
  };
  const inTeam = (actor, employee) => { const me = V.empByUser(actor.id); return Boolean(me && (employee.managerId === me.id || V.teamIds(me.id).has(employee.id))); };
  function authorize(action, payload, actorId) {
    const actor = current(actorId);
    if (action === 'create') {
      checkFields(payload, ['employeeId', 'employeeUserId', 'timeOffType', 'durationType', 'startDate', 'endDate', 'halfDayPeriod', 'partialStartTime', 'partialEndTime', 'employeeNote']);
      const targetId = payload.employeeId == null && payload.employeeUserId == null ? actor.id : numericId(payload.employeeId ?? payload.employeeUserId);
      if (payload.employeeId != null && payload.employeeUserId != null && numericId(payload.employeeId) !== numericId(payload.employeeUserId)) throw fail(422, 'invalid_employee', 'Choose one employee.');
      const employee = V.emp(targetId);
      if (!employee || !identity.findUser(employee.authUserId ?? employee.id)) throw fail(404, 'employee_not_found', 'This employee is not available in this workspace.');
      if (employee.id !== V.empByUser(actor.id)?.id && !V.isHR(actor) && !(V.isManager(actor) && inTeam(actor, employee))) throw fail(403, 'leave_forbidden', 'You may request leave only for yourself or your reporting team.');
      return { actor, employee };
    }
    checkFields(payload, action === 'decision' ? ['requestId', 'status', 'decisionNote'] : action === 'cancel' ? ['requestId'] : []);
    if (!['decision', 'cancel'].includes(action)) throw fail(422, 'invalid_leave_action', 'Choose a valid leave action.');
    const request = db.timeOffs.find(numericId(payload.requestId)), employee = request && V.empAny(request.employeeId);
    if (!request || !employee) throw fail(404, 'leave_not_found', 'This leave request was not found.');
    const self = V.empByUser(actor.id)?.id === employee.id;
    if (action === 'cancel') {
      if (!self && !V.isHR(actor)) throw fail(403, 'leave_forbidden', 'You may cancel only your own request.');
      return { actor, employee, request };
    }
    const stage = V.isHR(actor) ? 'hr' : V.isManager(actor) && inTeam(actor, employee) ? 'manager' : null;
    if (!stage) throw fail(403, 'leave_forbidden', 'Only HR or the current reporting manager may decide this request.');
    return { actor, employee, request, stage };
  }
  const managerRequired = request => typeof request.managerRequired === 'boolean' ? request.managerRequired : Boolean(V.empAny(request.employeeId)?.managerId || request.managerDecidedByUserId);
  function detail(request, actorId) {
    const actor = current(actorId), employee = V.empAny(request.employeeId), visible = V.visibleEmpIds(actor);
    if (!employee || visible && !visible.has(employee.id)) throw fail(403, 'leave_forbidden', 'This request is outside your current HR scope.');
    const selected = context(), canWrite = selected?.tools?.hr?.canWrite === true && !selected?.actor?.readOnly;
    const stage = V.isHR(actor) ? 'hr' : V.isManager(actor) && inTeam(actor, employee) && managerRequired(request) ? 'manager' : null;
    const status = overall(request);
    return { ...V.timeOffDetail({ ...request, status }), capabilities: { canDecide: canWrite && status !== 'cancelled' && Boolean(stage), decisionStage: stage, canCancel: canWrite && status === 'pending' && (V.isHR(actor) || V.empByUser(actor.id)?.id === employee.id), readOnly: !canWrite, managerRequired: managerRequired(request) } };
  }
  function execute(action, payload, actorId) {
    const allowed = authorize(action, payload, actorId), { actor, employee } = allowed, now = L.nowIso();
    if (typeof identity.canWrite === 'function' && !identity.canWrite(actor)) throw fail(context()?.actor?.readOnly || context()?.tools?.hr?.access === 'read_only' ? 423 : 403, 'workspace_read_only', 'Your current HR access cannot change this request.');
    if (action === 'create') {
      if (employee.isActive === false || ['invited', 'offboarded'].includes(employee.status)) throw fail(422, 'employment_inactive', 'An active employment record is required.');
      const timeOffType = payload.timeOffType || 'annual_leave', durationType = ['custom_hours', 'partial_day'].includes(payload.durationType) ? 'partial' : payload.durationType || 'full_day';
      if (!TYPES.includes(timeOffType) || !['full_day', 'half_day', 'partial'].includes(durationType)) throw fail(422, 'invalid_leave_duration', 'Choose a valid leave type and duration.');
      const start = civilDate(payload.startDate), endDate = durationType === 'full_day' ? payload.endDate || payload.startDate : payload.startDate, end = civilDate(endDate);
      if (end < start || (end - start) / DAY >= 366) throw fail(422, 'invalid_leave_date', 'Choose a date range of at most 366 days.');
      if (payload.employeeNote != null && (typeof payload.employeeNote !== 'string' || payload.employeeNote.length > 2000)) throw fail(422, 'invalid_leave_note', 'Use a note of at most 2000 characters.');
      const fields = { timeOffType, durationType, startDate: payload.startDate, endDate, halfDayPeriod: durationType === 'half_day' ? payload.halfDayPeriod || 'morning' : null, partialStartTime: durationType === 'partial' ? payload.partialStartTime : null, partialEndTime: durationType === 'partial' ? payload.partialEndTime : null };
      const bounds = availabilityBounds(fields, db.settings, workspace.timeZone);
      const conflict = db.timeOffs.rows.some(row => row.employeeId === employee.id && ['pending', 'approved'].includes(overall(row)) && (() => { const old = availabilityBounds(row, db.settings, workspace.timeZone); return old.startAt < bounds.endAt && old.endAt > bounds.startAt; })());
      if (conflict) throw fail(409, 'leave_overlap', 'This employee already has a pending or approved request during that time.');
      const workDays = L.dateRange(fields.startDate, fields.endDate).filter(date => C.isWorkingDay(date, employee));
      if (durationType === 'full_day' && !workDays.length) throw fail(422, 'non_working_days', 'Choose dates that include a working day.');
      const schedule = db.settings.attendance.schedule;
      const minutes = durationType === 'full_day' ? workDays.length * 1440 : durationType === 'half_day' ? (clockMinute(schedule.dayEndTime) - clockMinute(schedule.dayStartTime)) / 2 : clockMinute(fields.partialEndTime) - clockMinute(fields.partialStartTime);
      const byManager = employee.id !== V.empByUser(actor.id)?.id && V.isManager(actor) && !V.isHR(actor), required = Boolean(employee.managerId);
      const id = db.timeOffs.nextId();
      const request = db.timeOffs.insert({ ...fields, requestCode: `TOR-${fields.startDate.slice(0, 4)}-${String(id).padStart(4, '0')}`, employeeId: employee.id, totalDurationMinutes: minutes, employeeNote: payload.employeeNote || '', attachments: [], status: 'pending', managerRequired: required, managerActionStatus: !required || byManager ? 'approved' : 'pending', managerDecisionNote: byManager ? 'Created by manager.' : null, managerDecidedByUserId: byManager ? actor.id : null, managerDecidedAt: byManager ? now : null, hrActionStatus: 'pending', hrDecisionNote: null, hrDecidedByUserId: null, hrDecidedAt: null, decidedByUserId: null, decidedAt: null, createdByUserId: actor.id });
      log('requested', 'TimeOffRequest', request.id, actor.id, { employeeId: employee.id, timeOffType });
      if (required && request.managerActionStatus === 'pending') notify({ to: V.empAny(employee.managerId)?.authUserId ?? employee.managerId, actor: actor.id, action: 'time_off.requested', title: 'Time-off request awaiting your approval', entityType: 'AttendanceTimeOff', entityId: request.id });
      notify({ to: identity.users.filter(user => V.isHR(user)).map(user => user.id), actor: actor.id, action: 'time_off.requested', title: 'New time-off request', entityType: 'AttendanceTimeOff', entityId: request.id });
      return detail(request, actor.id);
    }
    const { request, stage } = allowed, before = overall(request);
    if (action === 'cancel') {
      if (before !== 'pending') throw fail(409, 'leave_unavailable', 'Only a pending request may be cancelled.');
      request.status = 'cancelled'; request.updatedAt = now;
      log('cancelled', 'TimeOffRequest', request.id, actor.id); return detail(request, actor.id);
    }
    if (!['pending', 'approved', 'rejected'].includes(payload.status) || before === 'cancelled') throw fail(422, 'invalid_leave_decision', 'Choose a valid decision for an available request.');
    if (payload.decisionNote != null && (typeof payload.decisionNote !== 'string' || payload.decisionNote.length > 1000)) throw fail(422, 'invalid_leave_note', 'Use a note of at most 1000 characters.');
    if (stage === 'manager' && !managerRequired(request)) throw fail(409, 'manager_not_required', 'This request does not require a manager decision.');
    Object.assign(request, { [`${stage}ActionStatus`]: payload.status, [`${stage}DecisionNote`]: payload.decisionNote || null, [`${stage}DecidedByUserId`]: payload.status === 'pending' ? null : actor.id, [`${stage}DecidedAt`]: payload.status === 'pending' ? null : now });
    request.status = overall(request); request.updatedAt = now;
    request.decidedAt = ['approved', 'rejected'].includes(request.status) ? request.hrDecidedAt || request.managerDecidedAt : null;
    request.decidedByUserId = ['approved', 'rejected'].includes(request.status) ? request.hrActionStatus !== 'pending' ? request.hrDecidedByUserId : request.managerDecidedByUserId : null;
    log(payload.status, 'TimeOffRequest', request.id, actor.id, { decidedAs: stage, note: payload.decisionNote || null });
    if (request.status !== before) notify({ to: employee.authUserId ?? employee.id, actor: actor.id, action: 'time_off.decided', title: `Time-off request ${request.status}`, entityType: 'AttendanceTimeOff', entityId: request.id });
    if (stage === 'manager' && payload.status === 'approved' && request.hrActionStatus === 'pending') notify({ to: identity.users.filter(user => V.isHR(user)).map(user => user.id).concat(employee.authUserId ?? employee.id), actor: actor.id, action: 'time_off.manager_approved', title: 'Awaiting HR decision', entityType: 'AttendanceTimeOff', entityId: request.id });
    return detail(request, actor.id);
  }
  return { authorize, execute, detail };
}
module.exports = { createLeaveService, civilDate, availabilityBounds, overall };
