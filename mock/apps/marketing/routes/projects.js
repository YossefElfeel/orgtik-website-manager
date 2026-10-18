// Brands (projects): switcher, settings page (name/description/avatar), create & delete.
const { send, error, newId, nowIso, slugify } = require("../lib");

module.exports = function projectRoutes(app, { ctx, getDb, views, h }) {
  const findProject = (req, u) => {
    const p = getDb().projects.find((x) => x.id === req.params.id);
    return p && h.canSee(p, u) ? p : null;
  };
  const fileRef = (file) => `/uploads/${encodeURIComponent(file.filename)}`;

  app.get("/projects", h.handle((req, res, u) => {
    const active = h.activeProject(u);
    send(res, h.projectsFor(u).map((p) => views.projectView(p, active?.id)), "Projects fetched successfully");
  }, { needsProject: false }));

  app.get("/projects/active", h.handle((req, res, u) => {
    const p = h.activeProject(u);
    if (!p) return error(res, 404, "No active project. Create a project to get started.");
    send(res, views.projectView(p, p.id), "Active project fetched successfully");
  }, { needsProject: false }));

  app.get("/projects/:id", h.handle((req, res, u) => {
    const p = findProject(req, u);
    if (!p) return h.notFound(res, "Project");
    send(res, views.projectView(p, h.activeProject(u)?.id), "Project fetched successfully");
  }, { needsProject: false }));

  // JSON { name, description } or multipart with an `avatar` file.
  app.post("/projects", ctx.upload.single("avatar"), h.handle((req, res, u) => {
    const name = String(req.body?.name || "").trim();
    if (name.length < 2) return error(res, 422, "Project name is required", { errors: { name: ["Project name must be at least 2 characters long"] } });
    const db = getDb();
    const now = nowIso();
    const p = {
      id: newId(), key: null, userId: u.id, name, slug: slugify(name), description: req.body?.description?.trim() || null,
      avatar: req.file ? fileRef(req.file) : null, isActive: true, memberUserIds: [u.id], createdAt: now, updatedAt: now,
      timeZone: ctx.workspace?.timeZone || "Africa/Cairo", currency: ctx.workspace?.currency || "USD",
    };
    db.projects.push(p);
    db.activeProject[u.id] = p.id;
    send(res, views.projectView(p, p.id), "Project created successfully", 201);
  }, { needsProject: false }));

  app.patch("/projects/:id", h.handle((req, res, u) => {
    const p = findProject(req, u);
    if (!p) return h.notFound(res, "Project");
    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (name.length < 2) return error(res, 422, "Project name must be at least 2 characters long");
      p.name = name;
    }
    if (req.body?.description !== undefined) p.description = String(req.body.description || "").trim() || null;
    p.updatedAt = nowIso();
    send(res, views.projectView(p, h.activeProject(u)?.id), "Project updated successfully");
  }, { needsProject: false }));

  app.delete("/projects/:id", h.handle((req, res, u) => {
    const db = getDb();
    const p = findProject(req, u);
    if (!p) return h.notFound(res, "Project");
    db.projects = db.projects.filter((x) => x.id !== p.id);
    for (const key of ["posts", "labels", "integrations", "campaigns", "executions", "audiences", "segments", "imports", "gallery", "competitors"]) {
      db[key] = db[key].filter((x) => x.projectId !== p.id);
    }
    const postIds = new Set(db.posts.map((x) => x.id));
    db.postComments = db.postComments.filter((c) => postIds.has(c.postId));
    const campaignIds = new Set(db.campaigns.map((x) => x.id));
    db.campaignComments = db.campaignComments.filter((c) => campaignIds.has(c.campaignId));
    for (const [userId, active] of Object.entries(db.activeProject)) if (active === p.id) delete db.activeProject[userId];
    send(res, { id: p.id }, "Project deleted successfully");
  }, { needsProject: false }));

  app.post("/projects/:id/switch", h.handle((req, res, u) => {
    const p = findProject(req, u);
    if (!p) return h.notFound(res, "Project");
    getDb().activeProject[u.id] = p.id;
    send(res, views.projectView(p, p.id), `Switched to ${p.name}`);
  }, { needsProject: false }));

  // Avatar upload (multipart field `file`) and removal.
  app.post("/projects/:id/avatar", ctx.upload.single("file"), h.handle((req, res, u) => {
    const p = findProject(req, u);
    if (!p) return h.notFound(res, "Project");
    const file = req.file || (req.files || [])[0];
    if (!file) return error(res, 422, "Please choose an image to upload");
    p.avatar = fileRef(file);
    p.updatedAt = nowIso();
    send(res, views.projectView(p, h.activeProject(u)?.id), "Avatar updated successfully");
  }, { needsProject: false }));

  app.delete("/projects/:id/avatar", h.handle((req, res, u) => {
    const p = findProject(req, u);
    if (!p) return h.notFound(res, "Project");
    p.avatar = null;
    p.updatedAt = nowIso();
    send(res, views.projectView(p, h.activeProject(u)?.id), "Avatar removed successfully");
  }, { needsProject: false }));
};
