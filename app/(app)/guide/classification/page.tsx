import { PageHeader } from "@/app/components/ui";
import { ClassificationGuide } from "./ClassificationGuide";

export const dynamic = "force-dynamic";

/**
 * Reference explainer for customer classification.
 *
 * Deliberately lives under /guide: that prefix is absent from MODULE_ROUTES in
 * lib/constants.ts, and proxy.ts only gates paths matching a module route — so
 * this page is reachable by every role without adding a module key or touching
 * the middleware. Anyone who can see a classification can read how it works.
 *
 * The header is server-rendered; only the bilingual body needs client state.
 */
export default function ClassificationGuidePage() {
  return (
    <div>
      <PageHeader
        icon="guide"
        overline="Guide"
        title="How classification works"
        subtitle="How the system decides whether a customer is a shopper or a business — and what it deliberately refuses to guess"
      />
      <ClassificationGuide />
    </div>
  );
}
