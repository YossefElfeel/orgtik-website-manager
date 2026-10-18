"use client";
import type { ReactNode } from "react";
import { DownloadSimple } from "@phosphor-icons/react";
import { buttonVariants } from "../components/Button.js";
import { SimulatedTag } from "../demo/DemoPanel.js";
import { useOrgtik } from "../provider/OrgtikProvider.js";
const labels = { en: ["Document preview", "Download packaged PDF", "Illustrative packaged PDF; the sample does not change with scene values."], ar: ["معاينة المستند", "تحميل PDF النموذجي", "ملف PDF توضيحي؛ لا يتغير الملف مع قيم السيناريو."], de: ["Dokumentvorschau", "Paket-PDF herunterladen", "Illustratives PDF; das Beispiel ändert sich nicht mit Szenenwerten."], fr: ["Aperçu du document", "Télécharger le PDF fourni", "PDF illustratif ; l’exemple ne change pas avec les valeurs de la scène."], it: ["Anteprima documento", "Scarica PDF incluso", "PDF illustrativo; l’esempio non cambia con i valori della scena."] } as const;
export function PdfPreview({ children, samplePdfHref }: { children: ReactNode; samplePdfHref: string }) {
  const { locale } = useOrgtik(), words = labels[locale];
  return <section aria-label={words[0]} className="flex flex-col gap-4 rounded-panel border border-line bg-raised p-5"><div className="flex flex-wrap items-center justify-between gap-3"><SimulatedTag /><a href={samplePdfHref} download className={buttonVariants({ variant: "secondary" })}><DownloadSimple aria-hidden="true" className="size-4" />{words[1]}</a></div><div className="min-w-0">{children}</div><p className="text-caption text-fg-muted">{words[2]}</p></section>;
}
