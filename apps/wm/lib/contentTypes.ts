// The content types the Website Manager edits, and how each one is laid out: its area in the
// navigation, the editor's sections (each a schema node, labelled from messages Editor.tabs.*),
// the language-neutral fields it has, and where it lives on the website. Everything a type shows
// comes from the website at the D-031 baseline (d76ee3b); see local-dev/apps/wm/seed/build.mjs.
import type { EntryContent, EntryType, LayoutSection } from "@/store/api";
import { BLOCKS, BRIEF, type Department, type Node } from "./caseStudySchema";
import { cmsLabelKey, cmsNodeLabels } from "./cmsLabels";
import managerPages from "@/lib/manager-pages.json";
import sectionMap from "@/lib/cms-sections.json";

export type Area =
  | "pages"
  | "global"
  | "strings"
  | "work"
  | "services"
  | "software"
  | "insights"
  | "legal"
  | "roadmap"
  | "reviews"
  | "pricing";
/**
 * `path` is where the section's value sits in one language's tree; "" is the whole tree. The
 * section's name is `label` (the page's own heading), else messages Fields[labelKey], else
 * Editor.tabs[value].
 */
export type EditorSection = {
  value: string;
  node: Node;
  path: string;
  label?: string;
  labelKey?: string;
};
/** What a type's sections are built from: the entry's department, or its layout. */
export type SectionSource = {
  id?: string;
  department?: Department;
  content?: Pick<EntryContent, "layout" | "locales">;
};
export type NeutralField =
  | "icon"
  | "category"
  | "publishedOn"
  | "readingMinutes"
  | "status"
  | "period"
  | "year"
  | "progress"
  | "versionLabel"
  | "effectiveFrom"
  | "priceMode";

export type ContentType = {
  key: EntryType;
  area: Area;
  idPrefix: string;
  sections: (entry: SectionSource) => EditorSection[];
  /** Language-neutral fields, set in English and shared by every language. */
  neutral: NeutralField[];
  /** Has a main image (alt text per language). */
  image: boolean;
  /** Carries figures that stay labelled as samples until confirmed (D-032). */
  figures: boolean;
  /** The address on the website. Services sit under their family's address. */
  path: (slug: string, familySlug?: string) => string;
  /** Has its own search metadata (Global doesn't: it's part of every page). */
  seo: boolean;
  /** The address is set by the page template, not edited here. */
  fixedAddress?: boolean;
};

// A page's copy slot → the field that edits it. Its label says what kind of text it is; its hint
// where a link goes or which heading level it is.
const SLOT_LABEL: Record<string, string> = {
  heading: "slotHeading",
  paragraph: "slotParagraph",
  link: "slotLink",
  button: "slotButton",
  listItem: "slotListItem",
  formLabel: "slotFormLabel",
  caption: "slotCaption",
  quote: "slotQuote",
  option: "slotOption",
  term: "slotTerm",
  definition: "slotDefinition",
  imageAlt: "slotImageAlt",
  ariaLabel: "slotAriaLabel",
  placeholder: "slotPlaceholder",
  tooltip: "slotTooltip",
  message: "slotMessage",
};
function layoutSections(e: SectionSource): EditorSection[] {
  const en = (e.content?.locales?.en ?? {}) as Record<
    string,
    Record<string, unknown>
  >;
  const manager = (managerPages as Record<string, { editor: string[]; labels?: Record<string,string>; fields?: Record<string, {label:string}>; headerOnly?: string[] }>)[e.id ?? ""];
  const sections = (e.content?.layout ?? []).map((sec: LayoutSection): EditorSection => {
    if (sec.kind === "data")
      return {
        value: sec.key,
        path: sec.key,
        labelKey: sec.label ? cmsLabelKey(sec.label) : undefined,
        node: cmsNodeLabels(sec.node),
      };
    const fields = Object.fromEntries(
      sec.slots.filter(slot => !manager?.headerOnly?.includes(sec.key) || ["div", "h1", "h2", "p"].includes(slot.key)).map((slot) => [
        slot.key,
        {
          kind: "rich",
          fixedValues: slot.fixedValues,
          label: slot.kind === "heading" ? "header" : slot.kind === "paragraph" ? "subheading" : slot.key === "div" ? "description" : SLOT_LABEL[slot.kind] ?? "slotText",
          long: String(en[sec.key]?.[slot.key] ?? "").length > 60,
          hint: slot.href
            ? { key: "link", values: { href: slot.href } }
            : slot.level
              ? { key: "heading", values: { level: slot.level } }
              : slot.context
                ? { key: "usedIn", values: { where: slot.context } }
                : undefined,
        } as Node,
      ]),
    );
    return {
      value: sec.key,
      path: sec.key,
      ...(sec.label && cmsLabelKey(sec.label) !== sec.label
        ? { labelKey: cmsLabelKey(sec.label) }
        : { label: sec.label ?? undefined }),
      node: { kind: "group", fields },
    };
  });
  const mapping = (sectionMap as Record<string, { groups?: Record<string, string[]> }>)[e.id ?? ""];
  const visible = manager ? sections.filter(section => manager.editor.includes(section.value)) : sections;
  if (!mapping?.groups && !manager) return sections;
  const groups = mapping?.groups ?? {};
  const grouped = new Set(Object.values(groups).flatMap(keys => keys.slice(1)));
  const result: EditorSection[] = visible.filter(section => !grouped.has(section.value)).map(section => {
    const groupKeys = groups[section.value];
    return !groupKeys ? section : { ...section, path: "", node: { kind: "group", fields: Object.fromEntries(groupKeys.flatMap(key => { const child = sections.find(item => item.value === key); return child ? [[key, child.node]] : []; })) } };
  });
  if (!manager) return result;
  return manager.editor.flatMap<EditorSection>(key => {
    const custom = manager.fields?.[key];
    const section = result.find(item => item.value === key);
    return custom ? [{value:key,path:"",label:custom.label,node:{kind:"group" as const,fields:{}}}] : section ? [{...section,label:manager.labels?.[key] ?? section.label}] : [];
  });
}

