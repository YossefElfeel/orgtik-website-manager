// After `vite build`: gives every address its own HTML, the same app with the <head> its SEO
// record in the Website Manager describes (title, description, robots, canonical, hreflang,
// social preview, structured data). Only the head changes; the page itself still renders in the
// browser exactly as before (a full server render would change the first paint: the pages read
// the window's size). Also writes sitemap.xml, robots.txt and the not-found page (404.html).
//
//   npm run build        (vite build, then this)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addresses, headFor, siteSettings } from "../src/content/heads.js";
import snapshot from "../src/content/snapshot.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, "..", "dist", "client");
const shell = fs.readFileSync(path.join(OUT, "index.html"), "utf8");
const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
const site = siteSettings();

// Each public language (S5): its own lang/dir, social locale and canonical address.
const OG_LOCALE = { en: "en_CH", de: "de_CH", fr: "fr_CH", it: "it_CH", ar: "ar" };
function render(head, locale = "en") {
  const canonical = head.alternates.find((a) => a.hreflang === locale)?.href ?? head.canonical;
  const tags = [
    `<title>${esc(head.title)}</title>`,
    `<meta name="description" content="${esc(head.description)}" />`,
    `<meta name="robots" content="${head.robots}" />`,
    `<link rel="canonical" href="${esc(canonical)}" />`,
    ...head.alternates.map(
      (a) =>
        `<link rel="alternate" hreflang="${a.hreflang}" href="${esc(a.href)}" />`,
    ),
    ...(head.alternates.length
      ? [
          `<link rel="alternate" hreflang="x-default" href="${esc(head.alternates[0].href)}" />`,
        ]
      : []),
    `<meta property="og:type" content="${head.type}" />`,
    `<meta property="og:site_name" content="${esc(head.siteName)}" />`,
    `<meta property="og:title" content="${esc(head.title)}" />`,
    `<meta property="og:description" content="${esc(head.description)}" />`,
    `<meta property="og:url" content="${esc(canonical)}" />`,
    `<meta property="og:locale" content="${OG_LOCALE[locale] ?? locale}" />`,
    ...(head.image
      ? [
          `<meta property="og:image" content="${esc(head.image)}" />`,
          ...(head.imageAlt
            ? [
                `<meta property="og:image:alt" content="${esc(head.imageAlt)}" />`,
              ]
            : []),
        ]
      : []),
    `<meta name="twitter:card" content="${head.image ? "summary_large_image" : "summary"}" />`,
    ...(head.jsonLd
      ? [
          `<script type="application/ld+json">${JSON.stringify(head.jsonLd).replace(/</g, "\\u003c")}</script>`,
        ]
      : []),
  ];
  let html = shell
    .replace(/<html lang="en">/, `<html lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}">`)
    .replace(/\s*<title>[\s\S]*?<\/title>/, "")
    .replace(/\s*<meta\s+name="description"[\s\S]*?\/>/, "")
    .replace(/\s*<meta\s+name="robots"[\s\S]*?\/>/, "");
  return html.replace(/\s*<\/head>/, `\n    ${tags.join("\n    ")}\n  </head>`);
}

let written = 0;
const sitemap = new Set();
for (const address of addresses()) {
  const head = headFor(address);
  const file =
    address === "/"
      ? path.join(OUT, "index.html")
      : path.join(OUT, ...address.slice(1).split("/"), "index.html");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, render(head));
  written += 1;
  if (head.inSitemap) sitemap.add(head.canonical);
}

// The not-found page: the app shows its "Page not found." view; the host answers with 404.
const template = site.titleTemplate ?? "{page} | OrgTik";
fs.writeFileSync(
  path.join(OUT, "404.html"),
  render({
    ...headFor("/"),
    title: template.replace("{page}", "page not found"),
    robots: "noindex,nofollow",
    jsonLd: null,
  }).replace(/\s*<link rel="(canonical|alternate)"[^>]*\/>/g, ""),
);

// The other public languages (none yet: D-037): /de/…, /ar/… with their own heads.
for (const locale of (site.publicLocales ?? ["en"]).filter((l) => l !== "en")) {
  for (const address of addresses()) {
    const head = headFor(address, locale);
    const file = path.join(OUT, locale, ...address.slice(1).split("/").filter(Boolean), "index.html");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, render(head, locale));
    written += 1;
    const own = head.alternates.find((a) => a.hreflang === locale)?.href;
    if (head.inSitemap && own) sitemap.add(own);
  }
}
fs.writeFileSync(
  path.join(OUT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[
    ...sitemap,
  ]
    .sort()
    .map((loc) => `  <url><loc>${esc(loc)}</loc></url>`)
    .join("\n")}\n</urlset>\n`,
);
fs.writeFileSync(
  path.join(OUT, "robots.txt"),
  snapshot.robots ?? "User-agent: *\nDisallow: /\n",
);
console.log(
  `heads: ${written} addresses, 404.html, sitemap.xml (${sitemap.size} URLs), robots.txt (${site.visibility ?? "noindex"})`,
);
