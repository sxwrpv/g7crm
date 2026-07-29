const SUPABASE_URL = 'https://fbstesgbttojfysznddq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_4cSGroJ_acAu_YhAvocx8w_Gg-USqAe';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const APP_CONFIG = {
  // Public Cloudflare Turnstile site key. This is intentionally browser-visible.
  turnstileSiteKey: '',
  defaultNiche: 'Home Services',
  // Emails allowed to sign into the dashboard. Add more as needed.
  allowedOperators: ['hello@g7systems.xyz'],
};
