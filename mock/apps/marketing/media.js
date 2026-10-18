// Locally generated artwork (SVG) for seeded gallery items, brand logos and profile pictures,
// so posts, the media gallery and previews show real images without any online host.

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// slug -> design. `project` groups the gallery per brand (see seed.js).
const GALLERY = [
  // Nile Foods
  { slug: "koshary-friday", project: "nile", title: "Koshary Friday", sub: "Egypt's favourite comfort bowl", c: ["#F59E0B", "#B45309"], motif: "bowl" },
  { slug: "molokhia-classic", project: "nile", title: "Molokhia, Mom's Way", sub: "Ready in 15 minutes", c: ["#16A34A", "#14532D"], motif: "bowl" },
  { slug: "mango-season", project: "nile", title: "Mango Season Is Here", sub: "Fresh Ewais mango juice", c: ["#FBBF24", "#EA580C"], motif: "drink" },
  { slug: "lunchbox-pack", project: "nile", title: "Back-to-School Lunchbox", sub: "5 ideas kids actually eat", c: ["#38BDF8", "#1D4ED8"], motif: "box" },
  { slug: "iftar-box", project: "nile", title: "Iftar Box 2027", sub: "Pre-orders open soon", c: ["#7C3AED", "#312E81"], motif: "moon" },
  { slug: "white-friday-50", project: "nile", title: "White Friday Up to 50% Off", sub: "Nov 20-30 on the Nile Foods app", c: ["#111827", "#4B5563"], motif: "sale" },
  { slug: "ful-medames", project: "nile", title: "Ful Medames Breakfast", sub: "The Cairo morning ritual", c: ["#A16207", "#713F12"], motif: "bowl" },
  { slug: "feteer-meshaltet", project: "nile", title: "Feteer Meshaltet", sub: "Flaky, buttery, golden", c: ["#FCD34D", "#D97706"], motif: "star" },
  { slug: "saudi-national-day", project: "nile", title: "Happy Saudi National Day", sub: "From all of us at Nile Foods KSA", c: ["#16A34A", "#065F46"], motif: "star" },
  { slug: "protein-bar-launch", project: "nile", title: "New Nile Protein Bar", sub: "20g protein - dates and tahini", c: ["#EF4444", "#7F1D1D"], motif: "box" },
  { slug: "world-food-day", project: "nile", title: "World Food Day Oct 16", sub: "Zero-waste kitchen tips", c: ["#22C55E", "#15803D"], motif: "leaf" },
  { slug: "frozen-ready-meals", project: "nile", title: "Ready Meals in 5 Minutes", sub: "Now in Riyadh and Jeddah", c: ["#0EA5E9", "#0C4A6E"], motif: "box" },
  { slug: "hawawshi-night", project: "nile", title: "Hawawshi Night", sub: "Spiced beef, crispy baladi bread", c: ["#DC2626", "#7C2D12"], motif: "star" },
  { slug: "om-ali-kit", project: "nile", title: "Om Ali Dessert Kit", sub: "Serves 6 - bake in 20 minutes", c: ["#F472B6", "#9D174D"], motif: "bowl" },
  { slug: "pink-october", project: "nile", title: "Pink October", sub: "Early detection saves lives", c: ["#EC4899", "#BE185D"], motif: "heart" },
  { slug: "factory-tour", project: "nile", title: "Inside Our 10th of Ramadan Kitchen", sub: "Quality from farm to fork", c: ["#64748B", "#1E293B"], motif: "camera" },
  { slug: "shakshuka-reel", project: "nile", title: "60-Second Shakshuka", sub: "Watch the reel", c: ["#F97316", "#9A3412"], motif: "play" },
  { slug: "customer-review", project: "nile", title: "“Tastes like home”", sub: "Mariam from Alexandria - 4.9 stars", c: ["#6366F1", "#3730A3"], motif: "quote" },
  // OrgTik
  { slug: "orgtik-suite-launch", project: "orgtik", title: "One Suite. Every Team.", sub: "HR - Tasks - Sales - Files - Marketing", c: ["#8135CD", "#4C1D95"], motif: "chart" },
  { slug: "gitex-2026", project: "orgtik", title: "Meet OrgTik at GITEX Global", sub: "Dubai - Hall 7 - Stand B42", c: ["#0F172A", "#6D28D9"], motif: "people" },
  { slug: "webinar-approvals", project: "orgtik", title: "Webinar: Automate Your Approvals", sub: "Oct 8 - 2 PM Cairo time", c: ["#2563EB", "#1E3A8A"], motif: "play" },
  { slug: "delta-pharma-story", project: "orgtik", title: "Customer Story: Delta Pharma", sub: "Onboarding time cut by 43%", c: ["#059669", "#064E3B"], motif: "quote" },
  { slug: "hiring-cairo", project: "orgtik", title: "We're Hiring in Cairo", sub: "Backend - Frontend - QA", c: ["#F59E0B", "#92400E"], motif: "people" },
  // Sahel Resorts
  { slug: "sahel-sunset", project: "sahel", title: "Sunsets in Sidi Abdel Rahman", sub: "Last call for summer", c: ["#FB923C", "#9A3412"], motif: "sun" },
  { slug: "hurghada-winter", project: "sahel", title: "Winter Sun in Hurghada", sub: "Book 4 nights, pay 3", c: ["#06B6D4", "#0E7490"], motif: "wave" },
  { slug: "family-pool", project: "sahel", title: "Family Pool Days", sub: "Kids stay free this October", c: ["#3B82F6", "#1E40AF"], motif: "wave" },
  { slug: "red-sea-spa", project: "sahel", title: "Red Sea Spa Retreat", sub: "Couples package from 9,900 EGP", c: ["#A78BFA", "#5B21B6"], motif: "leaf" },
];
const BY_SLUG = Object.fromEntries(GALLERY.map((g) => [g.slug, g]));

