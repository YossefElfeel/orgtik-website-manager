import type { ReactNode } from "react";
// The language routes keep their own root layout. This group owns only `/`'s redirect.
export default function RedirectLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
