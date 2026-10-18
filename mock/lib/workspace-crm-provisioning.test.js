const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), http = require('node:http');
test('an actual won CRM project provisions an empty workspace owned by its registered customer once', { timeout: 90000 }, async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'orgtik-provision-v3-'));
  Object.assign(process.env, { MOCK_AUTH_FILE: path.join(folder, 'accounts.json'), MOCK_AUTH_STORE: 'file', MOCK_JOURNAL: 'memory', MOCK_SANDBOX: `provision-v3-${process.pid}`, MOCK_PUBLIC_URL: '', VERCEL: '', KV_REST_API_URL: '', KV_REST_API_TOKEN: '', UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '', MOCK_CLOCK: 'frozen', MOCK_NOW: '2026-10-07T09:00:00Z' });
  process.argv.push('--only=sos,admin,sales');
  const server = http.createServer(require('../api/index')); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function call(app, endpoint, token, method = 'GET', body) {
    const response = await fetch(`${base}/${app}${endpoint}`, { method, signal: AbortSignal.timeout(20000), headers: { connection: 'close', ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const raw = await response.json(); return { status: response.status, data: raw.data ?? raw, raw };
  }
  const good = value => { assert.ok(value.status < 300, JSON.stringify(value.raw)); return value.data; };
  try {
    const owner = good(await call('sos', '/api/auth/login', null, 'POST', { email: 'mona.adel@orgtik.test', password: 'Local@2026', mode: 'workspace', workspaceId: 'ws_orgtik', target: 'sales' })), token = owner.tokens.accessToken;
    const projects = good(await call('sales', '/api/projects?limit=100', token)).items;
    let candidate;
    for (const project of projects.filter(row => ['confirmed', 'approved', 'in_progress', 'testing', 'completed'].includes(row.status))) {
      const current = good(await call('sales', `/api/suite/crm/projects/${project.id}/provisioning`, token));
      if (current.won && current.customer && !require('./identity').findByEmail(current.customer.email)) { candidate = current; break; }
    }
    assert.ok(candidate, 'The retained fixture has an actual approved customer contract without a shared account.');
    const S = require('../apps/admin').getStore(), before = S.db.workspaces.length, invoices = JSON.stringify(S.db.invoices);
    const path = `/api/suite/crm/projects/${candidate.projectId}/provision`, body = { name: 'Confirmed customer workspace', country: 'CH', operationId: 'won-provision-fixture' };
    assert.equal(good(await call('sales', path, token, 'POST', body)).state, 'awaiting_owner_signup'); assert.equal(S.db.workspaces.length, before);
    const customer = good(await call('sos', '/api/auth/register', null, 'POST', { email: candidate.customer.email, name: candidate.customer.name, password: 'StrongFixture!' }));
    const receipt = good(await call('sales', path, token, 'POST', body)); assert.equal(receipt.state, 'provisioned'); assert.equal(receipt.ownerUserId, customer.user.id);
    const workspace = S.workspace(receipt.workspaceId); assert.equal(workspace.initialization.kind, 'empty'); assert.equal(workspace.members[0].userKey, require('./identity').findUser(customer.user.id).key); assert.equal(workspace.members[0].role, 'owner');
    assert.equal(JSON.stringify(S.db.invoices), invoices); assert.equal(workspace.lines.every(row => row.state === 'free'), true);
    assert.equal(good(await call('sales', path, token, 'POST', body)).workspaceId, receipt.workspaceId); assert.equal(S.db.workspaces.length, before + 2);
    assert.equal((await call('sales', path, token, 'POST', { ...body, name: 'Changed receipt' })).status, 409);
    const selected = good(await call('sos', '/api/auth/workspace', customer.tokens.accessToken, 'POST', { workspaceId: receipt.workspaceId, target: 'suite' }));
    assert.equal(selected.workspaceContext.member.role, 'owner'); assert.equal(selected.workspaceContext.workspace.id, receipt.workspaceId);
    assert.equal((await call('sos', path, selected.tokens.accessToken, 'POST', body)).status, 403);
  } finally { await new Promise(resolve => server.close(resolve)); fs.rmSync(folder, { recursive: true, force: true }); }
});
