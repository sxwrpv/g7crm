-- Tier 1 prospects: sole-trader Dublin trades with NO website.
-- Sourced from goldenpages.ie 2026-05-26 (handyman, electrician, plumber categories).
--
-- These are the actual cold targets — they have zero lead-handling infrastructure
-- and need the full bundle (website + lead system). The 'tier:established' prospects
-- from the earlier migration (`20260526_starter_prospects.sql`) are demoted to
-- low priority + tagged for the "upgrade your existing system" pitch instead.

insert into public.customers (
  name, email, phone, company, address, status,
  record_type, account_stage, business_type, niche, website_url,
  service_area, source_channel, lead_temperature,
  onboarding_status, next_action, tags, notes
) values
  ('Emile', 'goldenpages-emile@no-email.tradelead.local', '+353 1 495 0694', 'Emile (Handyman)',
   'Knocklyon, Dublin', 'lead', 'lead', 'new', 'Handyman', 'Handyman', null,
   'Knocklyon, Dublin', 'goldenpages', 'cold', 'not-started',
   'First cold call - sole trader, no website',
   ARRAY['priority:high','tier:cold-target','no-website','sole-trader'],
   'Single name (Emile), single phone, no website, no other digital trace. Pure cold target. Pitch the full bundle.'),
  ('Owner', 'goldenpages-dublincityhandyman@no-email.tradelead.local', '+353 83 167 5607', 'Dublin City Handyman',
   'Kimmage, Dublin 12', 'lead', 'lead', 'new', 'Handyman', 'Handyman', null,
   'Kimmage (D12)', 'goldenpages', 'cold', 'not-started',
   'First cold call - sole op, no website',
   ARRAY['priority:high','tier:cold-target','no-website','sole-trader'],
   'No website, mobile only. Kimmage (D12).'),
  ('Owner', 'goldenpages-handymandalkey@no-email.tradelead.local', '+353 86 061 8325', 'Handyman Dalkey',
   'Dalkey, Dublin', 'lead', 'lead', 'new', 'Handyman', 'Handyman', null,
   'Dalkey', 'goldenpages', 'cold', 'not-started',
   'First cold call - geographic single-area op',
   ARRAY['priority:high','tier:cold-target','no-website','geographic-focus'],
   'Single area (Dalkey only). No website. Mobile only.'),
  ('Owner', 'goldenpages-dbbuilding@no-email.tradelead.local', '+353 85 222 7080', 'DB Building Solutions',
   'Finglas South, Dublin 11', 'lead', 'lead', 'new', 'Handyman/General', 'Handyman', null,
   'Finglas South (D11)', 'goldenpages', 'cold', 'not-started',
   'First cold call - no website',
   ARRAY['priority:high','tier:cold-target','no-website'],
   'No website. Mobile only. Finglas South.'),
  ('Owner', 'goldenpages-nmandsons@no-email.tradelead.local', '+353 85 224 5347', 'N.M & Sons Handyman Services',
   'Ballyfermot, Dublin', 'lead', 'lead', 'new', 'Handyman', 'Handyman', null,
   'Ballyfermot', 'goldenpages', 'cold', 'not-started',
   'First cold call - family op, no website',
   ARRAY['priority:high','tier:cold-target','no-website','family-op'],
   'Family-run (initials + Sons). No website. Ballyfermot. Likely father-son.'),
  ('CDunn', 'goldenpages-cdunn@no-email.tradelead.local', '+353 85 720 7713', 'CDUNN Carpenter/Handyman',
   'Dublin 1', 'lead', 'lead', 'new', 'Carpenter/Handyman', 'Handyman', null,
   'Dublin 1', 'goldenpages', 'cold', 'not-started',
   'First cold call - sole trader, initials only',
   ARRAY['priority:high','tier:cold-target','no-website','sole-trader'],
   'Initials-only naming = one-person op. No website. Dublin 1.'),
  ('Owner', 'goldenpages-handyhomeservice@no-email.tradelead.local', '+353 87 765 8476', 'Handy Home Service',
   'Stepaside, Dublin 18', 'lead', 'lead', 'new', 'Handyman', 'Handyman', null,
   'Stepaside (D18)', 'goldenpages', 'cold', 'not-started',
   'First cold call - no website, single area',
   ARRAY['priority:high','tier:cold-target','no-website'],
   'No website. Mobile only. Stepaside.'),
  ('Owner', 'goldenpages-metropolis@no-email.tradelead.local', '+353 89 221 5304', 'Metropolis (Handyman)',
   'Dun Laoghaire, Dublin', 'lead', 'lead', 'new', 'Handyman', 'Handyman', null,
   'Dun Laoghaire', 'goldenpages', 'cold', 'not-started',
   'First cold call - no website',
   ARRAY['priority:high','tier:cold-target','no-website'],
   'No website. Mobile only. Dun Laoghaire.'),
  ('Owner', 'goldenpages-everybodyneeds@no-email.tradelead.local', '+353 85 287 1348', 'Everybody Needs a Handyman',
   'Coolock, Dublin 17', 'lead', 'lead', 'new', 'Handyman', 'Handyman', null,
   'Coolock (D17)', 'goldenpages', 'cold', 'not-started',
   'First cold call - no website, sole trader',
   ARRAY['priority:high','tier:cold-target','no-website','sole-trader'],
   'No website. Mobile only. Coolock. Cheeky name = sole trader.'),
  ('David Molloy', 'goldenpages-davidmolloy@no-email.tradelead.local', '+353 87 217 0853', 'David Molloy Dublin Handyman',
   'Millbrook Lawns, Dublin', 'lead', 'lead', 'new', 'Handyman', 'Handyman', null,
   'Dublin', 'goldenpages', 'cold', 'not-started',
   'First cold call - personal name = sole trader',
   ARRAY['priority:high','tier:cold-target','no-website','sole-trader','named-owner'],
   'Personal-name business. Sole trader. No website. Mobile only.'),
  ('Tito', 'goldenpages-titos@no-email.tradelead.local', '+353 89 444 8724', 'Titos Painting & Renovation',
   'Jobstown, Dublin', 'lead', 'lead', 'new', 'Painting/Handyman', 'Handyman', null,
   'Jobstown', 'goldenpages', 'cold', 'not-started',
   'First cold call - sole trader, no website',
   ARRAY['priority:high','tier:cold-target','no-website','sole-trader','named-owner'],
   'Named owner (Tito). Paint+reno specialist. No website. Mobile only.'),
  ('Owner', 'goldenpages-dublinhandymanservices@no-email.tradelead.local', '+353 89 959 5076', 'Dublin Handyman Services',
   'Dublin 1', 'lead', 'lead', 'new', 'Handyman', 'Handyman', null,
   'Dublin 1', 'goldenpages', 'cold', 'not-started',
   'First cold call - no website',
   ARRAY['priority:medium','tier:cold-target','no-website'],
   'Generic name, no website, mobile only.'),
  ('Joe', 'goldenpages-joewillfixit@no-email.tradelead.local', '+353 87 254 2419', 'Joe Will Fix It',
   'Dublin 13', 'lead', 'lead', 'new', 'Handyman', 'Handyman', null,
   'Dublin 13', 'goldenpages', 'cold', 'not-started',
   'First cold call - personal-name sole trader',
   ARRAY['priority:high','tier:cold-target','no-website','sole-trader','named-owner'],
   'Named owner (Joe). Personality-driven name. No website.'),
  ('Owner', 'goldenpages-housedoc@no-email.tradelead.local', '+353 86 609 9894', 'Housedoc Handyman Services',
   'Drumcondra, Dublin 9', 'lead', 'lead', 'new', 'Handyman', 'Handyman', null,
   'Drumcondra (D9)', 'goldenpages', 'cold', 'not-started',
   'First cold call - no website',
   ARRAY['priority:high','tier:cold-target','no-website'],
   'No website. Mobile only. Drumcondra. Brand-y name + no digital follow-through = clear leak.'),
  ('Owner', 'goldenpages-dundrumhandyman@no-email.tradelead.local', '+353 89 424 3342', 'Dundrum Handy Man',
   'Dundrum, Dublin', 'lead', 'lead', 'new', 'Handyman', 'Handyman', null,
   'Dundrum', 'goldenpages', 'cold', 'not-started',
   'First cold call - geographic sole trader',
   ARRAY['priority:high','tier:cold-target','no-website','geographic-focus'],
   'Geographic single area (Dundrum). No website. Mobile only.'),
  ('Owner', 'goldenpages-dunneelec@no-email.tradelead.local', '+353 1 691 7658', 'DunneElec Electrical Contractors',
   'Dublin 11', 'lead', 'lead', 'new', 'Electrical', 'Electrical', null,
   'Dublin 11', 'goldenpages', 'cold', 'not-started',
   'First cold call - electrician with no website',
   ARRAY['priority:medium','tier:cold-target','no-website','RECI-likely'],
   'Electrician with NO website (rare - most have them). Landline only. RECI registered (mandatory) but invisible online.'),
  ('Owner', 'goldenpages-beselectrical@no-email.tradelead.local', '+353 1 485 4954', 'BES Electrical',
   'Baldoyle, Dublin 13', 'lead', 'lead', 'new', 'Electrical', 'Electrical', null,
   'Baldoyle (D13)', 'goldenpages', 'cold', 'not-started',
   'First cold call - electrician with no website',
   ARRAY['priority:medium','tier:cold-target','no-website','RECI-likely'],
   'Electrician with no website. Landline only. Baldoyle. Same as DunneElec — clear digital gap.'),
  ('Owner', 'goldenpages-bcplumbing@no-email.tradelead.local', '+353 87 232 4410', 'BC Plumbing',
   'Dublin 15', 'lead', 'lead', 'new', 'Plumbing', 'Plumbing', null,
   'Dublin 15', 'goldenpages', 'cold', 'not-started',
   'First cold call - plumber with no website (rare!)',
   ARRAY['priority:high','tier:cold-target','no-website','RGII-likely'],
   'Plumber with no website. Mobile only. Initials-only naming (BC) = one-person op. Plumbers RARELY lack websites — strong target.')
on conflict (email) do nothing;

-- Demote earlier "tier:established" prospects so HIGH-priority ones from the
-- previous migration become LOW-priority, fitting the upgrade-pitch.
update public.customers
set tags = array_append(array_remove(tags, 'priority:high'), 'tier:established') || ARRAY['priority:low']
where source_channel = 'research'
  and 'priority:high' = any(tags);

update public.customers
set tags = array_append(array_remove(tags, 'priority:medium'), 'tier:established')
where source_channel = 'research'
  and 'priority:medium' = any(tags)
  and not 'tier:established' = any(tags);

update public.customers
set tags = array_append(tags, 'tier:established')
where source_channel = 'research'
  and not 'tier:established' = any(tags)
  and not 'tier:cold-target' = any(tags);
