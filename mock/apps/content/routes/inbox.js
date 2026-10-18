// Contact form submissions, client reviews and the dashboard analytics (GET /analytics/dashboard).
const { send, fail, paginate, byNewest, matches, toId, bool, reqLang, tr, nowIso, seeded } = require("../lib");

const STATUSES = ["new", "replied"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Card labels in the dashboard languages (HomeCards shows `label`/`unit` as sent).
const T = {
  en: { replied: ["Replied Contacts", "contacts"], visitors: ["Website Visitors", "visits this month"], waiting: ["New Contacts", "awaiting reply"], blogs: ["Published Blogs", "posts"] },
  de: { replied: ["Beantwortete Kontakte", "Kontakte"], visitors: ["Website-Besuche", "Besuche diesen Monat"], waiting: ["Neue Kontakte", "warten auf Antwort"], blogs: ["Veröffentlichte Blogs", "Beiträge"] },
  fr: { replied: ["Contacts traités", "contacts"], visitors: ["Visites du site", "visites ce mois-ci"], waiting: ["Nouveaux contacts", "en attente de réponse"], blogs: ["Articles publiés", "articles"] },
  it: { replied: ["Contatti gestiti", "contatti"], visitors: ["Visite al sito", "visite questo mese"], waiting: ["Nuovi contatti", "in attesa di risposta"], blogs: ["Blog pubblicati", "articoli"] },
};
const LOCALE = { en: "en-US", de: "de-CH", fr: "fr-CH", it: "it-CH" };

// Last 12 months of visits (deterministic), current month last.
function monthlyVisits(lang, now = new Date()) {
  const rnd = seeded(20260929);
  const season = [0.86, 0.9, 1.02, 1.05, 1.08, 1.0, 0.82, 0.78, 1.1, 1.14, 1.06, 0.94]; // Jan..Dec
  const out = [];
  for (let k = 11; k >= 0; k--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - k, 1));
    const m = d.getUTCMonth();
    const trend = 1 + (11 - k) * 0.012;
    const previousYear = Math.round(31000 * season[m] * (0.95 + rnd.rnd() * 0.1));
    const currentYear = Math.round(previousYear * (1.16 + rnd.rnd() * 0.08) * trend);
    out.push({ month: d.toLocaleString(LOCALE[lang] || "en-CH", { month: "short", timeZone: "UTC" }), year: d.getUTCFullYear(), currentYear, previousYear });
  }
  return out;
}

const pct = (a, b) => (b ? Math.round(((a - b) / b) * 1000) / 10 : a ? 100 : 0);
const share = (n, total) => (total ? Math.round((n / total) * 1000) / 10 : 0);

