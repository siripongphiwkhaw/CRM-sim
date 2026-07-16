import Link from "next/link";
import { listProducts } from "@/db/queries/products";
import { PageHeader, LinkButton, EmptyState } from "@/app/components/ui";
import { ProductImage } from "@/app/components/ProductImage";
import { DeleteButton } from "@/app/components/form";
import { formatCurrency } from "@/lib/format";
import { BRANDS } from "@/lib/constants";
import { deleteProductAction } from "./actions";

export const dynamic = "force-dynamic";

const filterClass =
  "rounded-full border border-stone-300 bg-white px-4 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; brand?: string }>;
}) {
  const { q, brand } = await searchParams;
  const products = await listProducts({ search: q, brand });

  return (
    <div>
      <PageHeader
        title="Products (S&I)"
        subtitle={`${products.length} products in the master database`}
        action={<LinkButton href="/products/new">New product</LinkButton>}
      />

      <form method="get" className="mb-6 flex flex-wrap gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search name or SKU…"
          className={`w-full max-w-xs ${filterClass}`}
        />
        <select name="brand" defaultValue={brand ?? ""} className={filterClass}>
          <option value="">All brands</option>
          {BRANDS.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-full border border-stone-300 bg-white px-5 py-2 text-sm font-medium text-stone-700 transition-colors hover:border-brand-600 hover:text-brand-700"
        >
          Filter
        </button>
      </form>

      {products.length === 0 ? (
        <EmptyState message="No products match your filters." />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {products.map((p) => (
            <div
              key={p.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_3px_rgba(41,37,36,0.06)] transition-shadow hover:shadow-md"
            >
              <Link href={`/products/${p.id}/edit`} className="block p-4 pb-0">
                <ProductImage
                  brand={p.brand}
                  category={p.category}
                  className="mx-auto w-full max-w-[160px]"
                />
              </Link>
              <div className="flex flex-1 flex-col p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                  {p.brand}
                </p>
                <Link
                  href={`/products/${p.id}/edit`}
                  className="mt-0.5 line-clamp-2 text-sm font-medium text-stone-800 group-hover:text-brand-700"
                >
                  {p.name}
                </Link>
                <p className="mt-1 text-xs text-stone-400">
                  {p.category || "Uncategorized"} · <span className="font-mono">{p.sku}</span>
                </p>
                <div className="mt-auto flex items-center justify-between pt-3">
                  <span className="text-lg font-semibold text-brand-600">
                    {formatCurrency(p.unit_price)}
                  </span>
                  <DeleteButton
                    action={deleteProductAction}
                    id={p.id}
                    label="✕"
                    confirmMessage={`Delete ${p.name}?`}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
