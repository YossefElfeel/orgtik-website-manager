// Every address the site answers, and what its <head> says: the SEO block each page and entry
// carries in the Website Manager, with the site-wide settings filling what an entry leaves empty
// (S3, D-035). scripts/prerender-heads.mjs writes these into each address's HTML at build time;
// the running site uses the same titles when it moves between views.
import snapshot from "./snapshot.js";

const { entries, site = {}, redirects = [] } = snapshot;
const HOST = (site.canonicalHost ?? "https://orgtik.ch").replace(/\/$/, "");
const plain = (s) =>
  String(s ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
const nameOf = (e) =>
  plain(e.locales?.en?.name ?? e.locales?.en?.title ?? e.name ?? e.id);
const asset = (src) =>
  !src
    ? null
    : /^https?:/.test(src)
      ? src
      : src.startsWith("/")
        ? HOST + src
        : `${HOST}/assets/${src}`;
// Read when asked, not at load: a preview lays drafts over the entries first (preview.js).
let pages, families;
const organization = () => ({
  "@type": "Organization",
  name: site.organization?.name ?? site.siteName ?? "OrgTik",
  url: HOST + "/",
  logo: `${HOST}/assets/logo/orgtik-app-icon.svg`,
  ...(site.organization?.address ? { address: site.organization.address } : {}),
  ...(site.organization?.email ? { email: site.organization.email } : {}),
  ...(site.organization?.phone ? { telephone: site.organization.phone } : {}),
});

// The routable things, in the site's order: each page, then the entries that have an address.
function build() {
  pages = new Map(entries.page.map((p) => [p.slug.en, p]));
  families = new Map(entries.serviceFamily.map((f) => [f.id, f]));
  const list = [];
  const add = (path, entry, kind, trail, extra = {}) =>
    list.push({ path, entry, kind, trail, ...extra });
  for (const p of entries.page)
    add(p.slug.en, p, "page", p.slug.en === "/" ? [] : [p]);
  // Sign up is the sign-in page's other form: same page, same record.
  const signIn = pages.get("/sign-in");
  if (signIn && !pages.has("/sign-up"))
    add("/sign-up", signIn, "page", [signIn], { label: "sign up" });
  const under = (base) => pages.get(base);
  for (const f of entries.serviceFamily)
    add(`/services/${f.slug.en}`, f, "serviceFamily", [under("/services"), f]);
  for (const s of entries.service) {
    const f = families.get(s.parent);
    if (f)
      add(`/services/${f.slug.en}/${s.slug.en}`, s, "service", [
        under("/services"),
        f,
        s,
      ]);
  }
  for (const m of entries.softwareModule)
    add(`/software/${m.slug.en}`, m, "softwareModule", [under("/software"), m]);
  for (const c of entries.caseStudy)
    add(`/work/${c.slug.en}`, c, "caseStudy", [under("/work"), c]);
  for (const a of entries.article)
    add(`/insights/${a.slug.en}`, a, "article", [under("/insights"), a]);
  for (const l of entries.legalDocument)
    add(`/legal/${l.slug.en}`, l, "legalDocument", [under("/legal"), l]);
  // The plan builder's result is a view of the software page with its choices in the
  // address, so it's never indexed on its own.
  const software = under("/software");
  if (software)
    add("/software/plans", software, "page", [software], {
      label: "plans",
      prefix: true,
      robots: "noindex",
      inSitemap: false,
    });
  return list.filter((r) => r.trail.every(Boolean));
}
// Built again only when an address could have changed (a slug in a preview).
let ROUTES, EXACT, built;
function routes() {
  const key = JSON.stringify(
    Object.values(entries)
      .flat()
      .map((e) => `${e.id}:${e.parent ?? ""}:${e.slug?.en ?? ""}`),
  );
  if (key !== built) {
    ROUTES = build();
    EXACT = new Map(ROUTES.map((r) => [r.path, r]));
    built = key;
  }
  return ROUTES;
}

/** The route an address belongs to, or null (the not-found page). */
export function routeOf(pathname) {
  const path = pathname.replace(/\/$/, "") || "/";
  routes();
  return (
    EXACT.get(path) ??
    ROUTES.find((r) => r.prefix && path.startsWith(r.path + "/")) ??
    null
  );
}

function jsonLd(r, head) {
  const e = r.entry;
  const en = e.locales?.en ?? {};
  const graph = [];
  if (r.path === "/")
    graph.push(organization(), {
      "@type": "WebSite",
      name: site.siteName ?? "OrgTik",
      url: HOST + "/",
    });
  const main = {
    serviceFamily: "Service",
    service: "Service",
    softwareModule: "SoftwareApplication",
    article: "BlogPosting",
    caseStudy: "CreativeWork",
  }[r.kind];
  if (main) {
    const node = {
      "@type": main,
      name: nameOf(e),
      description: head.description,
      url: head.canonical,
      ...(head.image ? { image: head.image } : {}),
    };
    if (main === "Service") node.provider = organization();
    if (main === "SoftwareApplication")
      Object.assign(node, {
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
      });
    if (main === "BlogPosting") {
      node.headline = nameOf(e);
      node.author = organization();
      if (/^\d{4}-\d{2}-\d{2}/.test(e.publishedOn ?? ""))
        node.datePublished = e.publishedOn.slice(0, 10);
    }
    if (main === "CreativeWork") node.creator = organization();
    graph.push(node);
  }
  if (r.trail.length > 1 || (r.trail.length === 1 && r.path !== "/")) {
    // Home › the page › (a service's family ›) this.
    const last = r.trail.length - 1;
    const items = [
      { name: nameOf(pages.get("/")), path: "/" },
      ...r.trail.map((x, i) => ({
        name: i === last && r.label ? r.label : nameOf(x),
        path:
          i === last
            ? r.path
            : i === 0
              ? x.slug.en
              : `${r.trail[0].slug.en}/${x.slug.en}`,
      })),
    ];
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: items.map((x, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: x.name,
        item: HOST + (x.path === "/" ? "/" : x.path),
      })),
    });
  }
  const custom = e.seo?.en?.jsonLd;
  if (custom) graph.push(...(Array.isArray(custom) ? custom : [custom]));
  return graph.length
    ? { "@context": "https://schema.org", "@graph": graph }
    : null;
}

