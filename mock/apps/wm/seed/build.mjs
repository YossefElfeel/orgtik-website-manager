// Builds the Website Manager's seed from the website's own content, read-only.
//
//   node apps/wm/seed/build.mjs
//
// Reads orgtik-website/landing-directions/src/reference/{projects,case-studies}.js, the purchasing
// catalogs ({service,software,purchase}-catalog.js) and the data fields of Home.jsx and Insights.jsx
// (fields.mjs) at the website's main (the D-031 baseline: c8be7fe), maps them onto the content model v2 and
// writes apps/wm/seed/website.json with the commit it came from. Re-run it in the D-031 drift
// protocol when the website changes. The website repo is never written to.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { field } from "./fields.mjs";
import { buildPages } from "./pages.mjs";
import { buildCatalog } from "./catalog.mjs";
import { buildPricing } from "./pricing.mjs";
import { applyPlatformCommerceCopy, platformPricingEntry } from "./platform-pricing.mjs";
import { applyWebsiteAlignment, websiteAlignmentRedirects } from "./website-alignment.mjs";
import managerImprovements from "./manager-improvements.js";
import { buildMedia } from "./media.mjs";
import { buildSeo } from "./seo.mjs";
import { restoredRoadmap, followupSource, ROADMAP_REF, WEBSITE_REF } from "./source-overrides.mjs";
import defaults from "../defaults.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = process.env.SEED_SOURCE_REPO
  ? path.resolve(process.env.SEED_SOURCE_REPO)
  : path.resolve(here, "..", "..", "..", "..", "..", "orgtik-website");
// Read the pinned upstream source regardless of the checkout: cms/connect turns the pages
// into readers of this seed, and website main remains a recovery point.
// Pin the latest integrated upstream revision without changing website main. SEED_REF may
// explicitly override it for a future sync; normal regeneration uses WEBSITE_REF.
const SEED_REF = process.env.SEED_REF ?? WEBSITE_REF;
const site = fs.mkdtempSync(path.join(os.tmpdir(), "wm-seed-site-"));
execFileSync("tar", ["-xf", "-", "-C", site], { input: execFileSync("git", ["-C", repo, "archive", "--format=tar", SEED_REF, "landing-directions"], { maxBuffer: 256 << 20 }) });
process.on("exit", () => fs.rmSync(site, { recursive: true, force: true }));
const ref = path.join(site, "landing-directions", "src", "reference");
const roadmapRevision = execFileSync("git", ["-C", repo, "rev-parse", ROADMAP_REF], {encoding:"utf8"}).trim();
fs.writeFileSync(path.join(ref, "Roadmap.jsx"), restoredRoadmap(execFileSync("git", ["-C", repo, "show", `${ROADMAP_REF}:landing-directions/src/reference/Roadmap.jsx`], {encoding:"utf8",maxBuffer:16<<20})));
for (const file of ['PaymentDetails.jsx', 'purchase-payment.js', 'CaseStudy.jsx']) fs.writeFileSync(path.join(ref,file), followupSource(file,fs.readFileSync(path.join(ref,file),'utf8')));
const LOCALES = ["en", "ar", "de", "fr", "it"];

// The data modules are self-contained ES modules; load each one from its text so the website's
// package settings don't matter.
async function load(file) {
  const src = fs.readFileSync(path.join(ref, file), "utf8");
  return import("data:text/javascript;charset=utf-8," + encodeURIComponent(src));
}

const commit = execFileSync("git", ["-C", repo, "rev-parse", "--short", SEED_REF], { encoding: "utf8" }).trim();
// Read from a commit, so never "uncommitted changes".
const dirty = false;
const { PROJECTS } = await load("projects.js");
const { CASE_STUDIES, CASE_STUDY_FORMATS } = await load("case-studies.js");

const SEEDED_AT = "2026-09-30T08:00:00.000Z";
const untranslated = Object.fromEntries(LOCALES.map((l) => [l, l === "en" ? "published" : "not_started"]));

