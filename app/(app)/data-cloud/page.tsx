import { listDataSources } from "@/db/queries/dataSources";
import { PageHeader, Card, SourceStatusBadge } from "@/app/components/ui";
import { formatDate } from "@/lib/format";
import { SyncButton } from "./SyncButton";

export const dynamic = "force-dynamic";

export default async function DataCloudPage() {
  const sources = await listDataSources();
  const totalRecords = sources.reduce((s, x) => s + x.records_synced, 0);
  const connected = sources.filter((s) => s.status === "connected").length;

  return (
    <div>
      <PageHeader
        title="Data Cloud"
        subtitle="Linked source systems for data integration & migration"
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-stone-500">Connected sources</p>
          <p className="mt-1 text-2xl font-semibold text-stone-900">
            {connected}/{sources.length}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-stone-500">Records linked</p>
          <p className="mt-1 text-2xl font-semibold text-stone-900">
            {totalRecords.toLocaleString("en-US")}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-stone-500">Integration modes</p>
          <p className="mt-1 text-2xl font-semibold text-stone-900">Real-time + Batch</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {sources.map((s) => (
          <Card key={s.id}>
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-medium text-stone-900">{s.name}</h3>
                <p className="text-xs text-stone-400">
                  {s.source_type} · {s.direction} · {s.mode}
                </p>
              </div>
              <SourceStatusBadge status={s.status} />
            </div>
            {s.description && (
              <p className="mb-3 text-sm text-stone-600">{s.description}</p>
            )}
            <div className="flex items-center justify-between border-t border-stone-100 pt-3">
              <div className="text-xs text-stone-500">
                {s.records_synced.toLocaleString("en-US")} records · last synced{" "}
                {formatDate(s.last_synced_at)}
              </div>
              <SyncButton id={s.id} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
