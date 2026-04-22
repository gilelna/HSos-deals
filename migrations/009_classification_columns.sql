-- ================================================================
-- Migration 009: Classification columns on transactions + vendors
-- Run in BOTH Supabase projects:
--   Demo:       https://pqkzffgpkpovternesmt.supabase.co
--   Production: https://wmqmonjnmgtoilxfqqkv.supabase.co
-- ================================================================

BEGIN;

-- transactions: classification columns
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS category_id   text REFERENCES transaction_categories(id),
  ADD COLUMN IF NOT EXISTS tax_treatment text,
  ADD COLUMN IF NOT EXISTS entity        text CHECK (entity IN ('business', 'private')),
  ADD COLUMN IF NOT EXISTS tags          text[] DEFAULT '{}';

-- vendors: classification defaults + match patterns (aliases)
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS category_id   text,
  ADD COLUMN IF NOT EXISTS tax_treatment text,
  ADD COLUMN IF NOT EXISTS entity        text CHECK (entity IN ('business', 'private')),
  ADD COLUMN IF NOT EXISTS tags          text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS match_patterns text[] DEFAULT '{}';

NOTIFY pgrst, 'reload schema';

COMMIT;
