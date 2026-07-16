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
const CHANNEL_RECORD_COUNT = 60;

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
    for (const [name, email, role] of [
      ["Admin User", "admin@crm.local", "admin"],
      ["Staff Member", "staff@crm.local", "user"],
    ]) {
      db.run(
        "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
        [name, email, demoHash, role]
      );
    }

    // S&I product master.
    const productIds: number[] = [];
    for (let i = 0; i < PRODUCT_COUNT; i++) {
      const brand = faker.helpers.arrayElement(BRANDS);
      db.run(
        `INSERT INTO products (sku, name, brand, category, unit_price)
         VALUES (?, ?, ?, ?, ?)`,
        [
          `SKU-${String(1000 + i)}`,
          `${brand} ${faker.commerce.productName()}`,
          brand,
          faker.helpers.arrayElement(PRODUCT_CATEGORIES),
          faker.number.int({ min: 15, max: 590 }),
        ]
      );
      productIds.push(lastId(db));
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

    // Sell-out / inventory / forecast records across dealers.
    const dealers = Array.from({ length: 8 }, () => faker.company.name());
    for (let i = 0; i < CHANNEL_RECORD_COUNT; i++) {
      const sellOut = faker.number.int({ min: 0, max: 500 });
      db.run(
        `INSERT INTO channel_records
           (dealer_name, product_id, channel, sell_out_qty, stock_on_hand, forecast_qty, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          faker.helpers.arrayElement(dealers),
          faker.helpers.arrayElement(productIds),
          faker.helpers.arrayElement(["Modern Trade", "Traditional Trade", "E-Commerce", "Food Service"]),
          sellOut,
          faker.number.int({ min: 0, max: 800 }),
          Math.round(sellOut * faker.number.float({ min: 0.8, max: 1.4 })),
          faker.date.recent({ days: 30 }).toISOString(),
        ]
      );
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

    db.run("COMMIT");
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }
}
