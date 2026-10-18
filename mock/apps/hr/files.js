// Small, valid binary files built with Node built-ins only: PDF (payslips, CVs), ZIP, XLSX, CSV, SVG avatars.
const zlib = require("zlib");

// ---------------- PDF ----------------
// A single-page A4 PDF. `blocks` is a list of drawing ops:
//   { text, x, y, size, bold, color:[r,g,b] } | { rect:[x,y,w,h], fill:[r,g,b] } | { line:[x1,y1,x2,y2], color }
const esc = (s) => String(s).replace(/[^\x20-\x7e]/g, "?").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
function pdf(blocks, { title = "Document" } = {}) {
  const ops = [];
  for (const b of blocks) {
    if (b.rect) {
      const [r, g, bl] = b.fill || [0.95, 0.95, 0.97];
      ops.push(`${r} ${g} ${bl} rg ${b.rect.join(" ")} re f`);
    } else if (b.line) {
      const [r, g, bl] = b.color || [0.85, 0.87, 0.9];
      ops.push(`${r} ${g} ${bl} RG 0.8 w ${b.line[0]} ${b.line[1]} m ${b.line[2]} ${b.line[3]} l S`);
    } else if (b.text != null) {
      const [r, g, bl] = b.color || [0.13, 0.15, 0.18];
      const size = b.size || 10;
      let x = b.x;
      // right-align helper: approximate Helvetica width (0.5em avg, 0.55 bold)
      if (b.align === "right") x = b.x - String(b.text).length * size * (b.bold ? 0.56 : 0.5);
      ops.push(`BT /${b.bold ? "F2" : "F1"} ${size} Tf ${r} ${g} ${bl} rg ${x.toFixed(1)} ${b.y} Td (${esc(b.text)}) Tj ET`);
    }
  }
  const stream = ops.join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
    `<< /Title (${esc(title)}) /Producer (OrgTik local mock) /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)}Z) >>`,
  ];
  let out = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info 7 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

const PURPLE = [0.506, 0.208, 0.804];
const GREY = [0.35, 0.39, 0.46];

