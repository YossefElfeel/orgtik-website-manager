const { test } = require('node:test');
const assert = require('node:assert/strict');
const { makeStore } = require('../apps/admin/store');
const { initializeWorkspaceAuthority, seatCounts } = require('./workspace-context');
const hr = require('./workspace-hr');
const people = require('./workspace-people');
function fixture() {
  const owner = { id: 1, key: 'admin', email: 'owner@fixture.test', isActive: true }, employee = { id: 2, key: 'employee', email: 'worker@fixture.test', firstName: 'Existing', lastName: 'Person', isActive: true, passwordHash: 'preserved' };
  const identity = { users: [owner, employee], grants: {}, findUser: id => identity.users.find(row => row.id === Number(id)), findByEmail: email => identity.users.find(row => row.email === email), findByKey: key => identity.users.find(row => row.key === key) };
  const S = makeStore({ identity }); let now = Date.parse('2026-10-07T09:00:00Z'); S.now = () => now;
  initializeWorkspaceAuthority(S, identity);
  const ws = S.createWorkspace({ wsId: 'hr-workspace', ownerKey: owner.key, name: 'People', email: owner.email, currency: 'CHF' });
  ws.lines.push({ tool: 'hr', planId: 'hr_pro', state: 'active', snapshot: { quantity: 2 } });
  ws.members[0].toolGrants = { hr: { roles: ['super_admin'], assigned: true } };
  let snapshot = { data: { employees: [], timeOffs: [] }, sequences: {} };
  const runtime = { exportSnapshot: () => structuredClone(snapshot), applyCommitted(command) {
    if (command.snapshot) snapshot = structuredClone(command.snapshot);
    else if (command.kind === 'hr.employee.upsert') {
      const index = snapshot.data.employees.findIndex(row => row.id === command.payload.employee.id);
      if (index < 0) snapshot.data.employees.push(structuredClone(command.payload.employee));
      else snapshot.data.employees[index] = structuredClone(command.payload.employee);
    }
    else if (command.kind === 'hr.employee.offboard') Object.assign(snapshot.data.employees.find(row => row.id === command.payload.employeeId), { status: 'offboarded', isActive: false });
  } };
  return { S, identity, workspace: ws, actor: owner, runtime, employee, setNow: value => now = Date.parse(value) };
}
test('hire reuses identity, preserves credentials, reserves invitation and activates employment once', () => {
  const f = fixture(), before = f.identity.users.length;
  const result = hr.hire({ ...f, payload: { firstName: 'Existing', lastName: 'Person', email: f.employee.email } });
  assert.equal(f.identity.users.length, before); assert.equal(f.employee.passwordHash, 'preserved');
  assert.equal(result.status, 'invited'); assert.equal(result.salary.currency, 'CHF'); assert.equal(result.isActive, false);
  assert.equal(seatCounts(f.S, f.workspace, 'hr').reserved, 1);
  const token = f.S.db.mailbox.at(-1).acceptanceToken;
  people.acceptInvitation(f.S, f.identity, token, f.employee, {});
  assert.equal(hr.activateEmployee({ ...f, userId: f.employee.id }), true);
  assert.equal(hr.activateEmployee({ ...f, userId: f.employee.id }), false);
  assert.equal(f.runtime.exportSnapshot().data.employees[0].status, 'active');
});
test('end date keeps access through workspace day, releases seats once and preserves other memberships', () => {
  const f = fixture(); hr.hire({ ...f, payload: { firstName: 'Existing', lastName: 'Person', email: f.employee.email } });
  people.acceptInvitation(f.S, f.identity, f.S.db.mailbox.at(-1).acceptanceToken, f.employee, {});
  hr.activateEmployee({ ...f, userId: f.employee.id });
  const other = f.S.createWorkspace({ wsId: 'other', ownerKey: f.employee.key, name: 'Other', email: f.employee.email });
  const row = hr.offboard({ ...f, payload: { employeeId: f.employee.id, effectiveAt: '2026-10-08' } });
  assert.equal(row.effectiveAt, '2026-10-08T21:00:00.000Z');
  f.setNow('2026-10-08T20:59:59Z'); assert.deepEqual(hr.runOffboarding(f).completed, []);
  assert.equal(people.memberOf(f.workspace, f.employee).status, 'active');
  f.setNow(row.effectiveAt); assert.deepEqual(hr.runOffboarding(f).completed, [2]);
  assert.deepEqual(hr.runOffboarding(f).completed, []);
  assert.equal(seatCounts(f.S, f.workspace, 'hr').assigned, 1);
  assert.equal(other.members[0].status, 'active'); assert.equal(f.employee.isActive, true); assert.equal(f.employee.passwordHash, 'preserved');
  assert.equal(row.equipment.status, 'pending'); assert.equal(row.finalPay.status, 'pending');
});
test('offboarding owner requires a valid replacement before revoking membership', () => {
  const f = fixture(); f.runtime.applyCommitted({ kind: 'hr.employee.upsert', payload: { employee: { id: 1, authUserId: 1, salary: { currency: 'CHF' } } } });
  assert.throws(() => hr.offboard({ ...f, payload: { employeeId: 1 } }), { code: 'ownership_transfer_required' });
  f.workspace.members.push({ id: 'next-owner', userKey: f.employee.key, status: 'active', role: 'member', revision: 1, toolGrants: {} });
  hr.offboard({ ...f, payload: { employeeId: 1, transfer: { ownerMemberId: 'next-owner' } } });
  assert.equal(f.workspace.members[1].role, 'owner'); assert.equal(f.workspace.members[0].status, 'offboarded');
});
test('scheduled offboarding still revokes a departed owner when the proposed successor becomes inactive', () => {
  const f = fixture(); f.runtime.applyCommitted({ kind: 'hr.employee.upsert', payload: { employee: { id: 1, authUserId: 1, salary: { currency: 'CHF' } } } });
  f.workspace.members.push({ id: 'next-owner', userKey: f.employee.key, status: 'active', role: 'member', revision: 1, toolGrants: {} });
  const row = hr.offboard({ ...f, payload: { employeeId: 1, effectiveAt: '2026-10-08', transfer: { ownerMemberId: 'next-owner' } } });
  f.workspace.members[1].status = 'removed'; f.setNow(row.effectiveAt);
  hr.runOffboarding(f);
  assert.equal(f.workspace.state, 'suspended'); assert.equal(f.workspace.members[0].status, 'offboarded');
  assert.equal(f.workspace.flags.ownershipReview.offboardingId, row.id);
});
test('inactive, deleted or missing successor accounts cannot be scheduled or offered as owners', () => {
  for (const unavailable of ['inactive', 'deleted', 'missing']) {
    const f = fixture();
    f.runtime.applyCommitted({ kind: 'hr.employee.upsert', payload: { employee: { id: 1, authUserId: 1, email: f.actor.email, salary: { currency: 'CHF' } } } });
    f.workspace.members.push({ id: 'next-owner', userKey: f.employee.key, status: 'active', role: 'member', revision: 1, toolGrants: { hr: { assigned: true, roles: ['hr'] } } });
    if (unavailable === 'inactive') f.employee.isActive = false;
    if (unavailable === 'deleted') f.employee.deletedAt = '2026-10-07T09:00:00Z';
    if (unavailable === 'missing') f.identity.users.splice(f.identity.users.indexOf(f.employee), 1);
    const options = hr.offboardingOptions({ ...f, payload: { employeeId: 1 } });
    assert.deepEqual(options.successors, [], unavailable);
    assert.ok(options.custodyCoverage.every(row => row.eligibleSuccessorMemberIds.length === 0), unavailable);
    assert.throws(() => hr.offboard({ ...f, payload: { employeeId: 1, transfer: { ownerMemberId: 'next-owner' } } }), { code: 'ownership_transfer_required' });
    assert.deepEqual(f.workspace.offboardings, []);
    assert.equal(f.workspace.members[0].status, 'active');
  }
});
test('successor account deactivation after scheduling archives custody and revokes only the departed workspace', () => {
  const custody = require('./workspace-custody');
  for (const unavailable of ['inactive', 'deleted', 'missing']) {
    const f = fixture(), other = f.S.createWorkspace({ wsId: 'other-owner-workspace', ownerKey: f.actor.key, name: 'Independent', email: f.actor.email });
    const otherBefore = structuredClone(other), credentials = f.actor.passwordHash;
    f.runtime.applyCommitted({ kind: 'hr.employee.upsert', payload: { employee: { id: 1, authUserId: 1, email: f.actor.email, salary: { currency: 'CHF' } } } });
    const successor = { id: 'next-owner', userKey: f.employee.key, status: 'active', role: 'member', revision: 1, toolGrants: { hr: { assigned: true, roles: ['hr'] } } };
    f.workspace.members.push(successor);
    const row = hr.offboard({ ...f, payload: { employeeId: 1, effectiveAt: '2026-10-08', transfer: { ownerMemberId: successor.id } } });
    if (unavailable === 'inactive') f.employee.isActive = false;
    if (unavailable === 'deleted') f.employee.deletedAt = '2026-10-07T09:00:00Z';
    if (unavailable === 'missing') f.identity.users.splice(f.identity.users.indexOf(f.employee), 1);
    f.setNow(row.effectiveAt);
    const targetKinds = [];
    const transferOwned = () => {
      const kind = custody.eligible(successor, 'hr', f.identity) ? 'member' : 'archive';
      targetKinds.push(kind); return { hr: { transferred: [], archived: ['department:fixture'] } };
    };
    assert.deepEqual(hr.runOffboarding({ ...f, transferOwned }).completed, [1], unavailable);
    assert.deepEqual(hr.runOffboarding({ ...f, transferOwned }).completed, [], unavailable);
    assert.deepEqual(targetKinds, ['archive'], unavailable);
    assert.equal(row.status, 'completed'); assert.deepEqual(row.custody.hr.archived, ['department:fixture']);
    assert.equal(f.workspace.state, 'suspended'); assert.equal(f.workspace.flags.ownershipReview.offboardingId, row.id);
    assert.equal(f.workspace.members[0].status, 'offboarded'); assert.equal(f.workspace.members[0].toolGrants.hr.assigned, false);
    assert.equal(successor.status, 'active'); assert.equal(successor.role, 'member');
    assert.equal(f.actor.isActive, true); assert.equal(f.actor.passwordHash, credentials);
    assert.deepEqual(other, otherBefore, unavailable);
  }
});
test('an unavailable staged HR runtime cannot invent a status-only approval or calendar cache', () => {
  const f = fixture(); const snapshot = f.runtime.exportSnapshot();
  snapshot.data.timeOffs.push({ id: 9, employeeId: 2, startDate: '2026-10-09', endDate: '2026-10-10', status: 'pending', timeOffType: 'annual_leave', managerActionStatus: 'pending', hrActionStatus: 'pending' });
  f.runtime.applyCommitted({ snapshot });
  const before = f.runtime.exportSnapshot(), workspaceBefore = structuredClone(f.workspace);
  assert.throws(() => hr.approveLeave({ ...f, payload: { requestId: 9, status: 'approved' } }), error => error.status === 503 && error.code === 'workspace_runtime_unavailable');
  assert.deepEqual(f.runtime.exportSnapshot(), before); assert.deepEqual(f.workspace, workspaceBefore);
  assert.equal(f.workspace.approvedLeave, undefined); assert.equal(f.S.workspace('ws_orgtik').approvedLeave, undefined);
});
test('offboarding an unaccepted hire cancels its invitation and releases reserved capacity', () => {
  const f = fixture();
  const hired = hr.hire({ ...f, payload: { firstName: 'Pending', lastName: 'Worker', email: 'pending@fixture.test' } });
  assert.equal(seatCounts(f.S, f.workspace, 'hr').reserved, 1);
  const record = hr.offboard({ ...f, payload: { employeeId: hired.id } });
  assert.equal(record.status, 'completed'); assert.equal(seatCounts(f.S, f.workspace, 'hr').reserved, 0);
  assert.equal(f.workspace.invitations.find(row => row.id === hired.invitation.id).status, 'cancelled');
});
test('offboarding options use the workspace day and equipment/final-pay actions track mock completion', () => {
  const f = fixture();
  hr.hire({ ...f, payload: { firstName: 'Existing', lastName: 'Person', email: f.employee.email } });
  const options = hr.offboardingOptions({ ...f, payload: { employeeId: f.employee.id } });
  assert.equal(options.businessToday, '2026-10-07'); assert.equal(options.workspace.timeZone, 'Africa/Cairo');
  const record = hr.offboard({ ...f, payload: { employeeId: f.employee.id, effectiveAt: '2026-10-10' } });
  hr.offboardingAction({ ...f, payload: { employeeId: f.employee.id, offboardingId: record.id, action: 'equipment_returned', note: 'Sample equipment checked' } });
  hr.offboardingAction({ ...f, payload: { employeeId: f.employee.id, offboardingId: record.id, action: 'final_pay_completed' } });
  assert.equal(record.equipment.status, 'completed'); assert.equal(record.finalPay.mode, 'mock_tracking');
  assert.equal(record.finalPay.currency, 'CHF'); assert.equal(record.actions.length, 2);
  hr.offboardingAction({ ...f, payload: { employeeId: f.employee.id, offboardingId: record.id, action: 'cancel' } });
  assert.equal(record.status, 'cancelled');
});
test('hiring command refuses credentials and nested personal fields before identity or receipt effects', () => {
  const f = fixture(), payload = { firstName: 'Next', lastName: 'Worker', email: 'next@fixture.test' }, before = JSON.stringify(f.S.db), identities = f.identity.users.length;
  assert.throws(() => hr.hire({ ...f, payload: { ...payload, password: 'UnwantedSecret!' } }), { code: 'invalid_employee' });
  assert.throws(() => hr.hire({ ...f, payload: { ...payload, firstName: { password: 'UnwantedSecret!' } } }), { code: 'invalid_employee' });
  assert.equal(f.identity.users.length, identities); assert.equal(JSON.stringify(f.S.db), before);
});

