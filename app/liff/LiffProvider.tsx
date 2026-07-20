"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithLineAction } from "./actions";

/**
 * Bootstraps the LINE LIFF SDK and hands the resulting ID token to the server
 * for verification. Renders nothing on the happy path.
 *
 * The SDK is imported dynamically inside the effect: @line/liff touches
 * `window` at module scope, so a static import breaks the server render.
 */
export function LiffProvider({
  liffId,
  configured,
  hasSession,
}: {
  liffId: string;
  configured: boolean;
  hasSession: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Nothing to do when LINE isn't set up (the dev picker handles sign-in),
    // or when the member session cookie is already valid.
    if (!configured || hasSession) return;

    let cancelled = false;

    (async () => {
      try {
        const liff = (await import("@line/liff")).default;
        await liff.init({ liffId });

        if (!liff.isLoggedIn()) {
          liff.login();
          return; // redirects away
        }

        const idToken = liff.getIDToken();
        if (!idToken) {
          // Overwhelmingly the most common LIFF misconfiguration, so name it
          // precisely instead of failing as a generic "not linked".
          setError(
            "LINE did not return an ID token. The LINE Login channel needs the 'openid' scope enabled."
          );
          return;
        }

        const result = await signInWithLineAction(idToken);
        if (cancelled) return;
        if (!result.ok) {
          setError(result.error ?? "Could not sign you in.");
          return;
        }
        router.refresh();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not start the LINE app.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [configured, hasSession, liffId, router]);

  if (!error) return null;

  return (
    <div className="mx-4 mt-4 rounded-[14px] border border-[#f3c2c2] bg-[#feded8] px-4 py-3 text-sm text-[#8e030f]">
      {error}
    </div>
  );
}
