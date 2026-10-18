// Deterministic analytics: a 120-day daily series per connected profile, plus the report shapes the
// app reads (our-reports overview/profiles, integration details, post performance, competitors).
const { rng, ymd, startOfToday, DAY, round, pctChange, calendarDay, addCalendarDays, weekday } = require("./lib");
const { reportPlatform, normPlatform } = require("./catalog");

const HISTORY_DAYS = 120;
const METRICS = ["impressions", "reach", "engagements", "followers", "followersGained", "profileViews", "clicks", "likes", "comments", "shares", "saves", "videoViews", "sessions", "activeUsers", "following", "posts"];
const STOCK = new Set(["followers", "following"]); // point-in-time values, not sums
const WEEKDAY = [1.0, 0.95, 0.97, 1.0, 1.12, 1.2, 1.08]; // Sun..Sat (Thu/Fri evenings peak in Egypt & GCC)

const cache = new Map();

// Daily points (oldest -> today) for one integration. Published app posts create visible spikes.
function series(db, integration) {
  const today = ymd(startOfToday());
  const postDays = new Map();
  for (const p of db.posts) for (const t of p.targets) {
    if (t.integrationId === integration.id && t.publishedAt) postDays.set(ymd(t.publishedAt), (postDays.get(ymd(t.publishedAt)) || 0) + 1);
  }
  const key = `${integration.id}:${today}:${[...postDays.entries()].join("|")}:${integration.account.followers}`;
  if (cache.has(key)) return cache.get(key);

  const r = rng(`series:${integration.id}`);
  const a = integration.account;
  const isAds = integration.platform === "GOOGLE";
  const reachRate = { FACEBOOK: 0.05, INSTAGRAM: 0.09, X: 0.07, LINKEDIN: 0.06, TIKTOK: 0.16, YOUTUBE: 0.08 }[integration.platform] || 0.06;
  const engRate = { FACEBOOK: 0.032, INSTAGRAM: 0.05, X: 0.02, LINKEDIN: 0.04, TIKTOK: 0.075, YOUTUBE: 0.045 }[integration.platform] || 0.04;
  const growth = { FACEBOOK: 0.0006, INSTAGRAM: 0.0011, X: 0.0008, LINKEDIN: 0.0012, TIKTOK: 0.0019, YOUTUBE: 0.001 }[integration.platform] || 0.0008;
  const start = addCalendarDays(startOfToday(), -(HISTORY_DAYS - 1));

  const days = [];
  for (let i = 0; i < HISTORY_DAYS; i++) {
    const d = addCalendarDays(start, i);
    const date = ymd(d);
    const appPosts = postDays.get(date) || 0;
    const spike = 1 + appPosts * (0.35 + r() * 0.3);
    const noise = 0.8 + r() * 0.4;
    const trend = 0.85 + (i / HISTORY_DAYS) * 0.3; // audiences keep growing
    const wd = WEEKDAY[weekday(date)];
    const point = { date };
    if (isAds) {
      const spend = 1 + (i % 7 === 3 ? 0.2 : 0);
      point.impressions = Math.round(9000 * trend * wd * noise * spend);
      point.clicks = Math.round(point.impressions * (0.045 + r() * 0.02));
      point.sessions = Math.round(point.clicks * (0.82 + r() * 0.1));
      point.activeUsers = Math.round(point.sessions * (0.74 + r() * 0.1));
      point.reach = Math.round(point.impressions * 0.58);
      point.engagements = point.clicks;
      Object.assign(point, { likes: 0, comments: 0, shares: 0, saves: 0, videoViews: 0, profileViews: 0, followersGained: 0, posts: 0 });
    } else {
      point.impressions = Math.round(a.followers * reachRate * trend * wd * noise * spike);
      point.reach = Math.round(point.impressions * (0.6 + r() * 0.12));
      point.engagements = Math.round(point.reach * engRate * (0.8 + r() * 0.4) * (appPosts ? 1.25 : 1));
      point.likes = Math.round(point.engagements * 0.68);
      point.comments = Math.round(point.engagements * 0.09);
      point.shares = Math.round(point.engagements * 0.11);
      point.saves = Math.round(point.engagements * 0.07);
      point.clicks = Math.round(point.impressions * (0.009 + r() * 0.006));
      point.profileViews = Math.round(point.impressions * (0.004 + r() * 0.003));
      point.videoViews = ["TIKTOK", "YOUTUBE", "INSTAGRAM"].includes(integration.platform) ? Math.round(point.impressions * (0.5 + r() * 0.2)) : 0;
      point.followersGained = Math.max(0, Math.round(a.followers * growth * wd * noise * (appPosts ? 1.6 : 1) * trend));
      point.posts = appPosts + (r() < 0.18 ? 1 : 0);
      point.sessions = 0;
      point.activeUsers = 0;
    }
    days.push(point);
  }
  // Walk backwards so today's follower count equals the profile's current followers.
  let followers = a.followers;
  let following = a.following;
  for (let i = days.length - 1; i >= 0; i--) {
    days[i].followers = Math.max(0, followers);
    days[i].following = Math.max(0, following);
    followers -= days[i].followersGained;
    if (i % 17 === 0 && following > 0) following -= 1;
  }
  cache.set(key, days);
  return days;
}

