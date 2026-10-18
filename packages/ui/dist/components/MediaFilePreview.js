"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from "react";
export function MediaFilePreview({ file }) {
    const [src, setSrc] = useState();
    useEffect(() => {
        const url = URL.createObjectURL(file);
        setSrc(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);
    if (!src)
        return null;
    return file.type.startsWith("video/") ? (_jsx("video", { src: src, "aria-label": file.name, controls: true, muted: true, preload: "metadata", className: "h-24 w-40 shrink-0 rounded-field bg-sunken object-contain" })) : (_jsx("img", { src: src, alt: "", className: "h-16 w-24 shrink-0 rounded-field bg-sunken object-contain" }));
}
//# sourceMappingURL=MediaFilePreview.js.map