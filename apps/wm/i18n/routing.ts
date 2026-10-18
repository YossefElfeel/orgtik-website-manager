import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";

// The Website Manager is a new app, so its URLs carry the language like the other suite apps
// (/ar/content/work). D-001: all five from day one.
export const routing = defineRouting({
  locales: ["en", "ar", "de", "fr", "it"],
  defaultLocale: "en",
  localePrefix: "always",
});

export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);
export type AppLocale = (typeof routing)["locales"][number];
