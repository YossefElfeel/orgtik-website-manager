"use client";
import { useMeQuery } from "@/store/api";

/** What the signed-in person may do, from /v2/admin/me. The API enforces it again on every call. */
export function useCan() {
  const { data } = useMeQuery();
  // /admin/me revalidates staff membership and current roles. A role granted after sign-in
  // must not be masked by the older permission snapshot stored in the tab's session.
  const set = new Set(data?.permissions ?? []);
  return (permission: string) => set.has(permission);
}
