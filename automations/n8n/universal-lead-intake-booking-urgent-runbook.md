# Universal Lead Intake + Booking + Urgent Call

Purpose
- Receives inbound lead webhooks.
- Classifies each lead as standard, booking, or urgent-call.
- Stores the submission in Supabase.
- Upserts the customer.
- Marks the submission as processed.
- Creates the right follow-up task.
- Logs the run.
- Sends a Telegram alert.

Webhook path
- /webhook/agency-lead-intake-routing

Expected payload fields
- business_name or company
- name or lead_name
- email / phone
- service or service_requested
- message
- urgency
- inquiry_type / request_type / intent
- booking_date / booking_time when relevant
- assigned_to (optional)
- alert_destination (optional, defaults to @sxwrpv1)

Routing rules
- booking
  - if inquiry_type/request_type/intent includes booking
  - or both booking date and booking time are present
- urgent-call
  - if inquiry_type/request_type/intent includes urgent or call
  - or call_now=true
  - or urgency is urgent/emergency
- standard
  - everything else

Current outputs
- lead_submissions row with inquiry_type, booking date/time, and booking_status
- customer upsert
- follow-up task with priority matched to route type
- automation_runs log row
- Telegram alert via localhost:8765/send

What is not wired yet
- booking confirmation email
- Apple Calendar event creation
- dedupe / retry / review queue hardening

Why those are not wired yet
- no confirmed SMTP credential strategy yet
- local n8n should avoid unsupported Execute Command patterns
- safer to get booking/urgent routing live first, then add outbound email/calendar

Recommended next step after this workflow
- add SMTP credential for confirmation emails
- add a localhost calendar bridge so complete bookings can create Apple Calendar events
- then add idempotency, retries, and failure queue