function staffFixture() {
  const f = fixture(), internal = f.S.workspace('ws_orgtik');
  const peer = { id: 3, key: 'peer-super-admin', email: 'peer@staff.fixture.test', firstName: 'Peer', lastName: 'Administrator', isActive: true };
  f.identity.users.push(peer);
  internal.kind = 'orgtik_internal'; internal.offboardings = []; internal.flags = {};
  internal.members = [
    { id: 'hr-operator', userKey: f.actor.key, email: f.actor.email, role: 'owner', status: 'active', revision: 1, toolGrants: { hr: { assigned: true, roles: ['super_admin'] } } },
    { id: 'departing-staff', userKey: f.employee.key, email: f.employee.email, role: 'member', status: 'active', revision: 1, toolGrants: { hr: { assigned: true, roles: ['employee'] } } },
    { id: 'remaining-staff', userKey: peer.key, email: peer.email, role: 'member', status: 'active', revision: 1, toolGrants: {} },
  ];
  f.S.db.staffRoles = { [f.actor.key]: ['finance'], [f.employee.key]: ['super_admin'], [peer.key]: ['super_admin'] };
  f.identity.grants.website_manager = { [f.employee.key]: { roles: ['wm_super_admin'] } };
  f.runtime.applyCommitted({ kind: 'hr.employee.upsert', payload: { employee: { id: f.employee.id, authUserId: f.employee.id, userKey: f.employee.key, email: f.employee.email, firstName: 'Existing', lastName: 'Staff', salary: { currency: 'CHF' }, status: 'active', isActive: true } } });
  return { ...f, workspace: internal, peer, peerMember: internal.members[2], departedMember: internal.members[1] };
}

