import { redirect } from "next/navigation";
import { requireMember } from "@/lib/liffAuth";
import { listLedger } from "@/db/queries/loyalty";
import { formatDate } from "@/lib/format";
import { LiffShell, LedgerRow, SectionCard, LiffEmpty, BottomNav } from "../components/ui";

export const dynamic = "force-dynamic";

/** Groups entries under a "Month YYYY" heading, preserving ledger order. */
function monthLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Earlier";
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default async function LiffHistoryPage() {
  const auth = await requireMember();
  if (!auth.ok) redirect("/liff");

  const entries = await listLedger(auth.customerId, { limit: 100 });

  const groups: { month: string; rows: typeof entries }[] = [];
  for (const entry of entries) {
    const month = monthLabel(entry.occurred_at);
    const last = groups[groups.length - 1];
    if (last && last.month === month) last.rows.push(entry);
    else groups.push({ month, rows: [entry] });
  }

  return (
    <>
      <LiffShell>
        <h1 className="mb-3 text-lg font-bold text-[#14202b]">Points history</h1>

        {entries.length === 0 ? (
          <SectionCard title="Activity">
            <LiffEmpty message="No points activity yet." />
          </SectionCard>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <SectionCard key={g.month} title={g.month}>
                <ul className="divide-y divide-[#eef3f5]">
                  {g.rows.map((e) => (
                    <LedgerRow
                      key={e.id}
                      title={e.note ?? e.entry_type}
                      detail={`${e.entry_type} · ${formatDate(e.occurred_at)}`}
                      points={e.points}
                      isCredit={e.entry_type === "EARN"}
                    />
                  ))}
                </ul>
              </SectionCard>
            ))}
          </div>
        )}
      </LiffShell>
      <BottomNav active="/liff/history" />
    </>
  );
}
