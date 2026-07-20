import bcrypt from "bcryptjs";

/**
 * The subset of db/client.ts's query surface seeding needs. Passed in by
 * db/client.ts rather than imported directly, so this module has no runtime
 * dependency on client.ts (which itself imports seedInto) — avoids a
 * circular import while keeping full type safety.
 */
export interface SeedDb {
  run(sql: string, args?: unknown[] | Record<string, unknown>): Promise<number>;
  batch(statements: { sql: string; args?: unknown[] | Record<string, unknown> }[]): Promise<void>;
}

/**
 * Populates a fresh database with the bare minimum: sign-in accounts and the
 * department names they belong to. No module grants, no PIC links, no tier
 * ladder, no business records of any kind — every other table starts empty
 * and is filled through the app or the admin Setup page.
 *
 * Called once from db/client.ts's ensureDatabase(), only when the `users`
 * table is empty. ON CONFLICT DO NOTHING guards are defense-in-depth against
 * two server instances cold-starting concurrently on first-ever deploy —
 * Postgres is durable and shared, unlike the old in-memory sql.js instance.
 */
export async function seedInto(db: SeedDb): Promise<void> {
  const demoHash = bcrypt.hashSync("demo123", 10);

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
    userIds[key] = await db.run(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES (@name, @email, @hash, @role)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      { name, email, hash: demoHash, role }
    );
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
    const departmentId = await db.run(
      `INSERT INTO departments (name, description)
       VALUES (@name, @description)
       ON CONFLICT (name) DO NOTHING
       RETURNING id`,
      { name: dept.name, description: dept.description }
    );
    if (departmentId > 0) {
      await db.run("UPDATE users SET home_department_id = @dept WHERE id = @user", {
        dept: departmentId,
        user: userIds[dept.key],
      });
    }
  }
}
