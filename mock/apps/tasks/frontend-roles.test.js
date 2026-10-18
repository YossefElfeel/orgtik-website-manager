const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '../../..');
let compiler;
try { compiler = require(require.resolve('typescript', { paths: [path.join(ROOT, 'apps/tasks'), path.join(ROOT, 'packages/ui')] })); }
catch { const version = require(path.join(ROOT, 'packages/ui/package.json')).devDependencies.typescript; compiler = require(path.join(ROOT, 'node_modules/.pnpm', 'typescript@' + version, 'node_modules/typescript')); }
function load(file) {
  const module = { exports: {} };
  const source = compiler.transpileModule(fs.readFileSync(path.join(ROOT, file), 'utf8'), { compilerOptions: { module: compiler.ModuleKind.CommonJS, target: compiler.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { exports: module.exports, module, require() { throw new Error('Pure role helpers must not load mutable app state.'); } });
  return module.exports;
}
const tasks = load('apps/tasks/lib/roles.ts');
const files = load('apps/files/lib/session-access.ts');
const permissions = load('apps/files/lib/permissions.ts');

test('Tasks frontend ignores privileged global and other-tool scopes', () => {
  const grant = tasks.permissionsFor([{ scope: 'global', roles: ['super_admin'] }, { scope: 'hr_system', roles: ['super_admin'] }, { scope: 'task_manager', roles: ['viewer'] }]);
  assert.equal(grant.isAdmin, false); assert.equal(grant.isManager, false); assert.equal(grant.isViewerOnly, true);
});

test('Files frontend never promotes canonical userType or flattened cross-tool roles', () => {
  const grant = files.fileSessionAccess({ id: 1, userType: 'admin', roles: ['super_admin'], scopes: [{ scope: 'hr_system', roles: ['super_admin'] }, { scope: 'file_manager', roles: ['file_guest'] }] });
  assert.equal(grant.isAdmin, false); assert.equal(grant.canWrite, false);
});

test('Files current workspace context overrides old scopes and denies stale write capabilities', () => {
  const grant = files.fileSessionAccess({ id: 1, scopes: [{ scope: 'file_manager', roles: ['super_admin'] }], workspaceContext: { tools: { files: { roles: ['super_admin'], access: 'read_only', canWrite: false } } } });
  assert.equal(grant.canWrite, false);
  assert.equal(permissions.canWriteResource({ ownerId: 1, capabilities: { canWrite: true } }, grant), false);
  assert.equal(permissions.canUploadIntoFolder(null, grant), false);
  const absent = files.fileSessionAccess({ id: 1, scopes: [{ scope: 'file_manager', roles: ['super_admin'] }], workspaceContext: { tools: {} } });
  assert.equal(absent.isAdmin, false); assert.equal(absent.canWrite, false);
});
