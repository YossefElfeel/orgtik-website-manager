const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runtime, plain } = require('../apps/hr/runtime-harness');

function fixture(workspaceId = 'ws_leave_unit', timeZone = 'Africa/Cairo') {
  const roles = { leave_hr: ['hr'], leave_manager: ['manager'], leave_worker: ['employee'], leave_other: ['employee'] };
  const people = ['leave_hr', 'leave_manager', 'leave_worker', 'leave_other'].map((key, index) => ({ id: index + 1, key, firstName: key, lastName: 'Fixture', email: `${key}@leave.test`, isActive: true }));
  const f = runtime('hr', workspaceId, { people, roles, timeZone });
  f.identity.currentContext = () => ({ actor: { readOnly: false }, tools: { hr: { canWrite: true } } });
  for (const user of people) f.instance.applyCommitted({ kind: 'hr.employee.upsert', payload: { employee: { id: user.id, authUserId: user.id, userKey: user.key, firstName: user.firstName, lastName: user.lastName, email: user.email, employeeCode: `EMP-${user.id}`, status: 'active', isActive: true, deletedAt: null, departmentId: null, managerId: user.id === 3 ? 2 : null, joinDate: '2026-01-01', employeeType: 'full_time', salary: { currency: 'EGP' }, daysOff: { annualLeave: 30 } } } });
  return { ...f, roles, create: (body, actor = 3) => plain(f.instance.executeLeave('create', body, actor)), decide: (id, status, actor, note = '') => plain(f.instance.executeLeave('decision', { requestId: id, status, decisionNote: note }, actor)) };
}
const full = (startDate = '2026-11-02', endDate = startDate) => ({ timeOffType: 'annual_leave', durationType: 'full_day', startDate, endDate, employeeNote: 'Private employee note' });
const failsWithoutMutation = (f, operation, status) => {
  const before = plain(f.instance.exportSnapshot());
  assert.throws(operation, error => error.status === status, `expected HTTP${status}`);
  assert.deepEqual(plain(f.instance.exportSnapshot()), before);
};

test('leave decisions retain manager and HR stages, attribution and the HR detail serializer', () => {
  const f = fixture();
  try {
    const created = f.create(full('2026-11-02', '2026-11-03'));
    assert.equal(created.employeeId, 3); assert.equal(created.status, 'pending');
    assert.equal(created.managerActionStatus, 'pending'); assert.equal(created.hrActionStatus, 'pending');
    assert.deepEqual(created.capabilities, { canDecide: false, decisionStage: null, canCancel: true, readOnly: false, managerRequired: true });
    assert.equal(created.timeOffType, 'annual_leave'); assert.equal(created.employee.id, 3);
    const managed = f.decide(created.id, 'approved', 2, 'Manager note');
    assert.equal(managed.status, 'pending'); assert.equal(managed.managerActionStatus, 'approved'); assert.equal(managed.hrActionStatus, 'pending');
    assert.equal(managed.capabilities.decisionStage, 'manager'); assert.equal(managed.capabilities.canDecide, true);
    assert.equal(managed.managerDecidedByUserId, 2); assert.equal(managed.managerDecisionNote, 'Manager note'); assert.ok(managed.managerDecidedAt);
    const approved = f.decide(created.id, 'approved', 1, 'HR note');
    assert.equal(approved.status, 'approved'); assert.equal(approved.hrActionStatus, 'approved'); assert.equal(approved.hrDecidedByUserId, 1);
    assert.equal(approved.capabilities.decisionStage, 'hr'); assert.equal(approved.capabilities.canCancel, false);
    assert.equal(approved.hrDecisionNote, 'HR note'); assert.deepEqual(approved.decisionNote, { reason: 'HR note' });
    assert.equal(approved.decidedByUserId, 1); assert.equal(approved.employee.id, 3);
    const managerReset = f.decide(created.id, 'pending', 2);
    assert.equal(managerReset.status, 'approved'); assert.equal(managerReset.managerDecidedByUserId, null); assert.equal(managerReset.managerDecidedAt, null);
    const reset = f.decide(created.id, 'pending', 1);
    assert.equal(reset.status, 'pending'); assert.equal(reset.hrActionStatus, 'pending'); assert.equal(reset.hrDecidedAt, null); assert.equal(reset.decidedAt, null);
    f.decide(created.id, 'approved', 1);
    assert.equal(f.decide(created.id, 'rejected', 2).status, 'rejected');
  } finally { f.close(); }
});

