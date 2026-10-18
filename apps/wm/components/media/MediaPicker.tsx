"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Button,
  Field,
  FileField,
  Input,
  Pagination,
  ErrorState,
  Skeleton,
  Textarea,
  toast,
} from "@orgtik/ui";
import { Link } from "@/i18n/routing";
import { useCan } from "@/lib/permissions";
import { libraryUrl, mediaUrl } from "@/lib/env";
import {
  useMediaQuery,
  useUploadMediaMutation,
  type MediaItem,
} from "@/store/api";

export function MediaPicker({
  value,
  onChange,
  disabled = false,
  imagesOnly = false,
  iconOnly = false,
  kind,
}: {
  value: string;
  onChange: (src: string, media?: MediaItem) => void;
  disabled?: boolean;
  imagesOnly?: boolean;
  iconOnly?: boolean;
  kind?: "image" | "video";
}) {
  const t = useTranslations("Improvements");
  const tm = useTranslations("Media");
  const can = useCan();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [files, setFiles] = useState<File[]>([]);
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [choosing, setChoosing] = useState(!value && !iconOnly);
  const [uploadingNew, setUploadingNew] = useState(false);
  const library = useMediaQuery(
    {
      page,
      pageSize: 10,
      search,
      kind: kind ?? (imagesOnly ? "image" : undefined),
    },
    { skip: disabled || !choosing || !can("media:view") },
  );
  const [upload, uploading] = useUploadMediaMutation();
  const selection = useMediaQuery(
    { page: 1, pageSize: 10, search: value.split("/").pop() ?? "" },
    { skip: !value || !can("media:view") },
  );
  const selected = selection.data?.items.find(
    (item) =>
      (item.source === "upload" ? libraryUrl(item) : item.file) === value,
  );
  const video =
    kind === "video" ||
    selected?.kind === "video" ||
    /\.(mp4|webm)(\?|$)/i.test(value);
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-field border border-line p-3">
      {value ? (
        <div className="flex flex-wrap items-center gap-3">
          {video ? (
            <video
              src={mediaUrl(value)}
              controls
              preload="metadata"
              className="max-h-44 max-w-full rounded-field"
            />
          ) : (
            <img
              src={mediaUrl(value)}
              alt={selected?.alt.en ?? ""}
              className="h-28 max-w-full rounded-field object-contain"
            />
          )}
          <span className="min-w-0 flex-1 break-all text-body-sm text-fg-muted">
            {selected?.file ?? value.split("/").pop()}
          </span>
        </div>
      ) : null}
      {!disabled || (value && selected && can("media:edit")) ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {!disabled ? (
            <div className="flex flex-wrap items-center gap-2">
              {can("media:view") ? (
                <Button
                  variant="secondary"
                  size="sm"
                  aria-expanded={choosing}
                  onClick={() => setChoosing(!choosing)}
                >
                  {value ? t("replaceMedia") : t("selectMedia")}
                </Button>
              ) : null}
              {can("media:create") ? (
                <Button
                  variant="secondary"
                  size="sm"
                  aria-expanded={uploadingNew}
                  onClick={() => setUploadingNew(!uploadingNew)}
                >
                  {t(imagesOnly || iconOnly || kind === "image" ? "uploadImage" : kind === "video" ? "uploadVideo" : "upload")}
                </Button>
              ) : null}
              {!can("media:view") && !can("media:create") ? (
                <p className="text-body-sm text-fg-muted">{t("mediaPermission")}</p>
              ) : null}
            </div>
          ) : null}
          {value ? (
            <div className="ms-auto flex items-center gap-3">
              {selected && can("media:edit") ? (
                <Link
                  href={`/media/${selected.id}`}
                  className="text-body-sm text-fg-brand underline"
                >
                  {t("edit")}
                </Link>
              ) : null}
              {!disabled ? (
                <Button variant="danger" size="sm" onClick={() => onChange("")}>
                  {t("remove")}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {!disabled && choosing && can("media:view") ? (
        <>
          <Input
            type="search"
            size="sm"
            aria-label={tm("search")}
            placeholder={tm("search")}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          {library.isFetching ? (
            <Skeleton className="h-40 w-full" />
          ) : library.isError ? (
            <ErrorState size="compact" onRetry={library.refetch} />
          ) : library.data?.items.length ? (
            <div
              aria-label={t("selectMedia")}
              className="grid grid-cols-[repeat(auto-fill,minmax(min(8rem,100%),1fr))] gap-3"
            >
              {library.data.items.filter(item => !iconOnly || /\.(svg|png)$/i.test(item.file)).map((item) => {
                const src =
                  item.source === "upload" ? libraryUrl(item) : item.file;
                return (
                  <button
                    type="button"
                    key={item.id}
                    aria-pressed={value === src}
                    onClick={() => {
                      onChange(src, item);
                      setChoosing(false);
                    }}
                    className="group flex min-w-0 flex-col overflow-hidden rounded-field border border-line bg-raised text-start hover:border-fg-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg-brand aria-pressed:border-fg-brand"
                  >
                    <span className="flex aspect-video w-full items-center justify-center overflow-hidden bg-sunken">
                      {item.kind === "video" ? (
                        <video
                          src={`${mediaUrl(src)}#t=0.1`}
                          muted
                          preload="metadata"
                          aria-hidden
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <img
                          src={mediaUrl(src)}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-contain"
                        />
                      )}
                    </span>
                    <span className="flex flex-col gap-1 p-2">
                      <span title={item.file} className="truncate text-body-sm font-medium text-fg">
                        {item.file}
                      </span>
                      <span className="text-caption text-fg-muted">
                        {item.kind === "video" ? t("video") : t("image")}
                        {item.width && item.height
                          ? ` · ${item.width} × ${item.height}`
                          : ""}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p role="status" className="py-4 text-body-sm text-fg-muted">
              {t("noMediaResults")}
            </p>
          )}
          {(library.data?.total ?? 0) > 10 ? (
            <Pagination
              page={page}
              pageSize={10}
              total={library.data?.total ?? 0}
              onPageChange={setPage}
            />
          ) : null}
        </>
      ) : null}
      {!disabled && uploadingNew && can("media:create") ? (
        <div className="flex flex-col gap-3 border-t border-line pt-3">
          <FileField
            label={tm("file")}
            value={files}
            onChange={setFiles}
            accept={
              iconOnly ? "image/png,image/svg+xml" : kind === "video"
                ? "video/mp4,video/webm"
                : imagesOnly || kind === "image"
                  ? "image/png,image/jpeg,image/webp"
                  : "image/png,image/jpeg,image/webp,image/svg+xml,video/mp4,video/webm"
            }
            maxSize={15 * 1024 * 1024}
            maxFiles={1}
            multiple={false}
          />
          <Field label={t("description")}>
            <Textarea
              value={description}
              maxLength={2000}
              onChange={(event) => setDescription(event.target.value)}
            />
          </Field>
          <Field label={t("tags")}>
            <Input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
            />
          </Field>
          <Button
            size="sm"
            disabled={!files.length}
            loading={uploading.isLoading}
            onClick={async () => {
              try {
                const item = await upload({
                  file: files[0],
                  description,
                  tags: tags
                    .split(/[,،]/)
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                }).unwrap();
                onChange(libraryUrl(item), item);
                setFiles([]);
                setDescription("");
                setTags("");
                setUploadingNew(false);
                setChoosing(false);
              } catch {
                toast.error(tm("failed"));
              }
            }}
          >
            {tm("upload")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
