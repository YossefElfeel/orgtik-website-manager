// Publishing: posts (list/detail/create/update), targets, approvals, comments, publish/duplicate/delete,
// reviewers, platforms available for publishing and the campaign picker.
const { send, error, newId, nowIso, at, parseDate, listParam, paginate, textMatch, clone, intParam, ymd } = require("../lib");
const { meta, normPlatform } = require("../catalog");
const { seedMetrics } = require("../seed");

const MARKETING_SCOPE = "digital_marketing";

module.exports = function postRoutes(app, { ctx, getDb, views, h, tick, svc }) {
  const { identity } = ctx;

  const findPost = (id, u) => {
    const p = getDb().posts.find((x) => x.id === id);
    if (!p) return null;
    const project = getDb().projects.find((x) => x.id === p.projectId);
    return project && h.canSee(project, u) ? p : null;
  };
  const withPost = (fn) => h.handle((req, res, u, project) => {
    tick();
    const p = findPost(req.params.id, u);
    if (!p) return h.notFound(res, "Post");
    return fn(req, res, u, p, project);
  }, { needsProject: false });

  const connectedIntegration = (projectId, platform) => getDb().integrations.find((i) => i.projectId === projectId && i.platform === platform && i.isConnected)
    || getDb().integrations.find((i) => i.projectId === projectId && i.platform === platform);
  const validGalleryIds = (ids, projectId) => {
    const set = new Set(getDb().gallery.filter(g => g.projectId === projectId).map((g) => g.id));
    return [...new Set(listParam(ids).map(Number))].filter((id) => set.has(id));
  };
  const deriveTitle = (text) => {
    const first = String(text || "").trim().split("\n")[0]?.trim() || "";
    return first.length > 80 ? `${first.slice(0, 80)}…` : first;
  };
  const marketingTeam = () => {
    const grants = identity.grants[MARKETING_SCOPE] || {};
    return Object.keys(grants).map((k) => identity.findByKey(k)).filter(Boolean);
  };

  function newTarget(p, raw) {
    const platform = normPlatform(raw.platform);
    const integration = connectedIntegration(p.projectId, platform);
    const now = nowIso();
    const useMasterText = p.contentMode !== "PER_PLATFORM" || raw.useMasterText !== false || !raw.text || raw.text === p.text;
    return {
      id: newId(), platform, integrationId: integration?.id || null, contentType: raw.contentType || meta(platform)?.supportedContentTypes?.[0] || "POST",
      useMasterText, textOverride: useMasterText ? null : String(raw.text), useMasterMedia: false, galleryIds: validGalleryIds(raw.galleryIds, p.projectId),
      scheduledAt: parseDate(raw.scheduledAt), status: "DRAFT", errorMessage: null, publishedAt: null, platformPostId: null,
      isDeletedOnPlatform: false, platformDeletedAt: null, platformDeletedBy: null, platformDeleteStatus: "NONE", platformDeleteError: null,
      lastSyncedAt: null, lastSyncError: null, metrics: null, createdAt: now, updatedAt: now,
    };
  }

  const setTargetStatus = (p, status) => p.targets.forEach((t) => { if (!t.publishedAt) t.status = status; });

  // Publishes every unpublished target. Returns { published, failed }.
  function publishPost(p) {
    const now = nowIso();
    const failed = [];
    let published = 0;
    for (const t of p.targets) {
      if (t.publishedAt && !t.isDeletedOnPlatform) { published++; continue; }
      const i = getDb().integrations.find((x) => x.id === t.integrationId) || connectedIntegration(p.projectId, t.platform);
      const m = meta(t.platform);
      const text = views.effectiveText(p, t);
      let err = null;
      if (!i || !i.isConnected) err = `No connected ${m?.name || t.platform} account in this brand. Connect it in Integrations and try again.`;
      else if (i.requiresReconnect) err = `Access token expired. Reconnect the ${m.name} account in Integrations and try again.`;
      else if (t.platform === "X" && text.length > 280) err = `X rejected the post: text is ${text.length} characters (limit 280).`;
      else if (!m?.publish) err = `${m?.name || t.platform} does not support organic publishing.`;
      if (err) {
        Object.assign(t, { status: "FAILED", errorMessage: err, updatedAt: now });
        failed.push({ platform: m?.name || t.platform, error: err });
        continue;
      }
      t.integrationId = i.id;
      Object.assign(t, {
        status: "PUBLISHED", errorMessage: null, publishedAt: now, isDeletedOnPlatform: false, platformDeleteStatus: "NONE", platformDeletedAt: null,
        platformPostId: `${String(i.account.externalId).slice(-6)}${Date.now().toString().slice(-9)}${Math.floor(Math.random() * 90 + 10)}`,
        lastSyncedAt: now, metrics: seedMetrics(t.id, i.account.followers || 5000, t.platform, now), updatedAt: now,
      });
      published++;
    }
    p.status = failed.length === 0 ? "PUBLISHED" : published > 0 ? "PARTIAL" : "FAILED";
    p.workflowState = p.status;
    if (published) p.publishedAt = p.publishedAt || now;
    if (!p.scheduledAt) p.scheduledAt = now;
    p.updatedAt = now;
    return { published, failed };
  }

  svc.publishPost = publishPost;

  // Recomputes approvalStatus/status after reviewers change or decide.
  function recomputeApproval(p, u) {
    const reviewers = p.approvalRequest?.reviewers || [];
    if (!reviewers.length) {
      p.approvalRequest = null;
      p.requestApproval = false;
      p.approvalStatus = "NOT_REQUIRED";
      p.reApproveRequired = false;
      if (p.status === "PENDING") p.status = views.effectiveScheduledAt(p) ? "SCHEDULED" : "DRAFT";
      p.workflowState = p.status === "SCHEDULED" ? "SCHEDULED_APPROVED" : p.status;
      return null;
    }
    p.requestApproval = true;
    if (reviewers.some((r) => r.status === "REJECTED")) {
      p.approvalStatus = "REJECTED";
      if (!["PUBLISHED", "PARTIAL"].includes(p.status)) p.status = "DRAFT";
      p.workflowState = "REJECTED";
      return "REJECTED";
    }
    if (reviewers.every((r) => r.status === "APPROVED")) {
      p.approvalStatus = "APPROVED";
      p.reApproveRequired = false;
      p.lastApprovedSnapshot = {
        title: p.title, text: p.text, labelIds: [...p.labelIds],
        targets: p.targets.map((t) => ({ id: t.id, textOverride: t.textOverride, useMasterText: t.useMasterText, galleryIds: [...t.galleryIds] })),
        approvedAt: nowIso(), approvalVersion: p.approvalVersion,
      };
      if (p.status === "PENDING") {
        if (p.publishMode === "INSTANT") return publishPost(p).failed.length ? "PUBLISH_FAILED" : "PUBLISHED";
        const when = views.effectiveScheduledAt(p);
        p.status = when ? "SCHEDULED" : "DRAFT";
        setTargetStatus(p, p.status);
        p.workflowState = when ? "SCHEDULED_APPROVED" : "APPROVED";
      }
      return "APPROVED";
    }
    p.approvalStatus = "PENDING_APPROVAL";
    if (["DRAFT", "SCHEDULED", "PENDING"].includes(p.status)) {
      p.status = "PENDING";
      setTargetStatus(p, "PENDING");
      p.workflowState = p.reApproveRequired ? "REAPPROVAL_REQUIRED" : "AWAITING_REVIEW";
    }
    return "PENDING";
  }

  // ---------------------------------------------------------------- list & details
  app.get("/publishing/posts", h.handle((req, res, u, project) => {
    tick();
    const q = req.query;
    const platforms = new Set(listParam(q.platforms).map(normPlatform));
    const uiStatuses = new Set(listParam(q.uiStatuses).map((s) => (s === "DRAFT_POST" ? "DRAFT" : s.toUpperCase())));
    const labelIds = new Set(listParam(q.labelIds));
    const year = intParam(q.year, null);
    const month = intParam(q.month, null);
    const week = intParam(q.week, null);
    let list = getDb().posts.filter((p) => p.projectId === project.id);
    if (q.status) list = list.filter((p) => p.status === String(q.status).toUpperCase() || views.uiStatus(p) === String(q.status).toUpperCase());
    if (platforms.size) list = list.filter((p) => p.targets.some((t) => platforms.has(t.platform)));
    if (uiStatuses.size) list = list.filter((p) => uiStatuses.has(views.uiStatus(p)));
    if (labelIds.size) list = list.filter((p) => p.labelIds.some((id) => labelIds.has(id)));
    if (q.search) list = list.filter((p) => textMatch(q.search, p.title, p.text));
    const dateOf = (p) => new Date(views.effectiveScheduledAt(p) || p.createdAt);
    if (year) list = list.filter((p) => Number(ymd(dateOf(p)).slice(0, 4)) === year);
    if (month) list = list.filter((p) => Number(ymd(dateOf(p)).slice(5, 7)) === month);
    if (week) list = list.filter((p) => Math.ceil(Number(ymd(dateOf(p)).slice(8, 10)) / 7) === week);
    // Newest first (so a freshly created post is on page 1), then by schedule date.
    list = [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt) || dateOf(b) - dateOf(a));
    const { items, meta: m } = paginate(list, q, 10);
    send(res, { items: items.map((p) => views.postListItem(p, u)), meta: m }, "Posts fetched successfully");
  }));

  app.get("/publishing/posts/:id", withPost((req, res, u, p) => send(res, views.postDetail(p, u), "Post fetched successfully")));

  // Handles the 5-step composer payload and the lighter { projectId, title, targets, status } shape.
  app.post("/publishing/posts", h.handle((req, res, u, project) => {
    const b = req.body || {};
    const db = getDb();
    const text = String(b.text || "").trim();
    const title = String(b.title || "").trim() || deriveTitle(text);
    if (!title) return error(res, 422, "Title is required", { errors: { title: ["Please give the post a title."] } });
    const rawTargets = (Array.isArray(b.targets) ? b.targets : []).filter((t) => t && t.platform);
    if (!rawTargets.length) return error(res, 422, "Select at least one platform", { errors: { targets: ["Select at least one platform."] } });

    const now = nowIso();
    const labelSet = new Set(db.labels.filter((l) => l.projectId === project.id).map((l) => l.id));
    const campaignSet = new Set(db.campaigns.filter((c) => c.projectId === project.id).map((c) => c.id));
    const reviewerIds = [...new Set(listParam(b.approvalUserIds).map(Number))].filter((id) => identity.findUser(id));
    const mode = String(b.publishMode || "").toUpperCase();
    const isDraft = mode === "DRAFT" || String(b.status || "").toUpperCase() === "DRAFT" || (!mode && !b.scheduledAt && !b.status);
    const p = {
      id: newId(), projectId: project.id, userId: u.id, title, text,
      status: "DRAFT", approvalStatus: "NOT_REQUIRED", workflowState: "DRAFT", reApproveRequired: false,
      approvalNotes: b.approvalNote?.trim() || null, approvalVersion: reviewerIds.length ? 1 : 0, approvalRequest: null,
      lastApprovedSnapshot: null, lastContentEditedAt: null, lastMissedScheduleAt: null,
      scheduledAt: parseDate(b.scheduledAt), publishedAt: null,
      contentMode: b.contentMode === "PER_PLATFORM" || b.contentMode === "CUSTOM" ? "PER_PLATFORM" : "SYNC",
      publishMode: isDraft ? "DRAFT" : mode === "PUBLISH_NOW" || mode === "NOW" ? "INSTANT" : "SCHEDULED",
      requestApproval: reviewerIds.length > 0, labelIds: listParam(b.labelIds).filter((id) => labelSet.has(id)),
      campaignIds: listParam(b.campaignIds).filter((id) => campaignSet.has(id)), targets: [], imported: false, createdAt: now, updatedAt: now,
    };
    const seen = new Set();
    for (const raw of rawTargets) {
      const platform = normPlatform(raw.platform);
      if (seen.has(platform)) continue;
      seen.add(platform);
      p.targets.push(newTarget(p, { ...raw, platform }));
    }
    if (!p.text) p.text = p.targets.find((t) => t.textOverride)?.textOverride || "";
    if (!p.scheduledAt && p.publishMode === "SCHEDULED") p.scheduledAt = p.targets.map((t) => t.scheduledAt).filter(Boolean).sort()[0] || at(1, 10, 0);
    db.posts.push(p);

    let msg = "Post saved as draft";
    if (reviewerIds.length) {
      p.approvalRequest = { note: p.approvalNotes || "", sentAt: now, sentByUserId: u.id, reviewers: reviewerIds.map((id) => ({ userId: id, status: "PENDING", note: null, decidedAt: null, assignedByUserId: u.id })) };
      if (!isDraft) {
        p.status = "PENDING";
        p.approvalStatus = "PENDING_APPROVAL";
        p.workflowState = "AWAITING_REVIEW";
        setTargetStatus(p, "PENDING");
        msg = `Approval requested from ${reviewerIds.length} reviewer${reviewerIds.length > 1 ? "s" : ""}`;
      } else {
        p.approvalStatus = "NOT_REQUIRED";
      }
    } else if (!isDraft && p.publishMode === "INSTANT") {
      const r = publishPost(p);
      msg = r.failed.length ? `Published to ${r.published} of ${p.targets.length} platforms. ${r.failed.map((f) => `${f.platform}: ${f.error}`).join(" ")}` : "Post published successfully";
    } else if (!isDraft) {
      if (new Date(p.scheduledAt) <= new Date()) {
        const r = publishPost(p);
        msg = r.failed.length ? `Published to ${r.published} of ${p.targets.length} platforms` : "Post published successfully";
      } else {
        p.status = "SCHEDULED";
        p.workflowState = "SCHEDULED_APPROVED";
        setTargetStatus(p, "SCHEDULED");
        msg = "Post scheduled successfully";
      }
    }
    send(res, { ...views.postDetail(p, u), id: p.id }, msg, 201);
  }));

  // { title, text, labelIds, status } from the details sidebar.
  app.patch("/publishing/posts/:id", withPost((req, res, u, p) => {
    const b = req.body || {};
    const db = getDb();
    const before = { title: p.title, text: p.text, labels: JSON.stringify(p.labelIds) };
    if (b.title !== undefined) {
      const t = String(b.title).trim();
      if (!t) return error(res, 422, "Title cannot be empty");
      p.title = t;
    }
    if (b.text !== undefined) p.text = String(b.text);
    if (b.labelIds !== undefined) {
      const labelSet = new Set(db.labels.filter((l) => l.projectId === p.projectId).map((l) => l.id));
      p.labelIds = listParam(b.labelIds).filter((id) => labelSet.has(id));
    }
    if (b.campaignIds !== undefined) p.campaignIds = listParam(b.campaignIds);
    if (b.scheduledAt !== undefined) p.scheduledAt = parseDate(b.scheduledAt, p.scheduledAt);
    const contentChanged = before.title !== p.title || before.text !== p.text || before.labels !== JSON.stringify(p.labelIds);
    let msg = "Post updated successfully";
    if (contentChanged) {
      p.lastContentEditedAt = nowIso();
      // Editing approved content sends it back to the reviewers.
      if (p.approvalRequest && p.approvalStatus === "APPROVED" && ["SCHEDULED", "PENDING"].includes(p.status)) {
        p.approvalRequest.reviewers.forEach((r) => Object.assign(r, { status: "PENDING", decidedAt: null, note: null }));
        p.approvalVersion += 1;
        p.reApproveRequired = true;
        recomputeApproval(p, u);
        p.workflowState = "REAPPROVAL_REQUIRED";
        msg = "Post updated — changes need re-approval";
      }
    }
    const status = b.status ? String(b.status).toUpperCase() : null;
    if (status) {
      const map = { DRAFT_POST: "DRAFT", PENDING_APPROVAL: "PENDING", APPROVED: "SCHEDULED", SYNCED: "PUBLISHED" };
      const next = map[status] || status;
      if (next !== p.status && !(next === "PENDING" && p.status === "PENDING")) {
        if (next === "PUBLISHED") {
          if (p.approvalStatus === "PENDING_APPROVAL") return error(res, 409, "This post is still waiting for approval");
          const r = publishPost(p);
          msg = r.failed.length ? `Published to ${r.published} of ${p.targets.length} platforms` : "Post published successfully";
        } else if (next === "SCHEDULED") {
          if (!views.effectiveScheduledAt(p)) p.scheduledAt = at(1, 10, 0);
          p.status = "SCHEDULED";
          p.workflowState = "SCHEDULED_APPROVED";
          setTargetStatus(p, "SCHEDULED");
        } else if (next === "PENDING") {
          if (!p.approvalRequest?.reviewers?.length) return error(res, 422, "Add at least one approver before requesting approval");
          recomputeApproval(p, u);
        } else if (["DRAFT", "FAILED", "CANCELED"].includes(next)) {
          p.status = next;
          p.workflowState = next;
          setTargetStatus(p, next);
        }
      }
    }
    p.updatedAt = nowIso();
    send(res, views.postDetail(p, u), msg);
  }));

  app.delete("/publishing/posts/:id", withPost((req, res, u, p) => {
    const db = getDb();
    db.posts = db.posts.filter((x) => x.id !== p.id);
    db.postComments = db.postComments.filter((c) => c.postId !== p.id);
    send(res, { id: p.id }, "Post deleted successfully");
  }));

  // ---------------------------------------------------------------- comments
  app.get("/publishing/posts/:id/comments", withPost((req, res, u, p) => {
    const list = getDb().postComments.filter((c) => c.postId === p.id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    send(res, list.map(views.commentView), "Comments fetched successfully");
  }));
  app.post("/publishing/posts/:id/comments", withPost((req, res, u, p) => {
    const text = String(req.body?.text || "").trim();
    if (!text) return error(res, 422, "Comment text is required");
    const c = { id: newId(), postId: p.id, userId: u.id, text, createdAt: nowIso(), updatedAt: nowIso() };
    getDb().postComments.push(c);
    send(res, views.commentView(c), "Comment added", 201);
  }));

  // ---------------------------------------------------------------- targets
  app.post("/publishing/posts/:id/targets", withPost((req, res, u, p) => {
    const platform = normPlatform(req.body?.platform);
    if (!meta(platform)) return error(res, 422, "Unknown platform");
    if (p.targets.some((t) => t.platform === platform)) return error(res, 409, `${meta(platform).name} is already a target of this post`);
    const t = newTarget(p, { platform, contentType: req.body?.contentType });
    t.status = p.status === "PUBLISHED" ? "SCHEDULED" : p.status;
    p.targets.push(t);
    p.updatedAt = nowIso();
    send(res, views.postDetail(p, u), `${meta(platform).name} added to the post`, 201);
  }));

  // multipart { contentType, scheduledAt, mediaAction, files… } or JSON { galleryIds, galleryIdsToRemove, scheduledAt, text }.
  app.patch("/publishing/posts/:id/targets/:targetId", ctx.upload.any(), withPost((req, res, u, p) => {
    const t = p.targets.find((x) => x.id === req.params.targetId);
    if (!t) return h.notFound(res, "Target");
    const b = req.body || {};
    const db = getDb();
    const changes = [];
    if (b.contentType) t.contentType = String(b.contentType);
    if (b.scheduledAt !== undefined && b.scheduledAt !== "") {
      const when = parseDate(b.scheduledAt);
      if (!when) return error(res, 422, "Invalid schedule date");
      t.scheduledAt = when;
      if (p.targets.length === 1 || !p.scheduledAt) p.scheduledAt = when;
      else p.scheduledAt = p.targets.map((x) => x.scheduledAt || p.scheduledAt).filter(Boolean).sort()[0];
      changes.push("schedule");
    }
    if (b.text !== undefined || b.textOverride !== undefined) {
      const txt = String(b.text ?? b.textOverride ?? "");
      t.useMasterText = !txt || txt === p.text;
      t.textOverride = t.useMasterText ? null : txt;
      changes.push("text");
    }
    if (b.useMasterText !== undefined) t.useMasterText = b.useMasterText === true || b.useMasterText === "true";
    const files = req.files || [];
    const uploaded = files.map((f) => {
      const g = { id: db.nextGalleryId++, projectId: p.projectId, path: `/uploads/${encodeURIComponent(f.filename)}`, alt: f.originalname, uploadedBy: u.id, created_at: nowIso(), updated_at: nowIso() };
      db.gallery.push(g);
      return g.id;
    });
    if (String(b.mediaAction || "").toLowerCase() === "replace" && uploaded.length) t.galleryIds = [];
    const toRemove = new Set(listParam(b.galleryIdsToRemove ?? b.mediaToDelete).map(Number));
    if (toRemove.size) t.galleryIds = t.galleryIds.filter((id) => !toRemove.has(id));
    const toAdd = [...validGalleryIds(b.galleryIds, p.projectId), ...uploaded];
    for (const id of toAdd) if (!t.galleryIds.includes(id)) t.galleryIds.push(id);
    if (toAdd.length || toRemove.size) changes.push("media");
    t.updatedAt = nowIso();
    p.updatedAt = t.updatedAt;
    send(res, views.postDetail(p, u), changes.includes("schedule") ? "Schedule updated" : changes.includes("media") ? "Media updated" : "Target updated");
  }));

  app.delete("/publishing/posts/:id/targets/:targetId", withPost((req, res, u, p) => {
    const t = p.targets.find((x) => x.id === req.params.targetId);
    if (!t) return h.notFound(res, "Target");
    p.targets = p.targets.filter((x) => x.id !== t.id);
    p.updatedAt = nowIso();
    send(res, views.postDetail(p, u), `${meta(t.platform)?.name || t.platform} removed from the post`);
  }));

  // ---------------------------------------------------------------- publishing workflow
  app.post("/publishing/posts/:id/publish-now", withPost((req, res, u, p) => {
    if (p.approvalStatus === "PENDING_APPROVAL") {
      const pending = (p.approvalRequest?.reviewers || []).filter((r) => r.status === "PENDING").length;
      return error(res, 409, `This post is waiting for approval (${pending} reviewer${pending === 1 ? "" : "s"} pending).`);
    }
    if (p.approvalStatus === "REJECTED") return error(res, 409, "This post was rejected by a reviewer. Update it and request approval again before publishing.");
    if (p.status === "PUBLISHED" && p.targets.every((t) => t.publishedAt && !t.isDeletedOnPlatform)) return error(res, 409, "This post is already published on every platform.");
    if (!p.targets.length) return error(res, 422, "Add at least one platform before publishing");
    const r = publishPost(p);
    if (!r.published) return error(res, 422, `Publishing failed: ${r.failed.map((f) => `${f.platform} — ${f.error}`).join(" ")}`);
    send(res, views.postDetail(p, u), r.failed.length ? `Published to ${r.published} of ${p.targets.length} platforms. ${r.failed.map((f) => `${f.platform}: ${f.error}`).join(" ")}` : "Post published successfully");
  }));

  // Used by the integration details "Sync Now" (id = integration id) and for post analytics refresh.
  app.post("/publishing/posts/:id/sync", h.handle((req, res, u) => {
    const db = getDb();
    const i = db.integrations.find((x) => x.id === req.params.id);
    if (i) {
      const project = db.projects.find((x) => x.id === i.projectId);
      if (!project || !h.canSee(project, u)) return h.notFound(res, "Integration");
      Object.assign(i, { lastSyncedAt: nowIso(), requiresReconnect: false, grantedScopes: [...i.requiredScopes], expiresAt: at(60, 0, 0), updatedAt: nowIso() });
      i.resources.forEach((r) => { r.lastSyncedAt = i.lastSyncedAt; });
      return send(res, { id: i.id, lastSyncedAt: i.lastSyncedAt, status: "SUCCESS", metricsCount: 30 }, `${meta(i.platform).name} synced — 30 metrics and recent posts updated`);
    }
    const p = findPost(req.params.id, u);
    if (!p) return h.notFound(res, "Post or integration");
    const now = nowIso();
    p.targets.forEach((t) => { if (t.publishedAt) t.lastSyncedAt = now; });
    send(res, { id: p.id, lastSyncedAt: now, status: "SUCCESS" }, "Post analytics synced");
  }, { needsProject: false }));

  app.post("/publishing/posts/:id/reviewers", withPost((req, res, u, p) => {
    const ids = [...new Set(listParam(req.body?.approverUserIds ?? req.body?.reviewerIds).map(Number))].filter((id) => identity.findUser(id));
    const existing = new Map((p.approvalRequest?.reviewers || []).map((r) => [r.userId, r]));
    if (!p.approvalRequest && ids.length) p.approvalRequest = { note: p.approvalNotes || "", sentAt: nowIso(), sentByUserId: u.id, reviewers: [] };
    if (p.approvalRequest) {
      p.approvalRequest.reviewers = ids.map((id) => existing.get(id) || { userId: id, status: "PENDING", note: null, decidedAt: null, assignedByUserId: u.id });
      p.approvalRequest.sentAt = nowIso();
    }
    const state = recomputeApproval(p, u);
    p.updatedAt = nowIso();
    const msg = !ids.length ? "Approvers removed" : state === "PENDING" ? `Approval requested from ${ids.filter((id) => existing.get(id)?.status !== "APPROVED").length || ids.length} reviewer(s)` : "Approvers updated";
    send(res, views.postDetail(p, u), msg);
  }));

  function decide(req, res, u, p, decision) {
    const r = p.approvalRequest?.reviewers.find((x) => x.userId === u.id);
    if (!r) return error(res, 403, "Only assigned approvers can approve or reject this post");
    if (r.status !== "PENDING") return error(res, 409, `You already ${r.status.toLowerCase()} this post`);
    Object.assign(r, { status: decision, decidedAt: nowIso(), note: req.body?.note?.trim() || null });
    const state = recomputeApproval(p, u);
    p.updatedAt = nowIso();
    const msg = decision === "REJECTED" ? "Post rejected — the author has been notified"
      : state === "PUBLISHED" ? "Approved — all approvers signed off and the post was published"
      : state === "APPROVED" ? "Approved — all approvers signed off" : "Approval recorded — waiting for the other approvers";
    send(res, views.postDetail(p, u), msg);
  }
  app.patch("/publishing/posts/:id/approve", withPost((req, res, u, p) => decide(req, res, u, p, "APPROVED")));
  app.patch("/publishing/posts/:id/reject", withPost((req, res, u, p) => decide(req, res, u, p, "REJECTED")));

  app.patch("/publishing/posts/:id/rollback-last-approved", withPost((req, res, u, p) => {
    const s = p.lastApprovedSnapshot;
    if (!s) return send(res, views.postDetail(p, u), "This post already matches its last approved version");
    p.title = s.title;
    p.text = s.text;
    p.labelIds = [...(s.labelIds || p.labelIds)];
    for (const snap of s.targets || []) {
      const t = p.targets.find((x) => x.id === snap.id);
      if (t) Object.assign(t, { textOverride: snap.textOverride, useMasterText: snap.useMasterText, galleryIds: [...snap.galleryIds] });
    }
    if (p.approvalRequest) p.approvalRequest.reviewers.forEach((r) => Object.assign(r, { status: "APPROVED", decidedAt: r.decidedAt || s.approvedAt || nowIso() }));
    p.approvalStatus = p.approvalRequest ? "APPROVED" : p.approvalStatus;
    p.reApproveRequired = false;
    p.lastContentEditedAt = null;
    if (p.status === "PENDING") {
      p.status = views.effectiveScheduledAt(p) ? "SCHEDULED" : "DRAFT";
      setTargetStatus(p, p.status);
    }
    p.workflowState = p.status === "SCHEDULED" ? "SCHEDULED_APPROVED" : p.status;
    p.updatedAt = nowIso();
    send(res, views.postDetail(p, u), "Rolled back to the last approved version");
  }));

  app.post("/publishing/posts/:id/duplicate", withPost((req, res, u, p) => {
    const now = nowIso();
    const copy = clone(p);
    Object.assign(copy, {
      id: newId(), userId: u.id, title: `${p.title} (Copy)`, status: "DRAFT", approvalStatus: "NOT_REQUIRED", workflowState: "DRAFT", reApproveRequired: false,
      approvalRequest: null, approvalVersion: 0, lastApprovedSnapshot: null, lastContentEditedAt: null, publishedAt: null, scheduledAt: null,
      publishMode: "DRAFT", requestApproval: false, imported: false, createdAt: now, updatedAt: now,
    });
    copy.targets = p.targets.map((t) => ({
      ...clone(t), id: newId(), status: "DRAFT", errorMessage: null, publishedAt: null, platformPostId: null, scheduledAt: null, metrics: null,
      lastSyncedAt: null, isDeletedOnPlatform: false, platformDeleteStatus: "NONE", platformDeletedAt: null, createdAt: now, updatedAt: now,
    }));
    getDb().posts.push(copy);
    send(res, { ...views.postDetail(copy, u), id: copy.id }, "Post duplicated to drafts", 201);
  }));

  // { mode: PLATFORM_ONLY | BOTH | RECORD_ONLY }
  app.post("/publishing/posts/:id/delete", withPost((req, res, u, p) => {
    const mode = String(req.body?.mode || "BOTH").toUpperCase();
    const db = getDb();
    if (!["PLATFORM_ONLY", "BOTH", "RECORD_ONLY"].includes(mode)) return error(res, 422, "mode must be PLATFORM_ONLY, BOTH or RECORD_ONLY");
    const live = p.targets.filter((t) => t.publishedAt && !t.isDeletedOnPlatform);
    if (mode === "PLATFORM_ONLY") {
      if (!live.length) return error(res, 409, "This post is not live on any platform");
      const now = nowIso();
      live.forEach((t) => Object.assign(t, { isDeletedOnPlatform: true, platformDeletedAt: now, platformDeletedBy: u.id, platformDeleteStatus: "DELETED", status: "DRAFT", publishedAt: null, metrics: null, updatedAt: now }));
      p.status = "DRAFT";
      p.workflowState = "DRAFT";
      p.publishedAt = null;
      p.updatedAt = now;
      return send(res, views.postDetail(p, u), `Removed from ${live.length} platform${live.length === 1 ? "" : "s"} — the post was kept as a draft`);
    }
    db.posts = db.posts.filter((x) => x.id !== p.id);
    db.postComments = db.postComments.filter((c) => c.postId !== p.id);
    send(res, { id: p.id, mode }, mode === "BOTH" && live.length ? `Post deleted here and on ${live.length} platform${live.length === 1 ? "" : "s"}` : "Post deleted");
  }));

  // ---------------------------------------------------------------- composer helpers
  app.get("/publishing/platforms/available", h.handle((req, res, u, project) => {
    const seen = new Set();
    const rows = [];
    for (const i of getDb().integrations) {
      if (i.projectId !== project.id || !i.isConnected || !meta(i.platform)?.publish || seen.has(i.platform)) continue;
      seen.add(i.platform);
      rows.push(views.availablePlatformView(i));
    }
    send(res, rows, "Available platforms fetched successfully");
  }));

  app.get("/publishing/campaigns", h.handle((req, res, u, project) => {
    const list = getDb().campaigns.filter((c) => c.projectId === project.id && textMatch(req.query.search, c.name, c.description));
    send(res, list.map(views.publishingCampaignView), "Campaigns fetched successfully");
  }));

  // People who can review posts/campaigns: everyone with access to Digital Marketing.
  app.get("/publishing/reviewers", h.handle((req, res) => {
    const list = marketingTeam().filter((x) => textMatch(req.query.search, `${x.firstName} ${x.lastName}`, x.email, x.profile?.jobTitle));
    const { items, meta: m } = paginate(list, req.query, 50);
    send(res, { items: items.map(views.reviewerProfile), meta: m }, "Reviewers fetched successfully");
  }, { needsProject: false }));
};
