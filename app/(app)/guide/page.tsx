import { getSession } from "@/lib/session";
import { isPicOfAny } from "@/db/queries/departments";
import Link from "next/link";
import { Card, PageHeader, SectionHeader } from "@/app/components/ui";
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
      <Card className="mb-4 border-l-4 border-l-brand-600">
        <SectionHeader title="How classification works" />
        <p className="mb-2 max-w-[62ch] text-sm text-[#3c4f5e]">
          Why a customer counts as a shopper or a business, what each piece of evidence can and
          cannot prove, and the real thresholds behind it. Available in Thai and English.
        </p>
        <Link
          href="/guide/classification"
          className="text-sm font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
        >
          Read the classification guide →
        </Link>
      </Card>
      <GuideTabs defaultRole={defaultRole} />
    </div>
  );
}
