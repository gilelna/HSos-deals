-- ================================================================
-- HSos — PRODUCTION_SETUP.sql
-- Complete consolidated schema for a fresh production database.
-- Date: 2026-04-12
--
-- Run this ONCE on a new Supabase project (SQL Editor).
-- No seed data, no RLS policies (configure separately).
-- Order: extensions → enums → tables (dependency order) →
--        generated columns / triggers → indexes → RPCs.
--
-- POST-SETUP checklist:
--   [ ] Verify all tables created: Database → Tables
--   [ ] Enable RLS on all tables and add anon read/write policies
--       (or use authenticated-only policies for production)
--   [ ] Populate registry tables: companies, accounts, exchange_rates
--       system_settings (keys: default_currency, default_company_id,
--       default_account_id)
--   [ ] Import vendor, client, and deal data
--   [ ] Run: notify pgrst, 'reload schema';
--   [ ] Test DB connectivity from env-toggle (production env)
-- ================================================================

BEGIN;

-- ================================================================
-- 1. EXTENSIONS
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- 2. ENUMS
-- ================================================================

CREATE TYPE sales_status AS ENUM (
  'lead', 'qualified', 'active', 'delivered', 'closed'
);

CREATE TYPE billing_status AS ENUM (
  'pending', 'link_sent', 'invoiced', 'partial', 'paid', 'overdue'
);

CREATE TYPE session_status AS ENUM (
  'planned', 'done', 'cancelled', 'no_show'
);

CREATE TYPE session_type AS ENUM (
  'coaching', 'consulting', 'editing', 'design', 'admin', 'other'
);

CREATE TYPE product_type AS ENUM (
  'session', 'package', 'workshop', 'custom'
);

CREATE TYPE vendor_type AS ENUM (
  'coach', 'contractor', 'team_member'
);

CREATE TYPE system_role AS ENUM (
  'admin', 'manager', 'finance', 'vendor'
);

CREATE TYPE payment_processor AS ENUM (
  'stripe', 'wise', 'thrive', 'other'
);

CREATE TYPE vat_mode AS ENUM (
  'excl', 'incl'
);

CREATE TYPE origin AS ENUM (
  'manual', 'thrivecart', 'green_invoice', 'other'
);

-- ================================================================
-- 3. SHARED TRIGGER FUNCTION
-- ================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ================================================================
-- 4. CORE TABLES
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- profiles — system users (auth.users FK; not needed in demo mode)
-- ────────────────────────────────────────────────────────────────

CREATE TABLE profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  system_role system_role,
  nickname    text,
  full_name   text,
  vendor_id   uuid,          -- FK added below after vendors created
  created_at  timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- clients — operational clients (not the same as paying customers)
-- ────────────────────────────────────────────────────────────────

