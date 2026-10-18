"use client";
// Next.js wiring, in its own entry (`@orgtik/ui/next`) so non-Next hosts never load next/*.
// A server layout can't pass next/link to OrgtikProvider (functions don't cross the server/client
// boundary), so this provider imports it on the client side:
//
//   <OrgtikNextProvider locale={locale}>{children}</OrgtikNextProvider>
import NextLink from "next/link";
import type { ComponentProps } from "react";
import { OrgtikProvider, type LinkComponent } from "../provider/OrgtikProvider.js";

const Link: LinkComponent = (props) => <NextLink {...props} />;

export function OrgtikNextProvider(props: Omit<ComponentProps<typeof OrgtikProvider>, "link">) {
  return <OrgtikProvider {...props} link={Link} />;
}
