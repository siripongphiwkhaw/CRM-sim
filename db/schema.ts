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

-- Sales / Trade / Channel: sell-out, inventory on-hand and demand forecast.
CREATE TABLE IF NOT EXISTS channel_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dealer_name TEXT NOT NULL,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  channel TEXT,
  sell_out_qty INTEGER NOT NULL DEFAULT 0,
  stock_on_hand INTEGER NOT NULL DEFAULT 0,
  forecast_qty INTEGER NOT NULL DEFAULT 0,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS channel_product ON channel_records(product_id);

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
