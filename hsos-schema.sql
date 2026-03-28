-- ================================================================
-- HSos Database Schema
-- Complete SQL script for Supabase/PostgreSQL
-- 
-- Purpose: Internal operations system for service business
-- Modules: Sales, Operations, Payments, (future: Clients Portal)
-- 
-- Run this script in Supabase SQL Editor to create full schema
-- ================================================================

BEGIN;

-- ================================================================
-- 1. ENABLE UUID EXTENSION
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- 2. CREATE ENUMS
-- ================================================================

CREATE TYPE sales_status AS ENUM (
  'lead',
  'qualified', 
  'active',
  'delivered',
  'closed'
);

CREATE TYPE billing_status AS ENUM (
  'pending',
  'invoiced',
  'partial',
  'paid',
  'overdue'
);

CREATE TYPE session_status AS ENUM (
  'planned',
  'done',
  'cancelled',
  'no_show'
);

CREATE TYPE session_type AS ENUM (
  'coaching',
  'consulting',
  'editing',
  'design',
  'admin',
  'other'
);

CREATE TYPE product_type AS ENUM (
  'session',
  'package',
  'workshop',
  'custom'
);

CREATE TYPE vendor_type AS ENUM (
  'coach',
  'contractor',
  'team_member'
);

CREATE TYPE system_role AS ENUM (
  'admin',
  'manager',
  'finance',
  'vendor'
);

CREATE TYPE payment_processor AS ENUM (
  'stripe',
  'wise',
  'thrive',
  'other'
);

CREATE TYPE vat_mode AS ENUM (
  'excl',
  'incl'
);

-- ================================================================
-- 3. CREATE TABLES
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- profiles
-- System users and access roles (auth reintroduced later)
-- ────────────────────────────────────────────────────────────────

CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  system_role system_role,
  nickname text,
  full_name text,
  vendor_id uuid, -- FK added after vendors table created
  created_at timestamptz DEFAULT now()
);

-- ────────────────────────────────────────────────────────────────
-- clients
-- Operational clients managed inside HSos (not full customer records)
-- ────────────────────────────────────────────────────────────────

CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id text,
  full_name text NOT NULL,
  email text,
  phone text,
  client_kind text,
  company text,
  source text,
  notes text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_clients_full_name ON clients(full_name);
CREATE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_clients_active ON clients(active);

COMMENT ON TABLE clients IS 'Operational clients - links to external customer systems via customer_id';
COMMENT ON COLUMN clients.customer_id IS 'External reference to ActiveCampaign, ThriveCart, etc.';
COMMENT ON COLUMN clients.client_kind IS 'private | corporate';

-- ────────────────────────────────────────────────────────────────
-- vendors
-- Service providers and team members for operations and payments
-- ────────────────────────────────────────────────────────────────

