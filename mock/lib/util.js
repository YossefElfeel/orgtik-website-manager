// Small helpers shared by the mock app modules.

const nowIso = () => new Date().toISOString();

// ISO date relative to now: daysFromNow(-3) = three days ago.
const daysFromNow = (days, hours = 0) => new Date(Date.now() + days * 864e5 + hours * 36e5).toISOString();

// "2 hours ago"-style label, matching the *TimeAgo fields some APIs return.
function timeAgo(iso) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  const abs = Math.abs(s);
  const units = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
  for (const [name, secs] of units) {
    const n = Math.floor(abs / secs);
    if (n >= 1) return s >= 0 ? `${n} ${name}${n > 1 ? "s" : ""} ago` : `in ${n} ${name}${n > 1 ? "s" : ""}`;
  }
  return "just now";
}

// Page/limit pagination. Returns { items, meta } with the common meta field names.
function paginate(list, query = {}, { pageKey = "page", limitKey = "limit", defaultLimit = 10 } = {}) {
  const page = Math.max(1, parseInt(query[pageKey], 10) || 1);
  const limit = Math.max(1, parseInt(query[limitKey], 10) || defaultLimit);
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const items = list.slice((page - 1) * limit, page * limit);
  return {
    items,
    meta: {
      page, limit, total, totalItems: total, totalPages, currentPage: page, itemCount: items.length,
      itemsPerPage: limit, hasNextPage: page < totalPages, hasPreviousPage: page > 1,
      hasNext: page < totalPages, hasPrev: page > 1,
    },
  };
}

// Case-insensitive search over the given fields (supports nested "a.b" paths).
function search(list, q, fields) {
  if (!q) return list;
  const needle = String(q).toLowerCase();
  const get = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
  return list.filter((item) => fields.some((f) => String(get(item, f) ?? "").toLowerCase().includes(needle)));
}

// Tiny in-memory collection with numeric ids.
function createStore(items = [], { idKey = "id", now = nowIso } = {}) {
  const rows = items.map((r) => ({ ...r }));
  let nextId = rows.reduce((m, r) => Math.max(m, Number(r[idKey]) || 0), 0) + 1;
  return {
    rows,
    all: () => rows,
    find: (id) => rows.find((r) => String(r[idKey]) === String(id)),
    where: (fn) => rows.filter(fn),
    insert(data) {
      const row = { [idKey]: nextId++, createdAt: now(), updatedAt: now(), ...data };
      const explicitId = Number(row[idKey]);
      if (Number.isSafeInteger(explicitId) && explicitId >= nextId) nextId = explicitId + 1;
      rows.push(row);
      return row;
    },
    update(id, patch) {
      const row = rows.find((r) => String(r[idKey]) === String(id));
      if (!row) return null;
      Object.assign(row, patch, { updatedAt: now() });
      return row;
    },
    remove(id) {
      const i = rows.findIndex((r) => String(r[idKey]) === String(id));
      return i === -1 ? null : rows.splice(i, 1)[0];
    },
    nextId: () => nextId,
    exportSnapshot: () => ({ rows: JSON.parse(JSON.stringify(rows)), nextId, idKey }),
    importSnapshot(snapshot) {
      if (!snapshot || snapshot.idKey !== idKey || !Array.isArray(snapshot.rows) || !Number.isSafeInteger(snapshot.nextId)) throw new TypeError("Invalid collection snapshot");
      const minimum = snapshot.rows.reduce((highest, row) => Math.max(highest, Number(row[idKey]) || 0), 0) + 1;
      if (snapshot.nextId < minimum) throw new TypeError("Collection sequence would reuse an ID");
      rows.splice(0, rows.length, ...JSON.parse(JSON.stringify(snapshot.rows)));
      nextId = snapshot.nextId;
      return this;
    },
  };
}

// Standard envelope used by most of these backends: { success, message, data }.
const ok = (res, data = null, message = "Success", status = 200) => res.status(status).json({ success: true, statusCode: status, message, data });
const fail = (res, status = 400, message = "Bad request", extra = {}) => res.status(status).json({ success: false, statusCode: status, message, ...extra });

// Deterministic pseudo-random picks so seed data is stable between restarts.
function seeded(seed = 42) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  return {
    rnd,
    int: (min, max) => Math.floor(rnd() * (max - min + 1)) + min,
    pick: (arr) => arr[Math.floor(rnd() * arr.length)],
    some: (arr, n) => [...arr].sort(() => rnd() - 0.5).slice(0, n),
    exportState: () => s,
    importState(value) {
      if (!Number.isSafeInteger(value) || value < 0 || value >= 2147483647) throw new TypeError("Invalid random sequence");
      s = value;
    },
  };
}

module.exports = { nowIso, daysFromNow, timeAgo, paginate, search, createStore, ok, fail, seeded };
