"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowClockwise, ArrowSquareOut, CheckCircle, Warning, WarningCircle } from "@phosphor-icons/react";
import { Button, Card, Combobox, ErrorState, IconButton, LoadingState, NoPermissionState, PageHeader, SegmentedControl, Spinner } from "@orgtik/ui";
import { RequirePermission } from "@/components/frame/RequirePermission";
import { WEBSITE_URL } from "@/lib/env";
import { statusOf, usePreviewAddressesQuery, usePreviewTokenMutation } from "@/store/api";

// The three widths the site is checked at (the parity harness uses the same ones).
const FRAMES = [
  { key: "phone", width: 390, height: 844 },
  { key: "tablet", width: 768, height: 1024 },
  { key: "desktop", width: 1440, height: 900 },
] as const;
type FrameKey = (typeof FRAMES)[number]["key"];
type FrameState = { status: "loading" | "ready" | "error"; path?: string; overflow?: boolean; message?: string };

// The site may be opened as localhost or 127.0.0.1; both are the same local site.
const siteOrigins = () => {
  const o = new URL(WEBSITE_URL).origin;
  return new Set([o, o.replace("//localhost", "//127.0.0.1"), o.replace("//127.0.0.1", "//localhost")]);
};

function Frame({ frame, src, token, scale, onState }: { frame: (typeof FRAMES)[number]; src: string; token: string; scale: number; onState: (s: FrameState) => void }) {
  const ref = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const origins = siteOrigins();
    const listen = (event: MessageEvent) => {
      if (event.source !== ref.current?.contentWindow || !origins.has(event.origin)) return;
      const d = event.data as { type?: string; path?: string; overflow?: boolean; message?: string };
      // The site asks for the token when it opens; only this frame's window gets it.
      if (d?.type === "orgtik:preview-ready") ref.current?.contentWindow?.postMessage({ type: "orgtik:preview-token", token }, event.origin);
      if (d?.type === "orgtik:preview-state") onState({ status: "ready", path: d.path, overflow: d.overflow });
      if (d?.type === "orgtik:preview-error") onState({ status: "error", message: d.message });
    };
    window.addEventListener("message", listen);
    return () => window.removeEventListener("message", listen);
  }, [token, onState]);
  return (
    <div className="overflow-hidden rounded-field border border-line bg-surface-sunken" style={{ width: frame.width * scale, height: frame.height * scale }}>
      <iframe
        ref={ref}
        title={frame.key}
        src={src}
        className="origin-top-left border-0 bg-white rtl:origin-top-right"
        style={{ width: frame.width, height: frame.height, transform: `scale(${scale})` }}
      />
    </div>
  );
}

