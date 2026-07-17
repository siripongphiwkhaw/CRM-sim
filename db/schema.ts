// Runtime source of truth for the schema. Kept as a TS string (not read from a
// .sql file at runtime) so it is always present in the serverless bundle.
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Customer / Master Data (CDP): unified member profile across all brands.
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_code TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  brand TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'Bronze' CHECK (tier IN ('Bronze','Silver','Gold','Platinum')),
  points INTEGER NOT NULL DEFAULT 0,
  register_channel TEXT,
  data_level TEXT NOT NULL DEFAULT 'Register',
  consent_pdpa INTEGER NOT NULL DEFAULT 0,
  consent_marketing INTEGER NOT NULL DEFAULT 0,
  consent_migration INTEGER NOT NULL DEFAULT 0,
  clv REAL NOT NULL DEFAULT 0,
  last_purchase_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS customers_brand ON customers(brand);
CREATE INDEX IF NOT EXISTS customers_tier ON customers(tier);

-- Interaction history: register / enrichment / purchase / engagement events.
CREATE TABLE IF NOT EXISTS interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('register','enrichment','purchase','engagement')),
  channel TEXT,
  amount REAL NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS interactions_customer ON interactions(customer_id);
CREATE INDEX IF NOT EXISTS interactions_type ON interactions(type);

-- S&I product master.
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  category TEXT,
  unit_price REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS products_brand ON products(brand);

-- Sales / Trade / Channel: distributor master data.
CREATE TABLE IF NOT EXISTS distributors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  distributor_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  region TEXT,
  channel TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  credit_limit REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Self-ordering: order header + line items + a full status-change timeline.
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT NOT NULL UNIQUE,
  distributor_id INTEGER NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected','fulfilled','cancelled')),
  requested_delivery_date TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  submitted_at TEXT,
  decided_at TEXT,
  decided_by INTEGER REFERENCES users(id),
  decision_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS orders_distributor ON orders(distributor_id);
CREATE INDEX IF NOT EXISTS orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS order_items_order ON order_items(order_id);

-- "How it got here" for an order — a timeline, distinct from orders.status
-- ("what's true now"), same relationship as interactions is to customers.
CREATE TABLE IF NOT EXISTS order_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  note TEXT,
  changed_by INTEGER NOT NULL REFERENCES users(id),
  changed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS order_status_history_order ON order_status_history(order_id);

CREATE TABLE IF NOT EXISTS delivery_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  distributor_id INTEGER NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  plan_date TEXT NOT NULL,
  planned_qty INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','delivered','cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS delivery_plans_distributor ON delivery_plans(distributor_id);
CREATE INDEX IF NOT EXISTS delivery_plans_order ON delivery_plans(order_id);

-- Inventory ledger: signed-delta transactions. On-hand stock is always
-- COALESCE(SUM(quantity),0) computed at query time — no maintained column,
-- no trigger, so every mutation stays traceable to a single run()/batch() call.
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  distributor_id INTEGER NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  txn_type TEXT NOT NULL CHECK (txn_type IN ('stock_in','stock_out','adjustment')),
  quantity INTEGER NOT NULL,
  reference_type TEXT CHECK (reference_type IN ('delivery_plan','sell_out_report','manual')),
  reference_id INTEGER,
  note TEXT,
  created_by INTEGER REFERENCES users(id),
  occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS inventory_txn_distributor_product ON inventory_transactions(distributor_id, product_id);

-- Sell-out actuals + demand forecast per distributor/product/period.
CREATE TABLE IF NOT EXISTS distributor_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  distributor_id INTEGER NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  sell_out_qty INTEGER NOT NULL DEFAULT 0,
  forecast_qty INTEGER NOT NULL DEFAULT 0,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS distributor_reports_distributor ON distributor_reports(distributor_id);

-- Backoffice: departments and their PICs (Person In Charge). Functional units
-- that will eventually route approvals — routing is deferred; this phase is
-- just the data model plus the admin and PIC-facing management surfaces.
CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Many-to-many: a department can have multiple PICs, a user can be PIC of
-- multiple departments.
CREATE TABLE IF NOT EXISTS department_pics (
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (department_id, user_id)
);

-- Data Cloud: linked source systems for data integration & migration.
CREATE TABLE IF NOT EXISTS data_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'inbound',
  mode TEXT NOT NULL DEFAULT 'batch',
  status TEXT NOT NULL DEFAULT 'connected',
  records_synced INTEGER NOT NULL DEFAULT 0,
  last_synced_at TEXT,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;
