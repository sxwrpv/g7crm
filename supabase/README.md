# Supabase

Source-controlled copies of the database migrations and edge functions deployed
to project `fbstesgbttojfysznddq` (region `eu-central-1`).

These are applied via the Supabase MCP, not via the Supabase CLI — but the files
here are the canonical source. If you start using the CLI later, point it at
this directory.

## Layout

- `migrations/` — SQL files applied via `apply_migration` MCP call. Idempotent (each script can be re-run safely).
- `functions/<name>/index.ts` — Edge Function source. Deployed via `deploy_edge_function`.

## Active functions

| Name | Trigger | Purpose |
|---|---|---|
| `intake-processor` | DB trigger on `lead_submissions` INSERT | Upsert customer, create task, log run, send email alert |

## Required edge function env vars

Set these in **Supabase Dashboard → Edge Functions → Secrets**:

- `RESEND_API_KEY` — from https://resend.com/api-keys
- `ALERT_EMAIL_TO` — e.g. `sxwrpv2022@gmail.com`
- `ALERT_EMAIL_FROM` — e.g. `G7CRM Alerts <onboarding@resend.dev>` (Resend sandbox)
- `DASHBOARD_URL` — optional, defaults to `https://g7systems.xyz/dashboard.html`

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected by Supabase.
