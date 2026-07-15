import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "crm.db");
const SCHEMA_PATH = path.join(process.cwd(), "db", "schema.sql");

declare global {
  // eslint-disable-next-line no-var
  var __crmDb: Database.Database | undefined;
}

function createConnection(): Database.Database {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const database = new Database(DB_PATH);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  // Wait for the write lock instead of failing immediately when another
  // process (e.g. a parallel build worker) is mid-transaction.
  database.pragma("busy_timeout = 5000");
  database.exec(fs.readFileSync(SCHEMA_PATH, "utf-8"));
  return database;
}

// Reuse a single connection across Next.js dev-mode hot reloads.
const isNewConnection = !global.__crmDb;
export const db = global.__crmDb ?? createConnection();

if (process.env.NODE_ENV !== "production") {
  global.__crmDb = db;
}

if (isNewConnection) {
  // Seed on first run. The check-and-seed runs inside an IMMEDIATE transaction
  // so that parallel processes sharing this DB file (e.g. Next.js build workers)
  // can't both observe an empty table and collide on the users.email UNIQUE
  // constraint. The first worker seeds; the rest wait for the lock, then see a
  // populated table and skip.
  const seedIfEmpty = db.transaction(() => {
    const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as {
      count: number;
    };
    if (userCount.count === 0) {
      // Lazy require avoids a circular import (seed.ts imports this module for `db`).
      (require("./seed") as typeof import("./seed")).seed();
    }
  });
  seedIfEmpty.immediate();
}
