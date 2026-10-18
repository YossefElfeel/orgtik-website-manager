"use client";
import { RequirePermission } from "@/components/frame/RequirePermission";
import { RoleComparison } from "@/components/users/RoleComparison";
export default function RolesPage() {
  return <RequirePermission permission="settings:view"><RoleComparison /></RequirePermission>;
}
