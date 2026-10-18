// Real signed HTTP against disposable file domains and physical server processes.
// Fixture clocks/accounts/checkpoints are private to os.tmpdir(); never configured Redis,
// shared preview/production data, public fixture routes or caller-supplied system authority.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const AT = '2026-10-07T09:00:00.000Z';
const DAY = 86400000;
const APPS = ['tasks', 'files', 'hr', 'sales', 'marketing', 'chats'];
const TOOLS = ['tasks', 'files', 'hr', 'crm', 'marketing', 'chat'];
const clone = value => JSON.parse(JSON.stringify(value));
const key = value => ({ 'idempotency-key': value });
const fail = code => Object.assign(new Error('Isolated due-transition persistence failure'), { status: 503, code });

async function waitFor(predicate, label, timeout = 20000) {
  const end = performance.now() + timeout;
  while (!predicate()) {
    if (performance.now() > end) throw new Error('Timed out waiting for ' + label);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

async function child(phase) {
  const privateDir = fs.realpathSync(process.env.DUE_HTTP_DIR);
  assert.ok(privateDir.startsWith(fs.realpathSync(os.tmpdir()) + path.sep) && path.basename(privateDir).startsWith('orgtik-due-http-'));
  for (const name of ['MOCK_PUBLIC_URL', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']) assert.equal(process.env[name], '', 'Due fixtures must never use hosted credentials');
  const config = require('../config'); config.dataDir = privateDir;
  const journal = require('./journal'), store = journal.fileStore(path.join(config.dataDir, 'journal.json'));
  const checkpoint = require('./domain-checkpoint');
  let boundary, args, refusePhase = null, failCustody = false, barrierReached = false, conflictBilling = false, billingAttempts = 0;
  let winBillingOnce = null, winningCheckpoints = 0;
  const commit = store.commit.bind(store);
  store.commit = async (entry, expected) => {
    if (entry.url === '/__system/billing') {
      billingAttempts++;
      if (conflictBilling) throw Object.assign(new Error('Isolated persistent CAS conflict'), { status: 409, code: 'journal_conflict' });
      if (winBillingOnce) {
        // Commit an actual competing candidate through the real file CAS. The original
        // candidate then loses its old revision and must restore the winning checkpoint.
        const state = checkpoint.decodeDomainCheckpoint(entry.checkpoint);
        const customer = state.platformState.db.workspaces.find(row => row.id === winBillingOnce.workspaceId);
        assert.ok(customer); customer.name = winBillingOnce.name;
        winBillingOnce = null; winningCheckpoints++;
        await commit({ ...entry, checkpoint: checkpoint.encodeDomainCheckpoint(state) }, expected);
      }
    }
    if (refusePhase && entry.url === '/__system/' + refusePhase) throw fail('journal_unavailable');
    if (phase === 'race' && entry.url === '/__system/billing' && !barrierReached) {
      barrierReached = true;
      fs.writeFileSync(path.join(config.dataDir, 'ready-' + process.env.DUE_HTTP_ACTOR), JSON.stringify({ epoch: expected.expectedEpoch, revision: expected.expectedRevision }));
      await waitFor(() => fs.existsSync(path.join(config.dataDir, 'release')), 'both physical billing candidates reaching CAS');
    }
    return commit(entry, expected);
  };
  journal.pickStore = () => ({ sandbox: process.env.MOCK_SANDBOX, store });
  const factory = require('./workspace-boundary'), original = factory.createWorkspaceBoundary;
  factory.createWorkspaceBoundary = input => {
    args = input; boundary = original(input);
    const create = boundary.registry.create.bind(boundary.registry);
    boundary.registry.create = (workspaceId, app) => {
      const runtime = create(workspaceId, app);
      if (failCustody && app === 'marketing') runtime.transferOwnership = () => { throw fail('custody_fixture_unavailable'); };
      return runtime;
    };
    return boundary;
  };
  const server = require('node:http').createServer(require('../api/index'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const platform = () => require('../apps/admin');
  const clock = () => require('./clock').now();
  const factsFile = path.join(config.dataDir, 'facts.json');
  async function call(app, route, method = 'GET', body, token, headers = {}) {
    const response = await fetch(origin + '/' + app + route, { method, headers: { connection: 'close', ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: 'Bearer ' + token } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30000) });
    const text = await response.text(), raw = text ? JSON.parse(text) : {};
    return { status: response.status, raw, data: raw.data ?? raw };
  }
  async function expect(app, route, method, body, token, status = 200, headers = {}) {
    const answer = await call(app, route, method, body, token, headers);
    assert.equal(answer.status, status, `${app}${route}: ${answer.raw.code || answer.raw.message || answer.status}`);
    return answer.data;
  }
  const select = async (session, workspaceId, target) => (await expect('sos', '/api/auth/workspace', 'POST', { workspaceId, target }, session.tokens.accessToken)).tokens.accessToken;
  async function register(label) {
    return expect('sos', '/api/auth/register', 'POST', { email: label + '@due-fixture.test', password: 'PrivateDueFixture@2026', name: label + ' Person', company: label + ' Workspace' }, null, 201);
  }
  async function seedOwner() {
    return expect('sos', '/api/auth/login', 'POST', { email: 'mona.adel@orgtik.test', password: 'Local@2026' }, null);
  }
  async function staff() {
    const answer = await expect('sos', '/api/auth/login', 'POST', { email: 'mona.adel@orgtik.test', password: 'Local@2026', mode: 'staff', target: 'admin' }, null);
    return answer.tokens.accessToken;
  }
  async function purchase(session, all = true) {
    const token = session.tokens.accessToken;
    const method = await expect('sos', '/v1/app/payment-methods', 'POST', { last4: '4242', expires: '12/40', brand: 'Visa', kind: 'card' }, token, 201);
    const ids = all ? ['tasks_pro', 'files_pro', 'hr_pro', 'crm_pro', 'marketing_pro', 'chat_pro'] : ['tasks_pro'];
    const items = ids.map(planId => {
      const plan = platform().getStore().db.plans.find(row => row.id === planId);
      return { planId, cycle: 'monthly', ...(plan.perUser ? { intent: 'seat_purchase', quantity: Math.max(5, plan.minSeats) } : {}) };
    });
    const quote = await expect('sos', '/v1/app/checkout/preview', 'POST', { items }, token);
    await expect('sos', '/v1/app/checkout/confirm', 'POST', { items, quoteId: quote.quoteId, paymentMethodId: method.id, billing: { legalName: 'Private due fixture' } }, token, 201, key('purchase-' + session.user.id));
    return method.id;
  }
  async function accept(session, invitation, inviter) {
    const delivered = await expect('sos', `/v1/app/invitations/${invitation.id}/delivery`, 'GET', undefined, inviter.tokens.accessToken);
    return expect('sos', `/v1/public/invitations/${delivered.invitePath.split('/').pop()}/accept`, 'POST', {}, session.tokens.accessToken, 200, key('accept-' + invitation.id));
  }
  async function addPerson(owner, session, role = 'member') {
    const invitation = await expect('sos', '/v1/app/invitations', 'POST', { email: session.user.email, role, tools: TOOLS }, owner.tokens.accessToken, 200, key('invite-' + session.user.id));
    await accept(session, invitation, owner);
    return platform().getStore().workspace(owner.workspaceContext.workspace.id).members.find(row => row.userKey === require('./identity').findUser(session.user.id).key).id;
  }
  async function hire(owner, session) {
    const token = await select(owner, owner.workspaceContext.workspace.id, 'hr');
    const employee = await expect('hr', '/api/employees', 'POST', { firstName: 'Due', lastName: String(session.user.id), email: session.user.email, tools: TOOLS }, token, 201, key('hire-' + session.user.id));
    await accept(session, employee.invitation, owner);
    return employee.id;
  }
  async function customer(label, all = true) {
    const account = await register(label); const goodMethodId = await purchase(account, all);
    return { account, workspaceId: account.workspaceContext.workspace.id, goodMethodId };
  }
  async function domain() {
    const snapshot = await store.snapshot(0), entry = snapshot.entries.map(JSON.parse).findLast(row => row.checkpoint);
    assert.ok(entry, 'Expected a durable domain checkpoint');
    return { ...snapshot, state: checkpoint.decodeDomainCheckpoint(entry.checkpoint) };
  }
  // Private accepted historical fixture, never an HTTP route or a changed runtime implementation.
  async function fixture(edit) {
    const current = await domain(), value = clone(current.state);
    await edit(value);
    const entry = { epoch: current.meta.epoch, kind: 'workspace-v1', app: 'admin', method: 'SYSTEM', url: '/__fixture/historical-domain', headers: {}, body: null, at: clock(), checkpoint: checkpoint.encodeDomainCheckpoint(value) };
    await store.commit(entry, { expectedEpoch: current.meta.epoch, expectedRevision: current.revision });
    args.persist.rebuild = true;
  }
  async function setTime(token, now) {
    await expect('sos', '/__mock/clock', 'POST', { now, frozen: true, reset: false }, token);
    assert.equal(clock(), Date.parse(now));
  }
  async function tokens(customer) {
    return Object.fromEntries(await Promise.all(APPS.map(async app => [app, await select(customer.account, customer.workspaceId, app)])));
  }
  async function write(app, token, suffix, ownerId) {
    const routes = {
      tasks: ['/api/projects', { title: 'Due project ' + suffix }],
      files: ['/api/v1/folders', { name: 'Due folder ' + suffix }],
      hr: ['/api/departments', { name: 'Due department ' + suffix, managerUserId: ownerId }],
      sales: ['/api/customers', { fullName: 'Due contact ' + suffix, email: suffix + '@contact.fixture.test' }],
      marketing: ['/projects', { name: 'Due brand ' + suffix }],
      chats: ['/api/hq/commands', { event: { type: 'channel.created', channel: { name: 'Due channel ' + suffix, kind: 'public', memberIds: [String(ownerId)] } } }],
    };
    const [route, body] = routes[app]; return call(app, route, 'POST', body, token, key('write-' + app + '-' + suffix));
  }
  async function ownerFixture(label) {
    const first = await customer(label), successor = await register(label + '-successor'), administrator = await register(label + '-hr');
    const ownerMemberId = platform().getStore().workspace(first.workspaceId).members.find(row => row.role === 'owner').id;
    const successorMemberId = await addPerson(first.account, successor);
    await addPerson(first.account, administrator, 'admin');
    const ownerEmployeeId = await hire(first.account, first.account);
    await hire(first.account, administrator);
    const appTokens = await tokens(first);
    const records = {};
    for (const app of APPS) {
      const answer = await write(app, appTokens[app], 'custody-' + label, first.account.user.id);
      assert.ok([200, 201].includes(answer.status), app + ' custody fixture: ' + JSON.stringify(answer.raw));
      records[app] = answer.data;
    }
    const other = await customer(label + '-other', false);
    const invitation = await expect('sos', '/v1/app/invitations', 'POST', { email: first.account.user.email, role: 'member', tools: ['tasks'] }, other.account.tokens.accessToken);
    await accept(first.account, invitation, other.account);
    const otherToken = await select(first.account, other.workspaceId, 'tasks');
    const hrToken = await select(administrator, first.workspaceId, 'hr');
    const scheduleKey = 'schedule-' + label, scheduleBody = { effectiveAt: '2026-10-08', transfer: { ownerMemberId: successorMemberId } };
    const transferKey = 'owner-receipt-' + label, transferBody = { memberId: successorMemberId };
    await expect('sos', '/v1/app/ownership-transfer', 'POST', transferBody, first.account.tokens.accessToken, 200, key(transferKey));
    const successorSuite = await select(successor, first.workspaceId, 'suite');
    await expect('sos', '/v1/app/ownership-transfer', 'POST', { memberId: ownerMemberId }, successorSuite, 200, key('restore-owner-' + label));
    const scheduled = await expect('hr', `/api/employees/${ownerEmployeeId}`, 'DELETE', scheduleBody, hrToken, 200, key(scheduleKey));
    const facts = { ...first, successor, administrator, ownerMemberId, successorMemberId, ownerEmployeeId, appTokens, otherWorkspaceId: other.workspaceId, otherToken, hrToken, scheduleKey, scheduleBody, transferKey, transferBody, offboardingId: scheduled.id, effectiveAt: scheduled.effectiveAt, records };
    fs.writeFileSync(factsFile, JSON.stringify(facts));
    return facts;
  }
  async function billingFixture(label, all = true) {
    const value = await customer(label, all);
    if (all) await hire(value.account, value.account);
    const appTokens = all ? await tokens(value) : { tasks: await select(value.account, value.workspaceId, 'tasks') };
    const recoveryMethod = await expect('sos', '/v1/app/payment-methods', 'POST', { last4: '4242', expires: '12/40', brand: 'Visa', kind: 'card' }, value.account.tokens.accessToken, 201);
    const historical = (await domain()).state.platformState.db.invoices.filter(row => row.state === 'paid');
    const originalEnd = new Date(Date.parse(AT) - 7 * DAY + 1).toISOString();
    await fixture(state => {
      const workspace = state.platformState.db.workspaces.find(row => row.id === value.workspaceId);
      workspace.paymentMethods.find(row => row.isDefault).last4 = '0002';
      for (const line of workspace.lines.filter(line => TOOLS.includes(line.tool))) {
        Object.assign(line, { state: 'active', autoRenew: true, periodStart: new Date(Date.parse(originalEnd) - 30 * DAY).toISOString(), periodEnd: originalEnd });
        delete line.billingRenewalDueAt; delete line.lastFailure; delete line.graceEndsAt; delete line.readOnlySince;
      }
    });
    return { ...value, appTokens, recoveryMethodId: recoveryMethod.id, historical, originalEnd };
  }

  function assertHistoricPaid(current, historic) {
    for (const invoice of historic) assert.deepEqual(current.platformState.db.invoices.find(row => row.id === invoice.id), invoice, 'Previously paid invoices are immutable');
  }
  function assertArchived(state, facts) {
    const ws = state.platformState.db.workspaces.find(row => row.id === facts.workspaceId), offboarding = ws.offboardings.find(row => row.id === facts.offboardingId);
    assert.equal(ws.state, 'suspended'); assert.equal(ws.flags.ownershipReview.unavailableSuccessorId, facts.successorMemberId);
    assert.equal(offboarding.status, 'completed');
    const snapshot = app => state.workspaceState.snapshots[facts.workspaceId + ':' + app];
    for (const app of APPS) assert.ok(offboarding.custody[app].archived.length > 0, app + ' must archive real owned records');
    const project = snapshot('tasks').data.projects.find(row => row.title.startsWith('Due project custody-'));
    assert.equal(project.ownerId, null); assert.equal(project.custodyReadOnly, true); assert.equal(project.createdById, facts.account.user.id);
    const folder = snapshot('files').data.folders.map(([, row]) => row).find(row => row.name.startsWith('Due folder custody-'));
    assert.equal(folder.ownerId, null); assert.equal(folder.custodyReadOnly, true); assert.ok(folder.deletedAt);
    const department = snapshot('hr').data.departments.find(row => row.name.startsWith('Due department custody-'));
    assert.equal(department.managerUserId, null); assert.equal(department.custodyReadOnly, true);
    const contact = snapshot('sales').data.db.customers.find(row => row.fullName.startsWith('Due contact custody-'));
    assert.equal(contact.ownerUserId, null); assert.equal(contact.custodyReadOnly, true); assert.equal(contact.createdByUserId, facts.account.user.id);
    const brand = snapshot('marketing').data.projects.find(row => row.name.startsWith('Due brand custody-'));
    assert.equal(brand.userId, null); assert.equal(brand.custodyReadOnly, true);
    const channel = snapshot('chats').data.channels.find(row => row.name.startsWith('Due channel custody-'));
    assert.equal(channel.ownerId, 'system:workspace'); assert.equal(channel.archived, true); assert.equal(channel.custodyReadOnly, true);
  }

  try {
    // Phases below assert durable state after the triggering response, before any second HTTP read.
    if (phase === 'prepare-owner') {
      const facts = await ownerFixture('owner-due');
      assert.equal(facts.effectiveAt, '2026-10-08T21:00:00.000Z');
      await setTime(await staff(), facts.effectiveAt);
    } else if (phase === 'owner') {
      const facts = JSON.parse(fs.readFileSync(factsFile, 'utf8'));
      const response = await call('tasks', '/api/projects', 'GET', undefined, facts.appTokens.tasks);
      assert.ok([401, 403].includes(response.status), 'The departed owner must be denied on the first request');
      const saved = await domain(), ws = saved.state.platformState.db.workspaces.find(row => row.id === facts.workspaceId);
      const offboarding = ws.offboardings.find(row => row.id === facts.offboardingId);
      assert.equal(offboarding.status, 'completed'); assert.equal(offboarding.completedAt, facts.effectiveAt);
      assert.equal(ws.members.find(row => row.id === facts.successorMemberId).role, 'owner');
      const departed = ws.members.find(row => row.id === facts.ownerMemberId);
      assert.equal(departed.status, 'offboarded'); assert.ok(Object.values(departed.toolGrants).every(grant => !grant.assigned));
      assert.ok(saved.entries.map(JSON.parse).some(entry => entry.url === '/__system/offboarding' && entry.method === 'SYSTEM'));
      const completed = clone(offboarding);
      assert.equal((await call('tasks', '/api/projects', 'GET', undefined, facts.otherToken)).status, 200);
      assert.equal((await call('hr', `/api/employees/${facts.ownerEmployeeId}`, 'DELETE', facts.scheduleBody, facts.hrToken, key(facts.scheduleKey))).status, 200);
      const ownerReplay = await call('sos', '/v1/app/ownership-transfer', 'POST', facts.transferBody, facts.account.tokens.accessToken, key(facts.transferKey));
      assert.ok([401, 403].includes(ownerReplay.status));
      assert.deepEqual((await domain()).state.platformState.db.workspaces.find(row => row.id === facts.workspaceId).offboardings.find(row => row.id === facts.offboardingId), completed);
      assert.equal(clock(), Date.parse(facts.effectiveAt));
    } else if (phase === 'owner-cold') {
      const facts = JSON.parse(fs.readFileSync(factsFile, 'utf8'));
      assert.ok([401, 403].includes((await call('hr', '/api/employees', 'GET', undefined, facts.appTokens.hr)).status));
      assert.equal((await call('tasks', '/api/projects', 'GET', undefined, facts.otherToken)).status, 200);
      const ws = (await domain()).state.platformState.db.workspaces.find(row => row.id === facts.workspaceId);
      assert.equal(ws.offboardings.filter(row => row.status === 'completed').length, 1);
      assert.equal(clock(), Date.parse(facts.effectiveAt));
    } else if (phase === 'billing') {
      const facts = await billingFixture('six-tool-grace');
      for (const app of APPS) {
        const response = await write(app, facts.appTokens[app], 'grace', facts.account.user.id);
        assert.ok([200, 201].includes(response.status), app + ' must write in the last grace millisecond');
      }
      let saved = (await domain()).state, ws = saved.platformState.db.workspaces.find(row => row.id === facts.workspaceId);
      assert.ok(ws.lines.filter(line => TOOLS.includes(line.tool)).every(line => line.state === 'past_due'));
      await setTime(await staff(), new Date(Date.parse(AT) + 1).toISOString());
      for (const app of APPS) assert.equal((await write(app, facts.appTokens[app], 'blocked', facts.account.user.id)).status, 423, app + ' must refuse writes at its read-only boundary');
      saved = (await domain()).state; ws = saved.platformState.db.workspaces.find(row => row.id === facts.workspaceId);
      assert.ok(ws.lines.filter(line => TOOLS.includes(line.tool)).every(line => line.state === 'read_only' && line.readOnlySince === new Date(Date.parse(AT) + 1).toISOString()));
      for (const line of ws.lines.filter(line => TOOLS.includes(line.tool))) {
        const body = { lineId: line.id, paymentMethodId: facts.recoveryMethodId }, receipt = key('recover-' + line.id);
        const recovered = await expect('sos', '/v1/app/billing/recover', 'POST', body, facts.account.tokens.accessToken, 200, receipt);
        assert.equal(recovered.paymentStatus, 'succeeded');
        const paid = (await domain()).state.platformState.db.invoices.find(row => row.id === recovered.invoiceId);
        await expect('sos', '/v1/app/billing/recover', 'POST', body, facts.account.tokens.accessToken, 200, receipt);
        assert.deepEqual((await domain()).state.platformState.db.invoices.find(row => row.id === recovered.invoiceId), paid, 'Recovery replay does not charge again');
      }
      for (const app of APPS) assert.ok([200, 201].includes((await write(app, facts.appTokens[app], 'recovered', facts.account.user.id)).status), app + ' must regain write access');
      assertHistoricPaid((await domain()).state, facts.historical);
      assert.equal(clock(), Date.parse(AT) + 1);
    } else if (phase === 'prepare-race') {
      const one = await customer('concurrent-one', false), two = await customer('concurrent-two', false);
      const dueAt = new Date(Date.parse(AT) + DAY).toISOString();
      await fixture(state => {
        for (const account of [one, two]) {
          const ws = state.platformState.db.workspaces.find(row => row.id === account.workspaceId), line = ws.lines.find(row => row.tool === 'tasks');
          Object.assign(line, { periodStart: new Date(Date.parse(dueAt) - 30 * DAY).toISOString(), periodEnd: dueAt, state: 'active', autoRenew: true });
          const plan = { ...clone(state.platformState.db.plans.find(row => row.id === line.planId)), id: 'due_private_' + ws.id, tier: 'custom', workspaceId: ws.id, perUser: false, contractedQuantity: 5, private: { amount: ws.id === one.workspaceId ? 17 : 23, currency: ws.currency, cycle: 'monthly' } };
          state.platformState.db.plans.push(plan);
          line.scheduled = { kind: 'downgrade', planId: plan.id, effectiveAt: dueAt };
        }
      });
      const firstToken = await select(one.account, one.workspaceId, 'tasks');
      // Avoid adding an unrelated first-read tool initialization CAS after the due phase.
      // Both stores are initialized through their real API while the renewal is still future.
      await expect('tasks', '/api/projects', 'GET', undefined, firstToken);
      await expect('tasks', '/api/projects', 'GET', undefined, await select(two.account, two.workspaceId, 'tasks'));
      fs.writeFileSync(factsFile, JSON.stringify({ one, two, dueAt, firstToken }));
      await setTime(await staff(), dueAt);
    } else if (phase === 'race') {
      const facts = JSON.parse(fs.readFileSync(factsFile, 'utf8'));
      const response = await call('tasks', '/api/projects', 'GET', undefined, facts.firstToken);
      assert.equal(response.status, 200);
      assert.equal(clock(), Date.parse(facts.dueAt));
    } else if (phase === 'race-cold') {
      const facts = JSON.parse(fs.readFileSync(factsFile, 'utf8'));
      await expect('tasks', '/api/projects', 'GET', undefined, facts.firstToken);
      const before = await domain();
      for (const customer of [facts.one, facts.two]) {
        const state = before.state, ws = state.platformState.db.workspaces.find(row => row.id === customer.workspaceId), line = ws.lines.find(row => row.tool === 'tasks');
        const cycles = Object.values(state.platformState.db.billingLifecycle.cycles).filter(row => row.workspaceId === ws.id && row.lineId === line.id);
        assert.equal(cycles.length, 1, 'Each workspace retains exactly one original renewal obligation');
        assert.equal(cycles[0].dueAt, facts.dueAt, 'A preceding workspace downgrade must not move another charge anchor');
        assert.equal(cycles[0].amount, customer.workspaceId === facts.one.workspaceId ? 17 : 23);
        const invoices = state.platformState.db.invoices.filter(row => row.workspaceId === ws.id && row.billingEventKey);
        assert.equal(invoices.length, 1); assert.equal(invoices[0].payments.filter(row => row.status === 'succeeded').length, 1);
        assert.equal(line.periodStart, facts.dueAt); assert.equal(line.periodEnd, new Date(Date.parse(facts.dueAt) + 30 * DAY).toISOString());
      }
      await expect('tasks', '/api/projects', 'GET', undefined, facts.firstToken);
      const after = await domain();
      assert.equal(after.revision, before.revision, 'Repeated automatic deadline reads are durable no-ops');
      assert.deepEqual(after.state, before.state);
      assert.equal(clock(), Date.parse(facts.dueAt));
    } else if (phase === 'late') {
      const facts = await ownerFixture('inactive-successor'), control = await staff();
      await expect('admin', `/v1/admin/people/${facts.successor.user.id}/status`, 'PATCH', { isActive: false }, control);
      await setTime(control, facts.effectiveAt);
      assert.ok([401, 403].includes((await call('tasks', '/api/projects', 'GET', undefined, facts.appTokens.tasks)).status));
      const saved = await domain(); assertArchived(saved.state, facts);
      assert.equal((await call('tasks', '/api/projects', 'GET', undefined, facts.otherToken)).status, 200);
      const blocked = await write('tasks', await select(facts.administrator, facts.workspaceId, 'tasks'), 'suspended-custody', facts.administrator.user.id);
      assert.equal(blocked.status, 423);
      assertArchived((await domain()).state, facts);
      assert.equal(clock(), Date.parse(facts.effectiveAt));
    } else if (phase === 'late-cold') {
      const facts = JSON.parse(fs.readFileSync(factsFile, 'utf8'));
      assert.ok([401, 403].includes((await call('tasks', '/api/projects', 'GET', undefined, facts.appTokens.tasks)).status));
      assertArchived((await domain()).state, facts);
      assert.equal(clock(), Date.parse(facts.effectiveAt));
    } else if (phase === 'rollback') {
      const facts = await ownerFixture('rollback-owner');
      await setTime(await staff(), facts.effectiveAt);
      const before = await domain(), beforeClock = require('./clock').exportState();
      failCustody = true;
      assert.equal((await call('tasks', '/api/projects', 'GET', undefined, facts.appTokens.tasks)).status, 503);
      failCustody = false;
      let after = await domain(); assert.equal(after.revision, before.revision); assert.deepEqual(after.state, before.state);
      assert.deepEqual(platform().exportState(), before.state.platformState, 'No earlier tool transfer survives a later custody failure');
      assert.deepEqual(boundary.registry.exportState(), before.state.workspaceState);
      assert.deepEqual(require('./clock').exportState(), beforeClock);
      refusePhase = 'offboarding';
      assert.equal((await call('tasks', '/api/projects', 'GET', undefined, facts.appTokens.tasks)).status, 503);
      refusePhase = null;
      after = await domain(); assert.equal(after.revision, before.revision); assert.deepEqual(after.state, before.state);
      assert.deepEqual(platform().exportState(), before.state.platformState); assert.deepEqual(boundary.registry.exportState(), before.state.workspaceState);
      assert.deepEqual(require('./clock').exportState(), beforeClock);
      assert.ok([401, 403].includes((await call('tasks', '/api/projects', 'GET', undefined, facts.appTokens.tasks)).status));
      const completed = (await domain()).state.platformState.db.workspaces.find(row => row.id === facts.workspaceId).offboardings.find(row => row.id === facts.offboardingId);
      assert.equal(completed.status, 'completed');
      assert.equal((await call('tasks', '/api/projects', 'GET', undefined, facts.otherToken)).status, 200);
      assert.deepEqual(require('./clock').exportState(), beforeClock);
    } else if (phase === 'billing-rollback') {
      const facts = await billingFixture('billing-phase-refusal', false), before = await domain(), beforeClock = require('./clock').exportState();
      billingAttempts = 0; refusePhase = 'billing';
      assert.equal((await call('tasks', '/api/projects', 'GET', undefined, facts.appTokens.tasks)).status, 503);
      assert.equal(billingAttempts, 1, 'A storage outage is not retried automatically');
      refusePhase = null;
      assert.deepEqual((await domain()).state, before.state); assert.equal((await domain()).revision, before.revision);
      assert.deepEqual(require('./clock').exportState(), beforeClock);
      billingAttempts = 0; conflictBilling = true;
      assert.equal((await call('tasks', '/api/projects', 'GET', undefined, facts.appTokens.tasks)).status, 409);
      assert.equal(billingAttempts, 2, 'Exactly one trusted CAS retry is allowed');
      conflictBilling = false;
      assert.deepEqual((await domain()).state, before.state); assert.equal((await domain()).revision, before.revision);
      assert.deepEqual(require('./clock').exportState(), beforeClock);
      await expect('tasks', '/api/projects', 'GET', undefined, facts.appTokens.tasks);
      const state = (await domain()).state, cycles = Object.values(state.platformState.db.billingLifecycle.cycles).filter(row => row.workspaceId === facts.workspaceId);
      assert.equal(cycles.length, 1); assert.equal(state.platformState.db.invoices.filter(row => row.workspaceId === facts.workspaceId && row.billingEventKey).length, 1);
      assertHistoricPaid(state, facts.historical); assert.deepEqual(require('./clock').exportState(), beforeClock);
    } else if (phase === 'separate-phases') {
      const facts = await ownerFixture('offboarding-before-billing');
      await fixture(state => {
        const line = state.platformState.db.workspaces.find(row => row.id === facts.workspaceId).lines.find(row => row.tool === 'tasks');
        Object.assign(line, { autoRenew: true, periodEnd: facts.effectiveAt, periodStart: new Date(Date.parse(facts.effectiveAt) - 30 * DAY).toISOString() });
      });
      await setTime(await staff(), facts.effectiveAt);
      const beforeClock = require('./clock').exportState(); refusePhase = 'billing';
      assert.equal((await call('tasks', '/api/projects', 'GET', undefined, facts.appTokens.tasks)).status, 503);
      const saved = (await domain()).state, ws = saved.platformState.db.workspaces.find(row => row.id === facts.workspaceId);
      assert.equal(ws.offboardings.find(row => row.id === facts.offboardingId).status, 'completed', 'A later billing failure must not undo committed offboarding');
      assert.equal(ws.members.find(row => row.id === facts.ownerMemberId).status, 'offboarded');
      assert.equal(saved.platformState.db.invoices.filter(row => row.workspaceId === ws.id && row.billingEventKey).length, 0, 'The failed billing candidate is not durable');
      assert.deepEqual(require('./clock').exportState(), beforeClock);
      refusePhase = null;
      assert.ok([401, 403].includes((await call('tasks', '/api/projects', 'GET', undefined, facts.appTokens.tasks)).status));
      const current = (await domain()).state;
      assert.equal(current.platformState.db.invoices.filter(row => row.workspaceId === ws.id && row.billingEventKey).length, 1);
      assert.equal(current.platformState.db.workspaces.find(row => row.id === ws.id).offboardings.filter(row => row.status === 'completed').length, 1);
      assert.deepEqual(require('./clock').exportState(), beforeClock);
    } else if (phase === 'staff') {
      // Only this private realm's canonical OrgTik workspace is used for the staff boundary;
      // every replacement/recruiter/other workspace is created through real public commands.
      const owner = await seedOwner(), corporateId = 'ws_orgtik', control = await staff();
      const replacement = await register('corporate-replacement'), recruiter = await register('corporate-recruiter');
      const org = platform().getStore().workspace(corporateId), line = org.lines.find(row => row.tool === 'hr');
      const quote = await expect('sos', '/v1/app/billing/seats/quote', 'POST', { lineId: line.id, quantity: line.snapshot.quantity + 2 }, owner.tokens.accessToken, 200, key('corporate-capacity-quote'));
      await expect('sos', '/v1/app/billing/seats/confirm', 'POST', { quoteId: quote.quoteId, paymentMethodId: org.paymentMethods.find(row => row.isDefault).id }, owner.tokens.accessToken, 200, key('corporate-capacity-confirm'));
      for (const person of [replacement, recruiter]) {
        const invitation = await expect('sos', '/v1/app/invitations', 'POST', { email: person.user.email, role: 'admin', tools: ['hr'] }, owner.tokens.accessToken);
        await accept(person, invitation, owner);
      }
      const replacementKey = require('./identity').findUser(replacement.user.id).key;
      await fixture(state => { state.platformState.db.staffRoles[replacementKey] = ['super_admin']; });
      const replacementHr = await select(replacement, corporateId, 'hr');
      const recruiterMemberId = platform().getStore().workspace(corporateId).members.find(row => row.userKey === require('./identity').findUser(recruiter.user.id).key).id;
      const other = await customer('corporate-other', false);
      const invitation = await expect('sos', '/v1/app/invitations', 'POST', { email: owner.user.email, role: 'member', tools: ['tasks'] }, other.account.tokens.accessToken);
      await accept(owner, invitation, other.account);
      const otherToken = await select(owner, other.workspaceId, 'tasks');
      const scheduled = await expect('hr', `/api/employees/${owner.user.id}`, 'DELETE', { effectiveAt: '2026-10-08', transfer: { ownerMemberId: recruiterMemberId } }, replacementHr, 200, key('corporate-departure'));
      await expect('admin', `/v1/admin/people/${replacement.user.id}/status`, 'PATCH', { isActive: false }, control);
      await setTime(control, scheduled.effectiveAt);
      assert.ok([401, 403].includes((await call('admin', '/v1/admin/me', 'GET', undefined, control)).status));
      const saved = (await domain()).state, ws = saved.platformState.db.workspaces.find(row => row.id === corporateId);
      assert.equal(ws.state, 'active', 'A customer owner successor need not acquire OrgTik staff privileges');
      assert.equal(ws.flags.staffRecovery.status, 'required');
      assert.equal(ws.flags.staffRecovery.reason, 'no_active_super_admin');
      assert.equal(saved.platformState.db.staffAuthorityRevocations.admin.offboardingId, scheduled.id);
      assert.deepEqual(saved.platformState.db.staffRoles.admin, ['super_admin'], 'Stored roles remain history rather than being silently deleted');
      assert.equal((await call('tasks', '/api/projects', 'GET', undefined, otherToken)).status, 200);
      const recipient = await seedOwner();
      const recruited = await expect('sos', '/api/auth/workspace', 'POST', { workspaceId: corporateId, target: 'suite' }, recruiter.tokens.accessToken);
      const recruiterSession = { ...recruiter, ...recruited };
      const employee = await expect('hr', '/api/employees', 'POST', { firstName: owner.user.firstName, lastName: owner.user.lastName || 'Staff', email: owner.user.email, tools: ['hr'] }, await select(recruiter, corporateId, 'hr'), 201, key('corporate-rehire'));
      await accept(recipient, employee.invitation, recruiterSession);
      const freshStaff = await call('sos', '/api/auth/login', 'POST', { email: owner.user.email, password: 'Local@2026', mode: 'staff', target: 'admin' });
      assert.ok([401, 403].includes(freshStaff.status), 'Ordinary HR rehire must never restore historical staff authority');
      const current = (await domain()).state;
      assert.ok(current.platformState.db.staffAuthorityRevocations.admin);
      assert.equal(current.platformState.db.workspaces.find(row => row.id === corporateId).members.find(row => row.userKey === 'admin').status, 'active');
      assert.ok([401, 403].includes((await call('admin', '/v1/admin/me', 'GET', undefined, control)).status));
      assert.equal((await call('tasks', '/api/projects', 'GET', undefined, otherToken)).status, 200);
      assert.equal(clock(), Date.parse(scheduled.effectiveAt));
    } else if (phase === 'registration-retry') {
      const existing = await billingFixture('preflight-existing', false), beforeClock = require('./clock').exportState();
      const winnerName = 'Winning preflight domain survives public registration';
      winBillingOnce = { workspaceId: existing.workspaceId, name: winnerName };
      // No intermediate HTTP call: this registration request itself must encounter the
      // system CAS loss/rebuild before the freshly resolved authentication router runs.
      const created = await register('registration-after-preflight-restore');
      assert.equal(winningCheckpoints, 1);
      const saved = (await domain()).state, ws = saved.platformState.db.workspaces.find(row => row.id === created.workspaceContext.workspace.id);
      assert.ok(ws); assert.equal(ws.name, 'registration-after-preflight-restore Workspace');
      const raw = (await store.identityAccounts()).get(String(created.user.id));
      assert.ok(raw, 'Successful registration must atomically persist its canonical account');
      const account = JSON.parse(raw); assert.equal(account.user.id, created.user.id); assert.equal(account.user.email, created.user.email);
      assert.ok(ws.members.some(row => row.userKey === account.user.key && row.role === 'owner' && row.status === 'active'));
      assert.equal(saved.platformState.db.workspaces.find(row => row.id === existing.workspaceId).name, winnerName);
      const prior = JSON.parse((await store.identityAccounts()).get(String(existing.account.user.id)));
      assert.equal(prior.user.email, existing.account.user.email, 'The rebuilt account module retains preceding identities');
      assertHistoricPaid(saved, existing.historical);
      assert.equal((await call('sos', '/v1/app/me', 'GET', undefined, created.tokens.accessToken)).data.workspace.id, ws.id);
      assert.deepEqual(require('./clock').exportState(), beforeClock);
      fs.writeFileSync(factsFile, JSON.stringify({ created, previousUserId: existing.account.user.id, previousWorkspaceId: existing.workspaceId, winnerName, clockAt: clock() }));
    } else if (phase === 'registration-cold') {
      const facts = JSON.parse(fs.readFileSync(factsFile, 'utf8'));
      const loggedIn = await expect('sos', '/api/auth/login', 'POST', { email: facts.created.user.email, password: 'PrivateDueFixture@2026' }, null);
      assert.equal(loggedIn.user.id, facts.created.user.id);
      assert.equal(loggedIn.workspaceContext.workspace.id, facts.created.workspaceContext.workspace.id);
      const me = await expect('sos', '/v1/app/me', 'GET', undefined, facts.created.tokens.accessToken);
      assert.equal(me.workspace.id, facts.created.workspaceContext.workspace.id);
      const saved = (await domain()).state;
      assert.equal(saved.platformState.db.workspaces.find(row => row.id === facts.previousWorkspaceId).name, facts.winnerName);
      assert.ok((await store.identityAccounts()).has(String(facts.previousUserId)));
      assert.ok(saved.platformState.db.workspaces.find(row => row.id === facts.created.workspaceContext.workspace.id));
      assert.equal(clock(), facts.clockAt);
    } else throw new Error('Unknown isolated due phase: ' + phase);
    console.log('Isolated due HTTP phase ' + phase + ' passed');
  } finally { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
}

if (process.argv.includes('--due-child')) {
  child(process.argv[process.argv.indexOf('--due-child') + 1]).catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
} else {
  const { test } = require('node:test');
  function isolated(label) {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'orgtik-due-http-'));
    const env = { ...process.env, DUE_HTTP_DIR: folder, MOCK_AUTH_STORE: 'file', MOCK_AUTH_FILE: path.join(folder, 'accounts.json'), MOCK_JOURNAL: 'file', MOCK_SANDBOX: `due-${label}-${process.pid}`, MOCK_SESSION_SECRET: crypto.randomBytes(32).toString('hex'), MOCK_CLOCK: 'frozen', MOCK_NOW: AT, MOCK_PUBLIC_URL: '', VERCEL: '', KV_REST_API_URL: '', KV_REST_API_TOKEN: '', UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '' };
    const children = new Set();
    const run = (phase, extra = {}) => new Promise((resolve, reject) => {
      const process = spawn(globalThis.process.execPath, [__filename, '--only=sos,admin,tasks,files,hr,sales,marketing,chats', '--due-child', phase], { env: { ...env, ...extra }, stdio: ['ignore', 'pipe', 'pipe'] });
      children.add(process);
      let output = ''; process.stdout.on('data', value => output += value); process.stderr.on('data', value => output += value);
      process.on('error', error => { children.delete(process); reject(error); }); process.on('exit', code => { children.delete(process); code === 0 ? resolve() : reject(new Error(`Due ${phase} exited ${code}\n${output.slice(-8000).replace(/([?&]secret=)[^\s]+/g, '$1[redacted]').replace(/\(password: [^)]+\)/g, '(password: [redacted])')}`)); });
    });
    return { folder, run, async cleanup() { await Promise.all([...children].map(child => new Promise(resolve => { child.once('exit', resolve); child.kill(); }))); const target = fs.realpathSync(folder), root = fs.realpathSync(os.tmpdir()) + path.sep; assert.ok(target.startsWith(root) && path.basename(target).startsWith('orgtik-due-http-')); fs.rmSync(target, { recursive: true, force: true }); } };
  }
  test('first departed-owner request durably executes workspace offboarding before denying access, with cold restart and other-workspace isolation', { timeout: 180000 }, async () => {
    const f = isolated('owner');
    try { await f.run('prepare-owner'); await f.run('owner'); await f.run('owner-cold'); }
    finally { await f.cleanup(); }
  });
  test('all six customer tools enforce the exact grace boundary and regain writes after idempotent recovery', { timeout: 180000 }, async () => {
    const f = isolated('six-tool-billing'); try { await f.run('billing'); } finally { await f.cleanup(); }
  });
  test('two physical instances resolve due billing through CAS once and preserve two workspace downgrade charge anchors', { timeout: 180000 }, async () => {
    const f = isolated('billing-race');
    try {
      await f.run('prepare-race');
      const workers = [f.run('race', { DUE_HTTP_ACTOR: 'one' }), f.run('race', { DUE_HTTP_ACTOR: 'two' })];
      const joined = Promise.all(workers); joined.catch(() => {});
      await waitFor(() => ['one', 'two'].every(name => fs.existsSync(path.join(f.folder, 'ready-' + name))), 'both physical instances');
      const revisions = ['one', 'two'].map(name => JSON.parse(fs.readFileSync(path.join(f.folder, 'ready-' + name), 'utf8')));
      assert.deepEqual(revisions[0], revisions[1], 'Both candidates must actually compete for the same revision');
      fs.writeFileSync(path.join(f.folder, 'release'), 'release');
      await joined; await f.run('race-cold');
    } finally { await f.cleanup(); }
  });
  test('an inactive late successor archives actual custody records across all six tools and survives cold restart', { timeout: 180000 }, async () => {
    const f = isolated('inactive-successor'); try { await f.run('late'); await f.run('late-cold'); } finally { await f.cleanup(); }
  });
  test('a failed later tool custody transfer or offboarding CAS rolls back the whole phase without changing clock or historical data', { timeout: 180000 }, async () => {
    const f = isolated('rollback'); try { await f.run('rollback'); } finally { await f.cleanup(); }
  });
  test('late loss of the last qualified OrgTik staff successor records recovery and ordinary HR rehire cannot restore staff authority', { timeout: 180000 }, async () => {
    const f = isolated('staff-protection'); try { await f.run('staff'); } finally { await f.cleanup(); }
  });
  test('billing storage failure does not retry and persistent CAS conflict retries once without partial invoices or clock movement', { timeout: 120000 }, async () => {
    const f = isolated('billing-failure'); try { await f.run('billing-rollback'); } finally { await f.cleanup(); }
  });
  test('committed offboarding remains durable when the separate billing phase fails and later recovers once', { timeout: 180000 }, async () => {
    const f = isolated('separate-phases'); try { await f.run('separate-phases'); } finally { await f.cleanup(); }
  });
  test('a real winning system checkpoint restore refreshes account/platform/router references before same-request public registration and cold restart', { timeout: 180000 }, async () => {
    const f = isolated('registration-after-rebuild'); try { await f.run('registration-retry'); await f.run('registration-cold'); } finally { await f.cleanup(); }
  });
}
