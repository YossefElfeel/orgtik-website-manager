import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import snapshot from "../src/content/snapshot.js";
import { applyPublished, CONTENT_TYPES, loadPublishedContent } from "../src/content/published.js";

const clone = value => JSON.parse(JSON.stringify(value));
const baseline = clone(snapshot), candidate = () => clone(baseline);
afterEach(() => applyPublished(baseline));
function server(value, failPath) {
  return async url => {
    const path = url.split("/public/")[1];
    if (path === failPath) throw Error("Fixture unavailable");
    const data = path.startsWith("entries/") ? value.entries[path.slice(8)] : value[path === "robots.txt" ? "robots" : path];
    return { ok: true, json: async () => ({ data: clone(data) }), text: async () => data };
  };
}
function cache() { const rows = new Map(); return { getItem: key => rows.get(key) ?? null, setItem: (key, value) => rows.set(key, value) }; }

test("a complete publication updates existing reader objects without changing their identities", async () => {
  const next = candidate(), current = snapshot.entries.page.find(row => row.id === "pg_partners"), site = snapshot.site;
  next.entries.page.find(row => row.id === current.id).locales.en.intro.badge = "Published partners";
  assert.deepEqual(await loadPublishedContent({ api: "https://cms.fixture/v2", fetcher: server(next), storage: cache() }), { source: "published" });
  assert.equal(snapshot.entries.page.find(row => row.id === current.id), current); assert.equal(snapshot.site, site);
  assert.equal(current.locales.en.intro.badge, "Published partners");
});
test("one failed content request cannot apply the other successful partial responses", async () => {
  const next = candidate(); next.entries.page[0].locales.en = { changed: true };
  assert.deepEqual(await loadPublishedContent({ api: "https://cms.fixture/v2", fetcher: server(next, "entries/article"), storage: cache() }), { source: "packaged" });
  assert.deepEqual(snapshot.entries, baseline.entries);
});
test("last good published content survives a subsequent CMS outage", async () => {
  const next = candidate(), saved = cache(); next.entries.page.find(row => row.id === "pg_partners").locales.en.intro.badge = "Last published value";
  await loadPublishedContent({ api: "https://cms.fixture/v2", fetcher: server(next), storage: saved }); applyPublished(baseline);
  assert.deepEqual(await loadPublishedContent({ api: "https://cms.fixture/v2", fetcher: async () => { throw Error("Offline"); }, storage: saved }), { source: "cached" });
  assert.equal(snapshot.entries.page.find(row => row.id === "pg_partners").locales.en.intro.badge, "Last published value");
});
test("malformed response keeps the last good content and does not overwrite its cache", async () => {
  const saved = cache(); await loadPublishedContent({ api: "https://cms.fixture/v2", fetcher: server(baseline), storage: saved });
  const malformed = candidate(); malformed.entries[CONTENT_TYPES[0]] = [{ id: "invalid", locales: null }];
  assert.deepEqual(await loadPublishedContent({ api: "https://cms.fixture/v2", fetcher: server(malformed), storage: saved }), { source: "cached" });
  assert.deepEqual(snapshot.entries, baseline.entries);
});
test("an empty success response cannot remove fixed website templates or become the cached fallback", async () => {
  const empty = candidate(); for (const type of CONTENT_TYPES) empty.entries[type] = [];
  assert.equal((await loadPublishedContent({ api: "https://cms.fixture/v2", fetcher: server(empty), storage: cache() })).source, "packaged");
  assert.deepEqual(snapshot.entries, baseline.entries);
});
test("missing route or required page blocks retains the renderable last-good publication", async () => {
  const malformed = candidate(), home = malformed.entries.page.find(row => row.id === "pg_home"); delete home.slug; home.locales.en = {};
  assert.equal((await loadPublishedContent({ api: "https://cms.fixture/v2", fetcher: server(malformed), storage: cache() })).source, "packaged");
  const allowed = candidate(); for (const type of ["article", "caseStudy", "roadmapItem"]) allowed.entries[type] = [];
  assert.equal((await loadPublishedContent({ api: "https://cms.fixture/v2", fetcher: server(allowed), storage: cache() })).source, "published");
});
test("optional storage failure does not prevent a valid publication from rendering", async () => {
  const next = candidate(); next.entries.page.find(row => row.id === "pg_partners").locales.en.intro.badge = "Fresh content";
  next.site.canonicalHost = null;
  const storage = { getItem() { throw Error("Unavailable"); }, setItem() { throw Error("Quota"); } };
  assert.equal((await loadPublishedContent({ api: "https://cms.fixture/v2", fetcher: server(next), storage })).source, "published");
});
test("an unconfigured runtime keeps the packaged prototype without requesting a provider", async () => {
  assert.deepEqual(await loadPublishedContent({ api: "", fetcher: () => { throw Error("Should not fetch"); } }), { source: "packaged" });
});
test("a slow CMS request is bounded and falls back to the existing content", async () => {
  const fetcher = (_url, { signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(Error("Timeout")), { once: true }));
  assert.equal((await loadPublishedContent({ api: "https://cms.fixture/v2", fetcher, storage: cache(), timeoutMs: 10 })).source, "packaged");
  assert.deepEqual(snapshot.entries, baseline.entries);
});

test("FAQ answers, review ordering, and section presentation refresh together and survive an outage", async () => {
  const next = candidate(), saved = cache();
  const home = next.entries.page.find(row => row.id === "pg_home");
  home.locales.en.faqs[0][1] = "A newly published answer.";
  home.presentation = { sectionOrder: ["hero", "faqs", "work"], sectionMedia: { faqs: [{ src: "https://assets.example.test/faq.mp4", alt: { en: "FAQ overview" } }] }, cursor: { text: { en: "Explore" }, link: "/work" } };
  next.entries.review = [{ id: "review_new", position: 2, sample: true, locales: { en: { name: "Sample client", quote: "Published sample" } } }];
  assert.ok(CONTENT_TYPES.includes("review"));
  assert.equal((await loadPublishedContent({ api: "https://cms.fixture/v2", fetcher: server(next), storage: saved })).source, "published");
  assert.deepEqual(snapshot.entries.review, next.entries.review);
  applyPublished(baseline);
  assert.equal((await loadPublishedContent({ api: "https://cms.fixture/v2", fetcher: async () => { throw Error("Offline"); }, storage: saved })).source, "cached");
  assert.deepEqual(snapshot.entries.page.find(row => row.id === "pg_home").presentation, home.presentation);
  assert.equal(snapshot.entries.page.find(row => row.id === "pg_home").locales.en.faqs[0][1], "A newly published answer.");
  assert.ok(snapshot.entries.page.some(row => row.id === "pg_faq" && row.slug.en === "/faq"));
  assert.deepEqual(snapshot.entries.review, next.entries.review);
});
