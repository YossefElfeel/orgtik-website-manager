// Integrations: catalog, connected profiles per brand, details/analytics, toggle, delete and a fully
// local OAuth wizard: connect -> (redirect straight back to the app's wizard step 2 with code+state)
// -> callback (resources to pick) -> preflight (selection status) -> finish (creates/updates the profile).
const { send, error, newId, nowIso, at, uuidFrom, boolParam, listParam, hashInt } = require("../lib");
const { PLATFORMS, PLATFORM_KEYS, meta, normPlatform, availableRow } = require("../catalog");

module.exports = function integrationRoutes(app, { ctx, getDb, views, h }) {
  const { identity } = ctx;

  const visibleIntegration = (id, u) => {
    const i = getDb().integrations.find((x) => x.id === id);
    if (!i) return null;
    const p = getDb().projects.find((x) => x.id === i.projectId);
    return p && h.canSee(p, u) ? i : null;
  };
  const filterList = (list, q) => {
    const platform = q.platform ? normPlatform(q.platform) : null;
    const isConnected = boolParam(q.isConnected);
    const status = q.status ? String(q.status).toUpperCase() : null;
    return list.filter((i) => (!platform || i.platform === platform) && (isConnected === undefined || i.isConnected === isConnected) && (!status || i.status === status));
  };

  // ---------------------------------------------------------------- catalog & lists
  app.get("/integrations/available", h.handle((req, res) => {
    send(res, PLATFORM_KEYS.map((p) => availableRow(p, uuidFrom(`available:${p}`))), "Available integrations fetched successfully");
  }, { needsProject: false }));

  app.get("/integrations/project", h.handle((req, res, u, project) => {
    const list = filterList(getDb().integrations.filter((i) => i.projectId === project.id), req.query);
    send(res, list.map(views.integrationListView), "Integrations fetched successfully");
  }));

  app.get("/integrations/project/:projectId", h.handle((req, res, u) => {
    const project = getDb().projects.find((x) => x.id === req.params.projectId);
    if (!project || !h.canSee(project, u)) return h.notFound(res, "Project");
    const list = filterList(getDb().integrations.filter((i) => i.projectId === project.id), req.query);
    send(res, list.map(views.integrationListView), "Integrations fetched successfully");
  }, { needsProject: false }));

  // ---------------------------------------------------------------- simulated OAuth
  // The OAuth state is an opaque random value kept on the server with who started the connect, for
  // which project and platform, and until when (wave 5, MKT-018). The callback accepts it once, from
  // the same person and platform, within 15 minutes. It used to be self-describing base64 JSON that
  // the callback trusted as it came, so any made-up state opened a connect session for anyone.
  const STATE_TTL_MS = 15 * 60 * 1000;
  const opaque = () => require("crypto").randomBytes(24).toString("base64url");

  function oauthResources(platform, project) {
    const brand = project.name;
    const slug = (project.slug || brand).replace(/[^a-z0-9]/gi, "").toLowerCase();
    const existing = getDb().integrations.filter((i) => i.projectId === project.id && i.platform === platform);
    const now = at(0, 8, 0);
    const n = (s) => String(hashInt(`${project.id}:${platform}:${s}`) % 900000000000 + 100000000000);
    const mk = (capability, resourceType, type, displayName, externalId, extra = {}) => ({
      id: uuidFrom(`oauth:${project.id}:${platform}:${capability}:${externalId}`), capability, backingCapability: capability, resourceType, type,
      externalId: String(externalId), parentExternalId: extra.parent || null, displayName, handleOrCode: extra.handle || slug, currency: extra.currency || null,
      isSelectable: extra.selectable !== false, isSelected: false, metadata: { derivedFromProfile: capability === "ANALYTICS", source: platform === "GOOGLE" ? "google_ads_api" : "graph_api" }, lastSyncedAt: now,
    });
    const known = existing.map((i) => ({ name: i.account.displayName, id: i.account.externalId, handle: i.account.handle }));
    const pages = (fallback) => (known.length ? known : []).concat(fallback.filter((f) => !known.some((k) => k.name === f.name)));
    const out = [];
    switch (platform) {
      case "FACEBOOK": {
        const list = pages([{ name: brand, id: n("page1"), handle: slug }, { name: `${brand} KSA`, id: n("page2"), handle: `${slug}ksa` }, { name: `${brand} Careers`, id: n("page3"), handle: `${slug}careers` }]);
        list.forEach((pg) => out.push(mk("PUBLISHING", "FACEBOOK_PAGE", "PAGE", pg.name, pg.id, { handle: pg.handle })));
        out.push(mk("ADS", "FACEBOOK_AD_ACCOUNT", "AD_ACCOUNT", `${brand} — Meta Ads (SAR)`, `act_${n("ads1")}`, { currency: "SAR", handle: `act_${n("ads1")}` }));
        out.push(mk("ADS", "FACEBOOK_AD_ACCOUNT", "AD_ACCOUNT", `${brand} — Meta Ads (USD)`, `act_${n("ads2")}`, { currency: "USD", handle: `act_${n("ads2")}` }));
        out.push(mk("ANALYTICS", "FACEBOOK_PAGE_INSIGHTS", "INSIGHTS", `${list[0].name} Insights`, `${list[0].id}-insights`, { parent: list[0].id }));
        out.push(mk("MESSAGING", "FACEBOOK_MESSENGER", "INBOX", `${list[0].name} Messenger`, `${list[0].id}-inbox`, { parent: list[0].id }));
        break;
      }
      case "INSTAGRAM": {
        const list = pages([{ name: brand, id: n("ig1"), handle: slug }, { name: `${brand} KSA`, id: n("ig2"), handle: `${slug}.ksa` }]);
        list.forEach((pg) => out.push(mk("PUBLISHING", "INSTAGRAM_BUSINESS_ACCOUNT", "ACCOUNT", pg.name, pg.id, { handle: pg.handle })));
        out.push(mk("ADS", "FACEBOOK_AD_ACCOUNT", "AD_ACCOUNT", `${brand} — Meta Ads (SAR)`, `act_${n("ads1")}`, { currency: "SAR", handle: `act_${n("ads1")}` }));
        out.push(mk("ANALYTICS", "INSTAGRAM_INSIGHTS", "INSIGHTS", `@${list[0].handle} Insights`, `${list[0].id}-insights`, { parent: list[0].id }));
        out.push(mk("MESSAGING", "INSTAGRAM_DIRECT", "INBOX", `@${list[0].handle} Direct`, `${list[0].id}-inbox`, { parent: list[0].id }));
        break;
      }
      case "X": {
        const list = pages([{ name: brand, id: n("x1"), handle: `${brand.replace(/\s+/g, "")}HQ` }]);
        list.forEach((pg) => out.push(mk("PUBLISHING", "X_PROFILE", "ACCOUNT", pg.name, pg.id, { handle: pg.handle })));
        out.push(mk("ANALYTICS", "X_ANALYTICS", "INSIGHTS", `@${list[0].handle} Analytics`, `${list[0].id}-insights`, { parent: list[0].id }));
        break;
      }
      case "LINKEDIN": {
        const list = pages([{ name: brand, id: n("li1"), handle: slug }, { name: `${brand} Careers`, id: n("li2"), handle: `${slug}-careers` }]);
        list.forEach((pg) => out.push(mk("PUBLISHING", "LINKEDIN_ORGANIZATION", "ORGANIZATION", pg.name, pg.id, { handle: pg.handle })));
        out.push(mk("ADS", "LINKEDIN_AD_ACCOUNT", "AD_ACCOUNT", `${brand} — LinkedIn Ads`, n("liads"), { currency: "USD" }));
        out.push(mk("ANALYTICS", "LINKEDIN_PAGE_ANALYTICS", "INSIGHTS", `${list[0].name} Page Analytics`, `${list[0].id}-insights`, { parent: list[0].id }));
        break;
      }
      case "TIKTOK": {
        const list = pages([{ name: brand, id: n("tt1"), handle: slug }]);
        list.forEach((pg) => out.push(mk("PUBLISHING", "TIKTOK_ACCOUNT", "ACCOUNT", pg.name, pg.id, { handle: pg.handle })));
        out.push(mk("ADS", "TIKTOK_AD_ACCOUNT", "AD_ACCOUNT", `${brand} — TikTok Ads (AED)`, n("ttads"), { currency: "AED" }));
        out.push(mk("ANALYTICS", "TIKTOK_ANALYTICS", "INSIGHTS", `@${list[0].handle} Analytics`, `${list[0].id}-insights`, { parent: list[0].id }));
        break;
      }
      case "YOUTUBE": {
        const list = pages([{ name: `${brand} Kitchen`, id: `UC${n("yt1")}`, handle: `${brand.replace(/\s+/g, "")}Kitchen` }, { name: `${brand} Shorts`, id: `UC${n("yt2")}`, handle: `${brand.replace(/\s+/g, "")}Shorts` }]);
        list.forEach((pg) => out.push(mk("PUBLISHING", "YOUTUBE_CHANNEL", "CHANNEL", pg.name, pg.id, { handle: pg.handle })));
        out.push(mk("ANALYTICS", "YOUTUBE_ANALYTICS", "INSIGHTS", `${list[0].name} Analytics`, `${list[0].id}-insights`, { parent: list[0].id }));
        break;
      }
      case "GOOGLE": {
        const list = pages([{ name: `${brand} KSA — Google Ads`, id: n("gads1"), handle: "482-915-3307" }, { name: `${brand} UAE — Google Ads`, id: n("gads2"), handle: "590-118-2044" }]);
        list.forEach((pg, idx) => out.push(mk("ADS", "GOOGLE_ADS_CUSTOMER", "AD_ACCOUNT", pg.name, pg.id, { handle: pg.handle, currency: idx === 0 ? "SAR" : "AED" })));
        out.push(mk("ANALYTICS", "GA4_PROPERTY", "PROPERTY", `${brand} — GA4 (web)`, `properties/${n("ga4").slice(0, 9)}`));
        break;
      }
      default:
        break;
    }
    // Preselect the first resource of every capability so "Next" works right away.
    const seen = new Set();
    for (const r of out) if (!seen.has(r.capability)) { r.isSelected = true; seen.add(r.capability); }
    return out;
  }

  // A connect session after a good callback: an opaque id, bound to the person and the project.
  function makeTemp(s) {
    const db = getDb();
    const id = `tmp_${opaque()}`;
    const project = db.projects.find((x) => x.id === s.pr);
    const u = identity.findUser(s.u);
    if (!project || !u || !PLATFORMS[s.p]) return null;
    const m = PLATFORMS[s.p];
    const temp = {
      id, platform: s.p, projectId: project.id, userId: u.id, createdAt: nowIso(), resources: oauthResources(s.p, project),
      requiredScopes: [...m.scopes], grantedScopes: [...m.scopes],
      profile: { connectedAt: nowIso(), externalUserId: String(hashInt(`${u.email}:${s.p}`)), displayName: `${u.firstName} ${u.lastName}`, email: u.email, accountType: s.p === "GOOGLE" ? "GOOGLE_ACCOUNT" : "BUSINESS", isProfessional: s.p !== "GOOGLE" },
    };
    db.tempIntegrations[id] = temp;
    return temp;
  }

  const applySelections = (temp, selections) => {
    const byCap = new Map();
    for (const s of Array.isArray(selections) ? selections : []) {
      const cap = String(s.capability || "").toUpperCase() === "PUBLISH" ? "PUBLISHING" : String(s.capability || "").toUpperCase() === "ADVERTISING" ? "ADS" : String(s.capability || "").toUpperCase();
      byCap.set(cap, new Set(listParam(s.resourceIds)));
    }
    for (const r of temp.resources) r.isSelected = byCap.has(r.capability) ? byCap.get(r.capability).has(r.id) : false;
  };

  // POST /integrations/:platform/connect -> { authUrl, state }. The return address is configured here
  // (the app's callback route, without a language: next-intl adds it); a redirectUri in the body is
  // ignored (MKT-060).
  app.post("/integrations/:platform/connect", h.handle((req, res, u, project) => {
    const platform = normPlatform(req.params.platform);
    if (!PLATFORMS[platform]) return error(res, 422, `Unsupported platform "${req.params.platform}"`);
    const redirectUri = `${ctx.webUrl(ctx.key)}/integrations/platform/${platform}/callback`;
    const state = opaque();
    const url = new URL(redirectUri);
    url.searchParams.set("code", `local_${newId().replace(/-/g, "").slice(0, 24)}`);
    url.searchParams.set("state", state);
    if (PLATFORMS[platform].oauthVersion.startsWith("1")) {
      url.searchParams.set("oauth_token", `local_${newId().slice(0, 12)}`);
      url.searchParams.set("oauth_verifier", newId().slice(0, 12));
    }
    getDb().oauthStates[state] = { platform, projectId: project.id, userId: u.id, redirectUri, createdAt: nowIso(), expiresAt: Date.now() + STATE_TTL_MS };
    send(res, { authUrl: url.toString(), state, redirectUri, provider: PLATFORMS[platform].name, simulated: true }, `Redirecting to ${PLATFORMS[platform].name} (simulated locally)`);
  }));

  const callback = h.handle((req, res, u) => {
    const platform = normPlatform(req.params.platform);
    const payload = req.method === "GET" ? req.query : req.body || {};
    const state = payload.state;
    if (!state || !(payload.code || payload.oauth_verifier)) return error(res, 400, "Missing OAuth code or state — please start the connection again");
    const db = getDb();
    const rec = db.oauthStates[state];
    // Spent on first use, whatever the outcome: a state is never accepted twice.
    if (rec) delete db.oauthStates[state];
    if (!rec || rec.expiresAt < Date.now() || rec.userId !== u.id || rec.platform !== platform) {
      return error(res, 400, "This sign-in wasn't started here, or it expired — please start the connection again", { code: "invalid_state" });
    }
    const temp = makeTemp({ p: rec.platform, pr: rec.projectId, u: rec.userId });
    if (!temp) return error(res, 400, "Invalid or expired OAuth state — please start the connection again", { code: "invalid_state" });
    send(res, views.wizardView(temp), "Account authorized — choose the resources to connect");
  }, { needsProject: false });
  app.post("/integrations/:platform/callback", callback);
  app.get("/integrations/:platform/callback", ctx.identity.workspaceMode ? (_req, res) => error(res, 405, "Confirm the simulated connection using POST", { code: "workspace_command_required" }) : callback);

  // Only the person who authorized may continue their connect session.
  const tempFromBody = (req, u) => {
    const temp = getDb().tempIntegrations[String(req.body?.tempDataId || "")];
    return temp && temp.userId === u.id ? temp : null;
  };

  app.post("/integrations/:platform/preflight", h.handle((req, res, u) => {
    const temp = tempFromBody(req, u);
    if (!temp || temp.platform !== normPlatform(req.params.platform)) return error(res, 404, "Connection session expired — please connect again");
    applySelections(temp, req.body?.selections);
    if (!temp.resources.some((r) => r.isSelected)) return error(res, 422, "Select at least one resource to continue");
    send(res, views.wizardView(temp), "Selection verified");
  }, { needsProject: false }));

  function finish(temp, u) {
    const db = getDb();
    const m = PLATFORMS[temp.platform];
    const pub = temp.resources.find((r) => r.capability === "PUBLISHING" && r.isSelected) || temp.resources.find((r) => r.capability === "ADS" && r.isSelected) || temp.resources.find((r) => r.isSelected);
    const existing = db.integrations.find((i) => i.projectId === temp.projectId && i.platform === temp.platform && i.account.externalId === pub.externalId);
    const now = nowIso();
    const r = hashInt(`${temp.projectId}:${temp.platform}:${pub.externalId}`);
    const followers = temp.platform === "GOOGLE" ? 0 : 3000 + (r % 57000);
    if (existing) {
      Object.assign(existing, {
        status: "CONNECTED", isConnected: true, requiresReconnect: false, resources: temp.resources.map((x) => ({ ...x })), grantedScopes: [...temp.grantedScopes],
        requiredScopes: [...temp.requiredScopes], lastSyncedAt: now, expiresAt: m.requiresRefreshToken ? at(60, 0, 0) : at(58, 0, 0), updatedAt: now,
      });
      return { integration: existing, reconnected: true };
    }
    const i = {
      id: newId(), projectId: temp.projectId, platform: temp.platform, status: "CONNECTED", isConnected: true, requiresReconnect: false,
      account: {
        displayName: pub.displayName, handle: pub.handleOrCode, externalId: pub.externalId, category: temp.platform === "GOOGLE" ? "Google Ads account" : "Brand",
        websiteUrl: null, email: temp.profile.email, followers, following: temp.platform === "GOOGLE" ? 0 : 20 + (r % 400), basePosts: temp.platform === "GOOGLE" ? 0 : 40 + (r % 600), color: m.color,
      },
      requiredScopes: [...temp.requiredScopes], grantedScopes: [...temp.grantedScopes], resources: temp.resources.map((x) => ({ ...x })),
      connectedAt: now, expiresAt: m.requiresRefreshToken ? at(60, 0, 0) : at(58, 0, 0), lastSyncedAt: now, connectedByUserId: u.id,
      audience: { topCountries: [["Egypt", 55], ["Saudi Arabia", 20], ["United Arab Emirates", 12], ["Kuwait", 7], ["Qatar", 6]], ageGroups: [["18-24", 22], ["25-34", 39], ["35-44", 23], ["45-54", 11], ["55+", 5]], gender: { male: 47, female: 51, unknown: 2 } },
      createdAt: now, updatedAt: now,
    };
    db.integrations.push(i);
    return { integration: i, reconnected: false };
  }

  app.post("/integrations/:platform/finish", h.handle((req, res, u) => {
    const temp = tempFromBody(req, u);
    if (!temp || temp.platform !== normPlatform(req.params.platform)) return error(res, 404, "Connection session expired — please connect again");
    if (req.body?.selections) applySelections(temp, req.body.selections);
    if (!temp.resources.some((r) => r.isSelected)) return error(res, 422, "Select at least one resource to finish the connection");
    const { integration, reconnected } = finish(temp, u);
    send(res, views.wizardView(temp, { integrationId: integration.id, requiresSelection: false, integration: views.integrationListView(integration) }), `${meta(temp.platform).name} ${reconnected ? "reconnected" : "connected"} successfully`);
  }, { needsProject: false }));

  // Legacy Facebook page picker: { pageId, projectId }.
  app.post("/integrations/facebook/complete", h.handle((req, res, u, project) => {
    const db = getDb();
    const temp = Object.values(db.tempIntegrations).filter((t) => t.platform === "FACEBOOK" && t.userId === u.id).pop()
      || makeTemp({ p: "FACEBOOK", pr: project.id, u: u.id });
    const pageId = String(req.body?.pageId || "");
    const page = temp.resources.find((r) => r.capability === "PUBLISHING" && (r.id === pageId || r.externalId === pageId)) || temp.resources.find((r) => r.capability === "PUBLISHING");
    temp.resources.forEach((r) => { if (r.capability === "PUBLISHING") r.isSelected = r === page; });
    const { integration } = finish(temp, u);
    send(res, views.integrationListView(integration), "Facebook page connected successfully");
  }));

  // ---------------------------------------------------------------- per-integration actions
  app.get("/integrations/:id", h.handle((req, res, u) => {
    const i = visibleIntegration(req.params.id, u);
    if (!i) return h.notFound(res, "Integration");
    send(res, views.integrationDetailView(i), "Integration fetched successfully");
  }, { needsProject: false }));

  app.patch("/integrations/:id/toggle", h.handle((req, res, u) => {
    const i = visibleIntegration(req.params.id, u);
    if (!i) return h.notFound(res, "Integration");
    i.isConnected = !i.isConnected;
    i.status = i.isConnected ? "CONNECTED" : "DISCONNECTED";
    i.updatedAt = nowIso();
    send(res, views.integrationListView(i), `${meta(i.platform).name} ${i.isConnected ? "enabled" : "disabled"}`);
  }, { needsProject: false }));

  app.post("/integrations/:id/sync", h.handle((req, res, u) => {
    const i = visibleIntegration(req.params.id, u);
    if (!i) return h.notFound(res, "Integration");
    Object.assign(i, { lastSyncedAt: nowIso(), requiresReconnect: false, grantedScopes: [...i.requiredScopes], updatedAt: nowIso() });
    send(res, views.integrationListView(i), `${meta(i.platform).name} synced`);
  }, { needsProject: false }));

  app.delete("/integrations/:id", h.handle((req, res, u) => {
    const i = visibleIntegration(req.params.id, u);
    if (!i) return h.notFound(res, "Integration");
    const db = getDb();
    db.integrations = db.integrations.filter((x) => x.id !== i.id);
    send(res, { id: i.id }, `${meta(i.platform).name} account removed`);
  }, { needsProject: false }));
};
