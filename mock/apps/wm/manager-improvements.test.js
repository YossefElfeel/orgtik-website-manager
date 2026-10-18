const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const http = require("node:http");
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const { makeStore } = require("./content");
const { makeLibrary } = require("./library");
const { permissionsFor } = require("./permissions");
const wm = require("../wm");
const now = () => "2026-10-08T12:00:00.000Z",
  editor = { key: "editor" },
  approver = { key: "approver" },
  all = { can: () => true };

test("Published examples survive suggestion drafts and persisted version-one fixtures without altering existing content", () => {
  const store = makeStore(now, { demo: true });
  require("./suggestions").applySuggestions({ store, media: new Map(), now });
  store.ensureDemo();
  for (const type of [
    "serviceFamily",
    "softwareModule",
    "caseStudy",
    "article",
  ])
    assert.ok(
      [...store.entries.values()].some(
        (entry) =>
          entry.type === type && store.summary(entry).state === "published",
      ),
      type,
    );
  const published = [...store.entries.values()].filter(
    (entry) => entry.demoPublished,
  );
  assert.ok(published.length > 0);
  assert.ok(
    published.every((entry) => entry.workflow.visibility === "archived"),
  );
  const before = store.exportState();
  store.ensureDemo();
  assert.deepEqual(store.exportState(), before);
  const legacy = structuredClone(before);
  legacy.demoVersion = 1;
  legacy.entries = legacy.entries.filter(([, entry]) => !entry.demoPublished);
  const existing = structuredClone(legacy.entries);
  const restored = makeStore(now, { demo: true });
  restored.importState(legacy);
  for (const [id, entry] of existing)
    assert.deepEqual(restored.entries.get(id), entry);
  assert.ok(
    [...restored.entries.values()].some((entry) => entry.demoPublished),
  );
});

test("translation-status examples open actual draft content without resetting saved translations or the live website", () => {
  const store = makeStore(now, { demo: true });
  store.ensureDemo();
  for (const entry of store.entries.values())
    for (const [locale, state] of Object.entries(entry.translation)) {
      if (
        entry.demoTranslations &&
        ["needs_review", "outdated", "in_progress"].includes(state)
      )
        assert.ok(entry.draft.locales[locale]);
    }
  const snapshot = store.exportState();
  snapshot.demoVersion = 1;
  const sample = snapshot.entries.find(
    ([, entry]) => entry.demoTranslations,
  )[1];
  const locale = Object.keys(sample.translation).find(
    (key) =>
      key !== "en" &&
      ["needs_review", "outdated", "in_progress"].includes(
        sample.translation[key],
      ),
  );
  delete sample.draft.locales[locale];
  const live = structuredClone(sample.live);
  const edited = snapshot.entries.find(
    ([, entry]) => entry.demoTranslations && entry !== sample,
  )[1];
  edited.versions[0].note = "A saved user revision";
  const before = structuredClone(edited);
  const restored = makeStore(now, { demo: true });
  restored.importState(snapshot);
  assert.deepEqual(
    restored.entries.get(sample.id).draft.locales[locale],
    sample.draft.locales.en,
  );
  assert.deepEqual(restored.entries.get(sample.id).live, live);
  assert.deepEqual(restored.entries.get(edited.id), before);
});

test("review details expose the actual draft author independently of the transition actor", () => {
  const store = makeStore(now, { demo: true }); store.ensureDemo();
  const sample = [...store.entries.values()].find(entry => entry.draft && entry.workflow.state === "in_review");
  assert.equal(store.detail(sample).lastEditor, "admin");
  assert.equal(store.transition(sample, { key: "admin" }, "approve", all).code, "four_eyes");
  assert.ok(store.transition(sample, { key: "manager" }, "approve", all).entry);
  assert.equal(store.detail(sample).lastEditor, "admin");
});

test("demo revisions cover workflow states without changing published content or overwriting saved edits", () => {
  const store = makeStore(now, { demo: true });
  const published = [...store.entries.values()].map((entry) => [
    entry.id,
    structuredClone(entry.live),
  ]);
  store.ensureDemo();
  for (const type of [
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
  ]) {
    const states = new Set(
      [...store.entries.values()]
        .filter((entry) => entry.type === type)
        .map((entry) => store.summary(entry).state),
    );
    for (const state of [
      "published",
      "draft",
      "in_review",
      "approved",
      "scheduled",
    ])
      assert.ok(states.has(state), `${type}: ${state}`);
  }
  assert.deepEqual(
    [...store.entries.values()].map((entry) => [entry.id, entry.live]),
    published,
  );
  const entry = store.entries.get("pg_home");
  assert.ok(
    store.save(
      entry,
      editor,
      { locale: "en", seo: { title: "Preserve the saved title" } },
      all,
    ).entry,
  );
  const saved = store.exportState();
  store.importState(saved);
  store.ensureDemo();
  assert.deepEqual(store.exportState(), saved);
  assert.equal(store.entries.get("pg_faq").live.slug.en, "/faq");
  assert.equal(
    [...store.entries.values()].filter(
      (entry) =>
        entry.type === "review" && entry.workflow.visibility === "live",
    ).length,
    3,
  );
});

