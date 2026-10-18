const test = require('node:test');
const assert = require('node:assert/strict');
const { filesPolicy } = require('./workspace-files-policy');
function fixture() {
  const workspace = { id: 'one', state: 'active', lines: [{ tool: 'files', planId: 'pro', state: 'active' }] };
  const plan = { id: 'pro', limits: { 'files.storage_gb': 2.5 }, flags: { 'files.share_links': true } };
  return { workspace, plan, S: { workspace: id => id === 'one' ? workspace : null, db: { plans: [plan] } }, context: { workspace: { id: 'one' }, actor: { readOnly: false }, tools: { files: { canWrite: true } } } };
}
test('Files policy follows current canonical limits and billing without lifting a role', () => {
  const { S, workspace, plan, context } = fixture();
  assert.equal(filesPolicy(S, 'one', context).storageBytes, 2.5 * 1024 ** 3);
  assert.equal(filesPolicy(S, 'one', context).canWrite, true);
  plan.limits['files.storage_gb'] = 5;
  assert.equal(filesPolicy(S, 'one', context).storageBytes, 5 * 1024 ** 3);
  context.tools.files.canWrite = false;
  assert.equal(filesPolicy(S, 'one', context).canWrite, false);
  workspace.lines[0].state = 'read_only';
  assert.equal(filesPolicy(S, 'one', context).canAcceptSamples, false);
});
test('Files policy keeps preview, unknown limit and foreign actor writes unavailable', () => {
  const { S, plan, context } = fixture();
  context.actor.readOnly = true;
  assert.equal(filesPolicy(S, 'one', context).canAcceptSamples, false);
  assert.equal(filesPolicy(S, 'one', null).canWrite, false);
  assert.equal(filesPolicy(S, 'one', { ...context, workspace: { id: 'other' } }).canWrite, false);
  plan.limits['files.storage_gb'] = Number.MAX_VALUE;
  assert.equal(filesPolicy(S, 'one', null).storageBytes, null);
  assert.equal(filesPolicy(S, 'one', null).canAcceptSamples, false);
  assert.equal(filesPolicy(S, 'missing', null).billingReadOnly, true);
});
