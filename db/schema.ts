// Runtime source of truth for the schema. Kept as a TS string (not read from
// schema.sql at runtime) so it is always present in the serverless bundle.
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  industry TEXT,
  website TEXT,
  phone TEXT,
  address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  title TEXT,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS contacts_company_id ON contacts(company_id);

CREATE TABLE IF NOT EXISTS deals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  value REAL NOT NULL DEFAULT 0,
  stage TEXT NOT NULL CHECK (stage IN ('New','Contacted','Qualified','Proposal','Won','Lost')),
  contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  owner_id INTEGER REFERENCES users(id),
  expected_close_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS deals_contact_id ON deals(contact_id);
CREATE INDEX IF NOT EXISTS deals_company_id ON deals(company_id);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('call','email','note','meeting','follow_up')),
  subject TEXT NOT NULL,
  description TEXT,
  due_date TEXT,
  completed INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
  deal_id INTEGER REFERENCES deals(id) ON DELETE CASCADE,
  owner_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS tasks_contact_id ON tasks(contact_id);
CREATE INDEX IF NOT EXISTS tasks_deal_id ON tasks(deal_id);
`;
