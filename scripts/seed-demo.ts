/**
 * Optional demo data for the Only-One LIFF app and the CRM.
 *
 * Deliberately NOT wired into db/seed.ts or ensureDatabase(): the app is meant
 * to start empty, and this only runs when you ask for it.
 *
 *   npx tsx --env-file=.env.local scripts/seed-demo.ts
 *
 * Idempotent — re-running is a no-op once demo rewards exist. Everything goes
 * through createTransaction/createReward rather than raw INSERTs so the seed
 * exercises the same earn maths the app does and the ledger stays consistent.
 */

import { all, run } from "../db/client";
import { createCustomer, updateCustomer, getCustomer } from "../db/queries/customers";
import { createTransaction } from "../db/queries/transactions";
import { createReward, listRewards, getLoyaltySummary } from "../db/queries/loyalty";
import { createMission, submitMission, reviewSubmission } from "../db/queries/missions";
import { recomputeScores } from "../db/queries/scores";
import { createSegment } from "../db/queries/segments";
import { createCampaign, launchCampaign, recomputeConversions } from "../db/queries/campaigns";
import { runIdentityLinkScan } from "../db/queries/identityLinks";
import { recordConsent } from "../db/queries/consent";
import { BRANDS, type TxChannel } from "../lib/constants";

/** "YYYY-MM-DD" for today's month/day but a fixed birth year, so the
 * birthday-rewards demo always has at least one match whenever this runs. */
