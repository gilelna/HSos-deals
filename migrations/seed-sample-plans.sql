-- ============================================================
-- Seed: seed-sample-plans.sql
-- Purpose:   Real products, product plans, and test customers
--            for the payment routing system.
--            Safe to run multiple times (uses ON CONFLICT DO NOTHING).
-- Depends on: add-product-plans.sql has been applied first
-- ============================================================

-- ─── 1. Insert real products (if they don't exist yet) ────────
-- Fixed UUIDs so this file is idempotent and plans can reference them.

INSERT INTO public.products (id, name, type, base_price, currency, has_plans)
VALUES
  (
    'b1000001-0000-0000-0000-000000000001',
    'Trial Lesson',
    'session',
    50.00,
    'USD',
    true
  ),
  (
    'b1000002-0000-0000-0000-000000000001',
    '10-Lesson Package',
    'package',
    500.00,
    'USD',
    true
  ),
  (
    'b1000003-0000-0000-0000-000000000001',
    '20-Lesson Package',
    'package',
    900.00,
    'USD',
    true
  )
ON CONFLICT (id) DO UPDATE
  SET has_plans = true;          -- re-running always ensures has_plans is set


-- ─── 2. Product plans ─────────────────────────────────────────

INSERT INTO public.product_plans (
  id, product_id,
  plan_name, plan_code,
  target_customer_country, target_currency,
  price, currency, installments,
  collection_gateway, collection_gateway_product_id, collection_gateway_link,
  vendor_id, vendor_payout_currency,
  is_default, active, priority
) VALUES

-- ── Trial Lesson ──────────────────────────────────────────────

-- IL: 180 ILS, Green Invoice, single payment
(
  'a1010001-0000-0000-0000-000000000001',
  'b1000001-0000-0000-0000-000000000001',
  'Israel — Green Invoice',
  'IL-GI-TRIAL',
  'IL', 'ILS',
  180, 'ILS', 1,
  'green_invoice', 'GI-PROD-TRIAL-001', NULL,
  NULL, 'ILS',
  false, true, 10
),

-- US: 50 USD, ThriveCart, single payment
(
  'a1010001-0000-0000-0000-000000000002',
  'b1000001-0000-0000-0000-000000000001',
  'US — ThriveCart',
  'US-TC-TRIAL',
  'US', 'USD',
  50, 'USD', 1,
  'thrivecart', 'TC-PROD-TRIAL-USD', 'https://tc.thrivecart.com/trial-lesson-usd/',
  NULL, 'USD',
  false, true, 20
),

-- EU: 45 EUR, ThriveCart, single payment (default for all other countries)
(
  'a1010001-0000-0000-0000-000000000003',
  'b1000001-0000-0000-0000-000000000001',
  'Europe — ThriveCart (default)',
  'EU-TC-TRIAL',
  NULL, 'EUR',
  45, 'EUR', 1,
  'thrivecart', 'TC-PROD-TRIAL-EUR', 'https://tc.thrivecart.com/trial-lesson-eur/',
  NULL, 'EUR',
  true, true, 0
),

-- ── 10-Lesson Package ─────────────────────────────────────────

-- IL: 1800 ILS, Green Invoice, single payment
(
  'a1020001-0000-0000-0000-000000000001',
  'b1000002-0000-0000-0000-000000000001',
  'Israel — Green Invoice',
  'IL-GI-10L',
  'IL', 'ILS',
  1800, 'ILS', 1,
  'green_invoice', 'GI-PROD-10L-001', NULL,
  NULL, 'ILS',
  false, true, 10
),

-- US: 500 USD, ThriveCart, single payment
(
  'a1020001-0000-0000-0000-000000000002',
  'b1000002-0000-0000-0000-000000000001',
  'US — ThriveCart (single)',
  'US-TC-10L-1P',
  'US', 'USD',
  500, 'USD', 1,
  'thrivecart', 'TC-PROD-10L-USD-1P', 'https://tc.thrivecart.com/10-lessons-usd/',
  NULL, 'USD',
  false, true, 20
),

-- US: 520 USD, ThriveCart, 3 installments
(
  'a1020001-0000-0000-0000-000000000003',
  'b1000002-0000-0000-0000-000000000001',
  'US — ThriveCart (3 installments)',
  'US-TC-10L-3P',
  'US', 'USD',
  520, 'USD', 3,
  'thrivecart', 'TC-PROD-10L-USD-3P', 'https://tc.thrivecart.com/10-lessons-usd-3pay/',
  NULL, 'USD',
  false, true, 25
),

-- EU: 480 EUR, ThriveCart, single payment (default)
(
  'a1020001-0000-0000-0000-000000000004',
  'b1000002-0000-0000-0000-000000000001',
  'Europe — ThriveCart (single, default)',
  'EU-TC-10L-1P',
  NULL, 'EUR',
  480, 'EUR', 1,
  'thrivecart', 'TC-PROD-10L-EUR-1P', 'https://tc.thrivecart.com/10-lessons-eur/',
  NULL, 'EUR',
  true, true, 0
),

-- EU: 500 EUR, ThriveCart, 3 installments
(
  'a1020001-0000-0000-0000-000000000005',
  'b1000002-0000-0000-0000-000000000001',
  'Europe — ThriveCart (3 installments)',
  'EU-TC-10L-3P',
  NULL, 'EUR',
  500, 'EUR', 3,
  'thrivecart', 'TC-PROD-10L-EUR-3P', 'https://tc.thrivecart.com/10-lessons-eur-3pay/',
  NULL, 'EUR',
  false, true, 5
),

-- ── 20-Lesson Package ─────────────────────────────────────────

-- IL: 3200 ILS, Green Invoice, single payment
(
  'a1030001-0000-0000-0000-000000000001',
  'b1000003-0000-0000-0000-000000000001',
  'Israel — Green Invoice',
  'IL-GI-20L',
  'IL', 'ILS',
  3200, 'ILS', 1,
  'green_invoice', 'GI-PROD-20L-001', NULL,
  NULL, 'ILS',
  false, true, 10
),

-- US: 900 USD, ThriveCart, single payment
(
  'a1030001-0000-0000-0000-000000000002',
  'b1000003-0000-0000-0000-000000000001',
  'US — ThriveCart (single)',
  'US-TC-20L-1P',
  'US', 'USD',
  900, 'USD', 1,
  'thrivecart', 'TC-PROD-20L-USD-1P', 'https://tc.thrivecart.com/20-lessons-usd/',
  NULL, 'USD',
  false, true, 20
),

-- US: 950 USD, ThriveCart, 3 installments
(
  'a1030001-0000-0000-0000-000000000003',
  'b1000003-0000-0000-0000-000000000001',
  'US — ThriveCart (3 installments)',
  'US-TC-20L-3P',
  'US', 'USD',
  950, 'USD', 3,
  'thrivecart', 'TC-PROD-20L-USD-3P', 'https://tc.thrivecart.com/20-lessons-usd-3pay/',
  NULL, 'USD',
  false, true, 25
),

-- EU: 850 EUR, ThriveCart, single payment (default)
(
  'a1030001-0000-0000-0000-000000000004',
  'b1000003-0000-0000-0000-000000000001',
  'Europe — ThriveCart (single, default)',
  'EU-TC-20L-1P',
  NULL, 'EUR',
  850, 'EUR', 1,
  'thrivecart', 'TC-PROD-20L-EUR-1P', 'https://tc.thrivecart.com/20-lessons-eur/',
  NULL, 'EUR',
  true, true, 0
),

-- EU: 900 EUR, ThriveCart, 3 installments
(
  'a1030001-0000-0000-0000-000000000005',
  'b1000003-0000-0000-0000-000000000001',
  'Europe — ThriveCart (3 installments)',
  'EU-TC-20L-3P',
  NULL, 'EUR',
  900, 'EUR', 3,
  'thrivecart', 'TC-PROD-20L-EUR-3P', 'https://tc.thrivecart.com/20-lessons-eur-3pay/',
  NULL, 'EUR',
  false, true, 5
)

ON CONFLICT (id) DO NOTHING;


-- ─── 3. Test customers ────────────────────────────────────────

INSERT INTO public.customers (
  id, email, full_name, phone, country,
  lifetime_value
) VALUES

-- Israel
(
  'c0000002-0000-0000-0000-000000000001',
  'anna@example.com',
  'Anna Israeli',
  '+972-50-111-2233',
  'IL',
  0
),

-- USA
(
  'c0000002-0000-0000-0000-000000000002',
  'john@example.com',
  'John American',
  '+1-555-100-2000',
  'US',
  0
),

-- France (EU)
(
  'c0000002-0000-0000-0000-000000000003',
  'marie@example.com',
  'Marie Dupont',
  '+33-1-23-45-67-89',
  'FR',
  0
)

ON CONFLICT (email) DO NOTHING;
