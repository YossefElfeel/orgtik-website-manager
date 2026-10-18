"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { DownloadSimple } from "@phosphor-icons/react";
import { buttonVariants } from "../components/Button.js";
import { SimulatedTag } from "../demo/DemoPanel.js";
import { useOrgtik } from "../provider/OrgtikProvider.js";
const labels = { en: ["Document preview", "Download packaged PDF", "Illustrative packaged PDF; the sample does not change with scene values."], ar: ["معاينة المستند", "تحميل PDF النموذجي", "ملف PDF توضيحي؛ لا يتغير الملف مع قيم السيناريو."], de: ["Dokumentvorschau", "Paket-PDF herunterladen", "Illustratives PDF; das Beispiel ändert sich nicht mit Szenenwerten."], fr: ["Aperçu du document", "Télécharger le PDF fourni", "PDF illustratif ; l’exemple ne change pas avec les valeurs de la scène."], it: ["Anteprima documento", "Scarica PDF incluso", "PDF illustrativo; l’esempio non cambia con i valori della scena."] };
export function PdfPreview({ children, samplePdfHref }) {
    const { locale } = useOrgtik(), words = labels[locale];
    return _jsxs("section", { "aria-label": words[0], className: "flex flex-col gap-4 rounded-panel border border-line bg-raised p-5", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [_jsx(SimulatedTag, {}), _jsxs("a", { href: samplePdfHref, download: true, className: buttonVariants({ variant: "secondary" }), children: [_jsx(DownloadSimple, { "aria-hidden": "true", className: "size-4" }), words[1]] })] }), _jsx("div", { className: "min-w-0", children: children }), _jsx("p", { className: "text-caption text-fg-muted", children: words[2] })] });
}
//# sourceMappingURL=PdfPreview.js.map