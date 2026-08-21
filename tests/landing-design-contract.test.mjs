import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const landing = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');

test('public landing page has no artificial scarcity badge', () => {
  assert.doesNotMatch(landing, /2 Dublin slots open this month/i);
  assert.doesNotMatch(landing, /class=["']demo-badge["']/i);
});

test('package names use plain text without decorative stickers or emoji', () => {
  assert.doesNotMatch(landing, /Standard\s*[⭐🌟★]/u);
});