// D-032: a case study joins the project record (projects.js) and its brief and department blocks
// (case-studies.js). Language-neutral things (department, images, figures' provenance) sit on the
// entry; everything a reader reads sits under locales.<lang>.
const caseStudies = PROJECTS.map((p, i) => {
  const cs = CASE_STUDIES[p.slug];
  // Main may publish owned work without publishing a case-study narrative or results.
  const { department = p.service, client, timeline, team, challenge, goal, role, highlight, approach, delivered, results } = {...defaults.caseWords(p.service), ...cs};
  if (department !== p.service) throw new Error(`${p.slug}: department ${department} vs service ${p.service}`);
  return {
    id: `cs_${String(i + 1).padStart(2, "0")}`,
    type: "caseStudy",
    siteId: "orgtik",
    department,
    narrativePublished: false,
    sampleNarrativePublished: Boolean(cs),
    format: CASE_STUDY_FORMATS[department],
    slug: { en: p.slug },
    order: i + 1,
    image: { src: p.image, alt: {} },
    gallery: p.gallery.map((src) => ({ src, alt: {} })),
    // The website's rule (AGENTS.md 2026-09-30): figures stay labelled as samples until an
    // approver with claims:approve confirms real results.
    provenance: { figures: "sample", sampleLabel: { en: p.status } },
    locales: {
      en: {
        name: p.name,
        category: p.category,
        sector: p.sector,
        summary: p.summary,
        transformation: p.transformation,
        client,
        timeline,
        team,
        challenge,
        goal,
        role,
        highlight,
        approach,
        delivered,
        results,
      },
    },
    seo: {
      en: {
        title: p.name,
        description: p.summary,
        ogImage: p.image,
        // The whole site is noindex until its content is approved (plan: SEO, D6).
        robots: "noindex",
        inSitemap: true,
      },
    },
    workflow: { state: "published", visibility: "live", version: 1, updatedAt: SEEDED_AT, updatedBy: "seed", publishedAt: SEEDED_AT },
    translation: untranslated,
  };
});

// ---- The rest of the content lives as class fields in the page components (fields.mjs). ----
const pageField = (file, name) => field(path.join(ref, file), name);
// Since c8be7fe the families and the software products live in the website's purchasing catalogs,
// which the cart and checkout read too: the website keeps them (owner's choice, 2026-10-03) and the
// Website Manager mirrors them read-only (managedIn). Their pages' slugs and SEO stay editable here.
const { SERVICE_FAMILIES: FAM } = await load("service-catalog.js");
const { SOFTWARE_PRODUCTS: MODS } = await load("software-catalog.js");
const SERVICE_FILE = "src/reference/service-catalog.js";
const SOFTWARE_FILE = "src/reference/software-catalog.js";
// Home names the modules by a short label where Software uses the formal name ("Website" vs
// "Website Manager"): kept as its own field.
const HOME_MODS = pageField("Home.jsx", "MODS");
const INS = pageField("Insights.jsx", "INS");
const ART = pageField("Insights.jsx", "ART");
const SVC = pageField("Insights.jsx", "SVC");
const pad = (n) => String(n).padStart(2, "0");
const entry = (id, type, order, neutral, en, seo) => ({
  id,
  type,
  siteId: "orgtik",
  order,
  ...neutral,
  locales: { en },
  seo: { en: { robots: "noindex", inSitemap: true, ...seo } },
  workflow: { state: "published", visibility: "live", version: 1, updatedAt: SEEDED_AT, updatedBy: "seed", publishedAt: SEEDED_AT },
  translation: untranslated,
});

