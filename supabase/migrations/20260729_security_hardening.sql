-- Final security cutover. Apply only after:
--   1. 20260729_security_foundations.sql is applied,
--   2. submit-lead is deployed and verified,
--   3. the Turnstile-enabled public form is deployed and verified.
-- The operator assertion runs before any policy replacement or anon revocation,
-- so a missing bootstrap user rolls back the migration instead of locking out
-- the dashboard.

create table if not exists public.crm_operators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.crm_operators enable row level security;
revoke all on public.crm_operators from anon, authenticated;

create or replace function public.is_crm_operator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.crm_operators
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_crm_operator() from public;
grant execute on function public.is_crm_operator() to authenticated;

-- Bootstrap only the intended, confirmed, non-banned operator.
insert into public.crm_operators (user_id)
select id
from auth.users
where lower(email) = 'hello@g7systems.xyz'
  and email_confirmed_at is not null
  and (banned_until is null or banned_until < now())
on conflict (user_id) do nothing;

-- Fail before policy changes unless that exact usable operator is present.
do $$
begin
  if not exists (
    select 1
    from public.crm_operators operators
    join auth.users users on users.id = operators.user_id
    where lower(users.email) = 'hello@g7systems.xyz'
      and users.email_confirmed_at is not null
      and (users.banned_until is null or users.banned_until < now())
  ) then
    raise exception using
      message = 'security hardening aborted: confirmed hello@g7systems.xyz operator is missing',
      hint = 'Create, confirm, and verify the intended Supabase Auth user before retrying';
  end if;
end $$;

-- Remove browser-bypassable policies and require server-controlled membership.
do $policies$
declare
  table_name text;
begin
  foreach table_name in array array[
    'customers', 'deals', 'tasks', 'interactions', 'lead_submissions',
    'client_systems', 'automation_runs', 'products'
  ]
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('drop policy if exists %I on public.%I', 'Allow all on ' || table_name, table_name);
      execute format('drop policy if exists %I on public.%I', 'authenticated full access ' || table_name, table_name);
      execute format('drop policy if exists %I on public.%I', 'crm operators manage ' || table_name, table_name);
      execute format(
        'create policy %I on public.%I for all to authenticated using (public.is_crm_operator()) with check (public.is_crm_operator())',
        'crm operators manage ' || table_name,
        table_name
      );
    end if;
  end loop;
end
$policies$;

-- Public visitors now enter only through submit-lead.
drop policy if exists "anon insert leads" on public.lead_submissions;
revoke insert on public.lead_submissions from anon;