// Period helpers ------------------------------------------------------------
// "2026-09-10" and "2026-09-10T00:00:00.000Z" (what `new Date(dateInput).toISOString()` sends) both mean
// the local calendar day 2026-09-10; anything else is taken as an instant.
function parseDay(v, endOfDay) {
  if (!v) return null;
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z)?$/);
  if (m) return endOfDay ? new Date(calendarDay(`${m[1]}-${m[2]}-${m[3]}`, 1).getTime() - 1) : calendarDay(`${m[1]}-${m[2]}-${m[3]}`);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function resolvePeriod(q = {}) {
  const today = startOfToday();
  const endOfToday = new Date(addCalendarDays(today, 1).getTime() - 1);
  const pEnd = parseDay(q.periodEnd, true) || endOfToday;
  const pStart = parseDay(q.periodStart, false) || addCalendarDays(today, -29);
  const start = Number.isNaN(pStart.getTime()) ? addCalendarDays(today, -29) : pStart;
  const end = Number.isNaN(pEnd.getTime()) ? endOfToday : pEnd;
  const days = Math.max(1, Math.round((Date.parse(ymd(end)) - Date.parse(ymd(start))) / DAY) + 1);
  const cStart = parseDay(q.compareStart, false) || calendarDay(ymd(start), -days);
  const cEnd = parseDay(q.compareEnd, true) || new Date(start.getTime() - 1);
  return { start, end, cStart: Number.isNaN(cStart.getTime()) ? calendarDay(ymd(start), -days) : cStart, cEnd: Number.isNaN(cEnd.getTime()) ? new Date(start.getTime() - 1) : cEnd };
}

const inRange = (date, a, b) => {
  return date >= ymd(a) && date <= ymd(b);
};

function zero() {
  return Object.fromEntries(METRICS.map((m) => [m, 0]));
}

// Sums flow metrics and takes the last value of stock metrics within [a, b].
function totalsFor(points, a, b) {
  const out = zero();
  let last = null;
  for (const p of points) {
    if (!inRange(p.date, a, b)) continue;
    for (const m of METRICS) if (!STOCK.has(m)) out[m] += p[m] || 0;
    last = p;
  }
  if (last) {
    out.followers = last.followers;
    out.following = last.following;
  }
  return out;
}

function addTotals(acc, t) {
  for (const m of METRICS) acc[m] += t[m] || 0;
  return acc;
}

function projectIntegrations(db, projectId, q = {}) {
  const platforms = new Set((q.platforms || []).map(normPlatform));
  const profileIds = new Set(q.profileIds || []);
  return db.integrations.filter((i) => i.projectId === projectId
    && (!platforms.size || platforms.has(i.platform))
    && (!profileIds.size || profileIds.has(i.id)));
}

function rawFor(db, integrations, a, b) {
  const fb = integrations.filter((i) => i.platform === "FACEBOOK");
  const acc = { fan_count: 0, page_post_engagements: 0, page_impressions_unique: 0 };
  for (const i of fb) {
    const t = totalsFor(series(db, i), a, b);
    acc.fan_count += t.followers;
    acc.page_post_engagements += t.engagements;
    acc.page_impressions_unique += t.reach;
  }
  return acc;
}

