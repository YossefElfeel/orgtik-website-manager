// The website's content, from the Website Manager (D-012, D-035).
//
// snapshot.js is the published content (scripts/content-pull.mjs). The functions below rebuild
// the exact shapes the pages were written against (the arrays and objects that used to be typed
// into each page), so the pages render as before and change only when content is published.
// Each call returns a fresh copy: a page may sort or change what it gets without touching others.
import { wordsOf } from "./locale.js";
import snapshot from "./snapshot.js";

const clone = (v) => JSON.parse(JSON.stringify(v));
const pad = (n) => String(n).padStart(2, "0");
const of = (type) =>
  (snapshot.entries[type] ?? [])
    .slice()
    .sort(
      (a, b) =>
        String(a.parent ?? "").localeCompare(String(b.parent ?? "")) ||
        a.order - b.order,
    );
const byId = (type, id) =>
  (snapshot.entries[type] ?? []).find((e) => e.id === id);
const externalHref = (value) => {
  try {
    const url = new URL(String(value || "").trim());
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
};
// A record's words in the page's language, else English (S5; the name is from before languages).
const en = (e) => wordsOf(e.locales);
const page = (key) => en(byId("page", `pg_${key}`));
const global = (key) => en(byId("global", `gl_${key}`));
const ROADMAP_STATUS = {
  open: "Open",
  planned: "Planned",
  in_progress: "In progress",
  shipped: "Shipped",
};
const PERIOD = { past: "Past", now: "Now", next: "Next" };
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
// "2026-09-18" as the site writes dates: "18 September 2026".
const longDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

function families() {
  const services = of("service");
  return of("serviceFamily").map((f) => {
    const x = en(f);
    return {
      slug: f.slug.en,
      name: x.name,
      short: x.short,
      kicker: x.kicker,
      title: x.title,
      intro: x.intro,
      image: f.image.src,
      icon: f.icon,
      children: services
        .filter((s) => s.parent === f.id)
        .map((s) => {
          const y = en(s);
          return {
            slug: s.slug.en,
            name: y.name,
            outcome: y.outcome,
            summary: y.summary,
            capabilities: y.capabilities,
          };
        }),
    };
  });
}

// The software modules' words (Home reads them; their prices are in software-catalog.js).
function modules() {
  return of("softwareModule").map((m, i) => {
    const x = en(m);
    return {
      id: m.slug.en,
      name: x.name,
      formal: x.formal,
      shortLabel: x.shortLabel,
      icon: m.icon,
      title: x.title,
      short: x.short,
      description: x.description,
      tasks: x.tasks,
      category: x.category,
      number: pad(i + 1),
      image: m.image.src,
      highlights: x.highlights,
      useCases: x.useCases,
    };
  });
}

function projects() {
  return of("caseStudy").map((c) => {
    const x = en(c);
    return {
      slug: c.slug.en,
      name: x.name,
      category: x.category,
      sector: x.sector,
      summary: x.summary,
      transformation: x.transformation,
      image: c.image.src,
      status: c.provenance.sampleLabel.en,
      service: c.department,
      gallery: c.gallery.map((g) => g.src),
    };
  });
}

function caseStudies() {
  return Object.fromEntries(
    of("caseStudy")
      .filter(
        (c) =>
          (c.narrativePublished === true &&
            c.provenance?.figures === "approved") ||
          (c.sampleNarrativePublished === true &&
            c.provenance?.figures === "sample"),
      )
      .map((c) => {
        const x = en(c);
        const {
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
        } = x;
        return [
          c.slug.en,
          {
            department: c.department,
            approved: c.provenance?.figures === "approved",
            sample: c.provenance?.figures === "sample",
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
        ];
      }),
  );
}

// Articles are filed under a service family; the Insights page labels them with its short name.
function articleFamilies() {
  const used = new Set(of("article").map((a) => a.category));
  return families().filter((f) => used.has(f.slug));
}

// Prices, bundles and software plans are not here: since c8be7fe they live in the website's
// purchasing catalogs (service-catalog.js, software-catalog.js, purchase-catalog.js), which the
// cart and checkout read too. The Website Manager mirrors them read-only (owner's choice, 2026-10-03).
export const content = {
  MENU: () => clone(global("header")?.menu ?? []),
  FOOT_EXPLORE: () => clone(global("footer")?.explore ?? []),
  FOOT_START: () => clone(global("footer")?.start ?? []),
  PARTNER_INFO: () => clone(en(byId("page", "pg_partners"))?.intro ?? {}),
  PARTNERS: () =>
    clone(en(byId("page", "pg_partners"))?.partners ?? [])
      .filter(
        (p) =>
          p.visible !== false &&
          p.name &&
          /^\/assets\/|^https:\/\//.test(p.logo || ""),
      )
      .map((p) => ({
        ...p,
        profileHref: `/legal/partners#${encodeURIComponent(p.id)}`,
        website: externalHref(p.website),
        accounts: (Array.isArray(p.accounts) ? p.accounts : [])
          .filter((account) => account && typeof account === "object")
          .map((account) => ({
            label: String(account.label || "").trim(),
            url: externalHref(account.url),
          }))
          .filter((account) => account.label && account.url),
      })),
  // Services.jsx, About.jsx
  FAM: () => families(),
  STORIES: () => page("services").stories.map((s) => [s.title, s.body, s.icon]),
  // Home.jsx, Services.jsx: the process steps shared by both.
  STEPS: () => global("process").steps.map((s) => [s.name, s.title, s.body]),
  SOCIALS: () => global("socials").networks.map((s) => [s.name, s.icon]),
  // Home.jsx
  HOME_MODS: () =>
    modules().map(
      ({ id, shortLabel, icon, category, title, description, tasks }) => ({
        id,
        formal: shortLabel,
        icon,
        category,
        title,
        desc: description,
        tasks,
      }),
    ),
  HERO_WORDS: () => clone(page("home").heroWords),
  SVCS: () => clone(page("home").homeServices),
  FAQS: () => page("home").faqs.map((q) => [q.question, q.answer]),
  SOFTWARE_STEPS: () =>
    page("software").planSteps.map((s, i) => ({
      n: pad(i + 1),
      title: s.title,
      body: s.body,
    })),
  FLOW: () =>
    page("software").flow.map((f) => [f.icon, f.name, f.title, f.body]),
  CTX: () => page("software").context.map((c) => [c.step, c.icon, c.label]),
  // Insights.jsx
  INS: () => {
    const short = Object.fromEntries(families().map((f) => [f.slug, f.short]));
    return of("article").map((a) => {
      const x = en(a);
      return {
        slug: a.slug.en,
        category: short[a.category],
        title: x.name,
        excerpt: x.excerpt,
        date: longDate(a.publishedOn),
        readingTime: `${a.readingMinutes} min read`,
        image: a.image.src,
      };
    });
  },
  ART: () =>
    Object.fromEntries(
      of("article").map((a) => [
        a.slug.en,
        {
          t: clone(en(a).takeaways),
          b: en(a).sections.map((s) => [s.heading, clone(s.paragraphs ?? [])]),
          ...(en(a).sections.some((s) => s.blocks)
            ? { sections: clone(en(a).sections) }
            : {}),
        },
      ]),
    ),
  SVC: () =>
    Object.fromEntries(
      articleFamilies()
        .sort((a, b) => a.short.localeCompare(b.short))
        .map((f) => [f.short, [f.slug, f.name, f.short]]),
    ),
  // About.jsx
  JR: () =>
    page("about").journeySteps.map((j, i) => [
      pad(i + 1),
      j.title,
      j.body,
      j.outcome,
    ]),
  CAPS: () =>
    page("about").capabilityRoutes.map((c) => [
      c.title,
      c.lead,
      c.body,
      clone(c.tags),
      c.href,
      c.image,
      c.icon,
      c.cta,
    ]),
  // Contact.jsx
  TOPICS: () => clone(page("contact").topics),
  PATHS: () =>
    page("contact").paths.map((p) => [
      p.id,
      p.icon,
      p.title,
      p.body,
      p.audience,
      p.topic,
    ]),
  // Roadmap.jsx
  RM: () =>
    of("roadmapItem").map((r) => {
      const x = en(r);
      return {
        year: r.year,
        period: PERIOD[r.period],
        status: ROADMAP_STATUS[r.status],
        progress: r.progress,
        timing: x.timing,
        theme: x.theme,
        title: x.name,
        body: x.body,
      };
    }),
  IDEAS: () =>
    snapshot.ideas
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((i) => ({
        id: i.id,
        status: ROADMAP_STATUS[i.status],
        theme: i.theme,
        title: i.title,
        body: i.body,
        votes: i.votes,
        comments: i.comments,
      })),
  IDEA_COMMENTS: (id) =>
    clone((snapshot.ideas.find((idea) => idea.id === id)?.commentPreview ?? []).filter(comment => !comment.status || comment.status === "published")),
  // Legal.jsx
  LG: () =>
    Object.fromEntries(
      of("legalDocument").map((d) => [
        d.slug.en,
        {
          title: en(d).name,
          summary: en(d).summary,
          sections: en(d).sections.map((s) => [s.heading, s.body]),
        },
      ]),
    ),
  // projects.js, case-studies.js
  PROJECTS: () => projects(),
  CASE_STUDIES: () => caseStudies(),
  CASE_STUDY_FORMATS: () =>
    clone(
      global("caseFormats")?.formats ??
        Object.fromEntries(
          of("caseStudy").map((c) => [c.department, c.format]),
        ),
    ),
};
