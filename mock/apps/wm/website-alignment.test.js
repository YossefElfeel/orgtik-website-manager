const { test } = require("node:test");
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const original = JSON.parse(fs.readFileSync(path.join(__dirname, "seed/website.json"), "utf8"));
const clone = value => JSON.parse(JSON.stringify(value));
const ordered = entries => entries.slice().sort((a, b) => a.id.localeCompare(b.id));
test("regeneration restores the current Partners, account setup, Imprint and Legal fields", async () => {
  const { applyWebsiteAlignment } = await import("./seed/website-alignment.mjs");
  const entries = clone(original.entries).filter(row => row.id !== "pg_partners"), at = id => entries.find(row => row.id === id);
  at("st_commerce").layout = at("st_commerce").layout.filter(section => section.key !== "b21"); delete at("st_commerce").locales.en.b21;
  at("gl_footer").locales.en.start = [{ label: "Sitemap", href: "/legal#/sitemap" }];
  at("pg_legal").locales.en.hero["p-2"] = "Legacy introduction";
  Object.assign(at("st_legal").locales.en.b1, { s3: "Legacy company label", s6: "Legacy legal label" });
  applyWebsiteAlignment(entries);
  assert.deepEqual(ordered(entries), ordered(original.entries));
});
test("repeated alignment produces one stable record/section without duplicating approved content", async () => {
  const { applyWebsiteAlignment } = await import("./seed/website-alignment.mjs");
  const entries = clone(original.entries); applyWebsiteAlignment(entries); const once = clone(entries); applyWebsiteAlignment(entries);
  assert.deepEqual(entries, once); assert.equal(new Set(entries.map(row => row.id)).size, entries.length);
});
test("alignment preserves other approved content, language data and retained price references", async () => {
  const { applyWebsiteAlignment, websiteAlignmentRedirects } = await import("./seed/website-alignment.mjs");
  const entries = clone(original.entries); const footer = entries.find(row => row.id === "gl_footer"); footer.locales.de = { preserved: "Eigener Text" };
  const prices = entries.filter(row => row.type === "pricing"); const header = entries.find(row => row.id === "gl_header");
  const pricesBefore = clone(prices), headerBefore = clone(header); applyWebsiteAlignment(entries);
  assert.deepEqual(entries.filter(row => row.type === "pricing"), pricesBefore); assert.deepEqual(header, headerBefore); assert.deepEqual(footer.locales.de, { preserved: "Eigener Text" });
  assert.deepEqual(websiteAlignmentRedirects(), original.seo.redirects);
});
