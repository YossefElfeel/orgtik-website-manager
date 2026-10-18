"use client";
import { Avatar } from "./Display.js";
import { useFormatter } from "../provider/OrgtikProvider.js";
import type { SuitePerson } from "../suite/types.js";
export function AvatarGroup({ people, max = 4, label, size = "sm" }: { people: SuitePerson[]; max?: number; label: string; size?: "sm" | "md" | "lg" }) {
  const f = useFormatter(), shown = people.slice(0, Math.max(1, max));
  return <div role="group" aria-label={label} className="flex items-center -space-x-2 rtl:space-x-reverse">
    {shown.map(person => <span key={person.id} className="rounded-pill ring-2 ring-raised"><Avatar name={person.name} src={person.avatar} size={size} /></span>)}
    {people.length > shown.length ? <span className="grid size-8 place-items-center rounded-pill bg-sunken text-caption font-semibold text-fg-muted ring-2 ring-raised">+{f.number(people.length - shown.length)}</span> : null}
  </div>;
}
