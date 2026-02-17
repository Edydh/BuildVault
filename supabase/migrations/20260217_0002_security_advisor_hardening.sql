-- BuildVault: Supabase Security Advisor hardening
-- Date: 2026-02-17

-- 1) Move citext extension out of public schema when needed.
create schema if not exists extensions;

do $$
declare
  ext_schema text;
begin
  select n.nspname
    into ext_schema
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'citext';

  if ext_schema = 'public' then
    alter extension citext set schema extensions;
  end if;
end;
$$;

-- 2) Pin function search_path to remove mutable-search-path warning.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
