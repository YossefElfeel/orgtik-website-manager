const crypto = require('node:crypto');
const { civilDate, availabilityBounds, overall } = require('../apps/hr/leave');
const { APP_TO_TOOL } = require('./workspace-context');
const fail = (status, code, message) => Object.assign(new Error(message), { status, code });
function projectAvailability({ realm, workspace, identity, snapshot, tool, actor, fromDate, toDate }) {
  if (!['tasks', 'chats'].includes(tool)) throw fail(403, 'availability_forbidden', 'This calendar is not available for this tool.');
  const grantTool = APP_TO_TOOL[tool];
  const first = civilDate(fromDate), last = civilDate(toDate);
  if (last < first || (last - first) / 864e5 >= 93) throw fail(422, 'invalid_calendar_range', 'Choose a calendar range of at most 93 days.');
  const member = workspace.members.find(row => row.userKey === actor.key && row.status === 'active');
  const current = identity.findUser(actor.id);
  if (current?.isActive !== true || current.key !== actor.key || current.deletedAt || current.pendingActivation === true) throw fail(403, 'availability_forbidden', 'Your active account is required.');
  if (!member?.toolGrants?.[grantTool]?.assigned || !member.toolGrants[grantTool].roles?.length) throw fail(403, 'availability_forbidden', 'Your current tool assignment is required.');
  if (snapshot?.workspaceId !== workspace.id || snapshot.appKey !== 'hr' || realm && snapshot.realm !== realm) throw fail(503, 'availability_unavailable', 'Workspace availability is temporarily unavailable.');
  const result = { workspaceId: workspace.id, timeZone: workspace.timeZone, fromDate, toDate, items: [] };
  if (member.role === 'guest' || member.toolGrants[grantTool].roles.every(role => ['guest', 'customer'].includes(role))) return result;
  const employees = new Map(snapshot.data.employees.map(employee => [employee.id, employee]));
  for (const request of snapshot.data.timeOffs) {
    if (overall(request) !== 'approved' || request.hrActionStatus !== 'approved' || request.endDate < fromDate || request.startDate > toDate) continue;
    const employee = employees.get(request.employeeId);
    if (!employee || employee.deletedAt || employee.isActive === false || ['invited', 'offboarded'].includes(employee.status)) continue;
    const person = identity.findUser(employee.authUserId ?? employee.id);
    if (!person || person.isActive !== true || person.deletedAt || person.pendingActivation === true) continue;
    const coworker = workspace.members.find(row => row.userKey === person.key && row.status === 'active');
    if (!coworker || coworker.role === 'guest' || !coworker.toolGrants?.[grantTool]?.assigned || !coworker.toolGrants[grantTool].roles?.length) continue;
    const range = availabilityBounds(request, snapshot.data.settings, workspace.timeZone);
    result.items.push({ id: crypto.createHash('sha256').update(`${workspace.id}:availability:${request.id}`).digest('hex').slice(0, 32), personId: person.id, personName: `${person.firstName || ''} ${person.lastName || ''}`.trim(), startDate: request.startDate, endDate: request.endDate, ...range, durationType: request.durationType, halfDayPeriod: request.durationType === 'half_day' ? request.halfDayPeriod : null });
  }
  result.items.sort((a, b) => a.startAt.localeCompare(b.startAt) || a.personName.localeCompare(b.personName) || a.id.localeCompare(b.id));
  return result;
}
module.exports = { projectAvailability };
