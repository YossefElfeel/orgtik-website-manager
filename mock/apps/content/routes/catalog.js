// Services, sub-services, blogs and projects.
const { send, paginate, byNewest, byOrder, matches, normLoc, normLocArr, normArr, toId, has, bool, mapLoc, slugify, LANGS, nowIso, reqLang, tr, intOr } = require("../lib");

const locSlug = (slug, title) => {
  const base = normLoc(slug, null);
  return Object.fromEntries(LANGS.map((l) => [l, String(base?.[l] || "").trim() || slugify(title?.[l] || title?.en || "")]));
};
const parseJson = (v) => {
  if (typeof v !== "string") return v;
  try { return JSON.parse(v); } catch { return v; }
};

function registerCatalog(r, deps) {
  const { getDb, views, common } = deps;
  const { optionalUser, requireEditor, checker, notFound } = common;
  const seq = () => getDb().seq;

  const imageIdOr = (v, fallback) => (v === undefined ? fallback : toId(v));
  const galleryExists = (id) => id == null || !!getDb().gallery.find(id);

  // ---------------------------------------------------------------- services (families)
  r.get("/services", optionalUser, (req, res) => {
    const list = getDb().services.all().filter((s) => matches(req.query.search, s.title, s.slug)).sort(byOrder);
    const { items, meta } = paginate(list, req.query, 50);
    send(res, { items: items.map(views.service), meta }, "Services fetched successfully");
  });

  // [{ id, name }] for the blog form's service picker (names in the dashboard language).
  r.get("/services/list", optionalUser, (req, res) => {
    const lang = reqLang(req);
    send(res, getDb().services.all().sort(byOrder).map((s) => ({ id: s.id, name: tr(s.title, lang), slug: tr(s.slug, lang) })), "Services list fetched successfully");
  });

  r.get("/services/:id", optionalUser, (req, res) => {
    const s = getDb().services.find(req.params.id);
    if (!s) return notFound(res, "Service");
    const subServices = getDb().subServices.where((x) => x.serviceId === s.id).sort(byOrder).map(views.subService);
    send(res, { ...views.service(s), subServices }, "Service fetched successfully");
  });

  function serviceFields(body, row = {}) {
    const title = normLoc(body.title, row.title);
    return {
      title,
      description: normLoc(body.description, row.description),
      slug: has(body, "slug") || !row.slug ? locSlug(body.slug ?? row.slug, title) : row.slug,
      seoTitle: normLoc(body.seoTitle, row.seoTitle ?? null),
      seoDescription: normLoc(body.seoDescription, row.seoDescription ?? null),
      seoKeywords: normArr(body.seoKeywords, row.seoKeywords ?? []),
      imageId: imageIdOr(body.imageId, row.imageId ?? null),
      order: body.order !== undefined ? intOr(body.order, row.order ?? 0) : row.order,
    };
  }

  r.post("/services", requireEditor, (req, res) => {
    const body = req.body || {};
    const v = checker();
    v.localized("title", body.title, "Title");
    const fields = serviceFields(body);
    if (!galleryExists(fields.imageId)) v.add("imageId", "Image not found in the gallery");
    if (!v.ok()) return v.send(res);
    const db = getDb();
    if (fields.order == null) fields.order = db.services.all().reduce((m, s) => Math.max(m, s.order || 0), 0) + 1;
    const row = db.services.insert({ key: slugify(fields.title.en), ...fields, createdById: req.user.id, updatedById: req.user.id });
    send(res, views.service(row), "Service created successfully", 201);
  });

  const updateService = (req, res) => {
    const db = getDb();
    const s = db.services.find(req.params.id);
    if (!s) return notFound(res, "Service");
    const body = req.body || {};
    const fields = serviceFields(body, s);
    const v = checker();
    if (has(body, "title")) v.localized("title", fields.title, "Title");
    if (!galleryExists(fields.imageId)) v.add("imageId", "Image not found in the gallery");
    if (!v.ok()) return v.send(res);
    const row = db.services.update(s.id, { ...fields, updatedById: req.user.id });
    send(res, views.service(row), "Service updated successfully");
  };
  r.put("/services/:id", requireEditor, updateService);
  r.patch("/services/:id", requireEditor, updateService);

  r.delete("/services/:id", requireEditor, (req, res) => {
    const db = getDb();
    const s = db.services.remove(req.params.id);
    if (!s) return notFound(res, "Service");
    const subs = db.subServices.where((x) => x.serviceId === s.id);
    for (const x of subs) db.subServices.remove(x.id);
    for (const b of db.blogs.where((x) => x.serviceId === s.id)) b.serviceId = null;
    send(res, { id: s.id, removedSubServices: subs.length }, "Service deleted successfully");
  });

  // ---------------------------------------------------------------- sub-services
  const nestedCards = (list, prev = []) => {
    if (!Array.isArray(list)) return prev;
    const d = seq();
    return list.map((f) => ({
      id: toId(f?.id) ?? d.feature++,
      imageId: toId(f?.imageId),
      title: normLoc(f?.title, { en: "", de: "", fr: "", it: "" }),
      description: normLoc(f?.description, { en: "", de: "", fr: "", it: "" }),
    }));
  };
  const plans = (list, prev = []) => {
    if (!Array.isArray(list)) return prev;
    const d = seq();
    return list.map((p) => ({
      id: toId(p?.id) ?? d.plan++,
      iconId: toId(p?.iconId),
      price: Number(p?.price) || 0,
      name: normLoc(p?.name, { en: "", de: "", fr: "", it: "" }),
      brief: normLoc(p?.brief, { en: "", de: "", fr: "", it: "" }),
      whatsIncluded: normLocArr(p?.whatsIncluded, { en: [], de: [], fr: [], it: [] }),
    }));
  };
  function subServiceFields(body, row = {}) {
    const title = normLoc(body.title, row.title);
    const hero = body.featureImageId !== undefined ? body.featureImageId : body.heroImageId;
    return {
      title,
      description: normLoc(body.description, row.description),
      slug: has(body, "slug") || !row.slug ? locSlug(body.slug ?? row.slug, title) : row.slug,
      seoTitle: normLoc(body.seoTitle, row.seoTitle ?? null),
      seoDescription: normLoc(body.seoDescription, row.seoDescription ?? null),
      seoKeywords: normArr(body.seoKeywords, row.seoKeywords ?? []),
      imageId: imageIdOr(body.imageId, row.imageId ?? null),
      featureImageId: imageIdOr(hero, row.featureImageId ?? null),
      tags: normLocArr(body.tags, row.tags ?? { en: [], de: [], fr: [], it: [] }),
      body: normLoc(body.body, row.body ?? null),
      quote: normLoc(body.quote, row.quote ?? null),
      features: nestedCards(body.features, row.features || []),
      howWeWork: nestedCards(body.howWeWork, row.howWeWork || []),
      pricingPlans: plans(body.pricingPlans, row.pricingPlans || []),
      order: body.order !== undefined ? intOr(body.order, row.order ?? 0) : row.order,
    };
  }

  r.get("/sub-services", optionalUser, (req, res) => {
    const sid = toId(req.query.serviceId);
    const list = getDb().subServices.all().filter((s) => (sid == null || s.serviceId === sid) && matches(req.query.search, s.title, s.slug)).sort((a, b) => a.serviceId - b.serviceId || byOrder(a, b));
    send(res, list.map(views.subService), "Sub-services fetched successfully");
  });

  r.get("/sub-services/service/:serviceId", optionalUser, (req, res) => {
    const db = getDb();
    const service = db.services.find(req.params.serviceId);
    if (!service) return notFound(res, "Service");
    send(res, db.subServices.where((s) => s.serviceId === service.id).sort(byOrder).map(views.subService), "Sub-services fetched successfully");
  });

  r.get("/sub-services/:id", optionalUser, (req, res) => {
    const s = getDb().subServices.find(req.params.id);
    if (!s) return notFound(res, "Sub-service");
    send(res, views.subService(s), "Sub-service fetched successfully");
  });

  const createSubService = (req, res) => {
    const db = getDb();
    const body = req.body || {};
    const service = db.services.find(req.params.serviceId ?? body.serviceId);
    if (!service) return notFound(res, "Service");
    const v = checker();
    v.localized("title", body.title, "Title");
    const fields = subServiceFields(body);
    for (const k of ["imageId", "featureImageId"]) if (!galleryExists(fields[k])) v.add(k, "Image not found in the gallery");
    if (!v.ok()) return v.send(res);
    if (fields.order == null) fields.order = db.subServices.where((s) => s.serviceId === service.id).reduce((m, s) => Math.max(m, s.order || 0), 0) + 1;
    const row = db.subServices.insert({ serviceId: service.id, key: fields.slug.en, ...fields });
    send(res, views.subService(row), "Sub-service created successfully", 201);
  };
  r.post("/sub-services/:serviceId", requireEditor, createSubService);
  r.post("/sub-services", requireEditor, createSubService);

  const updateSubService = (req, res) => {
    const db = getDb();
    const s = db.subServices.find(req.params.id);
    if (!s) return notFound(res, "Sub-service");
    const body = req.body || {};
    const fields = subServiceFields(body, s);
    const v = checker();
    if (has(body, "title")) v.localized("title", fields.title, "Title");
    for (const k of ["imageId", "featureImageId"]) if (!galleryExists(fields[k])) v.add(k, "Image not found in the gallery");
    const moveTo = body.serviceId !== undefined ? db.services.find(body.serviceId) : null;
    if (body.serviceId !== undefined && !moveTo) v.add("serviceId", "Service not found");
    if (!v.ok()) return v.send(res);
    const row = db.subServices.update(s.id, { ...fields, ...(moveTo ? { serviceId: moveTo.id } : {}) });
    send(res, views.subService(row), "Sub-service updated successfully");
  };
  r.put("/sub-services/:id", requireEditor, updateSubService);
  r.patch("/sub-services/:id", requireEditor, updateSubService);

  r.delete("/sub-services/:id", requireEditor, (req, res) => {
    const db = getDb();
    const s = db.subServices.remove(req.params.id);
    if (!s) return notFound(res, "Sub-service");
    for (const c of db.contacts.where((x) => x.subServiceId === s.id)) c.subServiceId = null;
    send(res, { id: s.id }, "Sub-service deleted successfully");
  });

  // ---------------------------------------------------------------- blogs
  function blogFields(body, row = {}) {
    const title = normLoc(body.title, row.title);
    let blogSchema = row.blogSchema ?? null;
    if (body.blogSchema !== undefined) {
      const raw = parseJson(body.blogSchema);
      blogSchema = raw && typeof raw === "object" && !Array.isArray(raw) && LANGS.some((l) => l in raw)
        ? Object.fromEntries(LANGS.map((l) => [l, parseJson(raw[l]) ?? row.blogSchema?.[l] ?? null]))
        : raw;
    }
    return {
      title,
      description: normLoc(body.description, row.description),
      slug: has(body, "slug") || !row.slug ? locSlug(body.slug ?? row.slug, title) : row.slug,
      content: normLoc(body.content, row.content),
      seoTitle: normLoc(body.seoTitle, row.seoTitle ?? (title ? mapLoc(title, (t) => `${t} | OrgTik Insights`) : null)),
      seoDescription: normLoc(body.seoDescription, row.seoDescription ?? null),
      seoKeywords: normLocArr(body.seoKeywords, row.seoKeywords ?? { en: [], de: [], fr: [], it: [] }),
      visibility: body.visibility !== undefined ? bool(body.visibility) : (row.visibility ?? true),
      featureImageId: imageIdOr(body.featureImageId, row.featureImageId ?? null),
      serviceId: body.serviceId !== undefined ? toId(body.serviceId) : (row.serviceId ?? null),
      blogSchema,
    };
  }
  const validateBlog = (v, fields) => {
    if (!galleryExists(fields.featureImageId)) v.add("featureImageId", "Feature image not found in the gallery");
    if (fields.serviceId != null && !getDb().services.find(fields.serviceId)) v.add("serviceId", "Service not found");
  };

  r.get("/blogs", optionalUser, (req, res) => {
    const sid = toId(req.query.serviceId);
    const vis = req.query.visibility;
    const list = getDb().blogs.all()
      .filter((b) => (sid == null || b.serviceId === sid) && (vis === undefined || vis === "" || b.visibility === bool(vis)))
      .filter((b) => matches(req.query.search, b.title, b.description, b.slug))
      .sort(byNewest);
    const { items, meta } = paginate(list, req.query, 10);
    send(res, { items: items.map(views.blog), meta }, "Blogs fetched successfully");
  });

  r.get("/blogs/slug/:slug", optionalUser, (req, res) => {
    const b = getDb().blogs.all().find((x) => LANGS.some((l) => x.slug?.[l] === req.params.slug));
    if (!b) return notFound(res, "Blog");
    send(res, views.blog(b), "Blog fetched successfully");
  });

  r.get("/blogs/:id", optionalUser, (req, res) => {
    const b = getDb().blogs.find(req.params.id);
    if (!b) return notFound(res, "Blog");
    send(res, views.blog(b), "Blog fetched successfully");
  });

  r.post("/blogs", requireEditor, (req, res) => {
    const body = req.body || {};
    const v = checker();
    v.localized("title", body.title, "Title");
    v.localized("content", body.content, "Content");
    const fields = blogFields(body);
    validateBlog(v, fields);
    if (!v.ok()) return v.send(res);
    const row = getDb().blogs.insert({ ...fields, views: 0, readingTime: null, createdById: req.user.id, updatedById: req.user.id });
    send(res, views.blog(row), "Blog created successfully", 201);
  });

  const updateBlog = (req, res) => {
    const db = getDb();
    const b = db.blogs.find(req.params.id);
    if (!b) return notFound(res, "Blog");
    const body = req.body || {};
    const fields = blogFields(body, b);
    const v = checker();
    if (has(body, "title")) v.localized("title", fields.title, "Title");
    validateBlog(v, fields);
    if (!v.ok()) return v.send(res);
    const row = db.blogs.update(b.id, { ...fields, updatedById: req.user.id });
    send(res, views.blog(row), "Blog updated successfully");
  };
  r.patch("/blogs/:id", requireEditor, updateBlog);
  r.put("/blogs/:id", requireEditor, updateBlog);

  r.delete("/blogs/:id", requireEditor, (req, res) => {
    const b = getDb().blogs.remove(req.params.id);
    if (!b) return notFound(res, "Blog");
    send(res, { id: b.id }, "Blog deleted successfully");
  });

  // ---------------------------------------------------------------- projects
  function projectFields(body, row = {}) {
    return {
      title: normLoc(body.title, row.title),
      description: normLoc(body.description, row.description),
      tags: normLocArr(body.tags, row.tags ?? { en: [], de: [], fr: [], it: [] }),
      link: body.link !== undefined ? String(body.link || "").trim() : (row.link ?? ""),
      mainImageId: imageIdOr(body.mainImageId, row.mainImageId ?? null),
      logoImageId: imageIdOr(body.logoImageId, row.logoImageId ?? null),
      slug: row.slug ?? (body.title ? slugify(normLoc(body.title)?.en) : null),
    };
  }
  const validateProject = (v, fields) => {
    if (fields.link && !/^https?:\/\/\S+$/i.test(fields.link)) v.add("link", "Please provide a valid URL");
    if (!galleryExists(fields.mainImageId)) v.add("mainImageId", "Main image not found in the gallery");
  };

  r.get("/projects", optionalUser, (req, res) => {
    const list = getDb().projects.all().filter((p) => matches(req.query.search, p.title, p.description, p.tags?.en)).sort(byNewest);
    const { items, meta } = paginate(list, req.query, 10);
    send(res, { items: items.map(views.project), meta }, "Projects fetched successfully");
  });

  r.get("/projects/:id", optionalUser, (req, res) => {
    const p = getDb().projects.find(req.params.id);
    if (!p) return notFound(res, "Project");
    send(res, views.project(p), "Project fetched successfully");
  });

  r.post("/projects", requireEditor, (req, res) => {
    const body = req.body || {};
    const v = checker();
    v.localized("title", body.title, "Title");
    v.required("mainImageId", toId(body.mainImageId), "Main image");
    const fields = projectFields(body);
    validateProject(v, fields);
    if (!v.ok()) return v.send(res);
    const row = getDb().projects.insert({ ...fields, createdById: req.user.id, updatedById: req.user.id });
    send(res, views.project(row), "Project created successfully", 201);
  });

  const updateProject = (req, res) => {
    const db = getDb();
    const p = db.projects.find(req.params.id);
    if (!p) return notFound(res, "Project");
    const body = req.body || {};
    const fields = projectFields(body, p);
    const v = checker();
    if (has(body, "title")) v.localized("title", fields.title, "Title");
    validateProject(v, fields);
    if (!v.ok()) return v.send(res);
    const row = db.projects.update(p.id, { ...fields, updatedById: req.user.id });
    send(res, views.project(row), "Project updated successfully");
  };
  r.put("/projects/:id", requireEditor, updateProject);
  r.patch("/projects/:id", requireEditor, updateProject);

  r.delete("/projects/:id", requireEditor, (req, res) => {
    const p = getDb().projects.remove(req.params.id);
    if (!p) return notFound(res, "Project");
    send(res, { id: p.id, deletedAt: nowIso() }, "Project deleted successfully");
  });
}

module.exports = { registerCatalog };
