-- ================================================================
-- Migration 008: Transaction Drawer, Dedup, Audit Log
-- Run in BOTH Supabase projects:
--   Demo:       https://pqkzffgpkpovternesmt.supabase.co
--   Production: https://wmqmonjnmgtoilxfqqkv.supabase.co
-- ================================================================

BEGIN;

-- ── A. import_id on transactions ─────────────────────────────────
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS import_id text REFERENCES transaction_imports(id);

CREATE INDEX IF NOT EXISTS idx_transactions_import_id
  ON transactions(import_id);

-- ── B. soft delete ────────────────────────────────────────────────
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_deleted
  ON transactions(deleted_at)
  WHERE deleted_at IS NULL;

-- ── C. duplicate_of ──────────────────────────────────────────────
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES transactions(id);

-- ── D. audit_log table ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  text NOT NULL,   -- 'transaction' | 'vendor' | 'import' | etc.
  entity_id    text NOT NULL,
  action       text NOT NULL,   -- 'create' | 'update' | 'delete' | 'classify' | 'import' | 'restore'
  changed_by   text NOT NULL DEFAULT 'admin',
  old_data     jsonb,
  new_data     jsonb,
  meta         jsonb,           -- extra context: { field, import_id, rule_id, etc. }
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity
  ON audit_log(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_created
  ON audit_log(created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_log' AND policyname = 'anon_all_audit_log'
  ) THEN
    CREATE POLICY "anon_all_audit_log" ON audit_log FOR ALL USING (true);
  END IF;
END$$;

COMMIT;
