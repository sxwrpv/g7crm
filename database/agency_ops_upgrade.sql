
begin;


alter table public.customers
  add column if not exists record_type varchar(20)
    default 'lead'
    check (record_type in ('lead','prospect','client','former-client','partner')),
  add column if not exists account_stage varchar(30)
    default 'new'
    check (account_stage in ('new','in-progress','closed','recurring')),
  add column if not exists business_type varchar(50),
  add column if not exists niche varchar(50),
  add column if not exists website_url text,
  add column if not exists service_area text,
  add column if not exists owner_name varchar(150),
  add column if not exists whatsapp varchar(30),
  add column if not exists source_channel varchar(50),
  add column if not exists lead_temperature varchar(20)
    default 'warm'
    check (lead_temperature in ('cold','warm','hot')),
  add column if not exists onboarding_status varchar(30)
    default 'not-started'
    check (onboarding_status in ('not-started','awaiting-access','setup-in-progress','live','paused')),
  add column if not exists delivery_status varchar(30)
    default 'not-started'
    check (delivery_status in ('not-started','monitoring','stable','needs-attention')),
  add column if not exists preferred_alert_channel varchar(30)
    default 'telegram'
    check (preferred_alert_channel in ('telegram','email','whatsapp','sms','none')),
  add column if not exists alert_destination text,
  add column if not exists next_action text,
  add column if not exists last_contacted_at timestamptz,
  add column if not exists qualified_at timestamptz,
  add column if not exists client_since timestamptz,
  add column if not exists tags text[] default '{}';

create index if not exists idx_customers_record_type on public.customers(record_type);
create index if not exists idx_customers_account_stage on public.customers(account_stage);
create index if not exists idx_customers_niche on public.customers(niche);
create index if not exists idx_customers_onboarding_status on public.customers(onboarding_status);
create index if not exists idx_customers_source_channel on public.customers(source_channel);

-- Backfill a few sensible defaults from current data
update public.customers
set record_type = case
  when status = 'active' then 'client'
  when status = 'inactive' then 'former-client'
  else 'lead'
end
where record_type is null or record_type = 'lead';

update public.customers
set client_since = created_at
where record_type = 'client' and client_since is null;

update public.customers
set account_stage = case
  when record_type = 'former-client' then 'closed'
  when record_type = 'client' and status = 'active' then 'recurring'
  when record_type in ('prospect','client','partner') then 'in-progress'
  else 'new'
end
where account_stage is null or account_stage = 'new';

-- ============================================================
-- 2) DEALS: make them useful for service offers and retainers
-- ============================================================
alter table public.deals
  add column if not exists offer_type varchar(50),
  add column if not exists setup_fee numeric(12,2) default 0,
  add column if not exists monthly_revenue numeric(12,2) default 0,
  add column if not exists service_scope text,
  add column if not exists close_reason text,
  add column if not exists expected_close_date date,
  add column if not exists won_at timestamptz,
  add column if not exists lost_at timestamptz;

create index if not exists idx_deals_offer_type on public.deals(offer_type);
create index if not exists idx_deals_stage on public.deals(stage);

-- ============================================================
-- 3) TASKS: make tasks usable for sales + onboarding + delivery
-- ============================================================
alter table public.tasks
  add column if not exists task_type varchar(30)
    default 'general'
    check (task_type in ('sales','follow-up','onboarding','delivery','support','general')),
  add column if not exists priority varchar(20)
    default 'medium'
    check (priority in ('low','medium','high','urgent')),
  add column if not exists assigned_to varchar(150),
  add column if not exists completed_at timestamptz;

create index if not exists idx_tasks_task_type on public.tasks(task_type);
create index if not exists idx_tasks_priority on public.tasks(priority);
create index if not exists idx_tasks_status on public.tasks(status);

update public.tasks
set completed_at = created_at
where status = 'done' and completed_at is null;

-- ============================================================
-- 4) INTERACTIONS: better sales / client communication history
-- ============================================================
alter table public.interactions
  add column if not exists direction varchar(20)
    default 'outbound'
    check (direction in ('inbound','outbound','internal')),
  add column if not exists outcome varchar(50),
  add column if not exists next_step text,
  add column if not exists created_by varchar(150),
  add column if not exists metadata jsonb default '{}'::jsonb;

create index if not exists idx_interactions_type on public.interactions(type);
create index if not exists idx_interactions_direction on public.interactions(direction);
create index if not exists idx_interactions_customer_date on public.interactions(customer_id, date desc);

