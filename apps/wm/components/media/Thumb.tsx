"use client";

import { libraryUrl } from "@/lib/env";
import type { MediaItem } from "@/store/api";

/** A file's picture: the image itself (at its focal point), or a video's first frame. */
export function Thumb({ m, className }: { m: Pick<MediaItem, "file" | "url" | "kind" | "focal">; className?: string }) {
  const src = libraryUrl(m);
  const position = `${m.focal.x}% ${m.focal.y}%`;
  if (m.kind === "video") return <video src={src} muted preload="metadata" aria-hidden="true" className={className} style={{ objectFit: "cover", objectPosition: position }} />;
  return <img src={src} alt="" className={className} style={{ objectFit: m.kind === "vector" ? "contain" : "cover", objectPosition: position }} />;
}
