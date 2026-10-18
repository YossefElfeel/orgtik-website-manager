"use client";
import { Buildings, Plus } from "@phosphor-icons/react";
import { Menu, MenuContent, MenuItem, MenuTrigger, MenuSeparator } from "../components/Menu.js";
import { Button } from "../components/Button.js";
export function WorkspaceSwitcher({ workspaces, selected, label, onChange, onCreate, createLabel }: { workspaces: { id: string; name: string; role?: string }[]; selected: string; label: string; onChange: (id: string) => void; onCreate?: () => void; createLabel?: string }) {
  const current = workspaces.find(workspace => workspace.id === selected);
  if (workspaces.length < 2 && !onCreate) return <span className="inline-flex items-center gap-2 text-body-sm font-semibold"><Buildings aria-hidden="true" className="size-4 text-fg-subtle" /><span dir="auto">{current?.name || label}</span></span>;
  return <Menu><MenuTrigger render={<Button shape="control" variant="ghost" size="sm" aria-label={label} startIcon={<Buildings />}>{current?.name || label}</Button>} /><MenuContent align="start">{workspaces.map(workspace => <MenuItem key={workspace.id} onClick={() => onChange(workspace.id)}><span dir="auto" className="min-w-0 flex-1 truncate">{workspace.name}</span>{workspace.role ? <span className="text-caption text-fg-subtle">{workspace.role}</span> : null}</MenuItem>)}{onCreate ? <><MenuSeparator /><MenuItem icon={<Plus />} onClick={onCreate}>{createLabel || label}</MenuItem></> : null}</MenuContent></Menu>;
}
