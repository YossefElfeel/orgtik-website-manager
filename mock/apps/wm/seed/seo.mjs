// SEO seed: the redirects the website already performs, and the site-wide search settings.
//
// Redirects come from navigation.js normalizeLocation(), which rewrites old addresses in the
// browser. Each one is checked against main's source text, so a change there fails the seed
// instead of drifting. Their targets are the real addresses every view has since S3 (D-035,
// cms/connect: /work/x, not /work#/project/x); the site's build writes them into vercel.json, so
// the host answers them as 301s and the browser rewrite stays only as a fallback. /services/…
// and /insights/… used to be aliases too; they're real addresses now, so no redirect.
// Search visibility starts as the site is today: noindex everywhere until the content is
// approved (plan: D6). Only someone with site:visibility can change it.
import path from "node:path";

const FROM_NAVIGATION = [
  { from: "/platform", to: "/software#plan-builder", check: 'path === "/platform" || path === "/pricing"' },
  { from: "/pricing", to: "/software#plan-builder", check: 'path === "/platform" || path === "/pricing"' },
  { from: "/platform/*", to: "/software/*", check: 'path.startsWith("/platform/")' },
  { from: "/pricing/plans", to: "/software/plans/*", note: "Keeps mode, duration and modules from the query, so the browser does this one.", check: 'path === "/pricing/plans"', handledBy: "browser" },
  { from: "/projects", to: "/work", check: 'path === "/projects"' },
  { from: "/projects/*", to: "/work/*", check: 'path.startsWith("/projects/")' },
  { from: "/privacy", to: "/legal/privacy", check: '["/privacy", "/terms", "/imprint", "/sitemap"]' },
  { from: "/terms", to: "/legal/terms", check: '["/privacy", "/terms", "/imprint", "/sitemap"]' },
  { from: "/imprint", to: "/legal/imprint", check: '["/privacy", "/terms", "/imprint", "/sitemap"]' },
  { from: "/sitemap", to: "/legal/sitemap", check: '["/privacy", "/terms", "/imprint", "/sitemap"]' },
];

export function buildSeo({ ref, read, SEEDED_AT }) {
  const src = read(path.join(ref, "navigation.js"));
  const redirects = FROM_NAVIGATION.map(({ check, handledBy, ...r }, i) => {
    if (!src.includes(check)) throw new Error(`navigation.js changed: ${check}`);
    return { id: `rd_${String(i + 1).padStart(2, "0")}`, ...r, code: 301, source: "website", handledBy: handledBy ?? "host", createdAt: SEEDED_AT, createdBy: "seed", version: 1 };
  });
  const settings = {
    canonicalHost: "https://orgtik.ch",
    visibility: "noindex",
    // Only English is public today (LanguageMenu shows EN; the others are previews).
    publicLocales: ["en"],
    version: 1,
    history: [{ at: SEEDED_AT, by: "seed", visibility: "noindex", note: "As the website is today: hidden from search until the content is approved." }],
  };
  return { redirects, settings };
}
