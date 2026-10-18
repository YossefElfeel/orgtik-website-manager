// Labels and the media gallery. The gallery endpoints follow the @somion/gallery package contract:
//   GET  /galleries?page&limit&search  -> { data: { items: [{ id, image, alt, created_at, updated_at }], meta: { total, totalPages, hasNext, hasPrev, ... } } }
//   POST /galleries (multipart alt + image) -> { data: { gallery: item } }
//   PUT  /galleries/:id { alt } · DELETE /galleries/:id · POST /galleries/bulk-fetch { ids } -> { data: item[] }
const { send, error, newId, nowIso, paginate, textMatch, listParam } = require("../lib");

const LABEL_COLORS = ["#6366F1", "#F97316", "#EF4444", "#16A34A", "#0EA5E9", "#DB2777", "#CA8A04", "#7C3AED"];

module.exports = function libraryRoutes(app, { ctx, getDb, views, h }) {
  const permittedMedia = (id, user) => {
    const db = getDb(), row = db.gallery.find(item => String(item.id) === String(id));
    const project = row && db.projects.find(item => item.id === row.projectId);
    return row && project && h.canSee(project, user) ? row : null;
  };
  // ---------------------------------------------------------------- labels
  const projectLabels = (project) => getDb().labels.filter((l) => l.projectId === project.id).sort((a, b) => a.name.localeCompare(b.name));
  const findLabel = (req, project) => getDb().labels.find((l) => l.id === req.params.id && l.projectId === project.id);

  app.get("/labels", h.handle((req, res, u, project) => {
    const list = projectLabels(project).filter((l) => textMatch(req.query.search || req.query.name, l.name));
    const { items, meta } = paginate(list, req.query, 100);
    send(res, { items: items.map(views.labelView), meta }, "Labels fetched successfully");
  }));

  app.get("/labels/all", h.handle((req, res, u, project) => send(res, projectLabels(project).map(views.labelView), "Labels fetched successfully")));

  app.get("/labels/:id", h.handle((req, res, u, project) => {
    const l = findLabel(req, project);
    if (!l) return h.notFound(res, "Label");
    send(res, views.labelView(l), "Label fetched successfully");
  }));

  app.post("/labels", h.handle((req, res, u, project) => {
    const name = String(req.body?.name || "").trim();
    if (name.length < 2) return error(res, 422, "Label name must be at least 2 characters", { errors: { name: ["Label name must be at least 2 characters"] } });
    const db = getDb();
    if (db.labels.some((l) => l.projectId === project.id && l.name.toLowerCase() === name.toLowerCase())) return error(res, 409, `A label named "${name}" already exists`);
    const color = /^#[0-9a-f]{3,8}$/i.test(req.body?.color || "") ? req.body.color : LABEL_COLORS[db.labels.length % LABEL_COLORS.length];
    const l = { id: newId(), projectId: project.id, userId: u.id, name, color, createdAt: nowIso(), updatedAt: nowIso() };
    db.labels.push(l);
    send(res, views.labelView(l), "Label created successfully", 201);
  }));

  app.patch("/labels/:id", h.handle((req, res, u, project) => {
    const l = findLabel(req, project);
    if (!l) return h.notFound(res, "Label");
    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (name.length < 2) return error(res, 422, "Label name must be at least 2 characters");
      l.name = name;
    }
    if (req.body?.color) l.color = req.body.color;
    l.updatedAt = nowIso();
    send(res, views.labelView(l), "Label updated successfully");
  }));

  app.delete("/labels/:id", h.handle((req, res, u, project) => {
    const db = getDb();
    const l = findLabel(req, project);
    if (!l) return h.notFound(res, "Label");
    db.labels = db.labels.filter((x) => x.id !== l.id);
    db.posts.forEach((p) => { p.labelIds = p.labelIds.filter((id) => id !== l.id); });
    send(res, { id: l.id }, "Label deleted successfully");
  }));

  // ---------------------------------------------------------------- gallery
  const projectGallery = (project) => getDb().gallery.filter((g) => g.projectId === project.id).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  app.get("/galleries", h.handle((req, res, u, project) => {
    const list = projectGallery(project).filter((g) => textMatch(req.query.search, g.alt));
    const { items, meta } = paginate(list, req.query, 12);
    send(res, { items: items.map(views.galleryView), meta }, "Gallery fetched successfully");
  }));

  app.post("/galleries/bulk-fetch", h.handle((req, res, u) => {
    const ids = listParam(req.body?.ids).map(Number);
    const out = ids.filter(id => permittedMedia(id, u)).map((id) => views.galleryById(id)).filter(Boolean);
    send(res, out, "Gallery items fetched successfully");
  }, { needsProject: false }));

  app.get("/galleries/:id", h.handle((req, res, u) => {
    const g = permittedMedia(req.params.id, u) && views.galleryById(req.params.id);
    if (!g) return h.notFound(res, "Media item");
    send(res, g, "Media item fetched successfully");
  }, { needsProject: false }));

  // multipart: alt + image (any file field name is accepted).
  app.post("/galleries", ctx.upload.any(), h.handle((req, res, u, project) => {
    const file = (req.files || []).find((f) => f.fieldname === "image") || (req.files || [])[0];
    if (!file) return error(res, 422, "Please choose an image or video to upload");
    const db = getDb();
    const now = nowIso();
    const g = { id: db.nextGalleryId++, projectId: project.id, path: `/uploads/${encodeURIComponent(file.filename)}`, alt: String(req.body?.alt || file.originalname).trim(), uploadedBy: u.id, mimeType: file.mimetype, size: file.size, created_at: now, updated_at: now };
    db.gallery.push(g);
    const item = views.galleryView(g);
    send(res, { gallery: item, ...item }, "Media uploaded successfully", 201);
  }));

  const updateAlt = h.handle((req, res, u) => {
    const g = permittedMedia(req.params.id, u);
    if (!g) return h.notFound(res, "Media item");
    if (req.body?.alt !== undefined) g.alt = String(req.body.alt);
    g.updated_at = nowIso();
    send(res, { gallery: views.galleryView(g), ...views.galleryView(g) }, "Media updated successfully");
  }, { needsProject: false });
  app.put("/galleries/:id", updateAlt);
  app.patch("/galleries/:id", updateAlt);

  app.delete("/galleries/:id", h.handle((req, res, u) => {
    const db = getDb();
    const g = permittedMedia(req.params.id, u);
    if (!g) return h.notFound(res, "Media item");
    db.gallery = db.gallery.filter((x) => x.id !== g.id);
    db.posts.forEach((p) => p.targets.forEach((t) => { t.galleryIds = t.galleryIds.filter((id) => id !== g.id); }));
    send(res, { id: g.id }, "Media deleted successfully");
  }, { needsProject: false }));
};

