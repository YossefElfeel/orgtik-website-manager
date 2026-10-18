"use client";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/routing";

/** Shareable list state survives detail navigation, refresh and browser Back. */
export function useListState() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const set = (values: Record<string, string | number | null | undefined>) => {
    const next = new URLSearchParams(params.toString());
    if (!("page" in values)) next.delete("page");
    for (const [key, value] of Object.entries(values)) {
      if (
        value == null ||
        value === "" ||
        value === "all" ||
        (key === "page" && Number(value) <= 1)
      )
        next.delete(key);
      else next.set(key, String(value));
    }
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, {
      scroll: false,
    });
  };
  return {
    get: (key: string, fallback = "") => params.get(key) ?? fallback,
    page: Math.max(1, Number(params.get("page")) || 1),
    href: `${pathname}${params.size ? `?${params}` : ""}`,
    set,
  };
}

export function safeReturn(value: string | null, fallback: string) {
  return value?.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
    ? value
    : fallback;
}
