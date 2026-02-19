-- BuildVault: reliable project creation RPC with explicit auth checks
-- Date: 2026-02-19
--
-- Why:
-- Direct PostgREST INSERT on public.projects can fail with RLS despite valid auth/session.
-- This RPC keeps security explicit and stable while avoiding client-side insert path issues.

create or replace function public.create_project(
  p_name text,
  p_client text default null,
  p_location text default null,
  p_organization_id uuid default null,
  p_start_date timestamptz default null,
  p_end_date timestamptz default null,
  p_budget numeric default null
)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_project public.projects%rowtype;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Project name is required';
  end if;

  if p_organization_id is not null then
    if not (
      public.is_org_member(p_organization_id, v_user_id)
      or exists (
        select 1
        from public.organizations o
        where o.id = p_organization_id
          and o.owner_user_id = v_user_id
      )
    ) then
      raise exception 'You do not have permission to create projects in this workspace.';
    end if;
  end if;

  insert into public.projects (
    owner_user_id,
    organization_id,
    name,
    client,
    location,
    status,
    progress,
    start_date,
    end_date,
    budget,
    visibility
  )
  values (
    v_user_id,
    p_organization_id,
    trim(p_name),
    nullif(trim(coalesce(p_client, '')), ''),
    nullif(trim(coalesce(p_location, '')), ''),
    'neutral',
    0,
    p_start_date,
    p_end_date,
    p_budget,
    'private'
  )
  returning * into v_project;

  return v_project;
end;
$$;

grant execute on function public.create_project(text, text, text, uuid, timestamptz, timestamptz, numeric)
to authenticated;
