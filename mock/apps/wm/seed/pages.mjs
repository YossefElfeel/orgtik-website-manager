// Pages and Global for the Website Manager seed (plan, Phase 2 "Full website coverage").
//
// A page entry is the page's own copy (copy.mjs: every literal string, grouped by section) plus
// the data blocks it keeps as class fields (fields.mjs), each with the schema the editor draws.
// The header, the footer, the menu, the social networks and the process steps repeat on every
// page, so they are Global entries, taken from Home; how each other page differs from Home is
// recorded (`duplicates`), so the drift protocol sees it.
//
// Each entry carries `layout` (language-neutral): its sections, in page order, each either
//   { key, kind: "copy", label, slots: [{ key, kind, level?, href?, source? }] }
//   { key, kind: "data", label, node }            (node: the editor's schema, see caseStudySchema.ts)
// and its reader text under locales.en[section.key].
import path from "node:path";
import { extractCopy, viewArray } from "./copy.mjs";
import { field } from "./fields.mjs";

const PAGES = [
  ["home", "Home", "Home.jsx", "/"],
  ["services", "Services", "Services.jsx", "/services"],
  ["software", "Software", "Software.jsx", "/software"],
  ["work", "Work", "Work.jsx", "/work"],
  ["about", "About", "About.jsx", "/about"],
  ["insights", "Insights", "Insights.jsx", "/insights"],
  ["contact", "Contact", "Contact.jsx", "/contact"],
  ["roadmap", "Roadmap", "Roadmap.jsx", "/roadmap"],
  ["legal", "Legal", "Legal.jsx", "/legal"],
  ["signIn", "Sign in", "SignIn.jsx", "/sign-in"],
];

// Schema helpers (the same node kinds the editor knows).
const text = (label, extra = {}) => ({ kind: "text", label, ...extra });
const long = (label) => ({ kind: "longtext", label });
const tags = (label) => ({ kind: "tags", label });
const num = (label, extra = {}) => ({ kind: "number", label, ...extra });
const group = (fields) => ({ kind: "group", fields });
const list = (label, itemLabel, fields) => ({ kind: "list", label, itemLabel, item: group(fields) });
// Tuples become objects with named fields; the website's adapter turns them back (plan, S1).
const rows = (tuples, keys) => tuples.map((t) => Object.fromEntries(keys.map((k, i) => [k, t[i]]).filter(([k]) => k !== "_")));

/** Page data blocks: [section key it sits in or after, block key, label, node, value]. */
function dataBlocks(ref, key) {
  const f = (file, name) => field(path.join(ref, file), name);
  switch (key) {
    case "home":
      return [
        ["hero", "heroWords", "rotatingWords", tags("rotatingWords"), f("Home.jsx", "HERO_WORDS")],
        ["services", "homeServices", "homeServices", list("homeServices", "homeService", { title: text("title"), category: text("category"), icon: text("icon", { neutral: true }), text: long("text"), tags: tags("tags"), image: text("image", { neutral: true }), caption: text("caption") }), f("Home.jsx", "SVCS")],
        ["approach", "faqs", "faqs", list("faqs", "faq", { question: text("question"), answer: long("answer") }), rows(f("Home.jsx", "FAQS"), ["question", "answer"])],
      ];
    case "services":
      return [["families", "stories", "stories", list("stories", "story", { title: text("title"), body: long("storyBody"), icon: text("icon", { neutral: true }) }), rows(f("Services.jsx", "STORIES"), ["title", "body", "icon"])]];
    case "software":
      return [
        ["workspace", "flow", "flow", list("flow", "flowStep", { icon: text("icon", { neutral: true }), name: text("name"), title: text("title"), body: long("body") }), rows(f("Software.jsx", "FLOW"), ["icon", "name", "title", "body"])],
        ["workspace", "context", "contextItems", list("contextItems", "contextItem", { step: num("flowStepIndex", { min: 0, max: 5 }), icon: text("icon", { neutral: true }), label: text("label") }), rows(f("Software.jsx", "CTX"), ["step", "icon", "label"])],
        ["plan-builder", "planSteps", "planSteps", list("planSteps", "step", { title: text("title"), body: long("body") }), f("Software.jsx", "STEPS").map(({ title, body }) => ({ title, body }))],
      ];
    case "about":
      return [
        ["journey", "journeySteps", "journey", list("journey", "journeyStep", { title: text("title"), body: long("body"), outcome: text("outcome") }), rows(f("About.jsx", "JR"), ["_", "title", "body", "outcome"])],
        [
          "capabilities",
          "capabilityRoutes",
          "capabilities",
          list("capabilities", "capability", { title: text("title"), lead: text("lead"), body: long("body"), tags: tags("tags"), href: text("link", { neutral: true }), image: text("image", { neutral: true }), icon: text("icon", { neutral: true }), cta: text("cta") }),
          rows(f("About.jsx", "CAPS"), ["title", "lead", "body", "tags", "href", "image", "icon", "cta"]),
        ],
      ];
    case "contact":
      return [
        ["enquiry", "topics", "topics", tags("topics"), f("Contact.jsx", "TOPICS")],
        ["enquiry", "paths", "paths", list("paths", "path", { id: text("key", { locked: true }), icon: text("icon", { neutral: true }), title: text("title"), body: long("body"), audience: text("audience"), topic: text("topic") }), rows(f("Contact.jsx", "PATHS"), ["id", "icon", "title", "body", "audience", "topic"])],
      ];
    default:
      return [];
  }
}

