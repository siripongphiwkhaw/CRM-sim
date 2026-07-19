import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";
import type { Database } from "sql.js";
import {
  BRANDS,
  CHANNELS,
  DATA_LEVELS,
  PRODUCT_CATEGORIES,
  type CustType,
  type TxChannel,
} from "@/lib/constants";
import {
  calcEarn,
  tierForLifetime,
  DEFAULT_TIER_RULES,
} from "@/lib/loyaltyEngine";

const CUSTOMER_COUNT = 60;
const PRODUCT_COUNT = 24;
const DISTRIBUTOR_COUNT = 8;
const REPORT_COUNT = 40;
const TRADE_CHANNELS_SEED = ["Modern Trade", "Traditional Trade", "E-Commerce", "Food Service"];

function lastId(db: Database): number {
  const res = db.exec("SELECT last_insert_rowid() AS id");
  return Number(res[0].values[0][0]);
}

const B2C_TX_CHANNELS: TxChannel[] = ["POS", "ECOM", "D2C"];

/**
 * Populates a fresh in-memory database with deterministic demo data for the
 * loyalty / CDP platform. Runs once per server instance (db/client.ts) with a
 * fixed faker seed, so every cold start produces the same sample data.
 */
export function seedInto(db: Database): void {
  faker.seed(20240715);
  const demoHash = bcrypt.hashSync("demo123", 10);

  db.run("BEGIN");
  try {
    // Users with roles: one admin, one regular staff user.
    const userIds: Record<"admin" | "staff", number> = { admin: 0, staff: 0 };
    for (const [key, name, email, role] of [
      ["admin", "Admin User", "admin@crm.local", "admin"],
      ["staff", "Staff Member", "staff@crm.local", "user"],
    ] as const) {
      db.run(
        "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
        [name, email, demoHash, role]
      );
      userIds[key] = lastId(db);
    }

    // Loyalty tier ladder (mirrors lib/loyaltyEngine DEFAULT_TIER_RULES).
    for (const rule of DEFAULT_TIER_RULES) {
      db.run(
        "INSERT INTO tier_config (tier, min_lifetime_points, multiplier) VALUES (?, ?, ?)",
        [rule.tier, rule.min_lifetime_points, rule.multiplier]
      );
    }

    // Rewards catalog.
    const rewards: [string, string, string, number][] = [
      ["฿50 cash voucher", "VOUCHER", "Redeemable at any participating store.", 100],
      ["฿100 cash voucher", "VOUCHER", "Redeemable at any participating store.", 200],
      ["Free seasoning sampler", "PRODUCT", "A sampler pack of the season's range.", 250],
      ["10% off next purchase", "DISCOUNT", "One-time discount code.", 150],
      ["Premium gift set", "PRODUCT", "Curated gift set of best-sellers.", 500],
      ["Cooking class seat", "EXPERIENCE", "One seat at a partner cooking class.", 1500],
      ["Branded tote bag", "PRODUCT", "Limited-edition reusable tote.", 300],
      ["฿250 cash voucher", "VOUCHER", "Redeemable at any participating store.", 480],
    ];
    for (let i = 0; i < rewards.length; i++) {
      const [name, type, desc, cost] = rewards[i];
      db.run(
        `INSERT INTO rewards (code, name, description, reward_type, points_cost)
         VALUES (?, ?, ?, ?, ?)`,
        [`RWD-${String(i + 1).padStart(3, "0")}`, name, desc, type, cost]
      );
    }
    const rewardCount = rewards.length;

    // S&I product master.
    const productIds: number[] = [];
    const productPrices = new Map<number, number>();
    for (let i = 0; i < PRODUCT_COUNT; i++) {
      const brand = faker.helpers.arrayElement(BRANDS);
      const unitPrice = faker.number.int({ min: 15, max: 590 });
      db.run(
        `INSERT INTO products (sku, name, brand, category, unit_price, reorder_point)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          `SKU-${String(1000 + i)}`,
          `${brand} ${faker.commerce.productName()}`,
          brand,
          faker.helpers.arrayElement(PRODUCT_CATEGORIES),
          unitPrice,
          faker.helpers.arrayElement([10, 20, 20, 20, 50]),
        ]
      );
      const id = lastId(db);
      productIds.push(id);
      productPrices.set(id, unitPrice);
    }

    // Customers (CDP master). Purchases are transactions that walk the loyalty
    // ledger chronologically (lib/loyaltyEngine), so tier/points caches, lifetime
    // progression, and the redemption rate are all internally consistent.
    const b2bCustomerIds: number[] = [];
    let txCounter = 0;
    let ledgerBurnTotal = 0;
    let ledgerEarnTotal = 0;

    const nextTxCode = () => `TXN-${String(++txCounter).padStart(6, "0")}`;

    /** Inserts a customer and returns its id (does not create consent/tx). */
    function insertCustomer(opts: {
      firstName: string;
      lastName: string;
      brand: string;
      custType: CustType;
      registerChannel: string;
      dataLevel: string;
      registeredAt: string;
    }): number {
      const rowCount = db.exec("SELECT COUNT(*)+1 AS n FROM customers");
      const n = Number(rowCount[0].values[0][0]);
      db.run(
        `INSERT INTO customers
           (member_code, first_name, last_name, email, phone, brand, cust_type,
            register_channel, data_level, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `CUS-${String(n).padStart(6, "0")}`,
          opts.firstName,
          opts.lastName,
          faker.internet.email({ firstName: opts.firstName, lastName: opts.lastName }).toLowerCase(),
          faker.phone.number(),
          opts.brand,
          opts.custType,
          opts.registerChannel,
          opts.dataLevel,
          opts.registeredAt,
          opts.registeredAt,
        ]
      );
      return lastId(db);
    }

    /** Records a purchase transaction + EARN ledger row, returning points earned. */
    function seedTransaction(
      customerId: number,
      custType: CustType,
      lifetimeSoFar: number,
      amount: number,
      channel: TxChannel,
      when: string
    ): number {
      const tier = tierForLifetime(lifetimeSoFar);
      const earn = calcEarn(amount, custType, tier);
      const channelIsB2C = B2C_TX_CHANNELS.includes(channel);
      const matches = custType === "B2C" ? channelIsB2C : !channelIsB2C;
      const flag = matches ? null : "CHANNEL_ELIGIBILITY_WARNING";
      db.run(
        `INSERT INTO transactions (tx_code, customer_id, channel, amount_thb, channel_flag, source_ref, created_by, tx_date)
         VALUES (?, ?, ?, ?, ?, 'seed', ?, ?)`,
        [nextTxCode(), customerId, channel, amount, flag, userIds.staff, when]
      );
      const txId = lastId(db);
      if (earn.points > 0) {
        db.run(
          `INSERT INTO loyalty_ledger
             (customer_id, entry_type, points, rate_applied, multiplier, tier_at_time, ref_type, ref_id, note, created_by, occurred_at)
           VALUES (?, 'EARN', ?, ?, ?, ?, 'transaction', ?, ?, ?, ?)`,
          [customerId, earn.points, earn.rate, earn.multiplier, tier, txId, `Earn on ${channel} purchase`, userIds.staff, when]
        );
        ledgerEarnTotal += earn.points;
      }
      return earn.points;
    }

    function seedConsents(customerId: number, marketingGranted: boolean, when: string, withdrawnLater: boolean) {
      db.run(
        `INSERT INTO consents (customer_id, purpose, status, source, captured_at) VALUES (?, 'ANALYTICS', 'GRANTED', 'registration', ?)`,
        [customerId, when]
      );
      db.run(
        `INSERT INTO consents (customer_id, purpose, status, source, captured_at) VALUES (?, 'MARKETING', ?, 'registration', ?)`,
        [customerId, marketingGranted ? "GRANTED" : "DENIED", when]
      );
      if (marketingGranted && withdrawnLater) {
        db.run(
          `INSERT INTO consents (customer_id, purpose, status, source, captured_at) VALUES (?, 'MARKETING', 'WITHDRAWN', 'staff', ?)`,
          [customerId, faker.date.recent({ days: 20 }).toISOString()]
        );
      }
    }

    // points cache = balance (lifetime EARN − BURN); tier = tierForLifetime(lifetime).
    function finalizeCustomer(
      customerId: number,
      lifetime: number,
      balance: number,
      clv: number,
      lastPurchaseAt: string | null
    ) {
      db.run(
        `UPDATE customers SET points = ?, tier = ?, clv = ?, last_purchase_at = ?, updated_at = datetime('now') WHERE id = ?`,
        [balance, tierForLifetime(lifetime), clv, lastPurchaseAt, customerId]
      );
    }

    for (let i = 0; i < CUSTOMER_COUNT; i++) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const brand = faker.helpers.arrayElement(BRANDS);
      // ~15% of members are B2B (business buyers on the SFA channel).
      const custType: CustType = i % 7 === 3 ? "B2B" : "B2C";
      const registerChannel = faker.helpers.arrayElement(CHANNELS);
      const registeredAt = faker.date.past({ years: 2 }).toISOString();
      const dataLevel = faker.helpers.weightedArrayElement([
        { value: DATA_LEVELS[0], weight: 2 },
        { value: DATA_LEVELS[1], weight: 3 },
        { value: DATA_LEVELS[2], weight: 5 },
      ]);

      const customerId = insertCustomer({
        firstName, lastName, brand, custType, registerChannel, dataLevel, registeredAt,
      });
      if (custType === "B2B") b2bCustomerIds.push(customerId);

      // Registration + enrichment stay in the soft interactions log.
      db.run(
        `INSERT INTO interactions (customer_id, type, channel, points, description, occurred_at)
         VALUES (?, 'register', ?, 50, ?, ?)`,
        [customerId, registerChannel, `Registered via ${registerChannel}`, registeredAt]
      );
      if (dataLevel !== "Register") {
        db.run(
          `INSERT INTO interactions (customer_id, type, channel, points, description, occurred_at)
           VALUES (?, 'enrichment', ?, 20, 'Profile enrichment survey completed', ?)`,
          [customerId, registerChannel, faker.date.between({ from: registeredAt, to: new Date() }).toISOString()]
        );
      }

      // Purchases → transactions + ledger.
      let lifetime = 0;
      let burned = 0;
      let clv = 0;
      let lastPurchaseAt: string | null = null;
      let dualChannel = false;
      if (dataLevel === "Purchase & Engagement") {
        const purchaseCount = faker.number.int({ min: 1, max: 9 });
        const dates = Array.from({ length: purchaseCount }, () =>
          faker.date.between({ from: registeredAt, to: new Date() }).toISOString()
        ).sort();
        // A few B2B members also transact through a B2C channel (channel conflict).
        dualChannel = custType === "B2B" && i % 11 === 3;
        for (let p = 0; p < dates.length; p++) {
          const amount = faker.number.int({ min: 90, max: 2400 });
          let channel: TxChannel;
          if (custType === "B2B") {
            channel = dualChannel && p === 0 ? "POS" : "SFA";
          } else {
            channel = faker.helpers.arrayElement(B2C_TX_CHANNELS);
          }
          const earned = seedTransaction(customerId, custType, lifetime, amount, channel, dates[p]);
          lifetime += earned;
          clv += amount;
          lastPurchaseAt = dates[p];
        }
        // ~30% redeem a reward (BURN) — tuned to keep global redemption < 30%.
        if (lifetime > 250 && i % 10 < 3) {
          const cost = faker.helpers.arrayElement([100, 150, 200]);
          if (cost <= lifetime) {
            db.run(
              `INSERT INTO loyalty_ledger (customer_id, entry_type, points, tier_at_time, ref_type, ref_id, note, created_by, occurred_at)
               VALUES (?, 'BURN', ?, ?, 'reward', 1, 'Redeemed reward', ?, ?)`,
              [customerId, cost, tierForLifetime(lifetime), userIds.staff, faker.date.recent({ days: 40 }).toISOString()]
            );
            ledgerBurnTotal += cost;
            burned += cost;
          }
        }
      }

      finalizeCustomer(customerId, lifetime, lifetime - burned, clv, lastPurchaseAt);

      // Consents: ~30% deny marketing, spread across the member base (drives
      // CONSENT_GAP > 20%). A deterministic hash avoids clustering.
      const marketingGranted = (i * 37 + 11) % 100 >= 30;
      seedConsents(customerId, marketingGranted, registeredAt, i % 13 === 5);
    }

    // Four fixed boundary members with exact lifetime totals for tier tests.
    const boundaries: [string, number][] = [
      ["Bronze Boundary", 499],
      ["Silver Boundary", 500],
      ["Silver Ceiling", 1999],
      ["Gold Boundary", 2000],
    ];
    for (const [name, lifetime] of boundaries) {
      const registeredAt = faker.date.past({ years: 1 }).toISOString();
      const id = insertCustomer({
        firstName: name.split(" ")[0],
        lastName: name.split(" ")[1],
        brand: BRANDS[0],
        custType: "B2C",
        registerChannel: CHANNELS[0],
        dataLevel: "Purchase & Engagement",
        registeredAt,
      });
      db.run(
        `INSERT INTO loyalty_ledger (customer_id, entry_type, points, tier_at_time, ref_type, note, created_by, occurred_at)
         VALUES (?, 'EARN', ?, ?, 'seed', 'Boundary seed', ?, ?)`,
        [id, lifetime, tierForLifetime(lifetime), userIds.admin, registeredAt]
      );
      ledgerEarnTotal += lifetime;
      finalizeCustomer(id, lifetime, lifetime, lifetime * 20, registeredAt);
      seedConsents(id, true, registeredAt, false);
    }
    void ledgerBurnTotal;

    // Distributors / dealers: FMCG trade master data. ~5 Dealers are linked to a
    // B2B CRM member (so a delivered sell-in earns them loyalty points); two
    // active Dealers are deliberately left unlinked (DEALER_UNLINKED insight).
    const distributorIds: number[] = [];
    for (let i = 0; i < DISTRIBUTOR_COUNT; i++) {
      const name = faker.company.name();
      const dealerType = i % 3 === 2 ? "Retailer" : "Dealer";
      // Link the first 5 dealers to B2B members; leave the rest unlinked.
      const linkedCustomer =
        dealerType === "Dealer" && i < 5 && b2bCustomerIds[i] ? b2bCustomerIds[i] : null;
      // Force the last two dealers active + unlinked for the DEALER_UNLINKED rule.
      const active =
        i >= DISTRIBUTOR_COUNT - 2 ? true : faker.datatype.boolean({ probability: 0.9 });
      db.run(
        `INSERT INTO distributors
           (distributor_code, name, region, channel, status, dealer_type, customer_id, area, contact_name, phone, email, address, credit_limit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `DIST-${String(1000 + i)}`,
          name,
          faker.location.state(),
          faker.helpers.arrayElement(TRADE_CHANNELS_SEED),
          active ? "active" : "inactive",
          dealerType,
          linkedCustomer,
          faker.location.city(),
          faker.person.fullName(),
          faker.phone.number(),
          faker.internet.email({ firstName: name.split(" ")[0] }).toLowerCase(),
          `${faker.location.streetAddress()}, ${faker.location.city()}`,
          faker.number.int({ min: 50000, max: 500000 }),
        ]
      );
      distributorIds.push(lastId(db));
    }

    // Inventory ledger: opening stock-in per distributor/product, so on-hand
    // (always SUM(quantity) at query time) starts from a believable baseline.
    for (const distributorId of distributorIds) {
      const stockedProducts = faker.helpers.arrayElements(productIds, { min: 4, max: 8 });
      for (const productId of stockedProducts) {
        db.run(
          `INSERT INTO inventory_transactions
             (distributor_id, product_id, txn_type, quantity, reference_type, note, created_by, occurred_at)
           VALUES (?, ?, 'stock_in', ?, 'manual', ?, ?, ?)`,
          [
            distributorId,
            productId,
            faker.number.int({ min: 100, max: 600 }),
            "Opening stock balance",
            userIds.admin,
            faker.date.recent({ days: 60 }).toISOString(),
          ]
        );
      }
    }

    // Sell-out reports: a report + its matching negative stock-out ledger
    // entry, mirroring db/queries/reports.ts's createDistributorReport.
    for (let i = 0; i < REPORT_COUNT; i++) {
      const distributorId = faker.helpers.arrayElement(distributorIds);
      const productId = faker.helpers.arrayElement(productIds);
      const sellOut = faker.number.int({ min: 0, max: 150 });
      const forecast = Math.round(sellOut * faker.number.float({ min: 0.8, max: 1.4 }));
      const period = faker.date.recent({ days: 90 }).toISOString().slice(0, 7);
      const recordedAt = faker.date.recent({ days: 30 }).toISOString();

      db.run(
        `INSERT INTO distributor_reports (distributor_id, product_id, period, sell_out_qty, forecast_qty, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [distributorId, productId, period, sellOut, forecast, recordedAt]
      );
      if (sellOut > 0) {
        db.run(
          `INSERT INTO inventory_transactions
             (distributor_id, product_id, txn_type, quantity, reference_type, note, created_by, occurred_at)
           VALUES (?, ?, 'stock_out', ?, 'sell_out_report', ?, ?, ?)`,
          [distributorId, productId, -sellOut, `Sell-out report for ${period}`, userIds.staff, recordedAt]
        );
      }
    }

    // Orders: self-ordering with a full approval-workflow spread across every
    // status, each with a matching order_status_history timeline.
    const ORDER_PLAN: { status: string; steps: string[] }[] = [
      { status: "draft", steps: ["draft"] },
      { status: "draft", steps: ["draft"] },
      { status: "draft", steps: ["draft"] },
      { status: "submitted", steps: ["draft", "submitted"] },
      { status: "submitted", steps: ["draft", "submitted"] },
      { status: "submitted", steps: ["draft", "submitted"] },
      { status: "submitted", steps: ["draft", "submitted"] },
      { status: "approved", steps: ["draft", "submitted", "approved"] },
      { status: "approved", steps: ["draft", "submitted", "approved"] },
      { status: "approved", steps: ["draft", "submitted", "approved"] },
      { status: "approved", steps: ["draft", "submitted", "approved"] },
      { status: "approved", steps: ["draft", "submitted", "approved"] },
      { status: "fulfilled", steps: ["draft", "submitted", "approved", "fulfilled"] },
      { status: "fulfilled", steps: ["draft", "submitted", "approved", "fulfilled"] },
      { status: "fulfilled", steps: ["draft", "submitted", "approved", "fulfilled"] },
      { status: "fulfilled", steps: ["draft", "submitted", "approved", "fulfilled"] },
      { status: "rejected", steps: ["draft", "submitted", "rejected"] },
      { status: "rejected", steps: ["draft", "submitted", "rejected"] },
      { status: "cancelled", steps: ["draft", "cancelled"] },
      { status: "cancelled", steps: ["draft", "submitted", "cancelled"] },
    ];

    for (let i = 0; i < ORDER_PLAN.length; i++) {
      const plan = ORDER_PLAN[i];
      const orderNumber = `ORD-${String(10000 + i)}`;
      const distributorId = faker.helpers.arrayElement(distributorIds);
      const createdAt = faker.date.recent({ days: 45 }).toISOString();
      const lineItems = faker.helpers
        .arrayElements(productIds, { min: 1, max: 3 })
        .map((productId) => ({
          productId,
          quantity: faker.number.int({ min: 5, max: 60 }),
          unitPrice: productPrices.get(productId) ?? 0,
        }));

      db.run(
        `INSERT INTO orders
           (order_number, distributor_id, status, requested_delivery_date, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          orderNumber,
          distributorId,
          plan.status,
          faker.date.soon({ days: 21 }).toISOString().slice(0, 10),
          userIds.staff,
          createdAt,
          createdAt,
        ]
      );
      const orderId = lastId(db);

      for (const item of lineItems) {
        db.run(
          `INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)`,
          [orderId, item.productId, item.quantity, item.unitPrice]
        );
      }

      let fromStatus: string | null = null;
      for (const toStatus of plan.steps) {
        const actor =
          toStatus === "approved" || toStatus === "rejected" ? userIds.admin : userIds.staff;
        const note =
          toStatus === "rejected"
            ? "Over credit limit for this period."
            : toStatus === "fulfilled"
              ? "Auto-fulfilled: all deliveries completed."
              : null;
        db.run(
          `INSERT INTO order_status_history (order_id, from_status, to_status, note, changed_by, changed_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [orderId, fromStatus, toStatus, note, actor, createdAt]
        );
        fromStatus = toStatus;
      }

      if (plan.status === "approved" || plan.status === "fulfilled") {
        const delivered = plan.status === "fulfilled";
        for (const item of lineItems) {
          db.run(
            `INSERT INTO delivery_plans (distributor_id, product_id, order_id, plan_date, planned_qty, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              distributorId,
              item.productId,
              orderId,
              faker.date.soon({ days: 14 }).toISOString().slice(0, 10),
              item.quantity,
              delivered ? "delivered" : "planned",
              createdAt,
            ]
          );
          if (delivered) {
            db.run(
              `INSERT INTO inventory_transactions
                 (distributor_id, product_id, txn_type, quantity, reference_type, reference_id, created_by, occurred_at)
               VALUES (?, ?, 'stock_in', ?, 'delivery_plan', ?, ?, ?)`,
              [distributorId, item.productId, item.quantity, lastId(db), userIds.admin, createdAt]
            );
          }
        }
      }
    }

    // Correct any distributor/product pair that went negative — opening
    // stock, sell-out reports and fulfilled deliveries are drawn from
    // independent random samples, so some combinations can oversell what was
    // ever stocked in. Rather than widen the random ranges and hope, post one
    // reconciling 'adjustment' transaction per negative pair, the same way a
    // real warehouse count correction would. Deterministic: guarantees
    // on-hand >= 0 everywhere instead of relying on probability.
    const negativeRes = db.exec(
      `SELECT distributor_id, product_id, SUM(quantity) AS on_hand
       FROM inventory_transactions
       GROUP BY distributor_id, product_id
       HAVING on_hand < 0`
    );
    for (const row of negativeRes[0]?.values ?? []) {
      const [distributorId, productId, onHand] = row as [number, number, number];
      db.run(
        `INSERT INTO inventory_transactions
           (distributor_id, product_id, txn_type, quantity, reference_type, note, created_by, occurred_at)
         VALUES (?, ?, 'adjustment', ?, 'manual', 'Stock count reconciliation', ?, datetime('now'))`,
        [distributorId, productId, -onHand + 20, userIds.admin]
      );
    }

    // Departments & PICs: the admin backoffice / employee frontend split.
    const departments: [string, string][] = [
      ["Trade & Sales", "Owns distributor relationships, orders and sell-out reporting."],
      ["Data Governance", "Owns PDPA consent policy and customer data quality."],
      ["Finance", "Owns distributor credit limits and order approval thresholds."],
      ["IT & Data Cloud", "Owns source-system integrations and data migration."],
    ];
    const departmentIds: number[] = [];
    for (const [name, description] of departments) {
      db.run("INSERT INTO departments (name, description) VALUES (?, ?)", [name, description]);
      departmentIds.push(lastId(db));
    }
    // Seed both demo users as PICs so /department has something to show
    // out of the box, without making PIC-ness the same thing as admin.
    db.run("INSERT INTO department_pics (department_id, user_id) VALUES (?, ?)", [departmentIds[0], userIds.staff]);
    db.run("INSERT INTO department_pics (department_id, user_id) VALUES (?, ?)", [departmentIds[1], userIds.admin]);
    db.run("INSERT INTO department_pics (department_id, user_id) VALUES (?, ?)", [departmentIds[2], userIds.admin]);
    db.run("INSERT INTO department_pics (department_id, user_id) VALUES (?, ?)", [departmentIds[0], userIds.admin]);

    // Retail-audit receipt scans: a few store receipts already "scanned" so
    // the OCR audit pages have data before anyone points a camera at one.
    const productRows = (db.exec(
      "SELECT id, name, unit_price FROM products ORDER BY id LIMIT 12"
    )[0]?.values ?? []) as [number, string, number][];
    const auditStores: [string, string][] = [
      ["CityMart Sukhumvit", "Modern Trade"],
      ["BigBasket Superstore", "Modern Trade"],
      ["Somchai Minimart", "Traditional Trade"],
      ["Golden Wok Restaurant", "Food Service"],
    ];
    for (const [storeName, channel] of auditStores) {
      const ownPicks = faker.helpers.arrayElements(productRows, { min: 2, max: 4 });
      const otherLines = faker.helpers.arrayElements(
        ["Drinking Water 600ml", "Instant Noodles Cup", "Paper Towels 2pk", "น้ำแข็งหลอด"],
        { min: 1, max: 2 }
      );
      const total =
        ownPicks.reduce((sum, [, , price]) => sum + price, 0) + otherLines.length * 25;
      db.run(
        `INSERT INTO receipt_scans
           (scan_type, store_name, channel, receipt_date, receipt_total, currency, match_status, note, created_by, created_at)
         VALUES ('retail_audit', ?, ?, ?, ?, 'THB', 'matched', ?, ?, ?)`,
        [
          storeName,
          channel,
          faker.date.recent({ days: 30 }).toISOString().slice(0, 10),
          total,
          `${ownPicks.length} of ${ownPicks.length + otherLines.length} receipt lines are own products.`,
          userIds.admin,
          faker.date.recent({ days: 30 }).toISOString(),
        ]
      );
      const scanId = lastId(db);
      for (const [productId, name, price] of ownPicks) {
        const qty = faker.number.int({ min: 1, max: 3 });
        db.run(
          `INSERT INTO receipt_scan_lines
             (scan_id, product_id, ocr_name, quantity, unit_price, line_total, match_status, expected_price)
           VALUES (?, ?, ?, ?, ?, ?, 'matched', ?)`,
          [scanId, productId, name, qty, price, price * qty, price]
        );
      }
      for (const name of otherLines) {
        db.run(
          `INSERT INTO receipt_scan_lines
             (scan_id, ocr_name, quantity, unit_price, line_total, match_status)
           VALUES (?, ?, 1, 25, 25, 'not_our_product')`,
          [scanId, name]
        );
      }
    }

    // Data Cloud: linked source systems.
    const sources: [string, string, string, string, string, number, string][] = [
      ["Customer Data Platform", "CDP", "inbound", "realtime", "connected", CUSTOMER_COUNT, "Primary customer data source for the loyalty program"],
      ["SAP S/4HANA", "SAP", "bidirectional", "batch", "connected", 4200, "Sales orders & master data (nightly batch)"],
      ["LINE Official Account", "LINE OA", "inbound", "realtime", "connected", 1830, "Engagement & registration events"],
      ["Salesforce SFA", "SFA", "outbound", "batch", "syncing", 640, "Sales-force automation / self-ordering interface"],
      ["Web Sign-up", "Web", "inbound", "realtime", "connected", 970, "Website registration & enrichment forms"],
    ];
    for (const [name, type, direction, mode, status, records, description] of sources) {
      db.run(
        `INSERT INTO data_sources (name, source_type, direction, mode, status, records_synced, last_synced_at, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          type,
          direction,
          mode,
          status,
          records,
          faker.date.recent({ days: 2 }).toISOString(),
          description,
        ]
      );
    }

    // Service cases across statuses/priorities, most linked to a member.
    const customerCount = Number(db.exec("SELECT COUNT(*) AS n FROM customers")[0].values[0][0]);
    const caseSeeds: [string, string, string, string, string | null][] = [
      ["Points not credited after purchase", "POINTS", "HIGH", "OPEN", null],
      ["Reward voucher code not working", "REDEMPTION", "MEDIUM", "IN_PROGRESS", "staff"],
      ["Wrong tier shown in app", "ACCOUNT", "LOW", "RESOLVED", "staff"],
      ["Damaged product on delivery", "DELIVERY", "URGENT", "OPEN", null],
      ["Request to withdraw marketing consent", "ACCOUNT", "MEDIUM", "RESOLVED", "admin"],
      ["Duplicate account merge request", "ACCOUNT", "MEDIUM", "IN_PROGRESS", "admin"],
      ["Question about earning rate", "POINTS", "LOW", "CLOSED", "staff"],
      ["Missing purchase in history", "POINTS", "MEDIUM", "OPEN", null],
      ["Cannot redeem — insufficient points", "REDEMPTION", "LOW", "CLOSED", "staff"],
      ["Product quality complaint", "PRODUCT", "HIGH", "IN_PROGRESS", "staff"],
      ["Address update for deliveries", "ACCOUNT", "LOW", "RESOLVED", "staff"],
      ["Loyalty card not linking to LINE", "ACCOUNT", "MEDIUM", "OPEN", null],
    ];
    for (let i = 0; i < caseSeeds.length; i++) {
      const [subject, category, priority, status, assignee] = caseSeeds[i];
      const customerId = faker.number.int({ min: 1, max: customerCount });
      const createdAt = faker.date.recent({ days: 40 }).toISOString();
      const resolved = status === "RESOLVED" || status === "CLOSED";
      db.run(
        `INSERT INTO cases
           (case_number, customer_id, subject, category, priority, status, assigned_to, resolution, created_by, created_at, updated_at, resolved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `CASE-${String(i + 1).padStart(5, "0")}`,
          customerId,
          subject,
          category,
          priority,
          status,
          assignee === "admin" ? userIds.admin : assignee === "staff" ? userIds.staff : null,
          resolved ? "Resolved by support team." : null,
          userIds.staff,
          createdAt,
          createdAt,
          resolved ? faker.date.recent({ days: 10 }).toISOString() : null,
        ]
      );
    }

    // Seed a few AI insights so the Insights page is populated on first load;
    // the "Regenerate" action replaces the analytic ones with rule-derived rows.
    const insightSeeds: [string, string, string, string | null, number | null, string, string, string][] = [
      ["CONSENT_GAP", "WARNING", "global", null, null, "Marketing consent gap detected", "A meaningful share of members cannot be reached by marketing.", "Launch a consent-request journey on LINE with an incentive."],
      ["LIABILITY_HIGH", "OPPORTUNITY", "global", null, null, "Points liability building up", "Low redemption rate means points are accumulating as liability.", "Promote low-cost rewards to encourage members to burn points."],
      ["DEALER_UNLINKED", "INFO", "distributor", null, null, "Dealers not linked to CRM", "Some active dealers have no linked member, breaking the identity chain.", "Link each dealer to a B2B member to enable sell-in loyalty earn."],
      ["CHURN_RISK", "WARNING", "customer", null, null, "Members at churn risk", "Several members have not purchased in over 60 days.", "Send a win-back campaign with a personalized offer."],
    ];
    for (const [type, severity, etype, , , title, desc, rec] of insightSeeds) {
      db.run(
        `INSERT INTO ai_insights (insight_type, severity, entity_type, entity_id, title, description, recommendation, confidence, created_at)
         VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
        [type, severity, etype, title, desc, rec, 0.9, faker.date.recent({ days: 5 }).toISOString()]
      );
    }

    void ledgerEarnTotal;
    db.run("COMMIT");
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }
}