test('civil end dates use the first valid following Cairo day when midnight is missing', () => {
  assert.equal(new Date(hr.endInstant({ timeZone: 'Africa/Cairo' }, '2026-04-23', 0)).toISOString(), '2026-04-23T22:00:00.000Z');
  assert.equal(new Date(hr.endInstant({ timeZone: 'Africa/Cairo' }, '2026-10-08', 0)).toISOString(), '2026-10-08T21:00:00.000Z');
  assert.throws(() => hr.endInstant({ timeZone: 'Africa/Cairo' }, '2026-02-30', 0), { code: 'invalid_end_date' });
});

test('manual scheduling requires a current canonical actor and cannot partially alter employment', () => {
  for (const actor of [null, { id: 99, key: 'unknown' }, { id: 1, key: 'spoofed' }]) {
    const f = staffFixture(), before = structuredClone(f.S.db), snapshot = f.runtime.exportSnapshot();
    assert.throws(() => hr.offboard({ ...f, actor, payload: { employeeId: f.employee.id, effectiveAt: '2026-10-08' } }), { code: 'offboarding_actor_required' });
    assert.deepEqual(f.S.db, before); assert.deepEqual(f.runtime.exportSnapshot(), snapshot);
  }
});

test('last-super-admin scheduling counts canonical internal authority, not staff hints or customer tool roles', () => {
  for (const condition of ['inactive', 'deleted', 'pending', 'missing', 'guest', 'offboarded', 'customer', 'revoked', 'no-staff-role', 'malformed-role']) {
    const f = staffFixture();
    if (condition === 'inactive') f.peer.isActive = false;
    if (condition === 'deleted') f.peer.deletedAt = '2026-10-07T09:00:00Z';
    if (condition === 'pending') f.peer.pendingActivation = true;
    if (condition === 'missing') f.identity.users.splice(f.identity.users.indexOf(f.peer), 1);
    if (condition === 'guest') f.peerMember.role = 'guest';
    if (condition === 'offboarded') f.peerMember.status = 'offboarded';
    if (condition === 'customer') { f.workspace.members.splice(2, 1); f.S.createWorkspace({ wsId: 'peer-customer', ownerKey: f.peer.key, name: 'Customer', email: f.peer.email }); }
    if (condition === 'revoked') f.S.db.staffAuthorityRevocations = { [f.peer.key]: null };
    if (condition === 'no-staff-role') { f.S.db.staffRoles[f.peer.key] = []; f.peer.userType = 'admin'; f.identity.grants.global = { [f.peer.key]: { roles: ['super_admin'] } }; f.peerMember.toolGrants.hr = { roles: ['super_admin'], assigned: true }; }
    if (condition === 'malformed-role') f.S.db.staffRoles[f.peer.key] = 'super_admin';
    const before = structuredClone(f.S.db), options = hr.offboardingOptions({ ...f, payload: { employeeId: f.employee.id } });
    assert.equal(options.canOffboard, false, condition); assert.equal(options.staffProtection.isLastActiveSuperAdmin, true, condition);
    assert.equal(options.staffProtection.activeReplacementCount, 0, condition); assert.equal(options.staffProtection.reason, 'active_super_admin_required');
    assert.equal(Object.hasOwn(options.staffProtection, 'replacementUserKeys'), false);
    assert.throws(() => hr.offboard({ ...f, payload: { employeeId: f.employee.id, effectiveAt: '2026-10-08' } }), { code: 'active_super_admin_required' }, condition);
    assert.deepEqual(f.S.db, before, condition); assert.equal(f.departedMember.status, 'active');
  }
});

