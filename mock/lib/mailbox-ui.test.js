const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const root = path.resolve(__dirname, '../..'), ts = require(require.resolve('typescript', { paths: [path.join(root, 'apps/sos')] }));
const source = fs.readFileSync(path.join(root, 'apps/sos/components/workspace/mailbox/delivery.ts'), 'utf8'), moduleValue = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: moduleValue.exports, module: moduleValue });
const { invitationPath, mailboxInvitationPath, newestFirst } = moduleValue.exports;
const opaque = 'opaqueMockCapability'.padEnd(43, 'x'), valid = '/invite/' + opaque;
test('Mailbox actions use only the current pending server-projected opaque invitation path', () => {
  assert.equal(invitationPath({ status: 'pending', delivery: 'mock', invitePath: valid }), valid);
  for (const status of ['accepted', 'expired', 'cancelled', 'superseded']) assert.equal(invitationPath({ status, delivery: 'mock', invitePath: valid }), null);
  for (const invitePath of ['https://untrusted.test' + valid, '//untrusted.test' + valid, '/invite/' + opaque + '?token=credential', '/invite/a.b.c', '/invite/short']) assert.equal(invitationPath({ status: 'pending', delivery: 'mock', invitePath }), null);
  assert.equal(mailboxInvitationPath({ delivery: 'mock', acceptanceToken: opaque }), null);
  assert.equal(mailboxInvitationPath({ delivery: 'mock', invitationStatus: 'pending', invitePath: valid }), valid);
});
test('Mailbox display ordering leaves server delivery data unchanged', () => {
  const original = [{ id: 'old', at: '2026-10-07T09:00:00Z' }, { id: 'new', at: '2026-10-08T09:00:00Z' }];
  assert.equal(newestFirst(original)[0].id, 'new'); assert.equal(original[0].id, 'old');
});
test('All mailbox languages cover mock delivery, denied view-as, empty/error and superseded invitations', () => {
  for (const locale of ['en', 'ar', 'de', 'fr', 'it']) {
    const { Mailbox: copy } = JSON.parse(fs.readFileSync(path.join(root, 'apps/sos/messages/usr', locale, 'mailbox.json'), 'utf8'));
    for (const key of ['title', 'description', 'readOnlyTitle', 'readOnlyBody', 'emptyTitle', 'failedBody']) assert.equal(typeof copy[key], 'string');
    assert.equal(typeof copy.status.superseded, 'string'); assert.equal(typeof copy.sender.copyFallback, 'string');
  }
});
