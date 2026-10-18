// Website Manager: the Overview's website numbers (plan: "KPI cards and charts from mock analytics,
// parity with the old dashboard"). The site has no analytics yet, so these are SAMPLE numbers:
// the same every time for the same day and period (a seeded generator), shaped by the site's real
// addresses, service families and articles, and always marked `sample: true` so the screen says so.
// When a real analytics source is connected, this is the one function to replace.
const DAY = 86400000;
const PERIODS = { "30d": { days: 30, bucket: "day" }, "90d": { days: 90, bucket: "week" }, "12m": { days: 365, bucket: "month" } };

// mulberry32: small, fast, deterministic.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = (s) => [...String(s)].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
const plain = (s) => String(s ?? "").replace(/<[^>]+>/g, "").trim();

function makeAnalytics({ store, lib, ops, now }) {
  function visitsOn(t, r) {
    const d = new Date(t).getUTCDay();
    const weekday = d === 0 || d === 6 ? 0.62 : 1;
    // A slow climb over the year, the weekly rhythm and some noise.
    const trend = 1 + ((t / DAY) % 365) / 1400;
    return Math.round(430 * weekday * trend * (0.82 + r() * 0.36));
  }
  function report(period = "30d") {
    const p = PERIODS[period] ?? PERIODS["30d"];
    const today = Date.parse(String(now()).slice(0, 10) + "T00:00:00Z");
    const r = rng(hash(`${period}:${today}`));
    const days = (from, count) => Array.from({ length: count }, (_, i) => from + i * DAY);
    const current = days(today - (p.days - 1) * DAY, p.days).map((t) => ({ t, visits: visitsOn(t, r) }));
    const previous = days(today - (2 * p.days - 1) * DAY, p.days).map((t) => ({ t, visits: Math.round(visitsOn(t, r) * 0.9) }));
    current.forEach((d) => (d.leads = Math.max(0, Math.round(d.visits * (0.014 + r() * 0.012)))));
    previous.forEach((d) => (d.leads = Math.max(0, Math.round(d.visits * (0.013 + r() * 0.01)))));

    // Days, weeks or months, as the period reads best.
    const key = (t) => {
      const d = new Date(t);
      if (p.bucket === "day") return d.toISOString().slice(0, 10);
      if (p.bucket === "month") return d.toISOString().slice(0, 7);
      const monday = t - ((d.getUTCDay() + 6) % 7) * DAY;
      return new Date(monday).toISOString().slice(0, 10);
    };
    const buckets = new Map();
    current.forEach((d, i) => {
      const k = key(d.t);
      const b = buckets.get(k) ?? { period: k, visits: 0, previous: 0, leads: 0 };
      b.visits += d.visits;
      b.leads += d.leads;
      b.previous += previous[i].visits;
      buckets.set(k, b);
    });
    const sum = (list, f) => list.reduce((n, d) => n + d[f], 0);
    const totals = { visits: sum(current, "visits"), leads: sum(current, "leads") };
    const before = { visits: sum(previous, "visits"), leads: sum(previous, "leads") };
    totals.visitors = Math.round(totals.visits * 0.71);
    before.visitors = Math.round(before.visits * 0.72);
    totals.conversion = totals.leads / totals.visits;
    before.conversion = before.leads / before.visits;

    // Pages: the site's real addresses, weighted the way a site like this reads (overviews first).
    const live = [...store.entries.values()].filter((e) => e.workflow.visibility === "live" && e.live);
    const weight = { page: 1, serviceFamily: 0.45, softwareModule: 0.5, service: 0.25, caseStudy: 0.3, article: 0.28, legalDocument: 0.04 };
    const addresses = lib.previewAddresses().filter((a) => a.onSite && weight[a.type]);
    const raw = addresses.map((a) => ({ ...a, w: weight[a.type] * (a.path === "/" ? 3 : a.path === "/sign-in" ? 0.1 : 1) * (0.5 + r()) }));
    const total = raw.reduce((n, a) => n + a.w, 0);
    const pages = raw.map((a) => ({ path: a.path, name: a.name, type: a.type, visits: Math.round((totals.visits * a.w) / total) })).sort((x, y) => y.visits - x.visits);

    // Leads per service family (the old dashboard's "top services"), from the sample share.
    const families = live.filter((e) => e.type === "serviceFamily").sort((a, b) => a.order - b.order);
    const famW = families.map(() => 0.4 + r());
    const famT = famW.reduce((n, w) => n + w, 0);
    const services = families.map((f, i) => ({ id: f.id, name: plain(f.live.locales.en.name), leads: Math.round((totals.leads * 0.55 * famW[i]) / famT) })).sort((x, y) => y.leads - x.leads);

    services.push({ id: "software-system", name: "Software System", leads: Math.round(totals.leads * 0.3) });
    services.sort((a, b) => b.leads - a.leads);

    // Articles by views, and views by topic (the service family an article belongs to, by its slug).
    const articles = pages.filter((x) => x.type === "article").map((x) => {
      const e = live.find((y) => y.type === "article" && `/insights/${y.live.slug.en}` === x.path);
      return { id: e?.id, title: x.name, path: x.path, views: x.visits, image: e?.live.image?.src ?? null, topic: e?.live.category ?? null };
    });
    const topics = families
      .map((f) => ({ key: f.id, label: plain(f.live.locales.en.name), value: articles.filter((a) => a.topic === f.live.slug.en).reduce((n, a) => n + a.views, 0) }))
      .filter((t) => t.value > 0);

    // Where visits come from.
    const channels = [["search", 0.46], ["direct", 0.27], ["social", 0.17], ["referral", 0.1]].map(([k, s]) => ({ key: k, value: Math.round(totals.visits * s * (0.9 + r() * 0.2)) }));

    return {
      sample: true,
      period,
      bucket: p.bucket,
      from: new Date(current[0].t).toISOString().slice(0, 10),
      to: new Date(current.at(-1).t).toISOString().slice(0, 10),
      totals,
      previous: before,
      series: [...buckets.values()],
      pages: pages.slice(0, 8),
      services,
      articles: articles.slice(0, 5),
      topics,
      channels,
      // Real, not sample: what the Website Manager itself holds.
      realLeads: [...ops.leads.values()].filter((l) => !["spam", "duplicate"].includes(l.status)).length,
    };
  }
  return { report, PERIODS };
}

module.exports = { makeAnalytics };
