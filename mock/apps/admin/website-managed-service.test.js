// D-059: a paid website-management offer creates fulfilment work without CMS access.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const net = require('node:net');
const express = require('express');
const { makeStore } = require('./store');
const appApi = require('./app-api');
const { mountPublicRoutes } = require('./website-offers');

test('Website Manager purchase creates one managed-service request and no CMS entitlement', async () => {
  const user = { id: 1, key: 'admin', email: 'buyer@fixture.test', firstName: 'Buyer', lastName: 'Fixture' };
  const identity = { users: [user], userFromReq: () => user, tokenFrom: () => 'fixture', decode: () => ({}), findByKey: key => key === user.key ? user : null, fullName: () => 'Buyer Fixture' };
  const S = makeStore({ identity }), ws = S.workspace('ws_orgtik'), app = express();
  S.now = () => Date.parse('2026-10-07T09:00:00Z');
  const ctx = { identity, config: { hosted: false }, websiteOrderSecret: 'isolated-managed-service-fixture' };
  const H = { ok: (res, data, meta = {}, status = 200) => res.status(status).json({ data, meta }), fail: (res, status, code, message) => res.status(status).json({ error: { code, message } }), page: (req, res, data) => res.json({ data, meta: {} }) };
  mountPublicRoutes(app, ctx, S, H);
  appApi(app, ctx, S, H);
  const call = (url, body) => new Promise(resolve => {
    const req = new http.IncomingMessage(new net.Socket()); req.method = 'POST'; req.url = url; req.headers = { 'x-workspace': ws.id }; req.body = body;
    const res = new http.ServerResponse(req); res.end = payload => { resolve({ status: res.statusCode, body: JSON.parse(String(payload)) }); return res; };
    app.handle(req, res);
  });
  const quote = await call('/v1/public/website-quotes', { groups: [{ id: 'managed-service', kind: 'software', lines: [{ catalogId: 'website', months: 3, autoRenew: true }] }] });
  assert.equal(quote.status, 200);
  const paid = await call('/v1/public/website-orders', { quoteId: quote.body.data.quoteId, reference: 'managed-service-one', paymentMethod: 'card', billing: { name: 'Buyer Fixture', email: user.email } });
  assert.equal(paid.status, 200); assert.equal(paid.body.data.paymentStatus, 'succeeded');
  const claim = { reference: paid.body.data.reference, claimToken: paid.body.data.claimToken };
  const requestCount = S.db.serviceRequests.length;
  const before = S.db.invoices.length, first = await call('/v1/app/website-orders', claim), repeat = await call('/v1/app/website-orders', claim);
  assert.equal(first.status, 201); assert.equal(repeat.status, 201);
  assert.deepEqual(repeat.body.data, first.body.data);
  assert.equal(first.body.data.tools.length, 0); assert.equal(first.body.data.requests.length, 1);
  assert.equal(S.db.serviceRequests.find(row => row.id === first.body.data.requests[0].requestId).serviceId, 'svc_web_managed_website');
  assert.equal(S.db.invoices.length, before + 1);
  assert.equal(S.db.serviceRequests.length, requestCount + 1);
  assert.equal(ws.lines.some(line => ['website', 'wm'].includes(line.tool)), false);
  assert.equal(S.db.plans.some(plan => plan.id === 'website_pro'), false);
});
