-- ================================================================
-- HSos Database Schema
-- Synced from DEMO database: pqkzffgpkpovternesmt
-- Last sync: 2026-04-12
--
-- Purpose: Internal operations system for service business
-- Modules: Sales, Operations, Payments, Workload, Finance
--
-- Run this script in Supabase SQL Editor to recreate full schema
-- (drops all existing tables/types first — data will be lost)
-- ================================================================

BEGIN;

-- ================================================================
-- 0. EXTENSIONS
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================================
-- 1. DROP EXISTING (reverse dependency order)
-- ================================================================

DROP TABLE IF EXISTS transaction_tags CASCADE;
DROP TABLE IF EXISTS transaction_imports CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS classification_rules CASCADE;
DROP TABLE IF EXISTS fee_rules CASCADE;
DROP TABLE IF EXISTS transaction_categories CASCADE;
DROP TABLE IF EXISTS account_balances CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS import_logs CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS vendor_client_assignments CASCADE;
DROP TABLE IF EXISTS product_plans CASCADE;
DROP TABLE IF EXISTS plans CASCADE;
DROP TABLE IF EXISTS programs CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS packages CASCADE;
DROP TABLE IF EXISTS bills CASCADE;
DROP TABLE IF EXISTS task_types CASCADE;
DROP TABLE IF EXISTS exchange_rates CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS deal_reminders CASCADE;
DROP TABLE IF EXISTS deal_documents CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS paychecks CASCADE;
DROP TABLE IF EXISTS vendor_hours CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS deals CASCADE;
DROP TABLE IF EXISTS vendor_clients CASCADE;
DROP TABLE IF EXISTS rates CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS vendors CASCADE;

DROP TYPE IF EXISTS account_status CASCADE;
DROP TYPE IF EXISTS account_type CASCADE;
DROP TYPE IF EXISTS billing_status CASCADE;
DROP TYPE IF EXISTS currency_code CASCADE;
DROP TYPE IF EXISTS deal_origin CASCADE;
DROP TYPE IF EXISTS document_entity_type CASCADE;
DROP TYPE IF EXISTS document_type CASCADE;
DROP TYPE IF EXISTS exchange_rate_source CASCADE;
DROP TYPE IF EXISTS package_status CASCADE;
DROP TYPE IF EXISTS payment_processor CASCADE;
DROP TYPE IF EXISTS payout_currency CASCADE;
DROP TYPE IF EXISTS product_type CASCADE;
DROP TYPE IF EXISTS sales_status CASCADE;
DROP TYPE IF EXISTS session_status CASCADE;
DROP TYPE IF EXISTS session_type CASCADE;
DROP TYPE IF EXISTS system_role CASCADE;
DROP TYPE IF EXISTS vat_mode CASCADE;
DROP TYPE IF EXISTS vendor_type CASCADE;

-- ================================================================
-- 2. ENUMS
-- ================================================================

CREATE TYPE account_status AS ENUM ('active', 'inactive', 'closed');
CREATE TYPE account_type AS ENUM ('bank', 'card', 'paypal', 'stripe', 'wise', 'other');
CREATE TYPE billing_status AS ENUM ('pending', 'invoiced', 'partial', 'paid', 'overdue');
CREATE TYPE currency_code AS ENUM ('USD', 'EUR', 'ILS', 'GBP');
CREATE TYPE deal_origin AS ENUM ('manual', 'thrivecart', 'stripe', 'other');
CREATE TYPE document_entity_type AS ENUM ('deal', 'client', 'vendor');
CREATE TYPE document_type AS ENUM ('upload', 'url');
CREATE TYPE exchange_rate_source AS ENUM ('manual', 'wise');
CREATE TYPE package_status AS ENUM ('active', 'completed', 'cancelled');
CREATE TYPE payment_processor AS ENUM ('stripe', 'wise', 'thrive', 'other');
CREATE TYPE payout_currency AS ENUM ('usd', 'ils', 'eur');
CREATE TYPE product_type AS ENUM ('session', 'package', 'workshop', 'custom');
CREATE TYPE sales_status AS ENUM ('lead', 'qualified', 'active', 'delivered', 'closed');
CREATE TYPE session_status AS ENUM ('planned', 'done', 'cancelled', 'no_show');
CREATE TYPE session_type AS ENUM ('coaching', 'consulting', 'editing', 'design', 'admin', 'other');
CREATE TYPE system_role AS ENUM ('admin', 'manager', 'finance', 'vendor');
CREATE TYPE vat_mode AS ENUM ('excl', 'incl');
CREATE TYPE vendor_type AS ENUM ('coach', 'contractor', 'team_member', 'subscription', 'software_saas');

