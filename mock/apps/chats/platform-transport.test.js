const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const compiler = require(require.resolve('typescript', { paths: [path.resolve(__dirname, '../../../apps/chats')] }));
const file = path.resolve(__dirname, '../../../apps/chats/store/platform.ts');
const plain = value => JSON.parse(JSON.stringify(value));
const settle = async () => { for (let index = 0; index < 4; index++) await new Promise(setImmediate); };
function session(workspaceId = 'a', role = 'owner') {
  return { tokens: { accessToken: 'unit-only-token' }, workspaceContext: { realm: 'test', workspace: { id: workspaceId }, actor: { effectiveUserId: 1, readOnly: false }, member: { revision: 1 }, tools: { chat: { access: 'active', canWrite: true, roles: [role] } } } };
}
function data(workspaceId, revision = 0, messages = []) {
  return { workspaceId, me: '1', dataRevision: revision, access: { canWrite: true, readOnly: false, roles: ['owner'] }, users: [{ id: '1' }], historicalUsers: [], floor: { rooms: [] }, channels: [], messages };
}
const response = (value, status = 200) => ({ ok: status < 400, status, json: async () => status < 400 ? { success: true, data: value } : { success: false, code: value } });
function load(fetch, initial = session(), storage = new Map(), env = { NEXT_PUBLIC_API_URL: 'http://fixture.test/chats' }) {
  let current = initial;
  const listeners = new Set(), module = { exports: {} }, effects = [];
  const source = compiler.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: compiler.ModuleKind.CommonJS, target: compiler.ScriptTarget.ES2022 } }).outputText;
  const apiModule = { exports: {} };
  const apiSource = compiler.transpileModule(fs.readFileSync(path.resolve(__dirname, '../../../apps/chats/lib/api-url.ts'), 'utf8'), { compilerOptions: { module: compiler.ModuleKind.CommonJS, target: compiler.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(apiSource, { module: apiModule, exports: apiModule.exports, URL, process: { env } });
  vm.runInNewContext(source, { module, exports: module.exports, process: { env }, crypto: crypto.webcrypto, fetch, sessionStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) }, window: { setInterval() { return 1; }, clearInterval() {} }, require(name) { if (name === '@/lib/api-url') return apiModule.exports; if (name !== '@orgtik/ui/auth') throw new Error('Unexpected runtime import: ' + name); return { readClientSession: () => current, refreshClientSession: async () => current, subscribeClientSession(listener) { listeners.add(listener); return () => listeners.delete(listener); } }; } });
  const transport = module.exports, close = transport.startWorkspacePlatform({ clear: state => effects.push({ clear: plain(state) }), status: state => effects.push({ status: plain(state) }), hydrate: (data, state) => effects.push({ data: plain(data), status: plain(state) }) });
  return { transport, effects, close, switch(next) { current = next; for (const listener of listeners) listener(); } };
}

test('Chats loads and saves through its namespace when an older hosted project only configured SOS', async () => {
  const requests = [];
  const runtime = load(async (url, options) => {
    requests.push({ url, options });
    return response(data('a', options.method === 'POST' ? 1 : 0));
  }, session(), new Map(), { NEXT_PUBLIC_SOS_API_URL: 'https://mock.fixture.test/sos/api' });
  try {
    await settle();
    assert.equal(runtime.effects.at(-1).status.status, 'ready');
    assert.equal(await runtime.transport.persistEvent({ type: 'message.created', message: { channelId: 'chat', text: 'Saved' } }), true);
    assert.deepEqual(requests.map(row => row.url), ['https://mock.fixture.test/chats/api/hq/bootstrap', 'https://mock.fixture.test/chats/api/hq/commands']);
    for (const { options } of requests) {
      assert.equal(options.headers.Authorization, 'Bearer unit-only-token');
      assert.equal(options.headers['X-Workspace'], 'a');
    }
  } finally { runtime.close(); }
});

