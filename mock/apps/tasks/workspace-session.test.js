const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ROOT = path.resolve(__dirname, '../../..');
const compiler = require(require.resolve('typescript', { paths: [path.join(ROOT, 'apps/tasks')] }));
const plain = value => JSON.parse(JSON.stringify(value));
function load(app, session, cookie) {
  const module = { exports: {} };
  const source = compiler.transpileModule(fs.readFileSync(path.join(ROOT, 'apps', app, 'lib/workspace-session.ts'), 'utf8'), { compilerOptions: { module: compiler.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, window: {}, require(name) {
    if (name === 'cookies-next') return { getCookie: () => cookie };
    if (name === '@/constants') return { TOKEN_COOKIE: 'hint' };
    if (name === '@orgtik/ui/auth') return { readClientSession: () => session, toolAccess: (context, tool) => ({ hasAccess: Boolean(context?.tools?.[tool] && !['no_access', 'not_subscribed'].includes(context.tools[tool].access)) }), SessionRequestError: class extends Error { constructor(status, code) { super(code); this.status = status; } } };
    throw new Error('Unexpected session helper dependency: ' + name);
  } }); return module.exports;
}
function envelope(tool, workspaceId = 'tab-a') { return { tokens: { accessToken: 'isolated-tab-token', refreshToken: 'isolated-refresh', expiresIn: 30 }, user: { id: 1, firstName: 'One' }, scopes: [{ scope: tool === 'tasks' ? 'task_manager' : 'file_manager', roles: ['viewer'] }], workspaceContext: { realm: 'test', workspace: { id: workspaceId }, actor: { effectiveUserId: 1, readOnly: false }, member: { revision: 2 }, tools: { [tool]: { roles: ['viewer'], access: 'active', canWrite: false } } } }; }
for (const tool of ['tasks', 'files']) {
  test(tool + ' tab session wins over another tab’s mutable cookie hint and preserves selected context', () => {
    const session = envelope(tool), helper = load(tool, session, JSON.stringify('different-workspace-token'));
    assert.equal(helper.candidateTokens().accessToken, 'isolated-tab-token');
    const auth = plain(helper.verifiedAuth(session)); assert.equal(auth.user.workspaceContext.workspace.id, 'tab-a'); assert.equal(auth.token, 'isolated-tab-token');
  });
  test(tool + ' cookie hint supplies credentials only; missing tool context or a mismatched person fails closed', () => {
    const helper = load(tool, null, JSON.stringify('unverified-cookie-token'));
    assert.deepEqual(plain(helper.candidateTokens()), { accessToken: 'unverified-cookie-token', refreshToken: '', expiresIn: 0 });
    assert.throws(() => helper.verifiedAuth({ ...envelope(tool), workspaceContext: null }), /tool_access_denied/);
    const other = envelope(tool); other.user.id = 2; assert.throws(() => helper.verifiedAuth(other), /tool_access_denied/);
  });
}