test('a peer scheduled to leave by the proposed boundary cannot be the protecting super administrator', () => {
  const f = staffFixture(), at = '2026-10-08T21:00:00.000Z';
  f.workspace.offboardings.push({ id: 'peer-departure', userId: f.peer.id, userKey: f.peer.key, memberId: f.peerMember.id, effectiveAt: at, status: 'scheduled' });
  const before = structuredClone(f.S.db);
  assert.throws(() => hr.offboard({ ...f, payload: { employeeId: f.employee.id, effectiveAt: '2026-10-08' } }), { code: 'active_super_admin_required' });
  assert.deepEqual(f.S.db, before);
  f.workspace.offboardings[0].effectiveAt = '2026-10-09T21:00:00Z';
  assert.equal(hr.offboard({ ...f, payload: { employeeId: f.employee.id, effectiveAt: '2026-10-08' } }).status, 'scheduled');
});

test('a qualified staff replacement permits departure without promoting roles or affecting another workspace', () => {
  const f = staffFixture(), other = f.S.createWorkspace({ wsId: 'staff-customer', ownerKey: f.employee.key, name: 'Independent', email: f.employee.email });
  const otherBefore = structuredClone(other), roles = structuredClone(f.S.db.staffRoles), grants = structuredClone(f.identity.grants), credentials = f.employee.passwordHash;
  const row = hr.offboard({ ...f, payload: { employeeId: f.employee.id, effectiveAt: '2026-10-08' } });
  assert.equal(row.staffProtection.activeReplacementCount, 1);
  assert.equal(Object.hasOwn(row.staffProtection, 'eligibleReplacementUserKeys'), false);
  f.setNow(row.effectiveAt); assert.deepEqual(hr.runOffboarding({ ...f, actor: null }).completed, [f.employee.id]);
  assert.deepEqual(f.S.db.staffAuthorityRevocations[f.employee.key], { workspaceId: 'ws_orgtik', memberId: f.departedMember.id, offboardingId: row.id, at: row.effectiveAt });
  assert.equal(row.staffRecovery, undefined); assert.equal(f.workspace.flags.staffRecovery, undefined);
  assert.equal(f.departedMember.status, 'offboarded'); assert.equal(f.departedMember.toolGrants.hr.assigned, false);
  assert.deepEqual(f.S.db.staffRoles, roles); assert.deepEqual(f.identity.grants, grants); assert.equal(f.employee.passwordHash, credentials); assert.equal(f.employee.isActive, true); assert.deepEqual(other, otherBefore);
});

