// Helpers for the Content dashboard mock (content-dashboard-somion-main).
// Envelope: the app's RTK baseApi reads `data` and toasts `msg` on mutations; @somion/gallery reads `data` too.
const LANGS = ["en", "de", "fr", "it"];
const LOCALE_TAG = { en: "en-CH", de: "de-CH", fr: "fr-CH", it: "it-CH" };

// Localized value in the four website languages (en, de, fr, it).
const L = (en, de, fr, it) => ({ en, de: de ?? en, fr: fr ?? en, it: it ?? en });
// Same builder for localized string arrays (tags, keywords).
const LA = (en, de, fr, it) => ({ en, de: de ?? en, fr: fr ?? en, it: it ?? en });
const mapLoc = (loc, fn) => Object.fromEntries(LANGS.map((l) => [l, fn(loc?.[l] ?? "", l)]));

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

const nowIso = () => new Date().toISOString();
const iso = (s) => new Date(s).toISOString();
const daysAgo = (d, h = 0) => new Date(Date.now() - d * 864e5 - h * 36e5).toISOString();

// "2 hours ago" labels (the *TimeAgo fields the real backend returns).
function timeAgo(value) {
  const s = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  const abs = Math.abs(s);
  const units = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [name, secs] of units) {
    const n = Math.floor(abs / secs);
    if (n >= 1) return s >= 0 ? `${n} ${name}${n > 1 ? "s" : ""} ago` : `in ${n} ${name}${n > 1 ? "s" : ""}`;
  }
  return "just now";
}

function send(res, data = null, msg = "Success", status = 200) {
  return res.status(status).json({ success: true, statusCode: status, status: "success", message: msg, msg, data });
}
function fail(res, status = 400, msg = "Bad request", errors) {
  const body = { success: false, statusCode: status, status: "error", message: msg, msg };
  if (errors && Object.keys(errors).length) body.errors = errors;
  return res.status(status).json(body);
}

const intOr = (v, def) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
};

// Page/limit pagination with every meta spelling the app reads
// (blogs/contacts/reviews: page/limit/total/totalPages/hasNext/hasPrev; projects: current_page/per_page/total_pages).
function paginate(list, query = {}, defaultLimit = 10) {
  const limit = Math.min(500, Math.max(1, intOr(query.limit, defaultLimit)));
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.max(1, intOr(query.page, 1));
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

// Language the dashboard asked for (baseApi sends Accept-Language from the NEXT_LOCALE cookie).
function reqLang(req) {
  const raw = String(req.query?.lang || req.headers?.["accept-language"] || "en").toLowerCase();
  const code = raw.split(/[,;\-_]/)[0].trim();
  return LANGS.includes(code) ? code : "en";
}
const tr = (loc, lang = "en") => {
  if (loc == null) return "";
  if (typeof loc !== "object") return String(loc);
  return loc[lang] || loc.en || Object.values(loc).find(Boolean) || "";
};

const bool = (v) => v === true || v === "true" || v === 1 || v === "1";
const has = (obj, k) => obj != null && Object.prototype.hasOwnProperty.call(obj, k);
const splitCsv = (s) => String(s).split(",").map((x) => x.trim()).filter(Boolean);

// Incoming localized string: {en,de,fr,it} (partial allowed) or a plain string (used for every language).
function normLoc(v, fallback) {
  if (v === undefined) return fallback;
  if (v === null) return fallback ?? null;
  if (typeof v === "string" || typeof v === "number") return Object.fromEntries(LANGS.map((l) => [l, String(v)]));
  if (typeof v === "object") {
    const out = {};
    for (const l of LANGS) out[l] = v[l] != null ? String(v[l]) : (fallback?.[l] ?? "");
    return out;
  }
  return fallback;
}
// Incoming localized string arrays: {en:[..]} or a flat array/CSV (used for every language).
function normLocArr(v, fallback) {
  if (v === undefined) return fallback;
  if (v === null) return fallback ?? null;
  if (Array.isArray(v) || typeof v === "string") {
    const arr = normArr(v, []);
    return Object.fromEntries(LANGS.map((l) => [l, [...arr]]));
  }
  if (typeof v === "object") {
    const out = {};
    for (const l of LANGS) out[l] = v[l] !== undefined ? normArr(v[l], []) : (fallback?.[l] ?? []);
    return out;
  }
  return fallback;
}
function normArr(v, fallback) {
  if (v === undefined || v === null) return fallback;
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === "string") return splitCsv(v);
  return fallback;
}
const toId = (v) => {
  if (v === null || v === undefined || v === "" || v === 0 || v === "0") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const locFilled = (loc) => !!loc && LANGS.some((l) => String(loc[l] ?? "").trim());
const locText = (loc) => (loc && typeof loc === "object" ? LANGS.map((l) => loc[l] ?? "").join(" ") : String(loc ?? ""));
const stripHtml = (s) => String(s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

// Case-insensitive search across getters (strings or localized objects).
function matches(q, ...values) {
  if (!q) return true;
  const needle = String(q).trim().toLowerCase();
  if (!needle) return true;
  return values.some((v) => (typeof v === "object" && v ? locText(v) : String(v ?? "")).toLowerCase().includes(needle));
}

const byNewest = (a, b) => new Date(b.createdAt) - new Date(a.createdAt) || b.id - a.id;
const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id - b.id;

// Deterministic pseudo-random numbers so seed data is identical on every start.
function seeded(seed = 7) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  return { rnd, int: (min, max) => Math.floor(rnd() * (max - min + 1)) + min, pick: (arr) => arr[Math.floor(rnd() * arr.length)] };
}

// Minimal in-memory table with numeric ids.
function table(rows = []) {
  const all = rows.map((r) => ({ ...r }));
  let next = all.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0) + 1;
  return {
    rows: all,
    all: () => all,
    find: (id) => all.find((r) => String(r.id) === String(id)),
    where: (fn) => all.filter(fn),
    insert(data) {
      const t = nowIso();
      const row = { id: next++, createdAt: t, updatedAt: t, ...data };
      all.push(row);
      return row;
    },
    update(id, patch) {
      const row = all.find((r) => String(r.id) === String(id));
      if (!row) return null;
      Object.assign(row, patch, { updatedAt: nowIso() });
      return row;
    },
    remove(id) {
      const i = all.findIndex((r) => String(r.id) === String(id));
      return i === -1 ? null : all.splice(i, 1)[0];
    },
  };
}

module.exports = {
  LANGS, LOCALE_TAG, L, LA, mapLoc, slugify, nowIso, iso, daysAgo, timeAgo, send, fail, intOr, paginate,
  reqLang, tr, bool, has, splitCsv, normLoc, normLocArr, normArr, toId, locFilled, locText, stripHtml,
  matches, byNewest, byOrder, seeded, table,
};
