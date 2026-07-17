-- G7CRM: allow WhatsApp (and SMS) as an interaction type
-- Additive, non-destructive: widens the existing check constraint only.
-- Safe to run on the live fbstesgbttojfysznddq project.

alter table public.interactions
  drop constraint interactions_type_check;

alter table public.interactions
  add constraint interactions_type_check
  check (
    (type)::text = any (
      (array['call','email','meeting','note','whatsapp','sms']::character varying[])::text[]
    )
  );