function todayAsBirthdate(year: number): string {
  const now = new Date();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

const B2C_CHANNELS: TxChannel[] = ["POS", "ECOM", "D2C"];

const MEMBERS: { first: string; last: string; brand: string; purchases: [number, number][] }[] = [
  // [amountTHB, brandIndex] — spread across brands so the breakdown has shape.
  { first: "Malee", last: "Srisawat", brand: "Umeya", purchases: [[420, 0], [780, 1], [350, 0], [1200, 2], [640, 1], [980, 3], [520, 0], [1450, 2]] },
  { first: "Somchai", last: "Ruangsri", brand: "Sunmato", purchases: [[2400, 1], [1800, 4], [3200, 1], [950, 0], [2750, 5], [1600, 4]] },
  { first: "Ratana", last: "Boonmee", brand: "VitaCharge", purchases: [[6200, 2], [4800, 2], [5500, 3], [7100, 5], [3900, 2], [8200, 0], [4400, 3]] },
  { first: "Prasert", last: "Thongdee", brand: "GoldLeaf", purchases: [[310, 3], [480, 0]] },
  { first: "Nattaporn", last: "Wattana", brand: "FreshPantry", purchases: [[1100, 4], [890, 1], [1350, 4], [760, 2]] },
  { first: "Kanya", last: "Phumin", brand: "NutriWell", purchases: [[540, 5], [620, 5], [430, 1], [880, 0], [700, 5]] },
  { first: "Wichai", last: "Sombat", brand: "Umeya", purchases: [[15000, 0], [12500, 2], [9800, 1], [11200, 4], [13400, 0], [10600, 3]] },
  { first: "Suda", last: "Chaiyaporn", brand: "Sunmato", purchases: [[260, 1]] },
];

const REWARDS: {
  name: string;
  type: string;
  desc: string;
  cost: number;
  status?: string;
  perMemberLimit?: number;
}[] = [
  { name: "฿50 cash voucher", type: "VOUCHER", desc: "Redeemable at any Only-One brand.", cost: 80 },
  { name: "Free drink upsize", type: "PRODUCT", desc: "Any size, any participating store.", cost: 150, perMemberLimit: 2 },
  { name: "10% off next purchase", type: "DISCOUNT", desc: "One-time code, valid 30 days.", cost: 300 },
  { name: "฿250 cash voucher", type: "VOUCHER", desc: "Redeemable at any Only-One brand.", cost: 500 },
  { name: "Premium gift set", type: "PRODUCT", desc: "Curated best-sellers across brands.", cost: 1200 },
  { name: "Cooking class seat", type: "EXPERIENCE", desc: "One seat at a partner cooking class.", cost: 2500 },
  // Lifecycle demo: not everything in the catalog is redeemable right now.
  { name: "VIP tasting event (coming soon)", type: "EXPERIENCE", desc: "Draft — not yet published.", cost: 1800, status: "DRAFT" },
  { name: "Retired anniversary mug", type: "PRODUCT", desc: "Suspended — past promotion.", cost: 200, status: "SUSPENDED" },
];

const MISSIONS: {
  name: string;
  type: string;
  desc: string;
  points: number;
  status: string;
  requiresProof: boolean;
}[] = [
  { name: "Complete your profile", type: "GENERAL", desc: "Add a birthday and confirm your details.", points: 30, status: "PUBLISHED", requiresProof: false },
  { name: "Share a photo at checkout", type: "SOCIAL", desc: "Show us where you shop — staff review before points post.", points: 60, status: "PUBLISHED", requiresProof: true },
  { name: "Take the satisfaction survey", type: "SURVEY", desc: "Two minutes, helps us improve.", points: 40, status: "DRAFT", requiresProof: false },
];

async function main() {
  const existing = await listRewards();
  if (existing.length > 0) {
    console.log(`Demo data already present (${existing.length} rewards). Nothing to do.`);
    return;
  }

  console.log("Creating rewards…");
  for (const r of REWARDS) {
    await createReward({
      name: r.name,
      description: r.desc,
      reward_type: r.type as never,
      points_cost: r.cost,
      status: (r.status as never) ?? "PUBLISHED",
      per_member_limit: r.perMemberLimit ?? null,
    });
  }
  console.log(`  ${REWARDS.length} rewards`);

  console.log("Creating missions…");
  const missionIds: number[] = [];
  for (const m of MISSIONS) {
    const id = await createMission(
      {
        name: m.name,
        description: m.desc,
        mission_type: m.type as never,
        reward_points: m.points,
        status: m.status as never,
        requires_proof: m.requiresProof,
      },
      null
    );
    missionIds.push(id);
  }
  console.log(`  ${MISSIONS.length} missions`);

  console.log("Creating members and purchases…");
  const memberIds: number[] = [];
  for (const m of MEMBERS) {
    const id = await createCustomer(
      {
        first_name: m.first,
        last_name: m.last,
        email: `${m.first.toLowerCase()}.${m.last.toLowerCase()}@example.com`,
        phone: null,
        brand: m.brand as never,
        cust_type: "B2C",
        register_channel: "Store",
        data_level: "Purchase & Engagement",
      },
      "all"
    );

    let i = 0;
    for (const [amount, brandIndex] of m.purchases) {
      const daysAgo = (m.purchases.length - i) * 21 + 3;
      await createTransaction({
        customer_id: id,
        channel: B2C_CHANNELS[i % B2C_CHANNELS.length],
        amount_thb: amount,
        brand: BRANDS[brandIndex % BRANDS.length],
        source_ref: "seed-demo",
        created_by: null,
        tx_date: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
      });
      i++;
    }

    // One member declines marketing, so the consent toggle has both states.
    if (m.first === "Prasert") {
      await recordConsent({
        customer_id: id,
        purpose: "MARKETING",
        status: "WITHDRAWN",
        source: "seed-demo",
      });
    }

    // Two birthdays land "today" so the birthday-rewards button always has
    // something to award whenever this seed runs; the rest are off-date.
    if (m.first === "Malee" || m.first === "Wichai") {
      const customer = await getCustomer(id);
      if (customer) {
        await updateCustomer(id, { ...customer, birth_date: todayAsBirthdate(1992) });
      }
    }

    memberIds.push(id);
    const summary = await getLoyaltySummary(id);
    console.log(
      `  ${m.first} ${m.last}: ${m.purchases.length} purchases · ` +
        `${summary.balance} pts · ${summary.tier}`
    );
  }

  // Shared-identity demo: a B2B "restaurant" account that reuses Ratana's
  // email — the same chef buying big through the trade (SFA) channel. Its
  // spend outweighs her consumer side, so the identity scan should judge it
  // B2B-dominant and route the review to Sales and Ingredient.
  console.log("Creating a shared-identity B2B account…");
  const chefB2bId = await createCustomer(
    {
      first_name: "Ratana",
      last_name: "Kitchen (B2B)",
      email: "ratana.boonmee@example.com", // same as the B2C "Ratana Boonmee"
      phone: null,
      brand: "VitaCharge",
      cust_type: "B2B",
      register_channel: "SFA",
      data_level: "Purchase & Engagement",
    },
    "all"
  );
  for (const [amount, i] of [[22000, 0], [25000, 1], [19000, 2]] as [number, number][]) {
    await createTransaction({
      customer_id: chefB2bId,
      channel: "SFA",
      amount_thb: amount,
      brand: "VitaCharge",
      source_ref: "seed-demo",
      created_by: null,
      tx_date: new Date(Date.now() - (i + 1) * 18 * 86_400_000).toISOString(),
    });
  }
  memberIds.push(chefB2bId);

  console.log("Submitting a mission…");
  // Auto-awarded mission (no proof) for the top member.
  await submitMission(memberIds[6], missionIds[0], null, "liff");
  // Proof-required mission, submitted then approved by staff — leaves a real
  // submission history row so /loyalty/missions/[id] has something to show.
  const pendingResult = await submitMission(memberIds[0], missionIds[1], "Photo attached", "liff");
  if (pendingResult.ok && pendingResult.status === "PENDING") {
    const subs = await all<{ id: number }>(
      "SELECT id FROM mission_submissions WHERE mission_id = ? AND customer_id = ?",
      [missionIds[1], memberIds[0]]
    );
    if (subs[0]) await reviewSubmission(subs[0].id, true, null);
  }

  console.log("Computing RFM + churn scores…");
  await recomputeScores();

  console.log("Creating segments and campaigns…");
  const goldSegmentId = await createSegment("Gold members", "custom", { tier: "Gold" }, null);
  await createSegment("Marketing opted-in", "custom", { marketing_consent: true }, null);
  await createSegment("High churn risk", "custom", { churn_level: "High" }, null);
  // Channel-classification demo segments.
  await createSegment("HoReCa buyers", "custom", { behavior_class: "HORECA" }, null);
  const contestedSegmentId = await createSegment("Contested customers", "custom", { channel_affinity: "CONTESTED" }, null);

  const campaignId = await createCampaign("Gold appreciation", "LINE", goldSegmentId, "retention", 30, null);
  const launch = await launchCampaign(campaignId);
  if (launch.ok) await recomputeConversions(campaignId);
  // Second campaign over an overlapping audience shows cross-channel exclusion:
  // members already targeted above (still in cooldown) are skipped here.
  const contestedCampaignId = await createCampaign(
    "E-com re-engage",
    "Email",
    contestedSegmentId,
    "acquisition",
    30,
    null
  );
  const launch2 = await launchCampaign(contestedCampaignId);

  console.log("Scanning for shared-identity B2C/B2B pairs…");
  const identityScan = await runIdentityLinkScan(null);
  console.log(`  ${identityScan.found} identity link(s) detected and routed.`);

  const [{ n: txCount }] = await all<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM transactions WHERE source_ref = 'seed-demo'"
  );
  console.log(
    `\nDone — ${MEMBERS.length} members, ${txCount} transactions, ${REWARDS.length} rewards, ` +
      `${MISSIONS.length} missions, 5 segments, 2 campaigns ` +
      `(1st reach ${launch.ok ? launch.reach : "—"}, 2nd reach ${launch2.ok ? launch2.reach : "—"} / ` +
      `${launch2.ok ? launch2.excluded : "—"} excluded by cross-channel arbitration).`
  );
  console.log("To remove it all again:");
  console.log("  npx tsx --env-file=.env.local scripts/seed-demo.ts --clear");
}

