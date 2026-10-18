const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const routes = ['/', '/services', '/software', '/work', '/about', '/insights', '/contact', '/roadmap', '/legal', '/sign-in', '/sign-up', '/services#/family/design', '/services#/service/design/graphic-design', '/software#/product/hr', '/software#/plans/custom/annual/hr'];
  const output = path.join(__dirname, 'figma-repair');
  fs.mkdirSync(output, { recursive: true });
  const results = [];
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 812 });
    for (const route of routes) {
      await page.goto('http://127.0.0.1:4173' + route, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(async () => { for(let y=0;y<document.documentElement.scrollHeight;y+=600){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,30));}window.scrollTo(0,0); });
      await page.waitForTimeout(350);
      const result = await page.evaluate(() => {
        const visible = e => { const r = e.getBoundingClientRect(); return r.width && r.height && getComputedStyle(e).visibility !== 'hidden'; };
        return {
          height: document.documentElement.scrollHeight,
          overflow: document.documentElement.scrollWidth > innerWidth,
          headings: [...document.querySelectorAll('h1,h2,h3')].filter(visible).map(e => ({ text: e.innerText, font: getComputedStyle(e).fontFamily, size: getComputedStyle(e).fontSize })),
          text: document.body.innerText,
          sections: [...document.querySelectorAll('main > section, footer')].filter(visible).map(e => ({ name: e.id || e.tagName, height: e.getBoundingClientRect().height, width: e.getBoundingClientRect().width })),
          controls: [...document.querySelectorAll('button, a, input, textarea')].filter(visible).slice(0, 25).map(e => ({ text: e.innerText || e.placeholder, width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height, radius: getComputedStyle(e).borderRadius, font: getComputedStyle(e).fontFamily }))
        };
      });
      results.push({ route, width, ...result });
      if (['/', '/contact', '/services#/family/design', '/software#/product/hr'].includes(route)) {
        await page.screenshot({ path: path.join(output, route === '/' ? `home-${width}.png` : `${route.replace(/[^a-z0-9]/gi, '-')}-${width}.png`), fullPage: true });
      }
    }
  }
  fs.writeFileSync(path.join(output, 'source-audit.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results.map(({route,width,height,overflow,headings})=>({route,width,height,overflow,h1:headings[0]?.text}))));
  await context.close();
  await browser.close();
})();
