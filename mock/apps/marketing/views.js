// Response builders: internal records -> the exact shapes the Digital Marketing app reads.
const { rng, round, at } = require("./lib");
const { meta, platformBrief, PLATFORMS, CAPABILITY_GROUPS } = require("./catalog");
const analytics = require("./analytics");

function makeViews(ctx, getDb) {
  const { identity } = ctx;
  const apiBase = () => ctx.apiUrl(ctx.key);
  const abs = (p) => (!p ? null : /^https?:\/\//.test(p) ? p : `${apiBase()}${p}`);

  // ---------------------------------------------------------------- people
  const user = (id) => identity.findUser(id);
  const fullName = (u) => (u ? `${u.firstName} ${u.lastName}` : "Unknown user");
  function userBrief(id) {
    const u = user(id);
    if (!u) return null;
    return { id: u.id, email: u.email, username: u.username, firstName: u.firstName, lastName: u.lastName, avatar: u.avatar };
  }
  function reviewerUser(id) {
    const u = user(id);
    if (!u) return undefined;
    return { id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, avatar: u.avatar, profile: { jobTitle: u.profile?.jobTitle || "Team Member" } };
  }
  const reviewerProfile = (u) => ({ ...identity.publicUser(u), scopes: identity.userScopes(u).map((s) => s.scope) });

  // ---------------------------------------------------------------- projects / gallery / labels
  // A member's Marketing roles (the digital_marketing grant), for Settings › Team.
  const marketingRolesOf = (u) => identity.userScopes(u).find((s) => s.scope === "digital_marketing")?.roles || [];
  // timeZone and currency are proposed contracts (wave 5): schedules are read in the project's zone,
  // and reports total money in its currency.
  const projectView = (p, activeId) => ({
    id: p.id, userId: p.userId, name: p.name, description: p.description || null, avatar: abs(p.avatar), isActive: p.isActive !== false,
    isLastActive: p.id === activeId, timeZone: p.timeZone || "Africa/Cairo", currency: p.currency || "EGP",
    members: (p.memberUserIds || []).map((id) => {
      const u = user(id);
      return u ? { ...userBrief(id), jobTitle: u.jobTitle || null, roles: marketingRolesOf(u) } : null;
    }).filter(Boolean),
    createdAt: p.createdAt, updatedAt: p.updatedAt,
  });
  const galleryView = (g) => (g ? { id: g.id, image: abs(g.path), alt: g.alt, created_at: g.created_at, updated_at: g.updated_at } : null);
  const galleryById = (id) => galleryView(getDb().gallery.find((g) => String(g.id) === String(id)));
  const labelView = (l) => ({ __entity: "Label", id: l.id, userId: l.userId, projectId: l.projectId, name: l.name, color: l.color, createdAt: l.createdAt, updatedAt: l.updatedAt });
  const labelBrief = (id) => {
    const l = getDb().labels.find((x) => x.id === id);
    return l ? { id: l.id, name: l.name, color: l.color } : null;
  };

  // ---------------------------------------------------------------- integrations
  const integrationById = (id) => getDb().integrations.find((i) => i.id === id);
  const avatarFor = (i) => abs(`/media/avatar/${encodeURIComponent(i.account.handle || i.platform)}.svg?name=${encodeURIComponent(i.account.displayName)}&color=${encodeURIComponent((i.account.color || "#8135CD").replace("#", ""))}`);
  const missingScopes = (i) => i.requiredScopes.filter((s) => !i.grantedScopes.includes(s));
  const selectedCount = (resources, cap) => resources.filter((r) => r.capability === cap && r.isSelected).length;

  function scopeBuckets(platform, required, missing) {
    const pick = (re) => required.filter((s) => re.test(s));
    const buckets = {
      PUBLISHING: pick(/publish|manage_posts|write|upload|w_organization|content|force-ssl|video\.publish/),
      ADS_MANAGEMENT: pick(/ads|adwords|advertiser/),
      ANALYTICS: pick(/insight|read|analytics|stats|list|basic/),
      MESSAGING: pick(/messag/),
    };
    return Object.fromEntries(Object.entries(buckets).map(([f, s]) => [f, { requiredScopesCount: s.length, missingScopesCount: s.filter((x) => missing.includes(x)).length }]));
  }

  function capabilitySummary(platform, resources, required, missing) {
    const m = PLATFORMS[platform];
    const caps = CAPABILITY_GROUPS.filter((g) => (g.capability === "PUBLISHING" && m.publish) || (g.capability === "ADS" && m.ads) || (g.capability === "ANALYTICS" && m.analytics) || (g.capability === "MESSAGING" && m.messaging));
    const capabilityStatuses = caps.map((g) => {
      const available = resources.filter((r) => r.capability === g.capability).length;
      const selected = selectedCount(resources, g.capability);
      return { capability: g.capability, state: selected > 0 ? "satisfied" : available ? "not_selected" : "unavailable", availableResources: available, selectedResources: selected };
    });
    const buckets = scopeBuckets(platform, required, missing);
    const featureOf = { PUBLISHING: "PUBLISHING", ADS: "ADS_MANAGEMENT", ANALYTICS: "ANALYTICS", MESSAGING: "MESSAGING" };
    const featureStatuses = caps.map((g) => {
      const f = featureOf[g.capability];
      const b = buckets[f];
      return { feature: f, ready: selectedCount(resources, g.capability) > 0 && b.missingScopesCount === 0, requiredScopesCount: b.requiredScopesCount, missingScopesCount: b.missingScopesCount };
    });
    const accountsSummary = {
      totalAccounts: resources.length, selectedAccounts: resources.filter((r) => r.isSelected).length,
      adsAccounts: selectedCount(resources, "ADS"), publishAccounts: selectedCount(resources, "PUBLISHING"),
      analyticsAccounts: selectedCount(resources, "ANALYTICS"), messagingAccounts: selectedCount(resources, "MESSAGING"),
    };
    const selectionStatus = {
      pageSelected: selectedCount(resources, "PUBLISHING") > 0, publishingSelected: selectedCount(resources, "PUBLISHING") > 0,
      businessSelected: resources.some((r) => r.isSelected), analyticsSelected: selectedCount(resources, "ANALYTICS") > 0,
      adAccountSelected: selectedCount(resources, "ADS") > 0,
      readyForAds: selectedCount(resources, "ADS") > 0 && (!m.publish || selectedCount(resources, "PUBLISHING") > 0),
    };
    return { capabilityStatuses, featureStatuses, accountsSummary, selectionStatus };
  }

  const resourceView = (r) => ({ ...r });

  function integrationListView(i) {
    const m = meta(i.platform);
    const missing = missingScopes(i);
    return {
      id: i.id, projectId: i.projectId, name: m.name, icon: m.icon, color: m.color, platform: i.platform, oauthVersion: m.oauthVersion,
      requiresRefreshToken: m.requiresRefreshToken, requiresReconnect: i.requiresReconnect, status: i.status, isConnected: i.isConnected,
      requiredScopes: i.requiredScopes, grantedScopes: i.grantedScopes, missingScopes: missing,
      metadata: {
        name: i.account.displayName, pageName: i.account.displayName, email: i.account.email, handle: i.account.handle, externalId: i.account.externalId,
        pictureUrl: avatarFor(i), scopes: i.grantedScopes, googleUserId: i.platform === "GOOGLE" || i.platform === "YOUTUBE" ? String(i.account.externalId) : null,
        grantedScopes: i.grantedScopes, requestedScopes: i.requiredScopes, followers: i.account.followers,
      },
      publishConnected: m.publish && i.resources.some((r) => r.capability === "PUBLISHING" && r.isSelected),
      adsConnected: m.ads && i.resources.some((r) => r.capability === "ADS" && r.isSelected),
      connectedAt: i.connectedAt, expiresAt: i.expiresAt, lastSyncedAt: i.lastSyncedAt, createdAt: i.createdAt, updatedAt: i.updatedAt,
    };
  }

  function recentPostsFor(i) {
    const db = getDb();
    const out = [];
    for (const p of db.posts) for (const t of p.targets) {
      if (t.integrationId !== i.id || !t.publishedAt || !t.metrics) continue;
      const mt = t.metrics;
      out.push({
        id: t.id, platformPostId: t.platformPostId, content: effectiveText(p, t), postedAt: t.publishedAt, profileId: i.id, profileName: i.account.displayName,
        url: postUrl(t), impressions: mt.impressions, reach: mt.reach, engagements: mt.engagements, engagementRate: mt.reach ? round((mt.engagements / mt.reach) * 100, 2) : 0,
        likeCount: mt.likes, commentCount: mt.comments, shareCount: mt.shares, saveCount: mt.saves,
      });
    }
    return out.sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt)).slice(0, 10);
  }

  function integrationDetailView(i) {
    const base = integrationListView(i);
    const missing = base.missingScopes;
    const summary = capabilitySummary(i.platform, i.resources, i.requiredScopes, missing);
    return {
      ...base,
      scopeSummary: { requiredScopesCount: i.requiredScopes.length, grantedScopesCount: i.grantedScopes.length, missingScopesCount: missing.length },
      accountsSummary: summary.accountsSummary,
      accountResources: i.resources.map(resourceView),
      capabilityStatuses: summary.capabilityStatuses,
      featureStatuses: summary.featureStatuses,
      analytics: analytics.integrationAnalytics(getDb(), i, { avatarUrl: avatarFor(i), recentPosts: recentPostsFor(i) }),
    };
  }

  // GET /publishing/platforms/available rows (one per connected publishing profile).
  function availablePlatformView(i) {
    const m = meta(i.platform);
    const res = i.resources.find((r) => r.capability === "PUBLISHING" && r.isSelected) || i.resources[0];
    return {
      platform: i.platform, integrationId: i.id, resourceId: res?.id || null, resourceType: m.resourceType, resourceName: res?.displayName || i.account.displayName,
      handleOrCode: i.account.handle, supportedContentTypes: m.supportedContentTypes, mediaConstraints: m.mediaConstraints,
      name: m.name, oauthVersion: m.oauthVersion, color: m.color, icon: m.icon, requiresRefreshToken: m.requiresRefreshToken,
    };
  }

  // Wizard payload (callback / preflight / finish) from a temp OAuth record.
  function wizardView(temp, extra = {}) {
    const m = meta(temp.platform);
    const missing = temp.requiredScopes.filter((s) => !temp.grantedScopes.includes(s));
    const summary = capabilitySummary(temp.platform, temp.resources, temp.requiredScopes, missing);
    const groups = {};
    for (const g of CAPABILITY_GROUPS) {
      const resources = temp.resources.filter((r) => r.capability === g.capability);
      if (!resources.length) continue;
      groups[g.key] = { title: g.title, totalCount: resources.length, selectedCount: resources.filter((r) => r.isSelected).length, resources: resources.map(resourceView) };
    }
    return {
      tempDataId: temp.id, projectId: temp.projectId, platform: temp.platform, name: m.name, oauthVersion: m.oauthVersion, color: m.color, icon: m.icon,
      requiresSelection: true, requiresReconnect: false,
      profile: temp.profile,
      permissions: {
        requiredScopes: temp.requiredScopes, grantedScopes: temp.grantedScopes, missingScopes: missing,
        requiredScopesCount: temp.requiredScopes.length, grantedScopesCount: temp.grantedScopes.length, missingScopesCount: missing.length,
      },
      selectionStatus: summary.selectionStatus, accountsSummary: summary.accountsSummary,
      capabilityStatuses: summary.capabilityStatuses, featureStatuses: summary.featureStatuses,
      resourceSelection: { totalCount: temp.resources.length, selectedCount: temp.resources.filter((r) => r.isSelected).length, groups },
      ...extra,
    };
  }

  // ---------------------------------------------------------------- posts
  const effectiveText = (p, t) => (t && !t.useMasterText && t.textOverride ? t.textOverride : p.text || "");
  function postUrl(t) {
    if (!t.publishedAt || t.isDeletedOnPlatform || !t.platformPostId) return null;
    const i = integrationById(t.integrationId);
    const m = meta(t.platform);
    return m?.postUrl ? m.postUrl(i?.account.handle || "profile", t.platformPostId) : null;
  }
  function effectiveScheduledAt(p) {
    const overrides = p.targets.map((t) => t.scheduledAt).filter(Boolean).sort();
    return p.scheduledAt || overrides[0] || p.publishedAt || null;
  }
  const targetSchedule = (p, t) => t.scheduledAt || p.scheduledAt || t.publishedAt || p.publishedAt || null;

  function uiStatus(p) {
    if (p.imported && (p.status === "PUBLISHED" || p.status === "PARTIAL")) return "SYNCED";
    switch (p.status) {
      case "PENDING": return "PENDING_APPROVAL";
      case "SCHEDULED": return p.approvalRequest && p.approvalStatus === "APPROVED" ? "APPROVED" : "SCHEDULED";
      case "PUBLISHED": return "PUBLISHED";
      case "FAILED":
      case "PARTIAL": return "FAILED";
      default: return "DRAFT";
    }
  }
  const UI_LABELS = { DRAFT: ["Draft", "neutral"], PENDING_APPROVAL: ["Pending Approval", "warning"], APPROVED: ["Approved", "info"], SCHEDULED: ["Scheduled", "primary"], PUBLISHED: ["Published", "success"], FAILED: ["Failed", "danger"], SYNCED: ["Synced", "success"] };

  const reviewerOf = (p, viewer) => p.approvalRequest?.reviewers.find((r) => r.userId === viewer?.id) || null;
  function contentChangedSinceApproval(p) {
    const s = p.lastApprovedSnapshot;
    if (!s) return false;
    return s.title !== p.title || s.text !== p.text || JSON.stringify(s.labelIds || []) !== JSON.stringify(p.labelIds || []);
  }
  function postActions(p, viewer) {
    const r = reviewerOf(p, viewer);
    const pendingMine = r?.status === "PENDING" && p.status === "PENDING";
    const blocked = p.approvalStatus === "PENDING_APPROVAL" || p.approvalStatus === "REJECTED";
    return {
      canPublishNow: ["DRAFT", "SCHEDULED", "FAILED", "PARTIAL"].includes(p.status) && !blocked,
      canSchedule: p.status === "DRAFT" && !blocked,
      canReschedule: ["SCHEDULED", "PENDING"].includes(p.status),
      canEdit: !["PUBLISHED", "CANCELED"].includes(p.status),
      canApprove: pendingMine,
      canReject: pendingMine,
      canRepostNow: false,
      canRollbackToLastApproved: !!p.lastApprovedSnapshot && (p.reApproveRequired || p.workflowState === "REAPPROVAL_REQUIRED" || contentChangedSinceApproval(p)),
    };
  }

  function metricMatrix(t) {
    if (!t.metrics) return {};
    const r = rng(`matrix:${t.id}`);
    const out = {};
    for (const [k, v] of Object.entries(t.metrics)) out[k] = { value: v, rate: round((r() - 0.3) * 30, 1) };
    const reach = t.metrics.reach || 0;
    out.engagementRate = { value: reach ? round((t.metrics.engagements / reach) * 100, 2) : 0, rate: round((r() - 0.4) * 10, 1) };
    return out;
  }

  function postListItem(p, viewer) {
    const actions = postActions(p, viewer);
    const r = reviewerOf(p, viewer);
    const eff = effectiveScheduledAt(p);
    const status = uiStatus(p);
    const editable = actions.canEdit;
    return {
      id: p.id, dateTime: eff || p.createdAt, postTitle: p.title, title: p.title, status, uiStatus: { key: status, label: UI_LABELS[status][0], tone: UI_LABELS[status][1] },
      workflowState: p.workflowState, approvalStatus: p.approvalStatus, reApproveRequired: !!p.reApproveRequired,
      actions: { canPublishNow: actions.canPublishNow, canSchedule: actions.canSchedule, canReschedule: actions.canReschedule, canEdit: actions.canEdit, canApprove: actions.canApprove, canReject: actions.canReject },
      viewerReview: { isReviewer: !!r, reviewerStatus: r?.status || null, canApprove: actions.canApprove, canReject: actions.canReject },
      scheduleScope: p.targets.some((t) => t.scheduledAt) ? "PER_TARGET" : "GLOBAL",
      effectiveScheduledAt: eff, scheduledAt: p.scheduledAt || eff, publishedAt: p.publishedAt, isEditable: editable,
      platforms: p.targets.map((t) => {
        const m = meta(t.platform) || { name: t.platform, color: "#64748B", icon: "ph:share-network" };
        return { id: t.id, platform: t.platform, name: m.name, color: m.color, icon: m.icon, isEditable: editable && t.status !== "PUBLISHED", effectiveScheduledAt: targetSchedule(p, t), status: t.status };
      }),
      platformCount: p.targets.length,
      labels: p.labelIds.map(labelBrief).filter(Boolean),
      approvers: (p.approvalRequest?.reviewers || []).map((x) => ({ ...userBrief(x.userId), status: x.status })).filter((x) => x.id),
      approverCount: p.approvalRequest?.reviewers.length || 0,
      campaignIds: p.campaignIds, imported: !!p.imported, createdAt: p.createdAt, updatedAt: p.updatedAt,
    };
  }

  function postDetail(p, viewer) {
    const db = getDb();
    const campaigns = p.campaignIds.map((id) => db.campaigns.find((c) => c.id === id)).filter(Boolean);
    const reviewers = p.approvalRequest?.reviewers || [];
    const fallbackSchedule = at(1, 10, 0);
    return {
      id: p.id, userId: p.userId, projectId: p.projectId, title: p.title, text: p.text,
      campaignId: campaigns[0]?.id || null, campaign: campaigns[0] ? { id: campaigns[0].id, name: campaigns[0].name } : null,
      campaignIds: p.campaignIds, campaignPosts: campaigns.map((c) => ({ id: c.id, name: c.name })),
      labels: p.labelIds.map(labelBrief).filter(Boolean), labelIds: p.labelIds,
      status: p.status, uiStatus: uiStatus(p), workflowState: p.workflowState, reApproveRequired: !!p.reApproveRequired,
      scheduledAt: p.scheduledAt, publishedAt: p.publishedAt,
      approvalStatus: p.approvalStatus, approvalNotes: p.approvalNotes, approvalVersion: p.approvalVersion,
      lastApprovedSnapshot: p.lastApprovedSnapshot, lastContentEditedAt: p.lastContentEditedAt, lastMissedScheduleAt: p.lastMissedScheduleAt,
      approvalRequest: p.approvalRequest ? {
        note: p.approvalRequest.note || "", sentAt: p.approvalRequest.sentAt, postUrl: `${ctx.webUrl(ctx.key)}/en/posts/${p.id}`, sentByUserId: p.approvalRequest.sentByUserId,
        reviewerUser: reviewers.map((r) => {
          const u = user(r.userId);
          return { id: r.userId, name: fullName(u), email: u?.email || "", avatar: u?.avatar || null, isMine: r.userId === viewer?.id, isApproved: r.status === "APPROVED", status: r.status, note: r.note, decidedAt: r.decidedAt };
        }),
      } : null,
      workflow: { contentMode: p.contentMode, publishMode: p.publishMode === "INSTANT" ? "INSTANT" : "SCHEDULED", requestApproval: !!p.requestApproval },
      actions: postActions(p, viewer),
      targets: p.targets.map((t) => {
        const i = integrationById(t.integrationId);
        const matrix = metricMatrix(t);
        return {
          id: t.id, errorMessage: t.errorMessage, unifiedPostId: p.id, platform: platformBrief(t.platform), platformKey: t.platform, integrationId: t.integrationId,
          contentType: t.contentType, effectiveText: effectiveText(p, t), textOverride: t.textOverride,
          publishMode: p.publishMode === "INSTANT" ? "INSTANT" : "SCHEDULED", useMasterText: t.useMasterText, useMasterMedia: t.useMasterMedia,
          status: t.status, effectiveScheduledAt: targetSchedule(p, t) || fallbackSchedule, scheduledAt: t.scheduledAt, publishedAt: t.publishedAt,
          platformPostId: t.platformPostId, postUrl: postUrl(t),
          isDeletedOnPlatform: t.isDeletedOnPlatform, platformDeletedAt: t.platformDeletedAt, platformDeletedBy: t.platformDeletedBy,
          platformDeleteStatus: t.platformDeleteStatus, platformDeleteError: t.platformDeleteError, lastSyncedAt: t.lastSyncedAt, lastSyncError: t.lastSyncError,
          galleryIds: t.galleryIds, galleries: t.galleryIds.map(galleryById).filter(Boolean),
          analyticsAvailable: !!t.metrics, availableMetrics: Object.keys(matrix), performanceMatrix: matrix,
          integrationPublishPageData: i ? { name: i.account.displayName, image: avatarFor(i), followers: i.account.followers } : { name: meta(t.platform)?.name || t.platform, image: null, followers: 0 },
          createdAt: t.createdAt, updatedAt: t.updatedAt,
        };
      }),
      imported: !!p.imported, createdAt: p.createdAt, updatedAt: p.updatedAt,
      contentMode: p.contentMode, publishMode: p.publishMode === "INSTANT" ? "INSTANT" : "SCHEDULED",
    };
  }

  const commentView = (c) => ({ id: c.id, postId: c.postId, text: c.text, user: identity.publicUser(user(c.userId)), createdAt: c.createdAt, updatedAt: c.updatedAt });

  // ---------------------------------------------------------------- campaigns
  function messagingConfigView(cfg) {
    const db = getDb();
    const out = { ...cfg };
    const sender = db.senders.find((s) => s.id === cfg.senderConfigId);
    const template = db.templates.find((t) => t.id === cfg.templateId);
    const imp = db.imports.find((x) => x.id === cfg.importId || (cfg.audienceId && x.id === cfg.audienceId));
    out.senderConfig = sender ? senderView(sender) : null;
    out.template = template ? templateView(template) : null;
    out.audienceImport = imp ? { id: imp.id, fileName: imp.fileName, status: imp.status, savedAudienceId: imp.savedAudienceId || null } : null;
    return out;
  }
  function adView(c, a) {
    const out = { id: a.id, name: a.name };
    if (a.unifiedPostTargetId) out.unifiedPostTargetId = a.unifiedPostTargetId;
    if (a.callToAction) out.callToAction = a.callToAction;
    if (a.configuration) out.configuration = a.configuration;
    if (a.unifiedPostTargetId) {
      const p = getDb().posts.find((x) => x.id === a.unifiedPostTargetId);
      out.creative = { title: p?.title || a.creative?.title || a.name, source: a.creative?.source || "EXISTING", postId: a.unifiedPostTargetId };
    }
    return out;
  }
  function adSetView(c, s) {
    return {
      id: s.id, name: s.name, platform: s.platform || (c.type === "MESSAGING" ? s.configuration?.channel || "" : ""), deliveryPlatform: s.deliveryPlatform || s.platform || null,
      integrationId: s.integrationId || null, startAt: s.startAt || null, endAt: s.endAt || null,
      configuration: c.type === "MESSAGING" ? messagingConfigView(s.configuration || {}) : s.configuration || {},
      ads: (s.ads || []).map((a) => adView(c, a)),
    };
  }
  function campaignReviewerView(r) {
    return { id: r.id, reviewerUserId: r.reviewerUserId, status: r.status, note: r.note, decidedAt: r.decidedAt, reviewerUser: reviewerUser(r.reviewerUserId) };
  }
  function campaignView(c) {
    return {
      id: c.id, userId: c.userId, projectId: c.projectId, type: c.type, name: c.name, description: c.description,
      startAt: c.startAt, endAt: c.endAt, status: c.status, isComplete: c.isComplete, workflowState: c.workflowState,
      approvalStatus: c.approvalStatus, approvalNote: c.approvalNote, approvalVersion: c.approvalVersion,
      configuration: c.configuration || {}, budgetCurrency: c.configuration?.budgetCurrency || null,
      categories: (c.categoryNames || []).map((name) => ({ name })),
      adSets: c.adSets.map((s) => adSetView(c, s)),
      reviewers: c.reviewers.map(campaignReviewerView),
      onboardingStep: c.onboardingStep, publishedAt: c.publishedAt || null,
      createdAt: c.createdAt, updatedAt: c.updatedAt,
    };
  }
  const campaignListItem = (c) => ({
    id: c.id, type: c.type, name: c.name, description: c.description, startAt: c.startAt, endAt: c.endAt, isComplete: c.isComplete,
    workflowState: c.workflowState, approvalStatus: c.approvalStatus, status: c.status, createdAt: c.createdAt, updatedAt: c.updatedAt,
  });
  // Legacy ICampaign rows used by the post composer's campaign picker (GET /publishing/campaigns).
  const publishingCampaignView = (c) => ({
    id: c.id, userId: c.userId, projectId: c.projectId, name: c.name, category: c.categoryNames?.[0] || "ADS", type: c.type, objective: c.configuration?.objective || null,
    description: c.description || "", budget: c.configuration?.budgetAmount != null ? String(c.configuration.budgetAmount) : null, status: c.status,
    audience: c.configuration?.audience ? JSON.stringify(c.configuration.audience) : "", scheduledAt: c.startAt,
    facebookCampaignId: null, googleAdsCampaignId: c.type === "GOOGLE_SEARCH_ADS" && c.status === "RUNNING" ? `2${String(c.id).replace(/\D/g, "").slice(0, 10)}` : null,
    googleAdsCampaignBudgetId: null, facebookAdSetId: null, googleSearchSettings: c.type === "GOOGLE_SEARCH_ADS" ? c.configuration : {}, providerData: {},
    createdAt: c.createdAt, updatedAt: c.updatedAt,
  });

  function onboardingStepView(c, step) {
    const S = String(step || "").toUpperCase();
    const isGoogle = c.type === "GOOGLE_SEARCH_ADS";
    switch (S) {
      case "DETAILS":
        return { step: "DETAILS", name: c.name, description: c.description, type: c.type, categoryNames: c.categoryNames || [] };
      case "SETTINGS":
        return { step: "SETTINGS", startAt: c.startAt, endAt: c.endAt, configuration: c.configuration || {} };
      case "POSTS":
        return { step: "POSTS", startAt: c.startAt, endAt: c.endAt, adSets: c.adSets.map((s) => ({ id: s.id, name: s.name, integrationId: s.integrationId, platform: s.platform, startAt: s.startAt, endAt: s.endAt, ads: s.ads.map((a) => ({ id: a.id, name: a.name, unifiedPostTargetId: a.unifiedPostTargetId })) })) };
      case "AD_GROUPS":
        return { step: "AD_GROUPS", adSets: c.adSets.map((s) => ({ id: s.id, name: s.name, configuration: { defaultBidMicros: s.configuration?.defaultBidMicros, keywords: s.configuration?.keywords || [], negativeKeywords: s.configuration?.negativeKeywords || [] }, ads: s.ads.map((a) => ({ id: a.id, name: a.name, configuration: a.configuration || {} })) })) };
      case "AD_SETS_AND_ADS":
        if (isGoogle) return { ...onboardingStepView(c, "AD_GROUPS"), step: "AD_SETS_AND_ADS" };
        return { step: "AD_SETS_AND_ADS", adSets: c.adSets.map((s) => ({ id: s.id, name: s.name, integrationId: s.integrationId, platform: s.platform, configuration: s.configuration || {}, ads: s.ads.map((a) => ({ id: a.id, name: a.name, unifiedPostTargetId: a.unifiedPostTargetId, callToAction: a.callToAction })) })) };
      case "MESSAGE":
        return { step: "MESSAGE", startAt: c.startAt, adSets: c.adSets.map((s) => ({ id: s.id, name: s.name, configuration: messagingConfigView(s.configuration || {}) })) };
      case "REVIEW":
        return { step: "REVIEW", approval: { reviewerIds: c.reviewers.map((r) => r.reviewerUserId), note: c.approvalNote || undefined }, saveAsDraft: c.status === "DRAFT" };
      default:
        return null;
    }
  }

  const campaignCommentView = (c) => {
    const u = user(c.userId);
    return { id: c.id, campaignId: c.campaignId, userId: c.userId, text: c.text, type: c.type || "comment", createdAt: c.createdAt, updatedAt: c.updatedAt, user: u ? { id: u.id, firstName: u.firstName, lastName: u.lastName, email: u.email, avatar: u.avatar || undefined, name: fullName(u) } : undefined };
  };

  // ---------------------------------------------------------------- audiences / messaging
  function selectivity(rules = {}) {
    let f = 1;
    if (rules.source) f *= 0.46;
    if (rules.type) f *= rules.type.toLowerCase() === "lead" ? 0.38 : 0.72;
    if (rules.interest) f *= 0.34;
    if (rules.qualifiedOnly) f *= 0.55;
    return f;
  }
  const audienceView = (a) => ({ id: a.id, name: a.name, description: a.description || null, contactsCount: a.contactsCount, createdAt: a.createdAt, updatedAt: a.updatedAt });
  function segmentView(s, audienceId) {
    const db = getDb();
    const pool = audienceId ? db.audiences.filter((a) => a.id === audienceId) : s.audienceId ? db.audiences.filter((a) => a.id === s.audienceId) : db.audiences.filter((a) => a.projectId === s.projectId);
    const base = pool.reduce((sum, a) => sum + a.contactsCount, 0);
    return { id: s.id, name: s.name, description: s.description || null, rules: s.rules || {}, audienceId: s.audienceId || null, matchingContactsCount: Math.round(base * selectivity(s.rules)), createdAt: s.createdAt, updatedAt: s.updatedAt };
  }
  const senderView = (s) => ({ id: s.id, channel: s.channel, name: s.name, isActive: s.isActive, configuration: s.configuration, createdByUserId: s.createdByUserId, createdAt: s.createdAt, updatedAt: s.updatedAt });
  const templateView = (t) => ({ id: t.id, projectId: t.projectId, channel: t.channel, senderConfigId: t.senderConfigId, name: t.name, subject: t.subject ?? null, body: t.body, variables: t.variables || [], providerData: t.providerData || {}, isActive: t.isActive, createdByUserId: t.createdByUserId, createdAt: t.createdAt, updatedAt: t.updatedAt });

  return {
    abs, userBrief, reviewerUser, reviewerProfile, fullName, projectView, galleryView, galleryById, labelView, labelBrief,
    integrationById, integrationListView, integrationDetailView, availablePlatformView, wizardView, avatarFor, capabilitySummary,
    postListItem, postDetail, postActions, uiStatus, effectiveScheduledAt, effectiveText, postUrl, commentView,
    campaignView, campaignListItem, publishingCampaignView, onboardingStepView, campaignCommentView,
    audienceView, segmentView, senderView, templateView,
  };
}

module.exports = { makeViews };
