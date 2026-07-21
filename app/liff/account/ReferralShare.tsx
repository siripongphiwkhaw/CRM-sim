"use client";

import { useState } from "react";

/** Copy-to-clipboard for the member's referral link. No send/share-sheet
 * integration — plain copy is enough for the demo scope. */
export function ReferralShare({ shareUrl, code }: { shareUrl: string; code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-[10px] bg-[#f4f7f8] px-2 py-1.5 text-xs text-[#14202b]">
          {shareUrl}
        </code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(shareUrl).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="shrink-0 rounded-[10px] bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-1 text-xs text-[#607785]">
        Your code: <span className="font-mono">{code}</span> — both of you get bonus
        points when a friend joins with it.
      </p>
    </div>
  );
}
