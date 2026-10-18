// Headless, owned browser QA. Fixtures are in-memory and only enabled on localhost.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(
  new URL("../../../docs/package.json", import.meta.url),
);
const { chromium } = require("playwright");
const origin = process.env.REVIEWS_AUDIT_ORIGIN ?? "http://127.0.0.1:4273";
const local = new URL(origin).hostname === "127.0.0.1";
const out = path.resolve(
  process.env.REVIEWS_AUDIT_OUTPUT ??
    "../../../program/audits/website/reviews-figma/local",
);
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
async function check(name, run) {
  try {
    await run();
    results.push({ name, passed: true });
  } catch (error) {
    results.push({ name, passed: false, message: error.message });
  }
}
async function pageFor(width, motion = "reduce", locale = "en") {
  const context = await browser.newContext({
    viewport: { width, height: 1000 },
    reducedMotion: motion,
  });
  const page = await context.newPage();
  await page.goto(`${origin}${locale === "en" ? "/" : `/${locale}`}`, {
    waitUntil: "networkidle",
  });
  await page.locator("#reviews").waitFor();
  await page.evaluate(() => document.fonts.ready);
  return page;
}
async function fixture(page, scope = "general", extra = {}) {
  assert.ok(
    local,
    "fixture rendering is restricted to a disposable local browser",
  );
  await page.evaluate(
    async ({ scope, extra }) => {
      const reactModule = await import("/node_modules/.vite/deps/react.js");
      const React = reactModule.default ?? reactModule;
      const client =
        await import("/node_modules/.vite/deps/react-dom_client.js");
      const createRoot = client.createRoot ?? client.default.createRoot;
      const { Testimonials } = await import("/src/reference/Testimonials.jsx");
      const { default: snapshot } = await import("/src/content/snapshot.js");
      const rows = [
        [
          "Brand & digital design",
          "services",
          "A client’s story of bringing their digital experience to life.",
        ],
        [
          "Customer relationships",
          "software",
          "A client’s experience of building closer customer relationships.",
        ],
        [
          "Web & platform development",
          "services",
          "A client’s perspective on turning a digital idea into something people can use.",
        ],
        [
          "Connected operations",
          "software",
          "A client’s experience of making everyday work feel more connected.",
        ],
        [
          "Hosting & ongoing support",
          "services",
          "A client’s story of keeping their digital business moving forward.",
        ],
        [
          "People & HR",
          "software",
          "A client’s perspective on making more time for their people.",
        ],
      ];
      snapshot.entries.review = rows.map(([name, kind, quote], index) => {
        const id = `fixture_related_${index}`;
        snapshot.entries[
          kind === "software" ? "softwareModule" : "serviceFamily"
        ].push({ id, locales: { en: { name } } });
        return {
          id: `fixture_${index}`,
          position: index,
          relatedEntry: id,
          sample: true,
          locales: {
            en: { name: "Client name", role: "Role, company", quote },
          },
        };
      });
      if (extra.single)
        snapshot.entries.review = snapshot.entries.review.slice(0, 1);
      if (extra.long)
        snapshot.entries.review[0].locales.en.quote =
          "A long managed review with all its words preserved. ".repeat(25);
      if (extra.portrait)
        snapshot.entries.review[0].image = {
          src: "brand-cards.webp",
          alt: { en: "Managed portrait" },
          focal: { x: 20, y: 80 },
        };
      document.getElementById("root").remove();
      const mount = document.createElement("div");
      document.body.append(mount);
      createRoot(mount).render(React.createElement(Testimonials, { scope }));
    },
    { scope, extra },
  );
  await page.locator("#reviews").waitFor();
  await page.evaluate(() => document.fonts.ready);
}
async function range(page) {
  return (await page.locator(".testimonials__count").innerText())
    .replace(/\s+/g, " ")
    .trim();
}
try {
  await check(
    "all public testimonial placements use the Figma carousel",
    async () => {
      const page = await pageFor(1440);
      for (const route of [
        "/",
        "/about",
        "/services",
        "/software",
        "/work/orgtik-identity-system",
      ]) {
        await page.goto(`${origin}${route}`, { waitUntil: "networkidle" });
        await page.locator("#reviews .testimonials__track").waitFor();
        assert.equal(await page.locator(".cms-reviews-grid").count(), 0);
        assert.equal(
          await page.locator("#reviews h2").innerText(),
          "In our clients’ words.",
        );
        assert.ok(await page.locator(".testimonials__card").count());
      }
      await page.goto(origin, { waitUntil: "networkidle" });
      await page.locator("#reviews").scrollIntoViewIfNeeded();
      await page
        .locator("#reviews")
        .screenshot({ path: path.join(out, "home-desktop.png") });
      await page.context().close();
    },
  );
  await check(
    "mobile swipe/arrow navigation has accurate counts and boundary states",
    async () => {
      const page = await pageFor(375);
      await page.locator("#reviews").scrollIntoViewIfNeeded();
      const total = await page.locator(".testimonials__card").count();
      assert.equal(
        await range(page),
        `01–01 of ${String(total).padStart(2, "0")}`,
      );
      assert.ok(
        await page
          .getByRole("button", { name: "Previous testimonials", exact: true })
          .isDisabled(),
      );
      if (total > 1) {
        await page
          .getByRole("button", { name: "Next testimonials", exact: true })
          .click();
        await page.waitForFunction(() =>
          document
            .querySelector(".testimonials__count")
            .textContent.includes("02–02"),
        );
      }
      await page.locator(".testimonials__track").focus();
      await page.keyboard.press("End");
      await page.waitForFunction(
        () =>
          document.querySelector('[aria-label="Next testimonials"]').disabled,
      );
      await page.keyboard.press("Home");
      await page.waitForFunction(
        () =>
          document.querySelector('[aria-label="Previous testimonials"]')
            .disabled,
      );
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      );
      await page
        .locator("#reviews")
        .screenshot({ path: path.join(out, "home-mobile.png") });
      await page.context().close();
    },
  );
  if (local) {
    await check(
      "Figma desktop geometry and all five original icon slots match",
      async () => {
        const page = await pageFor(1440);
        await fixture(page);
        const geometry = await page.locator("#reviews").evaluate((section) => {
          const style = (node) => getComputedStyle(node);
          const first = section.querySelector("figure");
          return {
            height: section.getBoundingClientRect().height,
            background: style(section).backgroundColor,
            card: style(first).backgroundColor,
            radius: style(first).borderRadius,
            quoteSize: style(section.querySelector(".ph-quotes")).fontSize,
            heading: style(section.querySelector("h2")).fontSize,
            first: first.getBoundingClientRect().left,
            icons: [...section.querySelectorAll(".ph, .ph-fill")].map(
              (icon) => ({
                font: style(icon).fontFamily,
                glyph: getComputedStyle(icon, "::before").content,
                size: style(icon).fontSize,
              }),
            ),
          };
        });
        assert.equal(geometry.background, "rgb(25, 15, 36)");
        assert.equal(geometry.card, "rgb(40, 24, 51)");
        assert.equal(geometry.radius, "24px");
        assert.equal(geometry.heading, "40px");
        assert.equal(geometry.quoteSize, "33.12px");
        assert.ok(
          Math.abs(geometry.height - 667.84) < 3,
          `section height ${geometry.height}`,
        );
        assert.ok(Math.abs(geometry.first - 56.16) < 1);
        assert.ok(
          geometry.icons.every(
            (icon) =>
              /Phosphor/.test(icon.font) &&
              !["none", '""'].includes(icon.glyph),
          ),
        );
        assert.equal(await range(page), "01–03 of 06");
        await page
          .locator("#reviews")
          .screenshot({ path: path.join(out, "figma-match-desktop.png") });
        await page.locator(".testimonials__track").focus();
        await page.keyboard.press("End");
        await page.waitForFunction(() =>
          document
            .querySelector(".testimonials__count")
            .textContent.includes("04–06"),
        );
        await page.context().close();
      },
    );
    await check(
      "Figma mobile layout, Arabic RTL and all language labels remain readable",
      async () => {
        for (const locale of ["en", "ar", "de", "fr", "it"]) {
          const page = await pageFor(375, "reduce", locale);
          await fixture(page);
          assert.ok(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
          );
          assert.equal(
            await page.locator("#reviews").getAttribute("dir"),
            locale === "ar" ? "rtl" : "ltr",
          );
          if (locale === "en") {
            const height = await page
              .locator("#reviews")
              .evaluate((node) => node.getBoundingClientRect().height);
            assert.ok(
              Math.abs(height - 717.625) < 3,
              `section height ${height}`,
            );
            await page
              .locator("#reviews")
              .screenshot({ path: path.join(out, "figma-match-mobile.png") });
          }
          if (locale === "ar") {
            await page.locator(".testimonials__track").focus();
            await page.keyboard.press("ArrowLeft");
            await page.waitForFunction(
              () =>
                !document.querySelector(".testimonials__controls button")
                  .disabled,
            );
            await page
              .locator("#reviews")
              .screenshot({ path: path.join(out, "arabic-mobile.png") });
          }
          await page.context().close();
        }
      },
    );
    await check(
      "single and long reviews preserve portraits and never clip managed content",
      async () => {
        const page = await pageFor(375);
        await fixture(page, "general", {
          single: true,
          long: true,
          portrait: true,
        });
        assert.equal(await range(page), "01–01 of 01");
        assert.ok(
          await page
            .getByRole("button", { name: "Next testimonials", exact: true })
            .isDisabled(),
        );
        const image = page.locator('[alt="Managed portrait"]');
        await image.evaluate((img) => img.decode());
        assert.equal(
          await image.evaluate((img) => getComputedStyle(img).objectPosition),
          "20% 80%",
        );
        assert.ok(
          await page
            .locator("blockquote")
            .evaluate((node) => node.scrollHeight <= node.clientHeight + 1),
        );
        assert.ok(
          await page
            .locator("figure")
            .evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
        );
        await page.context().close();
      },
    );
    await check(
      "autoplay loops and pauses for focus, open dialogs and reduced motion",
      async () => {
        const page = await pageFor(375, "no-preference");
        await fixture(page);
        await page.waitForFunction(
          () =>
            document
              .querySelector(".testimonials__count")
              .textContent.includes("02–02"),
          null,
          { timeout: 6000 },
        );
        await page.locator(".testimonials__track").focus();
        await page.keyboard.press("End");
        await page.waitForFunction(() =>
          document
            .querySelector(".testimonials__count")
            .textContent.includes("06–06"),
        );
        await page.waitForTimeout(3300);
        assert.equal(await range(page), "06–06 of 06");
        await page
          .locator(".testimonials__track")
          .evaluate((node) => node.blur());
        await page.waitForFunction(
          () =>
            document
              .querySelector(".testimonials__count")
              .textContent.includes("01–01"),
          null,
          { timeout: 6000 },
        );
        await page.evaluate(() => {
          const dialog = document.createElement("dialog");
          dialog.open = true;
          document.body.append(dialog);
        });
        const before = await range(page);
        await page.waitForTimeout(3300);
        assert.equal(await range(page), before);
        await page.evaluate(() => document.querySelector("dialog").remove());
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.waitForTimeout(3300);
        assert.equal(await range(page), before);
        await page.context().close();
      },
    );
  }
} finally {
  await browser.close();
}
await fs.writeFile(
  path.join(out, "checks.json"),
  JSON.stringify({ origin, results }, null, 2),
);
console.log(JSON.stringify(results, null, 2));
if (results.some((result) => !result.passed)) process.exitCode = 1;
