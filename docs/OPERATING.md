# G7 Systems — Operating playbook

How to run the agency day-to-day: from first cold call to retained client.

**Last updated:** 2026-05-26.
**Reference docs:** [README.md](../README.md), [SETUP.md](../SETUP.md), [supabase/README.md](../supabase/README.md).

---

## Contents

1. [Client lifecycle (6 stages)](#1-client-lifecycle)
2. [Three offer tiers](#2-three-offer-tiers)
3. [Technical onboarding per client](#3-technical-onboarding-per-client)
4. [Attribution — proving the system earns its keep](#4-attribution)
5. [Daily / weekly / monthly responsibilities](#5-your-role)
6. [Money flow](#6-money-flow)
7. [When to build multi-tenant](#7-when-to-build-multi-tenant)
8. [Checklists](#8-checklists)

---

## 1. Client lifecycle

Six stages. Each maps to specific G7CRM state so the dashboard reflects reality.

| Stage | Goal | G7CRM state change | Time |
|---|---|---|---|
| **Outreach** | Book a 15-min audit call | `record_type=lead`, `source_channel=cold-call/cold-email/dm/referral` | 5-10 min / prospect |
| **Audit call** | Understand their leak, qualify them | `record_type=prospect`, `last_contacted_at=now()`, log interaction | 15 min |
| **Proposal** | Pick a tier, send pricing | Add row to `deals`, `stage=proposal` | 15 min to write |
| **Sign** | Verbal/written yes + first month | `deal.stage=closed-won`, `record_type=client`, `client_since=now()` | Same day |
| **Onboard** | Wire them into the system (see §3) | `onboarding_status=setup-in-progress → live` | 24-48 h (Starter) / 7-14 days (Standard/Growth) |
| **Deliver/Retain** | Leads flow, you monitor, weekly digest, monthly review | `delivery_status=monitoring → stable` | Ongoing |

---

## 2. Three offer tiers

Have these in your head when you pick up the phone. Don't put them on the public site yet — quote them client-by-client.

| Tier | What's in it | Setup time | Monthly | Best for |
|---|---|---|---|---|
| **Starter** | Lead form on their existing site + SMS/email alert within 5 min + G7CRM view | 1-2 hours | **€290/mo** (first month free) | Trades that already have a site but it leaks |
| **Standard** ⭐ | Starter + we build/rebuild their website (one of 3 template directions) | 7-14 days | **€490/mo** | Most clients — bundled offer |
| **Growth** | Standard + Google Ads management + Google Business Profile + monthly review call | 14-21 days | **€890/mo** | Clients who want active growth, not just lead-stopping |

All tiers: no contract · cancel anytime · first month free.

**Why this works:** Standard is the hero (most clients land here). Starter is the "yes" for cheapskates. Growth is the month-3 upsell.

---

## 3. Technical onboarding per client

Run this checklist for every new client. Order matters.

### For all tiers
1. **Add to G7CRM** — `customers` row, `record_type=client`, `account_stage=in-progress`, `onboarding_status=awaiting-access`. Record price in `deals` (`setup_fee` + `monthly_revenue`).
2. **Collect access** — phone number, current website, Google Business Profile login, Facebook page. Log each in `client_systems` (`access_status=requested → granted`).
3. **Set up forwarding number** — Twilio number (~€1/mo) that forwards to their phone *and* triggers SMS text-back when missed. Or use their existing number with carrier call-forwarding to Twilio.
4. **Configure alert routing** — their phone + email plugged into G7CRM via `customer.alert_destination` + `preferred_alert_channel`. The edge function emails *them*, not you. Copy yourself on first 2 weeks while you debug.
5. **End-to-end test** — call their forwarded number, miss it, confirm SMS text-back goes to a real test number you control. Log in `automation_runs`.

### Add for Standard / Growth
6. **Build website** — clone Classic / Modern / Local Pride direction, swap in business name, services, photos, area covered. Deploy to Vercel under `clientname.g7systems.app` first, then their domain once they're happy.
7. **Embed the form** — form posts to your Supabase with a `client_id` so leads route to *their* pipeline.

### Add for Growth
8. **Set up Google Business Profile** — claim/verify, add photos, services, hours, service area.
9. **Set up Google Ads** — one campaign per service (e.g., "Emergency Plumber Dublin"), agreed budget, conversion tracking to the form.

**Hard deadline:** Standard = 6 hours of your actual work spread across the 7-14 day window. Don't underestimate.

---

## 4. Attribution

The single most important thing for retention: client knows *exactly* how many leads your system caught.

### Tagging
Every G7-managed lead has:
- `source_channel` set specifically: `g7-form`, `g7-text-back`, `g7-google-ads`, `g7-website`
- `client_id` link (so leads go to *their* pipeline, not yours)
- `automation_runs` row showing the path through the system

### Friday digest — send to every paying client every week
One paragraph. Templated. ~5 min per client.

> *Hi Jim,*
>
> *This week your G7 system caught **7 leads**: 3 from missed-call text-backs, 4 from the contact form. Top service: emergency boiler (5 of 7). You replied to 6, quoted 4. One lead (Patrick O'Brien, kitchen tap, +€220) is sitting un-quoted — flagged in your dashboard.*
>
> *Last week: 9 leads / quoted 5 / won 2 (€870 revenue attributed to G7).*
>
> *Have a good weekend, — Arsen*

### Monthly review — 15-min call at month end
- Total leads caught
- Conversion rate (lead → quote → won)
- Revenue attributable to G7
- vs. last month
- One thing to change next month

**Build a `reports` view in the dashboard** that aggregates this per client. Goal: open one screen and read off the digest in under 60 seconds.

---

## 5. Your role

### Daily — 45-90 min total

| When | What | Time |
|---|---|---|
| Morning | Open G7CRM. Check overnight leads landed correctly. Any `automation_runs.run_status='failed'`? Fix immediately. | 15 min |
| Mid-day | 30-50 cold-call dials at peak hours (9-11am or 5-7pm Tue-Thu). Log each as `record_type=lead`, `source_channel=cold-call`, set `next_action`. | 30-60 min |
| End of day | Process responses (callbacks, emails). Update CRM. Tomorrow's call list ready. | 15 min |

### Weekly

| Day | What |
|---|---|
| **Tue** | Send Friday digests to all paying clients (~5 min × N clients) |
| **Thu** | Review own pipeline. Which prospects are stalling? Re-touch. |
| **Fri** | Internal review. What worked this week? Which trade vertical is responding best? Update outreach script. |

### Monthly

- Send invoices (Stripe Subscriptions from client #4+; manual bank transfer for first three).
- Monthly review call with each client (15 min × N).
- Review your own funnel: cold-call → audit → signed conversion rate. Tune.

---

## 6. Money flow

**Clients 1-3 — manual is fine:**
- Send Revolut Business or AIB business account number.
- Ask them to set up a standing order for the 1st of every month.
- Pros: no Stripe fees, simple.
- Cons: chasing missed payments is annoying.

**Client #4 onwards — Stripe Subscriptions:**
- Stripe Ireland: ~1.4% + €0.25 per transaction.
- Auto-charge → no awkward chasing.
- Add payment link in the proposal email.

Either way: invoice on signup with month 1 = €0, month 2+ = standard rate. Send a confirmation email so they have it in writing.

---

## 7. When to build multi-tenant

Right now: ONE pipeline. Everything in `customers` and `lead_submissions` is yours. Manual carve-out works fine **for clients 1-3**.

**Build trigger: when you sign client #3.**

When you do, the changes are:
- New `clients` table (separate from `customers` — `clients` = the agencies/businesses you bill; `customers` = end-consumers each of those gets leads from).
- Add `client_id` foreign key on `lead_submissions`, `customers`, `tasks`, `automation_runs` (partition key).
- Update the edge function to route alerts to the right client's email/phone (read from `clients.alert_destination`).
- Per-client pages in the dashboard (`/clients/{slug}`).

Scaffolding the migration + edge function changes is ~60 min of work. Don't do it preemptively — wait for the pain.

---

## 8. Checklists

### Pre-cold-call checklist (every morning)
- [ ] G7CRM open, "leads to call today" filter set
- [ ] Today's target list ready (30-50 names)
- [ ] Call script open in another tab
- [ ] Notes app ready for live notes
- [ ] Phone fully charged / headset on
- [ ] Targeting 9-11am OR 5-7pm slot

### New-client onboarding checklist (use per client)
- [ ] Customer row in CRM, `record_type=client`, `account_stage=in-progress`
- [ ] Deal row, stage=`closed-won`, setup_fee + monthly_revenue filled
- [ ] Access collected (phone, website, GBP, FB) — logged in `client_systems`
- [ ] Forwarding number live
- [ ] Alert routing tested (call → text-back → email lands in client inbox)
- [ ] Website built (Standard/Growth) — deployed to Vercel
- [ ] Form embedded with correct `client_id`
- [ ] Google Business Profile claimed (Growth)
- [ ] Google Ads campaign live (Growth)
- [ ] `onboarding_status=live`
- [ ] First-week monitoring scheduled
- [ ] Invoice sent for month 2 onwards

### Friday digest checklist (every Friday)
- [ ] For each paying client: run weekly leads query
- [ ] Note conversion (replied / quoted / won)
- [ ] Flag any un-quoted leads
- [ ] Send digest email
- [ ] Update `customer.last_contacted_at`

---

## Operating rule going forward

The system is built. The bottleneck is sales, not engineering. Don't add features. Add clients.

— *G7 Systems · Dublin, Ireland*
