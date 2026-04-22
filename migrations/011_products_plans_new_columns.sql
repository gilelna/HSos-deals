-- Migration 011: add new columns to products + plans for products page rebuild
-- products: logo_url, category, status, price_min, price_max, currency, links (jsonb), prd_uid
-- plans: plan_uid (PLN-XXXX), plan_type, status, description, link_source, link_id

-- ── products ──────────────────────────────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS logo_url    text,
  ADD COLUMN IF NOT EXISTS category    text,
  ADD COLUMN IF NOT EXISTS status      text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS price_min   numeric,
  ADD COLUMN IF NOT EXISTS price_max   numeric,
  ADD COLUMN IF NOT EXISTS currency    text,
  ADD COLUMN IF NOT EXISTS links       jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS prd_uid     text UNIQUE;

-- ── plans ─────────────────────────────────────────────────────
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS plan_uid    text UNIQUE,
  ADD COLUMN IF NOT EXISTS plan_type   text,
  ADD COLUMN IF NOT EXISTS status      text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS link_source text,
  ADD COLUMN IF NOT EXISTS link_id     text;

-- Auto-generate plan_uid (PLN-0001, PLN-0002, …)
CREATE SEQUENCE IF NOT EXISTS plan_uid_seq START 1;

CREATE OR REPLACE FUNCTION assign_plan_uid()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.plan_uid IS NULL OR NEW.plan_uid = '' THEN
    NEW.plan_uid := 'PLN-' || lpad(nextval('plan_uid_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_plan_uid ON plans;
CREATE TRIGGER trg_assign_plan_uid
  BEFORE INSERT ON plans
  FOR EACH ROW EXECUTE FUNCTION assign_plan_uid();

-- Auto-generate prd_uid (PRD-0001, PRD-0002, …)
CREATE SEQUENCE IF NOT EXISTS prd_uid_seq START 1;

CREATE OR REPLACE FUNCTION assign_prd_uid()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.prd_uid IS NULL OR NEW.prd_uid = '' THEN
    NEW.prd_uid := 'PRD-' || lpad(nextval('prd_uid_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_prd_uid ON products;
CREATE TRIGGER trg_assign_prd_uid
  BEFORE INSERT ON products
  FOR EACH ROW EXECUTE FUNCTION assign_prd_uid();

NOTIFY pgrst, 'reload schema';
