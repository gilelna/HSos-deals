-- ============================================================
-- Migration: 005_transaction_tags.sql
-- Purpose:   Add transaction_tags lookup table for Registry CRUD
--            and seed from existing data + default pool.
-- ============================================================

create table if not exists public.transaction_tags (
  id         text primary key,
  name       text not null,
  status     text not null default 'active' check (status in ('active', 'inactive')),
  notes      text,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_transaction_tags_name_unique
  on public.transaction_tags (lower(name));

with default_tags(tag) as (
  select unnest(array[
    'ai','amazon','car','car rental','CFO','coaching','consulting','design','donation',
    'editor','event','finance','gas','gift','gym','hotel','israel','mac','macbook',
    'marketing','media','one-timer','parking','photography','platform','podcast',
    'public transportation','rent','scheduling','school','server','support','takeaway',
    'taxi','teacher','team','telecom','train','training','travel','utilities','va',
    'website','broadcast and streaming'
  ]::text[])
),
existing_tags(tag) as (
  select unnest(tags) from public.transactions where tags is not null
  union
  select unnest(tags) from public.vendors where tags is not null
),
all_tags(tag) as (
  select tag from default_tags
  union
  select tag from existing_tags
)
insert into public.transaction_tags (id, name, status)
select
  'tag_' || regexp_replace(lower(trim(tag)), '[^a-z0-9]+', '', 'g') as id,
  trim(tag) as name,
  'active'
from all_tags
where coalesce(trim(tag), '') <> ''
on conflict (id) do update
set
  name = excluded.name;

notify pgrst, 'reload schema';
