import { all, batch } from "../client";
import type { InteractionType } from "@/lib/constants";

export interface Interaction {
  id: number;
  customer_id: number;
  type: InteractionType;
  channel: string | null;
  amount: number;
  points: number;
  description: string | null;
  occurred_at: string;
}

export interface InteractionWithCustomer extends Interaction {
  customer_name: string;
  member_code: string;
}

export function listInteractionsByCustomer(
  customerId: number
): Promise<Interaction[]> {
  return all<Interaction>(
    "SELECT * FROM interactions WHERE customer_id = ? ORDER BY occurred_at DESC",
    [customerId]
  );
}

export function listRecentInteractions(
  limit = 12
): Promise<InteractionWithCustomer[]> {
  return all<InteractionWithCustomer>(
    `SELECT i.*,
       (c.first_name || ' ' || c.last_name) AS customer_name,
       c.member_code
     FROM interactions i
     JOIN customers c ON c.id = i.customer_id
     ORDER BY i.occurred_at DESC
     LIMIT ?`,
    [limit]
  );
}

export interface InteractionInput {
  customer_id: number;
  type: InteractionType;
  channel?: string | null;
  amount: number;
  points: number;
  description?: string | null;
}

/**
 * Records an interaction and rolls its points (and, for purchases, spend) up
 * into the customer's loyalty totals — atomically.
 */
export async function createInteraction(input: InteractionInput): Promise<void> {
  const statements: { sql: string; args: Record<string, string | number | null> }[] = [
    {
      sql: `INSERT INTO interactions (customer_id, type, channel, amount, points, description)
            VALUES (@customer_id, @type, @channel, @amount, @points, @description)`,
      args: {
        customer_id: input.customer_id,
        type: input.type,
        channel: input.channel ?? null,
        amount: input.amount,
        points: input.points,
        description: input.description ?? null,
      },
    },
    {
      sql: `UPDATE customers SET points = points + @points, updated_at = datetime('now')
            WHERE id = @id`,
      args: { points: input.points, id: input.customer_id },
    },
  ];

  if (input.type === "purchase") {
    statements.push({
      sql: `UPDATE customers SET clv = clv + @amount, last_purchase_at = datetime('now')
            WHERE id = @id`,
      args: { amount: input.amount, id: input.customer_id },
    });
  }

  await batch(statements);
}
