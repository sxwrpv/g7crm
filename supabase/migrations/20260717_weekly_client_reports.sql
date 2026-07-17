-- Weekly automated client reports
--
-- 1) Per-client attribution: client_id on lead_submissions / interactions /
--    tasks. A row with client_id = NULL is G7's own pipeline; a row pointing
--    at a customers row (record_type='client') belongs to that client's
--    delivery. This is the minimal slice of the multi-tenant build needed
--    for reporting — full clients table can still come at client #3.
-- 2) pg_cron job: every Monday 08:00 UTC → POST to the weekly-report edge
--    function (same pg_net pattern as the lead-intake trigger), with a
--    shared-secret header the function can verify (set REPORT_SECRET in the
--    function env to enforce it).

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

-- Re-schedule idempotently
do $$
begin
  perform cron.unschedule('weekly-client-reports');
exception when others then null;
end $$;

select cron.schedule(
  'weekly-client-reports',
  '0 8 * * 1',   -- Monday 08:00 UTC = 09:00 Dublin (summer) / 08:00 (winter)
  $$
  select net.http_post(
    url := 'https://fbstesgbttojfysznddq.supabase.co/functions/v1/weekly-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-g7-secret', '57d8062ccfc7010890ba047896138017afe57f88769ee174'
    ),
    body := '{"source":"pg_cron","job":"weekly-client-reports"}'::jsonb,
    timeout_milliseconds := 15000
  );
  $$
);
