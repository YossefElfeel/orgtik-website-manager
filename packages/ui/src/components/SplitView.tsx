import type { ReactNode } from "react";
import { cn } from "../lib/cn.js";
export function SplitView({ children, inspector, label, className }: { children: ReactNode; inspector?: ReactNode; label: string; className?: string }) { return <div className={cn("grid min-h-0 min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]", !inspector && "xl:grid-cols-1", className)}><div className="min-w-0">{children}</div>{inspector ? <aside aria-label={label} className="min-w-0 rounded-card border border-line bg-raised p-5 shadow-sm">{inspector}</aside> : null}</div>; }
