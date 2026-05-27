-- Starter prospect list — Dublin home-services businesses verified via public websites on 2026-05-26.
-- All loaded as record_type='lead', source_channel='research', ready for the first cold-call sprint.
-- Skip if already inserted (ON CONFLICT on email).

insert into public.customers (
  name, email, phone, company, address, status,
  record_type, account_stage, business_type, niche, website_url,
  service_area, owner_name, source_channel, lead_temperature,
  onboarding_status, preferred_alert_channel, next_action,
  last_contacted_at, tags, notes
) values
  ('Tom', 'info@yourhandyman.ie', '+353 83 315 0617', 'Your Handy Man',
   'Dublin 15, Ireland', 'lead',
   'lead', 'new', 'Handyman', 'Handyman', 'https://yourhandyman.ie/',
   'Dublin 15, 7, 9, 11, 20 (Blanchardstown, Castleknock, Clonsilla)', 'Tom',
   'research', 'warm',
   'not-started', 'email', 'First cold call — missing call angle, multi-step form likely loses leads',
   null, ARRAY['priority:high','no-instagram','small-op'],
   '15+ yrs. No Facebook/Insta listed on site. Multi-step quote form which loses traffic mid-funnel. WhatsApp link present. Solo operator. Strong "missing call when on the job" angle.'
  ),
  ('Owen Flynn', 'info@thehometeam.ie', '+353 1 685 2574', 'The Home Team',
   'Dublin, Ireland', 'lead',
   'lead', 'new', 'Handyman', 'Handyman', 'https://thehometeam.ie/',
   'Dublin', 'Owen Flynn',
   'research', 'warm',
   'not-started', 'email', 'First cold call — no social channels at all, small team',
   null, ARRAY['priority:high','no-social','small-team'],
   '25+ yrs handyman experience. No social channels mentioned anywhere on site. Same-day quotes by phone/email. Available 7 days. Strong "we''re missing leads outside hours" angle.'
  ),
  ('Kane Nolan', 'info@knes.ie', '+353 1 451 6880', 'KN Electrical Services',
   'Kildare-based, Ireland', 'lead',
   'lead', 'new', 'Electrical', 'Electrical', 'https://www.knelectricalservices.ie/',
   'Kildare + Dublin coverage', 'Kane Nolan',
   'research', 'warm',
   'not-started', 'email', 'First cold call — Mon-Fri 8-4 hours = missing evenings + weekends',
   null, ARRAY['priority:high','limited-hours','RECI'],
   'Est 2008. Owner Kane Nolan. RECI registered. Office hours Mon-Fri 8:00-16:00 = guaranteed missing after-hours + weekend calls. Has FB/LinkedIn/Insta but limited engagement.'
  ),
  ('Owner', 'enquiries@mmk.ie', '+353 1 515 9265', 'MMK Facilities Management (MMK Electricians)',
   'Donabate, Dublin', 'lead',
   'lead', 'new', 'Electrical', 'Electrical', 'https://www.mmkelectricians.ie/',
   'Greater Dublin (Donabate, Swords, Dublin 9), also London', 'Unknown',
   'research', 'warm',
   'not-started', 'email', 'First cold call — basic site, no social mentions, also splits attention with London ops',
   null, ARRAY['priority:medium','basic-site','split-focus'],
   'Two phones: 01 515 9265 + 086 145 2795. Operates both Dublin + London which dilutes focus. Basic quote form. No socials surfaced on site. Likely 1-2 person operation in Dublin.'
  ),
  ('Owner', 'info@stamfordelectrical.ie', '+353 83 308 7584', 'Stamford Electrical',
   '11 Mill Rd, Stadalt, Stamullin, Co. Meath', 'lead',
   'lead', 'new', 'Electrical', 'Electrical', 'https://stamfordelectrical.ie/',
   'Dublin, Kildare, Meath', 'Unknown',
   'research', 'warm',
   'not-started', 'email', 'First cold call — only FB, no Insta, two mobile-only contacts',
   null, ARRAY['priority:medium','minimal-social'],
   '25+ yrs experience claimed. RECI registered. Only Facebook (no Insta/LinkedIn). Two mobile numbers, no landline — strong sign of small op. Quote form basic.'
  ),
  ('Owner', 'info@jlkelectrical.ie', '+353 1 281 0678', 'JLK Electrical',
   'Dublin/Wicklow border area', 'lead',
   'lead', 'new', 'Electrical', 'Electrical', 'https://jlkelectrical.ie/',
   'Dublin & Wicklow', 'Unknown',
   'research', 'warm',
   'not-started', 'email', 'First cold call — Mon-Fri 8-5, weird social presence (Pinterest/Reddit only)',
   null, ARRAY['priority:medium','limited-hours','weird-socials'],
   'RECI registered, "lifetime guarantee" claim. Listed socials: Pinterest, Reddit, Twitter — no Facebook/Insta which is unusual for trades. Mon-Fri 8-5 = misses evenings. Quote form has Domestic/Commercial + Instant Quote/Emergency split.'
  ),
  ('John', 'john@thehandymandublin.com', '+353 87 280 6299', 'The Handyman Dublin',
   '4A Shelton Drive, Suite B, Kimmage, Dublin 6W', 'lead',
   'lead', 'new', 'Handyman', 'Handyman', 'https://thehandymandublin.com/',
   'Dublin City & County (D6W base)', 'John',
   'research', 'cold',
   'not-started', 'email', 'First cold call — established 1982, weekend gap (closed Sat/Sun)',
   null, ARRAY['priority:medium','weekend-gap','older-op'],
   'Est 1982 — long-running. Owner John. Has multiple social channels (FB/Twitter/Insta/Yelp/Pinterest). M-F 9-9 hours = closed both weekend days. WhatsApp for photo submissions. May feel they have it figured out — qualify hard.'
  ),
  ('Owner', 'info@acrplumbingandheating.ie', '+353 1 497 9838', 'ACR Plumbing and Heating Ltd',
   '1 Gandon Close, Harolds Cross, Dublin 6W, D6W CF44', 'lead',
   'lead', 'new', 'Plumbing/Heating', 'Plumbing', 'https://www.acrplumbingandheating.ie/',
   'Dublin South', 'Unknown',
   'research', 'cold',
   'not-started', 'email', 'First cold call — established 1990 with full socials, may already be sorted',
   null, ARRAY['priority:low','established','full-social'],
   'Founded 1990, family-operated, 30+ yrs. RGII registered. Strong social presence (FB/Twitter/LinkedIn/Insta). Likely has lead handling sorted. Qualify hard for missed-call angle — push on weekend cover specifically.'
  ),
  ('Owner', 'info@dewargasservice.ie', '+353 1 514 3344', 'DeWAR Gas Service',
   '68 Rathgar Avenue, Rathgar, Dublin 6, D06KN53', 'lead',
   'lead', 'new', 'Heating/Gas', 'Heating', 'https://dewargasservice.ie/',
   'All Dublin (D1-D24)', 'Unknown',
   'research', 'cold',
   'not-started', 'email', 'First cold call — claims 30k customers, may be too large but try the website redesign angle',
   null, ARRAY['priority:low','larger-op'],
   'RGII + OFTEC registered. "Over 30,000 customers" claim suggests larger op. Only Facebook (no Insta) — possible website redesign angle. Has online quote system already. Qualify hard or skip to a smaller competitor.'
  )
on conflict (email) do nothing;