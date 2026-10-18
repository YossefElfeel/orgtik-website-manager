import type { ToolKey } from "./types.js";
import type { Locale } from "../locale.js";
export const SUITE_TOOLS: Record<ToolKey, { scope: string; app: string; labels: Record<Locale, string>; adminRoles: string[] }> = {
  tasks: { scope: "task_manager", app: "tasks", labels: { en: "Tasks", ar: "المهام", de: "Aufgaben", fr: "Tâches", it: "Attività" }, adminRoles: ["super_admin", "project_manager"] },
  files: { scope: "file_manager", app: "files", labels: { en: "Files", ar: "الملفات", de: "Dateien", fr: "Fichiers", it: "File" }, adminRoles: ["super_admin"] },
  hr: { scope: "hr_system", app: "hr", labels: { en: "HR", ar: "الموارد البشرية", de: "Personal", fr: "RH", it: "Risorse umane" }, adminRoles: ["super_admin", "hr"] },
  crm: { scope: "sales", app: "sales", labels: { en: "CRM", ar: "إدارة العملاء", de: "CRM", fr: "CRM", it: "CRM" }, adminRoles: ["admin", "manager"] },
  marketing: { scope: "digital_marketing", app: "marketing", labels: { en: "Marketing", ar: "التسويق", de: "Marketing", fr: "Marketing", it: "Marketing" }, adminRoles: ["super_admin", "marketing_manager"] },
  chat: { scope: "hq", app: "chats", labels: { en: "Chats", ar: "المحادثات", de: "Chats", fr: "Discussions", it: "Chat" }, adminRoles: ["owner", "admin"] },
};
export function toolFromScope(scope: string): ToolKey | undefined { return (Object.keys(SUITE_TOOLS) as ToolKey[]).find(tool => SUITE_TOOLS[tool].scope === scope || SUITE_TOOLS[tool].app === scope || tool === scope); }
export const CONNECTOR_PAIRS: [ToolKey, ToolKey][] = [["tasks", "files"], ["chat", "files"], ["tasks", "hr"], ["chat", "hr"], ["hr", "tasks"], ["chat", "tasks"], ["crm", "tasks"], ["crm", "files"], ["marketing", "crm"], ["marketing", "tasks"]];
const METRICS = {
  projects: ["Projects", "المشاريع", "Projekte", "Projets", "Progetti"],
  guests: ["Guests", "الضيوف", "Gäste", "Invités", "Ospiti"],
  storage_gb: ["Storage (GB)", "التخزين (غيغابايت)", "Speicher (GB)", "Stockage (Go)", "Spazio (GB)"],
  employees: ["Employees", "الموظفون", "Mitarbeitende", "Personnel", "Dipendenti"],
  departments: ["Departments", "الأقسام", "Abteilungen", "Départements", "Reparti"],
  payroll_runs: ["Payroll runs", "دورات الرواتب", "Lohnläufe", "Cycles de paie", "Cicli paghe"],
  contacts: ["Contacts", "جهات الاتصال", "Kontakte", "Contacts", "Contatti"],
  leads: ["Leads", "العملاء المحتملون", "Leads", "Prospects", "Lead"],
  brands: ["Brands", "العلامات التجارية", "Marken", "Marques", "Marchi"],
  posts: ["Posts", "المنشورات", "Beiträge", "Publications", "Post"],
  campaigns: ["Campaigns", "الحملات", "Kampagnen", "Campagnes", "Campagne"],
  messages: ["Messages", "الرسائل", "Nachrichten", "Messages", "Messaggi"],
} as const;
export function suiteMetricLabel(locale: Locale, key: string) { const name = key.split(".").at(-1) as keyof typeof METRICS; return METRICS[name]?.[["en", "ar", "de", "fr", "it"].indexOf(locale)] || name.replaceAll("_", " "); }
