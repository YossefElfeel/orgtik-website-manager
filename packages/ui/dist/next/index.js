"use client";
import { jsx as _jsx } from "react/jsx-runtime";
// Next.js wiring, in its own entry (`@orgtik/ui/next`) so non-Next hosts never load next/*.
// A server layout can't pass next/link to OrgtikProvider (functions don't cross the server/client
// boundary), so this provider imports it on the client side:
//
//   <OrgtikNextProvider locale={locale}>{children}</OrgtikNextProvider>
import NextLink from "next/link";
import { OrgtikProvider } from "../provider/OrgtikProvider.js";
const Link = (props) => _jsx(NextLink, { ...props });
export function OrgtikNextProvider(props) {
    return _jsx(OrgtikProvider, { ...props, link: Link });
}
//# sourceMappingURL=index.js.map