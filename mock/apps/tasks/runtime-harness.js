// Isolated adapter tests only; authority/session validation belongs to the server suite.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const express = require('express');
const util = require('../../lib/util');
const { createPrivateModuleGraph } = require('../../lib/private-module-graph');
const manifest = require('../../lib/workspace-runtime-manifest.json');
const fixed = Date.parse('2026-10-07T09:00:00Z');
class BusinessDate extends Date { constructor(...args) { super(...(args.length ? args : [fixed])); } static now() { return fixed; } }

function runtime(appKey, workspaceId, { snapshot, fixtureId, roles, users, writable = true, commands, sharedFiles, boardAuthority, filesPolicy, apiOrigin = 'http://fixture.test' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orgtik-tools-runtime-'));
  const people = users || [{ id: 1, key: 'one', firstName: 'One', lastName: 'Owner', email: 'one@fixture.test', username: 'one', userType: 'admin', isActive: true, profile: {}, createdAt: '2026-01-01T00:00:00Z' }, { id: 2, key: 'two', firstName: 'Two', lastName: 'Member', email: 'two@fixture.test', username: 'two', userType: 'employee', isActive: true, profile: {}, createdAt: '2026-01-01T00:00:00Z' }];
  const scope = appKey === 'tasks' ? 'task_manager' : appKey === 'chats' ? 'hq' : 'file_manager';
  const assigned = roles || { one: appKey === 'chats' ? ['owner'] : ['super_admin'], two: appKey === 'tasks' ? ['developer'] : appKey === 'chats' ? ['member'] : ['file_editor'] };
  const identity = {
    realm: 'isolated', workspaceId, workspaceMode: true, users: people,
    grants: { [scope]: Object.fromEntries(people.map(user => [user.key, { roles: assigned[user.key] || [] }])), global: { one: { roles: ['super_admin'] } } },
    findUser: id => people.find(user => user.id === Number(id)), findByKey: key => people.find(user => user.key === key),
    userScopes: user => assigned[user.key]?.length ? [{ scope, roles: assigned[user.key] }] : [],
    publicUser: user => ({ ...user }), scopeByName: () => ({ name: scope }), canWrite: () => writable,
    requireUser(req, res) { const user = this.findUser(req.headers['x-user']); if (!user) { util.fail(res, 401, 'Sign in again'); return null; } return user; },
    fullName: user => `${user.firstName} ${user.lastName}`,
  };
  const graph = createPrivateModuleGraph({ appKey, identity, config: {}, util, Date: BusinessDate, manifest: [...manifest.apps[appKey], ...(appKey === 'chats' ? ['apps/chats.js', 'apps/chats/runtime-state.js', 'apps/chats/fixture.json', 'lib/tool-adapters/chats.js'] : [])] });
  const ctx = { realm: 'isolated', identity, util, sharedFiles, boardAuthority, uploadsDir: root, log() {}, upload: { any: () => (_req, _res, next) => next() }, apiUrl: () => apiOrigin, webUrl: () => 'http://fixture.test', fileUrl: name => `http://fixture.test/assets/${encodeURIComponent(name)}?workspace=${workspaceId}` };
  // Test-only finite subscription fixture. Production gets its policy from the
  // current canonical workspace line through workspace-boundary, never this fallback.
  ctx.filesPolicy = filesPolicy || (() => ({ planId: 'files_pro', storageBytes: 500 * 1024 ** 3, shareLinks: true, billingReadOnly: !writable, readOnly: !writable, canAcceptSamples: writable, canWrite: writable }));
  const instance = graph.load().createWorkspaceRuntime({ realm: 'isolated', appKey, workspace: { id: workspaceId, name: workspaceId }, initialization: { kind: fixtureId ? 'fixture' : 'empty', ...(fixtureId ? { fixtureId } : {}), seedAt: new BusinessDate().toISOString() }, snapshot, identity, clock: { now: () => fixed }, services: { ctx, verifyActorPassword: password => password === 'fixture-password', commands }, assets: {} });
  return { instance, identity, graph, close() {
    instance.close(); graph.close();
    const target = fs.realpathSync(root), expected = path.resolve(os.tmpdir()) + path.sep;
    if (!target.startsWith(expected) || !path.basename(target).startsWith('orgtik-tools-runtime-')) throw new Error('Unsafe test cleanup path.');
    fs.rmSync(target, { recursive: true, force: true });
  } };
}

async function harness(instances) {
  const app = express(); app.use(express.json());
  instances.forEach((runtime, index) => app.use('/' + index, runtime.instance.router));
  const server = http.createServer(app); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  return { async call(index, method, route, body, headers = {}) {
    const bytes = body === undefined ? null : Buffer.from(JSON.stringify(body));
    return new Promise((resolve, reject) => {
      const request = http.request({ host: '127.0.0.1', port, path: '/' + index + route, method, agent: false, headers: { 'x-user': '1', ...headers, ...(bytes ? { 'content-type': 'application/json', 'content-length': bytes.length } : {}) } }, response => {
        const chunks = []; response.on('data', chunk => chunks.push(chunk)); response.on('end', () => {
          const raw = Buffer.concat(chunks); let json; try { json = JSON.parse(raw.toString()); } catch {}
          resolve({ status: response.statusCode, json, headers: response.headers, raw });
        });
      }); request.on('error', reject); request.end(bytes);
    });
  }, async close() { await new Promise(resolve => server.close(resolve)); instances.forEach(runtime => runtime.close()); } };
}

const plain = value => JSON.parse(JSON.stringify(value));
module.exports = { runtime, harness, plain };
