import type { ToolKey } from "./types.js";
import type { Locale } from "../locale.js";
export declare const SUITE_TOOLS: Record<ToolKey, {
    scope: string;
    app: string;
    labels: Record<Locale, string>;
    adminRoles: string[];
}>;
export declare function toolFromScope(scope: string): ToolKey | undefined;
export declare const CONNECTOR_PAIRS: [ToolKey, ToolKey][];
export declare function suiteMetricLabel(locale: Locale, key: string): "Projects" | "المشاريع" | "Projekte" | "Projets" | "Progetti" | "Guests" | "الضيوف" | "Gäste" | "Invités" | "Ospiti" | "Storage (GB)" | "التخزين (غيغابايت)" | "Speicher (GB)" | "Stockage (Go)" | "Spazio (GB)" | "Employees" | "الموظفون" | "Mitarbeitende" | "Personnel" | "Dipendenti" | "Departments" | "الأقسام" | "Abteilungen" | "Départements" | "Reparti" | "Payroll runs" | "دورات الرواتب" | "Lohnläufe" | "Cycles de paie" | "Cicli paghe" | "Contacts" | "جهات الاتصال" | "Kontakte" | "Contatti" | "Leads" | "العملاء المحتملون" | "Prospects" | "Lead" | "Brands" | "العلامات التجارية" | "Marken" | "Marques" | "Marchi" | "Posts" | "المنشورات" | "Beiträge" | "Publications" | "Post" | "Campaigns" | "الحملات" | "Kampagnen" | "Campagnes" | "Campagne" | "Messages" | "الرسائل" | "Nachrichten" | "Messaggi";
//# sourceMappingURL=registry.d.ts.map