-- ================================================================
-- 3. FUNCTIONS
-- ================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_public_tables()
RETURNS TABLE(table_name text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT table_name::text
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
  ORDER BY table_name;
$$;

CREATE OR REPLACE FUNCTION get_table_columns(p_table text)
RETURNS TABLE(column_name text, data_type text, is_nullable text, column_default text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    column_name::text,
    data_type::text,
    is_nullable::text,
    column_default::text
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = p_table
  ORDER BY ordinal_position;
$$;

-- ================================================================
-- 4. TABLES
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- profiles
-- ────────────────────────────────────────────────────────────────
CREATE TABLE profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  system_role  system_role,
  nickname     text,
  full_name    text,
  vendor_id    uuid,
  created_at   timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- clients
-- ────────────────────────────────────────────────────────────────
CREATE TABLE clients (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id      text,
  full_name        text NOT NULL,
  email            text,
  phone            text,
  client_kind      text,    -- private | corporate
  company          text,
  source           text,
  notes            text,
  active           boolean DEFAULT true,
  created_at       timestamptz DEFAULT now(),
  customer_id_fk   uuid      -- Links to customers table for billing/payment tracking
);

COMMENT ON TABLE clients IS 'Operational clients - links to external customer systems via customer_id';
COMMENT ON COLUMN clients.customer_id IS 'External reference to ActiveCampaign, ThriveCart, etc.';
COMMENT ON COLUMN clients.client_kind IS 'private | corporate';

CREATE INDEX idx_clients_full_name ON clients(full_name);
CREATE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_clients_active ON clients(active);

-- ────────────────────────────────────────────────────────────────
-- vendors (expense/SaaS vendor + service vendor, unified table)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE vendors (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  vendor_type      text NOT NULL,
  -- vendor_type values: coach | contractor | team_member | subscription | software_saas | merchant
  -- 'merchant' = lightweight classification-only vendor, no rates/bills/sessions
  category_id      text,
  tax_treatment    text,
  cadence          text,
  entity           text,
  merge_name       text,
  match_patterns   text[],
  tags             text[],
  payout_currency  text,
  company_id       text,
  is_active        boolean NOT NULL DEFAULT true,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  full_name        text,
  active           boolean,
  email            text
);

CREATE INDEX idx_vendors_type ON vendors(vendor_type);
CREATE INDEX IF NOT EXISTS idx_vendors_merchant ON vendors(vendor_type) WHERE vendor_type = 'merchant';

-- ────────────────────────────────────────────────────────────────
-- rates
-- ────────────────────────────────────────────────────────────────
CREATE TABLE rates (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id      uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name           text,
  session_type   session_type NOT NULL,
  rate           numeric(10,2) NOT NULL,
  currency       text DEFAULT 'EUR',
  effective_date date,
  notes          text,
  created_at     timestamptz DEFAULT now()
);

COMMENT ON TABLE rates IS 'Vendor hourly rates by session type - for payout calculations';

CREATE INDEX idx_rates_vendor ON rates(vendor_id);
CREATE INDEX idx_rates_vendor_type ON rates(vendor_id, session_type);

-- ────────────────────────────────────────────────────────────────
-- vendor_clients (junction)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE vendor_clients (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id  uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  client_id  uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(vendor_id, client_id)
);

COMMENT ON TABLE vendor_clients IS 'Junction table - which vendors work with which clients';

CREATE INDEX idx_vendor_clients_vendor ON vendor_clients(vendor_id);
CREATE INDEX idx_vendor_clients_client ON vendor_clients(client_id);

-- ────────────────────────────────────────────────────────────────
-- customers
-- ────────────────────────────────────────────────────────────────
CREATE TABLE customers (
  id                        uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email                     text NOT NULL UNIQUE,
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

CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_thrivecart_id ON customers(thrivecart_customer_id);

CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ────────────────────────────────────────────────────────────────
-- programs
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
-- products
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
  active            boolean DEFAULT true,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX products_program_id_idx ON products(program_id);

-- ────────────────────────────────────────────────────────────────
-- plans
-- ────────────────────────────────────────────────────────────────
CREATE TABLE plans (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id         uuid REFERENCES products(id),
  name               text NOT NULL,
  payment_type       text,
  installments_count integer,
  amount             numeric,
  currency           text DEFAULT 'USD',
  payment_rail       text,
  payment_link_url   text,
  external_id        text,
  active             boolean DEFAULT true,
  created_at         timestamptz DEFAULT now()
);

CREATE INDEX plans_product_id_idx ON plans(product_id);
CREATE INDEX plans_external_id_idx ON plans(external_id);

-- ────────────────────────────────────────────────────────────────
-- product_plans
-- ────────────────────────────────────────────────────────────────
CREATE TABLE product_plans (
  id                              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id                      uuid NOT NULL REFERENCES products(id),
  plan_name                       text NOT NULL,
  plan_code                       text,
  target_customer_country         text,
  target_currency                 text,
  price                           numeric NOT NULL,
  currency                        text NOT NULL DEFAULT 'EUR',
  installments                    integer NOT NULL DEFAULT 1,
  collection_gateway              text NOT NULL,
  collection_gateway_product_id   text,
  collection_gateway_link         text,
  vendor_id                       uuid REFERENCES vendors(id),
  vendor_payout_currency          text,
  is_default                      boolean NOT NULL DEFAULT false,
  active                          boolean NOT NULL DEFAULT true,
  priority                        integer NOT NULL DEFAULT 0,
  created_at                      timestamptz DEFAULT now(),
  updated_at                      timestamptz DEFAULT now()
);

CREATE INDEX idx_product_plans_product_id ON product_plans(product_id);
CREATE INDEX idx_product_plans_target_country ON product_plans(target_customer_country);

CREATE TRIGGER trg_product_plans_updated_at BEFORE UPDATE ON product_plans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ────────────────────────────────────────────────────────────────
-- deals ★ CENTRAL TABLE
-- ────────────────────────────────────────────────────────────────
CREATE TABLE deals (
  id                    uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id             uuid REFERENCES clients(id),
  primary_vendor_id     uuid REFERENCES vendors(id),
  owner_vendor_id       uuid REFERENCES vendors(id),
  product_id            uuid REFERENCES products(id),
  price                 numeric(10,2),
  currency              text DEFAULT 'EUR',
  vat_pct               numeric(5,2) DEFAULT 0,
  vat_mode              vat_mode DEFAULT 'excl',
  discount              text,
  sales_status          sales_status DEFAULT 'lead',
  billing_status        billing_status DEFAULT 'pending',
  payment_processor     payment_processor,
  gi_client_id          text,
  gi_invoice_series     text,
  stripe_customer_id    text,
  stripe_payment_link   text,
  wise_iban             text,
  wise_bank_ref         text,
  thrive_ref            text,
  notes                 text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  origin                deal_origin NOT NULL DEFAULT 'manual',
  external_id           text,
  product_plan_id       uuid REFERENCES product_plans(id),
  payment_method        text,
  payment_link          text,
  payment_gateway_id    text,
  payment_status        text NOT NULL DEFAULT 'pending',
  paid_at               timestamptz,
  paid_amount           numeric,
  paid_currency         text,
  plan_id               uuid REFERENCES plans(id),
  agreed_price          numeric,
  agreed_currency       text
);

COMMENT ON TABLE deals IS 'Central sales pipeline table';
COMMENT ON COLUMN deals.primary_vendor_id IS 'Vendor delivering the service';
COMMENT ON COLUMN deals.owner_vendor_id IS 'Deal owner/manager (optional)';

CREATE INDEX idx_deals_client ON deals(client_id);
CREATE INDEX idx_deals_primary_vendor ON deals(primary_vendor_id);
CREATE INDEX idx_deals_owner_vendor ON deals(owner_vendor_id);
CREATE INDEX idx_deals_sales_status ON deals(sales_status);
CREATE INDEX idx_deals_billing_status ON deals(billing_status);
CREATE INDEX idx_deals_payment_status ON deals(payment_status);
CREATE INDEX idx_deals_created ON deals(created_at DESC);
CREATE INDEX idx_deals_product_plan_id ON deals(product_plan_id);

CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ────────────────────────────────────────────────────────────────
-- packages
-- ────────────────────────────────────────────────────────────────
CREATE TABLE packages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id         uuid REFERENCES deals(id),
  client_id       uuid NOT NULL REFERENCES clients(id),
  vendor_id       uuid NOT NULL REFERENCES vendors(id),
  total_sessions  integer NOT NULL,
  sessions_used   integer NOT NULL DEFAULT 0,
  status          package_status NOT NULL DEFAULT 'active',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  product_id      uuid REFERENCES products(id),
  sessions_total  integer
);

-- ────────────────────────────────────────────────────────────────
-- task_types
-- ────────────────────────────────────────────────────────────────
CREATE TABLE task_types (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       text NOT NULL,
  rate_usd   numeric NOT NULL,
  vendor_id  uuid REFERENCES vendors(id),
  active     boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- sessions
-- ────────────────────────────────────────────────────────────────
CREATE TABLE sessions (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id       uuid REFERENCES deals(id) ON DELETE CASCADE,
  vendor_id     uuid REFERENCES vendors(id),
  client_id     uuid REFERENCES clients(id),
  session_date  date,
  start_time    time,
  duration_min  integer DEFAULT 60,
  session_type  session_type,
  status        session_status DEFAULT 'planned',
  notes         text,
  created_at    timestamptz DEFAULT now(),
  package_id    uuid REFERENCES packages(id),
  billed        boolean NOT NULL DEFAULT false,
  bill_id       uuid,
  task_type_id  uuid REFERENCES task_types(id),
  rate_usd      numeric,
  hours         numeric
);

COMMENT ON TABLE sessions IS 'Client-facing service delivery events';

CREATE INDEX idx_sessions_deal ON sessions(deal_id);
CREATE INDEX idx_sessions_vendor ON sessions(vendor_id);
CREATE INDEX idx_sessions_client ON sessions(client_id);
CREATE INDEX idx_sessions_date ON sessions(session_date DESC);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_unbilled ON sessions(vendor_id, billed) WHERE billed = false;

-- ────────────────────────────────────────────────────────────────
-- bills
-- ────────────────────────────────────────────────────────────────
CREATE TABLE bills (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id            uuid NOT NULL REFERENCES vendors(id),
  status               text NOT NULL DEFAULT 'draft',
  created_at           timestamptz NOT NULL DEFAULT now(),
  submitted_at         timestamptz,
  returned_at          timestamptz,
  approved_at          timestamptz,
  paid_at              timestamptz,
  total_amount         numeric NOT NULL,
  currency             text NOT NULL DEFAULT 'EUR',
  vendor_notes         text,
  finance_notes        text,
  payment_method       text,
  payment_reference    text,
  paid_from_account_id uuid
);

-- Add bill_id FK to sessions after bills is created
ALTER TABLE sessions ADD CONSTRAINT fk_sessions_bill
  FOREIGN KEY (bill_id) REFERENCES bills(id);

-- ────────────────────────────────────────────────────────────────
-- vendor_hours
-- ────────────────────────────────────────────────────────────────
CREATE TABLE vendor_hours (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id    uuid NOT NULL REFERENCES vendors(id),
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

COMMENT ON TABLE vendor_hours IS 'Vendor work logs for payout calculations';
COMMENT ON COLUMN vendor_hours.synced IS 'Whether this hour log has been processed into a paycheck';

CREATE INDEX idx_vendor_hours_vendor ON vendor_hours(vendor_id);
CREATE INDEX idx_vendor_hours_date ON vendor_hours(date DESC);
CREATE INDEX idx_vendor_hours_vendor_date ON vendor_hours(vendor_id, date);

-- ────────────────────────────────────────────────────────────────
-- exchange_rates
-- ────────────────────────────────────────────────────────────────
CREATE TABLE exchange_rates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month         date NOT NULL,
  from_currency text NOT NULL,
  to_currency   text NOT NULL,
  rate          numeric NOT NULL,
  source        exchange_rate_source NOT NULL DEFAULT 'manual',
  created_at    timestamptz DEFAULT now(),
  notes         text
);

-- ────────────────────────────────────────────────────────────────
-- companies
-- ────────────────────────────────────────────────────────────────
CREATE TABLE companies (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  currency    text NOT NULL,
  entity_type text NOT NULL,
  status      text NOT NULL DEFAULT 'active',
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- paychecks
-- ────────────────────────────────────────────────────────────────
CREATE TABLE paychecks (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id           uuid NOT NULL REFERENCES vendors(id),
  month               text NOT NULL,
  total_hours         numeric(6,2),
  amount              numeric(10,2),
  currency            text DEFAULT 'EUR',
  status              text DEFAULT 'draft',
  payment_date        date,
  notes               text,
  created_at          timestamptz DEFAULT now(),
  base_amount_usd     numeric,
  payout_amount       numeric,
  payout_currency     payout_currency,
  exchange_rate_id    uuid REFERENCES exchange_rates(id),
  company_id          uuid,
  actual_amount_paid  numeric
);

COMMENT ON TABLE paychecks IS 'Monthly vendor payout records - aggregated from vendor_hours';
COMMENT ON COLUMN paychecks.month IS 'Format: YYYY-MM';
COMMENT ON COLUMN paychecks.status IS 'draft | ready | pending | paid';

CREATE INDEX idx_paychecks_vendor ON paychecks(vendor_id);
CREATE INDEX idx_paychecks_month ON paychecks(month DESC);
CREATE INDEX idx_paychecks_status ON paychecks(status);
CREATE UNIQUE INDEX idx_paychecks_vendor_month ON paychecks(vendor_id, month);

-- ────────────────────────────────────────────────────────────────
-- payments
-- ────────────────────────────────────────────────────────────────
CREATE TABLE payments (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id      uuid REFERENCES deals(id),
  client_id    uuid REFERENCES clients(id),
  vendor_id    uuid REFERENCES vendors(id),
  type         text,
  direction    text,
  amount       numeric(10,2) NOT NULL,
  currency     text DEFAULT 'EUR',
  payment_date date,
  method       text,
  reference    text,
  status       text,
  tax_kind     text,
  notes        text,
  created_at   timestamptz DEFAULT now()
);

COMMENT ON TABLE payments IS 'Unified payment tracking - incoming, payouts, and expenses';
COMMENT ON COLUMN payments.type IS 'incoming | payout | expense';
COMMENT ON COLUMN payments.direction IS 'in | out';
COMMENT ON COLUMN payments.tax_kind IS 'vat | withholding | fee | other';

CREATE INDEX idx_payments_deal ON payments(deal_id);
CREATE INDEX idx_payments_client ON payments(client_id);
CREATE INDEX idx_payments_vendor ON payments(vendor_id);
CREATE INDEX idx_payments_type ON payments(type);
CREATE INDEX idx_payments_date ON payments(payment_date DESC);

-- ────────────────────────────────────────────────────────────────
-- invoices
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

COMMENT ON TABLE invoices IS 'Invoice tracking - references external invoicing systems';

CREATE INDEX idx_invoices_deal ON invoices(deal_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_issue_date ON invoices(issue_date DESC);

-- ────────────────────────────────────────────────────────────────
-- deal_documents
-- ────────────────────────────────────────────────────────────────
CREATE TABLE deal_documents (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id      uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  name         text,
  type         text,
  url          text,
  storage_path text,
  size_kb      integer,
  created_at   timestamptz DEFAULT now()
);

COMMENT ON TABLE deal_documents IS 'Document attachments for deals';
COMMENT ON COLUMN deal_documents.type IS 'invoice | agreement | receipt | other';

CREATE INDEX idx_deal_documents_deal ON deal_documents(deal_id);

-- ────────────────────────────────────────────────────────────────
-- deal_reminders
-- ────────────────────────────────────────────────────────────────
CREATE TABLE deal_reminders (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id    uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  text       text NOT NULL,
  done       boolean DEFAULT false,
  due_date   date,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE deal_reminders IS 'Todo/reminder items attached to deals';

CREATE INDEX idx_deal_reminders_deal ON deal_reminders(deal_id);
CREATE INDEX idx_deal_reminders_done ON deal_reminders(done);

-- ────────────────────────────────────────────────────────────────
-- documents (polymorphic — deal / client / vendor)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type document_entity_type NOT NULL,
  entity_id   uuid NOT NULL,
  name        text NOT NULL,
  type        document_type NOT NULL DEFAULT 'url',
  url         text,
  uploaded_by text,
  created_at  timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- vendor_client_assignments (history log of vendor↔client assignments)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE vendor_client_assignments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  uuid NOT NULL REFERENCES clients(id),
  vendor_id  uuid NOT NULL REFERENCES vendors(id),
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to   timestamptz,
  changed_by text NOT NULL,
  reason     text,
  created_at timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- import_logs
-- ────────────────────────────────────────────────────────────────
CREATE TABLE import_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type    text NOT NULL,
  table_name     text NOT NULL,
  batch_id       uuid NOT NULL,
  rows_total     integer,
  rows_imported  integer,
  rows_skipped   integer,
  rows_failed    integer,
  column_mapping jsonb,
  imported_by    text DEFAULT 'demo',
  created_at     timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- system_settings
-- ────────────────────────────────────────────────────────────────
CREATE TABLE system_settings (
  key         text PRIMARY KEY,
  value       text,
  label       text,
  description text,
  updated_at  timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- accounts
-- ────────────────────────────────────────────────────────────────
CREATE TABLE accounts (
  id           text PRIMARY KEY,
  company_id   text NOT NULL,
  name         text NOT NULL,
  provider     text NOT NULL,
  currency     text NOT NULL,
  account_type text NOT NULL,
  is_active    boolean NOT NULL DEFAULT true,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_accounts_company ON accounts(company_id);

-- ────────────────────────────────────────────────────────────────
-- account_balances
-- ────────────────────────────────────────────────────────────────
CREATE TABLE account_balances (
  id              text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  account_id      text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  month           date NOT NULL, -- always first day of month (e.g. 2026-04-01)
  opening_balance numeric(14,2) NOT NULL DEFAULT 0,
  closing_balance numeric(14,2),  -- actual from statement; nullable until entered
  currency        text NOT NULL DEFAULT 'USD',
  notes           text,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(account_id, month)
);

-- ────────────────────────────────────────────────────────────────
-- transaction_categories
-- ────────────────────────────────────────────────────────────────
CREATE TABLE transaction_categories (
  id             text PRIMARY KEY,
  name           text NOT NULL,
  match_patterns text[],
  hebrew         text,
  tax_category   text,
  status         text NOT NULL DEFAULT 'active',
  notes          text
);

-- ────────────────────────────────────────────────────────────────
-- transaction_tags
-- ────────────────────────────────────────────────────────────────
CREATE TABLE transaction_tags (
  id         text PRIMARY KEY,
  name       text NOT NULL,
  status     text NOT NULL DEFAULT 'active',
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_transaction_tags_name_unique ON transaction_tags(lower(name));

-- ────────────────────────────────────────────────────────────────
-- classification_rules
-- ────────────────────────────────────────────────────────────────
CREATE TABLE classification_rules (
  id         text PRIMARY KEY,
  provider   text NOT NULL,
  priority   integer NOT NULL,
  when_field text NOT NULL,
  when_op    text NOT NULL,
  when_value text,
  set_field  text NOT NULL,
  set_value  text,
  stop       boolean NOT NULL DEFAULT false,
  notes      text
);

-- ────────────────────────────────────────────────────────────────
-- fee_rules
-- ────────────────────────────────────────────────────────────────
CREATE TABLE fee_rules (
  id              text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  provider        text NOT NULL,
  match_type      text NOT NULL,
  match_value     text,
  fee_account_id  text,
  fee_category_id text,
  notes           text
);

-- ────────────────────────────────────────────────────────────────
-- transaction_imports
-- ────────────────────────────────────────────────────────────────
CREATE TABLE transaction_imports (
  id            text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  account_id    text NOT NULL,
  provider      text NOT NULL,
  source_type   text NOT NULL,
  raw_rows      integer,
  imported_rows integer,
  skipped_rows  integer,
  failed_rows   integer,
  imported_at   timestamptz NOT NULL DEFAULT now(),
  notes         text
);

-- ────────────────────────────────────────────────────────────────
-- transactions
-- ────────────────────────────────────────────────────────────────
CREATE TABLE transactions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source              text,
  direction           text,
  external_id         text,
  status              text DEFAULT 'unmatched',
  amount              numeric,
  currency            text,
  exchange_rate       numeric,
  amount_ils          numeric,
  counterparty_name   text,
  counterparty_account text,
  reference           text,
  event_type          text,
  transaction_date    date,
  settled_date        date,
  installment_index   integer,
  linked_entity_type  text,
  linked_entity_id    uuid,
  plan_id             uuid REFERENCES plans(id),
  tax_category        text,
  category            text,
  tags                text[],
  raw_data            jsonb,
  created_at          timestamptz DEFAULT now(),
  category_id         text,
  tax_treatment       text,
  entity              text,
  vendor_id           uuid REFERENCES vendors(id),
  account_id          text REFERENCES accounts(id) ON DELETE SET NULL,
  import_id           text REFERENCES transaction_imports(id),
  deleted_at          timestamptz DEFAULT NULL,
  duplicate_of        uuid REFERENCES transactions(id)
);

CREATE INDEX transactions_linked_entity_type_linked_entity_id_idx ON transactions(linked_entity_type, linked_entity_id);
CREATE INDEX transactions_plan_id_idx ON transactions(plan_id);
CREATE INDEX transactions_source_external_id_idx ON transactions(source, external_id);
CREATE INDEX transactions_status_idx ON transactions(status);
CREATE INDEX idx_transactions_import_id ON transactions(import_id);
CREATE INDEX idx_transactions_deleted ON transactions(deleted_at) WHERE deleted_at IS NULL;

-- ────────────────────────────────────────────────────────────────
-- audit_log
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  text NOT NULL,
  entity_id    text NOT NULL,
  action       text NOT NULL,
  changed_by   text NOT NULL DEFAULT 'admin',
  old_data     jsonb,
  new_data     jsonb,
  meta         jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_entity  ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- ================================================================
-- 5. DEFERRED FK (profiles → vendors)
-- ================================================================

ALTER TABLE profiles ADD CONSTRAINT fk_profiles_vendor
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL;

-- ================================================================
-- 6. ROW LEVEL SECURITY
-- ================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE paychecks ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_client_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE classification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- 7. RLS POLICIES (permissive — Phase 1)
-- ================================================================

-- clients
CREATE POLICY "anon_read_clients"  ON clients FOR SELECT USING (true);
CREATE POLICY "anon_write_clients" ON clients FOR ALL    USING (true);

-- vendors
CREATE POLICY "anon_all_vendors" ON vendors FOR ALL USING (true);

-- rates
CREATE POLICY "anon_read_rates"  ON rates FOR SELECT USING (true);
CREATE POLICY "anon_write_rates" ON rates FOR ALL    USING (true);

-- vendor_clients
CREATE POLICY "anon_read_vendor_clients"  ON vendor_clients FOR SELECT USING (true);
CREATE POLICY "anon_write_vendor_clients" ON vendor_clients FOR ALL    USING (true);

-- programs / products / plans / product_plans
CREATE POLICY "anon_all_programs"      ON programs      FOR ALL USING (true);
CREATE POLICY "anon_all_products"      ON products      FOR ALL USING (true);
CREATE POLICY "anon_all_plans"         ON plans         FOR ALL USING (true);
CREATE POLICY "anon_all_product_plans" ON product_plans FOR ALL USING (true);

-- deals
CREATE POLICY "anon_read_deals"  ON deals FOR SELECT USING (true);
CREATE POLICY "anon_write_deals" ON deals FOR ALL    USING (true);

-- sessions
CREATE POLICY "anon_read_sessions"  ON sessions FOR SELECT USING (true);
CREATE POLICY "anon_write_sessions" ON sessions FOR ALL    USING (true);

-- bills
CREATE POLICY "bills_all" ON bills FOR ALL USING (true);

-- vendor_hours
CREATE POLICY "anon_read_vendor_hours"  ON vendor_hours FOR SELECT USING (true);
CREATE POLICY "anon_write_vendor_hours" ON vendor_hours FOR ALL    USING (true);

-- paychecks
CREATE POLICY "anon_read_paychecks"  ON paychecks FOR SELECT USING (true);
CREATE POLICY "anon_write_paychecks" ON paychecks FOR ALL    USING (true);

-- payments
CREATE POLICY "Allow all for authenticated users" ON payments FOR ALL USING (true);

-- invoices
CREATE POLICY "anon_read_invoices" ON invoices FOR SELECT USING (true);

-- deal_documents
CREATE POLICY "anon_read_deal_documents"  ON deal_documents FOR SELECT USING (true);
CREATE POLICY "anon_write_deal_documents" ON deal_documents FOR ALL    USING (true);

-- deal_reminders
CREATE POLICY "anon_read_deal_reminders"  ON deal_reminders FOR SELECT USING (true);
CREATE POLICY "anon_write_deal_reminders" ON deal_reminders FOR ALL    USING (true);

-- documents
CREATE POLICY "anon read documents"   ON documents FOR SELECT USING (true);
CREATE POLICY "anon insert documents" ON documents FOR INSERT WITH CHECK (true);
CREATE POLICY "anon update documents" ON documents FOR UPDATE USING (true);
CREATE POLICY "anon delete documents" ON documents FOR DELETE USING (true);

-- vendor_client_assignments
CREATE POLICY "anon read vendor_client_assignments"   ON vendor_client_assignments FOR SELECT USING (true);
CREATE POLICY "anon insert vendor_client_assignments" ON vendor_client_assignments FOR INSERT WITH CHECK (true);
CREATE POLICY "anon update vendor_client_assignments" ON vendor_client_assignments FOR UPDATE USING (true);
CREATE POLICY "anon delete vendor_client_assignments" ON vendor_client_assignments FOR DELETE USING (true);

-- exchange_rates
CREATE POLICY "anon read exchange_rates"   ON exchange_rates FOR SELECT USING (true);
CREATE POLICY "anon insert exchange_rates" ON exchange_rates FOR INSERT WITH CHECK (true);
CREATE POLICY "anon update exchange_rates" ON exchange_rates FOR UPDATE USING (true);
CREATE POLICY "anon delete exchange_rates" ON exchange_rates FOR DELETE USING (true);

-- accounts
CREATE POLICY "anon_all_accounts" ON accounts FOR ALL USING (true);

-- companies
CREATE POLICY "anon_all_companies" ON companies FOR ALL USING (true);

-- transaction_categories
CREATE POLICY "anon_all_transaction_categories" ON transaction_categories FOR ALL USING (true);

-- transaction_tags (no policy in demo — RLS enabled but no explicit policy = blocked by default; add permissive)
-- (demo has no explicit policy for transaction_tags, keeping consistent)

-- classification_rules
CREATE POLICY "anon_all_classification_rules" ON classification_rules FOR ALL USING (true);

-- fee_rules
CREATE POLICY "anon_all_fee_rules" ON fee_rules FOR ALL USING (true);

-- transaction_imports
CREATE POLICY "anon_all_transaction_imports" ON transaction_imports FOR ALL USING (true);

-- audit_log
CREATE POLICY "anon_all_audit_log" ON audit_log FOR ALL USING (true);

-- ================================================================
-- 8. MIGRATION HELPERS
-- ================================================================

ALTER TABLE transactions DROP COLUMN IF EXISTS account_id;
ALTER TABLE transactions ADD COLUMN account_id text REFERENCES accounts(id) ON DELETE SET NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES transactions(id);

-- ================================================================
-- 9. COMMIT
-- ================================================================

COMMIT;
