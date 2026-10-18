// Website Manager content: entries, drafts, the publishing workflow, versions and the audit log
// (plan, Phase 2 "Workflows"). S1 started with case studies (D-032, D-034); service families,
// services, software modules and articles share the same shape. Every entry keeps what the website shows (`live`) apart from the working copy
// (`draft`), so editing never changes the site until someone publishes.
const fs = require("fs");
const path = require("path");
const {DEPARTMENTS, blankContent} = require("./defaults");
const articleBody = require("./article-body");

const LOCALES = ["en", "ar", "de", "fr", "it"];
const TYPES = ["page", "global", "strings", "caseStudy", "serviceFamily", "service", "softwareModule", "article", "legalDocument", "roadmapItem", "pricing", "review"];
// Roadmap items: where they sit on the timeline (keys; the screens and the site label them).
const ROADMAP_STATUS = ["open", "planned", "in_progress", "shipped"];
const PERIODS = ["past", "now", "next"];
// How the website shows prices (plan: pricingDisplay.priceMode).
const PRICE_MODES = ["indicative", "on_request"];

// Every number and switch in a tree, by path: what "changing a price" means for pricing:edit.
function figures(v, at = "", out = {}) {
  if (typeof v === "number" || typeof v === "boolean") out[at] = v;
  else if (Array.isArray(v)) v.forEach((x, i) => figures(x, `${at}.${i}`, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) figures(x, `${at}.${k}`, out);
  return out;
}

/** The tags in a copy slot, in order: what a translation must keep. */
// Marks (<em>, <m1>) and placeholders ({0}: what the site fills in) both have to survive.
const marksOf = (text) => (String(text ?? "").match(/<\/?[a-z][a-z0-9]*\/?>|\{\d+\}/g) ?? []).join("");
const plain = (text) => String(text ?? "").replace(/<[^>]+>/g, "").trim();

// Language-neutral values inside a data block (an icon, an image, a link): set in English and
// copied into every language, like numbers. The block's schema says which they are.
function copyNeutral(node, from, to) {
  if (!node || from == null || to == null) return to;
  if (node.kind === "group") {
    for (const [k, n] of Object.entries(node.fields)) {
      if (n.neutral || n.locked) to[k] = from[k];
      else if (to[k] && typeof to[k] === "object") copyNeutral(n, from[k], to[k]);
    }
  } else if (node.kind === "list" && Array.isArray(from) && Array.isArray(to)) {
    to.forEach((item, i) => item && typeof item === "object" && copyNeutral(node.item, from[i], item));
  }
  return to;
}
// Entry-level things a list shows next to the name (language-neutral).
const NEUTRAL = ["department", "format", "parent", "category", "icon", "publishedOn", "readingMinutes", "status", "period", "year", "progress", "versionLabel", "effectiveFrom", "priceMode"];
// Language-neutral fields an editor may change (the rest is structure: department, parent).
const EDITABLE_NEUTRAL = ["icon", "category", "publishedOn", "readingMinutes", "status", "period", "year", "progress", "versionLabel", "effectiveFrom", "priceMode", "narrativePublished", "sampleNarrativePublished"];
const clone = (v) => JSON.parse(JSON.stringify(v));
const codec = require("./state-codec");

// Numbers are language-neutral (chart points, gauges, weeks, before/after): they're edited in
// English and copied to the same place in every other language that has that place, so a figure
// can never read differently in German than in English.
function copyNumbers(from, to) {
  if (Array.isArray(from) && Array.isArray(to)) {
    from.forEach((v, i) => {
      if (typeof v === "number") to[i] = v;
      else if (v && typeof v === "object" && to[i] && typeof to[i] === "object") copyNumbers(v, to[i]);
    });
  } else if (from && typeof from === "object" && to && typeof to === "object") {
    for (const [k, v] of Object.entries(from)) {
      if (typeof v === "number") to[k] = v;
      else if (v && typeof v === "object" && to[k] && typeof to[k] === "object") copyNumbers(v, to[k]);
    }
  }
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// The workflow (status matrix: cms_revision). "published" means no pending draft.
const TRANSITIONS = {
  submit: { from: ["draft"], to: "in_review", permission: "content:edit" },
  request_changes: { from: ["in_review"], to: "draft", permission: "content:approve" },
  approve: { from: ["in_review"], to: "approved", permission: "content:approve" },
  publish: { from: ["approved"], to: "published", permission: "content:approve" },
  discard: { from: ["draft", "in_review", "approved"], to: "published", permission: "content:edit" },
  // Publish later: the mock's clock publishes it when the time comes (tick()).
  schedule: { from: ["approved"], to: "scheduled", permission: "content:approve" },
  unschedule: { from: ["scheduled"], to: "approved", permission: "content:approve" },
};
// A translation's review (status matrix: translation). "published" follows the entry's publish.
const TRANSLATION_ACTIONS = {
  submit: { from: ["in_progress", "outdated"], to: "needs_review", permission: "localization:edit" },
  approve: { from: ["needs_review"], to: "ready", permission: "localization:approve" },
  reopen: { from: ["needs_review", "ready"], to: "in_progress", permission: "localization:edit" },
};

function loadSeed() {
  return require("./seed/manager-improvements").applyManagerImprovements(JSON.parse(fs.readFileSync(path.join(__dirname, "seed", "website.json"), "utf8")));
}

function makeStore(now, { demo = false } = {}) {
  const LOCALES = ["en", "ar", "de", "fr", "it"];
  const seed = loadSeed();
  const entries = new Map();
  const audit = [];
  const managerOrders = {};
  for (const cs of [...seed.caseStudies, ...seed.entries]) {
    const { id, type, siteId, order, workflow, translation, legalVersions, ...rest } = cs;
    const neutral = Object.fromEntries(NEUTRAL.filter((k) => k in rest && ["department", "format", "parent"].includes(k)).map((k) => [k, rest[k]]));
    for (const k of Object.keys(neutral)) delete rest[k];
    const content = rest;
    if (type === "caseStudy") content.narrativePublished ??= false;
    if (type === "caseStudy") content.sampleNarrativePublished ??= false;
    // The marks each copy slot has, from the published English: translations must keep them.
    const marks = {};
    for (const sec of content.layout ?? []) if (sec.kind === "copy") for (const slot of sec.slots) marks[`${sec.key}.${slot.key}`] = marksOf(content.locales.en?.[sec.key]?.[slot.key]);
    entries.set(id, {
      marks,
      id,
      type,
      siteId,
      ...neutral,
      order,
      live: content,
      draft: null,
      workflow: { ...workflow, lastEditor: null },
      translation: { ...translation },
      versions: [{ version: 1, state: "published", at: workflow.publishedAt, by: "seed", note: `Imported from orgtik-website@${seed.source.commit}`, content: clone(content) }],
      translators: {},
      // Legal documents: every version the website has published, never changed afterwards.
      ...(legalVersions ? { legalVersions: clone(legalVersions) } : {}),
    });
  }

  const current = (e) => e.draft ?? e.live;
  const log = (who, action, e, extra = {}) => audit.unshift({ at: now(), by: who, action, entry: e.id, type: e.type, version: e.workflow.version, ...extra });

  function summary(e) {
    const c = current(e);
    const en = c.locales.en ?? {};
    return {
      id: e.id,
      type: e.type,
      name: en.name ?? c.name ?? "",
      department: e.department,
      format: e.format,
      narrativePublished: c.narrativePublished ?? false,
      sampleNarrativePublished: c.sampleNarrativePublished ?? false,
      parent: e.parent,
      category: c.category,
      icon: c.icon,
      publishedOn: c.publishedOn,
      readingMinutes: c.readingMinutes,
      status: c.status,
      priceMode: c.priceMode,
      period: c.period,
      year: c.year,
      progress: c.progress,
      versionLabel: e.legalVersions?.[0]?.versionLabel,
      effectiveFrom: e.legalVersions?.[0]?.effectiveFrom,
      // Pages, Global and Strings: how many texts they hold.
      slots: c.layout ? c.layout.reduce((n, x) => n + (x.kind === "copy" ? x.slots.length : 1), 0) : undefined,
      slug: c.slug,
      image: c.image,
      order: e.order,
      state: e.draft ? e.workflow.state : "published",
      visibility: e.workflow.visibility,
      hasDraft: Boolean(e.draft),
      version: e.workflow.version,
      updatedAt: e.workflow.updatedAt,
      updatedBy: e.workflow.updatedBy,
      translation: e.translation,
      // Only case studies carry figures that need confirming.
      figures: c.provenance?.figures ?? null,
    };
  }

  function detail(e) {
    return { ...summary(e), lastEditor: e.workflow.lastEditor ?? null, publishAt: e.workflow.publishAt ?? null, seoOnly: seoOnly(e), content: current(e), live: e.live, versions: e.versions.map(({ content, ...v }) => v), ...(e.legalVersions ? { legalVersions: e.legalVersions.map(({ content, ...v }) => v) } : {}) };
  }

  // Validation per locale for what a reader can't do without (422 with fieldErrors).
  function validate(content, e) {
    const errors = {};
    if (e?.type === "article") for (const [locale, words] of Object.entries(content.locales ?? {})) {
      if (words && Object.hasOwn(words, "sections") && articleBody.validate(words.sections)) errors[`locales.${locale}.sections`] = "invalid";
    }
    const safeAsset = value => typeof value === "string" && value.length <= 2048 && (/^(https?:)\/\//i.test(value) || !/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value));
    if (content.presentation) {
      const p = content.presentation;
      const allowedSections = require("../../../program/cms/sections.json")[e?.id]?.body;
      if (allowedSections && Array.isArray(p.sectionOrder) && p.sectionOrder.some(key => !allowedSections.includes(key))) errors.presentation = "invalid";
      if (!Array.isArray(p.sectionOrder) || p.sectionOrder.length > 50 || new Set(p.sectionOrder).size !== p.sectionOrder.length || p.sectionOrder.some(key => typeof key !== "string" || !/^[a-zA-Z0-9_-]+$/.test(key))) errors.presentation = "invalid";
      if (!p.sectionMedia || typeof p.sectionMedia !== "object" || Object.values(p.sectionMedia).some(items => !Array.isArray(items) || items.length > 10 || items.some(item => !safeAsset(item?.src)))) errors.presentation = "invalid";
      if (!p.cursor || typeof p.cursor.link !== "string" || (p.cursor.link && !/^(https?:\/\/|\/(?!\/)|#)/.test(p.cursor.link)) || !p.cursor.text || Object.values(p.cursor.text).some(text => typeof text !== "string" || text.length > 120)) errors.presentation = "invalid";
    }
    if (e?.type === "review") {
      if (typeof content.sample !== "boolean") errors.sample = "required";
      if (!Number.isInteger(content.position) || content.position < 0) errors.position = "out_of_range";
      if (content.relatedEntry && !["service", "serviceFamily", "softwareModule"].includes(entries.get(content.relatedEntry)?.type)) errors.relatedEntry = "invalid";
    }
    if (e?.type === "caseStudy") {
      if (typeof content.narrativePublished !== "boolean") errors.narrativePublished = "required";
      else if (content.narrativePublished && content.provenance?.figures !== "approved") errors.narrativePublished = "narrative_needs_approved_figures";
      if (typeof content.sampleNarrativePublished !== "boolean") errors.sampleNarrativePublished = "required";
      else if (content.sampleNarrativePublished && (content.provenance?.figures !== "sample" || content.narrativePublished)) errors.sampleNarrativePublished = "sample_narrative_needs_sample_figures";
    }
    // Pages and Global are laid out by their template: no name to fill in, a fixed address, and
    // every copy slot keeps the marks (<em>, <m1>...) the English one has, in every language.
    if (content.layout) {
      for (const [l, v] of Object.entries(content.locales)) {
        if (!v) continue;
        for (const s of content.layout) {
          if (s.kind !== "copy") continue;
          for (const slot of s.slots) {
            const text = v[s.key]?.[slot.key];
            if (text === undefined) continue;
            if (marksOf(text) !== e.marks[`${s.key}.${slot.key}`]) errors[`locales.${l}.${s.key}.${slot.key}`] = "marks_changed";
            else if (l === "en" && !plain(text)) errors[`locales.en.${s.key}.${slot.key}`] = "required";
          }
        }
      }
      if ("priceMode" in content && !PRICE_MODES.includes(content.priceMode)) errors.priceMode = "required";
      return errors;
    }
    for (const [l, v] of Object.entries(content.locales)) {
      if (!v) continue;
      if (l === "en" || Object.keys(v).length) {
        if (!String(v.name ?? "").trim()) errors[`locales.${l}.name`] = "required";
      }
    }
    for (const [l, s] of Object.entries(content.slug ?? {})) {
      if (s && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)) errors[`slug.${l}`] = "slug_format";
      // Two entries at one address: the same slug among siblings (a service's are its family's).
      else if (s && e && e.type !== "page") {
        const taken = [...entries.values()].some((x) => x.id !== e.id && x.type === e.type && (x.parent ?? null) === (e.parent ?? null) && [x.draft, x.live].some((c) => c?.slug?.[l] === s));
        if (taken) errors[`slug.${l}`] = "slug_taken";
      }
    }
    if ("readingMinutes" in content && !(Number.isInteger(content.readingMinutes) && content.readingMinutes > 0)) errors.readingMinutes = "required";
    if ("status" in content && !ROADMAP_STATUS.includes(content.status)) errors.status = "required";
    if ("period" in content && !PERIODS.includes(content.period)) errors.period = "required";
    if ("progress" in content && !(Number.isInteger(content.progress) && content.progress >= 0 && content.progress <= 100)) errors.progress = "out_of_range";
    if ("year" in content && !/^\d{4}$/.test(String(content.year ?? ""))) errors.year = "required";
    if ("versionLabel" in content && !String(content.versionLabel ?? "").trim()) errors.versionLabel = "required";
    if ("priceMode" in content && !PRICE_MODES.includes(content.priceMode)) errors.priceMode = "required";
    if ("effectiveFrom" in content && content.effectiveFrom !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(content.effectiveFrom))) errors.effectiveFrom = "required";
    if ("publishedOn" in content && !/^\d{4}-\d{2}-\d{2}$/.test(String(content.publishedOn ?? ""))) errors.publishedOn = "required";
    for (const [l, seo] of Object.entries(content.seo ?? {})) {
      if (!seo) continue;
      const long = (k, max) => typeof seo[k] === "string" && seo[k].length > max && (errors[`seo.${l}.${k}`] = "too_long");
      long("title", 120);
      long("description", 320);
      long("ogTitle", 120);
      long("ogDescription", 320);
      long("focus", 80);
      if ("keywords" in seo && !(Array.isArray(seo.keywords) && seo.keywords.length <= 20 && seo.keywords.every((k) => typeof k === "string" && k.trim() && k.length <= 60))) errors[`seo.${l}.keywords`] = "keywords";
      if ("robots" in seo && !["index", "noindex"].includes(seo.robots)) errors[`seo.${l}.robots`] = "required";
      if ("inSitemap" in seo && typeof seo.inSitemap !== "boolean") errors[`seo.${l}.inSitemap`] = "required";
      if (seo.canonical && !/^https:\/\/[^\s/]+(\/\S*)?$/.test(seo.canonical)) errors[`seo.${l}.canonical`] = "canonical_format";
      if (seo.jsonLd != null && (typeof seo.jsonLd !== "object" || (!Array.isArray(seo.jsonLd) && !seo.jsonLd["@type"]))) errors[`seo.${l}.jsonLd`] = "jsonld_type";
    }
    return errors;
  }

  // ---- new entries, and taking them off the site (plan: "a separate public lifecycle of
  // unpublished / published / archived") ----
  // Only where the website's design takes a list of any length: articles, case studies and
  // roadmap items. Families, services and modules have a fixed place in the design.
  const CREATABLE = { article: "ar", caseStudy: "cs", roadmapItem: "rm", review: "rv" };
  // A new entry starts as a copy of one the site already shows, so it has every field its page
  // needs; only English, and off the site until it's published.
  function create(type, who, { name, slug, from, department } = {}) {
    const prefix = CREATABLE[type];
    if (!prefix) return { status: 405, code: "not_creatable", message: "The site's design has a fixed number of these." };
    const template = entries.get(from);
    const errors = {};
    if (from && (!template || template.type !== type)) errors.from = "required";
    if (type === "caseStudy" && !template && !DEPARTMENTS.includes(department)) errors.department = "required";
    if (!String(name ?? "").trim()) errors.name = "required";
    if (Object.keys(errors).length) return { errors };
    const content = template ? clone(current(template)) : blankContent(type, department, now());
    content.locales = { en: { ...content.locales.en, name: String(name).trim() } };
    if (content.slug && Object.keys(content.slug).length) content.slug = { en: String(slug ?? "").trim() };
    const was = template?.live?.seo?.en ?? template?.draft?.seo?.en ?? {};
    content.seo = ["roadmapItem", "review"].includes(type) ? {} : { en: { title: String(name).trim(), description: "", robots: was.robots ?? "noindex", inSitemap: was.inSitemap ?? true } };
    // Copied figures aren't this project's: they start as samples.
    if (content.provenance) content.provenance = { figures: "sample", sampleLabel: clone(content.provenance.sampleLabel) };
    if (type === "caseStudy") content.narrativePublished = false;
    if (type === "caseStudy") content.sampleNarrativePublished = false;
    const taken = new Set([...entries.keys()]);
    let n = 1;
    while (taken.has(`${prefix}_${String(n).padStart(2, "0")}`)) n += 1;
    const id = `${prefix}_${String(n).padStart(2, "0")}`;
    const e = {
      marks: {},
      id,
      type,
      siteId: "orgtik",
      ...(type === "caseStudy" ? {department: template?.department ?? department, format: template?.format ?? current(entries.get("gl_caseFormats")).locales.en.formats[department]} : {}),
      ...(template?.parent ? { parent: template.parent } : {}),
      order: Math.max(0, ...[...entries.values()].filter((x) => x.type === type).map((x) => x.order)) + 1,
      live: null,
      draft: content,
      workflow: { state: "draft", visibility: "not_on_site", version: 1, updatedAt: now(), updatedBy: who.key, publishedAt: null, lastEditor: who.key },
      translation: Object.fromEntries(LOCALES.map((l) => [l, l === "en" ? "in_progress" : "not_started"])),
      versions: [],
      translators: {},
    };
    const v = validate(content, e);
    if (content.slug?.en === "") v["slug.en"] = "required";
    if (Object.keys(v).length) return { errors: v };
    e.versions.push({ version: 1, state: "draft", at: now(), by: who.key, note: template ? `Started from “${summary(template).name}”` : "Started blank", content: clone(content) });
    entries.set(id, e);
    log(who.key, "create", e, { from: template?.id ?? null });
    return { entry: e };
  }
  // Purchasing data the website keeps in its own catalogs (managedIn: the file) is mirrored here
  // read-only: its words, numbers and visibility change in the website's code. Its page metadata
  // (slug, SEO) is still edited here.
  const MIRRORED = { status: 423, code: "managed_in_website", message: "This is kept in the website's code; only its SEO can change here." };
  const mirrored = (e) => Boolean(current(e).managedIn);

  // Off the site and back (Approvers): the entry and its history stay.
  function setVisibility(e, who, action, { can }) {
    if (mirrored(e)) return MIRRORED;
    if (!can("content:approve")) return { status: 403, code: "forbidden", required: "content:approve" };
    if (action === "archive") {
      if (e.workflow.visibility !== "live") return { status: 409, code: "wrong_state", message: "Only something on the site can be taken off it." };
      if (e.type === "page" || e.type === "global" || e.type === "strings" || e.type === "pricing") return { status: 409, code: "fixed", message: "The site can't do without this." };
      e.workflow = { ...e.workflow, visibility: "archived", updatedAt: now(), updatedBy: who.key };
    } else if (action === "unarchive") {
      if (e.workflow.visibility !== "archived") return { status: 409, code: "wrong_state" };
      e.workflow = { ...e.workflow, visibility: "live", updatedAt: now(), updatedBy: who.key };
    } else return { status: 400, code: "unknown_action" };
    e.workflow.version += 1;
    e.versions.unshift({ version: e.workflow.version, state: e.draft ? e.workflow.state : "published", at: now(), by: who.key, action, content: clone(current(e)) });
    log(who.key, action, e);
    return { entry: e };
  }
  // Deleting is for what never reached the site; anything published is taken off it instead.
  function remove(e, who) {
    if (mirrored(e)) return MIRRORED;
    if (e.live || e.workflow.publishedAt) return { status: 409, code: "published_before", message: "This has been on the site: take it off instead." };
    entries.delete(e.id);
    log(who.key, "delete", e);
    return { ok: true };
  }

  // A draft whose only change from what's published is its SEO block.
  function seoOnly(e) {
    if (!e.draft || !e.live) return false;
    const { seo: a, ...restDraft } = e.draft;
    const { seo: b, ...restLive } = e.live;
    return same(restDraft, restLive) && !same(a, b);
  }

  // A save writes the draft. English changing after a translation exists marks it outdated.
  function save(e, who, patch, { can = () => true } = {}) {
    if (mirrored(e) && Object.keys(patch).some((k) => !["locale", "seo", "note"].includes(k))) return MIRRORED;
    const base = clone(current(e));
    const next = clone(base);
    if (e.type === "article" && Object.hasOwn(patch.fields ?? {}, "sections")) {
      const error = articleBody.validate(patch.fields.sections);
      if (error) return { errors: { [`locales.${patch.locale}.sections`]: error } };
      if (patch.locale !== "en" && !same(articleBody.structure(patch.fields.sections), articleBody.structure(base.locales.en.sections))) return { errors: { [`locales.${patch.locale}.sections`]: "structure_locked" } };
    }
    if (patch.neutral && "narrativePublished" in patch.neutral && patch.neutral.narrativePublished !== base.narrativePublished && !can("content:approve")) return {status:403,code:"forbidden",required:"content:approve"};
    if (patch.neutral && "sampleNarrativePublished" in patch.neutral && patch.neutral.sampleNarrativePublished !== base.sampleNarrativePublished && !can("content:approve")) return {status:403,code:"forbidden",required:"content:approve"};
    // The patch is copied: nothing the caller keeps a hold of can change the draft later.
    if (patch.locale && patch.fields) next.locales[patch.locale] = { ...(next.locales[patch.locale] ?? {}), ...clone(patch.fields) };
    if (e.type === "article" && patch.locale === "en" && patch.fields?.sections?.some(section => section.blocks)) {
      for (const locale of LOCALES) if (locale !== "en" && next.locales[locale]) next.locales[locale].sections = articleBody.synchronize(next.locales.en.sections, base.locales.en.sections, base.locales[locale]?.sections ?? []);
    }
    if (patch.locale === "en" && patch.fields)
      for (const l of LOCALES) {
        if (l === "en" || !next.locales[l]) continue;
        copyNumbers(next.locales.en, next.locales[l]);
        for (const sec of next.layout ?? []) if (sec.kind === "data" && next.locales[l][sec.key]) copyNeutral(sec.node, next.locales.en[sec.key], next.locales[l][sec.key]);
      }
    if (patch.seo && patch.locale) next.seo[patch.locale] = { ...(next.seo[patch.locale] ?? {}), ...patch.seo };
    if (patch.slug && patch.locale) next.slug[patch.locale] = patch.slug;
    if (patch.image) next.image = { ...next.image, ...patch.image };
    if (patch.presentation) next.presentation = { ...(next.presentation ?? {}), ...clone(patch.presentation) };
    if (e.type === "review" && patch.neutral) {
      for (const key of ["sample", "position", "relatedEntry"]) if (key in patch.neutral) next[key] = clone(patch.neutral[key]);
    }
    // Language-neutral fields an editor may change (the rest is structure: department, parent).
    for (const k of EDITABLE_NEUTRAL) if (patch.neutral && k in patch.neutral && k in next) next[k] = patch.neutral[k];
    if (patch.gallery) next.gallery = patch.gallery;
    if (patch.sampleLabel && patch.locale) next.provenance.sampleLabel[patch.locale] = patch.sampleLabel;
    // A price, a discount, a switch or the price mode: only someone who may change prices.
    if (e.type === "pricing" && !can("pricing:edit")) {
      const before = JSON.stringify({ ...figures(base.locales.en), mode: base.priceMode });
      const after = JSON.stringify({ ...figures(next.locales.en), mode: next.priceMode });
      if (before !== after) return { status: 403, code: "forbidden", required: "pricing:edit" };
    }
    // The canonical override is the SEO team's (plan: "automatic, with an SEO-only override"),
    // and custom structured data needs its own permission.
    for (const l of Object.keys(next.seo ?? {})) {
      const was = base.seo?.[l] ?? {};
      const now_ = next.seo[l] ?? {};
      if ((was.canonical ?? "") !== (now_.canonical ?? "") && !can("seo:edit")) return { status: 403, code: "forbidden", required: "seo:edit" };
      if (!same(was.jsonLd ?? null, now_.jsonLd ?? null) && !can("seo:custom-jsonld")) return { status: 403, code: "forbidden", required: "seo:custom-jsonld" };
    }
    // Approval covers the previous figures. Revoke it before narrative validation.
    const figuresChanged = next.provenance && patch.locale === "en" && patch.fields && ["highlight", "results"].some((k) => k in patch.fields && !same(patch.fields[k], base.locales.en?.[k]));
    if (figuresChanged && next.provenance.figures === "approved") {
      next.provenance = {figures:"sample",sampleLabel:next.provenance.sampleLabel};
      next.narrativePublished = false;
    }
    const errors = validate(next, e);
    if (Object.keys(errors).length) return { errors };
    if (same(next, base)) return { entry: e, unchanged: true };
    e.draft = next;
    e.workflow = { ...e.workflow, state: "draft", version: e.workflow.version + 1, updatedAt: now(), updatedBy: who.key, lastEditor: who.key };
    if (patch.locale === "en" && patch.fields) {
      for (const l of LOCALES) if (l !== "en" && ["ready", "published"].includes(e.translation[l])) e.translation[l] = "outdated";
    } else if (patch.locale && patch.locale !== "en" && patch.fields) {
      e.translation[patch.locale] = "in_progress";
    }
    if (patch.locale && patch.locale !== "en" && patch.fields) e.translators = { ...e.translators, [patch.locale]: who.key };
    e.versions.unshift({ version: e.workflow.version, state: "draft", at: now(), by: who.key, note: patch.note ?? null, content: clone(e.draft) });
    log(who.key, "save", e, { locale: patch.locale ?? null });
    return { entry: e };
  }

  function transition(e, who, action, { can, note, publishAt } = {}) {
    const rule = TRANSITIONS[action];
    if (!rule) return { status: 400, code: "unknown_action" };
    const state = e.draft ? e.workflow.state : "published";
    if (mirrored(e) && e.draft && !seoOnly(e)) return MIRRORED;
    if (!rule.from.includes(state)) return { status: 409, code: "wrong_state", message: `Can't ${action} from ${state}.` };
    // The SEO fast lane: a draft that only changes the SEO block can go through the SEO team.
    const seoLane = seoOnly(e) && can(rule.permission.replace(/^content:/, "seo:"));
    if (!can(rule.permission) && !seoLane) return { status: 403, code: "forbidden", required: rule.permission };
    if (["publish", "schedule", "approve"].includes(action)) {
      const errors = validate(current(e), e);
      if (e.type === "article") for (const [locale, words] of Object.entries(current(e).locales)) if (words?.sections && articleBody.validate(words.sections, { publishing: true })) errors[`locales.${locale}.sections`] = "invalid";
      if (e.type === "review" && !current(e).locales.en.quote?.trim()) errors["locales.en.quote"] = "required";
      if (["caseStudy", "article"].includes(e.type) && !current(e).image?.src?.trim()) errors["image.src"] = "required";
      if (Object.keys(errors).length) return {status:422,code:"invalid",fieldErrors:errors};
    }
    // Legal wording is approved and published by someone who may approve legal text (plan: four
    // eyes for legal, claims and pricing).
    if (action === "schedule" && !(Date.parse(publishAt) > Date.parse(now()))) return { status: 422, code: "invalid", message: "Choose a time in the future.", fieldErrors: { publishAt: "future" } };
    if (e.type === "legalDocument" && ["approve", "publish", "schedule"].includes(action) && !can("legal:approve")) return { status: 403, code: "forbidden", required: "legal:approve" };
    if (e.type === "pricing" && ["approve", "publish", "schedule"].includes(action) && !can("pricing:approve")) return { status: 403, code: "forbidden", required: "pricing:approve" };
    if (e.type === "legalDocument" && (action === "publish" || action === "schedule")) {
      const c = e.draft;
      const last = e.legalVersions?.[0];
      const fieldErrors = {};
      if (!c.effectiveFrom) fieldErrors.effectiveFrom = "required";
      if (last && c.versionLabel === last.versionLabel) fieldErrors.versionLabel = "version_exists";
      if (Object.keys(fieldErrors).length) return { status: 422, code: "legal_version", message: "A new legal version needs its own number and an effective date.", fieldErrors };
    }
    // Four-eyes: whoever made the last change can't approve it themselves.
    if (action === "approve" && e.workflow.lastEditor === who.key) return { status: 409, code: "four_eyes", message: "Someone else has to approve your own change." };
    if (action === "request_changes" && !String(note ?? "").trim()) return { status: 422, code: "note_required", fieldErrors: { note: "required" } };
    if (action === "discard" && !e.live) return { status: 409, code: "never_published", message: "This was never published: delete it instead." };
    if (action === "discard") {
      e.draft = null;
      e.workflow = { ...e.workflow, state: "published", updatedAt: now(), updatedBy: who.key };
    } else if (action === "schedule") {
      e.workflow = { ...e.workflow, state: "scheduled", publishAt, updatedAt: now(), updatedBy: who.key };
    } else if (action === "unschedule") {
      e.workflow = { ...e.workflow, state: "approved", publishAt: null, updatedAt: now(), updatedBy: who.key };
    } else if (action === "publish") {
      if (e.type === "legalDocument") e.legalVersions.unshift({ versionLabel: e.draft.versionLabel, effectiveFrom: e.draft.effectiveFrom, publishedAt: now(), by: who.key, note: note ?? null, content: clone(e.draft) });
      e.live = e.draft;
      e.draft = null;
      e.workflow = { ...e.workflow, state: "published", visibility: e.workflow.visibility === "not_on_site" ? "live" : e.workflow.visibility, updatedAt: now(), updatedBy: who.key, publishedAt: now() };
      for (const l of LOCALES) if (e.translation[l] === "ready") e.translation[l] = "published";
      if (e.live.locales.en) e.translation.en = "published";
    } else {
      e.workflow = { ...e.workflow, state: rule.to, updatedAt: now(), updatedBy: who.key };
    }
    e.versions.unshift({ version: e.workflow.version, state: e.workflow.state, at: now(), by: who.key, note: note ?? null, action, content: clone(e.draft ?? e.live), ...(publishAt ? { publishAt } : {}) });
    log(who.key, action, e, note ? { note } : {});
    return { entry: e };
  }

  // Sample figures become approved project results (claims:approve; D-032, website AGENTS.md).
  function approveFigures(e, who) {
    const c = e.draft ?? clone(e.live);
    if (!c.provenance) return { status: 409, code: "no_figures" };
    if (c.provenance.figures === "approved") return { status: 409, code: "already_approved" };
    c.provenance = { ...c.provenance, figures: "approved", approvedBy: who.key, approvedAt: now() };
    c.sampleNarrativePublished = false;
    e.draft = c;
    e.workflow = { ...e.workflow, state: "draft", version: e.workflow.version + 1, updatedAt: now(), updatedBy: who.key, lastEditor: who.key };
    e.versions.unshift({ version: e.workflow.version, state: "draft", at: now(), by: who.key, note: "Figures confirmed as project results", action: "approve_figures", content: clone(e.draft) });
    log(who.key, "approve_figures", e);
    return { entry: e };
  }

  const ideas = new Map((seed.ideas ?? []).map((x) => [x.id, clone(x)]));
  // What each moderation action does. A reason, a link or a target are required where the status
  // matrix says so; everything is recorded in the idea's history and the audit log.
  const IDEA_ACTIONS = {
    publish: { from: ["pending"], to: "open" },
    plan: { from: ["open"], to: "planned" },
    start: { from: ["planned"], to: "in_progress" },
    ship: { from: ["in_progress"], to: "shipped", needs: "link" },
    decline: { from: ["pending", "open"], to: "declined", needs: "reason" },
    merge: { from: ["pending", "open"], to: "merged", needs: "into" },
    hide: { from: ["pending", "open", "planned", "in_progress", "shipped"], to: "hidden", needs: "reason" },
  };
  const VISIBLE = ["open", "planned", "in_progress", "shipped"];
  function moderate(idea, who, action, input = {}) {
    const rule = IDEA_ACTIONS[action];
    if (!rule) return { status: 400, code: "unknown_action" };
    if (!rule.from.includes(idea.status)) return { status: 409, code: "wrong_state", message: `Can't ${action} an idea that is ${idea.status}.` };
    const fieldErrors = {};
    if (rule.needs === "reason" && !String(input.reason ?? "").trim()) fieldErrors.reason = "required";
    if (rule.needs === "link" && !/^(https?:\/\/|\/)/.test(String(input.link ?? ""))) fieldErrors.link = "required";
    let target = null;
    if (rule.needs === "into") {
      target = ideas.get(String(input.into ?? ""));
      if (!target || target.id === idea.id || !VISIBLE.includes(target.status)) fieldErrors.into = "required";
    }
    if (Object.keys(fieldErrors).length) return { status: 422, code: "invalid", fieldErrors };
    const from = idea.status;
    idea.status = rule.to;
    idea.version += 1;
    if (rule.needs === "reason") idea.reason = String(input.reason).trim();
    if (rule.needs === "link") idea.link = String(input.link).trim();
    if (target) {
      idea.mergedInto = target.id;
      // The votes follow the idea people meant.
      target.votes += idea.votes;
      target.comments += idea.comments;
      if (idea.commentPreview?.length) {
        const ids = new Set((target.commentPreview ?? []).map(comment => comment.id));
        target.commentPreview = [...(target.commentPreview ?? []), ...clone(idea.commentPreview).map(comment => {
          while (ids.has(comment.id)) comment.id = `${idea.id}_${comment.id}`;
          ids.add(comment.id);
          return comment;
        })];
        // The discussion moves to the selected topic; future moderation happens there.
        idea.commentPreview = [];
      }
      idea.comments = 0;
      target.version += 1;
      target.history.unshift({ at: now(), by: who.key, action: "merged_from", from: idea.id });
    }
    idea.history.unshift({ at: now(), by: who.key, action, from, to: rule.to, ...(input.reason ? { reason: String(input.reason).trim() } : {}), ...(input.link ? { link: input.link } : {}), ...(target ? { into: target.id } : {}) });
    audit.unshift({ at: now(), by: who.key, action: `idea_${action}`, entry: idea.id, type: "idea", version: idea.version });
    return { idea };
  }

  // Scheduled entries whose time has come are published, as "scheduler" (called on every request).
  function tick() {
    for (const e of entries.values()) {
      if (e.draft && e.workflow.state === "scheduled" && Date.parse(e.workflow.publishAt) <= Date.parse(now())) {
        const publishAt = e.workflow.publishAt;
        e.workflow = { ...e.workflow, state: "approved" };
        const result = transition(e, { key: "scheduler" }, "publish", { can: () => true, note: `Scheduled for ${publishAt}` });
        e.workflow.publishAt = null;
        if (result.status) {
          e.workflow.updatedAt = now();
          e.workflow.updatedBy = "scheduler";
          log("scheduler", "schedule_failed", e, { publishAt, code: result.code, fieldErrors: result.fieldErrors });
        }
      }
    }
  }

  // A translation moves through review; whoever translated it can't approve it (four eyes).
  function translate(e, who, locale, action, { can }) {
    const rule = TRANSLATION_ACTIONS[action];
    if (!rule || locale === "en" || !LOCALES.includes(locale)) return { status: 400, code: "unknown_action" };
    const state = e.translation[locale];
    if (!rule.from.includes(state)) return { status: 409, code: "wrong_state", message: `Can't ${action} a translation that is ${state}.` };
    if (!can(rule.permission)) return { status: 403, code: "forbidden", required: rule.permission };
    if (action === "approve" && e.translators?.[locale] === who.key) return { status: 409, code: "four_eyes", message: "Someone else has to review your translation." };
    e.translation = { ...e.translation, [locale]: rule.to };
    log(who.key, `translation_${action}`, e, { locale });
    return { entry: e };
  }

  // A version's content, and restoring it as a new draft (the history is never rewritten).
  const versionOf = (e, n) => e.versions.find((v) => v.version === Number(n));
  function restore(e, who, n, {can = () => true} = {}) {
    const v = versionOf(e, n);
    if (!v?.content) return { status: 404, code: "not_found" };
    const restored = clone(v.content);
    if (e.type === "caseStudy") {
      restored.narrativePublished ??= false;
      restored.sampleNarrativePublished ??= false;
      if (restored.narrativePublished !== current(e).narrativePublished && !can("content:approve")) return {status:403,code:"forbidden",required:"content:approve"};
      if (restored.sampleNarrativePublished !== current(e).sampleNarrativePublished && !can("content:approve")) return {status:403,code:"forbidden",required:"content:approve"};
    }
    const errors = validate(restored, e);
    if (Object.keys(errors).length) return {status:422,code:"invalid",fieldErrors:errors};
    e.draft = restored;
    e.workflow = { ...e.workflow, state: "draft", version: e.workflow.version + 1, updatedAt: now(), updatedBy: who.key, lastEditor: who.key };
    e.versions.unshift({ version: e.workflow.version, state: "draft", at: now(), by: who.key, note: `Restored from version ${v.version}`, action: "restore", content: clone(e.draft) });
    log(who.key, "restore", e, { from: v.version });
    return { entry: e };
  }

  function queue(who) {
    const all = [...entries.values()];
    const media = (c) => [c.image, ...(c.gallery ?? [])].filter((m) => m && !m.alt?.en?.trim()).length;
    return {
      drafts: all.filter((e) => e.draft && e.workflow.state === "draft" && e.workflow.lastEditor === who.key).length,
      inReview: all.filter((e) => e.draft && e.workflow.state === "in_review").length,
      scheduled: all.filter((e) => e.draft && e.workflow.state === "scheduled").length,
      translationGaps: all.reduce((n, e) => n + LOCALES.filter((l) => l !== "en" && ["not_started", "outdated"].includes(e.translation[l])).length, 0),
      // Only what has an address of its own can miss a search description.
      seoIssues: all.filter((e) => !["global", "strings", "roadmapItem", "pricing"].includes(e.type) && !current(e).seo?.en?.description?.trim()).length,
      mediaIssues: all.reduce((n, e) => n + media(current(e)), 0),
      newLeads: 0,
      sampleFigures: all.filter((e) => current(e).provenance?.figures === "sample").length,
      pendingIdeas: [...ideas.values()].filter((x) => x.status === "pending").length,
      translationReview: all.reduce((n, e) => n + LOCALES.filter((l) => e.translation[l] === "needs_review").length, 0),
    };
  }

  // What the website prices with today: the software products' monthly prices, mirrored read-only
  // from the website's purchasing catalog (since c8be7fe).
  const pricing = () => {
    const live = entries.get("pr_software")?.live;
    return { currency: live?.currency ?? "CHF", priceMode: live?.priceMode ?? "indicative", managedIn: live?.managedIn ?? null, modules: Object.fromEntries((live?.locales.en.items ?? []).map((m) => [m.id, { monthly: m.monthly }])) };
  };
  const ensureDemo = () => { if (demo) require("./seed/demo-states").contentExamples({ entries, audit, ideas, now }); };
  const exportState = () => clone({ cmsVersion: 1, demoVersion: 3, entries: [...entries], audit, managerOrders, contentLocales: LOCALES, ideas: [...ideas] });
  const validateState = value => {
    const incoming = codec.object(value), rows = codec.mapRows(incoming.entries), ideas_ = codec.mapRows(incoming.ideas);
    if (!Array.isArray(incoming.audit) || rows.some(([, row]) => !row.workflow || !Array.isArray(row.versions) || !row.translation || !TYPES.includes(row.type))) throw codec.fail("Website Manager content state is incomplete.");
    const orders = incoming.managerOrders ?? {}, locales = incoming.contentLocales ?? ["en","ar","de","fr","it"];
    if (!orders || typeof orders !== "object" || Array.isArray(orders) || Object.entries(orders).some(([type,ids])=>!["service","caseStudy","article"].includes(type) || !Array.isArray(ids) || ids.length>1000 || ids.some(id=>typeof id!=="string") || new Set(ids).size!==ids.length) || !Array.isArray(locales) || !locales.includes("en") || new Set(locales).size!==locales.length || locales.some(locale=>!["en","ar","de","fr","it","es","pt","nl"].includes(locale))) throw codec.fail("Website Manager preferences are invalid.");
    return { cmsVersion: incoming.cmsVersion ?? 0, demoVersion: incoming.demoVersion ?? 0, entries: rows, audit: clone(incoming.audit), managerOrders: clone(incoming.managerOrders ?? {}), contentLocales: incoming.contentLocales ?? ["en","ar","de","fr","it"], ideas: ideas_ };
  };
  const importState = value => {
    const incoming = validateState(value);
    const additions = [...entries].filter(([id]) => id === "pg_faq" || id.startsWith("rv_"));
    codec.replaceMap(entries, incoming.entries);
    for (const [id, entry] of additions) if (incoming.cmsVersion < 1 && !entries.has(id)) entries.set(id, entry);
    // Populate only new schema fields. Never reset saved copy or draft revisions.
    for (const entry of entries.values()) for (const content of [entry.live, entry.draft].filter(Boolean)) {
      if (entry.type === "page") content.presentation ??= { sectionOrder: [], sectionMedia: {}, cursor: { text: {}, link: "" } };
    }
    for(const key of Object.keys(managerOrders)) delete managerOrders[key];
    Object.assign(managerOrders,incoming.managerOrders);
    LOCALES.splice(0,LOCALES.length,...incoming.contentLocales);
    for(const [,row] of incoming.entries) for(const locale of Object.keys((row.draft ?? row.live)?.locales ?? {})) if(!LOCALES.includes(locale))LOCALES.push(locale);
    codec.replaceMap(ideas, incoming.ideas); audit.splice(0, audit.length, ...incoming.audit);
    if (incoming.demoVersion < 1) ensureDemo();
    else if (demo && incoming.demoVersion < 2) require("./seed/demo-states").publishedExamples({ entries, audit, now });
    if (demo && incoming.demoVersion < 3) require("./seed/demo-states").populateTranslationExamples(entries);
  };
  return { managerOrders, ensureDemo, create, setVisibility, remove, CREATABLE, seed, tick, translate, versionOf, restore, entries, audit, ideas, moderate, IDEA_ACTIONS, VISIBLE, pricing, summary, detail, save, transition, approveFigures, queue, LOCALES, exportState, importState, validateState };
}

module.exports = { makeStore, TRANSITIONS, TYPES };