test('Chats transport retries a lost command response with one operation ID and hydrates only committed data', async () => {
  const requests = [], commits = new Map(); let loss = true;
  const runtime = load(async (_url, options) => {
    requests.push(options);
    if (options.method === 'GET') return response(data('a'));
    const id = options.headers['Idempotency-Key'];
    if (!commits.has(id)) commits.set(id, data('a', 1, [{ id: 'm-unit', text: 'Saved once' }]));
    if (loss) { loss = false; throw new Error('Socket closed after commit'); }
    return response(commits.get(id));
  });
  try {
    await settle(); runtime.transport.persistEvent({ type: 'message.created', message: { channelId: 'c', text: 'Saved once' } }); await settle();
    const writes = requests.filter(request => request.method === 'POST'); assert.equal(writes.length, 2); assert.equal(writes[0].headers['Idempotency-Key'], writes[1].headers['Idempotency-Key']);
    assert.equal(writes[0].body, writes[1].body); assert.equal(writes[0].headers['X-Workspace'], 'a'); assert.equal(commits.size, 1);
    assert.equal(runtime.effects.filter(effect => effect.data?.dataRevision === 1).length, 1);
    assert.equal(runtime.effects.at(-1).status.pending, 0);
  } finally { runtime.close(); }
});

test('Chats dispatches a queued command with the current token after same-context rotation', async () => {
  const writes = []; let completeFirst;
  const runtime = load(async (_url, options) => {
    if (options.method === 'GET') return response(data('a'));
    writes.push(options);
    return writes.length === 1 ? new Promise(resolve => { completeFirst = resolve; }) : response(data('a', 2));
  });
  try {
    await settle();
    const first = runtime.transport.persistEvent({ type: 'message.created', message: { id: 'm-a', channelId: 'c', text: 'First' } });
    const second = runtime.transport.persistEvent({ type: 'message.created', message: { id: 'm-b', channelId: 'c', text: 'Queued original' } });
    await settle();
    const rotated = session(); rotated.tokens.accessToken = 'unit-only-rotated';
    runtime.switch(rotated); await settle();
    completeFirst(response(data('a', 1))); assert.equal(await first, true); assert.equal(await second, true);
    assert.equal(writes.length, 2);
    assert.equal(writes[1].headers.Authorization, 'Bearer unit-only-rotated');
    assert.equal(writes[1].headers['X-Workspace'], 'a');
    assert.equal(JSON.parse(writes[1].body).event.message.text, 'Queued original');
    assert.equal(runtime.effects.at(-1).status.status, 'ready');
  } finally { runtime.close(); }
});

test('Chats keeps one command through repeated 503, a cold reload, and canonical reference serialization', async () => {
  const storage = new Map(), writes = [], committed = new Map(); let available = false;
  const fetch = async (_url, options) => {
    if (options.method === 'GET') return response(data('a'));
    writes.push(options);
    const key = options.headers['Idempotency-Key'];
    if (!committed.has(key)) committed.set(key, data('a', 1, [{ id: 'm-ref', text: 'Original draft' }]));
    return available ? response(committed.get(key)) : response('persistence_unavailable', 503);
  };
  const event = { type: 'message.created', message: { id: 'm-ref', channelId: 'c', text: 'Original draft', attachments: [{ id: 'display-only', name: 'Never sent', size: 'not authoritative', kind: 'pdf', reference: { workspaceId: 'a', fileId: 'f-1', versionId: 'v1' } }] } };
  const first = load(fetch, session(), storage);
  await settle();
  assert.equal(await first.transport.persistEvent(event), false);
  assert.equal(first.effects.at(-1).status.uncertain, true);
  const firstKey = writes[0].headers['Idempotency-Key'];
  assert.deepEqual(JSON.parse(writes[0].body).event.message.attachments, [{ workspaceId: 'a', fileId: 'f-1', versionId: 'v1' }]);
  first.close();
  const second = load(fetch, session(), storage);
  try {
    await settle();
    const recovered = second.transport.recoverableMessage('c');
    assert.equal(recovered.text, 'Original draft');
    assert.equal(recovered.attachments[0].name, '');
    available = true;
    assert.equal(await second.transport.persistEvent({ type: 'message.created', message: recovered }), true);
    assert.equal(writes.at(-1).headers['Idempotency-Key'], firstKey);
    assert.equal(writes.at(-1).body, writes[0].body);
    assert.equal(committed.size, 1);
    assert.equal(second.transport.recoverableMessage('c'), null);
    second.switch(session('b'));
    assert.equal(second.transport.recoverableMessage('c'), null);
  } finally { second.close(); }
});

