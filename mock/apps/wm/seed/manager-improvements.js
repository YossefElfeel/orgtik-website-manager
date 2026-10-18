// Additive CMS schema migration. Existing values and stable IDs always win.
const clone = (value) => JSON.parse(JSON.stringify(value));
const locales = ["en", "ar", "de", "fr", "it"];
const labels = {
  en: [
    "Frequently asked questions",
    "Answers to common questions about working with OrgTik.",
    "Reviews",
    "Sample review",
  ],
  ar: [
    "الأسئلة الشائعة",
    "إجابات عن الأسئلة الشائعة حول العمل مع أورجتيك.",
    "التقييمات",
    "تقييم تجريبي",
  ],
  de: [
    "Häufig gestellte Fragen",
    "Antworten auf häufige Fragen zur Zusammenarbeit mit OrgTik.",
    "Bewertungen",
    "Beispielbewertung",
  ],
  fr: [
    "Questions fréquentes",
    "Les réponses aux questions courantes sur la collaboration avec OrgTik.",
    "Avis",
    "Avis de démonstration",
  ],
  it: [
    "Domande frequenti",
    "Risposte alle domande più comuni sulla collaborazione con OrgTik.",
    "Recensioni",
    "Recensione dimostrativa",
  ],
};
function applyManagerImprovements(seed) {
  const home = seed.entries.find((entry) => entry.id === "pg_home");
  if (!seed.entries.some((entry) => entry.id === "pg_faq")) {
    const faq = clone(home);
    Object.assign(faq, {
      id: "pg_faq",
      name: "FAQ",
      order: 30,
      slug: { en: "/faq" },
      layout: [
        {
          key: "hero",
          kind: "data",
          label: "FAQ",
          node: {
            kind: "group",
            fields: {
              title: { kind: "text", label: "title" },
              intro: { kind: "longtext", label: "intro" },
            },
          },
        },
      ],
      locales: {},
      seo: {},
    });
    for (const locale of locales) {
      faq.locales[locale] = {
        hero: { title: labels[locale][0], intro: labels[locale][1] },
      };
      faq.seo[locale] = {
        title: labels[locale][0],
        description: labels[locale][1],
        robots: "index",
        inSitemap: true,
      };
    }
    seed.entries.push(faq);
  }
  for (const entry of seed.entries) {
    if (entry.type === "page") {
      entry.presentation ??= {
        sectionOrder: [],
        sectionMedia: {},
        cursor: { text: {}, link: "" },
      };
      // The old intro copy is still consumed by page code; retain it as the source fallback.
      const cursor = entry.layout?.find(
        (section) =>
          section.key === "intro" && section.label === "View project",
      );
      if (cursor) {
        cursor.label = "Custom Cursor";
        for (const locale of locales) {
          const text = entry.locales[locale]?.intro?.div;
          if (text)
            entry.presentation.cursor.text[locale] ??= text
              .replace(/<[^>]+>/g, "")
              .trim();
        }
      }
    }
    if (entry.id === "gl_footer") {
      for (const [locale, words] of Object.entries(entry.locales)) {
        if (
          Array.isArray(words.explore) &&
          !words.explore.some((link) => link.href === "/faq")
        )
          words.explore.push({
            label: labels[locale]?.[0] ?? "FAQ",
            href: "/faq",
          });
      }
    }
  }
  for (let i = 1; i <= 7; i++) {
    if (
      seed.entries.some(
        (entry) => entry.id === `rv_${String(i).padStart(2, "0")}`,
      )
    )
      continue;
    seed.entries.push({
      id: `rv_${String(i).padStart(2, "0")}`,
      type: "review",
      siteId: "orgtik",
      order: i,
      slug: {},
      seo: {},
      image: { src: "", alt: {} },
      sample: true,
      relatedEntry: "",
      position: i,
      locales: {
        en: {
          name: `Sample client ${i}`,
          role: "Project lead",
          company: "Example organization",
          quote: [
            "A clear plan helped our team agree on what to build next.",
            "Our design and software work came together in one shared process.",
            "We could follow progress and understand the decisions at every step.",
          ][(i - 1) % 3],
        },
      },
      workflow: {
        ...clone(home.workflow),
        ...(i > 3 ? { visibility: "not_on_site" } : {}),
      },
      translation: Object.fromEntries(
        locales.map((locale) => [
          locale,
          locale === "en" ? "published" : "not_started",
        ]),
      ),
    });
  }
  return seed;
}
module.exports = { applyManagerImprovements, labels };