-- ============================================================
-- 5) LEAD SUBMISSIONS: webhook / n8n landing zone
-- ============================================================
create table if not exists public.lead_submissions (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references public.customers(id) on delete set null,
  source_channel varchar(50) not null default 'website-form',
  business_name varchar(150),
  lead_name varchar(150),
  lead_email varchar(150),
  lead_phone varchar(30),
  service_requested varchar(150),
  urgency varchar(20) default 'normal',
  message text,
  submission_status varchar(30) default 'new',
  n8n_run_id varchar(100),
  raw_payload jsonb default '{}'::jsonb,
  received_at timestamptz default now(),
  processed_at timestamptz
);

-- Add columns that may be missing if table already existed
alter table public.lead_submissions
  add column if not exists inquiry_type varchar(30)
    default 'standard',
  add column if not exists requested_booking_date date,
  add column if not exists requested_booking_time varchar(20),
  add column if not exists booking_status varchar(30)
    default 'not-applicable',
  add column if not exists calendar_event_ref text;

-- Add check constraints only if they don't already exist
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'lead_submissions_inquiry_type_check') then
    alter table public.lead_submissions
      add constraint lead_submissions_inquiry_type_check
      check (inquiry_type in ('standard','booking','urgent-call'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lead_submissions_booking_status_check') then
    alter table public.lead_submissions
      add constraint lead_submissions_booking_status_check
      check (booking_status in ('not-applicable','requested','confirmed','completed','cancelled'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lead_submissions_urgency_check') then
    alter table public.lead_submissions
      add constraint lead_submissions_urgency_check
      check (urgency in ('low','normal','high','emergency'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lead_submissions_submission_status_check') then
    alter table public.lead_submissions
      add constraint lead_submissions_submission_status_check
      check (submission_status in ('new','processed','duplicate','spam','archived'));
  end if;
end $$;

create index if not exists idx_lead_submissions_customer on public.lead_submissions(customer_id);
create index if not exists idx_lead_submissions_status on public.lead_submissions(submission_status);
create index if not exists idx_lead_submissions_inquiry_type on public.lead_submissions(inquiry_type);
create index if not exists idx_lead_submissions_received_at on public.lead_submissions(received_at desc);
create index if not exists idx_lead_submissions_email on public.lead_submissions(lead_email);
create index if not exists idx_lead_submissions_phone on public.lead_submissions(lead_phone);

alter table public.lead_submissions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'lead_submissions'
      and policyname = 'Allow all on lead_submissions'
  ) then
    create policy "Allow all on lead_submissions"
      on public.lead_submissions
      for all
      using (true)
      with check (true);
  end if;
end $$;

-- ============================================================
-- 6) CLIENT SYSTEMS: track access + implementation dependencies
-- ============================================================
create table if not exists public.client_systems (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid not null references public.customers(id) on delete cascade,
  system_type varchar(50) not null,
  system_name varchar(150) not null,
  access_status varchar(30)
    default 'not-requested'
    check (access_status in ('not-requested','requested','granted','blocked')),
  owner_contact varchar(150),
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_client_systems_customer on public.client_systems(customer_id);

alter table public.client_systems enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'client_systems'
      and policyname = 'Allow all on client_systems'
  ) then
    create policy "Allow all on client_systems"
      on public.client_systems
      for all
      using (true)
      with check (true);
  end if;
end $$;

-- ============================================================
-- 7) AUTOMATION RUNS: log key n8n / webhook activity
-- ============================================================
create table if not exists public.automation_runs (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references public.customers(id) on delete set null,
  lead_submission_id uuid references public.lead_submissions(id) on delete set null,
  workflow_name varchar(150) not null,
  workflow_run_id varchar(100),
  run_status varchar(20)
    default 'success'
    check (run_status in ('success','failed','warning')),
  summary text,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_automation_runs_customer on public.automation_runs(customer_id);
create index if not exists idx_automation_runs_submission on public.automation_runs(lead_submission_id);
create index if not exists idx_automation_runs_created_at on public.automation_runs(created_at desc);

alter table public.automation_runs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'automation_runs'
      and policyname = 'Allow all on automation_runs'
  ) then
    create policy "Allow all on automation_runs"
      on public.automation_runs
      for all
      using (true)
      with check (true);
  end if;
end $$;

-- ============================================================
-- 8) SAMPLE DATA ENRICHMENT
-- ============================================================
update public.customers
set niche = coalesce(niche, 'General SMB'),
    business_type = coalesce(business_type, company),
    source_channel = coalesce(source_channel, 'manual-import'),
    next_action = coalesce(next_action, 'Review record and assign real next step.')
where true;

update public.deals
set offer_type = coalesce(offer_type, 'CRM / automation service')
where true;

update public.tasks
set task_type = coalesce(task_type,
  case
    when lower(title) like '%follow-up%' then 'follow-up'
    when lower(title) like '%demo%' then 'sales'
    when lower(title) like '%contract%' then 'sales'
    when lower(title) like '%welcome%' then 'onboarding'
    else 'general'
  end
)
where true;

commit;
