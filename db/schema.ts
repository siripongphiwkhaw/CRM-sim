// Runtime source of truth for the schema. Kept as a TS string (not read from a
// .sql file at runtime) so it is always present in the serverless bundle.
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user')),
  -- Single "home" org unit, used to scope which modules this user can reach.
  -- Distinct from department_pics (M:N, "who manages a department's own
  -- settings"). NULL = unassigned, which resolves to Home + Guide only.
  -- Admins ignore this entirely. Forward-references departments (declared
  -- further down) — the FK constraint itself is added via ALTER TABLE at the
  -- bottom of this file, after departments exists.
  home_department_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (now())
);

-- Customer / Master Data (CDP): unified member profile across all brands.
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  member_code TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  brand TEXT NOT NULL,
  cust_type TEXT NOT NULL DEFAULT 'B2C' CHECK (cust_type IN ('B2C','B2B')),
  tier TEXT NOT NULL DEFAULT 'Bronze' CHECK (tier IN ('Bronze','Silver','Gold')),
  points INTEGER NOT NULL DEFAULT 0,
  register_channel TEXT,
  data_level TEXT NOT NULL DEFAULT 'Register',
  clv REAL NOT NULL DEFAULT 0,
  last_purchase_at TEXT,
  -- Only-One LINE link. NULL until a member is linked to a LINE account;
  -- the unique index still permits many NULLs, so unlinked members never
  -- collide but one LINE account can never claim two members.
  line_user_id TEXT,
  line_linked_at TEXT,
  -- Birthday auto-rewards (month+day match, see runBirthdayRewards).
  birth_date TEXT,
  -- Referral program. referral_code is this member's own shareable code;
  -- referred_by is the customer id of whoever referred them (set once, at
  -- registration, never editable after — see registerLineMember).
  referral_code TEXT,
  referred_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (now()),
  updated_at TEXT NOT NULL DEFAULT (now())
);
CREATE INDEX IF NOT EXISTS customers_brand ON customers(brand);
CREATE INDEX IF NOT EXISTS customers_tier ON customers(tier);

-- Interaction history: register / enrichment / purchase / engagement events.
CREATE TABLE IF NOT EXISTS interactions (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('register','enrichment','purchase','engagement')),
  channel TEXT,
  amount REAL NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  occurred_at TEXT NOT NULL DEFAULT (now())
);
CREATE INDEX IF NOT EXISTS interactions_customer ON interactions(customer_id);
CREATE INDEX IF NOT EXISTS interactions_type ON interactions(type);

-- S&I product master.
CREATE TABLE IF NOT EXISTS products (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  category TEXT,
  unit_price REAL NOT NULL DEFAULT 0,
  reorder_point INTEGER NOT NULL DEFAULT 20,
  -- Remote product photo. NULL falls back to the drawn placeholder art.
  image_url TEXT,
  created_at TEXT NOT NULL DEFAULT (now())
);
CREATE INDEX IF NOT EXISTS products_brand ON products(brand);

-- Sales / Trade / Channel: distributor master data.
CREATE TABLE IF NOT EXISTS distributors (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  distributor_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  region TEXT,
  channel TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  dealer_type TEXT NOT NULL DEFAULT 'Dealer' CHECK (dealer_type IN ('Dealer','Retailer')),
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  area TEXT,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  credit_limit REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (now()),
  updated_at TEXT NOT NULL DEFAULT (now())
);

-- Self-ordering: order header + line items + a full status-change timeline.
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  distributor_id INTEGER NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected','fulfilled','cancelled')),
  requested_delivery_date TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  submitted_at TEXT,
  decided_at TEXT,
  decided_by INTEGER REFERENCES users(id),
  decision_note TEXT,
  created_at TEXT NOT NULL DEFAULT (now()),
  updated_at TEXT NOT NULL DEFAULT (now())
);
CREATE INDEX IF NOT EXISTS orders_distributor ON orders(distributor_id);
CREATE INDEX IF NOT EXISTS orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS order_items_order ON order_items(order_id);

-- "How it got here" for an order — a timeline, distinct from orders.status
-- ("what's true now"), same relationship as interactions is to customers.
CREATE TABLE IF NOT EXISTS order_status_history (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  note TEXT,
  changed_by INTEGER NOT NULL REFERENCES users(id),
  changed_at TEXT NOT NULL DEFAULT (now())
);
CREATE INDEX IF NOT EXISTS order_status_history_order ON order_status_history(order_id);

