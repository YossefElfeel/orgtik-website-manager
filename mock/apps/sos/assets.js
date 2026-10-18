// Seed files for the SOS mock: chat images/documents/voice notes, CMS logos and a default avatar.
// Everything is generated locally (no downloads) into local-dev/uploads/sos and served from /uploads.
const fs = require("fs");
const path = require("path");

const FONT = "Segoe UI, Helvetica, Arial, sans-serif";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FONT}">${body}</svg>`;
const text = (x, y, s, size, fill, extra = "") => `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" ${extra}>${esc(s)}</text>`;

// ---------- images ----------
function dashboardMockup() {
  const dots = ["#BBBBBB", "#8135CD", "#0EA5E9", "#16A34A", "#F59E0B", "#EF4444"].map((c, i) => `<circle cx="48" cy="${56 + i * 48}" r="17" fill="${c}"/>`).join("");
  const kpis = [
    ["ACTIVE SYSTEMS", "6", "+1 this month", "#16A34A"],
    ["TOTAL MEMBERS", "16", "+2 this month", "#16A34A"],
    ["CMS PLATFORMS", "3", "1 platform inactive", "#6B7280"],
    ["SYSTEM HEALTH", "99.9%", "Healthy", "#16A34A"],
  ]
    .map(([label, value, sub, color], i) => {
      const x = 604 + (i % 2) * 168;
      const y = 104 + Math.floor(i / 2) * 230;
      return `<rect x="${x}" y="${y}" width="156" height="210" rx="14" fill="#FAFAFB" stroke="#E5E7EB"/>` +
        text(x + 16, y + 40, label, 11, "#6B7280", 'font-weight="600" letter-spacing="1"') +
        text(x + 16, y + 100, value, 38, i === 3 ? "#16A34A" : "#111827", 'font-weight="700"') +
        text(x + 16, y + 130, sub, 12, color);
    })
    .join("");
  return svg(960, 600,
    `<rect width="960" height="600" fill="#F3F4F6"/>` +
    `<rect x="16" y="16" width="64" height="568" rx="16" fill="#FFFFFF"/>${dots}` +
    `<rect x="96" y="16" width="848" height="568" rx="16" fill="#FFFFFF"/>` +
    `<line x1="96" y1="76" x2="944" y2="76" stroke="#E5E7EB"/>` +
    text(124, 54, "orgtik", 22, "#4C1D95", 'font-weight="800"') +
    `<rect x="360" y="30" width="330" height="30" rx="15" fill="#F3F4F6"/>` +
    text(382, 50, "Home   Chat   Content   Systems   People", 13, "#6B7280") +
    `<circle cx="904" cy="46" r="15" fill="#DDD6FE"/>` + text(898, 51, "M", 13, "#4C1D95", 'font-weight="700"') +
    `<circle cx="330" cy="220" r="92" fill="#EDE9FE"/><rect x="262" y="176" width="136" height="88" rx="10" fill="#8135CD"/>` +
    `<rect x="276" y="190" width="108" height="10" rx="5" fill="#C4B5FD"/><rect x="276" y="210" width="72" height="10" rx="5" fill="#C4B5FD"/>` +
    `<rect x="300" y="264" width="60" height="16" fill="#6D28D9"/>` +
    text(330, 360, "WELCOME TO THE HEART OF ORGTIK", 22, "#111827", 'font-weight="600" text-anchor="middle"') +
    text(330, 392, "Use the sidebar to navigate and manage your work", 14, "#6B7280", 'text-anchor="middle"') +
    text(330, 412, "efficiently between the different systems.", 14, "#6B7280", 'text-anchor="middle"') +
    kpis + text(930, 578, "SOS v2 · home dashboard · draft 3", 11, "#9CA3AF", 'text-anchor="end"'));
}

