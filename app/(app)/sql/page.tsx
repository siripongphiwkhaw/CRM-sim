import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/session";
import { getSchemaInfo } from "@/db/queries/sqlconsole";
import { PageHeader, Card } from "@/app/components/ui";
import { SqlConsole } from "./SqlConsole";

export const dynamic = "force-dynamic";

export default async function SqlPage() {
  // Defense in depth — the proxy already blocks non-admins from /sql.
  if (!(await isAdmin())) redirect("/dashboard");

  const schema = await getSchemaInfo();

  return (
    <div>
      <PageHeader
        title="SQL Console"
        subtitle="Run read-only queries against the platform database (admin only)"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <SqlConsole />
        </div>
        <div className="lg:col-span-1">
          <Card>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-400">
              Schema
            </h2>
            <div className="space-y-4">
              {schema.map((t) => (
                <div key={t.table}>
                  <p className="font-mono text-sm font-medium text-stone-800">{t.table}</p>
                  <ul className="mt-1 space-y-0.5">
                    {t.columns.map((c) => (
                      <li key={c} className="font-mono text-xs text-stone-500">{c}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
