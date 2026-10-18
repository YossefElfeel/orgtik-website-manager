const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const ROOT = path.resolve(__dirname, '../..');
const ts = require(require.resolve('typescript', { paths: [path.join(ROOT, 'apps/sos')] }));
function load(file, window = {}) { const module = { exports: {} }; vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(ROOT, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module, exports: module.exports, window }); return module.exports; }
const seats = load('apps/sos/components/workspace/team/seats.ts');
const tool = (key, state = 'active') => ({ key, state, line: { id: key } });
const counts = { tasks: { capacity: 3, assigned: 1, reserved: 1, available: 1 }, files: { capacity: null, assigned: 9, reserved: 4, available: null }, hr: { capacity: 2, assigned: 1, reserved: 0, available: 1 }, marketing: { capacity: 0, assigned: 0, reserved: 0, available: 0 } };
const plain = value => JSON.parse(JSON.stringify(value));
test('Team null selection contains only supported current subscriptions and guests exclude HR without free-seat bypass', () => {
  const choices = [tool('tasks'), tool('files'), tool('hr'), tool('marketing', 'coming_soon'), tool('wm'), tool('future')];
  assert.deepEqual(plain(seats.selection(choices, counts, 'guest', null)), ['tasks', 'files']);
  assert.deepEqual(plain(seats.selection(choices, counts, 'member', null)), ['tasks', 'files', 'hr']);
  const exhausted = { ...counts, tasks: { ...counts.tasks, available: 0 } };
  assert.deepEqual(plain(seats.unavailableCapacity(exhausted, ['tasks', 'files'])), ['tasks']);
  assert.deepEqual(plain(seats.unavailableCapacity(exhausted, ['tasks'], ['tasks'])), []);
});
test('Pending invitation attempts survive reload with exact reference/body and stay isolated by realm/workspace/actor', () => {
  const saved = new Map(), window = { sessionStorage: { getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) } };
  const first = load('apps/sos/components/workspace/team/attempts.ts', window), key = first.attemptNamespace('realm', 'one', 1);
  first.saveAttempt(key, { operationId: 'original-attempt', email: 'fixture@test.invalid', role: 'guest', tools: ['tasks'], uncertain: true, accessToken: 'must-not-store' });
  const afterReload = load('apps/sos/components/workspace/team/attempts.ts', window);
  assert.deepEqual(plain(afterReload.readAttempt(key)), { operationId: 'original-attempt', email: 'fixture@test.invalid', role: 'guest', tools: ['tasks'], uncertain: true });
  assert.equal(afterReload.readAttempt(afterReload.attemptNamespace('realm', 'two', 1)), null);
  assert.equal(afterReload.readAttempt(afterReload.attemptNamespace('realm', 'one', 2)), null);
  assert.equal(saved.get(key).includes('must-not-store'), false);
  assert.equal(afterReload.uncertainResult({ status: 503 }), true); assert.equal(afterReload.uncertainResult({ status: 'offline' }), true); assert.equal(afterReload.uncertainResult({ status: 422 }), false);
  afterReload.saveAttempt(key, null); assert.equal(afterReload.readAttempt(key), null);
});
test('Team copy describes reservations and mock delivery in every language, without legacy free-guest or automatic-charge claims', () => {
  for (const locale of ['en', 'ar', 'de', 'fr', 'it']) {
    const { Team: text } = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps/sos/messages/usr', locale, 'team.json'), 'utf8'));
    assert.equal(text.seatGuest, undefined); assert.equal(text.invite.sentSeats, undefined); assert.equal(text.cost.total, undefined);
    for (const key of ['purchased', 'assigned', 'reserved', 'available']) assert.equal(typeof text.seats[key], 'string');
    assert.equal(typeof text.invite.sentReserved, 'string'); assert.equal(typeof text.invite.uncertain, 'string');
  }
});
