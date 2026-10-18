// Seed data for the task-manager mock: an Egypt/GCC software agency ("Orgtik") running client
// projects for Nile Foods, Delta Pharma, Gulf Retail, Riyadh Health Clinics plus internal work.
// All dates are relative to "today" so the screens always look current.
const DAY = 864e5;
const HOUR = 36e5;

function buildSeed({ files, identity, empty = false, seedAt }) {
  const now = seedAt ? Date.parse(seedAt) : Date.now();
  const today0 = new Date(now); today0.setHours(0, 0, 0, 0);
  const at = (d, h = 10, m = 0) => new Date(today0.getTime() + d * DAY + h * HOUR + m * 6e4).toISOString();
  const past = (iso, minAgoMs = 6e4) => new Date(Math.min(new Date(iso).getTime(), now - minAgoMs)).toISOString();
  const hoursAgo = (h) => new Date(now - h * HOUR).toISOString();
  const plus = (iso, ms) => new Date(new Date(iso).getTime() + ms).toISOString();

  const db = {
    teams: [], bookmarks: [], projects: [], sections: [], tasks: [], subtasks: [], attachments: [],
    comments: [], activities: [], notifications: [], conversations: [], messages: [], myOrder: {},
    seq: {},
  };
  const start = { team: 1, bookmark: 1, project: 1, section: 11, task: 1001, subtask: 2001, attachment: 301, comment: 501, activity: 5001, notification: 9001, conversation: 1, message: 1, assignment: 7001 };
  const nextId = (kind) => {
    if (db.seq[kind] == null) db.seq[kind] = start[kind] || 1;
    return db.seq[kind]++;
  };
  db.nextId = nextId;
  if (empty) return db;

  // ---------------- teams ----------------
  const TEAMS = [
    ["Frontend Squad", "FE", "Owns the web front-ends: Next.js storefronts, admin dashboards and the shared design-system component library.", [3, 8, 9, 15], true, -380],
    ["Backend & APIs", "BE", "NestJS services and integrations with ERPs and payment gateways (SAP B1, Paymob, Fawry, HyperPay).", [7, 11, 9, 2], true, -372],
    ["Product Design", "UX", "Research, UX flows, UI design and prototyping in Figma for client and internal products.", [8, 3, 12, 15], true, -360],
    ["QA & Release", "QA", "Test plans, automated regression with Playwright, UAT coordination and release sign-off.", [9, 7, 11], true, -300],
    ["DevOps & Cloud", "OPS", "CI/CD, Kubernetes, monitoring and the Azure/AWS infrastructure behind every client environment.", [11, 7], true, -290],
    ["Content & Growth", "GRW", "Bilingual copywriting (EN/AR), SEO, campaigns and go-to-market support for launches.", [12, 14, 4, 13], true, -210],
    ["Client Success", "CS", "Account management, onboarding, weekly status reports and change requests for all clients.", [13, 4, 2], true, -180],
    ["Mobile Guild", "MOB", "Flutter / React Native practice — paused until Q1 2027, members moved to the Frontend Squad.", [3, 7], false, -330],
  ];
  for (const [name, alias, description, memberIds, isActive, created] of TEAMS) {
    const id = nextId("team");
    db.teams.push({ id, name, alias, description, memberIds: [...memberIds], isActive, teamImage: files.teamFile(id), createdById: 1, createdAt: at(created, 9), updatedAt: at(Math.min(created + 40, -3), 12) });
  }
  const BOOKMARKS = {
    1: [["Design System Storybook", "Components, tokens and usage guidelines for all Orgtik web projects", "https://storybook.orgtik.test", 0], ["Frontend Release Checklist", "Pre-release QA steps, Lighthouse budgets and RTL checks", "https://wiki.orgtik.test/frontend/release-checklist", 1], ["Nile Foods Staging", "Storefront staging (credentials in 1Password)", "https://staging.nilefoods.test", 0]],
    2: [["API Guidelines", "REST conventions, error envelopes and pagination", "https://wiki.orgtik.test/backend/api-guidelines", 2], ["SAP B1 Service Layer notes", "Delta Pharma ERP integration notes and sample payloads", "https://wiki.orgtik.test/integrations/sap-b1", 1]],
    3: [["Figma — Client Projects", "All design files organised by client", "https://figma.orgtik.test/files/client-projects", 0], ["UX Research Repository", "Interview notes and personas (Nile Foods, Gulf Retail)", "https://wiki.orgtik.test/ux/research", 3]],
    4: [["Test Plans", "Playwright suites and manual regression sheets", "https://wiki.orgtik.test/qa/test-plans", 2], ["Bug Triage Board", "Daily triage at 10:30 Cairo time", "https://wiki.orgtik.test/qa/triage", 0]],
    5: [["Grafana", "Production dashboards for every client environment", "https://grafana.orgtik.test", 0], ["On-call Runbooks", "Incident response and escalation matrix", "https://wiki.orgtik.test/ops/runbooks", 4]],
    6: [["Brand Guidelines 2026", "Logo, colours and tone of voice (EN/AR)", "https://wiki.orgtik.test/brand", 2], ["Content Calendar Q4", "Blog, LinkedIn and newsletter schedule", "https://wiki.orgtik.test/marketing/content-calendar", 1]],
    7: [["Weekly Status Report Template", "Report format used for every account", "https://wiki.orgtik.test/cs/status-report", 1], ["Change Request Log", "CRs per client with approval status", "https://wiki.orgtik.test/cs/change-requests", 0]],
    8: [["Flutter Starter Kit", "Archived — see Frontend Squad", "https://wiki.orgtik.test/mobile/flutter-starter", 0]],
  };
  for (const [teamId, list] of Object.entries(BOOKMARKS)) {
    list.forEach(([title, description, link, attachmentCount], i) => {
      const team = db.teams.find((t) => t.id === Number(teamId));
      const created = plus(team.createdAt, (i + 2) * 5 * DAY);
      db.bookmarks.push({ id: nextId("bookmark"), teamId: Number(teamId), title, description, link, attachmentCount, attachments: [], createdById: team.memberIds[0], createdAt: past(created), updatedAt: past(created) });
    });
  }

  // ---------------- projects & sections ----------------
  const STD = [["BACKLOG", "backlog", "#6B7280"], ["TODO", "todo", "#3B82F6"], ["IN_PROGRESS", "in_progress", "#F59E0B"], ["IN_REVIEW", "in_review", "#8B5CF6"], ["DONE", "done", "#10B981"]];
  const PROJECTS = [
    { key: "nile", title: "Nile Foods E-commerce Revamp", description: "Headless storefront, B2B ordering portal and Paymob/Fawry checkout for Nile Foods' 1,200+ retail partners across Egypt.", priority: "high", status: "in_progress", isPrivate: false, members: [2, 3, 7, 8, 9, 11, 13, 5], teams: [1, 2, 3], by: 2, created: -76 },
    { key: "delta", title: "Delta Pharma Field Sales CRM", description: "Offline-first CRM for 350 medical reps: visit planning, sample tracking and SAP Business One sync.", priority: "urgent", status: "in_progress", isPrivate: false, members: [15, 7, 3, 9, 11, 4, 8], teams: [2, 4, 5], by: 15, created: -121,
      extra: [["UAT_WITH_CLIENT", "in_review", "#EC4899", 5]] },
    { key: "gulf", title: "Gulf Retail Loyalty App", description: "Points, tiers and personalised offers for Gulf Retail's 40 stores in KSA & UAE — React Native app plus admin console.", priority: "medium", status: "in_progress", isPrivate: false, members: [15, 8, 3, 9, 12, 13, 7], teams: [1, 3], by: 15, created: -47 },
    { key: "web", title: "Orgtik Website 2026 Relaunch", description: "New bilingual (EN/AR) marketing site with case studies, careers page and HubSpot lead capture.", priority: "medium", status: "todo", isPrivate: false, members: [2, 12, 14, 8, 3], teams: [6, 3], by: 2, created: -22 },
    { key: "riyadh", title: "Riyadh Health Clinics Booking Portal", description: "Patient self-booking, doctor schedules and SMS reminders for 12 clinics — delivered, now in the warranty period.", priority: "high", status: "done", isPrivate: false, members: [2, 7, 3, 9, 13], teams: [2, 4], by: 2, created: -212 },
    { key: "cloud", title: "Cloud Migration to Azure UAE North", description: "Move client workloads from the Cairo data centre to Azure UAE North with a zero-downtime cut-over and Terraform IaC.", priority: "high", status: "in_progress", isPrivate: false, members: [11, 7, 15, 1], teams: [5], by: 15, created: -61 },
    { key: "strategy", title: "Orgtik 2027 Strategy & Budget", description: "Confidential — pricing model, hiring plan and 2027 budget for the board. Management only.", priority: "urgent", status: "in_progress", isPrivate: true, members: [1, 2, 15], teams: [], by: 1, created: -15 },
    { key: "pos", title: "Gulf Retail POS Integration — Phase 2", description: "Real-time sync between Oracle Xstore POS and the loyalty engine; scoping and estimate awaiting client sign-off.", priority: "low", status: "todo", isPrivate: false, members: [15, 7, 11, 13], teams: [2], by: 15, created: -9 },
  ];
  const P = {}; // key -> project
  const S = {}; // `${projectKey}:${flag}` -> section (first with that flag) ; `${key}:uat`
  for (const p of PROJECTS) {
    const id = nextId("project");
    const created = at(p.created, 9, 30);
    const project = { id, title: p.title, description: p.description, priority: p.priority, status: p.status, isPrivate: p.isPrivate, memberIds: [...p.members], teamIds: [...p.teams], createdById: p.by, createdAt: created, updatedAt: created };
    db.projects.push(project);
    P[p.key] = project;
    const list = STD.map(([title, flag, color], i) => ({ title, flag, color, order: i + 1 }));
    for (const [title, flag, color, order] of p.extra || []) {
      list.forEach((s) => { if (s.order >= order) s.order += 1; });
      list.push({ title, flag, color, order, custom: true });
    }
    list.sort((a, b) => a.order - b.order);
    for (const s of list) {
      const sec = { id: nextId("section"), projectId: id, title: s.title, color: s.color, flag: s.flag, order: s.order, createdAt: created, updatedAt: created };
      db.sections.push(sec);
      if (s.custom) S[`${p.key}:uat`] = sec;
      else if (!S[`${p.key}:${s.flag}`]) S[`${p.key}:${s.flag}`] = sec;
    }
    const arch = { id: nextId("section"), projectId: id, title: "ARCHIVE", color: "#9CA3AF", flag: "archive", order: 99, createdAt: created, updatedAt: created };
    db.sections.push(arch);
    S[`${p.key}:archive`] = arch;
  }

  // ---------------- tasks ----------------
  // [project, section, key, { title, desc, pri, who, by, created, start, due, doneAt, moved, progress, subs, deps, files, time, status }]
  const T = [
    ["nile", "done", "discovery", { title: "Discovery workshop with Nile Foods marketing", desc: "Run a 2-day discovery workshop with @[5] and the trade-marketing team. Output: personas, B2B ordering pain points and success KPIs.", pri: "high", who: [2, 8], by: 2, created: -75, start: -73, due: -70, doneAt: -69, subs: [["Prepare workshop agenda", 1], ["Interview 6 retail partners", 1], ["Share workshop summary with the client", 1]], files: ["discovery_pdf"] }],
    ["nile", "done", "ia", { title: "Information architecture & sitemap", desc: "Catalogue structure for 1,800 SKUs, the B2B account area and Arabic RTL navigation.", pri: "medium", who: [8], by: 2, created: -68, start: -66, due: -58, doneAt: -57, subs: [["Card sorting with 8 retailers", 1], ["Sitemap v2 (EN/AR)", 1]], files: ["sitemap_svg"] }],
    ["nile", "done", "tokens", { title: "Design system tokens (EN/AR)", desc: "Colour, typography (IBM Plex Sans Arabic + Inter) and spacing tokens synced to the Tailwind config.", pri: "medium", who: [8, 3], by: 2, created: -52, start: -50, due: -40, doneAt: -39, subs: [["Colour & typography tokens", 1], ["RTL spacing utilities", 1], ["Publish to Storybook", 1]] }],
    ["nile", "done", "staging", { title: "Staging environment & seed data", desc: "Staging on AKS with an anonymised catalogue (1,800 SKUs) and 50 test partner accounts.", pri: "medium", who: [11], by: 2, created: -58, start: -56, due: -50, doneAt: -49 }],
    ["nile", "done", "megamenu", { title: "Mega menu & category navigation", desc: "Three-level category navigation with brand filters; keyboard accessible and mirrored for Arabic.", pri: "medium", who: [3], by: 2, created: -20, start: -12, due: -2, doneAt: -2, subs: [["Desktop mega menu", 1], ["Mobile drawer navigation", 1], ["Arabic RTL mirroring", 1]] }],
    ["nile", "in_review", "checkout", { title: "Checkout flow with Paymob & Fawry", desc: "Multi-step checkout: address book, delivery slots, Paymob card payments (3DS) and Fawry reference codes. Spec: https://wiki.orgtik.test/nile-foods/checkout", pri: "urgent", who: [3, 7], by: 2, created: -30, start: -21, due: 1, moved: -1, subs: [["Address book & delivery slots", 1], ["Paymob iframe + 3DS redirect", 1], ["Fawry reference code flow", 1], ["Order confirmation email & SMS", 0], ["Edge cases: declined card, 3DS timeout", 0]], deps: ["orders"], files: ["checkout_svg", "orders_json"] }],
    ["nile", "in_review", "cdn", { title: "Product image CDN & lazy loading", desc: "Move product images to Azure Blob + CDN, generate WebP/AVIF variants and lazy-load below the fold.", pri: "medium", who: [11, 3], by: 2, created: -18, start: -12, due: -2, moved: -3, subs: [["Blob storage + CDN profile", 1], ["WebP/AVIF generation", 1], ["Lazy loading on PLP", 0]] }],
    ["nile", "in_progress", "orders", { title: "Orders API v2 (NestJS)", desc: "REST endpoints for carts, orders and invoices with idempotency keys for payment callbacks. @[9] please prepare the Postman collection for regression.", pri: "high", who: [7], by: 2, created: -24, start: -14, due: 2, subs: [["Cart & order endpoints", 1], ["Payment callback idempotency", 1], ["Invoice PDF (ETA e-invoice)", 0], ["Rate limiting per partner", 0]], files: ["orders_json"] }],
    ["nile", "in_progress", "bulk", { title: "B2B bulk ordering (CSV upload)", desc: "Retail partners upload a CSV of SKUs and quantities; validate stock and tiered pricing, then convert it to a draft order.", pri: "high", who: [3], by: 2, created: -16, start: -8, due: 4, subs: [["CSV parser & validation", 1], ["Stock check against the ERP", 0], ["Draft order review screen", 0]], files: ["bulk_csv"] }],
    ["nile", "in_progress", "rtl", { title: "Arabic RTL QA pass on PLP & PDP", desc: "Check mirrored layouts, Arabic-Indic numerals (١٢٣ vs 123), EGP price formatting and truncation on the product listing and detail pages.", pri: "medium", who: [9, 8], by: 2, created: -6, start: -3, due: 0, subs: [["Product listing page", 1], ["Product detail page", 0], ["Cart drawer", 0]], files: ["rtl_png"], time: ["10:00", "12:30"] }],
    ["nile", "todo", "report14", { title: "Weekly status report — Sprint 14", desc: "Prepare the sprint 14 report for @[5]: burndown, risks (ERP stock API latency) and next sprint scope.", pri: "medium", who: [13, 2], by: 2, created: -4, start: -2, due: -1, files: ["burndown_csv"] }],
    ["nile", "todo", "banner", { title: "Loyalty points banner on homepage", desc: "Show the partner tier and points balance from the loyalty service; hide it for guest users.", pri: "low", who: [3], by: 2, created: -9, start: 5, due: 9 }],
    ["nile", "todo", "lighthouse", { title: "Performance budget & Lighthouse CI", desc: "Target LCP < 2.5s on 4G for Cairo and Alexandria. Add Lighthouse CI to the pipeline and fail PRs that exceed the budget.", pri: "medium", who: [7, 3], by: 2, created: -7, start: 6, due: 12, deps: ["orders"] }],
    ["nile", "backlog", "wishlist", { title: "Wishlist & reorder from past orders", desc: "Let partners save shopping lists and reorder a previous order in one click.", pri: "low", who: [], by: 2, created: -40, start: 20, due: 30 }],
    ["nile", "backlog", "whatsapp", { title: "WhatsApp order notifications", desc: "Order status updates through the WhatsApp Business API — template approval from Meta needed first.", pri: "medium", who: [7], by: 2, created: -35, start: 25, due: 40 }],
    ["nile", "archive", "magento", { title: "Legacy Magento data export", desc: "Export customers and orders from Magento 1.9 — superseded by the direct ERP sync.", pri: "low", who: [7], by: 2, created: -70, start: -69, due: -60, status: "done", doneAt: -61 }],
    ["nile", "archive", "catalogue", { title: "Print catalogue PDF (cancelled)", desc: "Client decided to drop the printed catalogue for 2026.", pri: "low", who: [8], by: 2, created: -65, start: -60, due: -45, status: "todo" }],

    ["delta", "done", "offline", { title: "Offline sync architecture (SQLite + delta sync)", desc: "Reps work in areas with poor coverage (Upper Egypt). Design conflict resolution for visits and sample movements.", pri: "urgent", who: [7, 15], by: 15, created: -115, start: -112, due: -60, doneAt: -62, subs: [["Conflict resolution rules", 1], ["Delta hash protocol", 1], ["Load test with 350 devices", 1]], files: ["crm_svg"] }],
    ["delta", "done", "sap", { title: "SAP Business One integration spike", desc: "Validate the Service Layer API for customers, items and stock per warehouse.", pri: "high", who: [7], by: 15, created: -100, start: -98, due: -45, doneAt: -44 }],
    ["delta", "done", "mdm", { title: "MDM enrolment for 350 Android devices", desc: "Intune enrolment profiles and kiosk mode for the CRM app on Samsung Tab A8 devices.", pri: "high", who: [11], by: 15, created: -30, start: -20, due: -4, doneAt: -3 }],
    ["delta", "done", "login", { title: "Login & device binding", desc: "Bind each rep account to one managed device; remote wipe on termination.", pri: "high", who: [3, 7], by: 15, created: -40, start: -26, due: -6, doneAt: -6, subs: [["Device binding API", 1], ["Remote wipe hook", 1]] }],
    ["delta", "uat", "visits", { title: "Visit planning calendar", desc: "Weekly route planning with doctor/pharmacy targets and approvals by area managers.", pri: "high", who: [3, 8], by: 15, created: -50, start: -35, due: 3, moved: -3, subs: [["Week view with drag & drop", 1], ["Manager approvals", 1], ["Pharmacy names in week view", 1], ["Configurable low-stock threshold", 0]], files: ["uat_pdf"] }],
    ["delta", "uat", "samples", { title: "Sample stock tracking per rep", desc: "Track sample allocation and returns; alert when stock drops below 10 units.", pri: "medium", who: [7, 9], by: 15, created: -44, start: -30, due: 5, moved: -2, progress: 85 }],
    ["delta", "in_review", "dashboard", { title: "Rep performance dashboard", desc: "KPIs: visits per day, coverage %, samples per call. Filters by area (Cairo, Delta, Upper Egypt).", pri: "high", who: [3], by: 15, created: -21, start: -10, due: 2, moved: -1, deps: ["offline"], files: ["dashboard_png"] }],
    ["delta", "in_progress", "push", { title: "Push notifications for approvals", desc: "FCM notifications when a manager approves or rejects a visit plan.", pri: "medium", who: [7], by: 15, created: -12, start: -5, due: 6, progress: 40 }],
    ["delta", "in_progress", "reports", { title: "Arabic/English PDF call reports", desc: "Generate bilingual PDF call reports with the Delta Pharma letterhead.", pri: "medium", who: [3, 9], by: 15, created: -14, start: -9, due: -3, subs: [["PDF template (EN/AR)", 1], ["Signature capture", 0]] }],
    ["delta", "in_progress", "pentest", { title: "Penetration test fixes (OWASP MASVS)", desc: "Fix the findings from the external pentest: certificate pinning, root detection and token storage.", pri: "urgent", who: [11, 7], by: 15, created: -8, start: -6, due: 1, subs: [["Certificate pinning", 1], ["Encrypted token storage", 1], ["Root detection hardening", 0]], files: ["pentest_pdf"] }],
    ["delta", "todo", "regression", { title: "Regression suite in Playwright", desc: "Automate the 60 critical paths and run them nightly on staging.", pri: "high", who: [9], by: 15, created: -10, start: 3, due: 10 }],
    ["delta", "todo", "territories", { title: "Data migration from Excel territories", desc: "Import 14 territory spreadsheets (4,200 doctors) with de-duplication rules.", pri: "medium", who: [7], by: 15, created: -11, start: 2, due: 8 }],
    ["delta", "backlog", "leaderboard", { title: "Rep gamification leaderboard", desc: "Monthly leaderboard for reps — pending HR approval on Delta Pharma's side.", pri: "low", who: [], by: 15, created: -60, start: 30, due: 45 }],
    ["delta", "archive", "ios", { title: "iOS version (descoped)", desc: "Client standardised on Android devices; the iOS build was descoped in CR-07.", pri: "low", who: [3], by: 15, created: -110, start: -105, due: -80, status: "backlog" }],

    ["gulf", "done", "tiers", { title: "Loyalty tiers & rules engine design", desc: "Silver/Gold/Platinum tiers, points expiring after 12 months and double-points campaigns.", pri: "high", who: [15, 8], by: 15, created: -44, start: -42, due: -25, doneAt: -5, subs: [["Tier thresholds", 1], ["Expiry rules", 1]] }],
    ["gulf", "in_review", "balance", { title: "Points balance & history screen", desc: "Balance card with tier progress and a paginated history of earned/redeemed points.", pri: "medium", who: [8, 9], by: 15, created: -20, start: -10, due: 1, moved: -1 }],
    ["gulf", "in_review", "a11y", { title: "Accessibility audit (WCAG 2.1 AA)", desc: "Contrast, dynamic type and screen-reader labels — including Arabic VoiceOver labels.", pri: "medium", who: [9, 8], by: 15, created: -15, start: -7, due: -1, moved: -2, subs: [["Contrast fixes", 1], ["VoiceOver labels (AR)", 0]] }],
    ["gulf", "in_progress", "otp", { title: "Onboarding & OTP login (KSA/UAE numbers)", desc: "Phone OTP via Unifonic, Arabic-first onboarding and PDPL-compliant consent screens.", pri: "high", who: [3, 8], by: 15, created: -26, start: -12, due: 3, subs: [["Welcome & language picker", 1], ["OTP for +966 / +971", 1], ["PDPL consent screen", 0], ["Favourite categories picker", 0]], files: ["onboarding_svg"] }],
    ["gulf", "in_progress", "offers", { title: "Offers feed with personalisation", desc: "Rank offers by basket history and A/B test two layouts.", pri: "medium", who: [3], by: 15, created: -18, start: -4, due: 7, subs: [["Offers API contract", 1], ["Card layout A", 0], ["Card layout B", 0]] }],
    ["gulf", "todo", "locator", { title: "Store locator with maps", desc: "40 stores with filters by city (Riyadh, Jeddah, Dubai, Sharjah) and opening hours including Ramadan timings.", pri: "medium", who: [3], by: 15, created: -12, start: 8, due: 14 }],
    ["gulf", "todo", "campaigns", { title: "Admin console: campaign builder", desc: "Marketing can schedule double-points campaigns per store and category.", pri: "high", who: [7], by: 15, created: -12, start: 9, due: 18 }],
    ["gulf", "todo", "storecopy", { title: "App store listing copy (EN/AR)", desc: "Store listing, keywords and screenshot captions. نسخة عربية مطلوبة للمتجر السعودي.", pri: "low", who: [12], by: 15, created: -5, start: 12, due: 20 }],
    ["gulf", "backlog", "wallet", { title: "Apple Wallet / Google Wallet loyalty card", desc: "Add the loyalty card to the phone wallet with live points balance.", pri: "low", who: [], by: 15, created: -30, start: 40, due: 60 }],

    ["web", "done", "brand", { title: "Brand refresh approval", desc: "Board approval for the refreshed logo and colour palette.", pri: "high", who: [2, 8], by: 2, created: -21, start: -18, due: -5, doneAt: -4, files: ["brand_pdf", "logo_zip"] }],
    ["web", "in_progress", "wireframes", { title: "Homepage wireframes & hero concepts", desc: "Three hero directions: 'Built in Cairo, shipped to the Gulf', a case-study carousel and a product-led hero.", pri: "high", who: [8], by: 2, created: -12, start: -6, due: 2, progress: 60, files: ["homepage_svg"] }],
    ["web", "in_progress", "cases", { title: "Case studies: Nile Foods & Riyadh Health", desc: "Interview the clients and write 800-word case studies with metrics; Arabic versions after approval.", pri: "medium", who: [14, 12], by: 2, created: -10, start: -4, due: 6, subs: [["Interview Nile Foods", 1], ["Interview Riyadh Health", 0], ["First drafts", 0]] }],
    ["web", "todo", "careers", { title: "Careers page & hiring form", desc: "Job listings from Workable, a culture section and a bilingual application form.", pri: "medium", who: [3], by: 2, created: -9, start: 7, due: 15 }],
    ["web", "todo", "seo", { title: "SEO keyword research (Egypt & KSA)", desc: "Target keywords such as 'software company Cairo' and 'تطوير تطبيقات الرياض'.", pri: "medium", who: [12], by: 2, created: -8, start: 1, due: 9 }],
    ["web", "backlog", "blog", { title: "Blog migration from Medium", desc: "Move 38 posts with redirects and canonical tags.", pri: "low", who: [14], by: 2, created: -15, start: 20, due: 35 }],

    ["riyadh", "done", "slots", { title: "Doctor schedules & slot engine", desc: "Slot templates, holidays (Eid, National Day) and overbooking rules per clinic.", pri: "high", who: [7], by: 2, created: -205, start: -200, due: -150, doneAt: -152 }],
    ["riyadh", "done", "booking", { title: "Patient booking flow (Arabic-first)", desc: "Search by specialty, pick a doctor and slot, confirm with OTP.", pri: "high", who: [3], by: 2, created: -200, start: -180, due: -140, doneAt: -141 }],
    ["riyadh", "done", "sms", { title: "SMS reminders via Unifonic", desc: "Reminders 24h and 2h before the appointment, in the patient's language.", pri: "medium", who: [7], by: 2, created: -170, start: -150, due: -120, doneAt: -121 }],
    ["riyadh", "done", "golive", { title: "UAT & go-live", desc: "UAT with 3 pilot clinics, then go-live for all 12 clinics.", pri: "urgent", who: [9, 2], by: 2, created: -130, start: -110, due: -95, doneAt: -95, files: ["release_md"] }],
    ["riyadh", "in_review", "double", { title: "Warranty: fix double-booking edge case", desc: "Two patients could book the same slot when confirming within ~200 ms. Add a DB-level unique constraint and a friendly retry message.", pri: "high", who: [7, 9], by: 2, created: -6, start: -5, due: 2, moved: -1 }],
    ["riyadh", "todo", "uptime", { title: "Warranty: monthly uptime report — September", desc: "Send uptime (99.95%) and the incident summary to the client.", pri: "low", who: [13], by: 2, created: -3, start: 0, due: 1 }],
    ["riyadh", "archive", "insurance", { title: "Insurance eligibility check (moved to phase 2)", desc: "Tawuniya / Bupa eligibility API — moved to phase 2 by the client.", pri: "medium", who: [7], by: 2, created: -160, start: -150, due: -100, status: "todo" }],

    ["cloud", "done", "landing", { title: "Landing zone & Terraform modules", desc: "Hub-spoke network, policies and reusable Terraform modules for every client environment.", pri: "high", who: [11], by: 15, created: -58, start: -55, due: -30, doneAt: -2, subs: [["Hub-spoke VNet", 1], ["Azure Policy baseline", 1], ["Terraform module registry", 1]] }],
    ["cloud", "in_progress", "replication", { title: "Database replication (SQL Server → Azure SQL MI)", desc: "Log shipping for the Nile Foods ERP database; cut-over rehearsal on Thursday night (lowest traffic).", pri: "urgent", who: [11, 7], by: 15, created: -20, start: -10, due: 3, progress: 55, files: ["runbook_md"], time: ["23:00", "23:59"] }],
    ["cloud", "in_progress", "grafana", { title: "Monitoring with Grafana & alerts to Teams", desc: "Dashboards per client environment; alerts routed to the on-call channel in Microsoft Teams.", pri: "medium", who: [11], by: 15, created: -14, start: -3, due: 8, progress: 30 }],
    ["cloud", "todo", "cutover", { title: "Cut-over runbook & rollback plan", desc: "Step-by-step cut-over with go/no-go checkpoints and a tested rollback.", pri: "high", who: [11, 15], by: 15, created: -9, start: 4, due: 10, deps: ["replication"] }],
    ["cloud", "todo", "cost", { title: "Cost report & reserved instances", desc: "Compare pay-as-you-go vs 1-year reserved instances; target a 25% saving. Loop in @[1] for approval.", pri: "medium", who: [15, 1], by: 15, created: -7, start: 5, due: 12 }],
    ["cloud", "backlog", "dr", { title: "Disaster recovery drill (Q4)", desc: "Full DR drill with a documented RTO/RPO for every client.", pri: "medium", who: [11], by: 15, created: -40, start: 40, due: 50 }],

    ["strategy", "done", "q3review", { title: "Q3 financial review", desc: "Revenue per client, utilisation and cash-flow review for Q3.", pri: "high", who: [1], by: 1, created: -14, start: -12, due: -7, doneAt: -6 }],
    ["strategy", "in_progress", "budget", { title: "2027 budget draft", desc: "Headcount, cloud costs and the new Riyadh office. Figures in EGP and SAR.", pri: "urgent", who: [1, 2], by: 1, created: -12, start: -6, due: 5, progress: 50, files: ["budget_csv"] }],
    ["strategy", "todo", "pricing", { title: "Pricing model: retainer vs fixed-bid", desc: "Compare utilisation and margin for retainer vs fixed-bid engagements in Egypt and KSA.", pri: "high", who: [15, 2], by: 1, created: -10, start: 1, due: 9 }],
    ["strategy", "todo", "deck", { title: "Board presentation deck", desc: "12-slide deck for the board: 2026 results, 2027 plan and the Riyadh expansion.", pri: "urgent", who: [1], by: 1, created: -10, start: 10, due: 16, deps: ["budget", "pricing"] }],

    ["pos", "todo", "sow", { title: "Effort estimate & SOW draft", desc: "Estimate phase 2 and draft the SOW for Gulf Retail's procurement team.", pri: "high", who: [15, 13], by: 15, created: -8, start: 0, due: 4 }],
    ["pos", "backlog", "xstore", { title: "Xstore API discovery", desc: "Review Oracle Xstore POS APIs and the client's middleware options.", pri: "medium", who: [7], by: 15, created: -8, start: 14, due: 21 }],
    ["pos", "backlog", "eventbus", { title: "Event-driven sync design (Kafka vs Azure Service Bus)", desc: "Compare throughput, cost and ops overhead for real-time POS events.", pri: "medium", who: [11, 7], by: 15, created: -7, start: 20, due: 28 }],
  ];

  const K = {}; // key -> task
  const orderCounter = {};
  const knownFlags = ["backlog", "todo", "in_progress", "in_review", "done"];
  const pendingDeps = [];
  const pendingFiles = [];
  for (const [pk, sk, key, d] of T) {
    const project = P[pk];
    const section = S[`${pk}:${sk}`];
    orderCounter[section.id] = (orderCounter[section.id] || 0) + 1;
    const createdAt = past(at(d.created, 9 + (orderCounter[section.id] % 6), 15 * (orderCounter[section.id] % 4)));
    const status = d.status || (knownFlags.includes(section.flag) ? section.flag : "todo");
    const task = {
      id: nextId("task"), projectId: project.id, sectionId: section.id, order: orderCounter[section.id],
      title: d.title, description: d.desc, priority: d.pri, status, baseProgress: d.progress ?? null,
      startDate: at(d.start, 9), dueDate: at(d.due, 17), createdById: d.by, createdAt, updatedAt: createdAt,
      completedAt: status === "done" && d.doneAt != null ? past(at(d.doneAt, 15, 30)) : null,
      startTime: d.time ? d.time[0] : undefined, endTime: d.time ? d.time[1] : undefined,
      assignments: [], dependsOn: [], movedAt: null,
    };
    for (const uid of d.who) task.assignments.push({ id: nextId("assignment"), assigneeType: "user", assigneeId: uid, assignedById: d.by, assignedAt: plus(createdAt, 5 * 6e4) });
    if (status !== "backlog" && status !== "todo") {
      const movedDay = d.moved != null ? d.moved : status === "done" ? (d.doneAt ?? d.due) : d.start;
      task.movedAt = past(at(movedDay, 11, 20), 2 * HOUR);
      if (new Date(task.movedAt) < new Date(createdAt)) task.movedAt = plus(createdAt, HOUR);
    }
    db.tasks.push(task);
    K[key] = task;
    // Completed subtasks are spread between the task's start date and its completion (or now).
    const subs = d.subs || [];
    const doneCount = subs.filter(([, done]) => done).length;
    const workStart = Math.max(new Date(createdAt).getTime() + HOUR, new Date(task.startDate).getTime());
    const workEnd = Math.min(now - 3 * HOUR, task.completedAt ? new Date(task.completedAt).getTime() : now - 3 * HOUR);
    let k = 0;
    subs.forEach(([title, done], i) => {
      const created = past(plus(createdAt, (i + 1) * 3 * HOUR), (subs.length - i + 2) * HOUR);
      let completedAt = null;
      if (done) {
        k += 1;
        const t = workEnd > workStart ? workStart + ((workEnd - workStart) * k) / (doneCount + 1) : new Date(created).getTime() + k * HOUR;
        completedAt = past(new Date(Math.max(t, new Date(created).getTime() + 30 * 6e4)).toISOString(), (doneCount - k + 1) * 40 * 6e4);
      }
      db.subtasks.push({ id: nextId("subtask"), taskId: task.id, title, isCompleted: !!done, order: i + 1, createdById: d.by, createdAt: created, updatedAt: completedAt || created, completedAt, completedById: done ? (d.who[0] || d.by) : null });
    });
    if (d.deps) pendingDeps.push([task, d.deps]);
    if (d.files) pendingFiles.push([task, d.files, d.who[0] || d.by]);
  }
  for (const [task, deps] of pendingDeps) task.dependsOn = deps.map((k) => K[k].id);
  const addAttachment = (fileKey, owner, uploaderId, createdAt) => {
    const a = files.attachment(fileKey);
    const row = { id: nextId("attachment"), taskId: owner.taskId || null, commentId: owner.commentId || null, filename: a.file, originalName: a.originalName, mimetype: a.mimetype, size: a.size, uploadedById: uploaderId, createdAt };
    db.attachments.push(row);
    return row;
  };
  for (const [task, keys, uploader] of pendingFiles) {
    keys.forEach((k, i) => addAttachment(k, { taskId: task.id }, uploader, past(plus(task.createdAt, (i + 1) * 20 * HOUR), (8 - i) * HOUR)));
  }

  // ---------------- comments ----------------
  // [taskKey, author, hoursAgo, content, { reactions, files, replies: [[author, hoursAgo, content, {reactions}]] }]
  const C = [
    ["discovery", 2, 70 * 24, "Workshop summary shared with @[5] and the trade-marketing team. Personas are in section 2.", { files: ["discovery_pdf"], reactions: { like: [8, 5] } }],
    ["checkout", 2, 50, "@[3] @[7] the Paymob sandbox is ready. Please make sure we handle the 3DS redirect on mobile Safari — most Nile Foods partners order from iPhones.", { reactions: { like: [3, 7] },
      replies: [[3, 47, "Done on staging. The redirect now returns to /checkout/confirm with the order id.", { reactions: { like: [2] } }], [7, 45, "Callback endpoint is idempotent now (Idempotency-Key header). Duplicate callbacks from Paymob are ignored ✅", { reactions: { love: [2, 3] } }]] }],
    ["checkout", 5, 20, "Looks great! Can we also show the Fawry reference code in Arabic numerals? Many of our retailers prefer ١٢٣.", { reactions: { like: [8, 2] },
      replies: [[8, 18, "Good point @[5] — we'll show both formats on the confirmation screen and in the SMS.", {}]] }],
    ["checkout", 9, 3, "@[3] edge case: when a card is declined after 3DS the cart is emptied. Reproduced twice on staging with the Paymob test card 5123 4567 8901 2346.", { reactions: { wow: [3], like: [7] } }],
    ["orders", 7, 30, "Postman collection v2 is in the repo under /docs/postman. @[9] can you add the negative cases (expired session, invalid SKU)?", {
      replies: [[9, 26, "Added 18 negative cases — 2 failing: the invoice PDF returns 500 for orders with 0% VAT items.", { reactions: { sad: [7] } }], [7, 5, "Fixed the VAT rounding bug, deploying to staging tonight.", { reactions: { like: [9, 2] } }]] }],
    ["rtl", 9, 6, "PLP looks good. On the PDP the price and the 'Add to cart' button overlap in Arabic on small screens (iPhone SE). Screenshot attached.", { files: ["rtl_png"], reactions: { wow: [8] },
      replies: [[8, 4, "I'll update the PDP spacing tokens — @[3] please pick it up after my Figma update.", {}], [3, 1, "On it 👍", { reactions: { like: [8, 9] } }]] }],
    ["report14", 2, 28, "@[13] please include the ERP stock API latency risk and the Paymob go-live date in this week's report.", {
      replies: [[13, 20, "Draft ready — I'll send it to @[5] after your review.", { reactions: { like: [2] } }]] }],
    ["bulk", 3, 12, "The CSV parser supports Arabic product names now (UTF-8 with BOM). Sample file attached for testing.", { files: ["bulk_csv"], reactions: { like: [2, 7] } }],
    ["cdn", 11, 60, "CDN is live on staging. Average product image weight went from 480 KB to 95 KB with AVIF.", { reactions: { love: [3, 2] } }],
    ["visits", 15, 72, "UAT round 2 feedback from the Delta area managers attached — 3 minor fixes before sign-off.", { files: ["uat_pdf"],
      replies: [[3, 50, "Fixed pharmacy names in the week view and the approval badge contrast. Remaining: configurable low-stock threshold (that's @[7]'s ticket).", {}], [7, 26, "Threshold is configurable per product now 👌", { reactions: { like: [15, 3] } }]] }],
    ["visits", 4, 8, "Delta's commercial director asked if we can demo this on Thursday at their Nasr City office.", { reactions: { like: [15, 3] },
      replies: [[15, 6, "Yes — @[3] please prepare the tablet build by Wednesday.", {}]] }],
    ["dashboard", 3, 14, "First version of the rep dashboard — mock attached.", { files: ["dashboard_png"], reactions: { like: [15, 8] },
      replies: [[15, 11, "Nice! Please add an 'Upper Egypt' filter and export to Excel.", {}]] }],
    ["pentest", 11, 40, "Certificate pinning is done for /sync and /auth. Token storage moved to EncryptedSharedPreferences.", { reactions: { like: [7, 15] } }],
    ["pentest", 15, 10, "@[11] @[7] the retest is booked for Monday. Let's make sure staging has the release build.", {}],
    ["mdm", 11, 3 * 24, "All 350 devices enrolled ✅ Kiosk mode verified on 20 random devices.", { reactions: { like: [15], love: [7] } }],
    ["reports", 9, 30, "Arabic PDF renders correctly now, but the signature box is missing on page 2.", {}],
    ["tiers", 15, 6 * 24, "Client approved the tier thresholds: Silver 0–999, Gold 1,000–4,999, Platinum 5,000+ points.", { reactions: { like: [8, 3] } }],
    ["otp", 8, 30, "Updated onboarding flow with the PDPL consent step — see the attached flow.", { files: ["onboarding_svg"],
      replies: [[3, 22, "Implemented screens 1–3. OTP via Unifonic works for +966 and +971 numbers.", { reactions: { like: [8, 15] } }]] }],
    ["otp", 12, 2, "Copy for the consent screen is ready in both languages: «أوافق على الشروط وسياسة الخصوصية».", { reactions: { love: [8] } }],
    ["a11y", 9, 20, "Contrast issues fixed on the tier badges. VoiceOver reads the points balance in English even when the app is in Arabic — needs accessibilityLanguage.", {}],
    ["wireframes", 8, 26, "Three hero directions in the wireframe — I'd go with 'Built in Cairo, shipped to the Gulf'. @[2] @[12] thoughts?", { files: ["homepage_svg"], reactions: { love: [2, 12] },
      replies: [[2, 20, "Love direction A. Let's add client logos under the hero.", {}], [12, 7, "Agree. We need logo usage approval from Delta Pharma — I'll ask @[4].", { reactions: { like: [8] } }]] }],
    ["cases", 14, 16, "Nile Foods interview done — they reported 38% of partner orders online in the first month.", { reactions: { wow: [12, 2] } }],
    ["brand", 2, 4 * 24, "The board approved the refreshed logo 🎉 Guidelines and logo pack attached.", { files: ["brand_pdf", "logo_zip"], reactions: { love: [8, 12, 14] } }],
    ["double", 9, 48, "Reproduced with 2 parallel requests (k6 script). Happens roughly 1 in 500 bookings under load.", {
      replies: [[7, 30, "Added a unique index on (doctor_id, slot_start) plus a retry with a friendly message. Ready for review.", { reactions: { like: [9, 2] } }]] }],
    ["uptime", 13, 5, "Uptime for September: 99.95% — one 18-minute incident on the 12th (SMS provider).", {}],
    ["replication", 11, 9, "Rehearsal #1 finished: 42 min of replication lag during the full sync, 3 min at steady state. Runbook attached.", { files: ["runbook_md"],
      replies: [[7, 7, "Let's schedule rehearsal #2 on Thursday after 11 PM Cairo time — lowest traffic.", {}], [15, 5, "Approved. @[1] FYI — the actual cut-over stays on the 15th.", { reactions: { like: [1, 11] } }]] }],
    ["cost", 15, 20, "Reserved instances for the AKS node pools save ~27% vs pay-as-you-go. Waiting for @[1] to approve the 1-year commitment.", {}],
    ["budget", 1, 20, "@[2] please add the Riyadh office fit-out as a separate line and show SAR next to EGP.", { files: ["budget_csv"],
      replies: [[2, 16, "Added. The fit-out estimate is SAR 310k, pending two more quotes.", { reactions: { like: [1] } }]] }],
    ["pricing", 15, 30, "Draft comparison: retainers give us 18% better utilisation, but KSA clients prefer fixed-bid for phase 1.", {
      replies: [[1, 22, "Let's propose a hybrid: fixed-bid discovery, then a monthly retainer.", { reactions: { like: [15, 2] } }]] }],
    ["sow", 13, 26, "Gulf Retail procurement wants the SOW in their template — @[15] I'll share it tomorrow.", {}],
  ];
  const commentRows = [];
  const addComment = (task, author, hAgo, content, opts, parentId) => {
    const createdAt = past(new Date(now - hAgo * HOUR).toISOString());
    const createdAtSafe = new Date(createdAt) < new Date(task.createdAt) ? plus(task.createdAt, 2 * HOUR) : createdAt;
    const row = { id: nextId("comment"), taskId: task.id, parentCommentId: parentId || null, content, authorId: author, createdAt: createdAtSafe, updatedAt: createdAtSafe, reactions: [] };
    for (const [reaction, ids] of Object.entries(opts.reactions || {})) row.reactions.push({ reaction, userIds: [...ids] });
    db.comments.push(row);
    commentRows.push(row);
    for (const f of opts.files || []) addAttachment(f, { commentId: row.id }, author, createdAtSafe);
    return row;
  };
  for (const [tk, author, hAgo, content, opts] of C) {
    const task = K[tk];
    const parent = addComment(task, author, hAgo, content, opts);
    for (const [ra, rh, rc, ro] of opts.replies || []) addComment(task, ra, rh, rc, ro || {}, parent.id);
  }

  // ---------------- activities ----------------
  const act = (task, action, userId, createdAt, details = {}, oldValue = null, newValue = null) =>
    db.activities.push({ id: nextId("activity"), taskId: task.id, action, details: { taskTitle: task.title, ...details }, oldValue, newValue, userId, createdAt });
  const label = { backlog: "Backlog", todo: "To Do", in_progress: "In Progress", in_review: "In Review", done: "Done" };
  const nameOf = (id) => {
    const u = identity.findUser(id);
    return u ? `${u.firstName} ${u.lastName}` : "Unknown";
  };
  for (const task of db.tasks) {
    act(task, "created", task.createdById, task.createdAt);
    for (const a of task.assignments) act(task, "assigned", task.createdById, a.assignedAt, { assigneeName: nameOf(a.assigneeId) }, null, nameOf(a.assigneeId));
    for (const s of db.subtasks.filter((x) => x.taskId === task.id)) {
      act(task, "subtask_added", s.createdById, s.createdAt, { subtaskTitle: s.title });
      if (s.completedAt) act(task, "subtask_completed", s.completedById, s.completedAt, { subtaskTitle: s.title });
    }
    for (const a of db.attachments.filter((x) => x.taskId === task.id)) act(task, "attachment_added", a.uploadedById, a.createdAt, { filename: a.originalName, filesize: a.size });
    if (task.movedAt) {
      const mover = task.status === "in_review" || task.status === "done" ? (task.assignments[0]?.assigneeId || task.createdById) : (task.assignments[0]?.assigneeId || task.createdById);
      act(task, "status_changed", mover, task.completedAt || task.movedAt, {}, "To Do", label[task.status] || task.status);
    }
    for (const c of db.comments.filter((x) => x.taskId === task.id)) act(task, "commented", c.authorId, c.createdAt, { commentId: c.id });
    const times = db.activities.filter((a) => a.taskId === task.id).map((a) => new Date(a.createdAt).getTime());
    task.updatedAt = new Date(Math.max(...times, new Date(task.createdAt).getTime())).toISOString();
  }
  // a due-date change on the weekly report (shows up in notifications & activity)
  act(K.report14, "due_date_changed", 2, hoursAgo(30), {}, at(1, 17), at(-1, 17));
  for (const p of db.projects) {
    const ts = db.tasks.filter((t) => t.projectId === p.id).map((t) => new Date(t.updatedAt).getTime());
    if (ts.length) p.updatedAt = new Date(Math.max(...ts)).toISOString();
  }

  // ---------------- notifications ----------------
  const notify = (userId, n) => db.notifications.push({ id: 0, userId, priority: "normal", readAt: null, clearedAt: null, ...n, updatedAt: n.createdAt });
  const recent = (iso, h) => now - new Date(iso).getTime() < h * HOUR;
  for (const task of db.tasks) {
    const project = db.projects.find((p) => p.id === task.projectId);
    if (now - new Date(task.createdAt).getTime() > 45 * DAY) continue;
    for (const a of task.assignments) {
      if (a.assigneeId === task.createdById) continue;
      notify(a.assigneeId, { type: "task_assigned", group: "assigned", priority: task.priority === "urgent" ? "high" : "normal", title: "New task assigned", message: `${nameOf(task.createdById)} assigned you to "${task.title}"`, actorId: task.createdById,
        data: { taskId: task.id, projectId: project.id, taskTitle: task.title, projectTitle: project.title }, createdAt: a.assignedAt, readAt: recent(a.assignedAt, 50) ? null : plus(a.assignedAt, 3 * HOUR) });
    }
    if (task.movedAt && (task.status === "in_review" || task.status === "done") && recent(task.movedAt, 10 * 24)) {
      const mover = task.assignments[0]?.assigneeId || task.createdById;
      const watchers = new Set([task.createdById, ...task.assignments.map((a) => a.assigneeId)]);
      for (const uid of watchers) {
        if (uid === mover) continue;
        const ts = task.completedAt || task.movedAt;
        notify(uid, { type: "task_status_changed", group: "all", title: "Task status updated", message: `${nameOf(mover)} moved "${task.title}" to ${label[task.status]}`, actorId: mover,
          data: { taskId: task.id, projectId: project.id, taskTitle: task.title, projectTitle: project.title, status: task.status }, createdAt: ts, readAt: recent(ts, 30) ? null : plus(ts, 2 * HOUR) });
      }
    }
  }
  for (const c of commentRows) {
    const task = db.tasks.find((t) => t.id === c.taskId);
    const project = db.projects.find((p) => p.id === task.projectId);
    const mentioned = [...new Set([...c.content.matchAll(/@\[(\d+)\]/g)].map((m) => Number(m[1])))];
    for (const uid of mentioned) {
      if (uid === c.authorId) continue;
      notify(uid, { type: "comment_mention", group: "mentions", title: "You were mentioned", message: `${nameOf(c.authorId)} mentioned you in "${task.title}"`, actorId: c.authorId,
        data: { taskId: task.id, projectId: project.id, commentId: c.id, taskTitle: task.title, projectTitle: project.title, messageContent: c.content.replace(/@\[(\d+)\]/g, (m, id) => `@${nameOf(Number(id))}`) },
        createdAt: c.createdAt, readAt: recent(c.createdAt, 30) ? null : plus(c.createdAt, HOUR) });
    }
    if (c.parentCommentId) {
      const parent = db.comments.find((x) => x.id === c.parentCommentId);
      if (parent && parent.authorId !== c.authorId && !mentioned.includes(parent.authorId)) {
        notify(parent.authorId, { type: "comment_reply", group: "all", title: "New reply", message: `${nameOf(c.authorId)} replied to your comment on "${task.title}"`, actorId: c.authorId,
          data: { taskId: task.id, projectId: project.id, commentId: c.id, taskTitle: task.title, projectTitle: project.title }, createdAt: c.createdAt, readAt: recent(c.createdAt, 20) ? null : plus(c.createdAt, HOUR) });
      }
    }
  }
  for (const p of db.projects) {
    if (now - new Date(p.createdAt).getTime() > 80 * DAY) continue;
    for (const uid of p.memberIds) {
      if (uid === p.createdById) continue;
      const ts = plus(p.createdAt, HOUR);
      notify(uid, { type: "project_member_added", group: "all", title: "Added to project", message: `${nameOf(p.createdById)} added you to "${p.title}"`, actorId: p.createdById,
        data: { projectId: p.id, projectTitle: p.title }, createdAt: ts, readAt: recent(ts, 24) ? null : plus(ts, 5 * HOUR) });
    }
    for (const teamId of p.teamIds) {
      const team = db.teams.find((t) => t.id === teamId);
      for (const uid of team.memberIds) {
        if (uid === p.createdById || !p.memberIds.includes(uid)) continue;
        const ts = plus(p.createdAt, 2 * HOUR);
        notify(uid, { type: "project_team_added", group: "all", title: "Team added to project", message: `${nameOf(p.createdById)} added the ${team.name} team to "${p.title}"`, actorId: p.createdById,
          data: { projectId: p.id, projectTitle: p.title, teamId: team.id }, createdAt: ts, readAt: plus(ts, 6 * HOUR) });
      }
    }
  }
  const r14 = K.report14;
  for (const a of r14.assignments) if (a.assigneeId !== 2) notify(a.assigneeId, { type: "task_due_date_changed", group: "assigned", title: "Due date changed", message: `Karim Hassan changed the due date of "${r14.title}"`, actorId: 2, data: { taskId: r14.id, projectId: r14.projectId, taskTitle: r14.title, dueDate: r14.dueDate }, createdAt: hoursAgo(30), readAt: null });
  // keep the 30 most recent per user, clear a couple of old ones so the "Cleared" filter has data
  const byUser = {};
  for (const n of db.notifications) (byUser[n.userId] = byUser[n.userId] || []).push(n);
  db.notifications = [];
  for (const list of Object.values(byUser)) {
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const kept = list.slice(0, 30);
    kept.slice(-2).forEach((n) => { if (n.readAt) n.clearedAt = plus(n.readAt, DAY); });
    db.notifications.push(...kept);
  }
  db.notifications.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  for (const n of db.notifications) { n.id = nextId("notification"); n.updatedAt = n.clearedAt || n.readAt || n.createdAt; }

  // ---------------- chat ----------------
  const CONV = [
    [[2, 3], [[2, 26, "Salma, can you demo the checkout to Nour tomorrow at 1 PM?"], [3, 25.5, "Sure — staging is stable. I'll share my screen from the office."], [2, 25, "Great, I'll send the invite 👍"], [3, 2, "Heads-up: Ahmed found a declined-card edge case, fixing it before the demo."]]],
    [[1, 2], [[1, 20, "Karim, I need the budget draft with SAR figures by Thursday."], [2, 19, "On it — Riyadh fit-out quotes arrive Wednesday."], [1, 18.5, "Perfect. Board meeting is on the 16th."]]],
    [[3, 8], [[8, 30, "Uploaded the new PDP spacing tokens to Figma."], [3, 29, "Thanks Laila! Arabic price alignment looks much better now."], [8, 4, "Can you check the mega menu hover states on Safari?"]]],
    [[7, 9], [[9, 27, "Invoice PDF fails for 0% VAT items — logs in the ticket."], [7, 26.5, "Found it, rounding issue in the tax calculator."], [7, 5, "Fixed on staging, can you re-run the suite?"], [9, 1.5, "All green ✅"]]],
    [[15, 3], [[15, 8, "Delta wants a tablet demo on Thursday in Nasr City."], [3, 7.5, "I'll prepare a release build tonight."]]],
    [[11, 7], [[11, 10, "Replication lag is down to 3 minutes at steady state."], [7, 9.5, "Nice. Rehearsal #2 Thursday after 11 PM?"], [11, 9, "Booked 🗓️"]]],
  ];
  for (const [pair, msgs] of CONV) {
    const id = nextId("conversation");
    const first = msgs[0];
    const conv = { id, participantIds: pair, createdAt: hoursAgo(first[1] + 1), lastActivityAt: hoursAgo(msgs[msgs.length - 1][1]), lastReadAt: {}, deletedFor: [] };
    db.conversations.push(conv);
    for (const [sender, h, content] of msgs) db.messages.push({ id: nextId("message"), conversationId: id, senderId: sender, type: "text", content, status: "read", voiceFilePath: null, voiceDuration: null, attachments: [], links: [], createdAt: hoursAgo(h), deletedAt: null });
    // the last message is unread for the other participant
    const last = msgs[msgs.length - 1];
    for (const uid of pair) conv.lastReadAt[uid] = uid === last[0] ? hoursAgo(last[1]) : hoursAgo(last[1] + 0.5);
    db.messages[db.messages.length - 1].status = "delivered";
  }

  return db;
}

module.exports = { buildSeed };
