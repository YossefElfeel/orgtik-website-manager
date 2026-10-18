// Helpers for the file-manager mock: ids, MIME types, ZIP read/write, cookies and
// SVG "page" previews for text-like uploads on the public share page.
const crypto = require("crypto");
const zlib = require("zlib");

// Deterministic UUID-shaped id so seeded folders/files keep the same URL across restarts.
function seedId(name) {
  const h = crypto.createHash("sha1").update(`orgtik-files:${name}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
let counters = { ids: 0, secrets: 0 };
const newId = () => { counters.ids += 1; return crypto.randomUUID(); };
const newSecret = () => { counters.secrets += 1; return crypto.randomBytes(24).toString("base64url"); };
const exportCounters = () => ({ ...counters });
function importCounters(value) {
  if (!value || Object.keys(value).sort().join(",") !== "ids,secrets" || Object.values(value).some(count => !Number.isSafeInteger(count) || count < 0)) throw Object.assign(new Error("Files ID counters are invalid."), { status: 503, code: "invalid_tool_snapshot" });
  counters = { ...value };
}

// "1.8 MB" -> bytes
function parseSize(s) {
  if (typeof s === "number") return s;
  const m = /^([\d.]+)\s*(B|KB|MB|GB)$/i.exec(String(s || "").trim());
  if (!m) return 0;
  const mult = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 }[m[2].toUpperCase()];
  return Math.round(parseFloat(m[1]) * mult);
}

const MIME = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  rtf: "application/rtf",
  odt: "application/vnd.oasis.opendocument.text",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  heic: "image/heic",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  aac: "audio/aac",
  zip: "application/zip",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
  fig: "application/octet-stream",
  sketch: "application/octet-stream",
  psd: "image/vnd.adobe.photoshop",
};
const extOf = (name) => (String(name).split(".").pop() || "").toLowerCase();
function mimeFor(name, given) {
  if (given && given !== "application/octet-stream") return given;
  return MIME[extOf(name)] || given || "application/octet-stream";
}

// Dashboard storage buckets.
function category(mime, name) {
  const m = String(mime || "");
  if (m.startsWith("image/")) return "images";
  if (m.startsWith("video/")) return "videos";
  const ext = extOf(name);
  if (/pdf|msword|officedocument|opendocument|ms-excel|ms-powerpoint|rtf/.test(m) || m.startsWith("text/") || m === "application/json" ||
      ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "md", "rtf", "odt"].includes(ext)) return "documents";
  return "other";
}

// ------------------------------------------------------------------ ZIP
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
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function dosTime(d) {
  const date = d instanceof Date ? d : new Date(d || Date.now());
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}
const STORE_TYPES = /\.(png|jpe?g|gif|webp|mp4|mov|webm|zip|rar|7z|docx|xlsx|pptx|mp3|m4a|fig)$/i;

// entries: [{ name: "Folder/file.pdf" | "Folder/", data?: Buffer, date? }]
function zipBuffer(entries) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const e of entries) {
    const isDir = e.name.endsWith("/");
    const name = Buffer.from(e.name, "utf8");
    const raw = isDir ? Buffer.alloc(0) : e.data || Buffer.alloc(0);
    const deflate = !isDir && raw.length > 64 && !STORE_TYPES.test(e.name);
    const body = deflate ? zlib.deflateRawSync(raw) : raw;
    const crc = isDir ? 0 : crc32(raw);
    const { time, day } = dosTime(e.date);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x0800, 6); // UTF-8 names
    lh.writeUInt16LE(deflate ? 8 : 0, 8);
    lh.writeUInt16LE(time, 10);
    lh.writeUInt16LE(day, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(body.length, 18);
    lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(name.length, 26);
    lh.writeUInt16LE(0, 28);
    locals.push(lh, name, body);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(deflate ? 8 : 0, 10);
    ch.writeUInt16LE(time, 12);
    ch.writeUInt16LE(day, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(body.length, 20);
    ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(isDir ? 0x10 : 0, 38);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, name);
    offset += 30 + name.length + body.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

// Minimal reader: { name -> Buffer } (store + deflate only). Returns null for non-zip input.
function unzip(buf) {
  try {
    let eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
      if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) return null;
    const count = buf.readUInt16LE(eocd + 10);
    let p = buf.readUInt32LE(eocd + 16);
    const out = {};
    for (let n = 0; n < count; n++) {
      if (buf.readUInt32LE(p) !== 0x02014b50) break;
      const method = buf.readUInt16LE(p + 10);
      const csize = buf.readUInt32LE(p + 20);
      const nlen = buf.readUInt16LE(p + 28);
      const xlen = buf.readUInt16LE(p + 30);
      const clen = buf.readUInt16LE(p + 32);
      const lho = buf.readUInt32LE(p + 42);
      const name = buf.slice(p + 46, p + 46 + nlen).toString("utf8");
      const dataStart = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
      const data = buf.slice(dataStart, dataStart + csize);
      if (method === 0) out[name] = data;
      else if (method === 8) out[name] = zlib.inflateRawSync(data);
      p += 46 + nlen + xlen + clen;
    }
    return out;
  } catch {
    return null;
  }
}

const decodeXml = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&amp;/g, "&");

// Paragraph texts of a .docx (for previews of uploaded Word files).
function docxParagraphs(buf) {
  const parts = unzip(buf);
  const xml = parts?.["word/document.xml"]?.toString("utf8");
  if (!xml) return null;
  const paras = [];
  for (const p of xml.split(/<\/w:p>/)) {
    const texts = [...p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => decodeXml(m[1]));
    if (/<w:tab\/>/.test(p) && !texts.length) continue;
    paras.push({ text: texts.join(""), rtl: /<w:bidi\/>|<w:rtl\/>/.test(p), heading: /w:pStyle w:val="(Heading|Title)/.test(p) });
  }
  return paras;
}

// ------------------------------------------------------------------ SVG pages
const escXml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const isArabic = (s) => /[\u0600-\u06FF]/.test(s);

function wrap(text, max) {
  const out = [];
  for (const raw of String(text).replace(/\t/g, "    ").split(/\r?\n/)) {
    if (raw.length <= max) { out.push(raw); continue; }
    let line = "";
    for (const word of raw.split(" ")) {
      if ((line + " " + word).trim().length > max) {
        if (line) out.push(line);
        line = word.length > max ? word.slice(0, max) : word;
      } else line = (line ? line + " " : "") + word;
    }
    if (line) out.push(line);
  }
  return out;
}

// lines: [{ text, rtl?, bold?, mono? }] -> array of SVG documents (A4-ish 794 x 1123)
function svgPages(title, lines, { mono = false } = {}) {
  const W = 794, H = 1123, perPage = 44, lh = 22;
  const pages = [];
  for (let i = 0; i < Math.max(1, lines.length); i += perPage) pages.push(lines.slice(i, i + perPage));
  return pages.map((chunk, idx) => {
    const rows = chunk.map((l, k) => {
      const y = 150 + k * lh;
      const rtl = l.rtl || isArabic(l.text);
      const attrs = rtl ? `x="${W - 60}" text-anchor="end" direction="rtl"` : `x="60"`;
      const weight = l.bold ? ' font-weight="700"' : "";
      const fam = mono || l.mono ? "Consolas, 'Courier New', monospace" : "'Segoe UI', Arial, sans-serif";
      return `<text ${attrs} y="${y}" font-family="${fam}" font-size="${l.bold ? 17 : 14}"${weight} fill="${l.bold ? "#8135cd" : "#1f2937"}" xml:space="preserve">${escXml(l.text)}</text>`;
    }).join("\n");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#ffffff"/>
