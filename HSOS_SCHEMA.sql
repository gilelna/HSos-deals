-- HSos — HSOS_SCHEMA.sql
-- Ground-truth DDL for the Demo DB as of 2026-04-27
-- This is documentation/reference — not a migration script.
-- Run on a fresh DB only. For changes, write a numbered migration file.

-- ─── EXTENSIONS ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── ENUMS ───────────────────────────────────────────────────────────────────

CREATE TYPE vendor_type AS ENUM (
  'coach', 'contractor', 'team_member', 'subscription', 'software_saas', 'merchant'
);

CREATE TYPE billing_status AS ENUM (
  'pending', 'invoiced', 'partial', 'paid', 'overdue'
);

CREATE TYPE sales_status AS ENUM (
  'lead', 'qualified', 'active', 'delivered', 'closed'
);

CREATE TYPE session_status AS ENUM (
  'planned', 'done', 'cancelled', 'no_show'
);

CREATE TYPE session_type AS ENUM (
  'coaching', 'consulting', 'editing', 'design', 'admin', 'other'
);

CREATE TYPE package_status AS ENUM (
  'active', 'completed', 'cancelled'
);

CREATE TYPE product_type AS ENUM (
  'session', 'package', 'workshop', 'custom'
);

CREATE TYPE system_role AS ENUM (
  'admin', 'manager', 'finance', 'vendor'
);

CREATE TYPE payment_processor AS ENUM (
  'stripe', 'wise', 'thrive', 'other'
);

CREATE TYPE payout_currency AS ENUM (
  'usd', 'ils', 'eur'
);

CREATE TYPE vat_mode AS ENUM (
  'excl', 'incl'
);

CREATE TYPE deal_origin AS ENUM (
  'manual', 'thrivecart', 'stripe', 'other'
);

CREATE TYPE document_entity_type AS ENUM (
  'deal', 'client', 'vendor'
);

CREATE TYPE document_type AS ENUM (
  'upload', 'url'
);

CREATE TYPE exchange_rate_source AS ENUM (
  'manual', 'wise'
);

CREATE TYPE account_status AS ENUM (
  'active', 'inactive', 'closed'
);

CREATE TYPE account_type AS ENUM (
  'bank', 'card', 'paypal', 'stripe', 'wise', 'other'
);

CREATE TYPE currency_code AS ENUM (
  'USD', 'EUR', 'ILS', 'GBP'
);