test('late loss of the qualified replacement records recovery once and never retains departed authority', () => {
  for (const unavailable of ['inactive', 'deleted', 'missing', 'guest', 'removed', 'revoked', 'role-removed']) {
    const f = staffFixture(), other = f.S.createWorkspace({ wsId: 'late-customer', ownerKey: f.employee.key, name: 'Independent', email: f.employee.email });
    const otherBefore = structuredClone(other), roles = structuredClone(f.S.db.staffRoles), password = f.employee.passwordHash;
    const row = hr.offboard({ ...f, payload: { employeeId: f.employee.id, effectiveAt: '2026-10-08' } });
    if (unavailable === 'inactive') f.peer.isActive = false;
    if (unavailable === 'deleted') f.peer.deletedAt = '2026-10-08T09:00:00Z';
    if (unavailable === 'missing') f.identity.users.splice(f.identity.users.indexOf(f.peer), 1);
    if (unavailable === 'guest') f.peerMember.role = 'guest';
    if (unavailable === 'removed') f.peerMember.status = 'removed';
    if (unavailable === 'revoked') f.S.db.staffAuthorityRevocations = { [f.peer.key]: { offboardingId: 'earlier', at: row.effectiveAt } };
    if (unavailable === 'role-removed') f.S.db.staffRoles[f.peer.key] = [];
    const currentRoles = structuredClone(f.S.db.staffRoles), grants = structuredClone(f.identity.grants);
    f.setNow('2026-10-11T09:00:00Z'); assert.deepEqual(hr.runOffboarding({ ...f, actor: null }).completed, [f.employee.id], unavailable);
    assert.equal(f.departedMember.status, 'offboarded'); assert.equal(f.departedMember.accessEpoch, 1); assert.equal(f.departedMember.toolGrants.hr.assigned, false);
    assert.equal(row.completedAt, row.effectiveAt); assert.equal(row.staffRecovery.at, row.effectiveAt); assert.equal(row.staffRecovery.detectedAt, '2026-10-11T09:00:00.000Z');
    assert.equal(f.workspace.flags.staffRecovery.offboardingId, row.id); assert.equal(f.S.db.staffAuthorityRevocations[f.employee.key].offboardingId, row.id);
    const audit = f.S.db.audit.filter(event => event.action === 'staff_recovery_required' && event.target === row.id);
    assert.equal(audit.length, 1); assert.equal(audit[0].by, 'system');
    const notices = f.S.db.mailbox.filter(message => message.template === 'staff_recovery_required' && message.offboardingId === row.id);
    assert.ok(notices.length > 0); const beforeRepeat = structuredClone(f.S.db);
    assert.deepEqual(hr.runOffboarding({ ...f, actor: null }).completed, []); assert.deepEqual(f.S.db, beforeRepeat);
    assert.deepEqual(f.S.db.staffRoles, currentRoles); assert.deepEqual(f.identity.grants, grants); assert.equal(f.employee.passwordHash, password); assert.equal(f.employee.isActive, true); assert.deepEqual(other, otherBefore);
    const options = hr.offboardingOptions({ ...f, payload: { employeeId: f.employee.id } });
    assert.deepEqual(options.staffRecovery, { status: 'required', offboardingId: row.id, at: row.effectiveAt });
  }
});

