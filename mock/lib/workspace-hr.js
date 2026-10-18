const people = require("./workspace-people");
const custody = require('./workspace-custody');
const { createBusinessCalendar } = require('./business-calendar');
const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
const dictionary = value => Boolean(value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)));
const isInternalEmployment = workspace => workspace?.id === 'ws_orgtik' && workspace.kind === 'orgtik_internal';
function qualifiedSuperAdmins(S, identity, { excludingKey, through, excludingOffboardingId } = {}) {
  const internal = S.workspace('ws_orgtik');
  if (!isInternalEmployment(internal)) return [];
  return internal.members.filter(member => member.userKey !== excludingKey && member.status === 'active' && member.role !== 'guest'
    && custody.hasActiveAccount(member, identity) && !Object.hasOwn(S.db.staffAuthorityRevocations || {}, member.userKey)
    && Array.isArray(S.db.staffRoles?.[member.userKey]) && S.db.staffRoles[member.userKey].includes('super_admin')
    && !(internal.offboardings || []).some(row => row.id !== excludingOffboardingId && row.status === 'scheduled'
      && (row.memberId === member.id || row.userKey === member.userKey || Number(row.userId) === identity.findByKey(member.userKey)?.id)
      && Number.isFinite(through) && Date.parse(row.effectiveAt) <= through));
}
function staffProtection(S, identity, workspace, userKey, through, excludingOffboardingId) {
  if (!isInternalEmployment(workspace)) return null;
  const isSuperAdmin = qualifiedSuperAdmins(S, identity, { excludingOffboardingId }).some(member => member.userKey === userKey);
  const replacements = qualifiedSuperAdmins(S, identity, { excludingKey: userKey, through, excludingOffboardingId });
  return { isSuperAdmin, isLastActiveSuperAdmin: isSuperAdmin && replacements.length === 0, activeReplacementCount: replacements.length,
    canSchedule: !isSuperAdmin || replacements.length > 0, reason: isSuperAdmin && !replacements.length ? 'active_super_admin_required' : null,
    replacementUserKeys: replacements.map(member => member.userKey) };
}
function validateHirePayload(payload) {
  const fields = ['firstName', 'lastName', 'email', 'phoneNumber', 'birthday', 'gender', 'nationality', 'nationalIdOrPassport', 'personalTaxId', 'accommodationType', 'country', 'city', 'street', 'postCode', 'tools'];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || Object.keys(payload).some(key => !fields.includes(key))) throw fail(422, 'invalid_employee', 'Only employee details and invited tools can be supplied.');
  for (const [key, value] of Object.entries(payload)) {
    if (key === 'tools') { if (value !== null && (!Array.isArray(value) || value.some(tool => typeof tool !== 'string'))) throw fail(422, 'invalid_tools', 'Choose valid invited tools.'); }
    else if (value !== null && (typeof value !== 'string' || value.length > 2000)) throw fail(422, 'invalid_employee', 'Check the employee details.');
  }
  if (['firstName', 'lastName', 'email'].some(key => typeof payload[key] !== 'string' || !payload[key].trim())) throw fail(422, 'invalid_employee', 'Enter the employee name and email.');
}
function hire({ S, identity, workspace, actor, runtime, payload }) {
  validateHirePayload(payload);
  const email = String(payload.email || "").trim().toLowerCase();
  if (!payload.firstName || !payload.lastName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail(422, "invalid_employee", "Check the employee name and email.");
  const old = runtime.exportSnapshot().data.employees.find(employee => employee.email.toLowerCase() === email && !employee.deletedAt && employee.status !== "offboarded");
  if (old) throw fail(409, "employee_exists", "This employee already has an employment record.");
  let person = identity.findByEmail(email);
  if (!person) {
    const id = people.allocatePersonId(identity), now = S.iso(S.now());
    person = { id, key: `person_${id}`, email, firstName: String(payload.firstName), lastName: String(payload.lastName), userType: "employee", isActive: false, pendingActivation: true, isEmailVerified: false, authVersion: 0, createdAt: now, updatedAt: now, profile: { language: "en", timeZone: workspace.timeZone, theme: "light" } };
    identity.users.push(person);
  }
  const invitation = people.invite(S, identity, workspace, actor, { email, name: `${payload.firstName} ${payload.lastName}`, tools: payload.tools || ["hr"], role: "member" }, { authorizedHire: true });
  const now = S.iso(S.now());
  const highestCode = Math.max(1000, ...runtime.exportSnapshot().data.employees.map(row => Number(String(row.employeeCode || '').match(/^EMP-(\d+)$/)?.[1]) || 0));
  workspace.nextEmployeeCode = Math.max(workspace.nextEmployeeCode || 1001, highestCode + 1);
  const employeeCode = `EMP-${workspace.nextEmployeeCode++}`;
  const employee = {
    id: person.id, authUserId: person.id, userKey: person.key, employeeCode, firstName: String(payload.firstName), lastName: String(payload.lastName), email,
    phoneNumber: payload.phoneNumber || "", birthday: payload.birthday || "", gender: payload.gender || "", nationality: payload.nationality || "", nationalIdOrPassport: payload.nationalIdOrPassport || "", personalTaxId: payload.personalTaxId || "", accommodationType: payload.accommodationType || "own_accommodation",
    address: { country: payload.country || "", city: payload.city || "", street: payload.street || "", postCode: payload.postCode || "" },
    jobTitle: "", departmentId: null, managerId: null, employeeType: "", workLocation: "", status: "invited", experienceLevel: "", joinDate: now.slice(0, 10), skills: [],
    payment: { paymentMethod: "bank", paymentCycle: "monthly", bank: null, instapay: null, wallet: null },
    salary: { baseSalary: 0, housingAllowanceValue: 0, housingAllowanceType: "percentage", transportationAllowanceValue: 0, transportationAllowanceType: "percentage", otherAllowancesValue: 0, otherAllowancesType: "percentage", insuranceValue: 0, insuranceType: "percentage", taxValue: 0, taxType: "percentage", currency: workspace.currency },
    salaryHistory: [], daysOff: { annualLeave: 0, casualLeave: 0, sickLeave: 0, unpaidLeavePolicy: "", contractAdds: 0 },
    contract: { contractType: "", startDate: "", endDate: null, trainingPeriod: "", noticePeriod: "", sendForSignature: false, companyLogoFileId: null, contractSections: [] },
    permissions: { roleIds: [], scopeDepartmentIds: [], scopeEntityIds: [], customPermissions: [] }, completedSteps: ["user_base_info"], onboardingComplete: false, avatarUrl: "", isActive: false, createdAt: now, updatedAt: now, deletedAt: null,
  };
  runtime.applyCommitted({ kind: "hr.employee.upsert", payload: { employee, person: { id: person.id, key: person.key, firstName: person.firstName, lastName: person.lastName, email } } });
  S.log(actor.key, "employee_hired", String(person.id), { workspaceId: workspace.id, invitationId: invitation.id });
  return { ...employee, invitation };
}
function approveLeave({ S, workspace, actor, runtime, payload }) {
  return leaveCommand({ S, workspace, actor, runtime, payload }, 'decision');
}
function leaveCommand({ S, workspace, actor, runtime, payload }, action) {
  if (typeof runtime.executeLeave !== 'function') throw fail(503, 'workspace_runtime_unavailable', 'Leave processing is temporarily unavailable.');
  const result = runtime.executeLeave(action, payload, actor.id);
  S.log(actor.key, `leave_${action}`, String(result.id), { workspaceId: workspace.id, status: result.status, stage: result.capabilities.decisionStage });
  return result;
}
function activateEmployee({ S, runtime, userId }) {
  const snapshot = runtime.exportSnapshot(), employee = snapshot.data.employees.find(row => row.authUserId === userId);
  if (!employee || employee.status !== 'invited') return false;
  employee.status = 'active'; employee.isActive = true; employee.updatedAt = S.iso(S.now());
  runtime.applyCommitted({ snapshot }); return true;
}
function endInstant(workspace, value, now) {
  if (value === undefined || value === null) return now;
  if (typeof value !== 'string') throw fail(422, 'invalid_end_date', 'Choose a valid employment end date.');
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number), calendar = createBusinessCalendar(workspace.timeZone);
    const normalized = new Date(Date.UTC(year, month - 1, day));
    if (normalized.toISOString().slice(0, 10) !== value) throw fail(422, 'invalid_end_date', 'Choose a valid employment end date.');
    // A date-only end date preserves access through the workspace's last local day.
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    return calendar.civilDayStart({ year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() });
  }
  const instant = Date.parse(value);
  if (!Number.isFinite(instant)) throw fail(422, 'invalid_end_date', 'Choose a valid employment end date.');
  return instant;
}
function offboard({ S, identity, workspace, actor, runtime, payload, transferOwned }) {
  const scheduler = actor && identity.findUser(actor.id);
  if (!scheduler || scheduler.key !== actor.key || scheduler.isActive !== true || scheduler.deletedAt || scheduler.pendingActivation) throw fail(403, 'offboarding_actor_required', 'An authenticated HR actor must schedule offboarding.');
  const snapshot = runtime.exportSnapshot(), employee = snapshot.data.employees.find(row => row.id === Number(payload.employeeId));
  if (!employee) throw fail(404, 'employee_not_found', 'This employment record was not found.');
  workspace.offboardings ??= [];
  const existing = workspace.offboardings.find(row => row.employeeId === employee.id && row.status !== 'cancelled');
  if (existing) return existing;
  const person = identity.findUser(employee.authUserId), member = workspace.members.find(candidate => person && candidate.userKey === person.key || candidate.email && candidate.email.toLowerCase() === employee.email.toLowerCase());
  const targetId = payload.transfer?.ownerMemberId ?? payload.transfer?.memberId;
  if (member?.role === 'owner' && !workspace.members.some(row => row.id === targetId && row.status === 'active' && row.role !== 'guest' && row.id !== member.id && custody.hasActiveAccount(row, identity))) throw fail(422, 'ownership_transfer_required', 'Choose an active member to receive workspace ownership.');
  const at = endInstant(workspace, payload.effectiveAt, S.now());
  const userKey = person?.key || member?.userKey || employee.userKey || null;
  const protection = staffProtection(S, identity, workspace, userKey, at);
  if (protection && !protection.canSchedule) throw fail(409, 'active_super_admin_required', 'Appoint another qualified active OrgTik super administrator before scheduling this departure.');
  const row = { id: S.id('offboard'), employeeId: employee.id, userId: employee.authUserId, memberId: member?.id || null, effectiveAt: S.iso(at), status: 'scheduled', transfer: { ownerMemberId: targetId || null }, equipment: { status: 'pending' }, finalPay: { status: 'pending', currency: employee.salary?.currency || workspace.currency }, createdBy: actor.id, createdAt: S.iso(S.now()) };
  row.userKey = userKey;
  if (protection) row.staffProtection = { wasQualifiedSuperAdmin: protection.isSuperAdmin, checkedAt: S.iso(S.now()), activeReplacementCount: protection.activeReplacementCount };
  workspace.offboardings.push(row);
  S.log(actor.key, 'offboarding_scheduled', row.id, { workspaceId: workspace.id, employeeId: employee.id });
  runOffboarding({ S, identity, workspace, actor, runtime, transferOwned }); return row;
}
function runOffboarding({ S, identity, workspace, actor, runtime, transferOwned }) {
  const completed = [];
  for (const row of workspace.offboardings || []) {
    if (row.status !== 'scheduled' || Date.parse(row.effectiveAt) > S.now()) continue;
    const member = workspace.members.find(item => item.id === row.memberId);
    if (isInternalEmployment(workspace)) {
      const userKey = row.userKey || member?.userKey || identity.findUser(row.userId)?.key;
      const epochs = S.db.staffAccessEpochs;
      if (epochs !== undefined && !dictionary(epochs)) throw fail(503, 'staff_epoch_invalid', 'Staff access recovery is temporarily required.');
      if (S.db.staffAuthorityRevocations !== undefined && !dictionary(S.db.staffAuthorityRevocations)) throw fail(503, 'staff_revocations_invalid', 'Staff access recovery is temporarily required.');
      const epoch = epochs && Object.hasOwn(epochs, userKey) ? epochs[userKey] : 0;
      if (!userKey || !Number.isSafeInteger(epoch) || epoch < 0 || epoch === Number.MAX_SAFE_INTEGER) throw fail(503, 'staff_epoch_invalid', 'Staff access recovery is temporarily required.');
      const currentlyQualified = qualifiedSuperAdmins(S, identity, { excludingOffboardingId: row.id }).some(item => item.userKey === userKey);
      if (userKey) {
        S.db.staffAccessEpochs ??= {};
        S.db.staffAccessEpochs[userKey] = epoch + 1;
        S.db.staffAuthorityRevocations ??= {};
        S.db.staffAuthorityRevocations[userKey] ??= { workspaceId: workspace.id, memberId: row.memberId, offboardingId: row.id, at: row.effectiveAt };
        row.staffAuthorityRevokedAt = S.db.staffAuthorityRevocations[userKey].at;
      }
      if ((row.staffProtection?.wasQualifiedSuperAdmin || currentlyQualified) && !qualifiedSuperAdmins(S, identity, { excludingKey: userKey, through: S.now(), excludingOffboardingId: row.id }).length) {
        const incident = { status: 'required', reason: 'no_active_super_admin', offboardingId: row.id, departedUserKey: userKey || null, departedMemberId: row.memberId, at: row.effectiveAt, detectedAt: S.iso(S.now()) };
        workspace.flags ??= {}; workspace.flags.staffRecovery = incident; row.staffRecovery = { ...incident };
        const recipients = new Set(workspace.members.filter(item => item.id !== row.memberId && item.status === 'active' && item.role !== 'guest' && custody.hasActiveAccount(item, identity)).map(item => identity.findByKey(item.userKey)?.email).filter(Boolean));
        if (!recipients.size && workspace.billing?.email) recipients.add(workspace.billing.email);
        for (const email of recipients) people.notice(S, workspace, email, 'staff_recovery_required', `staff-recovery:${row.id}:${email}`, { offboardingId: row.id, at: row.effectiveAt });
        S.log(actor?.key || 'system', 'staff_recovery_required', row.id, { workspaceId: workspace.id, userId: row.userId, at: row.effectiveAt });
      }
    }
    if (member?.role === 'owner') {
      const target = workspace.members.find(item => item.id === row.transfer.ownerMemberId && item.status === 'active' && item.role !== 'guest' && custody.hasActiveAccount(item, identity));
      if (!target) {
        workspace.state = 'suspended'; workspace.flags ??= {};
        workspace.flags.ownershipReview = { departedMemberId: member.id, unavailableSuccessorId: row.transfer.ownerMemberId, offboardingId: row.id, at: row.effectiveAt };
      } else { target.role = 'owner'; target.revision++; }
      member.role = 'member';
    }
    if (transferOwned) row.custody = transferOwned(row);
    if (member) { member.status = 'offboarded'; member.revision++; member.accessEpoch = (member.accessEpoch || 0) + 1; for (const grant of Object.values(member.toolGrants || {})) grant.assigned = false; }
    for (const invitation of workspace.invitations || []) if (invitation.memberId === row.memberId && invitation.status === 'pending') invitation.status = 'cancelled';
    runtime.applyCommitted({ kind: 'hr.employee.offboard', payload: { employeeId: row.employeeId, effectiveAt: row.effectiveAt } });
    row.status = 'completed'; row.completedAt = row.effectiveAt; people.revision(workspace);
    const owner = workspace.members.find(item => item.role === 'owner' && item.status === 'active');
    people.notice(S, workspace, owner?.email || workspace.billing?.email, 'offboarding_completed', `offboard:${row.id}`, { employeeId: row.employeeId, equipment: row.equipment, finalPay: row.finalPay });
    S.log(actor?.key || 'system', 'employee_offboarded', row.id, { workspaceId: workspace.id, userId: row.userId });
    completed.push(row.userId);
  }
  return { completed };
}
function offboardingOptions({ S, identity, workspace, actor, runtime, payload }) {
  const employee = runtime.exportSnapshot().data.employees.find(row => row.id === Number(payload.employeeId));
  if (!employee) throw fail(404, 'employee_not_found', 'This employment record was not found.');
  const person = identity.findUser(employee.authUserId), member = person && people.memberOf(workspace, person);
  const clock = createBusinessCalendar(workspace.timeZone), parts = clock.parts(S.now());
  const successors = workspace.members.filter(candidate => candidate.id !== member?.id && candidate.status === 'active' && candidate.role !== 'guest' && custody.hasActiveAccount(candidate, identity)).map(candidate => {
    const user = identity.findByKey(candidate.userKey);
    return { memberId: candidate.id, name: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : candidate.name, email: user?.email || candidate.email, role: candidate.role, tools: Object.keys(candidate.toolGrants || {}).filter(tool => candidate.toolGrants[tool].assigned) };
  });
  const record = (workspace.offboardings || []).filter(row => row.employeeId === employee.id).at(-1) || null;
  const protection = staffProtection(S, identity, workspace, person?.key || member?.userKey || employee.userKey, record?.status === 'scheduled' ? Date.parse(record.effectiveAt) : S.now(), record?.id);
  const { replacementUserKeys: _privateKeys, ...safeProtection } = protection || {};
  const recovery = isInternalEmployment(workspace) && workspace.flags?.staffRecovery;
  return { workspace: { id: workspace.id, name: workspace.name, timeZone: workspace.timeZone }, employee: { id: employee.id, name: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(), isOwner: member?.role === 'owner' }, canOffboard: employee.authUserId !== actor.id && !['offboarded'].includes(employee.status) && (!protection || protection.canSchedule), successorRequired: member?.role === 'owner', successors, offboarding: record, ownershipReview: workspace.flags?.ownershipReview || null, staffProtection: protection ? safeProtection : null, staffRecovery: recovery ? { status: recovery.status, offboardingId: recovery.offboardingId, at: recovery.at } : null, serverNow: S.iso(S.now()), businessToday: `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`, custodyCoverage: custody.coverage(workspace, member, identity) };
}
function offboardingAction({ S, workspace, actor, payload }) {
  const row = workspace.offboardings?.find(record => record.id === payload.offboardingId && record.employeeId === Number(payload.employeeId));
  if (!row) throw fail(404, 'offboarding_not_found', 'This offboarding record was not found.');
  if (payload.note !== undefined && (typeof payload.note !== 'string' || payload.note.length > 1000)) throw fail(422, 'invalid_note', 'Use a note of at most1000 characters.');
  if (payload.action === 'cancel') {
    if (row.status !== 'scheduled' || Date.parse(row.effectiveAt) <= S.now()) throw fail(409, 'offboarding_unavailable', 'Only future scheduled offboarding can be cancelled.');
    row.status = 'cancelled'; row.cancelledAt = S.iso(S.now());
  } else {
    const field = { equipment_returned: 'equipment', final_pay_completed: 'finalPay' }[payload.action];
    if (!field || row.status === 'cancelled') throw fail(422, 'invalid_offboarding_action', 'Choose an available offboarding action.');
    row[field] = { ...row[field], status: 'completed', completedAt: S.iso(S.now()), completedBy: actor.id, mode: 'mock_tracking', ...(payload.note ? { note: payload.note } : {}) };
  }
  row.actions ??= []; row.actions.push({ action: payload.action, actorUserId: actor.id, at: S.iso(S.now()), note: payload.note || null });
  S.log(actor.key, 'offboarding_action', row.id, { workspaceId: workspace.id, action: payload.action }); return row;
}
module.exports = { hire, validateHirePayload, approveLeave, leaveCommand, activateEmployee, offboard, runOffboarding, endInstant, offboardingOptions, offboardingAction };