test("section order, cursor and attachment metadata remain draft-only until approved and published", () => {
  const store = makeStore(now),
    entry = store.entries.get("pg_home");
  const before = structuredClone(entry.live);
  const presentation = {
    sectionOrder: ["reviews", "hero"],
    sectionMedia: {
      hero: [
        {
          src: "https://media.example.test/header.webp",
          alt: { en: "Team at work" },
          focal: { x: 25, y: 70 },
        },
      ],
    },
    cursor: { text: { en: "Explore project" }, link: "/work" },
  };
  assert.ok(store.save(entry, editor, { presentation }, all).entry);
  assert.deepEqual(entry.live, before);
  assert.ok(store.transition(entry, editor, "submit", all).entry);
  assert.equal(
    store.transition(entry, editor, "approve", all).code,
    "four_eyes",
  );
  assert.ok(store.transition(entry, approver, "approve", all).entry);
  assert.ok(store.transition(entry, approver, "publish", all).entry);
  assert.deepEqual(entry.live.presentation, presentation);
  assert.equal(
    store.save(
      entry,
      editor,
      { presentation: { ...presentation, sectionOrder: ["footer"] } },
      all,
    ).errors.presentation,
    "invalid",
  );
  assert.equal(
    store.save(
      entry,
      editor,
      {
        presentation: {
          ...presentation,
          cursor: { text: {}, link: "javascript:alert(1)" },
        },
      },
      all,
    ).errors.presentation,
    "invalid",
  );
});