test('ordinary internal employment rehire never clears a durable staff authority revocation', () => {
  const f = staffFixture(), roles = structuredClone(f.S.db.staffRoles), grants = structuredClone(f.identity.grants);
  const row = hr.offboard({ ...f, payload: { employeeId: f.employee.id } }), marker = structuredClone(f.S.db.staffAuthorityRevocations[f.employee.key]);
  const invited = hr.hire({ ...f, payload: { firstName: 'Existing', lastName: 'Staff', email: f.employee.email } });
  people.acceptInvitation(f.S, f.identity, f.S.db.mailbox.at(-1).acceptanceToken, f.employee, {}); hr.activateEmployee({ ...f, userId: f.employee.id });
  assert.equal(invited.authUserId, f.employee.id); assert.equal(people.memberOf(f.workspace, f.employee).status, 'active');
  assert.deepEqual(f.S.db.staffAuthorityRevocations[f.employee.key], marker); assert.deepEqual(f.S.db.staffRoles, roles); assert.deepEqual(f.identity.grants, grants); assert.equal(f.employee.passwordHash, 'preserved');
  assert.equal(hr.offboardingOptions({ ...f, payload: { employeeId: f.employee.id } }).staffProtection.isSuperAdmin, false);
  assert.equal(marker.offboardingId, row.id);
});