// Service families and their services (Services.jsx FAM). A service points at its family; the
// order inside the family is the website's.
const families = FAM.map((f, i) =>
  entry(`sf_${pad(i + 1)}`, "serviceFamily", i + 1, { slug: { en: f.slug }, icon: f.icon, image: { src: f.image, alt: {} }, managedIn: SERVICE_FILE }, { name: f.name, short: f.short, kicker: f.kicker, title: f.title, intro: f.intro }, { title: f.name, description: f.intro, ogImage: f.image }),
);
let n = 0;
const services = FAM.flatMap((f, i) =>
  f.children.map((c, j) =>
    entry(`sv_${pad(++n)}`, "service", j + 1, { slug: { en: c.slug }, parent: `sf_${pad(i + 1)}`, managedIn: SERVICE_FILE }, { name: c.name, outcome: c.outcome, summary: c.summary, capabilities: c.capabilities }, { title: c.name, description: c.summary }),
  ),
);

// Software modules (Software.jsx MODS). The number ("01") is the order, computed, not copy; the
// monthly price belongs to pricingDisplay (plan: Pricing), not to the module.
const modules = MODS.map((m, i) =>
  entry(
    `sm_${pad(i + 1)}`,
    "softwareModule",
    i + 1,
    { slug: { en: m.id }, icon: m.icon, image: { src: m.image, alt: {} }, managedIn: SOFTWARE_FILE },
    { name: m.name, formal: m.formal, shortLabel: HOME_MODS.find((h) => h.id === m.id)?.formal ?? m.formal, category: m.category, title: m.title, short: m.short, description: m.description, tasks: m.tasks, highlights: m.highlights, useCases: m.useCases },
    { title: `${m.name} · ${m.formal}`, description: m.description, ogImage: m.image },
  ),
);
const pricing = { currency: "CHF", priceMode: "indicative", modules: Object.fromEntries(MODS.map((m) => [m.id, { monthly: m.monthlyPrice }])) };

// Articles (Insights.jsx INS + ART). The category is the service family it belongs to (SVC); the
// date and reading time are data, and the site formats them ("18 September 2026", "7 min read").
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const isoDate = (s) => {
  const [d, mon, y] = s.split(" ");
  const m = MONTHS.indexOf(mon);
  if (m < 0) throw new Error(`date ${s}`);
  return `${y}-${pad(m + 1)}-${pad(Number(d))}`;
};
const articles = INS.map((a, i) => {
  const body = ART[a.slug];
  if (!body) throw new Error(`no article body for ${a.slug}`);
  const family = SVC[a.category]?.[0];
  if (!family) throw new Error(`${a.slug}: category ${a.category} has no service family`);
  const minutes = Number(/^(\d+) min read$/.exec(a.readingTime)?.[1]);
  if (!minutes) throw new Error(`${a.slug}: reading time ${a.readingTime}`);
  return entry(
    `ar_${pad(i + 1)}`,
    "article",
    i + 1,
    { slug: { en: a.slug }, category: family, publishedOn: isoDate(a.date), readingMinutes: minutes, image: { src: a.image, alt: {} } },
    { ...defaults.blankContent("article").locales.en, name: a.title, excerpt: a.excerpt, takeaways: body.t, sections: body.b.map(([heading, paragraphs]) => ({ heading, paragraphs })) },
    { title: a.title, description: a.excerpt, ogImage: a.image },
  );
});

// Pages and Global (pages.mjs): the copy written into each page, its data blocks, and the parts
// every page repeats. navigation.js turns the site's file links into paths.
const { toSiteHref } = await load("navigation.js");
const site_ = buildPages({ ref, toSiteHref, entry });
applyPlatformCommerceCopy(site_.global);
// Format labels exist even when no story of that department has been published.
site_.global.push(entry("gl_caseFormats", "global", site_.global.length + 1,
  { name: "Case study formats", slug: {}, layout: [{ key: "formats", kind: "data", label: "caseFormats", node: { kind: "group", fields: Object.entries({design:"caseFormatDesign",development:"caseFormatDevelopment",hosting:"caseFormatHosting","digital-marketing":"caseFormatMarketing","it-support":"caseFormatSupport"}).map(([key,label]) => [key, { kind: "text", label }]).reduce((all,[key,value]) => ({...all,[key]:value}),{}) } }] },
  { formats: CASE_STUDY_FORMATS }, {}));
