import Link from "next/link";
import { listMissions } from "@/db/queries/missions";
import { getSession } from "@/lib/session";
import { PageHeader, Card, SectionHeader, EmptyState } from "@/app/components/ui";
import { formatDate } from "@/lib/format";
import { MissionForm } from "./MissionForm";
import { MissionStatusToggle } from "./MissionStatusToggle";

export const dynamic = "force-dynamic";

export default async function MissionsPage() {
  const [missions, session] = await Promise.all([listMissions(), getSession()]);
  const isAdmin = session.role === "admin";

  return (
    <div>
      <PageHeader
        icon="loyalty"
        overline="Loyalty"
        title="Missions"
        subtitle="Tasks members complete in Only-One for bonus points"
        action={
          <Link href="/loyalty" className="text-sm font-medium text-brand-700">
            ← Loyalty
          </Link>
        }
      />

      <Card>
        <SectionHeader title="Mission catalog" count={missions.length} />
        {missions.length === 0 ? (
          <EmptyState message="No missions yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs font-semibold uppercase tracking-wide text-[#3c4f5e]">
                <tr>
                  <th className="py-2 pr-2">Code</th>
                  <th className="py-2 pr-2">Mission</th>
                  <th className="py-2 pr-2">Type</th>
                  <th className="py-2 pr-2 text-right">Points</th>
                  <th className="py-2 pr-2">Approval</th>
                  <th className="py-2 pr-2">Created</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef3f5]">
                {missions.map((m) => (
                  <tr key={m.id}>
                    <td className="py-2 pr-2 font-mono text-xs text-[#607785]">{m.code}</td>
                    <td className="py-2 pr-2">
                      <Link href={`/loyalty/missions/${m.id}`} className="font-medium text-brand-600 hover:underline">
                        {m.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-2 text-[#607785]">{m.mission_type}</td>
                    <td className="py-2 pr-2 text-right text-[#14202b]">{m.reward_points.toLocaleString("en-US")}</td>
                    <td className="py-2 pr-2 text-[#607785]">{m.requires_proof ? "Staff review" : "Automatic"}</td>
                    <td className="py-2 pr-2 text-[#607785]">{formatDate(m.created_at)}</td>
                    <td className="py-2">
                      {isAdmin ? (
                        <MissionStatusToggle id={m.id} status={m.status} />
                      ) : (
                        <span className="text-xs text-[#607785]">{m.status}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {isAdmin && (
          <div className="mt-4">
            <MissionForm />
          </div>
        )}
      </Card>
    </div>
  );
}
