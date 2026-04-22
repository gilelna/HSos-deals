-- ============================================================
-- Migration: 004_products_plans_transactions.sql
-- Purpose:   Add programs, products (uuid-PK), plans (uuid-PK),
--            transactions tables; alter deals + packages.
-- Run via:   Supabase MCP apply_migration or SQL Editor
-- IMPORTANT: Run notify pgrst after applying (included at end)
-- ============================================================

-- ─── programs ────────────────────────────────────────────────

create table if not exists programs (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  slug             text unique,
  description      text,
  logo_url         text,
  audience_segment text,
  active           boolean default true,
  created_at       timestamptz default now()
);

-- ─── products (uuid-PK, new generation) ──────────────────────
-- NOTE: A text-PK products table may already exist from the
-- 2026-04-12 schema session. This creates a separate uuid-PK
-- products table. Confirm table does not already exist before
-- running if there is any doubt.

create table if not exists products (
  id                uuid primary key default gen_random_uuid(),
  program_id        uuid references programs(id),
  name              text not null,
  description       text,
  sessions_included integer,
  vendor_type       text,
  base_price        numeric,
  base_currency     text default 'USD',
  active            boolean default true,
  created_at        timestamptz default now()
);

-- ─── plans (uuid-PK, new generation) ─────────────────────────
-- NOTE: Same caveat as products above — a text-PK plans table
-- may already exist. Verify before running.

create table if not exists plans (
  id                  uuid primary key default gen_random_uuid(),
  product_id          uuid references products(id),
  name                text not null,
  payment_type        text check (payment_type in ('one_time','installment','subscription','manual')),
  installments_count  integer,
  amount              numeric,
  currency            text default 'USD',
  payment_rail        text check (payment_rail in ('thrivecart','green_invoice','wise','bank_transfer','manual')),
  payment_link_url    text,
  external_id         text,        -- ThriveCart item_id or equivalent
  active              boolean default true,
  created_at          timestamptz default now()
);

-- ─── transactions ─────────────────────────────────────────────
-- NOTE: A transactions table may already exist from the
-- 2026-04-12 schema session (text-PK generation).
-- This uuid-PK version supersedes it for the reconciliation
-- pipeline. Drop or rename the old one before running if needed.

create table if not exists transactions (
  id                   uuid primary key default gen_random_uuid(),

  -- Source & direction
  source               text check (source in ('thrivecart','green_invoice','wise','bank','manual')),
  direction            text check (direction in ('in','out')),
  external_id          text,
  status               text default 'unmatched' check (status in ('unmatched','matched','reconciled')),

  -- Amounts
  amount               numeric,
  currency             text,
  exchange_rate        numeric,
  amount_ils           numeric,

  -- Counterparty
  counterparty_name    text,
  counterparty_account text,
  reference            text,

  -- Event classification
  -- thrivecart : purchase | recur_success | recur_fail | recur_cancel | refund
  -- bank        : credit | debit
  -- wise        : transfer_in | transfer_out
  -- green_invoice: invoice | receipt | cancel
  event_type           text,

  -- Dates
  transaction_date     date,
  settled_date         date,

  -- Installment tracking
  -- ThriveCart  : parsed from invoice_id suffix (e.g. 004216105-1 → 1)
  -- Green Invoice: parsed from payment sequence field if present
  -- null for one_time payments
  installment_index    integer,

  -- Entity linkage
  linked_entity_type   text check (linked_entity_type in ('deal','paycheck','expense')),
  linked_entity_id     uuid,

  -- Plan linkage
  plan_id              uuid references plans(id),

  -- Classification
  tax_category         text,
  category             text,
  tags                 text[],

  -- Raw payload preserved for auditing / re-parsing
  raw_data             jsonb,

  created_at           timestamptz default now()
);

-- ─── alter deals ──────────────────────────────────────────────

alter table deals
  add column if not exists product_id       uuid references products(id),
  add column if not exists plan_id          uuid references plans(id),
  add column if not exists agreed_price     numeric,
  add column if not exists agreed_currency  text,
  add column if not exists origin           text default 'manual'
    check (origin in ('manual','thrivecart','green_invoice','other')),
  add column if not exists external_id      text;

-- ─── alter packages ───────────────────────────────────────────

alter table packages
  add column if not exists product_id    uuid references products(id),
  add column if not exists sessions_total integer;

-- ─── indexes ──────────────────────────────────────────────────

create index if not exists idx_transactions_source_external_id
  on transactions(source, external_id);

create index if not exists idx_transactions_status
  on transactions(status);

create index if not exists idx_transactions_plan_id
  on transactions(plan_id);

create index if not exists idx_transactions_linked_entity
  on transactions(linked_entity_type, linked_entity_id);

create index if not exists idx_plans_external_id
  on plans(external_id);

create index if not exists idx_plans_product_id
  on plans(product_id);

create index if not exists idx_products_program_id
  on products(program_id);

-- ─── reload PostgREST schema cache ───────────────────────────

notify pgrst, 'reload schema';
