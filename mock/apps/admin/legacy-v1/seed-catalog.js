// The tool catalogue for the platform mock (ADM-03…07, 29). Until the PM confirms the launch
// catalogue (packet 01, Q "which list is the source of truth"), it is the union of the spec's tools
// (General, Task Manager, Chat, File Manager, Email, Hosting) and the suite's apps (HR, CRM,
// Marketing, Website), each with the status it really has today.
// Names are in the 5 languages (D-001); feature keys follow G-20 ("<tool>.<feature>").
const L = (en, ar, de, fr, it) => ({ en, ar, de, fr, it });

const tools = [
  { key: "general", order: 1, status: "live", mandatory: true, icon: "ph-squares-four", scope: "global", name: L("General", "العام", "Allgemein", "Général", "Generale"), short: L("Your workspace, people and settings.", "مساحة العمل والأشخاص والإعدادات.", "Ihr Arbeitsbereich, Personen und Einstellungen.", "Votre espace, vos personnes et vos réglages.", "Il tuo spazio, le persone e le impostazioni.") },
  { key: "tasks", order: 2, status: "live", icon: "ph-check-square", scope: "task_manager", name: L("Tasks", "المهام", "Aufgaben", "Tâches", "Attività"), short: L("Projects, boards and deadlines.", "المشاريع واللوحات والمواعيد.", "Projekte, Boards und Fristen.", "Projets, tableaux et échéances.", "Progetti, bacheche e scadenze.") },
  { key: "files", order: 3, status: "live", icon: "ph-folder", scope: "file_manager", name: L("Files", "الملفات", "Dateien", "Fichiers", "File"), short: L("Shared files with versions and links.", "ملفات مشتركة بإصدارات وروابط.", "Gemeinsame Dateien mit Versionen und Links.", "Fichiers partagés, versions et liens.", "File condivisi con versioni e link.") },
  { key: "chat", order: 4, status: "beta", icon: "ph-chats", scope: "hq", name: L("Chat", "المحادثات", "Chat", "Chat", "Chat"), short: L("Team chat, calls and meetings.", "محادثات الفريق والمكالمات والاجتماعات.", "Team-Chat, Anrufe und Meetings.", "Messagerie, appels et réunions.", "Chat del team, chiamate e riunioni.") },
  { key: "hr", order: 5, status: "live", icon: "ph-users-three", scope: "hr_system", name: L("HR", "الموارد البشرية", "Personal", "RH", "Risorse umane"), short: L("People, leave and payroll.", "الموظفين والإجازات والرواتب.", "Mitarbeitende, Urlaub und Lohn.", "Personnel, congés et paie.", "Persone, ferie e buste paga.") },
  { key: "crm", order: 6, status: "live", icon: "ph-chart-line-up", scope: "sales", name: L("CRM", "إدارة العملاء", "CRM", "CRM", "CRM"), short: L("Leads, deals and customers.", "العملاء المحتملين والصفقات والعملاء.", "Leads, Deals und Kunden.", "Prospects, affaires et clients.", "Lead, trattative e clienti.") },
  { key: "marketing", order: 7, status: "live", icon: "ph-megaphone", scope: "digital_marketing", name: L("Marketing", "التسويق", "Marketing", "Marketing", "Marketing"), short: L("Campaigns, posts and reports.", "الحملات والمنشورات والتقارير.", "Kampagnen, Beiträge und Berichte.", "Campagnes, publications et rapports.", "Campagne, post e report.") },
  { key: "email", order: 8, status: "coming_soon", icon: "ph-envelope-simple", scope: null, name: L("Email", "البريد", "E-Mail", "E-mail", "Email"), short: L("Business mailboxes on your domain (G-28).", "صناديق بريد على نطاقك (G-28).", "Postfächer auf Ihrer Domain (G-28).", "Boîtes mail sur votre domaine (G-28).", "Caselle sul tuo dominio (G-28).") },
  { key: "website", order: 9, status: "coming_soon", icon: "ph-browser", scope: null, name: L("Website", "الموقع", "Website", "Site web", "Sito web"), short: L("Your website, managed from the suite.", "موقعك، من داخل المنصة.", "Ihre Website, aus der Suite verwaltet.", "Votre site, géré depuis la suite.", "Il tuo sito, gestito dalla suite.") },
  { key: "hosting", order: 10, status: "live", external: "https://orgtik.ch", icon: "ph-hard-drives", scope: null, name: L("Hosting", "الاستضافة", "Hosting", "Hébergement", "Hosting"), short: L("Managed hosting at orgtik.ch (G-24).", "استضافة مُدارة على orgtik.ch (G-24).", "Verwaltetes Hosting auf orgtik.ch (G-24).", "Hébergement géré sur orgtik.ch (G-24).", "Hosting gestito su orgtik.ch (G-24).") },
];