const BRANDS = {
  "nile-foods": { label: "NF", c: ["#F59E0B", "#B45309"], name: "Nile Foods" },
  orgtik: { label: "OT", c: ["#8135CD", "#4C1D95"], name: "OrgTik" },
  "sahel-resorts": { label: "SR", c: ["#06B6D4", "#0E7490"], name: "Sahel Resorts" },
};

function motifSvg(kind) {
  const w = 'fill="#ffffff" fill-opacity="0.9"';
  const s = 'fill="none" stroke="#ffffff" stroke-opacity="0.9" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"';
  switch (kind) {
    case "bowl": return `<g transform="translate(700 560)"><path d="M0 60 h300 a150 150 0 0 1 -300 0z" ${w}/><path d="M60 30 q40 -60 0 -120 M150 30 q40 -60 0 -120 M240 30 q40 -60 0 -120" ${s}/></g>`;
    case "drink": return `<g transform="translate(760 440)"><path d="M0 0 h200 l-30 330 h-140z" ${w}/><path d="M140 -10 l60 -110" ${s}/><circle cx="100" cy="120" r="40" fill="#FDE68A"/></g>`;
    case "box": return `<g transform="translate(700 520)"><rect width="300" height="220" rx="24" ${w}/><path d="M0 70 h300 M150 0 v220" stroke="#000" stroke-opacity="0.12" stroke-width="14"/></g>`;
    case "moon": return `<g transform="translate(820 600)"><circle r="150" ${w}/><circle cx="70" cy="-40" r="130" fill="#312E81" fill-opacity="0.95"/><circle cx="-190" cy="-230" r="14" ${w}/><circle cx="-80" cy="-300" r="9" ${w}/></g>`;
    case "sale": return `<g transform="translate(700 470)"><circle cx="150" cy="150" r="170" fill="#ffffff" fill-opacity="0.12"/><text x="150" y="215" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="210" font-weight="800" fill="#ffffff">%</text></g>`;
    case "heart": return `<g transform="translate(850 640)"><path d="M0 120 C-220 -20 -120 -200 0 -90 C120 -200 220 -20 0 120z" ${w}/></g>`;
    case "camera": return `<g transform="translate(700 540)"><rect width="300" height="200" rx="30" ${w}/><circle cx="150" cy="100" r="62" fill="#1E293B"/><rect x="40" y="-30" width="90" height="40" rx="12" ${w}/></g>`;
    case "play": return `<g transform="translate(850 640)"><circle r="160" fill="#ffffff" fill-opacity="0.18"/><path d="M-50 -80 L90 0 L-50 80z" ${w}/></g>`;
    case "quote": return `<g transform="translate(720 500)"><text x="0" y="260" font-family="Georgia, serif" font-size="420" font-weight="700" fill="#ffffff" fill-opacity="0.35">”</text></g>`;
    case "chart": return `<g transform="translate(700 520)"><rect x="0" y="120" width="60" height="140" rx="12" ${w}/><rect x="90" y="60" width="60" height="200" rx="12" ${w}/><rect x="180" y="0" width="60" height="260" rx="12" ${w}/><rect x="270" y="80" width="60" height="180" rx="12" ${w}/></g>`;
    case "people": return `<g transform="translate(700 520)"><circle cx="80" cy="60" r="55" ${w}/><circle cx="240" cy="60" r="55" ${w}/><path d="M0 250 a80 80 0 0 1 160 0z M160 250 a80 80 0 0 1 160 0z" ${w}/></g>`;
    case "sun": return `<g transform="translate(830 620)"><circle r="120" fill="#FEF3C7"/><path d="M-300 170 h600 M-240 230 h480" ${s}/></g>`;
    case "wave": return `<g transform="translate(640 620)"><path d="M0 60 q70 -60 140 0 t140 0 t140 0 M0 150 q70 -60 140 0 t140 0 t140 0" ${s}/><circle cx="330" cy="-110" r="70" fill="#FEF3C7"/></g>`;
    case "leaf": return `<g transform="translate(830 620)"><path d="M-140 140 C-140 -80 40 -160 160 -160 C160 -20 80 140 -140 140z" ${w}/><path d="M-140 140 L80 -80" stroke="#000" stroke-opacity="0.12" stroke-width="14"/></g>`;
    default: return `<g transform="translate(830 620)"><path d="M0 -150 L40 -45 L150 -45 L60 20 L95 130 L0 65 L-95 130 L-60 20 L-150 -45 L-40 -45z" ${w}/></g>`;
  }
}

