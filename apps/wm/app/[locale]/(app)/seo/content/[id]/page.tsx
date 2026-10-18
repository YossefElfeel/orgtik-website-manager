"use client";
import { useParams } from "next/navigation";
import { EntryEditor } from "@/components/content/EntryEditor";
import { RequirePermission } from "@/components/frame/RequirePermission";

export default function SeoEditorPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequirePermission permission="seo:view">
      <EntryEditor id={id} seoOnly />
    </RequirePermission>
  );
}
