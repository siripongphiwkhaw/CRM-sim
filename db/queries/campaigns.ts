import { get, all, run, batch } from "../client";
import { getSegment, getSegmentMembers, parseSegmentRule } from "./segments";
import { hasMarketingConsent } from "./consent";
import { customersOwnedByOtherSide } from "./identityLinks";
import type { CampaignChannel, CampaignStatus, CampaignType } from "@/lib/constants";

/**
 * Campaigns target a saved segment and simulate a multi-channel send — there
 * is no live LINE Messaging API channel wired up yet (that's the "Real LINE
 * push" follow-up noted in the Version 2 plan). What's real here: the
 * audience snapshot, the MARKETING-consent gate on reach, the cross-channel
 * arbitration that stops two channels promoting the same person, and
 * conversion counted from actual post-launch transactions.
 */

// A customer counts as an "active loyalist" (already won) if they purchased
// within this window — an acquisition campaign shouldn't pay to re-acquire them.
export const ACTIVE_LOYALIST_DAYS = 60;

export interface Campaign {
  id: number;
  name: string;
  channel: CampaignChannel;
  segment_id: number | null;
  status: CampaignStatus;
  campaign_type: CampaignType;
  cooldown_days: number;
  audience_size: number;
  reach: number;
  converted: number;
  excluded: number;
  launched_at: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export function listCampaigns(): Promise<Campaign[]> {
  return all<Campaign>("SELECT * FROM campaigns ORDER BY created_at DESC");
}

export function getCampaign(id: number): Promise<Campaign | undefined> {
  return get<Campaign>("SELECT * FROM campaigns WHERE id = ?", [id]);
}

export function createCampaign(
  name: string,
  channel: CampaignChannel,
  segmentId: number,
  campaignType: CampaignType,
  cooldownDays: number,
  createdBy: number | null
): Promise<number> {
  return run(
    `INSERT INTO campaigns (name, channel, segment_id, campaign_type, cooldown_days, created_by)
     VALUES (@name, @channel, @sid, @type, @cooldown, @by) RETURNING id`,
    { name, channel, sid: segmentId, type: campaignType, cooldown: cooldownDays, by: createdBy }
  );
}

/**
 * Customers currently "spoken for" by another running campaign whose cooldown
 * window hasn't elapsed — the cross-channel promo frequency cap. Excluding
 * these at launch is what stops two channels spending to reach the same person
 * in the same window (the cannibalization the CRM is meant to prevent).
 */
async function spokenForCustomers(exceptCampaignId: number): Promise<Set<number>> {
  const rows = await all<{ customer_id: number }>(
    `SELECT DISTINCT ca.customer_id
       FROM campaign_audience ca
       JOIN campaigns c ON c.id = ca.campaign_id
      WHERE c.id <> @self
        AND c.status = 'RUNNING'
        AND c.launched_at IS NOT NULL
        AND c.launched_at::timestamptz > now() - make_interval(days => c.cooldown_days)`,
    { self: exceptCampaignId }
  );
  return new Set(rows.map((r) => r.customer_id));
}

/** Customers who purchased recently — already-won, so an acquisition campaign
 * skips them. */
async function activeLoyalists(): Promise<Set<number>> {
  const rows = await all<{ customer_id: number }>(
    `SELECT DISTINCT customer_id FROM transactions
      WHERE tx_date::timestamptz > now() - make_interval(days => @days)`,
    { days: ACTIVE_LOYALIST_DAYS }
  );
  return new Set(rows.map((r) => r.customer_id));
}

export function setCampaignStatus(id: number, status: CampaignStatus): Promise<number> {
  return run("UPDATE campaigns SET status = @status, updated_at = now() WHERE id = @id", { id, status });
}

export type LaunchResult =
  | { ok: true; audienceSize: number; reach: number; excluded: number }
  | { ok: false; error: "NO_SEGMENT" | "ALREADY_LAUNCHED" };

/**
 * Snapshots who the campaign actually reaches into campaign_audience, applying
 * these gates in order:
 *   1. MARKETING consent (same gate /api/v1/notifications/line enforces).
 *   2. Cross-channel exclusivity — skip anyone another running campaign already
 *      "owns" inside its cooldown window, so channels can't double-target.
 *   3. Acquisition guard — an acquisition campaign additionally skips
 *      already-won active loyalists.
 *   4. Confirmed identity ownership — skip anyone a confirmed B2C/B2B identity
 *      link assigns to the OTHER side, so a shared-identity buyer is promoted
 *      to from one side only. All campaign channels are B2C-side today.
 * Segment membership can drift afterwards; the snapshot is what reach and
 * conversion are always measured against.
 */
export async function launchCampaign(id: number): Promise<LaunchResult> {
  const campaign = await getCampaign(id);
  if (!campaign || !campaign.segment_id) return { ok: false, error: "NO_SEGMENT" };
  if (campaign.launched_at) return { ok: false, error: "ALREADY_LAUNCHED" };

  const segment = await getSegment(campaign.segment_id);
  if (!segment) return { ok: false, error: "NO_SEGMENT" };

  const members = await getSegmentMembers(parseSegmentRule(segment));

  const [spokenFor, loyalists, otherSideOwned] = await Promise.all([
    spokenForCustomers(id),
    campaign.campaign_type === "acquisition" ? activeLoyalists() : Promise.resolve(new Set<number>()),
    customersOwnedByOtherSide("B2C"),
  ]);

  const targeted: number[] = [];
  let excluded = 0;
  for (const m of members) {
    if (!(await hasMarketingConsent(m.id))) continue; // consent gate (not counted as arbitration exclusion)
    if (spokenFor.has(m.id) || loyalists.has(m.id) || otherSideOwned.has(m.id)) {
      excluded += 1;
      continue;
    }
    targeted.push(m.id);
  }

  if (targeted.length > 0) {
    await batch(
      targeted.map((customerId) => ({
        sql: `INSERT INTO campaign_audience (campaign_id, customer_id, delivered)
              VALUES (@campaign, @cid, 1)
              ON CONFLICT (campaign_id, customer_id) DO NOTHING`,
        args: { campaign: id, cid: customerId },
      }))
    );
  }

  await run(
    `UPDATE campaigns
        SET status = 'RUNNING', audience_size = @size, reach = @reach, excluded = @excluded,
            launched_at = now(), updated_at = now()
      WHERE id = @id`,
    { id, size: members.length, reach: targeted.length, excluded }
  );
  return { ok: true, audienceSize: members.length, reach: targeted.length, excluded };
}

export interface AudienceRow {
  customer_id: number;
  member_code: string;
  member_name: string;
  delivered: number;
}

export function listCampaignAudience(campaignId: number): Promise<AudienceRow[]> {
  return all<AudienceRow>(
    `SELECT ca.customer_id, c.member_code, (c.first_name || ' ' || c.last_name) AS member_name, ca.delivered
       FROM campaign_audience ca JOIN customers c ON c.id = ca.customer_id
      WHERE ca.campaign_id = ?
      ORDER BY member_name`,
    [campaignId]
  );
}

/** Recomputes `converted` as members from the snapshot with any purchase
 * after launch. On-demand, like the other Version 2 jobs. */
export async function recomputeConversions(id: number): Promise<number> {
  const campaign = await getCampaign(id);
  if (!campaign?.launched_at) return 0;
  const row = await get<{ n: number }>(
    `SELECT COUNT(DISTINCT ca.customer_id)::int AS n
       FROM campaign_audience ca
       JOIN transactions t ON t.customer_id = ca.customer_id
      WHERE ca.campaign_id = @id AND t.tx_date::timestamptz > @launched::timestamptz`,
    { id, launched: campaign.launched_at }
  );
  const converted = row?.n ?? 0;
  await run("UPDATE campaigns SET converted = @c, updated_at = now() WHERE id = @id", { id, c: converted });
  return converted;
}
