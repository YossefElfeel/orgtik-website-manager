// Generates the static files the task-manager seed data points at (avatars, team logos and
// realistic attachments: SVG mock-ups, a PNG screenshot, PDFs, CSV/JSON/Markdown and a ZIP).
// Everything is written once into local-dev/uploads/tasks and served by the framework at /uploads.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ---------- avatars & team logos ----------
const AVATAR_COLORS = [
  ["#8135cd", "#593BF2"], ["#0EA5E9", "#2563EB"], ["#F97316", "#EF4444"], ["#10B981", "#059669"],
  ["#EC4899", "#DB2777"], ["#14B8A6", "#0D9488"], ["#F59E0B", "#D97706"], ["#6366F1", "#4F46E5"],
  ["#32ABB9", "#0E7490"], ["#A855F7", "#7C3AED"], ["#84CC16", "#4D7C0F"], ["#F43F5E", "#BE123C"],
];

function avatarSvg(initials, i) {
  const [a, b] = AVATAR_COLORS[i % AVATAR_COLORS.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
  <rect width="128" height="128" rx="64" fill="url(#g)"/>
  <text x="64" y="66" dominant-baseline="middle" text-anchor="middle" font-family="Rubik, 'Segoe UI', Arial, sans-serif" font-size="46" font-weight="600" fill="#ffffff">${esc(initials)}</text>
</svg>`;
}

function teamLogoSvg(alias, i) {
  const [a, b] = AVATAR_COLORS[(i * 5 + 3) % AVATAR_COLORS.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs><linearGradient id="t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
  <rect width="128" height="128" rx="28" fill="url(#t)"/>
  <circle cx="104" cy="24" r="10" fill="#ffffff" opacity="0.25"/>
  <text x="64" y="68" dominant-baseline="middle" text-anchor="middle" font-family="Rubik, 'Segoe UI', Arial, sans-serif" font-size="${alias.length > 2 ? 38 : 46}" font-weight="700" fill="#ffffff">${esc(alias)}</text>
</svg>`;
}

// ---------- SVG mock-ups ----------
function frame(title, body, w = 960, h = 600) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Rubik, 'Segoe UI', Arial, sans-serif">
  <rect width="${w}" height="${h}" fill="#F8FAFB"/>
  <rect x="0" y="0" width="${w}" height="44" fill="#ffffff" stroke="#E6E8EA"/>
  <circle cx="22" cy="22" r="6" fill="#FF5F57"/><circle cx="42" cy="22" r="6" fill="#FEBC2E"/><circle cx="62" cy="22" r="6" fill="#28C840"/>
  <text x="${w / 2}" y="27" text-anchor="middle" font-size="14" fill="#6B7280">${esc(title)}</text>
${body}
</svg>`;
}
const box = (x, y, w, h, fill = "#E5E7EB", rx = 8, extra = "") => `  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${extra}/>`;
const txt = (x, y, s, size = 14, fill = "#111827", weight = 400, anchor = "start") =>
  `  <text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(s)}</text>`;

function homepageWireframe() {
  const b = [];
  b.push(box(40, 64, 880, 56, "#ffffff", 10, 'stroke="#E6E8EA"'), txt(64, 98, "orgtik", 22, "#8135cd", 700));
  ["Services", "Case studies", "Careers", "Contact"].forEach((s, i) => b.push(txt(520 + i * 100, 97, s, 14, "#374151")));
  b.push(box(40, 140, 880, 250, "#EEE7FA", 14));
  b.push(txt(80, 210, "Built in Cairo, shipped to the Gulf.", 30, "#1F2937", 700));
  b.push(txt(80, 245, "Product engineering for retail, pharma and healthcare brands.", 16, "#4B5563"));
  b.push(box(80, 280, 150, 44, "#8135cd", 10), txt(155, 308, "Book a call", 15, "#ffffff", 600, "middle"));
  b.push(box(250, 280, 150, 44, "#ffffff", 10, 'stroke="#8135cd"'), txt(325, 308, "Our work", 15, "#8135cd", 600, "middle"));
  b.push(box(600, 170, 280, 190, "#D8C8F5", 12), txt(740, 270, "Hero visual", 14, "#6B21A8", 500, "middle"));
  ["Nile Foods", "Delta Pharma", "Gulf Retail", "Riyadh Health"].forEach((s, i) => {
    b.push(box(40 + i * 225, 410, 205, 150, "#ffffff", 12, 'stroke="#E6E8EA"'));
    b.push(box(56 + i * 225, 426, 173, 80, "#F3F4F6", 8));
    b.push(txt(56 + i * 225, 530, s, 15, "#111827", 600), txt(56 + i * 225, 549, "Case study", 12, "#6B7280"));
  });
  return frame("Orgtik website — homepage wireframe v1", b.join("\n"));
}

function checkoutFlow() {
  const b = [];
  const steps = ["Cart", "Address & slot", "Payment", "Review", "Confirmation"];
  steps.forEach((s, i) => {
    const x = 40 + i * 180;
    b.push(box(x, 90, 160, 60, i === 2 ? "#8135cd" : "#ffffff", 12, 'stroke="#D1D5DB"'));
    b.push(txt(x + 80, 126, s, 15, i === 2 ? "#ffffff" : "#111827", 600, "middle"));
    if (i < steps.length - 1) b.push(`  <path d="M${x + 162} 120 L${x + 178} 120" stroke="#9CA3AF" stroke-width="2"/>`);
  });
  b.push(box(40, 180, 520, 380, "#ffffff", 12, 'stroke="#E6E8EA"'), txt(64, 214, "Payment method", 18, "#111827", 600));
  [["Card (Paymob)", "Visa / Mastercard / Meeza — 3DS"], ["Fawry reference", "Pay at any Fawry outlet within 48h"], ["Cash on delivery", "B2B partners with credit limit only"]].forEach(([t, s], i) => {
    b.push(box(64, 236 + i * 90, 472, 72, i === 0 ? "#F5F0FD" : "#F9FAFB", 10, `stroke="${i === 0 ? "#8135cd" : "#E5E7EB"}"`));
    b.push(`  <circle cx="92" cy="${272 + i * 90}" r="9" fill="${i === 0 ? "#8135cd" : "#ffffff"}" stroke="#9CA3AF"/>`);
    b.push(txt(114, 268 + i * 90, t, 15, "#111827", 600), txt(114, 290 + i * 90, s, 12, "#6B7280"));
  });
  b.push(box(590, 180, 330, 380, "#ffffff", 12, 'stroke="#E6E8EA"'), txt(614, 214, "Order summary", 18, "#111827", 600));
  [["Subtotal", "EGP 48,250.00"], ["Tier discount (Gold)", "- EGP 2,412.50"], ["Delivery (Cairo)", "EGP 350.00"], ["VAT 14%", "EGP 6,466.28"]].forEach(([k, v], i) => {
    b.push(txt(614, 256 + i * 34, k, 14, "#4B5563"), txt(896, 256 + i * 34, v, 14, "#111827", 500, "end"));
  });
  b.push(`  <path d="M614 398 L896 398" stroke="#E5E7EB"/>`, txt(614, 430, "Total", 16, "#111827", 700), txt(896, 430, "EGP 52,653.78", 16, "#111827", 700, "end"));
  b.push(box(614, 470, 282, 48, "#8135cd", 10), txt(755, 500, "Pay securely", 16, "#ffffff", 600, "middle"));
  return frame("Nile Foods — checkout flow v3", b.join("\n"));
}

