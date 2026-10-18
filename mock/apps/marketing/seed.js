// Seed data for the Digital Marketing mock. Everything is relative to "today" (local time) so the
// calendar, schedules and analytics always look current. Ids are deterministic (uuidFrom).
const { uuidFrom, at, rng } = require("./lib");
const { PLATFORMS } = require("./catalog");
const { GALLERY } = require("./media");

// Seeded people (identity user ids): admin=1 Mona, manager=2 Karim, customer=5 Nour (Nile Foods),
// u12=12 Dina (Marketing Specialist), u14=14 Hoda (Content Writer).
const U = { admin: 1, manager: 2, customer: 5, u12: 12, u14: 14 };

function buildEmptySeed() {
  return {
    marketingV3: require("./v3").empty(), projects: [], activeProject: {}, gallery: [], nextGalleryId: 1, labels: [], integrations: [],
    posts: [], postComments: [], campaigns: [], campaignComments: [], executions: [],
    audiences: [], segments: [], imports: [], senders: [], templates: [], competitors: [],
    oauthStates: {}, tempIntegrations: {}, ownershipTransfers: {},
  };
}

function buildSeed() {
  const db = buildEmptySeed();

  // ---------------------------------------------------------------- projects (brands)
  const P = {};
  const project = (key, name, slug, description, createdDay, memberUserIds) => {
    const p = {
      id: uuidFrom(`project:${key}`), key, userId: U.admin, name, slug, description,
      avatar: `/media/brand/${slug}.svg`, isActive: true, memberUserIds,
      timeZone: "Africa/Cairo", currency: key === "orgtik" ? "USD" : "EGP",
      createdAt: at(createdDay, 9, 0), updatedAt: at(createdDay + 3, 12, 0),
    };
    db.projects.push(p);
    P[key] = p;
    return p;
  };
  project("nile", "Nile Foods", "nile-foods", "Egyptian FMCG food brand — ready meals, sweets and pantry staples in Egypt, KSA and the UAE.", -240, [U.admin, U.manager, U.customer, U.u12, U.u14]);
  project("orgtik", "OrgTik", "orgtik", "OrgTik suite brand marketing — B2B SaaS for teams in Egypt and the GCC.", -300, [U.admin, U.manager, U.u12, U.u14]);
  project("sahel", "Sahel Resorts", "sahel-resorts", "Beach resorts on the North Coast and the Red Sea (Sidi Abdel Rahman, Hurghada).", -120, [U.admin, U.manager, U.u12, U.u14]);

  // ---------------------------------------------------------------- gallery
  const G = {};
  GALLERY.forEach((g, i) => {
    const item = {
      id: db.nextGalleryId++, projectId: P[g.project === "nile" ? "nile" : g.project].id, slug: g.slug,
      path: `/media/seed/${g.slug}.svg`, alt: `${g.title} — ${g.sub}`, uploadedBy: [U.u14, U.u12, U.manager][i % 3],
      created_at: at(-60 + i * 2, 10 + (i % 6), 15), updated_at: at(-60 + i * 2, 10 + (i % 6), 15),
    };
    db.gallery.push(item);
    G[g.slug] = item;
  });

  // ---------------------------------------------------------------- labels
  const L = {};
  const label = (pk, name, color, day) => {
    const l = { id: uuidFrom(`label:${pk}:${name}`), projectId: P[pk].id, userId: U.u12, name, color, createdAt: at(day, 11, 0), updatedAt: at(day, 11, 0) };
    db.labels.push(l);
    L[`${pk}:${name}`] = l;
  };
  [["Recipes", "#F97316"], ["Promotions", "#EF4444"], ["Ramadan", "#7C3AED"], ["White Friday", "#111827"], ["KSA Market", "#16A34A"], ["UGC", "#0EA5E9"], ["Product Launch", "#DB2777"], ["Seasonal", "#CA8A04"]]
    .forEach(([n, c], i) => label("nile", n, c, -200 + i * 9));
  [["Product", "#8135CD"], ["Events", "#2563EB"], ["Hiring", "#F59E0B"], ["Customer Stories", "#059669"]].forEach(([n, c], i) => label("orgtik", n, c, -250 + i * 12));
  [["Offers", "#F97316"], ["Summer", "#EAB308"], ["Family", "#3B82F6"]].forEach(([n, c], i) => label("sahel", n, c, -100 + i * 10));

  // ---------------------------------------------------------------- integrations (connected profiles)
  const I = {};
  const integ = (pk, platform, a) => {
    const m = PLATFORMS[platform];
    const id = uuidFrom(`integration:${pk}:${platform}`);
    const connectedAt = at(a.connectedDay ?? -200, 10, 30);
    const res = (capability, resourceType, type, displayName, externalId, extra = {}) => ({
      id: uuidFrom(`resource:${pk}:${platform}:${capability}:${externalId}`), capability, backingCapability: capability,
      resourceType, type, externalId: String(externalId), parentExternalId: extra.parent || null, displayName,
      handleOrCode: extra.handle || a.handle, currency: extra.currency || null, isSelectable: true, isSelected: extra.selected !== false,
      metadata: { derivedFromProfile: capability === "ANALYTICS", source: platform === "GOOGLE" ? "google_ads_api" : "graph_api" },
      lastSyncedAt: at(-1, 6, 0),
    });
    const resources = [];
    if (m.publish) resources.push(res("PUBLISHING", `${platform}_${m.resourceType}`, m.resourceType, a.displayName, a.externalId));
    if (m.ads && a.adAccount) resources.push(res("ADS", `${platform}_AD_ACCOUNT`, "AD_ACCOUNT", a.adAccount.name, a.adAccount.id, { currency: a.adAccount.currency, handle: a.adAccount.id }));
    resources.push(res("ANALYTICS", `${platform}_INSIGHTS`, "INSIGHTS", `${a.displayName} Insights`, `${a.externalId}-insights`, { parent: a.externalId }));
    if (m.messaging && a.messaging) resources.push(res("MESSAGING", `${platform}_INBOX`, "INBOX", `${a.displayName} Inbox`, `${a.externalId}-inbox`, { parent: a.externalId }));
    const granted = a.missingScopes ? m.scopes.filter((s) => !a.missingScopes.includes(s)) : [...m.scopes];
    const i = {
      id, projectId: P[pk].id, platform, status: a.connected === false ? "DISCONNECTED" : "CONNECTED", isConnected: a.connected !== false,
      requiresReconnect: !!a.requiresReconnect,
      account: {
        displayName: a.displayName, handle: a.handle, externalId: String(a.externalId), category: a.category, websiteUrl: a.websiteUrl || null,
        email: a.email, followers: a.followers, following: a.following ?? 120, basePosts: a.basePosts ?? 400, color: a.color || m.color,
      },
      requiredScopes: [...m.scopes], grantedScopes: granted, resources,
      connectedAt, expiresAt: a.requiresReconnect ? at(-3, 0, 0) : m.requiresRefreshToken ? at(45, 0, 0) : at(58, 0, 0),
      lastSyncedAt: a.requiresReconnect ? at(-6, 4, 12) : at(-1, 6, 0), connectedByUserId: U.u12,
      audience: a.audience, createdAt: connectedAt, updatedAt: at(-1, 6, 0),
    };
    db.integrations.push(i);
    I[`${pk}:${platform}`] = i;
    return i;
  };
  const EG_AUDIENCE = { topCountries: [["Egypt", 58], ["Saudi Arabia", 21], ["United Arab Emirates", 9], ["Kuwait", 5], ["Qatar", 3]], ageGroups: [["18-24", 24], ["25-34", 38], ["35-44", 22], ["45-54", 11], ["55+", 5]], gender: { male: 41, female: 57, unknown: 2 } };
  integ("nile", "FACEBOOK", { displayName: "Nile Foods Egypt", handle: "NileFoodsEG", externalId: 104839205571, category: "Food & Beverage Company", websiteUrl: "https://nilefoods.com", email: "social@nilefoods.com", followers: 482300, following: 86, basePosts: 3120, adAccount: { name: "Nile Foods — Meta Ads (SAR)", id: "act_2231840917745", currency: "SAR" }, messaging: true, connectedDay: -210, audience: EG_AUDIENCE });
  integ("nile", "INSTAGRAM", { displayName: "Nile Foods", handle: "nilefoods.eg", externalId: 17841402983311, category: "Food & Beverage", websiteUrl: "https://nilefoods.com/links", email: "social@nilefoods.com", followers: 216800, following: 312, basePosts: 1840, adAccount: { name: "Nile Foods — Meta Ads (SAR)", id: "act_2231840917745", currency: "SAR" }, messaging: true, connectedDay: -210, audience: { ...EG_AUDIENCE, gender: { male: 33, female: 65, unknown: 2 } } });
  integ("nile", "X", { displayName: "Nile Foods", handle: "NileFoodsEG", externalId: 1283904417552, category: "Food", websiteUrl: "https://nilefoods.com", email: "social@nilefoods.com", followers: 38900, following: 540, basePosts: 5210, connectedDay: -180, audience: { ...EG_AUDIENCE, gender: { male: 61, female: 37, unknown: 2 } } });
  integ("nile", "LINKEDIN", { displayName: "Nile Foods Group", handle: "nile-foods-group", externalId: 71420985, category: "Food and Beverage Manufacturing", websiteUrl: "https://nilefoods.com/careers", email: "hr@nilefoods.com", followers: 24600, following: 0, basePosts: 410, adAccount: { name: "Nile Foods — LinkedIn Ads", id: "508812347", currency: "USD" }, connectedDay: -170, audience: { topCountries: [["Egypt", 71], ["Saudi Arabia", 14], ["United Arab Emirates", 8], ["Germany", 3], ["United Kingdom", 2]], ageGroups: [["18-24", 12], ["25-34", 44], ["35-44", 28], ["45-54", 12], ["55+", 4]], gender: { male: 55, female: 44, unknown: 1 } } });
  integ("nile", "TIKTOK", { displayName: "Nile Foods", handle: "nilefoods", externalId: 6982205511, category: "Food & Drink", websiteUrl: null, email: "social@nilefoods.com", followers: 311500, following: 48, basePosts: 620, adAccount: { name: "Nile Foods — TikTok Ads (AED)", id: "7239910045521", currency: "AED" }, requiresReconnect: true, missingScopes: ["user.info.stats"], connectedDay: -150, audience: { topCountries: [["Egypt", 49], ["Saudi Arabia", 27], ["United Arab Emirates", 12], ["Kuwait", 6], ["Jordan", 3]], ageGroups: [["18-24", 46], ["25-34", 33], ["35-44", 14], ["45-54", 5], ["55+", 2]], gender: { male: 38, female: 60, unknown: 2 } } });
  integ("nile", "YOUTUBE", { displayName: "Nile Foods Kitchen", handle: "NileFoodsKitchen", externalId: "UC7xNileFoodsKitchen01", category: "Howto & Style", websiteUrl: "https://nilefoods.com/recipes", email: "social@nilefoods.com", followers: 58400, following: 0, basePosts: 212, connectedDay: -160, audience: EG_AUDIENCE });
  integ("nile", "GOOGLE", { displayName: "Nile Foods KSA — Google Ads", handle: "482-915-3307", externalId: 4829153307, category: "Google Ads account", websiteUrl: "https://nilefoods.com/ksa", email: "ads@nilefoods.com", followers: 0, following: 0, basePosts: 0, adAccount: { name: "Nile Foods KSA (482-915-3307)", id: "482-915-3307", currency: "SAR" }, connectedDay: -140, audience: { topCountries: [["Saudi Arabia", 78], ["United Arab Emirates", 15], ["Kuwait", 4], ["Bahrain", 2], ["Qatar", 1]], ageGroups: [["18-24", 18], ["25-34", 41], ["35-44", 26], ["45-54", 11], ["55+", 4]], gender: { male: 52, female: 46, unknown: 2 } } });

  const OT_AUDIENCE = { topCountries: [["Egypt", 52], ["United Arab Emirates", 22], ["Saudi Arabia", 16], ["Jordan", 5], ["Germany", 3]], ageGroups: [["18-24", 9], ["25-34", 46], ["35-44", 31], ["45-54", 11], ["55+", 3]], gender: { male: 63, female: 36, unknown: 1 } };
  integ("orgtik", "LINKEDIN", { displayName: "OrgTik", handle: "orgtik", externalId: 90331472, category: "Software Development", websiteUrl: "https://orgtik.com", email: "marketing@orgtik.com", followers: 12400, following: 0, basePosts: 260, adAccount: { name: "OrgTik — LinkedIn Ads", id: "511203398", currency: "USD" }, connectedDay: -280, audience: OT_AUDIENCE });
  integ("orgtik", "X", { displayName: "OrgTik", handle: "OrgTikHQ", externalId: 1622039958, category: "Software", websiteUrl: "https://orgtik.com", email: "marketing@orgtik.com", followers: 3900, following: 210, basePosts: 690, connectedDay: -270, audience: OT_AUDIENCE });
  integ("orgtik", "FACEBOOK", { displayName: "OrgTik", handle: "OrgTikHQ", externalId: 109922340187, category: "Software Company", websiteUrl: "https://orgtik.com", email: "marketing@orgtik.com", followers: 8700, following: 12, basePosts: 330, adAccount: { name: "OrgTik — Meta Ads (USD)", id: "act_8830021994", currency: "USD" }, messaging: true, connectedDay: -260, audience: OT_AUDIENCE });
  integ("orgtik", "GOOGLE", { displayName: "OrgTik — Google Ads", handle: "731-204-8816", externalId: 7312048816, category: "Google Ads account", websiteUrl: "https://orgtik.com", email: "ads@orgtik.com", followers: 0, following: 0, basePosts: 0, adAccount: { name: "OrgTik (731-204-8816)", id: "731-204-8816", currency: "USD" }, connectedDay: -250, audience: OT_AUDIENCE });

  const SR_AUDIENCE = { topCountries: [["Egypt", 64], ["Germany", 11], ["Italy", 8], ["Saudi Arabia", 7], ["United Kingdom", 5]], ageGroups: [["18-24", 14], ["25-34", 35], ["35-44", 29], ["45-54", 15], ["55+", 7]], gender: { male: 45, female: 54, unknown: 1 } };
  integ("sahel", "INSTAGRAM", { displayName: "Sahel Resorts", handle: "sahelresorts", externalId: 17841455120981, category: "Hotel & Resort", websiteUrl: "https://sahelresorts.com", email: "social@sahelresorts.com", followers: 64200, following: 190, basePosts: 880, adAccount: { name: "Sahel Resorts — Meta Ads (EUR)", id: "act_5511092837", currency: "EUR" }, connectedDay: -110, audience: SR_AUDIENCE });
  integ("sahel", "FACEBOOK", { displayName: "Sahel Resorts & Spa", handle: "SahelResorts", externalId: 108122099431, category: "Resort", websiteUrl: "https://sahelresorts.com", email: "social@sahelresorts.com", followers: 91500, following: 40, basePosts: 1210, adAccount: { name: "Sahel Resorts — Meta Ads (EUR)", id: "act_5511092837", currency: "EUR" }, messaging: true, connectedDay: -110, audience: SR_AUDIENCE });
  integ("sahel", "TIKTOK", { displayName: "Sahel Resorts", handle: "sahelresorts", externalId: 7012299341, category: "Travel", websiteUrl: null, email: "social@sahelresorts.com", followers: 22800, following: 15, basePosts: 95, connected: false, connectedDay: -90, audience: SR_AUDIENCE });

  // ---------------------------------------------------------------- posts
  const POST = {};
  const post = (pk, key, s) => {
    const p = P[pk];
    const id = uuidFrom(`post:${key}`);
    const when = s.day != null ? at(s.day, s.hh ?? 10, s.mm ?? 0) : null;
    const createdAt = s.day != null && s.day < 0 ? at(s.day - 3, 11, 20) : at(-2 - (hashNum(key) % 6), 9 + (hashNum(key) % 8), 5);
    const reviewers = (s.reviewers || []).map(([userKey, status, day, note]) => ({
      userId: U[userKey], status, note: note || null, decidedAt: status === "PENDING" ? null : at(day ?? -1, 15, 10), assignedByUserId: U.u14,
    }));
    const targets = s.targets.map((t, ti) => {
      const tp = typeof t === "string" ? { platform: t } : t;
      const integration = I[`${pk}:${tp.platform}`];
      const published = s.status === "PUBLISHED" || s.status === "PARTIAL" ? !tp.error : false;
      return {
        id: uuidFrom(`target:${key}:${tp.platform}`), platform: tp.platform, integrationId: integration?.id || null, contentType: tp.contentType || "POST",
        useMasterText: !tp.text, textOverride: tp.text || null, useMasterMedia: !tp.gallery, galleryIds: (tp.gallery || s.gallery || []).map((g) => G[g].id),
        scheduledAt: tp.scheduledAt || null, status: tp.error ? "FAILED" : published ? "PUBLISHED" : s.status === "FAILED" ? "FAILED" : s.status,
        errorMessage: tp.error || null, publishedAt: published ? when : null,
        platformPostId: published ? `${String(integration?.account.externalId || "1").slice(-6)}${String(900000 + ti * 1373 + key.length * 97)}` : null,
        isDeletedOnPlatform: false, platformDeletedAt: null, platformDeletedBy: null, platformDeleteStatus: "NONE", platformDeleteError: null,
        lastSyncedAt: published ? at(-1, 6, 0) : null, lastSyncError: null, metrics: null,
        createdAt, updatedAt: when || createdAt,
      };
    });
    const hasReviewers = reviewers.length > 0;
    const allApproved = hasReviewers && reviewers.every((r) => r.status === "APPROVED");
    const anyRejected = reviewers.some((r) => r.status === "REJECTED");
    const item = {
      id, key, projectId: p.id, userId: s.author ?? U.u14, title: s.title, text: s.text,
      status: s.status, // DRAFT | PENDING | SCHEDULED | PUBLISHED | FAILED | PARTIAL | CANCELED
      approvalStatus: !hasReviewers ? "NOT_REQUIRED" : anyRejected ? "REJECTED" : allApproved ? "APPROVED" : "PENDING_APPROVAL",
      workflowState: s.workflowState || null, reApproveRequired: !!s.reapproval,
      approvalNotes: s.approvalNote || null, approvalVersion: s.approvalVersion ?? (hasReviewers ? 1 : 0),
      approvalRequest: hasReviewers ? { note: s.approvalNote || "", sentAt: at(s.requestDay ?? -2, 10, 45), sentByUserId: s.author ?? U.u14, reviewers } : null,
      lastApprovedSnapshot: s.snapshot || null, lastContentEditedAt: s.reapproval ? at(-1, 11, 50) : null, lastMissedScheduleAt: null,
      scheduledAt: s.status === "DRAFT" && !s.planned ? null : when, publishedAt: s.status === "PUBLISHED" || s.status === "PARTIAL" ? when : null,
      contentMode: s.contentMode || "SYNC", publishMode: s.publishMode || (s.status === "DRAFT" ? "DRAFT" : "SCHEDULED"),
      requestApproval: hasReviewers, labelIds: (s.labels || []).map((n) => L[`${pk}:${n}`].id), campaignIds: [],
      targets, imported: !!s.imported, createdAt, updatedAt: s.reapproval ? at(-1, 11, 50) : when && s.day < 0 ? when : createdAt,
    };
    // Approved content keeps a snapshot so "rollback to last approved" has something to restore.
    const snapshotOf = (x) => ({
      title: x.title, text: x.text, labelIds: [...x.labelIds],
      targets: x.targets.map((t) => ({ id: t.id, textOverride: t.textOverride, useMasterText: t.useMasterText, galleryIds: [...t.galleryIds] })),
      approvedAt: at(-1, 15, 10), approvalVersion: 1,
    });
    if (s.snapshot) item.lastApprovedSnapshot = { ...snapshotOf(item), ...s.snapshot, labelIds: [...item.labelIds], targets: snapshotOf(item).targets };
    else if (allApproved) item.lastApprovedSnapshot = snapshotOf(item);
    // Scheduled posts with approved reviewers look "APPROVED"; drafts after rejection keep the history.
    if (!item.workflowState) {
      item.workflowState = {
        DRAFT: anyRejected ? "REJECTED" : "DRAFT", PENDING: "AWAITING_REVIEW", SCHEDULED: "SCHEDULED_APPROVED", PUBLISHED: "PUBLISHED", FAILED: "FAILED", PARTIAL: "PARTIAL", CANCELED: "CANCELED",
      }[s.status];
    }
    db.posts.push(item);
    POST[key] = item;
    return item;
  };

  // Nile Foods — published / synced history
  post("nile", "nf-01", { day: -44, hh: 19, status: "PUBLISHED", imported: true, title: "Throwback: our first Ramadan table", text: "Throwback to our very first Ramadan campaign in 2019 — 12 dishes, one long table and a lot of love. Which Nile Foods dish is on your Iftar table every year? 🌙", targets: ["INSTAGRAM"], gallery: ["iftar-box"], labels: ["Ramadan"] });
  post("nile", "nf-02", { day: -40, hh: 13, status: "PUBLISHED", title: "Mango season is officially here 🥭", text: "Mango season is officially here 🥭 Our Ewais mango juice is back — cold-pressed, no added sugar, and only in stores until October. Tag the friend who drinks it straight from the bottle 👇 #NileFoods #MangoSeason", targets: ["FACEBOOK", "INSTAGRAM"], gallery: ["mango-season"], labels: ["Seasonal"] });
  post("nile", "nf-03", { day: -37, hh: 20, status: "PUBLISHED", imported: true, title: "How we make molokhia at scale", text: "From the farm in Beheira to your plate: a 4-minute look at how our molokhia is picked, chopped and frozen within 6 hours.", targets: [{ platform: "YOUTUBE", contentType: "VIDEO" }], gallery: ["factory-tour"] });
  post("nile", "nf-04", { day: -35, hh: 12, mm: 30, status: "PUBLISHED", title: "Koshary Friday: pick your layer", text: "It's Koshary Friday! 🍲 Rice, lentils, pasta, chickpeas, crispy onions and that garlic-vinegar dakka. Which layer would you never skip? Vote in the comments ⬇️ #KosharyFriday", targets: ["FACEBOOK", "INSTAGRAM", { platform: "X", text: "Koshary Friday 🍲 Which layer would you never skip — the crispy onions or the dakka? #KosharyFriday" }], gallery: ["koshary-friday"], labels: ["Recipes", "UGC"], contentMode: "PER_PLATFORM" });
  post("nile", "nf-05", { day: -30, hh: 9, status: "PUBLISHED", title: "Back-to-school lunchbox: 5 ideas kids actually eat", text: "School's back! 🎒 5 lunchbox ideas kids actually finish: mini feteer bites, chicken shawarma wraps, cheese sambousek, fruit skewers and our new date bars. Save this post for Sunday prep ✅", targets: ["FACEBOOK", "INSTAGRAM", { platform: "TIKTOK", contentType: "VIDEO" }], gallery: ["lunchbox-pack"], labels: ["Recipes", "Seasonal"], reviewers: [["customer", "APPROVED", -32]], requestDay: -33 });
  post("nile", "nf-06", { day: -28, hh: 18, status: "PUBLISHED", author: U.u12, title: "Inside our 10th of Ramadan kitchen", text: "Quality from farm to fork. This week we opened the doors of our 10th of Ramadan City kitchen to 40 retail partners — 3 production lines, 1,200 colleagues and ISO 22000 certified since 2021. Thank you to everyone who joined the tour.", targets: ["LINKEDIN", { platform: "YOUTUBE", contentType: "VIDEO" }], gallery: ["factory-tour"] });
  post("nile", "nf-07", { day: -25, hh: 19, mm: 30, status: "PUBLISHED", title: "60-second Shakshuka", text: "60-second Shakshuka 🍳 Tomatoes, peppers, cumin and 4 eggs — breakfast done before the kettle boils. Full recipe on our YouTube channel. #NileFoodsKitchen #Shakshuka", targets: [{ platform: "INSTAGRAM", contentType: "REEL" }, { platform: "TIKTOK", contentType: "VIDEO" }, { platform: "YOUTUBE", contentType: "SHORT" }], gallery: ["shakshuka-reel"], labels: ["Recipes"] });
  post("nile", "nf-08", { day: -21, hh: 8, status: "PUBLISHED", title: "Ful medames: the Cairo breakfast ritual", text: "Nothing says Cairo morning like a plate of ful medames with olive oil, cumin and a squeeze of lemon. Our slow-cooked fava beans are ready in 3 minutes — no overnight soaking needed 🫘", targets: ["FACEBOOK", "X"], gallery: ["ful-medames"], labels: ["Recipes"] });
  post("nile", "nf-09", { day: -18, hh: 17, status: "PUBLISHED", title: "Lunchbox tip #2: feteer bites", text: "Lunchbox tip #2 🥐 Cut a frozen Nile Foods feteer into squares, bake for 12 minutes and pack with labneh and cucumber. Crunchy at 10 AM, still crunchy at break time.", targets: ["INSTAGRAM", "FACEBOOK"], gallery: ["feteer-meshaltet"], labels: ["Recipes"] });
  post("nile", "nf-10", { day: -14, hh: 16, status: "PARTIAL", title: "Protein bar pre-launch teaser", text: "Something new is coming to the snack aisle 👀 20g protein, dates and tahini, zero added sugar. Guess the flavour in the comments and win a box!", targets: ["INSTAGRAM", { platform: "TIKTOK", contentType: "VIDEO", error: "TikTok rejected the upload: video duration must be between 3 and 600 seconds (uploaded file is 1.2 seconds)." }], gallery: ["protein-bar-launch"], labels: ["Product Launch"] });
  post("nile", "nf-11", { day: -10, hh: 20, status: "PUBLISHED", title: "Weekend giveaway winners 🎉", text: "Congratulations to the 10 winners of our weekend giveaway! 🎉 Please check your DMs to claim your Nile Foods hamper. Thank you to the 8,400 of you who entered.", targets: ["FACEBOOK"], gallery: ["customer-review"], labels: ["UGC", "Promotions"] });
  post("nile", "nf-12", { day: -6, hh: 12, status: "PUBLISHED", author: U.u12, title: "Happy Saudi National Day 🇸🇦", text: "Happy Saudi National Day 96 🇸🇦 كل عام والمملكة بخير. Celebrate with 25% off all Nile Foods ready meals in Riyadh, Jeddah and Dammam — this weekend only.", targets: ["FACEBOOK", "INSTAGRAM", "X"], gallery: ["saudi-national-day"], labels: ["KSA Market", "Promotions"], reviewers: [["manager", "APPROVED", -8]], requestDay: -9 });
  post("nile", "nf-13", { day: -5, hh: 21, status: "PUBLISHED", title: "Hawawshi night", text: "Hawawshi night 🔥 Spiced minced beef baked in crispy baladi bread — share it with the friend who still owes you dinner. Find it in the frozen aisle.", targets: ["FACEBOOK", "INSTAGRAM"], gallery: ["hawawshi-night"], labels: ["Recipes"] });
  post("nile", "nf-14", { day: -3, hh: 14, status: "PUBLISHED", title: "“Tastes like home” — Mariam from Alexandria", text: "“Tastes like home.” Mariam from Alexandria sent us this after trying our molokhia for the first time in Riyadh. Reviews like this are why we do what we do ❤️ 4.9★ from 12,000+ reviews.", targets: ["FACEBOOK", "LINKEDIN"], gallery: ["customer-review"], labels: ["UGC"] });
  post("nile", "nf-15", { day: -2, hh: 11, status: "FAILED", title: "Lunchbox tip #3: Om Ali mini cups", text: "Lunchbox tip #3 🍮 Om Ali mini cups: puff pastry, milk, nuts and raisins baked in muffin tins. The sweetest way to end a school week.", targets: [{ platform: "INSTAGRAM", error: "Instagram API error (code 36003): media aspect ratio is not supported — images must be between 4:5 and 1.91:1." }, { platform: "TIKTOK", contentType: "VIDEO", error: "Access token expired. Reconnect the TikTok account in Integrations and try again." }], gallery: ["om-ali-kit"], labels: ["Recipes"] });
  post("nile", "nf-16", { day: -1, hh: 10, status: "PUBLISHED", author: U.u12, title: "Ready meals now in Riyadh & Jeddah", text: "Big news for KSA 🇸🇦 Nile Foods ready meals are now in Panda, Danube and Tamimi stores across Riyadh and Jeddah. Dinner in 5 minutes — molokhia, mahshi, kofta and more.", targets: ["FACEBOOK", "X", "LINKEDIN"], gallery: ["frozen-ready-meals"], labels: ["KSA Market", "Product Launch"] });
  // Nile Foods — upcoming, approvals, re-approval
  post("nile", "nf-17", { day: 2, hh: 13, status: "SCHEDULED", title: "Molokhia, mom's way", text: "Molokhia, mom's way 💚 Garlic, coriander and that famous 'shahka' — ready in 15 minutes with Nile Foods frozen molokhia. What do you serve it with: rice or bread?", targets: ["FACEBOOK", "INSTAGRAM"], gallery: ["molokhia-classic"], labels: ["Recipes"] });
  post("nile", "nf-18", { day: 4, hh: 18, status: "SCHEDULED", title: "Pink October: early detection saves lives", text: "This October, Nile Foods is going pink 🎗️ For every pack sold this month we donate 1 EGP to breast cancer early-detection programmes in Egypt. Book your screening — it takes 20 minutes.", targets: ["FACEBOOK", "INSTAGRAM", "LINKEDIN"], gallery: ["pink-october"], labels: ["Seasonal"], reviewers: [["manager", "APPROVED", -1], ["customer", "APPROVED", -1]], approvalNote: "Pink October partnership post — legal already reviewed the donation claim.", requestDay: -2 });
  post("nile", "nf-19", { day: 6, hh: 19, status: "PENDING", title: "Protein Bar launch day", text: "It's here 💪 The new Nile Protein Bar — 20g protein, dates and tahini, zero added sugar. Available now at Carrefour, Spinneys and on the Nile Foods app. #NileProtein", targets: ["FACEBOOK", "INSTAGRAM", { platform: "TIKTOK", contentType: "VIDEO" }, "X"], gallery: ["protein-bar-launch"], labels: ["Product Launch"], reviewers: [["manager", "APPROVED", -1], ["customer", "PENDING"]], approvalNote: "Final launch-day copy — please double-check the retailer list and the price claim." });
  post("nile", "nf-20", { day: 9, hh: 10, status: "SCHEDULED", title: "Weekend feteer special", text: "Weekend special 🥐 Buy 2 Feteer Meshaltet packs, get 1 free — this Friday and Saturday only at all Nile Foods outlets.", targets: ["FACEBOOK"], gallery: ["feteer-meshaltet"], labels: ["Promotions"] });
  post("nile", "nf-21", { day: 12, hh: 20, status: "SCHEDULED", author: U.u12, title: "5-minute dinner, KSA edition", text: "Late shift? 🌙 Dinner in 5 minutes: heat, plate, done. Nile Foods ready meals — now delivered in Riyadh and Jeddah within 60 minutes.", targets: ["FACEBOOK", "INSTAGRAM"], gallery: ["frozen-ready-meals"], labels: ["KSA Market"] });
  post("nile", "nf-22", { day: 17, hh: 9, status: "PENDING", title: "World Food Day: 5 zero-waste kitchen tips", text: "World Food Day 🌍 5 zero-waste tips from our chefs: 1) freeze herbs in olive oil 2) turn stale bread into fattah 3) pickle veggie stems 4) plan a leftovers night 5) compost coffee grounds. Which one will you try?", targets: ["FACEBOOK", "INSTAGRAM", "LINKEDIN"], gallery: ["world-food-day"], labels: ["Seasonal"], reviewers: [["admin", "PENDING"], ["u12", "APPROVED", -1]], approvalNote: "Please double-check the tips with the sustainability team before approving." });
  post("nile", "nf-23", { day: 30, hh: 12, status: "PENDING", title: "White Friday is coming — early access", text: "White Friday is coming ⚡ Nile Club members get 24-hour early access to up to 50% off. Sign up on the app before Nov 18 so you don't miss out.", targets: ["FACEBOOK", "INSTAGRAM", "X", { platform: "TIKTOK", contentType: "VIDEO" }], gallery: ["white-friday-50"], labels: ["White Friday", "Promotions"], reviewers: [["admin", "PENDING"], ["manager", "PENDING"]], approvalNote: "Teaser for the White Friday early-access list." });
  post("nile", "nf-24", {
    day: 52, hh: 8, status: "PENDING", reapproval: true, workflowState: "REAPPROVAL_REQUIRED", approvalVersion: 2,
    title: "White Friday Day 1 — up to 50% off", text: "White Friday is LIVE 🛒 Up to 50% off ready meals, sweets and pantry staples — today only on the Nile Foods app. Free delivery on orders over 500 EGP.",
    targets: ["FACEBOOK", "INSTAGRAM", { platform: "TIKTOK", contentType: "VIDEO" }], gallery: ["white-friday-50"], labels: ["White Friday"],
    reviewers: [["manager", "PENDING"], ["customer", "PENDING"]], approvalNote: "Free-delivery threshold changed from 300 to 500 EGP — needs re-approval.",
    snapshot: { title: "White Friday Day 1 — up to 50% off", text: "White Friday is LIVE 🛒 Up to 50% off ready meals, sweets and pantry staples — today only on the Nile Foods app. Free delivery on orders over 300 EGP.", labelIds: [], approvedAt: at(-4, 16, 30), approvalVersion: 1, targets: [] },
  });
  // Nile Foods — drafts (one rejected)
  post("nile", "nf-25", { status: "DRAFT", title: "Iftar Box 2027 teaser", text: "Ramadan 2027 is 4 months away and our Iftar Box is already in the test kitchen 🌙 Help us choose this year's dessert: kunafa, basbousa or qatayef?", targets: ["FACEBOOK"], gallery: ["iftar-box"], labels: ["Ramadan"] });
  post("nile", "nf-26", { status: "DRAFT", title: "Poll: koshary or hawawshi?", text: "Settle this once and for all: Friday lunch is 🍲 koshary or 🔥 hawawshi?", targets: ["X"], labels: ["UGC"] });
  post("nile", "nf-27", { day: 8, hh: 16, planned: true, status: "DRAFT", title: "Om Ali dessert kit — the perfect gift", text: "Visiting family this weekend? Bring the Om Ali dessert kit — serves 6 and bakes in 20 minutes 🍮", targets: ["INSTAGRAM"], gallery: ["om-ali-kit"], labels: ["Promotions"], reviewers: [["customer", "REJECTED", -2, "Please use the new packaging photo before we publish."]], approvalNote: "Gift-season push for the dessert kit." , requestDay: -3 });
  post("nile", "nf-28", { status: "DRAFT", author: U.u12, title: "We're hiring food technologists", text: "We're hiring! Nile Foods is looking for 3 food technologists to join our R&D team in 10th of Ramadan City. Experience with HACCP and new product development is a plus. Apply via the link in the comments.", targets: ["LINKEDIN"] });
  // OrgTik
  post("orgtik", "ot-01", { day: -20, hh: 11, status: "PUBLISHED", author: U.u12, title: "One suite for every team — meet OrgTik", text: "One suite for every team 🚀 HR, tasks, sales, files and marketing — connected by a single sign-on and one source of truth. Built in Cairo for teams across the Middle East.", targets: ["LINKEDIN", "X", "FACEBOOK"], gallery: ["orgtik-suite-launch"], labels: ["Product"] });
  post("orgtik", "ot-02", { day: -9, hh: 10, status: "PUBLISHED", title: "Customer story: Delta Pharma", text: "How Delta Pharma cut employee onboarding time by 43% with OrgTik HR: digital contracts, automated equipment requests and a 5-step approval flow instead of 14 emails. Full story 👇", targets: ["LINKEDIN"], gallery: ["delta-pharma-story"], labels: ["Customer Stories"] });
  post("orgtik", "ot-03", { day: -4, hh: 12, status: "PUBLISHED", title: "We're hiring in Cairo", text: "We're hiring in Cairo 🇪🇬 Backend (Node.js), Frontend (Next.js) and QA engineers. Hybrid, New Cairo office, great tea. DM us or apply on our careers page.", targets: ["LINKEDIN", "X"], gallery: ["hiring-cairo"], labels: ["Hiring"] });
  post("orgtik", "ot-04", { day: 3, hh: 14, status: "SCHEDULED", title: "Webinar: automate your approvals", text: "Free webinar on Oct 8 at 2 PM Cairo time: how to automate approvals across HR, finance and marketing — live demo and Q&A with our product team. Seats are limited.", targets: ["LINKEDIN", "X"], gallery: ["webinar-approvals"], labels: ["Events"] });
  post("orgtik", "ot-05", { day: 7, hh: 10, status: "PENDING", title: "GITEX Global 2026 — Hall 7, Stand B42", text: "We're heading to GITEX Global 2026 in Dubai! 🇦🇪 Visit us in Hall 7, Stand B42 (Oct 12–16) for live demos of OrgTik Marketing and a coffee on us ☕", targets: ["LINKEDIN", "X", "FACEBOOK"], gallery: ["gitex-2026"], labels: ["Events"], reviewers: [["admin", "PENDING"], ["manager", "APPROVED", -1]], approvalNote: "Stand number confirmed — ready for sign-off." });
  post("orgtik", "ot-06", { status: "DRAFT", title: "Product update: approvals in Marketing", text: "New in OrgTik Marketing: multi-step approvals for posts and campaigns, with rollback to the last approved version. Rolling out to all workspaces this week.", targets: ["LINKEDIN"], gallery: ["orgtik-suite-launch"], labels: ["Product"] });
  // Sahel Resorts
  post("sahel", "sr-01", { day: -12, hh: 18, mm: 30, status: "PUBLISHED", title: "Last call for summer in Sidi Abdel Rahman", text: "Last call for summer ☀️ 3 nights in Sidi Abdel Rahman from 18,500 EGP per couple, breakfast and a sunset dinner included. Valid until October 10.", targets: ["INSTAGRAM", "FACEBOOK"], gallery: ["sahel-sunset"], labels: ["Summer", "Offers"] });
  post("sahel", "sr-02", { day: -2, hh: 12, status: "PUBLISHED", title: "Family pool days", text: "October = family pool days 🏊 Kids under 12 stay and eat free at all Sahel Resorts properties this month.", targets: ["INSTAGRAM", "FACEBOOK"], gallery: ["family-pool"], labels: ["Family"] });
  post("sahel", "sr-03", { day: 5, hh: 17, status: "SCHEDULED", title: "Winter sun in Hurghada", text: "Winter sun, Red Sea blue 🌊 Book 4 nights in Hurghada and pay for 3 — travel between November and February.", targets: ["INSTAGRAM", "FACEBOOK"], gallery: ["hurghada-winter"], labels: ["Offers"] });
  post("sahel", "sr-04", { status: "DRAFT", title: "Red Sea spa retreat", text: "Two massages, a private beach dinner and late checkout. The Red Sea Spa Retreat for couples starts at 9,900 EGP.", targets: ["INSTAGRAM"], gallery: ["red-sea-spa"] });

  // Per-target performance metrics for everything already on the platforms.
  for (const p of db.posts) {
    for (const t of p.targets) {
      if (!t.publishedAt) continue;
      const integration = db.integrations.find((i) => i.id === t.integrationId);
      t.metrics = seedMetrics(t.id, integration?.account.followers || 5000, t.platform, p.publishedAt);
    }
  }

  // ---------------------------------------------------------------- post comments
  const comment = (key, userKey, day, hh, mm, text) => db.postComments.push({ id: uuidFrom(`pc:${key}:${day}:${hh}:${mm}`), postId: POST[key].id, userId: U[userKey], text, createdAt: at(day, hh, mm), updatedAt: at(day, hh, mm) });
  comment("nf-19", "manager", -1, 15, 12, "Approved from my side. Let's make sure the TikTok version uses the 15-second cut.");
  comment("nf-19", "u14", -1, 16, 40, "Updated the caption with the retailer list 👍");
  comment("nf-22", "u12", -1, 11, 0, "Tips reviewed with the sustainability team ✅");
  comment("nf-23", "u14", -2, 10, 0, "Copy is ready — waiting for the final discount % from sales.");
  comment("nf-24", "manager", -1, 12, 5, "Finance changed the free-delivery threshold from 300 to 500 EGP, so this needs re-approval.");
  comment("nf-27", "customer", -2, 13, 30, "Please use the new packaging photo before we publish.");
  comment("nf-27", "u14", -2, 14, 5, "Got it — the new shoot is on Thursday, I'll swap the image then.");
  comment("nf-15", "u12", -2, 11, 20, "Instagram rejected the 9:16 image. I'll re-crop to 4:5 and reconnect TikTok before retrying.");
  comment("nf-18", "customer", -1, 10, 15, "Love this. Approved from our side 🎗️");
  comment("nf-16", "manager", -1, 12, 30, "Great reach in the first two hours — boosting the Facebook version in KSA.");
  comment("ot-05", "manager", -1, 9, 40, "Stand number confirmed with the GITEX team.");

  // ---------------------------------------------------------------- audiences, segments, imports
  const A = {};
  const audience = (pk, key, name, description, contactsCount, day) => {
    const a = { id: uuidFrom(`audience:${key}`), projectId: P[pk].id, name, description, contactsCount, createdAt: at(day, 10, 0), updatedAt: at(day + 5, 10, 0) };
    db.audiences.push(a);
    A[key] = a;
  };
  audience("nile", "nile-club", "Nile Club Members", "Loyalty programme members who opted in to marketing (Egypt).", 48250, -200);
  audience("nile", "ksa-shoppers", "Online Shoppers — KSA", "App and web customers with a delivery address in Riyadh, Jeddah or Dammam.", 12480, -90);
  audience("nile", "b2b", "B2B Distributors", "Wholesale partners and supermarket buyers.", 640, -150);
  audience("nile", "wf-2025", "White Friday 2025 Buyers", "Customers who ordered during White Friday 2025 (imported list).", 21930, -30);
  audience("orgtik", "ot-trials", "Trial Signups 2026", "Workspaces that started a free trial this year.", 3120, -120);
  audience("orgtik", "ot-webinar", "Webinar Registrants", "Everyone who registered for an OrgTik webinar.", 870, -60);
  audience("sahel", "sr-guests", "Past Guests 2024–2026", "Guests with a completed stay who accepted marketing messages.", 15600, -80);

  const S = {};
  const segment = (pk, key, name, description, rules, day, audienceKey) => {
    const s = { id: uuidFrom(`segment:${key}`), projectId: P[pk].id, audienceId: audienceKey ? A[audienceKey].id : null, name, description, rules, createdAt: at(day, 12, 0), updatedAt: at(day, 12, 0) };
    db.segments.push(s);
    S[key] = s;
  };
  segment("nile", "cairo-frequent", "Cairo & Giza — Frequent Buyers", "Ordered 3+ times in the last 60 days.", { source: "Mobile App", type: "Customer", interest: "Ready Meals", qualifiedOnly: true }, -60);
  segment("nile", "lapsed", "Lapsed Buyers (90+ days)", "No purchase in the last 90 days.", { source: "E-commerce", type: "Customer" }, -45);
  segment("nile", "genz-health", "Health-conscious Gen Z", null, { type: "Lead", interest: "Fitness" }, -20);
  segment("nile", "ksa-leads", "Riyadh & Jeddah Leads", "Lead-form sign-ups from the KSA launch.", { source: "Lead Form", type: "Lead", interest: "Frozen Meals" }, -15, "ksa-shoppers");
  segment("orgtik", "ot-enterprise", "Enterprise HR Leads", "Companies with 200+ employees.", { source: "LinkedIn Lead Gen", type: "Lead", interest: "HR Software", qualifiedOnly: true }, -40);
  segment("sahel", "sr-families", "Families with Kids", null, { interest: "Family Travel" }, -30);

  db.imports.push({
    id: uuidFrom("import:wf-2025"), projectId: P.nile.id, fileName: "white-friday-2025-buyers.csv", status: "COMPLETED", headers: ["Full name", "Email", "Phone", "City"],
    rows: [], totalRows: 21930, mapping: { nameColumn: "Full name", emailColumn: "Email", phoneColumn: "Phone" }, savedAudienceId: A["wf-2025"].id, createdAt: at(-30, 9, 0), updatedAt: at(-30, 9, 5),
  });

  // ---------------------------------------------------------------- messaging senders & templates
  const SND = {};
  const sender = (pk, key, channel, name, configuration, isActive = true) => {
    const s = { id: uuidFrom(`sender:${key}`), projectId: pk ? P[pk].id : null, channel, name, isActive, configuration, createdByUserId: U.u12, createdAt: at(-180, 10, 0), updatedAt: at(-20, 10, 0) };
    db.senders.push(s);
    SND[key] = s;
  };
  sender("nile", "nf-email-mkt", "EMAIL", "Nile Foods Marketing", { from: "marketing@nilefoods.com", host: "smtp.nilefoods.com", port: 587, secure: false });
  sender("nile", "nf-email-noreply", "EMAIL", "Nile Foods No-Reply", { from: "no-reply@nilefoods.com", host: "smtp.nilefoods.com", port: 465, secure: true });
  sender("nile", "nf-sms-eg", "SMS", "NILEFOODS", { method: "POST", endpoint: "sms-gateway.nilefoods.com/v1/eg/send", bodyTemplate: '{"to":"{{phone}}","sender":"NILEFOODS","text":"{{message}}"}' });
  sender("nile", "nf-sms-ksa", "SMS", "NileFoods-KSA", { method: "POST", endpoint: "sms-gateway.nilefoods.com/v1/ksa/send", bodyTemplate: '{"to":"{{phone}}","sender":"NileFoods-KSA","text":"{{message}}"}' });
  sender("nile", "nf-wa", "WHATSAPP", "Nile Foods WhatsApp Business", { apiVersion: "v21.0", phoneNumberId: "+20 100 555 0101", whatsappBusinessAccountId: "112093847566201" });
  sender("nile", "nf-wa-old", "WHATSAPP", "Nile Foods (old number)", { apiVersion: "v19.0", phoneNumberId: "+20 122 000 4410", whatsappBusinessAccountId: "109922384411002" }, false);
  sender("orgtik", "ot-email", "EMAIL", "OrgTik Team", { from: "hello@orgtik.com", host: "smtp.orgtik.com", port: 587, secure: false });
  sender("orgtik", "ot-sms", "SMS", "ORGTIK", { method: "POST", endpoint: "sms-gateway.orgtik.com/v1/send", bodyTemplate: '{"to":"{{phone}}","text":"{{message}}"}' });
  sender("sahel", "sr-email", "EMAIL", "Sahel Resorts Reservations", { from: "reservations@sahelresorts.com", host: "smtp.sahelresorts.com", port: 587, secure: false });
  sender("sahel", "sr-wa", "WHATSAPP", "Sahel Resorts Concierge", { apiVersion: "v21.0", phoneNumberId: "+20 111 777 2020", whatsappBusinessAccountId: "118822093311447" });

  const T = {};
  const template = (pk, key, channel, senderKey, name, subject, body, providerData = {}) => {
    const vars = [...new Set((`${subject || ""} ${body}`.match(/\{\{\s*([\w.-]+)\s*\}\}/g) || []).map((m) => m.replace(/[{}\s]/g, "")))];
    const t = { id: uuidFrom(`template:${key}`), projectId: P[pk].id, channel, senderConfigId: SND[senderKey].id, name, subject, body, variables: vars, providerData, isActive: true, createdByUserId: U.u14, createdAt: at(-90, 10, 0), updatedAt: at(-10, 10, 0) };
    db.templates.push(t);
    T[key] = t;
  };
  template("nile", "nf-wf-early", "EMAIL", "nf-email-mkt", "White Friday Early Access", "{{name}}, your White Friday early access is here", "<p>Hi {{name}},</p><p>As a Nile Club member you get <strong>24-hour early access</strong> to White Friday — up to 50% off ready meals, sweets and pantry staples.</p><p><a href=\"{{link}}\">Shop early access</a></p><p>The Nile Foods team</p>");
  template("nile", "nf-newsletter", "EMAIL", "nf-email-mkt", "Monthly Recipes Newsletter", "3 new recipes for {{name}}'s kitchen this month", "<p>Hi {{name}},</p><p>This month: molokhia with shrimp, 10-minute hawawshi and an Om Ali you can make in a mug.</p><p><a href=\"{{link}}\">Get the recipes</a></p>");
  template("nile", "nf-order-email", "EMAIL", "nf-email-noreply", "Order Confirmation", "Order {{order_id}} confirmed", "<p>Hi {{name}}, thanks for your order {{order_id}}. We'll let you know when it's on the way.</p>");
  template("nile", "nf-flash-sms", "SMS", "nf-sms-ksa", "Flash Sale (KSA)", null, "Hi {{name}}, 25% off Nile Foods ready meals today only with code NILE25. Shop: {{link}} Reply STOP to opt out.");
  template("nile", "nf-shipped-sms", "SMS", "nf-sms-eg", "Order Shipped", null, "Hi {{name}}, your Nile Foods order {{order_id}} is on its way! Track it here: {{link}}");
  template("nile", "nf-welcome-sms", "SMS", "nf-sms-eg", "Welcome to Nile Club", null, "أهلاً {{name}}! مرحباً بك في نادي نايل فودز. استخدم كود WELCOME10 لخصم ١٠٪ على أول طلب.");
  template("nile", "nf-wa-weekly", "WHATSAPP", "nf-wa", "Weekly Offers (AR)", null, "أهلاً {{name}}! عروض الأسبوع من نايل فودز وصلت 🎉 خصم ٢٠٪ على الوجبات الجاهزة. اطلب الآن: {{link}}", { status: "APPROVED", category: "MARKETING", language: "ar", templateName: "weekly_offers_ar" });
  template("nile", "nf-wa-points", "WHATSAPP", "nf-wa", "Loyalty Points Reminder", null, "Hi {{name}}, you have {{points}} Nile Club points expiring on {{date}}. Redeem them before they're gone: {{link}}", { status: "APPROVED", category: "MARKETING", language: "en", templateName: "loyalty_points_reminder" });
  template("orgtik", "ot-webinar", "EMAIL", "ot-email", "Webinar Invite — Automate Your Approvals", "{{name}}, join our live webinar on Oct 8", "<p>Hi {{name}},</p><p>Join the OrgTik product team on <strong>Oct 8 at 2 PM Cairo time</strong> to see how teams automate approvals across HR, finance and marketing.</p><p><a href=\"{{link}}\">Save my seat</a></p>");
  template("orgtik", "ot-trial-sms", "SMS", "ot-sms", "Trial Ending Reminder", null, "Hi {{name}}, your OrgTik trial ends in 3 days. Upgrade to keep your workspace: {{link}}");
  template("sahel", "sr-winter-email", "EMAIL", "sr-email", "Winter Sun Offer", "{{name}}, the Red Sea is calling", "<p>Hi {{name}},</p><p>Book 4 nights in Hurghada and pay for 3 — travel November to February.</p><p><a href=\"{{link}}\">Book now</a></p>");
  template("sahel", "sr-wa-checkin", "WHATSAPP", "sr-wa", "Pre-arrival Check-in", null, "Hello {{name}}, we can't wait to welcome you on {{date}}! Check in online to skip the queue: {{link}}", { status: "APPROVED", category: "UTILITY", language: "en", templateName: "pre_arrival_checkin" });

  // ---------------------------------------------------------------- campaigns
  const C = {};
  const reviewerRows = (key, list) => (list || []).map(([userKey, status, day, note]) => ({
    id: uuidFrom(`cr:${key}:${userKey}`), reviewerUserId: U[userKey], status, note: note || null, decidedAt: status === "PENDING" ? null : at(day ?? -1, 14, 20), assignedByUserId: U.u12, createdAt: at(-5, 10, 0),
  }));
  const ad = (ckey, name, extra = {}) => ({ id: uuidFrom(`ad:${ckey}:${name}`), name, ...extra });
  const postAd = (ckey, postKey, name, cta) => {
    const p = POST[postKey];
    return ad(ckey, name || p.title, { unifiedPostTargetId: p.id, ...(cta ? { callToAction: cta } : {}), creative: { title: p.title, source: "EXISTING", postId: p.id } });
  };
  const adSet = (ckey, name, platform, pk, extra = {}) => ({
    id: uuidFrom(`adset:${ckey}:${name}`), name, platform, deliveryPlatform: platform, integrationId: platform && I[`${pk}:${platform}`] ? I[`${pk}:${platform}`].id : null,
    startAt: extra.startAt || null, endAt: extra.endAt || null, configuration: extra.configuration || {}, ads: extra.ads || [],
  });
  const campaign = (pk, key, s) => {
    const c = {
      id: uuidFrom(`campaign:${key}`), key, projectId: P[pk].id, userId: s.author ?? U.u12, type: s.type, name: s.name, description: s.description || null,
      categoryNames: s.categories || [], startAt: s.startAt || null, endAt: s.endAt || null, status: s.status, isComplete: s.isComplete !== false,
      workflowState: s.workflowState, approvalStatus: s.approvalStatus || "NOT_REQUIRED", approvalNote: s.approvalNote || null, approvalVersion: s.approvalVersion ?? 1,
      configuration: s.configuration || {}, adSets: s.adSets || [], reviewers: reviewerRows(key, s.reviewers), lastApprovedSnapshot: null,
      onboardingStep: s.onboardingStep || "REVIEW", publishedAt: s.publishedAt || null,
      createdAt: at(s.createdDay ?? -20, 11, 0), updatedAt: at(s.updatedDay ?? -2, 16, 30),
    };
    db.campaigns.push(c);
    C[key] = c;
    // Posts linked through a SOCIAL_MEDIA / PAID_SOCIAL campaign show the campaign in their details.
    for (const set of c.adSets) for (const a of set.ads) {
      const p = db.posts.find((x) => x.id === a.unifiedPostTargetId);
      if (p && !p.campaignIds.includes(c.id)) p.campaignIds.push(c.id);
    }
    return c;
  };

  campaign("nile", "wf-paid", {
    type: "PAID_SOCIAL_ADS", name: "White Friday 2026 — Mega Deals", description: "Always-on sales push across Meta and TikTok for the White Friday week (KSA, UAE, Egypt).",
    categories: ["ECOMMERCE"], startAt: at(52, 0, 0), endAt: at(62, 23, 59), status: "READY", workflowState: "AWAITING_REVIEW", approvalStatus: "PENDING_APPROVAL",
    approvalNote: "Budget split 60/30/10 across Facebook, Instagram and TikTok — please confirm before Nov 1.", createdDay: -12, updatedDay: -2,
    configuration: { objective: "OUTCOME_SALES", budgetAmount: 2500, budgetType: "DAILY", budgetCurrency: "SAR", audience: { locations: ["Saudi Arabia", "United Arab Emirates", "Egypt"], ageMin: 21, ageMax: 45, gender: "ALL", interests: ["ONLINE_SHOPPING", "FOOD_AND_DRINK", "COOKING"] } },
    adSets: [
      adSet("wf-paid", "Facebook — KSA Retargeting", "FACEBOOK", "nile", { configuration: { budgetAmount: 1500, audience: { locations: ["Saudi Arabia"], ageMin: 25, ageMax: 45, gender: "ALL", interests: ["ONLINE_SHOPPING"] } }, ads: [postAd("wf-paid", "nf-24", "White Friday Day 1 — 50% off", "SHOP_NOW"), postAd("wf-paid", "nf-23", "Early access sign-up", "SIGN_UP")] }),
      adSet("wf-paid", "Instagram — Egypt & UAE", "INSTAGRAM", "nile", { ads: [postAd("wf-paid", "nf-23", "Countdown teaser", "LEARN_MORE")] }),
      adSet("wf-paid", "TikTok — Gen Z KSA", "TIKTOK", "nile", { configuration: { budgetAmount: 250 }, ads: [postAd("wf-paid", "nf-24", "White Friday Day 1 — TikTok cut", "SHOP_NOW")] }),
    ],
    reviewers: [["manager", "APPROVED", -2], ["customer", "PENDING"], ["admin", "PENDING"]],
  });
  campaign("nile", "search-ksa", {
    type: "GOOGLE_SEARCH_ADS", name: "Ready Meals KSA — Google Search", description: "Capture high-intent searches for Egyptian ready meals in Riyadh and Jeddah.",
    categories: ["FOOD_BEVERAGE"], startAt: at(-14, 0, 0), endAt: at(93, 23, 59), status: "RUNNING", workflowState: "RUNNING", approvalStatus: "APPROVED", createdDay: -25, updatedDay: -14, publishedAt: at(-15, 12, 0),
    configuration: { integrationId: I["nile:GOOGLE"].id, objective: "CONVERSIONS", budgetAmount: 350, budgetType: "DAILY", budgetCurrency: "SAR", biddingStrategy: "MAXIMIZE_CONVERSIONS", networks: ["GOOGLE_SEARCH", "SEARCH_PARTNERS"], locations: ["2682"], languages: ["1019", "1000"] },
    adSets: [
      adSet("search-ksa", "Frozen Ready Meals", "GOOGLE", "nile", {
        configuration: { defaultBidMicros: 2500000, keywords: [{ text: "frozen ready meals riyadh", matchType: "PHRASE" }, { text: "وجبات جاهزة", matchType: "BROAD" }, { text: "egyptian food delivery jeddah", matchType: "PHRASE" }, { text: "nile foods", matchType: "EXACT" }], negativeKeywords: [{ text: "recipe", matchType: "BROAD" }, { text: "jobs", matchType: "BROAD" }] },
        ads: [
          ad("search-ksa", "RSA — Ready in 5 minutes", { configuration: { finalUrl: "https://nilefoods.com/ksa/ready-meals", headlines: ["Egyptian Ready Meals in KSA", "Dinner Ready in 5 Minutes", "Molokhia, Mahshi & Kofta", "Delivered in 60 Minutes", "Order on the Nile Foods App"], descriptions: ["Authentic Egyptian home cooking, frozen fresh. Now in Riyadh and Jeddah.", "Heat, plate, done. 25% off your first order with code KSA25."], displayPath: ["ksa", "ready-meals"] } }),
          ad("search-ksa", "RSA — Taste of home", { configuration: { finalUrl: "https://nilefoods.com/ksa", headlines: ["A Taste of Home in Riyadh", "Egyptian Classics, Frozen Fresh", "Free Delivery Over 150 SAR"], descriptions: ["Molokhia, koshary kits and desserts delivered across Riyadh and Jeddah.", "4.9 stars from 12,000+ reviews. Order in two taps."], displayPath: ["ksa"] } }),
        ],
      }),
      adSet("search-ksa", "Healthy Lunch Boxes", "GOOGLE", "nile", {
        configuration: { defaultBidMicros: 1800000, keywords: [{ text: "healthy lunch box riyadh", matchType: "PHRASE" }, { text: "office lunch delivery", matchType: "BROAD" }, { text: "high protein meals ksa", matchType: "PHRASE" }], negativeKeywords: [{ text: "free", matchType: "BROAD" }] },
        ads: [ad("search-ksa", "RSA — Office lunch", { configuration: { finalUrl: "https://nilefoods.com/ksa/lunch-boxes", headlines: ["Healthy Office Lunch Boxes", "Under 500 Calories", "Order by 11 AM"], descriptions: ["Balanced Egyptian meals for the office — delivered by lunchtime.", "Subscribe weekly and save 15%."], displayPath: ["lunch-boxes"] } })],
      }),
    ],
    reviewers: [["manager", "APPROVED", -16]],
  });
  campaign("nile", "ramadan-2027", {
    type: "SOCIAL_MEDIA", name: "Ramadan 2027 — Iftar Bundles", description: "Organic content plan for the Ramadan 2027 Iftar box launch.", categories: ["FOOD_BEVERAGE"],
    startAt: at(129, 9, 0), endAt: at(162, 23, 0), status: "DRAFT", isComplete: false, workflowState: "DRAFT", approvalStatus: "NOT_REQUIRED", onboardingStep: "POSTS", createdDay: -3, updatedDay: -1,
    adSets: [adSet("ramadan-2027", "Facebook posts", "FACEBOOK", "nile", { startAt: at(129, 9, 0), endAt: at(162, 23, 0), ads: [postAd("ramadan-2027", "nf-25")] })],
  });
  campaign("nile", "bts", {
    type: "SOCIAL_MEDIA", name: "Back to School Lunchbox", description: "Four weeks of lunchbox recipes and tips for parents.", categories: ["FOOD_BEVERAGE"],
    startAt: at(-30, 9, 0), endAt: at(16, 23, 0), status: "RUNNING", workflowState: "RUNNING", approvalStatus: "APPROVED", createdDay: -40, updatedDay: -30, publishedAt: at(-31, 10, 0),
    adSets: [
      adSet("bts", "Instagram posts", "INSTAGRAM", "nile", { startAt: at(-30, 9, 0), endAt: at(16, 23, 0), ads: [postAd("bts", "nf-05"), postAd("bts", "nf-09"), postAd("bts", "nf-15")] }),
      adSet("bts", "Facebook posts", "FACEBOOK", "nile", { startAt: at(-30, 9, 0), endAt: at(16, 23, 0), ads: [postAd("bts", "nf-05"), postAd("bts", "nf-09")] }),
      adSet("bts", "TikTok posts", "TIKTOK", "nile", { startAt: at(-30, 9, 0), endAt: at(16, 23, 0), ads: [postAd("bts", "nf-05")] }),
    ],
    reviewers: [["customer", "APPROVED", -32]],
  });
  const msgSet = (ckey, name, cfg) => adSet(ckey, name, null, null, { configuration: cfg });
  campaign("nile", "club-wa", {
    type: "MESSAGING", name: "Nile Club — Weekly WhatsApp Offers", description: "Weekly WhatsApp broadcast to frequent buyers in Cairo and Giza.", categories: ["ECOMMERCE"],
    startAt: at(6, 10, 0), status: "READY", workflowState: "READY", approvalStatus: "APPROVED", createdDay: -8, updatedDay: -3, publishedAt: at(-3, 13, 0),
    adSets: [msgSet("club-wa", "Nile Club Members · Cairo & Giza — Frequent Buyers", { channel: "WHATSAPP", audienceId: A["nile-club"].id, segmentId: S["cairo-frequent"].id, senderConfigId: SND["nf-wa"].id, templateId: T["nf-wa-weekly"].id })],
    reviewers: [["manager", "APPROVED", -3]],
  });
  campaign("nile", "wf-email", {
    type: "MESSAGING", name: "White Friday Early Access — Email", description: "Early-access email to last year's White Friday buyers.", categories: ["ECOMMERCE"],
    startAt: at(50, 9, 0), status: "DRAFT", workflowState: "DRAFT", approvalStatus: "NOT_REQUIRED", onboardingStep: "REVIEW", createdDay: -6, updatedDay: -2,
    adSets: [msgSet("wf-email", "White Friday 2025 Buyers", { channel: "EMAIL", audienceId: A["wf-2025"].id, importId: db.imports[0].id, senderConfigId: SND["nf-email-mkt"].id, templateId: T["nf-wf-early"].id })],
  });
  campaign("nile", "protein", {
    type: "PAID_SOCIAL_ADS", name: "Nile Protein Bar Launch", description: "Awareness burst for the protein bar launch — paused while the TikTok creative is re-cut.", categories: ["FOOD_BEVERAGE", "HEALTH"],
    startAt: at(-16, 0, 0), endAt: at(20, 23, 59), status: "PAUSED", workflowState: "PAUSED", approvalStatus: "APPROVED", createdDay: -24, updatedDay: -5, publishedAt: at(-17, 9, 0),
    configuration: { objective: "OUTCOME_AWARENESS", budgetAmount: 12000, budgetType: "LIFETIME", budgetCurrency: "USD", audience: { locations: ["Egypt"], ageMin: 18, ageMax: 34, gender: "ALL", interests: ["FITNESS", "HEALTHY_EATING"] } },
    adSets: [
      adSet("protein", "Instagram — Teaser", "INSTAGRAM", "nile", { ads: [postAd("protein", "nf-10", "Teaser — guess the flavour", "LEARN_MORE")] }),
      adSet("protein", "TikTok — Launch", "TIKTOK", "nile", { startAt: at(6, 0, 0), endAt: at(20, 23, 59), configuration: { budgetAmount: 4000, audience: { locations: ["Egypt", "Saudi Arabia"], ageMin: 18, ageMax: 28, gender: "ALL", interests: ["FITNESS"] } }, ads: [postAd("protein", "nf-19", "Launch day video", "SHOP_NOW")] }),
    ],
    reviewers: [["manager", "APPROVED", -18], ["customer", "APPROVED", -18]],
  });
  campaign("nile", "flash-sms", {
    type: "MESSAGING", name: "Mid-Month Flash Sale — SMS", description: "One-day SMS flash sale for KSA shoppers.", categories: ["ECOMMERCE"],
    startAt: at(16, 12, 0), status: "DRAFT", workflowState: "REJECTED", approvalStatus: "REJECTED", approvalNote: "Discount must be 20%, not 25% — please update the template.", createdDay: -5, updatedDay: -1,
    adSets: [msgSet("flash-sms", "Online Shoppers — KSA · Riyadh & Jeddah Leads", { channel: "SMS", audienceId: A["ksa-shoppers"].id, segmentId: S["ksa-leads"].id, senderConfigId: SND["nf-sms-ksa"].id, templateId: T["nf-flash-sms"].id })],
    reviewers: [["manager", "APPROVED", -2], ["customer", "REJECTED", -1, "Discount must be 20%, not 25%."]],
  });
  campaign("nile", "brand-uae", {
    type: "GOOGLE_SEARCH_ADS", name: "Brand Protection — UAE Search", description: "Defend brand terms in the UAE.", categories: ["FOOD_BEVERAGE"],
    startAt: at(-7, 0, 0), endAt: at(53, 23, 59), status: "FAILED", workflowState: "FAILED", approvalStatus: "APPROVED", createdDay: -10, updatedDay: -7, publishedAt: at(-7, 8, 0),
    configuration: { integrationId: I["nile:GOOGLE"].id, objective: "WEBSITE_TRAFFIC", budgetAmount: 150, budgetType: "DAILY", budgetCurrency: "AED", biddingStrategy: "MAXIMIZE_CLICKS", networks: ["GOOGLE_SEARCH"], locations: ["2784"], languages: ["1000", "1019"], providerError: "Google Ads API: CUSTOMER_NOT_ENABLED — the UAE billing profile is not active." },
    adSets: [adSet("brand-uae", "Brand terms", "GOOGLE", "nile", {
      configuration: { defaultBidMicros: 900000, keywords: [{ text: "nile foods", matchType: "EXACT" }, { text: "nile foods uae", matchType: "PHRASE" }, { text: "نايل فودز", matchType: "EXACT" }], negativeKeywords: [] },
      ads: [ad("brand-uae", "RSA — Official store", { configuration: { finalUrl: "https://nilefoods.com/uae", headlines: ["Nile Foods Official Store", "Egyptian Food in the UAE", "Delivery Across Dubai & Abu Dhabi"], descriptions: ["Order Egypt's favourite ready meals and sweets online.", "Free delivery on your first order."], displayPath: ["uae"] } })],
    })],
    reviewers: [["manager", "APPROVED", -8]],
  });
  campaign("orgtik", "ot-leadgen", {
    type: "PAID_SOCIAL_ADS", name: "OrgTik Suite Launch — Lead Gen", description: "Lead generation for the OrgTik suite launch across LinkedIn and Facebook.", categories: ["SERVICES"],
    startAt: at(2, 0, 0), endAt: at(32, 23, 59), status: "READY", workflowState: "READY", approvalStatus: "APPROVED", createdDay: -10, updatedDay: -2, publishedAt: at(-2, 15, 0),
    configuration: { objective: "OUTCOME_LEADS", budgetAmount: 90, budgetType: "DAILY", budgetCurrency: "USD", audience: { locations: ["Egypt", "United Arab Emirates", "Saudi Arabia"], ageMin: 25, ageMax: 55, gender: "ALL", interests: ["HR_SOFTWARE", "SAAS", "SMALL_BUSINESS"] } },
    adSets: [
      adSet("ot-leadgen", "LinkedIn — HR & Ops decision makers", "LINKEDIN", "orgtik", { ads: [postAd("ot-leadgen", "ot-01", "Suite launch — single image", "SIGN_UP")] }),
      adSet("ot-leadgen", "Facebook — Site visitors retargeting", "FACEBOOK", "orgtik", { ads: [postAd("ot-leadgen", "ot-02", "Delta Pharma story", "LEARN_MORE")] }),
    ],
    reviewers: [["admin", "APPROVED", -2]],
  });
  campaign("orgtik", "ot-search", {
    type: "GOOGLE_SEARCH_ADS", name: "HR Software Egypt — Search", description: "Search ads for HR and task-management intent in Egypt and the UAE.", categories: ["SERVICES"],
    startAt: at(-28, 0, 0), endAt: at(62, 23, 59), status: "RUNNING", workflowState: "RUNNING", approvalStatus: "APPROVED", createdDay: -35, updatedDay: -28, publishedAt: at(-29, 10, 0),
    configuration: { integrationId: I["orgtik:GOOGLE"].id, objective: "LEADS", budgetAmount: 60, budgetType: "DAILY", budgetCurrency: "USD", biddingStrategy: "TARGET_CPA", networks: ["GOOGLE_SEARCH"], locations: ["2818", "2784"], languages: ["1000", "1019"] },
    adSets: [
      adSet("ot-search", "HR software", "GOOGLE", "orgtik", { configuration: { defaultBidMicros: 1200000, keywords: [{ text: "hr software egypt", matchType: "PHRASE" }, { text: "برنامج موارد بشرية", matchType: "BROAD" }, { text: "payroll system cairo", matchType: "PHRASE" }], negativeKeywords: [{ text: "free download", matchType: "PHRASE" }] }, ads: [ad("ot-search", "RSA — HR suite", { configuration: { finalUrl: "https://orgtik.com/hr", headlines: ["HR Software Built for Egypt", "Payroll, Leave & Contracts", "Start a Free 14-Day Trial"], descriptions: ["Arabic-first HR suite with payroll and approvals.", "Trusted by 300+ teams in Egypt and the GCC."], displayPath: ["hr"] } })] }),
      adSet("ot-search", "Task management", "GOOGLE", "orgtik", { configuration: { defaultBidMicros: 800000, keywords: [{ text: "task management software", matchType: "BROAD" }, { text: "project tracking tool arabic", matchType: "PHRASE" }], negativeKeywords: [] }, ads: [ad("ot-search", "RSA — Tasks", { configuration: { finalUrl: "https://orgtik.com/tasks", headlines: ["Tasks & Projects in One Place", "Kanban, Timelines, Approvals"], descriptions: ["Plan work, track time and automate approvals.", "Free for teams up to 10."], displayPath: ["tasks"] } })] }),
    ],
    reviewers: [["admin", "APPROVED", -29]],
  });
  campaign("orgtik", "ot-gitex", {
    type: "SOCIAL_MEDIA", name: "GITEX Global 2026 Countdown", description: "Organic countdown to GITEX Global in Dubai.", categories: ["SERVICES"],
    startAt: at(6, 9, 0), endAt: at(18, 20, 0), status: "READY", workflowState: "AWAITING_REVIEW", approvalStatus: "PENDING_APPROVAL", approvalNote: "Please review the stand details before we go live.", createdDay: -6, updatedDay: -1,
    adSets: [
      adSet("ot-gitex", "LinkedIn posts", "LINKEDIN", "orgtik", { startAt: at(6, 9, 0), endAt: at(18, 20, 0), ads: [postAd("ot-gitex", "ot-05")] }),
      adSet("ot-gitex", "X posts", "X", "orgtik", { startAt: at(6, 9, 0), endAt: at(18, 20, 0), ads: [postAd("ot-gitex", "ot-05")] }),
    ],
    reviewers: [["admin", "PENDING"], ["manager", "APPROVED", -1]],
  });
  campaign("orgtik", "ot-webinar", {
    type: "MESSAGING", name: "Webinar Invite — Automate Your Approvals", description: "Invite trial users to the Oct 8 webinar.", categories: ["SERVICES"],
    startAt: at(7, 10, 0), status: "DRAFT", isComplete: false, workflowState: "DRAFT", approvalStatus: "NOT_REQUIRED", onboardingStep: "MESSAGE", createdDay: -2, updatedDay: -1,
    adSets: [msgSet("ot-webinar", "Trial Signups 2026", { channel: "EMAIL", audienceId: A["ot-trials"].id, senderConfigId: SND["ot-email"].id, templateId: T["ot-webinar"].id })],
  });
  campaign("sahel", "sr-summer", {
    type: "PAID_SOCIAL_ADS", name: "Summer in Sahel — Last Call", description: "Last-call traffic campaign for September/October stays.", categories: ["SERVICES"],
    startAt: at(-20, 0, 0), endAt: at(11, 23, 59), status: "RUNNING", workflowState: "RUNNING", approvalStatus: "APPROVED", createdDay: -25, updatedDay: -20, publishedAt: at(-21, 11, 0),
    configuration: { objective: "OUTCOME_TRAFFIC", budgetAmount: 150, budgetType: "DAILY", budgetCurrency: "EUR", audience: { locations: ["Egypt", "Germany", "Italy"], ageMin: 28, ageMax: 60, gender: "ALL", interests: ["BEACH_VACATIONS", "LUXURY_TRAVEL"] } },
    adSets: [
      adSet("sr-summer", "Instagram — Egypt", "INSTAGRAM", "sahel", { ads: [postAd("sr-summer", "sr-01", "Sunset carousel", "BOOK_NOW")] }),
      adSet("sr-summer", "Facebook — Germany & Italy", "FACEBOOK", "sahel", { configuration: { audience: { locations: ["Germany", "Italy"], ageMin: 35, ageMax: 60, gender: "ALL", interests: ["BEACH_VACATIONS"] } }, ads: [postAd("sr-summer", "sr-01", "Sunset — EU audience", "BOOK_NOW")] }),
    ],
    reviewers: [["manager", "APPROVED", -21]],
  });
  campaign("sahel", "sr-winter", {
    type: "SOCIAL_MEDIA", name: "Winter Sun in Hurghada", description: "Organic winter campaign for Hurghada stays.", categories: ["SERVICES"],
    startAt: at(33, 9, 0), endAt: at(150, 20, 0), status: "DRAFT", isComplete: false, workflowState: "DRAFT", approvalStatus: "NOT_REQUIRED", onboardingStep: "POSTS", createdDay: -1, updatedDay: 0,
    adSets: [adSet("sr-winter", "Instagram posts", "INSTAGRAM", "sahel", { ads: [postAd("sr-winter", "sr-03")] })],
  });

  // ---------------------------------------------------------------- campaign comments & activity
  const cc = (key, userKey, day, hh, mm, text, type = "comment") => db.campaignComments.push({ id: uuidFrom(`cc:${key}:${day}:${hh}:${mm}`), campaignId: C[key].id, userId: U[userKey], text, type, createdAt: at(day, hh, mm), updatedAt: at(day, hh, mm) });
  cc("wf-paid", "u12", -3, 11, 0, "requested approval from Karim Hassan, Nour Khaled and Mona Adel", "activity");
  cc("wf-paid", "manager", -2, 14, 20, "approved this campaign", "activity");
  cc("wf-paid", "manager", -2, 14, 25, "Budget looks right. Can we add a UAE-only ad set in week 2 if ROAS is above 4?");
  cc("wf-paid", "u12", -2, 15, 10, "Yes — I'll prepare the creative and add it after the first 3 days of data.");
  cc("search-ksa", "manager", -16, 10, 5, "approved this campaign", "activity");
  cc("search-ksa", "u12", -6, 9, 30, "CPA is 18.4 SAR vs a 25 SAR target — raising the budget from 250 to 350 SAR/day.");
  cc("flash-sms", "customer", -1, 17, 45, "rejected this campaign: Discount must be 20%, not 25%.", "activity");
  cc("flash-sms", "u14", -1, 18, 5, "Updating the template now, will re-submit tomorrow morning.");
  cc("ot-gitex", "manager", -1, 9, 45, "approved this campaign", "activity");
  cc("protein", "u12", -5, 16, 0, "Paused the campaign until the TikTok video is re-cut to 15 seconds.", "comment");

  // ---------------------------------------------------------------- boost (ad executions)
  const tgt = (postKey, platform) => POST[postKey].targets.find((t) => t.platform === platform);
  const exec = (pk, key, postKey, platform, s) => {
    const t = tgt(postKey, platform);
    const e = {
      id: uuidFrom(`exec:${key}`), userId: s.userId ?? U.u12, projectId: P[pk].id, unifiedPostTargetId: t.id, platform, status: s.status,
      durationDays: s.days, budgetAmount: s.budget, currency: s.currency, objective: s.objective, callToAction: s.cta,
      targeting: { geo_locations: { countries: s.countries }, age_min: s.ageMin, age_max: s.ageMax },
      placements: s.placements, creativeOverrides: s.creative || { actionButtonLabel: s.cta }, platformData: s.platformData || {},
      scheduledAt: s.scheduledAt || null, startedAt: s.startedAt || null, completedAt: s.completedAt || null, failedAt: s.failedAt || null,
      externalCampaignId: s.status === "FAILED" || s.status === "QUEUED" ? null : `23851${String(hashNum(key)).slice(0, 9)}`,
      externalAdSetId: s.status === "FAILED" || s.status === "QUEUED" ? null : `23852${String(hashNum(key + "set")).slice(0, 9)}`,
      externalAdId: s.status === "FAILED" || s.status === "QUEUED" ? null : `23853${String(hashNum(key + "ad")).slice(0, 9)}`,
      errorMessage: s.error || null, queueState: s.queueState || (s.status === "QUEUED" ? "waiting" : s.status === "FAILED" ? "failed" : "completed"),
      createdAt: s.createdAt, updatedAt: s.updatedAt || s.createdAt,
    };
    db.executions.push(e);
  };
  exec("nile", "e1", "nf-16", "FACEBOOK", { status: "ACTIVE", days: 7, budget: 750, currency: "SAR", objective: "OUTCOME_TRAFFIC", cta: "SHOP_NOW", countries: ["SA"], ageMin: 21, ageMax: 45, placements: ["facebook_feed", "instagram_feed"], createdAt: at(-1, 12, 40), startedAt: at(-1, 13, 5), creative: { headline: "Egyptian ready meals, now in KSA", primaryText: "Dinner in 5 minutes — molokhia, mahshi, kofta and more.", actionButtonLabel: "SHOP_NOW", destinationUrl: "https://nilefoods.com/ksa" } });
  exec("nile", "e2", "nf-12", "INSTAGRAM", { status: "STOPPED", days: 3, budget: 1200, currency: "SAR", objective: "OUTCOME_ENGAGEMENT", cta: "LEARN_MORE", countries: ["SA"], ageMin: 18, ageMax: 44, placements: ["instagram_feed", "instagram_stories"], createdAt: at(-6, 12, 30), startedAt: at(-6, 13, 0), completedAt: at(-3, 13, 0) });
  exec("nile", "e3", "nf-05", "FACEBOOK", { status: "PAUSED", days: 14, budget: 300, currency: "USD", objective: "OUTCOME_ENGAGEMENT", cta: "LEARN_MORE", countries: ["EG"], ageMin: 25, ageMax: 45, placements: ["facebook_feed", "facebook_reels"], createdAt: at(-29, 10, 0), startedAt: at(-29, 10, 20), updatedAt: at(-20, 9, 0) });
  exec("nile", "e4", "nf-07", "TIKTOK", { status: "FAILED", days: 5, budget: 450, currency: "AED", objective: "OUTCOME_AWARENESS", cta: "WATCH_MORE", countries: ["AE"], ageMin: 18, ageMax: 34, placements: ["facebook_reels", "instagram_reels"], createdAt: at(-24, 20, 10), failedAt: at(-24, 20, 11), error: "TikTok Ads API error 40002: insufficient advertiser balance to launch this ad group (balance 0.00 AED, required 450.00 AED). Top up the TikTok Ads account and retry." });
  exec("nile", "e5", "nf-13", "FACEBOOK", { status: "QUEUED", days: 5, budget: 400, currency: "AED", objective: "OUTCOME_AWARENESS", cta: "SHOP_NOW", countries: ["AE"], ageMin: 21, ageMax: 40, placements: ["facebook_feed", "instagram_feed", "instagram_stories"], createdAt: at(-1, 17, 0), scheduledAt: at(1, 9, 0) });
  exec("nile", "e6", "nf-02", "INSTAGRAM", { status: "STOPPED", days: 7, budget: 120, currency: "KWD", objective: "OUTCOME_ENGAGEMENT", cta: "SHOP_NOW", countries: ["KW"], ageMin: 25, ageMax: 50, placements: ["instagram_feed"], createdAt: at(-39, 14, 0), startedAt: at(-39, 14, 30), completedAt: at(-32, 14, 30) });
  exec("nile", "e7", "nf-14", "LINKEDIN", { status: "RUNNING", days: 10, budget: 500, currency: "USD", objective: "OUTCOME_LEADS", cta: "CONTACT_US", countries: ["EG"], ageMin: 25, ageMax: 55, placements: ["facebook_feed"], createdAt: at(-3, 15, 0), startedAt: at(-2, 9, 0) });
  exec("nile", "e8", "nf-12", "FACEBOOK", { status: "ACTIVE", days: 10, budget: 650, currency: "QAR", objective: "OUTCOME_SALES", cta: "SHOP_NOW", countries: ["QA"], ageMin: 21, ageMax: 50, placements: ["facebook_feed", "instagram_feed"], createdAt: at(-5, 11, 0), startedAt: at(-5, 11, 30) });
  exec("orgtik", "e9", "ot-01", "LINKEDIN", { status: "ACTIVE", days: 21, budget: 1200, currency: "USD", objective: "OUTCOME_LEADS", cta: "SIGN_UP", countries: ["EG", "AE", "SA"], ageMin: 25, ageMax: 55, placements: ["facebook_feed"], createdAt: at(-19, 9, 0), startedAt: at(-19, 10, 0) });
  exec("sahel", "e10", "sr-01", "INSTAGRAM", { status: "STOPPED", days: 7, budget: 600, currency: "EUR", objective: "OUTCOME_TRAFFIC", cta: "BOOK_NOW", countries: ["DE", "IT"], ageMin: 30, ageMax: 60, placements: ["instagram_feed", "instagram_stories"], createdAt: at(-11, 9, 0), startedAt: at(-11, 10, 0), completedAt: at(-4, 10, 0) });

  // ---------------------------------------------------------------- competitors (benchmarks)
  const comp = (pk, name, handle, platforms) => db.competitors.push({ id: uuidFrom(`competitor:${pk}:${handle}`), projectId: P[pk].id, name, handle, platforms, createdAt: at(-60, 10, 0) });
  comp("nile", "Americana Foods", "americanafoods", { FACEBOOK: 2150000, INSTAGRAM: 640000, TIKTOK: 410000 });
  comp("nile", "Edita Food Industries", "edita.eg", { FACEBOOK: 1320000, INSTAGRAM: 280000, YOUTUBE: 96000 });
  comp("nile", "Juhayna", "juhaynaeg", { FACEBOOK: 3050000, INSTAGRAM: 510000, TIKTOK: 230000 });
  comp("nile", "Almarai", "almarai", { FACEBOOK: 1870000, INSTAGRAM: 1120000, X: 890000 });
  comp("orgtik", "Zoho", "zoho", { LINKEDIN: 820000, X: 190000 });
  comp("orgtik", "Odoo", "odoo", { LINKEDIN: 610000, X: 88000 });
  comp("sahel", "Marassi", "marassi.eg", { INSTAGRAM: 310000, FACEBOOK: 540000 });
  comp("sahel", "Steigenberger Hotels", "steigenberger", { INSTAGRAM: 220000, FACEBOOK: 470000 });

  return db;
}

