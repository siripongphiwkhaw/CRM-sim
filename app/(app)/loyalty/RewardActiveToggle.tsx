"use client";

import { useTransition } from "react";
import { toggleRewardAction } from "./actions";

export function RewardActiveToggle({ id, active }: { id: number; active: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => toggleRewardAction(id, !active))}
      className={`rounded-[16px] px-2 py-0.5 text-xs font-medium transition active:scale-[0.98] disabled:opacity-50 ${
        active ? "bg-[#cdefc4] text-[#194e31]" : "bg-[#e5eaec] text-[#514f4d]"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </button>
  );
}