site_.global.find(e => e.id === "gl_caseFormats").seo = {};
// Strings, legal documents, the roadmap and its ideas (catalog.mjs).
const cat = buildCatalog({ ref, entry, SEEDED_AT });
// What the website shows as prices (pricing.mjs).
const pricingEntries = await buildPricing({ ref, entry });
// Every image, logo and video the site ships (media.mjs).
const media = buildMedia({ site, ref, SEEDED_AT, pages: [["home", "Home.jsx"], ["services", "Services.jsx"], ["software", "Software.jsx"], ["work", "Work.jsx"], ["about", "About.jsx"], ["insights", "Insights.jsx"], ["contact", "Contact.jsx"], ["roadmap", "Roadmap.jsx"], ["legal", "Legal.jsx"], ["signIn", "SignIn.jsx"], ["caseStudy", "CaseStudy.jsx"], ["testimonials", "Testimonials.jsx"], ["app", "../App.jsx"], ["document", "../../index.html"]] });

const out = {
  source: {
    repo: "orgtik-website",
    commit,
    overrides: {roadmap: {commit: roadmapRevision, file: "src/reference/Roadmap.jsx", reason: "Approved restoration of public sample timeline and moderated ideas"}},
    dirty,
    files: ["src/reference/projects.js", "src/reference/case-studies.js", "src/reference/service-catalog.js", "src/reference/software-catalog.js", "src/reference/purchase-catalog.js", "src/reference/Insights.jsx#INS,ART,SVC", "src/reference/*.jsx (page copy)", "src/reference/navigation.js"],
    builtAt: new Date().toISOString(),
  },
  formats: CASE_STUDY_FORMATS,
  caseStudies,
  entries: [...site_.pages, ...site_.global, ...cat.strings, platformPricingEntry(SEEDED_AT), ...cat.legal, ...cat.roadmap, ...pricingEntries, ...families, ...services, ...modules, ...articles],
  ideas: cat.ideas,
  media,
  seo: buildSeo({ ref, SEEDED_AT, read: (f) => fs.readFileSync(f, "utf8") }),
  duplicates: site_.duplicates,
  uses: site_.uses,
  pricing,
};
applyWebsiteAlignment(out.entries);
managerImprovements.applyManagerImprovements(out);
out.seo.redirects = websiteAlignmentRedirects();
out.source.overrides.websiteAlignment = { repo: "orgtik-suite", revision: "bfd1238", file: "mock/apps/wm/seed/website-alignment.json", reason: "Approved Partners, account setup, Imprint and Legal content from the current website" };
const output = process.env.SEED_OUTPUT_FILE ? path.resolve(process.env.SEED_OUTPUT_FILE) : path.join(here, "website.json");
fs.writeFileSync(output, JSON.stringify(out, null, 2) + "\n");
console.log(
  `seed: ${cat.strings.reduce((n, e) => n + e.layout.reduce((m, x) => m + x.slots.length, 0), 0)} strings in ${cat.strings.length} groups, ${cat.legal.length} legal documents, ${cat.roadmap.length} roadmap items, ${cat.ideas.length} ideas, ${site_.pages.length} pages (${site_.pages.reduce((n, p) => n + p.layout.filter((s) => s.kind === "copy").reduce((m, s) => m + s.slots.length, 0), 0)} copy slots), ${site_.global.length} global, ${caseStudies.length} case studies, ${families.length} service families, ${services.length} services, ${modules.length} software modules, ${articles.length} articles from orgtik-website@${commit}${dirty ? " (uncommitted changes!)" : ""} -> apps/wm/seed/website.json`,
);
