-- migrations/create-import-logs.sql
-- Run once to create the import audit table and helper RPC.

-- Helper function: used by supabase-adapter.js to read column metadata.
-- Falls back gracefully to PostgREST information_schema if RPC unavailable.
create or replace function get_table_columns(p_table text)
returns table (
  column_name  text,
  data_type    text,
  is_nullable  text,
  column_default text
)
language sql
security definer
as $$
  select
    column_name::text,
    data_type::text,
    is_nullable::text,
    column_default::text
  from information_schema.columns
  where table_schema = 'public'
    and table_name   = p_table
  order by ordinal_position;
$$;

create table if not exists import_logs (
  id              uuid primary key default gen_random_uuid(),
  entity_type     text not null,
  table_name      text not null,
  batch_id        uuid not null,
  rows_total      int,
  rows_imported   int,
  rows_skipped    int,
  rows_failed     int,
  column_mapping  jsonb,   -- snapshot: { "CSV Header": "db_column", ... }
  imported_by     text default 'demo',
  created_at      timestamptz default now()
);
