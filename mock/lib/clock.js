// The mock backend's clock.
//
// Every date in the mocks comes from `new Date()` or `Date.now()`: seed data, createdAt,
// "2 hours ago" labels, token expiry. Replacing the global Date therefore controls all of
// them at once, with no change to the app modules.
//
//   MOCK_NOW=2026-09-29T09:00:00+03:00   start the clock at this instant (it keeps running)
//   MOCK_CLOCK=frozen                     stop it: every request sees the same instant
//   neither                               real time, as before
//
// At runtime: GET/POST /__mock/clock and POST /__mock/clock/advance (see server.js).
// This module is never reloaded by a reset, so the clock survives it.

const crypto = require("crypto");

const RealDate = Date;
const realRandom = Math.random;
const realRandomUUID = crypto.randomUUID;
const realRandomBytes = crypto.randomBytes;

let anchorMock = null; // ms: the mock instant at the moment it was set
let anchorReal = null; // ms: real time at that moment
let frozen = false;

// A pinned run (the seed build, one recorded change, or its replay) sees one fixed instant and a
// seeded random sequence, so replaying a change later, on another instance, gives the same ids and
// dates. The pin is process-wide while it lasts: the journal (server.js) handles one request at a
// time whenever it is on, so nothing else runs during a pinned run.
let pin = null;
const pinned = { getStore: () => pin };

function seededRandom(seed) {
  // mulberry32 over a 32-bit hash of the seed string
  let h = 1779033703 ^ String(seed).length;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 3432918353), (h = (h << 13) | (h >>> 19));
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// fn may return a promise: the pin lasts until it settles.
function runPinned({ at, seed }, fn) {
  const prev = pin;
  pin = { at: Number(at), rng: seededRandom(seed ?? at) };
  let out;
  try {
    out = fn();
  } catch (e) {
    pin = prev;
    throw e;
  }
  if (out && typeof out.then === "function") return Promise.resolve(out).finally(() => { pin = prev; });
  pin = prev;
  return out;
}
const isPinned = () => Boolean(pin);

function now() {
  const p = pinned.getStore();
  if (p) return p.at;
  if (anchorMock == null) return RealDate.now();
  return frozen ? anchorMock : anchorMock + (RealDate.now() - anchorReal);
}

function parseInstant(value) {
  const ms = typeof value === "number" ? value : RealDate.parse(value);
  if (!Number.isFinite(ms)) throw new Error(`Not a date: ${value}`);
  return ms;
}

function status() {
  const mode = anchorMock == null ? "real" : frozen ? "frozen" : "shifted";
  return {
    mode,
    now: new RealDate(now()).toISOString(),
    realNow: new RealDate(RealDate.now()).toISOString(),
    offsetMinutes: mode === "real" ? 0 : Math.round((now() - RealDate.now()) / 60000),
  };
}

// set({ now: "2026-09-29T09:00:00Z" | ms | "real", frozen: true|false })
function set({ now: when, frozen: freeze } = {}) {
  if (when === "real" || when === null) {
    anchorMock = null;
    anchorReal = null;
    frozen = false;
    return status();
  }
  anchorMock = when === undefined ? now() : parseInstant(when);
  anchorReal = RealDate.now();
  if (freeze !== undefined) frozen = Boolean(freeze);
  return status();
}

// Moves the clock on by ms, keeping it frozen or running as it was.
function advance(ms) {
  if (!Number.isFinite(ms)) throw new Error("advance needs a number of milliseconds");
  anchorMock = now() + ms;
  anchorReal = RealDate.now();
  return status();
}

function install() {
  if (globalThis.Date.__mockClock) return;
  // A plain function rather than a class, so the rare `Date()` call without `new` still works.
  function MockDate(...args) {
    if (!new.target) return new RealDate(now()).toString();
    return args.length === 0 ? new RealDate(now()) : new RealDate(...args);
  }
  MockDate.prototype = RealDate.prototype;
  Object.setPrototypeOf(MockDate, RealDate);
  MockDate.now = now;
  MockDate.parse = RealDate.parse;
  MockDate.UTC = RealDate.UTC;
  MockDate.__mockClock = true;
  globalThis.Date = MockDate;

  Math.random = () => {
    const p = pinned.getStore();
    return p ? p.rng() : realRandom();
  };
  crypto.randomBytes = function randomBytes(size, cb) {
    const p = pinned.getStore();
    if (!p) return realRandomBytes.apply(crypto, arguments);
    const buf = Buffer.alloc(size);
    for (let i = 0; i < size; i++) buf[i] = Math.floor(p.rng() * 256);
    if (typeof cb === "function") return void process.nextTick(cb, null, buf);
    return buf;
  };
  crypto.randomUUID = function randomUUID(options) {
    const p = pinned.getStore();
    if (!p) return realRandomUUID.call(crypto, options);
    const b = crypto.randomBytes(16);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = b.toString("hex");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  };

  const env = process.env;
  if (env.MOCK_NOW) set({ now: env.MOCK_NOW, frozen: env.MOCK_CLOCK === "frozen" });
  else if (env.MOCK_CLOCK === "frozen") set({ now: RealDate.now(), frozen: true });
}

// The clock's settings, to keep them in the journal's meta record and restore them elsewhere.
function exportState() {
  if (anchorMock == null) return { mode: "real" };
  return frozen ? { mode: "frozen", at: anchorMock } : { mode: "shifted", offset: anchorMock - anchorReal };
}
function importState(s) {
  if (!s || s.mode === "real") return set({ now: "real" });
  if (s.mode === "frozen") return set({ now: s.at, frozen: true });
  return set({ now: RealDate.now() + s.offset, frozen: false });
}

module.exports = { install, now, status, set, advance, RealDate, runPinned, isPinned, exportState, importState };
