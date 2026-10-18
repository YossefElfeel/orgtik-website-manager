const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runtime, harness, plain } = require('../apps/tasks/runtime-harness');
const manifest = require('../apps/files/assets/manifest.json');
const codec = require('../apps/files/runtime-state');
const safeKeys = ['workspaceId', 'fileId', 'versionId', 'name', 'mimetype', 'size', 'version'].sort();
function fixture(workspaceId, options = {}) {
  const roles = options.roles || { one: ['super_admin'], two: ['file_editor'] }, f = runtime('files', workspaceId, { ...options, roles });
  const current = { actorId: 1, readOnly: false, access: 'active' };
  f.identity.currentContext = () => ({ realm: 'isolated', workspace: { id: workspaceId }, member: { role: f.identity.findUser(current.actorId)?.userType === 'customer' ? 'guest' : 'member' }, actor: { effectiveUserId: current.actorId, readOnly: current.readOnly }, tools: { files: { access: current.access, canWrite: !current.readOnly && current.access === 'active', roles: roles[f.identity.findUser(current.actorId)?.key] || [] } } });
  f.identity.canWrite = user => current.actorId === user.id && !current.readOnly && current.access === 'active';
  return { ...f, roles, current };
}
const sample = (f, operationId = 'sample-one', parentId) => f.instance.createSample({ actorId: f.current.actorId, sampleId: 'pdf_company_profile', ...(parentId ? { parentId } : {}), operationId });
const unchangedRefusal = (f, fn, status) => {
  const before = plain(f.instance.exportSnapshot());
  assert.throws(fn, error => error.status === status);
  assert.deepEqual(plain(f.instance.exportSnapshot()), before);
};

test('empty workspace catalog is explicit, creation pins immutable version1 and picker has only safe metadata', () => {
  const f = fixture('ws_sample_empty');
  try {
    const before = plain(f.instance.exportSnapshot()), catalog = f.instance.sampleCatalog({ actorId: 1 });
    assert.ok(catalog.items.some(item => item.sampleId === 'pdf_company_profile'));
    assert.deepEqual(catalog.items.map(item => item.sampleId).sort().join(','), ['docx_runbook', 'jpg_mango', 'mp4_app_walkthrough', 'pdf_company_profile', 'png_app_checkout', 'png_app_home', 'png_dashboard_dark', 'txt_release_notes'].sort().join(','));
    assert.equal(catalog.canCreate, true); assert.deepEqual(plain(f.instance.exportSnapshot()), before);
    assert.deepEqual(plain(f.instance.listSharedFiles({ actorId: 1 }).items), []);
    const created = sample(f), row = f.instance.exportSnapshot().data.files[0][1];
    assert.equal(created.id, created.fileId); assert.equal(created.versionId, 'v1'); assert.equal(created.version, 1);
    assert.equal(row.currentVersionId, 'v1'); assert.equal(row.versions.length, 1); assert.equal(row.versions[0].storage.key, 'pdf_company_profile');
    const list = f.instance.listSharedFiles({ actorId: 1, search: 'profile', page: 1, limit: 10 });
    assert.deepEqual(plain(list.meta), { page: 1, limit: 10, total: 1, totalPages: 1 });
    assert.deepEqual(Object.keys(list.items[0]).sort(), safeKeys); assert.equal(list.items[0].fileId, created.id);
    const binary = f.instance.contentSharedFile({ actorId: 1, fileId: created.id, versionId: 'v1' });
    assert.deepEqual(fs.readFileSync(binary.path), fs.readFileSync(path.join(__dirname, '../apps/files/assets', manifest.pdf_company_profile.file)));
    assert.equal(list.items[0].size, manifest.pdf_company_profile.size);
    const completed = plain(f.instance.exportSnapshot()); assert.equal(sample(f).id, created.id); assert.deepEqual(plain(f.instance.exportSnapshot()), completed);
  } finally { f.close(); }
});

test('packaged recording sample pins real MP4 bytes and retains current Files write/refusal rules', () => {
  const f = fixture('ws_recording_sample');
  try {
    const created = f.instance.createSample({ actorId: 1, sampleId: 'mp4_app_walkthrough', operationId: 'recording-sample' });
    const metadata = f.instance.resolveSharedFile({ actorId: 1, fileId: created.id, versionId: 'v1' });
    assert.equal(metadata.mimetype, 'video/mp4'); assert.equal(metadata.size, manifest.mp4_app_walkthrough.size);
    const binary = f.instance.contentSharedFile({ actorId: 1, fileId: created.id, versionId: 'v1' });
    assert.deepEqual(fs.readFileSync(binary.path), fs.readFileSync(path.join(__dirname, '../apps/files/assets', manifest.mp4_app_walkthrough.file)));
    const before = plain(f.instance.exportSnapshot());
    f.current.readOnly = true;
    unchangedRefusal(f, () => f.instance.createSample({ actorId: 1, sampleId: 'mp4_app_walkthrough', operationId: 'readonly-recording' }), 423);
    assert.deepEqual(plain(f.instance.exportSnapshot()), before);
  } finally { f.close(); }
});