async function clear() {
  console.log("Removing demo data…");
  await run(
    `DELETE FROM loyalty_ledger WHERE customer_id IN
       (SELECT id FROM customers WHERE email LIKE '%@example.com')`
  );
  await run(
    `DELETE FROM transactions WHERE customer_id IN
       (SELECT id FROM customers WHERE email LIKE '%@example.com')`
  );
  await run(
    `DELETE FROM consents WHERE customer_id IN
       (SELECT id FROM customers WHERE email LIKE '%@example.com')`
  );
  // Identity links cascade with their customers, but the routed review cases
  // have customer_id ON DELETE SET NULL, so clear them explicitly first.
  await run(
    `DELETE FROM customer_identity_links WHERE customer_a_id IN
       (SELECT id FROM customers WHERE email LIKE '%@example.com')
       OR customer_b_id IN (SELECT id FROM customers WHERE email LIKE '%@example.com')`
  );
  await run("DELETE FROM cases WHERE category = 'IDENTITY_REVIEW'");
  await run("DELETE FROM customers WHERE email LIKE '%@example.com'");
  await run("DELETE FROM rewards");
  // Campaigns before segments — segment_id is ON DELETE SET NULL, not
  // CASCADE, so a stale campaign would otherwise survive with a null segment.
  await run("DELETE FROM campaigns");
  await run("DELETE FROM segments");
  await run("DELETE FROM missions"); // cascades mission_submissions
  await run("DELETE FROM audit_log");
  console.log("Demo data removed.");
}

const task = process.argv.includes("--clear") ? clear() : main();
task.catch((e) => {
  console.error("FAILED:", e);
  process.exitCode = 1;
});