const plain = (s) => String(s ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/** Copy regions → layout sections + their English text. */
function copySections(regions, toHref) {
  const layout = [];
  const en = {};
  for (const r of regions) {
    const heading = r.slots.find((s) => s.kind === "heading") ?? r.slots.find((s) => s.kind === "paragraph" || s.kind === "text");
    layout.push({
      key: r.key,
      kind: "copy",
      label: heading ? plain(heading.text).slice(0, 60) : null,
      slots: r.slots.map(({ key, kind, level, href, source }) => ({ key, kind, ...(r.key === "paymentDetails-intro" && key === "p" ? {fixedValues:["4242 4242 4242 4242","5555 5555 5555 4444","12/30","123"]} : {}), ...(level ? { level } : {}), ...(href ? { href: toHref(href) } : {}), ...(source ? { source } : {}) })),
    });
    en[r.key] = Object.fromEntries(r.slots.map((s) => [s.key, s.text]));
  }
  return { layout, en };
}

export function buildPages({ ref, toSiteHref, entry }) {
  const toHref = (h) => (h.startsWith("#") ? h : toSiteHref(h));
  const pages = [];
  const duplicates = {};
  const copyOf = Object.fromEntries(PAGES.map(([key, , file]) => [key, extractCopy(path.join(ref, file)).regions]));
  const homeHeader = copyOf.home.find((r) => r.key === "header");
  const homeFooter = copyOf.home.find((r) => r.key === "footer");
  const texts = (r) => JSON.stringify(r?.slots.map((s) => s.text) ?? []);
  // A link to the page itself is written #top on Home and #/ elsewhere: both mean "this page".
  const links = (a, route) => JSON.stringify(a.map(([label, href]) => [label, ["#top", "#/", "#"].includes(href) ? route : toHref(href)]));

  PAGES.forEach(([key, name, file, route], i) => {
    const regions = copyOf[key];
    const page = regions.filter((r) => r.key !== "header" && r.key !== "footer");
    const { layout, en } = copySections(page, toHref);
    // Data blocks go right after the section they belong to.
    for (const [after, blockKey, label, node, value] of dataBlocks(ref, key)) {
      const at = layout.findIndex((s) => s.key === after);
      // A data block never shares a key with a copy section: it would overwrite that section's text.
      if (en[blockKey] !== undefined) throw new Error(`${key}: data block "${blockKey}" collides with a copy section`);
      layout.splice(at < 0 ? layout.length : at + 1, 0, { key: blockKey, kind: "data", label, node });
      en[blockKey] = value;
    }
    // How this page's repeated parts differ from Home's (Global keeps Home's).
    if (key !== "home") {
      const diff = [];
      if (texts(regions.find((r) => r.key === "header")) !== texts(homeHeader)) diff.push("header copy");
      if (texts(regions.find((r) => r.key === "footer")) !== texts(homeFooter)) diff.push("footer copy");
      for (const n of ["menuLinks", "footExplore", "footStart"]) {
        try {
          const mine = viewArray(path.join(ref, file), n);
          const home = viewArray(path.join(ref, "Home.jsx"), n);
          if (JSON.stringify(mine.map((x) => x[0])) !== JSON.stringify(home.map((x) => x[0]))) diff.push(`${n} labels`);
          else if (links(mine, route) !== links(home, "/")) diff.push(`${n} links`);
        } catch {
          diff.push(`${n} missing`);
        }
      }
      if (diff.length) duplicates[key] = diff;
    }
    pages.push(
      entry(`pg_${key}`, "page", i + 1, { name, slug: { en: route }, layout }, en, {
        // Today's tab title (App.jsx); descriptions don't exist yet and show as SEO issues.
        title: `${route === "/" ? "Digital studio + business software" : route.slice(1).replace(/-/g, " ")} | OrgTik`,
        description: "",
        ...(key === "signIn" ? { robots: "noindex", inSitemap: false } : {}),
      }),
    );
  });
  // The purchasing views since c8be7fe: an address and SEO each. Their words are the global
  // "Purchasing" entry; the cart and checkout are a visitor's own, so they stay out of search.
  [
    ["plans", "Bundles & pricing", "/plans", "Bundles & pricing | OrgTik", {}],
    ["cart", "Cart", "/cart", "cart | OrgTik", { robots: "noindex", inSitemap: false }],
    ["checkout", "Checkout", "/checkout", "checkout | OrgTik", { robots: "noindex", inSitemap: false }],
    ["signUp", "Sign up", "/sign-up", "sign up | OrgTik", { robots: "noindex", inSitemap: false }],
  ].forEach(([key, name, route, title, seo], i) => {
    pages.push(entry(`pg_${key}`, "page", PAGES.length + i + 1, { name, slug: { en: route }, layout: [] }, {}, { title, description: "", ...seo }));
  });

  // Global: taken from Home.
  const home = path.join(ref, "Home.jsx");
  const pairs = (a) => a.map(([label, href]) => ({ label, href: toHref(href) }));
  const linkList = (label, itemLabel) => list(label, itemLabel, { label: text("label"), href: text("link", { neutral: true }) });
  const header = copySections([homeHeader], toHref);
  header.layout.push({ key: "menu", kind: "data", label: "menu", node: linkList("menu", "menuLink") });
  // In the header and menu, Home's #top is the home page for every other page.
  header.en.menu = pairs(viewArray(home, "menuLinks")).map((l) => (l.href === "#top" ? { ...l, href: "/" } : l));
  for (const s of header.layout[0].slots) if (s.href === "#top") s.href = "/";
  const footer = copySections([homeFooter], toHref);
  // Slots every other page's footer has and Home's lacks (the logo link's "OrgTik home"): the same
  // footer, so they belong to it too. Home simply doesn't use them.
  const others = PAGES.filter(([k]) => k !== "home").map(([k]) => copyOf[k].find((r) => r.key === "footer")).filter(Boolean);
  for (const s of others[0]?.slots ?? []) {
    if (footer.en.footer[s.key] !== undefined) continue;
    if (!others.every((r) => r.slots.some((x) => x.key === s.key && x.text === s.text))) continue;
    footer.layout[0].slots.push({ key: s.key, kind: s.kind, ...(s.href ? { href: toHref(s.href) } : {}) });
    footer.en.footer[s.key] = s.text;
  }
  footer.layout.push({ key: "explore", kind: "data", label: "footerExplore", node: linkList("footerExplore", "footerLink") });
  footer.layout.push({ key: "start", kind: "data", label: "footerStart", node: linkList("footerStart", "footerLink") });
  footer.en.explore = pairs(viewArray(home, "footExplore"));
  footer.en.start = pairs(viewArray(home, "footStart"));
  const socials = rows(field(home, "SOCIALS"), ["name", "icon"]);
  const steps = rows(field(home, "STEPS"), ["name", "title", "body"]);
  let global = [
    entry("gl_header", "global", 1, { name: "Header and menu", slug: {}, layout: [...header.layout] }, header.en, {}),
    entry("gl_footer", "global", 2, { name: "Footer", slug: {}, layout: footer.layout }, footer.en, {}),
    entry("gl_socials", "global", 3, { name: "Social networks", slug: {}, layout: [{ key: "networks", kind: "data", label: "networks", node: list("networks", "network", { name: text("name"), icon: text("icon", { neutral: true }) }) }] }, { networks: socials }, {}),
    entry("gl_process", "global", 4, { name: "Process steps", slug: {}, layout: [{ key: "steps", kind: "data", label: "processSteps", node: list("processSteps", "step", { name: text("name"), title: text("title"), body: long("body") }) }] }, { steps }, {}),
  ];
  // The copy inside shared components (case study pages, related work, testimonials): one global
  // entry, a section per component region, keyed "<component>-<region>".
  const COMPONENTS = [["caseStudy", "CaseStudy.jsx"], ["serviceWork", "ServiceWork.jsx"], ["testimonials", "Testimonials.jsx"]];
  const compRegions = COMPONENTS.flatMap(([c, file]) => extractCopy(path.join(ref, file)).regions.map((r) => ({ ...r, key: `${c}-${r.key}` })));
  const comps = copySections(compRegions, toHref);
  global.push(entry("gl_components", "global", 5, { name: "Shared components", slug: {}, layout: comps.layout }, comps.en, {}));
  // The purchasing views since c8be7fe (/plans, /cart, /checkout and the builders' shared parts):
  // their copy as one global entry, keyed "<component>-<region>". Prices and package names stay in
  // the purchasing catalogs (read-only mirrors in Pricing).
  const COMMERCE = ["PurchaseUI.jsx", "PurchaseControls.jsx", "CommerceLayout.jsx", "PurchasePlans.jsx", "PurchaseCart.jsx", "PurchaseCheckout.jsx", "SiteHeader.jsx", "AccountControl.jsx", "PaymentDetails.jsx"].map((f) => [f.replace(".jsx", "").replace(/^./, (c) => c.toLowerCase()), f]);
  const comRegions = COMMERCE.flatMap(([c, file]) => extractCopy(path.join(ref, file)).regions.map((r) => ({ ...r, key: `${c}-${r.key}` })));
  const com = copySections(comRegions, toHref);
  global.push(entry("gl_commerce", "global", 6, { name: "Purchasing", slug: {}, layout: com.layout }, com.en, {}));
  // Global entries have no address and no SEO of their own.
  for (const g of global) g.seo = {};
  return { pages, global, duplicates, uses: { processSteps: ["home", "services"], softwareModules: ["home", "software"] } };
}