function sitemap() {
  const b = [];
  b.push(box(400, 70, 160, 48, "#8135cd", 10), txt(480, 100, "Home", 16, "#ffffff", 600, "middle"));
  const l1 = ["Catalogue", "B2B Account", "Offers", "About / الشركة"];
  l1.forEach((s, i) => {
    const x = 40 + i * 230;
    b.push(`  <path d="M480 118 L${x + 90} 170" stroke="#C4B5FD" stroke-width="2"/>`);
    b.push(box(x, 170, 180, 44, "#EDE9FE", 10), txt(x + 90, 198, s, 14, "#4C1D95", 600, "middle"));
    const kids = [["Categories", "Brands", "Product detail"], ["Orders", "Invoices", "Bulk upload (CSV)"], ["Campaigns", "Tier rewards"], ["Stores", "Careers"]][i];
    kids.forEach((k, j) => {
      b.push(`  <path d="M${x + 90} 214 L${x + 90} ${250 + j * 60}" stroke="#E5E7EB" stroke-width="2"/>`);
      b.push(box(x + 10, 250 + j * 60 - 20, 160, 40, "#ffffff", 8, 'stroke="#D1D5DB"'), txt(x + 90, 255 + j * 60, k, 13, "#374151", 400, "middle"));
    });
  });
  return frame("Nile Foods — sitemap v2 (EN/AR)", b.join("\n"));
}

