const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runtime, harness } = require('../tasks/runtime-harness');
for (const [apiOrigin, expectedPrefix, hosted] of [['http://fixture.test', '/api', false], ['https://mock.fixture.test/files', '/files/api', true]]) {
  test('Public Files session cookie follows ' + (hosted ? 'hosted prefix and HTTPS cross-site policy' : 'local API path and same-site policy'), async () => {
    const graph = runtime('files', 'ws_nile', { fixtureId: 'nile-v1', apiOrigin }), api = await harness([graph]);
    try {
      const file = graph.instance.exportSnapshot().data.files[0][1];
      const created = await api.call(0, 'POST', '/api/v1/shares', { resourceType: 'file', resourceId: file.id });
      const share = created.json.data, secret = new URL(share.shareUrl).searchParams.get('secret');
      const opened = await api.call(0, 'POST', '/api/v1/public/shares/' + share.id + '/session', { secret });
      assert.equal(opened.status, 204);
      const fields = opened.headers['set-cookie'][0].split(';').map(field => field.trim());
      assert.equal(fields.find(field => field.startsWith('Path=')), 'Path=' + expectedPrefix + '/v1/public/shares/' + share.id);
      assert.equal(fields.includes('HttpOnly'), true); assert.equal(fields.includes('Secure'), hosted);
      assert.equal(fields.find(field => field.startsWith('SameSite=')), hosted ? 'SameSite=None' : 'SameSite=Lax');
    } finally { await api.close(); }
  });
}