function registerInbox(r, deps) {
  const { getDb, views, common } = deps;
  const { optionalUser, requireEditor, checker, notFound } = common;

  // ---------------------------------------------------------------- contacts
  r.get("/contacts", requireEditor, (req, res) => {
    const status = String(req.query.status || "");
    const list = getDb().contacts.all()
      .filter((c) => (!status || c.status === status))
      .filter((c) => matches(req.query.search, `${c.firstName} ${c.lastName}`, c.email, c.companyName, c.phoneNumber, c.subject, c.message))
      .sort(byNewest);
    const { items, meta } = paginate(list, req.query, 10);
    send(res, { items: items.map(views.contact), meta }, "Contacts fetched successfully");
  });

  r.get("/contacts/:id", requireEditor, (req, res) => {
    const c = getDb().contacts.find(req.params.id);
    if (!c) return notFound(res, "Contact");
    send(res, views.contactDetail(c), "Contact fetched successfully");
  });

  // The website's contact form posts here (no login needed).
  r.post("/contacts", optionalUser, (req, res) => {
    const b = req.body || {};
    const v = checker();
    v.required("firstName", b.firstName, "First name");
    v.required("lastName", b.lastName, "Last name");
    v.required("email", b.email, "Email");
    if (b.email && !EMAIL_RE.test(String(b.email).trim())) v.add("email", "Invalid email");
    v.required("message", b.message, "Message");
    const db = getDb();
    const serviceId = toId(b.serviceId);
    const subServiceId = toId(b.subServiceId);
    if (serviceId != null && !db.services.find(serviceId)) v.add("serviceId", "Service not found");
    if (subServiceId != null && !db.subServices.find(subServiceId)) v.add("subServiceId", "Sub-service not found");
    if (!v.ok()) return v.send(res);
    const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "127.0.0.1").split(",")[0].trim().replace(/^::ffff:/, "").replace(/^::1$/, "127.0.0.1");
    const row = db.contacts.insert({
      firstName: String(b.firstName).trim(), lastName: String(b.lastName).trim(), companyName: String(b.companyName || "").trim(),
      email: String(b.email).trim(), phoneNumber: String(b.phoneNumber || "").trim(), subject: b.subject ? String(b.subject).trim() : null,
      message: String(b.message).trim(), serviceId, subServiceId: subServiceId ?? null, status: "new", ipAddress: ip,
      // The dashboard's call-summary form needs an owner; new enquiries go to the website team until someone takes them.
      customerServiceName: req.user ? `${req.user.firstName} ${req.user.lastName}` : "Website Team",
      notes: null, source: req.user ? "dashboard" : "website-contact-form",
    });
    send(res, views.contactDetail(row), "Your message has been sent successfully", 201);
  });

  const updateContact = (req, res) => {
    const db = getDb();
    const c = db.contacts.find(req.params.id);
    if (!c) return notFound(res, "Contact");
    const b = req.body || {};
    const patch = {};
    if (b.status !== undefined) {
      if (!STATUSES.includes(b.status)) return fail(res, 400, "status must be one of new, replied", { status: ["status must be one of new, replied"] });
      patch.status = b.status;
    }
    if (b.customerServiceName !== undefined) patch.customerServiceName = String(b.customerServiceName || "").trim() || c.customerServiceName;
    if (b.notes !== undefined) patch.notes = b.notes === null ? null : String(b.notes);
    for (const k of ["firstName", "lastName", "companyName", "email", "phoneNumber", "subject", "message"]) if (b[k] !== undefined) patch[k] = String(b[k]);
    send(res, views.contactDetail(db.contacts.update(c.id, patch)), "Contact updated successfully");
  };
  r.patch("/contacts/:id", requireEditor, updateContact);
  r.put("/contacts/:id", requireEditor, updateContact);

  r.patch("/contacts/:id/status", requireEditor, (req, res) => {
    const db = getDb();
    const c = db.contacts.find(req.params.id);
    if (!c) return notFound(res, "Contact");
    const status = req.body?.status;
    if (!STATUSES.includes(status)) return fail(res, 400, "status must be one of new, replied", { status: ["status must be one of new, replied"] });
    send(res, views.contactDetail(db.contacts.update(c.id, { status })), "Status updated successfully");
  });

  r.delete("/contacts/:id", requireEditor, (req, res) => {
    const c = getDb().contacts.remove(req.params.id);
    if (!c) return notFound(res, "Contact");
    send(res, { id: c.id }, "Contact deleted successfully");
  });

  // ---------------------------------------------------------------- reviews
  function reviewFields(b, row = {}) {
    return {
      clientName: b.clientName !== undefined ? String(b.clientName).trim() : row.clientName,
      clientTitle: b.clientTitle !== undefined ? String(b.clientTitle).trim() : (row.clientTitle ?? ""),
      reviewContent: b.reviewContent !== undefined ? String(b.reviewContent).trim() : row.reviewContent,
      rate: b.rate !== undefined ? Number(b.rate) : row.rate,
      isPublic: b.isPublic !== undefined ? bool(b.isPublic) : (row.isPublic ?? false),
    };
  }
  const validateReview = (v, f) => {
    v.required("clientName", f.clientName, "Client name");
    v.required("reviewContent", f.reviewContent, "Review");
    if (!Number.isInteger(f.rate) || f.rate < 1 || f.rate > 5) v.add("rate", "Rating must be a whole number from 1 to 5");
  };

  r.get("/reviews", optionalUser, (req, res) => {
    const pub = req.query.isPublic;
    const list = getDb().reviews.all()
      .filter((x) => (pub === undefined || pub === "" || x.isPublic === bool(pub)))
      .filter((x) => matches(req.query.search, x.clientName, x.clientTitle, x.reviewContent))
      .sort(byNewest);
    const { items, meta } = paginate(list, req.query, 10);
    send(res, { items: items.map(views.review), meta }, "Reviews fetched successfully");
  });
  r.get("/reviews/:id", optionalUser, (req, res) => {
    const x = getDb().reviews.find(req.params.id);
    if (!x) return notFound(res, "Review");
    send(res, views.review(x), "Review fetched successfully");
  });
  r.post("/reviews", requireEditor, (req, res) => {
    const f = reviewFields(req.body || {}, { rate: 5, isPublic: true });
    const v = checker();
    validateReview(v, f);
    if (!v.ok()) return v.send(res);
    send(res, views.review(getDb().reviews.insert(f)), "Review created successfully", 201);
  });
  const updateReview = (req, res) => {
    const db = getDb();
    const x = db.reviews.find(req.params.id);
    if (!x) return notFound(res, "Review");
    const f = reviewFields(req.body || {}, x);
    const v = checker();
    validateReview(v, f);
    if (!v.ok()) return v.send(res);
    const msg = Object.keys(req.body || {}).length === 1 && req.body.isPublic !== undefined ? (f.isPublic ? "Review is now public" : "Review is now hidden") : "Review updated successfully";
    send(res, views.review(db.reviews.update(x.id, f)), msg);
  };
  r.patch("/reviews/:id", requireEditor, updateReview);
  r.put("/reviews/:id", requireEditor, updateReview);
  r.delete("/reviews/:id", requireEditor, (req, res) => {
    const x = getDb().reviews.remove(req.params.id);
    if (!x) return notFound(res, "Review");
    send(res, { id: x.id }, "Review deleted successfully");
  });

  // ---------------------------------------------------------------- analytics (Overview page)
  r.get("/analytics/dashboard", requireEditor, (req, res) => {
    const lang = reqLang(req);
    const t = T[lang] || T.en;
    const db = getDb();
    const now = Date.now();
    const age = (d) => now - new Date(d).getTime();
    const thisMonth = (d) => age(d) <= 30 * 864e5;
    const lastMonth = (d) => age(d) > 30 * 864e5 && age(d) <= 60 * 864e5;

    const contacts = db.contacts.all();
    const replied = contacts.filter((c) => c.status === "replied");
    const waiting = contacts.filter((c) => c.status === "new");
    const blogs = db.blogs.all();
    const published = blogs.filter((b) => b.visibility);
    const visits = monthlyVisits(lang, new Date(now));
    const [prevMonth, curMonth] = visits.slice(-2);

    const card = ([label, unit], value, cur, prev, icon) => ({ label, value, unit, changeFromLastMonth: cur - prev, percentageChange: pct(cur, prev), icon });
    const stats = [
      card(t.replied, replied.length, replied.filter((c) => thisMonth(c.updatedAt)).length, replied.filter((c) => lastMonth(c.updatedAt)).length, "check-circle"),
      card(t.visitors, curMonth.currentYear.toLocaleString(LOCALE[lang]), curMonth.currentYear, prevMonth.currentYear, "users"),
      card(t.waiting, waiting.length, waiting.filter((c) => thisMonth(c.createdAt)).length, waiting.filter((c) => lastMonth(c.createdAt)).length, "clock"),
      card(t.blogs, published.length, published.filter((b) => thisMonth(b.createdAt)).length, published.filter((b) => lastMonth(b.createdAt)).length, "file-text"),
    ];

    const services = db.services.all().sort((a, b) => a.order - b.order);
    const topServices = services
      .map((s) => ({ id: s.id, name: tr(s.title, lang), contactCount: contacts.filter((c) => c.serviceId === s.id).length }))
      .map((s) => ({ ...s, percentage: share(s.contactCount, contacts.length) }))
      .sort((a, b) => b.contactCount - a.contactCount);

    const fallbackImage = { id: 0, url: `${views.apiBase()}/seed-assets/orgtik-mark-black.svg`, alt: "OrgTik" };
    const topBlogs = [...published].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 5)
      .map((b) => ({ id: b.id, title: tr(b.title, lang), views: b.views || 0, featureImage: views.imageRef(b.featureImageId) || fallbackImage }));

    const totalViews = published.reduce((sum, b) => sum + (b.views || 0), 0);
    const blogViewsByService = services
      .map((s) => ({ serviceId: s.id, serviceName: tr(s.title, lang), viewCount: published.filter((b) => b.serviceId === s.id).reduce((sum, b) => sum + (b.views || 0), 0) }))
      .filter((s) => s.viewCount > 0)
      .map((s) => ({ ...s, percentage: share(s.viewCount, totalViews) }))
      .sort((a, b) => b.viewCount - a.viewCount);

    send(res, { stats, monthlyVisits: visits, topServices, topBlogs, blogViewsByService, generatedAt: nowIso() }, "Dashboard analytics fetched successfully");
  });
}

module.exports = { registerInbox, monthlyVisits };
