import Link from "next/link";
import { PageHeader, Card, ObjectIcon, type ObjectKind } from "@/app/components/ui";
import type { CustType } from "@/lib/constants";

const SEGMENTS: {
  type: CustType;
  title: string;
  blurb: string;
  icon: ObjectKind;
}[] = [
  {
    type: "B2B",
    title: "B2B Customers",
    icon: "b2b",
    blurb: "Companies and trade buyers — dealers, HoReCa and ingredient accounts.",
  },
  {
    type: "B2C",
    title: "B2C Customers",
    icon: "customer",
    blurb: "Individual members buying for themselves.",
  },
];

export function SegmentPicker({
  counts,
}: {
  counts: { cust_type: CustType; count: number }[];
}) {
  const byType = new Map(counts.map((c) => [c.cust_type, c.count]));

  return (
    <div>
      <PageHeader
        icon="customer"
        overline="Customers"
        title="Customers"
        subtitle="Pick a segment, or view the full list."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SEGMENTS.map((s) => {
          const n = byType.get(s.type) ?? 0;
          return (
            <Link
              key={s.type}
              href={`/customers?type=${s.type}`}
              className="block rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <Card className="h-full transition hover:border-brand-600">
                <div className="flex items-center gap-3">
                  <ObjectIcon kind={s.icon} size="lg" />
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-[#14202b]">{s.title}</h2>
                    <p className="text-xl font-bold text-brand-600">
                      {n.toLocaleString("en-US")}
                      <span className="ml-1 text-xs font-normal text-[#607785]">
                        {n === 1 ? "customer" : "customers"}
                      </span>
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-xs text-[#607785]">{s.blurb}</p>
              </Card>
            </Link>
          );
        })}
      </div>

      <p className="mt-4 text-sm">
        <Link
          href="/customers?type=all"
          className="rounded-control text-brand-600 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          View all customers →
        </Link>
      </p>
    </div>
  );
}
