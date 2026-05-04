-- Migration 015: profiles table — role foundation for Phase 2 auth
-- Links auth.users to a role + optional vendor identity.
-- Demo mode: table exists but is unpopulated (role comes from sessionStorage).
-- Phase 2: on Google OAuth login, fetch this row and call Role.set() with real role.
-- Run on BOTH envs: demo (pqkzffgpkpovternesmt) and production (wmqmonjnmgtoilxfqqkv)

-- Drop and recreate to ensure correct shape
-- (table existed before with unknown columns — this is safe, 0 rows)
DROP TABLE IF EXISTS profiles CASCADE;

CREATE TABLE profiles (
  id          uuid PRIMARY KEY,  -- matches auth.users.id (set after Google OAuth)
  role        system_role NOT NULL DEFAULT 'vendor',
  vendor_id   text REFERENCES vendors(id) ON DELETE SET NULL,
  full_name   text,
  email       text UNIQUE,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- RLS: open for demo (anon); will be tightened in Phase 2
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_profiles" ON profiles;
CREATE POLICY "anon_all_profiles" ON profiles FOR ALL TO anon USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
