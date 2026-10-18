// Website Manager: the media library and SEO (plan, Phase 2 "Media" and "SEO and marketing").
//
// Media: every file the website ships plus uploads, each with a description per language, rights,
// a focal point, and where it's used, worked out live from the entries (a case study's image, a
// module's picture) and from the page code (the hero video, logos). A file in use can't be
// deleted. Issues: in use without an English description, rights unknown or expiring, unused.
//
// SEO: a health check per page and entry (what a search result and a shared link need), the
// redirects (validated: no chains, loops, or redirects covering a real page), and indexing:
// search visibility, the sitemap and robots.txt, generated from the same entries.
const fs = require("fs");
const path = require("path");

const clone = (v) => JSON.parse(JSON.stringify(v));
const codec = require("./state-codec");
const RIGHTS = ["unknown", "owned", "licensed", "stock", "client"];
// Where each routable type lives on the website (after S3; today most open through # routes).
const ADDRESS = {
  page: (e, c) => c.slug.en,
  caseStudy: (e, c) => `/work/${c.slug.en}`,
  serviceFamily: (e, c) => `/services/${c.slug.en}`,
  service: (e, c, entries) => `/services/${(entries.get(e.parent)?.draft ?? entries.get(e.parent)?.live)?.slug.en ?? "…"}/${c.slug.en}`,
  softwareModule: (e, c) => `/software/${c.slug.en}`,
  article: (e, c) => `/insights/${c.slug.en}`,
  legalDocument: (e, c) => `/legal/${c.slug.en}`,
};
const plain = (s) => String(s ?? "").replace(/<[^>]+>/g, "").trim();

