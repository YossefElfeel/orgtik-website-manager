import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "../lib/cn.js";
export function SplitView({ children, inspector, label, className }) { return _jsxs("div", { className: cn("grid min-h-0 min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]", !inspector && "xl:grid-cols-1", className), children: [_jsx("div", { className: "min-w-0", children: children }), inspector ? _jsx("aside", { "aria-label": label, className: "min-w-0 rounded-card border border-line bg-raised p-5 shadow-sm", children: inspector }) : null] }); }
//# sourceMappingURL=SplitView.js.map