function hashNum(s) {
  let h = 7;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 1000000007;
  return 100000000 + (h % 900000000);
}

// Deterministic post performance: scales with audience size and decays with post age.
function seedMetrics(seed, followers, platform, publishedAt) {
  const r = rng(seed);
  const ageDays = Math.max(0.2, (Date.now() - new Date(publishedAt).getTime()) / 864e5);
  const maturity = Math.min(1, 0.35 + Math.log10(1 + ageDays) / 1.2);
  const reachRate = { FACEBOOK: 0.07, INSTAGRAM: 0.16, X: 0.09, LINKEDIN: 0.12, TIKTOK: 0.34, YOUTUBE: 0.2 }[platform] || 0.1;
  const impressions = Math.round(followers * reachRate * (0.6 + r() * 0.9) * maturity);
  const reach = Math.round(impressions * (0.62 + r() * 0.16));
  const engRate = { FACEBOOK: 0.035, INSTAGRAM: 0.055, X: 0.022, LINKEDIN: 0.045, TIKTOK: 0.08, YOUTUBE: 0.05 }[platform] || 0.04;
  const engagements = Math.round(reach * engRate * (0.7 + r() * 0.6));
  const likes = Math.round(engagements * (0.66 + r() * 0.1));
  const comments = Math.round(engagements * (0.07 + r() * 0.05));
  const reposts = Math.round(engagements * (0.05 + r() * 0.06));
  const saves = Math.round(engagements * (0.04 + r() * 0.05));
  const clicks = Math.round(impressions * (0.008 + r() * 0.012));
  const videoViews = ["TIKTOK", "YOUTUBE", "INSTAGRAM"].includes(platform) ? Math.round(impressions * (0.45 + r() * 0.3)) : 0;
  return { impressions, reach, engagements, likes, comments, reposts, shares: reposts, saves, clicks, videoViews };
}

module.exports = { buildSeed, buildEmptySeed, seedMetrics, U };
