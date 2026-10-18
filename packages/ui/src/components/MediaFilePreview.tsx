"use client";
import { useEffect, useState } from "react";

export function MediaFilePreview({ file }: { file: File }) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  if (!src) return null;
  return file.type.startsWith("video/") ? (
    <video
      src={src}
      aria-label={file.name}
      controls
      muted
      preload="metadata"
      className="h-24 w-40 shrink-0 rounded-field bg-sunken object-contain"
    />
  ) : (
    <img
      src={src}
      alt=""
      className="h-16 w-24 shrink-0 rounded-field bg-sunken object-contain"
    />
  );
}
