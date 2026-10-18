const { test } = require("node:test");
const assert = require("node:assert/strict");
const { makeStore } = require("./content");
const body = require("./article-body");
const now = () => "2026-10-11T12:00:00.000Z";
const editor = { key: "editor" },
  approver = { key: "approver" },
  all = { can: () => true };

test("article images and videos can sit between paragraphs; ordering survives publish and reload", () => {
  const store = makeStore(now),
    entry = store.entries.get("ar_02");
  const published = structuredClone(entry.live);
  const sections = body.normalize(entry.live.locales.en.sections);
  sections[0].blocks.splice(
    1,
    0,
    {
      id: "inserted-image",
      kind: "image",
      src: "brand-cards.webp",
      alt: "An example",
      caption: "Image inside the article",
    },
    {
      id: "inserted-video",
      kind: "video",
      src: "cinematic-desktop.mp4",
      alt: "Cinematic video",
      caption: "Video inside the article",
    },
  );
  sections.push({
    id: "extra-section",
    heading: "Extra section",
    blocks: [{ id: "extra-text", kind: "text", text: "More article content" }],
  });
  sections.reverse();
  assert.ok(
    store.save(entry, editor, { locale: "en", fields: { sections } }, all)
      .entry,
  );
  assert.deepEqual(entry.live, published);
  assert.ok(store.transition(entry, editor, "submit", all).entry);
  assert.ok(store.transition(entry, approver, "approve", all).entry);
  assert.ok(store.transition(entry, approver, "publish", all).entry);
  assert.deepEqual(entry.live.locales.en.sections, sections);
  const restored = makeStore(now);
  restored.importState(store.exportState());
  assert.deepEqual(
    restored.entries.get("ar_02").live.locales.en.sections,
    sections,
  );
});

test("moving English sections and paragraphs preserves translated words by stable ID", () => {
  const store = makeStore(now),
    entry = store.entries.get("ar_02");
  entry.live.locales.ar = structuredClone(entry.live.locales.en);
  entry.live.locales.ar.sections.forEach((section) => {
    section.heading = `عنوان ${section.heading}`;
    section.paragraphs = section.paragraphs.map((text) => `ترجمة ${text}`);
  });
  entry.translation.ar = "published";
  const translated = structuredClone(entry.live.locales.ar.sections);
  const sections = body.normalize(entry.live.locales.en.sections);
  sections.reverse();
  sections[0].blocks.reverse();
  assert.ok(
    store.save(entry, editor, { locale: "en", fields: { sections } }, all)
      .entry,
  );
  const expected = body.normalize(translated).reverse();
  expected[0].blocks.reverse();
  assert.deepEqual(entry.draft.locales.ar.sections, expected);
  assert.equal(entry.translation.ar, "outdated");
});

test("translations can edit captions and text while structure and media stay shared", () => {
  const store = makeStore(now),
    entry = store.entries.get("ar_02");
  entry.live.locales.fr = structuredClone(entry.live.locales.en);
  const sections = body.normalize(entry.live.locales.en.sections);
  sections[0].blocks.push({
    id: "new-image",
    kind: "image",
    src: "brand-phone.webp",
    alt: "Phone",
    caption: "English caption",
  });
  store.save(entry, editor, { locale: "en", fields: { sections } }, all);
  const french = structuredClone(entry.draft.locales.fr.sections);
  french[0].blocks.at(-1).caption = "Légende en français";
  assert.ok(
    store.save(
      entry,
      editor,
      { locale: "fr", fields: { sections: french } },
      all,
    ).entry,
  );
  french[0].blocks.at(-1).src = "brand-tablet.webp";
  assert.equal(
    store.save(
      entry,
      editor,
      { locale: "fr", fields: { sections: french } },
      all,
    ).errors["locales.fr.sections"],
    "structure_locked",
  );
  french[0].blocks.reverse();
  assert.ok(
    store.save(
      entry,
      editor,
      { locale: "fr", fields: { sections: french } },
      all,
    ).errors,
  );
});

test("malformed article blocks are rejected atomically; empty media can be drafted but not published", () => {
  const store = makeStore(now),
    entry = store.entries.get("ar_02");
  const before = structuredClone(store.detail(entry));
  for (const sections of [
    null,
    [
      {
        id: "x",
        heading: "Heading",
        blocks: [{ id: "x", kind: "image", src: "javascript:alert(1)" }],
      },
    ],
    [{ id: "x", heading: "Heading", blocks: [{ id: "x", kind: "other" }] }],
    [
      {
        id: "x",
        heading: "Heading",
        blocks: [
          { id: "same", kind: "text", text: "One" },
          { id: "same", kind: "text", text: "Two" },
        ],
      },
    ],
  ]) {
    assert.equal(body.validate(sections), "invalid");
    assert.ok(
      store.save(entry, editor, { locale: "en", fields: { sections } }, all)
        .errors,
    );
    assert.deepEqual(store.detail(entry), before);
  }
  const sections = [
    {
      id: "x",
      heading: "Heading",
      blocks: [{ id: "image", kind: "image", src: "", alt: "", caption: "" }],
    },
  ];
  assert.ok(
    store.save(entry, editor, { locale: "en", fields: { sections } }, all)
      .entry,
  );
  store.transition(entry, editor, "submit", all);
  assert.equal(
    store.transition(entry, approver, "approve", all).fieldErrors[
      "locales.en.sections"
    ],
    "invalid",
  );
});

test("legacy article paragraphs remain unchanged until an editor edits the body", () => {
  const store = makeStore(now),
    entry = store.entries.get("ar_02");
  const sections = structuredClone(entry.live.locales.en.sections);
  store.save(
    entry,
    editor,
    { locale: "en", fields: { excerpt: "Updated excerpt only" } },
    all,
  );
  assert.deepEqual(entry.draft.locales.en.sections, sections);
});
