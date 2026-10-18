// Signed consumer/source ACL integration in disposable file-journal subprocesses.
// No shared API/clock, hosted credentials, arbitrary uploads or public fixture routes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const AT = '2026-10-07T09:00:00.000Z', DAY = 86400000;
const APPS = ['tasks', 'files', 'chats'];
const clone = value => JSON.parse(JSON.stringify(value));
const key = value => ({ 'idempotency-key': value });
const ref = file => ({ workspaceId: file.workspaceId, fileId: file.fileId, versionId: file.versionId });
const fields = ['fileId', 'mimetype', 'name', 'size', 'version', 'versionId', 'workspaceId'];
async function waitFor(predicate, label, timeout = 20000) {
  const end = performance.now() + timeout;
  while (!predicate()) { if (performance.now() > end) throw new Error('Timed out waiting for ' + label); await new Promise(resolve => setTimeout(resolve, 20)); }
}

async function child(phase) {
  const folder = fs.realpathSync(process.env.REFERENCE_HTTP_DIR);
  assert.ok(folder.startsWith(fs.realpathSync(os.tmpdir()) + path.sep) && path.basename(folder).startsWith('orgtik-reference-http-'));
  for (const name of ['MOCK_PUBLIC_URL', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']) assert.equal(process.env[name], '');
  const config = require('../config'); config.dataDir = folder;
  let identityWriteFault = false, startupWriteFailures = 0;
  const io = { ...fs, renameSync(source, destination) {
    if (identityWriteFault) {
      identityWriteFault = false; startupWriteFailures++;
      throw Object.assign(new Error('Private identity startup write failure'), { code: 'EPERM' });
    }
    return fs.renameSync(source, destination);
  } };
  const journal = require('./journal'), store = journal.fileStore(path.join(folder, 'journal.json'), { io });
  const initializeIdentity = store.initializeIdentity.bind(store);
  store.initializeIdentity = async accounts => {
    // Fail the real durable rename only during identity initialization, once.
    // Metadata initialization, later writes and retries use the actual file store.
    if (phase === 'startup' && startupWriteFailures === 0) identityWriteFault = true;
    try { return await initializeIdentity(accounts); } finally { identityWriteFault = false; }
  };
  const checkpoint = require('./domain-checkpoint');
  let boundary, args, refuseCommit = false, dropPath = null, barrier = false;
  const commit = store.commit.bind(store);
  store.commit = async (entry, expected) => {
    if (refuseCommit && entry.kind === 'workspace-v1' && !entry.url.startsWith('/__system/')) throw Object.assign(new Error('Private reference commit outage'), { status: 503, code: 'journal_unavailable' });
    if (['race', 'revoke-race'].includes(phase) && /\/api\/tasks\/\d+\/attachments$/.test(entry.url) && !barrier) {
      barrier = true; fs.writeFileSync(path.join(folder, 'ready-' + process.env.REFERENCE_HTTP_ACTOR), JSON.stringify({ epoch: expected.expectedEpoch, revision: expected.expectedRevision }));
      await waitFor(() => fs.existsSync(path.join(folder, 'release')), 'file-reference candidates reaching CAS');
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
    const answer = await call(app, route, method, body, token, headers);
    assert.equal(answer.status, status, `${app}${route}: ${answer.raw.code || answer.raw.message || answer.status}`); return answer.data;
  }
  async function deny(app, route, method, body, token, status, code, headers = {}) {
    const answer = await call(app, route, method, body, token, headers); assert.equal(answer.status, status); assert.equal(answer.raw.code, code); return answer;
  }
  const select = async (account, workspaceId, target) => (await expect('sos', '/api/auth/workspace', 'POST', { workspaceId, target }, account.tokens.accessToken)).tokens.accessToken;
  async function register(label) { return expect('sos', '/api/auth/register', 'POST', { email: label + '@reference.fixture.test', password: 'PrivateReference@2026', name: label + ' Person', company: label + ' Company' }, null, 201); }
  async function customer(label) {
    const account = await register(label), workspaceId = account.workspaceContext.workspace.id;
    const payment = await expect('sos', '/v1/app/payment-methods', 'POST', { last4: '4242', expires: '12/40', brand: 'Visa', kind: 'card' }, account.tokens.accessToken, 201);
    const items = [{ planId: 'tasks_pro', cycle: 'monthly', intent: 'seat_purchase', quantity: 5 }, { planId: 'files_pro', cycle: 'monthly' }, { planId: 'chat_pro', cycle: 'monthly' }];
    const quote = await expect('sos', '/v1/app/checkout/preview', 'POST', { items }, account.tokens.accessToken);
    await expect('sos', '/v1/app/checkout/confirm', 'POST', { items, quoteId: quote.quoteId, paymentMethodId: payment.id, billing: { legalName: 'Reference fixture' } }, account.tokens.accessToken, 201, key('purchase-' + label));
    return { account, workspaceId, tokens: Object.fromEntries(await Promise.all(APPS.map(async app => [app, await select(account, workspaceId, app)]))) };
  }
  async function person(owner, label, tools = ['tasks', 'files', 'chat'], toolRoles) {
    const account = await register(label);
    const invitation = await expect('sos', '/v1/app/invitations', 'POST', { email: account.user.email, role: 'member', tools, ...(toolRoles ? { toolRoles } : {}) }, owner.account.tokens.accessToken);
    const delivery = await expect('sos', `/v1/app/invitations/${invitation.id}/delivery`, 'GET', undefined, owner.account.tokens.accessToken);
    await expect('sos', `/v1/public/invitations/${delivery.invitePath.split('/').pop()}/accept`, 'POST', {}, account.tokens.accessToken, 200, key('accept-' + label));
    return { account, id: account.user.id, tokens: Object.fromEntries(await Promise.all(APPS.filter(app => tools.includes(app === 'chats' ? 'chat' : app)).map(async app => [app, await select(account, owner.workspaceId, app)]))) };
  }
  const event = (token, value, operationId) => expect('chats', '/api/hq/commands', 'POST', { event: value }, token, 200, key(operationId));
  const picker = (type, id, search = '') => '/api/shared/files?' + new URLSearchParams({ resourceType: type, resourceId: String(id), search, page: '1', limit: '20' });
  async function fixture(label) {
    const owner = await customer(label), second = await customer(label + '-second');
    const member = await person(owner, label + '-member');
    const outsider = await person(owner, label + '-outsider', undefined, { chat: 'admin' });
    const viewer = await person(owner, label + '-viewer', undefined, { tasks: 'viewer' });
    const noFiles = await person(owner, label + '-no-files', ['tasks', 'chat']);
    const project = await expect('tasks', '/api/projects', 'POST', { title: 'Private reference project', isPrivate: true, memberIds: [member.id, viewer.id, noFiles.id] }, owner.tokens.tasks, 201);
    const detail = await expect('tasks', `/api/projects/${project.id}`, 'GET', undefined, owner.tokens.tasks);
    const task = await expect('tasks', `/api/tasks/sections/${detail.sections[0].section.id}`, 'POST', { title: 'Reference task', assignedUserIds: [member.id] }, owner.tokens.tasks, 201);
    const chat = await event(owner.tokens.chats, { type: 'channel.created', channel: { name: 'Private reference channel', kind: 'private', memberIds: [String(member.id), String(viewer.id), String(noFiles.id)] } }, 'channel-' + label);
    const channelId = chat.channels.find(row => row.name === 'Private reference channel').id;
    const folder = await expect('files', '/api/v1/folders', 'POST', { name: 'Reference folder', visibility: 'specific_people', allowedUserIds: [member.id, outsider.id, viewer.id] }, owner.tokens.files, 201);
    const catalog = await expect('files', '/api/v1/files/samples', 'GET', undefined, owner.tokens.files);
    assert.equal(catalog.canCreate, true); assert.ok(catalog.items.length > 0);
    const sample = catalog.items.find(row => row.mimetype === 'application/pdf') || catalog.items[0];
    const file = await expect('files', '/api/v1/files/samples', 'POST', { sampleId: sample.sampleId, parentId: folder.id }, owner.tokens.files, 201, key('sample-' + label));
    assert.equal(file.workspaceId, owner.workspaceId); assert.equal(file.versionId, 'v1'); assert.equal(file.version, 1);
    const foreignCatalog = await expect('files', '/api/v1/files/samples', 'GET', undefined, second.tokens.files);
    const foreign = await expect('files', '/api/v1/files/samples', 'POST', { sampleId: foreignCatalog.items[0].sampleId }, second.tokens.files, 201, key('foreign-' + label));
    const result = { owner, second, member, outsider, viewer, noFiles, projectId: project.id, taskId: task.id, channelId, folderId: folder.id, file, sample, foreign };
    // Warm actual target/source reads before racing mutations, so lazy store setup is not the race.
    await expect('tasks', `/api/tasks/${task.id}`, 'GET', undefined, member.tokens.tasks);
    await expect('tasks', picker('task', task.id), 'GET', undefined, member.tokens.tasks);
    await expect('chats', '/api/hq/bootstrap', 'GET', undefined, member.tokens.chats);
    fs.writeFileSync(factsFile, JSON.stringify(result)); return result;
  }
  const attachments = (f, token) => expect('tasks', `/api/tasks/${f.taskId}/attachments`, 'POST', { references: [ref(f.file)] }, token || f.member.tokens.tasks, 201, key('attach-' + f.taskId));
  async function attachBoth(f) {
    const added = await attachments(f), bootstrap = await event(f.member.tokens.chats, { type: 'message.created', message: { channelId: f.channelId, text: '', attachments: [ref(f.file)] } }, 'file-message');
    const message = bootstrap.messages.find(row => row.attachments.some(value => value.reference?.fileId === f.file.fileId));
    assert.ok(message); assert.equal(message.text, '');
    return { taskAttachmentId: added[0].id, messageId: message.id, chatReferenceId: message.attachments[0].id };
  }
  async function domain() {
    const snapshot = await store.snapshot(0), entry = snapshot.entries.map(JSON.parse).findLast(row => row.checkpoint);
    assert.ok(entry); return { ...snapshot, state: checkpoint.decodeDomainCheckpoint(entry.checkpoint) };
  }
  function canonical(items) {
    for (const item of items) { assert.deepEqual(Object.keys(item).sort(), fields); assert.equal(item.versionId, 'v1'); assert.equal(item.version, 1); assert.ok(Number.isSafeInteger(item.size) && item.size > 0); }
  }
  async function projections(f, ids) {
    const task = await expect('tasks', `/api/tasks/${f.taskId}`, 'GET', undefined, f.member.tokens.tasks);
    const attachment = task.attachments.find(row => row.id === ids.taskAttachmentId);
    const chat = await expect('chats', '/api/hq/bootstrap', 'GET', undefined, f.member.tokens.chats), message = chat.messages.find(row => row.id === ids.messageId);
    return { attachment, chat: message.attachments[0] };
  }
  async function content(app, f, ids, token) {
    const resourceType = app === 'tasks' ? 'task' : 'message', resourceId = app === 'tasks' ? f.taskId : ids.messageId, referenceId = app === 'tasks' ? ids.taskAttachmentId : ids.chatReferenceId;
    const route = `/api/shared/files/${f.file.fileId}/versions/v1/content?` + new URLSearchParams({ resourceType, resourceId: String(resourceId), referenceId: String(referenceId) });
    return call(app, route, 'GET', undefined, token || f.member.tokens[app], {}, true);
  }
  async function setFolder(f, ids) { return expect('files', `/api/v1/folders/${f.folderId}`, 'PATCH', { visibility: 'specific_people', allowedUserIds: ids }, f.owner.tokens.files); }
  async function readonly(f, tools) {
    // An accepted private historical renewal boundary, not a fake access DTO. The next
    // real request runs the actual due reducer at the unchanged fixture business clock.
    const before = await domain(), state = clone(before.state), ws = state.platformState.db.workspaces.find(row => row.id === f.owner.workspaceId);
    ws.paymentMethods.find(row => row.isDefault).last4 = '0002';
    for (const tool of tools) {
      const line = ws.lines.find(row => row.tool === tool);
      Object.assign(line, { state: 'active', autoRenew: true, periodStart: new Date(Date.parse(AT) - 37 * DAY).toISOString(), periodEnd: new Date(Date.parse(AT) - 7 * DAY).toISOString() });
      delete line.lastFailure; delete line.readOnlySince; delete line.graceEndsAt; delete line.billingRenewalDueAt;
    }
    await commit({ epoch: before.meta.epoch, kind: 'workspace-v1', app: 'admin', method: 'SYSTEM', url: '/__fixture/reference-renewal', headers: {}, body: null, at: clock(), checkpoint: checkpoint.encodeDomainCheckpoint(state) }, { expectedEpoch: before.meta.epoch, expectedRevision: before.revision });
    args.persist.rebuild = true;
  }

  try {
    if (phase === 'startup') {
      const body = { email: 'startup-retry@reference.fixture.test', password: 'PrivateReference@2026', name: 'Startup retry person', company: 'Startup retry company' };
      // Registration is the first actual request. An initialization error must be
      // caught before its account/workspace handler or bearer response can run.
      await deny('sos', '/api/auth/register', 'POST', body, null, 503, 'journal_unavailable');
      assert.equal(startupWriteFailures, 1);
      assert.equal(await store.identityAccounts(), null, 'A failed identity rename creates no persisted account table');
      const failed = await store.snapshot(0); assert.equal(failed.revision, 0); assert.equal(failed.entries.length, 0);
      assert.equal(require('./identity').findByEmail(body.email), undefined);
      assert.equal(require('../apps/admin').getStore().db.workspaces.some(row => row.name === body.company), false);
      const account = await expect('sos', '/api/auth/register', 'POST', body, null, 201);
      assert.equal(startupWriteFailures, 1, 'The same process retries the real initialization successfully');
      const me = await expect('sos', '/api/auth/me', 'GET', undefined, account.tokens.accessToken);
      assert.equal(me.user.email, body.email);
      const appMe = await expect('sos', '/v1/app/me', 'GET', undefined, account.tokens.accessToken);
      assert.equal(appMe.workspaceContext.workspace.id, account.workspaceContext.workspace.id);
      const saved = await store.identityAccounts(); assert.ok(saved.has(String(account.user.id)));
      const ws = (await domain()).state.platformState.db.workspaces.find(row => row.id === account.workspaceContext.workspace.id);
      assert.ok(ws); assert.equal(ws.members.find(row => row.role === 'owner').userKey, JSON.parse(saved.get(String(account.user.id))).user.key);
      fs.writeFileSync(factsFile, JSON.stringify({ body, account }));
    } else if (phase === 'startup-cold') {
      const { body, account } = JSON.parse(fs.readFileSync(factsFile, 'utf8'));
      const me = await expect('sos', '/api/auth/me', 'GET', undefined, account.tokens.accessToken);
      assert.equal(me.user.id, account.user.id); assert.equal(me.user.email, body.email);
      const login = await expect('sos', '/api/auth/login', 'POST', { email: body.email, password: body.password });
      assert.equal(login.user.id, account.user.id);
      assert.equal(login.workspaceContext.workspace.id, account.workspaceContext.workspace.id);
      assert.ok((await store.identityAccounts()).has(String(account.user.id)));
      assert.equal((await domain()).state.platformState.db.workspaces.filter(row => row.id === account.workspaceContext.workspace.id).length, 1);
    } else if (phase === 'flow') {
      const f = await fixture('reference-flow'), items = await expect('tasks', picker('task', f.taskId), 'GET', undefined, f.member.tokens.tasks);
      canonical(items.items); assert.deepEqual(items.meta, { page: 1, limit: 20, total: 1, totalPages: 1 });
      assert.equal(items.items[0].fileId, f.file.fileId); assert.equal((await expect('chats', picker('channel', f.channelId), 'GET', undefined, f.member.tokens.chats)).items[0].fileId, f.file.fileId);
      const ids = await attachBoth(f), shown = await projections(f, ids);
      assert.equal(shown.attachment.state, 'available'); assert.equal(shown.attachment.fileUrl, null); assert.equal(shown.chat.state, 'available');
      const taskBytes = await content('tasks', f, ids), chatBytes = await content('chats', f, ids);
      assert.equal(taskBytes.status, 200); assert.equal(chatBytes.status, 200); assert.deepEqual(taskBytes.bytes, chatBytes.bytes); assert.ok(taskBytes.bytes.length > 0);
      assert.equal(taskBytes.bytes.length, f.sample.size); if (f.sample.mimetype === 'application/pdf') assert.equal(taskBytes.bytes.subarray(0, 5).toString(), '%PDF-');
      assert.equal(taskBytes.headers.get('x-content-type-options'), 'nosniff'); assert.match(taskBytes.headers.get('cache-control'), /no-store/);
      await expect('files', `/api/v1/files/${f.file.fileId}`, 'PATCH', { name: 'Renamed pinned reference.txt' }, f.owner.tokens.files);
      for (const app of ['tasks', 'chats']) {
        const current = await content(app, f, ids);
        assert.deepEqual(current.bytes, taskBytes.bytes, 'Renaming cannot mutate pinned version content');
        assert.match(current.headers.get('content-type'), /^application\/pdf\b/, 'The current filename must not override the pinned MIME type');
        assert.match(current.headers.get('content-disposition'), /Renamed pinned reference\.txt/);
      }
      const renamed = await projections(f, ids); assert.equal(renamed.attachment.mimetype, 'application/pdf'); assert.equal(renamed.chat.mimetype, 'application/pdf');
      await attachments(f);
      const current = await expect('tasks', `/api/tasks/${f.taskId}`, 'GET', undefined, f.member.tokens.tasks); assert.equal(current.attachments.length, 1);
      fs.writeFileSync(factsFile, JSON.stringify({ f, ids, hash: crypto.createHash('sha256').update(taskBytes.bytes).digest('hex') }));
    } else if (phase === 'flow-cold') {
      const { f, ids, hash } = JSON.parse(fs.readFileSync(factsFile, 'utf8')), shown = await projections(f, ids);
      assert.equal(shown.attachment.state, 'available'); assert.equal(shown.chat.state, 'available');
      assert.equal(crypto.createHash('sha256').update((await content('tasks', f, ids)).bytes).digest('hex'), hash);
      assert.equal(crypto.createHash('sha256').update((await content('chats', f, ids)).bytes).digest('hex'), hash);
      const bad = await call('tasks', `/api/shared/files/${f.file.fileId}/versions/v2/content?resourceType=task&resourceId=${f.taskId}&referenceId=${ids.taskAttachmentId}`, 'GET', undefined, f.member.tokens.tasks);
      assert.equal(bad.status, 404);
      await expect('tasks', `/api/tasks/attachments/${ids.taskAttachmentId}`, 'DELETE', {}, f.member.tokens.tasks, 200, key('remove-reference'));
      const guessed = await content('tasks', f, ids); assert.equal(guessed.status, 404); assert.equal(guessed.raw.code, 'reference_not_found');
      await expect('files', `/api/v1/files/${f.file.fileId}/archive`, 'PATCH', {}, f.owner.tokens.files);
      const archived = await expect('chats', '/api/hq/bootstrap', 'GET', undefined, f.member.tokens.chats);
      const history = archived.messages.find(row => row.id === ids.messageId); assert.ok(history); assert.equal(history.attachments[0].state, 'unavailable'); assert.equal(history.attachments[0].name, '');
      const archivedBytes = await content('chats', f, ids); assert.equal(archivedBytes.status, 404); assert.equal(archivedBytes.raw.code, 'file_not_found');
    } else if (phase === 'acl') {
      const f = await fixture('reference-acl'), path = `/api/tasks/${f.taskId}/attachments`, body = { references: [ref(f.file)] }, before = await domain();
      await deny('tasks', picker('task', f.taskId), 'GET', undefined, f.outsider.tokens.tasks, 404, 'task_not_found');
      await deny('chats', picker('channel', f.channelId), 'GET', undefined, f.outsider.tokens.chats, 404, 'channel_not_found');
      await deny('tasks', picker('task', f.taskId), 'GET', undefined, f.noFiles.tokens.tasks, 403, 'files_access_denied');
      await deny('tasks', path, 'POST', body, f.noFiles.tokens.tasks, 403, 'files_access_denied', key('no-files'));
      assert.equal((await call('tasks', path, 'POST', body, f.viewer.tokens.tasks, key('viewer-ref'))).status, 403);
      await deny('tasks', path, 'POST', { references: [ref(f.foreign)] }, f.member.tokens.tasks, 404, 'file_not_found', key('foreign-ref'));
      await deny('tasks', path, 'POST', { references: [{ ...ref(f.file), name: 'Forged metadata', url: 'https://invalid.fixture.test/forged' }] }, f.member.tokens.tasks, 422, 'invalid_file_reference', key('forged-ref'));
      await deny('tasks', path, 'POST', { references: [ref(f.file)] }, f.member.tokens.tasks, 422, 'operation_id_required');
      const wrongAudience = await call('tasks', picker('task', f.taskId), 'GET', undefined, f.owner.tokens.files); assert.equal(wrongAudience.status, 401);
      const mismatch = await call('tasks', picker('task', f.taskId), 'GET', undefined, f.member.tokens.tasks, { 'x-workspace': f.second.workspaceId }); assert.equal(mismatch.status, 409);
      const after = await domain(); assert.deepEqual(after.state, before.state, 'Refusals never create references, messages, source records or activity');
      const ids = await attachBoth(f);
      const outsider = await content('chats', f, ids, f.outsider.tokens.chats); assert.equal(outsider.status, 404); assert.equal(outsider.raw.code, 'channel_not_found');
      const hiddenTask = await content('tasks', f, ids, f.outsider.tokens.tasks); assert.equal(hiddenTask.status, 404); assert.equal(hiddenTask.raw.code, 'task_not_found');
      const noSource = await content('tasks', f, ids, f.noFiles.tokens.tasks); assert.equal(noSource.status, 403); assert.equal(noSource.raw.code, 'files_access_denied');
      const guessed = await call('tasks', `/api/shared/files/${f.file.fileId}/versions/v1/content?resourceType=task&resourceId=${f.taskId}&referenceId=not-stored`, 'GET', undefined, f.member.tokens.tasks); assert.equal(guessed.status, 404); assert.equal(guessed.raw.code, 'reference_not_found');
    } else if (phase === 'permission-loss') {
      const f = await fixture('permission-loss'), ids = await attachBoth(f);
      await setFolder(f, [f.outsider.id]);
      let shown = await projections(f, ids);
      assert.equal(shown.attachment.state, 'unavailable'); assert.equal(shown.attachment.originalName, ''); assert.equal(shown.attachment.size, 0); assert.equal(shown.attachment.fileUrl, null); assert.equal(shown.attachment.contentPath, undefined);
      assert.equal(shown.chat.state, 'unavailable'); assert.equal(shown.chat.name, ''); assert.equal(shown.chat.size, ''); assert.equal(shown.chat.contentPath, undefined);
      assert.equal((await expect('tasks', picker('task', f.taskId), 'GET', undefined, f.member.tokens.tasks)).items.length, 0);
      const contentDenied = await content('tasks', f, ids); assert.equal(contentDenied.status, 404); assert.equal(contentDenied.raw.code, 'file_not_found');
      await deny('tasks', `/api/tasks/${f.taskId}/attachments`, 'POST', { references: [ref(f.file)] }, f.member.tokens.tasks, 404, 'file_not_found', key('attach-' + f.taskId));
      await deny('chats', '/api/hq/commands', 'POST', { event: { type: 'message.created', message: { channelId: f.channelId, text: '', attachments: [ref(f.file)] } } }, f.member.tokens.chats, 404, 'file_not_found', key('file-message'));
      // Native explicit extra-reader override is independently authorized; it does not
      // modify the consumer target or broaden the inherited folder policy for everyone.
      await expect('files', `/api/v1/files/${f.file.fileId}/access`, 'PUT', { visibility: 'specific_people', allowedUserIds: [f.member.id] }, f.owner.tokens.files);
      shown = await projections(f, ids); assert.equal(shown.attachment.state, 'available'); assert.equal(shown.chat.state, 'available');
      await event(f.owner.tokens.chats, { type: 'channel.member_removed', channelId: f.channelId, userId: String(f.member.id) }, 'remove-channel-member');
      assert.equal((await expect('chats', '/api/hq/bootstrap', 'GET', undefined, f.member.tokens.chats)).messages.some(row => row.id === ids.messageId), false);
      const channelDenied = await content('chats', f, ids); assert.equal(channelDenied.status, 404); assert.equal(channelDenied.raw.code, 'channel_not_found');
      await expect('tasks', `/api/projects/${f.projectId}/members/remove`, 'POST', { memberIds: [f.member.id] }, f.owner.tokens.tasks);
      await deny('tasks', picker('task', f.taskId), 'GET', undefined, f.member.tokens.tasks, 404, 'task_not_found');
      const taskDenied = await content('tasks', f, ids); assert.equal(taskDenied.status, 404); assert.equal(taskDenied.raw.code, 'task_not_found');
      fs.writeFileSync(factsFile, JSON.stringify({ f, ids }));
    } else if (phase === 'permission-cold') {
      const { f, ids } = JSON.parse(fs.readFileSync(factsFile, 'utf8'));
      await deny('tasks', picker('task', f.taskId), 'GET', undefined, f.member.tokens.tasks, 404, 'task_not_found');
      assert.equal((await content('chats', f, ids)).status, 404);
      const snapshot = (await domain()).state.workspaceState.snapshots[f.owner.workspaceId + ':tasks'];
      assert.equal(snapshot.data.attachments.filter(row => row.reference?.fileId === f.file.fileId).length, 1, 'Permission loss never destroys historical links');
    } else if (phase === 'outages') {
      const f = await fixture('reference-outage'), before = await domain(), body = { references: [ref(f.file)] }, route = `/api/tasks/${f.taskId}/attachments`;
      refuseCommit = true;
      assert.equal((await call('tasks', route, 'POST', body, f.member.tokens.tasks, key('retry-original'))).status, 503);
      refuseCommit = false;
      assert.deepEqual((await domain()).state, before.state); assert.equal((await domain()).revision, before.revision);
      dropPath = '/tasks' + route;
      await assert.rejects(call('tasks', route, 'POST', body, f.member.tokens.tasks, key('retry-original')));
      const repeated = await expect('tasks', route, 'POST', body, f.member.tokens.tasks, 201, key('retry-original'));
      assert.equal(repeated.length, 1); assert.equal((await expect('tasks', `/api/tasks/${f.taskId}`, 'GET', undefined, f.member.tokens.tasks)).attachments.length, 1);
      await deny('tasks', route, 'POST', { references: [] }, f.member.tokens.tasks, 422, 'invalid_file_references', key('retry-original'));
      const additional = await expect('files', '/api/v1/files/samples', 'POST', { sampleId: f.sample.sampleId, parentId: f.folderId }, f.owner.tokens.files, 201, key('second-record'));
      await deny('tasks', route, 'POST', { references: [ref(additional)] }, f.member.tokens.tasks, 409, 'operation_conflict', key('retry-original'));
      const chatEvent = { type: 'message.created', message: { channelId: f.channelId, text: '', attachments: [ref(f.file)] } };
      const chatBefore = await domain(); refuseCommit = true;
      assert.equal((await call('chats', '/api/hq/commands', 'POST', { event: chatEvent }, f.member.tokens.chats, key('message-retry'))).status, 503); refuseCommit = false;
      assert.deepEqual((await domain()).state, chatBefore.state);
      dropPath = '/chats/api/hq/commands'; await assert.rejects(call('chats', '/api/hq/commands', 'POST', { event: chatEvent }, f.member.tokens.chats, key('message-retry')));
      const messages = await event(f.member.tokens.chats, chatEvent, 'message-retry'); assert.equal(messages.messages.filter(row => row.attachments.some(value => value.reference?.fileId === f.file.fileId)).length, 1);
      fs.writeFileSync(factsFile, JSON.stringify({ f, attachmentId: repeated[0].id, chatEvent }));
    } else if (phase === 'outages-cold') {
      const { f, attachmentId, chatEvent } = JSON.parse(fs.readFileSync(factsFile, 'utf8'));
      const repeated = await expect('tasks', `/api/tasks/${f.taskId}/attachments`, 'POST', { references: [ref(f.file)] }, f.member.tokens.tasks, 201, key('retry-original')); assert.equal(repeated.length, 1); assert.equal(repeated[0].id, attachmentId);
      const chat = await event(f.member.tokens.chats, chatEvent, 'message-retry'); assert.equal(chat.messages.filter(row => row.attachments.some(value => value.reference?.fileId === f.file.fileId)).length, 1);
    } else if (phase === 'readonly') {
      const f = await fixture('readonly-reference'); await readonly(f, ['files']);
      const list = await expect('tasks', picker('task', f.taskId), 'GET', undefined, f.member.tokens.tasks); assert.equal(list.items.length, 1);
      const ids = await attachBoth(f);
      assert.equal((await content('tasks', f, ids)).status, 200); assert.equal((await content('chats', f, ids)).status, 200);
      assert.equal((await call('files', '/api/v1/files/samples', 'POST', { sampleId: f.sample.sampleId, parentId: f.folderId }, f.owner.tokens.files, key('readonly-sample'))).status, 423);
      let ws = (await domain()).state.platformState.db.workspaces.find(row => row.id === f.owner.workspaceId); assert.equal(ws.lines.find(row => row.tool === 'files').state, 'read_only'); assert.equal(ws.lines.find(row => row.tool === 'tasks').state, 'active');
      await readonly(f, ['tasks']);
      assert.equal((await call('tasks', `/api/tasks/${f.taskId}/attachments`, 'POST', { references: [ref(f.file)] }, f.member.tokens.tasks, key('readonly-task'))).status, 423);
      assert.equal((await call('tasks', `/api/tasks/attachments/${ids.taskAttachmentId}`, 'DELETE', {}, f.member.tokens.tasks, key('readonly-delete'))).status, 423);
      assert.equal((await content('tasks', f, ids)).status, 200, 'Read-only target retains authorized content reads');
      await readonly(f, ['chat']);
      assert.equal((await call('chats', '/api/hq/commands', 'POST', { event: { type: 'message.created', message: { channelId: f.channelId, text: '', attachments: [ref(f.file)] } } }, f.member.tokens.chats, key('readonly-message'))).status, 423);
      assert.equal((await content('chats', f, ids)).status, 200);
    } else if (phase === 'prepare-race') {
      const f = await fixture('reference-race'); fs.writeFileSync(factsFile, JSON.stringify(f));
    } else if (phase === 'race' || phase === 'revoke-race') {
      const f = JSON.parse(fs.readFileSync(factsFile, 'utf8'));
      if (phase === 'race') {
        // Bootstrap processes separately, then deliberately race the same actual mutation.
        // This isolates reference CAS from unrelated Windows file-store initialization writes.
        await expect('tasks', `/api/tasks/${f.taskId}`, 'GET', undefined, f.member.tokens.tasks);
        fs.writeFileSync(path.join(folder, 'boot-' + process.env.REFERENCE_HTTP_ACTOR), 'ready');
        await waitFor(() => fs.existsSync(path.join(folder, 'begin-race')), 'both processes initialized');
      }
      const response = await call('tasks', `/api/tasks/${f.taskId}/attachments`, 'POST', { references: [ref(f.file)] }, f.member.tokens.tasks, key('race-original'));
      if (phase === 'revoke-race') assert.equal(response.status, 409, 'A newer source permission checkpoint fences the old authorized candidate');
      else assert.ok([201, 409].includes(response.status), 'Only a success or actual CAS conflict is a valid race outcome');
      fs.writeFileSync(path.join(folder, 'result-' + process.env.REFERENCE_HTTP_ACTOR), JSON.stringify({ status: response.status }));
    } else if (phase === 'race-cold') {
      const f = JSON.parse(fs.readFileSync(factsFile, 'utf8'));
      const retried = await expect('tasks', `/api/tasks/${f.taskId}/attachments`, 'POST', { references: [ref(f.file)] }, f.member.tokens.tasks, 201, key('race-original'));
      assert.equal(retried.length, 1);
      const task = await expect('tasks', `/api/tasks/${f.taskId}`, 'GET', undefined, f.member.tokens.tasks); assert.equal(task.attachments.length, 1); assert.equal(task.attachments[0].id, retried[0].id);
      const data = (await domain()).state.workspaceState.snapshots[f.owner.workspaceId + ':tasks'].data;
      assert.equal(data.attachments.filter(row => row.reference?.fileId === f.file.fileId).length, 1);
      assert.equal(data.activities.filter(row => row.action === 'attachment_added').length, 1, 'Only one cross-app reference activity is recorded');
    } else if (phase === 'revoke-source') {
      const f = JSON.parse(fs.readFileSync(factsFile, 'utf8')); await setFolder(f, [f.outsider.id]);
    } else if (phase === 'revoke-cold') {
      const f = JSON.parse(fs.readFileSync(factsFile, 'utf8'));
      await deny('tasks', `/api/tasks/${f.taskId}/attachments`, 'POST', { references: [ref(f.file)] }, f.member.tokens.tasks, 404, 'file_not_found', key('race-original'));
      assert.equal((await expect('tasks', `/api/tasks/${f.taskId}`, 'GET', undefined, f.member.tokens.tasks)).attachments.length, 0);
      const data = (await domain()).state.workspaceState.snapshots[f.owner.workspaceId + ':tasks'].data;
      assert.equal(data.activities.filter(row => row.action === 'attachment_added').length, 0);
    } else if (phase === 'eviction') {
      const f = await fixture('chat-receipt-eviction'), ids = await attachBoth(f);
      for (let index = 0; index < 260; index++) await event(f.member.tokens.chats, { type: 'channel.read', channelId: f.channelId }, 'read-cache-' + index);
      let data = (await domain()).state.workspaceState.snapshots[f.owner.workspaceId + ':chats'].data;
      assert.equal(data.processedCommands.some(row => row.id === 'file-message'), false, 'The bounded command cache must actually evict the original key');
      const original = { type: 'message.created', message: { channelId: f.channelId, text: '', attachments: [ref(f.file)] } };
      const response = await event(f.member.tokens.chats, original, 'file-message');
      assert.equal(response.messages.filter(row => row.attachments.some(value => value.reference?.fileId === f.file.fileId)).length, 1); assert.ok(response.messages.some(row => row.id === ids.messageId));
      await deny('chats', '/api/hq/commands', 'POST', { event: { ...original, message: { ...original.message, text: 'Changed retry' } } }, f.member.tokens.chats, 409, 'operation_conflict', key('file-message'));
      await setFolder(f, [f.outsider.id]);
      await deny('chats', '/api/hq/commands', 'POST', { event: original }, f.member.tokens.chats, 404, 'file_not_found', key('file-message'));
      data = (await domain()).state.workspaceState.snapshots[f.owner.workspaceId + ':chats'].data;
      assert.equal(data.messages.filter(row => row.fileOperation?.id === 'file-message').length, 1);
      fs.writeFileSync(factsFile, JSON.stringify({ f, ids, original }));
    } else if (phase === 'eviction-cold') {
      const { f, ids, original } = JSON.parse(fs.readFileSync(factsFile, 'utf8'));
      await deny('chats', '/api/hq/commands', 'POST', { event: original }, f.member.tokens.chats, 404, 'file_not_found', key('file-message'));
      const chat = await expect('chats', '/api/hq/bootstrap', 'GET', undefined, f.member.tokens.chats); assert.equal(chat.messages.filter(row => row.id === ids.messageId).length, 1); assert.equal(chat.messages.find(row => row.id === ids.messageId).attachments[0].state, 'unavailable');
    } else throw new Error('Unknown private Files reference phase: ' + phase);
    assert.equal(clock(), Date.parse(AT)); console.log('Private Files reference phase ' + phase + ' passed');
  } finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
}

if (process.argv.includes('--reference-child')) child(process.argv[process.argv.indexOf('--reference-child') + 1]).catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
else {
  const { test } = require('node:test');
  function isolated(label) {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'orgtik-reference-http-')), children = new Set();
    const env = { ...process.env, REFERENCE_HTTP_DIR: folder, MOCK_AUTH_STORE: 'file', MOCK_AUTH_FILE: path.join(folder, 'accounts.json'), MOCK_JOURNAL: 'file', MOCK_SANDBOX: `reference-${label}-${process.pid}`, MOCK_SESSION_SECRET: crypto.randomBytes(32).toString('hex'), MOCK_CLOCK: 'frozen', MOCK_NOW: AT, MOCK_PUBLIC_URL: '', VERCEL: '', KV_REST_API_URL: '', KV_REST_API_TOKEN: '', UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '' };
    const run = (phase, extra = {}) => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['--unhandled-rejections=strict', __filename, '--only=sos,admin,tasks,files,chats', '--reference-child', phase], { env: { ...env, ...extra }, stdio: ['ignore', 'pipe', 'pipe'] }); children.add(child);
      let output = ''; child.stdout.on('data', value => output += value); child.stderr.on('data', value => output += value);
      child.on('error', error => { children.delete(child); reject(error); }); child.on('exit', code => { children.delete(child); code === 0 ? resolve() : reject(new Error(`Files ${phase} exited${code}\n${output.slice(-7500).replace(/([?&](?:secret|token)=)[^\s]+/g, '$1[redacted]').replace(/\(password: [^)]+\)/g, '(password: [redacted])')}`)); });
    });
    return { folder, run, async cleanup() { await Promise.all([...children].map(child => new Promise(resolve => { child.once('exit', resolve); child.kill(); }))); const target = fs.realpathSync(folder); assert.ok(target.startsWith(fs.realpathSync(os.tmpdir()) + path.sep) && path.basename(target).startsWith('orgtik-reference-http-')); fs.rmSync(target, { recursive: true, force: true }); } };
  }
  test('real sample records are picked and referenced in private Tasks/Chats, pinned bytes and stored links persist across cold start', { timeout: 180000 }, async () => {
    const f = isolated('flow'); try { await f.run('flow'); await f.run('flow-cold'); } finally { await f.cleanup(); }
  });
  test('consumer project/channel ACL, Files grant, workspace and audience intersect before disclosure or attachment writes', { timeout: 180000 }, async () => {
    const f = isolated('acl'); try { await f.run('acl'); } finally { await f.cleanup(); }
  });
  test('inherited and file-specific source ACL plus consumer membership are revalidated on projections, content and old receipts across cold start', { timeout: 180000 }, async () => {
    const f = isolated('permission-loss'); try { await f.run('permission-loss'); await f.run('permission-cold'); } finally { await f.cleanup(); }
  });
  test('failed commits and real lost responses leave no partial references and preserve original-operation recovery across cold start', { timeout: 180000 }, async () => {
    const f = isolated('outages'); try { await f.run('outages'); await f.run('outages-cold'); } finally { await f.cleanup(); }
  });
  test('read-only Files permits existing references while read-only consumers refuse reference writes and retain content reads', { timeout: 180000 }, async () => {
    const f = isolated('readonly'); try { await f.run('readonly'); } finally { await f.cleanup(); }
  });
  test('two physical processes linking the same file with the same operation record one reference and activity across cold start', { timeout: 180000 }, async () => {
    const f = isolated('same-key-race');
    try {
      await f.run('prepare-race');
      const first = f.run('race', { REFERENCE_HTTP_ACTOR: 'one' }); first.catch(() => {});
      await Promise.race([waitFor(() => fs.existsSync(path.join(f.folder, 'boot-one')), 'first process initialization'), first]);
      const second = f.run('race', { REFERENCE_HTTP_ACTOR: 'two' }); second.catch(() => {});
      await Promise.race([waitFor(() => fs.existsSync(path.join(f.folder, 'boot-two')), 'second process initialization'), second]);
      fs.writeFileSync(path.join(f.folder, 'begin-race'), 'begin');
      const workers = Promise.all([first, second]); workers.catch(() => {});
      await Promise.race([waitFor(() => ['one', 'two'].every(name => fs.existsSync(path.join(f.folder, 'ready-' + name))), 'both physical reference candidates'), workers]);
      const revisions = ['one', 'two'].map(name => JSON.parse(fs.readFileSync(path.join(f.folder, 'ready-' + name), 'utf8'))); assert.deepEqual(revisions[0], revisions[1]);
      fs.writeFileSync(path.join(f.folder, 'release'), 'release'); await workers;
      const results = ['one', 'two'].map(name => JSON.parse(fs.readFileSync(path.join(f.folder, 'result-' + name), 'utf8')).status); assert.deepEqual(results.sort(), [201, 409]);
      await f.run('race-cold');
    } finally { await f.cleanup(); }
  });
  test('a real source ACL change between authorization and consumer CAS fences the old candidate and its original retry', { timeout: 180000 }, async () => {
    const f = isolated('source-ACL-race');
    try {
      await f.run('prepare-race'); const pending = f.run('revoke-race', { REFERENCE_HTTP_ACTOR: 'one' }); pending.catch(() => {});
      await waitFor(() => fs.existsSync(path.join(f.folder, 'ready-one')), 'authorized consumer candidate');
      await f.run('revoke-source'); fs.writeFileSync(path.join(f.folder, 'release'), 'release'); await pending; await f.run('revoke-cold');
    } finally { await f.cleanup(); }
  });
  test('actual Chats command-cache eviction cannot duplicate a file message or bypass current Files permission after cold restart', { timeout: 180000 }, async () => {
    const f = isolated('receipt-eviction'); try { await f.run('eviction'); await f.run('eviction-cold'); } finally { await f.cleanup(); }
  });
  test('a real identity initialization write failure returns 503 before registration and recovers in the same process with cold-preserved account and workspace', { timeout: 180000 }, async () => {
    const f = isolated('startup-outage'); try { await f.run('startup'); await f.run('startup-cold'); } finally { await f.cleanup(); }
  });
}
