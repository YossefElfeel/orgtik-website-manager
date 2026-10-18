const { RealDate } = require("./clock");
function createBusinessCalendar(timeZone = "UTC", now = () => Date.now()) {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const parts = value => Object.fromEntries(formatter.formatToParts(new RealDate(value)).filter(part => part.type !== "literal").map(part => [part.type, Number(part.value)]));
  const wallNumber = value => RealDate.UTC(value.year, value.month - 1, value.day, value.hour || 0, value.minute || 0, value.second || 0, value.millisecond || 0);
  const offset = value => wallNumber(parts(value)) - Math.floor(value / 1000) * 1000;
  function fromWall(value) {
    const wanted = wallNumber(value);
    let guess = wanted;
    for (let n = 0; n < 4; n++) guess = wanted - offset(guess);
    const matches = candidate => {
      const actual = parts(candidate);
      return ["year", "month", "day", "hour", "minute", "second"].every(key => actual[key] === (value[key] || 0));
    };
    // Resolve an overlapping wall time to its earliest real instant. A missing time is invalid.
    const possibilities = Array.from({ length: 17 }, (_, index) => guess + (index - 8) * 900000).filter(matches);
    if (!possibilities.length) throw Object.assign(new Error("This local time does not exist in the workspace timezone."), { status: 422, code: "invalid_local_time" });
    return Math.min(...possibilities);
  }
  function civilDayStart(local) {
    for (let elapsed = 0; elapsed < 240; elapsed++) {
      try { return fromWall({ year: local.year, month: local.month, day: local.day, hour: Math.floor(elapsed / 60), minute: elapsed % 60 }); }
      catch (error) { if (error.code !== "invalid_local_time") throw error; }
    }
    throw Object.assign(new Error("This civil day has no supported start in the workspace timezone."), { status: 422, code: "invalid_local_time" });
  }
  function dayStart(value = now()) {
    return civilDayStart(parts(value));
  }
  function addCalendarDays(value, count) {
    if (!Number.isSafeInteger(count)) throw new TypeError("Calendar day count must be an integer");
    const local = parts(value), normalized = new RealDate(RealDate.UTC(local.year, local.month - 1, local.day + count));
    return fromWall({ ...local, year: normalized.getUTCFullYear(), month: normalized.getUTCMonth() + 1, day: normalized.getUTCDate() });
  }
  return { timeZone, now, parts, fromWall, dayStart, civilDayStart, addCalendarDays, iso: value => new RealDate(value).toISOString() };
}
module.exports = { createBusinessCalendar };
