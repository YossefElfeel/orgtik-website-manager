// Website Manager: leads and site settings (plan, Phase 2 "Leads", "Settings").
//
// Leads follow D-028: one pipeline for every lead (new → contacted → qualified → quoted → won or
// lost, plus not a fit, spam and duplicate). This is the website's slice of it: the Sales wave
// moves the records into the CRM's own store and this module becomes a view onto it. The
// local website forms now deliver to the CMS. The seed also has sample leads, marked as
// samples. A lead carries the page, the selection (bundle, modules, duration) and the
// UTM tags it came with, and the version of the privacy notice the visitor saw.
//
// Personal data (name, email, phone) is masked for anyone without leads:pii, in the list, the
// detail and the CSV export; erasing it is recorded in the audit log.
const clone = (v) => JSON.parse(JSON.stringify(v));
const codec = require("./state-codec");

const LEAD_ACTIONS = {
  contact: { from: ["new"], to: "contacted" },
  qualify: { from: ["new", "contacted"], to: "qualified" },
  unqualify: { from: ["new", "contacted"], to: "unqualified", needs: "reason" },
  quote: { from: ["qualified"], to: "quoted" },
  win: { from: ["quoted"], to: "won" },
  lose: { from: ["contacted", "qualified", "quoted"], to: "lost", needs: "reason" },
  spam: { from: ["new"], to: "spam" },
  duplicate: { from: ["new"], to: "duplicate", needs: "of" },
  reopen: { from: ["unqualified"], to: "new" },
};
const OPEN = ["contacted", "qualified", "quoted"];

function sampleLeads(now) {
  const at = (h) => new Date(Date.parse(now()) - h * 3600e3).toISOString();
  const lead = (id, hoursAgo, x) => ({ id, source: "website", status: "new", owner: null, notes: [], sample: true, consent: { privacyVersion: "0.1", at: at(hoursAgo) }, createdAt: at(hoursAgo), version: 1, history: [{ at: at(hoursAgo), by: "visitor", action: "submitted", to: "new" }], ...x });
  return [
    lead("ld_01", 50, { topic: "Software", name: "Sara Keller", email: "sara.keller@example.test", phone: "+41 31 555 01 01", company: "Keller Treuhand AG", message: "We're 18 people and want HR, Tasks and Files together. Can we start next month?", page: "/software", context: { plan: "operations", modules: ["hr", "tasks", "files"], duration: "annual" }, utm: { source: "linkedin", medium: "social", campaign: "suite-launch" } }),
    lead("ld_02", 30, { topic: "Website or app", name: "Luca Bernasconi", email: "luca@bernasconi-design.test", phone: "", company: "Bernasconi Design", message: "New website for our studio, with a small shop.", page: "/services", context: { bundle: "Launch bundle", services: ["design/brand-development", "development/web-development", "marketing/seo-services"] }, utm: { source: "google", medium: "cpc", campaign: "web-design-ch" } }),
    lead("ld_03", 20, { topic: "Support & hosting", name: "Nadia Haddad", email: "n.haddad@example.test", phone: "+41 44 555 22 10", company: "", message: "Our current host is shutting down. We need someone to move and look after the site.", page: "/contact", context: {}, utm: {} }),
    lead("ld_04", 6, { topic: "Brand & design", name: "Jonas Weber", email: "jonas.weber@example.test", phone: "", company: "Weber Bäckerei", message: "Refresh of our logo and packaging.", page: "/contact", context: {}, utm: { source: "instagram", medium: "social", campaign: "" } }),
    lead("ld_05", 2, { topic: "A new project", name: "Win a free iPhone", email: "promo@spam.test", phone: "", company: "", message: "Click here to claim your prize!!!", page: "/contact", context: {}, utm: {} }),
  ];
}