<rect x="48" y="44" width="${W - 96}" height="40" fill="#8135cd"/>
<text x="64" y="70" font-family="'Segoe UI', Arial, sans-serif" font-size="14" font-weight="700" fill="#ffffff" letter-spacing="2">ORGTIK</text>
<text x="140" y="70" font-family="'Segoe UI', Arial, sans-serif" font-size="13" fill="#ffffff">${escXml(title)}</text>
${rows}
<line x1="48" y1="${H - 50}" x2="${W - 48}" y2="${H - 50}" stroke="#e5e7eb"/>
<text x="${W - 48}" y="${H - 30}" text-anchor="end" font-family="Arial, sans-serif" font-size="11" fill="#9ca3af">Page ${idx + 1} of ${pages.length}</text>
</svg>`;
  });
}

function textPreviewPages(title, text, mono) {
  const lines = wrap(text, mono ? 92 : 100).slice(0, 44 * 20).map((t) => ({ text: t }));
  return svgPages(title, lines, { mono });
}

function csvPreviewPages(title, text) {
  const rows = String(text).split(/\r?\n/).filter(Boolean).slice(0, 400).map((r) => r.split(","));
  const cols = Math.max(1, ...rows.map((r) => r.length));
  const width = Math.max(8, Math.floor(92 / cols));
  const fmt = (r) => r.map((c) => String(c).slice(0, width - 1).padEnd(width)).join("");
  const lines = rows.map((r, i) => ({ text: fmt(r), bold: i === 0, mono: true }));
  return svgPages(title, lines, { mono: true });
}

function docxPreviewPages(title, buf) {
  const paras = docxParagraphs(buf);
  if (!paras) return null;
  const lines = [];
  for (const p of paras) {
    for (const t of wrap(p.text, p.heading ? 70 : 100)) lines.push({ text: t, rtl: p.rtl, bold: p.heading });
    if (p.heading || p.text) lines.push({ text: "" });
  }
  return svgPages(title, lines);
}

// ------------------------------------------------------------------ misc
function parseCookies(header) {
  const out = {};
  for (const part of String(header || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

// Content-Disposition with an ASCII fallback plus RFC 5987 UTF-8 name (Arabic names survive).
function contentDisposition(type, filename) {
  const ascii = String(filename).replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${type}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

// Multer decodes multipart filenames as latin1; browsers send UTF-8 bytes.
function fixUploadName(name) {
  const s = String(name || "");
  if (!/[\u0080-\u00ff]/.test(s)) return s;
  const utf = Buffer.from(s, "latin1").toString("utf8");
  return utf.includes("\uFFFD") ? s : utf;
}

module.exports = {
  seedId, newId, newSecret, exportCounters, importCounters, parseSize, mimeFor, extOf, category,
  crc32, zipBuffer, unzip, docxParagraphs,
  svgPages, textPreviewPages, csvPreviewPages, docxPreviewPages,
  parseCookies, contentDisposition, fixUploadName,
};
