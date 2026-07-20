import Link from "next/link";
import { listProducts } from "@/db/queries/products";
import { PageHeader, LinkButton, EmptyState } from "@/app/components/ui";
import { ProductImage } from "@/app/components/ProductImage";
import { DeleteButton, FormError } from "@/app/components/form";
import { formatCurrency } from "@/lib/format";
import { BRANDS } from "@/lib/constants";
import { deleteProductAction } from "./actions";

export const dynamic = "force-dynamic";

const filterClass =
  "rounded border border-[#c2d0d6] bg-white px-3 py-1.5 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; brand?: string; error?: string }>;
}) {
  const { q, brand, error } = await searchParams;
  const products = await listProducts({ search: q, brand });

  return (
    <div>
      <PageHeader
        icon="product"
        overline="Products"
        title="Product Master"
        subtitle={`${products.length} products`}
        action={<LinkButton href="/products/new">New</LinkButton>}
      />

      {error === "has-orders" && (
        <div className="mb-4">
          <FormError message="This product is referenced by existing orders and cannot be deleted." />
        </div>
      )}

      <form method="get" className="mb-4 flex flex-wrap gap-2">
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
          className="rounded border border-[#c2d0d6] bg-white px-4 py-1.5 text-sm font-medium text-[#3c4f5e] transition duration-150 hover:bg-[#eef3f5] active:scale-[0.98]"
        >
          Filter
        </button>
      </form>

      {products.length === 0 ? (
        <EmptyState message="No products match your filters." />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {products.map((p) => (
            <div
              key={p.id}
              className="group flex flex-col overflow-hidden rounded border border-[#dde5e8] bg-white transition-[box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:shadow-md"
            >
              <Link href={`/products/${p.id}/edit`} className="block p-3 pb-0">
                <ProductImage
                  brand={p.brand}
                  category={p.category}
                  imageUrl={p.image_url}
                  className="mx-auto w-full max-w-[140px]"
                />
              </Link>
              <div className="flex flex-1 flex-col p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-[#607785]">
                  {p.brand}
                </p>
                <Link
                  href={`/products/${p.id}/edit`}
                  className="mt-0.5 line-clamp-2 text-sm font-medium text-[#14202b] group-hover:text-brand-600"
                >
                  {p.name}
                </Link>
                <p className="mt-1 text-xs text-[#607785]">
                  {p.category || "Uncategorized"} · <span className="font-mono">{p.sku}</span>
                </p>
                <div className="mt-auto flex items-center justify-between pt-2">
                  <span className="text-base font-semibold text-brand-600">
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
