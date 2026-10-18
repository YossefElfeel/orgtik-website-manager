"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Avatar } from "./Display.js";
import { useFormatter } from "../provider/OrgtikProvider.js";
export function AvatarGroup({ people, max = 4, label, size = "sm" }) {
    const f = useFormatter(), shown = people.slice(0, Math.max(1, max));
    return _jsxs("div", { role: "group", "aria-label": label, className: "flex items-center -space-x-2 rtl:space-x-reverse", children: [shown.map(person => _jsx("span", { className: "rounded-pill ring-2 ring-raised", children: _jsx(Avatar, { name: person.name, src: person.avatar, size: size }) }, person.id)), people.length > shown.length ? _jsxs("span", { className: "grid size-8 place-items-center rounded-pill bg-sunken text-caption font-semibold text-fg-muted ring-2 ring-raised", children: ["+", f.number(people.length - shown.length)] }) : null] });
}
//# sourceMappingURL=AvatarGroup.js.map