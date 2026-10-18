// Gallery (/galleries) for the dashboard's galleryApi, @somion/gallery (MediaGallery/GalleryInput) and the TextEditor.
//   GET    /galleries?page&limit&search     -> { items: IGalleryItem[], meta }
//   POST   /galleries (multipart: alt + image|file)  -> { gallery: IGalleryItem }   (GalleryInput & TextEditor read data.gallery)
//   PUT    /galleries/:id (multipart: alt, optional image)   dashboard galleryApi.updateImage
//   PATCH  /galleries/:id (JSON { alt })                      @somion/gallery UpdateImageDialog
//   DELETE /galleries/:id
//   POST   /galleries/bulk-fetch { ids }    -> IGalleryItem[] in the order asked
const fs = require("fs");
const path = require("path");
const express = require("express");
const { send, fail, paginate, byNewest, matches, nowIso } = require("../lib");
const { coverSvg } = require("../covers");
const { ASSETS_DIR, MIME } = require("../seed/misc");

const FILE_FIELDS = ["image", "file", "media", "gallery", "photo", "video"];

function registerAssets(app, ctx) {
  // Generated covers first, then the copied seed images.
  app.get("/seed-assets/covers/:name.svg", (req, res) => {
    const svg = coverSvg(req.params.name);
    if (!svg) return res.status(404).type("text/plain").send("Cover not found");
    res.set("Cache-Control", "public, max-age=3600").type("image/svg+xml").send(svg);
  });
  app.use("/seed-assets", express.static(ASSETS_DIR, { maxAge: "1h" }));

  // Local copy of Monaco (the blog "blogSchema" JSON editor) so @monaco-editor/react does not need cdn.jsdelivr.net.
  const monacoVs = path.join(__dirname, "..", "..", "..", "..", ctx.config.apps.content.dir, "node_modules", "monaco-editor", "min", "vs");
  if (fs.existsSync(monacoVs)) app.use("/__monaco/vs", express.static(monacoVs, { maxAge: "1d" }));
  else ctx.log(`monaco-editor not installed yet (${monacoVs}); /__monaco/vs is unavailable`);
}

function registerGallery(r, deps) {
  const { ctx, getDb, views, common } = deps;
  const { optionalUser, requireEditor, notFound } = common;
  const upload = ctx.upload.any();

  const pickFile = (req) => {
    const files = req.files || [];
    return files.find((f) => FILE_FIELDS.includes(f.fieldname)) || files[0] || null;
  };
  const isMedia = (f) => /^(image|video)\//.test(f.mimetype || "") || /\.(png|jpe?g|gif|webp|avif|svg|mp4|webm|mov|m4v|ogg)$/i.test(f.originalname || "");
  const mimeOf = (f) => (f.mimetype && f.mimetype !== "application/octet-stream" ? f.mimetype : MIME[path.extname(f.originalname || "").toLowerCase()] || f.mimetype);
  const altFrom = (req, f) => String(req.body?.alt ?? "").trim() || String(f?.originalname || "Untitled").replace(/\.[^.]+$/, "");

  r.get("/galleries", optionalUser, (req, res) => {
    const db = getDb();
    const type = String(req.query.type || "").toLowerCase();
    let list = db.gallery.all().filter((g) => matches(req.query.search, g.alt, g.originalName));
    if (type === "image" || type === "video") list = list.filter((g) => String(g.mimeType).startsWith(`${type}/`));
    const { items, meta } = paginate([...list].sort(byNewest), req.query, 12);
    send(res, { items: items.map(views.gallery), meta }, "Gallery fetched successfully");
  });

  r.post("/galleries/bulk-fetch", optionalUser, (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : Array.isArray(req.body) ? req.body : [];
    const db = getDb();
    const items = ids.map((id) => db.gallery.find(id)).filter(Boolean).map(views.gallery);
    send(res, items, "Gallery items fetched successfully");
  });

  r.get("/galleries/:id", optionalUser, (req, res) => {
    const g = getDb().gallery.find(req.params.id);
    if (!g) return notFound(res, "Image");
    send(res, views.gallery(g), "Image fetched successfully");
  });

  r.post("/galleries", requireEditor, upload, (req, res) => {
    const f = pickFile(req);
    if (!f) return fail(res, 400, "Please attach an image or video file", { image: ["Please attach an image or video file"] });
    if (!isMedia(f)) return fail(res, 400, "Only image and video files can be uploaded", { image: ["Only image and video files can be uploaded"] });
    const row = getDb().gallery.insert({
      source: "upload", file: f.filename, originalName: f.originalname, alt: altFrom(req, f), mimeType: mimeOf(f), size: f.size, uploadedById: req.user.id,
    });
    const item = views.gallery(row);
    ctx.log(`gallery upload #${row.id} ${f.originalname} (${f.size} bytes) by ${req.user.email}`);
    send(res, { ...item, gallery: item }, "Image uploaded successfully", 201);
  });

  const update = (req, res) => {
    const db = getDb();
    const g = db.gallery.find(req.params.id);
    if (!g) return notFound(res, "Image");
    const patch = {};
    if (req.body?.alt !== undefined) patch.alt = String(req.body.alt).trim() || g.alt;
    const f = pickFile(req);
    if (f) {
      if (!isMedia(f)) return fail(res, 400, "Only image and video files can be uploaded", { image: ["Only image and video files can be uploaded"] });
      Object.assign(patch, { source: "upload", file: f.filename, originalName: f.originalname, mimeType: mimeOf(f), size: f.size });
    }
    const row = db.gallery.update(g.id, patch);
    const item = views.gallery(row);
    send(res, { ...item, gallery: item }, "Image updated successfully");
  };
  r.put("/galleries/:id", requireEditor, upload, update);
  r.patch("/galleries/:id", requireEditor, upload, update);

  r.delete("/galleries/:id", requireEditor, (req, res) => {
    const removed = getDb().gallery.remove(req.params.id);
    if (!removed) return notFound(res, "Image");
    send(res, { id: removed.id, deletedAt: nowIso() }, "Image deleted successfully");
  });
}

module.exports = { registerAssets, registerGallery };
