// Public website SKUs retain individual identities; internal WM is never sold as app access.
const names = (en, ar, de, fr, it) => ({ en, ar, de, fr, it });
const service = (id, monthlyCHF, serviceId, name) => ({ id, kind: "service", monthlyCHF, serviceId, name, fulfillment: "managed-service" });
const offers = [
  service("design/graphic-design", 900, "svc_web_graphic_design", names("Graphic design", "تصميم جرافيك", "Grafikdesign", "Design graphique", "Design grafico")),
  service("design/brand-development", 1200, "svc_web_branding", names("Branding", "تطوير الهوية", "Markenentwicklung", "Identité de marque", "Identità di marca")),
  service("design/web-and-app-design", 1800, "svc_web_interface_design", names("Web & app design", "تصميم المواقع والتطبيقات", "Web- und App-Design", "Design web et applications", "Design web e app")),
  service("development/web-development", 2400, "svc_web_development", names("Web development", "تطوير المواقع", "Webentwicklung", "Développement web", "Sviluppo web")),
  service("development/custom-app-development", 3200, "svc_web_custom_apps", names("Custom app development", "تطوير تطبيقات مخصصة", "Individuelle App-Entwicklung", "Applications sur mesure", "App personalizzate")),
  service("marketing/social-media-marketing", 900, "svc_web_social", names("Social media", "التواصل الاجتماعي", "Social Media", "Réseaux sociaux", "Social media")),
  service("marketing/digital-advertising-switzerland", 1100, "svc_web_advertising", names("Advertising management", "إدارة الإعلانات", "Werbemanagement", "Gestion publicitaire", "Gestione pubblicitaria")),
  service("marketing/seo-services", 1000, "svc_web_seo", names("SEO", "تحسين محركات البحث", "SEO", "SEO", "SEO")),
  service("it-support/website-management", 350, "svc_web_website_care", names("Website management", "إدارة المواقع", "Website-Verwaltung", "Gestion de site web", "Gestione sito web")),
  service("it-support/software-support", 600, "svc_web_software_support", names("Software support", "دعم البرمجيات", "Software-Support", "Assistance logicielle", "Supporto software")),
  ...[["hr", "hr_pro"], ["crm", "crm_pro"], ["files", "files_pro"], ["tasks", "tasks_pro"], ["marketing", "marketing_pro"]].map(([id, planId]) => ({ id, kind: "software", planId, tool: id, fulfillment: "tool" })),
  { ...service("website", 29, "svc_web_managed_website", names("Website management", "إدارة المواقع", "Website-Verwaltung", "Gestion de site web", "Gestione sito web")), kind: "software" },
];
// Presentation metadata only; these presets never contain prices or discount arithmetic.
const bundle = (id, kind, name, ids) => ({ id, kind, name, ids });
const bundles = [
  bundle("brand-presence", "service", "Brand Presence", ["design/graphic-design", "design/brand-development"]),
  bundle("digital-experience", "service", "Digital Experience", ["design/graphic-design", "design/web-and-app-design"]),
  bundle("complete-design", "service", "Complete Design", ["design/graphic-design", "design/brand-development", "design/web-and-app-design"]),
  bundle("product-build", "service", "Product Build", ["development/web-development", "development/custom-app-development"]),
  bundle("search-social", "service", "Search & Social", ["marketing/seo-services", "marketing/social-media-marketing"]),
  bundle("campaign-growth", "service", "Campaign Growth", ["marketing/social-media-marketing", "marketing/digital-advertising-switzerland"]),
  bundle("complete-marketing", "service", "Complete Marketing", ["marketing/seo-services", "marketing/social-media-marketing", "marketing/digital-advertising-switzerland"]),
  bundle("digital-care", "service", "Digital Care", ["it-support/website-management", "it-support/software-support"]),
  bundle("team-workspace", "software", "Team Workspace", ["hr", "tasks", "files"]),
  bundle("sales-marketing", "software", "Sales & Marketing", ["crm", "marketing", "website"]),
  bundle("business-suite", "software", "Business Suite", ["hr", "crm", "files", "tasks", "marketing", "website"]),
];
module.exports = { offers, bundles };