test('current manager relationships and tool roles authorize every decision, without mutation on refusal', () => {
  const f = fixture();
  try {
    const own = f.create(full()), unrelated = f.create({ ...full('2026-11-04'), employeeId: 4 }, 1);
    failsWithoutMutation(f, () => f.instance.authorizeLeave('decision', { requestId: unrelated.id, status: 'approved' }, 2), 403);
    failsWithoutMutation(f, () => f.instance.executeLeave('decision', { requestId: own.id, status: 'approved' }, 4), 403);
    failsWithoutMutation(f, () => f.create({ ...full('2026-11-05'), employeeId: 4 }, 2), 403);
    failsWithoutMutation(f, () => f.create({ ...full('2026-11-05'), employeeId: 4 }, 3), 403);
    f.roles.leave_manager = ['employee'];
    failsWithoutMutation(f, () => f.instance.authorizeLeave('decision', { requestId: own.id, status: 'approved' }, 2), 403);
    f.roles.leave_manager = ['manager'];
    const snapshot = plain(f.instance.exportSnapshot()); snapshot.data.employees.find(row => row.id === 3).managerId = 4;
    f.instance.applyCommitted({ snapshot });
    failsWithoutMutation(f, () => f.instance.authorizeLeave('decision', { requestId: own.id, status: 'approved' }, 2), 403);
  } finally { f.close(); }
});

test('create rejects forged decision fields, credentials, invalid dates and overlaps before changing counters', () => {
  const f = fixture();
  try {
    for (const patch of [{ status: 'approved' }, { decidedAs: 'hr' }, { password: 'MustNotBeRecorded!' }, { startDate: '2026-02-30' }, { startDate: '2026-11-04', endDate: '2026-11-03' }]) failsWithoutMutation(f, () => f.create({ ...full(), ...patch }), 422);
    f.create(full('2026-11-02', '2026-11-03'));
    failsWithoutMutation(f, () => f.create(full('2026-11-03', '2026-11-04')), 409);
  } finally { f.close(); }
});

test('full, half and partial leave retain explicit duration fields without inventing uploaded files', () => {
  const f = fixture();
  try {
    const fullDay = f.create(full()); assert.equal(fullDay.durationType, 'full_day'); assert.deepEqual(fullDay.attachments, []);
    for (const [day, halfDayPeriod] of [['2026-11-03', 'morning'], ['2026-11-04', 'afternoon']]) {
      const half = f.create({ ...full(day), durationType: 'half_day', halfDayPeriod });
      assert.equal(half.durationType, 'half_day'); assert.equal(half.halfDayPeriod, halfDayPeriod); assert.equal(half.totalDurationMinutes, 240);
    }
    const partial = f.create({ ...full('2026-11-05'), durationType: 'partial', partialStartTime: '11:00', partialEndTime: '13:00' });
    assert.equal(partial.durationType, 'partial'); assert.equal(partial.partialStartTime, '11:00'); assert.equal(partial.partialEndTime, '13:00'); assert.equal(partial.totalDurationMinutes, 120);
    failsWithoutMutation(f, () => f.create({ ...full('2026-11-06'), durationType: 'partial', partialStartTime: '13:00', partialEndTime: '11:00' }), 422);
    failsWithoutMutation(f, () => f.create({ ...full('2026-11-06'), durationType: 'half_day', halfDayPeriod: 'anytime' }), 422);
  } finally { f.close(); }
});

test('legacy employee and partial-duration aliases remain compatible without allowing conflicting targets', () => {
  const f = fixture();
  try {
    const first = f.create({ ...full(), employeeUserId: '3' }); assert.equal(first.employeeId, 3);
    for (const [day, durationType] of [['2026-11-03', 'custom_hours'], ['2026-11-04', 'partial_day']]) {
      const row = f.create({ ...full(day), employeeId: 3, employeeUserId: '3', durationType, partialStartTime: '10:00', partialEndTime: '11:00' });
      assert.equal(row.employeeId, 3); assert.equal(row.durationType, 'partial');
    }
    failsWithoutMutation(f, () => f.create({ ...full('2026-11-05'), employeeId: 3, employeeUserId: '4' }), 422);
    failsWithoutMutation(f, () => f.create(full('2026-11-02', '2027-11-03')), 422);
  } finally { f.close(); }
});