CREATE TABLE vendors (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name text NOT NULL,
  nickname text,
  email text,
  phone text,
  vendor_type vendor_type,
  payment_method text,
  payment_id text,
  iban text,
  preferred_currency text DEFAULT 'EUR',
  contract_url text,
  active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_vendors_full_name ON vendors(full_name);
CREATE INDEX idx_vendors_vendor_type ON vendors(vendor_type);
CREATE INDEX idx_vendors_active ON vendors(active);

COMMENT ON TABLE vendors IS 'Service providers and team members - shared across Operations and Payments';
COMMENT ON COLUMN vendors.payment_method IS 'iban | paypal | wise | other';
COMMENT ON COLUMN vendors.payment_id IS 'PayPal email, Wise ID, or other payment identifier';

-- Now add FK to profiles
ALTER TABLE profiles ADD CONSTRAINT fk_profiles_vendor 
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────────
-- products
-- Reusable commercial items for Sales (VAT does NOT live here)
-- ────────────────────────────────────────────────────────────────

CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  type product_type,
  base_price numeric(10,2),
  currency text DEFAULT 'EUR',
  units text,
  notes text,
  active boolean DEFAULT true,
  payment_links jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_type ON products(type);
CREATE INDEX idx_products_active ON products(active);

COMMENT ON TABLE products IS 'Reusable commercial items - VAT calculated in frontend, not stored here';
COMMENT ON COLUMN products.payment_links IS 'JSON object with multiple payment options (Stripe, Israeli CC, etc.)';

-- ────────────────────────────────────────────────────────────────
-- rates
-- Per-vendor hourly rates by session type
-- ────────────────────────────────────────────────────────────────

CREATE TABLE rates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  session_type session_type NOT NULL,
  rate numeric(10,2) NOT NULL,
  currency text DEFAULT 'EUR',
  effective_date date,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_rates_vendor ON rates(vendor_id);
CREATE INDEX idx_rates_vendor_type ON rates(vendor_id, session_type);

COMMENT ON TABLE rates IS 'Vendor hourly rates by session type - for payout calculations';

-- ────────────────────────────────────────────────────────────────
-- vendor_clients (junction table)
-- Links vendors to their assigned clients
-- ────────────────────────────────────────────────────────────────

CREATE TABLE vendor_clients (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(vendor_id, client_id)
);

CREATE INDEX idx_vendor_clients_vendor ON vendor_clients(vendor_id);
CREATE INDEX idx_vendor_clients_client ON vendor_clients(client_id);

COMMENT ON TABLE vendor_clients IS 'Junction table - which vendors work with which clients';

-- ────────────────────────────────────────────────────────────────
-- deals ★ CENTRAL TABLE
-- Sales pipeline and deal management
-- ────────────────────────────────────────────────────────────────

CREATE TABLE deals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id uuid REFERENCES clients(id),
  primary_vendor_id uuid REFERENCES vendors(id),
  owner_vendor_id uuid REFERENCES vendors(id),
  product_id uuid REFERENCES products(id),
  price numeric(10,2),
  currency text DEFAULT 'EUR',
  vat_pct numeric(5,2) DEFAULT 0,
  vat_mode vat_mode DEFAULT 'excl',
  discount text,
  sales_status sales_status DEFAULT 'lead',
  billing_status billing_status DEFAULT 'pending',
  payment_processor payment_processor,
  gi_client_id text,
  gi_invoice_series text,
  stripe_customer_id text,
  stripe_payment_link text,
  wise_iban text,
  wise_bank_ref text,
  thrive_ref text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_deals_client ON deals(client_id);
CREATE INDEX idx_deals_primary_vendor ON deals(primary_vendor_id);
CREATE INDEX idx_deals_owner_vendor ON deals(owner_vendor_id);
CREATE INDEX idx_deals_sales_status ON deals(sales_status);
CREATE INDEX idx_deals_billing_status ON deals(billing_status);
CREATE INDEX idx_deals_created ON deals(created_at DESC);

COMMENT ON TABLE deals IS 'Central sales pipeline table - links clients, vendors, products, pricing, and payment tracking';
COMMENT ON COLUMN deals.primary_vendor_id IS 'Vendor delivering the service';
COMMENT ON COLUMN deals.owner_vendor_id IS 'Deal owner/manager (optional)';
COMMENT ON COLUMN deals.product_id IS 'Linked product (NULL for custom deals)';

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ────────────────────────────────────────────────────────────────
-- sessions
-- Time-based service events linked to a deal
-- ────────────────────────────────────────────────────────────────

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id uuid REFERENCES deals(id) ON DELETE CASCADE,
  vendor_id uuid REFERENCES vendors(id),
  client_id uuid REFERENCES clients(id),
  session_date date,
  start_time time,
  duration_min integer DEFAULT 60,
  session_type session_type,
  status session_status DEFAULT 'planned',
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_sessions_deal ON sessions(deal_id);
CREATE INDEX idx_sessions_vendor ON sessions(vendor_id);
CREATE INDEX idx_sessions_client ON sessions(client_id);
CREATE INDEX idx_sessions_date ON sessions(session_date DESC);
CREATE INDEX idx_sessions_status ON sessions(status);

COMMENT ON TABLE sessions IS 'Client-facing service delivery events - coaching sessions, consultations, etc.';

-- ────────────────────────────────────────────────────────────────
-- vendor_hours
-- Time logs for payout calculation and operational tracking
-- ────────────────────────────────────────────────────────────────

CREATE TABLE vendor_hours (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id uuid NOT NULL REFERENCES vendors(id),
  deal_id uuid REFERENCES deals(id),
  session_id uuid REFERENCES sessions(id),
  date date NOT NULL,
  hours numeric(4,2) NOT NULL,
  session_type session_type,
  rate numeric(10,2),
  notes text,
  synced boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_vendor_hours_vendor ON vendor_hours(vendor_id);
CREATE INDEX idx_vendor_hours_date ON vendor_hours(date DESC);
CREATE INDEX idx_vendor_hours_vendor_date ON vendor_hours(vendor_id, date);

COMMENT ON TABLE vendor_hours IS 'Vendor work logs for payout calculations - may or may not map 1:1 with sessions';
COMMENT ON COLUMN vendor_hours.synced IS 'Whether this hour log has been processed into a paycheck';

-- ────────────────────────────────────────────────────────────────
-- paychecks
-- Monthly vendor payout records
-- ────────────────────────────────────────────────────────────────

CREATE TABLE paychecks (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id uuid NOT NULL REFERENCES vendors(id),
  month text NOT NULL,
  total_hours numeric(6,2),
  amount numeric(10,2),
  currency text DEFAULT 'EUR',
  status text DEFAULT 'draft',
  payment_date date,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_paychecks_vendor ON paychecks(vendor_id);
CREATE INDEX idx_paychecks_month ON paychecks(month DESC);
CREATE INDEX idx_paychecks_status ON paychecks(status);
CREATE UNIQUE INDEX idx_paychecks_vendor_month ON paychecks(vendor_id, month);

COMMENT ON TABLE paychecks IS 'Monthly vendor payout records - aggregated from vendor_hours';
COMMENT ON COLUMN paychecks.month IS 'Format: YYYY-MM';
COMMENT ON COLUMN paychecks.status IS 'draft | ready | pending | paid';

-- ────────────────────────────────────────────────────────────────
-- payments
-- Unified payment records (incoming, payouts, expenses)
-- ────────────────────────────────────────────────────────────────

CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id uuid REFERENCES deals(id),
  client_id uuid REFERENCES clients(id),
  vendor_id uuid REFERENCES vendors(id),
  type text,
  direction text,
  amount numeric(10,2) NOT NULL,
  currency text DEFAULT 'EUR',
  payment_date date,
  method text,
  reference text,
  status text,
  tax_kind text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_payments_deal ON payments(deal_id);
CREATE INDEX idx_payments_client ON payments(client_id);
CREATE INDEX idx_payments_vendor ON payments(vendor_id);
CREATE INDEX idx_payments_type ON payments(type);
CREATE INDEX idx_payments_date ON payments(payment_date DESC);

COMMENT ON TABLE payments IS 'Unified payment tracking - incoming, payouts, and expenses';
COMMENT ON COLUMN payments.type IS 'incoming | payout | expense';
COMMENT ON COLUMN payments.direction IS 'in | out';
COMMENT ON COLUMN payments.tax_kind IS 'vat | withholding | fee | other (lightweight tax hook)';

-- ────────────────────────────────────────────────────────────────
-- invoices
-- Invoice records linked to deals
-- ────────────────────────────────────────────────────────────────

CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id uuid REFERENCES deals(id),
  external_ref text,
  issue_date date,
  amount numeric(10,2),
  currency text DEFAULT 'EUR',
  status text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_invoices_deal ON invoices(deal_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_issue_date ON invoices(issue_date DESC);

COMMENT ON TABLE invoices IS 'Invoice tracking - references external invoicing systems';

-- ────────────────────────────────────────────────────────────────
-- deal_documents
-- Files and URLs attached to deals
-- ────────────────────────────────────────────────────────────────

CREATE TABLE deal_documents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  name text,
  type text,
  url text,
  storage_path text,
  size_kb integer,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_deal_documents_deal ON deal_documents(deal_id);

COMMENT ON TABLE deal_documents IS 'Document attachments for deals - external links or Supabase Storage paths';
COMMENT ON COLUMN deal_documents.type IS 'invoice | agreement | receipt | other';

-- ────────────────────────────────────────────────────────────────
-- deal_reminders
-- Follow-up reminders per deal
-- ────────────────────────────────────────────────────────────────

CREATE TABLE deal_reminders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  text text NOT NULL,
  done boolean DEFAULT false,
  due_date date,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_deal_reminders_deal ON deal_reminders(deal_id);
CREATE INDEX idx_deal_reminders_done ON deal_reminders(done);

COMMENT ON TABLE deal_reminders IS 'Todo/reminder items attached to deals';

-- ================================================================
-- 4. ENABLE ROW LEVEL SECURITY (RLS)
-- ================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE paychecks ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_reminders ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- 5. CREATE RLS POLICIES (Phase 1 - Permissive)
-- ================================================================

-- Phase 1: Allow all authenticated users to read/write everything
-- (Auth is bypassed in current phase, but policies ready for later)

-- Profiles
CREATE POLICY "Allow all for authenticated users" ON profiles
  FOR ALL USING (true);

-- Clients
CREATE POLICY "Allow all for authenticated users" ON clients
  FOR ALL USING (true);

-- Vendors
CREATE POLICY "Allow all for authenticated users" ON vendors
  FOR ALL USING (true);

-- Products
CREATE POLICY "Allow all for authenticated users" ON products
  FOR ALL USING (true);

-- Rates
CREATE POLICY "Allow all for authenticated users" ON rates
  FOR ALL USING (true);

-- Vendor-Clients Junction
CREATE POLICY "Allow all for authenticated users" ON vendor_clients
  FOR ALL USING (true);

-- Deals
CREATE POLICY "Allow all for authenticated users" ON deals
  FOR ALL USING (true);

-- Sessions
CREATE POLICY "Allow all for authenticated users" ON sessions
  FOR ALL USING (true);

-- Vendor Hours
CREATE POLICY "Allow all for authenticated users" ON vendor_hours
  FOR ALL USING (true);

-- Paychecks
CREATE POLICY "Allow all for authenticated users" ON paychecks
  FOR ALL USING (true);

-- Payments
CREATE POLICY "Allow all for authenticated users" ON payments
  FOR ALL USING (true);

-- Invoices
CREATE POLICY "Allow all for authenticated users" ON invoices
  FOR ALL USING (true);

-- Deal Documents
CREATE POLICY "Allow all for authenticated users" ON deal_documents
  FOR ALL USING (true);

-- Deal Reminders
CREATE POLICY "Allow all for authenticated users" ON deal_reminders
  FOR ALL USING (true);

-- ================================================================
-- 6. COMMIT
-- ================================================================

COMMIT;

-- ================================================================
-- SCHEMA CREATION COMPLETE
-- ================================================================

-- Next steps:
-- 1. Run this script in Supabase SQL Editor
-- 2. Verify tables created: Database → Tables
-- 3. Load dummy data using the generated INSERT script
-- 4. Test with frontend application

-- Notes:
-- - All tables have RLS enabled but permissive policies (Phase 1)
-- - Future phases will add vendor-specific and client-specific policies
-- - Auth is currently bypassed; Google OAuth to be added later
-- - UUID extension enabled for automatic ID generation
-- - Indexes created on common query patterns
-- - Triggers set up for updated_at automation
