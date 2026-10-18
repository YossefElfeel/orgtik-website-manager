"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { LoadingState, ErrorState, EmptyState, Textarea, Button, ConfirmDialog, Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Field, Input, Select, StatusBadge, toast, useFormatter, useStatusLabel } from "@orgtik/ui";


import { useCan } from "@/lib/permissions";
import { Link } from "@/i18n/routing";
import { LifecycleProgress } from "./LifecycleProgress";
import { useIdeaQuery, useEditIdeaMutation } from "@/store/api";
import {
  statusOf,
  useIdeasQuery,
  useModerateIdeaMutation,
  useEraseIdeaMutation,
  useModerateIdeaCommentMutation,
  useNoteIdeaMutation,
  type ApiError,
  type Idea,
  type IdeaAction,
  type IdeaStatus,
} from "@/store/api";

// The tabs: what needs a decision first, then the public lifecycle, then everything closed.
// What can be done from each status (status matrix roadmap_idea). The first one is the main action.
export const NEXT: Partial<Record<IdeaStatus, IdeaAction[]>> = {
  pending: ["publish", "merge", "decline", "hide"],
  open: ["plan", "merge", "decline", "hide"],
  planned: ["start", "hide"],
  in_progress: ["ship", "hide"],
  shipped: ["hide"],
};
const VISIBLE: IdeaStatus[] = ["open", "planned", "in_progress", "shipped"];

