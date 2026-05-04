-- schema/add_users_roles.sql
-- Adds the public.users table that mirrors auth.users with a role column,
-- plus a trigger that auto-creates a row whenever a new auth user signs up.
--
-- ⚠️  DO NOT APPLY YET — run manually in the Supabase SQL editor when ready.
-- Note: SCHEMA.md already documents a public.profiles table with a similar
-- shape (system_role enum). This file follows the spec verbatim with a
-- separate public.users table; reconcile with profiles before running.

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  role text not null default 'vendor'
    check (role in ('vendor', 'manager', 'admin')),
  created_at timestamptz default now()
);

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    'vendor'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
