// Copies the website's published content from the Website Manager into src/content/snapshot.js.
//
//   node scripts/content-pull.mjs                     from http://localhost:4007/v2 (local-dev)
//   CMS_API=https://… node scripts/content-pull.mjs   from another Website Manager
//
// The pages render from this copy, so the first paint never waits for the network and the site
// keeps working if the Website Manager is down (D-012: last-known-good copy). Run it after
// publishing; commit the result with the change it brings. Only published content is read.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const API = process.env.CMS_API ?? "http://localhost:4007/v2";
const TYPES = [
  "page",
  "global",
  "strings",
  "caseStudy",
  "serviceFamily",
  "service",
  "softwareModule",
  "article",
  "legalDocument",
  "roadmapItem",
  "pricing",
  "review",
];

async function get(p, text = false) {
  const res = await fetch(`${API}/public/${p}`);
  if (!res.ok) throw new Error(`${p}: ${res.status}`);
  return text ? res.text() : (await res.json()).data;
}

const entries = {};
for (const t of TYPES) entries[t] = await get(`entries/${t}`);
const ideas = await get("ideas");
// What the head tags need (scripts/prerender-heads.mjs): the site's settings, its redirects and
// robots.txt, as the Website Manager has them.
const site = await get("site");
const redirects = await get("redirects");
const robots = await get("robots.txt", true);
const snapshot = {
  source: API,
  pulledAt: new Date().toISOString(),
  entries,
  ideas,
  site,
  redirects,
  robots,
};
const out = path.join(here, "..", "src", "content", "snapshot.js");
fs.mkdirSync(path.dirname(out), { recursive: true });
// Same content as last time: leave the file (and its pull time) alone, so a pull never makes a change on its own.
const before = fs.existsSync(out)
  ? (await import(`${pathToFileURL(out).href}?t=${Date.now()}`)).default
  : null;
const unchanged =
  before &&
  JSON.stringify({
    entries: before.entries,
    ideas: before.ideas,
    site: before.site,
    redirects: before.redirects,
    robots: before.robots,
  }) === JSON.stringify({ entries, ideas, site, redirects, robots });
if (unchanged) console.log("content: unchanged since the last pull");
else {
  fs.writeFileSync(
    out,
    `// Pulled from the Website Manager by scripts/content-pull.mjs. Don't edit by hand: change it there and pull.\nexport default ${JSON.stringify(snapshot, null, 1)};\n`,
  );
  console.log(
    `content: ${Object.entries(entries)
      .map(([t, x]) => `${x.length} ${t}`)
      .join(", ")}, ${ideas.length} ideas -> src/content/snapshot.js`,
  );
}

// The host answers the redirects (vercel.json is read before the build, so it's written here,
// with the content it comes from). "/projects/*" → "/work/*" becomes "/projects/:path*".
// Everything else: the address's own prerendered HTML (scripts/prerender-heads.mjs), or the
// not-found page with a real 404. The plan builder's choices and the old *.dc.html names are the
// two kinds of address only the browser can resolve, so they get the app's HTML.
const VERCEL = path.join(here, "..", "vercel.json");
const star = (x) => x.replace(/\/\*$/, "/:path*");
// In the orgtik-suite monorepo the install, build and skip commands come from the shared Vercel
// configuration (tools/vercel/configure.mjs); outside it (the owner's own repo) the build is npm.
const suiteConfig = path.join(here, "..", "..", "..", "..", "tools", "vercel", "configure.mjs");
const commands = fs.existsSync(suiteConfig)
  ? (await import(pathToFileURL(suiteConfig).href)).commandsFor("apps/website/landing-directions")
  : { buildCommand: "npm run build" };
const vercel = {
  // Keep host settings (including response headers) when regenerating CMS redirects.
  ...(fs.existsSync(VERCEL) ? JSON.parse(fs.readFileSync(VERCEL, "utf8")) : {}),
  $schema: "https://openapi.vercel.sh/vercel.json",
  framework: "vite",
  ...commands,
  outputDirectory: "dist/client",
  redirects: redirects
    .filter((r) => r.handledBy !== "browser")
    .map((r) => ({
      source: star(r.from),
      destination: star(r.to),
      permanent: r.code === 301 || r.code === 308,
    })),
  rewrites: [
    {
      source: "/software/plans/:path*",
      destination: "/software/plans/index.html",
    },
    { source: "/pricing/plans", destination: "/index.html" },
    { source: "/:file*.dc.html", destination: "/index.html" },
  ],
};
const vercelText = JSON.stringify(vercel, null, 2) + "\n";
if (!fs.existsSync(VERCEL) || fs.readFileSync(VERCEL, "utf8") !== vercelText) {
  fs.writeFileSync(VERCEL, vercelText);
  console.log(`vercel.json: ${vercel.redirects.length} redirects`);
}