function peopleMockup() {
  const rows = [
    ["Mona Adel", "mona.adel@orgtik.test", "Global · Task Manager", true],
    ["Karim Hassan", "karim.hassan@orgtik.test", "Global · HR System", true],
    ["Salma Nabil", "salma.nabil@orgtik.test", "Global · Task Manager", true],
    ["Omar Farouk", "omar.farouk@orgtik.test", "Global · Sales", true],
    ["Nour Khaled", "nour.khaled@nilefoods.test", "Sales", true],
    ["Hany Samir", "hany.samir@orgtik.test", "Global · HR System", false],
  ]
    .map(([name, email, scopes, active], i) => {
      const y = 170 + i * 62;
      return `<line x1="40" y1="${y - 22}" x2="920" y2="${y - 22}" stroke="#F1F1F4"/>` +
        `<circle cx="64" cy="${y + 6}" r="15" fill="#DDD6FE"/>` + text(58, y + 11, name[0], 13, "#4C1D95", 'font-weight="700"') +
        text(92, y + 11, name, 15, "#111827", 'font-weight="600"') + text(290, y + 11, email, 14, "#4B5563") +
        `<rect x="560" y="${y - 7}" width="${scopes.length * 7.2}" height="26" rx="13" fill="#FFFFFF" stroke="#D1D5DB"/>` +
        text(572, y + 11, scopes, 12, "#374151") +
        `<rect x="800" y="${y - 5}" width="42" height="22" rx="11" fill="${active ? "#8135CD" : "#EF4444"}"/>` +
        `<circle cx="${active ? 830 : 812}" cy="${y + 6}" r="8" fill="#FFFFFF"/>`;
    })
    .join("");
  return svg(960, 600,
    `<rect width="960" height="600" fill="#FFFFFF"/>` +
    text(40, 56, "People", 28, "#111827", 'font-weight="700"') + text(40, 82, "Manage your people", 14, "#6B7280") +
    `<rect x="700" y="30" width="220" height="42" rx="10" fill="#8135CD"/>` + text(760, 57, "+ Add User", 15, "#FFFFFF", 'font-weight="600"') +
    `<rect x="40" y="100" width="420" height="36" rx="8" fill="#F3F4F6" stroke="#D1D5DB"/>` + text(56, 123, "Search people…", 13, "#9CA3AF") +
    `<rect x="480" y="100" width="130" height="36" rx="8" fill="#FFFFFF" stroke="#D1D5DB"/>` + text(494, 123, "All scopes ▾", 13, "#374151") +
    `<rect x="620" y="100" width="130" height="36" rx="8" fill="#FFFFFF" stroke="#D1D5DB"/>` + text(634, 123, "All (types) ▾", 13, "#374151") +
    `<rect x="760" y="100" width="130" height="36" rx="8" fill="#FFFFFF" stroke="#D1D5DB"/>` + text(774, 123, "All (status) ▾", 13, "#374151") +
    rows + text(920, 585, "SOS v2 · people page", 11, "#9CA3AF", 'text-anchor="end"'));
}

function mobileChatMockup() {
  const bubbles = [
    [false, "Hi Salma! Designs are ready 🎨", 150],
    [true, "Amazing, sending feedback soon", 214],
    [false, "Bubble radius is 16px", 278],
    [true, "Perfect 👌 matches the tokens", 342],
    [false, "Voice notes use the same style", 406],
  ]
    .map(([own, msg, y]) => {
      const w = msg.length * 7.6 + 28;
      const x = own ? 332 - w : 28;
      return `<rect x="${x}" y="${y}" width="${w}" height="44" rx="16" fill="${own ? "#8135CD" : "#FFFFFF"}" stroke="${own ? "none" : "#E5E7EB"}"/>` +
        text(x + 14, y + 27, msg, 13, own ? "#FFFFFF" : "#111827");
    })
    .join("");
  return svg(360, 720,
    `<rect width="360" height="720" rx="36" fill="#111827"/><rect x="12" y="12" width="336" height="696" rx="28" fill="#F9FAFB"/>` +
    `<rect x="12" y="12" width="336" height="96" rx="28" fill="#FFFFFF"/><line x1="12" y1="108" x2="348" y2="108" stroke="#E5E7EB"/>` +
    `<circle cx="56" cy="64" r="20" fill="#FBCFE8"/>` + text(49, 70, "L", 16, "#9D174D", 'font-weight="700"') +
    text(88, 60, "Laila Mostafa", 16, "#111827", 'font-weight="600"') + text(88, 80, "Online", 12, "#8135CD") +
    `<circle cx="70" cy="76" r="6" fill="#22C55E" stroke="#FFFFFF" stroke-width="2"/>` +
    bubbles +
    `<rect x="28" y="632" width="304" height="48" rx="24" fill="#FFFFFF" stroke="#E5E7EB"/>` + text(48, 661, "Type any message…", 13, "#9CA3AF") +
    `<circle cx="306" cy="656" r="18" fill="#8135CD"/>`);
}

