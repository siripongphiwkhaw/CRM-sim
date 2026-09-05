/**
 * Faker-driven volume seed — hundreds of members with real purchase history,
 * so the dashboard, search and filters have something with shape behind them.
 *
 * Distinct from scripts/seed-demo.ts, which plants a handful of hand-authored
 * fixtures to demonstrate specific features (a birthday match, a mission
 * submission, an identity-link conflict). This one is about *volume and
 * distribution*: nothing here is individually interesting, but in aggregate it
 * produces the tier spread, brand mix, channel mix and 18-month time series
 * that make an empty dashboard readable.
 *
 *   npx tsx --env-file=.env.local scripts/seed-volume.ts
 *   npx tsx --env-file=.env.local scripts/seed-volume.ts --customers 800
 *   npx tsx --env-file=.env.local scripts/seed-volume.ts --clear
 *
 * Deliberately NOT wired into db/seed.ts or ensureDatabase(): the app starts
 * empty and this only runs when asked, same contract as seed-demo.
 *
 * Reproducible — faker is seeded from --seed (default 20260905), so the same
 * flags always produce the same database. Change the seed for a different
 * population, not for "more random".
 *
 * Everything goes through createCustomer/createTransaction rather than raw
 * INSERTs, so the loyalty ledger, tier ladder and points cache stay internally
 * consistent and the seed exercises the same earn maths the app does.
 */

import { faker } from "@faker-js/faker";
import { all, get, run } from "../db/client";
import { createCustomer } from "../db/queries/customers";
import { createTransaction } from "../db/queries/transactions";
import { recomputeScores } from "../db/queries/scores";
import { BRANDS, type Brand, type CustType, type TxChannel, type DataLevel } from "../lib/constants";

/**
 * Every row this script creates carries an @volume.test email, which is the
 * only handle --clear uses. seed-demo owns @example.com, so the two seeds can
 * coexist and be cleared independently.
 */
const VOLUME_DOMAIN = "volume.test";

/** Months of purchase history to spread transactions across. Long enough that
 * the dashboard's trend lines have a real slope rather than one spike. */
const HISTORY_MONTHS = 18;

interface Options {
  customers: number;
  seed: number;
  clear: boolean;
}

function parseArgs(argv: string[]): Options {
  const opts: Options = { customers: 400, seed: 20260905, clear: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--clear") opts.clear = true;
    else if (arg === "--customers") opts.customers = Number(argv[++i]);
    else if (arg === "--seed") opts.seed = Number(argv[++i]);
    else if (arg === "-h" || arg === "--help") {
      console.log(
        [
          "Faker-driven volume seed for the CRM.",
          "",
          "  --customers <n>  members to create (default 400)",
          "  --seed <n>       faker seed, for reproducibility (default 20260905)",
          "  --clear          remove everything this script created, then exit",
        ].join("\n")
      );
      process.exit(0);
    }
  }
  if (!Number.isFinite(opts.customers) || opts.customers < 1) {
    throw new Error("--customers must be a positive number");
  }
  if (!Number.isFinite(opts.seed)) throw new Error("--seed must be a number");
  return opts;
}

