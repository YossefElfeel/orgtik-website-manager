import { bare, splitLocale, withLocale } from "../content/locale.js";

const files = {
  "OrgTik Home": "/",
  Home: "/",
  Software: "/software",
  Services: "/services",
  Work: "/work",
  About: "/about",
  Insights: "/insights",
  Contact: "/contact",
  Roadmap: "/roadmap",
  Legal: "/legal",
  SignIn: "/sign-in",
};

// Real addresses (S3). The pages still think in their own view routes ("#/project/<slug>");
// every view has a real address, and these two tables translate between them. A hash that
// doesn't start with "/" stays what it always was: an anchor on the page.
const VIEW_TO_PATH = {
  "/services": [
    [/^\/family\/([^/]+)$/, (m) => `/services/${m[1]}`],
    [/^\/service\/([^/]+)\/([^/]+)$/, (m) => `/services/${m[1]}/${m[2]}`],
  ],
  "/software": [
    [/^\/product\/([^/]+)$/, (m) => `/software/${m[1]}`],
    [/^\/plans\/(.+)$/, (m) => `/software/plans/${m[1]}`],
  ],
  "/work": [[/^\/project\/([^/]+)$/, (m) => `/work/${m[1]}`]],
  "/insights": [[/^\/article\/([^/]+)$/, (m) => `/insights/${m[1]}`]],
  "/legal": [
    [/^\/(imprint|privacy|terms|partners|sitemap)$/, (m) => `/legal/${m[1]}`],
  ],
};
const PATH_TO_VIEW = {
  "/services": (p) =>
    p.length > 1 ? `#/service/${p[0]}/${p[1]}` : `#/family/${p[0]}`,
  "/software": (p) =>
    p[0] === "plans" ? `#/plans/${p.slice(1).join("/")}` : `#/product/${p[0]}`,
  "/work": (p) => `#/project/${p[0]}`,
  "/insights": (p) => `#/article/${p[0]}`,
  "/legal": (p) => `#/${p[0]}`,
};

/** The page an address belongs to: "/services/design/graphic-design" → "/services". */
export function pageOf(pathname) {
  // A language prefix (/ar/…) isn't part of the page's address.
  const path = bare(pathname).replace(/\/$/, "") || "/";
  const base = "/" + path.split("/")[1];
  return PATH_TO_VIEW[base] && path !== base ? base : path;
}

/** A view's real address on a page ("#/project/x" on "/work" → "/work/x"), or null. */
export function viewToPath(page, hash) {
  const h = decodeURIComponent(String(hash || "").replace(/^#/, ""));
  if (h === "" || h === "/") return page;
  for (const [re, to] of VIEW_TO_PATH[page] ?? []) {
    const m = h.match(re);
    if (m) return to(m);
  }
  return null;
}

/** The view the current address shows, in the pages' own form ("#/project/x"). */
export function routeHash(loc = window.location) {
  if (loc.hash.startsWith("#/")) return loc.hash;
  const path = bare(loc.pathname).replace(/\/$/, "") || "/";
  const page = pageOf(path);
  if (page !== path) {
    const parts = path
      .slice(page.length + 1)
      .split("/")
      .map(decodeURIComponent);
    return PATH_TO_VIEW[page](parts);
  }
  return loc.hash;
}

/**
 * Moves to a view of this page at its real address, and tells the page as a hash change used
 * to. `silent` only replaces the address (for a page that has already updated itself).
 */
export function setRoute(hash, { replace = false, silent = false } = {}) {
  const page = pageOf(window.location.pathname);
  const path = viewToPath(page, hash);
  if (path === null) {
    window.location.hash = hash;
    return;
  }
  window.history[replace || silent ? "replaceState" : "pushState"](
    {},
    "",
    withLocale(path) + window.location.search,
  );
  if (!silent) window.dispatchEvent(new HashChangeEvent("hashchange"));
}

export function toSiteHref(href) {
  if (!href || typeof href !== "string") return href;
  const match = href.match(/^(?:\.\/)?([^/#]+)\.dc\.html(.*)$/);
  if (!match) return href;
  const page = files[decodeURIComponent(match[1])] || "/";
  // A link to another page's view goes to its real address.
  if (match[2].startsWith("#/"))
    return viewToPath(page, match[2]) ?? page + match[2];
  return page + match[2];
}

// The address the browser shows: the real one. Old forms (the site's first aliases, and views in
// the hash) are rewritten in place, so every old link and bookmark keeps working.
export function normalizeLocation() {
  const { search, hash } = window.location;
  // The language prefix stays as it is; the rest is normalised as before.
  const { locale, path: pathname } = splitLocale(window.location.pathname);
  let path = pathname.replace(/\/$/, "") || "/",
    target = toSiteHref(path.slice(1));
  if (target !== path.slice(1)) path = target;
  let fragment = hash;
  const params = new URLSearchParams(search);
  if (path === "/platform" || path === "/pricing") {
    path = "/software";
    fragment ||= "#plan-builder";
  } else if (path.startsWith("/platform/")) {
    path = "/software/" + path.split("/")[2];
  } else if (path === "/pricing/plans") {
    path =
      "/software/plans/" +
      (params.get("mode") || "single") +
      "/" +
      (params.get("duration") || "annual") +
      "/" +
      (params.get("modules") || params.get("module") || "hr");
  } else if (path === "/projects") path = "/work";
  else if (path.startsWith("/projects/")) {
    path = "/work/" + path.split("/")[2];
  } else if (["/privacy", "/terms", "/imprint", "/sitemap"].includes(path)) {
    path = "/legal" + path;
  }
  // A view in the hash (the site's old links): its real address instead.
  if (fragment.startsWith("#/")) {
    const real = viewToPath(pageOf(path), fragment);
    if (real) {
      path = real;
      fragment = "";
    }
  }
  if (path !== pathname || fragment !== hash)
    window.history.replaceState(
      window.history.state,
      "",
      withLocale(path, locale) + search + fragment,
    );
}

export function cartBackTarget() {
  const internalPage = (href) => {
    if (typeof href !== "string" || !href) return null;
    try {
      const url = new URL(href, window.location.origin);
      if (
        url.origin !== window.location.origin ||
        pageOf(url.pathname) === "/cart"
      )
        return null;
      return url.pathname + url.search + url.hash;
    } catch {
      return null;
    }
  };
  const previousPage = internalPage(window.history.state?.cartReturnTo);
  return {
    href:
      previousPage || internalPage(document.referrer) || withLocale("/plans"),
    useHistory: !!previousPage && window.history.length > 1,
  };
}

export function readWorkspaceQuery(search = window.location.search) {
  const query = new URLSearchParams(search);
  const ids = ["hr", "crm", "files", "tasks", "marketing", "website"];
  // "complete" is the older name for the all-in-one suite.
  const presets = {
    operations: ["hr", "tasks", "files"],
    growth: ["crm", "marketing", "website"],
    suite: ids,
    complete: ids,
  };
  const raw = query.get("modules") || query.get("module");
  const selected = raw
    ? [...new Set(raw.split(",").filter((id) => ids.includes(id)))]
    : presets[query.get("mode")];
  const duration = query.get("duration");
  const plan = query.get("plan");
  return {
    ...(selected?.length ? { selected } : {}),
    ...(["monthly", "annual", "biennial"].includes(duration)
      ? { duration, prodDur: duration }
      : {}),
    ...(["starter", "complete", "ongoing"].includes(plan) ? { plan } : {}),
  };
}
