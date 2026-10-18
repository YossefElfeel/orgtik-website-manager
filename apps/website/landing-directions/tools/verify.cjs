const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright",
);
const fs = require("node:fs");
(async () => {
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const results = [],
    errors = [],
    warnings = [];
  for (const width of [1440, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: width === 1440 ? 1000 : 844 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.on("pageerror", (e) =>
      errors.push({ url: page.url(), message: e.message }),
    );
    page.on("console", (e) => {
      if (["error", "warning"].includes(e.type()))
        warnings.push({ url: page.url(), message: e.text() });
    });
    for (const route of [
      "/",
      "/services",
      "/software",
      "/work",
      "/about",
      "/insights",
      "/contact",
      "/roadmap",
      "/legal",
      "/sign-in",
      "/software#/product/hr",
      "/services#/family/design",
      "/services#/service/design/brand-development",
    ]) {
      await page.goto("http://127.0.0.1:4173" + route, {
        waitUntil: "domcontentloaded",
      });
      await page.locator("h1, h2").first().waitFor({ timeout: 30000 });
      await page.waitForTimeout(400);
      const result = await page.evaluate(() => ({
        title: document.title,
        heading: document.querySelector("h1, h2")?.innerText,
        overflow: document.documentElement.scrollWidth > innerWidth,
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        links: [...document.querySelectorAll("a[href]")].filter((a) =>
          a.getAttribute("href").includes(".dc.html"),
        ).length,
      }));
      results.push({ route, ...result });
      if (["/", "/services", "/software"].includes(route))
        await page.screenshot({
          path: `qa/${width === 1440 ? "desktop" : "mobile"}-${route === "/" ? "home" : route.slice(1)}.png`,
        });
      console.log(
        width,
        route,
        result.heading.replace(/\n/g, " "),
        result.overflow ? "OVERFLOW" : "OK",
      );
    }
    await context.close();
  }
  fs.writeFileSync(
    "qa/browser-results.json",
    JSON.stringify({ results, errors, warnings }, null, 2),
  );
  console.log(JSON.stringify({ errors, warnings }, null, 2));
  await browser.close();
  if (errors.length || results.some((r) => r.overflow)) process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
