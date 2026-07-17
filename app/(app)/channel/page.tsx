import Link from "next/link";
import { getDistributorSummary } from "@/db/queries/distributors";
import { getPendingApprovalCount } from "@/db/queries/orders";
import { getTotalOnHandValue } from "@/db/queries/inventory";
import { getReportSummary } from "@/db/queries/reports";
import { PageHeader, Card, ObjectIcon } from "@/app/components/ui";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

function HubTile({
  href,
  icon,
  title,
  stat,
  description,
}: {
  href: string;
  icon: "distributor" | "order" | "channel" | "product";
  title: string;
  stat: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded border border-[#e5e5e5] bg-white p-4 transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-md"
    >
      <ObjectIcon kind={icon} size="lg" />
      <div className="min-w-0">
        <h3 className="font-semibold text-[#181818]">{title}</h3>
        <p className="text-lg font-bold text-brand-600">{stat}</p>
        <p className="text-xs text-[#706e6b]">{description}</p>
      </div>
    </Link>
  );
}

export default async function ChannelHubPage() {
  const [distributors, pendingApprovals, onHandValue, reports] = await Promise.all([
    getDistributorSummary(),
    getPendingApprovalCount(),
    getTotalOnHandValue(),
    getReportSummary(),
  ]);

  return (
    <div>
      <PageHeader
        icon="channel"
        overline="Sales & Channel"
        title="Trade Operations"
        subtitle="Distributors, self-ordering, inventory and sell-out reporting"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <HubTile
          href="/channel/distributors"
          icon="distributor"
          title="Distributors"
          stat={`${distributors.active} active`}
          description={`${distributors.total} total distributors on file`}
        />
        <HubTile
          href="/channel/orders"
          icon="order"
          title="Orders"
          stat={`${pendingApprovals} pending approval`}
          description="Self-ordering with an approval workflow"
        />
        <HubTile
          href="/channel/inventory"
          icon="channel"
          title="Inventory"
          stat={formatCurrency(onHandValue)}
          description="On-hand stock value, ledger and delivery plans"
        />
        <HubTile
          href="/channel/reports"
          icon="product"
          title="Sell-out Reports"
          stat={`${reports.total_sell_out.toLocaleString("en-US")} units`}
          description={`${reports.distributor_count} distributors reporting`}
        />
      </div>

      <Card className="mt-4">
        <p className="text-sm text-[#444]">
          Distributor master data, an inventory ledger, and self-ordering with
          submit → approve/reject → fulfil replace the old flat channel-numbers
          view. Product Management lives under{" "}
          <Link href="/products" className="text-brand-600 hover:underline">
            Products
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}
