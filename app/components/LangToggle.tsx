"use client";

import { useCallback, useEffect, useState } from "react";
import { LOCALES, UI, type Locale } from "@/lib/classificationCopy";

const STORAGE_KEY = "crm.explainerLocale";
/** Same-tab broadcast. `storage` only fires in OTHER tabs, so two explainer
 * components mounted on one page would otherwise drift apart. */
const SYNC_EVENT = "crm:explainer-locale";

function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Language choice for the classification explainer, shared across surfaces.
 *
 * Deliberately a hook over localStorage rather than a React context provider:
 * the reference page and the customer panel live on different routes and never
 * mount together, so what actually needs sharing is *persisted* state, not
 * runtime state. Mounting a provider in the app shell would push a client
 * boundary onto every page in the CRM for a feature that lives on two of them.
 * If a third surface ever needs it, the body of this hook lifts into a
 * provider with no change at any call site.
 *
 * HYDRATION RULE: localStorage is read only inside the effect, never during
 * render and never in a useState initializer. The server renders "en" and the
 * first client render must match it; the effect then corrects. The cost is one
 * frame of English for a reader who chose Thai, which is the right trade
 * against a hydration mismatch.
 */
export function useExplainerLocale(): [Locale, (next: Locale) => void] {
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    const read = () => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (isLocale(stored)) setLocale(stored);
      } catch {
        // Private mode / storage disabled — stay on the default for the session.
      }
    };
    read();
    window.addEventListener("storage", read);
    window.addEventListener(SYNC_EVENT, read);
    return () => {
      window.removeEventListener("storage", read);
      window.removeEventListener(SYNC_EVENT, read);
    };
  }, []);

  const choose = useCallback((next: Locale) => {
    setLocale(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
      window.dispatchEvent(new Event(SYNC_EVENT));
    } catch {
      // Non-persistent is still usable for this session.
    }
  }, []);

  return [locale, choose];
}

const NAMES: Record<Locale, string> = { en: "English", th: "ไทย" };

/**
 * Segmented EN | TH control.
 *
 * Interaction states: default, hover, focus-visible and active are all styled
 * below. Disabled, loading, error and success do not apply — switching
 * language is synchronous, local, and cannot fail; rendering a spinner or an
 * error state for it would be inventing failure modes that do not exist.
 */
export function LangToggle({
  locale,
  onChange,
}: {
  locale: Locale;
  onChange: (next: Locale) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[#607785]">{UI.langLabel[locale]}</span>
      <div
        role="group"
        aria-label={`${UI.langLabel.en} / ${UI.langLabel.th}`}
        className="inline-flex overflow-hidden rounded-pill border border-[#c2d0d6]"
      >
        {LOCALES.map((code) => {
          const active = code === locale;
          return (
            <button
              key={code}
              type="button"
              // The Thai button's own label is Thai even while the surrounding
              // UI is English, so it needs its own lang for correct font
              // selection and screen-reader pronunciation.
              lang={code}
              aria-pressed={active}
              onClick={() => onChange(code)}
              className={[
                "px-3 py-1 text-xs font-medium transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
                "active:scale-[0.98]",
                active
                  ? "bg-brand-600 text-white"
                  : "bg-white text-[#3c4f5e] hover:bg-surface-100",
              ].join(" ")}
            >
              {NAMES[code]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
