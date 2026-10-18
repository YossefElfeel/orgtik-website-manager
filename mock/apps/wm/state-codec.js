const copy = value => JSON.parse(JSON.stringify(value));
const fail = message => Object.assign(new Error(message), { status: 503, code: "wm_state_unavailable" });
function mapRows(value, { ids = true } = {}) {
  if (!Array.isArray(value)) throw fail("A Website Manager collection is missing.");
  const keys = new Set();
  for (const entry of value) {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "string" || !entry[1] || typeof entry[1] !== "object" || Array.isArray(entry[1]) || keys.has(entry[0]) || ids && String(entry[1].id) !== entry[0]) throw fail("A Website Manager collection is invalid.");
    keys.add(entry[0]);
  }
  return copy(value);
}
function replaceMap(target, rows) { target.clear(); for (const [key, row] of rows) target.set(key, row); }
function object(value) { if (!value || typeof value !== "object" || Array.isArray(value)) throw fail("A Website Manager object is missing."); return copy(value); }
function replaceObject(target, value) { for (const key of Object.keys(target)) delete target[key]; Object.assign(target, value); }
function sequence(value, rows, prefix) {
  const highest = rows.reduce((max, [key]) => Math.max(max, Number(key.match(new RegExp(`^${prefix}_(\\d+)$`))?.[1]) || 0), 0);
  if (!Number.isSafeInteger(value) || value < 1 || value <= highest) throw fail("A Website Manager sequence would reuse an ID.");
  return value;
}
module.exports = { copy, fail, mapRows, replaceMap, object, replaceObject, sequence };