test('non-super-admin internal departures also revoke historical staff authority without creating a recovery incident', () => {
  const f = staffFixture(); f.S.db.staffRoles[f.employee.key] = ['content']; const roles = structuredClone(f.S.db.staffRoles), grants = structuredClone(f.identity.grants);
  const row = hr.offboard({ ...f, payload: { employeeId: f.employee.id } });
  assert.equal(f.S.db.staffAuthorityRevocations[f.employee.key].offboardingId, row.id); assert.equal(f.workspace.flags.staffRecovery, undefined);
  assert.deepEqual(f.S.db.staffRoles, roles); assert.deepEqual(f.identity.grants, grants);
});

test('customer HR changes never disclose or mutate staff protections, roles, passwords or authority markers', () => {
  const f = fixture(); f.S.db.staffRoles[f.employee.key] = ['super_admin'];
  f.identity.grants.website_manager = { [f.employee.key]: { roles: ['wm_super_admin'] } };
  f.S.db.staffAuthorityRevocations = { [f.actor.key]: { workspaceId: 'ws_orgtik', offboardingId: 'historical', at: '2026-01-01T00:00:00Z' } };
  f.S.db.staffAccessEpochs = { [f.actor.key]: 4, [f.employee.key]: 7 };
  const roles = structuredClone(f.S.db.staffRoles), grants = structuredClone(f.identity.grants), markers = structuredClone(f.S.db.staffAuthorityRevocations), epochs = structuredClone(f.S.db.staffAccessEpochs);
  hr.hire({ ...f, payload: { firstName: 'Existing', lastName: 'Person', email: f.employee.email } });
  people.acceptInvitation(f.S, f.identity, f.S.db.mailbox.at(-1).acceptanceToken, f.employee, {}); hr.activateEmployee({ ...f, userId: f.employee.id });
  const options = hr.offboardingOptions({ ...f, payload: { employeeId: f.employee.id } });
  assert.equal(options.staffProtection, null); assert.equal(options.staffRecovery, null);
  hr.offboard({ ...f, payload: { employeeId: f.employee.id } });
  assert.deepEqual(f.S.db.staffRoles, roles); assert.deepEqual(f.identity.grants, grants); assert.deepEqual(f.S.db.staffAuthorityRevocations, markers); assert.deepEqual(f.S.db.staffAccessEpochs, epochs); assert.equal(f.employee.passwordHash, 'preserved'); assert.equal(f.employee.isActive, true);
});