function moodboardMockup() {
  const swatches = [["#16A34A", "Nile Green"], ["#F59E0B", "Harvest Gold"], ["#FDF6E3", "Wheat"], ["#7C2D12", "Clay"], ["#0EA5E9", "River Blue"]]
    .map(([c, n], i) => `<rect x="${40 + i * 176}" y="420" width="160" height="110" rx="14" fill="${c}" stroke="#E5E7EB"/>` + text(40 + i * 176, 556, `${n} ${c}`, 13, "#374151"))
    .join("");
  return svg(960, 600,
    `<rect width="960" height="600" fill="#FFFBEB"/>` +
    text(40, 64, "Nile Foods · Autumn Campaign", 30, "#14532D", 'font-weight="800"') + text(40, 94, "Moodboard v2 — warm, natural, family breakfast", 15, "#78350F") +
    `<rect x="40" y="120" width="420" height="270" rx="18" fill="#FDE68A"/><circle cx="170" cy="255" r="80" fill="#FFFFFF"/><circle cx="170" cy="255" r="56" fill="#FCD34D"/>` +
    `<ellipse cx="330" cy="290" rx="70" ry="40" fill="#D97706"/><rect x="290" y="170" width="90" height="70" rx="12" fill="#16A34A"/>` +
    `<rect x="480" y="120" width="210" height="130" rx="18" fill="#DCFCE7"/>` + text(500, 190, "“Start your day", 20, "#14532D", 'font-style="italic"') + text(500, 216, " the Nile way”", 20, "#14532D", 'font-style="italic"') +
    `<rect x="480" y="260" width="210" height="130" rx="18" fill="#FFEDD5"/><path d="M520 360 L585 290 L650 360 Z" fill="#EA580C"/>` +
    `<rect x="710" y="120" width="210" height="270" rx="18" fill="#E0F2FE"/>` + text(730, 160, "Channels", 18, "#0C4A6E", 'font-weight="700"') +
    text(730, 196, "• Instagram reels", 15, "#0C4A6E") + text(730, 224, "• Blog recipes", 15, "#0C4A6E") + text(730, 252, "• In-store posters", 15, "#0C4A6E") + text(730, 280, "• Newsletter", 15, "#0C4A6E") +
    swatches);
}

function sprintBoardMockup() {
  const cols = [
    ["TO DO", "#FEF3C7", ["Contact info tabs", "Voice note waveform", "Empty states"]],
    ["IN PROGRESS", "#DBEAFE", ["Read receipts", "Typing indicator"]],
    ["DONE", "#DCFCE7", ["Conversation list", "Attachments (10 MB)", "Delete message"]],
  ]
    .map(([title, color, notes], ci) => {
      const x = 40 + ci * 300;
      return text(x, 110, title, 16, "#374151", 'font-weight="700" letter-spacing="1"') +
        notes.map((n, i) => `<rect x="${x}" y="${130 + i * 120}" width="260" height="100" rx="6" fill="${color}" transform="rotate(${(i + ci) % 2 ? 1.5 : -1.5} ${x + 130} ${180 + i * 120})"/>` +
          text(x + 18, 186 + i * 120, n, 17, "#1F2937", 'font-family="Segoe Print, Comic Sans MS, cursive"')).join("");
    })
    .join("");
  return svg(960, 540,
    `<rect width="960" height="540" fill="#FFFFFF"/><rect x="8" y="8" width="944" height="524" rx="12" fill="none" stroke="#D1D5DB" stroke-width="6"/>` +
    text(40, 64, "Chat sprint · workshop board", 26, "#111827", 'font-weight="700" font-family="Segoe Print, Comic Sans MS, cursive"') + cols);
}