const text = (label: string): Node => ({ kind: "text", label });
const long = (label: string): Node => ({ kind: "longtext", label });
const tags = (label: string): Node => ({ kind: "tags", label });
const group = (fields: Record<string, Node>): Node => ({
  kind: "group",
  fields,
});
const titled = (label: string, itemLabel: string): Node => ({
  kind: "list",
  label,
  itemLabel,
  item: group({ title: text("title"), body: long("body") }),
});

export const TYPES: Record<EntryType, ContentType> = {
  review: {
    key: "review", area: "reviews", idPrefix: "rv", neutral: [], image: true, figures: false, path: () => "", seo: false,
    sections: () => [{ value: "details", path: "", node: group({ name: text("reviewAuthor"), role: text("reviewRole"), company: text("reviewCompany"), quote: long("reviewQuote") }) }],
  },
  page: {
    key: "page",
    area: "pages",
    idPrefix: "pg",
    sections: layoutSections,
    neutral: [],
    image: false,
    figures: false,
    path: (slug) => slug,
    seo: true,
    fixedAddress: true,
  },
  global: {
    key: "global",
    area: "global",
    idPrefix: "gl",
    sections: layoutSections,
    neutral: [],
    image: false,
    figures: false,
    path: () => "",
    seo: false,
  },
  pricing: {
    key: "pricing",
    area: "pricing",
    idPrefix: "pr",
    sections: layoutSections,
    neutral: ["priceMode"],
    image: false,
    figures: false,
    path: () => "",
    seo: false,
  },
  strings: {
    key: "strings",
    area: "strings",
    idPrefix: "st",
    sections: layoutSections,
    neutral: [],
    image: false,
    figures: false,
    path: () => "",
    seo: false,
  },
  legalDocument: {
    key: "legalDocument",
    area: "legal",
    idPrefix: "lg",
    sections: () => [
      {
        value: "details",
        node: group({ name: text("title"), summary: long("summary") }),
        path: "",
      },
      {
        value: "sections",
        labelKey: "sections",
        node: {
          kind: "list",
          label: "sections",
          itemLabel: "articleSection",
          item: group({ heading: text("heading"), body: long("body") }),
        },
        path: "sections",
      },
    ],
    neutral: ["versionLabel", "effectiveFrom"],
    image: false,
    figures: false,
    // Today the documents open at /legal#/<key>; S3 gives them real addresses.
    path: (slug) => `/legal/${slug}`,
    seo: true,
    fixedAddress: true,
  },
  roadmapItem: {
    key: "roadmapItem",
    area: "roadmap",
    idPrefix: "rm",
    sections: () => [
      {
        value: "details",
        node: group({
          name: text("title"),
          body: long("body"),
          timing: text("timing"),
          theme: text("theme"),
        }),
        path: "",
      },
    ],
    neutral: ["status", "period", "year", "progress"],
    image: false,
    figures: false,
    path: () => "",
    seo: false,
  },
  caseStudy: {
    key: "caseStudy",
    area: "work",
    idPrefix: "cs",
    sections: (e) => {
      const blocks = BLOCKS[e.department ?? "design"];
      return [
        { value: "brief", node: group(BRIEF), path: "" },
        { value: "approach", node: blocks.approach, path: "approach" },
        { value: "delivered", node: blocks.delivered, path: "delivered" },
        { value: "results", node: blocks.results, path: "results" },
      ];
    },
    neutral: [],
    image: true,
    figures: true,
    path: (slug) => `/work/${slug}`,
    seo: true,
  },
  serviceFamily: {
    key: "serviceFamily",
    area: "services",
    idPrefix: "sf",
    sections: () => [
      {
        value: "details",
        node: group({
          name: text("name"),
          short: text("short"),
          kicker: text("kicker"),
          title: text("title"),
          intro: long("intro"),
        }),
        path: "",
      },
    ],
    neutral: ["icon"],
    image: true,
    figures: false,
    path: (slug) => `/services/${slug}`,
    seo: true,
  },
  service: {
    key: "service",
    area: "services",
    idPrefix: "sv",
    sections: () => [
      {
        value: "overview",
        labelKey: "overview",
        node: group({
          name: text("name"),
          outcome: long("outcome"),
          summary: long("summary"),
          capabilities: tags("capabilities"),
        }),
        path: "",
      },
    ],
    neutral: [],
    image: false,
    figures: false,
    path: (slug, family) => `/services/${family ?? "…"}/${slug}`,
    seo: true,
  },
  softwareModule: {
    key: "softwareModule",
    area: "software",
    idPrefix: "sm",
    sections: () => [
      {
        value: "details",
        node: group({
          name: text("name"),
          formal: text("formal"),
          shortLabel: text("shortLabel"),
          category: text("category"),
          title: text("title"),
          short: long("tagline"),
          description: long("description"),
          tasks: tags("tasks"),
        }),
        path: "",
      },
      {
        value: "highlights",
        node: titled("highlights", "highlightItem"),
        path: "highlights",
      },
      {
        value: "useCases",
        node: titled("useCases", "useCase"),
        path: "useCases",
      },
    ],
    neutral: ["icon"],
    image: true,
    figures: false,
    path: (slug) => `/software/${slug}`,
    seo: true,
  },
  article: {
    key: "article",
    area: "insights",
    idPrefix: "ar",
    sections: () => [
      {
        value: "details",
        node: group({
          name: text("title"),
          excerpt: long("excerpt"),
          takeaways: tags("takeaways"),
        }),
        path: "",
      },
      {
        value: "body",
        node: {
          kind: "list",
          label: "sections",
          itemLabel: "articleSection",
          item: group({
            heading: text("heading"),
            paragraphs: {
              kind: "list",
              label: "paragraphs",
              itemLabel: "paragraph",
              item: long("paragraph"),
            },
          }),
        },
        path: "sections",
      },
    ],
    neutral: ["category", "publishedOn", "readingMinutes"],
    image: true,
    figures: false,
    path: (slug) => `/insights/${slug}`,
    seo: true,
  },
};

