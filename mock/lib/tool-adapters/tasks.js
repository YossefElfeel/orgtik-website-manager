const express = require("express");
const stateCodec = require("../../apps/tasks/runtime-state");
let created = false;
const schema = "orgtik.tool.tasks";
const fail = message => { throw Object.assign(new Error(message), { status: 503, code: "invalid_tool_runtime" }); };

function createWorkspaceRuntime(input, tool) {
  if (created) fail("A Tasks graph can own only one workspace runtime.");
  const ctx = input.services?.ctx, realm = input.realm ?? input.identity?.realm ?? ctx?.realm;
  if (!ctx || typeof realm !== "string" || !realm || !input.workspace?.id || !input.identity?.workspaceMode || input.identity.workspaceId !== input.workspace.id) fail("Tasks requires a verified workspace identity and context.");
  if (!['empty', 'fixture'].includes(input.initialization?.kind) || !Number.isFinite(Date.parse(input.initialization.seedAt))) fail("Tasks initialization is invalid.");
  const fixtureId = input.initialization.fixtureId;
  if (input.initialization.kind === 'fixture' && !['orgtik-v1', 'nile-v1'].includes(fixtureId)) fail("Tasks fixture is not registered.");
  if (input.initialization.kind === 'fixture' && input.workspace.id !== (fixtureId === 'orgtik-v1' ? 'ws_orgtik' : 'ws_nile')) fail("Tasks fixture is not assigned to this workspace.");
  const snapshot = input.snapshot;
  if (snapshot && (snapshot.schema !== schema || snapshot.version !== 1 || snapshot.realm !== realm || snapshot.workspaceId !== input.workspace.id || snapshot.appKey !== 'tasks')) fail("Tasks snapshot belongs to a different runtime.");
  const state = snapshot && stateCodec.decode(snapshot.data, snapshot.sequences);
  if (state?.attachments.some(attachment => attachment.reference && attachment.reference.workspaceId !== input.workspace.id)) fail('Tasks file reference belongs to another workspace.');
  const router = express.Router();
  created = true;
  const hooks = tool.routes(router, { ...ctx, identity: input.identity, commands: input.services.commands }, { empty: input.initialization.kind === 'empty', state, fixtureId: snapshot ? undefined : fixtureId, seedAt: input.initialization.seedAt });
  return {
    router,
    exportSnapshot: () => ({ schema, version: 1, realm, workspaceId: input.workspace.id, appKey: 'tasks', ...hooks.exportState(), ...(fixtureId ? { fixtureId } : {}) }),
    bootstrap: context => {
      if (!context?.actor || context.mode === 'public_resource') throw Object.assign(new Error("Tasks bootstrap is not authorized."), { status: 403 });
      const user = input.identity.findUser(context.actor.effectiveUserId), access = context.tools?.tasks;
      if (!user || user.isActive === false || context.realm !== realm || context.workspace?.id !== input.workspace.id || !access || ['no_access', 'not_subscribed'].includes(access.access) || !access.roles?.length || !input.identity.userScopes(user).some(scope => scope.scope === 'task_manager' && scope.roles.length)) throw Object.assign(new Error("Tasks bootstrap is not authorized."), { status: 403 });
      return hooks.bootstrap(user);
    },
    suiteFeed: context => { const access = context?.tools.tasks; if (!access || ['no_access', 'not_subscribed'].includes(access.access) || context.workspace.id !== input.workspace.id) throw Object.assign(new Error('Tasks access is required.'), { status: 403 }); return hooks.suiteFeed(input.identity.findUser(context.actor.effectiveUserId)); },
    createConnectedTask: (context, payload) => { if (context?.workspace.id !== input.workspace.id || !context.tools.tasks?.canWrite || context.actor.readOnly) throw Object.assign(new Error('Tasks write access is required.'), { status: 403 }); return hooks.createConnectedTask(input.identity.findUser(context.actor.effectiveUserId), payload); },
    suiteExport: context => { if (context?.workspace.id !== input.workspace.id || !context.tools.tasks?.roles.length || ['no_access', 'not_subscribed'].includes(context.tools.tasks.access)) throw Object.assign(new Error('Tasks access is required.'), { status: 403 }); return hooks.suiteExport(input.identity.findUser(context.actor.effectiveUserId)); },
    connectedProjects: context => { if (context?.workspace.id !== input.workspace.id || !context.tools.tasks?.roles.length || ['no_access', 'not_subscribed'].includes(context.tools.tasks.access)) throw Object.assign(new Error('Tasks access is required.'), { status: 403 }); return hooks.connectedProjects(input.identity.findUser(context.actor.effectiveUserId)); },
    projectAudience: (context, projectId) => { if (context?.realm !== realm || context.workspace.id !== input.workspace.id || !context.tools.tasks?.roles.length || ['no_access', 'not_subscribed'].includes(context.tools.tasks.access)) throw Object.assign(new Error('Tasks access is required.'), { status: 403 }); return hooks.projectAudience(input.identity.findUser(context.actor.effectiveUserId), projectId); },
    usage: hooks.usage, authorizeSharedTarget: hooks.authorizeSharedTarget, transferOwnership: hooks.transferOwnership, close: hooks.close,
  };
}

module.exports = { createWorkspaceRuntime, schema };