function cmsLogo(initials, color, accent) {
  return svg(200, 200,
    `<rect width="200" height="200" rx="44" fill="${color}"/><circle cx="160" cy="44" r="22" fill="${accent}" opacity="0.9"/>` +
    text(100, 124, initials, 72, "#FFFFFF", 'font-weight="800" text-anchor="middle" letter-spacing="-2"'));
}

function defaultAvatar() {
  return svg(128, 128,
    `<rect width="128" height="128" fill="#E9E4F5"/><circle cx="64" cy="50" r="24" fill="#A78BCF"/>` +
    `<path d="M20 124c4-26 22-40 44-40s40 14 44 40z" fill="#A78BCF"/>`);
}

// ---------- PDF (single page, Helvetica, padded to a realistic size) ----------
function pdf(title, subtitle, lines, targetBytes = 0) {
  const pdfEsc = (s) => String(s).replace(/[^\x20-\x7E]/g, "-").replace(/([\\()])/g, "\\$1");
  let content = `BT /F2 22 Tf 56 770 Td (${pdfEsc(title)}) Tj ET\nBT /F1 12 Tf 56 748 Td (${pdfEsc(subtitle)}) Tj ET\n`;
  content += "0.51 0.21 0.80 RG 2 w 56 736 m 539 736 l S\n";
  let y = 708;
  for (const l of lines) {
    const bold = l.startsWith("# ");
    content += `BT /${bold ? "F2" : "F1"} ${bold ? 13 : 11} Tf 56 ${y} Td (${pdfEsc(bold ? l.slice(2) : l)}) Tj ET\n`;
    y -= bold ? 24 : 18;
  }
  content += `BT /F1 9 Tf 56 40 Td (Generated locally for the Orgtik mock environment) Tj ET\n`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];
  let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  // Comment padding keeps the file a valid PDF while giving it a realistic size.
  if (targetBytes > 0) {
    const line = "%" + " ".repeat(126) + "\n";
    while (out.length < targetBytes - 2000) out += line;
  }
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

// ---------- WAV (16-bit PCM mono, 8 kHz): a soft "speech-like" hum with syllable rhythm ----------
function wav(seconds, baseHz) {
  const rate = 8000;
  const n = Math.round(seconds * rate);
  const data = Buffer.alloc(n * 2);
  let seed = baseHz * 7919;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const syllable = Math.max(0, Math.sin(2 * Math.PI * 3.3 * t + Math.sin(t * 1.7))) ** 1.5;
    const phrase = t % 2.6 < 2.2 ? 1 : 0.08;
    const fade = Math.min(1, t * 8, (seconds - t) * 8);
    const pitch = baseHz * (1 + 0.08 * Math.sin(2 * Math.PI * 0.7 * t));
    const tone = Math.sin(2 * Math.PI * pitch * t) * 0.6 + Math.sin(4 * Math.PI * pitch * t) * 0.25 + Math.sin(6 * Math.PI * pitch * t) * 0.1;
    const v = (tone + rnd() * 0.08) * syllable * phrase * fade * 0.45;
    data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767))), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

