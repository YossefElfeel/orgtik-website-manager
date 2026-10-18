"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Avatar } from "./Display.js";
import { Button } from "./Button.js";
import { Textarea } from "./Input.js";
import { useFormatter, useOrgtik } from "../provider/OrgtikProvider.js";
import { suiteText } from "../suite/strings.js";
export function CommentThread({ comments, people = [], onPost, readOnly, label }) {
    const [text, setText] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState();
    const { locale } = useOrgtik(), f = useFormatter();
    const query = text.match(/@([^@\n]*)$/)?.[1]?.toLocaleLowerCase(), matches = query === undefined ? [] : people.filter(person => person.name.toLocaleLowerCase().includes(query)).slice(0, 5);
    const post = async () => { if (!onPost || !text.trim())
        return; setBusy(true); setError(undefined); try {
        await onPost(text.trim(), people.filter(person => text.includes(`@${person.name}`)).map(person => person.id));
        setText("");
    }
    catch (failure) {
        setError(failure instanceof Error ? failure.message : suiteText(locale, "retry"));
    }
    finally {
        setBusy(false);
    } };
    return _jsxs("section", { "aria-label": label, className: "flex flex-col gap-4", children: [_jsx("ol", { className: "space-y-4", children: comments.map(comment => _jsxs("li", { className: "flex gap-3", children: [_jsx(Avatar, { name: comment.author.name, src: comment.author.avatar, size: "sm", decorative: true }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex flex-wrap items-baseline gap-2", children: [_jsx("span", { dir: "auto", className: "text-body-sm font-semibold", children: comment.author.name }), _jsx("time", { dateTime: comment.at, className: "text-caption text-fg-subtle", children: f.date(comment.at, { dateStyle: "medium", timeStyle: "short" }) })] }), _jsx("p", { dir: "auto", className: "mt-1 whitespace-pre-wrap break-words text-body-sm text-fg", children: comment.text })] })] }, comment.id)) }), !readOnly && onPost ? _jsxs("form", { onSubmit: event => { event.preventDefault(); void post(); }, className: "flex flex-col gap-2", children: [_jsx(Textarea, { "aria-label": suiteText(locale, "comment"), value: text, maxLength: 10000, disabled: busy, onChange: event => setText(event.target.value), rows: 3 }), matches.length ? _jsx("div", { "aria-label": suiteText(locale, "members"), className: "flex flex-wrap gap-1", children: matches.map(person => _jsxs(Button, { size: "xs", variant: "ghost", shape: "control", onClick: () => setText(previous => previous.replace(/@([^@\n]*)$/, `@${person.name} `)), children: ["@", person.name] }, person.id)) }) : null, error ? _jsx("p", { role: "alert", className: "text-body-sm text-danger", children: error }) : null, _jsx(Button, { type: "submit", size: "sm", loading: busy, disabled: !text.trim(), className: "self-end", children: suiteText(locale, "post") })] }) : null] });
}
//# sourceMappingURL=CommentThread.js.map