"use client";

import { useState, useTransition } from "react";
import {
  launchCampaignAction,
  setCampaignStatusAction,
  recomputeConversionsAction,
} from "../actions";
import type { CampaignStatus } from "@/lib/constants";

const btn =
  "rounded-[9px] border border-[#c2d0d6] bg-white px-3 py-1.5 text-sm font-medium text-[#3c4f5e] transition hover:bg-[#eef3f5] active:scale-[0.98] disabled:opacity-50";
const btnPrimary =
  "rounded-[9px] border border-brand-600 bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50";

export function CampaignControls({ id, status }: { id: number; status: CampaignStatus }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "DRAFT" && (
        <button
          type="button"
          disabled={pending}
          className={btnPrimary}
          onClick={() =>
            startTransition(async () => {
              const result = await launchCampaignAction(id);
              setMessage(result.success ?? result.error ?? null);
            })
          }
        >
          {pending ? "Launching…" : "Launch"}
        </button>
      )}
      {status === "RUNNING" && (
        <button
          type="button"
          disabled={pending}
          className={btn}
          onClick={() => startTransition(() => setCampaignStatusAction(id, "PAUSED"))}
        >
          Pause
        </button>
      )}
      {status === "PAUSED" && (
        <button
          type="button"
          disabled={pending}
          className={btn}
          onClick={() => startTransition(() => setCampaignStatusAction(id, "RUNNING"))}
        >
          Resume
        </button>
      )}
      {(status === "RUNNING" || status === "PAUSED") && (
        <>
          <button
            type="button"
            disabled={pending}
            className={btn}
            onClick={() => startTransition(() => recomputeConversionsAction(id))}
          >
            Refresh conversions
          </button>
          <button
            type="button"
            disabled={pending}
            className={btn}
            onClick={() => startTransition(() => setCampaignStatusAction(id, "DONE"))}
          >
            Mark done
          </button>
        </>
      )}
      {message && <span className="text-xs text-[#607785]">{message}</span>}
    </div>
  );
}
