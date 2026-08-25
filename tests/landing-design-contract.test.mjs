import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const landing = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
const robots = readFileSync(new URL('../web/robots.txt', import.meta.url), 'utf8');
const sitemap = readFileSync(new URL('../web/sitemap.xml', import.meta.url), 'utf8');

test('public landing page has no artificial scarcity badge', () => {
  assert.doesNotMatch(landing, /2 Dublin slots open this month/i);
  assert.doesNotMatch(landing, /class=["']demo-badge["']/i);
});

test('package names use plain text without decorative stickers or emoji', () => {
  assert.doesNotMatch(landing, /Standard\s*[⭐🌟★]/u);
});

test('five-stage workflow covers capture through permission-aware growth', () => {
  assert.match(landing, /<ol class="workflow"/);
  assert.equal((landing.match(/class="workflow-stage"/g) || []).length, 5);
  for (const label of ['Capture', 'Respond', 'Qualify in G7CRM', 'Book &amp; follow up', 'Grow']) {
    assert.match(landing, new RegExp(`>${label}<`, 'i'));
  }
  assert.match(landing, /Automated/);
  assert.match(landing, /Human handoff/);
  assert.match(landing, /owner alert/i);
  assert.match(landing, /reactivation where permitted/i);
});

test('setup foundations include all requested services', () => {
  for (const service of [
    'Google Business Profile setup',
    'WhatsApp Business setup',
    'Missed-call &amp; auto-reply setup',
    'Google review system',
    'Customer email follow-up',
    'Custom business websites',
  ]) assert.match(landing, new RegExp(service, 'i'));
});

test('package scopes match the requested managed-service tiers', () => {
  assert.match(landing, /Starter<small>Lead capture \+ auto-reply \+ G7CRM<\/small>/);
  assert.match(landing, /Standard<small>Starter \+ WhatsApp \+ custom website<\/small>/);
  assert.match(landing, /Growth<small>Standard \+ GBP, reviews, email follow-up &amp; Google Ads<\/small>/);
});

test('website offer is custom and not limited to a one-page build', () => {
  assert.doesNotMatch(landing, /one-page website/i);
  assert.match(landing, /built to your requirements/i);
});

test('pricing is exact and setup fee is individually quoted without an amount', () => {
  for (const price of ['€290', '€490', '€890']) assert.match(landing, new RegExp(price));
  assert.equal((landing.match(/€(?:290|490|890)/g) || []).length, 3);
  assert.match(landing, /one-time setup fee is quoted individually after the audit/i);
  assert.doesNotMatch(landing, /setup fee[^<.]*€\d/i);
});

test('SEO metadata and crawler files point to the production root', () => {
  assert.match(landing, /<link rel="canonical" href="https:\/\/g7systems\.xyz\/"/);
  assert.match(landing, /<title>CRM &amp; Lead Recovery for Irish Trades \| G7 Systems<\/title>/);
  assert.match(landing, /"@type": "Organization"/);
  assert.doesNotMatch(landing, /"postalAddress"|"aggregateRating"|"sameAs"/);
  assert.match(robots, /Sitemap: https:\/\/g7systems\.xyz\/sitemap\.xml/);
  assert.match(sitemap, /<loc>https:\/\/g7systems\.xyz\/<\/loc>/);
});

test('public examples and claims are framed truthfully', () => {
  assert.match(landing, /G7CRM · example scenario/);
  assert.match(landing, /fictional concepts/i);
  assert.doesNotMatch(landing, /€240 job won|0 leads lost|120\+ reviews/i);
});
