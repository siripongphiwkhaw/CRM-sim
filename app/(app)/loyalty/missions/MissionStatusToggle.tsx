"use client";

import { useTransition } from "react";
import { toggleMissionStatusAction } from "./actions";
import type { MissionStatus } from "@/lib/constants";

const TONE: Record<MissionStatus, string> = {
  PUBLISHED: "bg-[#cdefc4] text-[#194e31]",
  DRAFT: "bg-[#e5eaec] text-[#514f4d]",
  SUSPENDED: "bg-[#feded8] text-[#8e030f]",
};

export function MissionStatusToggle({ id, status }: { id: number; status: MissionStatus }) {
  const [pending, startTransition] = useTransition();
  const next: MissionStatus = status === "PUBLISHED" ? "SUSPENDED" : "PUBLISHED";
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => toggleMissionStatusAction(id, next))}
      className={`rounded-[16px] px-2 py-0.5 text-xs font-medium transition active:scale-[0.98] disabled:opacity-50 ${TONE[status]}`}
    >
      {status}
    </button>
  );
}
