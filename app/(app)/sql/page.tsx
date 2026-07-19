import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/session";
import { getSchemaInfo } from "@/db/queries/sqlconsole";
import { PageHeader, Card, SectionHeader } from "@/app/components/ui";
import { SqlConsole } from "./SqlConsole";

export const dynamic = "force-dynamic";

export default async function SqlPage() {
  // Defense in depth — the proxy already blocks non-admins from /sql.
  if (!(await isAdmin())) redirect("/dashboard");

  const schema = await getSchemaInfo();

  return (
    <div>
      <PageHeader
        icon="sql"
        overline="Setup · Developer"
        title="SQL Console"
        subtitle="Run read-only queries against the platform database (admin only)"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <SqlConsole />
        </div>
        <div className="lg:col-span-1">
          <Card>
            <SectionHeader title="Schema" />
            <div className="space-y-3">
              {schema.map((t) => (
                <div key={t.table}>
                  <p className="font-mono text-sm font-semibold text-[#14202b]">{t.table}</p>
                  <ul className="mt-0.5 space-y-0.5">
                    {t.columns.map((c) => (
                      <li key={c} className="font-mono text-xs text-[#607785]">{c}</li>
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