function wrap(text, max = 16) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + " " + w).length <= max) cur += " " + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 4);
}

function cardSvg({ title, sub, c, motif, tag }) {
  const lines = wrap(title, 15);
  const size = lines.length > 3 ? 78 : 92;
  const titleSvg = lines.map((l, i) => `<text x="80" y="${300 + i * (size + 14)}" font-family="Segoe UI, Arial, sans-serif" font-size="${size}" font-weight="800" fill="#ffffff">${esc(l)}</text>`).join("");
  const subY = 300 + lines.length * (size + 14) + 30;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${esc(c[0])}"/><stop offset="1" stop-color="${esc(c[1])}"/></linearGradient>
<radialGradient id="r" cx="0.85" cy="0.15" r="0.7"><stop offset="0" stop-color="#ffffff" stop-opacity="0.35"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs>
<rect width="1080" height="1080" fill="url(#g)"/><rect width="1080" height="1080" fill="url(#r)"/>
<circle cx="930" cy="930" r="300" fill="#ffffff" fill-opacity="0.06"/><circle cx="140" cy="140" r="110" fill="#ffffff" fill-opacity="0.07"/>
${motifSvg(motif)}
<text x="80" y="150" font-family="Segoe UI, Arial, sans-serif" font-size="32" font-weight="700" letter-spacing="6" fill="#ffffff" fill-opacity="0.85">${esc(tag)}</text>
${titleSvg}
<text x="80" y="${subY}" font-family="Segoe UI, Arial, sans-serif" font-size="44" font-weight="500" fill="#ffffff" fill-opacity="0.9">${esc(sub)}</text>
<rect x="80" y="950" width="300" height="60" rx="30" fill="#ffffff" fill-opacity="0.2"/>
<text x="230" y="991" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="700" fill="#ffffff">${esc(tag)}</text>
</svg>`;
}

const TAGS = { nile: "NILE FOODS", orgtik: "ORGTIK", sahel: "SAHEL RESORTS" };

function seedImageSvg(slug) {
  const g = BY_SLUG[slug] || { title: slug.replace(/-/g, " "), sub: "Local mock artwork", c: ["#6366F1", "#312E81"], motif: "star", project: "" };
  return cardSvg({ ...g, tag: TAGS[g.project] || "MEDIA" });
}

function initialsOf(name) {
  return String(name || "?").replace(/[@#]/g, "").split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
}

// Round profile picture with initials (profile/page avatars).
function avatarSvg(name, color = "#8135CD") {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
<defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${esc(color)}"/><stop offset="1" stop-color="#111827"/></linearGradient></defs>
<circle cx="128" cy="128" r="128" fill="url(#a)"/>
<text x="128" y="152" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="92" font-weight="800" fill="#ffffff">${esc(initialsOf(name))}</text>
</svg>`;
}

// Square brand mark used as project avatars.
function brandSvg(slug) {
  const b = BRANDS[slug] || { label: initialsOf(slug.replace(/-/g, " ")), c: ["#8135CD", "#4C1D95"] };
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
<defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${esc(b.c[0])}"/><stop offset="1" stop-color="${esc(b.c[1])}"/></linearGradient></defs>
<rect width="256" height="256" rx="56" fill="url(#b)"/>
<text x="128" y="158" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="96" font-weight="800" fill="#ffffff">${esc(b.label)}</text>
</svg>`;
}

// Express routes serving the artwork (public, like a CDN).
function routes(app) {
  const sendSvg = (res, svg) => res.set("Cache-Control", "public, max-age=86400").type("image/svg+xml").send(svg);
  app.get("/media/seed/:slug.svg", (req, res) => sendSvg(res, seedImageSvg(req.params.slug)));
  app.get("/media/brand/:slug.svg", (req, res) => sendSvg(res, brandSvg(req.params.slug)));
  app.get("/media/avatar/:slug.svg", (req, res) => sendSvg(res, avatarSvg(req.query.name || req.params.slug.replace(/-/g, " "), req.query.color ? `#${String(req.query.color).replace(/^#/, "")}` : "#8135CD")));
}

module.exports = { GALLERY, BY_SLUG, routes, avatarSvg, brandSvg, seedImageSvg, initialsOf };