// Payslip PDF from a plain data object (see payroll routes for the shape).
function payslipPdf(p) {
  const b = [];
  let y = 842;
  b.push({ rect: [0, 762, 595, 80], fill: PURPLE });
  b.push({ text: p.company || "OrgTik", x: 40, y: 808, size: 20, bold: true, color: [1, 1, 1] });
  b.push({ text: "PAYSLIP", x: 555, y: 808, size: 16, bold: true, color: [1, 1, 1], align: "right" });
  b.push({ text: p.companyAddress || "", x: 40, y: 788, size: 9, color: [0.93, 0.9, 1] });
  b.push({ text: p.periodTitle || "", x: 555, y: 788, size: 10, color: [0.93, 0.9, 1], align: "right" });
  y = 730;
  if (p.watermark) {
    b.push({ rect: [40, y - 6, 515, 22], fill: [1, 0.95, 0.88] });
    b.push({ text: p.watermark, x: 50, y, size: 10, bold: true, color: [0.75, 0.45, 0.05] });
    y -= 32;
  }
  const kv = (label, value, x, yy) => {
    b.push({ text: label, x, y: yy, size: 8, color: GREY });
    b.push({ text: value || "-", x, y: yy - 13, size: 10, bold: true });
  };
  kv("EMPLOYEE", p.employeeName, 40, y);
  kv("EMPLOYEE CODE", p.employeeCode, 230, y);
  kv("DEPARTMENT", p.department, 400, y);
  y -= 38;
  kv("JOB TITLE", p.jobTitle, 40, y);
  kv("PAY PERIOD", `${p.periodStart}  to  ${p.periodEnd}`, 230, y);
  kv("PAYMENT", p.paymentLabel, 400, y);
  y -= 38;
  kv("PAYSLIP NO.", p.number, 40, y);
  kv("STATUS", p.status, 230, y);
  kv("PAID ON", p.paidAt || "-", 400, y);
  y -= 34;
  b.push({ line: [40, y, 555, y] });
  y -= 22;
  const section = (title) => {
    b.push({ rect: [40, y - 5, 515, 18], fill: [0.96, 0.95, 0.99] });
    b.push({ text: title, x: 48, y, size: 9, bold: true, color: PURPLE });
    b.push({ text: `AMOUNT (${p.currency})`, x: 547, y, size: 9, bold: true, color: PURPLE, align: "right" });
    y -= 20;
  };
  const row = (label, amount, opts = {}) => {
    b.push({ text: label, x: 48, y, size: 10, bold: !!opts.bold, color: opts.color });
    b.push({ text: amount, x: 547, y, size: 10, bold: !!opts.bold, color: opts.color, align: "right" });
    y -= 16;
  };
  section("EARNINGS");
  for (const e of p.earnings) row(e.label, e.amount);
  y -= 6;
  section("DEDUCTIONS");
  if (!p.deductions.length) row("No deductions this period", "0.00", { color: GREY });
  for (const d of p.deductions) row(d.label, `-${d.amount}`);
  y -= 16;
  b.push({ rect: [40, y - 10, 515, 30], fill: PURPLE });
  b.push({ text: "NET PAYABLE", x: 52, y: y + 1, size: 12, bold: true, color: [1, 1, 1] });
  b.push({ text: `${p.netPayable} ${p.currency}`, x: 543, y: y + 1, size: 13, bold: true, color: [1, 1, 1], align: "right" });
  y -= 44;
  if (p.reference?.length) {
    b.push({ text: "Contract salary structure (reference)", x: 40, y, size: 9, bold: true, color: GREY });
    y -= 14;
    for (const r of p.reference) {
      b.push({ text: r.label, x: 48, y, size: 9, color: GREY });
      b.push({ text: r.amount, x: 547, y, size: 9, color: GREY, align: "right" });
      y -= 12;
    }
  }
  b.push({ line: [40, 70, 555, 70] });
  b.push({ text: "This payslip was generated by the OrgTik HR local mock server. No real payment data.", x: 40, y: 56, size: 8, color: GREY });
  b.push({ text: `Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`, x: 40, y: 44, size: 8, color: GREY });
  return pdf(b, { title: `Payslip ${p.employeeName} ${p.periodTitle}` });
}

// Generic "document" PDF (CVs, seeded attachments, certificates).
function documentPdf({ title, subtitle, sections = [] }) {
  const b = [];
  b.push({ rect: [0, 782, 595, 60], fill: PURPLE });
  b.push({ text: title, x: 40, y: 812, size: 18, bold: true, color: [1, 1, 1] });
  if (subtitle) b.push({ text: subtitle, x: 40, y: 793, size: 10, color: [0.93, 0.9, 1] });
  let y = 750;
  for (const s of sections) {
    if (y < 90) break;
    if (s.heading) {
      b.push({ text: s.heading.toUpperCase(), x: 40, y, size: 10, bold: true, color: PURPLE });
      b.push({ line: [40, y - 5, 555, y - 5] });
      y -= 22;
    }
    for (const line of s.lines || []) {
      if (y < 80) break;
      b.push({ text: line, x: 48, y, size: 10 });
      y -= 15;
    }
    y -= 10;
  }
  b.push({ text: "Sample document generated by the OrgTik local mock server.", x: 40, y: 44, size: 8, color: GREY });
  return pdf(b, { title });
}

