import { get, all, batch, type QueryArgs } from "../client";
import { calcEarn, channelEligibility } from "@/lib/loyaltyEngine";
import { getTierRules, recomputeCustomerCache } from "./loyalty";
import type { TxChannel, Tier, CustType } from "@/lib/constants";

export interface TransactionRow {
  id: number;
  tx_code: string;
  customer_id: number;
  channel: TxChannel;
  amount_thb: number;
  channel_flag: string | null;
  source_ref: string | null;
  created_by: number | null;
  tx_date: string;
}

export interface CreateTransactionInput {
  customer_id: number;
  channel: TxChannel;
  amount_thb: number;
  source_ref?: string | null;
  created_by?: number | null;
  tx_date?: string | null;
}

export interface CreateTransactionResult {
  txId: number;
  txCode: string;
  channelFlag: "CHANNEL_ELIGIBILITY_WARNING" | null;
  earned: { points: number; rate: number; multiplier: number; tier: Tier };
}

/**
 * Records a purchase and credits loyalty points atomically. The transaction and
 * its matching EARN ledger row are inserted in one batch (the ledger row uses
 * SQLite's last_insert_rowid() to reference the transaction). Then the customer
 * cache (points/tier) is recomputed and clv/last_purchase_at updated.
 */
export async function createTransaction(
  input: CreateTransactionInput
): Promise<CreateTransactionResult> {
  const customer = await get<{ id: number; cust_type: CustType; tier: Tier }>(
    "SELECT id, cust_type, tier FROM customers WHERE id = ?",
    [input.customer_id]
  );
  if (!customer) throw new Error(`Customer ${input.customer_id} not found`);

  const rules = await getTierRules();
  const flag =
    channelEligibility(customer.cust_type, input.channel) === "OK"
      ? null
      : "CHANNEL_ELIGIBILITY_WARNING";
  const earn = calcEarn(input.amount_thb, customer.cust_type, customer.tier, rules);

  const next = await get<{ n: number }>("SELECT COALESCE(MAX(id),0)+1 AS n FROM transactions");
  const txCode = `TXN-${String(next?.n ?? 1).padStart(6, "0")}`;
  const txDate = input.tx_date ?? new Date().toISOString();

  const statements: { sql: string; args: QueryArgs }[] = [
    {
      sql: `INSERT INTO transactions
              (tx_code, customer_id, channel, amount_thb, channel_flag, source_ref, created_by, tx_date)
            VALUES (@code, @cid, @channel, @amount, @flag, @ref, @actor, @date)`,
      args: {
        code: txCode,
        cid: input.customer_id,
        channel: input.channel,
        amount: input.amount_thb,
        flag,
        ref: input.source_ref ?? null,
        actor: input.created_by ?? null,
        date: txDate,
      },
    },
  ];

  // Only post an EARN row when the purchase actually earns points (>0).
  if (earn.points > 0) {
    statements.push({
      sql: `INSERT INTO loyalty_ledger
              (customer_id, entry_type, points, rate_applied, multiplier, tier_at_time, ref_type, ref_id, note, created_by)
            VALUES (@cid, 'EARN', @points, @rate, @mult, @tier, 'transaction', last_insert_rowid(), @note, @actor)`,
      args: {
        cid: input.customer_id,
        points: earn.points,
        rate: earn.rate,
        mult: earn.multiplier,
        tier: customer.tier,
        note: `Earn on ${input.channel} purchase`,
        actor: input.created_by ?? null,
      },
    });
  }

  statements.push({
    sql: `UPDATE customers SET clv = clv + @amount, last_purchase_at = @date, updated_at = datetime('now')
          WHERE id = @cid`,
    args: { amount: input.amount_thb, date: txDate, cid: input.customer_id },
  });

  await batch(statements);
  await recomputeCustomerCache(input.customer_id);

  const created = await get<{ id: number }>(
    "SELECT id FROM transactions WHERE tx_code = ?",
    [txCode]
  );
  return {
    txId: created?.id ?? 0,
    txCode,
    channelFlag: flag,
    earned: { ...earn, tier: customer.tier },
  };
}

export function listTransactions(customerId: number, limit = 100): Promise<TransactionRow[]> {
  return all<TransactionRow>(
    `SELECT * FROM transactions WHERE customer_id = ? ORDER BY tx_date DESC, id DESC LIMIT ${limit}`,
    [customerId]
  );
}

export interface TimelineItem {
  kind: "transaction" | "earn" | "burn" | "adjust" | "interaction" | "case";
  title: string;
  detail: string | null;
  amount: number | null;
  points: number | null;
  occurred_at: string;
}

/** Merged Customer 360 activity feed across transactions, ledger, interactions, cases. */
export function getCustomerTimeline(customerId: number): Promise<TimelineItem[]> {
  return all<TimelineItem>(
    `SELECT 'transaction' AS kind, ('Purchase · ' || channel) AS title,
            channel_flag AS detail, amount_thb AS amount, NULL AS points, tx_date AS occurred_at
       FROM transactions WHERE customer_id = @cid
     UNION ALL
     SELECT CASE entry_type WHEN 'EARN' THEN 'earn' WHEN 'BURN' THEN 'burn' ELSE 'adjust' END AS kind,
            (entry_type || ' ' || points || ' pts') AS title,
            note AS detail, NULL AS amount, points AS points, occurred_at
       FROM loyalty_ledger WHERE customer_id = @cid
     UNION ALL
     SELECT 'interaction' AS kind, type AS title,
            description AS detail, amount AS amount, points AS points, occurred_at
       FROM interactions WHERE customer_id = @cid
     UNION ALL
     SELECT 'case' AS kind, ('Case · ' || subject) AS title,
            status AS detail, NULL AS amount, NULL AS points, created_at AS occurred_at
       FROM cases WHERE customer_id = @cid
     ORDER BY occurred_at DESC
     LIMIT 60`,
    { cid: customerId }
  );
}
