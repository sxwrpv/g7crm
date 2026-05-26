-- Replace wide-open "Allow all" RLS policies with role-scoped policies:
--   - anon (public form):    can only INSERT into lead_submissions
--   - authenticated:         can do everything on CRM tables (operator dashboard)
--   - service_role (n8n/EF): bypasses RLS automatically
--
-- Drops the previous "Allow all on <table>" policies first.

drop policy if exists "Allow all on customers"        on public.customers;
drop policy if exists "Allow all on deals"            on public.deals;
drop policy if exists "Allow all on tasks"            on public.tasks;
drop policy if exists "Allow all on interactions"    on public.interactions;
drop policy if exists "Allow all on lead_submissions" on public.lead_submissions;
drop policy if exists "Allow all on client_systems"   on public.client_systems;
drop policy if exists "Allow all on automation_runs"  on public.automation_runs;

-- Public lead capture: anon can ONLY insert into lead_submissions
create policy "anon insert leads"
  on public.lead_submissions
  for insert
  to anon
  with check (true);

-- Authenticated operator: full read/write on every CRM table
create policy "authenticated full access customers"
  on public.customers for all to authenticated using (true) with check (true);

create policy "authenticated full access deals"
  on public.deals for all to authenticated using (true) with check (true);

create policy "authenticated full access tasks"
  on public.tasks for all to authenticated using (true) with check (true);

create policy "authenticated full access interactions"
  on public.interactions for all to authenticated using (true) with check (true);

create policy "authenticated full access lead_submissions"
  on public.lead_submissions for all to authenticated using (true) with check (true);

create policy "authenticated full access client_systems"
  on public.client_systems for all to authenticated using (true) with check (true);

create policy "authenticated full access automation_runs"
  on public.automation_runs for all to authenticated using (true) with check (true);

create policy "authenticated full access products"
  on public.products for all to authenticated using (true) with check (true);
