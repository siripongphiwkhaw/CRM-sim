/**
 * LINE / LIFF configuration flags.
 *
 * NEXT_PUBLIC_LIFF_ID is deliberately public: liff.init() runs in the browser
 * and the id already appears in the https://liff.line.me/<id> URL every user
 * opens. LINE_CHANNEL_ID stays server-only — it is used as `client_id` when
 * verifying an ID token, and server-side LINE credentials should never cross
 * the NEXT_PUBLIC_ boundary (values behind that prefix are inlined into the
 * client bundle at build time and cannot be rotated without a rebuild).
 */

export const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID ?? "";
export const LINE_CHANNEL_ID = process.env.LINE_CHANNEL_ID ?? "";

/** True once real LINE credentials are present. */
export const LIFF_CONFIGURED = Boolean(LIFF_ID) && Boolean(LINE_CHANNEL_ID);

/** The link that opens the mini-app inside LINE. Empty until LIFF_ID is set. */
export const LIFF_URL = LIFF_ID ? `https://liff.line.me/${LIFF_ID}` : "";

/**
 * The demo member picker. Three fail-closed conditions, all required:
 *
 * 1. Not a production build — every Vercel deployment (production AND preview)
 *    sets NODE_ENV=production, so no deployment can ever enable this.
 * 2. LINE is not configured — the moment real credentials exist the fallback
 *    dies on its own, so there is no flag anyone has to remember to turn off.
 * 3. Explicit developer opt-in, so it never appears for someone who just
 *    cloned the repo and hasn't set LINE up yet.
 *
 * Never trust this alone: the picker route calls notFound() and every demo
 * server action re-checks it, because server actions are independently
 * addressable POST endpoints regardless of what the UI renders.
 */
export const DEV_FALLBACK_ENABLED =
  process.env.NODE_ENV !== "production" &&
  !LIFF_CONFIGURED &&
  process.env.LIFF_DEV_FALLBACK === "1";
