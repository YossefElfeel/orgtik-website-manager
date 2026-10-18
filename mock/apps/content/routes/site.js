// Website structure: pages (SEO), content sections + section types, sitemap categories/blogs, jobs.
const { send, fail, paginate, byNewest, byOrder, matches, normLoc, normLocArr, normArr, toId, has, bool, mapLoc, slugify, LANGS, intOr } = require("../lib");

// Keys like "hero.buttons" (ContentReusableForm writes nested object arrays that way) become nested values.
function expandDotted(content) {
  if (!content || typeof content !== "object" || Array.isArray(content)) return content;
  const out = {};
  const dotted = [];
  for (const [k, v] of Object.entries(content)) {
    if (k === "_placeholder") continue;
    if (k.includes(".")) dotted.push([k, v]);
    else out[k] = v;
  }
  for (const [k, v] of dotted) {
    const parts = k.split(".");
    let node = out;
    for (const p of parts.slice(0, -1)) {
      if (!node[p] || typeof node[p] !== "object") node[p] = {};
      node = node[p];
    }
    node[parts[parts.length - 1]] = v;
  }
  return out;
}

function registerSite(r, deps) {
  const { getDb, views, common } = deps;
  const { optionalUser, requireEditor, checker, notFound } = common;

  // ---------------------------------------------------------------- pages (SEO)
  r.get("/pages", optionalUser, (req, res) => {
    send(res, getDb().pages.all().sort(byOrder).map(views.page), "Pages fetched successfully");
  });
  r.get("/pages/:id", optionalUser, (req, res) => {
    const p = getDb().pages.find(req.params.id);
    if (!p) return notFound(res, "Page");
    send(res, views.page(p), "Page fetched successfully");
  });
  const updatePage = (req, res) => {
    const db = getDb();
    const p = db.pages.find(req.params.id);
    if (!p) return notFound(res, "Page");
    const body = req.body || {};
    const patch = {
      seoTitle: normLoc(body.seoTitle ?? body.titles, p.seoTitle),
      seoDescription: normLoc(body.seoDescription ?? body.descriptions, p.seoDescription),
      // SeoForm sends a comma-joined string; arrays are accepted too.
      seoKeywords: normArr(body.seoKeywords ?? body.keywords, p.seoKeywords),
    };
    const v = checker();
    for (const f of ["seoTitle", "seoDescription"]) if (LANGS.some((l) => String(patch[f]?.[l] ?? "").trim().length < 1)) v.add(f, `${f} is required in every language`);
    if (patch.seoKeywords.length > 10) v.add("seoKeywords", "Maximum 10 keywords allowed");
    if (!v.ok()) return v.send(res);
    const row = db.pages.update(p.id, patch);
    send(res, views.page(row), "SEO settings saved successfully");
  };
  r.put("/pages/:id", requireEditor, updatePage);
  r.patch("/pages/:id", requireEditor, updatePage);

  // ---------------------------------------------------------------- sections
  r.get("/section-types", optionalUser, (req, res) => send(res, getDb().sectionTypes.all().map(views.sectionType), "Section types fetched successfully"));
  r.get("/section-types/:id", optionalUser, (req, res) => {
    const db = getDb();
    const t = db.sectionTypes.find(req.params.id) || db.sectionTypes.where((x) => x.name === req.params.id)[0];
    if (!t) return notFound(res, "Section type");
    send(res, views.sectionType(t), "Section type fetched successfully");
  });

  r.get("/sections", optionalUser, (req, res) => {
    const pid = req.query.pageId !== undefined ? toId(req.query.pageId) : undefined;
    const list = getDb().sections.all().filter((s) => pid === undefined || s.pageId === pid).sort((a, b) => (a.pageId ?? 999) - (b.pageId ?? 999) || byOrder(a, b));
    send(res, list.map(views.section), "Sections fetched successfully");
  });
  r.get("/sections/shared", optionalUser, (req, res) => {
    send(res, getDb().sections.where((s) => s.pageId == null).sort(byOrder).map(views.section), "Shared sections fetched successfully");
  });
  r.get("/sections/page/:pageId", optionalUser, (req, res) => {
    const db = getDb();
    const p = db.pages.find(req.params.pageId);
    if (!p) return notFound(res, "Page");
    send(res, db.sections.where((s) => s.pageId === p.id).sort(byOrder).map(views.section), "Page sections fetched successfully");
  });
  r.get("/sections/:id", optionalUser, (req, res) => {
    const s = getDb().sections.find(req.params.id);
    if (!s) return notFound(res, "Section");
    send(res, views.section(s), "Section fetched successfully");
  });

  const updateSection = (req, res) => {
    const db = getDb();
    const s = db.sections.find(req.params.id);
    if (!s) return notFound(res, "Section");
    const type = db.sectionTypes.where((t) => t.name === s.sectionTypeName)[0];
    const body = req.body || {};
    const patch = {};
    if (body.content !== undefined) {
      let content = body.content;
      if (type?.isArrayBased) {
        if (!Array.isArray(content) && Array.isArray(content?.rootArray)) content = content.rootArray;
        if (!Array.isArray(content)) return fail(res, 400, "content must be an array for this section", { content: ["content must be an array for this section"] });
      } else {
        if (!content || typeof content !== "object" || Array.isArray(content)) return fail(res, 400, "content must be an object for this section", { content: ["content must be an object for this section"] });
        content = expandDotted(content);
      }
      patch.content = JSON.parse(JSON.stringify(content));
    }
    if (body.isActive !== undefined) patch.isActive = bool(body.isActive);
    if (body.order !== undefined) patch.order = intOr(body.order, s.order);
    const row = db.sections.update(s.id, patch);
    send(res, views.section(row), "Section content saved successfully");
  };
  r.put("/sections/:id", requireEditor, updateSection);
  r.patch("/sections/:id", requireEditor, updateSection);

  // ---------------------------------------------------------------- sitemap categories
  r.get("/sitemap-categories", optionalUser, (req, res) => {
    const list = getDb().sitemapCategories.all().filter((c) => matches(req.query.search, c.name)).sort((a, b) => a.id - b.id);
    send(res, list.map(views.sitemapCategory), "Sitemap categories fetched successfully");
  });
  r.get("/sitemap-categories/:id", optionalUser, (req, res) => {
    const db = getDb();
    const c = db.sitemapCategories.find(req.params.id);
    if (!c) return notFound(res, "Category");
    send(res, { ...views.sitemapCategory(c), blogs: db.sitemapBlogs.where((b) => b.categoryId === c.id).sort(byNewest).map(views.sitemapBlog) }, "Sitemap category fetched successfully");
  });
  r.post("/sitemap-categories", requireEditor, (req, res) => {
    const v = checker();
    v.localized("name", req.body?.name, "Category name");
    if (!v.ok()) return v.send(res);
    const row = getDb().sitemapCategories.insert({ name: normLoc(req.body.name) });
    send(res, views.sitemapCategory(row), "Category created successfully", 201);
  });
  const updateCategory = (req, res) => {
    const db = getDb();
    const c = db.sitemapCategories.find(req.params.id);
    if (!c) return notFound(res, "Category");
    const name = normLoc(req.body?.name, c.name);
    const v = checker();
    v.localized("name", name, "Category name");
    if (!v.ok()) return v.send(res);
    send(res, views.sitemapCategory(db.sitemapCategories.update(c.id, { name })), "Category updated successfully");
  };
  r.patch("/sitemap-categories/:id", requireEditor, updateCategory);
  r.put("/sitemap-categories/:id", requireEditor, updateCategory);
  r.delete("/sitemap-categories/:id", requireEditor, (req, res) => {
    const db = getDb();
    const c = db.sitemapCategories.remove(req.params.id);
    if (!c) return notFound(res, "Category");
    const orphaned = db.sitemapBlogs.where((b) => b.categoryId === c.id);
    for (const b of orphaned) b.categoryId = null;
    send(res, { id: c.id, uncategorizedBlogs: orphaned.length }, "Category deleted successfully");
  });

  // ---------------------------------------------------------------- sitemap blogs (plain array, newest first)
  function sitemapBlogFields(body, row = {}) {
    const title = normLoc(body.title, row.title);
    return {
      title,
      content: normLoc(body.content, row.content),
      categoryId: body.categoryId !== undefined ? toId(body.categoryId) : (row.categoryId ?? null),
      visibility: body.visibility !== undefined ? bool(body.visibility) : (row.visibility ?? true),
      seoTitle: normLoc(body.seoTitle, row.seoTitle ?? (title ? mapLoc(title, (t) => `${t} | OrgTik`) : null)),
      seoDescription: normLoc(body.seoDescription, row.seoDescription ?? null),
      seoKeywords: normArr(body.seoKeywords, row.seoKeywords ?? []),
      slug: has(body, "slug") || !row.slug
        ? Object.fromEntries(LANGS.map((l) => [l, String(normLoc(body.slug, row.slug)?.[l] || "").trim() || slugify(title?.[l] || title?.en)]))
        : row.slug,
    };
  }
  r.get("/sitemap-blogs", optionalUser, (req, res) => {
    const cid = toId(req.query.categoryId);
    let list = getDb().sitemapBlogs.all()
      .filter((b) => (cid == null || b.categoryId === cid) && matches(req.query.search, b.title, b.slug))
      .sort(byNewest);
    if (req.query.limit !== undefined || req.query.page !== undefined) list = paginate(list, req.query, 10).items;
    send(res, list.map(views.sitemapBlog), "Sitemap blogs fetched successfully");
  });
  r.get("/sitemap-blogs/:id", optionalUser, (req, res) => {
    const b = getDb().sitemapBlogs.find(req.params.id);
    if (!b) return notFound(res, "Blog");
    send(res, views.sitemapBlog(b), "Sitemap blog fetched successfully");
  });
  r.post("/sitemap-blogs", requireEditor, (req, res) => {
    const body = req.body || {};
    const v = checker();
    v.localized("title", body.title, "Title");
    const fields = sitemapBlogFields(body);
    if (fields.categoryId != null && !getDb().sitemapCategories.find(fields.categoryId)) v.add("categoryId", "Category not found");
    if (!v.ok()) return v.send(res);
    send(res, views.sitemapBlog(getDb().sitemapBlogs.insert(fields)), "Blog created successfully", 201);
  });
  const updateSitemapBlog = (req, res) => {
    const db = getDb();
    const b = db.sitemapBlogs.find(req.params.id);
    if (!b) return notFound(res, "Blog");
    const fields = sitemapBlogFields(req.body || {}, b);
    const v = checker();
    if (fields.categoryId != null && !db.sitemapCategories.find(fields.categoryId)) v.add("categoryId", "Category not found");
    if (!v.ok()) return v.send(res);
    send(res, views.sitemapBlog(db.sitemapBlogs.update(b.id, fields)), "Blog updated successfully");
  };
  r.patch("/sitemap-blogs/:id", requireEditor, updateSitemapBlog);
  r.put("/sitemap-blogs/:id", requireEditor, updateSitemapBlog);
  r.delete("/sitemap-blogs/:id", requireEditor, (req, res) => {
    const b = getDb().sitemapBlogs.remove(req.params.id);
    if (!b) return notFound(res, "Blog");
    send(res, { id: b.id }, "Blog deleted successfully");
  });

  // ---------------------------------------------------------------- jobs (careers)
  const EMPLOYMENT = ["full-time", "part-time", "contract", "internship", "temporary"];
  function jobFields(body, row = {}) {
    return {
      title: normLoc(body.title, row.title),
      department: normLoc(body.department, row.department),
      location: normLoc(body.location, row.location),
      description: normLoc(body.description, row.description),
      requirements: normLocArr(body.requirements, row.requirements ?? { en: [], de: [], fr: [], it: [] }),
      employmentType: body.employmentType !== undefined ? String(body.employmentType) : (row.employmentType ?? "full-time"),
      employmentTypeLabel: body.employmentTypeLabel !== undefined ? String(body.employmentTypeLabel) : (row.employmentTypeLabel ?? "Full-time"),
      workplace: body.workplace !== undefined ? String(body.workplace) : (row.workplace ?? "on-site"),
      isActive: body.isActive !== undefined ? bool(body.isActive) : (row.isActive ?? true),
      closingDate: body.closingDate !== undefined ? body.closingDate : (row.closingDate ?? null),
      applyEmail: body.applyEmail !== undefined ? String(body.applyEmail) : (row.applyEmail ?? "jobs@orgtik.test"),
      applicationsCount: row.applicationsCount ?? 0,
      publishedAt: row.publishedAt ?? new Date().toISOString(),
    };
  }
  r.get("/jobs", optionalUser, (req, res) => {
    const active = req.query.isActive;
    const list = getDb().jobs.all()
      .filter((j) => (active === undefined || active === "" || j.isActive === bool(active)) && matches(req.query.search, j.title, j.department, j.location))
      .sort(byNewest);
    const { items, meta } = paginate(list, req.query, 10);
    send(res, { items: items.map(views.job), meta }, "Jobs fetched successfully");
  });
  r.get("/jobs/:id", optionalUser, (req, res) => {
    const j = getDb().jobs.find(req.params.id);
    if (!j) return notFound(res, "Job");
    send(res, views.job(j), "Job fetched successfully");
  });
  r.post("/jobs", requireEditor, (req, res) => {
    const body = req.body || {};
    const v = checker();
    v.localized("title", body.title, "Job title");
    const fields = jobFields(body);
    if (!EMPLOYMENT.includes(fields.employmentType)) v.add("employmentType", `employmentType must be one of ${EMPLOYMENT.join(", ")}`);
    if (!v.ok()) return v.send(res);
    send(res, views.job(getDb().jobs.insert(fields)), "Job created successfully", 201);
  });
  const updateJob = (req, res) => {
    const db = getDb();
    const j = db.jobs.find(req.params.id);
    if (!j) return notFound(res, "Job");
    const fields = jobFields(req.body || {}, j);
    const v = checker();
    if (!EMPLOYMENT.includes(fields.employmentType)) v.add("employmentType", `employmentType must be one of ${EMPLOYMENT.join(", ")}`);
    if (!v.ok()) return v.send(res);
    send(res, views.job(db.jobs.update(j.id, fields)), "Job updated successfully");
  };
  r.patch("/jobs/:id", requireEditor, updateJob);
  r.put("/jobs/:id", requireEditor, updateJob);
  r.delete("/jobs/:id", requireEditor, (req, res) => {
    const j = getDb().jobs.remove(req.params.id);
    if (!j) return notFound(res, "Job");
    send(res, { id: j.id }, "Job deleted successfully");
  });
}

module.exports = { registerSite, expandDotted };
