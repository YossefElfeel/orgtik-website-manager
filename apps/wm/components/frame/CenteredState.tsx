import type { ReactNode } from "react";
import { Logo } from "@orgtik/ui";

/** A full page for moments outside the shell: signing in, signed out, no access. */
export function CenteredState({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-10 bg-canvas px-4 py-16">
      <Logo variant="wordmark" className="h-7 text-fg" />
      <div className="w-full max-w-md rounded-panel border border-line bg-raised p-6 shadow-raised">{children}</div>
    </main>
  );
}
