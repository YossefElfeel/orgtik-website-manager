const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createBusinessCalendar } = require('./business-calendar');
test('calendar days preserve wall time across DST instead of adding24 hours', () => {
  const calendar = createBusinessCalendar('Europe/Berlin');
  const start = Date.parse('2026-03-28T12:00:00Z'), next = calendar.addCalendarDays(start, 1);
  assert.equal(next - start, 23 * 3600000);
  assert.equal(calendar.parts(start).hour, calendar.parts(next).hour);
});
test('missing wall time is rejected and overlapping time chooses earliest instant', () => {
  const calendar = createBusinessCalendar('Europe/Berlin');
  assert.throws(() => calendar.fromWall({ year: 2026, month: 3, day: 29, hour: 2, minute: 30 }), { code: 'invalid_local_time' });
  assert.equal(calendar.iso(calendar.fromWall({ year: 2026, month: 10, day: 25, hour: 2, minute: 30 })), '2026-10-25T00:30:00.000Z');
});
