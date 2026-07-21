import Link from "next/link";
import { notFound } from "next/navigation";
import { getMission, listSubmissions } from "@/db/queries/missions";
import { getSession } from "@/lib/session";
import { PageHeader, Card, SectionHeader, EmptyState } from "@/app/components/ui";
import { formatDate } from "@/lib/format";
import { MissionStatusToggle } from "../MissionStatusToggle";
import { ReviewButtons } from "./ReviewButtons";

export const dynamic = "force-dynamic";

export default async function MissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const missionId = Number(id);
  if (!Number.isFinite(missionId)) notFound();

  const [mission, submissions, session] = await Promise.all([
    getMission(missionId),
    listSubmissions({ missionId }),
    getSession(),
  ]);
  if (!mission) notFound();
  const isAdmin = session.role === "admin";
  const pending = submissions.filter((s) => s.status === "PENDING");
  const decided = submissions.filter((s) => s.status !== "PENDING");

  return (
    <div>
      <PageHeader
        icon="loyalty"
        overline="Loyalty · Missions"
        title={mission.name}
        subtitle={`${mission.reward_points.toLocaleString("en-US")} points · ${mission.requires_proof ? "Staff review required" : "Auto-awarded on submit"}`}
        action={
          <div className="flex items-center gap-2">
            {isAdmin && <MissionStatusToggle id={mission.id} status={mission.status} />}
            <Link href="/loyalty/missions" className="text-sm font-medium text-brand-700">
              ← Missions
            </Link>
          </div>
        }
      />

      {mission.description && (
        <Card className="mb-4">
          <p className="text-sm text-[#3c4f5e]">{mission.description}</p>
        </Card>
      )}

      {mission.requires_proof && (
        <Card className="mb-4">
          <SectionHeader title="Pending review" count={pending.length} />
          {pending.length === 0 ? (
            <EmptyState message="Nothing waiting on review." />
          ) : (
            <ul className="divide-y divide-[#eef3f5]">
              {pending.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <Link href={`/customers/${s.customer_id}`} className="font-medium text-brand-600 hover:underline">
                      {s.member_name}
                    </Link>
                    <p className="text-xs text-[#607785]">
                      {s.proof_note || "No proof note"} · {formatDate(s.submitted_at)}
                    </p>
                  </div>
                  <ReviewButtons submissionId={s.id} missionId={mission.id} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card>
        <SectionHeader title="Submission history" count={decided.length} />
        {decided.length === 0 ? (
          <EmptyState message="No decided submissions yet." />
        ) : (
          <ul className="divide-y divide-[#eef3f5]">
            {decided.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <Link href={`/customers/${s.customer_id}`} className="font-medium text-brand-600 hover:underline">
                    {s.member_name}
                  </Link>
                  <p className="text-xs text-[#607785]">{formatDate(s.submitted_at)}</p>
                </div>
                <span
                  className={`shrink-0 rounded-[16px] px-2 py-0.5 text-xs font-medium ${
                    s.status === "APPROVED" ? "bg-[#cdefc4] text-[#194e31]" : "bg-[#feded8] text-[#8e030f]"
                  }`}
                >
                  {s.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