// GET /analytics/reports/overview
function overviewReport(db, projectId, q) {
  const { start, end, cStart, cEnd } = resolvePeriod(q);
  const integrations = projectIntegrations(db, projectId, q);
  const current = zero();
  const compare = zero();
  const trendMap = new Map();
  for (const i of integrations) {
    const pts = series(db, i);
    addTotals(current, totalsFor(pts, start, end));
    addTotals(compare, totalsFor(pts, cStart, cEnd));
    for (const p of pts) {
      if (!inRange(p.date, start, end)) continue;
      const row = trendMap.get(p.date) || zero();
      for (const m of METRICS) row[m] += p[m] || 0;
      trendMap.set(p.date, row);
    }
  }
  const withRate = Object.fromEntries(METRICS.map((m) => [m, { value: current[m], rate: compare[m] ? pctChange(current[m], compare[m]) : null }]));
  const failed = integrations.filter((i) => i.requiresReconnect);
  return {
    period: { start: start.toISOString(), end: end.toISOString() },
    comparePeriod: { start: cStart.toISOString(), end: cEnd.toISOString() },
    totals: { current, compare, withRate, rawCurrent: rawFor(db, integrations, start, end), rawCompare: rawFor(db, integrations, cStart, cEnd) },
    trends: [...trendMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, metrics]) => ({ date, metrics })),
    syncStatus: syncStatus(db, integrations, failed),
  };
}

function syncStatus(db, integrations, failed) {
  return {
    attempted: true, totalIntegrations: integrations.length, succeeded: integrations.length - failed.length, failed: failed.length,
    metricsCount: integrations.length * 16,
    failures: failed.map((i) => ({ integrationId: i.id, platform: reportPlatform(i.platform), profileName: i.account.displayName, error: "Access token expired — reconnect the account to resume syncing." })),
  };
}

// GET /analytics/reports/profiles
function profilesReport(db, projectId, q) {
  const { start, end, cStart, cEnd } = resolvePeriod(q);
  const integrations = projectIntegrations(db, projectId, q);
  const items = integrations.map((i) => {
    const t = totalsFor(series(db, i), start, end);
    const appPosts = db.posts.filter((p) => p.targets.some((x) => x.integrationId === i.id && x.publishedAt && inRange(ymd(x.publishedAt), start, end))).length;
    const raw = i.platform === "FACEBOOK" ? { fan_count: t.followers, page_post_engagements: t.engagements, page_impressions_unique: t.reach } : { fan_count: 0, page_post_engagements: 0, page_impressions_unique: 0 };
    return {
      platform: reportPlatform(i.platform), profileId: i.id, profileName: i.account.displayName,
      impressions: t.impressions, engagements: t.engagements, engagementRate: t.reach ? round((t.engagements / t.reach) * 100, 2) : 0,
      followersGained: t.followersGained, postsPublished: Math.max(t.posts, appPosts), reach: t.reach,
      unifiedMetrics: { ...t, posts: Math.max(t.posts, appPosts) }, rawMetrics: raw,
    };
  });
  const sortBy = ["impressions", "engagements", "reach", "followers"].includes(q.sortBy) ? q.sortBy : "impressions";
  const dir = String(q.sortOrder || "desc").toLowerCase() === "asc" ? 1 : -1;
  items.sort((a, b) => dir * ((sortBy === "followers" ? a.unifiedMetrics.followers - b.unifiedMetrics.followers : a[sortBy] - b[sortBy])));
  const failed = integrations.filter((i) => i.requiresReconnect);
  return { period: { start: start.toISOString(), end: end.toISOString() }, comparePeriod: { start: cStart.toISOString(), end: cEnd.toISOString() }, items, syncStatus: syncStatus(db, integrations, failed) };
}

const mv = (value, prev) => ({ value, rate: prev == null ? null : pctChange(value, prev) });

