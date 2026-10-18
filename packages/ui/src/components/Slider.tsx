"use client";
import { useId } from "react";
export function Slider({ label, value, onChange, min = 0, max = 100, step = 1, disabled, format = String }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number; disabled?: boolean; format?: (value: number) => string }) {
  const id = useId();
  return <div className="flex flex-col gap-2"><div className="flex items-center justify-between gap-4"><label htmlFor={id} className="text-body-sm font-semibold">{label}</label><output htmlFor={id} className="text-body-sm tabular-nums text-fg-muted">{format(value)}</output></div><input id={id} type="range" className="h-5 w-full accent-[var(--ot-action-primary-bg)] disabled:opacity-50" value={value} min={min} max={max} step={step} disabled={disabled} aria-valuetext={format(value)} onChange={event => onChange(Number(event.target.value))} /></div>;
}
