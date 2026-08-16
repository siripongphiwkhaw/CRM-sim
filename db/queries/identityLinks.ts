import { get, all, run } from "../client";
import { behaviorClassFor, channelAffinityFor } from "@/lib/classification";
import { createCase } from "./cases";
import { getDepartmentByName } from "./departments";
import { DEPARTMENTS_BY_CUST_TYPE, type CustType, type TxChannel, type BehaviorClass } from "@/lib/constants";

/**
 * Cross-registration identity resolution: a B2C customer row and a B2B customer
 * row that share an email or phone are very likely the same real person /
 * business (e.g. a chef who orders as a consumer AND is the contact on their
 * restaurant's trade account). Left unlinked, both sides promote to them and
 * waste spend competing for the same buyer. This detects the pair, judges
 * which side actually spends/buys more from the merged history, routes the
 * decision to the owning department's PICs, and — once a human confirms —
 * lets launchCampaign() enforce promotion from one side only.
 *
 * Seeded department names (db/seed.ts): "Business Unit" + "Digital Marketing"
 * own B2C; "Sales and Ingredient" owns B2B.
 */

export type LinkStatus = "PENDING" | "CONFIRMED" | "REJECTED";
export type DominantSide = "B2C" | "B2B";

export interface IdentityLink {
  id: number;
  customer_a_id: number;
  customer_b_id: number;
  matched_by: "email" | "phone";
  dominant_side: DominantSide | null;
  verdict_note: string | null;
  status: LinkStatus;
  case_id: number | null;
  confirmed_by: number | null;
  created_at: string;
  confirmed_at: string | null;
}

export interface IdentityLinkWithNames extends IdentityLink {
  a_name: string;
  a_code: string;
  a_type: CustType;
  b_name: string;
  b_code: string;
  b_type: CustType;
}

const LINK_SELECT = `
  SELECT l.*,
    (ca.first_name || ' ' || ca.last_name) AS a_name, ca.member_code AS a_code, ca.cust_type AS a_type,
    (cb.first_name || ' ' || cb.last_name) AS b_name, cb.member_code AS b_code, cb.cust_type AS b_type
  FROM customer_identity_links l
  JOIN customers ca ON ca.id = l.customer_a_id
  JOIN customers cb ON cb.id = l.customer_b_id`;

export function listIdentityLinks(opts?: { status?: LinkStatus }): Promise<IdentityLinkWithNames[]> {
  const where = opts?.status ? "WHERE l.status = ?" : "";
  const params = opts?.status ? [opts.status] : [];
  return all<IdentityLinkWithNames>(`${LINK_SELECT} ${where} ORDER BY l.created_at DESC, l.id DESC`, params);
}

export function getIdentityLink(id: number): Promise<IdentityLinkWithNames | undefined> {
  return get<IdentityLinkWithNames>(`${LINK_SELECT} WHERE l.id = ?`, [id]);
}

/** Any links touching a given customer (either side) — for Customer 360. */
export function getLinksForCustomer(customerId: number): Promise<IdentityLinkWithNames[]> {
  return all<IdentityLinkWithNames>(
    `${LINK_SELECT} WHERE l.customer_a_id = ? OR l.customer_b_id = ?`,
    [customerId, customerId]
  );
}

/** The still-pending link a review case is about — the routed department's PICs
 * decide it from the case detail. A review case's customer_id is always one
 * side of the pair, so this resolves the link without a case_id back-ref. */
export function getPendingLinkForCustomer(customerId: number): Promise<IdentityLinkWithNames | undefined> {
  return get<IdentityLinkWithNames>(
    `${LINK_SELECT} WHERE l.status = 'PENDING' AND (l.customer_a_id = ? OR l.customer_b_id = ?)
      ORDER BY l.id DESC LIMIT 1`,
    [customerId, customerId]
  );
}

/**
 * Customers who, per a CONFIRMED link, are owned by a side OTHER than `side` —
 * so a campaign for `side` must skip them. Both rows of the pair are returned,
 * since they're the same person. launchCampaign(side='B2C') uses this to keep
 * B2B-owned people out of consumer promos.
 */
export async function customersOwnedByOtherSide(side: DominantSide): Promise<Set<number>> {
  const rows = await all<{ customer_id: number }>(
    `SELECT customer_a_id AS customer_id FROM customer_identity_links
      WHERE status = 'CONFIRMED' AND dominant_side IS NOT NULL AND dominant_side <> @side
     UNION
     SELECT customer_b_id AS customer_id FROM customer_identity_links
      WHERE status = 'CONFIRMED' AND dominant_side IS NOT NULL AND dominant_side <> @side`,
    { side }
  );
  return new Set(rows.map((r) => r.customer_id));
}