/** What an address's <head> says. Null for an address the site doesn't have. */
// `locale`: a public language's own SEO record (S5); English where it has none yet.
export function headFor(pathname, locale = "en") {
  const r = routeOf(pathname);
  if (!r) return null;
  const seo = r.entry.seo?.[locale] ?? r.entry.seo?.en ?? {};
  const template = site.titleTemplate ?? "{page} | OrgTik";
  // A title already written in the template's form is used as it is; otherwise the template wraps it.
  const own = plain(seo.title);
  const [before, after] = template.split("{page}");
  const wrapped =
    own && (before || after) && own.startsWith(before) && own.endsWith(after);
  const title = r.label
    ? template.replace("{page}", r.label)
    : wrapped
      ? own
      : template.replace("{page}", own || nameOf(r.entry));
  const description = plain(seo.description) || site.defaultDescription || "";
  const path = r.prefix ? pathname.replace(/\/$/, "") : r.path;
  const canonical =
    seo.canonical || HOST + (r.path === "/" ? "/" : r.prefix ? r.path : path);
  const indexable =
    site.visibility !== "noindex" &&
    (r.robots ?? seo.robots ?? "index") !== "noindex";
  const image =
    asset(seo.ogImage) ??
    asset(r.entry.image?.src) ??
    asset(site.defaultOgImage);
  const head = {
    path,
    title,
    description,
    robots:
      site.visibility === "noindex"
        ? "noindex,nofollow"
        : indexable
          ? "index,follow"
          : "noindex,follow",
    canonical,
    image,
    imageAlt:
      plain(r.entry.image?.alt?.[locale] ?? r.entry.image?.alt?.en) || null,
    type: r.kind === "article" ? "article" : "website",
    siteName: site.siteName ?? "OrgTik",
    // One entry per public language; only English is public so far (the others add /de/… etc.).
    alternates: (site.publicLocales ?? ["en"]).map((l) => ({
      hreflang: l,
      href:
        l === "en" ? canonical : `${HOST}/${l}${r.path === "/" ? "" : r.path}`,
    })),
  };
  head.jsonLd = jsonLd(r, head);
  // As the Website Manager's sitemap: robots.txt decides whether search engines read it at all.
  head.inSitemap = r.inSitemap !== false && seo.inSitemap !== false;
  return head;
}

/** Every address with a head of its own (the plan builder's stands for all its choices). */
export const addresses = () => routes().map((r) => r.path);
export const siteSettings = () => site;
export const siteRedirects = () => redirects;
