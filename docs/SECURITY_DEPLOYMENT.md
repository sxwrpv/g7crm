# Security hardening deployment

The code is prepared locally. Production secrets, Cloudflare configuration,
Supabase migrations/functions and the static-site release require account
access. Use this phased order to avoid interrupting lead capture.

## 1. Create Cloudflare Turnstile credentials

In Cloudflare Dashboard → Turnstile:

1. Create a managed widget.
2. Allow `g7systems.xyz` and `www.g7systems.xyz`.
3. Copy the site key and secret key separately.
4. Put only the public site key in `web/js/config.js`:

```js
turnstileSiteKey: 'PUBLIC_SITE_KEY_HERE',
```

Never put the Turnstile secret in the repository.

## 2. Create fresh server-only values

Generate three unrelated values locally:

```bash
openssl rand -hex 32  # REPORT_SECRET
openssl rand -hex 32  # INTAKE_PROCESSOR_SECRET
openssl rand -hex 32  # RATE_LIMIT_SALT
```

The previously committed report value is obsolete and must not be reused. Keep
these values in the password manager; do not paste them into tracked files.

## 3. Configure Edge Function secrets

Using Supabase CLI:

```bash
supabase secrets set \
  REPORT_SECRET='REPORT_SECRET_VALUE' \
  INTAKE_PROCESSOR_SECRET='INTAKE_PROCESSOR_SECRET_VALUE' \
  TURNSTILE_SECRET_KEY='TURNSTILE_SECRET_VALUE' \
  RATE_LIMIT_SALT='RATE_LIMIT_SALT_VALUE' \
  ALLOWED_ORIGINS='https://g7systems.xyz,https://www.g7systems.xyz' \
  TURNSTILE_HOSTNAMES='g7systems.xyz,www.g7systems.xyz' \
  --project-ref fbstesgbttojfysznddq
```

The same values can be entered through Supabase Dashboard → Edge Functions →
Secrets if the CLI is unavailable.

## 4. Store both trigger-side secrets in Supabase Vault

In Supabase Dashboard → SQL Editor, create two uniquely named Vault entries.
Use the same values supplied to the corresponding Function Secrets:

```sql
select vault.create_secret(
  'REPORT_SECRET_VALUE',
  'g7_weekly_report_secret',
  'Weekly report cron caller credential'
);

select vault.create_secret(
  'INTAKE_PROCESSOR_SECRET_VALUE',
  'g7_intake_processor_secret',
  'Lead intake database-trigger credential'
);
```

If either name already exists, update that existing Vault entry instead of
creating a duplicate. Verify exactly one of each exists:

```sql
select name, count(*)
from vault.decrypted_secrets
where name in ('g7_weekly_report_secret', 'g7_intake_processor_secret')
group by name;
```

Each count must be `1`. Do not display `decrypted_secret` during verification.

## 5. Apply the foundation migration

Apply only:

`supabase/migrations/20260729_security_foundations.sql`

Use `supabase db push` only if it will apply the migrations in the intended
order, otherwise paste this single file into Supabase SQL Editor. It creates the
rate limiter, atomic intake claim and Vault-backed database callers. It does
**not** revoke the old public insert yet.

## 6. Deploy all three Edge Functions

The functions authenticate their own callers and are invoked without a user
JWT, so deploy them with gateway JWT verification disabled:

```bash
supabase functions deploy submit-lead \
  --project-ref fbstesgbttojfysznddq \
  --no-verify-jwt

supabase functions deploy intake-processor \
  --project-ref fbstesgbttojfysznddq \
  --no-verify-jwt

supabase functions deploy weekly-report \
  --project-ref fbstesgbttojfysznddq \
  --no-verify-jwt
```

`intake-processor` and `weekly-report` still require their separate private
headers. `--no-verify-jwt` does not make them unauthenticated.

## 7. Deploy and verify the protected static form

Deploy `web/` after its Turnstile site key is filled and `submit-lead` is live.
Submit one internal test through the page and confirm exactly one lead, one
customer/task processing path and one operator notification.

At this stage the new form uses `submit-lead`, while the old anonymous database
insert permission remains temporarily available for rollback safety.

## 8. Preflight the operator before final cutover

Confirm the intended Supabase Auth user exists:

```sql
select id, email, email_confirmed_at, banned_until
from auth.users
where lower(email) = 'hello@g7systems.xyz'
  and email_confirmed_at is not null
  and (banned_until is null or banned_until < now());
```

Exactly one usable row must appear. If it does not, create and confirm the
operator Auth user (or remove an active ban) before proceeding. The final
migration asserts this exact user and rolls back before policy changes if the
check fails.

## 9. Apply the final hardening migration

Apply only:

`supabase/migrations/20260729_security_hardening.sql`

This migration:

- creates and verifies server-controlled `crm_operators` membership;
- replaces unrestricted authenticated policies;
- revokes direct anonymous lead inserts.

Confirm operator membership afterward:

```sql
select u.email, o.created_at
from public.crm_operators o
join auth.users u on u.id = o.user_id;
```

To add another operator, create the Auth user first, then insert its UUID into
`crm_operators`. Do not remove the last operator before adding a replacement.

## 10. Production checks

1. Submit another real internal test through the public form; confirm one
   processing path and no duplicate task/email.
2. Submit without completing Turnstile; it must fail.
3. Confirm a direct anonymous PostgREST insert into `lead_submissions` is denied.
4. Sign in as the normal operator and confirm dashboard read/write access.
5. Create a temporary authenticated non-operator, confirm direct CRM reads and
   writes are denied, then delete the temporary user.
6. Invoke `intake-processor` and `weekly-report` without their private headers
   and with incorrect values; all attempts must be rejected.
7. Confirm `cron.job` contains one `weekly-client-reports` job.
8. Keep `REPORTS_ENABLED=false` until the dry-run digest has been reviewed.

## Rollback

If the operator dashboard is locked out, do not restore broad policies. Insert
the correct Auth user UUID into `public.crm_operators`. If the public form fails,
keep direct anonymous inserts disabled after final cutover and direct visitors
to `hello@g7systems.xyz` while correcting the Function Secret, Turnstile key or
function deployment.
