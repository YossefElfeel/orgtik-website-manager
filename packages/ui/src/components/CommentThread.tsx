"use client";
import { useState } from "react";
import { Avatar } from "./Display.js";
import { Button } from "./Button.js";
import { Textarea } from "./Input.js";
import { useFormatter, useOrgtik } from "../provider/OrgtikProvider.js";
import { suiteText } from "../suite/strings.js";
import type { SuitePerson } from "../suite/types.js";
export type Comment = { id: string; author: SuitePerson; text: string; at: string; mentions?: string[] };
export function CommentThread({ comments, people = [], onPost, readOnly, label }: { comments: Comment[]; people?: SuitePerson[]; onPost?: (text: string, mentions: string[]) => Promise<unknown>; readOnly?: boolean; label: string }) {
  const [text, setText] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState<string>();
  const { locale } = useOrgtik(), f = useFormatter();
  const query = text.match(/@([^@\n]*)$/)?.[1]?.toLocaleLowerCase(), matches = query === undefined ? [] : people.filter(person => person.name.toLocaleLowerCase().includes(query)).slice(0, 5);
  const post = async () => { if (!onPost || !text.trim()) return; setBusy(true); setError(undefined); try { await onPost(text.trim(), people.filter(person => text.includes(`@${person.name}`)).map(person => person.id)); setText(""); } catch (failure) { setError(failure instanceof Error ? failure.message : suiteText(locale, "retry")); } finally { setBusy(false); } };
  return <section aria-label={label} className="flex flex-col gap-4"><ol className="space-y-4">{comments.map(comment => <li key={comment.id} className="flex gap-3"><Avatar name={comment.author.name} src={comment.author.avatar} size="sm" decorative /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline gap-2"><span dir="auto" className="text-body-sm font-semibold">{comment.author.name}</span><time dateTime={comment.at} className="text-caption text-fg-subtle">{f.date(comment.at, { dateStyle: "medium", timeStyle: "short" })}</time></div><p dir="auto" className="mt-1 whitespace-pre-wrap break-words text-body-sm text-fg">{comment.text}</p></div></li>)}</ol>{!readOnly && onPost ? <form onSubmit={event => { event.preventDefault(); void post(); }} className="flex flex-col gap-2"><Textarea aria-label={suiteText(locale, "comment")} value={text} maxLength={10000} disabled={busy} onChange={event => setText(event.target.value)} rows={3} />{matches.length ? <div aria-label={suiteText(locale, "members")} className="flex flex-wrap gap-1">{matches.map(person => <Button key={person.id} size="xs" variant="ghost" shape="control" onClick={() => setText(previous => previous.replace(/@([^@\n]*)$/, `@${person.name} `))}>@{person.name}</Button>)}</div> : null}{error ? <p role="alert" className="text-body-sm text-danger">{error}</p> : null}<Button type="submit" size="sm" loading={busy} disabled={!text.trim()} className="self-end">{suiteText(locale, "post")}</Button></form> : null}</section>;
}