CREATE TABLE clients (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id   text,           -- legacy external ref (AC, TC, etc.)
  customer_id_fk uuid,          -- FK to customers table (added below)
  full_name     text NOT NULL,
  email         text,
  phone         text,
  client_kind   text,           -- 'private' | 'corporate'
  company       text,
  source        text,
  notes         text,
  active        boolean DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

COMMENT ON COLUMN clients.customer_id IS 'Legacy external reference (ActiveCampaign, ThriveCart, etc.)';
COMMENT ON COLUMN clients.client_kind IS 'private | corporate';

-- ────────────────────────────────────────────────────────────────
-- vendors — service providers and team members
-- id is TEXT (not uuid) — generated as 'vnd_<slug>'
-- Generated columns: full_name (alias for name), active (alias for is_active)
-- ────────────────────────────────────────────────────────────────

CREATE TABLE vendors (
  id                 text PRIMARY KEY,
  name               text NOT NULL,
  full_name          text GENERATED ALWAYS AS (name) STORED,
  nickname           text,
  email              text,
  phone              text,
  vendor_type        vendor_type,
  is_active          boolean DEFAULT true,
  active             boolean GENERATED ALWAYS AS (is_active) STORED,
  payment_method     text,           -- 'iban' | 'paypal' | 'wise' | 'other'
  payment_id         text,
  iban               text,
  preferred_currency text DEFAULT 'EUR',
  contract_url       text,
  notes              text,
  -- classification fields (used by Payments / Vendor Manager)
  category_id        text,           -- FK to transaction_categories (added below)
  tax_treatment      text,
  entity             text,           -- which company entity applies: com_us | com_il | com_es
  tags               text[],
  aliases            text[],         -- merchant name variants for auto-matching
  created_at         timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- programs — top-level product groupings
-- ────────────────────────────────────────────────────────────────

CREATE TABLE programs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  slug             text UNIQUE,
  description      text,
  logo_url         text,
  audience_segment text,
  active           boolean DEFAULT true,
  created_at       timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- products — commercial items (new uuid-PK generation)
-- active is a generated column from status
-- ────────────────────────────────────────────────────────────────

CREATE TABLE products (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id        uuid REFERENCES programs(id),
  name              text NOT NULL,
  description       text,
  sessions_included integer,
  vendor_type       text,
  base_price        numeric,
  base_currency     text DEFAULT 'USD',
  status            text DEFAULT 'active',
  active            boolean GENERATED ALWAYS AS (status = 'active') STORED,
  has_plans         boolean NOT NULL DEFAULT false,  -- true = pricing in product_plans
  type              product_type,
  currency          text DEFAULT 'EUR',
  units             text,
  payment_links     jsonb,
  created_at        timestamptz DEFAULT now()
);

COMMENT ON COLUMN products.has_plans IS 'When true, pricing is defined in product_plans rather than base_price';

-- ────────────────────────────────────────────────────────────────
-- plans — pricing variants per product
-- ────────────────────────────────────────────────────────────────

CREATE TABLE plans (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          uuid REFERENCES products(id),
  name                text NOT NULL,
  payment_type        text CHECK (payment_type IN ('one_time','installment','subscription','manual')),
  installments_count  integer,
  amount              numeric,
  currency            text DEFAULT 'USD',
  payment_rail        text CHECK (payment_rail IN ('thrivecart','green_invoice','wise','bank_transfer','manual')),
  payment_link_url    text,
  external_id         text,          -- ThriveCart item_id or equivalent
  active              boolean DEFAULT true,
  created_at          timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- product_plans — multi-gateway pricing variants (from add-product-plans migration)
-- ────────────────────────────────────────────────────────────────

CREATE TABLE product_plans (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id                    uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  plan_name                     text NOT NULL,
  plan_code                     text,
  target_customer_country       text,
  target_currency               text,
  price                         numeric NOT NULL,
  currency                      text NOT NULL DEFAULT 'EUR',
  installments                  int NOT NULL DEFAULT 1,
  collection_gateway            text NOT NULL
    CHECK (collection_gateway IN ('green_invoice','thrivecart','wise','stripe')),
  collection_gateway_product_id text,
  collection_gateway_link       text,
  vendor_id                     text REFERENCES vendors(id),
  vendor_payout_currency        text CHECK (vendor_payout_currency IN ('ILS','USD','EUR')),
  is_default                    boolean NOT NULL DEFAULT false,
  active                        boolean NOT NULL DEFAULT true,
  priority                      int NOT NULL DEFAULT 0,
  created_at                    timestamptz DEFAULT now(),
  updated_at                    timestamptz DEFAULT now()
);

COMMENT ON TABLE product_plans IS 'Pricing variants per product — different gateways, currencies, countries, installment options';

CREATE TRIGGER trg_product_plans_updated_at
  BEFORE UPDATE ON product_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ────────────────────────────────────────────────────────────────
-- customers — paying customers (distinct from operational clients)
-- ────────────────────────────────────────────────────────────────

CREATE TABLE customers (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                     text UNIQUE NOT NULL,
  full_name                 text NOT NULL,
  phone                     text,
  country                   text,
  thrivecart_customer_id    text,
  green_invoice_client_id   text,
  lifetime_value            numeric NOT NULL DEFAULT 0,
  first_purchase_date       timestamptz,
  last_purchase_date        timestamptz,
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);

COMMENT ON TABLE customers IS 'Paying customers — linked to external payment gateways. Separate from clients (who receive the service).';

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Add FK from clients to customers
ALTER TABLE clients ADD CONSTRAINT fk_clients_customer
  FOREIGN KEY (customer_id_fk) REFERENCES customers(id);

-- ────────────────────────────────────────────────────────────────
-- rates — per-vendor hourly rates by session type
-- ────────────────────────────────────────────────────────────────

CREATE TABLE rates (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id      text NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  session_type   session_type NOT NULL,
  rate           numeric(10,2) NOT NULL,
  currency       text DEFAULT 'EUR',
  effective_date date,
  notes          text,
  created_at     timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- vendor_clients — legacy junction (vendors ↔ clients)
-- ────────────────────────────────────────────────────────────────

CREATE TABLE vendor_clients (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id  text NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  client_id  uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(vendor_id, client_id)
);

-- ────────────────────────────────────────────────────────────────
-- vendor_client_assignments — time-bound vendor↔client assignments
-- vendor_id is stored as text (matches vendors.id) — no FK due to type
-- ────────────────────────────────────────────────────────────────

CREATE TABLE vendor_client_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   text NOT NULL,            -- references vendors(id) — no FK (text/uuid type history)
  client_id   uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  valid_from  date,
  valid_to    date,
  changed_by  text,
  reason      text,
  created_at  timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- task_types — vendor work categories with optional rates
-- ────────────────────────────────────────────────────────────────

CREATE TABLE task_types (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  vendor_id   text,                 -- NULL = global; set = vendor-specific override
  rate_usd    numeric(10,2),
  active      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- deals ★ CENTRAL TABLE — sales pipeline
-- ────────────────────────────────────────────────────────────────

CREATE TABLE deals (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id           uuid REFERENCES clients(id),
  primary_vendor_id   text REFERENCES vendors(id),
  owner_vendor_id     text REFERENCES vendors(id),
  product_id          uuid REFERENCES products(id),
  product_plan_id     uuid REFERENCES product_plans(id),
  plan_id             uuid REFERENCES plans(id),
  price               numeric(10,2),
  currency            text DEFAULT 'EUR',
  agreed_price        numeric,
  agreed_currency     text,
  vat_pct             numeric(5,2) DEFAULT 0,
  vat_mode            vat_mode DEFAULT 'excl',
  discount            text,
  sales_status        sales_status DEFAULT 'lead',
  billing_status      billing_status DEFAULT 'pending',
  billing_type        text,
  payment_processor   payment_processor,
  payment_method      text,
  payment_link        text,
  payment_gateway_id  text,
  payment_status      text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending','initiated','partial','paid','refunded','failed')),
  paid_at             timestamptz,
  paid_amount         numeric,
  paid_currency       text,
  origin              origin DEFAULT 'manual',
  external_id         text,
  gi_client_id        text,
  gi_invoice_series   text,
  stripe_customer_id  text,
  stripe_payment_link text,
  wise_iban           text,
  wise_bank_ref       text,
  thrive_ref          text,
  notes               text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ────────────────────────────────────────────────────────────────
-- packages — session bundles per client/vendor
-- ────────────────────────────────────────────────────────────────

CREATE TABLE packages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id        uuid REFERENCES deals(id),
  client_id      uuid REFERENCES clients(id),
  vendor_id      text,              -- references vendors(id) — no FK (type history)
  product_id     uuid REFERENCES products(id),
  total_sessions integer,
  sessions_total integer,           -- alias column used in some queries
  sessions_used  integer DEFAULT 0,
  status         text DEFAULT 'active',
  notes          text,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- sessions — service delivery events
-- ────────────────────────────────────────────────────────────────

CREATE TABLE sessions (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id        uuid REFERENCES deals(id) ON DELETE CASCADE,
  vendor_id      text,              -- references vendors(id) — no FK (type history)
  client_id      uuid REFERENCES clients(id),
  package_id     uuid REFERENCES packages(id),
  task_type_id   uuid REFERENCES task_types(id),
  bill_id        uuid,              -- FK to bills added below
  session_date   date,
  start_time     time,
  duration_min   integer DEFAULT 60,
  session_type   session_type,
  status         session_status DEFAULT 'planned',
  billed         boolean DEFAULT false,
  notes          text,
  created_at     timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- bills — vendor payout invoices (vendor-submitted)
-- Status flow: draft → submitted → approved → paid
--           or: draft → submitted → returned → draft
-- ────────────────────────────────────────────────────────────────

CREATE TABLE bills (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id     text NOT NULL REFERENCES vendors(id),
  status        text DEFAULT 'draft',
  total_amount  numeric(10,2),
  currency      text DEFAULT 'EUR',
  vendor_notes  text,
  admin_notes   text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TRIGGER trg_bills_updated_at
  BEFORE UPDATE ON bills
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Add bill FK to sessions
ALTER TABLE sessions ADD CONSTRAINT fk_sessions_bill
  FOREIGN KEY (bill_id) REFERENCES bills(id);

-- ────────────────────────────────────────────────────────────────
-- vendor_hours — time logs for payout calculation
-- ────────────────────────────────────────────────────────────────

CREATE TABLE vendor_hours (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id    text NOT NULL REFERENCES vendors(id),
  deal_id      uuid REFERENCES deals(id),
  session_id   uuid REFERENCES sessions(id),
  date         date NOT NULL,
  hours        numeric(4,2) NOT NULL,
  session_type session_type,
  rate         numeric(10,2),
  notes        text,
  synced       boolean DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- paychecks — monthly vendor payout records
-- ────────────────────────────────────────────────────────────────

CREATE TABLE paychecks (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id    text NOT NULL REFERENCES vendors(id),
  month        text NOT NULL,          -- format: YYYY-MM
  total_hours  numeric(6,2),
  amount       numeric(10,2),
  currency     text DEFAULT 'EUR',
  status       text DEFAULT 'draft',   -- draft | ready | pending | paid
  payment_date date,
  notes        text,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(vendor_id, month)
);

-- ────────────────────────────────────────────────────────────────
-- payments — unified payment records (legacy)
-- ────────────────────────────────────────────────────────────────

CREATE TABLE payments (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id      uuid REFERENCES deals(id),
  client_id    uuid REFERENCES clients(id),
  vendor_id    text REFERENCES vendors(id),
  type         text,        -- 'incoming' | 'payout' | 'expense'
  direction    text,        -- 'in' | 'out'
  amount       numeric(10,2) NOT NULL,
  currency     text DEFAULT 'EUR',
  payment_date date,
  method       text,
  reference    text,
  status       text,
  tax_kind     text,        -- 'vat' | 'withholding' | 'fee' | 'other'
  notes        text,
  created_at   timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- invoices — invoice records linked to deals
-- ────────────────────────────────────────────────────────────────

CREATE TABLE invoices (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id      uuid REFERENCES deals(id),
  external_ref text,
  issue_date   date,
  amount       numeric(10,2),
  currency     text DEFAULT 'EUR',
  status       text,
  notes        text,
  created_at   timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- deal_documents — files and URLs attached to deals
-- ────────────────────────────────────────────────────────────────

CREATE TABLE deal_documents (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id      uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  name         text,
  type         text,        -- 'invoice' | 'agreement' | 'receipt' | 'other'
  url          text,
  storage_path text,
  size_kb      integer,
  created_at   timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- documents — standalone document storage (not deal-specific)
-- ────────────────────────────────────────────────────────────────

CREATE TABLE documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  text,
  entity_id    uuid,
  name         text,
  type         text,
  url          text,
  storage_path text,
  size_kb      integer,
  created_at   timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- deal_reminders — follow-up reminders per deal
-- ────────────────────────────────────────────────────────────────

CREATE TABLE deal_reminders (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id    uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  text       text NOT NULL,
  done       boolean DEFAULT false,
  due_date   date,
  created_at timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- Add FK from profiles to vendors (deferred — vendors exists now)
-- ────────────────────────────────────────────────────────────────

ALTER TABLE profiles ADD CONSTRAINT fk_profiles_vendor
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL;

-- ================================================================
-- 5. REGISTRY TABLES
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- companies — three legal entities
-- id is text (e.g. 'com_us', 'com_il', 'com_es')
-- ────────────────────────────────────────────────────────────────

CREATE TABLE companies (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  currency    text,           -- 'USD' | 'ILS' | 'EUR'
  entity_type text,           -- 'llc' | 'ltd' | 'autonomo' | 'other'
  status      text DEFAULT 'active',
  notes       text,
  created_at  timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- accounts — bank / payment processor accounts
-- id is text (e.g. 'acc_mizrachi_il')
-- ────────────────────────────────────────────────────────────────

CREATE TABLE accounts (
  id           text PRIMARY KEY,
  company_id   text REFERENCES companies(id),
  name         text NOT NULL,
  provider     text,           -- 'bank' | 'wise' | 'stripe' | etc.
  account_type text,           -- 'bank' | 'card' | 'processor' | 'wallet' | 'other'
  currency     text,
  is_active    boolean DEFAULT true,
  created_at   timestamptz DEFAULT now()
);

-- Add category_id FK to vendors (after transaction_categories created below)
-- (deferred — see end of section 6)

-- ────────────────────────────────────────────────────────────────
-- exchange_rates — monthly FX rates
-- id is text (e.g. 'er_2026_01_ils_usd')
-- ────────────────────────────────────────────────────────────────

CREATE TABLE exchange_rates (
  id            text PRIMARY KEY,
  month         text NOT NULL,         -- format: YYYY-MM
  from_currency text NOT NULL,
  to_currency   text NOT NULL DEFAULT 'USD',
  rate          numeric(12,6) NOT NULL,
  source        text DEFAULT 'manual', -- 'manual' | 'wise'
  notes         text,
  created_at    timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- account_balances — opening balances per account per period
-- ────────────────────────────────────────────────────────────────

CREATE TABLE account_balances (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid,              -- uuid accounts use uuid; text accounts use text (see below)
  date       date NOT NULL,
  balance    numeric(14,2),
  currency   text,
  notes      text,
  created_at timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- system_settings — key/value config for the app
-- ────────────────────────────────────────────────────────────────

CREATE TABLE system_settings (
  key         text PRIMARY KEY,
  value       text,
  label       text,
  description text,
  updated_at  timestamptz DEFAULT now()
);

-- Default settings rows (modify values after setup)
INSERT INTO system_settings (key, label, description) VALUES
  ('default_currency',   'Default Currency',   'Currency used when no other is specified'),
  ('default_company_id', 'Default Company',    'Company entity used as default for new transactions'),
  ('default_account_id', 'Default Account',    'Account used as default for new transactions');

-- ================================================================
-- 6. PAYMENT / TRANSACTION TABLES
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- transaction_categories — taxonomy for classifying transactions
-- id is text (e.g. 'ca_software', 'ca_payroll')
-- ────────────────────────────────────────────────────────────────

CREATE TABLE transaction_categories (
  id             text PRIMARY KEY,
  name           text NOT NULL,
  tax_category   text,
  match_patterns text,       -- comma-separated merchant name patterns for auto-classification
  status         text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  notes          text,
  created_at     timestamptz DEFAULT now()
);

-- Add category_id FK to vendors (now that transaction_categories exists)
ALTER TABLE vendors ADD CONSTRAINT fk_vendors_category
  FOREIGN KEY (category_id) REFERENCES transaction_categories(id);

-- ────────────────────────────────────────────────────────────────
-- transaction_tags — tag pool for transactions and vendors
-- id is text (e.g. 'tag_software', 'tag_travel')
-- ────────────────────────────────────────────────────────────────

CREATE TABLE transaction_tags (
  id         text PRIMARY KEY,
  name       text NOT NULL,
  status     text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- transactions — imported financial transactions
-- ────────────────────────────────────────────────────────────────

CREATE TABLE transactions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source & direction
  source               text CHECK (source IN ('thrivecart','green_invoice','wise','bank','manual')),
  direction            text CHECK (direction IN ('in','out')),
  external_id          text,
  status               text DEFAULT 'unmatched' CHECK (status IN ('unmatched','matched','reconciled')),

  -- Amounts
  amount               numeric,
  currency             text,
  exchange_rate        numeric,
  amount_ils           numeric,

  -- Counterparty
  counterparty_name    text,
  counterparty_account text,
  reference            text,

  -- Event type
  event_type           text,

  -- Dates
  transaction_date     date,
  settled_date         date,

  -- Installment tracking
  installment_index    integer,

  -- Entity linkage
  linked_entity_type   text CHECK (linked_entity_type IN ('deal','paycheck','expense')),
  linked_entity_id     uuid,

  -- Plan linkage
  plan_id              uuid REFERENCES plans(id),

  -- Classification
  category_id          text REFERENCES transaction_categories(id),
  tax_treatment        text,
  entity               text,           -- 'com_us' | 'com_il' | 'com_es'
  tags                 text[],

  -- Raw payload
  raw_data             jsonb,

  created_at           timestamptz DEFAULT now()
);

-- ================================================================
-- 7. IMPORT TABLE
-- ================================================================

CREATE TABLE import_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type    text NOT NULL,
  table_name     text NOT NULL,
  batch_id       uuid NOT NULL,
  rows_total     int,
  rows_imported  int,
  rows_skipped   int,
  rows_failed    int,
  column_mapping jsonb,     -- snapshot: { "CSV Header": "db_column", ... }
  imported_by    text DEFAULT 'demo',
  created_at     timestamptz DEFAULT now()
);

-- ================================================================
-- 8. INDEXES
-- ================================================================

-- clients
CREATE INDEX idx_clients_full_name   ON clients(full_name);
CREATE INDEX idx_clients_email       ON clients(email);
CREATE INDEX idx_clients_active      ON clients(active);

-- vendors
CREATE INDEX idx_vendors_name        ON vendors(name);
CREATE INDEX idx_vendors_type        ON vendors(vendor_type);
CREATE INDEX idx_vendors_active      ON vendors(is_active);

-- programs / products / plans
CREATE INDEX idx_products_program_id ON products(program_id);
CREATE INDEX idx_products_name       ON products(name);
CREATE INDEX idx_products_active     ON products(active);
CREATE INDEX idx_plans_product_id    ON plans(product_id);
CREATE INDEX idx_plans_external_id   ON plans(external_id);
CREATE INDEX idx_product_plans_product_id      ON product_plans(product_id);
CREATE INDEX idx_product_plans_target_country  ON product_plans(target_customer_country);

-- customers
CREATE INDEX idx_customers_email           ON customers(email);
CREATE INDEX idx_customers_thrivecart_id   ON customers(thrivecart_customer_id);

-- rates
CREATE INDEX idx_rates_vendor      ON rates(vendor_id);
CREATE INDEX idx_rates_vendor_type ON rates(vendor_id, session_type);

-- vendor_clients / assignments
CREATE INDEX idx_vendor_clients_vendor      ON vendor_clients(vendor_id);
CREATE INDEX idx_vendor_clients_client      ON vendor_clients(client_id);
CREATE INDEX idx_vca_vendor                 ON vendor_client_assignments(vendor_id);
CREATE INDEX idx_vca_client                 ON vendor_client_assignments(client_id);

-- task_types
CREATE INDEX idx_task_types_active          ON task_types(active);

-- deals
CREATE INDEX idx_deals_client               ON deals(client_id);
CREATE INDEX idx_deals_primary_vendor       ON deals(primary_vendor_id);
CREATE INDEX idx_deals_sales_status         ON deals(sales_status);
CREATE INDEX idx_deals_billing_status       ON deals(billing_status);
CREATE INDEX idx_deals_payment_status       ON deals(payment_status);
CREATE INDEX idx_deals_product_plan_id      ON deals(product_plan_id);
CREATE INDEX idx_deals_created              ON deals(created_at DESC);

-- packages
CREATE INDEX idx_packages_client            ON packages(client_id);
CREATE INDEX idx_packages_vendor            ON packages(vendor_id);
CREATE INDEX idx_packages_status            ON packages(status);

-- sessions
CREATE INDEX idx_sessions_deal              ON sessions(deal_id);
CREATE INDEX idx_sessions_vendor            ON sessions(vendor_id);
CREATE INDEX idx_sessions_client            ON sessions(client_id);
CREATE INDEX idx_sessions_date              ON sessions(session_date DESC);
CREATE INDEX idx_sessions_status            ON sessions(status);
CREATE INDEX idx_sessions_bill              ON sessions(bill_id);

-- bills
CREATE INDEX idx_bills_vendor               ON bills(vendor_id);
CREATE INDEX idx_bills_status               ON bills(status);

-- vendor_hours / paychecks
CREATE INDEX idx_vendor_hours_vendor        ON vendor_hours(vendor_id);
CREATE INDEX idx_vendor_hours_date          ON vendor_hours(date DESC);
CREATE INDEX idx_paychecks_vendor           ON paychecks(vendor_id);
CREATE INDEX idx_paychecks_month            ON paychecks(month DESC);
CREATE INDEX idx_paychecks_status           ON paychecks(status);

-- payments / invoices
CREATE INDEX idx_payments_deal              ON payments(deal_id);
CREATE INDEX idx_payments_date              ON payments(payment_date DESC);
CREATE INDEX idx_invoices_deal              ON invoices(deal_id);

-- deal_documents / deal_reminders
CREATE INDEX idx_deal_documents_deal        ON deal_documents(deal_id);
CREATE INDEX idx_deal_reminders_deal        ON deal_reminders(deal_id);

-- transactions
CREATE INDEX idx_transactions_source_external_id ON transactions(source, external_id);
CREATE INDEX idx_transactions_status             ON transactions(status);
CREATE INDEX idx_transactions_plan_id            ON transactions(plan_id);
CREATE INDEX idx_transactions_linked_entity      ON transactions(linked_entity_type, linked_entity_id);
CREATE INDEX idx_transactions_category           ON transactions(category_id);

-- transaction_tags
CREATE UNIQUE INDEX idx_transaction_tags_name_unique ON transaction_tags(lower(name));

-- accounts / exchange_rates
CREATE INDEX idx_accounts_company           ON accounts(company_id);
CREATE INDEX idx_exchange_rates_month       ON exchange_rates(month DESC);

-- ================================================================
-- 9. RPC HELPERS
-- ================================================================

-- get_table_columns — used by import adapter to read column metadata
CREATE OR REPLACE FUNCTION get_table_columns(p_table text)
RETURNS TABLE (
  column_name    text,
  data_type      text,
  is_nullable    text,
  column_default text
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    column_name::text,
    data_type::text,
    is_nullable::text,
    column_default::text
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = p_table
  ORDER BY ordinal_position;
$$;

-- ================================================================
-- 10. RELOAD PGRST SCHEMA CACHE
-- ================================================================

NOTIFY pgrst, 'reload schema';

-- ================================================================
-- COMMIT
-- ================================================================

COMMIT;

-- ================================================================
-- POST-SETUP CHECKLIST
-- ================================================================
-- After running this script:
--
--   [ ] Verify in Supabase Dashboard → Table Editor that all tables
--       appear: clients, vendors, deals, sessions, bills, packages,
--       task_types, products, plans, product_plans, programs,
--       customers, rates, vendor_clients, vendor_client_assignments,
--       vendor_hours, paychecks, payments, invoices, deal_documents,
--       deal_reminders, documents, companies, accounts, exchange_rates,
--       account_balances, system_settings, transaction_categories,
--       transaction_tags, transactions, import_logs
--
--   [ ] Enable RLS on all tables in Dashboard → Table Editor → RLS
--
--   [ ] Add anon policies (for demo mode) or service-role policies:
--         CREATE POLICY "anon_all" ON <table> FOR ALL USING (true);
--       Repeat for each table, or use a loop in SQL.
--
--   [ ] Populate companies (com_us, com_il, com_es), accounts,
--       and exchange_rates via the Registry tab in payments.html
--
--   [ ] Update system_settings values (default_currency, etc.)
--
--   [ ] Import vendors, clients, deals from demo DB if needed
--
--   [ ] Confirm env-toggle shows "Production" and queries succeed
--
--   [ ] Run: NOTIFY pgrst, 'reload schema'; if PostgREST errors appear
-- ================================================================