-- ─── TEXT-PK TABLES (financial layer) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS companies (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  currency    text NOT NULL,
  entity_type text NOT NULL,
  status      text NOT NULL DEFAULT 'active',
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounts (
  id           text PRIMARY KEY,
  company_id   text NOT NULL REFERENCES companies(id),
  name         text NOT NULL,
  provider     text NOT NULL,
  currency     text NOT NULL,
  account_type text NOT NULL,
  is_active    boolean NOT NULL DEFAULT true,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transaction_categories (
  id             text PRIMARY KEY,
  name           text NOT NULL,
  hebrew         text,
  tax_category   text,
  match_patterns text[],
  status         text NOT NULL DEFAULT 'active',
  notes          text
);

CREATE TABLE IF NOT EXISTS transaction_tags (
  id         text PRIMARY KEY,
  name       text NOT NULL,
  status     text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS classification_rules (
  id          text PRIMARY KEY,
  provider    text NOT NULL,
  priority    integer NOT NULL,
  when_field  text NOT NULL,
  when_op     text NOT NULL,
  when_value  text,
  set_field   text NOT NULL,
  set_value   text,
  stop        boolean NOT NULL DEFAULT false,
  notes       text
);

CREATE TABLE IF NOT EXISTS system_settings (
  key         text PRIMARY KEY,
  value       text,
  label       text,
  description text,
  updated_at  timestamptz DEFAULT now()
);

-- ─── UUID-PK TABLES ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customers (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email                   text NOT NULL UNIQUE,
  full_name               text NOT NULL,
  phone                   text,
  country                 text,
  thrivecart_customer_id  text,
  green_invoice_client_id text,
  lifetime_value          numeric NOT NULL DEFAULT 0,
  first_purchase_date     timestamptz,
  last_purchase_date      timestamptz,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clients (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name       text NOT NULL,
  email           text,
  phone           text,
  client_kind     text,
  company         text,
  source          text,
  notes           text,
  active          boolean DEFAULT true,
  customer_id     text,
  customer_id_fk  uuid REFERENCES customers(id),
  created_at      timestamptz DEFAULT now()
);
COMMENT ON COLUMN clients.customer_id IS 'External ref (ActiveCampaign, ThriveCart, etc.)';

CREATE TABLE IF NOT EXISTS vendors (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  is_active        boolean NOT NULL DEFAULT true,
  vendor_type      vendor_type NOT NULL DEFAULT 'contractor',
  email            text,
  payout_currency  text,
  company_id       text REFERENCES companies(id),
  category_id      text REFERENCES transaction_categories(id),
  tax_treatment    text,
  entity           text,
  cadence          text,                          -- DEPRECATED: use payment_cadence
  payment_cadence  text CHECK (payment_cadence IN ('recurring','project_based','one_time')),
  match_patterns   text[],
  merge_name       text,
  tags             text[],
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  -- Generated columns (aliases for compatibility)
  full_name        text GENERATED ALWAYS AS (name) STORED,
  active           boolean GENERATED ALWAYS AS (is_active) STORED
);
COMMENT ON COLUMN vendors.cadence IS 'DEPRECATED — use payment_cadence';
COMMENT ON COLUMN vendors.match_patterns IS 'Counterparty name strings for auto-classify';

CREATE TABLE IF NOT EXISTS programs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  slug             text UNIQUE,
  description      text,
  logo_url         text,
  audience_segment text,
  active           boolean DEFAULT true,
  created_at       timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id        uuid REFERENCES programs(id),
  name              text NOT NULL,
  description       text,
  category          text,
  status            text NOT NULL DEFAULT 'active',
  type              text,
  logo_url          text,
  currency          text,
  price_min         numeric,
  price_max         numeric,
  base_price        numeric,
  base_currency     text DEFAULT 'USD',
  sessions_included integer,
  vendor_type       text,
  links             jsonb DEFAULT '[]',
  prd_uid           text UNIQUE,
  active            boolean DEFAULT true,
  created_at        timestamptz DEFAULT now()
);

-- Auto-assign PRD-XXXX
CREATE OR REPLACE FUNCTION fn_assign_prd_uid() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.prd_uid IS NULL THEN
    NEW.prd_uid := 'PRD-' || LPAD(nextval('prd_uid_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE SEQUENCE IF NOT EXISTS prd_uid_seq START 1;

CREATE OR REPLACE TRIGGER trg_assign_prd_uid
  BEFORE INSERT ON products
  FOR EACH ROW EXECUTE FUNCTION fn_assign_prd_uid();

CREATE TABLE IF NOT EXISTS plans (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id              uuid REFERENCES products(id),
  name                    text NOT NULL,
  plan_type               text,
  plan_uid                text UNIQUE,
  status                  text,
  amount                  numeric,
  currency                text DEFAULT 'USD',
  installments_count      integer,
  description             text,
  link_source             text,
  link_id                 text,
  link_url                text,
  external_id             text,
  payment_rail            text CHECK (payment_rail IN ('thrivecart','green_invoice','wise','bank_transfer','manual')),
  target_customer_country text,
  target_currency         text,
  vendor_payout_currency  text,
  vendor_id               uuid REFERENCES vendors(id),
  gateway_product_id      text,
  is_default              boolean DEFAULT false,
  priority                integer,
  created_at              timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION fn_assign_plan_uid() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.plan_uid IS NULL THEN
    NEW.plan_uid := 'PLN-' || LPAD(nextval('plan_uid_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE SEQUENCE IF NOT EXISTS plan_uid_seq START 1;

CREATE OR REPLACE TRIGGER trg_assign_plan_uid
  BEFORE INSERT ON plans
  FOR EACH ROW EXECUTE FUNCTION fn_assign_plan_uid();

CREATE TABLE IF NOT EXISTS deals (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         uuid REFERENCES clients(id),
  primary_vendor_id uuid REFERENCES vendors(id),
  product_id        uuid REFERENCES products(id),
  plan_id           uuid REFERENCES plans(id),
  agreed_price      numeric,
  agreed_currency   text,
  vat_pct           numeric DEFAULT 0,
  vat_mode          vat_mode DEFAULT 'excl',
  sales_status      sales_status DEFAULT 'lead',
  billing_status    billing_status DEFAULT 'pending',
  payment_processor payment_processor,
  origin            deal_origin NOT NULL DEFAULT 'manual',
  external_id       text,
  payment_method    text,
  payment_link      text,
  gi_client_id      text,
  gi_invoice_series text,
  wise_iban         text,
  wise_bank_ref     text,
  thrive_ref        text,
  notes             text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION fn_deals_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION fn_deals_updated_at();

CREATE TABLE IF NOT EXISTS packages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id        uuid REFERENCES deals(id),
  client_id      uuid NOT NULL REFERENCES clients(id),
  vendor_id      uuid NOT NULL REFERENCES vendors(id),
  product_id     uuid REFERENCES products(id),
  sessions_total integer,
  sessions_used  integer NOT NULL DEFAULT 0,
  status         package_status NOT NULL DEFAULT 'active',
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_types (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  rate_usd   numeric NOT NULL,
  vendor_id  uuid REFERENCES vendors(id),
  active     boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bills (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id            uuid NOT NULL REFERENCES vendors(id),
  status               text NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft','submitted','returned','approved','paid')),
  total_amount         numeric NOT NULL CHECK (total_amount > 0),
  currency             text NOT NULL DEFAULT 'EUR',
  vendor_notes         text,
  finance_notes        text,
  payment_method       text,
  payment_reference    text,
  paid_from_account_id uuid,
  created_at           timestamptz NOT NULL DEFAULT now(),
  submitted_at         timestamptz,
  returned_at          timestamptz,
  approved_at          timestamptz,
  paid_at              timestamptz
);

CREATE TABLE IF NOT EXISTS sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id    uuid REFERENCES vendors(id),
  client_id    uuid REFERENCES clients(id),
  deal_id      uuid REFERENCES deals(id),
  package_id   uuid REFERENCES packages(id),
  task_type_id uuid REFERENCES task_types(id),
  bill_id      uuid REFERENCES bills(id),
  session_date date,
  start_time   time,
  duration_min integer DEFAULT 60,
  session_type session_type,
  status       session_status NOT NULL DEFAULT 'planned',
  rate_usd     numeric,
  hours        numeric,
  billed       boolean NOT NULL DEFAULT false,
  notes        text,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id      uuid NOT NULL REFERENCES vendors(id),
  session_type   session_type NOT NULL,
  rate           numeric NOT NULL,
  currency       text DEFAULT 'EUR',
  name           text,
  effective_date date,
  notes          text,
  created_at     timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exchange_rates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month         date NOT NULL,
  from_currency text NOT NULL,
  to_currency   text NOT NULL,
  rate          numeric NOT NULL,
  source        exchange_rate_source NOT NULL DEFAULT 'manual',
  notes         text,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS paychecks (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id          uuid NOT NULL REFERENCES vendors(id),
  month              text NOT NULL,
  total_hours        numeric,
  amount             numeric,
  currency           text DEFAULT 'EUR',
  status             text DEFAULT 'draft',
  payment_date       date,
  base_amount_usd    numeric,
  payout_amount      numeric,
  payout_currency    payout_currency,
  exchange_rate_id   uuid REFERENCES exchange_rates(id),
  company_id         uuid,
  actual_amount_paid numeric,
  notes              text,
  created_at         timestamptz DEFAULT now()
);
COMMENT ON COLUMN paychecks.month IS 'Format: YYYY-MM';

CREATE TABLE IF NOT EXISTS vendor_clients (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id  uuid NOT NULL REFERENCES vendors(id),
  client_id  uuid NOT NULL REFERENCES clients(id),
  created_at timestamptz DEFAULT now()
);
COMMENT ON TABLE vendor_clients IS 'Junction: which vendors work with which clients';

CREATE TABLE IF NOT EXISTS vendor_client_assignments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id  uuid NOT NULL REFERENCES vendors(id),
  client_id  uuid NOT NULL REFERENCES clients(id),
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to   timestamptz,
  changed_by text NOT NULL,
  reason     text,
  created_at timestamptz DEFAULT now()
);
COMMENT ON TABLE vendor_client_assignments IS 'Audit trail for vendor reassignments';

CREATE TABLE IF NOT EXISTS vendor_hours (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id    uuid NOT NULL REFERENCES vendors(id),
  deal_id      uuid REFERENCES deals(id),
  session_id   uuid REFERENCES sessions(id),
  date         date NOT NULL,
  hours        numeric NOT NULL,
  session_type session_type,
  rate         numeric,
  synced       boolean DEFAULT false,
  notes        text,
  created_at   timestamptz DEFAULT now()
);
COMMENT ON TABLE vendor_hours IS 'LEGACY V1 billing — superseded by sessions.bill_id flow';

CREATE TABLE IF NOT EXISTS documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type document_entity_type NOT NULL,
  entity_id   uuid NOT NULL,
  name        text NOT NULL,
  type        document_type NOT NULL DEFAULT 'url',
  url         text,
  uploaded_by text,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS deal_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id      uuid NOT NULL REFERENCES deals(id),
  name         text,
  type         text,
  url          text,
  storage_path text,
  size_kb      integer,
  created_at   timestamptz DEFAULT now()
);
COMMENT ON TABLE deal_documents IS 'LEGACY — prefer documents table';

CREATE TABLE IF NOT EXISTS deal_reminders (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id    uuid NOT NULL REFERENCES deals(id),
  text       text NOT NULL,
  done       boolean DEFAULT false,
  due_date   date,
  created_at timestamptz DEFAULT now()
);
COMMENT ON TABLE deal_reminders IS 'LEGACY — prefer activities table with type=reminder';

CREATE TABLE IF NOT EXISTS invoices (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id      uuid REFERENCES deals(id),
  external_ref text,
  issue_date   date,
  amount       numeric,
  currency     text DEFAULT 'EUR',
  status       text,
  notes        text,
  created_at   timestamptz DEFAULT now()
);
COMMENT ON TABLE invoices IS 'LEGACY — 0 rows. Superseded by external refs on deals';

CREATE TABLE IF NOT EXISTS payments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id      uuid REFERENCES deals(id),
  client_id    uuid REFERENCES clients(id),
  vendor_id    uuid REFERENCES vendors(id),
  type         text,
  direction    text,
  amount       numeric NOT NULL,
  currency     text DEFAULT 'EUR',
  payment_date date,
  method       text,
  reference    text,
  status       text,
  tax_kind     text,
  notes        text,
  created_at   timestamptz DEFAULT now()
);
COMMENT ON TABLE payments IS 'LEGACY — 0 rows. Superseded by transactions table';

CREATE TABLE IF NOT EXISTS account_balances (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   uuid REFERENCES accounts(id),
  date         date NOT NULL,
  balance      numeric NOT NULL,
  balance_type text DEFAULT 'opening',
  notes        text,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transaction_imports (
  id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  account_id    text NOT NULL REFERENCES accounts(id),
  provider      text NOT NULL,
  source_type   text NOT NULL,
  raw_rows      integer,
  imported_rows integer,
  skipped_rows  integer,
  failed_rows   integer,
  imported_at   timestamptz NOT NULL DEFAULT now(),
  notes         text
);

CREATE TABLE IF NOT EXISTS transactions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source              text CHECK (source IN ('thrivecart','green_invoice','wise','bank','manual')),
  direction           text CHECK (direction IN ('in','out')),
  status              text DEFAULT 'unmatched' CHECK (status IN ('unmatched','matched','reconciled')),
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
  linked_entity_type  text CHECK (linked_entity_type IN ('deal','paycheck','expense')),
  linked_entity_id    uuid,
  plan_id             uuid REFERENCES plans(id),
  account_id          text REFERENCES accounts(id),
  import_id           text REFERENCES transaction_imports(id),
  vendor_id           uuid REFERENCES vendors(id),
  category_id         text REFERENCES transaction_categories(id),
  category            text,      -- LEGACY raw text, use category_id
  tax_category        text,      -- LEGACY, use tax_treatment
  tax_treatment       text,
  entity              text,
  tags                text[],
  payment_cadence     text CHECK (payment_cadence IN ('recurring','project_based','one_time')),
  raw_data            jsonb,
  deleted_at          timestamptz,
  duplicate_of        uuid REFERENCES transactions(id),
  external_id         text,
  created_at          timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS import_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type     text NOT NULL,
  table_name      text NOT NULL,
  batch_id        uuid NOT NULL,
  rows_total      integer,
  rows_imported   integer,
  rows_skipped    integer,
  rows_failed     integer,
  column_mapping  jsonb,
  imported_by     text DEFAULT 'demo',
  created_at      timestamptz DEFAULT now()
);
COMMENT ON TABLE import_logs IS 'LEGACY — use transaction_imports for new imports';

CREATE TABLE IF NOT EXISTS fee_rules (
  id              text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  provider        text NOT NULL,
  match_type      text NOT NULL,
  match_value     text,
  fee_account_id  text REFERENCES accounts(id),
  fee_category_id text REFERENCES transaction_categories(id),
  notes           text
);

CREATE TABLE IF NOT EXISTS profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id),
  system_role   system_role NOT NULL DEFAULT 'vendor',
  vendor_id     uuid REFERENCES vendors(id) ON DELETE SET NULL,
  full_name     text,
  nickname      text,
  email         text UNIQUE,
  slack_user_id text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id   uuid,
  type        text NOT NULL,
  subtype     text,
  body        text,
  created_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  origin      text NOT NULL DEFAULT 'user',
  due_at      timestamptz,
  status      text,
  meta        jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activities_entity ON activities(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
CREATE INDEX IF NOT EXISTS idx_activities_due_at ON activities(due_at) WHERE due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status) WHERE status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_origin ON activities(origin);

CREATE TABLE IF NOT EXISTS audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id   text NOT NULL,
  action      text NOT NULL,
  changed_by  text NOT NULL DEFAULT 'admin',
  old_data    jsonb,
  new_data    jsonb,
  meta        jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── NOTIFY ──────────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
