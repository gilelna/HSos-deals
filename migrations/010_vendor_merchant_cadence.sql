-- ================================================================
-- Migration 010: vendor_type enum + payment_cadence
-- Run on BOTH envs:
--   Demo:       pqkzffgpkpovternesmt.supabase.co
--   Production: wmqmonjnmgtoilxfqqkv.supabase.co
-- After running: update SCHEMA.md migration log
-- ================================================================

BEGIN;

-- 1. Add 'merchant' to vendor_type enum (safe — ADD VALUE is non-transactional in PG)
-- Wrapped in DO block so it doesn't fail if already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'merchant'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'vendor_type')
  ) THEN
    ALTER TYPE vendor_type ADD VALUE 'merchant';
  END IF;
END$$;

-- 2. Add payment_cadence to vendors
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS payment_cadence text
    CHECK (payment_cadence IN ('recurring', 'project_based', 'one_time'));

-- 3. Add payment_cadence to transactions (inherited from vendor on match)
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS payment_cadence text
    CHECK (payment_cadence IN ('recurring', 'project_based', 'one_time'));

-- 4. Add vendor_id to transactions if missing (migration 008 may not have added it)
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS vendor_id text REFERENCES vendors(id);

-- 5. Set default payment_cadence for existing vendors by type
UPDATE vendors SET payment_cadence = 'project_based'
  WHERE vendor_type IN ('coach', 'contractor') AND payment_cadence IS NULL;

UPDATE vendors SET payment_cadence = 'recurring'
  WHERE vendor_type = 'team_member' AND payment_cadence IS NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;