// IntegrationResponse.analytics for GET /integrations/:id
function integrationAnalytics(db, integration, { avatarUrl, recentPosts }) {
  const { start, end, cStart, cEnd } = resolvePeriod({});
  const pts = series(db, integration);
  const cur = totalsFor(pts, start, end);
  const prev = totalsFor(pts, cStart, cEnd);
  const a = integration.account;
  const totalPosts = a.basePosts + db.posts.filter((p) => p.targets.some((t) => t.integrationId === integration.id && t.publishedAt)).length;
  const prevTotalPosts = Math.max(0, totalPosts - Math.max(cur.posts, 1));
  const weekly = [];
  for (let i = pts.length - 1; i >= 0 && weekly.length < 12; i -= 7) {
    const p = pts[i];
    const windowPts = pts.slice(Math.max(0, i - 6), i + 1);
    weekly.unshift({
      date: new Date(`${p.date}T12:00:00`).toISOString(), followers: p.followers, following: p.following,
      impressions: windowPts.reduce((s, x) => s + x.impressions, 0), reach: windowPts.reduce((s, x) => s + x.reach, 0), engagements: windowPts.reduce((s, x) => s + x.engagements, 0),
    });
  }
  const postsInPeriod = Math.max(1, cur.posts);
  const syncFailed = integration.requiresReconnect;
  const syncBlock = (count) => ({ status: syncFailed ? "FAILED" : "SUCCESS", attempted: true, queued: false, metricsCount: syncFailed ? null : count, error: syncFailed ? "Access token expired — reconnect to resume syncing." : null, queuedJobId: null });
  const isAds = integration.platform === "GOOGLE";
  const aud = integration.audience || { topCountries: [], ageGroups: [], gender: { male: 0, female: 0, unknown: 0 } };
  return {
    status: syncFailed ? "STALE" : "READY",
    period: { start: start.toISOString(), end: end.toISOString() },
    comparePeriod: { start: cStart.toISOString(), end: cEnd.toISOString() },
    sync: {
      accountMetrics: syncBlock(30), audienceMetrics: syncBlock(3), recentPostsImport: syncBlock(recentPosts.length),
      lastSyncAt: integration.lastSyncedAt, errors: syncFailed ? [{ scope: "accountMetrics", message: "Access token expired — reconnect to resume syncing.", at: integration.lastSyncedAt }] : [],
    },
    overview: {
      status: "READY",
      profile: { displayName: a.displayName, handle: a.handle, externalId: a.externalId, imageUrl: avatarUrl, category: a.category, websiteUrl: a.websiteUrl },
      followers: mv(cur.followers, prev.followers), following: mv(cur.following, prev.following), totalPosts: mv(totalPosts, prevTotalPosts),
      reach: mv(cur.reach, prev.reach), impressions: mv(cur.impressions, prev.impressions),
    },
    engagement: {
      status: "READY",
      engagementRate: mv(cur.reach ? round((cur.engagements / cur.reach) * 100, 2) : 0, prev.reach ? round((prev.engagements / prev.reach) * 100, 2) : null),
      avgLikes: mv(Math.round(cur.likes / postsInPeriod), Math.round(prev.likes / Math.max(1, prev.posts))),
      avgComments: mv(Math.round(cur.comments / postsInPeriod), Math.round(prev.comments / Math.max(1, prev.posts))),
      avgShares: mv(Math.round(cur.shares / postsInPeriod), Math.round(prev.shares / Math.max(1, prev.posts))),
      profileViews: mv(cur.profileViews, prev.profileViews),
    },
    growth: {
      status: "READY",
      followersDelta: mv(cur.followersGained, prev.followersGained),
      followingDelta: mv(cur.following - (pts.find((p) => inRange(p.date, start, end))?.following ?? cur.following), null),
      impressionsDelta: mv(cur.impressions - prev.impressions, null),
      series: weekly,
    },
    audience: {
      status: isAds && !aud.topCountries.length ? "empty" : "READY",
      topCountries: aud.topCountries.map(([label, value]) => ({ label, value })),
      ageGroups: aud.ageGroups.map(([label, value]) => ({ label, value })),
      genderSplit: aud.gender,
    },
    recentPosts: { status: recentPosts.length ? "READY" : "EMPTY", items: recentPosts, meta: { total: recentPosts.length, page: 1, limit: 10, totalPages: 1, hasNext: false, hasPrev: false } },
  };
}

// Competitor benchmark rows (not called by the current UI, kept for the reports section).
function competitorsReport(db, projectId) {
  return db.competitors.filter((c) => c.projectId === projectId).map((c) => {
    const r = rng(`competitor:${c.id}`);
    const profiles = Object.entries(c.platforms).map(([platform, followers]) => {
      const impressions = Math.round(followers * (0.04 + r() * 0.05) * 30);
      const engagements = Math.round(impressions * (0.02 + r() * 0.03));
      return { platform: reportPlatform(platform), followers, followersGained: Math.round(followers * (0.004 + r() * 0.01)), impressions, engagements, engagementRate: round((engagements / impressions) * 100, 2), postsPublished: 18 + Math.round(r() * 40) };
    });
    const sum = (k) => profiles.reduce((s, p) => s + p[k], 0);
    return { id: c.id, name: c.name, handle: c.handle, avatar: null, profiles, followers: sum("followers"), followersGained: sum("followersGained"), impressions: sum("impressions"), engagements: sum("engagements"), engagementRate: round((sum("engagements") / Math.max(1, sum("impressions"))) * 100, 2), postsPublished: sum("postsPublished"), createdAt: c.createdAt };
  });
}

module.exports = { series, resolvePeriod, overviewReport, profilesReport, integrationAnalytics, competitorsReport, totalsFor, METRICS };
