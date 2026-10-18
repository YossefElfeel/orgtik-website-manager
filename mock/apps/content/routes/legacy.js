// Endpoints declared in redux/features/* that no current page uses (older CMS screens): single-document sections
// (contentApi), control/testimonial/timelines/social-media/features collections, admin/ad-banner, admin/chatbot-script,
// and the content API's own /auth/login + /auth/me (authApi). Implemented so nothing 404s if they are reached.
const { send, fail, nowIso, normLoc, toId, bool, has } = require("../lib");

const DOC_KEYS = ["hero-section", "testimonial-section", "timeline-section", "feature-section", "control-section", "hosting-hero-section", "vps-hero-section", "question-section", "pakege-section", "domin-section", "service-section", "footer"];

function mergeDoc(doc, body) {
  for (const [k, v] of Object.entries(body || {})) {
    if (k === "id") continue;
    doc[k] = v && typeof v === "object" && !Array.isArray(v) && doc[k] && typeof doc[k] === "object" && !Array.isArray(doc[k]) ? { ...doc[k], ...v } : v;
  }
  if (has(doc, "updated_at")) doc.updated_at = nowIso();
  return doc;
}

function registerLegacy(r, deps) {
  const { ctx, getDb, views, common } = deps;
  const { optionalUser, requireUser, requireEditor, notFound } = common;
  const { identity } = ctx;

  for (const key of DOC_KEYS) {
    r.get(`/${key}`, optionalUser, (req, res) => send(res, getDb().legacyDocs[key], "Section fetched successfully"));
    r.put(`/${key}/:id`, requireEditor, (req, res) => send(res, mergeDoc(getDb().legacyDocs[key], req.body), "Section updated successfully"));
  }

  r.get("/admin/ad-banner", requireUser, (req, res) => send(res, getDb().legacyDocs["admin/ad-banner"], "Banner fetched successfully"));
  r.put("/admin/ad-banner", requireEditor, (req, res) => {
    const doc = getDb().legacyDocs["admin/ad-banner"];
    const b = req.body || {};
    if (b.description !== undefined) doc.description = normLoc(b.description, doc.description);
    if (b.discount_percent !== undefined) doc.discount_percent = Number(b.discount_percent) || 0;
    if (b.expires_at !== undefined) doc.expires_at = b.expires_at;
    if (b.is_active !== undefined) doc.is_active = bool(b.is_active);
    send(res, doc, "Banner updated successfully");
  });
  r.get("/admin/chatbot-script", requireUser, (req, res) => send(res, getDb().legacyDocs["admin/chatbot-script"], "Script fetched successfully"));
  r.put("/admin/chatbot-script", requireEditor, (req, res) => {
    const doc = getDb().legacyDocs["admin/chatbot-script"];
    doc.script = String(req.body?.script ?? "");
    send(res, doc, "Script updated successfully");
  });

  // control / testimonial / timelines / social-media: plain arrays with snake_case timestamps.
  const collectionView = (name, row) => (name === "social-media" ? { ...row, gallery: views.galleryById(row.gallery_id) } : row);
  for (const name of ["control", "testimonial", "timelines", "social-media"]) {
    const tbl = () => getDb().legacyCollections[name];
    r.get(`/${name}`, optionalUser, (req, res) => send(res, tbl().all().map((x) => collectionView(name, x)), "Items fetched successfully"));
    r.post(`/${name}`, requireEditor, (req, res) => {
      const { id, ...body } = req.body || {};
      const t = nowIso();
      const row = tbl().insert({ ...body, gallery_id: toId(body.gallery_id), created_at: t, updated_at: t });
      send(res, collectionView(name, row), "Item created successfully", 201);
    });
    r.put(`/${name}/:id`, requireEditor, (req, res) => {
      const row = tbl().find(req.params.id);
      if (!row) return notFound(res, "Item");
      const { id, ...body } = req.body || {};
      if (body.gallery_id !== undefined) body.gallery_id = toId(body.gallery_id);
      Object.assign(row, body, { updated_at: nowIso() });
      send(res, collectionView(name, row), "Item updated successfully");
    });
    r.delete(`/${name}/:id`, requireEditor, (req, res) => {
      const row = tbl().remove(req.params.id);
      if (!row) return notFound(res, "Item");
      send(res, { id: row.id }, "Item deleted successfully");
    });
  }

  // /features (IFeature[]: the old Features page, same shape as services).
  const featureView = (f) => ({ ...f, image: views.galleryById(f.imageId), createdAtTimeAgo: "", updatedAtTimeAgo: "" });
  r.get("/features", optionalUser, (req, res) => send(res, getDb().features.all().map(featureView), "Features fetched successfully"));
  r.put("/features/:id", requireEditor, (req, res) => {
    const db = getDb();
    const f = db.features.find(req.params.id);
    if (!f) return notFound(res, "Feature");
    const b = req.body || {};
    const patch = {};
    for (const k of ["title", "description", "slug", "seoTitle", "seoDescription"]) if (b[k] !== undefined) patch[k] = normLoc(b[k], f[k]);
    if (b.seoKeywords !== undefined) patch.seoKeywords = Array.isArray(b.seoKeywords) ? b.seoKeywords : String(b.seoKeywords).split(",").map((s) => s.trim()).filter(Boolean);
    if (b.imageId !== undefined || b.image_id !== undefined || b.gallery_id !== undefined) patch.imageId = toId(b.imageId ?? b.image_id ?? b.gallery_id);
    send(res, featureView(db.features.update(f.id, patch)), "Feature updated successfully");
  });

  // authApi: POST /auth/login and GET /auth/me against the content API (the app itself signs in through SOS).
  r.post("/auth/login", (req, res) => {
    const { email, password } = req.body || {};
    const u = identity.findByEmail(email);
    if (!u || password !== u.password) return fail(res, 401, "Invalid email or password. Please try again.");
    send(res, identity.authPayload(u), "Login successful");
  });
  r.get("/auth/me", requireUser, (req, res) => send(res, { user: identity.publicUser(req.user), scopes: identity.userScopes(req.user) }, "Profile fetched"));
}

module.exports = { registerLegacy };
