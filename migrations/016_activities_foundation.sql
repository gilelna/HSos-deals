-- migrations/016_activities_foundation.sql
-- Patches profiles table and creates activities table + indexes.
-- Run on BOTH demo (pqkzffgpkpovternesmt) and production (wmqmonjnmgtoilxfqqkv).

-- Patch profiles: add missing columns (no-op if they already exist)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email         text UNIQUE,
  ADD COLUMN IF NOT EXISTS slack_user_id text,
  ADD COLUMN IF NOT EXISTS updated_at    timestamptz DEFAULT now();

-- Create activities table
CREATE TABLE IF NOT EXISTS activities (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type   text        NOT NULL,
  entity_id     uuid,
  type          text        NOT NULL,
  subtype       text,
  body          text,
  created_by    uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  origin        text        NOT NULL DEFAULT 'user',
  due_at        timestamptz,
  status        text,
  meta          jsonb       NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activities_entity  ON activities(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activities_type    ON activities(type);
CREATE INDEX IF NOT EXISTS idx_activities_due     ON activities(due_at) WHERE due_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_status  ON activities(status) WHERE status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activities_origin  ON activities(origin);

-- Open anon policy (demo mode)
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'activities' AND policyname = 'anon_all_activities'
  ) THEN
    CREATE POLICY anon_all_activities ON activities FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