function contentCalendarCsv() {
  const rows = [["Date", "Channel", "Topic", "Owner", "Status", "Caption / notes"]];
  const channels = ["Instagram", "Blog", "Facebook", "Newsletter", "TikTok"];
  const topics = ["Healthy breakfast ideas", "New oat line launch", "Behind the scenes: factory tour", "Customer recipe of the week", "World Food Day (Oct 16)", "Autumn campaign teaser", "Kids lunchbox tips", "Q&A with our nutritionist"];
  for (let d = 1; d <= 31; d++) {
    const date = `2026-10-${String(d).padStart(2, "0")}`;
    const ch = channels[d % channels.length];
    const topic = d === 16 ? "World Food Day (Oct 16)" : topics[(d * 3) % topics.length];
    const owner = ch === "Blog" ? "Hoda Ashraf" : "Dina Fathy";
    const status = d < 8 ? "Approved" : d < 18 ? "In review" : "Draft";
    const caption = ch === "Instagram" ? `"${topic} ☀️ #NileFoods #StartYourDay"` : ch === "Blog" ? "800-1000 words, 2 photos" : "Reuse blog hero image";
    rows.push([date, ch, topic, owner, status, caption]);
  }
  return Buffer.from("﻿" + rows.map((r) => r.join(",")).join("\r\n") + "\r\n", "utf8");
}

