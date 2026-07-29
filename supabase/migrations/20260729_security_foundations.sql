-- Security foundations that must exist before deploying the protected form.
-- This migration does not revoke the legacy anonymous lead insert yet; the
-- final cutover is 20260729_security_hardening.sql after the new form is live.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

-- ---------------------------------------------------------------------------
-- Atomic, database-backed request quotas (hashed keys only)

create table if not exists public.lead_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 1)
);

alter table public.lead_rate_limits enable row level security;
revoke all on public.lead_rate_limits from anon, authenticated;
create index if not exists lead_rate_limits_window_idx
  on public.lead_rate_limits (window_started_at);

create or replace function public.consume_lead_rate_limit(
  p_key_hash text,
  p_limit integer default 5,
  p_window_seconds integer default 900
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_at timestamptz := clock_timestamp();
  current_count integer;
begin
  if p_key_hash !~ '^[0-9a-f]{64}$'
     or p_limit < 1 or p_limit > 1000
     or p_window_seconds < 60 or p_window_seconds > 86400 then
    return false;
  end if;

  insert into public.lead_rate_limits as limits
    (key_hash, window_started_at, request_count)
  values
    (p_key_hash, now_at, 1)
  on conflict (key_hash) do update
  set
    window_started_at = case
      when limits.window_started_at <= now_at - make_interval(secs => p_window_seconds)
      then now_at else limits.window_started_at end,
    request_count = case
      when limits.window_started_at <= now_at - make_interval(secs => p_window_seconds)
      then 1 else limits.request_count + 1 end
  returning request_count into current_count;

  return current_count <= p_limit;
end;
$$;

revoke all on function public.consume_lead_rate_limit(text, integer, integer) from public;
grant execute on function public.consume_lead_rate_limit(text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Atomic intake transaction. All database effects succeed or roll back
-- together, so a timeout cannot strand a claim or leave a processed lead
-- without its required task and audit row.

alter table public.lead_submissions
  drop constraint if exists lead_submissions_submission_status_check;

alter table public.lead_submissions
  add constraint lead_submissions_submission_status_check
  check (submission_status in ('new','processing','processed','duplicate','spam','archived'));

alter table public.tasks
  add column if not exists source_lead_submission_id uuid
    references public.lead_submissions(id) on delete set null;

create unique index if not exists tasks_source_lead_submission_uidx
  on public.tasks (source_lead_submission_id);

alter table public.automation_runs
  add column if not exists idempotency_key text;

create unique index if not exists automation_runs_idempotency_uidx
  on public.automation_runs (idempotency_key);

create or replace function public.process_lead_submission(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  lead_row public.lead_submissions%rowtype;
  customer_id_value uuid;
  task_id_value uuid;
  customer_email text;
  next_action_value text;
  priority_value text;
  title_value text;
  description_value text;
  due_date_value date;
  summary_value text;
begin
  select *
  into lead_row
  from public.lead_submissions
  where id = p_id
    and submission_status = 'new'
  for update skip locked;

  if not found then
    return null;
  end if;

  update public.lead_submissions
  set submission_status = 'processing'
  where id = lead_row.id;

  customer_email := coalesce(
    nullif(lower(trim(lead_row.lead_email)), ''),
    'missing-' || replace(lead_row.id::text, '-', '') || '@placeholder.local'
  );

  next_action_value := case lead_row.inquiry_type
    when 'booking' then 'Confirm booking request and lock time.'
    when 'urgent-call' then 'Call back immediately.'
    else 'Review new inbound lead and qualify.'
  end;

  insert into public.customers (
    name, company, email, phone, record_type, niche, source_channel,
    onboarding_status, preferred_alert_channel, next_action,
    last_contacted_at
  ) values (
    coalesce(nullif(lead_row.lead_name, ''), nullif(lead_row.business_name, ''), 'Unknown lead'),
    lead_row.business_name,
    customer_email,
    lead_row.lead_phone,
    'lead',
    'Home Services',
    coalesce(lead_row.source_channel, 'website-form'),
    'not-started',
    'email',
    next_action_value,
    clock_timestamp()
  )
  on conflict (email) do update
  set
    phone = coalesce(excluded.phone, customers.phone),
    company = coalesce(customers.company, excluded.company),
    next_action = excluded.next_action,
    last_contacted_at = excluded.last_contacted_at
  returning id into customer_id_value;

  priority_value := case lead_row.urgency
    when 'emergency' then 'urgent'
    when 'high' then 'high'
    else 'medium'
  end;

  title_value := case lead_row.inquiry_type
    when 'urgent-call' then 'Urgent call: ' || coalesce(lead_row.business_name, 'Unknown business')
    when 'booking' then 'Booking: ' || coalesce(lead_row.business_name, 'Unknown business')
    else 'Follow up: ' || coalesce(lead_row.business_name, 'Unknown business')
  end;

  description_value := trim(concat_ws(
    E'\n',
    lead_row.service_requested,
    case when nullif(lead_row.message, '') is not null then 'Message: ' || lead_row.message end
  ));

  due_date_value := case
    when lead_row.inquiry_type = 'booking' then lead_row.requested_booking_date
    else null
  end;

  insert into public.tasks (
    customer_id, title, description, status, task_type, priority,
    assigned_to, due_date, source_lead_submission_id
  ) values (
    customer_id_value, title_value, description_value, 'pending', 'follow-up',
    priority_value, 'ops', due_date_value, lead_row.id
  )
  on conflict (source_lead_submission_id) do update
    set source_lead_submission_id = excluded.source_lead_submission_id
  returning id into task_id_value;

  summary_value := case lead_row.inquiry_type
    when 'urgent-call' then 'Urgent call request for ' || coalesce(lead_row.business_name, 'Unknown business')
    when 'booking' then 'Booking request for ' || coalesce(lead_row.business_name, 'Unknown business')
    else 'New inbound lead for ' || coalesce(lead_row.business_name, 'Unknown business')
  end;

  insert into public.automation_runs (
    customer_id, lead_submission_id, workflow_name, workflow_run_id,
    run_status, summary, payload, idempotency_key
  ) values (
    customer_id_value,
    lead_row.id,
    'intake-processor (edge function)',
    'efn_' || replace(lead_row.id::text, '-', ''),
    'success',
    summary_value,
    jsonb_build_object(
      'inquiry_type', lead_row.inquiry_type,
      'service_requested', lead_row.service_requested,
      'urgency', lead_row.urgency,
      'task_id', task_id_value
    ),
    'lead-intake:' || lead_row.id::text
  )
  on conflict (idempotency_key) do update
    set idempotency_key = excluded.idempotency_key;

  update public.lead_submissions
  set
    customer_id = customer_id_value,
    submission_status = 'processed',
    processed_at = clock_timestamp()
  where id = lead_row.id;

  return jsonb_build_object(
    'id', lead_row.id,
    'customer_id', customer_id_value,
    'task_id', task_id_value,
    'business_name', lead_row.business_name,
    'lead_name', lead_row.lead_name,
    'lead_phone', lead_row.lead_phone,
    'lead_email', lead_row.lead_email,
    'service_requested', lead_row.service_requested,
    'urgency', lead_row.urgency,
    'message', lead_row.message,
    'source_channel', lead_row.source_channel,
    'inquiry_type', lead_row.inquiry_type,
    'received_at', lead_row.received_at
  );
end;
$$;

revoke all on function public.process_lead_submission(uuid) from public;
grant execute on function public.process_lead_submission(uuid) to service_role;

drop function if exists public.claim_lead_submission(uuid);

-- Replace the original PII-bearing unauthenticated trigger request. The new
-- trigger sends only the row ID and authenticates with one unique Vault entry.
create or replace function public.handle_new_lead_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  intake_secret text;
  secret_count integer;
begin
  select count(*), min(decrypted_secret)
  into secret_count, intake_secret
  from vault.decrypted_secrets
  where name = 'g7_intake_processor_secret';

  if secret_count <> 1 or length(intake_secret) < 32 then
    raise warning 'intake processor Vault secret missing, duplicated, or too short';
    return new;
  end if;

  perform net.http_post(
    url := 'https://fbstesgbttojfysznddq.supabase.co/functions/v1/intake-processor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-g7-intake-secret', intake_secret
    ),
    body := jsonb_build_object(
      'type', tg_op,
      'table', tg_table_name,
      'schema', tg_table_schema,
      'record', jsonb_build_object('id', new.id),
      'old_record', null
    ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Weekly report cron reads exactly one caller credential from Supabase Vault.

do $$
begin
  perform cron.unschedule('weekly-client-reports');
exception when others then
  null;
end $$;

select cron.schedule(
  'weekly-client-reports',
  '0 8 * * 1',
  $cron$
  with report_secret as (
    select min(decrypted_secret) as decrypted_secret
    from vault.decrypted_secrets
    where name = 'g7_weekly_report_secret'
    having count(*) = 1 and length(min(decrypted_secret)) >= 32
  )
  select net.http_post(
    url := 'https://fbstesgbttojfysznddq.supabase.co/functions/v1/weekly-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-g7-secret', decrypted_secret
    ),
    body := '{"source":"pg_cron","job":"weekly-client-reports"}'::jsonb,
    timeout_milliseconds := 15000
  )
  from report_secret;
  $cron$
);
