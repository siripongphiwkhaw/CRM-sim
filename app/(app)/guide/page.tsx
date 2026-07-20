import { getSession } from "@/lib/session";
import { isPicOfAny } from "@/db/queries/departments";
import { PageHeader } from "@/app/components/ui";
import { GuideTabs } from "./GuideTabs";

export const dynamic = "force-dynamic";

export default async function GuidePage() {
  const session = await getSession();
  const isAdmin = session.role === "admin";
  const isPic = session.userId ? await isPicOfAny(session.userId) : false;

  // Default the open tab to the viewer's own role; all three stay readable.
  const defaultRole = isAdmin ? "admin" : isPic ? "pic" : "staff";

  return (
    <div>
      <PageHeader
        icon="guide"
        overline="Guide"
        title="How to use this platform"
        subtitle="Step-by-step guidance for each role — pick a tab to see what you can do"
      />
      <GuideTabs defaultRole={defaultRole} />
    </div>
  );
}