function crmDataModel() {
  const b = [];
  const ent = [
    ["Rep", ["id", "name", "area_id", "device_id"], 60, 90], ["Visit", ["id", "rep_id", "doctor_id", "planned_at", "status"], 360, 90],
    ["Doctor", ["id", "name", "specialty", "clinic_id"], 660, 90], ["SampleStock", ["id", "rep_id", "sku", "qty"], 60, 340],
    ["CallReport", ["id", "visit_id", "notes", "pdf_url"], 360, 340], ["SyncLog", ["id", "device_id", "delta_hash", "synced_at"], 660, 340],
  ];
  for (const [name, cols, x, y] of ent) {
    b.push(box(x, y, 240, 40 + cols.length * 28, "#ffffff", 10, 'stroke="#C4B5FD"'));
    b.push(box(x, y, 240, 36, "#8135cd", 10), txt(x + 16, y + 24, name, 15, "#ffffff", 700));
    cols.forEach((c, i) => b.push(txt(x + 16, y + 62 + i * 28, c, 13, "#374151")));
  }
  b.push(`  <path d="M300 130 L360 130 M600 130 L660 130 M180 250 L180 340 M480 260 L480 340 M780 250 L780 340" stroke="#8B5CF6" stroke-width="2" stroke-dasharray="6 4"/>`);
  return frame("Delta Pharma CRM — offline data model", b.join("\n"));
}

function loyaltyOnboarding() {
  const b = [];
  ["Welcome", "Phone + OTP", "Pick favourites", "Your tier"].forEach((s, i) => {
    const x = 40 + i * 225;
    b.push(box(x, 70, 200, 490, "#111827", 28), box(x + 10, 86, 180, 458, "#ffffff", 20));
    b.push(txt(x + 100, 130, s, 16, "#111827", 700, "middle"));
    if (i === 0) b.push(box(x + 30, 160, 140, 140, "#EDE9FE", 70), txt(x + 100, 236, "Gulf Retail", 14, "#6D28D9", 700, "middle"), txt(x + 100, 340, "أهلاً بك", 20, "#111827", 700, "middle"));
    if (i === 1) { b.push(box(x + 24, 170, 152, 44, "#F3F4F6", 10), txt(x + 36, 198, "+966 5X XXX XXXX", 13, "#6B7280")); for (let k = 0; k < 4; k++) b.push(box(x + 28 + k * 38, 240, 30, 40, "#F3F4F6", 8)); }
    if (i === 2) for (let k = 0; k < 6; k++) b.push(box(x + 24 + (k % 2) * 80, 160 + Math.floor(k / 2) * 90, 70, 76, k % 3 === 0 ? "#DDD6FE" : "#F3F4F6", 12));
    if (i === 3) b.push(box(x + 24, 160, 152, 90, "#FDE68A", 14), txt(x + 100, 200, "GOLD", 22, "#92400E", 800, "middle"), txt(x + 100, 228, "2,480 pts", 14, "#92400E", 600, "middle"));
    b.push(box(x + 24, 470, 152, 44, "#8135cd", 12), txt(x + 100, 498, i === 3 ? "Start shopping" : "Continue", 14, "#ffffff", 600, "middle"));
  });
  return frame("Gulf Retail loyalty — onboarding flow", b.join("\n"));
}

