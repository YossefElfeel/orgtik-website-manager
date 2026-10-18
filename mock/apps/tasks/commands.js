const PROFILE_FIELDS = new Set(['firstName', 'lastName', 'username', 'avatar', 'jobTitle', 'department', 'about', 'language', 'timeZone', 'weekStartDay', 'dateFormat', 'timeFormat', 'flyoutToastMessage', 'timezoneChangeNotification']);
function profilePatch(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !PROFILE_FIELDS.has(key))) throw Object.assign(new Error('Unsupported profile field.'), { status: 422, code: 'invalid_profile_patch' });
  return Object.fromEntries(Object.entries(body));
}
async function execute(ctx, identity, req, user, kind, payload) {
  if (typeof ctx.commands?.execute !== 'function') throw Object.assign(new Error('Workspace commands are unavailable.'), { status: 503, code: 'workspace_commands_unavailable' });
  return ctx.commands.execute(kind, payload, { actor: identity.currentContext?.()?.actor || { userId: user.id, effectiveUserId: user.id }, workspaceId: identity.workspaceId, operationId: req.get('Idempotency-Key') });
}
function failure(res, error) { return res.status(error.status || 503).json({ success: false, code: error.code || 'workspace_command_failed', message: error.status ? error.message : 'The workspace change could not be saved. Try again.' }); }
module.exports = { profilePatch, execute, failure };
