"use client";

import { useState, useTransition } from "react";
import type { PicUser } from "@/db/queries/departments";
import type { UserSummary } from "@/db/queries/users";
import { addPicAction, removePicAction } from "./actions";

export function PicManager({
  departmentId,
  pics,
  allUsers,
}: {
  departmentId: number;
  pics: PicUser[];
  allUsers: UserSummary[];
}) {
  const [pending, startTransition] = useTransition();
  const assignable = allUsers.filter((u) => !pics.some((p) => p.id === u.id));
  const [selected, setSelected] = useState(assignable[0]?.id ?? 0);

  return (
    <div>
      {pics.length === 0 ? (
        <p className="text-xs text-[#706e6b]">No PICs assigned.</p>
      ) : (
        <ul className="mb-2 space-y-1">
          {pics.map((p) => (
            <li key={p.id} className="flex items-center justify-between text-xs">
              <span className="text-[#444]">{p.name} <span className="text-[#706e6b]">({p.email})</span></span>
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => removePicAction(departmentId, p.id))}
                className="text-[#8e030f] hover:underline disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {assignable.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(Number(e.target.value))}
            className="flex-1 rounded border border-[#c9c9c9] px-2 py-1 text-xs focus:border-brand-600 focus:outline-none"
          >
            {assignable.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || !selected}
            onClick={() => startTransition(() => addPicAction(departmentId, selected))}
            className="rounded border border-brand-600 bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Add PIC
          </button>
        </div>
      )}
    </div>
  );
}