function makeLibrary({ seed, store, now, uploads, demo = false }) {
  const media = new Map((seed.media ?? []).map((m) => [m.id, clone(m)]));
  const redirects = new Map((seed.seo?.redirects ?? []).map((r) => [r.id, clone(r)]));
  const settings = clone(seed.seo?.settings ?? { visibility: "noindex", canonicalHost: "https://orgtik.ch", publicLocales: ["en"], version: 1, history: [] });
  let nextMedia = media.size + 1;
  let nextRedirect = redirects.size + 1;
  const ensureDemo = () => { if (demo) require("./seed/demo-states").redirectExamples(redirects, now); };
  ensureDemo();
  const current = (e) => e.draft ?? e.live;
  const log = (who, action, id, type, extra = {}) => store.audit.unshift({ at: now(), by: who, action, entry: id, type, ...extra });

  // ---- media ----
  // Every place an entry names the file: { entry, type, name, field, ownAlt } (live and draft).
  function usesOf(m) {
    const base = m.file.split("/").pop();
    const uses = [];
    for (const e of store.entries.values()) {
      const seen = new Set();
      for (const c of [e.live, e.draft].filter(Boolean)) {
        (function walk(v, at, parent) {
          if (typeof v === "string") {
            if (v === m.file || v === base || v.endsWith(`/assets/${m.file}`) || v.endsWith(`/media/${m.file}`)) {
              if (!seen.has(at)) {
                seen.add(at);
                uses.push({ entry: e.id, type: e.type, name: plain(c.locales.en?.name ?? c.name ?? e.id), field: at.replace(/^\./, ""), ownAlt: Boolean(parent?.alt?.en?.trim()) });
              }
            }
          } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${at}.${i}`, v));
          else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, `${at}.${k}`, v);
        })(c, "", null);
      }
    }
    return uses;
  }
  function issuesOf(m, uses) {
    const inUse = uses.length > 0 || m.templateUses.length > 0;
    const out = [];
    if (inUse && m.kind !== "video" && !m.alt.en?.trim()) out.push("noAlt");
    // A description Claude suggested (D-038) counts as missing until someone reviews and saves it.
    else if (inUse && m.altSuggested) out.push("altSuggested");
    if (inUse && m.rights.status === "unknown") out.push("rightsUnknown");
    if (m.rights.expires && m.rights.expires <= new Date(Date.parse(now()) + 30 * 864e5).toISOString().slice(0, 10)) out.push("rightsExpiring");
    if (!inUse) out.push("unused");
    return out;
  }
  function mediaOut(m, withUses = false) {
    const uses = usesOf(m);
    return { ...m, usage: uses.length + m.templateUses.length, issues: issuesOf(m, uses), ...(withUses ? { uses } : {}) };
  }
  function updateMedia(m, who, patch) {
    const next = clone(m);
    const errors = {};
    if (patch.description !== undefined) {
      if (typeof patch.description !== "string" || patch.description.length > 2000) errors.description = "too_long";
      else next.description = patch.description.trim();
    }
    if (patch.tags !== undefined) {
      if (!Array.isArray(patch.tags) || patch.tags.length > 30 || patch.tags.some(tag => typeof tag !== "string" || tag.length > 80)) errors.tags = "invalid";
      else next.tags = [...new Set(patch.tags.map(tag => tag.trim()).filter(Boolean))];
    }
    if (patch.alt) for (const [l, v] of Object.entries(patch.alt)) next.alt[l] = String(v ?? "").trim();
    // Saving the description is the review.
    if (patch.alt) delete next.altSuggested;
    if (patch.rights) {
      next.rights = { ...next.rights, ...patch.rights };
      if (!RIGHTS.includes(next.rights.status)) errors["rights.status"] = "required";
      if (["licensed", "stock", "client"].includes(next.rights.status) && !String(next.rights.holder ?? "").trim()) errors["rights.holder"] = "required";
      if (next.rights.expires && !/^\d{4}-\d{2}-\d{2}$/.test(next.rights.expires)) errors["rights.expires"] = "required";
    }
    if (patch.focal) {
      const { x, y } = patch.focal;
      if (![x, y].every((n) => Number.isFinite(n) && n >= 0 && n <= 100)) errors.focal = "out_of_range";
      else next.focal = { x: Math.round(x), y: Math.round(y) };
    }
    if (Object.keys(errors).length) return { errors };
    next.version = m.version + 1;
    next.updatedAt = now();
    next.updatedBy = who.key;
    Object.assign(m, next);
    log(who.key, "media_update", m.id, "media");
    return { media: m };
  }
  function addUpload(who, file, metadata = {}) {
    const id = `md_${String(nextMedia++).padStart(2, "0")}`;
    const name = `${id}-${file.originalname.replace(/[^A-Za-z0-9._-]+/g, "-").toLowerCase()}`;
    fs.mkdirSync(uploads, { recursive: true });
    fs.writeFileSync(path.join(uploads, name), file.buffer);
    const ext = name.split(".").pop();
    const kind = file.mimetype === "image/svg+xml" ? "vector" : file.mimetype.startsWith("video/") ? "video" : "image";
    const m = { id, file: name, kind, bytes: file.size, width: null, height: null, alt: {}, rights: { status: "unknown", holder: "", expires: null, note: "" }, focal: { x: 50, y: 50 }, templateUses: [], source: "upload", addedAt: now(), addedBy: who.key, version: 1, ext };
    media.set(id, m);
    m.description = metadata.description ?? "";
    m.tags = metadata.tags ?? [];
    log(who.key, "media_upload", id, "media");
    return m;
  }
  function removeMedia(m, who) {
    const uses = usesOf(m);
    const count = uses.length + m.templateUses.length;
    if (count) return { status: 409, code: "in_use", message: "This file is used on the website.", count };
    media.delete(m.id);
    // Bytes are retained until storage garbage collection: a failed journal commit can
    // restore this record. The public media route serves only registered library files.
    log(who.key, "media_delete", m.id, "media");
    return { ok: true };
  }

  // ---- SEO health ----
  const CHECKS = ["titleMissing", "titleLong", "titleDuplicate", "descriptionMissing", "descriptionShort", "descriptionLong", "noSocialImage", "imageNoAlt"];
  function health() {
    const rows = [];
    const titles = new Map();
    for (const e of store.entries.values()) {
      if (!ADDRESS[e.type]) continue;
      const c = current(e);
      if (c.seo?.en?.robots === "noindex" && c.seo?.en?.inSitemap === false) continue; // sign-in and the like
      for (const l of settings.publicLocales) {
        const seo = c.seo?.[l] ?? {};
        const title = String(seo.title ?? "").trim();
        const description = String(seo.description ?? "").trim();
        const issues = [];
        if (!title) issues.push("titleMissing");
        else if (title.length > 60) issues.push("titleLong");
        if (!description) issues.push("descriptionMissing");
        else if (description.length < 50) issues.push("descriptionShort");
        else if (description.length > 160) issues.push("descriptionLong");
        if (!seo.ogImage && !c.image?.src) issues.push("noSocialImage");
        if (c.image?.src && !c.image.alt?.[l]?.trim()) issues.push("imageNoAlt");
        if (title) titles.set(title.toLowerCase(), [...(titles.get(title.toLowerCase()) ?? []), rows.length]);
        rows.push({ id: e.id, type: e.type, name: plain(c.locales.en?.name ?? c.name ?? e.id), path: ADDRESS[e.type](e, c, store.entries), locale: l, title, titleLength: title.length, descriptionLength: description.length, issues, state: e.draft ? e.workflow.state : "published" });
      }
    }
    for (const idx of titles.values()) if (idx.length > 1) for (const i of idx) rows[i].issues.push("titleDuplicate");
    const counts = Object.fromEntries(CHECKS.map((k) => [k, rows.filter((r) => r.issues.includes(k)).length]));
    return { rows, counts, healthy: rows.filter((r) => !r.issues.length).length };
  }

  // ---- redirects ----
  const livePaths = () => new Set([...store.entries.values()].filter((e) => ADDRESS[e.type] && e.live && e.workflow.visibility === "live").map((e) => ADDRESS[e.type](e, e.live, store.entries)));
  function validateRedirect(r, selfId) {
    const errors = {};
    const from = String(r.from ?? "").trim();
    const to = String(r.to ?? "").trim();
    if (!/^\/[^\s?#]*$/.test(from)) errors.from = "path_format";
    else if (from.includes("*") && !from.endsWith("/*")) errors.from = "wildcard_end";
    if (!/^(\/|https:\/\/)\S*$/.test(to)) errors.to = "path_format";
    else if (to.includes("*") && !from.includes("*")) errors.to = "wildcard_unmatched";
    if (from && from === to) errors.to = "same_as_from";
    if (![301, 302].includes(Number(r.code))) errors.code = "required";
    const others = [...redirects.values()].filter((x) => x.id !== selfId);
    if (others.some((x) => x.from === from)) errors.from = "duplicate";
    if (livePaths().has(from)) errors.from = "shadows_page";
    // A redirect to an address that itself redirects is a chain (and may be a loop): point at the end.
    const target = to.split("#")[0];
    if (!errors.to && others.some((x) => x.from === target)) errors.to = others.some((x) => x.from === target && x.to.split("#")[0] === from) ? "loop" : "chain";
    return { errors, clean: { from, to, code: Number(r.code), note: String(r.note ?? "").trim() || undefined } };
  }
  function saveRedirect(who, input, existing) {
    const { errors, clean } = validateRedirect(input, existing?.id);
    if (Object.keys(errors).length) return { errors };
    if (existing) {
      Object.assign(existing, clean, { version: existing.version + 1, updatedAt: now(), updatedBy: who.key });
      log(who.key, "redirect_update", existing.id, "redirect");
      return { redirect: existing };
    }
    const r = { id: `rd_${String(nextRedirect++).padStart(2, "0")}`, ...clean, source: "manager", handledBy: "host", createdAt: now(), createdBy: who.key, version: 1 };
    redirects.set(r.id, r);
    log(who.key, "redirect_create", r.id, "redirect");
    return { redirect: r };
  }
  function removeRedirect(r, who) {
    redirects.delete(r.id);
    log(who.key, "redirect_delete", r.id, "redirect");
  }

  // ---- a published address that changes keeps working (plan: "a change after publishing creates 301s") ----
  const liveAddresses = () => new Map([...store.entries.values()].filter((e) => ADDRESS[e.type] && e.workflow.visibility === "live" && e.live).map((e) => [e.id, ADDRESS[e.type](e, e.live, liveOnly)]));
  // A service's address uses its family's live slug, not a draft one.
  const liveOnly = { get: (id) => { const x = store.entries.get(id); return x && { live: x.live, draft: x.live }; } };
  function keepAddresses(who, fn) {
    const before = liveAddresses();
    const result = fn();
    const after = liveAddresses();
    for (const [id, at] of after) {
      if (before.has(id)) continue;
      // Back on the site (or new): nothing may redirect away from its address.
      for (const r of [...redirects.values()]) if (r.from === at) redirects.delete(r.id);
    }
    for (const [id, was] of before) {
      const now_ = after.get(id);
      if (!now_) {
        // Off the site: its address goes to the list it was part of, so no link breaks.
        const listing = "/" + was.split("/")[1];
        if (listing === was || [...redirects.values()].some((r) => r.from === was)) continue;
        const r = { id: `rd_${String(nextRedirect++).padStart(2, "0")}`, from: was, to: listing, code: 301, note: "Taken off the site.", entry: id, source: "archived", handledBy: "host", createdAt: now(), createdBy: who.key, version: 1 };
        redirects.set(r.id, r);
        log(who.key, "redirect_auto", id, store.entries.get(id)?.type ?? "entry", { from: was, to: listing });
        continue;
      }
      if (now_ === was) continue;
      // Anything that pointed at the old address points at the new one (no chains)…
      for (const r of redirects.values()) {
        const [path, hash] = r.to.split("#");
        if (path === was) Object.assign(r, { to: now_ + (hash ? "#" + hash : ""), version: r.version + 1, updatedAt: now(), updatedBy: who.key });
      }
      // …a redirect away from the new address would hide the page now there…
      for (const r of [...redirects.values()]) if (r.from === now_) redirects.delete(r.id);
      // …and the old address sends visitors and search engines on.
      const existing = [...redirects.values()].find((r) => r.from === was);
      if (existing) Object.assign(existing, { to: now_, code: 301, version: existing.version + 1, updatedAt: now(), updatedBy: who.key });
      else {
        const r = { id: `rd_${String(nextRedirect++).padStart(2, "0")}`, from: was, to: now_, code: 301, note: "The address changed when this was published.", entry: id, source: "address_change", handledBy: "host", createdAt: now(), createdBy: who.key, version: 1 };
        redirects.set(r.id, r);
      }
      log(who.key, "redirect_auto", id, store.entries.get(id).type, { from: was, to: now_ });
    }
    return result;
  }

  // What the preview can open: every address as the drafts have it (a draft slug moves it).
  function previewAddresses() {
    return [...store.entries.values()]
      .filter((e) => ADDRESS[e.type] && e.workflow.visibility !== "archived")
      .map((e) => ({ path: ADDRESS[e.type](e, current(e), store.entries), id: e.id, type: e.type, name: plain(current(e).locales?.en?.name ?? current(e).name ?? e.id), draft: Boolean(e.draft), onSite: e.workflow.visibility === "live" }))
      .sort((x, y) => x.path.localeCompare(y.path));
  }

  // ---- indexing ----
  function indexingUrls() {
    const urls = [];
    const included = new Set(sitemap().map(row => row.loc));
    for (const entry of store.entries.values()) {
      if (!ADDRESS[entry.type] || entry.workflow.visibility !== "live" || !entry.live) continue;
      for (const locale of settings.publicLocales) {
        const seo = entry.live.seo?.[locale] ?? entry.live.seo?.en ?? {};
        const path = ADDRESS[entry.type](entry, entry.live, liveOnly);
        const loc = settings.canonicalHost + (locale === "en" ? "" : `/${locale}`) + (path === "/" && locale !== "en" ? "" : path);
        const policy = settings.visibility === "noindex" || seo.robots === "noindex" ? "noindex" : "index";
        urls.push({ id: entry.id, type: entry.type, locale, loc, canonical: seo.canonical || loc, policy, reason: settings.visibility === "noindex" ? "siteOverride" : seo.robots === "noindex" ? "pagePolicy" : "allowed", inSitemap: included.has(loc), lastmod: String(entry.workflow.publishedAt ?? entry.workflow.updatedAt).slice(0, 10) });
      }
    }
    return urls.sort((a, b) => a.loc.localeCompare(b.loc));
  }
  function sitemap() {
    const urls = [];
    for (const e of store.entries.values()) {
      if (!ADDRESS[e.type] || e.workflow.visibility !== "live" || !e.live) continue;
      const at = ADDRESS[e.type](e, e.live, liveOnly);
      for (const locale of settings.publicLocales) {
        const seo = e.live.seo?.[locale] ?? e.live.seo?.en ?? {};
        if (seo.inSitemap === false) continue;
        const suffix = locale === "en" ? at : `/${locale}${at === "/" ? "" : at}`;
        urls.push({ loc: settings.canonicalHost + suffix, lastmod: String(e.workflow.publishedAt ?? e.workflow.updatedAt).slice(0, 10), type: e.type, id: e.id });
      }
    }
    urls.sort((a, b) => a.loc.localeCompare(b.loc));
    return urls;
  }
  const robots = () =>
    settings.visibility === "noindex"
      ? "# Page heads carry noindex. Crawling remains allowed so engines can read it.\nUser-agent: *\nAllow: /\n"
      : `User-agent: *\nAllow: /\n\nSitemap: ${settings.canonicalHost}/sitemap.xml\n`;
  function setVisibility(who, visibility, reason) {
    if (!["index", "noindex"].includes(visibility)) return { errors: { visibility: "required" } };
    if (!String(reason ?? "").trim()) return { errors: { reason: "required" } };
    if (visibility === settings.visibility) return { settings };
    settings.visibility = visibility;
    settings.version += 1;
    settings.history.unshift({ at: now(), by: who.key, visibility, note: String(reason).trim() });
    log(who.key, "search_visibility", "site", "settings", { visibility });
    return { settings };
  }

  const exportState = () => ({ data: clone({ media: [...media], redirects: [...redirects], settings, demoVersion: 1 }), sequences: { nextMedia, nextRedirect } });
  const validateState = value => {
    const incoming = codec.object(value), rows = codec.mapRows(incoming.data?.media), redirects_ = codec.mapRows(incoming.data?.redirects), settings_ = codec.object(incoming.data?.settings);
    if (!Number.isSafeInteger(settings_.version) || !Array.isArray(settings_.history) || !Array.isArray(settings_.publicLocales)) throw codec.fail("Website Manager SEO settings are incomplete.");
    return { data: { media: rows, redirects: redirects_, settings: settings_, demoVersion: incoming.data.demoVersion ?? 0 }, sequences: { nextMedia: codec.sequence(incoming.sequences?.nextMedia, rows, "md"), nextRedirect: codec.sequence(incoming.sequences?.nextRedirect, redirects_, "rd") } };
  };
  const importState = value => { const incoming = validateState(value); codec.replaceMap(media, incoming.data.media); codec.replaceMap(redirects, incoming.data.redirects); codec.replaceObject(settings, incoming.data.settings); nextMedia = incoming.sequences.nextMedia; nextRedirect = incoming.sequences.nextRedirect; if (incoming.data.demoVersion < 1) ensureDemo(); };
  return { media, redirects, settings, mediaOut, updateMedia, addUpload, removeMedia, health, CHECKS, saveRedirect, removeRedirect, sitemap, indexingUrls, robots, setVisibility, RIGHTS, keepAddresses, previewAddresses, exportState, importState, validateState };
}

module.exports = { makeLibrary };
