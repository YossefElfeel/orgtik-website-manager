// Actual UI handler/transport source in isolated VMs. No API, browser, business data or clock.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const repo = path.resolve(__dirname, '../..');
const ts = require(require.resolve('typescript', { paths: [path.join(repo, 'apps/chats')] }));
const plain = value => JSON.parse(JSON.stringify(value));
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const settle = async () => { for (let i = 0; i < 4; i++) await new Promise(setImmediate); };

function handlerSource(filename, componentName, handlerName) {
  const source = ts.createSourceFile(filename, fs.readFileSync(path.join(repo, filename), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const component = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === componentName);
  assert.ok(component?.body, 'The actual component function must exist: ' + componentName);
  let initializer;
  for (const statement of component.body.statements) if (ts.isVariableStatement(statement)) {
    const declaration = statement.declarationList.declarations.find(node => ts.isIdentifier(node.name) && node.name.text === handlerName);
    if (declaration) initializer = declaration.initializer;
  }
  assert.ok(initializer && ts.isArrowFunction(initializer), 'The actual async handler must exist: ' + handlerName);
  return initializer.getText(source);
}

function handlerHarness(app) {
  const tasks = app === 'tasks';
  const handler = tasks
    ? handlerSource('apps/tasks/components/task/TaskAttachments.tsx', 'TaskAttachments', 'execute')
    : handlerSource('apps/files/components/dialogs/FileUpload/index.tsx', 'FileUploadDialog', 'create');
  const writes = [], committed = new Map(); let mode = 'lost', issue;
  class FileRequestError extends Error { constructor(code, status = 0, uncertain = false) { super(code); Object.assign(this, { code, status, uncertain }); } }
  const original = { key: 'isolated-original-attempt', scope: 'fixture-scope', path: tasks ? '/api/tasks/1/attachments' : '/api/v1/files/samples', method: 'POST', body: tasks ? { references: [{ workspaceId: 'fixture', fileId: 'f1', versionId: 'v1' }] } : { sampleId: 'pdf_company_profile' } };
  const module = { exports: {} };
  // Mock only captured React state, transport and presentation callbacks. Recovery logic
  // is the AST-selected current handler, not a test implementation of its algorithm.
  const source = `let attempt = null; const data = { canCreate: true }, busy = false, selected = 'pdf_company_profile', folderId = undefined;
    const keep = a => { attempt = a; }, keepAttempt = keep;
    const setBusy = noop, setPicker = noop, setRemoving = noop, setRevision = noop, setSelected = noop, setOwnOpen = noop, onOpenChange = noop, onUpload = noop;
    const baseApi = { util: { invalidateTags: noop } }, taskApi = baseApi, dispatch = noop;
    const invoke = ${handler}; exports.invoke = invoke; exports.peek = () => attempt;`;
  vm.runInNewContext(compile(source), {
    module, exports: module.exports, noop() {}, setIssue(value) { issue = value; }, fileAuthority: () => 'unchanged-authority', newFileAttempt: () => plain(original), FileRequestError,
    async fileRequest(_path, options) {
      writes.push(plain(options.attempt));
      if (mode === 'refused') throw new FileRequestError('access_denied', 403, false);
      committed.set(options.attempt.key, { id: 'committed-once' });
      if (mode === 'lost') throw new FileRequestError('transport_unavailable', 0, true);
      return committed.get(options.attempt.key);
    },
  });
  return { writes, committed, get issue() { return issue; }, mode(value) { mode = value; }, peek: module.exports.peek,
    invoke: () => module.exports.invoke(tasks ? module.exports.peek() || plain(original) : undefined), original };
}

for (const app of ['files', 'tasks']) {
  test(`${app} actual handler keeps a lost committed request through later403 and recovers its original record`, async () => {
    const f = handlerHarness(app);
    await f.invoke(); assert.equal(f.peek().uncertain, true);
    const original = plain(f.peek());
    f.mode('refused'); await f.invoke();
    assert.deepEqual(plain(f.peek()), original); assert.equal(f.issue, 'uncertain');
    f.mode('available'); await f.invoke(); assert.equal(f.peek(), null);
    assert.equal(f.committed.size, 1); assert.equal(f.writes.length, 3);
    assert.ok(f.writes.every(row => row.key === original.key && JSON.stringify(row.body) === JSON.stringify(original.body)));
  });
  test(`${app} actual handler clears a new definitive403 without inventing a record`, async () => {
    const f = handlerHarness(app); f.mode('refused'); await f.invoke();
    assert.equal(f.peek(), null); assert.equal(f.issue, 'noAccessBody'); assert.equal(f.committed.size, 0); assert.equal(f.writes.length, 1);
  });
}

function chatHarness() {
  const storage = new Map(), writes = [], committed = new Map(), effects = []; let mode = 'lost-then-refused';
  const current = { tokens: { accessToken: 'isolated-vm-placeholder' }, workspaceContext: { realm: 'fixture', workspace: { id: 'fixture' }, actor: { userId: 1, effectiveUserId: 1, readOnly: false }, member: { id: 'm1', role: 'owner', revision: 1, accessEpoch: 0 }, tools: { chat: { access: 'active', roles: ['owner'], canWrite: true }, files: { access: 'active', roles: ['file_editor'], canWrite: true } } } };
  const data = (revision = 0) => ({ workspaceId: 'fixture', me: '1', dataRevision: revision, access: { canWrite: true, readOnly: false }, users: [{ id: '1' }], historicalUsers: [], floor: { rooms: [] }, channels: [], messages: revision ? [{ id: 'm-proof' }] : [] });
  const response = (payload, status = 200) => ({ ok: status < 400, status, json: async () => status < 400 ? { success: true, data: payload } : { success: false, code: payload } });
  function load() {
    const module = { exports: {} };
    const apiModule = { exports: {} };
    vm.runInNewContext(compile(fs.readFileSync(path.join(repo, 'apps/chats/lib/api-url.ts'), 'utf8')), { module: apiModule, exports: apiModule.exports, URL, process: { env: { NEXT_PUBLIC_API_URL: 'http://isolated.fixture/chats' } } });
    vm.runInNewContext(compile(fs.readFileSync(path.join(repo, 'apps/chats/store/platform.ts'), 'utf8')), {
      module, exports: module.exports, crypto: crypto.webcrypto, process: { env: { NEXT_PUBLIC_API_URL: 'http://isolated.fixture/chats' } }, window: { setInterval() { return 1; }, clearInterval() {} }, sessionStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
      require(name) { if (name === '@/lib/api-url') return apiModule.exports; assert.equal(name, '@orgtik/ui/auth'); return { readClientSession: () => current, refreshClientSession: async () => current, subscribeClientSession: () => () => {} }; },
      async fetch(_url, options) {
        if (options.method === 'GET') return response(data());
        writes.push(plain(options)); const key = options.headers['Idempotency-Key'];
        if (mode === 'refused' || mode === 'lost-then-refused' && writes.length > 1) return response('access_denied', 403);
        committed.set(key, data(1));
        if (mode === 'lost-then-refused') throw new Error('Isolated lost successful response');
        return response(committed.get(key));
      },
    });
    const transport = module.exports, close = transport.startWorkspacePlatform({ clear: state => effects.push(plain(state)), status: state => effects.push(plain(state)), hydrate: (_data, state) => effects.push(plain(state)) });
    return { transport, close };
  }
  return { load, storage, writes, committed, effects, mode(value) { mode = value; } };
}

test('Chats actual transport retains a lost success through automatic403 and cold reload, then recovers one message', async () => {
  const f = chatHarness(), first = f.load(); let second;
  try {
    await settle();
    const event = { type: 'message.created', message: { id: 'm-proof', channelId: 'c1', text: 'One committed message', attachments: [] } };
    assert.equal(await first.transport.persistEvent(event), false);
    assert.equal(f.writes.length, 2); assert.ok(first.transport.recoverableMessage('c1'));
    first.close(); second = f.load(); await settle();
    assert.ok(second.transport.recoverableMessage('c1')); f.mode('available');
    assert.equal(await second.transport.persistEvent({ type: 'message.created', message: second.transport.recoverableMessage('c1') }), true);
    assert.equal(f.committed.size, 1); assert.equal(new Set(f.writes.map(row => row.headers['Idempotency-Key'])).size, 1); assert.equal(new Set(f.writes.map(row => row.body)).size, 1);
    assert.equal(second.transport.recoverableMessage('c1'), null);
  } finally { (second || first).close(); }
});

test('Chats actual transport clears a new definitive403 without inventing a message', async () => {
  const f = chatHarness(); f.mode('refused'); const runtime = f.load();
  try {
    await settle();
    assert.equal(await runtime.transport.persistEvent({ type: 'message.created', message: { id: 'm-new', channelId: 'c1', text: 'Refused' } }), false);
    assert.equal(runtime.transport.recoverableMessage('c1'), null); assert.equal(f.committed.size, 0); assert.equal(f.writes.length, 1);
  } finally { runtime.close(); }
});