CREATE TABLE IF NOT EXISTS delivery_plans (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  distributor_id INTEGER NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  plan_date TEXT NOT NULL,
  planned_qty INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','delivered','cancelled')),
  created_at TEXT NOT NULL DEFAULT (now())
);
CREATE INDEX IF NOT EXISTS delivery_plans_distributor ON delivery_plans(distributor_id);
CREATE INDEX IF NOT EXISTS delivery_plans_order ON delivery_plans(order_id);

-- Inventory ledger: signed-delta transactions. On-hand stock is always
-- COALESCE(SUM(quantity),0) computed at query time — no maintained column,
-- no trigger, so every mutation stays traceable to a single run()/batch() call.
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  distributor_id INTEGER NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  txn_type TEXT NOT NULL CHECK (txn_type IN ('stock_in','stock_out','adjustment')),
  quantity INTEGER NOT NULL,
  reference_type TEXT CHECK (reference_type IN ('delivery_plan','sell_out_report','manual')),
  reference_id INTEGER,
  note TEXT,
  created_by INTEGER REFERENCES users(id),
  occurred_at TEXT NOT NULL DEFAULT (now())
);
CREATE INDEX IF NOT EXISTS inventory_txn_distributor_product ON inventory_transactions(distributor_id, product_id);

-- Sell-out actuals + demand forecast per distributor/product/period.
CREATE TABLE IF NOT EXISTS distributor_reports (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  distributor_id INTEGER NOT NULL REFERENCES distributors(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  sell_out_qty INTEGER NOT NULL DEFAULT 0,
  forecast_qty INTEGER NOT NULL DEFAULT 0,
  recorded_at TEXT NOT NULL DEFAULT (now())
);
CREATE INDEX IF NOT EXISTS distributor_reports_distributor ON distributor_reports(distributor_id);

-- OCR receipt scans. Two flavours: order_verification (image checked against a
-- PO/SO's line items) and retail_audit (any store receipt scanned to log where
-- own products are being sold). Extraction happens via Claude vision; only the
-- structured result is stored, never the image itself.
CREATE TABLE IF NOT EXISTS receipt_scans (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scan_type TEXT NOT NULL CHECK (scan_type IN ('order_verification','retail_audit')),
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  store_name TEXT,
  channel TEXT,
  receipt_date TEXT,
  receipt_total REAL,
  currency TEXT,
  raw_summary TEXT,
  match_status TEXT NOT NULL CHECK (match_status IN ('matched','partial','mismatched','unmatched')),
  note TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (now())
);
CREATE INDEX IF NOT EXISTS receipt_scans_order ON receipt_scans(order_id);

CREATE TABLE IF NOT EXISTS receipt_scan_lines (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scan_id INTEGER NOT NULL REFERENCES receipt_scans(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  ocr_name TEXT NOT NULL,
  quantity INTEGER,
  unit_price REAL,
  line_total REAL,
  match_status TEXT NOT NULL CHECK (match_status IN ('matched','qty_mismatch','price_mismatch','not_in_order','not_our_product')),
  expected_quantity INTEGER,
  expected_price REAL
);
CREATE INDEX IF NOT EXISTS receipt_scan_lines_scan ON receipt_scan_lines(scan_id);

-- Backoffice: departments and their PICs (Person In Charge). Functional units
-- that will eventually route approvals — routing is deferred; this phase is
-- just the data model plus the admin and PIC-facing management surfaces.
CREATE TABLE IF NOT EXISTS departments (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  -- Members of an approver department may approve/reject submitted orders,
  -- a right that otherwise belongs to admins alone.
  is_approver INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (now()),
  updated_at TEXT NOT NULL DEFAULT (now())
);

-- Many-to-many: a department can have multiple PICs, a user can be PIC of
-- multiple departments.
CREATE TABLE IF NOT EXISTS department_pics (
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_at TEXT NOT NULL DEFAULT (now()),
  PRIMARY KEY (department_id, user_id)
);

-- Which modules (nav tabs) a department grants its members. Applies to the
-- 'user' role only — admins always reach everything. SQL Console and Setup are
-- never grantable here; they stay admin-only.
CREATE TABLE IF NOT EXISTS department_modules (
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  module TEXT NOT NULL CHECK (module IN (
    'customers','loyalty','cases','insights','products','channel','data-cloud','marketing'
  )),
  PRIMARY KEY (department_id, module)
);

-- Data Cloud: linked source systems for data integration & migration.
CREATE TABLE IF NOT EXISTS data_sources (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'inbound',
  mode TEXT NOT NULL DEFAULT 'batch',
  status TEXT NOT NULL DEFAULT 'connected',
  records_synced INTEGER NOT NULL DEFAULT 0,
  last_synced_at TEXT,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (now())
);

-- Loyalty: purchase transactions. The interactions table remains the soft
-- activity log; this is the money/points-bearing record of sale.
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tx_code TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('POS','ECOM','D2C','SFA')),
  amount_thb REAL NOT NULL CHECK (amount_thb >= 0),
  channel_flag TEXT CHECK (channel_flag IN ('CHANNEL_ELIGIBILITY_WARNING')),
  source_ref TEXT,
  -- Which brand the purchase happened at. Drives the Only-One per-brand
  -- earning breakdown. Nullable: rows written before this column existed
  -- have genuinely unknown attribution and surface as "Unattributed".
  brand TEXT,
  created_by INTEGER REFERENCES users(id),
  tx_date TEXT NOT NULL DEFAULT (now())
);
CREATE INDEX IF NOT EXISTS transactions_customer ON transactions(customer_id);

