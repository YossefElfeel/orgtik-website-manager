// Shared helpers for the sales mock: ids, localisation, money, request context, PDF/PNG files.
const crypto = require("crypto");
const zlib = require("zlib");
const { CURRENCIES } = require("./reference");

// ---------------------------------------------------------------- ids
// Deterministic UUID-shaped ids so seeded links stay stable across restarts.
function uid(ns, n) {
  const h = crypto.createHash("md5").update(`orgtik-sales:${ns}:${n}`).digest("hex");
  const variant = ((parseInt(h[16], 16) & 3) | 8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
const newId = () => crypto.randomUUID();
const token = (n = 24) => crypto.randomBytes(n).toString("base64url");

// ---------------------------------------------------------------- dates
const DAY = 864e5;
const now = () => new Date();
const iso = (d) => new Date(d).toISOString();
const daysAgo = (n, hours = 0) => new Date(Date.now() - n * DAY - hours * 36e5).toISOString();
const daysAhead = (n, hours = 0) => new Date(Date.now() + n * DAY + hours * 36e5).toISOString();
const dateOnly = (d) => new Date(d).toISOString().slice(0, 10);
function addMonths(d, months) {
  const x = new Date(d);
  const day = x.getUTCDate();
  x.setUTCDate(1);
  x.setUTCMonth(x.getUTCMonth() + months);
  const last = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate();
  x.setUTCDate(Math.min(day, last));
  return x.toISOString();
}
const daysBetween = (a, b) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthKey = (d) => { const x = new Date(d); return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}`; };
function shortDate(d) {
  const x = new Date(d);
  return `${MONTHS[x.getUTCMonth()]} ${x.getUTCDate()}, ${x.getUTCFullYear()}`;
}

// ---------------------------------------------------------------- localisation
const LANGS = ["en", "ar", "de", "fr", "it"];
const L = (en, ar, de, fr, it) => {
  const o = { en };
  if (ar) o.ar = ar;
  if (de) o.de = de;
  if (fr) o.fr = fr;
  if (it) o.it = it;
  return o;
};
function langOf(req) {
  const raw = String(req.headers["accept-language"] || "en").toLowerCase();
  const code = raw.split(",")[0].trim().slice(0, 2);
  return LANGS.includes(code) ? code : "en";
}
function text(value, lang = "en") {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return (value[lang] && value[lang].trim()) || (value.en && value.en.trim()) || Object.values(value).find((v) => v && String(v).trim()) || "";
}
// Validates / normalises a localized map from a request body. Returns { value } or { error }.
function cleanLocalized(input, { required = false, field = "name" } = {}) {
  if (input == null) return required ? { error: `${field} needs at least one language` } : { value: undefined };
  if (typeof input === "string") input = { en: input };
  if (typeof input !== "object") return { error: `${field} must be a translation map` };
  const out = {};
  for (const [k, v] of Object.entries(input)) {
    if (!LANGS.includes(k)) return { error: `Unsupported language "${k}" in ${field}` };
    if (v == null) continue;
    const s = String(v).trim();
    if (!s) continue;
    out[k] = s;
  }
  if (required && Object.keys(out).length === 0) return { error: `${field} needs at least one language` };
  return { value: out };
}
const mergeLocalized = (existing, patch) => ({ ...(existing || {}), ...(patch || {}) });

// ---------------------------------------------------------------- money
const cur = (code) => CURRENCIES[code] || { code, name: code, symbol: code, minorUnits: 2, usdRate: null };
const minor = (code) => cur(code).minorUnits ?? 2;
const round = (n, code = "USD") => {
  const f = 10 ** minor(code);
  return Math.round((Number(n) || 0) * f) / f;
};
const money = (n, code = "USD") => round(n, code).toFixed(minor(code));
const num = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const x = Number(String(v ?? "").replace(/,/g, ""));
  return Number.isFinite(x) ? x : 0;
};
function convert(amount, from, to) {
  if (!from || !to || from === to) return num(amount);
  const f = cur(from).usdRate;
  const t = cur(to).usdRate;
  if (!f || !t) return num(amount);
  return (num(amount) / num(f)) * num(t);
}
const toUsd = (amount, from) => convert(amount, from, "USD");
function fmtMoney(amount, code) {
  const d = minor(code);
  return `${code} ${round(amount, code).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
}
const pct = (n) => Math.round((Number(n) || 0) * 100) / 100;
function growth(current, previous) {
  if (!previous) return current ? 100 : 0;
  return pct(((current - previous) / previous) * 100);
}

// ---------------------------------------------------------------- query helpers
function listParam(v) {
  if (v == null || v === "") return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.flatMap((x) => String(x).split(",")).map((s) => s.trim()).filter(Boolean);
}
function boolParam(v) {
  if (v === undefined || v === null || v === "") return undefined;
  if (v === true || v === "true" || v === "1") return true;
  if (v === false || v === "false" || v === "0") return false;
  return undefined;
}
const sortDesc = (list, key = "createdAt") => [...list].sort((a, b) => String(b[key] || "").localeCompare(String(a[key] || "")));

// ---------------------------------------------------------------- files: PDF & PNG
const pdfSafe = (s) =>
  String(s ?? "")
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

// Minimal multi-page PDF (Helvetica). `lines` entries are strings or { text, bold, size, gap }.
function makePdf(title, lines, { subtitle } = {}) {
  const pages = [];
  let items = [];
  let y = 0;
  const pageHeight = 842;
  const startY = 790;
  const bottom = 60;
  const flush = () => { pages.push(items); items = []; };
  let first = true;
  const header = () => {
    items.push({ t: title, x: 50, y: startY, f: "F2", s: 18 });
    let yy = startY - 20;
    if (subtitle && first) { items.push({ t: subtitle, x: 50, y: yy, f: "F1", s: 10 }); yy -= 14; }
    items.push({ line: true, y: yy + 4 });
    return yy - 18;
  };
  y = header();
  first = false;
  for (const raw of lines) {
    const l = typeof raw === "string" ? { text: raw } : raw;
    const size = l.size || 11;
    const gap = l.gap ?? size + 5;
    if (y - gap < bottom) { flush(); y = header(); }
    if (l.text === "---") { items.push({ line: true, y: y + 6 }); y -= 10; continue; }
    items.push({ t: l.text ?? "", x: l.x ?? 50, y, f: l.bold ? "F2" : "F1", s: size });
    if (l.right != null) items.push({ t: l.right, x: 430, y, f: l.bold ? "F2" : "F1", s: size });
    y -= gap;
  }
  flush();

  const objects = [];
  const add = (body) => { objects.push(body); return objects.length; };
  const catalogId = add(null);
  const pagesId = add(null);
  const f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const pageIds = [];
  pages.forEach((items, idx) => {
    const ops = [];
    for (const it of items) {
      if (it.line) ops.push(`0.8 0.8 0.85 RG 1 w 50 ${it.y} m 545 ${it.y} l S`);
      else ops.push(`BT /${it.f} ${it.s} Tf 0.12 0.12 0.2 rg ${it.x} ${it.y} Td (${pdfSafe(it.t)}) Tj ET`);
    }
    ops.push(`BT /F1 8 Tf 0.5 0.5 0.55 rg 50 30 Td (${pdfSafe(`OrgTik Sales - local mock document - page ${idx + 1} of ${pages.length}`)}) Tj ET`);
    const stream = ops.join("\n");
    const contentId = add(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
    const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 ${pageHeight}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((p) => `${p} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let out = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

// Small valid PNG (solid background with a darker band) used for seeded ID scans.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function makePng(width = 320, height = 200, rgb = [129, 53, 205]) {
  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    for (let x = 0; x < width; x++) {
      const band = y > height * 0.62 && y < height * 0.78;
      const photo = x > width * 0.07 && x < width * 0.3 && y > height * 0.15 && y < height * 0.55;
      const f = band ? 0.55 : photo ? 0.75 : 1;
      const light = band || photo ? 0 : 0.35;
      row[1 + x * 3] = Math.min(255, Math.round(rgb[0] * f + 255 * light * (1 - f + 0.5)));
      row[2 + x * 3] = Math.min(255, Math.round(rgb[1] * f + 255 * light * (1 - f + 0.5)));
      row[3 + x * 3] = Math.min(255, Math.round(rgb[2] * f + 255 * light * (1 - f + 0.5)));
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = zlib.deflateSync(Buffer.concat(rows));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pngChunk("IHDR", ihdr), pngChunk("IDAT", idat), pngChunk("IEND", Buffer.alloc(0))]);
}

module.exports = {
  uid, newId, token,
  DAY, now, iso, daysAgo, daysAhead, dateOnly, addMonths, daysBetween, MONTHS, monthKey, shortDate,
  LANGS, L, langOf, text, cleanLocalized, mergeLocalized,
  cur, minor, round, money, num, convert, toUsd, fmtMoney, pct, growth,
  listParam, boolParam, sortDesc,
  makePdf, makePng,
};
