"use client";
import { Columns } from "@phosphor-icons/react";
import { Checkbox } from "./Checkbox.js";
import { Button } from "./Button.js";
import { Popover, PopoverTrigger, PopoverContent } from "./Popover.js";
import { useOrgtik } from "../provider/OrgtikProvider.js";
import { suiteText } from "../suite/strings.js";
export function ColumnChooser({ columns, onChange }: { columns: { id: string; label: string; visible: boolean; required?: boolean }[]; onChange: (id: string, visible: boolean) => void }) {
  const { locale } = useOrgtik(), label = suiteText(locale, "columns");
  return <Popover><PopoverTrigger render={<Button variant="secondary" shape="control" size="sm" startIcon={<Columns />}>{label}</Button>} /><PopoverContent align="end" className="min-w-52"><div className="flex flex-col gap-3 p-1"><p className="text-body-sm font-semibold">{label}</p>{columns.map(column => <label key={column.id} className="flex items-center gap-2 text-body-sm"><Checkbox checked={column.visible} disabled={column.required} onCheckedChange={visible => onChange(column.id, Boolean(visible))} /><span>{column.label}</span></label>)}</div></PopoverContent></Popover>;
}
