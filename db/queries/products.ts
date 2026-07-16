import { get, all, run } from "../client";
import type { Brand } from "@/lib/constants";

export interface Product {
  id: number;
  sku: string;
  name: string;
  brand: Brand;
  category: string | null;
  unit_price: number;
  created_at: string;
}

export interface ProductInput {
  sku: string;
  name: string;
  brand: Brand;
  category?: string | null;
  unit_price: number;
}

export function listProducts(opts?: {
  search?: string;
  brand?: string;
}): Promise<Product[]> {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (opts?.search) {
    clauses.push("(name LIKE ? OR sku LIKE ?)");
    params.push(`%${opts.search}%`, `%${opts.search}%`);
  }
  if (opts?.brand) {
    clauses.push("brand = ?");
    params.push(opts.brand);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return all<Product>(
    `SELECT * FROM products ${where} ORDER BY brand, name`,
    params
  );
}

export function getProduct(id: number): Promise<Product | undefined> {
  return get<Product>("SELECT * FROM products WHERE id = ?", [id]);
}

export function createProduct(input: ProductInput): Promise<number> {
  return run(
    `INSERT INTO products (sku, name, brand, category, unit_price)
     VALUES (@sku, @name, @brand, @category, @unit_price)`,
    {
      sku: input.sku,
      name: input.name,
      brand: input.brand,
      category: input.category ?? null,
      unit_price: input.unit_price,
    }
  );
}

export async function updateProduct(
  id: number,
  input: ProductInput
): Promise<void> {
  await run(
    `UPDATE products SET sku = @sku, name = @name, brand = @brand,
       category = @category, unit_price = @unit_price WHERE id = @id`,
    {
      id,
      sku: input.sku,
      name: input.name,
      brand: input.brand,
      category: input.category ?? null,
      unit_price: input.unit_price,
    }
  );
}

export async function deleteProduct(id: number): Promise<void> {
  await run("DELETE FROM products WHERE id = ?", [id]);
}
