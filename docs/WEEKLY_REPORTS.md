# G7CRM — weekly automated reports

Every **Monday 08:00 UTC** a pg_cron job (`weekly-client-reports`, see
`supabase/migrations/20260717_weekly_client_reports.sql`) POSTs to the
`weekly-report` Edge Function, which:

1. Emails each **live client** (`record_type='client'` + `onboarding_status='live'`)
   a branded 7-day summary: enquiries caught, urgent calls, booking requests,
   WhatsApp messages handled, estimated pipeline value (~€400/job, override
   with `EST_JOB_VALUE`).
2. Emails **you** (ALERT_EMAIL_TO) an operator digest: own-pipeline health
   (new / unprocessed leads, overdue tasks) + a one-liner per client and
   whether their report went out.
3. Logs an `automation_runs` row per run.

## Safety valve — client emails are OFF by default

Until you set `REPORTS_ENABLED=true` in the function secrets, every run is a
**dry-run**: clients get nothing, you still get the digest showing what they
*would* receive. Flip it on when you've proof-read one:

```bash
supabase secrets set REPORTS_ENABLED=true --project-ref fbstesgbttojfysznddq
```

## Attribution: client_id

`lead_submissions`, `interactions` and `tasks` now have a nullable
`client_id → customers(id)`:

- `client_id = NULL` → G7's own pipeline (your sales funnel).
- `client_id = <customer id of a client>` → that client's delivery traffic.

`intake-processor` / `whatsapp-webhook` don't set it yet — when client #1
goes live, map their inbound (e.g. by the Twilio `To` number) to their
`client_id`. Until then reports simply show zero clients.

## Hardening

The cron job sends an `x-g7-secret` header (value inside the migration SQL).
Enforce it so randoms can't trigger runs:

```bash
supabase secrets set REPORT_SECRET=<value from the migration> --project-ref fbstesgbttojfysznddq
```

## Change the schedule

```sql
select cron.unschedule('weekly-client-reports');
select cron.schedule('weekly-client-reports', '0 8 * * 1', $$ ...same body... $$);
```

Cron runs in UTC: `0 8 * * 1` = Mon 09:00 Dublin in summer, 08:00 in winter.
