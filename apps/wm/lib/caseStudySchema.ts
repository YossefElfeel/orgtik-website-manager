// The case study's shape (D-032): one shared brief, then a block set per department, exactly as
// the website draws them (orgtik-website src/reference/case-studies.js at d76ee3b). The editor
// renders from this, and each `label` is a key in messages Fields.*.

export type Department =
  "design" | "development" | "hosting" | "digital-marketing" | "it-support";
export const DEPARTMENTS: Department[] = [
  "design",
  "development",
  "hosting",
  "digital-marketing",
  "it-support",
];

/** A line of help under a field, from messages Editor.hints.* (e.g. where a link goes). */
export type Hint = { key: string; values?: Record<string, string | number> };

export type Node =
  | {
      kind: "text" | "longtext" | "color" | "image" | "icon";
      label: string;
      /** The same in every language (an icon, an image, a link): set in English, locked elsewhere. */
      neutral?: boolean;
      /** Never edited here (an id the website's code refers to). */
      locked?: boolean;
      hint?: Hint;
    }
  // A page's copy: text that may carry marks (<em>…</em>, <m1>…</m1>, <br/>) the site styles.
  | {
      kind: "rich";
      label: string;
      long?: boolean;
      hint?: Hint;
      fixedValues?: string[];
    }
  // unit: how the number reads (a percentage, an amount in the site's currency).
  | {
      kind: "number";
      label: string;
      min?: number;
      max?: number;
      step?: number;
      unit?: "percent" | "currency";
    }
  // A yes/no the website acts on (a package is featured, a plan recurs). Language-neutral.
  | { kind: "toggle"; label: string }
  | { kind: "lines"; label: string }
  | { kind: "tags"; label: string; neutral?: boolean }
  | { kind: "numbers"; label: string }
  | { kind: "group"; label?: string; fields: Record<string, Node> }
  | { kind: "list"; label: string; item: Node; itemLabel: string }
  // A [label, value] tuple, as the site stores chart points, funnels and channel mixes.
  | {
      kind: "pair";
      label: string;
      first: string;
      second: string;
      secondKind: "text" | "number";
    }
  | { kind: "series"; label: string; first: string; second: string };

const text = (label: string): Node => ({ kind: "text", label });
const long = (label: string): Node => ({ kind: "longtext", label });
const num = (
  label: string,
  extra: Partial<{ min: number; max: number; step: number }> = {},
): Node => ({ kind: "number", label, ...extra });
const tags = (label: string): Node => ({ kind: "tags", label });
const list = (
  label: string,
  itemLabel: string,
  fields: Record<string, Node>,
): Node => ({
  kind: "list",
  label,
  itemLabel,
  item: { kind: "group", fields },
});
const section = (fields: Record<string, Node>): Node => ({
  kind: "group",
  fields: {
    title: { kind: "lines", label: "sectionTitle" },
    intro: long("intro"),
    ...fields,
  },
});

/** The brief every case study shares, plus the project record's fields. */
export const BRIEF: Record<string, Node> = {
  name: text("name"),
  category: text("category"),
  sector: text("sector"),
  summary: long("summary"),
  transformation: long("transformation"),
  client: text("client"),
  timeline: text("timeline"),
  team: text("team"),
  challenge: long("challenge"),
  goal: long("goal"),
  role: long("role"),
  highlight: {
    kind: "group",
    label: "highlight",
    fields: { value: text("value"), label: text("label") },
  },
};

const metrics = list("metrics", "metric", {
  value: text("value"),
  label: text("label"),
});
const steps = (extra: Record<string, Node> = {}) =>
  list("steps", "step", {
    ...extra,
    title: text("title"),
    detail: long("detail"),
    outputs: tags("outputs"),
  });

/** How we got there / What we delivered / The results, per department. */
export const BLOCKS: Record<
  Department,
  { approach: Node; delivered: Node; results: Node }
> = {
  design: {
    approach: section({ steps: steps({ when: text("when") }) }),
    delivered: section({
      palette: list("palette", "colour", {
        name: text("name"),
        hex: { kind: "color", label: "hex" },
      }),
      typeface: text("typeface"),
      weights: { kind: "numbers", label: "weights" },
      touchpoints: list("touchpoints", "touchpoint", {
        label: text("label"),
        image: { kind: "image", label: "image" },
      }),
    }),
    results: section({
      metrics,
      shifts: {
        kind: "list",
        label: "shifts",
        itemLabel: "shift",
        item: {
          kind: "pair",
          label: "shift",
          first: "from",
          second: "to",
          secondKind: "text",
        },
      },
    }),
  },
  development: {
    approach: section({
      steps: steps({ when: text("when"), log: text("log") }),
    }),
    delivered: section({
      core: text("core"),
      layers: tags("layers"),
      modules: list("modules", "module", {
        name: text("name"),
        icon: { kind: "icon", label: "icon" },
      }),
      stack: tags("stack"),
    }),
    results: section({
      gauges: list("gauges", "gauge", {
        label: text("label"),
        value: num("value", { min: 0, max: 100 }),
      }),
      metrics,
    }),
  },
  hosting: {
    approach: section({ steps: steps({ when: text("when") }) }),
    delivered: section({
      components: list("components", "component", {
        name: text("name"),
        detail: long("detail"),
        state: text("state"),
      }),
    }),
    results: section({
      chart: {
        kind: "group",
        label: "chart",
        fields: {
          label: text("label"),
          cutover: num("cutover", { min: 0 }),
          points: {
            kind: "series",
            label: "points",
            first: "label",
            second: "value",
          },
        },
      },
      metrics,
    }),
  },
  "digital-marketing": {
    approach: section({
      weeks: num("weeks", { min: 1, max: 52 }),
      steps: steps({
        start: num("start", { min: 1 }),
        end: num("end", { min: 1 }),
      }),
    }),
    delivered: section({
      week: list("week", "day", {
        day: text("day"),
        task: text("task"),
        items: tags("items"),
      }),
    }),
    results: section({
      kpis: list("kpis", "kpi", {
        label: text("label"),
        before: text("before"),
        after: text("after"),
        change: text("change"),
      }),
      monthly: {
        kind: "group",
        label: "monthly",
        fields: {
          label: text("label"),
          baseline: num("baseline"),
          points: {
            kind: "series",
            label: "points",
            first: "label",
            second: "value",
          },
        },
      },
      funnel: {
        kind: "list",
        label: "funnel",
        itemLabel: "stage",
        item: {
          kind: "pair",
          label: "stage",
          first: "label",
          second: "value",
          secondKind: "text",
        },
      },
      channels: {
        kind: "list",
        label: "channels",
        itemLabel: "channel",
        item: {
          kind: "pair",
          label: "channel",
          first: "label",
          second: "value",
          secondKind: "text",
        },
      },
    }),
  },
  "it-support": {
    approach: section({
      steps: steps({
        id: text("ticket"),
        when: text("when"),
        state: text("state"),
      }),
    }),
    delivered: section({
      priorities: list("priorities", "priority", {
        level: text("level"),
        name: text("name"),
        when: text("when"),
        target: text("target"),
      }),
    }),
    results: section({
      comparisons: list("comparisons", "comparison", {
        label: text("label"),
        before: num("before"),
        after: num("after"),
        unit: text("unit"),
      }),
    }),
  },
};
