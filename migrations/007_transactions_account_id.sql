-- Migration 007: Align transactions.account_id to accounts table text FK
-- Run on: Demo DB (pqkzffgpkpovternesmt) AND Production DB (wmqmonjnmgtoilxfqqkv)
-- Keep accounts table unchanged (accounts.id is text).
-- Any legacy account string that does not match accounts.id is set to NULL.

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS account_id_tmp text;

UPDATE transactions t
SET account_id_tmp = a.id
FROM accounts a
WHERE t.account_id = a.id;

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_account_id_fkey;
ALTER TABLE transactions DROP COLUMN IF EXISTS account_id;
ALTER TABLE transactions RENAME COLUMN account_id_tmp TO account_id;
ALTER TABLE transactions
  ADD CONSTRAINT transactions_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL;

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES transactions(id);

CREATE INDEX IF NOT EXISTS transactions_account_id_idx
  ON transactions(account_id);

notify pgrst, 'reload schema';