test('Chats treats a malformed successful command response as uncertain and retains its operation', async () => {
  const writes = []; let valid = false;
  const runtime = load(async (_url, options) => {
    if (options.method === 'GET') return response(data('a'));
    writes.push(options);
    return response(valid ? data('a', 1) : { workspaceId: 'a' });
  });
  try {
    await settle(); const event = { type: 'message.created', message: { id: 'm-bad', channelId: 'c', text: 'Keep this draft' } };
    assert.equal(await runtime.transport.persistEvent(event), false);
    assert.equal(runtime.effects.at(-1).status.uncertain, true);
    valid = true; assert.equal(await runtime.transport.persistEvent(event), true);
    assert.equal(writes.length, 3);
    assert.equal(new Set(writes.map(write => write.headers['Idempotency-Key'])).size, 1);
    assert.deepEqual(JSON.parse(writes[0].body).event.message.attachments, []);
  } finally { runtime.close(); }
});

test('Chats discards a delayed private projection after Files permission or member epoch changes', async () => {
  let finish;
  const runtime = load(async () => new Promise(resolve => { finish = resolve; }));
  try {
    await settle();
    const original = finish;
    const next = session(); next.workspaceContext.member.accessEpoch = 2; next.workspaceContext.tools.files = { access: 'no_access', canWrite: false, roles: [] };
    runtime.switch(next); await settle();
    original(response(data('a', 12, [{ id: 'old-private-file', attachments: [{ name: 'Private name' }] }]))); await settle();
    assert.equal(runtime.effects.some(effect => effect.data?.dataRevision === 12), false);
  } finally { runtime.close(); }
});

test('Chats clears before switching workspace and ignores a delayed old-workspace response', async () => {
  let finishOld;
  const runtime = load(async (_url, options) => options.headers['X-Workspace'] === 'a' ? new Promise(resolve => { finishOld = resolve; }) : response(data('b', 0)));
  try {
    await settle(); runtime.switch(session('b')); assert.equal(runtime.effects.at(-1).clear.namespace.includes(':b:'), true); await settle();
    finishOld(response(data('a', 10, [{ id: 'private-a' }]))); await settle();
    assert.equal(runtime.effects.filter(effect => effect.data?.workspaceId === 'a').length, 0);
    assert.equal(runtime.effects.at(-1).data.workspaceId, 'b');
  } finally { runtime.close(); }
});

test('Chats storage/transport failures show failure without inventing a saved message', async () => {
  const runtime = load(async (_url, options) => options.method === 'GET' ? response(data('a')) : response('persistence_unavailable', 503));
  try {
    await settle(); runtime.transport.persistEvent({ type: 'message.created', message: { text: 'Not committed' } }); await settle();
    assert.equal(runtime.effects.at(-1).status.status, 'error'); assert.equal(runtime.effects.at(-1).status.errorCode, 'persistence_unavailable');
    assert.equal(runtime.effects.filter(effect => effect.data).length, 1);
    assert.deepEqual(runtime.effects.find(effect => effect.data).data.messages, []);
  } finally { runtime.close(); }
});

test('Chats guest or revoked context clears the directory and never falls back to seeded data', async () => {
  let calls = 0;
  const runtime = load(async () => { calls++; return response(data('a')); }, session('a', 'guest'));
  try {
    await settle(); assert.equal(calls, 0); assert.equal(runtime.effects.at(-1).clear.status, 'no_access');
    runtime.switch(session()); await settle(); assert.equal(calls, 1);
    runtime.switch(null); await settle(); assert.equal(runtime.effects.at(-1).clear.status, 'no_access');
  } finally { runtime.close(); }
});
