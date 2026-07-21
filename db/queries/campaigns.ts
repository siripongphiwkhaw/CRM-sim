import { get, all, run, batch } from "../client";
import { getSegment, getSegmentMembers, parseSegmentRule } from "./segments";
import { hasMarketingConsent } from "./consent";
import type { CampaignChannel, CampaignStatus } from "@/lib/constants";

/**
 * Campaigns target a saved segment and simulate a multi-channel send — there
 * is no live LINE Messaging API channel wired up yet (that's the "Real LINE
 * push" follow-up noted in the Version 2 plan). What's real here: the
 * audience snapshot, the MARKETING-consent gate on reach, and conversion
 * counted from actual post-launch transactions.
 */

export interface Campaign {
  id: number;
  name: string;
  channel: CampaignChannel;
  segment_id: number | null;
  status: CampaignStatus;
  audience_size: number;
  reach: number;
  converted: number;
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
  createdBy: number | null
): Promise<number> {
  return run(
    `INSERT INTO campaigns (name, channel, segment_id, created_by)
     VALUES (@name, @channel, @sid, @by) RETURNING id`,
    { name, channel, sid: segmentId, by: createdBy }
  );
}

export function setCampaignStatus(id: number, status: CampaignStatus): Promise<number> {
  return run("UPDATE campaigns SET status = @status, updated_at = now() WHERE id = @id", { id, status });
}

export type LaunchResult =
  | { ok: true; audienceSize: number; reach: number }
  | { ok: false; error: "NO_SEGMENT" | "ALREADY_LAUNCHED" };

/**
 * Snapshots the segment's current membership into campaign_audience, keeping
 * only members with current GRANTED marketing consent — the same gate
 * /api/v1/notifications/line enforces for a real push. Segment membership can
 * drift after this point; the snapshot is what reach/conversion measure
 * against, not a live re-evaluation of the segment.
 */
export async function launchCampaign(id: number): Promise<LaunchResult> {
  const campaign = await getCampaign(id);
  if (!campaign || !campaign.segment_id) return { ok: false, error: "NO_SEGMENT" };
  if (campaign.launched_at) return { ok: false, error: "ALREADY_LAUNCHED" };

  const segment = await getSegment(campaign.segment_id);
  if (!segment) return { ok: false, error: "NO_SEGMENT" };

  const members = await getSegmentMembers(parseSegmentRule(segment));
  const consented: number[] = [];
  for (const m of members) {
    if (await hasMarketingConsent(m.id)) consented.push(m.id);
  }

  if (consented.length > 0) {
    await batch(
      consented.map((customerId) => ({
        sql: `INSERT INTO campaign_audience (campaign_id, customer_id, delivered)
              VALUES (@campaign, @cid, 1)
              ON CONFLICT (campaign_id, customer_id) DO NOTHING`,
        args: { campaign: id, cid: customerId },
      }))
    );
  }

  await run(
    `UPDATE campaigns
        SET status = 'RUNNING', audience_size = @size, reach = @reach,
            launched_at = now(), updated_at = now()
      WHERE id = @id`,
    { id, size: members.length, reach: consented.length }
  );
  return { ok: true, audienceSize: members.length, reach: consented.length };
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
