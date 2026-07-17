import { listDataSources } from "@/db/queries/dataSources";
import { PageHeader, Card, SourceStatusBadge } from "@/app/components/ui";
import { formatRelative } from "@/lib/format";
import { SyncButton } from "./SyncButton";
import { SyncAllButton } from "./SyncAllButton";

export const dynamic = "force-dynamic";

export default async function DataCloudPage() {
  const sources = await listDataSources();
  const totalRecords = sources.reduce((s, x) => s + x.records_synced, 0);
  const connected = sources.filter((s) => s.status === "connected").length;

  return (
    <div>
      <PageHeader
        icon="datacloud"
        overline="Data Cloud"
        title="Linked Sources"
        subtitle="Source systems for data integration & migration"
        action={<SyncAllButton />}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-xs text-[#706e6b]">Connected sources</p>
          <p className="mt-0.5 text-xl font-bold text-[#181818]">
            {connected}/{sources.length}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-[#706e6b]">Records linked</p>
          <p className="mt-0.5 text-xl font-bold text-[#181818]">
            {totalRecords.toLocaleString("en-US")}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-[#706e6b]">Integration modes</p>
          <p className="mt-0.5 text-xl font-bold text-[#181818]">Real-time + Batch</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {sources.map((s) => (
          <Card key={s.id}>
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-[#181818]">{s.name}</h3>
                <p className="text-xs text-[#706e6b]">
                  {s.source_type} · {s.direction} · {s.mode}
                </p>
              </div>
              <SourceStatusBadge status={s.status} />
            </div>
            {s.description && (
              <p className="mb-3 text-sm text-[#444]">{s.description}</p>
            )}
            <div className="flex items-center justify-between border-t border-[#f3f3f3] pt-2">
              <div className="text-xs text-[#706e6b]">
                {s.records_synced.toLocaleString("en-US")} records · synced{" "}
                {formatRelative(s.last_synced_at)}
              </div>
              <SyncButton id={s.id} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