interface MatchRow {
  customer_a_id: number;
  customer_b_id: number;
  matched_by: "email" | "phone";
}

/**
 * New B2C/B2B pairs sharing an email or phone, not already linked. `a.id < b.id`
 * keeps the pair canonical (smaller id first) so the UNIQUE(a,b) index can't be
 * bypassed by ordering. Email match wins the label when both match.
 */
function findIdentityMatches(): Promise<MatchRow[]> {
  return all<MatchRow>(
    `SELECT a.id AS customer_a_id, b.id AS customer_b_id,
            CASE WHEN a.email IS NOT NULL AND a.email = b.email THEN 'email' ELSE 'phone' END AS matched_by
       FROM customers a
       JOIN customers b
         ON a.id < b.id
        AND a.cust_type <> b.cust_type
        AND (
              (a.email IS NOT NULL AND a.email <> '' AND a.email = b.email)
           OR (a.phone IS NOT NULL AND a.phone <> '' AND a.phone = b.phone)
            )
      WHERE NOT EXISTS (
        SELECT 1 FROM customer_identity_links l
         WHERE l.customer_a_id = a.id AND l.customer_b_id = b.id
      )`
  );
}

interface SideStat {
  cust_type: CustType;
  spend: number;
  qty: number;
}

interface Verdict {
  dominantSide: DominantSide;
  note: string;
}

/**
 * Judges the pair from the merged transaction history: which registered side
 * (B2C vs B2B) spends more (tie-broken on order count), plus whether the B2C
 * side's own behaviour actually reads as a business buyer (HORECA/TRADE) —
 * "B2C behaviour normal or not". Pure numbers, recorded in the note.
 */
async function judgeIdentityLink(aId: number, bId: number): Promise<Verdict> {
  const sides = await all<SideStat>(
    `SELECT c.cust_type,
            COALESCE(SUM(t.amount_thb), 0)::float8 AS spend,
            COUNT(t.id)::int AS qty
       FROM customers c
       LEFT JOIN transactions t ON t.customer_id = c.id
      WHERE c.id = @a OR c.id = @b
      GROUP BY c.cust_type`,
    { a: aId, b: bId }
  );
  const b2c = sides.find((s) => s.cust_type === "B2C") ?? { cust_type: "B2C" as CustType, spend: 0, qty: 0 };
  const b2b = sides.find((s) => s.cust_type === "B2B") ?? { cust_type: "B2B" as CustType, spend: 0, qty: 0 };

  const dominantSide: DominantSide =
    b2b.spend > b2c.spend ? "B2B" : b2c.spend > b2b.spend ? "B2C" : b2b.qty > b2c.qty ? "B2B" : "B2C";

  // Is the consumer-registered side really behaving like a business? Run the
  // shared classifier over the B2C row's own numbers (its transactions are all
  // consumer channels, so sfaShare = 0).
  const b2cBehavior: BehaviorClass = behaviorClassFor({
    custType: "B2C",
    frequency: b2c.qty,
    monetary: b2c.spend,
    sfaShare: 0,
  });

  // Merged channel mix, for the primary-channel line in the note.
  const channelRows = await all<{ channel: TxChannel; n: number }>(
    `SELECT channel, COUNT(*)::int AS n FROM transactions
      WHERE customer_id = @a OR customer_id = @b GROUP BY channel`,
    { a: aId, b: bId }
  );
  const counts: Partial<Record<TxChannel, number>> = {};
  for (const r of channelRows) counts[r.channel] = r.n;
  const { primaryChannel } = channelAffinityFor(counts);

  const money = (n: number) => `฿${Math.round(n).toLocaleString("en-US")}`;
  const note =
    `B2C side: ${money(b2c.spend)} over ${b2c.qty} orders (behaves as ${b2cBehavior}). ` +
    `B2B side: ${money(b2b.spend)} over ${b2b.qty} orders. ` +
    `Primary channel ${primaryChannel ?? "—"}. Dominant: ${dominantSide}.`;

  return { dominantSide, note };
}


