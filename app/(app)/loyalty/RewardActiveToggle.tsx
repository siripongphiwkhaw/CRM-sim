"use client";

import { useTransition } from "react";
import { toggleRewardAction } from "./actions";
import type { RewardStatus } from "@/lib/constants";

const TONE: Record<RewardStatus, string> = {
  PUBLISHED: "bg-[#cdefc4] text-[#194e31]",
  DRAFT: "bg-[#e5eaec] text-[#514f4d]",
  SUSPENDED: "bg-[#feded8] text-[#8e030f]",
};

/** Toggles between PUBLISHED and SUSPENDED. DRAFT is only set at creation —
 * clicking a DRAFT reward publishes it. */
export function RewardActiveToggle({ id, status }: { id: number; status: RewardStatus }) {
  const [pending, startTransition] = useTransition();
  const next: RewardStatus = status === "PUBLISHED" ? "SUSPENDED" : "PUBLISHED";
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => toggleRewardAction(id, next))}
      className={`rounded-[16px] px-2 py-0.5 text-xs font-medium transition active:scale-[0.98] disabled:opacity-50 ${TONE[status]}`}
    >
      {status}
    </button>
  );
}
