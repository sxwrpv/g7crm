-- Weekly automated client reports
--
-- 1) Per-client attribution: client_id on lead_submissions / interactions /
--    tasks. A row with client_id = NULL is G7's own pipeline; a row pointing
--    at a customers row (record_type='client') belongs to that client's
--    delivery. This is the minimal slice of the multi-tenant build needed
--    for reporting — full clients table can still come at client #3.
-- 2) Scheduling/authentication is installed by the later security-foundations
--    migration, which reads the caller credential from Supabase Vault.

create extension if not exists pg_cron;

alter table public.lead_submissions
  add column if not exists client_id uuid references public.customers(id) on delete set null;

alter table public.interactions
  add column if not exists client_id uuid references public.customers(id) on delete set null;

alter table public.tasks
  add column if not exists client_id uuid references public.customers(id) on delete set null;

create index if not exists idx_lead_submissions_client on public.lead_submissions(client_id);
create index if not exists idx_interactions_client   on public.interactions(client_id);
create index if not exists idx_tasks_client          on public.tasks(client_id);

-- Scheduling and request authorization moved to
-- 20260729_security_foundations.sql. That migration reads the caller credential
-- from Supabase Vault and deliberately makes no request when it is absent.
