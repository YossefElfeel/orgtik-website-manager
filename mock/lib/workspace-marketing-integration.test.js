const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

test('Marketing resolves current CRM consent and creates one native attributed project', { timeout: 90000 }, async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'orgtik-marketing-v3-'));
  Object.assign(process.env, { MOCK_AUTH_FILE: path.join(folder, 'accounts.json'), MOCK_AUTH_STORE: 'file', MOCK_JOURNAL: 'memory', MOCK_SANDBOX: `marketing-v3-${process.pid}`, MOCK_PUBLIC_URL: '', VERCEL: '', KV_REST_API_URL: '', KV_REST_API_TOKEN: '', UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '', MOCK_CLOCK: 'frozen', MOCK_NOW: '2026-10-07T09:00:00Z' });
  process.argv.push('--only=sos,admin,sales,marketing,tasks');
  const server = http.createServer(require('../api/index'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function call(app, endpoint, token, method = 'GET', body) {
    const response = await fetch(`${base}/${app}${endpoint}`, { method, signal: AbortSignal.timeout(20000), headers: { connection: 'close', ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const raw = await response.json(); return { status: response.status, data: raw.data ?? raw, raw };
  }
  const good = response => { assert.ok(response.status < 300, JSON.stringify(response.raw)); return response.data; };
  try {
    const mona = good(await call('sos', '/api/auth/login', null, 'POST', { email: 'mona.adel@orgtik.test', password: 'Local@2026' }));
    const owner = mona.tokens.accessToken;
    const marketing = good(await call('sos', '/api/auth/workspace', owner, 'POST', { workspaceId: 'ws_orgtik', target: 'marketing' })).tokens.accessToken;
    const crm = good(await call('sos', '/api/auth/workspace', owner, 'POST', { workspaceId: 'ws_orgtik', target: 'sales' })).tokens.accessToken;
    const contact = good(await call('marketing', '/api/suite/crm/directory', marketing)).contacts[0]; assert.ok(contact?.id);
    const campaign = good(await call('marketing', '/v3/bootstrap', marketing)).campaigns[0]; assert.ok(campaign?.id);
    good(await call('marketing', `/v3/campaigns/${campaign.id}/recipients`, marketing, 'PATCH', { refs: [{ workspaceId: 'ws_orgtik', contactId: contact.id }] }));
    const consentBody = { contactId: contact.id, state: 'opted_in', operationId: 'marketing-consent-proof' };
    const consent = good(await call('marketing', '/api/suite/crm/consent', marketing, 'POST', consentBody));
    assert.equal(consent.consent.source, 'marketing_mock'); assert.equal(consent.consent.recordedBy, mona.user.id);
    assert.deepEqual(good(await call('marketing', '/api/suite/crm/consent', marketing, 'POST', consentBody)), consent);
    assert.equal((await call('marketing', '/api/suite/crm/consent', marketing, 'POST', { ...consentBody, state: 'opted_out' })).status, 409);
    assert.equal(good(await call('marketing', `/v3/campaigns/${campaign.id}/audience`, marketing)).eligible.length, 1);
    const S = require('../apps/admin').getStore();
    const monetary = JSON.stringify({ invoices: S.db.invoices, publicWebsiteOrders: S.db.publicWebsiteOrders });
    const leadBody = { contactId: contact.id, title: 'Actual campaign follow-up', estimate: 1500, operationId: 'marketing-lead-proof' };
    const lead = good(await call('marketing', `/api/suite/marketing/campaigns/${campaign.id}/lead`, marketing, 'POST', leadBody));
    assert.equal(lead.leadId, contact.id); assert.ok(lead.projectId); assert.equal(lead.operationId, leadBody.operationId);
    assert.equal(lead.currency, contact.currency); assert.match(lead.currency, /^[A-Z]{3}$/);
    assert.equal(good(await call('sales', `/api/projects/${lead.projectId}`, crm)).projectName, leadBody.title);
    assert.deepEqual(good(await call('marketing', `/api/suite/marketing/campaigns/${campaign.id}/lead`, marketing, 'POST', leadBody)), lead);
    assert.equal((await call('marketing', `/api/suite/marketing/campaigns/${campaign.id}/lead`, marketing, 'POST', { ...leadBody, title: 'Changed receipt' })).status, 409);
    const results = good(await call('marketing', `/v3/campaigns/${campaign.id}`, marketing)).results;
    assert.equal(results.filter(row => row.projectId === lead.projectId).length, 1);
    const currentResults = good(await call('marketing', `/api/suite/marketing/campaigns/${campaign.id}/results`, marketing));
    assert.equal(currentResults.deals[0].projectId, lead.projectId); assert.equal(currentResults.deals[0].estimatedValue, 1500);
    assert.equal(currentResults.deals[0].currency, lead.currency);
    assert.equal(currentResults.currencies[0].wonValue, 0); assert.equal(currentResults.currencies[0].pipelineEstimate, 1500);
    assert.equal(JSON.stringify({ invoices: S.db.invoices, publicWebsiteOrders: S.db.publicWebsiteOrders }), monetary);
    good(await call('marketing', '/api/suite/crm/consent', marketing, 'POST', { ...consentBody, state: 'opted_out', operationId: 'marketing-optout-proof' }));
    assert.equal(good(await call('marketing', `/v3/campaigns/${campaign.id}/audience`, marketing)).eligible.length, 0);
    assert.equal(good(await call('sales', '/api/crm/v3', crm)).contacts.find(row => row.id === contact.id).marketingConsent.state, 'opted_out');
    assert.equal((await call('marketing', '/api/suite/crm/consent', marketing, 'POST', { ...consentBody, workspaceId: 'foreign' })).status, 422);
    good(await call('marketing', '/api/suite/connectors/marketing-crm', marketing, 'PATCH', { enabled: false }));
    const beforeDenied = JSON.stringify(require('../apps/admin').exportState());
    assert.equal((await call('marketing', '/api/suite/crm/consent', marketing, 'POST', consentBody)).status, 403);
    assert.equal((await call('marketing', `/api/suite/marketing/campaigns/${campaign.id}/lead`, marketing, 'POST', leadBody)).status, 403);
    assert.equal(JSON.stringify(require('../apps/admin').exportState()), beforeDenied);
  } finally { await new Promise(resolve => server.close(resolve)); fs.rmSync(folder, { recursive: true, force: true }); }
});