// ---------------- ZIP ----------------
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
  if (typeof zlib.crc32 === "function") return zlib.crc32(buf) >>> 0;
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function dosTime(d = new Date()) {
  return {
    time: ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | (Math.floor(d.getSeconds() / 2) & 31),
    date: (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31),
  };
}
// files: [{ name, data: Buffer|string }]
function zip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  const { time, date } = dosTime();
  for (const f of files) {
    const data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(String(f.data), "utf8");
    const name = Buffer.from(f.name, "utf8");
    const deflated = zlib.deflateRawSync(data);
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x0800, 6); // UTF-8 names
    lh.writeUInt16LE(useDeflate ? 8 : 0, 8);
    lh.writeUInt16LE(time, 10);
    lh.writeUInt16LE(date, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(body.length, 18);
    lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(name.length, 26);
    lh.writeUInt16LE(0, 28);
    locals.push(lh, name, body);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(useDeflate ? 8 : 0, 10);
    ch.writeUInt16LE(time, 12);
    ch.writeUInt16LE(date, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(body.length, 20);
    ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt16LE(0, 30);
    ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34);
    ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(0, 38);
    ch.writeUInt32LE(offset, 42);
    centrals.push(ch, name);
    offset += lh.length + name.length + body.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...locals, centralBuf, end]);
}
// Reads a zip into { name: Buffer } (stored + deflated entries).
function unzip(buf) {
  const out = {};
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Not a zip file");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nameLen).toString("utf8");
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const start = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.slice(start, start + csize);
    out[name] = method === 8 ? zlib.inflateRawSync(raw) : raw;
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

// ---------------- XLSX ----------------
const xmlEsc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const colName = (i) => { let s = ""; i += 1; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
// rows: array of arrays (first row = header, bold). Numbers stay numeric.
function xlsx(rows, { sheetName = "Sheet1" } = {}) {
  const sheetRows = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
    const ref = `${colName(ci)}${ri + 1}`;
    const style = ri === 0 ? ' s="1"' : "";
    if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}"${style}><v>${v}</v></c>`;
    if (v == null || v === "") return `<c r="${ref}"${style}/>`;
    return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
  }).join("")}</row>`).join("");
  const widths = (rows[0] || []).map((_, ci) => Math.min(48, Math.max(10, ...rows.map((r) => String(r[ci] ?? "").length + 2))));
  const cols = widths.length ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>` : "";
  const files = [
    { name: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { name: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEsc(sheetName.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: "xl/styles.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>` },
    { name: "xl/worksheets/sheet1.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${cols}<sheetData>${sheetRows}</sheetData></worksheet>` },
  ];
  return zip(files);
}
const unxml = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
// First worksheet of an xlsx -> array of arrays of strings.
function readXlsx(buf) {
  const files = unzip(buf);
  const shared = [];
  const ss = files["xl/sharedStrings.xml"]?.toString("utf8");
  if (ss) for (const si of ss.match(/<si>[\s\S]*?<\/si>/g) || []) shared.push(unxml((si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []).map((t) => t.replace(/<[^>]+>/g, "")).join("")));
  const sheetName = Object.keys(files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort()[0];
  if (!sheetName) throw new Error("No worksheet found");
  const xml = files[sheetName].toString("utf8");
  const rows = [];
  for (const rowXml of xml.match(/<row[\s\S]*?<\/row>/g) || []) {
    const row = [];
    for (const c of rowXml.match(/<c[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) || []) {
      const ref = (c.match(/r="([A-Z]+)\d+"/) || [])[1];
      const type = (c.match(/t="([^"]+)"/) || [])[1];
      let v = "";
      if (type === "inlineStr") v = unxml(((c.match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1]) || "");
      else {
        const raw = (c.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
        v = raw == null ? "" : type === "s" ? shared[Number(raw)] ?? "" : unxml(raw);
      }
      let idx = row.length;
      if (ref) { idx = 0; for (const ch of ref) idx = idx * 26 + (ch.charCodeAt(0) - 64); idx -= 1; }
      row[idx] = v;
    }
    rows.push(Array.from(row, (x) => x ?? ""));
  }
  return rows;
}

// ---------------- CSV ----------------
const csvCell = (v) => { const s = v == null ? "" : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csv = (rows) => rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
function readCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  const s = String(text).replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

// ---------------- SVG avatar ----------------
const AVATAR_COLORS = ["#8135CD", "#18ABE7", "#32B183", "#E8A743", "#E34B4B", "#5182EF", "#DB2777", "#0E678C", "#7B2CBF", "#F97316"];
function avatarSvg(initials, seed = 0) {
  const bg = AVATAR_COLORS[Math.abs(seed) % AVATAR_COLORS.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="64" fill="${bg}"/><text x="64" y="64" dy=".35em" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="48" font-weight="600" fill="#fff">${xmlEsc(initials)}</text></svg>`;
}

module.exports = { pdf, payslipPdf, documentPdf, zip, unzip, xlsx, readXlsx, csv, readCsv, avatarSvg };
