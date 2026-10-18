const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright",
);
const assert = require("node:assert/strict"),
  fs = require("node:fs");
(async () => {
  const b = await chromium.connectOverCDP("http://127.0.0.1:9222"),
    c = await b.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    }),
    p = await c.newPage();
  const errors = [],
    passed = [];
  p.on("pageerror", (e) => errors.push(e.message));
  const go = async (route) => {
    await p.goto("http://127.0.0.1:4173" + route);
    await p.locator("main").waitFor();
  };
  const ok = (label) => {
    passed.push(label);
    console.log("PASS", label);
  };
  await go("/");
  assert.equal(await p.locator("header nav a").count(), 6);
  await p
    .locator("header nav")
    .getByRole("link", { name: "Services", exact: true })
    .click();
  await p.waitForURL("**/services");
  await p.goBack();
  await p.waitForURL("http://127.0.0.1:4173/");
  ok("Desktop navigation and browser Back");
  await go("/software");
  await p.getByRole("button", { name: /All-in-one suite/ }).click();
  await p.getByRole("button", { name: /Monthly.*Pay monthly/s }).click();
  await p.getByRole("radio", { name: /^Complete/ }).check();
  await p
    .locator("#plan-builder")
    .screenshot({ path: "qa/software-builder.png" });
  await p
    .getByRole("button", { name: "Compare the plans in detail", exact: true })
    .click();
  await p.waitForURL("**/software#/plans/suite/monthly/**");
  await p.getByText("6 products,", { exact: true }).waitFor();
  ok(
    "Six-product bundle, inline plan choice and billing flow to plan comparison",
  );
  await go("/software#/product/crm");
  await p.getByRole("button", { name: /24 months/ }).click();
  assert.match(await p.locator("body").innerText(), /CRM/);
  ok("Product detail and billing selector");
  await go("/services");
  await p.getByRole("button", { name: /Care bundle/ }).click();
  await p.getByRole("button", { name: /^Ongoing/ }).click();
  await p
    .getByRole("button", {
      name: "Add Care bundle · Ongoing to cart",
      exact: true,
    })
    .click();
  await p.getByRole("link", { name: /^Cart,/ }).click();
  await p.waitForURL("**/cart");
  await p.getByRole("heading", { name: "Care bundle", exact: true }).waitFor();
  await p
    .getByRole("link", { name: "Continue to checkout", exact: true })
    .click();
  await p.waitForURL("**/checkout");
  await p.getByRole("button", { name: "Preview enquiry", exact: true }).click();
  await p
    .getByText("Add your full name so we know who to contact.", { exact: true })
    .waitFor();
  await p.locator("[name=name]").fill("QA Preview");
  await p.locator("[name=email]").fill("qa@example.com");
  await p.getByRole("button", { name: "Preview enquiry", exact: true }).click();
  await p
    .getByRole("heading", {
      name: "Enquiry preview ready, QA Preview.",
      exact: true,
    })
    .waitFor();
  ok("Service bundle, persistent cart and contact-led checkout preview");
  await go("/contact");
  await p.waitForURL("**/contact");
  await p.getByRole("button", { name: "Send enquiry", exact: true }).click();
  await p
    .getByText("Please add your name, email and a short message.", {
      exact: true,
    })
    .waitFor();
  await p.locator("[name=name]").fill("QA Preview");
  await p.locator("[name=email]").fill("qa@example.com");
  await p
    .locator("[name=message]")
    .fill("Local verification of the website reference implementation.");
  await p.getByRole("button", { name: "Send enquiry", exact: true }).click();
  assert.match(await p.locator("body").innerText(), /preview/i);
  assert.equal(await p.locator("form").count(), 0);
  ok("Contact validation and local success state");
  await go("/sign-in");
  await p.getByRole("button", { name: "Reset password", exact: true }).click();
  await p.locator("[name=email]").fill("qa@example.com");
  await p.getByRole("button", { name: "Send reset link", exact: true }).click();
  await p.getByText("Check your inbox.", { exact: true }).waitFor();
  await p
    .getByText(
      "In the live product a reset link would arrive shortly. This preview sends nothing.",
      { exact: true },
    )
    .waitFor();
  ok("Password recovery preview");
  await go("/insights");
  await p.getByPlaceholder("Search articles").fill("no-matching-article-123");
  await p.waitForTimeout(100);
  assert.match(
    await p.locator("body").innerText(),
    /No (articles|insights|results)/i,
  );
  await p.getByPlaceholder("Search articles").fill("");
  await p
    .locator('a[href="#/article/brand-system-that-scales"]')
    .first()
    .click();
  await p.waitForURL("**#/article/brand-system-that-scales");
  ok("Insights search, empty state, article navigation");
  await go("/roadmap");
  const vote = p.locator(
    'button[aria-label*="A clearer workspace setup guide"]',
  );
  const before = Number(await vote.innerText());
  await vote.click();
  assert.equal(Number(await vote.innerText()), before + 1);
  await vote.click();
  assert.equal(Number(await vote.innerText()), before);
  ok("Reversible local roadmap voting");
  await go("/platform");
  assert.equal(new URL(p.url()).pathname, "/software");
  await go("/services/design/brand-development");
  assert.match(p.url(), /services#\/service\/design\/brand-development/);
  ok("Legacy route compatibility");
  await p.setViewportSize({ width: 390, height: 844 });
  await go("/");
  await p.getByRole("button", { name: "Open menu", exact: true }).click();
  await p.getByRole("dialog", { name: "Navigation menu" }).waitFor();
  await p.keyboard.press("Escape");
  assert.equal(await p.getByRole("dialog").count(), 0);
  assert.equal(
    await p.evaluate(() => document.activeElement?.getAttribute("aria-label")),
    "Open menu",
  );
  await p.getByRole("button", { name: "Open menu", exact: true }).click();
  await p
    .getByRole("dialog")
    .getByRole("link", { name: "Software", exact: true })
    .click();
  await p.waitForURL("**/software");
  assert.equal(await p.evaluate(() => document.body.style.overflow), "");
  ok("Mobile navigation, Escape, focus restoration, route change");
  fs.writeFileSync(
    "qa/interaction-results.json",
    JSON.stringify({ passed, errors }, null, 2),
  );
  assert.deepEqual(errors, []);
  await c.close();
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
