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
import { createCustomer } from "../db/queries/customers";
import { createTransaction } from "../db/queries/transactions";
import { createReward, listRewards, getLoyaltySummary } from "../db/queries/loyalty";
import { recordConsent } from "../db/queries/consent";
import { BRANDS, type TxChannel } from "../lib/constants";

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

const REWARDS: { name: string; type: string; desc: string; cost: number }[] = [
  { name: "฿50 cash voucher", type: "VOUCHER", desc: "Redeemable at any Only-One brand.", cost: 80 },
  { name: "Free drink upsize", type: "PRODUCT", desc: "Any size, any participating store.", cost: 150 },
  { name: "10% off next purchase", type: "DISCOUNT", desc: "One-time code, valid 30 days.", cost: 300 },
  { name: "฿250 cash voucher", type: "VOUCHER", desc: "Redeemable at any Only-One brand.", cost: 500 },
  { name: "Premium gift set", type: "PRODUCT", desc: "Curated best-sellers across brands.", cost: 1200 },
  { name: "Cooking class seat", type: "EXPERIENCE", desc: "One seat at a partner cooking class.", cost: 2500 },
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
    });
  }
  console.log(`  ${REWARDS.length} rewards`);

  console.log("Creating members and purchases…");
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

    const summary = await getLoyaltySummary(id);
    console.log(
      `  ${m.first} ${m.last}: ${m.purchases.length} purchases · ` +
        `${summary.balance} pts · ${summary.tier}`
    );
  }

  const [{ n: txCount }] = await all<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM transactions WHERE source_ref = 'seed-demo'"
  );
  console.log(`\nDone — ${MEMBERS.length} members, ${txCount} transactions, ${REWARDS.length} rewards.`);
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
  await run("DELETE FROM customers WHERE email LIKE '%@example.com'");
  await run("DELETE FROM rewards");
  console.log("Demo data removed.");
}

const task = process.argv.includes("--clear") ? clear() : main();
task.catch((e) => {
  console.error("FAILED:", e);
  process.exitCode = 1;
});
