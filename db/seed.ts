import bcrypt from "bcryptjs";
import type { Database } from "sql.js";

function lastId(db: Database): number {
  const res = db.exec("SELECT last_insert_rowid() AS id");
  return Number(res[0].values[0][0]);
}

/**
 * Populates a fresh in-memory database with the bare minimum: sign-in
 * accounts and the department names they belong to. No module grants, no PIC
 * links, no tier ladder, no business records of any kind — every other table
 * starts empty and is filled through the app or the admin Setup page.
 *
 * Runs once per server instance (see db/client.ts); because the database is
 * in-memory, a restart returns to this same bare baseline.
 */
export function seedInto(db: Database): void {
  const demoHash = bcrypt.hashSync("demo123", 10);

  db.run("BEGIN");
  try {
    // Sign-in accounts. Home departments are assigned once the departments
    // below exist. staff@crm.local is intentionally left without one.
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

    // Department names only — no module grants, no PIC, no approver flag.
    // Departments are inert until an admin grants modules from Setup.
    const departmentPlan: {
      key: "businessUnit" | "salesIngredient" | "digitalMarketing";
      name: string;
      description: string;
    }[] = [
      {
        key: "businessUnit",
        name: "Business Unit",
        description: "Sits under Digital Marketing. Approves submitted trade orders.",
      },
      {
        key: "salesIngredient",
        name: "Sales and Ingredient",
        description: "Owns the B2B side — dealers, trade orders, stock and the product master.",
      },
      {
        key: "digitalMarketing",
        name: "Digital Marketing",
        description: "Owns the B2C side — member engagement, loyalty and service cases.",
      },
    ];
    for (const dept of departmentPlan) {
      db.run("INSERT INTO departments (name, description) VALUES (?, ?)", [
        dept.name,
        dept.description,
      ]);
      const departmentId = lastId(db);
      db.run("UPDATE users SET home_department_id = ? WHERE id = ?", [
        departmentId,
        userIds[dept.key],
      ]);
    }

    db.run("COMMIT");
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }
}
