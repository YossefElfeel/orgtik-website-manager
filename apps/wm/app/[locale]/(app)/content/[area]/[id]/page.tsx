"use client";

import { notFound, useParams } from "next/navigation";
import { RequirePermission } from "@/components/frame/RequirePermission";
import { EntryEditor } from "@/components/content/EntryEditor";
import { isArea, typeOfId } from "@/lib/contentTypes";

export default function EntryEditorPage() {
  const { area, id } = useParams<{ area: string; id: string }>();
  // An entry opens under its own area only (/content/work/sv_01 is not a page).
  const type = typeOfId(id);
  if (!isArea(area) || (type && type.area !== area) || id === "gl_components") notFound();
  return (
    <RequirePermission permission="content:view">
      <EntryEditor id={id} />
    </RequirePermission>
  );
}