/** One action on one idea, with what it asks for: a reason, a link, or the idea to merge into. */
export function ActionDialog({
  idea,
  action,
  onClose,
}: {
  idea: Idea;
  action: IdeaAction;
  onClose: () => void;
}) {
  const t = useTranslations("Ideas");
  const [moderate, moderating] = useModerateIdeaMutation();
  const [targetSearch, setTargetSearch] = useState("");
  const others = useIdeasQuery({ pageSize: 100, mergeable: true, search: targetSearch || undefined }, { skip: action !== "merge" });
  const [into, setInto] = useState<string | null>(null);
  const run = (extra: { reason?: string; link?: string; into?: string } = {}) =>
    moderate({ id: idea.id, version: idea.version, action, ...extra })
      .unwrap()
      .then(() => {
        toast.success(t(`done.${action}`));
        onClose();
      })
      .catch((e: ApiError) => {
        if (e.status === 412) toast.error(t("stale"));
        else if (e.fieldErrors?.link) toast.error(t("errorLink"));
        else toast.error(t("failed"));
        throw e;
      });

  if (action === "merge") {
    const targets = (others.data?.items ?? []).filter(
      (x) => x.id !== idea.id && VISIBLE.includes(x.status),
    );
    return (
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>{t("mergeTitle")}</DialogTitle>
            <DialogDescription>
              {t("mergeImpact", { votes: idea.votes })}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Field label={t("searchTopics")}>
              <Input type="search" value={targetSearch} onChange={event => { setTargetSearch(event.target.value); setInto(null); }} />
            </Field>
            {others.error ? <ErrorState onRetry={others.refetch} /> : others.isFetching ? <LoadingState rows={2} /> : targets.length === 0 ? <p className="text-body-sm text-fg-muted">{t("noMergeTargets")}</p> : null}
            <Field label={t("mergeInto")}>
              <Select
                value={into}
                disabled={others.isFetching || !!others.error || !targets.length}
                onValueChange={setInto}
                placeholder={t("mergePick")}
                options={targets.map((x) => ({
                  value: x.id,
                  label: <span dir="auto">{x.title}</span>,
                }))}
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button
              disabled={!into || others.isFetching || !!others.error}
              loading={moderating.isLoading}
              onClick={() => into && run({ into }).catch(() => {})}
            >
              {t("actions.merge")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
  const asks =
    action === "ship"
      ? { label: t("shipLink"), required: true, placeholder: "/software" }
      : action === "decline" || action === "hide"
        ? { label: t(`reason.${action}`), required: true }
        : undefined;
  return (
    <ConfirmDialog
      open
      onOpenChange={(o) => !o && onClose()}
      tone={action === "hide" ? "danger" : "primary"}
      title={t(`confirm.${action}`, { title: idea.title })}
      impact={t(`impact.${action}`)}
      reason={asks}
      confirmLabel={t(`actions.${action}`)}
      onConfirm={({ reason }) =>
        run(action === "ship" ? { link: reason } : asks ? { reason } : {})
      }
    />
  );
}

export function IdeaDetailContent({
  idea,
  onClose,
}: {
  idea: Idea;
  onClose: () => void;
}) {
  const t = useTranslations("Ideas");
  const ti = useTranslations("Improvements");
  const te = useTranslations("Editor");
  const statusLabel = useStatusLabel();
  const [editing, setEditing] = useState(useSearchParams().get("edit") === "1");
  const [fields, setFields] = useState({
    title: idea.title,
    body: idea.body,
    theme: idea.theme,
  });
  const [save, saving] = useEditIdeaMutation();
  const [acting, setActing] = useState<IdeaAction | null>(null);
  const f = useFormatter();
  const can = useCan();
  const [erase] = useEraseIdeaMutation();
  const [moderateComment, commentMutation] = useModerateIdeaCommentMutation();
  const [addNote, noteMutation] = useNoteIdeaMutation();
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState("");
  const [discussionError, setDiscussionError] = useState("");
  const commentAction = async (commentId: string, action: "publish" | "hide" | "delete") => {
    setDiscussionError("");
    try {
      await moderateComment({ id: idea.id, version: idea.version, commentId, action }).unwrap();
      toast.success(t(`commentDone.${action}`));
    } catch (error) {
      setDiscussionError(t(statusOf(error) === 412 ? "stale" : "failed"));
      throw error;
    }
  };
  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <div>
        <header>
          <h1 className="mb-3 font-display text-title-lg">
            <span dir="auto">{idea.title}</span>
          </h1>
          <div>
            <span className="inline-flex flex-wrap items-center gap-2">
              <StatusBadge
                entity="roadmap_idea"
                state={idea.status}
                size="sm"
              />
              <span dir="auto">{idea.theme}</span>
            </span>
          </div>
        </header>
        <div className="flex flex-col gap-5">
          <LifecycleProgress
            label={t("history")}
            current={idea.status}
            visited={idea.history.flatMap((event) =>
              event.to ? [event.to] : [],
            )}
            stages={(
              ["pending", "open", "planned", "in_progress", "shipped"] as const
            ).map((key) => ({
              key,
              label:
                key === "open"
                  ? ti("opened")
                  : statusLabel("roadmap_idea", key),
            }))}
            outcome={<StatusBadge entity="roadmap_idea" state={idea.status} />}
          />
          {can("marketing:edit") ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setFields({
                    title: idea.title,
                    body: idea.body,
                    theme: idea.theme,
                  });
                  setEditing((value) => !value);
                }}
              >
                {ti("edit")}
              </Button>
              {(NEXT[idea.status] ?? []).map((action) => (
                <Button
                  key={action}
                  variant={
                    action === "hide" || action === "decline"
                      ? "warning"
                      : "secondary"
                  }
                  onClick={() => setActing(action)}
                >
                  {t(`actions.${action}`)}
                </Button>
              ))}
            </div>
          ) : null}
          {editing && can("marketing:edit") ? (
            <div className="flex flex-col gap-3">
              <Field label={t("colIdea")}>
                <Input
                  maxLength={180}
                  value={fields.title}
                  onChange={(event) =>
                    setFields((previous) => ({
                      ...previous,
                      title: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label={ti("description")}>
                <Textarea
                  maxLength={5000}
                  rows={5}
                  value={fields.body}
                  onChange={(event) =>
                    setFields((previous) => ({
                      ...previous,
                      body: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field label={t("colTheme")}>
                <Input
                  maxLength={100}
                  value={fields.theme}
                  onChange={(event) =>
                    setFields((previous) => ({
                      ...previous,
                      theme: event.target.value,
                    }))
                  }
                />
              </Field>
              <Button
                className="self-start"
                loading={saving.isLoading}
                onClick={async () => {
                  try {
                    await save({
                      id: idea.id,
                      version: idea.version,
                      ...fields,
                    }).unwrap();
                    setEditing(false);
                    toast.success(te("saved"));
                  } catch (error) {
                    toast.error(
                      t(statusOf(error) === 412 ? "stale" : "failed"),
                    );
                  }
                }}
              >
                {te("save")}
              </Button>
            </div>
          ) : null}
          {acting ? (
            <ActionDialog
              idea={idea}
              action={acting}
              onClose={() => setActing(null)}
            />
          ) : null}
          <p dir="auto" className="text-body text-fg">
            {idea.body}
          </p>
          <p className="text-body-sm text-fg-muted">
            {t("counts", { votes: idea.votes, comments: idea.comments })}
          </p>
          {idea.source ? (
            <p className="text-body-sm text-fg-muted">
              {t("source")}:{" "}
              <bdi>
                {idea.source === "website" ? t("sourceWebsite") : idea.source}
              </bdi>
            </p>
          ) : null}
          {idea.submitter ? (
            <section
              className="flex flex-col gap-2"
              aria-labelledby="idea-submitter"
            >
              <h3 id="idea-submitter" className="text-label">
                {t("submitter")}
              </h3>
              {idea.submitter.erased ? (
                <p>{t("erased")}</p>
              ) : (
                <>
                  <p dir="auto">{idea.submitter.name}</p>
                  <p dir="ltr" className="break-words text-start">
                    {idea.submitter.email}
                  </p>
                  {idea.submitter.masked ? (
                    <p className="text-body-sm text-fg-muted">{t("masked")}</p>
                  ) : null}
                  {can("leads:pii") ? (
                    <ConfirmDialog
                      tone="danger"
                      trigger={
                        <Button size="sm" variant="danger">
                          {t("erase")}
                        </Button>
                      }
                      title={t("eraseTitle")}
                      impact={t("eraseImpact")}
                      confirmLabel={t("erase")}
                      onConfirm={() =>
                        erase({ id: idea.id, version: idea.version })
                          .unwrap()
                          .then(() => {
                            toast.success(t("erased"));
                            onClose();
                          })
                          .catch((error: ApiError) => {
                            toast.error(
                              t(error.status === 412 ? "stale" : "failed"),
                            );
                            throw error;
                          })
                      }
                    />
                  ) : null}
                </>
              )}
            </section>
          ) : null}
            <section
              className="flex flex-col gap-3"
              aria-labelledby="idea-comments"
            >
              <h3 id="idea-comments" className="text-label">
                {idea.sample ? t("sampleComments") : t("commentsTitle")}
              </h3>
              {discussionError ? <p role="alert" className="text-body-sm text-danger">{discussionError}</p> : null}
              {!idea.commentPreview?.length ? <p className="text-body-sm text-fg-muted">{t("noComments")}</p> : null}
              <ol className="flex flex-col gap-3">
                {(idea.commentPreview ?? []).map((comment) => (
                  <li
                    key={comment.id}
                    className="rounded-field border border-line p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p dir="auto" className="text-label break-words">{comment.author}</p>
                      <span className="text-caption text-fg-muted">{t(`commentStatus.${comment.status ?? "published"}`)}</span>
                    </div>
                    <p dir="auto" className="mt-1 whitespace-pre-wrap break-words text-body-sm">
                      {comment.body}
                    </p>
                    {can("marketing:edit") ? <div className="mt-3 flex flex-wrap gap-2">
                      {comment.status && comment.status !== "published" ? <Button size="sm" variant="secondary" disabled={commentMutation.isLoading} onClick={() => commentAction(comment.id, "publish").catch(() => {})}>{t("commentActions.publish")}</Button> : <Button size="sm" variant="secondary" disabled={commentMutation.isLoading} onClick={() => commentAction(comment.id, "hide").catch(() => {})}>{t("commentActions.hide")}</Button>}
                      <ConfirmDialog tone="danger" trigger={<Button size="sm" variant="danger" disabled={commentMutation.isLoading}>{t("commentActions.delete")}</Button>} title={t("deleteCommentTitle")} impact={t("deleteCommentImpact")} confirmLabel={t("commentActions.delete")} onConfirm={() => commentAction(comment.id, "delete")} />
                    </div> : null}
                  </li>
                ))}
              </ol>
            </section>
          <section aria-labelledby="idea-notes" className="flex flex-col gap-3">
            <div>
              <h3 id="idea-notes" className="text-label">{t("notesTitle")}</h3>
              <p className="mt-1 text-body-sm text-fg-muted">{t("notesPrivate")}</p>
            </div>
            {can("marketing:edit") ? <form className="flex flex-col gap-2" onSubmit={async event => {
              event.preventDefault();
              if (!note.trim() || noteMutation.isLoading) return;
              setNoteError("");
              try {
                await addNote({ id: idea.id, version: idea.version, text: note }).unwrap();
                setNote("");
                toast.success(t("noteSaved"));
              } catch (error) {
                setNoteError(t(statusOf(error) === 412 ? "stale" : "failed"));
              }
            }}>
              <Field label={t("newNote")}>
                <Textarea dir="auto" rows={3} maxLength={5000} value={note} onChange={event => setNote(event.target.value)} />
              </Field>
              <Button type="submit" size="sm" variant="secondary" className="self-start" disabled={!note.trim()} loading={noteMutation.isLoading}>{t("saveNote")}</Button>
              {noteError ? <p role="alert" className="text-body-sm text-danger">{noteError}</p> : null}
            </form> : null}
            {!idea.notes?.length ? <p className="text-body-sm text-fg-muted">{t("noNotes")}</p> : null}
            <ol className="flex flex-col gap-3">
              {(idea.notes ?? []).map(item => <li key={item.id} className="border-b border-line pb-3 last:border-0">
                <p dir="auto" className="whitespace-pre-wrap break-words text-body-sm">{item.text}</p>
                <p className="mt-1 text-caption text-fg-muted">{f.date(item.at, { dateStyle: "medium", timeStyle: "short" })} · <bdi dir="auto">{item.by.name}</bdi></p>
              </li>)}
            </ol>
          </section>
          {idea.reason ? (
            <p className="text-body-sm text-fg">
              <span className="font-semibold">{t("reasonLabel")}:</span>{" "}
              <span dir="auto">{idea.reason}</span>
            </p>
          ) : null}
          {idea.link ? (
            <p className="text-body-sm text-fg">
              <span className="font-semibold">{t("shipLink")}:</span>{" "}
              <span dir="ltr">{idea.link}</span>
            </p>
          ) : null}
          {idea.mergedInto ? (
            <p className="text-body-sm text-fg">
              <span className="font-semibold">{t("mergedInto")}:</span>{" "}
              <Link href={`/marketing/ideas/${idea.mergedInto}`} className="font-semibold text-accent hover:underline"><bdi>{idea.mergedIntoTitle ?? idea.mergedInto}</bdi></Link>
            </p>
          ) : null}
          <section
            aria-labelledby="idea-history"
            className="flex flex-col gap-2"
          >
            <h3 id="idea-history" className="text-label text-fg">
              {t("history")}
            </h3>
            <ol className="flex flex-col gap-2">
              {idea.history.map((h, i) => (
                <li
                  key={i}
                  className="border-b border-line pb-2 text-body-sm last:border-0"
                >
                  <span className="text-fg">{t(`log.${h.action}`)}</span>
                  <span className="text-fg-muted">
                    {" "}
                    ·{" "}
                    {f.date(h.at, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}{" "}
                    · <bdi dir="auto">{h.by.name ?? t("visitor")}</bdi>
                  </span>
                  {h.reason ? (
                    <span dir="auto" className="block text-fg-muted">
                      {h.reason}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}

export function IdeaDetail({ id }: { id: string }) {
  const query = useIdeaQuery(id);
  const t = useTranslations("Ideas");
  if (query.isLoading) return <LoadingState rows={5} />;
  if (statusOf(query.error) === 404) return <EmptyState title={t("noMatch")} />;
  if (!query.data || query.error) return <ErrorState onRetry={query.refetch} />;
  return (
    <IdeaDetailContent
      key={id}
      idea={query.data}
      onClose={() => query.refetch()}
    />
  );
}