-- Append-only loyalty ledger. Balance and lifetime are ALWAYS computed:
--   balance  = SUM(CASE WHEN entry_type='EARN' THEN points ELSE -points END)
--   lifetime = SUM(points) WHERE entry_type='EARN'  (only EARN counts to tier)
-- No updates, no deletes; points is always positive, sign derives from type.
CREATE TABLE IF NOT EXISTS loyalty_ledger (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('EARN','BURN','ADJUST','EXPIRE')),
  points INTEGER NOT NULL CHECK (points > 0),
  rate_applied REAL,
  multiplier REAL,
  tier_at_time TEXT CHECK (tier_at_time IN ('Bronze','Silver','Gold')),
  ref_type TEXT CHECK (ref_type IN ('transaction','reward','manual','seed')),
  ref_id INTEGER,
  note TEXT,
  -- Where the entry came from: staff | api | liff | seed. Members have no
  -- users(id), so a member-initiated burn has created_by NULL — without this
  -- column it would be indistinguishable from an API-key burn.
  source TEXT,
  created_by INTEGER REFERENCES users(id),
  occurred_at TEXT NOT NULL DEFAULT (now())
);
CREATE INDEX IF NOT EXISTS loyalty_ledger_customer ON loyalty_ledger(customer_id, entry_type);

CREATE TABLE IF NOT EXISTS tier_config (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tier TEXT NOT NULL UNIQUE CHECK (tier IN ('Bronze','Silver','Gold')),
  min_lifetime_points INTEGER NOT NULL,
  multiplier REAL NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS rewards (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('VOUCHER','PRODUCT','DISCOUNT','EXPERIENCE')),
  points_cost INTEGER NOT NULL CHECK (points_cost > 0),
  -- Kept for back-compat with existing active=1 filters (API/LIFF); status is
  -- the source of truth going forward and setRewardStatus() keeps both in
  -- sync. See rewardAvailable() in lib/loyaltyEngine.ts for the full rule.
  active INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('DRAFT','PUBLISHED','SUSPENDED')),
  starts_at TEXT,
  ends_at TEXT,
  per_member_limit INTEGER,
  created_at TEXT NOT NULL DEFAULT (now())
);

-- Loyalty missions: staff-authored tasks members complete for bonus points.
-- Draft/Published/Suspended mirrors the rewards lifecycle.
CREATE TABLE IF NOT EXISTS missions (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  mission_type TEXT NOT NULL DEFAULT 'GENERAL',
  reward_points INTEGER NOT NULL CHECK (reward_points > 0),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','SUSPENDED')),
  starts_at TEXT,
  ends_at TEXT,
  -- 0 = auto-award on submit; 1 = a staff member must approve first.
  requires_proof INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (now())
);

