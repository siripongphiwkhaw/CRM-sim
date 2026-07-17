"use client";

import { useTransition } from "react";
import { TIERS, type Tier } from "@/lib/constants";
import { setTierAction } from "./actions";

/**
 * Salesforce-style Path: chevron stages for the loyalty tier. Completed stages
 * are dark, the current stage is brand blue, and clicking any stage moves the
 * member to that tier.
 */
export function TierPath({
  customerId,
  tier,
}: {
  customerId: number;
  tier: Tier;
}) {
  const [pending, startTransition] = useTransition();
  const currentIdx = TIERS.indexOf(tier);

  return (
    <div className="rounded border border-[#e5e5e5] bg-white p-3">
      <ol className={`flex ${pending ? "opacity-60" : ""}`}>
        {TIERS.map((t, i) => {
          const state =
            i < currentIdx ? "done" : i === currentIdx ? "current" : "todo";
          const colors =
            state === "done"
              ? "bg-brand-800 text-white"
              : state === "current"
                ? "bg-brand-600 text-white"
                : "bg-[#ecebea] text-[#514f4d] hover:bg-[#d9d9d9]";
          return (
            <li key={t} className="min-w-0 flex-1" style={{ marginLeft: i === 0 ? 0 : -8 }}>
              <button
                type="button"
                disabled={pending || t === tier}
                onClick={() => startTransition(() => setTierAction(customerId, t))}
                title={t === tier ? `Current tier: ${t}` : `Move to ${t}`}
                className={`block w-full truncate px-5 py-1.5 text-center text-xs font-medium transition-colors ${colors}`}
                style={{
                  clipPath:
                    i === 0
                      ? "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)"
                      : i === TIERS.length - 1
                        ? "polygon(0 0, 100% 0, 100% 100%, 0 100%, 10px 50%)"
                        : "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)",
                }}
              >
                {state === "done" ? "✓ " : ""}
                {t}
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-1.5 text-center text-[11px] text-[#706e6b]">
        Click a stage to move this member&apos;s tier
      </p>
    </div>
  );
}