const mask = (s, keep = 1) => (s ? s.slice(0, keep) + "•".repeat(Math.max(3, s.length - keep)) : s);
const maskEmail = (e) => (e ? e.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + "•".repeat(Math.max(3, b.length)) + c) : e);
// A cell that starts like a formula runs as one in a spreadsheet: prefix it (CSV injection).
const cell = (v) => {
  const s = String(v ?? "");
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

function makeOps({ store, now }) {
  const leads = new Map(sampleLeads(now).map((l) => [l.id, l]));
  let nextLead = leads.size + 1;
  require("./seed/demo-states").leadExamples(leads, now);
  const log = (who, action, id, extra = {}) => store.audit.unshift({ at: now(), by: who, action, entry: id, type: "lead", ...extra });

  const view = (l, canPii) => (canPii || l.erased ? l : { ...l, name: mask(l.name), email: maskEmail(l.email), phone: l.phone ? mask(l.phone, 4) : "", masked: true });

  function move(l, who, action, input = {}) {
    const rule = LEAD_ACTIONS[action];
    if (!rule) return { status: 400, code: "unknown_action" };
    if (!rule.from.includes(l.status)) return { status: 409, code: "wrong_state", message: `Can't ${action} a lead that is ${l.status}.` };
    const fieldErrors = {};
    if (rule.needs === "reason" && !String(input.reason ?? "").trim()) fieldErrors.reason = "required";
    if (rule.needs === "of" && !(leads.has(input.of) && input.of !== l.id)) fieldErrors.of = "required";
    if (Object.keys(fieldErrors).length) return { status: 422, code: "invalid", fieldErrors };
    const from = l.status;
    l.status = rule.to;
    if (rule.needs === "reason") l.reason = String(input.reason).trim();
    if (rule.needs === "of") l.duplicateOf = input.of;
    l.version += 1;
    l.history.unshift({ at: now(), by: who.key, action, from, to: rule.to, ...(input.reason ? { reason: String(input.reason).trim() } : {}) });
    log(who.key, `lead_${action}`, l.id);
    return { lead: l };
  }
  function assign(l, who, owner) {
    l.owner = owner || null;
    l.version += 1;
    l.history.unshift({ at: now(), by: who.key, action: "assign", owner: l.owner });
    log(who.key, "lead_assign", l.id);
    return { lead: l };
  }
  function note(l, who, text) {
    const t = String(text ?? "").trim();
    if (!t) return { status: 422, code: "invalid", fieldErrors: { text: "required" } };
    l.notes.unshift({ at: now(), by: who.key, text: t });
    l.version += 1;
    log(who.key, "lead_note", l.id);
    return { lead: l };
  }
  // Erasure (the visitor asked, or retention ran out): the record stays for the numbers, the person goes.
  function erase(l, who) {
    Object.assign(l, { name: "—", email: "", phone: "", company: "", message: "", erased: true, version: l.version + 1 });
    l.notes = l.notes.map((n) => ({ ...n, text: "—" }));
    l.history.unshift({ at: now(), by: who.key, action: "erase" });
    log(who.key, "lead_erase", l.id);
    return { lead: l };
  }
  // What the website's form sends (S6). Validated here, so the form can say what's missing.
  function submit(body) {
    const fieldErrors = {};
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim();
    const message = String(body.message ?? "").trim();
    if (!name) fieldErrors.name = "required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = "email";
    if (!message) fieldErrors.message = "required";
    if (body.consent !== true) fieldErrors.consent = "required";
    if (Object.keys(fieldErrors).length) return { fieldErrors };
    const id = `ld_${String(nextLead++).padStart(2, "0")}`;
    const l = {
      id,
      source: "website",
      status: "new",
      owner: null,
      notes: [],
      topic: String(body.topic ?? ""),
      name,
      email,
      phone: String(body.phone ?? ""),
      company: String(body.company ?? ""),
      message,
      page: String(body.page ?? ""),
      context: body.context && typeof body.context === "object" ? clone(body.context) : {},
      utm: body.utm && typeof body.utm === "object" ? clone(body.utm) : {},
      consent: { privacyVersion: String(body.privacyVersion ?? ""), at: now() },
      createdAt: now(),
      version: 1,
      history: [{ at: now(), by: "visitor", action: "submitted", to: "new" }],
    };
    leads.set(id, l);
    return { lead: l };
  }
  function csv(canPii) {
    const head = ["id", "status", "topic", "name", "email", "phone", "company", "page", "utm_source", "utm_medium", "utm_campaign", "created"];
    const rows = [...leads.values()].map((raw) => {
      const l = view(raw, canPii);
      return [l.id, l.status, l.topic, l.name, l.email, l.phone, l.company, l.page, l.utm.source, l.utm.medium, l.utm.campaign, l.createdAt];
    });
    // UTF-8 with a BOM so spreadsheet apps read accents and Arabic correctly.
    return "﻿" + [head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
  }

  // ---- site settings ----
  const site = {
    siteName: "OrgTik",
    // App.jsx: document.title = `${page} | OrgTik`
    titleTemplate: "{page} | OrgTik",
    // index.html's description: what every page says until its own is written.
    defaultDescription: "OrgTik connects expert digital services and modular business software in one cinematic digital experience.",
    defaultOgImage: null,
    organization: { name: "OrgTik", email: "", phone: "", address: "Belp, Switzerland" },
    // Owner enabled the local website-to-CMS forms integration on 2026-10-05.
    // The existing dashboard setting can pause delivery; this mock does not activate production.
    formsMode: "live",
    locales: [
      { code: "en", enabled: true, public: true },
      { code: "ar", enabled: true, public: false },
      { code: "de", enabled: true, public: false },
      { code: "fr", enabled: true, public: false },
      { code: "it", enabled: true, public: false },
    ],
    version: 1,
    updatedAt: null,
    updatedBy: null,
  };
  // How ready each language is: entries whose translation is ready or published.
  function readiness() {
    const all = [...store.entries.values()].filter((e) => !["pricing"].includes(e.type));
    return Object.fromEntries(site.locales.map((l) => [l.code, { done: all.filter((e) => ["ready", "published"].includes(e.translation[l.code])).length, total: all.length }]));
  }
  function updateSite(who, patch, can) {
    const next = clone(site);
    const errors = {};
    for (const k of ["siteName", "titleTemplate", "formsMode", "defaultDescription"]) if (k in patch) next[k] = patch[k];
    if ("defaultOgImage" in patch) next.defaultOgImage = patch.defaultOgImage || null;
    if (patch.organization) next.organization = { ...next.organization, ...patch.organization };
    if (!String(next.siteName).trim()) errors.siteName = "required";
    if (!String(next.titleTemplate).includes("{page}")) errors.titleTemplate = "needs_page";
    if (!String(next.defaultDescription ?? "").trim()) errors.defaultDescription = "required";
    else if (next.defaultDescription.length > 320) errors.defaultDescription = "too_long";
    if (!["preview", "live"].includes(next.formsMode)) errors.formsMode = "required";
    if (next.organization.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.organization.email)) errors["organization.email"] = "email";
    if (patch.locales) {
      if (!can("locales:enable")) return { status: 403, code: "forbidden", required: "locales:enable" };
      if(!Array.isArray(patch.locales) || new Set(patch.locales.map(locale=>locale.code)).size!==patch.locales.length || patch.locales.some(locale=>!['en','ar','de','fr','it','es','pt','nl'].includes(locale.code) || typeof locale.enabled!=='boolean' || typeof locale.public!=='boolean'))return {errors:{locales:'invalid'}};
      next.locales = next.locales.map(l=>({...l,...(patch.locales.find(p=>p.code===l.code)??{})})).concat(patch.locales.filter(l=>!next.locales.some(existing=>existing.code===l.code)));
      // New manager languages start private; publishing website translations is separate.
      if(next.locales.some(locale=>!['en','ar','de','fr','it'].includes(locale.code) && locale.public)) errors.locales='translation_not_ready';
      if (!next.locales.find((l) => l.code === "en")?.public) errors.locales = "english_public";
      for (const l of next.locales) if (l.public && !l.enabled) errors.locales = "public_needs_enabled";
    }
    // Forms going live means real personal data arrives: the privacy notice must be real first.
    if (next.formsMode === "live" && site.formsMode !== "live") {
      const privacy = store.entries.get("lg_privacy");
      if (!privacy?.legalVersions?.some((v) => v.effectiveFrom)) errors.formsMode = "privacy_first";
    }
    if (Object.keys(errors).length) return { errors };
    for(const locale of next.locales) if(!store.LOCALES.includes(locale.code))store.LOCALES.push(locale.code);
    Object.assign(site, next, { version: site.version + 1, updatedAt: now(), updatedBy: who.key });
    store.audit.unshift({ at: now(), by: who.key, action: "site_settings", entry: "site", type: "settings" });
    return { site };
  }

  const exportState = () => ({ data: clone({ leads: [...leads], site, demoVersion: 1 }), sequences: { nextLead } });
  const validateState = value => {
    const incoming = codec.object(value), rows = codec.mapRows(incoming.data?.leads), site_ = codec.object(incoming.data?.site);
    if (!Number.isSafeInteger(site_.version) || !Array.isArray(site_.locales) || !site_.organization) throw codec.fail("Website Manager site settings are incomplete.");
    return { data: { leads: rows, site: site_, demoVersion: incoming.data.demoVersion ?? 0 }, sequences: { nextLead: codec.sequence(incoming.sequences?.nextLead, rows, "ld") } };
  };
  const importState = value => { const incoming = validateState(value); codec.replaceMap(leads, incoming.data.leads); codec.replaceObject(site, incoming.data.site); for(const locale of site.locales)if(!store.LOCALES.includes(locale.code))store.LOCALES.push(locale.code); nextLead = incoming.sequences.nextLead; if (incoming.data.demoVersion < 1) require("./seed/demo-states").leadExamples(leads, now); };
  return { leads, view, move, assign, note, erase, submit, csv, OPEN, LEAD_ACTIONS, site, readiness, updateSite, exportState, importState, validateState };
}

module.exports = { makeOps, mask, maskEmail };