-- One row per member attempt at a mission. ledger_id points at the EARN entry
-- once approved/auto-awarded, so the award is traceable to exactly one write.
CREATE TABLE IF NOT EXISTS mission_submissions (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mission_id INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  proof_note TEXT,
  ledger_id INTEGER REFERENCES loyalty_ledger(id),
  reviewed_by INTEGER REFERENCES users(id),
  submitted_at TEXT NOT NULL DEFAULT (now()),
  reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS mission_submissions_customer ON mission_submissions(customer_id);
CREATE INDEX IF NOT EXISTS mission_submissions_mission ON mission_submissions(mission_id);

-- RFM + churn scoring, recomputed on demand (recomputeScores). One row per
-- customer — PK doubles as the upsert target, no separate id/versioning.
CREATE TABLE IF NOT EXISTS customer_scores (
  customer_id INTEGER PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  rfm_recency INTEGER,
  rfm_frequency INTEGER,
  rfm_monetary INTEGER,
  rfm_cell TEXT,
  churn_score TEXT CHECK (churn_score IN ('High','Medium','Low')),
  nba_action TEXT,
  -- Behavioral classification (CONSUMER/HORECA/TRADE) + channel affinity, both
  -- derived by recomputeScores() — validity enforced in code, not CHECK, so
  -- adding a class later needs no constraint migration.
  behavior_class TEXT,
  primary_channel TEXT,
  channel_affinity TEXT,
  calculated_at TEXT
);

-- Saved audience definitions for campaigns. rule_json is an allow-listed
-- filter set (see db/queries/segments.ts) — never raw SQL from the client.
CREATE TABLE IF NOT EXISTS segments (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  segment_type TEXT NOT NULL DEFAULT 'custom' CHECK (segment_type IN ('custom','ai')),
  rule_json TEXT NOT NULL,
  live_count INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (now()),
  updated_at TEXT NOT NULL DEFAULT (now())
);

-- Campaigns target a segment and simulate a multi-channel send (no live LINE
-- Messaging API channel yet — see the "Simulated send" note in the UI).
CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('LINE','Email','Push','SMS')),
  segment_id INTEGER REFERENCES segments(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SCHEDULED','RUNNING','PAUSED','DONE')),
  -- Promo intent + how many days a targeted customer is "spoken for" so other
  -- channels' campaigns skip them (cross-channel promo frequency cap).
  campaign_type TEXT NOT NULL DEFAULT 'retention' CHECK (campaign_type IN ('acquisition','retention')),
  cooldown_days INTEGER NOT NULL DEFAULT 30,
  audience_size INTEGER NOT NULL DEFAULT 0,
  reach INTEGER NOT NULL DEFAULT 0,
  converted INTEGER NOT NULL DEFAULT 0,
  excluded INTEGER NOT NULL DEFAULT 0,
  launched_at TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (now()),
  updated_at TEXT NOT NULL DEFAULT (now())
);

-- Audience snapshot taken at launch — segment membership can drift after, so
-- reach/conversion are always measured against who was actually targeted.
CREATE TABLE IF NOT EXISTS campaign_audience (
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  delivered INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (campaign_id, customer_id)
);

-- Governance: who did what to which record. Append-only, never updated.
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_name TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create','update','publish','suspend','delete','launch','pause','resume')),
  user_id INTEGER REFERENCES users(id),
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (now())
);
CREATE INDEX IF NOT EXISTS audit_log_entity ON audit_log(entity_name, entity_id);

-- Per-purpose PDPA consent, append-only history. Current status for a purpose
-- is the latest row by captured_at (tie-break: highest id).
CREATE TABLE IF NOT EXISTS consents (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('MARKETING','ANALYTICS','PROFILING')),
  status TEXT NOT NULL CHECK (status IN ('GRANTED','DENIED','WITHDRAWN')),
  source TEXT,
  note TEXT,
  captured_at TEXT NOT NULL DEFAULT (now())
);
CREATE INDEX IF NOT EXISTS consents_customer ON consents(customer_id, purpose, captured_at);

-- Service cases.
CREATE TABLE IF NOT EXISTS cases (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_number TEXT NOT NULL UNIQUE,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('POINTS','REDEMPTION','PRODUCT','DELIVERY','ACCOUNT','OTHER','IDENTITY_REVIEW')),
  priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW','MEDIUM','HIGH','URGENT')),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','RESOLVED','CLOSED')),
  assigned_to INTEGER REFERENCES users(id),
  -- Routes a case to a whole department's PICs, not just one assignee. Used by
  -- identity-review cases (see customer_identity_links). NULL = unrouted.
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  resolution TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (now()),
  updated_at TEXT NOT NULL DEFAULT (now()),
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS cases_customer ON cases(customer_id);
CREATE INDEX IF NOT EXISTS cases_status ON cases(status);
-- NOTE: the cases(department_id) index is created in the migration block at the
-- bottom, AFTER the ADD COLUMN — never here. On an already-provisioned DB the
-- CREATE TABLE above is a no-op, so department_id doesn't exist at this point;
-- indexing it here would abort the whole schema transaction and brick the app.