test('internal departure advances staff access epoch once without changing another person or customer membership', () => {
  for (const starting of [undefined, 0, 8]) {
    const f = staffFixture(), other = f.S.createWorkspace({ wsId: 'epoch-customer', ownerKey: f.employee.key, name: 'Other', email: f.employee.email });
    f.S.db.staffAccessEpochs = { [f.peer.key]: 12 };
    if (starting !== undefined) f.S.db.staffAccessEpochs[f.employee.key] = starting;
    const otherBefore = structuredClone(other), roles = structuredClone(f.S.db.staffRoles), grants = structuredClone(f.identity.grants);
    const row = hr.offboard({ ...f, payload: { employeeId: f.employee.id } });
    assert.equal(row.status, 'completed'); assert.equal(f.S.db.staffAccessEpochs[f.employee.key], (starting || 0) + 1);
    assert.equal(f.S.db.staffAccessEpochs[f.peer.key], 12); const after = structuredClone(f.S.db);
    assert.deepEqual(hr.runOffboarding({ ...f, actor: null }).completed, []); assert.deepEqual(f.S.db, after);
    assert.deepEqual(other, otherBefore); assert.deepEqual(f.S.db.staffRoles, roles); assert.deepEqual(f.identity.grants, grants); assert.equal(f.employee.passwordHash, 'preserved');
  }
});

test('malformed staff epochs fail closed before a due row can alter markers, authority or employment', () => {
  for (const bad of [-1, 0.25, NaN, null, '1', Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1]) {
    const f = staffFixture(), row = hr.offboard({ ...f, payload: { employeeId: f.employee.id, effectiveAt: '2026-10-08' } });
    f.S.db.staffAccessEpochs = { [f.employee.key]: bad }; f.setNow(row.effectiveAt);
    const before = structuredClone(f.S.db), snapshot = f.runtime.exportSnapshot();
    assert.throws(() => hr.runOffboarding({ ...f, actor: null }), { code: 'staff_epoch_invalid' });
    assert.deepEqual(f.S.db, before); assert.deepEqual(f.runtime.exportSnapshot(), snapshot); assert.equal(row.status, 'scheduled');
  }
  for (const badMap of [null, [], 'broken', 1]) {
    const f = staffFixture(), row = hr.offboard({ ...f, payload: { employeeId: f.employee.id, effectiveAt: '2026-10-08' } });
    f.S.db.staffAccessEpochs = badMap; f.setNow(row.effectiveAt); const before = structuredClone(f.S.db);
    assert.throws(() => hr.runOffboarding({ ...f, actor: null }), { code: 'staff_epoch_invalid' }); assert.deepEqual(f.S.db, before);
  }
});

test('malformed revocation dictionaries cannot drop authority markers from a JSON checkpoint', () => {
  for (const badMap of [null, [], 'broken', 1, new Date('2026-01-01T00:00:00Z')]) {
    const f = staffFixture(), row = hr.offboard({ ...f, payload: { employeeId: f.employee.id, effectiveAt: '2026-10-08' } });
    f.S.db.staffAuthorityRevocations = badMap; f.S.db.staffAccessEpochs = { [f.employee.key]: 4 }; f.setNow(row.effectiveAt);
    const before = structuredClone(f.S.db), snapshot = f.runtime.exportSnapshot();
    assert.throws(() => hr.runOffboarding({ ...f, actor: null }), { code: 'staff_revocations_invalid' });
    assert.deepEqual(f.S.db, before); assert.deepEqual(f.runtime.exportSnapshot(), snapshot); assert.equal(row.status, 'scheduled');
    assert.equal(f.S.db.staffAccessEpochs[f.employee.key], 4);
  }
});
