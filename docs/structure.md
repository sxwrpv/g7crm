# Structure notes

This repo is split into the following areas:

- `web/` — CRM frontend (operator dashboard) + public welcome/lead form
- `database/` — SQL schema reference files (the live source of truth is now `supabase/migrations/`)
- `supabase/` — Edge Function source + migrations applied via the Supabase MCP. See [supabase/README.md](../supabase/README.md).
- `automations/n8n/` — optional Railway-ready n8n workflow (the live processor is the Supabase Edge Function; n8n kept for future visual workflows).
- `docs/` — project documentation
  - [`OPERATING.md`](OPERATING.md) — agency operating playbook (client lifecycle, tiers, onboarding, attribution, daily ops)
  - `structure.md` — this file

Top-level:
- [`README.md`](../README.md) — project overview, stack, branding
- [`SETUP.md`](../SETUP.md) — go-live runbook (DNS, Vercel, Resend, optional Railway n8n)
