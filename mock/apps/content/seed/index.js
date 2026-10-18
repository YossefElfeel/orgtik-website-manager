// Builds the in-memory database for the Content dashboard mock. Called at start and by POST /__reset.
const { table } = require("../lib");
const { buildServices } = require("./services");
const { buildBlogs } = require("./blogs");
const { buildSite, buildJobs } = require("./site");
const { buildGallery, buildProjects, buildContacts, buildReviews, buildSitemap, buildLegacy } = require("./misc");

// ctx: { identity, websiteUrl, galleryUrl(row) }
function buildSeed(ctx) {
  const { identity, websiteUrl } = ctx;
  const userIdByKey = (key) => identity.findByKey(key)?.id ?? 1;
  const userName = (id) => {
    const u = identity.findUser(id);
    return u ? identity.fullName(u) : "OrgTik";
  };

  const gallery = buildGallery();
  const { services, subServices } = buildServices();
  const serviceIdByKey = (key) => services.find((s) => s.key === key)?.id ?? null;
  const subServiceIdByKey = (key) => subServices.find((s) => s.key === key)?.id ?? null;
  const imageUrl = (id) => {
    const g = gallery.find((x) => x.id === id);
    return g ? ctx.galleryUrl(g) : null;
  };

  const blogs = buildBlogs({ serviceIdByKey, userIdByKey, userName, imageUrl, websiteUrl });
  const jobs = buildJobs();
  const { pages, sectionTypes, sections } = buildSite({ websiteUrl, jobs });
  const projects = buildProjects({ websiteUrl, userIdByKey });
  const contacts = buildContacts({ serviceIdByKey, subServiceIdByKey });
  const reviews = buildReviews();
  const sitemap = buildSitemap();
  const legacy = buildLegacy();

  return {
    gallery: table(gallery),
    services: table(services),
    subServices: table(subServices),
    blogs: table(blogs),
    projects: table(projects),
    contacts: table(contacts),
    reviews: table(reviews),
    sitemapCategories: table(sitemap.categories),
    sitemapBlogs: table(sitemap.blogs),
    pages: table(pages),
    sectionTypes: table(sectionTypes),
    sections: table(sections),
    jobs: table(jobs),
    features: table(legacy.features),
    legacyDocs: legacy.docs,
    legacyCollections: Object.fromEntries(Object.entries(legacy.collections).map(([k, rows]) => [k, table(rows)])),
    // ids handed out by nested collections (sub-service features/steps/plans)
    seq: { feature: 1000, plan: 1000 },
  };
}

module.exports = { buildSeed };
