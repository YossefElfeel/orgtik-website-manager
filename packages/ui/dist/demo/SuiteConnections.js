"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Bell, MagnifyingGlass } from "@phosphor-icons/react";
import { IconButton } from "../components/IconButton.js";
import { Button } from "../components/Button.js";
import { Input } from "../components/Input.js";
import { Badge } from "../components/Badge.js";
import { Field } from "../components/Field.js";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../components/Dialog.js";
import { EmptyState, ErrorState, LoadingState } from "../components/States.js";
import { Popover, PopoverContent, PopoverTrigger } from "../components/Popover.js";
import { useOrgtik } from "../provider/OrgtikProvider.js";
import { readClientSession } from "../auth/session.js";
import { handoffCode, staffTargetToken, switchWorkspace } from "../auth/client.js";
import { SimulatedTag, useDemoScene } from "./DemoPanel.js";
import { demoRequest } from "./connections.js";
const copy = { search: ["Suite demo search", "بحث عرض السويت", "Suite-Demosuche", "Recherche suite démo", "Ricerca suite demo"], query: ["Search this scene", "البحث في السيناريو", "Diese Szene durchsuchen", "Rechercher cette scène", "Cerca questa scena"], body: ["Grouped presentation records in this workspace. Opening an app uses its existing handoff.", "سجلات العرض مجمعة في هذه المساحة. فتح التطبيق يستخدم التسليم الموجود.", "Gruppierte Demodatensätze dieses Arbeitsbereichs. Apps öffnen über bestehende Übergabe.", "Données démo groupées de cet espace. Ouverture via le transfert existant.", "Dati demo raggruppati nello spazio. Apertura tramite passaggio esistente."], notifications: ["Suite demo notifications", "إشعارات عرض السويت", "Suite-Demohinweise", "Notifications suite démo", "Notifiche suite demo"], empty: ["Nothing in this scene yet", "لا شيء في السيناريو بعد", "Noch nichts in dieser Szene", "Rien dans cette scène", "Nessun elemento nella scena"], error: ["Presentation connection unavailable", "اتصال العرض غير متاح", "Demoverbindung nicht verfügbar", "Connexion démo indisponible", "Connessione demo non disponibile"], retry: ["Try again", "أعد المحاولة", "Erneut versuchen", "Réessayer", "Riprova"], open: ["Open item", "فتح العنصر", "Element öffnen", "Ouvrir l’élément", "Apri elemento"], read: ["Mark read", "تحديد كمقروء", "Als gelesen markieren", "Marquer comme lu", "Segna letta"], noSession: ["Sign in through the suite to open another tool.", "سجّل الدخول عبر السويت لفتح أداة أخرى.", "Über die Suite anmelden, um ein anderes Tool zu öffnen.", "Connectez-vous par la suite pour ouvrir un autre outil.", "Accedi tramite suite per aprire un altro strumento."] };
const languages = { en: 0, ar: 1, de: 2, fr: 3, it: 4 };
const toolWords = { tasks: ["Tasks", "المهام", "Aufgaben", "Tâches", "Attività"], files: ["Files", "الملفات", "Dateien", "Fichiers", "File"], chats: ["Chats", "المحادثات", "Chats", "Conversations", "Chat"], hr: ["HR", "الموارد البشرية", "Personal", "RH", "Personale"], sales: ["Sales", "المبيعات", "Vertrieb", "Ventes", "Vendite"], marketing: ["Marketing", "التسويق", "Marketing", "Marketing", "Marketing"], wm: ["Website Manager", "إدارة الموقع", "Website-Manager", "Gestion du site", "Gestione sito"], sos: ["Account", "الحساب", "Konto", "Compte", "Account"], admin: ["Admin", "الإدارة", "Administration", "Administration", "Amministrazione"] };
const audience = { sos: "suite", tasks: "tool:tasks", files: "tool:files", chats: "tool:chats", hr: "tool:hr", sales: "tool:sales", marketing: "tool:marketing", wm: "staff:wm", admin: "staff:admin" };
export function SuiteConnections() {
    const demo = useDemoScene(), { locale } = useOrgtik(), words = (key) => copy[key][languages[locale]];
    const [open, setOpen] = useState(false), [query, setQuery] = useState(""), [results, setResults] = useState([]), [notices, setNotices] = useState([]), [busy, setBusy] = useState(false), [failed, setFailed] = useState(false), [launchError, setLaunchError] = useState(false), [refresh, setRefresh] = useState(0);
    useEffect(() => { if (!demo.enabled || !demo.runtime)
        return; const key = (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setOpen(true);
    } }; window.addEventListener("keydown", key, true); return () => window.removeEventListener("keydown", key, true); }, [demo.enabled, demo.runtime]);
    useEffect(() => { if (!open || !demo.runtime)
        return; let live = true; setBusy(true); setFailed(false); const timer = setTimeout(() => { demoRequest(demo.runtime, demo.scene, "/search?q=" + encodeURIComponent(query)).then(items => { if (live)
        setResults(items); }).catch(() => live && setFailed(true)).finally(() => live && setBusy(false)); }, 120); return () => { live = false; clearTimeout(timer); }; }, [open, query, demo.scene, demo.runtime, refresh]);
    useEffect(() => { if (!demo.enabled || !demo.runtime)
        return; let live = true; const load = () => demoRequest(demo.runtime, demo.scene, "/notifications").then(items => live && setNotices(items)).catch(() => { }); void load(); const timer = setInterval(load, 5000); return () => { live = false; clearInterval(timer); }; }, [demo.enabled, demo.runtime, demo.scene, refresh]);
    const navigate = async (item) => { if (!demo.runtime)
        return; setLaunchError(false); const current = readClientSession(); if (!current) {
        setLaunchError(true);
        return;
    } try {
        const target = demo.runtime.webUrls[item.tool];
        if (!target || !audience[item.tool])
            throw Error();
        await fetch(new URL(item.tool === "sos" ? "/auth" : "/" + locale + "/auth", target), { mode: "no-cors" });
        let token = current.tokens.accessToken;
        const destination = audience[item.tool];
        if (destination.startsWith("staff:"))
            token = await staffTargetToken(demo.runtime.sosApiUrl, token, item.tool === "admin" ? "admin" : "wm");
        else
            token = (await switchWorkspace(demo.runtime.sosApiUrl, token, current.workspaceContext?.workspace.id ?? "ws_orgtik")).tokens.accessToken;
        const code = await handoffCode(demo.runtime.sosApiUrl, token, destination);
        const landing = new URL(item.path, "http://presentation.invalid");
        landing.searchParams.set("demoScene", JSON.stringify({ scene: { ...demo.scene, state: "normal", scenario: "none" }, preferences: demo.preferences, locale, theme: document.documentElement.dataset.theme || "light" }));
        const url = new URL(item.tool === "sos" ? "/auth" : "/" + locale + "/auth", target);
        url.searchParams.set("code", code);
        url.searchParams.set("redirect", landing.pathname + landing.search);
        window.location.assign(url.toString());
    }
    catch {
        setLaunchError(true);
    } };
    if (!demo.enabled || !demo.runtime)
        return null;
    return _jsxs(_Fragment, { children: [_jsx(IconButton, { label: words("search"), icon: _jsx(MagnifyingGlass, {}), variant: "ghost", onClick: () => setOpen(true) }), _jsxs(Popover, { children: [_jsx(PopoverTrigger, { render: _jsx(IconButton, { label: words("notifications"), icon: _jsx(Bell, {}), variant: "ghost" }) }), _jsxs(PopoverContent, { align: "end", title: words("notifications"), className: "w-[min(380px,calc(100vw-2rem))] max-h-[70dvh] overflow-auto", children: [_jsx(SimulatedTag, {}), launchError ? _jsx("p", { role: "alert", className: "text-body-sm text-danger", children: words("error") }) : null, notices.length ? _jsx("ul", { className: "divide-y divide-line", children: notices.map(item => _jsxs("li", { className: "flex flex-col gap-2 py-3", children: [_jsx("p", { className: "text-body-sm font-semibold", dir: "auto", children: item.title }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { size: "sm", variant: "secondary", onClick: () => navigate(item), children: words("open") }), _jsx(Button, { size: "sm", variant: "ghost", disabled: item.read, onClick: () => demoRequest(demo.runtime, demo.scene, "/notifications/read", { id: item.id }).then(() => setRefresh(value => value + 1)), children: words("read") })] })] }, item.id)) }) : _jsx(EmptyState, { size: "compact", title: words("empty") })] })] }), _jsx(Dialog, { open: open, onOpenChange: setOpen, children: _jsxs(DialogContent, { size: "lg", children: [_jsxs(DialogHeader, { children: [_jsx(DialogTitle, { children: words("search") }), _jsx(DialogDescription, { children: words("body") })] }), _jsxs(DialogBody, { className: "flex flex-col gap-4", children: [_jsx(Field, { label: words("query"), children: _jsx(Input, { value: query, maxLength: 120, onChange: event => setQuery(event.target.value), startIcon: _jsx(MagnifyingGlass, {}) }) }), _jsx(SimulatedTag, {}), launchError ? _jsx("p", { role: "alert", className: "text-body-sm text-danger", children: words("noSession") }) : null, busy ? _jsx(LoadingState, { rows: 4 }) : failed ? _jsx(ErrorState, { size: "compact", title: words("error"), onRetry: () => setRefresh(value => value + 1) }) : results.length ? _jsx("div", { className: "flex flex-col gap-4", children: [...new Set(results.map(item => item.tool))].map(tool => _jsxs("section", { children: [_jsxs("h3", { className: "mb-2 text-body-sm font-semibold capitalize", children: [toolWords[tool]?.[languages[locale]] ?? tool, _jsx(Badge, { className: "ms-2", size: "sm", children: results.filter(item => item.tool === tool).length })] }), _jsx("ul", { className: "divide-y divide-line", children: results.filter(item => item.tool === tool).map(item => _jsx("li", { children: _jsx(Button, { variant: "ghost", className: "w-full justify-start text-start", onClick: () => navigate(item), children: _jsx("span", { dir: "auto", children: item.title }) }) }, item.id)) })] }, tool)) }) : _jsx(EmptyState, { size: "compact", title: words("empty") })] })] }) })] });
}
//# sourceMappingURL=SuiteConnections.js.map