# G7 Systems — go-live checklist

This is the click-by-click to take G7CRM from local-only to live at https://g7systems.xyz.
Do the steps in order. Each takes 5-15 minutes.

---

## 1. Point the domain at Vercel

### 1a. Add the domain in Vercel
1. https://vercel.com/dashboard → open the **g7crm** (or whatever you named it) project.
2. **Settings → Domains**.
3. Type `g7systems.xyz` → **Add**.
4. Vercel will show DNS instructions. **Keep this tab open** — you'll copy the values into Namecheap.
5. Also add `www.g7systems.xyz` (Vercel will offer "Redirect www → apex" — accept it).

Vercel will give you either:
- **A record** for apex: `76.76.21.21`
- **CNAME** for www: `cname.vercel-dns.com`

(Sometimes Vercel asks for nameserver delegation. **Don't** delegate nameservers — keep DNS at Namecheap. Use the A + CNAME records instead.)

### 1b. Set the DNS records at Namecheap
1. https://www.namecheap.com → **Account → Domain List**.
2. Next to `g7systems.xyz` click **Manage**.
3. Top tab **Advanced DNS**.
4. Delete the existing parking records (any `URL Redirect Record` or `CNAME @ parkingpage.namecheap.com`).
5. **Add New Record** → `A Record`, Host `@`, Value `76.76.21.21`, TTL `Automatic`.
6. **Add New Record** → `CNAME Record`, Host `www`, Value `cname.vercel-dns.com.` (note trailing dot), TTL `Automatic`.
7. Save.

Wait 2-30 minutes. Check:
```bash
dig +short g7systems.xyz @8.8.8.8
# expect: 76.76.21.21
curl -sIL https://g7systems.xyz | head -3
# expect: HTTP/2 200 ... server: Vercel
```

### 1c. Make sure Vercel deploys the right folder
The repo's web app lives in `web/`, not at the root.
- Vercel project → **Settings → General → Root Directory** = `web`
- **Build Command**: leave blank (static site)
- **Output Directory**: leave blank (or `.`)

Trigger a redeploy: **Deployments → … → Redeploy**.

---

## 2. Delete the inactive Supabase project

This is the abandoned `sxwrpv2022@gmail.com` project in `eu-west-1`.

1. https://supabase.com/dashboard
2. If the inactive project isn't visible, switch organisations (top-left).
3. Open it → **Settings → General → Pause / Delete project → Delete**.

(The active one — project ref `fbstesgbttojfysznddq`, name "qqq" — stays.)

While you're there, rename the active project so it's not literally "qqq":
**Settings → General → Project Name** → `g7crm-prod`.

---

## 3. Create your operator auth user

The dashboard is gated to emails in `APP_CONFIG.allowedOperators` (in `web/js/config.js`). Default = `hello@g7systems.xyz`.

First sign-in (one-time):
1. Open https://g7systems.xyz/dashboard.html (after DNS is live) or your Vercel preview URL.
2. Enter `hello@g7systems.xyz` → **Send magic link**.
3. Check Gmail. Click the link. You're in.

If the magic email never lands:
- Supabase free tier sends ~3 magic emails/hour from `noreply@mail.app.supabase.io`. Check spam.
- Or in Supabase **Authentication → Users → Add user** → enter your email + "Auto Confirm User" → then use the dashboard sign-in form normally.

If you want a second operator email, add it to `APP_CONFIG.allowedOperators` in `web/js/config.js` and redeploy.

---

## 4. Deploy n8n to Railway

### 4a. Create the project
1. https://railway.app → **New Project** → **Deploy a Template** → search **"n8n"** → pick the official **n8n** template.
2. Pick the **Postgres + n8n** variant (recommended — survives restarts cleanly). Free credits cover ~1 month of low-volume use; after that ~€5/mo.

### 4b. Set env vars (Railway → your n8n service → Variables)

Required:
```
N8N_HOST=<your-railway-domain>.up.railway.app
N8N_PROTOCOL=https
N8N_PORT=5678
WEBHOOK_URL=https://<your-railway-domain>.up.railway.app/
GENERIC_TIMEZONE=Europe/Dublin
N8N_ENCRYPTION_KEY=<paste 32+ random chars — KEEP THIS SAFE, it encrypts your credentials>

# Used by the lead-intake workflow:
SUPABASE_URL=https://fbstesgbttojfysznddq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<paste from Supabase → Settings → API → service_role secret>
RESEND_API_KEY=<from step 5>
ALERT_EMAIL_TO=sxwrpv2022@gmail.com
ALERT_EMAIL_FROM=G7CRM Alerts <onboarding@resend.dev>
```

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. Never paste it into client-side code, the n8n workflow JSON, or anywhere public. Railway env vars are the right home.

### 4c. Generate an admin login
n8n on Railway will ask you to create an owner account on first visit:
- Visit `https://<your-railway-domain>.up.railway.app`
- Set email/password (this is the n8n admin login, separate from the dashboard sign-in)

### 4d. Import the workflow
1. n8n top-right **+ → Import from file**.
2. Pick `/Users/mirka001/Desktop/g7systems/automations/n8n/universal-lead-intake-booking-urgent-workflow.json`.
3. Click **Save**, then the toggle in the top-right to **Activate** the workflow.
4. Click the **Lead Intake Webhook** node → copy the **Production URL** (looks like `https://<railway-domain>.up.railway.app/webhook/agency-lead-intake-routing`).

---

## 5. Set up Resend (email alerts)

Operator alerts go to your inbox via Resend (free: 100 emails/day, 3000/month — plenty for our volume).

1. https://resend.com → **Sign up** (use your personal Gmail).
2. After verifying your email, you land on the dashboard.
3. Left sidebar → **API Keys** → **Create API Key**.
4. Name: `g7crm-n8n` · Permission: `Sending access` · Domain: `All domains`.
5. **Copy** the key (starts with `re_…`). Save it in your password manager — Resend won't show it again.
6. Paste it into Railway as `RESEND_API_KEY` (step 4b).

> **Sender domain**: by default the workflow sends from `onboarding@resend.dev` (Resend's free sandbox sender — no setup needed). When you finish setting up `g7systems.xyz` mail later, you can verify the domain in Resend → **Domains** and switch `ALERT_EMAIL_FROM` to e.g. `G7CRM Alerts <alerts@g7systems.xyz>`.

7. Test from a terminal (paste your real key + email):
   ```bash
   curl -s https://api.resend.com/emails \
     -H "Authorization: Bearer <YOUR_RESEND_KEY>" \
     -H "Content-Type: application/json" \
     -d '{"from":"G7CRM Alerts <onboarding@resend.dev>","to":["sxwrpv2022@gmail.com"],"subject":"G7CRM test","text":"Resend is wired up."}'
   ```
   You should get an email within ~10 seconds. Check Spam if it doesn't appear.

---

## 6. Connect the public lead form to n8n

After Railway gives you the webhook URL (step 4d):

1. Open `web/js/config.js`.
2. Set:
   ```js
   n8nLeadWebhookUrl: 'https://<your-railway-domain>.up.railway.app/webhook/agency-lead-intake-routing',
   ```
3. Commit + push. Vercel auto-redeploys.

While `n8nLeadWebhookUrl` is empty the form posts straight to Supabase `lead_submissions` (works, just no email alert / customer upsert / task created). Once set, n8n handles the full flow.

---

## 7. End-to-end smoke test

1. Open https://g7systems.xyz in a private window.
2. Submit the lead form with real-looking test data (use `urgency=emergency` to test the urgent path).
3. Expect within 10 seconds:
   - Email lands in `ALERT_EMAIL_TO` inbox (check Spam folder for first one).
   - https://g7systems.xyz/dashboard.html shows the new lead in "Recent Lead Intake" (sign in first).
   - https://g7systems.xyz/customers.html shows a new customer row.
   - https://g7systems.xyz/tasks.html shows a new follow-up task.
4. Delete the test rows from Supabase Table Editor before going live for real.

---

## 8. Things not wired yet (decide later)

- **Customer-facing booking confirmation email** — different from operator alert. Add a second n8n node that emails the *lead* via Resend (only if booking → `inquiry_type === 'booking'`).
- **WhatsApp messaging** — the real Irish channel for client comms. Twilio WhatsApp Business API is the path; needs Meta approval and a paid Twilio account. Worth doing once you have your first paying client.
- **Apple/Google Calendar event** for bookings — the workflow builds the payload, but the original localhost calendar bridge is gone. Switch to Google Calendar via n8n's native node when needed.
- **Verify g7systems.xyz in Resend** to send alerts from `alerts@g7systems.xyz` instead of `onboarding@resend.dev` (Resend → Domains → Add → paste the DNS records into Namecheap).
- **Rate-limiting the public form** — currently anyone can spam `lead_submissions`. If it becomes a problem, add a Cloudflare Turnstile widget on the form and verify on the backend (Supabase Edge Function).

---

## Reference

- Active Supabase project: `fbstesgbttojfysznddq` (region eu-central-1)
- GitHub: https://github.com/sxwrpv/g7crm (private)
- Domain: g7systems.xyz (Namecheap)
- Admin inbox (planned): hello@g7systems.xyz — not yet receiving mail (no MX records). Until set up, alerts go to your personal Gmail.
- Email alerts: sent via Resend from `onboarding@resend.dev` to `ALERT_EMAIL_TO` (sxwrpv2022@gmail.com).
