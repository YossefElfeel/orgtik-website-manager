"use client";
import { useEffect, useId, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { TextB, TextItalic, ListBullets, ListNumbers, Quotes, Code, ArrowUUpLeft, ArrowUUpRight } from "@phosphor-icons/react";
import { IconButton } from "../components/IconButton.js";
import { useOrgtik } from "../provider/OrgtikProvider.js";
export type RichTextFormat = { bold: boolean; italic: boolean; bullets: boolean };
export type RichTextEditorProps = { label: string; value: string; onChange: (value: string) => void; contentFormat?: "html" | "text"; format?: RichTextFormat; onFormatChange?: (format: RichTextFormat) => void; placeholder?: string; disabled?: boolean; rows?: number; maxLength?: number; error?: string; onBlur?: () => void };
const labels = { en: ["Bold", "Italic", "Bullet list", "Numbered list", "Quote", "Code", "Undo", "Redo"], ar: ["عريض", "مائل", "قائمة نقطية", "قائمة مرقّمة", "اقتباس", "كود", "تراجع", "إعادة"], de: ["Fett", "Kursiv", "Aufzählung", "Nummerierte Liste", "Zitat", "Code", "Rückgängig", "Wiederholen"], fr: ["Gras", "Italique", "Liste à puces", "Liste numérotée", "Citation", "Code", "Annuler", "Rétablir"], it: ["Grassetto", "Corsivo", "Elenco puntato", "Elenco numerato", "Citazione", "Codice", "Annulla", "Ripeti"] } as const;
const escaped = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").split("\n").map(line => `<p>${line || "<br>"}</p>`).join("");
export function RichTextEditor({ label, value, onChange, contentFormat, format, onFormatChange, placeholder, disabled, rows = 3, maxLength = 10000, error, onBlur }: RichTextEditorProps) {
  const id = useId(), { locale } = useOrgtik(), words = labels[locale];
  const mode = contentFormat || (format ? "text" : "html");
  const callbacks = useRef({ onChange, onFormatChange, onBlur, mode, maxLength }); callbacks.current = { onChange, onFormatChange, onBlur, mode, maxLength };
  const editor = useEditor({ immediatelyRender: false, editable: !disabled, content: mode === "html" ? value : escaped(value), extensions: [StarterKit.configure({ heading: { levels: [2,3] } }), Placeholder.configure({ placeholder: placeholder || "" })], editorProps: { attributes: { id, role: "textbox", "aria-label": label, "aria-multiline": "true", "aria-readonly": String(Boolean(disabled)), class: "ot-rich-text min-h-24 p-3 font-body text-body outline-none", dir: "auto" } }, onUpdate: ({ editor: current }) => {
    if (current.getText().length > callbacks.current.maxLength) { current.commands.undo(); return; }
    callbacks.current.onChange(callbacks.current.mode === "html" ? current.getHTML() : current.getText({ blockSeparator: "\n" }));
    callbacks.current.onFormatChange?.({ bold: current.isActive("bold"), italic: current.isActive("italic"), bullets: current.isActive("bulletList") });
  }, onBlur: () => callbacks.current.onBlur?.() });
  useEffect(() => { if (!editor) return; editor.setEditable(!disabled); const current = mode === "html" ? editor.getHTML() : editor.getText({ blockSeparator: "\n" }); if (current !== value) editor.commands.setContent(mode === "html" ? value : escaped(value), { emitUpdate: false }); }, [editor, value, disabled, mode]);
  const actions = [
    { name: "bold", icon: <TextB />, run: () => editor?.chain().focus().toggleBold().run() },
    { name: "italic", icon: <TextItalic />, run: () => editor?.chain().focus().toggleItalic().run() },
    { name: "bulletList", icon: <ListBullets />, run: () => editor?.chain().focus().toggleBulletList().run() },
    { name: "orderedList", icon: <ListNumbers />, run: () => editor?.chain().focus().toggleOrderedList().run() },
    { name: "blockquote", icon: <Quotes />, run: () => editor?.chain().focus().toggleBlockquote().run() },
    { name: "codeBlock", icon: <Code />, run: () => editor?.chain().focus().toggleCodeBlock().run() },
    { name: "undo", icon: <ArrowUUpLeft />, run: () => editor?.chain().focus().undo().run() },
    { name: "redo", icon: <ArrowUUpRight />, run: () => editor?.chain().focus().redo().run() },
  ];
  return <div className="flex flex-col gap-2"><p className="text-body-sm font-semibold">{label}</p><div className={`overflow-hidden rounded-field border bg-raised ${error ? "border-danger" : "border-line-control"} focus-within:outline-2 focus-within:outline-focus`}><div role="group" aria-label={label} className="flex flex-wrap items-center gap-1 border-b border-line bg-sunken px-2 py-1">{actions.map((action,index) => <IconButton key={action.name} label={words[index]} icon={action.icon} size="xs" disabled={disabled || !editor} aria-pressed={index < 6 ? Boolean(editor?.isActive(action.name)) : undefined} onClick={action.run} className={editor?.isActive(action.name) ? "bg-brand-subtle text-fg-brand" : undefined} />)}</div><EditorContent editor={editor} className={rows > 3 ? "min-h-40" : "min-h-24"} /></div>{error ? <p role="alert" className="text-caption text-danger">{error}</p> : null}</div>;
}
