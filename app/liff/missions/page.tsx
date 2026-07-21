import { redirect } from "next/navigation";
import { requireMember } from "@/lib/liffAuth";
import { listMissions, listSubmissions } from "@/db/queries/missions";
import { missionAvailable } from "@/lib/loyaltyEngine";
import { LiffShell, SectionCard, LiffEmpty, BottomNav } from "../components/ui";
import { MissionSubmitForm } from "./MissionSubmitForm";

export const dynamic = "force-dynamic";

export default async function LiffMissionsPage() {
  const auth = await requireMember();
  if (!auth.ok) redirect("/liff");

  const [missions, mySubmissions] = await Promise.all([
    listMissions({ status: "PUBLISHED" }),
    listSubmissions({ customerId: auth.customerId }),
  ]);
  const available = missions.filter(missionAvailable);
  // Latest submission per mission (there can be a REJECTED history entry
  // followed by a fresh attempt) — keep the most recent by submitted_at.
  const latestByMission = new Map<number, (typeof mySubmissions)[number]>();
  for (const s of mySubmissions) {
    const existing = latestByMission.get(s.mission_id);
    if (!existing || s.submitted_at > existing.submitted_at) latestByMission.set(s.mission_id, s);
  }

  return (
    <>
      <LiffShell>
        <h1 className="text-lg font-bold text-[#14202b]">Missions</h1>
        <p className="mb-3 mt-0.5 text-sm text-[#607785]">
          Complete missions for bonus points on top of your purchases.
        </p>

        {available.length === 0 ? (
          <SectionCard title="Missions">
            <LiffEmpty message="No missions available right now." />
          </SectionCard>
        ) : (
          <ul className="space-y-2">
            {available.map((m) => {
              const mine = latestByMission.get(m.id);
              return (
                <li key={m.id} className="rounded-[14px] border border-[#dde5e8] bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#14202b]">{m.name}</p>
                      {m.description && (
                        <p className="mt-0.5 text-xs text-[#607785]">{m.description}</p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                      +{m.reward_points.toLocaleString("en-US")}
                    </span>
                  </div>

                  <div className="mt-3">
                    {mine?.status === "PENDING" && (
                      <p className="rounded-[12px] bg-[#fff5ec] px-3 py-2 text-xs text-[#8a4b1e]">
                        Submitted — waiting on staff review.
                      </p>
                    )}
                    {mine?.status === "APPROVED" && (
                      <p className="rounded-[12px] bg-[#f2fbef] px-3 py-2 text-xs text-[#194e31]">
                        Completed — points awarded.
                      </p>
                    )}
                    {(!mine || mine.status === "REJECTED") && (
                      <MissionSubmitForm
                        missionId={m.id}
                        requiresProof={Boolean(m.requires_proof)}
                        wasRejected={mine?.status === "REJECTED"}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </LiffShell>
      <BottomNav active="/liff/missions" />
    </>
  );
}
