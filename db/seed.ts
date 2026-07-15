import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";
import type { Database } from "sql.js";
import { DEAL_STAGES, TASK_TYPES } from "@/lib/constants";

const COMPANY_COUNT = 18;
const CONTACT_COUNT = 70;
const DEAL_COUNT = 45;
const TASK_COUNT = 120;

function lastId(db: Database): number {
  const res = db.exec("SELECT last_insert_rowid() AS id");
  return Number(res[0].values[0][0]);
}

/**
 * Populates a fresh in-memory database with deterministic demo data.
 * Runs once per server instance (see db/client.ts). Uses a fixed faker seed so
 * every cold start produces the same sample CRM.
 */
export function seedInto(db: Database): void {
  faker.seed(20240715);
  const demoHash = bcrypt.hashSync("demo123", 10);

  db.run("BEGIN");
  try {
    const userIds: number[] = [];
    for (const [name, email] of [
      ["Admin Demo", "admin@crm.local"],
      ["Jordan Sales", "jordan@crm.local"],
    ]) {
      db.run("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)", [
        name,
        email,
        demoHash,
      ]);
      userIds.push(lastId(db));
    }

    const companyIds: number[] = [];
    for (let i = 0; i < COMPANY_COUNT; i++) {
      db.run(
        `INSERT INTO companies (name, industry, website, phone, address)
         VALUES (?, ?, ?, ?, ?)`,
        [
          faker.company.name(),
          faker.commerce.department(),
          faker.internet.url(),
          faker.phone.number(),
          `${faker.location.streetAddress()}, ${faker.location.city()}`,
        ]
      );
      companyIds.push(lastId(db));
    }

    const contactIds: number[] = [];
    const contactCompany = new Map<number, number | null>();
    for (let i = 0; i < CONTACT_COUNT; i++) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const companyId = faker.datatype.boolean({ probability: 0.85 })
        ? faker.helpers.arrayElement(companyIds)
        : null;
      db.run(
        `INSERT INTO contacts (first_name, last_name, email, phone, title, company_id, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          firstName,
          lastName,
          faker.internet.email({ firstName, lastName }).toLowerCase(),
          faker.phone.number(),
          faker.person.jobTitle(),
          companyId,
          faker.datatype.boolean({ probability: 0.3 })
            ? faker.lorem.sentence()
            : null,
        ]
      );
      const id = lastId(db);
      contactIds.push(id);
      contactCompany.set(id, companyId);
    }

    const dealIds: number[] = [];
    for (let i = 0; i < DEAL_COUNT; i++) {
      const contactId = faker.helpers.arrayElement(contactIds);
      db.run(
        `INSERT INTO deals (title, value, stage, contact_id, company_id, owner_id, expected_close_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          faker.company.buzzPhrase(),
          faker.number.int({ min: 1000, max: 150000 }),
          faker.helpers.arrayElement(DEAL_STAGES),
          contactId,
          contactCompany.get(contactId) ?? null,
          faker.helpers.arrayElement(userIds),
          faker.date.soon({ days: 90 }).toISOString().slice(0, 10),
        ]
      );
      dealIds.push(lastId(db));
    }

    for (let i = 0; i < TASK_COUNT; i++) {
      const linkToDeal = faker.datatype.boolean({ probability: 0.5 });
      const isPast = faker.datatype.boolean({ probability: 0.4 });
      const dueDate = isPast
        ? faker.date.recent({ days: 30 })
        : faker.date.soon({ days: 30 });
      const completed = isPast && faker.datatype.boolean({ probability: 0.6 });
      db.run(
        `INSERT INTO tasks (type, subject, description, due_date, completed, completed_at, contact_id, deal_id, owner_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          faker.helpers.arrayElement(TASK_TYPES),
          faker.hacker.phrase(),
          faker.datatype.boolean({ probability: 0.4 })
            ? faker.lorem.sentence()
            : null,
          dueDate.toISOString().slice(0, 10),
          completed ? 1 : 0,
          completed ? dueDate.toISOString() : null,
          faker.helpers.arrayElement(contactIds),
          linkToDeal ? faker.helpers.arrayElement(dealIds) : null,
          faker.helpers.arrayElement(userIds),
          faker.date.recent({ days: 45 }).toISOString(),
        ]
      );
    }

    db.run("COMMIT");
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }
}
