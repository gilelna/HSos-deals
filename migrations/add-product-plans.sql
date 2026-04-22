-- ============================================================
-- Migration: add-product-plans.sql
-- Purpose:   Add product plans, customers, and enhance deals
--            for multi-gateway payment routing
-- Run via:   Supabase MCP apply_migration or supabase db push
-- ============================================================

-- ─── 1. Extend products table ────────────────────────────────

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS has_plans boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.products.has_plans IS
  'When true, pricing is defined in product_plans rather than base_price';


-- ─── 2. Create product_plans table ───────────────────────────

CREATE TABLE IF NOT EXISTS public.product_plans (
  id                          uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  product_id                  uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,

  -- Identity
  plan_name                   text NOT NULL,
  plan_code                   text,                       -- optional short code e.g. "IL-GI-001"

  -- Targeting
  target_customer_country     text,                       -- 'IL' | 'US' | 'EU' | NULL (default/all)
  target_currency             text,                       -- 'ILS' | 'USD' | 'EUR'

  -- Pricing
  price                       numeric NOT NULL,
  currency                    text NOT NULL DEFAULT 'EUR',
  installments                int NOT NULL DEFAULT 1,

  -- Collection gateway
  collection_gateway          text NOT NULL
    CHECK (collection_gateway IN ('green_invoice', 'thrivecart', 'wise', 'stripe')),
  collection_gateway_product_id text,                     -- product ID in the external gateway
  collection_gateway_link     text,                       -- pre-built checkout link

  -- Vendor payout for this plan
  vendor_id                   uuid REFERENCES public.vendors(id),
  vendor_payout_currency      text CHECK (vendor_payout_currency IN ('ILS', 'USD', 'EUR')),

  -- Meta
  is_default                  boolean NOT NULL DEFAULT false,
  active                      boolean NOT NULL DEFAULT true,
  priority                    int NOT NULL DEFAULT 0,     -- lower = higher priority in suggestions

  created_at                  timestamptz DEFAULT now(),
  updated_at                  timestamptz DEFAULT now()
);

COMMENT ON TABLE public.product_plans IS
  'Pricing variants per product — different gateways, currencies, countries, installment options';

COMMENT ON COLUMN public.product_plans.target_customer_country IS
  'ISO country code (IL, US, EU) that this plan targets. NULL = default for all countries.';

COMMENT ON COLUMN public.product_plans.collection_gateway IS
  'Payment processor that collects money for this plan: green_invoice | thrivecart | wise | stripe';

COMMENT ON COLUMN public.product_plans.collection_gateway_link IS
  'Ready-to-send checkout URL for this specific plan';

COMMENT ON COLUMN public.product_plans.priority IS
  'Lower number = shown first when suggesting plans. 0 = highest priority.';

-- Index for fast lookup by product + country
CREATE INDEX IF NOT EXISTS idx_product_plans_product_id
  ON public.product_plans(product_id);

CREATE INDEX IF NOT EXISTS idx_product_plans_target_country
  ON public.product_plans(target_customer_country);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_plans_updated_at ON public.product_plans;
CREATE TRIGGER trg_product_plans_updated_at
  BEFORE UPDATE ON public.product_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─── 3. Create customers table ───────────────────────────────
-- Represents the paying customer (the person with a credit card),
-- distinct from a "client" (the person receiving the service).
-- In most cases they are the same person, but corporate clients
-- may have a billing contact different from the coaching client.

CREATE TABLE IF NOT EXISTS public.customers (
  id                        uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),

  -- Identity
  email                     text UNIQUE NOT NULL,
  full_name                 text NOT NULL,
  phone                     text,
  country                   text,                         -- ISO country code: IL, US, EU...

  -- External gateway IDs
  thrivecart_customer_id    text,
  green_invoice_client_id   text,

  -- Revenue tracking
  lifetime_value            numeric NOT NULL DEFAULT 0,
  first_purchase_date       timestamptz,
  last_purchase_date        timestamptz,

  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);

COMMENT ON TABLE public.customers IS
  'Paying customers — linked to external payment gateways. '
  'Separate from clients (who receive the service). '
  'Usually 1:1 with clients, but can differ for corporate billing.';

COMMENT ON COLUMN public.customers.country IS
  'ISO country code used for plan auto-suggestion (IL, US, EU, etc.)';

COMMENT ON COLUMN public.customers.lifetime_value IS
  'Sum of all paid deals. Calculated/updated on deal payment.';

CREATE INDEX IF NOT EXISTS idx_customers_email
  ON public.customers(email);

CREATE INDEX IF NOT EXISTS idx_customers_thrivecart_id
  ON public.customers(thrivecart_customer_id);

DROP TRIGGER IF EXISTS trg_customers_updated_at ON public.customers;
CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─── 4. Update clients table ─────────────────────────────────
-- Link operational clients to their billing customer record.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS customer_id_fk uuid REFERENCES public.customers(id);

COMMENT ON COLUMN public.clients.customer_id_fk IS
  'Links to customers table for billing/payment tracking. '
  'Note: clients.customer_id (text) is the legacy external reference — '
  'this column (customer_id_fk) is the FK to the new customers table.';


-- ─── 5. Update deals table ───────────────────────────────────
-- Add plan selection and richer payment tracking fields.

-- Link to the specific product plan used
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS product_plan_id uuid REFERENCES public.product_plans(id);

COMMENT ON COLUMN public.deals.product_plan_id IS
  'Which product plan variant was used (determines gateway, currency, installments)';

-- Payment method details
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS payment_method    text;

COMMENT ON COLUMN public.deals.payment_method IS
  'Actual payment method used: card | bank_transfer | paypal | etc.';

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS payment_link      text;

COMMENT ON COLUMN public.deals.payment_link IS
  'The checkout link sent to customer for this specific deal (copied from plan or overridden)';

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS payment_gateway_id text;

COMMENT ON COLUMN public.deals.payment_gateway_id IS
  'Order/transaction ID in the gateway (e.g. ThriveCart order ID, Stripe payment intent ID)';

-- Payment status tracking
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS payment_status    text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'initiated', 'partial', 'paid', 'refunded', 'failed'));

COMMENT ON COLUMN public.deals.payment_status IS
  'Current payment collection status: pending | initiated | partial | paid | refunded | failed';

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS paid_at           timestamptz;

COMMENT ON COLUMN public.deals.paid_at IS
  'Timestamp of when full payment was received (null = not yet paid)';

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS paid_amount       numeric;

COMMENT ON COLUMN public.deals.paid_amount IS
  'Actual amount received (may differ from deal price due to FX, fees, or partial payments)';

ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS paid_currency     text;

COMMENT ON COLUMN public.deals.paid_currency IS
  'Currency of the actual received payment (may differ from deal currency)';

-- Index for payment status queries
CREATE INDEX IF NOT EXISTS idx_deals_payment_status
  ON public.deals(payment_status);

CREATE INDEX IF NOT EXISTS idx_deals_product_plan_id
  ON public.deals(product_plan_id);
