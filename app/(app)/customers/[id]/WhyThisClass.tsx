"use client";

import Link from "next/link";
import { useState } from "react";
import { LangToggle, useExplainerLocale } from "@/app/components/LangToggle";
import {
  BEHAVIOR_CLASS_LABEL,
  CLASS_COPY,
  UI,
  parseReasons,
  reasonsByWeight,
  renderReason,
  tierLabelFor,
  type Locale,
  type ReasonWeight,
} from "@/lib/classificationCopy";
import type { ClassificationReason } from "@/lib/classification";
import type { BehaviorClass, ResolutionTier } from "@/lib/constants";

/**
 * Per-customer "why this class?" panel.
 *
 * Renders the stored evidence trace — the branch the classifier actually took
 * — rather than re-deriving anything. Re-running classifyCustomer() here would
 * need peer context and windowed aggregates that only recomputeScores()
 * assembles, and any drift would make this panel disagree with the stored row
 * and with the review queue.
 *
 * What it must never claim is enforced structurally rather than by care:
 *
 *  - Reasons are grouped by REASON_META weight, so pack size and weekday share
 *    render under "consistent with this, but did not decide it". They are
 *    pushed inside a HoReCa branch already taken and cannot change a class.
 *  - The tier label goes through tierLabelFor(), so a staff INSTITUTIONAL
 *    override reads "Set by staff" instead of "Anchored (dealer record)".
 *  - With no stored trace it says so, rather than reconstructing a story from
 *    the other columns.
 */
export function WhyThisClass({
  behaviorClass,
  resolutionTier,
  reasonsJson,
  disagreementFlag,
}: {
  behaviorClass: BehaviorClass | null;
  resolutionTier: ResolutionTier | null;
  reasonsJson: string | null;
  disagreementFlag: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [locale, setLocale] = useExplainerLocale();

  const reasons = parseReasons(reasonsJson);
  const flagged = disagreementFlag === 1;

  return (
    <div lang={locale} className="mt-3 border-t border-[#dde5e8] pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="rounded-control px-1 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {open ? "▾" : "▸"} {UI.whyHeading[locale]}
        </button>
        {open && <LangToggle locale={locale} onChange={setLocale} />}
      </div>

      {open && (
        <div className="mt-3 space-y-3">
          {behaviorClass && (
            <div className="rounded-control bg-surface-50 p-3">
              <p className="text-sm font-semibold text-[#14202b]">
                {BEHAVIOR_CLASS_LABEL[behaviorClass][locale]}
                <span className="ml-2 font-normal text-[#607785]">
                  {tierLabelFor(resolutionTier, behaviorClass, locale)}
                </span>
              </p>
              <p className="mt-1 max-w-[62ch] text-sm text-[#3c4f5e]">
                {CLASS_COPY[behaviorClass].who[locale]}
              </p>
            </div>
          )}

          {reasons.length === 0 ? (
            <p className="max-w-[62ch] text-sm text-[#607785]">{UI.whyNoTrace[locale]}</p>
          ) : (
            <>
              <Group
                title={UI.whyDecided[locale]}
                weight="decisive"
                reasons={reasons}
                locale={locale}
              />
              {flagged && (
                <Group
                  title={UI.whyConflict[locale]}
                  weight="conflict"
                  reasons={reasons}
                  locale={locale}
                  tone="warn"
                />
              )}
              <Group
                title={UI.whySupporting[locale]}
                weight="supporting"
                reasons={reasons}
                locale={locale}
                tone="muted"
              />
              <Group
                title={UI.whyContext[locale]}
                weight="context"
                reasons={reasons}
                locale={locale}
                tone="muted"
              />
            </>
          )}

          <Link
            href="/guide/classification"
            className="inline-block text-sm font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            {UI.learnMore[locale]} →
          </Link>
        </div>
      )}
    </div>
  );
}

function Group({
  title,
  weight,
  reasons,
  locale,
  tone = "default",
}: {
  title: string;
  weight: ReasonWeight;
  reasons: ClassificationReason[];
  locale: Locale;
  tone?: "default" | "muted" | "warn";
}) {
  const matching = reasonsByWeight(reasons, weight);
  if (matching.length === 0) return null;

  const body =
    tone === "warn" ? "text-[#8e030f]" : tone === "muted" ? "text-[#607785]" : "text-[#3c4f5e]";

  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-[#607785]">{title}</p>
      <ul className="space-y-1">
        {matching.map((reason, i) => (
          <li key={`${reason.code}-${i}`} className={`max-w-[62ch] text-sm ${body}`}>
            {renderReason(reason, locale)}
          </li>
        ))}
      </ul>
    </div>
  );
}