-- A detected same-person link between a B2C and a B2B customer row sharing an
-- email or phone. dominant_side records which side actually spends/buys more
-- (judged from the merged transaction history). Only a CONFIRMED link enforces
-- exclusive promotion in launchCampaign(); PENDING waits on a routed
-- department review, REJECTED is a dismissed false match.
CREATE TABLE IF NOT EXISTS customer_identity_links (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_a_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  customer_b_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  matched_by TEXT NOT NULL CHECK (matched_by IN ('email','phone')),
  dominant_side TEXT CHECK (dominant_side IN ('B2C','B2B')),
  verdict_note TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CONFIRMED','REJECTED')),
  case_id INTEGER REFERENCES cases(id) ON DELETE SET NULL,
  confirmed_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (now()),
  confirmed_at TEXT,
  UNIQUE (customer_a_id, customer_b_id)
);
CREATE INDEX IF NOT EXISTS customer_identity_links_a ON customer_identity_links(customer_a_id);
CREATE INDEX IF NOT EXISTS customer_identity_links_b ON customer_identity_links(customer_b_id);

-- Rule-based AI insights. Analytic types are regenerated on demand; the
-- transactional stock types are posted inline when a sell-out crosses a threshold.
CREATE TABLE IF NOT EXISTS ai_insights (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  insight_type TEXT NOT NULL CHECK (insight_type IN (
    'CHANNEL_CONFLICT','LOW_SELLOUT_RATE','LOW_SELLIN_STOCK','OUT_OF_STOCK',
    'REORDER_POINT','CONSENT_GAP','LIABILITY_HIGH','CHURN_RISK','DEALER_UNLINKED',
    'CHANNEL_CANNIBALIZATION','RECLASSIFY_SUGGESTION')),
  severity TEXT NOT NULL CHECK (severity IN ('CRITICAL','WARNING','OPPORTUNITY','INFO')),
  entity_type TEXT CHECK (entity_type IN ('customer','distributor','product','global')),
  entity_id INTEGER,
  title TEXT NOT NULL,
  description TEXT,
  recommendation TEXT,
  confidence REAL,
  dismissed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (now())
);
CREATE INDEX IF NOT EXISTS ai_insights_type ON ai_insights(insight_type, entity_type, entity_id);

-- users.home_department_id forward-references departments (declared above but
-- after users in this file) — added as a named constraint post-hoc so table
-- creation order doesn't need to change. Postgres enforces this for real,
-- unlike sql.js which ran with foreign_keys off.
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_home_department_fk,
  ADD CONSTRAINT users_home_department_fk
    FOREIGN KEY (home_department_id) REFERENCES departments(id) ON DELETE SET NULL;

