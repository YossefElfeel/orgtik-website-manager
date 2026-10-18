// Suggestions Claude wrote for G2's coverage gaps (orgtik-program decisions/D-038): a search
// description for each page that had none, and a description (alt text) for each image in use.
// They're English drafts from the page's own copy and from what each image shows; nothing here is
// published. Entries get them as a draft waiting for review; the media library gets them marked as
// suggested until someone saves the file's description. Image rights are left unknown on purpose.
const AUTHOR = "assistant";
const NOTE = "Suggested by Claude (D-038): review before publishing.";

const PAGE_DESCRIPTIONS = {
  pg_home: "OrgTik designs brands, builds websites and apps, and grows your audience, then gives your team modular software to run the day-to-day.",
  pg_services: "Brand, digital, marketing, support and hosting from one studio. Explore every OrgTik service, or start from a ready-made bundle.",
  pg_software: "Modular business software in one workspace: CRM, HR, tasks, files, marketing and website. Pick what your team needs and build a plan.",
  pg_work: "Selected OrgTik projects, from OrgTik-owned work to concept previews. Each story shows its status up front.",
  pg_about: "Why OrgTik exists: we connect brand, technology and operations around one useful outcome, then build the system that carries it forward.",
  pg_insights: "Practical notes for better decisions. Search by topic or start with a popular read; every article links to the service that helps you act on it.",
  pg_contact: "Tell OrgTik what needs to work better. We read your note, suggest the smallest useful first step, and shape scope, timing and price with you.",
  pg_roadmap: "See what OrgTik has shipped, what is in progress and what comes next, and the ideas the community has voted on.",
  pg_legal: "Company details, privacy information and terms for OrgTik, plus a sitemap of every part of the site.",
};

// By file: what the image shows (the same words serve every entry that uses it).
const IMAGE_DESCRIPTIONS = {
  "brand-cards.webp": "OrgTik business cards, dark and light, stacked on a dark surface.",
  "brand-glass.webp": "A hand holding a clear glass tile with the OrgTik mark, against a violet gradient.",
  "brand-phone.webp": "A phone showing the OrgTik app icon on its home screen.",
  "brand-tablet.webp": "A hand with a stylus over a tablet that shows the OrgTik logo.",
  "cinematic-desktop.webp": "A hand holding a clear glass tile with the OrgTik mark, against a violet gradient.",
  "cinematic-mobile.webp": "A hand holding a clear glass tile with the OrgTik mark, against a violet gradient.",
  "logo-ph-1.svg": "Client logo placeholder",
  "logo-ph-2.svg": "Client logo placeholder",
  "logo-ph-3.svg": "Client logo placeholder",
  "logo-ph-4.svg": "Client logo placeholder",
  "logo-ph-5.svg": "Client logo placeholder",
  "logo-ph-6.svg": "Client logo placeholder",
  "logo/orgtik-app-icon.svg": "OrgTik app icon",
  "logo/orgtik-lockup-color.svg": "OrgTik",
  "logo/orgtik-lockup-white.svg": "OrgTik",
  "logo/orgtik-mark-white.svg": "OrgTik mark",
  "logo/orgtik-wordmark-white.svg": "OrgTik",
};

function applySuggestions({ store, media, now }) {
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const at = now();
  for (const e of store.entries.values()) {
    if (!e.live) continue;
    const description = PAGE_DESCRIPTIONS[e.id];
    const src = e.live.image?.src;
    const alt = src && !e.live.image.alt?.en && IMAGE_DESCRIPTIONS[src];
    if (!(description && !e.live.seo?.en?.description) && !alt) continue;
    const draft = clone(e.live);
    if (description && !draft.seo.en?.description) draft.seo.en = { ...(draft.seo.en ?? {}), description };
    if (alt) draft.image.alt = { ...draft.image.alt, en: alt };
    e.draft = draft;
    e.workflow = { ...e.workflow, state: "draft", version: e.workflow.version + 1, updatedAt: at, updatedBy: AUTHOR, lastEditor: AUTHOR };
    e.versions.unshift({ version: e.workflow.version, state: "draft", at, by: AUTHOR, note: NOTE, content: clone(draft) });
  }
  for (const m of media.values()) {
    const text = IMAGE_DESCRIPTIONS[m.file];
    if (!text || m.alt.en) continue;
    m.alt = { ...m.alt, en: text };
    m.altSuggested = true;
  }
}

module.exports = { applySuggestions, AUTHOR, PAGE_DESCRIPTIONS, IMAGE_DESCRIPTIONS };