// ---------- catalogue ----------
// key -> { file, name (shown to users), mime, kind, build() }
const CATALOGUE = {
  "default-avatar": { file: "seed-default-avatar.svg", name: "default-avatar.svg", mime: "image/svg+xml", kind: "image", build: defaultAvatar },
  "cms-nile-foods": { file: "seed-cms-nile-foods.svg", name: "nile-foods-logo.svg", mime: "image/svg+xml", kind: "image", build: () => cmsLogo("NF", "#15803D", "#FACC15") },
  "cms-orgtik-website": { file: "seed-cms-orgtik-website.svg", name: "orgtik-website-logo.svg", mime: "image/svg+xml", kind: "image", build: () => cmsLogo("OW", "#8135CD", "#F0ABFC") },
  "cms-cairo-bites": { file: "seed-cms-cairo-bites.svg", name: "cairo-bites-logo.svg", mime: "image/svg+xml", kind: "image", build: () => cmsLogo("CB", "#EA580C", "#FDE68A") },
  "cms-delta-pharma": { file: "seed-cms-delta-pharma.svg", name: "delta-pharma-logo.svg", mime: "image/svg+xml", kind: "image", build: () => cmsLogo("DP", "#0369A1", "#67E8F9") },
  "img-sos-dashboard": { file: "seed-chat-sos-dashboard-v2.svg", name: "sos-dashboard-v2.svg", mime: "image/svg+xml", kind: "image", build: dashboardMockup },
  "img-people-page": { file: "seed-chat-people-page-v2.svg", name: "people-page-v2.svg", mime: "image/svg+xml", kind: "image", build: peopleMockup },
  "img-mobile-chat": { file: "seed-chat-mobile-chat.svg", name: "mobile-chat-screen.svg", mime: "image/svg+xml", kind: "image", build: mobileChatMockup },
  "img-moodboard": { file: "seed-chat-campaign-moodboard.svg", name: "nile-foods-moodboard.svg", mime: "image/svg+xml", kind: "image", build: moodboardMockup },
  "img-sprint-board": { file: "seed-chat-sprint-board.svg", name: "sprint-board-sketch.svg", mime: "image/svg+xml", kind: "image", build: sprintBoardMockup },
  "doc-q3-report": {
    file: "seed-doc-q3-operations-report.pdf", name: "Q3-Operations-Report.pdf", mime: "application/pdf", kind: "document",
    build: () => pdf("Q3 2026 Operations Report", "Prepared by Karim Hassan, Operations Manager - Orgtik", [
      "# Highlights", "On-time delivery: 94% (Q2: 89%)", "Warehouse costs: -6% vs Q2", "Average order processing time: 3.2 hours",
      "# Returns", "Returns rate: 3.1% for the quarter (August peak: 5.4%)", "Root cause: damaged packaging during the Nile Foods seasonal campaign",
      "Action: packaging supplier switched on 28 August", "# Risks", "Courier contract (Alexandria) expires on 15 October 2026",
      "Two offers under review - summary in appendix B", "# Next quarter", "Roll out the new barcode scanners to both warehouses", "Train 40 staff members (30 minutes each)",
    ], 312000),
  },
  "doc-invoice": {
    file: "seed-doc-invoice-inv-2026-1042.pdf", name: "Invoice-INV-2026-1042.pdf", mime: "application/pdf", kind: "document",
    build: () => pdf("INVOICE INV-2026-1042", "Delta Print Co. - billed to Orgtik (Finance: Hany Samir)", [
      "Invoice date: 21 September 2026        Due date: 05 October 2026", "# Items", "Nile Foods brochures A5, 5,000 pcs ......... EGP 32,000.00",
      "Roll-up banners x 6 ......................... EGP 9,000.00", "Design adjustments (4 hours) ............... EGP 3,250.00",
      "Subtotal .................................... EGP 44,250.00", "VAT 14% ..................................... EGP 6,195.00",
      "# Total due: EGP 50,445.00", "Payment: bank transfer - reference INV-2026-1042",
    ], 186000),
  },
  "doc-proposal": {
    file: "seed-doc-nile-foods-proposal.pdf", name: "Nile-Foods-Proposal.pdf", mime: "application/pdf", kind: "document",
    build: () => pdf("Proposal: Digital Marketing Retainer & Customer Portal", "Prepared for Nile Foods by Omar Farouk, Sales Executive - Orgtik", [
      "# Scope", "12-month digital marketing retainer (social, blog, newsletter)", "Customer portal with order tracking - Arabic and English from day one",
      "Monthly performance report and quarterly strategy review", "# Timeline", "Kick-off: 5 October 2026", "Portal phase 1: 8 weeks, phase 2: 6 weeks",
      "# Investment", "Retainer: EGP 85,000 / month", "Portal: EGP 420,000 one-off", "Annual plan discount: 10%",
    ], 452000),
  },
  "doc-brand": {
    file: "seed-doc-brand-guidelines-v3.pdf", name: "Brand-Guidelines-v3.pdf", mime: "application/pdf", kind: "document",
    build: () => pdf("Nile Foods Brand Guidelines v3", "Tone of voice, colours, typography and imagery", [
      "# Tone of voice", "Warm, simple and family-friendly. Avoid jargon.", "Bilingual: Arabic first on social, English first on the website.",
      "# Colours", "Nile Green #15803D, Harvest Gold #F59E0B, Wheat #FDF6E3", "# Typography", "Headings: Cairo Bold - Body: Inter Regular",
      "# Imagery", "Natural light, real kitchens, no heavy filters", "Show the product in use - breakfast tables, lunchboxes",
    ], 734000),
  },
  "doc-content-calendar": { file: "seed-doc-content-calendar-october.csv", name: "content-calendar-october.csv", mime: "text/csv", kind: "document", build: contentCalendarCsv },
  "voice-karim": { file: "seed-voice-karim.wav", name: "voice-karim.wav", mime: "audio/wav", kind: "voice", duration: 7, build: () => wav(7, 118) },
  "voice-omar": { file: "seed-voice-omar.wav", name: "voice-omar.wav", mime: "audio/wav", kind: "voice", duration: 4, build: () => wav(4, 132) },
};

// Writes every seed file (cheap, idempotent) and returns key -> { filename, name, url, size, mime, kind, duration }.
function ensureSeedAssets(dir, fileUrl) {
  fs.mkdirSync(dir, { recursive: true });
  const out = {};
  for (const [key, a] of Object.entries(CATALOGUE)) {
    const buf = (() => {
      const b = a.build();
      return Buffer.isBuffer(b) ? b : Buffer.from(b, "utf8");
    })();
    const full = path.join(dir, a.file);
    try {
      if (!fs.existsSync(full) || fs.statSync(full).size !== buf.length) fs.writeFileSync(full, buf);
    } catch (e) {
      console.warn(`[api:sos] could not write seed asset ${a.file}: ${e.message}`);
    }
    out[key] = { filename: a.file, name: a.name, url: fileUrl(a.file), size: buf.length, mime: a.mime, kind: a.kind, duration: a.duration || null };
  }
  return out;
}

module.exports = { ensureSeedAssets };
