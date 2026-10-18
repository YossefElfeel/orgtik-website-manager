// Repeatable examples. Published content is retained; existing user revisions always win.
const clone = (value) => JSON.parse(JSON.stringify(value));
const TYPES = [
  "page",
  "global",
  "strings",
  "serviceFamily",
  "service",
  "softwareModule",
  "caseStudy",
  "article",
  "roadmapItem",
  "review",
];
function publishedExamples({ entries, audit, now }) {
  for (const type of TYPES) {
    const rows = [...entries.values()].filter((entry) => entry.type === type);
    if (!rows.length || rows.some((entry) => !entry.draft)) continue;
    const id = `demo_published_${type}`;
    if (entries.has(id)) continue;
    const source = rows.find((entry) => entry.live);
    if (!source) continue;
    const labels = {
      page: "page",
      global: "global content",
      strings: "strings",
      serviceFamily: "service family",
      service: "service",
      softwareModule: "software",
      caseStudy: "case study",
      article: "article",
      roadmapItem: "roadmap item",
      review: "review",
    };
    const at = now(),
      content = clone(source.live),
      name = `Sample published ${labels[type]}`;
    content.name = name;
    content.locales.en.name = name;
    if (content.slug?.en)
      content.slug.en =
        type === "page"
          ? `/sample-published-${type}`
          : `sample-published-${type.toLowerCase()}`;
    const entry = {
      ...clone(source),
      id,
      live: content,
      draft: null,
      demoState: true,
      demoPublished: true,
      order: Math.max(...rows.map((entry) => entry.order)) + 1,
      workflow: {
        state: "published",
        visibility: "archived",
        version: 1,
        updatedAt: at,
        updatedBy: "admin",
        publishedAt: at,
        lastEditor: null,
      },
      versions: [
        {
          version: 1,
          state: "published",
          at,
          by: "admin",
          note: "Sample published record, kept off the website. Existing published content and pending revisions are unchanged.",
          content: clone(content),
        },
      ],
      translators: {},
    };
    entries.set(id, entry);
    audit.unshift({
      at,
      by: "admin",
      action: "sample_revision",
      entry: id,
      type,
      version: 1,
      targetName: name,
      sample: true,
    });
  }
}
function populateTranslationExamples(entries) {
  for (const entry of entries.values()) {
    if (
      !entry.demoState ||
      entry.demoPublished ||
      !entry.draft ||
      !entry.versions[0]?.note?.startsWith("Sample ")
    )
      continue;
    for (const [locale, state] of Object.entries(entry.translation)) {
      if (
        locale === "en" ||
        !["needs_review", "outdated", "in_progress"].includes(state) ||
        entry.draft.locales[locale]
      )
        continue;
      entry.draft.locales[locale] = clone(entry.draft.locales.en);
      entry.versions[0].content = clone(entry.draft);
    }
  }
}
function contentExamples({ entries, audit, ideas, now }) {
  const at = now();
  for (const type of TYPES) {
    const rows = [...entries.values()].filter((entry) => entry.type === type);
    const candidates = rows.filter(
      (entry) =>
        (entry.workflow.version === 1 && !entry.draft) ||
        (entry.workflow.lastEditor === "assistant" &&
          entry.workflow.version === 2),
    );
    const reserved = rows.find((entry) => !entry.draft);
    for (const state of ["draft", "in_review", "approved", "scheduled"]) {
      if (rows.some((entry) => entry.draft && entry.workflow.state === state))
        continue;
      const entry = candidates.find(
        (entry) => entry !== reserved && !entry.demoState,
      );
      if (!entry) continue;
      entry.draft = clone(entry.draft ?? entry.live);
      entry.demoState = true;
      entry.workflow = {
        ...entry.workflow,
        state,
        version: entry.workflow.version + 1,
        lastEditor: "admin",
        updatedBy: state === "draft" ? "admin" : "manager",
        updatedAt: at,
        ...(state === "scheduled"
          ? {
              publishAt: new Date(
                Date.parse(at) + 365 * 86400000,
              ).toISOString(),
            }
          : {}),
      };
      entry.versions.unshift({
        version: entry.workflow.version,
        state,
        at,
        by: entry.workflow.updatedBy,
        note: `Sample ${state.replaceAll("_", " ")} revision; existing published content is unchanged.`,
        content: clone(entry.draft),
      });
      audit.unshift({
        at,
        by: entry.workflow.updatedBy,
        action: "sample_revision",
        entry: entry.id,
        type,
        version: entry.workflow.version,
        targetName:
          entry.live?.name ?? entry.live?.locales.en?.name ?? entry.id,
        sample: true,
      });
    }
  }
  publishedExamples({ entries, audit, now });
  for(const [type,action,entry] of [["page","save","pg_home"],["page","submit","pg_home"],["page","approve","pg_home"],["page","publish","pg_home"],["page","request_changes","pg_home"],["page","discard","pg_home"],["page","schedule","pg_home"],["page","unschedule","pg_home"],["page","restore","pg_home"],["page","approve_figures","pg_home"],["page","translation_submit","pg_home"],["page","translation_approve","pg_home"],["page","translation_reopen","pg_home"],["media","media_delete","md_01"],["redirect","redirect_update","rd_demo_manager"],["lead","leads_export","ld_05"],["lead","lead_note","ld_05"],["lead","lead_contact","ld_05"],["lead","lead_qualify","ld_05"],["lead","lead_unqualify","ld_05"],["lead","lead_quote","ld_05"],["lead","lead_win","ld_05"],["lead","lead_lose","ld_05"],["lead","lead_spam","ld_05"],["lead","lead_duplicate","ld_05"],["lead","lead_reopen","ld_05"],["idea","idea_plan","idea_01"],["idea","idea_start","idea_01"],["idea","idea_ship","idea_01"],["idea","idea_decline","idea_01"],["idea","idea_merge","idea_01"],["user","user_roles","sample_user"],["media","media_upload","md_01"],["media","media_update","md_02"],["redirect","redirect_create","rd_demo_manager"],["redirect","redirect_delete","rd_demo_retired"],["idea","idea_publish","idea_01"],["idea","idea_hide","idea_02"],["lead","lead_assign","ld_05"],["lead","lead_erase","ld_sample_erased"],["settings","site_settings","site"],["settings","search_visibility","site"],["user","user_create","sample_user"],["user","user_update","sample_user"]]) {
    const sampleId="audit_example_"+action;
    if(!audit.some(event=>event.sampleId===sampleId))audit.push({at:now(),by:"admin",type,action,entry,sample:true,sampleId,targetName:"Sample "+type+" activity"});
  }
  // Translation examples only touch untouched seed translations.
  const translations = ["needs_review", "outdated", "in_progress"];
  [...entries.values()]
    .filter((entry) => entry.demoState && !entry.demoPublished)
    .slice(0, 12)
    .forEach((entry, index) => {
      if (entry.demoTranslations) return;
      const locale = ["ar", "de", "fr", "it"][index % 4];
      entry.translation[locale] = translations[index % 3];
      entry.demoTranslations = true;
    });
  populateTranslationExamples(entries);
  const base = [...ideas.values()][0];
  if (base)
    for (const [index, status] of ["declined", "hidden", "merged"].entries()) {
      const id = `idea_demo_${status}`;
      if (ideas.has(id)) continue;
      const row = {
        ...clone(base),
        id,
        title: `Sample ${status} idea`,
        body: "This is a sample moderation record for reviewing closed outcomes.",
        status,
        sample: true,
        votes: 0,
        version: 1,
        createdAt: at,
        history: [
          {
            at,
            by: "manager",
            action:
              status === "declined"
                ? "decline"
                : status === "hidden"
                  ? "hide"
                  : "merge",
            from: "pending",
            to: status,
            reason: "Sample moderation outcome",
          },
        ],
        ...(status === "merged"
          ? { mergedInto: base.id }
          : { reason: "Sample moderation outcome" }),
      };
      ideas.set(id, row);
      audit.unshift({
        at,
        by: "manager",
        action: `idea_${row.history[0].action}`,
        entry: id,
        type: "idea",
        sample: true,
        targetName: row.title,
      });
    }
}
function leadExamples(leads, now) {
  const base = [...leads.values()][0];
  if (!base) return;
  for (const status of [
    "contacted",
    "qualified",
    "quoted",
    "won",
    "unqualified",
    "lost",
    "spam",
    "duplicate",
  ]) {
    const id = `ld_demo_${status}`;
    if (leads.has(id)) continue;
    const at = now();
    const stages = ["new", "contacted", "qualified", "quoted", "won"];
    const passed = stages.includes(status)
      ? stages.slice(0, stages.indexOf(status) + 1)
      : ["new", status];
    leads.set(id, {
      ...clone(base),
      id,
      status,
      name: `Sample ${status} lead`,
      email: `${status}@example.test`,
      sample: true,
      version: 1,
      ...(status === "duplicate" ? { duplicateOf: base.id } : {}),
      reason: "Sample lifecycle outcome",
      history: passed
        .map((to, index) => ({
          at,
          by: index ? "manager" : "visitor",
          action: index
            ? ({
                contacted: "contact",
                qualified: "qualify",
                quoted: "quote",
                won: "win",
                lost: "lose",
                unqualified: "unqualify",
              }[to] ?? to)
            : "submitted",
          from: passed[index - 1],
          to,
        }))
        .reverse(),
    });
  }
}
function redirectExamples(redirects, now) {
  for (const [source, code, suffix] of [
    ["manager", 302, "campaign"],
    ["address_change", 301, "renamed"],
    ["archived", 301, "retired"],
  ]) {
    const id = `rd_demo_${source}`;
    if (!redirects.has(id))
      redirects.set(id, {
        id,
        from: `/sample-${suffix}`,
        to: "/services",
        code,
        source,
        handledBy: "host",
        note: "Sample redirect for demonstrating this kind and origin.",
        createdBy: "manager",
        createdAt: now(),
        version: 1,
        sample: true,
      });
  }
}
module.exports = {
  contentExamples,
  publishedExamples,
  populateTranslationExamples,
  leadExamples,
  redirectExamples,
};