// ---------- PNG (tiny encoder, solid rectangles) ----------
function pngFromRects(width, height, bg, rects) {
  const px = Buffer.alloc(width * height * 3);
  const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const fill = (x0, y0, w, h, c) => {
    const [r, g, b] = hex(c);
    for (let y = Math.max(0, y0); y < Math.min(height, y0 + h); y++)
      for (let x = Math.max(0, x0); x < Math.min(width, x0 + w); x++) {
        const i = (y * width + x) * 3;
        px[i] = r; px[i + 1] = g; px[i + 2] = b;
      }
  };
  fill(0, 0, width, height, bg);
  for (const [x, y, w, h, c] of rects) fill(x, y, w, h, c);
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    px.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

function repDashboardPng() {
  const r = [[0, 0, 900, 52, "#FFFFFF"], [0, 52, 200, 508, "#1F1147"], [20, 80, 160, 28, "#8135CD"]];
  for (let i = 0; i < 6; i++) r.push([20, 130 + i * 44, 140, 16, "#4C3A8C"]);
  for (let i = 0; i < 4; i++) r.push([224 + i * 166, 76, 150, 90, "#FFFFFF"], [240 + i * 166, 92, 60, 12, "#D1D5DB"], [240 + i * 166, 118, 90, 26, ["#8135CD", "#32ABB9", "#F59E0B", "#EF4444"][i]]);
  r.push([224, 186, 482, 250, "#FFFFFF"]);
  const bars = [120, 160, 90, 190, 150, 210, 170, 130, 200, 180];
  bars.forEach((h, i) => r.push([250 + i * 44, 416 - h, 26, h, i % 2 ? "#C4B5FD" : "#8135CD"]));
  r.push([722, 186, 150, 250, "#FFFFFF"]);
  for (let i = 0; i < 5; i++) r.push([736, 204 + i * 44, 24, 24, "#E9D5FF"], [768, 210 + i * 44, 90, 12, "#E5E7EB"]);
  r.push([224, 452, 648, 90, "#FFFFFF"]);
  for (let i = 0; i < 3; i++) r.push([240, 466 + i * 24, 600, 12, i === 0 ? "#E5E7EB" : "#F3F4F6"]);
  return pngFromRects(900, 560, "#F1F3F5", r);
}

function rtlIssuesPng() {
  const r = [[0, 0, 900, 56, "#FFFFFF"], [700, 16, 170, 24, "#8135CD"], [30, 18, 120, 20, "#E5E7EB"]];
  for (let i = 0; i < 3; i++) {
    const x = 620 - i * 290;
    r.push([x, 80, 260, 380, "#FFFFFF"], [x + 16, 96, 228, 190, "#F3F4F6"], [x + 16, 300, 180, 16, "#D1D5DB"], [x + 16, 326, 120, 14, "#E5E7EB"], [x + 16, 360, 100, 22, "#10B981"], [x + 140, 410, 104, 36, "#8135CD"]);
  }
  r.push([322, 296, 238, 26, "#FEE2E2"], [32, 356, 128, 30, "#FEE2E2"]);
  r.push([0, 480, 900, 80, "#FFFBEB"], [20, 500, 18, 18, "#F59E0B"], [50, 504, 500, 12, "#FCD34D"]);
  return pngFromRects(900, 560, "#F8FAFB", r);
}

// ---------- PDF (single page, Helvetica, ASCII text) ----------
function pdfDoc(title, subtitle, lines) {
  const e = (s) => String(s).replace(/[^\x20-\x7E]/g, "-").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  let c = "0.506 0.208 0.804 rg 0 770 595 72 re f\n";
  c += `BT /F2 22 Tf 1 1 1 rg 40 800 Td (${e(title)}) Tj ET\n`;
  c += `BT /F1 11 Tf 1 1 1 rg 40 782 Td (${e(subtitle)}) Tj ET\n`;
  let y = 735;
  for (const l of lines) {
    if (l.startsWith("# ")) { y -= 8; c += `BT /F2 14 Tf 0.07 0.09 0.15 rg 40 ${y} Td (${e(l.slice(2))}) Tj ET\n`; y -= 22; continue; }
    c += `BT /F1 11 Tf 0.22 0.25 0.32 rg 40 ${y} Td (${e(l)}) Tj ET\n`;
    y -= 17;
  }
  c += `BT /F1 9 Tf 0.6 0.6 0.6 rg 40 40 Td (Orgtik Software - confidential - generated for local development) Tj ET\n`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${Buffer.byteLength(c, "latin1")} >>\nstream\n${c}endstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offs = [];
  objs.forEach((o, i) => { offs.push(Buffer.byteLength(pdf, "latin1")); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

// ---------- ZIP (stored entries) ----------
function zipFiles(entries) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, content] of entries) {
    const data = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const nameBuf = Buffer.from(name);
    const crc = zlib.crc32(data) >>> 0;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(0, 8);
    lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0x5921, 12); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28);
    locals.push(lh, nameBuf, data);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0, 8); ch.writeUInt16LE(0, 10);
    ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0x5921, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20);
    ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nameBuf.length, 28); ch.writeUInt32LE(offset, 42);
    centrals.push(ch, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

// ---------- text files ----------
const ordersApiJson = JSON.stringify({
  openapi: "3.0.3",
  info: { title: "Nile Foods Orders API", version: "2.0.0-rc.2", description: "Carts, orders and invoices for the B2B storefront." },
  servers: [{ url: "https://api.staging.nilefoods.test/v2" }],
  paths: {
    "/carts/{cartId}/items": { post: { summary: "Add item to cart", parameters: [{ name: "cartId", in: "path", required: true }] } },
    "/orders": { post: { summary: "Create order from cart (Idempotency-Key header required)" }, get: { summary: "List partner orders" } },
    "/orders/{orderId}/payments/callback": { post: { summary: "Paymob / Fawry payment callback" } },
    "/invoices/{invoiceId}.pdf": { get: { summary: "Download tax invoice (ETA e-invoice compliant)" } },
  },
}, null, 2);

const bulkOrderCsv = `sku,product_name,quantity,unit,notes
NF-OIL-1L,Sunflower Oil 1L,240,carton,
NF-RICE-5KG,Egyptian Rice 5kg,120,bag,Deliver before Friday
NF-TEA-100,Black Tea 100 bags,300,box,
NF-PASTA-400,Penne 400g,480,pack,
NF-SUGAR-1KG,White Sugar 1kg,200,bag,Promo price (Q4)
`;

const burndownCsv = `day,date,planned_points,remaining_points,completed_points
1,Day 1,64,64,0
2,Day 2,57.6,61,3
3,Day 3,51.2,55,9
4,Day 4,44.8,50,14
5,Day 5,38.4,41,23
6,Day 6,32,37,27
7,Day 7,25.6,30,34
8,Day 8,19.2,24,40
9,Day 9,12.8,19,45
10,Day 10,6.4,12,52
`;

const budgetCsv = `category,2026_actual_egp,2027_plan_egp,2027_plan_sar,owner
Salaries (Cairo),18400000,22600000,1780000,Mona Adel
Riyadh office (new),0,3900000,307000,Karim Hassan
Cloud (Azure + AWS),2150000,2480000,195000,Mahmoud Gamal
Tools & licences,640000,710000,56000,Sherif Magdy
Training & certifications,380000,520000,41000,Rana Saad
Marketing & events,900000,1350000,106000,Dina Fathy
`;

const releaseNotesMd = `# Riyadh Health Clinics — Booking Portal v1.0

**Go-live:** Sunday 06:00 (KSA) · **Environment:** Azure UAE North

## Highlights
- Patient self-booking across 12 clinics (Arabic-first, English toggle)
- Doctor schedules with slot templates and holiday calendars (Eid, National Day)
- SMS reminders 24h and 2h before the appointment (Unifonic)

## Known issues
- Double-booking can occur when two confirmations arrive within ~200 ms (tracked as a warranty fix)
- Insurance eligibility check moved to phase 2

## Rollback
Blue/green deployment — switch traffic back to \`blue\` slot via Front Door.
`;

const runbookMd = `# Cut-over runbook — Azure UAE North

| Step | Owner | Window |
|------|-------|--------|
| Freeze deployments | Sherif Magdy | T-24h |
| Final log-shipping sync | Mahmoud Gamal | T-2h |
| Switch DNS (TTL 60s) | Mahmoud Gamal | T-0 |
| Smoke tests (Nile Foods, Delta Pharma) | Ahmed Tarek | T+15m |
| Go / no-go call | Karim Hassan | T+30m |

## Rollback
1. Point DNS back to Cairo DC load balancer.
2. Resume log shipping in reverse direction.
3. Notify clients via status page.
`;

// ---------- registry of seed attachments ----------
// key -> { file, originalName, mimetype, build() }
const ATTACHMENTS = {
  discovery_pdf: { file: "seed-nile-foods-discovery-summary.pdf", originalName: "Nile Foods - Discovery Workshop Summary.pdf", mimetype: "application/pdf",
    build: () => pdfDoc("Discovery Workshop Summary", "Nile Foods E-commerce Revamp - prepared by Orgtik", [
      "# Personas", "1. Retail partner owner (Cairo, Alexandria) - orders weekly, mobile-first.", "2. Trade marketing manager - runs tier promotions and campaigns.", "3. Customer service agent - handles order changes and credit notes.",
      "# Top pain points", "- Phone/WhatsApp ordering causes 12% order errors.", "- No visibility on stock per warehouse.", "- Payment reconciliation takes 3 days.",
      "# Success KPIs", "- 60% of partner orders online within 6 months of launch.", "- Order error rate below 2%.", "- Checkout conversion above 45% for returning partners."]) },
  sitemap_svg: { file: "seed-nile-foods-sitemap-v2.svg", originalName: "sitemap-v2.svg", mimetype: "image/svg+xml", build: sitemap },
  checkout_svg: { file: "seed-checkout-flow-v3.svg", originalName: "checkout-flow-v3.svg", mimetype: "image/svg+xml", build: checkoutFlow },
  orders_json: { file: "seed-orders-api-v2.json", originalName: "orders-api-v2.openapi.json", mimetype: "application/json", build: () => ordersApiJson },
  bulk_csv: { file: "seed-bulk-order-sample.csv", originalName: "bulk-order-sample.csv", mimetype: "text/csv", build: () => bulkOrderCsv },
  rtl_png: { file: "seed-rtl-issues-pdp.png", originalName: "rtl-issues-pdp.png", mimetype: "image/png", build: rtlIssuesPng },
  burndown_csv: { file: "seed-sprint-14-burndown.csv", originalName: "sprint-14-burndown.csv", mimetype: "text/csv", build: () => burndownCsv },
  crm_svg: { file: "seed-crm-data-model.svg", originalName: "crm-data-model.svg", mimetype: "image/svg+xml", build: crmDataModel },
  uat_pdf: { file: "seed-delta-uat-feedback.pdf", originalName: "Delta Pharma UAT feedback - round 2.pdf", mimetype: "application/pdf",
    build: () => pdfDoc("UAT Feedback - Round 2", "Delta Pharma Field Sales CRM - area managers Cairo & Delta", [
      "# Visit planning calendar", "- Drag & drop between days works well on 10\" tablets.", "- Please show the pharmacy name, not only the doctor, in the week view.", "- Approval badge is not visible in dark mode.",
      "# Sample tracking", "- Low-stock alert threshold should be configurable per product.", "- Returns flow OK.",
      "# Sign-off", "Pending 3 minor fixes. Target sign-off: next Thursday."]) },
  pentest_pdf: { file: "seed-pentest-findings.pdf", originalName: "pentest-findings-summary.pdf", mimetype: "application/pdf",
    build: () => pdfDoc("Penetration Test - Findings Summary", "Delta Pharma CRM Android app - OWASP MASVS L1", [
      "# High", "H-01 Missing certificate pinning on /sync endpoints.", "H-02 Refresh token stored in SharedPreferences (unencrypted).",
      "# Medium", "M-01 Root/jailbreak detection can be bypassed with Frida.", "M-02 Verbose error messages leak stack traces.",
      "# Low", "L-01 Screenshot protection disabled on call report screen.", "", "Retest window: after fixes are deployed to staging."]) },
  onboarding_svg: { file: "seed-loyalty-onboarding.svg", originalName: "loyalty-onboarding-flow.svg", mimetype: "image/svg+xml", build: loyaltyOnboarding },
  homepage_svg: { file: "seed-homepage-wireframe.svg", originalName: "homepage-wireframe-v1.svg", mimetype: "image/svg+xml", build: homepageWireframe },
  brand_pdf: { file: "seed-orgtik-brand-guidelines.pdf", originalName: "Orgtik Brand Guidelines 2026.pdf", mimetype: "application/pdf",
    build: () => pdfDoc("Orgtik Brand Guidelines 2026", "Logo, colour, typography and tone of voice", [
      "# Colour", "Primary violet #8135CD, Verdigris #32ABB9, Ink #111827, Canvas #F8FAFB.",
      "# Typography", "Rubik for English and Arabic UI; IBM Plex Sans Arabic for long-form Arabic.",
      "# Logo", "Minimum size 24px height. Keep clear space equal to the height of the 'o'.",
      "# Voice", "Confident, warm, precise. Bilingual by default - never machine-translate Arabic copy."]) },
  logo_zip: { file: "seed-orgtik-logo-pack.zip", originalName: "orgtik-logo-pack.zip", mimetype: "application/zip",
    build: () => zipFiles([["orgtik-logo-violet.svg", teamLogoSvg("OT", 0)], ["orgtik-logo-white.svg", teamLogoSvg("OT", 3)], ["README.txt", "Orgtik logo pack 2026 - use the violet version on light backgrounds.\n"]]) },
  release_md: { file: "seed-riyadh-health-release-notes.md", originalName: "release-notes-v1.0.md", mimetype: "text/markdown", build: () => releaseNotesMd },
  dashboard_png: { file: "seed-rep-dashboard-mock.png", originalName: "rep-dashboard-mock.png", mimetype: "image/png", build: repDashboardPng },
  budget_csv: { file: "seed-2027-budget-draft.csv", originalName: "2027-budget-draft.csv", mimetype: "text/csv", build: () => budgetCsv },
  runbook_md: { file: "seed-cutover-runbook.md", originalName: "cutover-runbook.md", mimetype: "text/markdown", build: () => runbookMd },
};

function writeIfMissing(dir, file, build) {
  const p = path.join(dir, file);
  if (!fs.existsSync(p)) {
    const content = build();
    fs.writeFileSync(p, content);
  }
  return fs.statSync(p).size;
}

// Writes every seed file (once) and returns helpers: attachment(key), avatarFile(userId),
// teamFile(teamId) and writeTeamLogos(teams) (called after the seed has created the teams).
function prepare(uploadsDir, users, { samples = true } = {}) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  const sizes = {};
  if (samples) for (const [key, a] of Object.entries(ATTACHMENTS)) sizes[key] = writeIfMissing(uploadsDir, a.file, a.build);
  users.forEach((u, i) => writeIfMissing(uploadsDir, `seed-avatar-${u.id}.svg`, () => avatarSvg((`${String(u.firstName || '').charAt(0)}${String(u.lastName || '').charAt(0)}` || '?').toUpperCase(), i)));
  return {
    attachment: (key) => ({ ...ATTACHMENTS[key], size: sizes[key] }),
    avatarFile: (userId) => `seed-avatar-${userId}.svg`,
    teamFile: (teamId) => `seed-team-${teamId}.svg`,
    writeTeamLogos: (teams) => teams.forEach((t, i) => writeIfMissing(uploadsDir, `seed-team-${t.id}.svg`, () => teamLogoSvg(t.alias, i))),
  };
}

module.exports = { prepare, ATTACHMENTS };
