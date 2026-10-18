// Response shapes, matched to what the dashboard components read (not only types/*.ts):
//   gallery item (IGalleryItem): { id, image, alt, created_at, updated_at } (+ url for blog/project image objects)
//   blog.featureImage / topBlogs[].featureImage / project.logoImage: { id, url, alt }
//   service.image / subService.image|featureImage / project.mainImage: gallery items (read .image)
const { timeAgo, tr, byOrder } = require("./lib");

function makeViews({ getDb, identity, config, fileUrl }) {
  const apiBase = () => config.apiUrl("content");
  const db = () => getDb();

  const galleryUrl = (g) => (g.source === "upload" ? fileUrl(g.file) : `${apiBase()}/seed-assets/${g.file}`);
  const isVideo = (g) => String(g.mimeType || "").startsWith("video/");

  function gallery(g) {
    if (!g) return null;
    const url = galleryUrl(g);
    return {
      id: g.id, image: url, url, alt: g.alt, type: isVideo(g) ? "video" : "image", mimeType: g.mimeType, size: g.size,
      fileName: g.originalName, created_at: g.createdAt, updated_at: g.updatedAt, createdAt: g.createdAt, updatedAt: g.updatedAt,
    };
  }
  const galleryById = (id) => (id == null ? null : gallery(db().gallery.find(id)));
  const imageRef = (id) => {
    const g = galleryById(id);
    return g ? { id: g.id, url: g.url, image: g.image, alt: g.alt } : null;
  };

  const user = (id) => {
    const u = id != null ? identity.findUser(id) : null;
    return u ? { id: u.id, email: u.email, username: u.username, firstName: u.firstName, lastName: u.lastName, avatar: u.avatar } : null;
  };
  const stamps = (row) => ({ createdAt: row.createdAt, createdAtTimeAgo: timeAgo(row.createdAt), updatedAt: row.updatedAt, updatedAtTimeAgo: timeAgo(row.updatedAt) });

  const serviceMini = (id) => {
    const s = id != null ? db().services.find(id) : null;
    return s ? { id: s.id, title: s.title, slug: s.slug } : null;
  };
  const subServiceMini = (id) => {
    const s = id != null ? db().subServices.find(id) : null;
    return s ? { id: s.id, serviceId: s.serviceId, title: s.title, slug: s.slug } : null;
  };

  function service(s) {
    return {
      id: s.id, title: s.title, description: s.description, slug: s.slug,
      seoTitle: s.seoTitle ?? null, seoDescription: s.seoDescription ?? null, seoKeywords: s.seoKeywords ?? [],
      imageId: s.imageId ?? null, image: galleryById(s.imageId), order: s.order,
      subServicesCount: db().subServices.where((x) => x.serviceId === s.id).length,
      ...stamps(s),
    };
  }

  const withImage = (list) => (list || []).map((f) => ({ ...f, image: galleryById(f.imageId) }));
  function subService(s) {
    const featureImage = galleryById(s.featureImageId);
    return {
      id: s.id, serviceId: s.serviceId, service: serviceMini(s.serviceId),
      title: s.title, description: s.description, slug: s.slug,
      seoTitle: s.seoTitle ?? null, seoDescription: s.seoDescription ?? null, seoKeywords: s.seoKeywords ?? [],
      imageId: s.imageId ?? null, image: galleryById(s.imageId),
      featureImageId: s.featureImageId ?? null, featureImage, heroImageId: s.featureImageId ?? null, heroImage: featureImage,
      tags: s.tags ?? null, body: s.body ?? null, quote: s.quote ?? null,
      features: withImage(s.features), howWeWork: withImage(s.howWeWork),
      pricingPlans: (s.pricingPlans || []).map((p) => ({ ...p, icon: galleryById(p.iconId) })),
      order: s.order,
      ...stamps(s),
    };
  }

  function blog(b) {
    const svc = serviceMini(b.serviceId);
    return {
      id: b.id, title: b.title, description: b.description, slug: b.slug, content: b.content,
      seoTitle: b.seoTitle, seoDescription: b.seoDescription, seoKeywords: b.seoKeywords,
      visibility: b.visibility, status: b.visibility ? "published" : "draft",
      featureImageId: b.featureImageId ?? null, featureImage: imageRef(b.featureImageId),
      serviceId: b.serviceId ?? null, service: svc, services: svc ? [svc] : [],
      blogSchema: b.blogSchema ?? null, views: b.views ?? 0, readingTime: b.readingTime ?? null,
      createdById: b.createdById, updatedById: b.updatedById, createdBy: user(b.createdById), updatedBy: user(b.updatedById),
      ...stamps(b),
    };
  }

  function project(p) {
    return {
      id: p.id, title: p.title, description: p.description, tags: p.tags, link: p.link, slug: p.slug ?? null,
      mainImageId: p.mainImageId ?? null, mainImage: galleryById(p.mainImageId),
      logoImageId: p.logoImageId ?? null, logoImage: imageRef(p.logoImageId),
      createdById: p.createdById, updatedById: p.updatedById, createdBy: user(p.createdById), updatedBy: user(p.updatedById),
      ...stamps(p),
    };
  }

  function contact(c) {
    return {
      id: c.id, firstName: c.firstName, lastName: c.lastName, companyName: c.companyName, email: c.email, phoneNumber: c.phoneNumber,
      subject: c.subject ?? null, status: c.status, ipAddress: c.ipAddress ?? null,
      serviceId: c.serviceId ?? null, subServiceId: c.subServiceId ?? null,
      service: serviceMini(c.serviceId), subService: subServiceMini(c.subServiceId),
      ...stamps(c),
    };
  }
  function contactDetail(c) {
    const s = c.serviceId != null ? db().services.find(c.serviceId) : null;
    const ss = c.subServiceId != null ? db().subServices.find(c.subServiceId) : null;
    return {
      ...contact(c),
      message: c.message, customerServiceName: c.customerServiceName ?? null, notes: c.notes ?? null,
      service: s ? { id: s.id, title: s.title, slug: s.slug, description: s.description, image: imageRef(s.imageId) } : null,
      subService: ss ? { id: ss.id, title: ss.title, slug: ss.slug, description: ss.description } : null,
    };
  }

  const review = (r) => ({ id: r.id, clientName: r.clientName, clientTitle: r.clientTitle, reviewContent: r.reviewContent, rate: r.rate, isPublic: r.isPublic, createdAt: r.createdAt, updatedAt: r.updatedAt });

  const sitemapCategory = (c) => ({ id: c.id, name: c.name, blogsCount: db().sitemapBlogs.where((b) => b.categoryId === c.id).length, createdAt: c.createdAt, updatedAt: c.updatedAt });
  function sitemapBlog(b) {
    const c = b.categoryId != null ? db().sitemapCategories.find(b.categoryId) : null;
    return {
      id: b.id, title: b.title, content: b.content, categoryId: b.categoryId ?? null, category: c ? { id: c.id, name: c.name } : null,
      visibility: b.visibility, seoTitle: b.seoTitle, seoDescription: b.seoDescription, seoKeywords: b.seoKeywords ?? [], slug: b.slug,
      createdAt: b.createdAt, updatedAt: b.updatedAt,
    };
  }

  const sectionType = (t) => (t ? { id: t.id, name: t.name, displayName: t.displayName, description: t.description, isArrayBased: t.isArrayBased, schema: t.schema, isActive: t.isActive, createdAt: t.createdAt, updatedAt: t.updatedAt } : null);
  function section(s) {
    const t = db().sectionTypes.where((x) => x.name === s.sectionTypeName)[0];
    const p = s.pageId != null ? db().pages.find(s.pageId) : null;
    return {
      id: s.id, pageId: s.pageId ?? null, name: s.name, sectionTypeName: s.sectionTypeName, content: s.content,
      order: s.order, isActive: s.isActive, createdAt: s.createdAt, updatedAt: s.updatedAt,
      sectionType: sectionType(t), page: p ? { id: p.id, type: p.type } : null,
    };
  }
  function page(p) {
    const sections = db().sections.where((s) => s.pageId === p.id).sort(byOrder)
      .map((s) => ({ id: s.id, name: s.name, sectionTypeName: s.sectionTypeName, order: s.order, isActive: s.isActive }));
    return {
      id: p.id, type: p.type, name: p.type.charAt(0).toUpperCase() + p.type.slice(1),
      seoTitle: p.seoTitle, seoDescription: p.seoDescription, seoKeywords: p.seoKeywords ?? [],
      order: p.order, sections, createdAt: p.createdAt, updatedAt: p.updatedAt,
    };
  }

  const job = (j) => ({ ...j, ...stamps(j) });

  // Blog titles, service names etc. as plain strings in the dashboard language (analytics, services/list).
  const title = (loc, lang) => tr(loc, lang);

  return {
    apiBase, galleryUrl, gallery, galleryById, imageRef, user, service, serviceMini, subService, blog, project,
    contact, contactDetail, review, sitemapCategory, sitemapBlog, sectionType, section, page, job, title,
  };
}

module.exports = { makeViews };