test('pending cancellation is self or HR only, and unavailable accounts or employment cannot create leave', () => {
  const f = fixture();
  try {
    const own = f.create(full());
    failsWithoutMutation(f, () => f.instance.executeLeave('cancel', { requestId: own.id }, 4), 403);
    const cancelled = plain(f.instance.executeLeave('cancel', { requestId: own.id }, 3)); assert.equal(cancelled.status, 'cancelled');
    failsWithoutMutation(f, () => f.decide(own.id, 'approved', 1), 422);
    f.identity.findUser(3).isActive = false;
    failsWithoutMutation(f, () => f.create(full('2026-11-04')), 403);
    f.identity.findUser(3).isActive = true;
    const snapshot = plain(f.instance.exportSnapshot()); snapshot.data.employees.find(row => row.id === 3).status = 'offboarded'; snapshot.data.employees.find(row => row.id === 3).isActive = false;
    f.instance.applyCommitted({ snapshot });
    failsWithoutMutation(f, () => f.create(full('2026-11-04')), 422);
  } finally { f.close(); }
});

test('independent workspace graphs keep overlapping request IDs and decisions private', () => {
  const first = fixture('ws_leave_first'), second = fixture('ws_leave_second');
  try {
    const one = first.create(full()), two = second.create({ ...full(), employeeNote: 'Independent private note' });
    assert.equal(one.id, two.id);
    const untouched = plain(second.instance.exportSnapshot());
    first.decide(one.id, 'approved', 2); first.decide(one.id, 'approved', 1);
    assert.deepEqual(plain(second.instance.exportSnapshot()), untouched); assert.equal(two.status, 'pending');
  } finally { first.close(); second.close(); }
});

function projectionFixture(f) {
  const workspace = { ...f.input.workspace, members: f.identity.users.map(person => ({ id: `member:${person.key}`, userKey: person.key, status: 'active', role: person.id === 4 ? 'guest' : 'member', toolGrants: { tasks: { assigned: true, roles: [person.id === 4 ? 'viewer' : 'developer'] }, chat: { assigned: true, roles: [person.id === 4 ? 'guest' : 'member'] } } })) };
  const project = (tool = 'tasks', actorId = 1, range = {}) => require('./workspace-availability').projectAvailability({ workspace, identity: f.identity, snapshot: plain(f.instance.exportSnapshot()), tool, actor: f.identity.findUser(actorId), fromDate: '2026-11-01', toDate: '2026-11-30', ...range });
  return { workspace, project };
}
test('availability derives approved HR records and exposes only the minimal current-tool calendar schema', () => {
  const f = fixture(), { workspace, project } = projectionFixture(f);
  try {
    const row = f.create({ ...full(), timeOffType: 'medical_appointment', employeeNote: 'Confidential medical explanation' });
    assert.deepEqual(project().items, []);
    f.decide(row.id, 'approved', 2); assert.deepEqual(project().items, []);
    f.decide(row.id, 'approved', 1, 'Private HR explanation');
    for (const tool of ['tasks', 'chats']) {
      const result = project(tool);
      assert.equal(result.workspaceId, workspace.id); assert.equal(result.timeZone, 'Africa/Cairo');
      assert.equal(result.items.length, 1);
      assert.deepEqual(Object.keys(result.items[0]).sort(), ['id', 'personId', 'personName', 'startDate', 'endDate', 'startAt', 'endAt', 'durationType', 'halfDayPeriod'].sort());
      assert.equal(result.items[0].personId, 3); assert.equal(result.items[0].durationType, 'full_day');
      assert.equal(JSON.stringify(result).includes('medical'), false); assert.equal(JSON.stringify(result).includes('Private HR'), false);
      assert.deepEqual(project(tool, 4).items, []);
    }
    f.decide(row.id, 'pending', 1); assert.deepEqual(project().items, []);
    f.decide(row.id, 'approved', 1); f.decide(row.id, 'rejected', 2); assert.deepEqual(project().items, []);
  } finally { f.close(); }
});

