// Strings, legal documents and the roadmap for the Website Manager seed.
//
// Strings: every message a page builds in code (strings.mjs), one entry per page, one for the
// shared components (case study, testimonials, language menu...) and one "Shared" entry for a
// message three or more pages use word for word. A message that is already a page's copy or
// modelled data is left out. Messages are grouped by the block of the view model they sit in;
// each keeps where it's used as its context.
//
// Legal: the three documents in Legal.jsx (LG) as versioned documents (plan: legalDocument is
// versioned and immutable). Today's wording is a placeholder the site itself says must be
// reviewed, so it is imported as version 0.1 with no effective date.
//
// Roadmap: the timeline items (RM) as content; the ideas (IDEAS) as community submissions with
// the moderation lifecycle (status matrix roadmap_idea). The website only ever shows moderated
// ideas, so three pending submissions are added, marked as samples, to have something to
// moderate.
import path from "node:path";
import { extractCopy } from "./copy.mjs";
import { field } from "./fields.mjs";
import { extractStrings, MODELLED } from "./strings.mjs";
import defaults from "../defaults.js";
import { sampleIdeaComments } from "./idea-comments.mjs";

const PAGE_FILES = [
  ["home", "Home.jsx"],
  ["services", "Services.jsx"],
  ["software", "Software.jsx"],
  ["work", "Work.jsx"],
  ["about", "About.jsx"],
  ["insights", "Insights.jsx"],
  ["contact", "Contact.jsx"],
  ["roadmap", "Roadmap.jsx"],
  ["legal", "Legal.jsx"],
  ["signIn", "SignIn.jsx"],
];
const COMPONENT_FILES = ["CaseStudy.jsx", "Testimonials.jsx", "ServiceWork.jsx", "LanguageMenu.jsx"];
// The purchasing views since c8be7fe (/plans, /cart, /checkout and the builders' shared parts).
const COMMERCE_FILES = ["PurchaseUI.jsx", "PurchaseControls.jsx", "CommerceLayout.jsx", "PurchasePlans.jsx", "PurchaseCart.jsx", "PurchaseCheckout.jsx", "SiteHeader.jsx", "AccountControl.jsx", "PaymentDetails.jsx", "purchase-payment.js", "purchase-identity.js", "purchase-adapter.js"];
const plain = (s) => String(s ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const words = (s) => plain(s.replace(/\{\d+\}/g, ""));
const KEYS = new Set(["Open", "Planned", "In progress", "Shipped", "Past", "Now", "Next", "All"]);

// Every string inside modelled class fields, so a message isn't a second copy of data.
function modelledTexts(file) {
  const out = new Set();
  const add = (v) => {
    if (typeof v === "string") out.add(plain(v));
    else if (Array.isArray(v)) v.forEach(add);
    else if (v && typeof v === "object") Object.values(v).forEach(add);
  };
  for (const name of MODELLED) {
    try {
      add(field(file, name));
    } catch {
      // not in this file
    }
  }
  return out;
}

function stringsEntry(entry, id, order, name, messages, repeats = []) {
  // Blocks follow the source: a new block where the method changes or the code moves on (more
  // than 25 lines since the last message). Blocks of one or two messages join their neighbour,
  // long ones are cut at 20, so each section is one part of the page.
  const blocks = [];
  for (const m of messages) {
    const last = blocks[blocks.length - 1];
    const prev = last?.[last.length - 1];
    if (!prev || prev.method !== m.method || Math.abs(m.line - prev.line) > 25 || last.length >= 20) blocks.push([m]);
    else last.push(m);
  }
  for (let i = blocks.length - 1; i > 0; i--) if (blocks[i].length < 3 || blocks[i - 1].length < 3) blocks.splice(i - 1, 2, [...blocks[i - 1], ...blocks[i]]);
  const merged = new Map(blocks.map((list, i) => [`b${i + 1}`, list]));
  let n = 0;
  const layout = [];
  const en = {};
  for (const [g, list] of merged) {
    const key = g.replace(/[^A-Za-z0-9_-]/g, "_");
    layout.push({ key, kind: "copy", label: key === "other" ? null : plain(list[0].text).replace(/\{\d+\}/g, "…").slice(0, 60), slots: list.map((m) => ({ key: `s${++n}`, kind: "message", context: m.where })) });
    en[key] = {};
    n = 0;
    for (const m of list) en[key][`s${++n}`] = m.text;
    n = 0;
  }
  // Messages that repeat a text the page also shows as copy ("Talk to us" on a button built in
  // code): a place of their own, so they're kept last (the keys above never move).
  if (repeats.length) {
    layout.push({ key: "repeats", kind: "copy", label: null, slots: repeats.map((m, i) => ({ key: `s${i + 1}`, kind: "message", context: m.where })) });
    en.repeats = Object.fromEntries(repeats.map((m, i) => [`s${i + 1}`, m.text]));
  }
  const e = entry(id, "strings", order, { name, slug: {}, layout }, en, {});
  e.seo = {};
  return e;
}

export function buildCatalog({ ref, entry, SEEDED_AT }) {
  // ---- strings ----
  const perFile = new Map();
  const echoes = new Map();
  const known = new Map();
  for (const [key, file] of [...PAGE_FILES, ...[...COMPONENT_FILES, ...COMMERCE_FILES].map((f) => [f.replace(/\.jsx?$/, ""), f])]) {
    const full = path.join(ref, file);
    const copy = new Set();
    for (const r of extractCopy(full).regions) for (const s of r.slots) copy.add(plain(s.text));
    const data = modelledTexts(full);
    const all = extractStrings(full);
    const list = all.filter((m) => !copy.has(words(m.text)) && !data.has(words(m.text)));
    // Texts the code compares against (statuses, periods, ids) are keys, not copy: they stay in code.
    const echo = all.filter((m) => copy.has(words(m.text)) && !data.has(words(m.text)) && !KEYS.has(m.text) && !/^[a-z-]+\/[a-z-]+$/.test(m.text));
    echoes.set(key, echo);
    perFile.set(key, list);
    for (const m of list) known.set(m.text, [...(known.get(m.text) ?? []), key]);
  }
  const shared = [...known].filter(([, files]) => new Set(files).size >= 3);
  const sharedTexts = new Set(shared.map(([t]) => t));
  // Repeats of page copy: the ones on three or more pages are shared, the rest stay with their page.
  const echoKnown = new Map();
  for (const [k, list] of echoes) for (const m of list) if (!sharedTexts.has(m.text)) echoKnown.set(m.text, [...(echoKnown.get(m.text) ?? []), k]);
  const sharedEcho = [...echoKnown].filter(([, files]) => new Set(files).size >= 3);
  const sharedEchoTexts = new Set(sharedEcho.map(([t]) => t));
  const repeatsOf = (k) => {
    const seen = new Set();
    return (echoes.get(k) ?? []).filter((m) => !sharedTexts.has(m.text) && !sharedEchoTexts.has(m.text) && !seen.has(m.text) && seen.add(m.text));
  };
  const strings = [];
  let order = 0;
  strings.push(
    stringsEntry(
      entry,
      "st_shared",
      ++order,
      "Shared",
      shared.map(([text, files]) => ({ text, method: "shared", props: [], where: `${[...new Set(files)].length} pages` })),
      sharedEcho.map(([text, files]) => ({ text, where: `${[...new Set(files)].length} pages` })),
    ),
  );
  for (const [key] of PAGE_FILES) strings.push(stringsEntry(entry, `st_${key}`, ++order, key, perFile.get(key).filter((m) => !sharedTexts.has(m.text)), repeatsOf(key)));
  strings.push(
    stringsEntry(
      entry,
      "st_components",
      ++order,
      "Components",
      COMPONENT_FILES.flatMap((f) => perFile.get(f.replace(/\.jsx?$/, "")).filter((m) => !sharedTexts.has(m.text)).map((m) => ({ ...m, method: f.replace(/\.jsx?$/, ""), props: [] }))),
      COMPONENT_FILES.flatMap((f) => repeatsOf(f.replace(/\.jsx?$/, ""))),
    ),
  );
  strings.push(
    stringsEntry(
      entry,
      "st_commerce",
      ++order,
      "Purchasing",
      COMMERCE_FILES.flatMap((f) => perFile.get(f.replace(/\.jsx?$/, "")).filter((m) => !sharedTexts.has(m.text)).map((m) => ({ ...m, method: f.replace(/\.jsx?$/, ""), props: [] }))),
      COMMERCE_FILES.flatMap((f) => repeatsOf(f.replace(/\.jsx?$/, ""))),
    ),
  );

  // ---- legal ----
  const LG = field(path.join(ref, "Legal.jsx"), "LG");
  const legal = Object.entries(LG).map(([key, doc], i) => {
    const e = entry(
      `lg_${key}`,
      "legalDocument",
      i + 1,
      { slug: { en: key }, versionLabel: "0.2", effectiveFrom: "2026-10-05" },
      { name: doc.title, summary: doc.summary, sections: doc.sections.map(([heading, body]) => ({ heading, body })) },
      { title: `${doc.title} | OrgTik`, description: doc.summary },
    );
    // What the website has published so far, never changed afterwards.
    e.legalVersions = [{versionLabel:"0.2",effectiveFrom:"2026-10-05",publishedAt:"2026-10-05T08:00:00.000Z",by:"seed",note:"Current website wording; not legally reviewed."}, { versionLabel: "0.1", effectiveFrom: null, publishedAt: SEEDED_AT, by: "seed", note: "Placeholder wording imported from the website; not legally reviewed." }];
    return e;
  });

  // ---- roadmap ----
  const roadmapSource = path.join(ref, "Roadmap.jsx");
  const optionalField = (name) => {
    try { return field(roadmapSource, name); }
    catch (error) { if (error.message.startsWith(`${name} not found`)) return []; throw error; }
  };
  const RM = optionalField("RM");
  const IDEAS = optionalField("IDEAS");
  const statusKey = (s) => ({ Open: "open", Planned: "planned", "In progress": "in_progress", Shipped: "shipped" })[s] ?? (() => { throw new Error(`status ${s}`); })();
  const periodKey = (p) => ({ Past: "past", Now: "now", Next: "next" })[p] ?? (() => { throw new Error(`period ${p}`); })();
  const roadmap = RM.map((r, i) =>
    entry(`rm_${String(i + 1).padStart(2, "0")}`, "roadmapItem", i + 1, { slug: {}, status: statusKey(r.status), period: periodKey(r.period), year: r.year, progress: r.progress }, { ...defaults.blankContent("roadmapItem").locales.en, name: r.title, body: r.body, timing: r.timing, theme: r.theme }, {}),
  );
  for (const r of roadmap) r.seo = {};
  const ideas = [
    ...IDEAS.map((x, i) => ({ id: x.id, status: statusKey(x.status), theme: x.theme, title: x.title, body: x.body, votes: x.votes, comments: x.comments, commentPreview: sampleIdeaComments(x.id), submittedAt: SEEDED_AT, order: i + 1, source: "website", sample: true })),
    // Sample submissions waiting for moderation, separate from actual incoming website ideas.
    { id: "sample-dark-mode", status: "pending", theme: "SaaS products", title: "A dark theme for the workspace", body: "Long days in the CRM would be easier on the eyes with a darker theme.", votes: 0, comments: 0, submittedAt: "2026-09-29T15:12:00.000Z", sample: true },
    { id: "sample-invoice-export", status: "pending", theme: "SaaS products", title: "Export invoices to the accounting tool", body: "Send finished invoices straight to our accounting software instead of downloading them.", votes: 0, comments: 0, submittedAt: "2026-09-30T07:40:00.000Z", sample: true },
    { id: "sample-setup-duplicate", status: "pending", theme: "SaaS products", title: "Step-by-step guide for new teams", body: "A walkthrough that tells a new team which modules to start with.", votes: 0, comments: 0, submittedAt: "2026-09-30T09:05:00.000Z", sample: true },
  ].map((x, i) => ({ ...x, order: i + 1, version: 1, history: [{ at: x.submittedAt, by: x.source === "website" ? "seed" : "visitor", action: "submitted", to: x.status }] }));

  return { strings, legal, roadmap, ideas };
}