test('legacy fixtures expose stable implicit v1 without changing metadata or another workspace', () => {
  const first = fixture('ws_nile', { fixtureId: 'nile-v1' }), second = fixture('ws_other_empty');
  try {
    const before = plain(first.instance.exportSnapshot()), fileId = before.data.files[0][0];
    const one = first.instance.resolveSharedFile({ actorId: 1, fileId, versionId: 'v1' });
    assert.equal(one.workspaceId, 'ws_nile'); assert.equal(one.versionId, 'v1'); assert.deepEqual(plain(first.instance.exportSnapshot()), before);
    assert.throws(() => second.instance.resolveSharedFile({ actorId: 1, fileId, versionId: 'v1' }), { status: 404 });
    assert.deepEqual(plain(second.instance.listSharedFiles({ actorId: 1 }).items), []);
  } finally { first.close(); second.close(); }
});

test('same ACL authorizes inherited and explicit reader access, then immediately hides archived or revoked records', async () => {
  const f = fixture('ws_acl_samples', { roles: { one: ['file_editor'], two: ['file_editor'] } }), http = await harness([f]);
  try {
    const folder = await http.call(0, 'POST', '/api/v1/folders', { name: 'Private files', visibility: 'only_me' }); assert.equal(folder.status, 201);
    const created = sample(f, 'parent-sample', folder.json.data.id);
    f.current.actorId = 2;
    assert.deepEqual(plain(f.instance.listSharedFiles({ actorId: 2 }).items), []);
    assert.equal((await http.call(0, 'GET', `/api/v1/files/${created.id}`, undefined, { 'x-user': '2' })).status, 403);
    f.current.actorId = 1;
    assert.equal((await http.call(0, 'PATCH', `/api/v1/folders/${folder.json.data.id}`, { visibility: 'specific_people', allowedUserIds: [2] })).status, 200);
    f.current.actorId = 2;
    assert.equal(f.instance.resolveSharedFile({ actorId: 2, fileId: created.id, versionId: 'v1' }).fileId, created.id);
    assert.equal((await http.call(0, 'GET', `/api/v1/files/${created.id}`, undefined, { 'x-user': '2' })).status, 200);
    f.current.actorId = 1;
    assert.equal((await http.call(0, 'PATCH', `/api/v1/folders/${folder.json.data.id}`, { visibility: 'only_me', allowedUserIds: [] })).status, 200);
    assert.equal((await http.call(0, 'PUT', `/api/v1/files/${created.id}/access`, { visibility: 'specific_people', allowedUserIds: [2] })).status, 200);
    f.current.actorId = 2; assert.equal(f.instance.listSharedFiles({ actorId: 2 }).items.length, 1);
    f.current.actorId = 1; assert.equal((await http.call(0, 'PATCH', `/api/v1/files/${created.id}/archive`, {})).status, 200);
    assert.deepEqual(plain(f.instance.listSharedFiles({ actorId: 1 }).items), []);
    assert.throws(() => f.instance.resolveSharedFile({ actorId: 1, fileId: created.id, versionId: 'v1' }), { status: 404 });
  } finally { await http.close(); }
});

test('sample retries recheck current account, roles, read-only state and destination access before receipts', async () => {
  const f = fixture('ws_sample_retry', { roles: { one: ['file_editor'], two: ['file_editor'] } }), http = await harness([f]);
  try {
    const folder = await http.call(0, 'POST', '/api/v1/folders', { name: 'Shared destination', visibility: 'specific_people', allowedUserIds: [2] }); assert.equal(folder.status, 201);
    f.current.actorId = 2; const created = sample(f, 'recover-parent', folder.json.data.id); assert.ok(created.id);
    f.roles.two = ['file_viewer']; unchangedRefusal(f, () => sample(f, 'recover-parent', folder.json.data.id), 403);
    f.roles.two = ['file_editor']; f.identity.findUser(2).isActive = false; unchangedRefusal(f, () => sample(f, 'recover-parent', folder.json.data.id), 403);
    f.identity.findUser(2).isActive = true; f.current.access = 'read_only'; unchangedRefusal(f, () => sample(f, 'recover-parent', folder.json.data.id), 423);
    f.current.access = 'active'; f.current.actorId = 1;
    assert.equal((await http.call(0, 'PATCH', `/api/v1/folders/${folder.json.data.id}`, { visibility: 'only_me', allowedUserIds: [] })).status, 200);
    f.current.actorId = 2; unchangedRefusal(f, () => sample(f, 'recover-parent', folder.json.data.id), 403);
  } finally { await http.close(); }
});

