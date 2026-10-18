const express = require('express');
const codec = require('../../apps/chats/runtime-state');
const schema = 'orgtik.tool.chats';
let created = false;
const fail = message => { throw Object.assign(new Error(message), { status: 503, code: 'invalid_tool_runtime' }); };
function createWorkspaceRuntime(input, tool) {
  const ctx = input.services?.ctx, realm = input.realm ?? input.identity?.realm ?? ctx?.realm, fixtureId = input.initialization?.fixtureId;
  if (created || !ctx || typeof realm !== 'string' || !realm || !input.workspace?.id || !input.identity?.workspaceMode || input.identity.workspaceId !== input.workspace.id) fail('Chats requires a private verified workspace runtime.');
  if (!['empty', 'fixture'].includes(input.initialization?.kind) || !Number.isFinite(Date.parse(input.initialization.seedAt))) fail('Chats initialization is invalid.');
  if (input.initialization.kind === 'fixture' && (!['orgtik-v1', 'nile-v1'].includes(fixtureId) || input.workspace.id !== (fixtureId === 'orgtik-v1' ? 'ws_orgtik' : 'ws_nile'))) fail('Chats fixture is not assigned to this workspace.');
  const snapshot = input.snapshot;
  if (snapshot && (snapshot.schema !== schema || snapshot.version !== 1 || snapshot.realm !== realm || snapshot.workspaceId !== input.workspace.id || snapshot.appKey !== 'chats')) fail('Chats snapshot belongs to another runtime.');
  const effectiveFixture = snapshot?.fixtureId || fixtureId;
  if (effectiveFixture && (!['orgtik-v1', 'nile-v1'].includes(effectiveFixture) || input.workspace.id !== (effectiveFixture === 'orgtik-v1' ? 'ws_orgtik' : 'ws_nile'))) fail('Chats snapshot fixture is not assigned to this workspace.');
  const state = snapshot ? codec.decode(snapshot.data, snapshot.sequences) : codec.initialize({ workspace: input.workspace, identity: input.identity, fixtureId: input.initialization.kind === 'fixture' ? fixtureId : null });
  if (state.data.messages.some(message => message.attachments.some(attachment => attachment.reference && attachment.reference.workspaceId !== input.workspace.id))) fail('Chats file reference belongs to another workspace.');
  if (state.data.whiteboards.some(board => board.reference.workspaceId !== input.workspace.id)) fail('Chats whiteboard belongs to another workspace.');
  const router = express.Router(); created = true;
  const hooks = tool.routes(router, { ...ctx, identity: input.identity }, { state, seedAt: input.initialization.seedAt, timeZone: input.workspace.timeZone, fixtureId: effectiveFixture });
  return {
    router, exportSnapshot: () => ({ schema, version: 1, realm, workspaceId: input.workspace.id, appKey: 'chats', ...hooks.exportState(), ...(effectiveFixture ? { fixtureId: effectiveFixture } : {}) }),
    bootstrap(context) {
      const access = context?.tools?.chat;
      if (context?.mode === 'public_resource' || context?.realm !== realm || context.workspace?.id !== input.workspace.id || !context.actor || !access || ['no_access', 'not_subscribed'].includes(access.access)) throw Object.assign(new Error('Chats bootstrap is not authorized.'), { status: 403 });
      return hooks.bootstrap(input.identity.findUser(context.actor.effectiveUserId));
    },
    suiteFeed(context){const access=context?.tools?.chat;if(context?.mode==='public_resource'||context?.realm!==realm||context.workspace?.id!==input.workspace.id||!context.actor||!access||['no_access','not_subscribed'].includes(access.access))throw Object.assign(new Error('Chats feed is not authorized.'),{status:403});return hooks.suiteFeed(input.identity.findUser(context.actor.effectiveUserId));},
    suiteExport(context){const data=this.bootstrap(context);return{tool:'chat',workspaceId:data.workspaceId,channels:data.channels,messages:data.messages,meetings:data.meetings};},
    publicGuest:hooks.publicGuest,joinPublicGuest:hooks.joinPublicGuest,
    connectedTaskAudience(context,messageId) {
      const access=context?.tools?.chat;
      if(context?.mode==='public_resource'||context?.realm!==realm||context.workspace?.id!==input.workspace.id||!context.actor||!access||['no_access','not_subscribed'].includes(access.access))throw Object.assign(new Error('Chats source is not authorized.'),{status:403});
      return hooks.connectedTaskAudience(input.identity.findUser(context.actor.effectiveUserId),messageId);
    }, usage: hooks.usage, authorizeSharedTarget: hooks.authorizeSharedTarget, authorizeWhiteboardTarget: hooks.authorizeWhiteboardTarget, isWhiteboardCustodyTarget: hooks.isWhiteboardCustodyTarget, transferOwnership: hooks.transferOwnership, close: hooks.close,
  };
}
module.exports = { createWorkspaceRuntime, schema };
