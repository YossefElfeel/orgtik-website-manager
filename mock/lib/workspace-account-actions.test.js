const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), http = require('node:http');

test('personal account remains usable after leaving the last workspace', { timeout: 90000 }, async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'orgtik-account-v3-'));
  Object.assign(process.env, { MOCK_AUTH_FILE: path.join(folder, 'accounts.json'), MOCK_AUTH_STORE: 'file', MOCK_JOURNAL: 'memory', MOCK_SANDBOX: `account-v3-${process.pid}`, MOCK_PUBLIC_URL: '', VERCEL: '', KV_REST_API_URL: '', KV_REST_API_TOKEN: '', UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '', MOCK_CLOCK: 'frozen', MOCK_NOW: '2026-10-07T09:00:00Z' });
  process.argv.push('--only=sos,admin');
  const server = http.createServer(require('../api/index'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/sos`;
  async function call(endpoint, token, method = 'GET', body) {
    const response = await fetch(base + endpoint, { method, signal: AbortSignal.timeout(20000), headers: { connection: 'close', ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const raw = await response.json(); return { status: response.status, data: raw.data ?? raw, raw };
  }
  const good = value => { assert.ok(value.status < 300, JSON.stringify(value.raw)); return value.data; };
  try {
    assert.equal((await call('/api/auth/account')).status, 401);
    const account = good(await call('/api/auth/register', null, 'POST', { email: 'last-workspace@account-v3.test', name: 'Account Owner', password: 'StrongFixture!' }));
    const initial = account.tokens.accessToken, S = require('../apps/admin').getStore(), ws = S.workspace(account.workspaceContext.workspace.id);
    assert.equal(good(await call('/api/auth/account', initial)).workspaces.length, 1);
    assert.equal((await call('/api/suite/account/actions/membership.leave', initial, 'POST', {})).status, 409);
    assert.equal((await call('/api/auth/account/actions/person.delete', initial, 'POST', { confirm: account.user.email, password: 'StrongFixture!' })).status, 409);
    const peer = require('./identity').users.find(person => person.isActive === true && person.id !== account.user.id && person.email !== 'mona.adel@orgtik.test'), membership = { id: `member:${ws.id}:${peer.key}`, userKey: peer.key, role: 'member', status: 'active', revision: 1, accessEpoch: 0, toolGrants: {} };
    S.workspace(ws.id).members.push(membership); S.workspace(ws.id).suite = { account: { customRoles: [{ id: 'reviewer', name: 'Reviewer', baseRole: 'member' }] } };
    good(await call('/api/suite/account/actions/member.role', initial, 'POST', { memberId: membership.id, customRoleId: 'reviewer' }));
    assert.equal(good(await call('/v1/app/team', initial)).find(row => row.id === membership.id).customRoleId, 'reviewer');
    good(await call('/api/suite/account/actions/member.status', initial, 'POST', { memberId: membership.id, status: 'suspended' }));
    assert.equal(S.workspace(ws.id).members.find(row => row.id === membership.id).status, 'suspended');
    good(await call('/api/suite/account/actions/member.status', initial, 'POST', { memberId: membership.id, status: 'active' }));
    assert.equal(S.workspace(ws.id).members.find(row => row.id === membership.id).status, 'active');
    const staff = good(await call('/api/auth/login', null, 'POST', { email: 'mona.adel@orgtik.test', password: 'Local@2026', mode: 'staff', target: 'admin' }));
    const viewed = good(await call(`/api/auth/login-as/${account.user.id}`, staff.tokens.accessToken, 'POST', { workspaceId: ws.id }));
    assert.equal(viewed.workspaceContext.actor.readOnly, true);
    const audit = good(await call('/api/auth/account/audit', initial));
    assert.ok(audit.some(row => row.action === 'view_as_started' && row.actorUserId === staff.user.id && row.effectiveUserId === account.user.id && row.workspaceId === ws.id));
    assert.equal((await call('/api/auth/account/actions/workspace.create', viewed.tokens.accessToken, 'POST', { name: 'Denied preview workspace' })).status, 423);
    const returned = good(await call('/api/auth/exit-impersonation', viewed.tokens.accessToken, 'POST', {}));
    assert.equal(returned.workspaceContext, null); assert.ok(returned.staffAccess.apps.includes('admin'));
    assert.ok(good(await call('/api/auth/account/audit', initial)).some(row => row.action === 'view_as_ended' && row.actorUserId === staff.user.id && row.effectiveUserId === account.user.id));
    // Fixture membership is a member of its sole workspace; the actual HTTP leave rotates context.
    S.workspace(ws.id).members[0].role = 'member';
    const left = good(await call('/api/suite/account/actions/membership.leave', initial, 'POST', {}));
    assert.equal(left.workspaceId, null); assert.equal(left.session.workspaceContext, null);
    const token = left.session.tokens.accessToken;
    const identity = good(await call('/api/auth/account', token)); assert.equal(identity.workspaceId, null); assert.deepEqual(identity.workspaces, []);
    const sessions = good(await call('/api/auth/account/sessions', token)); assert.ok(sessions.some(row => row.current)); assert.ok(sessions.every(row => !Object.hasOwn(row, 'token') && !Object.hasOwn(row, 'accessToken')));
    assert.equal((await call('/api/auth/account/actions/member.status', token, 'POST', {})).status, 422);
    const created = good(await call('/api/auth/account/actions/workspace.create', token, 'POST', { name: 'Second Workspace', country: 'CH' }));
    assert.equal(S.workspace(created.workspaceId).members[0].role, 'owner'); assert.equal(good(await call('/api/auth/account', token)).workspaces[0].id, created.workspaceId);
    assert.equal((await call('/api/auth/account/actions/person.delete', token, 'POST', { confirm: account.user.email, password: 'incorrect' })).status, 422);
    S.workspace(created.workspaceId).state = 'deleted';
    const deleted = good(await call('/api/auth/account/actions/person.delete', token, 'POST', { confirm: account.user.email, password: 'StrongFixture!' }));
    assert.equal(deleted.state, 'deleted'); assert.equal(deleted.sessionAction, 'signed_out');
    assert.equal((await call('/api/auth/account', token)).status, 401);
  } finally { await new Promise(resolve => server.close(resolve)); fs.rmSync(folder, { recursive: true, force: true }); }
});
