-- seed_demo_data.sql — HSos Demo DB seed (idempotent)
-- Run on: pqkzffgpkpovternesmt.supabase.co
-- All inserts use ON CONFLICT DO NOTHING so re-runs are safe.
-- Generated: 2026-04-12

-- ─── VENDOR TYPE CORRECTIONS ────────────────────────────────────
-- Sets first 6 vendors to coach, next 3 to team_member, rest contractor

UPDATE vendors SET vendor_type = 'coach' WHERE id IN (
  '06c21041-f45f-48ac-968e-158029538ad0',
  '46c859c8-3a62-459e-a41c-4426fdd3213e',
  '490f2c6d-8f94-4f45-b778-3fc9f492c555',
  '4a99814c-df84-441e-a39c-95bd53cd4a9d',
  '61350738-3488-471d-9a61-a2d8894307a6',
  '63e88b62-514c-4123-9e3b-fa686c7f4a15'
);
UPDATE vendors SET vendor_type = 'team_member' WHERE id IN (
  '76fdba3b-5684-424f-856d-f2c350b7b19c',
  '7a7c6463-5feb-4b22-9afc-9d3f6e0ec802',
  '8da706a5-2d53-47c9-9c96-740ef67f5398'
);

-- ─── SESSIONS_USED SYNC ─────────────────────────────────────────
-- Resyncs packages.sessions_used to match live session count

UPDATE packages p
SET sessions_used = sub.live_count,
    status = CASE
      WHEN sub.live_count >= p.total_sessions THEN 'completed'::package_status
      WHEN p.status = 'cancelled'::package_status THEN 'cancelled'::package_status
      ELSE 'active'::package_status
    END
FROM (
  SELECT p2.id, COUNT(s.id) as live_count
  FROM packages p2
  LEFT JOIN sessions s ON s.client_id = p2.client_id
    AND s.vendor_id = p2.vendor_id
    AND s.task_type_id IS NOT NULL
  GROUP BY p2.id
  HAVING p2.sessions_used != COUNT(s.id)
) sub
WHERE p.id = sub.id;

-- ─── DEALS PRODUCT_ID CLEANUP ───────────────────────────────────
-- Null out product_ids pointing to non-existent products

UPDATE deals
SET product_id = NULL
WHERE product_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM products pr WHERE pr.id = deals.product_id);

-- ─── TRANSACTIONS (if table is empty, seed sample data) ─────────
-- Only inserts if transactions count < 10

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM transactions) < 10 THEN

    -- 3 incoming matched payments
    INSERT INTO transactions (id, transaction_date, counterparty_name, direction, amount, currency, status, category, source)
    VALUES
      (gen_random_uuid(), '2026-03-15', 'Dana Weiss',    'in', 600.00, 'EUR', 'matched',   'client_payment', 'bank'),
      (gen_random_uuid(), '2026-03-20', 'Daniel Cohen',  'in', 360.00, 'EUR', 'matched',   'client_payment', 'bank'),
      (gen_random_uuid(), '2026-04-01', 'Omer Haddad',   'in', 360.00, 'EUR', 'matched',   'client_payment', 'bank')
    ON CONFLICT DO NOTHING;

    -- 3 outgoing vendor payments
    INSERT INTO transactions (id, transaction_date, counterparty_name, direction, amount, currency, status, category, source)
    VALUES
      (gen_random_uuid(), '2026-03-07', 'Vendor 09 payment', 'out', -720.00, 'USD', 'matched', 'vendor_payment', 'bank'),
      (gen_random_uuid(), '2026-02-05', 'Vendor 18 payment', 'out', -500.00, 'USD', 'matched', 'vendor_payment', 'bank'),
      (gen_random_uuid(), '2026-04-06', 'Vendor 18 payment', 'out', -210.00, 'USD', 'matched', 'vendor_payment', 'bank')
    ON CONFLICT DO NOTHING;

    -- 2 unmatched incoming
    INSERT INTO transactions (id, transaction_date, counterparty_name, direction, amount, currency, status, source)
    VALUES
      (gen_random_uuid(), '2026-04-10', 'Unknown Client A', 'in', 250.00, 'USD', 'unmatched', 'paypal'),
      (gen_random_uuid(), '2026-04-11', 'Unknown Client B', 'in', 180.00, 'EUR', 'unmatched', 'stripe')
    ON CONFLICT DO NOTHING;

    -- 2 outgoing expenses
    INSERT INTO transactions (id, transaction_date, counterparty_name, direction, amount, currency, status, category, source)
    VALUES
      (gen_random_uuid(), '2026-03-31', 'Google Workspace', 'out', -24.00,  'USD', 'matched', 'software', 'bank'),
      (gen_random_uuid(), '2026-04-01', 'Zoom Subscription', 'out', -16.00, 'USD', 'matched', 'software', 'bank')
    ON CONFLICT DO NOTHING;

  END IF;
END $$;