async function fixture(t) {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "orgtik-manager-test-"));
  let role = "wm_admin",
    key = "editor";
  const actor = () => ({
    id: 1,
    key,
    firstName: "Test",
    lastName: "Editor",
    isActive: true,
  });
  const identity = {
    userFromReq: () => actor(),
    userScopes: () => [{ scope: "website_manager", roles: [role] }],
    fullName: (user) => `${user.firstName} ${user.lastName}`,
    publicUser: (user) => user,
    findByKey: () => actor(),
    findUser: () => actor(),
    users: [actor()],
  };
  const app = express();
  app.use(express.json());
  const hooks = wm.routes(app, {
    identity,
    realm: "manager-test",
    uploadsDir: folder,
    config: { apiUrl: () => "http://localhost" },
    apiUrl: () => "http://localhost",
    webUrl: () => "http://localhost",
    log() {},
  });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
    const resolved = fs.realpathSync(folder);
    assert.ok(
      resolved.startsWith(fs.realpathSync(os.tmpdir()) + path.sep) &&
        path.basename(resolved).startsWith("orgtik-manager-test-"),
    );
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return {
    hooks,
    base,
    as(nextRole, nextKey = "editor") {
      role = nextRole;
      key = nextKey;
    },
    async call(route, method = "GET", body, version) {
      const res = await fetch(base + "/v2" + route, {
        method,
        headers: {
          connection: "close",
          ...(body ? { "content-type": "application/json" } : {}),
          ...(version != null ? { "if-match": String(version) } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const raw = await res.text();
      return { status: res.status, ...(raw ? JSON.parse(raw) : {}) };
    },
  };
}

test("list APIs paginate 0/1/10/11/101 rows after combined search, workflow, timeline and language filters", async (t) => {
  const f = await fixture(t),
    snapshot = f.hooks.exportState();
  const template = structuredClone(
    snapshot.data.content.entries.find(([id]) => id === "rm_01")[1],
  );
  snapshot.data.content.entries = snapshot.data.content.entries.filter(
    ([, row]) => row.type !== "roadmapItem",
  );
  for (let n = 0; n < 101; n++) {
    const row = structuredClone(template);
    row.id = `rm_fixture_${n}`;
    row.draft = structuredClone(row.live);
    row.draft.locales.en.name = `Search fixture ${String(n).padStart(3, "0")}`;
    row.draft.period = "next";
    row.draft.year = "2030";
    row.workflow.state = "draft";
    snapshot.data.content.entries.push([row.id, row]);
  }
  f.hooks.importState(snapshot);
  for (const [search, total] of [
    ["absent", 0],
    ["fixture 100", 1],
    ["fixture 00", 10],
    ["fixture 01", 10],
    ["fixture", 101],
  ]) {
    const result = await f.call(
      `/admin/entries/roadmapItem?search=${encodeURIComponent(search)}&state=draft&period=next&year=2030&sort=name&direction=asc`,
    );
    assert.equal(result.status, 200);
    assert.equal(result.meta.total, total);
    assert.equal(result.data.length, Math.min(10, total));
    assert.equal(result.meta.pageSize, 10);
  }
  const last = await f.call(
    "/admin/entries/roadmapItem?search=fixture&page=11&sort=name&direction=asc",
  );
  assert.equal(last.data.length, 1);
  assert.equal(last.data[0].name, "Search fixture 100");
  const eleven = structuredClone(snapshot);
  eleven.data.content.entries = eleven.data.content.entries.filter(
    ([, row]) =>
      row.type !== "roadmapItem" || Number(row.id.split("_").pop()) < 11,
  );
  f.hooks.importState(eleven);
  assert.equal(
    (await f.call("/admin/entries/roadmapItem?page=2")).data.length,
    1,
  );
  const pages = await f.call(
    "/admin/entries/page?missingLanguages=true&pageSize=100",
  );
  assert.ok(
    pages.data.every((row) =>
      ["en", "ar", "de", "fr", "it"].some(
        (locale) => !["ready", "published"].includes(row.translation[locale]),
      ),
    ),
  );
});

test("roadmap creation survives state reload and leads' New and Opened sets are disjoint", async (t) => {
  const f = await fixture(t);
  const created = await f.call("/admin/entries/roadmapItem", "POST", {
    name: "Refresh-proof roadmap",
  });
  assert.equal(created.status, 201);
  f.hooks.importState(f.hooks.exportState());
  assert.equal(
    (await f.call(`/admin/entries/roadmapItem/${created.data.id}`)).data.name,
    "Refresh-proof roadmap",
  );
  const fresh = await f.call("/admin/leads?status=new"),
    opened = await f.call("/admin/leads?status=open");
  assert.ok(fresh.data.length);
  assert.ok(opened.data.length);
  assert.ok(fresh.data.every((row) => row.status === "new"));
  assert.ok(
    opened.data.every(
      (row) =>
        ["contacted", "qualified", "quoted"].includes(row.status) &&
        !fresh.data.some((item) => item.id === row.id),
    ),
  );
  for (const status of [
    "new",
    "contacted",
    "qualified",
    "quoted",
    "won",
    "lost",
    "unqualified",
    "spam",
    "duplicate",
  ])
    assert.ok(
      (await f.call(`/admin/leads?status=${status}`)).meta.total > 0,
      status,
    );
});

test("idea edits check versions and hiding removes a public idea but retains details and history", async (t) => {
  const f = await fixture(t),
    rows = await f.call("/admin/ideas?status=open");
  const idea = rows.data[0];
  assert.ok(idea);
  assert.equal(
    (
      await f.call(
        `/admin/ideas/${idea.id}`,
        "PATCH",
        { title: "Updated idea" },
        idea.version - 1,
      )
    ).status,
    412,
  );
  const edited = await f.call(
    `/admin/ideas/${idea.id}`,
    "PATCH",
    { title: "Updated idea" },
    idea.version,
  );
  assert.equal(edited.status, 200);
  const hidden = await f.call(
    `/admin/ideas/${idea.id}/moderate`,
    "POST",
    { action: "hide", reason: "Testing visibility" },
    edited.data.version,
  );
  assert.equal(hidden.status, 200);
  assert.equal(
    (await f.call("/public/ideas")).data.some((row) => row.id === idea.id),
    false,
  );
  const detail = await f.call(`/admin/ideas/${idea.id}`);
  assert.equal(detail.data.status, "hidden");
  assert.ok(detail.data.history.some((event) => event.action === "edit"));
});

test("SEO-only edits preserve content permissions; redirects and indexing include both policies", async (t) => {
  const f = await fixture(t);
  f.as("wm_seo");
  const page = await f.call("/admin/entries/page/pg_home");
  assert.equal(
    (
      await f.call(
        "/admin/entries/page/pg_home",
        "PATCH",
        { locale: "en", fields: { name: "Forbidden change" } },
        page.data.version,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await f.call(
        "/admin/entries/page/pg_home",
        "PATCH",
        { locale: "en", seo: { title: "SEO-only title" } },
        page.data.version,
      )
    ).status,
    200,
  );
  const temporary = await f.call("/admin/seo/redirects?kind=302");
  assert.ok(temporary.data.length);
  assert.ok(
    temporary.data.every((row) => row.code === 302 && row.history.length),
  );
  const permanent = await f.call("/admin/seo/redirects?kind=301");
  assert.ok(permanent.data.every((row) => row.code === 301));
  assert.equal((await f.call("/admin/users")).status, 403);
  const store = makeStore(now),
    library = makeLibrary({ store, seed: store.seed, now, uploads: "unused" });
  store.entries.get("pg_home").live.seo.en.robots = "index";
  const signIn = library.indexingUrls().find((row) => row.id === "pg_signIn");
  assert.ok(signIn);
  assert.equal(signIn.inSitemap, false);
  assert.equal(signIn.policy, "noindex");
  library.setVisibility(approver, "index", "Test public policy");
  assert.equal(
    library.indexingUrls().find((row) => row.id === "pg_home").policy,
    "index",
  );
  library.setVisibility(approver, "noindex", "Test site override");
  assert.ok(
    library
      .indexingUrls()
      .every(
        (row) => row.policy === "noindex" && row.reason === "siteOverride",
      ),
  );
  assert.ok(library.robots().includes("Allow: /"));
  library.settings.publicLocales = ["en", "ar", "de"];
  store.entries.get("pg_home").live.seo.ar = {
    robots: "noindex",
    inSitemap: false,
  };
  const localized = library.indexingUrls();
  const sitemap = new Set(library.sitemap().map((row) => row.loc));
  assert.ok(
    localized.some(
      (row) => row.id === "pg_home" && row.locale === "ar" && !row.inSitemap,
    ),
  );
  assert.ok(
    localized.some(
      (row) => row.id === "pg_home" && row.locale === "de" && row.inSitemap,
    ),
  );
  assert.ok(localized.every((row) => row.inSitemap === sitemap.has(row.loc)));
});

test("media uploads retain descriptions, tags, alt text and focal points through persistence", async (t) => {
  const f = await fixture(t),
    form = new FormData();
  form.set(
    "file",
    new Blob(
      ["<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'/>"],
      { type: "image/svg+xml" },
    ),
    "fixture.svg",
  );
  form.set("description", "Demo image");
  form.set("tags", JSON.stringify(["demo", "demo", "website"]));
  const response = await fetch(f.base + "/v2/admin/media", {
    method: "POST",
    body: form,
  });
  assert.equal(response.status, 201);
  const { data: media } = await response.json();
  assert.deepEqual(media.tags, ["demo", "website"]);
  const edited = await f.call(
    `/admin/media/${media.id}`,
    "PATCH",
    { alt: { en: "Demo diagram" }, focal: { x: 25, y: 75 } },
    media.version,
  );
  assert.equal(edited.status, 200);
  f.hooks.importState(f.hooks.exportState());
  const detail = await f.call(`/admin/media/${media.id}`);
  assert.equal(detail.data.description, "Demo image");
  assert.equal(detail.data.alt.en, "Demo diagram");
  assert.deepEqual(detail.data.focal, { x: 25, y: 75 });
  assert.equal((await fetch(f.base + detail.data.url)).status, 200);
});

test("newer manager page draft saves survive rollback with permission, atomicity and published content intact", async (t) => {
  const f = await fixture(t);
  const before = f.hooks.exportState();
  const original = before.data.content.entries.find(([id]) => id === "pg_about")[1];
  const command = {id: original.id, version: original.workflow.version, patches: [{locale: "en", fields: {hero: {...original.live.locales.en.hero, button1Href: "/contact"}}}]};
  f.as("wm_viewer");
  assert.equal((await f.call("/admin/studio/page-draft/pg_about", "POST", {commands: [command]})).status, 403);
  assert.deepEqual(f.hooks.exportState(), before);
  f.as("wm_admin");
  const saved = await f.call("/admin/studio/page-draft/pg_about", "POST", {commands: [command]});
  assert.equal(saved.status, 200);
  assert.ok(saved.data.version > original.workflow.version);
  const after = f.hooks.exportState();
  const changed = after.data.content.entries.find(([id]) => id === "pg_about")[1];
  assert.equal(changed.draft.locales.en.hero.button1Href, "/contact");
  assert.deepEqual(after.data.content.entries.map(([id, entry]) => [id, entry.live]), before.data.content.entries.map(([id, entry]) => [id, entry.live]));
  assert.equal((await f.call("/admin/studio/page-draft/pg_about", "POST", {commands: [command]})).status, 412);
  assert.deepEqual(f.hooks.exportState(), after);
});
