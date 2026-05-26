-- Trigger: on every INSERT into public.lead_submissions, POST the new row to
-- the intake-processor edge function via pg_net.
--
-- The edge function:
--   - Re-fetches the lead from the DB (never trusts payload).
--   - Upserts the customer, creates a follow-up task, logs an automation run.
--   - Sends an email alert via Resend if RESEND_API_KEY + ALERT_EMAIL_TO are set.
--
-- Source: supabase/functions/intake-processor/index.ts

create extension if not exists pg_net with schema extensions;

create or replace function public.handle_new_lead_submission()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  perform net.http_post(
    url := 'https://fbstesgbttojfysznddq.supabase.co/functions/v1/intake-processor',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', to_jsonb(NEW),
      'old_record', null
    ),
    timeout_milliseconds := 5000
  );
  return NEW;
end;
$$;

drop trigger if exists on_lead_submission_inserted on public.lead_submissions;

create trigger on_lead_submission_inserted
  after insert on public.lead_submissions
  for each row
  execute function public.handle_new_lead_submission();
