import { get, all, run } from "../client";

export interface Distributor {
  id: number;
  distributor_code: string;
  name: string;
  region: string | null;
  channel: string | null;
  status: "active" | "inactive";
  dealer_type: "Dealer" | "Retailer";
  customer_id: number | null;
  area: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  credit_limit: number;
  created_at: string;
  updated_at: string;
}

export interface DistributorInput {
  name: string;
  region?: string | null;
  channel?: string | null;
  status: "active" | "inactive";
  dealer_type: "Dealer" | "Retailer";
  customer_id?: number | null;
  area?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  credit_limit: number;
}

export interface DistributorWithMember extends Distributor {
  member_name: string | null;
  member_code: string | null;
}

export function getDistributorWithMember(id: number): Promise<DistributorWithMember | undefined> {
  return get<DistributorWithMember>(
    `SELECT d.*, (c.first_name || ' ' || c.last_name) AS member_name, c.member_code
     FROM distributors d LEFT JOIN customers c ON c.id = d.customer_id
     WHERE d.id = ?`,
    [id]
  );
}

const SORT_COLUMNS: Record<string, string> = {
  name: "name",
  code: "distributor_code",
  region: "region",
  status: "status",
  created: "created_at",
};

export function listDistributors(opts?: {
  search?: string;
  status?: string;
  region?: string;
  sort?: string;
  dir?: string;
}): Promise<Distributor[]> {
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (opts?.search) {
    clauses.push("(name LIKE ? OR distributor_code LIKE ?)");
    params.push(`%${opts.search}%`, `%${opts.search}%`);
  }
  if (opts?.status) {
    clauses.push("status = ?");
    params.push(opts.status);
  }
  if (opts?.region) {
    clauses.push("region = ?");
    params.push(opts.region);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const column = SORT_COLUMNS[opts?.sort ?? ""] ?? "name";
  const dir = opts?.dir === "desc" ? "DESC" : "ASC";
  return all<Distributor>(
    `SELECT * FROM distributors ${where} ORDER BY ${column} ${dir}`,
    params
  );
}

export function getDistributor(id: number): Promise<Distributor | undefined> {
  return get<Distributor>("SELECT * FROM distributors WHERE id = ?", [id]);
}

export interface DistributorSummary {
  total: number;
  active: number;
  inactive: number;
}

export async function getDistributorSummary(): Promise<DistributorSummary> {
  const row = await get<DistributorSummary>(
    `SELECT COUNT(*) AS total,
       SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
       SUM(CASE WHEN status = 'inactive' THEN 1 ELSE 0 END) AS inactive
     FROM distributors`
  );
  return row ?? { total: 0, active: 0, inactive: 0 };
}

export async function createDistributor(
  input: DistributorInput
): Promise<number> {
  const next = await get<{ next: number }>(
    "SELECT COALESCE(MAX(id), 0) + 1 AS next FROM distributors"
  );
  const code = `DIST-${String(1000 + (next?.next ?? 1))}`;

  return run(
    `INSERT INTO distributors
       (distributor_code, name, region, channel, status, dealer_type, customer_id, area, contact_name, phone, email, address, credit_limit)
     VALUES
       (@code, @name, @region, @channel, @status, @dealer_type, @customer_id, @area, @contact_name, @phone, @email, @address, @credit_limit)
     RETURNING id`,
    {
      code,
      name: input.name,
      region: input.region ?? null,
      channel: input.channel ?? null,
      status: input.status,
      dealer_type: input.dealer_type,
      customer_id: input.customer_id ?? null,
      area: input.area ?? null,
      contact_name: input.contact_name ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      credit_limit: input.credit_limit,
    }
  );
}

export async function updateDistributor(
  id: number,
  input: DistributorInput
): Promise<void> {
  await run(
    `UPDATE distributors SET
       name = @name, region = @region, channel = @channel, status = @status,
       dealer_type = @dealer_type, customer_id = @customer_id, area = @area,
       contact_name = @contact_name, phone = @phone, email = @email,
       address = @address, credit_limit = @credit_limit, updated_at = now()
     WHERE id = @id`,
    {
      id,
      name: input.name,
      region: input.region ?? null,
      channel: input.channel ?? null,
      status: input.status,
      dealer_type: input.dealer_type,
      customer_id: input.customer_id ?? null,
      area: input.area ?? null,
      contact_name: input.contact_name ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      credit_limit: input.credit_limit,
    }
  );
}

/** True if the distributor has any order not yet in a terminal state. */
export async function hasActiveOrders(distributorId: number): Promise<boolean> {
  const row = await get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM orders
     WHERE distributor_id = ? AND status NOT IN ('rejected','fulfilled','cancelled')`,
    [distributorId]
  );
  return (row?.n ?? 0) > 0;
}

export async function deleteDistributor(id: number): Promise<void> {
  await run("DELETE FROM distributors WHERE id = ?", [id]);
}
