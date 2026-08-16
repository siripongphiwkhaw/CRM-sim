"use client";

import { useTransition } from "react";
import { decideClassificationReviewAction } from "./actions";

export function ReviewDecideButtons({ reviewId }: { reviewId: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => void decideClassificationReviewAction(reviewId, "CONFIRMED"))}
        className="rounded-[9px] bg-[#cdefc4] px-3 py-1 text-xs font-medium text-[#194e31] active:scale-[0.98] disabled:opacity-50"
      >
        Confirm
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => void decideClassificationReviewAction(reviewId, "REJECTED"))}
        className="rounded-[9px] bg-[#feded8] px-3 py-1 text-xs font-medium text-[#8e030f] active:scale-[0.98] disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  );
}
