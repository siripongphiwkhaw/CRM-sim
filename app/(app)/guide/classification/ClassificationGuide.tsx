"use client";

import { Card, SectionHeader } from "@/app/components/ui";
import { LangToggle, useExplainerLocale } from "@/app/components/LangToggle";
import {
  BEHAVIOR_CLASS_LABEL,
  CLASS_COPY,
  RESOLUTION_TIER_LABEL,
  THRESHOLDS,
  TIER_COPY,
  UI,
  type Locale,
} from "@/lib/classificationCopy";
import { BEHAVIOR_CLASSES } from "@/lib/constants";

/**
 * The reference half of the classification explainer.
 *
 * Everything rendered here comes from lib/classificationCopy.ts — no copy is
 * written inline — so this page and the per-customer "Why this class?" panel
 * always agree, and the thresholds shown are the ones the engine actually uses.
 */
export function ClassificationGuide() {
  const [locale, setLocale] = useExplainerLocale();

  return (
    // lang is set here rather than on <html>: the CRM shell around this really
    // is English. It also drives the :lang(th) font + line-height rules.
    <section lang={locale} className="space-y-4">
      <div className="flex justify-end">
        <LangToggle locale={locale} onChange={setLocale} />
      </div>

      <Card className="border-l-4 border-l-brand-600">
        <SectionHeader title={UI.summaryHeading[locale]} />
        <p className="max-w-[60ch] text-sm text-[#3c4f5e]">{UI.summaryBody[locale]}</p>
      </Card>

      <TierChain locale={locale} />
      <ClassTable locale={locale} />
      <ThresholdTable locale={locale} />

      <Card>
        <SectionHeader title={UI.disagreementHeading[locale]} />
        <p className="max-w-[60ch] text-sm text-[#3c4f5e]">{UI.disagreementBody[locale]}</p>
      </Card>

      <Card>
        <SectionHeader title={UI.refreshHeading[locale]} />
        <p className="max-w-[60ch] text-sm text-[#3c4f5e]">{UI.refreshBody[locale]}</p>
      </Card>
    </section>
  );
}

/**
 * The evidence chain. Numbered because it genuinely is a precedence sequence —
 * the first tier that can answer decides and the rest are skipped — and the
 * order shown is the order classifyCustomer() actually evaluates, which is NOT
 * the "Tier 1 / Tier 2" labelling used on the customer page.
 */
function TierChain({ locale }: { locale: Locale }) {
  return (
    <Card>
      <SectionHeader title={UI.tiersHeading[locale]} />
      <p className="mb-4 max-w-[60ch] text-sm text-[#3c4f5e]">{UI.tiersLede[locale]}</p>
      <ol className="space-y-3">
        {TIER_COPY.map((tier) => (
          <li
            key={`${tier.order}-${tier.tier}`}
            className="rounded-control border border-[#dde5e8] bg-surface-50 p-3"
          >
            <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="rounded-pill bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white">
                {tier.order}
              </span>
              <h3 className="text-sm font-bold text-[#14202b]">{tier.name[locale]}</h3>
              <span className="text-xs text-[#607785]">
                {RESOLUTION_TIER_LABEL[tier.tier][locale]}
              </span>
            </div>
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              <Pair term={UI.tierTrigger[locale]} detail={tier.trigger[locale]} />
              <Pair term={UI.tierWhoActs[locale]} detail={tier.whoActs[locale]} />
              <Pair term={UI.tierProves[locale]} detail={tier.proves[locale]} />
              {/* The caveat is the most important field on the page: it is
                  what stops a reader concluding more than the engine knows. */}
              <Pair term={UI.tierCaveat[locale]} detail={tier.caveat[locale]} warn />
            </dl>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function Pair({ term, detail, warn = false }: { term: string; detail: string; warn?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-[#607785]">{term}</dt>
      <dd className={`text-sm ${warn ? "text-[#8e030f]" : "text-[#3c4f5e]"}`}>{detail}</dd>
    </div>
  );
}

function ClassTable({ locale }: { locale: Locale }) {
  return (
    <Card>
      <SectionHeader title={UI.classesHeading[locale]} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] border-collapse text-sm">
          <thead>
            <tr className="bg-surface-50 text-left text-xs text-[#607785]">
              <Th>{UI.colClass[locale]}</Th>
              <Th>{UI.colWho[locale]}</Th>
              <Th>{UI.colInData[locale]}</Th>
              <Th>{UI.colEffect[locale]}</Th>
              <Th>{UI.colReach[locale]}</Th>
            </tr>
          </thead>
          <tbody>
            {BEHAVIOR_CLASSES.map((klass) => {
              const copy = CLASS_COPY[klass];
              return (
                <tr key={klass} className="border-t border-[#dde5e8] align-top">
                  <td className="p-3 font-semibold text-[#14202b]">
                    {BEHAVIOR_CLASS_LABEL[klass][locale]}
                  </td>
                  <td className="p-3 text-[#3c4f5e]">{copy.who[locale]}</td>
                  <td className="p-3 text-[#3c4f5e]">{copy.inData[locale]}</td>
                  <td className="p-3 text-[#3c4f5e]">{copy.commercialEffect[locale]}</td>
                  <td className="p-3 text-[#607785]">{copy.reachability[locale]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ThresholdTable({ locale }: { locale: Locale }) {
  return (
    <Card>
      <SectionHeader title={UI.thresholdsHeading[locale]} />
      <p className="mb-3 max-w-[60ch] text-sm text-[#3c4f5e]">{UI.thresholdsLede[locale]}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <thead>
            <tr className="bg-surface-50 text-left text-xs text-[#607785]">
              <Th>{UI.colThreshold[locale]}</Th>
              <Th>{UI.colValue[locale]}</Th>
              <Th>{UI.colEffectPlain[locale]}</Th>
            </tr>
          </thead>
          <tbody>
            {THRESHOLDS.map((row) => (
              <tr key={row.constant} className="border-t border-[#dde5e8] align-top">
                <td className="p-3 font-semibold text-[#14202b]">
                  {row.name[locale]}
                  {/* The symbol name stays untranslated so a developer reading
                      over someone's shoulder can go verify the number. */}
                  <span className="mt-0.5 block font-mono text-xs font-normal text-[#607785]">
                    {row.constant}
                  </span>
                </td>
                <td className="p-3 font-mono tabular-nums text-[#14202b]">{row.value}</td>
                <td className="p-3 text-[#3c4f5e]">{row.effect[locale]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="p-3 font-semibold">{children}</th>;
}
