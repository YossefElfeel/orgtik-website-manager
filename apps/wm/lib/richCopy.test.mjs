import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { copyParts, copyText, replaceCopyText } from "./richCopy.ts";

const heading = "<m1>What could we</m1> <m2>build <m3>together?</m3></m2>";
const marks = value => copyParts(value).filter(part => part.fixed).map(part => part.text);

test("a heading is edited as one sentence while its nested emphasis survives", () => {
  assert.equal(copyText(heading), "What could we build together?");
  assert.equal(replaceCopyText(heading, "What could we make together?"), "<m1>What could we</m1> <m2>make <m3>together?</m3></m2>");
  assert.equal(replaceCopyText(heading, copyText(heading)), heading);
});

test("whole-sentence replacement, insertions, deletions and Unicode keep the exact formatting tokens", () => {
  for (const text of ["How can we help your team grow?", "Imagine what could we build together?", "What could we build together today?", "Together?", "ماذا يمكننا أن نبني معًا؟", "Build something 🌍 together?", ""]) {
    const result = replaceCopyText(heading, text);
    assert.equal(copyText(result), text);
    assert.deepEqual(marks(result), marks(heading));
  }
});

test("clearing and retyping keeps the heading editable", () => {
  const cleared = replaceCopyText(heading, "");
  const next = replaceCopyText(cleared, "A new beginning.");
  assert.equal(copyText(next), "A new beginning.");
  assert.deepEqual(marks(next), marks(heading));
});

test("sequential typing keeps words and emphasis around an edited phrase", () => {
  let value = heading;
  for (const text of ["What could we build together?!", "What could we build together?", "What could we build better together?", "What could we create better together?"]) {
    value = replaceCopyText(value, text);
    assert.equal(copyText(value), text);
    assert.deepEqual(marks(value), marks(heading));
  }
  assert.ok(value.includes("<m3>together?</m3>"));
});

test("line breaks, dynamic slots and large pasted text retain their protected tokens", () => {
  const source = "See the thinking. <br/> <m1>Explore {0} work.</m1>";
  const result = replaceCopyText(source, "See the ideas.  Explore  projects.");
  assert.equal(copyText(result), "See the ideas.  Explore  projects.");
  assert.deepEqual(marks(result), marks(source));
  const large = "A".repeat(1500);
  const replaced = replaceCopyText(`<m1>${large}</m1><m2>${large}</m2>`, "B".repeat(3000));
  assert.equal(copyText(replaced), "B".repeat(3000));
  assert.deepEqual(marks(replaced), ["<m1>", "</m1>", "<m2>", "</m2>"]);
});

test("the CMS accepts the reconstructed heading without a formatting validation error", () => {
  const require = createRequire(import.meta.url);
  const { makeStore } = require("../../../mock/apps/wm/content.js");
  const store = makeStore(() => "2026-10-14T12:00:00.000Z");
  const entry = store.entries.get("pg_home");
  const content = entry.draft ?? entry.live;
  const source = content.locales.en.closing.h2;
  const result = store.save(entry, { key: "editor" }, { locale: "en", fields: { closing: { ...content.locales.en.closing, h2: replaceCopyText(source, "How can we help your business grow?") } } }, { can: () => true });
  assert.ok(result.entry, JSON.stringify(result.errors));
});
