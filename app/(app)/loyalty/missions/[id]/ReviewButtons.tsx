"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/validation";
import { reviewSubmissionAction } from "../actions";

export function ReviewButtons({ submissionId, missionId }: { submissionId: number; missionId: number }) {
  const [state, formAction] = useActionState<FormState, FormData>(reviewSubmissionAction, {});

  if (state.success) {
    return <span className="text-xs text-[#194e31]">{state.success}</span>;
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="submission_id" value={submissionId} />
      <input type="hidden" name="mission_id" value={missionId} />
      {state.error && <span className="text-xs text-[#8e030f]">{state.error}</span>}
      <button
        type="submit"
        name="approve"
        value="true"
        className="rounded-[9px] bg-[#cdefc4] px-2 py-1 text-xs font-medium text-[#194e31] active:scale-[0.98]"
      >
        Approve
      </button>
      <button
        type="submit"
        name="approve"
        value="false"
        className="rounded-[9px] bg-[#feded8] px-2 py-1 text-xs font-medium text-[#8e030f] active:scale-[0.98]"
      >
        Reject
      </button>
    </form>
  );
}