-- Additive migrations for already-provisioned databases. CREATE TABLE IF NOT
-- EXISTS is a silent no-op once a table exists, so columns declared in the
-- table bodies above never reach a live database without these statements.
-- Every one must be idempotent: this whole file runs as a single transaction
-- on cold start, and one failure poisons the cached readiness promise for the
-- entire server instance.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS line_user_id TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS line_linked_at TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS customers_line_user_id ON customers(line_user_id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS brand TEXT;
CREATE INDEX IF NOT EXISTS transactions_brand ON transactions(brand);
ALTER TABLE loyalty_ledger ADD COLUMN IF NOT EXISTS source TEXT;
CREATE INDEX IF NOT EXISTS loyalty_ledger_source ON loyalty_ledger(source);

-- Version 2: reward lifecycle, referrals/birthday, RFM/churn, segments,
-- campaigns, audit log. New tables above are CREATE TABLE IF NOT EXISTS so
-- they need no ALTER here — only columns added to pre-existing tables and
-- CHECK constraints being widened need to run again on an already-live DB.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS birth_date TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS referred_by INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS customers_referral_code ON customers(referral_code);

ALTER TABLE rewards ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'PUBLISHED';
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS starts_at TEXT;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS ends_at TEXT;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS per_member_limit INTEGER;
ALTER TABLE rewards DROP CONSTRAINT IF EXISTS rewards_status_check;
ALTER TABLE rewards ADD CONSTRAINT rewards_status_check
  CHECK (status IN ('DRAFT','PUBLISHED','SUSPENDED'));

-- loyalty_ledger.ref_type gains mission/referral/birthday/expire origins.
ALTER TABLE loyalty_ledger DROP CONSTRAINT IF EXISTS loyalty_ledger_ref_type_check;
ALTER TABLE loyalty_ledger ADD CONSTRAINT loyalty_ledger_ref_type_check
  CHECK (ref_type IN ('transaction','reward','manual','seed','mission','referral','birthday','expire'));

-- department_modules gains the marketing module.
ALTER TABLE department_modules DROP CONSTRAINT IF EXISTS department_modules_module_check;
ALTER TABLE department_modules ADD CONSTRAINT department_modules_module_check
  CHECK (module IN ('customers','loyalty','cases','insights','products','channel','data-cloud','marketing'));

-- Channel classification + anti-cannibalization: behavioral class + channel
-- affinity on the score row, promo intent/cooldown/exclusion on campaigns, and
-- two new insight types.
ALTER TABLE customer_scores ADD COLUMN IF NOT EXISTS behavior_class TEXT;
ALTER TABLE customer_scores ADD COLUMN IF NOT EXISTS primary_channel TEXT;
ALTER TABLE customer_scores ADD COLUMN IF NOT EXISTS channel_affinity TEXT;

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS campaign_type TEXT NOT NULL DEFAULT 'retention';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS cooldown_days INTEGER NOT NULL DEFAULT 30;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS excluded INTEGER NOT NULL DEFAULT 0;
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_campaign_type_check;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_campaign_type_check
  CHECK (campaign_type IN ('acquisition','retention'));

ALTER TABLE ai_insights DROP CONSTRAINT IF EXISTS ai_insights_insight_type_check;
ALTER TABLE ai_insights ADD CONSTRAINT ai_insights_insight_type_check
  CHECK (insight_type IN (
    'CHANNEL_CONFLICT','LOW_SELLOUT_RATE','LOW_SELLIN_STOCK','OUT_OF_STOCK',
    'REORDER_POINT','CONSENT_GAP','LIABILITY_HIGH','CHURN_RISK','DEALER_UNLINKED',
    'CHANNEL_CANNIBALIZATION','RECLASSIFY_SUGGESTION'));

-- Identity-linked classification: department routing for cases + the
-- IDENTITY_REVIEW category. (customer_identity_links is CREATE TABLE IF NOT
-- EXISTS above, so it needs no ALTER here.)
ALTER TABLE cases ADD COLUMN IF NOT EXISTS department_id INTEGER;
ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_department_fk;
ALTER TABLE cases ADD CONSTRAINT cases_department_fk
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS cases_department ON cases(department_id);
-- Widened in place (not a second later ALTER) — CHECK constraints validate
-- immediately when the statement runs, not deferred to transaction end, and
-- this whole file re-runs every cold start. A second DROP/ADD later in the
-- file would transiently re-narrow the constraint back to this list first,
-- failing against any row already carrying a category only the later
-- statement allows. One statement, one canonical list.
ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_category_check;
ALTER TABLE cases ADD CONSTRAINT cases_category_check
  CHECK (category IN ('POINTS','REDEMPTION','PRODUCT','DELIVERY','ACCOUNT','OTHER','IDENTITY_REVIEW','CLASSIFICATION_REVIEW'));

-- Classification v2: identity keys, resolution tiers, and transaction line
-- items. Ordering rule for everything below: a CREATE INDEX may only appear
-- AFTER the ALTER TABLE ADD COLUMN that creates its column. On a live database
-- the CREATE TABLE bodies further up are silent no-ops, so an index placed
-- beside the table definition would reference a column that does not yet
-- exist and abort this entire transaction. scripts/verify-schema.ts enforces
-- this statically -- run it before shipping any schema change.

-- The 13-digit identity number. Only the ciphertext and the last four digits
-- are stored: the plaintext is encrypted in the app (lib/pii.ts) so it never
-- sits readable in a row, and the last four exist purely so staff can confirm
-- they are looking at the right record without decrypting anything.
-- tax_entity_type is derived from the leading digit (lib/thaiId.ts):
-- JURISTIC = a registered company, NATURAL = a private individual.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tax_id_encrypted TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tax_id_last4 TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tax_entity_type TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS identity_verified_at TEXT;
-- Staff-only classification. INSTITUTIONAL (school / hospital / canteen) is
-- indistinguishable from HORECA in transaction data, so it is never inferred.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS institutional_override INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS customers_tax_entity_type ON customers(tax_entity_type);

-- Which tier decided the class, and whether the tiers disagreed. A
-- disagreement is never resolved silently -- the higher tier stands and this
-- flag sends it to a human.
ALTER TABLE customer_scores ADD COLUMN IF NOT EXISTS resolution_tier TEXT;
ALTER TABLE customer_scores ADD COLUMN IF NOT EXISTS disagreement_flag INTEGER NOT NULL DEFAULT 0;
-- Supporting behavioural signals, stored so the UI can show the evidence
-- behind a classification rather than just its verdict.
ALTER TABLE customer_scores ADD COLUMN IF NOT EXISTS weekday_share REAL;
ALTER TABLE customer_scores ADD COLUMN IF NOT EXISTS max_pack_size REAL;
ALTER TABLE customer_scores ADD COLUMN IF NOT EXISTS distinct_skus INTEGER;
-- The evidence trace itself: a JSON array of {code, params} recording which
-- branch of the classifier actually ran, in order. Stored because the numbers
-- that drove the decision are otherwise unrecoverable -- the rfm_* columns are
-- all-time quintile SCORES (1-5), not the windowed amounts the classifier saw.
-- TEXT rather than an array type: db/client.ts binds params as
-- string|number|boolean|null, so an array cannot cross the driver boundary.
-- NULL on every row until the first recompute after this column landed.
ALTER TABLE customer_scores ADD COLUMN IF NOT EXISTS classification_reasons TEXT;
CREATE INDEX IF NOT EXISTS customer_scores_tier ON customer_scores(resolution_tier);

-- IDENTITY_VERIFICATION consent gates storage of an identity number. A
-- national ID is sensitive personal data under PDPA, so it gets its own
-- purpose and is never covered by MARKETING or ANALYTICS consent.
ALTER TABLE consents DROP CONSTRAINT IF EXISTS consents_purpose_check;
ALTER TABLE consents ADD CONSTRAINT consents_purpose_check
  CHECK (purpose IN ('MARKETING','ANALYTICS','PROFILING','IDENTITY_VERIFICATION'));

-- Purchase line items. Without these, "business-sized" can only be guessed
-- from baht value, which cannot separate one premium gift hamper from 20kg of
-- cooking oil. pack_size is the unit format (kg / litres / pieces per pack)
-- and is the strongest single HoReCa signal available.
CREATE TABLE IF NOT EXISTS transaction_items (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL,
  line_total REAL,
  pack_size REAL
);
CREATE INDEX IF NOT EXISTS transaction_items_transaction ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS transaction_items_product ON transaction_items(product_id);

-- Classification review workflow: a customer whose evidence tiers disagreed
-- (customer_scores.disagreement_flag, previously written but never read by
-- anything) now gets a routed, accountable review instead of a silently
-- dismissible insight. Mirrors customer_identity_links: PENDING waits on the
-- routed department, CONFIRMED means staff reviewed it and will act (the
-- actual customers.cust_type edit stays a separate manual step — same as a
-- CONFIRMED identity link doesn't merge customer rows), REJECTED dismisses a
-- false positive without erasing the record.
CREATE TABLE IF NOT EXISTS customer_classification_reviews (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  cust_type TEXT NOT NULL,
  behavior_class TEXT NOT NULL,
  resolution_tier TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CONFIRMED','REJECTED')),
  case_id INTEGER REFERENCES cases(id) ON DELETE SET NULL,
  confirmed_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (now()),
  confirmed_at TEXT
);
CREATE INDEX IF NOT EXISTS classification_reviews_customer ON customer_classification_reviews(customer_id);
CREATE INDEX IF NOT EXISTS classification_reviews_status ON customer_classification_reviews(status);
-- Partial unique index: blocks a second PENDING review for the same customer
-- (the scan's dedup target, via ON CONFLICT) while still allowing a fresh
-- review to open later once a prior one is CONFIRMED/REJECTED and the
-- disagreement recurs — unlike identity links, this signal can flip back on.
CREATE UNIQUE INDEX IF NOT EXISTS classification_reviews_open_customer
  ON customer_classification_reviews(customer_id) WHERE status = 'PENDING';
`;
