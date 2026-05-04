-- Migration 012: align plans table with products page write payload
-- Adds columns expected by updatePlanFull/createPlanFull.

BEGIN;

ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS link_id text,
  ADD COLUMN IF NOT EXISTS link_source text,
  ADD COLUMN IF NOT EXISTS link_url text,
  ADD COLUMN IF NOT EXISTS plan_type text,
  ADD COLUMN IF NOT EXISTS status text;

NOTIFY pgrst, 'reload schema';

COMMIT;
