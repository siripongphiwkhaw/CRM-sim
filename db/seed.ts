import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";
import { db } from "./client";
import { DEAL_STAGES, TASK_TYPES } from "@/lib/constants";

const COMPANY_COUNT = 18;
const CONTACT_COUNT = 70;
const DEAL_COUNT = 45;
const TASK_COUNT = 120;

export function seed() {
  const seedTx = db.transaction(() => {
    const insertUser = db.prepare(
      `INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)`
    );
    const demoHash = bcrypt.hashSync("demo123", 10);
    const userIds = [
      Number(insertUser.run("Admin Demo", "admin@crm.local", demoHash).lastInsertRowid),
      Number(
        insertUser.run("Jordan Sales", "jordan@crm.local", demoHash).lastInsertRowid
      ),
    ];

    const insertCompany = db.prepare(
      `INSERT INTO companies (name, industry, website, phone, address)
       VALUES (@name, @industry, @website, @phone, @address)`
    );
    const companyIds: number[] = [];
    for (let i = 0; i < COMPANY_COUNT; i++) {
      const name = faker.company.name();
      const id = Number(
        insertCompany.run({
          name,
          industry: faker.commerce.department(),
          website: faker.internet.url(),
          phone: faker.phone.number(),
          address: `${faker.location.streetAddress()}, ${faker.location.city()}`,
        }).lastInsertRowid
      );
      companyIds.push(id);
    }

    const insertContact = db.prepare(
      `INSERT INTO contacts (first_name, last_name, email, phone, title, company_id, notes)
       VALUES (@first_name, @last_name, @email, @phone, @title, @company_id, @notes)`
    );
    const contactIds: number[] = [];
    for (let i = 0; i < CONTACT_COUNT; i++) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const hasCompany = faker.datatype.boolean({ probability: 0.85 });
      const id = Number(
        insertContact.run({
          first_name: firstName,
          last_name: lastName,
          email: faker.internet.email({ firstName, lastName }).toLowerCase(),
          phone: faker.phone.number(),
          title: faker.person.jobTitle(),
          company_id: hasCompany
            ? faker.helpers.arrayElement(companyIds)
            : null,
          notes: faker.datatype.boolean({ probability: 0.3 })
            ? faker.lorem.sentence()
            : null,
        }).lastInsertRowid
      );
      contactIds.push(id);
    }

    const insertDeal = db.prepare(
      `INSERT INTO deals (title, value, stage, contact_id, company_id, owner_id, expected_close_date)
       VALUES (@title, @value, @stage, @contact_id, @company_id, @owner_id, @expected_close_date)`
    );
    const dealIds: number[] = [];
    for (let i = 0; i < DEAL_COUNT; i++) {
      const contactId = faker.helpers.arrayElement(contactIds);
      const contactRow = db
        .prepare("SELECT company_id FROM contacts WHERE id = ?")
        .get(contactId) as { company_id: number | null };

      const id = Number(
        insertDeal.run({
          title: `${faker.company.buzzPhrase()}`,
          value: faker.number.int({ min: 1000, max: 150000 }),
          stage: faker.helpers.arrayElement(DEAL_STAGES),
          contact_id: contactId,
          company_id: contactRow?.company_id ?? null,
          owner_id: faker.helpers.arrayElement(userIds),
          expected_close_date: faker.date
            .soon({ days: 90 })
            .toISOString()
            .slice(0, 10),
        }).lastInsertRowid
      );
      dealIds.push(id);
    }

    const insertTask = db.prepare(
      `INSERT INTO tasks (type, subject, description, due_date, completed, completed_at, contact_id, deal_id, owner_id, created_at)
       VALUES (@type, @subject, @description, @due_date, @completed, @completed_at, @contact_id, @deal_id, @owner_id, @created_at)`
    );
    for (let i = 0; i < TASK_COUNT; i++) {
      const type = faker.helpers.arrayElement(TASK_TYPES);
      const linkToDeal = faker.datatype.boolean({ probability: 0.5 });
      const contactId = faker.helpers.arrayElement(contactIds);
      const dealId = linkToDeal ? faker.helpers.arrayElement(dealIds) : null;
      const isPast = faker.datatype.boolean({ probability: 0.4 });
      const dueDate = isPast
        ? faker.date.recent({ days: 30 })
        : faker.date.soon({ days: 30 });
      const completed = isPast && faker.datatype.boolean({ probability: 0.6 });
      const createdAt = faker.date.recent({ days: 45 }).toISOString();

      insertTask.run({
        type,
        subject: faker.hacker.phrase(),
        description: faker.datatype.boolean({ probability: 0.4 })
          ? faker.lorem.sentence()
          : null,
        due_date: dueDate.toISOString().slice(0, 10),
        completed: completed ? 1 : 0,
        completed_at: completed ? dueDate.toISOString() : null,
        contact_id: contactId,
        deal_id: dealId,
        owner_id: faker.helpers.arrayElement(userIds),
        created_at: createdAt,
      });
    }
  });

  seedTx();

  console.log(
    `Seeded: 2 users, ${COMPANY_COUNT} companies, ${CONTACT_COUNT} contacts, ${DEAL_COUNT} deals, ${TASK_COUNT} tasks.`
  );
}
