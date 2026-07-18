# WhatsApp AI lead-intake workflow

Local n8n workflow: **G7CRM Master Automation — All Channels**

All G7CRM automation branches now live on one n8n canvas:
- universal website/API lead intake
- booking and urgent-call classification
- Supabase lead/customer/task/run writes
- Telegram owner alerts
- WhatsApp AI conversation intake and TwiML replies

## What it does

1. Receives a Twilio-compatible WhatsApp webhook at `POST /webhook/whatsapp-lead-intake`.
2. Sends the inbound message to the local G7 WhatsApp AI bridge on `127.0.0.1:8766`.
3. The AI bridge keeps per-phone conversation history and extracts:
   - name and WhatsApp phone
   - requested service and issue description
   - location/postcode
   - urgency and immediate-safety risk
   - preferred date/time
   - budget, price expectation, or request for a quote
   - optional email, property type and access notes
4. It asks one or two missing questions at a time.
5. It presents a summary and waits for explicit customer confirmation.
6. Only after confirmation, it creates the structured lead through the existing G7CRM n8n intake workflow.
7. n8n inserts only the lead submission; the database trigger `on_lead_submission_inserted` invokes the `intake-processor` Edge Function, which upserts the customer and creates the follow-up task and automation run. This keeps one canonical downstream processor and avoids duplicate records.
8. n8n sends the owner Telegram alert using the server-controlled `g7TelegramTarget` variable.
9. It returns the AI reply as TwiML, so Twilio sends it back in WhatsApp without a separate outbound API call.
10. Message SID processing is idempotent and confirmed conversations are submitted only once.

The agent must not invent quotes, availability, diagnoses or confirmed bookings. Immediate-danger messages receive 112/999 safety guidance.

## Files and services

- Master workflow JSON: `n8n/g7crm-master-automation.workflow.json`
- Previous component exports remain in `n8n/` as rollback references, but their n8n workflows are archived.
- Source-controlled workflow exports are intentionally **inactive** and contain no instance credentials or personal alert destination. Before importing/activating, create these n8n variables:
  - `supabaseAnonKey` — the project's Supabase publishable/anon key
  - `g7TelegramTarget` — the server-controlled Telegram destination
- AI bridge: `~/.hermes/scripts/g7-whatsapp-ai-bridge.py`
- Conversation database: `~/.n8n/g7-whatsapp-ai.sqlite`
- LaunchAgent: `~/Library/LaunchAgents/com.g7.whatsapp-ai-bridge.plist`
- n8n LaunchAgent: `~/Library/LaunchAgents/com.g7.n8n.plist`

Both local services start automatically at login and restart if they exit.

## Local checks

```bash
curl http://127.0.0.1:8766/health
curl http://localhost:5678/
```

A non-destructive workflow test can include `dry_run=true` in the Twilio form payload. The AI still analyses and replies, but the lead is not submitted to G7CRM.

## Production requirements

Before connecting a live Twilio sender:

1. Expose n8n through a stable public HTTPS URL.
2. Point Twilio's **A message comes in** webhook to:
   `https://YOUR-HOST/webhook/whatsapp-lead-intake`
3. Add Twilio signature validation or an authenticated proxy before exposing the endpoint publicly. The current local workflow is not a public security boundary.
4. Send several sandbox conversations and confirm the final lead, task, automation log and Telegram alert in G7CRM.
5. Keep a human escalation path for emergencies, complaints, unusual pricing and messages the agent cannot classify.
