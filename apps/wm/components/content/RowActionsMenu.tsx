"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { DotsThreeVertical } from "@phosphor-icons/react";
import { Button, Menu, MenuContent, MenuGroup, MenuTrigger } from "@orgtik/ui";

/** A visible, consistently sized entry point for every dashboard row menu. */
export function RowActionsMenu({
  target,
  children,
}: {
  target?: string;
  children: ReactNode;
}) {
  const t = useTranslations("Improvements");
  return (
    <span className="inline-flex" onClick={(event) => event.stopPropagation()}>
      <Menu>
        <MenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              shape="control"
              aria-label={target ? `${t("actions")}: ${target}` : t("actions")}
              className="size-9 p-0"
            >
              <DotsThreeVertical aria-hidden className="size-5" />
            </Button>
          }
        />
        <MenuContent align="end" className="min-w-52">
          <MenuGroup
            label={
              target ? (
                <span dir="auto" className="block max-w-72 truncate text-fg">
                  {target}
                </span>
              ) : undefined
            }
          >
            {children}
          </MenuGroup>
        </MenuContent>
      </Menu>
    </span>
  );
}
