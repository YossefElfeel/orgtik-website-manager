const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright",
);
const fs = require("node:fs");
(async () => {
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9222");
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.argv[2], { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(2500);
  fs.mkdirSync("qa", { recursive: true });
  await page.screenshot({
    path: "qa/" + (process.argv[3] || "page") + ".png",
    fullPage: false,
  });
  console.log(
    JSON.stringify(
      {
        url: page.url(),
        errors,
        title: await page.title(),
        text: (await page.locator("body").innerText()).slice(0, 1500),
      },
      null,
      2,
    ),
  );
  await context.close();
  await browser.close();
})();