/**
 * On-demand scan (mirrors recomputeScores/generateInsights): find new
 * cross-type email/phone matches, judge each, persist a PENDING link, and
 * open a routed IDENTITY_REVIEW case for the owning department(s).
 */
export async function runIdentityLinkScan(actorId: number | null): Promise<{ found: number }> {
  const matches = await findIdentityMatches();
  let found = 0;

  for (const match of matches) {
    const verdict = await judgeIdentityLink(match.customer_a_id, match.customer_b_id);

    // The dominant-side customer row is the one this case is about.
    const link = await get<{ id: number }>(
      `INSERT INTO customer_identity_links
         (customer_a_id, customer_b_id, matched_by, dominant_side, verdict_note, status)
       VALUES (@a, @b, @by, @side, @note, 'PENDING')
       ON CONFLICT (customer_a_id, customer_b_id) DO NOTHING
       RETURNING id`,
      { a: match.customer_a_id, b: match.customer_b_id, by: match.matched_by, side: verdict.dominantSide, note: verdict.note }
    );
    // Lost a race (or already existed) — nothing to route.
    if (!link) continue;

    const detail = await get<{ a_code: string; b_code: string; a_type: CustType; b_type: CustType }>(
      `SELECT ca.member_code AS a_code, cb.member_code AS b_code, ca.cust_type AS a_type, cb.cust_type AS b_type
         FROM customers ca, customers cb WHERE ca.id = @a AND cb.id = @b`,
      { a: match.customer_a_id, b: match.customer_b_id }
    );
    const dominantCustomerId =
      detail?.a_type === verdict.dominantSide ? match.customer_a_id : match.customer_b_id;

    let firstCaseId: number | null = null;
    for (const deptName of DEPARTMENTS_BY_CUST_TYPE[verdict.dominantSide]) {
      const dept = await getDepartmentByName(deptName);
      const caseId = await createCase({
        customer_id: dominantCustomerId,
        subject: `Identity review: ${detail?.a_code ?? match.customer_a_id} ↔ ${detail?.b_code ?? match.customer_b_id} (${verdict.dominantSide}-dominant)`,
        description:
          `Same ${match.matched_by} on a B2C and a B2B account — likely one buyer. ${verdict.note} ` +
          `Confirm to promote from the ${verdict.dominantSide} side only, or reject as a false match.`,
        category: "IDENTITY_REVIEW",
        priority: "MEDIUM",
        created_by: actorId,
        department_id: dept?.id ?? null,
      });
      if (firstCaseId == null) firstCaseId = caseId;
    }

    if (firstCaseId != null) {
      await run("UPDATE customer_identity_links SET case_id = @c WHERE id = @id", {
        c: firstCaseId,
        id: link.id,
      });
    }
    found += 1;
  }

  return { found };
}

export type ConfirmResult =
  | { ok: true }
  | { ok: false; error: "NOT_FOUND" | "ALREADY_DECIDED" };

/** Sets a link CONFIRMED/REJECTED and resolves its routed case on confirm.
 * Authorisation (PIC of the routed department, or admin) is enforced in the
 * server action, not here. */
export async function confirmIdentityLink(
  id: number,
  decision: "CONFIRMED" | "REJECTED",
  actorId: number | null
): Promise<ConfirmResult> {
  const link = await get<IdentityLink>("SELECT * FROM customer_identity_links WHERE id = ?", [id]);
  if (!link) return { ok: false, error: "NOT_FOUND" };
  if (link.status !== "PENDING") return { ok: false, error: "ALREADY_DECIDED" };

  await run(
    `UPDATE customer_identity_links
        SET status = @status, confirmed_by = @actor, confirmed_at = now()
      WHERE id = @id`,
    { id, status: decision, actor: actorId }
  );

  // Close the routed review case(s) — both the Business Unit and Digital
  // Marketing cases for a B2C link resolve on one decision. Scoped to this
  // pair's open IDENTITY_REVIEW cases.
  await run(
    `UPDATE cases
        SET status = 'RESOLVED', resolved_at = COALESCE(resolved_at, now()::text),
            resolution = @res, updated_at = now()
      WHERE category = 'IDENTITY_REVIEW'
        AND status IN ('OPEN','IN_PROGRESS')
        AND customer_id IN (@a, @b)`,
    {
      a: link.customer_a_id,
      b: link.customer_b_id,
      res: decision === "CONFIRMED" ? "Identity confirmed — promotion restricted to the dominant side." : "Rejected as a false identity match.",
    }
  );
  return { ok: true };
}
