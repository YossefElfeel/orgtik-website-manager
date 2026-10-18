// Actual signed HTTP against disposable file realms. Accepted meeting/custody/renewal
// fixtures stay private; no public fixture routes, hosted credentials or shared clock.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const AT = '2026-10-07T09:00:00.000Z', DAY = 86400000;
const BOARDS = '/api/hq/whiteboards', APPS = ['tasks', 'files', 'chats'];
const clone = value => JSON.parse(JSON.stringify(value));
const key = value => ({ 'idempotency-key': value });
const scene = (color = '#ffffff') => ({ schema: 'orgtik.whiteboard', version: 1, elements: [{ id: 'box', type: 'rectangle', x: 0, y: 0, width: 100, height: 80 }, { id: 'label', type: 'text', x: 10, y: 10, width: 70, height: 20, text: 'Draft', fontSize: 20, fontFamily: 5 }], appState: { viewBackgroundColor: color } });
const referenceFields = ['fileId', 'versionId', 'workspaceId'];
async function waitFor(predicate, label, timeout = 25000) {
  const until = performance.now() + timeout;
  while (!predicate()) { if (performance.now() > until) throw new Error('Timed out waiting for ' + label); await new Promise(resolve => setTimeout(resolve, 20)); }
}

async function child(phase) {
  const folder = fs.realpathSync(process.env.WHITEBOARD_HTTP_DIR);
  assert.ok(folder.startsWith(fs.realpathSync(os.tmpdir()) + path.sep) && path.basename(folder).startsWith('orgtik-whiteboard-http-'));
  for (const name of ['MOCK_PUBLIC_URL', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']) assert.equal(process.env[name], '');
  const config = require('../config'); config.dataDir = folder;
  const journal = require('./journal'), store = journal.fileStore(path.join(folder, 'journal.json')), checkpoint = require('./domain-checkpoint');
  let boundary, args, refuseCommit = false, dropPath = null, reached = false;
  const commit = store.commit.bind(store);
  store.commit = async (entry, expected) => {
    if (refuseCommit && entry.kind === 'workspace-v1' && entry.url.startsWith(BOARDS)) throw Object.assign(new Error('Private whiteboard commit outage'), { status: 503, code: 'journal_unavailable' });
    if (phase === 'race' && entry.method === 'PATCH' && entry.url.startsWith(BOARDS + '/') && !reached) {
      reached = true; fs.writeFileSync(path.join(folder, 'ready-' + process.env.WHITEBOARD_HTTP_ACTOR), JSON.stringify({ epoch: expected.expectedEpoch, revision: expected.expectedRevision }));
      await waitFor(() => fs.existsSync(path.join(folder, 'release')), 'both whiteboard candidates reaching actual CAS');
    }
    return commit(entry, expected);
  };
  journal.pickStore = () => ({ sandbox: process.env.MOCK_SANDBOX, store });
  const factory = require('./workspace-boundary'), create = factory.createWorkspaceBoundary;
  factory.createWorkspaceBoundary = input => { args = input; boundary = create(input); return boundary; };
  const handler = require('../api/index');
  const server = require('node:http').createServer((req, res) => { if (req.url === dropPath) { dropPath = null; res.end = () => { res.destroy(); return res; }; } handler(req, res); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port, factsFile = path.join(folder, 'facts.json');
  const clock = () => require('./clock').now();
  async function call(app, route, method = 'GET', body, token, headers = {}, binary = false) {
    const response = await fetch(origin + '/' + app + route, { method, headers: { connection: 'close', ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: 'Bearer ' + token } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30000) });
    const bytes = Buffer.from(await response.arrayBuffer());
    if (binary && response.ok) return { status: response.status, bytes, headers: response.headers };
    const raw = bytes.length ? JSON.parse(bytes.toString('utf8')) : {};
    return { status: response.status, raw, data: raw.data ?? raw, headers: response.headers };
  }
  async function expect(app, route, method, body, token, status = 200, headers = {}) {
    const value = await call(app, route, method, body, token, headers); assert.equal(value.status, status, `${app}${route}: ${value.raw.code || value.raw.message || value.status}`); return value.data;
  }
  async function denied(app, route, method, body, token, status, code, headers = {}) {
    const value = await call(app, route, method, body, token, headers); assert.equal(value.status, status, `${app}${route}: ${value.raw.code || value.status}`); if (code) assert.equal(value.raw.code, code); return value;
  }
  const select = async (account, workspaceId, target) => (await expect('sos', '/api/auth/workspace', 'POST', { workspaceId, target }, account.tokens.accessToken)).tokens.accessToken;
  async function register(label) { return expect('sos', '/api/auth/register', 'POST', { email: label + '@whiteboard.fixture.test', password: 'PrivateWhiteboard@2026', name: label + ' Person', company: label + ' Workspace' }, null, 201); }
  async function customer(label) {
    const account = await register(label), workspaceId = account.workspaceContext.workspace.id;
    const payment = await expect('sos', '/v1/app/payment-methods', 'POST', { last4: '4242', expires: '12/40', brand: 'Visa', kind: 'card' }, account.tokens.accessToken, 201);
    const items = [{ planId: 'tasks_pro', cycle: 'monthly', intent: 'seat_purchase', quantity: 5 }, { planId: 'files_pro', cycle: 'monthly' }, { planId: 'chat_pro', cycle: 'monthly' }];
    const quoted = await expect('sos', '/v1/app/checkout/preview', 'POST', { items }, account.tokens.accessToken);
    await expect('sos', '/v1/app/checkout/confirm', 'POST', { items, quoteId: quoted.quoteId, paymentMethodId: payment.id, billing: { legalName: 'Private whiteboard fixture' } }, account.tokens.accessToken, 201, key('purchase-' + label));
    return { account, workspaceId, tokens: Object.fromEntries(await Promise.all(APPS.map(async app => [app, await select(account, workspaceId, app)]))) };
  }
  async function person(owner, label, tools = ['tasks', 'files', 'chat'], toolRoles) {
    const account = await register(label), invitation = await expect('sos', '/v1/app/invitations', 'POST', { email: account.user.email, role: 'member', tools, ...(toolRoles ? { toolRoles } : {}) }, owner.account.tokens.accessToken);
    const delivery = await expect('sos', `/v1/app/invitations/${invitation.id}/delivery`, 'GET', undefined, owner.account.tokens.accessToken);
    await expect('sos', `/v1/public/invitations/${delivery.invitePath.split('/').pop()}/accept`, 'POST', {}, account.tokens.accessToken, 200, key('accept-' + label));
    return { account, id: account.user.id, tokens: Object.fromEntries(await Promise.all(APPS.filter(app => tools.includes(app === 'chats' ? 'chat' : app)).map(async app => [app, await select(account, owner.workspaceId, app)]))) };
  }
  const event = (token, value, operationId) => expect('chats', '/api/hq/commands', 'POST', { event: value }, token, 200, key(operationId));
  async function domain() {
    const snapshot = await store.snapshot(0), entry = snapshot.entries.map(JSON.parse).findLast(row => row.checkpoint); assert.ok(entry); return { ...snapshot, state: checkpoint.decodeDomainCheckpoint(entry.checkpoint) };
  }
  async function historical(edit) {
    const before = await domain(), state = clone(before.state); await edit(state);
    await commit({ epoch: before.meta.epoch, kind: 'workspace-v1', app: 'admin', method: 'SYSTEM', url: '/__fixture/accepted-whiteboard-history', headers: {}, body: null, at: clock(), checkpoint: checkpoint.encodeDomainCheckpoint(state) }, { expectedEpoch: before.meta.epoch, expectedRevision: before.revision }); args.persist.rebuild = true;
  }
  const snapshot = (state, f, app) => state.workspaceState.snapshots[f.owner.workspaceId + ':' + app];
  async function fixture(label) {
    const owner = await customer(label), foreign = await customer(label + '-foreign');
    const member = await person(owner, label + '-member'), outsider = await person(owner, label + '-outsider', undefined, { chat: 'admin' });
    const reader = await person(owner, label + '-reader', undefined, { files: 'file_viewer' }), noFiles = await person(owner, label + '-no-files', ['tasks', 'chat']);
    const folder = await expect('files', '/api/v1/folders', 'POST', { name: 'Whiteboard files', visibility: 'specific_people', allowedUserIds: [member.id, outsider.id, reader.id, noFiles.id] }, owner.tokens.files, 201);
    const channels = await event(owner.tokens.chats, { type: 'channel.created', channel: { name: 'Whiteboard channel', kind: 'private', memberIds: [String(member.id), String(reader.id), String(noFiles.id)] } }, 'channel-' + label);
    const channelId = channels.channels.find(row => row.name === 'Whiteboard channel').id;
    const project = await expect('tasks', '/api/projects', 'POST', { title: 'Whiteboard references', isPrivate: true, memberIds: [member.id] }, owner.tokens.tasks, 201);
    const sections = await expect('tasks', `/api/projects/${project.id}`, 'GET', undefined, owner.tokens.tasks);
    const task = await expect('tasks', `/api/tasks/sections/${sections.sections[0].section.id}`, 'POST', { title: 'Pinned board task' }, owner.tokens.tasks, 201);
    const f = { owner, foreign, member, outsider, reader, noFiles, folderId: folder.id, channelId, projectId: project.id, taskId: task.id };
    await expect('chats', '/api/hq/bootstrap', 'GET', undefined, owner.tokens.chats); await expect('tasks', `/api/tasks/${task.id}`, 'GET', undefined, member.tokens.tasks);
    fs.writeFileSync(factsFile, JSON.stringify(f)); return f;
  }
  function minimal(reference) { assert.deepEqual(Object.keys(reference).sort(), referenceFields); assert.equal(typeof reference.workspaceId, 'string'); assert.equal(typeof reference.fileId, 'string'); assert.match(reference.versionId, /^v[1-9]\d*$/); }
  const createBoard = (f, options = {}, token = f.member.tokens.chats, operationId = 'board-create') => expect('chats', BOARDS, 'POST', { name: 'Persistent whiteboard', parentId: f.folderId, scene: scene(), ...options }, token, 201, key(operationId));
  const detail = (f, board, token = f.member.tokens.chats, versionId) => expect('chats', `${BOARDS}/${board.id}${versionId ? '?versionId=' + versionId : ''}`, 'GET', undefined, token);
  const save = (f, board, color, operationId, baseVersionId = board.reference.versionId, token = f.member.tokens.chats) => expect('chats', `${BOARDS}/${board.id}`, 'PATCH', { baseVersionId, scene: scene(color) }, token, 200, key(operationId));
  const nativeBytes = (f, board, token = f.member.tokens.files) => call('files', `/api/v1/files/${board.reference.fileId}/download?download=true`, 'GET', undefined, token, {}, true);
  const zip = (f, token = f.member.tokens.files) => call('files', `/api/v1/folders/${f.folderId}/download`, 'GET', undefined, token, {}, true);
  async function native(f, board, token = f.member.tokens.files) { return expect('files', `/api/v1/files/${board.reference.fileId}`, 'GET', undefined, token); }
  async function pinned(f, board) {
    const attached = await expect('tasks', `/api/tasks/${f.taskId}/attachments`, 'POST', { references: [board.reference] }, f.member.tokens.tasks, 201, key('board-task'));
    const boot = await event(f.member.tokens.chats, { type: 'message.created', message: { channelId: f.channelId, text: '', attachments: [board.reference] } }, 'board-message');
    const message = boot.messages.find(row => row.attachments.some(value => value.reference?.fileId === board.reference.fileId)); assert.ok(message);
    return { taskAttachmentId: attached[0].id, messageId: message.id, messageReferenceId: message.attachments[0].id };
  }
  function contentRoute(board, ids, app) {
    return `/api/shared/files/${board.reference.fileId}/versions/${board.reference.versionId}/content?` + new URLSearchParams(app === 'tasks' ? { resourceType: 'task', resourceId: String(ids.taskId), referenceId: String(ids.taskAttachmentId) } : { resourceType: 'message', resourceId: ids.messageId, referenceId: ids.messageReferenceId });
  }
  async function sharedBytes(f, board, ids, app) { return call(app, contentRoute(board, { ...ids, taskId: f.taskId }, app), 'GET', undefined, f.member.tokens[app], {}, true); }
  function canonicalBytes(answer, expected) { assert.equal(answer.status, 200); assert.match(answer.headers.get('content-type'), /^application\/vnd\.orgtik\.whiteboard\+json\b/); assert.deepEqual(JSON.parse(answer.bytes.toString('utf8')), expected); assert.equal(answer.headers.get('x-content-type-options'), 'nosniff'); assert.match(answer.headers.get('cache-control'), /no-store/); }
  async function versionsCount(f, board) { const state = (await domain()).state; return snapshot(state, f, 'files').data.files.find(([id]) => id === board.reference.fileId)[1].versions.length; }
  async function folderAccess(f, ids) { await expect('files', `/api/v1/folders/${f.folderId}`, 'PATCH', { visibility: 'specific_people', allowedUserIds: ids }, f.owner.tokens.files); }
  async function noMutation(action) {
    const before = await domain(); await action(); const after = await domain();
    assert.equal(after.revision, before.revision); assert.deepEqual(after.state, before.state, 'A rejected parent operation cannot mutate descendants, versions, receipts, activity or counters');
  }
  async function archivedParentFixture(f) {
    // Explicit private accepted archive history enables a real purge request. It
    // supplies no caller authority and does not exercise a successful archive UI.
    await historical(state => {
      const data = snapshot(state, f, 'files').data, parent = data.folders.find(([id]) => id === f.folderId)[1];
      Object.assign(parent, { deletedAt: AT, archivedBy: parent.ownerId, archiveBatch: 'accepted:parent-archive' });
      for (const [, file] of data.files) if (file.folderId === f.folderId) Object.assign(file, { deletedAt: AT, archivedBy: parent.ownerId, archiveBatch: 'accepted:parent-archive' });
    });
  }
  async function custodyFixture(f) {
    // Run real coupled custody reducers, then commit their accepted historical
    // checkpoint privately. This is custody evidence, not an HTTP HR departure.
    const files = boundary.registry.create(f.owner.workspaceId, 'files'), chats = boundary.registry.create(f.owner.workspaceId, 'chats');
    const command = { fromUserId: f.member.id, target: { kind: 'member', userId: f.outsider.id }, operationId: 'accepted:whiteboard-custody' };
    try {
      const filesResult = files.transferOwnership(command); boundary.registry.commit(files);
      const chatsResult = chats.transferOwnership(command); boundary.registry.commit(chats);
      const accepted = boundary.registry.exportState(); await historical(state => { state.workspaceState = accepted; });
      return { filesResult, chatsResult };
    } finally { files.close(); chats.close(); }
  }
  async function readOnly(f, tool) {
    await historical(state => {
      const ws = state.platformState.db.workspaces.find(row => row.id === f.owner.workspaceId), line = ws.lines.find(row => row.tool === tool);
      ws.paymentMethods.find(row => row.isDefault).last4 = '0002';
      Object.assign(line, { state: 'active', autoRenew: true, periodStart: new Date(Date.parse(AT) - 37 * DAY).toISOString(), periodEnd: new Date(Date.parse(AT) - 7 * DAY).toISOString() });
      for (const name of ['lastFailure', 'readOnlySince', 'graceEndsAt', 'billingRenewalDueAt']) delete line[name];
    });
  }

  try {
    if (phase === 'flow') {
      const f = await fixture('board-flow'); assert.deepEqual((await expect('chats', BOARDS, 'GET', undefined, f.member.tokens.chats)).items, []);
      const board = await createBoard(f, { channelId: f.channelId }); minimal(board.reference); minimal(board.savedReference); assert.equal(board.replayed, false); assert.equal(board.revision, 1); assert.equal(board.capabilities.canWrite, true);
      const listed = (await expect('chats', BOARDS + '?channelId=' + f.channelId, 'GET', undefined, f.member.tokens.chats)).items; assert.equal(listed.length, 1); assert.equal(listed[0].id, board.id); assert.equal('scene' in listed[0], false);
      const current = await detail(f, board); assert.equal(current.scene.schema, 'orgtik.whiteboard'); assert.equal(current.scene.elements.find(row => row.id === 'label').text, 'Draft'); assert.equal(current.scene.elements.find(row => row.id === 'box').width, 100);
      const file = await native(f, board); assert.equal(file.whiteboard.boardId, board.id); assert.equal(file.whiteboard.currentVersionId, 'v1'); assert.equal(file.whiteboard.version, 1);
      const downloaded = await nativeBytes(f, board); canonicalBytes(downloaded, current.scene);
      const zipped = await zip(f); assert.equal(zipped.status, 200); assert.match(zipped.headers.get('content-type'), /^application\/zip\b/);
      const entries = require('../apps/files/lib').unzip(zipped.bytes); assert.ok(entries); const json = Object.entries(entries).filter(([name]) => name.endsWith('.json')); assert.equal(json.length, 1); assert.deepEqual(json[0][1], downloaded.bytes);
      fs.writeFileSync(factsFile, JSON.stringify({ f, board, bytes: downloaded.bytes.toString('base64') }));
    } else if (phase === 'flow-cold') {
      const { f, board, bytes } = JSON.parse(fs.readFileSync(factsFile, 'utf8')); assert.equal((await detail(f, board)).id, board.id); assert.deepEqual((await nativeBytes(f, board)).bytes, Buffer.from(bytes, 'base64')); assert.equal(await versionsCount(f, board), 1);
    } else if (phase === 'acl') {
      const f = await fixture('board-acl'), standalone = await createBoard(f, {}, f.member.tokens.chats, 'standalone'), channel = await createBoard(f, { channelId: f.channelId }, f.owner.tokens.chats, 'channel-board');
      await denied('chats', `${BOARDS}/${standalone.id}`, 'GET', undefined, f.owner.tokens.chats, 404);
      await denied('files', `/api/v1/files/${standalone.reference.fileId}`, 'GET', undefined, f.owner.tokens.files, 403);
      await denied('chats', `${BOARDS}/${channel.id}`, 'GET', undefined, f.outsider.tokens.chats, 404);
      await denied('files', `/api/v1/files/${channel.reference.fileId}`, 'GET', undefined, f.outsider.tokens.files, 403);
      assert.equal((await expect('chats', '/api/hq/bootstrap', 'GET', undefined, f.outsider.tokens.chats)).whiteboards.some(row => row.id === channel.id), false);
      assert.equal((await expect('chats', BOARDS, 'GET', undefined, f.outsider.tokens.chats)).items.length, 0);
      const reader = await detail(f, channel, f.reader.tokens.chats); assert.equal(reader.capabilities.canWrite, false); assert.equal(reader.capabilities.readOnly, true);
      await denied('chats', `${BOARDS}/${channel.id}`, 'PATCH', { baseVersionId: 'v1', scene: scene('#eeeeee') }, f.reader.tokens.chats, 403, undefined, key('reader-write'));
      await denied('chats', `${BOARDS}/${channel.id}`, 'GET', undefined, f.noFiles.tokens.chats, 403);
      await denied('chats', `${BOARDS}/${channel.id}`, 'GET', undefined, f.foreign.tokens.chats, 404);
      await denied('chats', `${BOARDS}/${channel.id}`, 'GET', undefined, f.owner.tokens.files, 401);
      await denied('chats', `${BOARDS}/${channel.id}`, 'GET', undefined, f.member.tokens.chats, 409, undefined, { 'x-workspace': f.foreign.workspaceId });
      const meetingId = 'meeting:accepted-fixture';
      await historical(state => { const data = snapshot(state, f, 'chats').data; const template = clone(require('../apps/chats/fixture.json').meetings[0]); data.meetings.push({ ...template, id: meetingId, title: 'Accepted meeting fixture', participantIds: [String(f.owner.account.user.id), String(f.member.id)] }); });
      const meetingBoard = await createBoard(f, { meetingId }, f.member.tokens.chats, 'meeting-board'); assert.equal(meetingBoard.meetingId, meetingId);
      await denied('chats', `${BOARDS}/${meetingBoard.id}`, 'GET', undefined, f.reader.tokens.chats, 404);
      await denied('chats', BOARDS, 'POST', { name: 'Forged meeting', parentId: f.folderId, meetingId: 'meeting:unregistered', scene: scene() }, f.member.tokens.chats, 404, undefined, key('unregistered-meeting'));
      fs.writeFileSync(factsFile, JSON.stringify({ f, standalone, channel, meetingBoard }));
    } else if (phase === 'acl-cold') {
      const { f, standalone, channel, meetingBoard } = JSON.parse(fs.readFileSync(factsFile, 'utf8')); assert.equal((await detail(f, standalone)).id, standalone.id); assert.equal((await detail(f, meetingBoard)).id, meetingBoard.id);
      await denied('chats', `${BOARDS}/${channel.id}`, 'GET', undefined, f.outsider.tokens.chats, 404); await denied('chats', `${BOARDS}/${meetingBoard.id}`, 'GET', undefined, f.reader.tokens.chats, 404);
    } else if (phase === 'versions') {
      const f = await fixture('board-versions'), board = await createBoard(f, { channelId: f.channelId }), ids = await pinned(f, board);
      const first = await detail(f, board); const taskV1 = await sharedBytes(f, board, ids, 'tasks'), chatV1 = await sharedBytes(f, board, ids, 'chats'); canonicalBytes(taskV1, first.scene); assert.deepEqual(chatV1.bytes, taskV1.bytes);
      const v2 = await save(f, board, '#eeeeee', 'save-v2'); assert.equal(v2.revision, 2); assert.equal(v2.reference.versionId, 'v2'); assert.deepEqual(v2.savedReference, v2.reference); assert.equal(await versionsCount(f, board), 2);
      const historicalV1 = await detail(f, board, f.member.tokens.chats, 'v1'); assert.equal(historicalV1.historical, true); assert.deepEqual(historicalV1.scene, first.scene);
      const current = await detail(f, board); assert.equal(current.reference.versionId, 'v2'); canonicalBytes(await nativeBytes(f, current), current.scene);
      const nativeV1 = await expect('files', `/api/v1/files/${board.reference.fileId}/versions/v1`, 'GET', undefined, f.member.tokens.files);
      assert.equal(nativeV1.whiteboard.boardId, board.id); assert.equal(nativeV1.whiteboard.versionId, 'v1'); assert.equal(nativeV1.whiteboard.currentVersionId, 'v2'); assert.equal(nativeV1.whiteboard.version, 1);
      const pinnedUrl = new URL(nativeV1.url); assert.ok(pinnedUrl.pathname.endsWith(`/files/${board.reference.fileId}/versions/v1/download`));
      const nativeOld = await call('files', pinnedUrl.pathname + pinnedUrl.search, 'GET', undefined, f.member.tokens.files, {}, true); canonicalBytes(nativeOld, first.scene); assert.deepEqual(nativeOld.bytes, taskV1.bytes);
      assert.deepEqual((await sharedBytes(f, board, ids, 'tasks')).bytes, taskV1.bytes); assert.deepEqual((await sharedBytes(f, board, ids, 'chats')).bytes, taskV1.bytes);
      const v3 = await save(f, v2, '#dddddd', 'save-v3'); assert.equal(v3.reference.versionId, 'v3');
      const unchanged = await save(f, v3, '#dddddd', 'unchanged-drawing'); assert.equal(unchanged.savedReference.versionId, 'v3'); assert.equal(unchanged.revision, 3); assert.equal(await versionsCount(f, board), 3, 'Unchanged canonical content never allocates another version');
      const repeat = await save(f, board, '#eeeeee', 'save-v2'); assert.equal(repeat.replayed, true); assert.equal(repeat.reference.versionId, 'v3'); assert.equal(repeat.savedReference.versionId, 'v2'); assert.equal(await versionsCount(f, board), 3);
      await denied('chats', `${BOARDS}/${board.id}`, 'PATCH', { baseVersionId: 'v1', scene: scene('#cccccc') }, f.member.tokens.chats, 409, 'version_conflict', key('new-stale-operation'));
      await denied('chats', `${BOARDS}/${board.id}`, 'PATCH', { baseVersionId: 'v1', scene: scene('#bbbbbb') }, f.member.tokens.chats, 409, 'operation_conflict', key('save-v2'));
      await denied('chats', `${BOARDS}/${board.id}?versionId=v99`, 'GET', undefined, f.member.tokens.chats, 404);
      fs.writeFileSync(factsFile, JSON.stringify({ f, board, ids, bytes: taskV1.bytes.toString('base64') }));
    } else if (phase === 'versions-cold') {
      const { f, board, ids, bytes } = JSON.parse(fs.readFileSync(factsFile, 'utf8')); assert.equal((await detail(f, board)).reference.versionId, 'v3'); assert.equal(await versionsCount(f, board), 3);
      for (const app of ['tasks', 'chats']) assert.deepEqual((await sharedBytes(f, board, ids, app)).bytes, Buffer.from(bytes, 'base64'));
      const repeat = await save(f, board, '#eeeeee', 'save-v2'); assert.equal(repeat.savedReference.versionId, 'v2'); assert.equal(repeat.reference.versionId, 'v3'); assert.equal(repeat.replayed, true);
    } else if (phase === 'invalid') {
      const f = await fixture('board-invalid'), board = await createBoard(f, { channelId: f.channelId }), before = await domain();
      const rectangle = scene().elements[0], text = scene().elements[1];
      const bad = [null, { ...scene(), schema: 'foreign' }, { ...scene(), version: 2 }, { ...scene(), files: {} }, { ...scene(), appState: { viewBackgroundColor: '#ffffff', embed: 'https://external.invalid' } }, { ...scene(), elements: [{ ...rectangle, type: 'image', fileId: 'remote' }] }, { ...scene(), elements: [{ ...rectangle, type: 'embeddable', link: 'https://external.invalid' }] }, { ...scene(), elements: [{ ...rectangle, link: 'https://external.invalid' }] }, { ...scene(), elements: Array.from({ length: 1001 }, (_, i) => ({ ...rectangle, id: 'too-many-' + i })) }, { ...scene(), elements: [{ ...text, text: 'x'.repeat(100001) }] }, { ...scene(), elements: [{ ...rectangle, type: 'line', points: Array.from({ length: 20001 }, () => [0, 0]) }] }, { ...scene(), elements: [{ ...text, text: '界'.repeat(100000) }] }];
      for (let index = 0; index < bad.length; index++) await denied('chats', `${BOARDS}/${board.id}`, 'PATCH', { baseVersionId: 'v1', scene: bad[index] }, f.member.tokens.chats, 422, 'invalid_whiteboard_scene', key('invalid-' + index));
      await denied('chats', BOARDS, 'POST', { name: 'Malformed creation', parentId: f.folderId, channelId: f.channelId, scene: bad[5] }, f.member.tokens.chats, 422, 'invalid_whiteboard_scene', key('invalid-create'));
      const after = await domain(); assert.equal(after.revision, before.revision); assert.deepEqual(after.state, before.state, 'Invalid scenes cannot change either store, version counters, activity or receipts'); assert.equal(await versionsCount(f, board), 1);
    } else if (phase === 'outages') {
      const f = await fixture('board-outages'), body = { name: 'Recovered board', parentId: f.folderId, channelId: f.channelId, scene: scene() }, before = await domain(); refuseCommit = true;
      await denied('chats', BOARDS, 'POST', body, f.member.tokens.chats, 503, 'journal_unavailable', key('recover-create')); refuseCommit = false; assert.deepEqual((await domain()).state, before.state); assert.equal((await domain()).revision, before.revision);
      dropPath = '/chats' + BOARDS; await assert.rejects(call('chats', BOARDS, 'POST', body, f.member.tokens.chats, key('recover-create')));
      const board = await expect('chats', BOARDS, 'POST', body, f.member.tokens.chats, 201, key('recover-create')); assert.equal(board.replayed, true); assert.equal((await expect('chats', BOARDS, 'GET', undefined, f.member.tokens.chats)).items.length, 1); assert.equal(await versionsCount(f, board), 1);
      const route = `${BOARDS}/${board.id}`, change = { baseVersionId: 'v1', scene: scene('#eeeeee') }, saved = await domain(); refuseCommit = true;
      await denied('chats', route, 'PATCH', change, f.member.tokens.chats, 503, 'journal_unavailable', key('recover-save')); refuseCommit = false; assert.deepEqual((await domain()).state, saved.state);
      dropPath = '/chats' + route; await assert.rejects(call('chats', route, 'PATCH', change, f.member.tokens.chats, key('recover-save')));
      const recovered = await expect('chats', route, 'PATCH', change, f.member.tokens.chats, 200, key('recover-save')); assert.equal(recovered.savedReference.versionId, 'v2'); assert.equal(recovered.replayed, true); assert.equal(await versionsCount(f, board), 2);
      fs.writeFileSync(factsFile, JSON.stringify({ f, board, body, change }));
    } else if (phase === 'outages-cold') {
      const { f, board, body, change } = JSON.parse(fs.readFileSync(factsFile, 'utf8'));
      const created = await expect('chats', BOARDS, 'POST', body, f.member.tokens.chats, 201, key('recover-create')); assert.equal(created.reference.versionId, 'v2'); assert.equal(created.savedReference.versionId, 'v1');
      const saved = await expect('chats', `${BOARDS}/${board.id}`, 'PATCH', change, f.member.tokens.chats, 200, key('recover-save')); assert.equal(saved.replayed, true); assert.equal(saved.savedReference.versionId, 'v2'); assert.equal(await versionsCount(f, board), 2);
    } else if (phase === 'prepare-race') {
      const f = await fixture('board-cas'), board = await createBoard(f, { channelId: f.channelId }); fs.writeFileSync(factsFile, JSON.stringify({ f, board }));
    } else if (phase === 'race') {
      const { f, board } = JSON.parse(fs.readFileSync(factsFile, 'utf8')), who = process.env.WHITEBOARD_HTTP_ACTOR;
      await detail(f, board); fs.writeFileSync(path.join(folder, 'boot-' + who), 'ready'); await waitFor(() => fs.existsSync(path.join(folder, 'begin')), 'initialized physical board instances');
      const response = await call('chats', `${BOARDS}/${board.id}`, 'PATCH', { baseVersionId: 'v1', scene: scene(who === 'one' ? '#eeeeee' : '#dddddd') }, f.member.tokens.chats, key('race-' + who)); assert.ok([200, 409].includes(response.status));
      fs.writeFileSync(path.join(folder, 'result-' + who), JSON.stringify({ status: response.status, code: response.raw?.code }));
    } else if (phase === 'race-cold') {
      const { f, board } = JSON.parse(fs.readFileSync(factsFile, 'utf8')), head = await detail(f, board); assert.equal(head.reference.versionId, 'v2'); assert.equal(head.revision, 2); assert.equal(await versionsCount(f, board), 2);
      const filesState = snapshot((await domain()).state, f, 'files').data;
      assert.equal(filesState.activities.filter(row => row.entityId === board.reference.fileId && row.action === 'whiteboard_saved').length, 1, 'Only the winning save records an activity');
      for (const who of ['one', 'two']) { const result = JSON.parse(fs.readFileSync(path.join(folder, 'result-' + who), 'utf8')); const body = { baseVersionId: 'v1', scene: scene(who === 'one' ? '#eeeeee' : '#dddddd') };
        if (result.status === 200) { const repeated = await expect('chats', `${BOARDS}/${board.id}`, 'PATCH', body, f.member.tokens.chats, 200, key('race-' + who)); assert.equal(repeated.savedReference.versionId, 'v2'); assert.equal(repeated.replayed, true); }
        else await denied('chats', `${BOARDS}/${board.id}`, 'PATCH', body, f.member.tokens.chats, 409, 'version_conflict', key('race-' + who));
      }
      assert.equal(await versionsCount(f, board), 2);
    } else if (phase === 'loss') {
      const f = await fixture('board-permission-loss'), board = await createBoard(f, { channelId: f.channelId }, f.owner.tokens.chats), ids = await pinned(f, board);
      const previousSave = { baseVersionId: 'v1', scene: scene('#eeeeee') }; await save(f, board, '#eeeeee', 'permission-replay');
      await folderAccess(f, [f.outsider.id]); await denied('chats', `${BOARDS}/${board.id}`, 'GET', undefined, f.member.tokens.chats, 404); assert.equal((await sharedBytes(f, board, ids, 'tasks')).status, 404);
      await denied('chats', `${BOARDS}/${board.id}`, 'PATCH', previousSave, f.member.tokens.chats, 404, undefined, key('permission-replay'));
      await folderAccess(f, [f.member.id, f.outsider.id, f.reader.id]); await detail(f, board);
      await event(f.owner.tokens.chats, { type: 'channel.member_removed', channelId: f.channelId, userId: String(f.member.id) }, 'remove-board-member');
      await denied('chats', `${BOARDS}/${board.id}`, 'GET', undefined, f.member.tokens.chats, 404); await denied('files', `/api/v1/files/${board.reference.fileId}`, 'GET', undefined, f.member.tokens.files, 403);
      await denied('chats', `${BOARDS}/${board.id}`, 'PATCH', previousSave, f.member.tokens.chats, 404, undefined, key('permission-replay'));
      // Files ownership alone cannot archive a subtree containing a board whose
      // channel association the current actor no longer holds.
      await historical(state => { snapshot(state, f, 'files').data.folders.find(([id]) => id === f.folderId)[1].ownerId = f.member.id; });
      await noMutation(() => denied('files', `/api/v1/folders/${f.folderId}/archive`, 'PATCH', {}, f.member.tokens.files, 404));
      const downloaded = await nativeBytes(f, board); assert.equal(downloaded.status, 403); assert.equal(JSON.stringify(downloaded.raw).includes('Persistent whiteboard'), false);
      const remaining = require('../apps/files/lib').unzip((await zip(f)).bytes); assert.ok(remaining); assert.equal(Object.keys(remaining).some(name => name.endsWith('.json')), false);
      const noDisclosure = await sharedBytes(f, board, ids, 'tasks'); assert.equal(noDisclosure.status, 404); assert.equal(JSON.stringify(noDisclosure.raw).includes('Persistent whiteboard'), false);
      await denied('files', '/api/v1/shares', 'POST', { resourceType: 'file', resourceId: board.reference.fileId, permission: 'download' }, f.owner.tokens.files, 422);
      const publicFolder = await expect('files', '/api/v1/shares', 'POST', { resourceType: 'folder', resourceId: f.folderId, permission: 'download' }, f.owner.tokens.files, 201), secret = new URL(publicFolder.shareUrl).searchParams.get('secret');
      const guest = await call('files', `/api/v1/public/shares/${publicFolder.id}/session`, 'POST', { secret }); assert.equal(guest.status, 204); const cookie = guest.headers.get('set-cookie').split(';')[0];
      const publicItems = await expect('files', `/api/v1/public/shares/${publicFolder.id}/items`, 'GET', undefined, undefined, 200, { cookie }); assert.equal(publicItems.items.some(row => row.id === board.reference.fileId), false);
      const publicZip = await call('files', `/api/v1/public/shares/${publicFolder.id}/download`, 'GET', undefined, undefined, { cookie }, true); assert.equal(publicZip.status, 200); assert.equal(Object.keys(require('../apps/files/lib').unzip(publicZip.bytes)).some(name => name.endsWith('.json')), false);
      await denied('files', `/api/v1/public/shares/${publicFolder.id}/files/${board.reference.fileId}/download`, 'GET', undefined, undefined, 404, undefined, { cookie });
      await expect('files', `/api/v1/files/${board.reference.fileId}/archive`, 'PATCH', {}, f.owner.tokens.files); await denied('chats', `${BOARDS}/${board.id}`, 'GET', undefined, f.owner.tokens.chats, 404);
      await denied('chats', BOARDS, 'POST', { name: 'Persistent whiteboard', parentId: f.folderId, channelId: f.channelId, scene: scene() }, f.owner.tokens.chats, 404, undefined, key('board-create'));
      await archivedParentFixture(f);
      await noMutation(() => denied('files', `/api/v1/archive/folders/${f.folderId}`, 'DELETE', { password: 'PrivateWhiteboard@2026' }, f.member.tokens.files, 404));
      const custody = await fixture('board-custody-associations'), meetingId = 'meeting:custody-fixture';
      await historical(state => { const data = snapshot(state, custody, 'chats').data, template = clone(require('../apps/chats/fixture.json').meetings[0]); data.meetings.push({ ...template, id: meetingId, title: 'Accepted custody meeting', participantIds: [String(custody.owner.account.user.id), String(custody.member.id)] }); });
      const channelBoard = await createBoard(custody, { channelId: custody.channelId }, custody.member.tokens.chats, 'custody-channel'), meetingBoard = await createBoard(custody, { meetingId }, custody.member.tokens.chats, 'custody-meeting'), standalone = await createBoard(custody, {}, custody.member.tokens.chats, 'custody-standalone');
      const results = await custodyFixture(custody), saved = (await domain()).state, source = snapshot(saved, custody, 'files').data, target = snapshot(saved, custody, 'chats').data;
      for (const archived of [channelBoard, meetingBoard]) {
        assert.ok(results.filesResult.archived.includes('file:' + archived.reference.fileId)); assert.ok(results.chatsResult.archived.includes('chat:whiteboard:' + archived.id));
        assert.equal(results.filesResult.transferred.includes('file:' + archived.reference.fileId), false); assert.equal(results.chatsResult.transferred.includes('chat:whiteboard:' + archived.id), false);
        const file = source.files.find(([id]) => id === archived.reference.fileId)[1], index = target.whiteboards.find(row => row.id === archived.id);
        assert.equal(file.ownerId, null); assert.equal(file.custodyReadOnly, true); assert.ok(file.deletedAt); assert.equal(file.versions.length, 1); assert.equal(index.ownerId, 'system:workspace'); assert.equal(index.custodyReadOnly, true);
        await denied('chats', `${BOARDS}/${archived.id}`, 'GET', undefined, custody.outsider.tokens.chats, 404); assert.equal((await nativeBytes(custody, archived, custody.outsider.tokens.files)).status, 404);
      }
      assert.equal(target.channels.find(row => row.id === custody.channelId).memberIds.includes(String(custody.outsider.id)), false);
      assert.equal(target.meetings.find(row => row.id === meetingId).participantIds.includes(String(custody.outsider.id)), false);
      assert.ok(results.filesResult.transferred.includes('file:' + standalone.reference.fileId)); assert.ok(results.chatsResult.transferred.includes('chat:whiteboard:' + standalone.id));
      assert.equal((await detail(custody, standalone, custody.outsider.tokens.chats)).id, standalone.id); await denied('chats', `${BOARDS}/${standalone.id}`, 'GET', undefined, custody.member.tokens.chats, 404);
      fs.writeFileSync(factsFile, JSON.stringify({ f, board, ids, custody, channelBoard, meetingBoard, standalone }));
    } else if (phase === 'loss-cold') {
      const { f, board, ids, custody, channelBoard, meetingBoard, standalone } = JSON.parse(fs.readFileSync(factsFile, 'utf8')); await denied('chats', `${BOARDS}/${board.id}`, 'GET', undefined, f.owner.tokens.chats, 404); assert.equal((await sharedBytes(f, board, ids, 'tasks')).status, 404);
      for (const archived of [channelBoard, meetingBoard]) { await denied('chats', `${BOARDS}/${archived.id}`, 'GET', undefined, custody.outsider.tokens.chats, 404); const source = snapshot((await domain()).state, custody, 'files').data.files.find(([id]) => id === archived.reference.fileId)[1]; assert.equal(source.custodyReadOnly, true); assert.equal(source.versions.length, 1, 'Custody preserves original structured history'); }
      assert.equal((await detail(custody, standalone, custody.outsider.tokens.chats)).id, standalone.id);
    } else if (phase === 'readonly') {
      for (const tool of ['files', 'chat']) {
        const f = await fixture('board-readonly-' + tool), board = await createBoard(f, { channelId: f.channelId }); await readOnly(f, tool);
        const visible = await detail(f, board); assert.equal(visible.capabilities.canWrite, false); assert.equal(visible.capabilities.readOnly, true); canonicalBytes(await nativeBytes(f, board), visible.scene);
        await denied('chats', `${BOARDS}/${board.id}`, 'PATCH', { baseVersionId: 'v1', scene: scene('#eeeeee') }, f.member.tokens.chats, 423, undefined, key('readonly-save-' + tool));
        await denied('chats', BOARDS, 'POST', { name: 'Read-only refuses create', parentId: f.folderId, channelId: f.channelId, scene: scene() }, f.member.tokens.chats, 423, undefined, key('readonly-create-' + tool));
        assert.equal(await versionsCount(f, board), 1); assert.equal((await expect('chats', BOARDS, 'GET', undefined, f.member.tokens.chats)).items.length, 1); assert.equal((await domain()).state.platformState.db.workspaces.find(row => row.id === f.owner.workspaceId).lines.find(row => row.tool === tool).state, 'read_only');
        await noMutation(() => denied('files', `/api/v1/folders/${f.folderId}/archive`, 'PATCH', {}, f.owner.tokens.files, 423));
        await archivedParentFixture(f);
        await noMutation(() => denied('files', `/api/v1/archive/folders/${f.folderId}`, 'DELETE', { password: 'PrivateWhiteboard@2026' }, f.owner.tokens.files, 423));
      }
    } else throw new Error('Unknown private whiteboard phase: ' + phase);
    assert.equal(clock(), Date.parse(AT)); console.log('Private whiteboard phase ' + phase + ' passed');
  } finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
}

if (process.argv.includes('--whiteboard-child')) child(process.argv[process.argv.indexOf('--whiteboard-child') + 1]).catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
else {
  const { test } = require('node:test');
  function isolated(label) {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'orgtik-whiteboard-http-')), children = new Set();
    const env = { ...process.env, WHITEBOARD_HTTP_DIR: folder, MOCK_AUTH_STORE: 'file', MOCK_AUTH_FILE: path.join(folder, 'accounts.json'), MOCK_JOURNAL: 'file', MOCK_SANDBOX: `whiteboard-${label}-${process.pid}`, MOCK_SESSION_SECRET: crypto.randomBytes(32).toString('hex'), MOCK_CLOCK: 'frozen', MOCK_NOW: AT, MOCK_PUBLIC_URL: '', VERCEL: '', KV_REST_API_URL: '', KV_REST_API_TOKEN: '', UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '' };
    function run(phase, extra = {}) { return new Promise((resolve, reject) => { const worker = spawn(process.execPath, ['--unhandled-rejections=strict', __filename, '--only=sos,admin,tasks,files,chats', '--whiteboard-child', phase], { env: { ...env, ...extra }, stdio: ['ignore', 'pipe', 'pipe'] }); children.add(worker); let output = ''; worker.stdout.on('data', value => output += value); worker.stderr.on('data', value => output += value); worker.on('error', error => { children.delete(worker); reject(error); }); worker.on('exit', code => { children.delete(worker); code === 0 ? resolve() : reject(new Error(`Whiteboard ${phase} exited${code}\n${output.slice(-7000).replace(/([?&](?:secret|token)=)[^\s]+/g, '$1[redacted]').replace(/\(password: [^)]+\)/g, '(password: [redacted])')}`)); }); }); }
    return { folder, run, async cleanup() { await Promise.all([...children].map(worker => new Promise(resolve => { worker.once('exit', resolve); worker.kill(); }))); const target = fs.realpathSync(folder); assert.ok(target.startsWith(fs.realpathSync(os.tmpdir()) + path.sep) && path.basename(target).startsWith('orgtik-whiteboard-http-')); fs.rmSync(target, { recursive: true, force: true }); } };
  }
  const cases = [
    ['actual board creation exposes one canonical Files JSON/zip record and persists across cold start', 'flow', 'flow-cold'],
    ['standalone author, real channel and canonical meeting permissions intersect Files without admin or audience bypass', 'acl', 'acl-cold'],
    ['immutable v1 Task/Chat content survives v2/v3 saves and permanent receipts return original saved version plus current head', 'versions', 'versions-cold'],
    ['malformed, external, image, oversized scene payloads cannot alter either store or allocate versions', 'invalid'],
    ['real commit outages and lost responses recover one board and saved version with original keys across cold start', 'outages', 'outages-cold'],
    ['source and channel permission loss, archive, custody and public sharing cannot disclose structured boards', 'loss', 'loss-cold'],
    ['Files or Chats read-only allows authorized views and refuses board creation/save without changing history', 'readonly'],
  ];
  for (const [name, ...phases] of cases) test(name, { timeout: 180000 }, async () => { const f = isolated(phases[0]); try { for (const phase of phases) await f.run(phase); } finally { await f.cleanup(); } });
  test('two physical signed save candidates at the same base and realm revision commit only one immutable version', { timeout: 180000 }, async () => {
    const f = isolated('physical-cas');
    try {
      await f.run('prepare-race'); const first = f.run('race', { WHITEBOARD_HTTP_ACTOR: 'one' }); first.catch(() => {}); await Promise.race([waitFor(() => fs.existsSync(path.join(f.folder, 'boot-one')), 'first physical instance initialization'), first]);
      const second = f.run('race', { WHITEBOARD_HTTP_ACTOR: 'two' }); second.catch(() => {}); await Promise.race([waitFor(() => fs.existsSync(path.join(f.folder, 'boot-two')), 'second physical instance initialization'), second]);
      fs.writeFileSync(path.join(f.folder, 'begin'), 'begin'); const pending = Promise.all([first, second]); pending.catch(() => {}); await Promise.race([waitFor(() => ['one', 'two'].every(id => fs.existsSync(path.join(f.folder, 'ready-' + id))), 'both actual board candidates'), pending]);
      const expected = ['one', 'two'].map(id => JSON.parse(fs.readFileSync(path.join(f.folder, 'ready-' + id), 'utf8'))); assert.deepEqual(expected[0], expected[1]); fs.writeFileSync(path.join(f.folder, 'release'), 'release'); await pending;
      const statuses = ['one', 'two'].map(id => JSON.parse(fs.readFileSync(path.join(f.folder, 'result-' + id), 'utf8')).status); assert.deepEqual(statuses.sort(), [200, 409]); await f.run('race-cold');
    } finally { await f.cleanup(); }
  });
}