function PreviewView() {
  const t = useTranslations("Preview");
  const params = useSearchParams();
  const addresses = usePreviewAddressesQuery(undefined, { refetchOnMountOrArgChange: true });
  const [getToken, tokenState] = usePreviewTokenMutation();
  const [token, setToken] = useState<string | null>(null);
  const [path, setPath] = useState(params.get("path") ?? "/");
  const [only, setOnly] = useState<"all" | FrameKey>("all");
  const [reload, setReload] = useState(0);
  const [states, setStates] = useState<Record<string, FrameState>>({});
  const [width, setWidth] = useState(1200);
  // Measured once the page is on screen (it first shows a loading state), and on every resize.
  const observer = useRef<ResizeObserver | null>(null);
  const box = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect();
    if (!el) return;
    observer.current = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    observer.current.observe(el);
  }, []);

  const open = useCallback(() => {
    setStates({});
    getToken()
      .unwrap()
      .then((r) => {
        setToken(r.token);
        setReload((n) => n + 1);
      })
      .catch(() => setToken(null));
  }, [getToken]);
  useEffect(() => open(), [open]);

  const shown = FRAMES.filter((f) => only === "all" || f.key === only);
  // All frames side by side at one scale, fitting the space (never larger than life).
  const gap = 16;
  // (A few pixels spare: rounded frame widths must not wrap the last one onto a new row.)
  const scale = Math.min(1, Math.floor(((Math.max(only === "all" ? 1000 : 0, width) - gap * (shown.length - 1) - 4) / shown.reduce((n, f) => n + f.width, 0)) * 1000) / 1000);
  const src = `${WEBSITE_URL}${path}?preview`;
  const setState = useMemo(() => Object.fromEntries(FRAMES.map((f) => [f.key, (s: FrameState) => setStates((x) => ({ ...x, [f.key]: s }))])) as Record<FrameKey, (s: FrameState) => void>, []);
  const options = (addresses.data ?? []).map((a) => ({ value: a.path, label: a.path, hint: `${a.name}${a.draft ? ` · ${t("hasDraft")}` : ""}${a.onSite ? "" : ` · ${t("notOnSite")}`}` }));
  if (!options.some((o) => o.value === path)) options.unshift({ value: path, label: path, hint: "" });

  const s = statusOf(addresses.error);
  if (s === 403) return <NoPermissionState />;
  if (addresses.isLoading) return <LoadingState rows={3} />;
  if (addresses.error) return <ErrorState onRetry={addresses.refetch} />;

  return (
    <div ref={box} className="flex flex-col gap-6">
      <PageHeader title={t("title")} description={t("description")} />
      <Card className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-64 flex-1 flex-col gap-1.5">
          <span aria-hidden="true" className="text-label text-fg">
            {t("address")}
          </span>
          <div dir="ltr">
            <Combobox aria-label={t("address")} options={options} value={path} onValueChange={(v) => v && setPath(v)} emptyText={t("noAddress")} />
          </div>
        </div>
        <SegmentedControl
          label={t("widths")}
          value={only}
          onValueChange={setOnly}
          segments={[{ value: "all", label: t("all") }, ...FRAMES.map((f) => ({ value: f.key, label: <span dir="ltr">{f.width}</span> }))]}
        />
        <IconButton label={t("reload")} variant="secondary" icon={<ArrowClockwise />} onClick={open} />
        <Button variant="ghost" startIcon={<ArrowSquareOut />} onClick={() => window.open(`${WEBSITE_URL}${path}`, "_blank", "noopener")}>
          {t("openLive")}
        </Button>
      </Card>

      {tokenState.isError ? (
        <ErrorState title={t("tokenFailed")} description={t("tokenFailedBody")} onRetry={open} />
      ) : !token ? (
        <div className="flex justify-center py-10">
          <Spinner label={t("opening")} />
        </div>
      ) : (
        <div className="flex flex-nowrap items-start gap-4 overflow-x-auto pb-4">
          {shown.map((f) => {
            const st = states[f.key];
            return (
              <figure key={f.key} className="flex shrink-0 flex-col gap-2">
                <figcaption className="flex min-h-12 items-center justify-between gap-3 text-body-sm">
                  <span className="text-fg">
                    {t(f.key)} · <span dir="ltr">{f.width}px</span>
                  </span>
                  {!st || st.status === "loading" ? (
                    <span className="text-fg-subtle">{t("loading")}</span>
                  ) : st.status === "error" ? (
                    <span className="inline-flex items-center gap-1 text-danger">
                      <WarningCircle aria-hidden="true" className="size-4" />
                      {t("frameFailed")}
                    </span>
                  ) : st.overflow ? (
                    <span className="inline-flex items-center gap-1 text-warning">
                      <Warning aria-hidden="true" className="size-4" />
                      {t("overflows")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-success">
                      <CheckCircle aria-hidden="true" className="size-4" />
                      {t("fits")}
                    </span>
                  )}
                </figcaption>
                <Frame key={`${f.key}-${reload}-${path}`} frame={f} src={src} token={token} scale={scale} onState={setState[f.key]} />
              </figure>
            );
          })}
        </div>
      )}
      <p className="text-caption text-fg-subtle">{t("note")}</p>
    </div>
  );
}

export default function PreviewPage() {
  return (
    <RequirePermission permission="content:view">
      <PreviewView />
    </RequirePermission>
  );
}
