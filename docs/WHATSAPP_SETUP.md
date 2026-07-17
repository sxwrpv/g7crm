# G7CRM — WhatsApp auto-reply agent, setup

Extends the live lead pipeline (`g7systems.xyz form → lead_submissions → intake-processor`) with
a second inbound channel: WhatsApp. Same pattern, new Edge Function: **`whatsapp-webhook`**.

Files (now in the repo):
- `supabase/migrations/20260716_whatsapp_interactions_migration.sql` — widens `interactions.type` to allow `'whatsapp'`
- `supabase/functions/whatsapp-webhook/index.ts` — the Edge Function
- this doc

## What it does

1. A lead messages your WhatsApp number.
2. Twilio forwards it to the `whatsapp-webhook` Edge Function.
3. The function:
   - upserts a `customers` row (matched on `whatsapp`/`phone`; new lead if none found)
   - logs the inbound message in `interactions` (`type='whatsapp'`, `direction='inbound'`)
   - creates (or appends to) a `follow-up` task, flagged `urgent` if the message contains words like "emergency", "leak", "no heat"
   - sends an instant WhatsApp auto-reply via Twilio, logged as an outbound interaction
   - logs an `automation_runs` row for the dashboard/audit trail

This mirrors the "missed-call text-back" promise, just on WhatsApp instead of email.

## 1. Twilio setup

You need WhatsApp Business API access. Twilio is the easiest path in and matches the note already
in your G7 Systems roadmap ("WhatsApp send-back via Twilio").

1. Create a Twilio account (or use existing) → console.twilio.com
2. **For testing:** activate the Twilio Sandbox for WhatsApp (Messaging → Try it out → Send a WhatsApp message). You get a shared sandbox number (`whatsapp:+14155238886`) and a join code — anyone who wants to test has to send that join code to the sandbox number once.
3. **For production (real client-facing number):** you need a Twilio WhatsApp Sender, which requires a Meta-approved WhatsApp Business Profile. This takes Meta business verification — start it early, it's the slowest part. Twilio's guided flow is under Messaging → Senders → WhatsApp senders.
4. Note down: **Account SID**, **Auth Token** (console.twilio.com home page), and the **WhatsApp-enabled number** (sandbox or approved sender).

## 2. Deploy the Edge Function

From your `g7crm` repo:

```bash
supabase functions deploy whatsapp-webhook --project-ref fbstesgbttojfysznddq --no-verify-jwt
```

`--no-verify-jwt` is required — Twilio calls this directly, it doesn't send a Supabase JWT (same as `intake-processor`).

## 3. Run the migration

```bash
supabase db push   # or run 20260716_whatsapp_interactions_migration.sql directly in the SQL editor
```

This just widens a check constraint (`call/email/meeting/note` → `+whatsapp/sms`). Non-destructive, no data loss.

## 4. Set Edge Function secrets

```bash
supabase secrets set \
  TWILIO_ACCOUNT_SID=ACxxxxxxxx \
  TWILIO_AUTH_TOKEN=xxxxxxxx \
  TWILIO_WHATSAPP_FROM=whatsapp:+14155238886 \
  WHATSAPP_WEBHOOK_URL=https://fbstesgbttojfysznddq.supabase.co/functions/v1/whatsapp-webhook \
  --project-ref fbstesgbttojfysznddq
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are already set project-wide (intake-processor uses them).

Optional:
- `AUTO_REPLY_TEXT` — override the canned reply. Use `{name}` as a placeholder, e.g. `"Hi{name}, got your message — we'll be in touch shortly!"`
- `WHATSAPP_VERIFY_SIGNATURE=false` — only for local/sandbox testing where Twilio's signature check gets fussy about the tunnel URL. **Leave it on (`true`, the default) in production** — without it, anyone who finds the webhook URL can forge messages into your CRM.

## 5. Point Twilio at the function

Twilio console → your WhatsApp sender (sandbox or approved) → **"A message comes in"** webhook:

```
https://fbstesgbttojfysznddq.supabase.co/functions/v1/whatsapp-webhook
```

Method: `HTTP POST`.

## 6. Test it

1. Sandbox: send the join code to `+1 415 523 8886` from your phone once.
2. Send a normal message, e.g. "hi, do you fix boilers?"
3. Check:
   - You get an auto-reply on WhatsApp within a few seconds.
   - `customers` has a new row with `source_channel='whatsapp'`.
   - `interactions` has an inbound + outbound row.
   - `tasks` has a `follow-up` task.
   - `automation_runs` has a `whatsapp-webhook` row.
4. Send "URGENT no heat" and confirm the task comes in as `priority='urgent'` and the customer is `lead_temperature='hot'`.

## Notes / decisions

- **Auto-reply is a canned instant acknowledgment**, not an AI conversation — matches how the rest of G7 Systems is positioned ("we run it, client logs into nothing"; missed-call text-back is instant + templated, real follow-up is human). If you want an LLM-drafted contextual reply instead of the static template, that's a small change (call Claude/Anthropic API with the message body before the Twilio send) — say the word and I'll wire it in.
- Customer matching is by phone number (`whatsapp` or `phone` column), not email — WhatsApp leads may not have an email, so a placeholder (`whatsapp-<number>@placeholder.local`) is used to satisfy the `customers.email` unique constraint.
- Repeated messages from the same open conversation append to the existing follow-up task instead of creating a new one each time.
