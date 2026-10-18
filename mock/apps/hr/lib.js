// Shared helpers for the HR mock: Cairo time math, formatting, envelopes, role checks.
const { ok, fail, paginate, nowIso } = require("../../lib/util");

let TZ = "Africa/Cairo";
let calendar = null;
const DAY_MS = 864e5;

// ---------- dates (all "YYYY-MM-DD" strings are Cairo calendar dates) ----------
const pad = (n, w = 2) => String(n).padStart(w, "0");
const ymd = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

let dtf = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
});
function configureClock(clock) {
  calendar = clock;
  TZ = clock.timeZone || "Africa/Cairo";
  dtf = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function cairoParts(date = new Date()) {
  if (calendar?.parts) {
    const p = calendar.parts(date.getTime());
    return { y: p.year, m: p.month, d: p.day, h: p.hour, mi: p.minute, s: p.second };
  }
  const p = {};
  for (const { type, value } of dtf.formatToParts(date)) p[type] = value;
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second };
}
// Offset of Cairo from UTC (minutes) at a given instant (DST aware via Intl).
function cairoOffsetMin(date) {
  const p = cairoParts(date);
  return Math.round((Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}
// Cairo wall-clock time -> Date.
function cairoDate(dateStr, hh = 0, mm = 0, ss = 0) {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (calendar?.fromWall) return new Date(calendar.fromWall({ year: y, month: m, day: d, hour: hh, minute: mm, second: ss }));
  const guess = Date.UTC(y, m - 1, d, hh, mm, ss);
  let off = cairoOffsetMin(new Date(guess));
  let t = guess - off * 60000;
  const off2 = cairoOffsetMin(new Date(t));
  if (off2 !== off) t = guess - off2 * 60000;
  return new Date(t);
}
const cairoIso = (dateStr, hh = 0, mm = 0, ss = 0) => cairoDate(dateStr, hh, mm, ss).toISOString();
const todayStr = () => { const p = cairoParts(); return ymd(p.y, p.m, p.d); };
// Cairo date of an ISO instant.
function dateOf(iso) {
  if (!iso) return null;
  const p = cairoParts(new Date(iso));
  return ymd(p.y, p.m, p.d);
}
function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + n * DAY_MS);
  return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}
// 0 = Sunday ... 6 = Saturday
function weekday(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
// ISO weekday: 1 = Monday ... 7 = Sunday (what the configuration screen uses)
const isoWeekday = (dateStr) => weekday(dateStr) || 7;
function daysBetween(a, b) {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY_MS);
}
function dateRange(from, to) {
  const out = [];
  if (!from || !to || from > to) return out;
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
const monthStart = (dateStr) => `${dateStr.slice(0, 7)}-01`;
function monthEnd(dateStr) {
  const [y, m] = dateStr.split("-").map(Number);
  return ymd(y, m, new Date(Date.UTC(y, m, 0)).getUTCDate());
}
const daysInMonth = (dateStr) => Number(monthEnd(dateStr).slice(8));
const weekStartSun = (dateStr) => addDays(dateStr, -weekday(dateStr));
const weekStartMon = (dateStr) => addDays(dateStr, -((weekday(dateStr) + 6) % 7));

// Accepts "YYYY-MM-DD", "DD-MM-YYYY", "DD/MM/YYYY" or any ISO string -> "YYYY-MM-DD" (Cairo date).
function normDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  let m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) return ymd(+m[3], +m[2], +m[1]);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})T/);
  if (m) {
    // Midnight-UTC ISO strings are date pickers talking; keep their calendar date.
    if (/T00:00:00(\.000)?Z$/.test(s)) return `${m[1]}-${m[2]}-${m[3]}`;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? `${m[1]}-${m[2]}-${m[3]}` : dateOf(d.toISOString());
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : dateOf(d.toISOString());
}
// "YYYY-MM-DD" -> "DD-MM-YYYY" (configuration screen format)
const toDmy = (dateStr) => (dateStr ? `${dateStr.slice(8, 10)}-${dateStr.slice(5, 7)}-${dateStr.slice(0, 4)}` : "");

// ---------- formatting ----------
function clock12(iso) {
  if (!iso) return "-";
  const p = cairoParts(new Date(iso));
  const h = p.h % 12 || 12;
  return `${pad(h)}:${pad(p.mi)} ${p.h < 12 ? "AM" : "PM"}`;
}
function hhmm(iso) {
  const p = cairoParts(new Date(iso));
  return `${pad(p.h)}:${pad(p.mi)}`;
}
const durLabel = (sec) => `${Math.floor(sec / 3600)}h ${pad(Math.floor((sec % 3600) / 60))}m`;
const hmsLabel = (sec) => `${pad(Math.floor(sec / 3600))}:${pad(Math.floor((sec % 3600) / 60))}:${pad(Math.floor(sec % 60))}`;
const pct = (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const money = (n) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MON3 = MONTHS.map((m) => m.slice(0, 3));
const labelize = (s) => String(s || "").replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const bool = (v) => v === true || v === "true" || v === "1" || v === 1;

// ---------- envelopes ----------
const send = ok;
const err = (res, status, message) => fail(res, status, message, { error: message });
function pageOf(list, q, defaultLimit = 10) {
  return paginate(list, q, { defaultLimit });
}
function paged(res, list, q, message = "Fetched successfully", extra = {}) {
  const { items, meta } = pageOf(list, q);
  return ok(res, { items, meta, ...extra }, message);
}

// ---------- sorting ----------
function sortBy(list, key, order = "DESC", getter) {
  const dir = String(order).toUpperCase() === "ASC" ? 1 : -1;
  const get = getter || ((x) => x[key]);
  return [...list].sort((a, b) => {
    const va = get(a), vb = get(b);
    if (va === vb) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return va > vb ? dir : -dir;
  });
}

module.exports = {
  get TZ() { return TZ; }, configureClock, pad, ymd, cairoParts, cairoDate, cairoIso, todayStr, dateOf, addDays, weekday, isoWeekday, daysBetween, dateRange,
  monthStart, monthEnd, daysInMonth, weekStartSun, weekStartMon, normDate, toDmy,
  clock12, hhmm, durLabel, hmsLabel, pct, round2, money, MONTHS, MON3, labelize, num, bool,
  send, err, pageOf, paged, sortBy, nowIso,
};
