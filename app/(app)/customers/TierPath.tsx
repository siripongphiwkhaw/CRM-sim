import { TIERS, type Tier } from "@/lib/constants";

/**
 * Read-only loyalty tier path. Tier is computed from lifetime earned points
 * (the ledger is the source of truth), so this shows progression only — it is
 * no longer a setter. Progress toward the next threshold is shown below.
 */
export function TierPath({
  tier,
  lifetime,
  nextTier,
  nextTierAt,
}: {
  tier: Tier;
  lifetime: number;
  nextTier?: Tier | null;
  nextTierAt?: number | null;
}) {
  const currentIdx = TIERS.indexOf(tier);
  const remaining = nextTierAt != null ? Math.max(0, nextTierAt - lifetime) : 0;

  return (
    <div className="rounded-[14px] border border-[#dde5e8] bg-white p-3">
      <ol className="flex">
        {TIERS.map((t, i) => {
          const state =
            i < currentIdx ? "done" : i === currentIdx ? "current" : "todo";
          const colors =
            state === "done"
              ? "bg-brand-800 text-white"
              : state === "current"
                ? "bg-brand-600 text-white"
                : "bg-[#e5eaec] text-[#514f4d]";
          return (
            <li key={t} className="min-w-0 flex-1" style={{ marginLeft: i === 0 ? 0 : -8 }}>
              <span
                title={t === tier ? `Current tier: ${t}` : t}
                className={`block w-full truncate px-5 py-1.5 text-center text-xs font-medium ${colors}`}
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
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-1.5 text-center text-[11px] text-[#607785]">
        {nextTier
          ? `${lifetime.toLocaleString("en-US")} lifetime points · ${remaining.toLocaleString("en-US")} more to reach ${nextTier}`
          : `${lifetime.toLocaleString("en-US")} lifetime points · top tier reached`}
      </p>
    </div>
  );
}