test('availability excludes inactive accounts, employment, memberships and unassigned tool seats independently', () => {
  const f = fixture(), { workspace, project } = projectionFixture(f);
  try {
    const row = f.create(full()); f.decide(row.id, 'approved', 1);
    assert.equal(project().items.length, 1);
    f.identity.findUser(3).isActive = false; assert.deepEqual(project().items, []); f.identity.findUser(3).isActive = true;
    f.identity.findUser(3).deletedAt = '2026-10-07T09:00:00Z'; assert.deepEqual(project().items, []); delete f.identity.findUser(3).deletedAt;
    const member = workspace.members.find(item => item.userKey === 'leave_worker');
    member.status = 'offboarded'; assert.deepEqual(project().items, []); member.status = 'active';
    member.toolGrants.tasks.assigned = false; assert.deepEqual(project().items, []); assert.equal(project('chats').items.length, 1); member.toolGrants.tasks.assigned = true;
    const snapshot = plain(f.instance.exportSnapshot()); snapshot.data.employees.find(item => item.id === 3).isActive = false;
    f.instance.applyCommitted({ snapshot }); assert.deepEqual(project().items, []);
  } finally { f.close(); }
});

test('availability validates real date ranges and the93-inclusive-day bound', () => {
  const f = fixture(), { project } = projectionFixture(f);
  try {
    assert.doesNotThrow(() => project('tasks', 1, { fromDate: '2026-11-01', toDate: '2027-02-01' }));
    for (const range of [{ fromDate: '2026-11-01', toDate: '2027-02-02' }, { fromDate: '2026-02-30', toDate: '2026-03-02' }, { fromDate: '2026-11-03', toDate: '2026-11-02' }]) assert.throws(() => project('tasks', 1, range), error => error.status === 422);
  } finally { f.close(); }
});

test('availability wall-clock boundaries preserve full, half, partial and DST durations', () => {
  const f = fixture();
  try {
    const { availabilityBounds } = require('../apps/hr/leave'), settings = plain(f.instance.exportSnapshot()).data.settings;
    const bounds = (body, zone = 'Africa/Cairo') => availabilityBounds(body, settings, zone);
    assert.deepEqual(bounds({ ...full(), durationType: 'half_day', halfDayPeriod: 'morning' }), { startAt: '2026-11-02T07:00:00.000Z', endAt: '2026-11-02T11:00:00.000Z' });
    assert.deepEqual(bounds({ ...full(), durationType: 'half_day', halfDayPeriod: 'afternoon' }), { startAt: '2026-11-02T11:00:00.000Z', endAt: '2026-11-02T15:00:00.000Z' });
    assert.deepEqual(bounds({ ...full(), durationType: 'partial', partialStartTime: '11:00', partialEndTime: '13:00' }), { startAt: '2026-11-02T09:00:00.000Z', endAt: '2026-11-02T11:00:00.000Z' });
    const spring = bounds(full('2026-03-29'), 'Europe/Berlin'), autumn = bounds(full('2026-10-25'), 'Europe/Berlin');
    assert.equal(Date.parse(spring.endAt) - Date.parse(spring.startAt), 23 * 3600000);
    assert.equal(Date.parse(autumn.endAt) - Date.parse(autumn.startAt), 25 * 3600000);
    assert.deepEqual(bounds(full('2026-04-23')), { startAt: '2026-04-22T22:00:00.000Z', endAt: '2026-04-23T22:00:00.000Z' });
    assert.deepEqual(bounds(full('2026-04-24')), { startAt: '2026-04-23T22:00:00.000Z', endAt: '2026-04-24T21:00:00.000Z' });
    assert.throws(() => bounds({ ...full('2026-04-24'), durationType: 'partial', partialStartTime: '00:15', partialEndTime: '02:00' }), { code: 'invalid_local_time' });
    assert.throws(() => bounds({ ...full('2026-03-29'), durationType: 'partial', partialStartTime: '02:30', partialEndTime: '03:30' }, 'Europe/Berlin'), { code: 'invalid_local_time' });
    assert.equal(bounds({ ...full('2026-10-25'), durationType: 'partial', partialStartTime: '02:30', partialEndTime: '03:30' }, 'Europe/Berlin').startAt, '2026-10-25T00:30:00.000Z');
  } finally { f.close(); }
});
