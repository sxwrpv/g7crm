import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { authorizeSharedSecret, validateLeadPayload } from '../supabase/functions/_shared/security.mjs';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('weekly report authorization fails closed when the server secret is absent', () => {
  assert.deepEqual(authorizeSharedSecret(undefined, undefined), {
    ok: false,
    status: 500,
    error: 'server configuration error',
  });
});

test('weekly report authorization rejects a missing or incorrect caller secret', () => {
  const configured = 'a-secure-value-with-at-least-32-characters';
  assert.equal(authorizeSharedSecret(configured, undefined).status, 403);
  assert.equal(authorizeSharedSecret(configured, 'wrong').status, 403);
  assert.equal(authorizeSharedSecret(configured, configured).ok, true);
});

test('lead validation accepts only the public fields and creates server-managed values', () => {
  const result = validateLeadPayload({
    business_name: ' Murphy Heating ',
    lead_name: ' Anne Murphy ',
    lead_phone: ' +353 87 123 4567 ',
    lead_email: ' ANNE@EXAMPLE.IE ',
    service_requested: 'Heating',
    urgency: 'high',
    message: 'Please call tomorrow.',
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    business_name: 'Murphy Heating',
    lead_name: 'Anne Murphy',
    lead_phone: '+353 87 123 4567',
    lead_email: 'anne@example.ie',
    service_requested: 'Heating',
    urgency: 'high',
    message: 'Please call tomorrow.',
    source_channel: 'website-form',
    submission_status: 'new',
    inquiry_type: 'standard',
  });
});

test('lead validation rejects client attempts to set privileged fields', () => {
  const result = validateLeadPayload({
    business_name: 'Murphy Heating',
    lead_name: 'Anne Murphy',
    lead_phone: '+353871234567',
    customer_id: 'attacker-controlled',
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
});

test('lead validation rejects invalid and oversized contact data', () => {
  assert.equal(validateLeadPayload({ business_name: 'A', lead_name: 'Anne', lead_phone: '+353871234567' }).ok, false);
  assert.equal(validateLeadPayload({ business_name: 'Valid Co', lead_name: 'Anne', lead_phone: 'x' }).ok, false);
  assert.equal(validateLeadPayload({ business_name: 'Valid Co', lead_name: 'Anne', lead_phone: '+353871234567', message: 'x'.repeat(2001) }).ok, false);
});

test('tracked SQL contains no embedded weekly report credential', async () => {
  const sql = await read('supabase/migrations/20260717_weekly_client_reports.sql');
  assert.doesNotMatch(sql, /'x-g7-secret'\s*,\s*'[0-9a-f]{32,}'/i);
});

test('security foundations provide rate limiting, atomic intake processing, and authenticated triggers', async () => {
  const sql = await read('supabase/migrations/20260729_security_foundations.sql');
  assert.match(sql, /consume_lead_rate_limit/i);
  assert.match(sql, /submission_status\s*=\s*'processing'/i);
  assert.match(sql, /process_lead_submission/i);
  assert.match(sql, /for update skip locked/i);
  assert.match(sql, /tasks_source_lead_submission_uidx/i);
  assert.match(sql, /automation_runs_idempotency_uidx/i);
  assert.match(sql, /x-g7-intake-secret/i);
  assert.match(sql, /g7_intake_processor_secret/i);
  assert.doesNotMatch(sql, /to_jsonb\(NEW\)/i);
});

test('corrective RLS migration revokes anonymous inserts and requires operator membership', async () => {
  const sql = await read('supabase/migrations/20260729_security_hardening.sql');
  assert.match(sql, /revoke\s+insert\s+on\s+public\.lead_submissions\s+from\s+anon/i);
  assert.match(sql, /security\s+definer/i);
  assert.match(sql, /auth\.uid\(\)/i);
  assert.match(sql, /is_crm_operator\(\)/i);
  assert.match(sql, /security hardening aborted: confirmed hello@g7systems\.xyz operator is missing/i);
  assert.ok(sql.indexOf('security hardening aborted') < sql.indexOf('create policy %I'));
  assert.doesNotMatch(sql, /to\s+authenticated\s+using\s*\(true\)/i);
});

test('public form invokes the protected function instead of inserting directly', async () => {
  const html = await read('web/index.html');
  assert.match(html, /functions\.invoke\(['"]submit-lead['"]/);
  assert.doesNotMatch(html, /from\(['"]lead_submissions['"]\)\.insert/);

  for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)) {
    if (match[1].trim()) new Function(match[1]);
  }
});

test('submit-lead rate limits before and after Turnstile without returning an internal ID', async () => {
  const source = await read('supabase/functions/submit-lead/index.ts');
  const preLimit = source.indexOf('preRateKey');
  const turnstile = source.indexOf('const verified = await verifyTurnstile');
  const postLimit = source.indexOf('const rateKey =');
  const insert = source.indexOf('.from("lead_submissions").insert');
  assert.ok(preLimit >= 0);
  assert.ok(turnstile > preLimit);
  assert.ok(postLimit > turnstile);
  assert.ok(insert > postLimit);
  assert.match(source, /challenges\.cloudflare\.com\/turnstile\/v0\/siteverify/);
  assert.match(source, /result\.action === "lead-submit"/);
  assert.doesNotMatch(source, /return json\(\{ ok: true, id:/);
});

test('intake processor requires its trigger secret and delegates DB work atomically', async () => {
  const source = await read('supabase/functions/intake-processor/index.ts');
  const auth = source.indexOf('authorizeSharedSecret');
  const process = source.indexOf('.rpc("process_lead_submission"');
  assert.ok(auth >= 0);
  assert.ok(process > auth);
  assert.doesNotMatch(source, /\.from\("customers"\)/);
  assert.doesNotMatch(source, /\.from\("tasks"\)/);
  assert.doesNotMatch(source, /\.from\("automation_runs"\)/);
});
