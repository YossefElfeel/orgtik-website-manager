// Signed HTTP and durable replay in disposable subprocesses only. No configured Redis,
// shared API, live account, hosted reset or shared business-clock control is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const AT = '2026-10-07T09:00:00.000Z';
const RANGE = '/api/calendar/availability?fromDate=2026-11-01&toDate=2026-11-30';
const clone = value => JSON.parse(JSON.stringify(value));
const key = value => ({ 'idempotency-key': value });
const full = (day = '2026-11-02') => ({ timeOffType: 'medical_appointment', durationType: 'full_day', startDate: day, endDate: day, employeeNote: 'Private fixture medical note' });

async function child(step) {
  const config = require('../config'); config.dataDir = process.env.LEAVE_ENDPOINT_DIR;
  const journal = require('./journal'), store = journal.fileStore(path.join(config.dataDir, 'journal.json'));
  const commit = store.commit.bind(store); let refuseCommit = false;
  store.commit = (...args) => refuseCommit ? Promise.reject(Object.assign(new Error('Isolated leave persistence failure'), { status: 503, code: 'journal_unavailable' })) : commit(...args);
  journal.pickStore = () => ({ sandbox: process.env.MOCK_SANDBOX, store });
  const handler = require('../api/index'); let dropResponsePath = null;
  const server = require('node:http').createServer((req, res) => {
    if (req.url === dropResponsePath) { dropResponsePath = null; res.end = () => { res.destroy(); return res; }; }
    handler(req, res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`, factsFile = path.join(config.dataDir, 'facts.json');
  const platform = () => require('../apps/admin').getStore();
  async function call(app, route, method = 'GET', body, token, headers = {}) {
    const response = await fetch(`${base}/${app}${route}`, { method, signal: AbortSignal.timeout(25000), headers: { connection: 'close', ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const text = await response.text(), raw = text ? JSON.parse(text) : {};
    return { status: response.status, raw, data: raw.data ?? raw };
  }
  async function login(userKey) {
    const person = require('./identity').findByKey(userKey);
    const answer = await call('sos', '/api/auth/login', 'POST', { email: person.email, password: 'Local@2026' });
    assert.equal(answer.status, 200, `Fixture login failed: ${answer.raw.code || answer.status}`);
    return { person, suite: answer.data.tokens.accessToken };
  }
  async function select(suite, target, workspaceId = 'ws_orgtik') {
    const answer = await call('sos', '/api/auth/workspace', 'POST', { workspaceId, target }, suite);
    assert.equal(answer.status, 200, `Fixture context failed: ${answer.raw.code || answer.status}`);
    return answer.data.tokens.accessToken;
  }
  async function savedHr() {
    const entries = (await store.read(0)).map(JSON.parse), last = entries.findLast(entry => entry.checkpoint);
    assert.ok(last, 'The private HR fixture must have a committed checkpoint');
    return require('./domain-checkpoint').decodeDomainCheckpoint(last.checkpoint).workspaceState.snapshots['ws_orgtik:hr'];
  }
  function safeAvailability(answer, workspaceId = 'ws_orgtik') {
    assert.equal(answer.status, 200, `Availability failed: ${answer.raw.code || answer.status}`);
    assert.equal(answer.raw.success, true); assert.equal(answer.data.workspaceId, workspaceId);
    assert.equal(answer.data.fromDate, '2026-11-01'); assert.equal(answer.data.toDate, '2026-11-30');
    assert.equal(answer.data.timeZone, 'Africa/Cairo'); assert.ok(Array.isArray(answer.data.items));
    const safe = ['id', 'personId', 'personName', 'startDate', 'endDate', 'startAt', 'endAt', 'durationType', 'halfDayPeriod'].sort();
    for (const item of answer.data.items) {
      assert.deepEqual(Object.keys(item).sort(), safe); assert.equal(typeof item.personId, 'number');
      assert.equal(typeof item.id, 'string'); assert.ok(item.id.length > 0);
      assert.ok(Date.parse(item.endAt) > Date.parse(item.startAt));
    }
    assert.equal(JSON.stringify(answer.data).includes('medical'), false);
    assert.equal(JSON.stringify(answer.data).includes('Private fixture'), false);
    return answer.data.items;
  }
  const expect = async (operation, status) => {
    const answer = await operation;
    assert.equal(answer.status, status, `Expected${status}; received${answer.status}: ${answer.raw.code || answer.raw.message || ''}`);
    return answer;
  };
  try {
    if (step === 'flow') {
      const owner = await login('admin'), worker = await login('employee'), manager = await login('manager'), guest = await login('customer');
      const hr = await select(owner.suite, 'hr'), workerHr = await select(worker.suite, 'hr'), managerHr = await select(manager.suite, 'hr');
      const tasks = await select(owner.suite, 'tasks'), chats = await select(owner.suite, 'chats');
      await expect(call('hr', `/api/employees/${worker.person.id}`, 'PATCH', { managerId: manager.person.id, departmentId: null }, hr), 200);
      const moneyBefore = clone(platform().db.invoices), before = await savedHr();
      await expect(call('hr', '/api/attendance/time-offs/requests', 'POST', full(), workerHr), 422);
      await expect(call('hr', '/api/attendance/time-offs/requests', 'POST', full(), workerHr, key('invalid key')), 422);
      await expect(call('hr', '/api/attendance/time-offs/requests', 'POST', { ...full(), status: 'approved' }, workerHr, key('forged-state')), 422);
      await expect(call('hr', '/api/attendance/time-offs/requests', 'POST', { ...full(), password: 'MustNotBeRecorded!' }, workerHr, key('credential-payload')), 422);
      assert.deepEqual(await savedHr(), before, 'Invalid commands must not change HR rows, counters or notifications');

      const body = full(), created = await expect(call('hr', '/api/attendance/time-offs/requests', 'POST', body, workerHr, key('leave-created')), 201);
      assert.equal(created.data.status, 'pending'); assert.equal(created.data.managerActionStatus, 'pending'); assert.equal(created.data.hrActionStatus, 'pending');
      assert.equal(created.data.capabilities.managerRequired, true); assert.equal(created.data.capabilities.canCancel, true);
      const requestId = created.data.id, decisionPath = `/api/attendance/time-offs/requests/${requestId}/decision`;
      assert.equal((await expect(call('hr', '/api/attendance/time-offs/requests', 'POST', body, workerHr, key('leave-created')), 201)).data.id, requestId);
      await expect(call('hr', '/api/attendance/time-offs/requests', 'POST', { ...body, employeeNote: 'Altered' }, workerHr, key('leave-created')), 409);
      for (const [app, token] of [['tasks', tasks], ['chats', chats]]) assert.deepEqual(safeAvailability(await call(app, RANGE, 'GET', undefined, token)), []);
      await expect(call('hr', decisionPath, 'PATCH', { status: 'approved' }, managerHr), 422);
      const managed = await expect(call('hr', decisionPath, 'PATCH', { status: 'approved', decisionNote: 'Private manager explanation' }, managerHr, key('manager-approved')), 200);
      assert.equal(managed.data.status, 'pending'); assert.equal(managed.data.managerActionStatus, 'approved'); assert.equal(managed.data.managerDecidedByUserId, manager.person.id);
      for (const [app, token] of [['tasks', tasks], ['chats', chats]]) assert.deepEqual(safeAvailability(await call(app, RANGE, 'GET', undefined, token)), []);

      const approved = await expect(call('hr', decisionPath, 'PATCH', { status: 'approved', decisionNote: 'Private HR explanation' }, hr, key('hr-approved')), 200);
      assert.equal(approved.data.status, 'approved'); assert.equal(approved.data.hrActionStatus, 'approved'); assert.equal(approved.data.hrDecidedByUserId, owner.person.id);
      const approvedRows = {};
      for (const [app, token] of [['tasks', tasks], ['chats', chats]]) {
        const items = safeAvailability(await call(app, RANGE, 'GET', undefined, token));
        assert.equal(items.length, 1); assert.equal(items[0].personId, worker.person.id); approvedRows[app] = clone(items);
      }
      await expect(call('hr', decisionPath, 'PATCH', { status: 'pending' }, hr, key('hr-reset')), 200);
      for (const [app, token] of [['tasks', tasks], ['chats', chats]]) assert.deepEqual(safeAvailability(await call(app, RANGE, 'GET', undefined, token)), []);
      await expect(call('hr', decisionPath, 'PATCH', { status: 'approved' }, hr, key('hr-reapproved')), 200);
      await expect(call('hr', decisionPath, 'PATCH', { status: 'rejected' }, managerHr, key('manager-rejected')), 200);
      for (const [app, token] of [['tasks', tasks], ['chats', chats]]) assert.deepEqual(safeAvailability(await call(app, RANGE, 'GET', undefined, token)), []);
      await expect(call('hr', decisionPath, 'PATCH', { status: 'approved' }, managerHr, key('manager-reapproved')), 200);

      // Recheck current role before a prior success receipt, then restore this disposable
      // fixture through the real Team endpoint. No production/shared authority is changed.
      const member = clone(platform().workspace('ws_orgtik').members.find(row => row.userKey === manager.person.key));
      const tools = Object.keys(member.toolGrants).filter(tool => member.toolGrants[tool].assigned);
      const roles = Object.fromEntries(tools.map(tool => [tool, member.toolGrants[tool].roles[0]]));
      await expect(call('sos', `/v1/app/team/${encodeURIComponent(member.id)}`, 'PATCH', { role: member.role, tools, toolRoles: { ...roles, hr: 'employee' } }, owner.suite), 200);
      await expect(call('hr', decisionPath, 'PATCH', { status: 'approved', decisionNote: 'Private manager explanation' }, managerHr, key('manager-approved')), 403);
      await expect(call('sos', `/v1/app/team/${encodeURIComponent(member.id)}`, 'PATCH', { role: member.role, tools, toolRoles: roles }, owner.suite), 200);

      // Read-only checks precede receipt lookup. This candidate state belongs only to
      // the isolated subprocess and is restored before further fixture commands.
      const normal = require('../apps/admin').exportState(), readOnly = clone(normal);
      readOnly.db.workspaces.find(row => row.id === 'ws_orgtik').lines.find(line => line.tool === 'hr' && !['ended', 'deleted'].includes(line.state)).state = 'read_only';
      require('../apps/admin').importState(readOnly);
      await expect(call('hr', decisionPath, 'PATCH', { status: 'approved', decisionNote: 'Private HR explanation' }, hr, key('hr-approved')), 423);
      const detail = await expect(call('hr', `/api/attendance/time-offs/requests/${requestId}`, 'GET', undefined, hr), 200);
      assert.equal(detail.data.capabilities.readOnly, true); assert.equal(detail.data.capabilities.canDecide, false);
      require('../apps/admin').importState(normal);

      const guestMember = clone(platform().workspace('ws_orgtik').members.find(row => row.userKey === guest.person.key));
      const guestTools = [...new Set(Object.keys(guestMember.toolGrants).filter(tool => guestMember.toolGrants[tool].assigned).concat('chat'))];
      await expect(call('sos', `/v1/app/team/${encodeURIComponent(guestMember.id)}`, 'PATCH', { role: 'guest', tools: guestTools }, owner.suite), 200);
      const guestTasks = await select(guest.suite, 'tasks'), guestChats = await select(guest.suite, 'chats');
      for (const [app, token] of [['tasks', guestTasks], ['chats', guestChats]]) assert.deepEqual(safeAvailability(await call(app, RANGE, 'GET', undefined, token)), []);
      const nileTasks = await select(guest.suite, 'tasks', 'ws_nile');
      assert.deepEqual(safeAvailability(await call('tasks', RANGE, 'GET', undefined, nileTasks), 'ws_nile'), []);
      await expect(call('tasks', RANGE, 'GET', undefined, tasks, { 'x-workspace': 'ws_nile' }), 409);
      assert.ok([401, 403].includes((await call('tasks', RANGE)).status));
      assert.ok([401, 403].includes((await call('tasks', RANGE, 'GET', undefined, owner.suite)).status));
      const clock = require('./clock'), securityNow = clock.RealDate.now, expirationBefore = await savedHr();
      // Security uses real time, independently of the frozen business clock. Override
      // only this disposable child's security clock; never call a shared clock API.
      try {
        clock.RealDate.now = () => securityNow() + (require('./session-authority').ACCESS_TTL + 1) * 1000;
        await expect(call('hr', decisionPath, 'PATCH', { status: 'approved', decisionNote: 'Private HR explanation' }, hr, key('hr-approved')), 401);
      } finally { clock.RealDate.now = securityNow; }
      assert.deepEqual(await savedHr(), expirationBefore);
      for (const route of ['/api/calendar/availability?fromDate=2026-02-30&toDate=2026-03-03', '/api/calendar/availability?fromDate=2026-11-03&toDate=2026-11-02', '/api/calendar/availability?fromDate=2026-11-01&toDate=2027-02-02']) await expect(call('tasks', route, 'GET', undefined, tasks), 422);
      await expect(call('tasks', '/api/calendar/availability?fromDate=2026-11-01&toDate=2027-02-01', 'GET', undefined, tasks), 200);

      const partialBody = { ...full('2026-11-05'), durationType: 'partial', partialStartTime: '11:00', partialEndTime: '13:00' }, persistenceBefore = await savedHr();
      refuseCommit = true;
      await expect(call('hr', '/api/attendance/time-offs/requests', 'POST', partialBody, workerHr, key('partial-created')), 503);
      refuseCommit = false;
      assert.deepEqual(await savedHr(), persistenceBefore); await expect(call('sos', '/api/auth/me', 'GET', undefined, worker.suite), 200);
      const partial = await expect(call('hr', '/api/attendance/time-offs/requests', 'POST', partialBody, workerHr, key('partial-created')), 201);
      await expect(call('hr', `/api/attendance/time-offs/requests/${partial.data.id}/decision`, 'PATCH', { status: 'approved' }, hr, key('partial-approved')), 200);
      const simultaneous = await Promise.all([1, 2].map(() => call('hr', '/api/attendance/time-offs/requests', 'POST', full('2026-11-08'), workerHr, key('concurrent-same'))));
      assert.ok(simultaneous.some(answer => answer.status === 201), simultaneous.map(answer => `${answer.status}:${answer.raw.code || ''}`).join(',')); assert.ok(simultaneous.every(answer => [201, 409].includes(answer.status)));
      const recoveredSame = await expect(call('hr', '/api/attendance/time-offs/requests', 'POST', full('2026-11-08'), workerHr, key('concurrent-same')), 201);
      assert.equal((await savedHr()).data.timeOffs.filter(row => row.startDate === '2026-11-08' && row.employeeId === worker.person.id).length, 1);
      const overlap = await Promise.all(['overlap-one', 'overlap-two'].map(attempt => call('hr', '/api/attendance/time-offs/requests', 'POST', full('2026-11-09'), workerHr, key(attempt))));
      assert.deepEqual(overlap.map(answer => answer.status).sort(), [201, 409]);
      dropResponsePath = '/hr/api/attendance/time-offs/requests';
      await assert.rejects(call('hr', '/api/attendance/time-offs/requests', 'POST', full('2026-11-10'), workerHr, key('lost-created')));
      const hrAfterCommit = await savedHr();
      const dropped = hrAfterCommit.data.timeOffs.find(row => row.employeeId === worker.person.id && row.startDate === '2026-11-10');
      assert.ok(dropped, 'The server must have committed the request before the response was lost');
      const recovered = await expect(call('hr', '/api/attendance/time-offs/requests', 'POST', full('2026-11-10'), workerHr, key('lost-created')), 201);
      assert.equal(recovered.data.id, dropped.id); assert.deepEqual(await savedHr(), hrAfterCommit);
      const cancellation = `/api/attendance/time-offs/requests/${recovered.data.id}/cancel`;
      await expect(call('hr', cancellation, 'PATCH', {}, workerHr), 422);
      await expect(call('hr', cancellation, 'PATCH', {}, workerHr, key('leave-cancelled')), 200);
      await expect(call('hr', cancellation, 'PATCH', {}, workerHr, key('leave-cancelled')), 200);
      assert.equal((await savedHr()).data.timeOffs.find(row => row.id === recovered.data.id).status, 'cancelled');
      assert.equal(recoveredSame.data.status, 'pending');
      assert.deepEqual(platform().db.invoices, moneyBefore); assert.equal(require('./clock').now(), Date.parse(AT));
      fs.writeFileSync(factsFile, JSON.stringify({ owner: owner.suite, worker: worker.suite, hr, workerHr, tasks, chats, requestId, partialId: partial.data.id, workerId: worker.person.id, body, moneyBefore }));
    } else if (step === 'cold') {
      const facts = JSON.parse(fs.readFileSync(factsFile, 'utf8'));
      await expect(call('sos', '/api/auth/me', 'GET', undefined, facts.worker), 200);
      const detail = await expect(call('hr', `/api/attendance/time-offs/requests/${facts.requestId}`, 'GET', undefined, facts.hr), 200);
      assert.equal(detail.data.status, 'approved'); assert.equal(detail.data.managerActionStatus, 'approved'); assert.equal(detail.data.hrActionStatus, 'approved');
      for (const [app, token] of [['tasks', facts.tasks], ['chats', facts.chats]]) {
        const items = safeAvailability(await call(app, RANGE, 'GET', undefined, token));
        assert.equal(items.length, 2); assert.ok(items.every(item => item.personId === facts.workerId));
        const partial = items.find(item => item.durationType === 'partial'); assert.ok(partial);
        assert.equal(partial.startAt, '2026-11-05T09:00:00.000Z'); assert.equal(partial.endAt, '2026-11-05T11:00:00.000Z');
      }
      const before = await savedHr();
      const repeated = await expect(call('hr', '/api/attendance/time-offs/requests', 'POST', facts.body, facts.workerHr, key('leave-created')), 201);
      assert.equal(repeated.data.id, facts.requestId); assert.deepEqual(await savedHr(), before);
      assert.deepEqual(platform().db.invoices, facts.moneyBefore); assert.equal(require('./clock').now(), Date.parse(AT));
    } else throw new Error('Unknown isolated leave phase');
    console.log(`Isolated leave HTTP phase ${step} passed`);
  } finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  }
}

if (process.argv.includes('--leave-child')) {
  child(process.argv[process.argv.indexOf('--leave-child') + 1]).catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
} else {
  const { test } = require('node:test');
  test('invalid dispatch capabilities return raw Node403 twice without crashing or using a legacy fallback', async () => {
    const http = require('node:http'), sessionStore = require('./session-store');
    const realm = `invalid-capability-${process.pid}`, previousPick = sessionStore.pickStore;
    let boundary, fallbackCalls = 0, handled = 0;
    try {
      sessionStore.pickStore = () => sessionStore.memoryStore({ realm });
      boundary = require('./workspace-boundary').createWorkspaceBoundary({
        realm, config: { hosted: false, dataDir: os.tmpdir() }, store: require('./journal').memoryStore(),
        accountStore: { accounts: async () => new Map() }, identity: () => ({}),
        platform: () => { throw new Error('Invalid capabilities must never initialize platform state'); },
        dispatch: () => { throw new Error('Invalid capabilities must never dispatch'); },
        persist: { seedAt: AT }, util: {}, makeCtx: () => ({}), staffAvailable: () => false,
      });
    } finally { sessionStore.pickStore = previousPick; }
    const server = http.createServer((req, res) => {
      assert.equal(typeof res.status, 'undefined', 'Exercise the raw Node response, not an Express substitute');
      handled++;
      const fallback = () => { fallbackCalls++; return (_req, response) => response.end('Forbidden legacy fallback'); };
      boundary.frameApp(req.headers['x-orgtik-dispatch'], req, fallback)(req, res);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const call = capability => new Promise((resolve, reject) => {
      const request = http.request({ hostname: '127.0.0.1', port: server.address().port, path: '/api/calendar/availability', method: 'GET', agent: false, headers: { connection: 'close', 'x-mock-app': 'tasks', 'x-orgtik-dispatch': capability } }, response => {
        const chunks = []; response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => resolve({ status: response.statusCode, type: response.headers['content-type'], data: JSON.parse(Buffer.concat(chunks).toString('utf8')) }));
        response.on('error', reject);
      });
      request.on('error', reject); request.end();
    });
    try {
      for (const capability of ['forged-first', 'forged-second']) {
        const result = await call(capability);
        assert.equal(result.status, 403); assert.match(result.type, /^application\/json/);
        assert.deepEqual(result.data, { success: false, code: 'invalid_dispatch_capability' });
      }
      assert.equal(handled, 2); assert.equal(fallbackCalls, 0);
    } finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
  });

  test('signed leave commands and private tool calendars preserve authority, refusal rollback and cold-start history', { timeout: 150000 }, async () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'orgtik-leave-http-'));
    const env = { ...process.env, LEAVE_ENDPOINT_DIR: folder, MOCK_AUTH_STORE: 'file', MOCK_AUTH_FILE: path.join(folder, 'accounts.json'), MOCK_JOURNAL: 'file', MOCK_SANDBOX: `leave-http-${process.pid}`, MOCK_CLOCK: 'frozen', MOCK_NOW: AT, MOCK_PUBLIC_URL: '', VERCEL: '', KV_REST_API_URL: '', KV_REST_API_TOKEN: '', UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '' };
    const run = phase => new Promise((resolve, reject) => {
      const taskProcess = spawn(process.execPath, [__filename, '--only=sos,admin,hr,tasks,chats', '--leave-child', phase], { env, stdio: ['ignore', 'pipe', 'pipe'] });
      let output = ''; taskProcess.stdout.on('data', value => output += value); taskProcess.stderr.on('data', value => output += value);
      taskProcess.on('error', reject); taskProcess.on('exit', code => code === 0 ? resolve() : reject(new Error(`Leave ${phase} exited${code}\n${output.slice(-7000)}`)));
    });
    try { await run('flow'); await run('cold'); }
    finally {
      const resolved = fs.realpathSync(folder), root = fs.realpathSync(os.tmpdir()) + path.sep;
      assert.ok(resolved.startsWith(root) && path.basename(resolved).startsWith('orgtik-leave-http-')); fs.rmSync(resolved, { recursive: true, force: true });
    }
  });
}
