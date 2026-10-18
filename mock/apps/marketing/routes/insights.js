// Boost (paid promotion of published posts, ad executions) and analytics reports.
const { send, error, newId, nowIso, parseDate, listParam, paginate, boolParam, round, ymd, rng } = require("../lib");
const { meta, normPlatform, reportPlatform } = require("../catalog");
const analytics = require("../analytics");

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "CHF", "AED", "SAR", "QAR", "KWD", "JPY", "CNY", "HKD", "SGD", "INR", "TRY", "BRL", "MXN", "ZAR", "EGP"];
const OBJECTIVES = ["OUTCOME_AWARENESS", "OUTCOME_TRAFFIC", "OUTCOME_ENGAGEMENT", "OUTCOME_LEADS", "OUTCOME_APP_PROMOTION", "OUTCOME_SALES"];
const CTAS = ["LEARN_MORE", "SHOP_NOW", "SIGN_UP", "CONTACT_US", "BOOK_NOW", "APPLY_NOW", "DOWNLOAD", "GET_OFFER", "GET_QUOTE", "SUBSCRIBE", "WATCH_MORE"];
const SORTABLE = ["createdAt", "updatedAt", "scheduledAt", "startedAt", "budgetAmount"];

module.exports = function insightRoutes(app, { getDb, views, h, tick }) {
  // ---------------------------------------------------------------- boost
  app.post("/ads/boost", h.handle((req, res, u, project) => {
    const b = req.body || {};
    const db = getDb();
    let post = null;
    let target = null;
    for (const p of db.posts) {
      if (p.projectId !== project.id) continue;
      const t = p.targets.find((x) => x.id === b.unifiedPostTargetId) || (p.id === b.unifiedPostTargetId ? p.targets.find((x) => x.publishedAt) : null);
      if (t) { post = p; target = t; break; }
    }
    if (!target) return error(res, 404, "Post target not found in this brand");
    if (!target.publishedAt || target.isDeletedOnPlatform) return error(res, 422, "Only published posts can be boosted");
    const durationDays = Number(b.durationDays);
    const budgetAmount = Number(b.budgetAmount);
    const errors = {};
    if (!(durationDays >= 1 && durationDays <= 365)) errors.durationDays = ["Duration must be between 1 and 365 days"];
    if (!(budgetAmount >= 1)) errors.budgetAmount = ["Budget must be at least 1"];
    if (!CURRENCIES.includes(b.currency)) errors.currency = ["Unsupported currency"];
    if (!OBJECTIVES.includes(b.objective)) errors.objective = ["Unsupported objective"];
    if (!CTAS.includes(b.callToAction)) errors.callToAction = ["Unsupported call to action"];
    if (!listParam(b.placements).length) errors.placements = ["Select at least one placement"];
    if (Object.keys(errors).length) return error(res, 422, "Please fix the highlighted fields", { errors });
    const scheduleAt = b.startNow ? null : parseDate(b.scheduleAt);
    if (!b.startNow && !scheduleAt) return error(res, 422, "Choose a start date or start now");

    const integration = db.integrations.find((i) => i.id === target.integrationId);
    const now = nowIso();
    let failure = null;
    if (target.platform === "X") failure = "Boosting on X requires an X Ads account — none is linked to this profile.";
    else if (target.platform === "YOUTUBE") failure = "YouTube videos can only be promoted through a Google Ads video campaign.";
    else if (!integration?.isConnected) failure = `The ${meta(target.platform).name} account is disconnected. Reconnect it in Integrations and try again.`;
    else if (integration.requiresReconnect) failure = `${meta(target.platform).name} Ads API error 40105: access token expired. Reconnect the account and retry.`;
    const started = !failure && !!b.startNow;
    const e = {
      id: newId(), userId: u.id, projectId: project.id, unifiedPostTargetId: target.id, platform: target.platform,
      status: failure ? "FAILED" : started ? "ACTIVE" : "QUEUED", durationDays, budgetAmount, currency: b.currency, objective: b.objective, callToAction: b.callToAction,
      targeting: b.targeting || { geo_locations: { countries: ["EG"] } }, placements: listParam(b.placements), creativeOverrides: b.creativeOverrides || { actionButtonLabel: b.callToAction },
      platformData: { ...(b.platformData || {}), postTitle: post.title },
      scheduledAt: scheduleAt, startedAt: started ? now : null, completedAt: null, failedAt: failure ? now : null,
      externalCampaignId: started ? `23851${Date.now().toString().slice(-9)}` : null, externalAdSetId: started ? `23852${Date.now().toString().slice(-9)}` : null, externalAdId: started ? `23853${Date.now().toString().slice(-9)}` : null,
      errorMessage: failure, queueState: failure ? "failed" : started ? "completed" : "waiting", createdAt: now, updatedAt: now,
    };
    db.executions.push(e);
    if (failure) return send(res, e, `Boost could not start: ${failure}`, 201);
    send(res, e, started ? `Boost started — ${budgetAmount} ${b.currency} over ${durationDays} day${durationDays === 1 ? "" : "s"}` : "Boost scheduled", 201);
  }));

  app.get("/ads/executions", h.handle((req, res, u, project) => {
    tick();
    const q = req.query;
    const platforms = new Set(listParam(q.platforms).map(normPlatform));
    const statuses = new Set(listParam(q.statuses).map((s) => s.toUpperCase()));
    let list = getDb().executions.filter((e) => e.projectId === project.id);
    if (platforms.size) list = list.filter((e) => platforms.has(e.platform));
    if (statuses.size) list = list.filter((e) => statuses.has(e.status));
    if (boolParam(q.startedOnly)) list = list.filter((e) => e.startedAt);
    const sortBy = SORTABLE.includes(q.sortBy) ? q.sortBy : "createdAt";
    const dir = String(q.sortOrder || "DESC").toUpperCase() === "ASC" ? 1 : -1;
    const val = (e) => (sortBy === "budgetAmount" ? e.budgetAmount : e[sortBy] ? new Date(e[sortBy]).getTime() : dir === 1 ? Infinity : -Infinity);
    list = [...list].sort((a, b) => dir * (val(a) - val(b)));
    const { items, meta: m } = paginate(list, q, 10);
    const withPlatform = boolParam(q.includePlatformStatus);
    send(res, { items: items.map((e) => (withPlatform ? { ...e, platformStatus: e.status === "ACTIVE" ? "DELIVERING" : e.status } : e)), meta: m }, "Ad executions fetched successfully");
  }));

  app.get("/ads/executions/:id", h.handle((req, res, u, project) => {
    const e = getDb().executions.find((x) => x.id === req.params.id && x.projectId === project.id);
    if (!e) return h.notFound(res, "Ad execution");
    send(res, e, "Ad execution fetched successfully");
  }));

  // ---------------------------------------------------------------- analytics reports
  const reportQuery = (q) => ({
    periodStart: q.periodStart, periodEnd: q.periodEnd, compareStart: q.compareStart, compareEnd: q.compareEnd,
    platforms: listParam(q.platforms), profileIds: listParam(q.profileIds), sortBy: q.sortBy, sortOrder: q.sortOrder, source: q.source,
  });

  app.get("/analytics/reports/overview", h.handle((req, res, u, project) => {
    send(res, analytics.overviewReport(getDb(), project.id, reportQuery(req.query)), "Overview report generated");
  }));

  app.get("/analytics/reports/profiles", h.handle((req, res, u, project) => {
    send(res, analytics.profilesReport(getDb(), project.id, reportQuery(req.query)), "Profiles report generated");
  }));

  app.get("/analytics/reports/post-performance", h.handle((req, res, u, project) => {
    const db = getDb();
    const out = [];
    for (const p of db.posts) {
      if (p.projectId !== project.id) continue;
      for (const t of p.targets) {
        if (!t.publishedAt || !t.metrics) continue;
        const i = db.integrations.find((x) => x.id === t.integrationId);
        const mt = t.metrics;
        const image = i ? views.avatarFor(i) : null;
        out.push({
          id: t.id, projectId: project.id, platform: t.platform, source: p.imported ? "IMPORTED" : "PUBLISHED", profileId: i?.id || null, profileName: i?.account.displayName || "",
          profileImageUrl: image, pageName: i?.account.displayName || "", pageImageUrl: image, platformPostId: t.platformPostId, unifiedPostId: p.id, status: t.status,
          date: t.publishedAt, createdAt: t.createdAt, postContent: views.effectiveText(p, t), unifiedPostTitle: p.title, unifiedPostText: p.text,
          impressions: mt.impressions, impression: mt.impressions, avgReach: mt.reach, reach: mt.reach, engagements: mt.engagements,
          engagementRate: mt.reach ? round((mt.engagements / mt.reach) * 100, 2) : 0, likeCount: mt.likes, likes: mt.likes, commentCount: mt.comments, comments: mt.comments,
          replyCount: t.platform === "X" ? mt.comments : 0, replies: t.platform === "X" ? mt.comments : 0, shareCount: mt.shares, shares: mt.shares,
          retweetCount: t.platform === "X" ? mt.reposts : 0, retweets: t.platform === "X" ? mt.reposts : 0, saveCount: mt.saves, saves: mt.saves,
          stats: { likes: mt.likes, comments: mt.comments, replies: t.platform === "X" ? mt.comments : 0, shares: mt.shares, retweets: t.platform === "X" ? mt.reposts : 0, saves: mt.saves },
          mediaTypes: t.galleryIds.length ? ["IMAGE"] : ["TEXT"], url: views.postUrl(t),
        });
      }
    }
    out.sort((a, b) => new Date(b.date) - new Date(a.date));
    send(res, out, "Post performance fetched");
  }));

  // Followers / mentions / competitors: the current UI renders these screens from static data; these
  // endpoints exist so the reports can be wired to the mock later without new seed work.
  app.get("/analytics/reports/followers", h.handle((req, res, u, project) => {
    const db = getDb();
    const { start, end } = analytics.resolvePeriod(req.query);
    const items = db.integrations.filter((i) => i.projectId === project.id && i.platform !== "GOOGLE").map((i) => {
      const pts = analytics.series(db, i).filter((p) => p.date >= ymd(start) && p.date <= ymd(end));
      return { profileId: i.id, platform: reportPlatform(i.platform), profileName: i.account.displayName, followers: pts.at(-1)?.followers || 0, followersGained: pts.reduce((s, p) => s + p.followersGained, 0), series: pts.map((p) => ({ date: p.date, followers: p.followers, followersGained: p.followersGained })) };
    });
    send(res, { period: { start: start.toISOString(), end: end.toISOString() }, items }, "Followers report generated");
  }));

  app.get("/analytics/reports/mentions", h.handle((req, res, u, project) => {
    const r = rng(`mentions:${project.id}`);
    const people = [["Mariam Adel", "@mariam.cooks"], ["Ahmed Samir", "@a.samir"], ["Foodies of Cairo", "@foodiesofcairo"], ["Riyadh Eats", "@riyadheats"], ["Salma Yousry", "@salma.y"], ["Dubai Deals", "@dubaideals"]];
    const texts = [`Just tried the new ${project.name} range — honestly impressed 👏`, `@${project.slug} when is the next giveaway?`, `Shoutout to ${project.name} for the fast delivery today!`, `Comparing ${project.name} with the other brands this week — thread 🧵`, `Loving the ${project.name} campaign on TikTok 😂`, `${project.name} customer service sorted my order in 10 minutes ✅`];
    const items = people.map(([name, username], idx) => ({ id: `mention-${project.id.slice(0, 8)}-${idx}`, name, username, text: texts[idx], platform: ["X", "INSTAGRAM", "TIKTOK", "X", "FACEBOOK", "INSTAGRAM"][idx], sentiment: idx === 3 ? "NEUTRAL" : "POSITIVE", likes: Math.round(20 + r() * 900), replies: Math.round(r() * 80), reposts: Math.round(r() * 120), postedAt: new Date(Date.now() - (idx + 1) * 5.5 * 36e5).toISOString() }));
    send(res, { items, meta: { total: items.length, page: 1, limit: items.length, totalPages: 1, hasNext: false, hasPrev: false } }, "Mentions fetched");
  }));

  const competitors = h.handle((req, res, u, project) => send(res, analytics.competitorsReport(getDb(), project.id), "Competitors report generated"));
  app.get("/analytics/competitors", competitors);
  app.get("/analytics/reports/competitors", competitors);
};
