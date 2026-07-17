import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";
import type { Database } from "sql.js";
import {
  BRANDS,
  CHANNELS,
  DATA_LEVELS,
  PRODUCT_CATEGORIES,
  TIERS,
  type Tier,
} from "@/lib/constants";

const CUSTOMER_COUNT = 60;
const PRODUCT_COUNT = 24;
const DISTRIBUTOR_COUNT = 8;
const REPORT_COUNT = 40;
const TRADE_CHANNELS_SEED = ["Modern Trade", "Traditional Trade", "E-Commerce", "Food Service"];

function lastId(db: Database): number {
  const res = db.exec("SELECT last_insert_rowid() AS id");
  return Number(res[0].values[0][0]);
}

function tierForClv(clv: number): Tier {
  if (clv >= 30000) return "Platinum";
  if (clv >= 10000) return "Gold";
  if (clv >= 2000) return "Silver";
  return "Bronze";
}

interface SeedInteraction {
  type: "register" | "enrichment" | "purchase" | "engagement";
  channel: string;
  amount: number;
  points: number;
  description: string;
  occurred_at: string;
}

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

    // S&I product master.
    const productIds: number[] = [];
    const productPrices = new Map<number, number>();
    for (let i = 0; i < PRODUCT_COUNT; i++) {
      const brand = faker.helpers.arrayElement(BRANDS);
      const unitPrice = faker.number.int({ min: 15, max: 590 });
      db.run(
        `INSERT INTO products (sku, name, brand, category, unit_price)
         VALUES (?, ?, ?, ?, ?)`,
        [
          `SKU-${String(1000 + i)}`,
          `${brand} ${faker.commerce.productName()}`,
          brand,
          faker.helpers.arrayElement(PRODUCT_CATEGORIES),
          unitPrice,
        ]
      );
      const id = lastId(db);
      productIds.push(id);
      productPrices.set(id, unitPrice);
    }

    // Customers (CDP master) + their interaction history.
    for (let i = 0; i < CUSTOMER_COUNT; i++) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const brand = faker.helpers.arrayElement(BRANDS);
      const registerChannel = faker.helpers.arrayElement(CHANNELS);
      const registeredAt = faker.date.past({ years: 2 });
      const dataLevel = faker.helpers.weightedArrayElement([
        { value: DATA_LEVELS[0], weight: 2 },
        { value: DATA_LEVELS[1], weight: 3 },
        { value: DATA_LEVELS[2], weight: 5 },
      ]);

      const events: SeedInteraction[] = [
        {
          type: "register",
          channel: registerChannel,
          amount: 0,
          points: 50,
          description: `Registered via ${registerChannel}`,
          occurred_at: registeredAt.toISOString(),
        },
      ];

      if (dataLevel !== "Register") {
        events.push({
          type: "enrichment",
          channel: registerChannel,
          amount: 0,
          points: 20,
          description: "Profile enrichment survey completed",
          occurred_at: faker.date
            .between({ from: registeredAt, to: new Date() })
            .toISOString(),
        });
      }

      if (dataLevel === "Purchase & Engagement") {
        const purchaseCount = faker.number.int({ min: 1, max: 9 });
        for (let p = 0; p < purchaseCount; p++) {
          const amount = faker.number.int({ min: 90, max: 2400 });
          events.push({
            type: "purchase",
            channel: faker.helpers.arrayElement(CHANNELS),
            amount,
            points: Math.round(amount / 10),
            description: `Purchase of ${brand} products`,
            occurred_at: faker.date
              .between({ from: registeredAt, to: new Date() })
              .toISOString(),
          });
        }
        const engagementCount = faker.number.int({ min: 0, max: 4 });
        for (let e = 0; e < engagementCount; e++) {
          events.push({
            type: "engagement",
            channel: faker.helpers.arrayElement(CHANNELS),
            amount: 0,
            points: faker.number.int({ min: 10, max: 40 }),
            description: faker.helpers.arrayElement([
              "Completed mission",
              "Answered satisfaction survey",
              "Opened LINE OA campaign",
              "Referred a friend",
            ]),
            occurred_at: faker.date
              .between({ from: registeredAt, to: new Date() })
              .toISOString(),
          });
        }
      }

      const purchases = events.filter((e) => e.type === "purchase");
      const clv = purchases.reduce((sum, e) => sum + e.amount, 0);
      const points = events.reduce((sum, e) => sum + e.points, 0);
      const lastPurchaseAt =
        purchases.length > 0
          ? purchases
              .map((e) => e.occurred_at)
              .sort()
              .slice(-1)[0]
          : null;

      db.run(
        `INSERT INTO customers
           (member_code, first_name, last_name, email, phone, brand, tier, points,
            register_channel, data_level, consent_pdpa, consent_marketing,
            consent_migration, clv, last_purchase_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `MBR-${String(10001 + i)}`,
          firstName,
          lastName,
          faker.internet.email({ firstName, lastName }).toLowerCase(),
          faker.phone.number(),
          brand,
          faker.helpers.maybe(() => tierForClv(clv), { probability: 1 }) ??
            "Bronze",
          points,
          registerChannel,
          dataLevel,
          faker.datatype.boolean({ probability: 0.9 }) ? 1 : 0,
          faker.datatype.boolean({ probability: 0.6 }) ? 1 : 0,
          faker.datatype.boolean({ probability: 0.5 }) ? 1 : 0,
          clv,
          lastPurchaseAt,
          registeredAt.toISOString(),
          registeredAt.toISOString(),
        ]
      );
      const customerId = lastId(db);

      for (const ev of events) {
        db.run(
          `INSERT INTO interactions (customer_id, type, channel, amount, points, description, occurred_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            customerId,
            ev.type,
            ev.channel,
            ev.amount,
            ev.points,
            ev.description,
            ev.occurred_at,
          ]
        );
      }
    }

    // Distributors: FMCG trade master data (replaces the old free-text dealer name).
    const distributorIds: number[] = [];
    for (let i = 0; i < DISTRIBUTOR_COUNT; i++) {
      const name = faker.company.name();
      db.run(
        `INSERT INTO distributors
           (distributor_code, name, region, channel, status, contact_name, phone, email, address, credit_limit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `DIST-${String(1000 + i)}`,
          name,
          faker.location.state(),
          faker.helpers.arrayElement(TRADE_CHANNELS_SEED),
          faker.datatype.boolean({ probability: 0.9 }) ? "active" : "inactive",
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

    db.run("COMMIT");
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }
}
