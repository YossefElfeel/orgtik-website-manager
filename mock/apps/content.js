// Local mock backend for content-dashboard-somion-main (web :3006, API :4006) — the CMS for the OrgTik website.
// NEXT_PUBLIC_API_URL=http://localhost:4006/api (every route is also served without the /api prefix).
//   gallery      /galleries* (+ @somion/gallery contract: list, multipart upload, PATCH alt, bulk-fetch)
//   catalog      /services*, /services/list, /sub-services*, /blogs*, /projects*
//   website      /pages* (SEO), /sections* (+ /section-types), /sitemap-categories*, /sitemap-blogs*, /jobs*
//   inbox        /contacts* (+ /:id/status), /reviews*, /analytics/dashboard
//   legacy       older section docs (/hero-section …), /control, /testimonial, /timelines, /social-media, /features,
//                /admin/ad-banner, /admin/chatbot-script, /auth/login, /auth/me
//   assets       /seed-assets/* (images copied from the OrgTik website clone + generated covers), /__monaco/vs/*
// Seed content mirrors the OrgTik website (orgtik-website/landing-directions) in en/de/fr/it.
// State is in memory; POST /__reset (or /api/__reset) rebuilds the seed. Code lives in apps/content/*.
const express = require("express");
const { buildSeed } = require("./content/seed");
const { makeViews } = require("./content/views");
const { makeCommon } = require("./content/routes/common");
const { registerAssets, registerGallery } = require("./content/routes/media");
const { registerCatalog } = require("./content/routes/catalog");
const { registerSite } = require("./content/routes/site");
const { registerInbox } = require("./content/routes/inbox");
const { registerLegacy } = require("./content/routes/legacy");
const { send } = require("./content/lib");

let db = null;
const getDb = () => db;

module.exports = {
  // The dashboard checks this scope (NEXT_PUBLIC_DASHBOARD_SCOPE); the SoSBar tile opens `${domain}/${locale}/auth?token=…`.
  scopes: [
    {
      // The old content dashboard, kept for admins until the Website Manager replaces it (plan,
      // Phase 2). Its scope is configurable (NEXT_PUBLIC_DASHBOARD_SCOPE).
      name: "website_manager_legacy",
      displayName: "Content Dashboard (legacy)",
      description: "Manage the OrgTik website: pages and sections, services, projects, blogs, SEO, sitemap, gallery, contacts and reviews.",
      metadata: { icon: "solar:global-bold", color: "#0EA5E9" },
    },
  ],

  // The app only requires the scope (it defines super_admin/developer/viewer/project_manager helpers but gates nothing on them).
  grants: {
    website_manager_legacy: {
      admin: ["super_admin"],
    },
  },

  routes(app, ctx) {
    const { config, identity } = ctx;
    const websiteUrl = config.apps.website ? config.webUrl("website") : "http://localhost:4173";
    const views = makeViews({ getDb, identity, config, fileUrl: ctx.fileUrl });
    const seed = () => buildSeed({ identity, websiteUrl, galleryUrl: views.galleryUrl });
    db = seed();

    const common = makeCommon(ctx);
    const deps = { ctx, getDb, views, common };
    registerAssets(app, ctx);

    const r = express.Router();
    registerGallery(r, deps);
    registerCatalog(r, deps);
    registerSite(r, deps);
    registerInbox(r, deps);
    registerLegacy(r, deps);
    r.post("/__reset", (req, res) => {
      db = seed();
      ctx.log("seed data reset");
      send(res, { ok: true }, "Content mock data reset");
    });
    app.use(["/api", "/"], r);

    ctx.log(
      `seeded ${db.services.all().length} services / ${db.subServices.all().length} sub-services, ${db.blogs.all().length} blogs, ` +
        `${db.projects.all().length} projects, ${db.pages.all().length} pages / ${db.sections.all().length} sections, ` +
        `${db.contacts.all().length} contacts, ${db.reviews.all().length} reviews, ${db.gallery.all().length} gallery items, ` +
        `${db.sitemapCategories.all().length} sitemap categories / ${db.sitemapBlogs.all().length} sitemap blogs, ${db.jobs.all().length} jobs`,
    );
  },
};
