const SUPABASE_URL = 'https://fbstesgbttojfysznddq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_4cSGroJ_acAu_YhAvocx8w_Gg-USqAe';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const APP_CONFIG = {
  n8nLeadWebhookUrl: 'http://127.0.0.1:5678/webhook/agency-lead-intake',
  telegramBridgeUrl: 'http://127.0.0.1:8765/send',
  defaultNiche: 'Plumber',
};
