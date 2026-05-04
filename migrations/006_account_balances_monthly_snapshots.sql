-- Migration 006: account_balances — monthly opening/closing snapshots
-- Run on BOTH demo and production databases.
-- Old table (uuid PK, date/balance/balance_type) had no real FK to accounts.
-- New table (text PK, proper FK to accounts.id, month+opening+closing model).
--
-- DEMO NOTE: 1 row of test data existed — dropping is safe (no real data).
-- PRODUCTION: table was already empty when this migration ran (2026-04-13).

DROP TABLE IF EXISTS account_balances CASCADE;

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

ALTER TABLE account_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all" ON account_balances;
CREATE POLICY "anon_all" ON account_balances FOR ALL TO anon USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