/** Weighted pick. Weights need not sum to 1; they are normalised here. */
function weighted<T>(entries: [T, number][]): T {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = faker.number.float({ min: 0, max: total });
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

/**
 * Brand mix is deliberately uneven — a flat distribution across six brands
 * makes every "top brand" chart a six-way tie, which tells you nothing about
 * whether the chart works.
 */
function pickBrand(): Brand {
  return weighted<Brand>([
    ["Umeya", 30],
    ["Sunmato", 22],
    ["VitaCharge", 18],
    ["GoldLeaf", 14],
    ["FreshPantry", 10],
    ["NutriWell", 6],
  ]);
}

/**
 * B2C buys through POS/ECOM/D2C, B2B through SFA. A small share crosses over
 * on purpose: createTransaction stamps CHANNEL_ELIGIBILITY_WARNING on those,
 * and the flag's UI is untestable if no row ever carries it.
 */
function pickChannel(custType: CustType): TxChannel {
  const crossover = faker.number.float({ min: 0, max: 1 }) < 0.04;
  if (custType === "B2C") {
    if (crossover) return "SFA";
    return weighted<TxChannel>([
      ["POS", 45],
      ["ECOM", 35],
      ["D2C", 20],
    ]);
  }
  if (crossover) return weighted<TxChannel>([["POS", 1], ["ECOM", 1]]);
  return "SFA";
}

/** Data level correlates with how engaged a member is, so it cannot be picked
 * independently of whether they went on to purchase. Resolved by the caller
 * once the purchase count is known. */
function dataLevelFor(purchaseCount: number): DataLevel {
  if (purchaseCount === 0) return faker.datatype.boolean(0.35) ? "Enrichment" : "Register";
  return "Purchase & Engagement";
}

/**
 * An ISO timestamp somewhere in the last HISTORY_MONTHS, biased toward recent
 * months. A flat spread makes every month identical and hides whether a trend
 * line is actually plotting anything.
 */
function purchaseDate(): string {
  const now = Date.now();
  const span = HISTORY_MONTHS * 30 * 24 * 60 * 60 * 1000;
  // Squaring a [0,1) roll pulls the mass toward 0 = today.
  const roll = faker.number.float({ min: 0, max: 1 });
  return new Date(now - roll * roll * span).toISOString();
}

async function main(opts: Options): Promise<void> {
  faker.seed(opts.seed);

  // --customers is a target, not a batch size, so an interrupted run can be
  // resumed by re-issuing the same command. A few thousand sequential round
  // trips is long enough that a run does get interrupted, and starting over
  // from zero each time is how a seed becomes something nobody runs.
  const existing = (
    await get<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM customers WHERE email LIKE @pattern`,
      { pattern: `%@${VOLUME_DOMAIN}` }
    )
  )?.n ?? 0;

  const remaining = opts.customers - existing;
  if (remaining <= 0) {
    console.log(
      `Already at ${existing} volume-seeded members (target ${opts.customers}). ` +
        `Nothing to do — use --clear to start over.`
    );
    return;
  }
  if (existing > 0) {
    console.log(`Resuming: ${existing} already present, adding ${remaining}.`);
  }

  console.log(`Seeding ${remaining} members (faker seed ${opts.seed})…`);

  const staff = await get<{ id: number }>(
    "SELECT id FROM users WHERE email = 'staff@crm.local'"
  );
  const actorId = staff?.id ?? null;

  let txTotal = 0;

  for (let n = 0; n < remaining; n++) {
    // Offset by what already exists so the email index stays unique across a
    // resumed run — faker replays the same names from a fixed seed, and the
    // index is what keeps them distinct.
    const i = existing + n;
    // ~18% of the book is B2B — dealers and trade accounts are the minority by
    // headcount but carry most of the revenue, which is what makes the
    // revenue-vs-member-count split on the dashboard worth looking at.
    const custType: CustType = faker.datatype.boolean(0.18) ? "B2B" : "B2C";
    const brand = pickBrand();

    // A third of members never purchase. Without them every funnel and
    // conversion metric reads 100% and the "registered but dormant" segment
    // the dashboard is supposed to surface is empty.
    const purchaseCount = weighted<number>([
      [0, 33],
      [faker.number.int({ min: 1, max: 3 }), 34],
      [faker.number.int({ min: 4, max: 11 }), 24],
      [faker.number.int({ min: 12, max: 40 }), 9],
    ]);

    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();

    const customerId = await createCustomer({
      first_name: firstName,
      last_name: lastName,
      // Indexed on i so the address is unique regardless of name collisions,
      // and so --clear can find every row this script wrote.
      email: `${firstName}.${lastName}.${i}`.toLowerCase().replace(/[^a-z0-9.]/g, "") +
        `@${VOLUME_DOMAIN}`,
      phone: `0${faker.string.numeric(9)}`,
      brand,
      cust_type: custType,
      register_channel: weighted([
        ["LINE", 40],
        ["Web", 25],
        ["POS", 20],
        ["Import", 15],
      ]),
      data_level: dataLevelFor(purchaseCount),
      birth_date: faker.date
        .birthdate({ min: 18, max: 72, mode: "age" })
        .toISOString()
        .slice(0, 10),
    });

    for (let p = 0; p < purchaseCount; p++) {
      await createTransaction({
        customer_id: customerId,
        channel: pickChannel(custType),
        amount_thb:
          custType === "B2B"
            ? faker.number.int({ min: 8_000, max: 120_000 })
            : faker.number.int({ min: 150, max: 9_000 }),
        // Members mostly buy their registered brand but not exclusively — a
        // pure 1:1 makes the cross-brand breakdown a diagonal and useless.
        brand: faker.datatype.boolean(0.75) ? brand : pickBrand(),
        created_by: actorId,
        tx_date: purchaseDate(),
        source: "staff",
      });
      txTotal++;
    }

    if ((n + 1) % 25 === 0) {
      console.log(`  ${i + 1}/${opts.customers} members, ${txTotal} transactions`);
    }
  }

  // RFM scores are derived, not stored per-write, so they have to be rebuilt
  // once the history exists or every segment filter reads empty.
  const { scored } = await recomputeScores();

  console.log(
    `Done: +${remaining} members (${opts.customers} total), ${txTotal} transactions, ${scored} scored.`
  );
}

/**
 * Removes only what this script wrote, keyed on the @volume.test email.
 * Transactions, interactions and ledger rows cascade from customers; the
 * derived score rows do not, so they go first.
 */
async function clear(): Promise<void> {
  const ids = await all<{ id: number }>(
    `SELECT id FROM customers WHERE email LIKE @pattern`,
    { pattern: `%@${VOLUME_DOMAIN}` }
  );
  if (ids.length === 0) {
    console.log("Nothing to clear.");
    return;
  }
  await run(
    `DELETE FROM customer_scores WHERE customer_id IN
       (SELECT id FROM customers WHERE email LIKE @pattern)`,
    { pattern: `%@${VOLUME_DOMAIN}` }
  );
  await run(`DELETE FROM customers WHERE email LIKE @pattern`, {
    pattern: `%@${VOLUME_DOMAIN}`,
  });
  console.log(`Cleared ${ids.length} volume-seeded members and their history.`);
}

const opts = parseArgs(process.argv.slice(2));
const task = opts.clear ? clear() : main(opts);
task.catch((e) => {
  console.error("FAILED:", e);
  process.exitCode = 1;
});
