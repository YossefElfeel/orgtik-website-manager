// Generated cover images (SVG) in the OrgTik plum/violet palette for seed items that have no supplied photo.
// Served at /seed-assets/covers/<key>.svg. next/image serves .svg sources as-is (no optimizer round-trip).
const PALETTES = [
  { a: "#190B25", b: "#4B1D7A", c: "#9458F4", d: "#D4B7EC" },
  { a: "#12081C", b: "#2E1446", c: "#B06AF2", d: "#F2C6E9" },
  { a: "#1B0F2E", b: "#3A1C66", c: "#7C4DDB", d: "#C9B6F5" },
  { a: "#0E0A1F", b: "#1F2A6B", c: "#6C63FF", d: "#BFD2FF" },
  { a: "#220B1E", b: "#5A1646", c: "#E0569B", d: "#F7C6DE" },
  { a: "#0B1A1F", b: "#15424B", c: "#2BB3A3", d: "#BDF2E9" },
];

// key -> { title, kicker, variant, motif }
const COVERS = {
  "local-seo": { title: "Local SEO for Swiss SMEs in four languages", kicker: "Insights · Marketing", variant: 3, motif: "rings" },
  "website-care": { title: "What a good website care plan covers", kicker: "Insights · IT support", variant: 5, motif: "grid" },
  accessibility: { title: "Accessibility is a quality bar", kicker: "Insights · Design", variant: 1, motif: "bars" },
  multilingual: { title: "Multilingual websites without double work", kicker: "Insights · Development", variant: 2, motif: "rings" },
  "social-calendar": { title: "A social calendar your team will keep", kicker: "Insights · Marketing", variant: 4, motif: "grid" },
  "template-vs-custom": { title: "Template or custom build?", kicker: "Draft · Development", variant: 0, motif: "bars" },
  "tested-backups": { title: "Backups you have tested", kicker: "Draft · Hosting", variant: 5, motif: "rings" },
  "nile-foods": { title: "Nile Foods online shop", kicker: "Project · E-commerce", variant: 4, motif: "bars" },
  "sahel-resorts": { title: "Sahel Resorts booking website", kicker: "Project · Hospitality", variant: 3, motif: "rings" },
  "riyadh-logistics": { title: "Riyadh Logistics tracking portal", kicker: "Project · Custom app", variant: 2, motif: "grid" },
  "cairo-bites": { title: "Cairo Bites magazine relaunch", kicker: "Project · Editorial", variant: 1, motif: "bars" },
  aarewelle: { title: "Aarewelle Physiotherapy, Bern", kicker: "Project · Local SEO", variant: 5, motif: "grid" },
  careers: { title: "Build what comes next with us", kicker: "Careers · OrgTik", variant: 0, motif: "rings" },
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function wrap(text, max) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

function motifSvg(motif, p) {
  if (motif === "grid") {
    let s = "";
    for (let x = 0; x < 6; x++) for (let y = 0; y < 4; y++) s += `<rect x="${1010 + x * 90}" y="${150 + y * 90}" width="64" height="64" rx="16" fill="${p.d}" fill-opacity="${((x + y) % 3) * 0.06 + 0.05}"/>`;
    return s;
  }
  if (motif === "bars") {
    const hs = [180, 260, 220, 340, 300, 420];
    return hs.map((h, i) => `<rect x="${1020 + i * 88}" y="${640 - h}" width="56" height="${h}" rx="28" fill="${i === 5 ? p.c : p.d}" fill-opacity="${i === 5 ? 0.9 : 0.16}"/>`).join("");
  }
  return [230, 320, 410].map((r) => `<circle cx="1250" cy="330" r="${r}" fill="none" stroke="${p.d}" stroke-opacity="0.16" stroke-width="2"/>`).join("")
    + `<circle cx="1250" cy="330" r="120" fill="${p.c}" fill-opacity="0.55"/>`;
}

function coverSvg(key) {
  const c = COVERS[key];
  if (!c) return null;
  const p = PALETTES[c.variant % PALETTES.length];
  const lines = wrap(c.title, 20).slice(0, 4);
  const fs = lines.length > 3 ? 72 : 84;
  const lh = Math.round(fs * 1.12);
  const top = 450 - ((lines.length - 1) * lh) / 2;
  const text = lines.map((l, i) => `<text x="120" y="${Math.round(top + i * lh)}" font-family="Montserrat, 'Segoe UI', Arial, sans-serif" font-size="${fs}" font-weight="600" fill="#F6F1FA">${esc(l)}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.a}"/><stop offset="1" stop-color="${p.b}"/></linearGradient>
<radialGradient id="g1" cx="0.82" cy="0.18" r="0.62"><stop offset="0" stop-color="${p.c}" stop-opacity="0.7"/><stop offset="1" stop-color="${p.c}" stop-opacity="0"/></radialGradient>
<radialGradient id="g2" cx="0.08" cy="0.98" r="0.55"><stop offset="0" stop-color="${p.d}" stop-opacity="0.32"/><stop offset="1" stop-color="${p.d}" stop-opacity="0"/></radialGradient>
</defs>
<rect width="1600" height="900" fill="url(#bg)"/><rect width="1600" height="900" fill="url(#g1)"/><rect width="1600" height="900" fill="url(#g2)"/>
${motifSvg(c.motif, p)}
<text x="120" y="190" font-family="Montserrat, 'Segoe UI', Arial, sans-serif" font-size="26" font-weight="600" letter-spacing="6" fill="${p.d}">${esc(c.kicker.toUpperCase())}</text>
<rect x="120" y="222" width="96" height="6" rx="3" fill="${p.c}"/>
${text}
<text x="120" y="800" font-family="Montserrat, 'Segoe UI', Arial, sans-serif" font-size="24" fill="#CFC2DB" letter-spacing="2">Strategy · Design · Technology</text>
</svg>`;
}

module.exports = { COVERS, coverSvg };
