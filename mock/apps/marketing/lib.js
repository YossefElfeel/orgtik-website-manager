// Small helpers used by the marketing mock (ids, dates, envelopes, query params, paging).
const crypto = require("crypto");

// Deterministic UUID (v4-shaped) from any seed string, so seed ids survive restarts.
function uuidFrom(seed) {
  const h = crypto.createHash("md5").update(`marketing:${seed}`).digest("hex");
  const variant = ((parseInt(h[16], 16) & 3) | 8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
const newId = () => crypto.randomUUID();

// Numeric hash (for seeded randomness per entity).
function hashInt(str) {
  let h = 2166136261;
  for (const c of String(str)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return Math.abs(h) || 1;
}
function rng(seed) {
  let s = hashInt(seed) % 2147483647 || 7;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

// ---- dates (local time, anchored to "today") ----
const DAY = 864e5;
let calendar = null;
const configureClock = value => { calendar = value; };
function startOfToday() {
  if (calendar) return new Date(calendar.dayStart());
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
// ISO string for today + dayOffset at hh:mm local time.
function at(dayOffset, hh = 10, mm = 0) {
  if (calendar) {
    const p = calendar.parts(calendar.addCalendarDays(calendar.dayStart(), dayOffset));
    return calendar.iso(calendar.fromWall({ ...p, hour: hh, minute: mm, second: 0 }));
  }
  const d = startOfToday();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}
const nowIso = () => new Date().toISOString();
const ymd = (d) => {
  if (calendar) {
    const p = calendar.parts(new Date(d).getTime());
    return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  }
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
function calendarDay(date, offset = 0, hour = 0, minute = 0, second = 0) {
  const [year, month, day] = String(date).slice(0, 10).split("-").map(Number);
  // Date-only arithmetic uses UTC as a calendar ordinal, never a tenant's instant.
  const normalized = new Date(Date.UTC(year, month - 1, day + offset));
  const p = { year: normalized.getUTCFullYear(), month: normalized.getUTCMonth() + 1, day: normalized.getUTCDate(), hour, minute, second };
  return calendar ? new Date(hour === 0 && minute === 0 && second === 0 ? calendar.dayStart(calendar.fromWall({ ...p, hour: 12 })) : calendar.fromWall(p)) : new Date(p.year, p.month - 1, p.day, hour, minute, second);
}
const weekday = date => {
  const [year, month, day] = String(date).slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
};
const addCalendarDays = (value, count) => {
  if (!Number.isSafeInteger(count)) throw new TypeError("Calendar day count must be an integer");
  if (!calendar) return calendarDay(ymd(value), count);
  const p = calendar.parts(new Date(value).getTime());
  return calendarDay(ymd(value), count, p.hour, p.minute, p.second);
};

// Lenient date parsing: accepts ISO, "YYYY-MM-DDTHH:mm" (local), "2026-10-01Tundefined", "" ...
function parseDate(value, fallback = null) {
  if (value == null || value === "") return fallback;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? fallback : value.toISOString();
  let s = String(value).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})(?:T(.*))?$/);
  if (m) {
    const time = /^\d{2}:\d{2}/.test(m[2] || "") ? m[2] : "09:00";
    s = `${m[1]}T${time.length === 5 ? `${time}:00` : time}`;
    if (calendar && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(s)) {
      const wall = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/);
      if (!wall) return fallback;
      try { return calendar.iso(calendar.fromWall({ year: +wall[1], month: +wall[2], day: +wall[3], hour: +wall[4], minute: +wall[5], second: +(wall[6] || 0) })); }
      catch { return fallback; }
    }
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString();
}

// ---- response envelopes ----
// The app reads data from `data`, success toasts from `msg`, error toasts from `msg || message`.
function send(res, data = null, msg = "Success", status = 200) {
  return res.status(status).json({ success: true, statusCode: status, status: "success", message: msg, msg, data });
}
function error(res, status = 400, msg = "Bad request", extra = {}) {
  return res.status(status).json({ success: false, statusCode: status, status: "error", message: msg, msg, ...extra });
}

// ---- query params ----
// Arrays arrive as "A,B" (RTK Query URLSearchParams), repeated keys, or key[]=.
function listParam(v) {
  if (v == null || v === "") return [];
  if (Array.isArray(v)) return v.flatMap(listParam);
  if (typeof v === "object") return Object.values(v).flatMap(listParam);
  return String(v).split(",").map((s) => s.trim()).filter(Boolean);
}
const boolParam = (v) => (v === undefined || v === null || v === "" ? undefined : v === true || v === "true" || v === "1");
const intParam = (v, d) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : d;
};

// Page/limit paging with every meta spelling this app reads
// (total/totalPages/hasNext for campaigns & gallery, total_pages/per_page for posts/labels/boost).
function paginate(list, query = {}, defaultLimit = 10) {
  const page = intParam(query.page, 1);
  const limit = intParam(query.limit, defaultLimit);
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const items = list.slice((page - 1) * limit, page * limit);
  return {
    items,
    meta: {
      total, page, limit, totalPages, hasNext: page < totalPages, hasPrev: page > 1,
      count: items.length, per_page: limit, current_page: page, total_pages: totalPages,
      totalItems: total, currentPage: page, itemsPerPage: limit, itemCount: items.length,
      hasNextPage: page < totalPages, hasPreviousPage: page > 1,
    },
  };
}

function textMatch(q, ...fields) {
  if (!q) return true;
  const needle = String(q).toLowerCase().trim();
  if (!needle) return true;
  return fields.some((f) => String(f ?? "").toLowerCase().includes(needle));
}

const round = (n, d = 1) => {
  const p = 10 ** d;
  return Math.round(n * p) / p;
};
const pctChange = (cur, prev) => (prev ? round(((cur - prev) / prev) * 100, 1) : cur ? 100 : 0);
const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
const slugify = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";

module.exports = {
  uuidFrom, newId, hashInt, rng, DAY, startOfToday, at, nowIso, ymd, parseDate, configureClock, calendarDay, addCalendarDays, weekday,
  send, error, listParam, boolParam, intParam, paginate, textMatch, round, pctChange, clone, slugify,
};