// Feature keys and limits (ADM-05, G-19 hard/soft, G-20).
const features = [
  { key: "general.users", tool: "general", kind: "limit", unit: "users", enforcement: "hard" },
  { key: "general.custom_roles", tool: "general", kind: "flag" },
  { key: "general.audit_days", tool: "general", kind: "limit", unit: "days", enforcement: "hard" },
  { key: "tasks.projects", tool: "tasks", kind: "limit", unit: "projects", enforcement: "hard" },
  { key: "tasks.guests", tool: "tasks", kind: "limit", unit: "guests", enforcement: "soft" },
  { key: "tasks.automations", tool: "tasks", kind: "flag" },
  { key: "files.storage_gb", tool: "files", kind: "limit", unit: "GB", enforcement: "hard" },
  { key: "files.share_links", tool: "files", kind: "flag" },
  { key: "chat.history_days", tool: "chat", kind: "limit", unit: "days", enforcement: "soft" },
  { key: "chat.meetings", tool: "chat", kind: "flag" },
  { key: "hr.employees", tool: "hr", kind: "limit", unit: "employees", enforcement: "hard" },
  { key: "hr.payroll", tool: "hr", kind: "flag" },
  { key: "crm.contacts", tool: "crm", kind: "limit", unit: "contacts", enforcement: "soft" },
  { key: "crm.pipelines", tool: "crm", kind: "limit", unit: "pipelines", enforcement: "hard" },
  { key: "marketing.channels", tool: "marketing", kind: "limit", unit: "channels", enforcement: "hard" },
  { key: "marketing.ads", tool: "marketing", kind: "flag" },
];

// Plans per tool (ADM-06/07). defaultUsd is the Default-zone price (ALG-5); yearly is 2 months free
// (G-03: monthly × 12 × (1 − 2/12)) unless a yearly cell is set.
const Y = 100 * (2 / 12);
const plan = (id, tool, tier, name, o = {}) => ({ id, tool, tier, name, perUser: false, minSeats: 1, guestLimit: 0, trialDays: 0, yearlyDiscountPct: Y, visibility: "public", status: "active", ...o });
const plans = [
  plan("general_free", "general", "free", L("Free", "مجاني", "Kostenlos", "Gratuit", "Gratuito"), { defaultUsd: { monthly: 0 }, limits: { "general.users": 5, "general.audit_days": 30 }, flags: {} }),
  plan("chat_free", "chat", "free", L("Free", "مجاني", "Kostenlos", "Gratuit", "Gratuito"), { defaultUsd: { monthly: 0 }, limits: { "chat.history_days": 30 }, flags: { "chat.meetings": false } }),
  plan("chat_starter", "chat", "starter", L("Starter", "البداية", "Starter", "Starter", "Starter"), { perUser: true, minSeats: 3, guestLimit: 2, trialDays: 14, defaultUsd: { monthly: 3 }, limits: { "chat.history_days": 365 }, flags: { "chat.meetings": true } }), // EX-10
  plan("chat_pro", "chat", "pro", L("Pro", "احترافي", "Pro", "Pro", "Pro"), { trialDays: 14, defaultUsd: { monthly: 12 }, limits: { "chat.history_days": 3650 }, flags: { "chat.meetings": true } }), // EX-1…9, 11, 12
  plan("tasks_free", "tasks", "free", L("Free", "مجاني", "Kostenlos", "Gratuit", "Gratuito"), { defaultUsd: { monthly: 0 }, limits: { "tasks.projects": 3, "tasks.guests": 0 }, flags: { "tasks.automations": false } }),
  plan("tasks_pro", "tasks", "pro", L("Pro", "احترافي", "Pro", "Pro", "Pro"), { perUser: true, minSeats: 2, guestLimit: 5, trialDays: 14, defaultUsd: { monthly: 8 }, limits: { "tasks.projects": 100, "tasks.guests": 5 }, flags: { "tasks.automations": true } }),
  plan("files_free", "files", "free", L("Free", "مجاني", "Kostenlos", "Gratuit", "Gratuito"), { defaultUsd: { monthly: 0 }, limits: { "files.storage_gb": 5 }, flags: { "files.share_links": false } }),
  plan("files_pro", "files", "pro", L("Pro", "احترافي", "Pro", "Pro", "Pro"), { trialDays: 14, defaultUsd: { monthly: 7 }, limits: { "files.storage_gb": 500 }, flags: { "files.share_links": true } }),
  plan("hr_pro", "hr", "pro", L("Pro", "احترافي", "Pro", "Pro", "Pro"), { perUser: true, minSeats: 5, trialDays: 14, defaultUsd: { monthly: 15 }, limits: { "hr.employees": 500 }, flags: { "hr.payroll": true } }),
  plan("crm_pro", "crm", "pro", L("Pro", "احترافي", "Pro", "Pro", "Pro"), { perUser: true, minSeats: 2, trialDays: 14, defaultUsd: { monthly: 18 }, limits: { "crm.contacts": 50000, "crm.pipelines": 10 }, flags: {} }),
  plan("marketing_pro", "marketing", "pro", L("Pro", "احترافي", "Pro", "Pro", "Pro"), { trialDays: 14, defaultUsd: { monthly: 11 }, limits: { "marketing.channels": 10 }, flags: { "marketing.ads": true } }),
];

const waitlist = [
  { id: "wl_1", tool: "email", email: "it@deltapharma.test", name: "Delta Pharma IT", country: "EG", createdAt: "2026-09-20T09:00:00Z", notified: false },
  { id: "wl_2", tool: "email", email: "ops@gulfretail.test", name: "Gulf Retail Ops", country: "AE", createdAt: "2026-09-24T11:20:00Z", notified: false },
  { id: "wl_3", tool: "website", email: "hello@nilefoods.test", name: "Nile Foods", country: "EG", createdAt: "2026-09-27T15:05:00Z", notified: false },
];

module.exports = { tools, features, plans, waitlist };
