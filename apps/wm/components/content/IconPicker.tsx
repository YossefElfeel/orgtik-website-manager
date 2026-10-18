"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Input } from "@orgtik/ui";
import { MediaPicker } from "@/components/media/MediaPicker";
import { mediaUrl } from "@/lib/env";
import {
  ArrowsClockwise,
  Browser,
  CalendarBlank,
  CalendarCheck,
  CaretDown,
  ChartLineUp,
  CheckSquare,
  CirclesThreePlus,
  Code,
  CursorClick,
  EnvelopeSimple,
  FileText,
  Flag,
  FolderSimple,
  HardDrives,
  IdentificationBadge,
  Lifebuoy,
  ListChecks,
  MagnifyingGlass,
  Megaphone,
  Note,
  Palette,
  RocketLaunch,
  Target,
  TrendUp,
  User,
  UserCircleCheck,
  UsersThree,
} from "@phosphor-icons/react";
const icons = {
  "ph-users-three": UsersThree,
  "ph-chart-line-up": ChartLineUp,
  "ph-folder-simple": FolderSimple,
  "ph-check-square": CheckSquare,
  "ph-megaphone": Megaphone,
  "ph-browser": Browser,
  "ph-palette": Palette,
  "ph-code": Code,
  "ph-lifebuoy": Lifebuoy,
  "ph-hard-drives": HardDrives,
  "ph-flag": Flag,
  "ph-arrows-clockwise": ArrowsClockwise,
  "ph-trend-up": TrendUp,
  "ph-user": User,
  "ph-calendar-check": CalendarCheck,
  "ph-user-circle-check": UserCircleCheck,
  "ph-list-checks": ListChecks,
  "ph-file-text": FileText,
  "ph-identification-badge": IdentificationBadge,
  "ph-calendar-blank": CalendarBlank,
  "ph-target": Target,
  "ph-note": Note,
  "ph-cursor-click": CursorClick,
  "ph-envelope-simple": EnvelopeSimple,
  "ph-circles-three-plus": CirclesThreePlus,
  "ph-rocket-launch": RocketLaunch,
};

export function IconPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("Fields");
  const [search, setSearch] = useState("");
  const Selected = Object.hasOwn(icons, value) ? icons[value as keyof typeof icons] : undefined;
  const query = search.trim().toLowerCase().replace(/^ph-/, "").replaceAll("-", " ");
  const filtered = Object.entries(icons).filter(([key]) =>
    key.replace(/^ph-/, "").replaceAll("-", " ").includes(query),
  );
  return (
    <details className="group rounded-field border border-line">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-field p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden">
        <span aria-label={t("icon")} className="flex size-10 shrink-0 items-center justify-center rounded-field border border-line bg-sunken">
          {Selected ? <Selected className="size-8" aria-hidden /> : value ? <img src={mediaUrl(value)} alt={t("icon")} className="size-8 object-contain" /> : null}
        </span>
        <span className="flex-1 text-body-sm font-medium">{t("chooseIcon")}</span>
        <CaretDown aria-hidden className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-3 border-t border-line p-3">
        <Input type="search" size="sm" aria-label={t("searchIcons")} placeholder={t("searchIcons")} startIcon={<MagnifyingGlass className="size-4" />} value={search} onChange={event => setSearch(event.target.value)} />
        <div role="group" aria-label={t("icon")} className="flex flex-wrap gap-2">
          {filtered.map(([key, Icon]) => <Button key={key} size="sm" variant={key === value ? "primary" : "secondary"} disabled={disabled} title={key.replace(/^ph-/, "").replaceAll("-", " ")} aria-label={key.replace(/^ph-/, "").replaceAll("-", " ")} aria-pressed={key === value} onClick={() => onChange(key)} className="size-10 p-0"><Icon aria-hidden className="size-6" /></Button>)}
        </div>
        {!filtered.length ? <p role="status" className="text-body-sm text-fg-muted">{t("noIcons")}</p> : null}
        <MediaPicker iconOnly value={Selected ? "" : value} onChange={onChange} disabled={disabled} />
      </div>
    </details>
  );
}
