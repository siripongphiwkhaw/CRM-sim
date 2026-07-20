import bcrypt from "bcryptjs";
import type { Database } from "sql.js";
import { DEFAULT_TIER_RULES } from "@/lib/loyaltyEngine";

function lastId(db: Database): number {
  const res = db.exec("SELECT last_insert_rowid() AS id");
  return Number(res[0].values[0][0]);
}

/**
 * Populates a fresh in-memory database with the minimum needed for a working,
 * empty CRM: sign-in accounts, the org units that scope what each account can
 * reach, and the loyalty tier ladder.
 *
 * Deliberately seeds no business records — no members, products, dealers,
 * orders, stock, cases or insights. Every module starts empty and is filled
 * through the app. Runs once per server instance (see db/client.ts); because
 * the database is in-memory, a restart returns to this same clean baseline.
 */
export function seedInto(db: Database): void {
  const demoHash = bcrypt.hashSync("demo123", 10);

  db.run("BEGIN");
  try {
    // Sign-in accounts. Home departments are assigned once the departments
    // below exist. staff@crm.local is intentionally left without one, which
    // exercises the "no department -> Home + Guide only" path.
    const userIds: Record<
      "admin" | "staff" | "businessUnit" | "salesIngredient" | "digitalMarketing",
      number
    > = { admin: 0, staff: 0, businessUnit: 0, salesIngredient: 0, digitalMarketing: 0 };
    for (const [key, name, email, role] of [
      ["admin", "Admin User", "admin@crm.local", "admin"],
      ["staff", "Staff Member", "staff@crm.local", "user"],
      ["businessUnit", "Kanokwan Suksawat", "kanokwan.s@crm.local", "user"],
      ["salesIngredient", "Chatchai Ruangwilai", "chatchai.r@crm.local", "user"],
      ["digitalMarketing", "Pimchanok Wongsawat", "pimchanok.w@crm.local", "user"],
    ] as const) {
      db.run(
        "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
        [name, email, demoHash, role]
      );
      userIds[key] = lastId(db);
    }

    // Loyalty tier ladder (mirrors lib/loyaltyEngine DEFAULT_TIER_RULES). Config
    // rather than sample data — the earn engine needs it to award any points.
    for (const rule of DEFAULT_TIER_RULES) {
      db.run(
        "INSERT INTO tier_config (tier, min_lifetime_points, multiplier) VALUES (?, ?, ?)",
        [rule.tier, rule.min_lifetime_points, rule.multiplier]
      );
    }

    // Org units that scope what a non-admin user can reach. Each grants a set
    // of modules; Business Unit additionally approves submitted orders.
    const departmentPlan: {
      key: "businessUnit" | "salesIngredient" | "digitalMarketing";
      name: string;
      description: string;
      isApprover: boolean;
      modules: string[];
    }[] = [
      {
        key: "businessUnit",
        name: "Business Unit",
        description:
          "Sits under Digital Marketing. Approves submitted trade orders and watches channel performance.",
        isApprover: true,
        modules: ["channel", "insights"],
      },
      {
        key: "salesIngredient",
        name: "Sales and Ingredient",
        description:
          "Owns the B2B side end to end — dealers, trade orders, stock and the product master.",
        isApprover: false,
        modules: ["customers", "channel", "products", "cases"],
      },
      {
        key: "digitalMarketing",
        name: "Digital Marketing",
        description:
          "Owns the B2C side — member engagement, loyalty programme and service cases.",
        isApprover: false,
        modules: ["customers", "loyalty", "cases", "insights"],
      },
    ];
    const departmentIds: number[] = [];
    for (const dept of departmentPlan) {
      db.run(
        "INSERT INTO departments (name, description, is_approver) VALUES (?, ?, ?)",
        [dept.name, dept.description, dept.isApprover ? 1 : 0]
      );
      const departmentId = lastId(db);
      departmentIds.push(departmentId);

      for (const moduleKey of dept.modules) {
        db.run(
          "INSERT INTO department_modules (department_id, module) VALUES (?, ?)",
          [departmentId, moduleKey]
        );
      }

      // Each department's member belongs to it (drives module access) and is
      // also its PIC (drives /department) — related but independent mechanisms.
      db.run("UPDATE users SET home_department_id = ? WHERE id = ?", [
        departmentId,
        userIds[dept.key],
      ]);
      db.run("INSERT INTO department_pics (department_id, user_id) VALUES (?, ?)", [
        departmentId,
        userIds[dept.key],
      ]);
    }
    // The admin is PIC of Business Unit too, so /department isn't empty for them.
    db.run("INSERT INTO department_pics (department_id, user_id) VALUES (?, ?)", [
      departmentIds[0],
      userIds.admin,
    ]);

    db.run("COMMIT");
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }
}
