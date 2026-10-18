// Every API request the mocks answer, oldest first.
//
// The last 2,000 are kept in memory for GET /__mock/requests, and all of them are appended
// to logs/requests.jsonl. The audit kit uses them to see which endpoints a flow step hit,
// who made the call, and what came back. This module is never reloaded by a reset.

const fs = require("fs");
const path = require("path");

const MAX = 2000;
const FILE = path.join(require("../config").dataDir, "logs", "requests.jsonl");
const rows = [];
let seq = 0;

// Start each run with a fresh file once it gets large.
try {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  if (fs.existsSync(FILE) && fs.statSync(FILE).size > 20 * 1024 * 1024) fs.writeFileSync(FILE, "");
} catch {
  /* logging is best effort */
}

// Who made the call: the email in the bearer token, if there is one. The tokens are unsigned
// local ones, so decoding them here is enough.
function actor(req) {
  try {
    let t = req.headers.authorization || "";
    if (t.toLowerCase().startsWith("bearer ")) t = t.slice(7);
    t = t.trim().replace(/^"|"$/g, "");
    if (t.startsWith("{")) t = JSON.parse(t).accessToken || "";
    if (!t) return null;
    const p = JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString("utf8"));
    return p.email || (p.sub != null ? String(p.sub) : null);
  } catch {
    return null;
  }
}

function record(entry) {
  const row = { seq: ++seq, ...entry };
  rows.push(row);
  if (rows.length > MAX) rows.shift();
  fs.appendFile(FILE, JSON.stringify(row) + "\n", () => {});
  return row;
}

// list({ since, app, user, status, limit })
//   status: an exact code ("404") or a class ("4xx", "5xx")
function list({ since = 0, app, user, status, limit = 200 } = {}) {
  const cls = /^[1-5]xx$/i.test(String(status || "")) ? Number(String(status)[0]) : null;
  const out = rows.filter(
    (r) =>
      r.seq > Number(since || 0) &&
      (!app || r.app === app) &&
      (!user || r.user === user) &&
      (!status || (cls ? Math.floor(r.status / 100) === cls : String(r.status) === String(status))),
  );
  return out.slice(-Math.max(1, Math.min(Number(limit) || 200, MAX)));
}

const lastSeq = () => seq;

module.exports = { record, list, lastSeq, actor, FILE };
