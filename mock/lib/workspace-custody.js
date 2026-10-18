const ROLES = {
  tasks: ['super_admin', 'project_manager', 'developer'], files: ['super_admin', 'file_editor'],
  hr: ['super_admin', 'hr', 'manager', 'finance_manager'], crm: ['admin', 'manager', 'salesman'],
  marketing: ['super_admin', 'marketing_manager', 'marketing_specialist', 'content_writer'], chat: ['owner', 'admin', 'member'],
};
function hasActiveAccount(member, identity) {
  const person = member?.userKey && identity?.findByKey(member.userKey);
  return Boolean(person && person.isActive === true && !person.deletedAt && !person.pendingActivation);
}
function eligible(member, tool, identity) {
  const grant = member?.toolGrants?.[tool];
  return member?.status === 'active' && member.role !== 'guest' && hasActiveAccount(member, identity) && grant?.assigned === true && grant.roles.some(role => ROLES[tool]?.includes(role));
}
function coverage(workspace, member, identity) {
  return Object.keys(ROLES).map(tool => ({ tool, assigned: member?.toolGrants?.[tool]?.assigned === true, eligibleSuccessorMemberIds: workspace.members.filter(candidate => candidate.id !== member?.id && eligible(candidate, tool, identity)).map(candidate => candidate.id), canArchive: true }));
}
module.exports = { hasActiveAccount, eligible, coverage, ROLES };
