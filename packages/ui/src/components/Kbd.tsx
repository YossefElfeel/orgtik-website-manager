import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn.js";
export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) { return <kbd className={cn("inline-flex min-w-5 items-center justify-center rounded border border-line-strong bg-sunken px-1.5 py-0.5 font-mono text-micro text-fg-muted", className)} {...props} />; }
