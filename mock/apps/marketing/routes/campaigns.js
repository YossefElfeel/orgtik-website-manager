// Campaigns: list/CRUD, the per-type onboarding wizard (SETTINGS, POSTS, AD_SETS_AND_ADS, AD_GROUPS,
// MESSAGE, REVIEW), publish, approvals (add/remove reviewers, approve, reject, request, rollback), comments.
const { send, error, newId, nowIso, parseDate, listParam, paginate, textMatch, clone } = require("../lib");
const { meta, normPlatform, PLATFORMS } = require("../catalog");

const TYPES = ["SOCIAL_MEDIA", "PAID_SOCIAL_ADS", "GOOGLE_SEARCH_ADS", "MESSAGING"];
const FIRST_STEP = { SOCIAL_MEDIA: "POSTS", PAID_SOCIAL_ADS: "SETTINGS", GOOGLE_SEARCH_ADS: "SETTINGS", MESSAGING: "MESSAGE" };
const CTAS = ["LEARN_MORE", "SHOP_NOW", "SIGN_UP", "CONTACT_US", "BOOK_NOW", "GET_QUOTE", "APPLY_NOW", "DOWNLOAD", "GET_OFFER", "SUBSCRIBE", "WATCH_MORE"];

module.exports = function campaignRoutes(app, { ctx, getDb, views, h, tick }) {
  const { identity } = ctx;

  const findCampaign = (id, u) => {
    const c = getDb().campaigns.find((x) => x.id === id);
    if (!c) return null;
    const project = getDb().projects.find((x) => x.id === c.projectId);
    return project && h.canSee(project, u) ? c : null;
  };
  const withCampaign = (fn) => h.handle((req, res, u) => {
    tick();
    const c = findCampaign(req.params.id, u);
    if (!c) return h.notFound(res, "Campaign");
    return fn(req, res, u, c);
  }, { needsProject: false });

  const byStart = (c) => (c.startAt && new Date(c.startAt) <= new Date() ? "RUNNING" : "READY");
  const nameOf = (userId) => views.fullName(identity.findUser(userId));
  const activity = (c, u, text) => getDb().campaignComments.push({ id: newId(), campaignId: c.id, userId: u.id, text, type: "activity", createdAt: nowIso(), updatedAt: nowIso() });
  const snapshot = (c) => clone({ name: c.name, description: c.description, categoryNames: c.categoryNames, startAt: c.startAt, endAt: c.endAt, configuration: c.configuration, adSets: c.adSets, approvedAt: nowIso(), approvalVersion: c.approvalVersion });
  const linkPosts = (c) => {
    const ids = new Set(c.adSets.flatMap((s) => s.ads.map((a) => a.unifiedPostTargetId)).filter(Boolean));
    for (const p of getDb().posts) {
      if (ids.has(p.id) && !p.campaignIds.includes(c.id)) p.campaignIds.push(c.id);
    }
  };
  // Editing approved content sends it back to the approvers.
  function markEdited(c) {
    c.updatedAt = nowIso();
    if (c.approvalStatus === "APPROVED" && c.reviewers.length) {
      c.reviewers.forEach((r) => Object.assign(r, { status: "PENDING", decidedAt: null, note: null }));
      c.approvalStatus = "PENDING_APPROVAL";
      c.workflowState = "REAPPROVAL_REQUIRED";
      c.approvalVersion += 1;
    }
  }
  // Resolve a post id (or one of its target ids) inside the campaign's brand.
  const resolvePost = (projectId, id) => {
    const db = getDb();
    return db.posts.find((p) => p.projectId === projectId && (p.id === id || p.targets.some((t) => t.id === id))) || null;
  };
  const projectIntegration = (projectId, id) => getDb().integrations.find((i) => i.projectId === projectId && i.id === id) || null;
  const reuseId = (c, name, platform) => c.adSets.find((s) => s.name === name && (s.platform || null) === (platform || null))?.id || newId();

  // ---------------------------------------------------------------- list & CRUD
  app.get("/campaigns", h.handle((req, res, u, project) => {
    tick();
    const q = req.query;
    let list = getDb().campaigns.filter((c) => c.projectId === project.id);
    if (q.search || q.name) list = list.filter((c) => textMatch(q.search || q.name, c.name, c.description));
    if (q.type) list = list.filter((c) => c.type === String(q.type).toUpperCase());
    if (q.status) list = list.filter((c) => c.status === String(q.status).toUpperCase() || c.workflowState === String(q.status).toUpperCase());
    list = [...list].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    const { items, meta: m } = paginate(list, q, 10);
    send(res, { items: items.map(views.campaignListItem), meta: m }, "Campaigns fetched successfully");
  }));

  app.post("/campaigns", h.handle((req, res, u, project) => {
    const b = req.body || {};
    const name = String(b.name || "").trim();
    const type = String(b.type || "").toUpperCase();
    if (!name) return error(res, 422, "Campaign name is required", { errors: { name: ["Campaign name is required"] } });
    if (!TYPES.includes(type)) return error(res, 422, `type must be one of ${TYPES.join(", ")}`);
    const now = nowIso();
    const c = {
      id: newId(), key: null, projectId: project.id, userId: u.id, type, name, description: b.description?.trim() || null,
      categoryNames: listParam(b.categoryNames).map((x) => x.toUpperCase()), startAt: null, endAt: null,
      status: "DRAFT", isComplete: false, workflowState: "DRAFT", approvalStatus: "NOT_REQUIRED", approvalNote: null, approvalVersion: 1,
      configuration: {}, adSets: [], reviewers: [], lastApprovedSnapshot: null, onboardingStep: FIRST_STEP[type], publishedAt: null, createdAt: now, updatedAt: now,
    };
    getDb().campaigns.push(c);
    send(res, views.campaignView(c), "Campaign draft created", 201);
  }));

  app.get("/campaigns/:id", withCampaign((req, res, u, c) => send(res, views.campaignView(c), "Campaign fetched successfully")));
  app.get("/ads/campaigns/:id", withCampaign((req, res, u, c) => send(res, views.campaignView(c), "Campaign fetched successfully")));

  app.patch("/campaigns/:id", withCampaign((req, res, u, c) => {
    const b = req.body || {};
    if (b.name !== undefined) {
      const name = String(b.name).trim();
      if (!name) return error(res, 422, "Campaign name is required");
      c.name = name;
    }
    if (b.type !== undefined) {
      const type = String(b.type).toUpperCase();
      if (!TYPES.includes(type)) return error(res, 422, `type must be one of ${TYPES.join(", ")}`);
      if (type !== c.type) {
        // Different campaign types have different structures — start the wizard over.
        c.type = type;
        c.configuration = {};
        c.adSets = [];
        c.isComplete = false;
        c.onboardingStep = FIRST_STEP[type];
      }
    }
    if (b.categoryNames !== undefined) c.categoryNames = listParam(b.categoryNames).map((x) => x.toUpperCase());
    if (b.description !== undefined) c.description = String(b.description || "").trim() || null;
    if (b.startAt !== undefined) c.startAt = parseDate(b.startAt, null);
    if (b.endAt !== undefined) c.endAt = parseDate(b.endAt, null);
    if (b.status && ["DRAFT", "READY", "RUNNING", "PAUSED"].includes(String(b.status).toUpperCase())) {
      c.status = String(b.status).toUpperCase();
      if (["RUNNING", "PAUSED"].includes(c.status)) c.workflowState = c.status;
    }
    markEdited(c);
    send(res, views.campaignView(c), c.workflowState === "REAPPROVAL_REQUIRED" ? "Campaign updated — changes need re-approval" : "Campaign updated successfully");
  }));

  const removeCampaign = withCampaign((req, res, u, c) => {
    const db = getDb();
    db.campaigns = db.campaigns.filter((x) => x.id !== c.id);
    db.campaignComments = db.campaignComments.filter((x) => x.campaignId !== c.id);
    db.posts.forEach((p) => { p.campaignIds = p.campaignIds.filter((id) => id !== c.id); });
    send(res, { id: c.id }, "Campaign deleted successfully");
  });
  app.delete("/ads/campaigns/:id", removeCampaign);
  app.delete("/campaigns/:id", removeCampaign);

  // ---------------------------------------------------------------- onboarding (wizard steps)
  app.get("/campaigns/:id/onboarding/:step", withCampaign((req, res, u, c) => {
    const view = views.onboardingStepView(c, req.params.step);
    if (!view) return error(res, 400, `Unknown onboarding step "${req.params.step}"`);
    send(res, view, "Onboarding step fetched successfully");
  }));
  app.get("/campaigns/:id/onboarding", withCampaign((req, res, u, c) => {
    send(res, { currentStep: c.onboardingStep, isComplete: c.isComplete, steps: ["DETAILS", "SETTINGS", "POSTS", "AD_SETS_AND_ADS", "AD_GROUPS", "MESSAGE", "REVIEW"].map((s) => views.onboardingStepView(c, s)) }, "Onboarding fetched successfully");
  }));

  const STEP_HANDLERS = {
    DETAILS(c, b) {
      if (b.name !== undefined) c.name = String(b.name).trim() || c.name;
      if (b.description !== undefined) c.description = String(b.description || "").trim() || null;
      if (b.categoryNames !== undefined) c.categoryNames = listParam(b.categoryNames).map((x) => x.toUpperCase());
      return null;
    },
    SETTINGS(c, b) {
      const cfg = b.configuration || {};
      const startAt = b.startAt !== undefined ? parseDate(b.startAt, null) : c.startAt;
      const endAt = b.endAt !== undefined ? parseDate(b.endAt, null) : c.endAt;
      if (startAt && endAt && new Date(endAt) < new Date(startAt)) return "End date must be after the start date";
      if (cfg.budgetAmount !== undefined && !(Number(cfg.budgetAmount) > 0)) return "Budget must be greater than 0";
      let currency = c.configuration.budgetCurrency;
      if (c.type === "GOOGLE_SEARCH_ADS") {
        const i = projectIntegration(c.projectId, cfg.integrationId);
        if (!cfg.integrationId || !i || i.platform !== "GOOGLE") return "Select a connected Google Ads account for this brand";
        if (!i.isConnected) return "The selected Google Ads account is disconnected — reconnect it in Integrations";
        if (!listParam(cfg.locations).length) return "Add at least one location target";
        // The budget is in the chosen account's currency, also when the account changes (wave 5).
        currency = i.resources.find((r) => r.capability === "ADS")?.currency || currency || "USD";
      }
      if (c.type === "PAID_SOCIAL_ADS") {
        const aud = cfg.audience || {};
        if (aud.ageMin != null && aud.ageMax != null && Number(aud.ageMax) < Number(aud.ageMin)) return "Maximum age must be greater than minimum age";
        // Until an ad account is picked per ad set, the project's currency, not a fixed USD (wave 5).
        currency = currency || getDb().projects.find((x) => x.id === c.projectId)?.currency || "USD";
      }
      c.startAt = startAt;
      c.endAt = endAt;
      c.configuration = { ...c.configuration, ...cfg, budgetAmount: cfg.budgetAmount !== undefined ? Number(cfg.budgetAmount) : c.configuration.budgetAmount, budgetCurrency: currency };
      c.onboardingStep = c.type === "GOOGLE_SEARCH_ADS" ? "AD_GROUPS" : "AD_SETS_AND_ADS";
      return null;
    },
    POSTS(c, b) {
      const sets = Array.isArray(b.adSets) ? b.adSets : [];
      const out = [];
      for (const s of sets) {
        const i = projectIntegration(c.projectId, s.integrationId);
        if (!i) return `Integration ${s.integrationId || "(missing)"} was not found in this brand`;
        const ads = [];
        for (const a of s.ads || []) {
          const p = resolvePost(c.projectId, a.unifiedPostTargetId);
          if (!p) return `Post ${a.unifiedPostTargetId} was not found in this brand`;
          ads.push({ id: newId(), name: String(a.name || p.title), unifiedPostTargetId: p.id, creative: { title: p.title, source: "EXISTING", postId: p.id } });
        }
        const name = String(s.name || `${meta(i.platform).name} posts`);
        out.push({ id: reuseId(c, name, i.platform), name, platform: i.platform, deliveryPlatform: i.platform, integrationId: i.id, startAt: parseDate(s.startAt, null), endAt: parseDate(s.endAt, null), configuration: {}, ads });
      }
      if (b.startAt !== undefined) c.startAt = parseDate(b.startAt, null);
      if (b.endAt !== undefined) c.endAt = parseDate(b.endAt, null);
      if (c.startAt && c.endAt && new Date(c.endAt) < new Date(c.startAt)) return "End date must be after the start date";
      c.adSets = out;
      linkPosts(c);
      c.onboardingStep = "REVIEW";
      return null;
    },
    AD_SETS_AND_ADS(c, b) {
      if (c.type === "GOOGLE_SEARCH_ADS") return STEP_HANDLERS.AD_GROUPS(c, b);
      const sets = Array.isArray(b.adSets) ? b.adSets : [];
      const out = [];
      for (const s of sets) {
        const i = projectIntegration(c.projectId, s.integrationId);
        if (!i) return `Integration ${s.integrationId || "(missing)"} was not found in this brand`;
        const ads = [];
        for (const a of s.ads || []) {
          const p = resolvePost(c.projectId, a.unifiedPostTargetId);
          if (!p) return `Post ${a.unifiedPostTargetId} was not found in this brand`;
          const cta = CTAS.includes(String(a.callToAction || "").toUpperCase()) ? String(a.callToAction).toUpperCase() : "LEARN_MORE";
          ads.push({ id: newId(), name: String(a.name || p.title), unifiedPostTargetId: p.id, callToAction: cta, creative: { title: p.title, source: "EXISTING", postId: p.id } });
        }
        const name = String(s.name || `${meta(i.platform).name} Ad Set`);
        out.push({ id: reuseId(c, name, i.platform), name, platform: i.platform, deliveryPlatform: i.platform, integrationId: i.id, startAt: parseDate(s.startAt, null), endAt: parseDate(s.endAt, null), configuration: s.configuration || {}, ads });
      }
      c.adSets = out;
      linkPosts(c);
      c.onboardingStep = "REVIEW";
      return null;
    },
    AD_GROUPS(c, b) {
      const groups = Array.isArray(b.adSets) ? b.adSets : [];
      const out = [];
      for (const g of groups) {
        const ads = [];
        for (const a of g.ads || []) {
          const cfg = a.configuration || {};
          if (!cfg.finalUrl || !/^https?:\/\//i.test(cfg.finalUrl) && !/^[\w.-]+\.[a-z]{2,}/i.test(cfg.finalUrl)) return `Responsive search ad "${a.name || "Ad"}" needs a valid final URL`;
          ads.push({ id: newId(), name: String(a.name || "Responsive search ad"), configuration: { finalUrl: cfg.finalUrl, headlines: Array.isArray(cfg.headlines) ? cfg.headlines : [], descriptions: Array.isArray(cfg.descriptions) ? cfg.descriptions : [], ...(cfg.displayPath ? { displayPath: cfg.displayPath } : {}) } });
        }
        const cfg = g.configuration || {};
        const name = String(g.name || "Ad Group");
        out.push({
          id: reuseId(c, name, "GOOGLE"), name, platform: "GOOGLE", deliveryPlatform: "GOOGLE", integrationId: c.configuration.integrationId || null, startAt: null, endAt: null,
          configuration: { ...(cfg.defaultBidMicros ? { defaultBidMicros: Number(cfg.defaultBidMicros) } : {}), keywords: cfg.keywords || [], negativeKeywords: cfg.negativeKeywords || [] }, ads,
        });
      }
      c.adSets = out;
      c.onboardingStep = "REVIEW";
      return null;
    },
    async MESSAGE(c, b) {
      const db = getDb();
      const sets = Array.isArray(b.adSets) ? b.adSets : [];
      if (!sets.length) return "Add the message configuration";
      const out = [];
      for (const s of sets) {
        const cfg = s.configuration || {};
        const channel = String(cfg.channel || "").toUpperCase();
        if (!["EMAIL", "SMS", "WHATSAPP"].includes(channel)) return "channel must be EMAIL, SMS or WHATSAPP";
        const sender = db.senders.find((x) => x.id === cfg.senderConfigId && (!x.projectId || x.projectId === c.projectId));
        if (!sender) return "Select a sender for this channel";
        if (sender.channel !== channel) return `The selected sender is not a ${channel} sender`;
        const template = db.templates.find((x) => x.id === cfg.templateId && (!x.projectId || x.projectId === c.projectId));
        if (!template) return "Select or create a template before continuing";
        if (template.channel !== channel) return `The selected template is not a ${channel} template`;
        const refs = cfg.crmRecipientRefs || c.crmRecipientRefs;
        if (!Array.isArray(refs) || !refs.length || refs.length > 200 || refs.some(ref => ref.workspaceId !== ctx.workspaceId || typeof ref.contactId !== "string")) return "Choose actual CRM recipients on the audience step first";
        if (!ctx.crmDirectory) throw Object.assign(new Error("Review the current CRM connection"), { status: 503 });
        const current = await ctx.crmDirectory.resolve({ contactIds: refs.map(ref => ref.contactId) });
        if (refs.some(ref => !current.contacts.some(contact => contact.id === ref.contactId))) return "A current CRM recipient is unavailable";
        const name = String(s.name || "CRM contacts");
        out.push({
          id: c.adSets[0]?.id || newId(), name, platform: null, deliveryPlatform: channel, integrationId: null, startAt: null, endAt: null,
          configuration: { channel, crmRecipientRefs: clone(refs), senderConfigId: sender.id, templateId: template.id }, ads: [],
        });
      }
      if (b.startAt !== undefined) c.startAt = parseDate(b.startAt, null);
      c.endAt = null;
      c.adSets = out;
      c.crmRecipientRefs = clone(out[0].configuration.crmRecipientRefs);
      c.configuration = { ...c.configuration, crmRecipientRefs: clone(c.crmRecipientRefs), senderConfigId: out[0].configuration.senderConfigId, templateId: out[0].configuration.templateId, v3TemplateVersion: db.templates.find(t => t.id === out[0].configuration.templateId)?.v3Version || 0 };
      c.onboardingStep = "REVIEW";
      return null;
    },
    REVIEW(c, b, u) {
      const approval = b.approval || {};
      const ids = [...new Set(listParam(approval.reviewerIds).map(Number))].filter((id) => identity.findUser(id));
      for (const id of ids) {
        if (!c.reviewers.some((r) => r.reviewerUserId === id)) c.reviewers.push({ id: newId(), reviewerUserId: id, status: "PENDING", note: null, decidedAt: null, assignedByUserId: u.id, createdAt: nowIso() });
      }
      if (approval.note !== undefined) c.approvalNote = String(approval.note || "").trim() || null;
      c.isComplete = true;
      c.onboardingStep = "REVIEW";
      if (b.saveAsDraft) {
        c.status = "DRAFT";
        if (!["REJECTED"].includes(c.workflowState)) c.workflowState = "DRAFT";
      }
      return null;
    },
  };

  app.patch("/campaigns/:id/onboarding", withCampaign(async(req, res, u, c) => {
    const b = req.body || {};
    const step = String(b.step || "").toUpperCase();
    const handler = STEP_HANDLERS[step];
    if (!handler) return error(res, 400, `Unknown onboarding step "${b.step}"`);
    const before = JSON.stringify({ n: c.name, d: c.description, s: c.startAt, e: c.endAt, cfg: c.configuration, a: c.adSets });
    const problem = await handler(c, b, u);
    if (problem) return error(res, 422, problem);
    if (step !== "REVIEW" && before !== JSON.stringify({ n: c.name, d: c.description, s: c.startAt, e: c.endAt, cfg: c.configuration, a: c.adSets })) markEdited(c);
    c.updatedAt = nowIso();
    const saved = { SETTINGS: "Settings saved", POSTS: "Posts saved", AD_SETS_AND_ADS: "Ad sets saved", AD_GROUPS: "Ad groups saved", MESSAGE: "Message saved", REVIEW: b.saveAsDraft ? "Campaign saved as draft" : "Review saved", DETAILS: "Details saved" }[step];
    send(res, views.onboardingStepView(c, step), saved);
  }));

  app.post("/campaigns/:id/publish", withCampaign((req, res, u, c) => {
    if (!c.adSets.length) {
      const what = { SOCIAL_MEDIA: "at least one platform with a post", PAID_SOCIAL_ADS: "at least one ad set", GOOGLE_SEARCH_ADS: "at least one ad group", MESSAGING: "an audience and a message" }[c.type];
      return error(res, 422, `Add ${what} before publishing`);
    }
    if (c.type === "GOOGLE_SEARCH_ADS" && !c.configuration.integrationId) return error(res, 422, "Complete the campaign settings (Google Ads account) before publishing");
    c.isComplete = true;
    c.publishedAt = nowIso();
    c.updatedAt = c.publishedAt;
    const waiting = c.reviewers.filter((r) => r.status !== "APPROVED");
    let msg;
    if (c.reviewers.length && waiting.length) {
      waiting.forEach((r) => Object.assign(r, { status: "PENDING", decidedAt: null }));
      c.status = "READY";
      c.workflowState = "AWAITING_REVIEW";
      c.approvalStatus = "PENDING_APPROVAL";
      activity(c, u, `requested approval from ${waiting.map((r) => nameOf(r.reviewerUserId)).join(", ")}`);
      msg = `Campaign submitted — waiting for ${waiting.length} approver${waiting.length === 1 ? "" : "s"}`;
    } else {
      c.approvalStatus = c.reviewers.length ? "APPROVED" : "NOT_REQUIRED";
      c.lastApprovedSnapshot = snapshot(c);
      c.status = byStart(c);
      c.workflowState = c.status;
      activity(c, u, c.status === "RUNNING" ? "published this campaign — it is now running" : "published this campaign — it will start on schedule");
      msg = c.status === "RUNNING" ? "Campaign published and running" : "Campaign published — scheduled to start";
    }
    send(res, views.campaignView(c), msg);
  }));

  // ---------------------------------------------------------------- approvals
  app.post("/campaigns/:id/reviewers", withCampaign((req, res, u, c) => {
    const ids = [...new Set(listParam(req.body?.reviewerIds).map(Number))].filter((id) => identity.findUser(id));
    if (!ids.length) return error(res, 422, "Select at least one approver");
    const added = [];
    for (const id of ids) {
      if (c.reviewers.some((r) => r.reviewerUserId === id)) continue;
      c.reviewers.push({ id: newId(), reviewerUserId: id, status: "PENDING", note: null, decidedAt: null, assignedByUserId: u.id, createdAt: nowIso() });
      added.push(id);
    }
    if (added.length && c.approvalStatus !== "NOT_REQUIRED" && c.publishedAt) {
      c.approvalStatus = "PENDING_APPROVAL";
      c.workflowState = "AWAITING_REVIEW";
    }
    c.updatedAt = nowIso();
    send(res, views.campaignView(c), added.length ? `${added.length} approver${added.length === 1 ? "" : "s"} added` : "Approvers already assigned");
  }));

  app.delete("/campaigns/:id/reviewers/:reviewerId", withCampaign((req, res, u, c) => {
    const rid = req.params.reviewerId;
    const r = c.reviewers.find((x) => x.id === rid || String(x.reviewerUserId) === rid);
    if (!r) return h.notFound(res, "Approver");
    c.reviewers = c.reviewers.filter((x) => x !== r);
    if (!c.reviewers.length) {
      if (c.approvalStatus !== "NOT_REQUIRED") c.approvalStatus = "NOT_REQUIRED";
      if (["AWAITING_REVIEW", "REJECTED", "REAPPROVAL_REQUIRED"].includes(c.workflowState)) c.workflowState = c.publishedAt ? byStart(c) : "DRAFT";
    } else if (c.approvalStatus === "PENDING_APPROVAL" && c.reviewers.every((x) => x.status === "APPROVED")) {
      c.approvalStatus = "APPROVED";
      if (c.publishedAt) c.status = c.workflowState = byStart(c);
    }
    c.updatedAt = nowIso();
    send(res, views.campaignView(c), "Approver removed");
  }));

  function decide(req, res, u, c, decision) {
    const r = c.reviewers.find((x) => x.reviewerUserId === u.id);
    if (!r) return error(res, 403, "Only assigned approvers can approve or reject this campaign");
    const note = req.body?.note?.trim() || null;
    Object.assign(r, { status: decision, note, decidedAt: nowIso() });
    activity(c, u, decision === "APPROVED" ? `approved this campaign${note ? `: ${note}` : ""}` : `rejected this campaign${note ? `: ${note}` : ""}`);
    let msg;
    if (c.reviewers.some((x) => x.status === "REJECTED")) {
      c.approvalStatus = "REJECTED";
      c.workflowState = "REJECTED";
      c.status = "DRAFT";
      if (note) c.approvalNote = note;
      msg = "Campaign rejected";
    } else if (c.reviewers.every((x) => x.status === "APPROVED")) {
      c.approvalStatus = "APPROVED";
      c.lastApprovedSnapshot = snapshot(c);
      if (c.publishedAt || c.status !== "DRAFT") {
        c.status = byStart(c);
        c.workflowState = c.status;
      } else {
        c.workflowState = "APPROVED";
      }
      msg = "Campaign approved by all approvers";
    } else {
      c.approvalStatus = "PENDING_APPROVAL";
      c.workflowState = "AWAITING_REVIEW";
      msg = "Approval recorded — waiting for the other approvers";
    }
    c.updatedAt = nowIso();
    send(res, views.campaignView(c), msg);
  }
  app.patch("/campaigns/:id/approve", withCampaign((req, res, u, c) => decide(req, res, u, c, "APPROVED")));
  app.patch("/campaigns/:id/reject", withCampaign((req, res, u, c) => decide(req, res, u, c, "REJECTED")));

  app.post("/campaigns/:id/request-approval", withCampaign((req, res, u, c) => {
    if (!c.reviewers.length) return error(res, 422, "Add at least one approver first");
    const waiting = c.reviewers.filter((r) => r.status !== "APPROVED");
    waiting.forEach((r) => Object.assign(r, { status: "PENDING", decidedAt: null, note: null }));
    if (req.body?.note !== undefined) c.approvalNote = String(req.body.note || "").trim() || c.approvalNote;
    c.approvalStatus = waiting.length ? "PENDING_APPROVAL" : "APPROVED";
    c.workflowState = waiting.length ? "AWAITING_REVIEW" : c.workflowState;
    if (c.status === "DRAFT" && c.isComplete) c.status = "READY";
    activity(c, u, `requested approval from ${waiting.map((r) => nameOf(r.reviewerUserId)).join(", ") || "no one (everyone already approved)"}`);
    c.updatedAt = nowIso();
    send(res, views.campaignView(c), waiting.length ? `Approval requested from ${waiting.length} approver${waiting.length === 1 ? "" : "s"}` : "Everyone has already approved");
  }));

  app.patch("/campaigns/:id/rollback-last-approved", withCampaign((req, res, u, c) => {
    const s = c.lastApprovedSnapshot;
    if (!s) return error(res, 409, "This campaign has no approved version to roll back to yet");
    Object.assign(c, { name: s.name, description: s.description, categoryNames: clone(s.categoryNames), startAt: s.startAt, endAt: s.endAt, configuration: clone(s.configuration), adSets: clone(s.adSets) });
    c.reviewers.forEach((r) => Object.assign(r, { status: "APPROVED", decidedAt: r.decidedAt || s.approvedAt, note: null }));
    c.approvalStatus = c.reviewers.length ? "APPROVED" : "NOT_REQUIRED";
    if (c.publishedAt) c.status = byStart(c);
    c.workflowState = c.publishedAt ? c.status : "APPROVED";
    activity(c, u, "rolled back to the last approved version");
    c.updatedAt = nowIso();
    send(res, views.campaignView(c), "Rolled back to the last approved version");
  }));

  // ---------------------------------------------------------------- comments
  app.get("/campaigns/:id/comments", withCampaign((req, res, u, c) => {
    const list = getDb().campaignComments.filter((x) => x.campaignId === c.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    send(res, list.map(views.campaignCommentView), "Comments fetched successfully");
  }));
  app.post("/campaigns/:id/comments", withCampaign((req, res, u, c) => {
    const text = String(req.body?.text || "").trim();
    if (!text) return error(res, 422, "Comment text is required");
    const row = { id: newId(), campaignId: c.id, userId: u.id, text, type: "comment", createdAt: nowIso(), updatedAt: nowIso() };
    getDb().campaignComments.push(row);
    send(res, views.campaignCommentView(row), "Comment added", 201);
  }));

  // ---------------------------------------------------------------- meta
  app.get("/meta/ad-status", h.handle((req, res) => send(res, [
    { value: "DRAFT", label: "Draft" }, { value: "READY", label: "Ready" }, { value: "RUNNING", label: "Running" }, { value: "PAUSED", label: "Paused" }, { value: "FAILED", label: "Failed" },
  ], "Ad statuses fetched successfully"), { needsProject: false }));
  app.get("/meta/ad-platforms", h.handle((req, res) => send(res, Object.values(PLATFORMS).filter((p) => p.ads).map((p) => ({ value: p.platform, label: p.name })), "Ad platforms fetched successfully"), { needsProject: false }));
  app.get("/meta/campaign-types", h.handle((req, res) => send(res, [
    { value: "PAID_SOCIAL_ADS", label: "Paid Social Ads" }, { value: "GOOGLE_SEARCH_ADS", label: "Google Search Ads" }, { value: "SOCIAL_MEDIA", label: "Social Media" }, { value: "MESSAGING", label: "Messaging" },
  ], "Campaign types fetched successfully"), { needsProject: false }));
};