/** The areas in the navigation, each listing one or more types. */
export const AREAS: Record<Area, EntryType[]> = {
  reviews: ["review"],
  pages: ["page"],
  global: ["global"],
  strings: ["strings"],
  legal: ["legalDocument"],
  roadmap: ["roadmapItem"],
  pricing: ["pricing"],
  work: ["caseStudy"],
  services: ["serviceFamily", "service"],
  software: ["softwareModule"],
  insights: ["article"],
};

export const isArea = (a: string): a is Area => a in AREAS;
export const typeOfId = (id: string): ContentType | undefined =>
  Object.values(TYPES).find((t) =>
    id.startsWith(`${t.idPrefix}_`) || id === `demo_published_${t.key}`,
  );

/** Every label key the schemas use, for the messages parity check. */
export function labelKeys(): string[] {
  const keys = new Set<string>();
  const walk = (n: Node) => {
    if ("label" in n && n.label) keys.add(n.label);
    if (n.kind === "list") (keys.add(n.itemLabel), walk(n.item));
    if (n.kind === "group") Object.values(n.fields).forEach(walk);
    if (n.kind === "pair" || n.kind === "series")
      (keys.add(n.first), keys.add(n.second));
  };
  // Pages and Global take their labels from their layout (the seed checks those).
  for (const t of Object.values(TYPES).filter(
    (x) => x.sections !== layoutSections,
  )) {
    const departments: (Department | undefined)[] =
      t.key === "caseStudy"
        ? [
            "design",
            "development",
            "hosting",
            "digital-marketing",
            "it-support",
          ]
        : [undefined];
    for (const d of departments)
      t.sections({ department: d }).forEach((s) => walk(s.node));
  }
  return [...keys].sort();
}