test('sample routes reject missing references, extra byte fields and altered retries without phantom records', async () => {
  const f = fixture('ws_sample_routes'), http = await harness([f]);
  try {
    const catalog = await http.call(0, 'GET', '/api/v1/files/samples'); assert.equal(catalog.status, 200);
    const before = plain(f.instance.exportSnapshot());
    assert.equal((await http.call(0, 'POST', '/api/v1/files/samples', { sampleId: 'pdf_company_profile' })).status, 422);
    assert.equal((await http.call(0, 'POST', '/api/v1/files/samples', { sampleId: 'pdf_company_profile', file: 'unreviewed bytes' }, { 'idempotency-key': 'invalid' })).status, 422);
    assert.equal((await http.call(0, 'POST', '/api/v1/files/samples', { sampleId: '../../private' }, { 'idempotency-key': 'invalid' })).status, 422);
    assert.deepEqual(plain(f.instance.exportSnapshot()), before);
    const first = await http.call(0, 'POST', '/api/v1/files/samples', { sampleId: 'pdf_company_profile' }, { 'idempotency-key': 'route-attempt' }); assert.equal(first.status, 201);
    assert.equal((await http.call(0, 'POST', '/api/v1/files/samples', { sampleId: 'docx_runbook' }, { 'idempotency-key': 'route-attempt' })).status, 409);
    assert.equal(f.instance.exportSnapshot().data.files.length, 1);
  } finally { await http.close(); }
});

test('read-only Files permits existing references, while guests see only explicit permitted records', async () => {
  const users = [{ id: 1, key: 'one', firstName: 'One', lastName: 'Owner', userType: 'employee', isActive: true }, { id: 2, key: 'two', firstName: 'Guest', lastName: 'Viewer', userType: 'customer', isActive: true }];
  const f = fixture('ws_sample_guest', { users, roles: { one: ['file_editor'], two: ['file_guest'] } }), http = await harness([f]);
  try {
    const created = sample(f);
    assert.equal((await http.call(0, 'PUT', `/api/v1/files/${created.id}/access`, { visibility: 'everyone' })).status, 200);
    f.current.actorId = 2; assert.deepEqual(plain(f.instance.listSharedFiles({ actorId: 2 }).items), []); assert.equal(f.instance.sampleCatalog({ actorId: 2 }).canCreate, false);
    f.current.actorId = 1; assert.equal((await http.call(0, 'PUT', `/api/v1/files/${created.id}/access`, { visibility: 'specific_people', allowedUserIds: [2] })).status, 200);
    f.current.actorId = 2; f.current.access = 'read_only';
    assert.equal(f.instance.resolveSharedFile({ actorId: 2, fileId: created.id, versionId: 'v1' }).fileId, created.id);
    unchangedRefusal(f, () => sample(f, 'guest-no-create'), 423);
  } finally { await http.close(); }
});

test('modeled versions never silently replace a missing pinned version with current content', () => {
  const f = fixture('ws_version_model'); let snapshot;
  try { sample(f); snapshot = plain(f.instance.exportSnapshot()); }
  finally { f.close(); }
  const file = snapshot.data.files[0][1]; file.currentVersionId = 'v2'; file.storage = { kind: 'asset', key: 'png_app_home' };
  file.versions = [{ id: 'v2', number: 2, storage: { ...file.storage }, size: manifest.png_app_home.size, createdAt: file.createdAt }];
  const restored = fixture('ws_version_model', { snapshot });
  try {
    assert.throws(() => restored.instance.resolveSharedFile({ actorId: 1, fileId: file.id, versionId: 'v1' }), { status: 404, code: 'file_version_not_found' });
    assert.equal(restored.instance.resolveSharedFile({ actorId: 1, fileId: file.id, versionId: 'v2' }).mimetype, 'image/png');
  } finally { restored.close(); }
});

test('strict codec preserves valid sample receipts and rejects malformed immutable version models', () => {
  const f = fixture('ws_sample_codec'); let snapshot;
  try { sample(f); snapshot = plain(f.instance.exportSnapshot()); }
  finally { f.close(); }
  assert.deepEqual(codec.encode(codec.decode(snapshot.data, manifest)), snapshot.data);
  for (const change of [data => data.files[0][1].versions = [null], data => delete data.files[0][1].versions[0].storage, data => data.files[0][1].currentVersionId = 'missing', data => data.sampleOperations[0][1].fingerprint = 'invalid', data => data.sampleOperations[0][1].secret = 'forbidden']) {
    const invalid = structuredClone(snapshot.data); change(invalid); assert.throws(() => codec.decode(invalid, manifest), { status: 503, code: 'invalid_tool_snapshot' });
  }
});
