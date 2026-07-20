import { redirect } from "next/navigation";

/**
 * Registration now happens inline at /liff (see the LIFF redirect-loop note in
 * ../page.tsx). This path is kept only so any old link resolves — it sends the
 * member to the single canonical entry point rather than a second page the
 * LINE login round-trip could land on and loop over.
 */
export default function LiffLinkRedirect() {
  redirect("/liff");
}
