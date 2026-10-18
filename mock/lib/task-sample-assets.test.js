const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), http = require('node:http');
const express = require('express');
const { prepare, ATTACHMENTS } = require('../apps/tasks/files');
const { createTaskSampleRouter, isTaskSampleRequest } = require('./task-sample-assets');

function request(server, method, url) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: server.address().port, method, path: url, agent: false }, res => {
      const chunks = []; res.on('data', value => chunks.push(value)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, bytes: Buffer.concat(chunks) }));
    }); req.on('error', reject); req.end();
  });
}
async function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orgtik-task-samples-')), folder = path.join(root, 'uploads', 'tasks');
  const users = Array.from({ length: 16 }, (_, index) => ({ id: index + 1, firstName: 'Fixture', lastName: 'Person' }));
  const files = prepare(folder, users); files.writeTeamLogos(Array.from({ length: 8 }, (_, index) => ({ id: index + 1, alias: 'OT' })));
  const app = express(); app.use(createTaskSampleRouter({ config: { dataDir: root } }));
  const server = http.createServer(app); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { root, folder, server, async close() {
    await new Promise(resolve => server.close(resolve));
    const resolved = fs.realpathSync(root), expected = path.resolve(os.tmpdir()) + path.sep;
    if (!resolved.startsWith(expected) || !path.basename(resolved).startsWith('orgtik-task-samples-')) throw new Error('Unsafe fixture cleanup.');
    fs.rmSync(resolved, { recursive: true, force: true });
  } };
}
test('Tasks public samples return byte-identical generated PDF/PNG/ZIP/text and only original fixture avatar/team IDs', async () => {
  const f = await fixture();
  try {
    const names = [...Object.values(ATTACHMENTS).map(asset => asset.file), 'seed-avatar-1.svg', 'seed-avatar-16.svg', 'seed-team-1.svg', 'seed-team-8.svg'];
    for (const name of names) {
      const response = await request(f.server, 'GET', '/uploads/' + name), source = fs.readFileSync(path.join(f.folder, name));
      assert.equal(response.status, 200); assert.deepEqual(response.bytes, source); assert.equal(Number(response.headers['content-length']), source.length);
      assert.equal(response.headers['x-content-type-options'], 'nosniff');
    }
    const head = await request(f.server, 'HEAD', '/uploads/seed-avatar-1.svg'); assert.equal(head.status, 200); assert.equal(head.bytes.length, 0); assert.ok(Number(head.headers['content-length']) > 0);
  } finally { await f.close(); }
});
test('Public asset classification denies metadata, unknown/dynamic files, encoded traversal and every mutation', () => {
  for (const url of ['/api/projects', '/api/users', '/uploads/customer-invoice.pdf', '/uploads/seed-avatar-17.svg', '/uploads/seed-team-9.svg', '/uploads/../identity.json', '/uploads/%2e%2e/identity.json', '/uploads/%2fseed-avatar-1.svg', '/uploads/seed-avatar-1.svg%2f..', '/uploads/%73eed-avatar-1.svg', '/uploads\\seed-avatar-1.svg', '/uploads//seed-avatar-1.svg']) assert.equal(isTaskSampleRequest({ method: 'GET', url }), false);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal(isTaskSampleRequest({ method, url: '/uploads/seed-avatar-1.svg' }), false);
  assert.equal(isTaskSampleRequest({ method: 'GET', url: '/uploads/seed-avatar-1.svg' }), true);
  assert.equal(isTaskSampleRequest({ method: 'HEAD', url: '/uploads/seed-team-8.svg' }), true);
});
test('Even files present in global uploads do not expose arbitrary bytes or authenticated metadata through this router', async () => {
  const f = await fixture();
  try {
    fs.writeFileSync(path.join(f.folder, 'customer-invoice.pdf'), 'private-customer-record');
    fs.writeFileSync(path.join(f.folder, 'seed-avatar-17.svg'), 'private-dynamic-person');
    for (const url of ['/uploads/customer-invoice.pdf', '/uploads/seed-avatar-17.svg', '/api/projects', '/api/users']) {
      const response = await request(f.server, 'GET', url); assert.equal(response.status, 404); assert.equal(response.bytes.includes('private-'), false);
    }
    const response = await request(f.server, 'POST', '/uploads/seed-avatar-1.svg'); assert.equal(response.status, 404);
  } finally { await f.close(); }
});
test('Known filenames cannot escape the configured sample folder through a filesystem link', async () => {
  const f = await fixture();
  try {
    const outside = path.join(f.root, 'outside'), name = 'seed-avatar-1.svg'; fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, name), 'private-outside-bytes');
    // A directory junction is permitted on Windows without developer-mode symlink rights.
    const moved = path.join(f.root, 'original-samples');
    assert.equal(path.relative(fs.realpathSync(f.root), fs.realpathSync(f.folder)), path.join('uploads', 'tasks'));
    assert.equal(path.relative(f.root, moved), 'original-samples');
    fs.renameSync(f.folder, moved);
    fs.mkdirSync(f.folder); fs.symlinkSync(outside, path.join(f.folder, name), 'junction');
    const response = await request(f.server, 'GET', '/uploads/' + name); assert.equal(response.status, 404); assert.equal(response.bytes.includes('private-outside-bytes'), false);
  } finally { await f.close(); }
});
test('A replaced sample-root junction cannot turn an outside directory into the public allowlist', async () => {
  const f = await fixture();
  try {
    const moved = path.join(f.root, 'original-samples'), outside = path.join(f.root, 'other-records');
    fs.mkdirSync(outside); fs.writeFileSync(path.join(outside, 'seed-avatar-1.svg'), 'outside-private-record');
    assert.equal(path.relative(fs.realpathSync(f.root), fs.realpathSync(f.folder)), path.join('uploads', 'tasks'));
    assert.equal(path.relative(f.root, moved), 'original-samples'); fs.renameSync(f.folder, moved);
    fs.symlinkSync(outside, f.folder, 'junction');
    const response = await request(f.server, 'GET', '/uploads/seed-avatar-1.svg');
    assert.equal(response.status, 404); assert.equal(response.bytes.includes('outside-private-record'), false);
  } finally { await f.close(); }
});
