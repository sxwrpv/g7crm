const PUBLIC_LEAD_FIELDS = new Set([
  'business_name',
  'lead_name',
  'lead_phone',
  'lead_email',
  'service_requested',
  'urgency',
  'message',
]);

/**
 * @typedef {{
 *   business_name: string,
 *   lead_name: string,
 *   lead_phone: string,
 *   lead_email: string | null,
 *   service_requested: string,
 *   urgency: string,
 *   message: string,
 *   source_channel: 'website-form',
 *   submission_status: 'new',
 *   inquiry_type: 'urgent-call' | 'standard'
 * }} ValidatedLead
 */

/**
 * @param {unknown} configuredSecret
 * @param {unknown} suppliedSecret
 * @returns {{ok: false, status: number, error: string} | {ok: true, status: number}}
 */
export function authorizeSharedSecret(configuredSecret, suppliedSecret) {
  if (typeof configuredSecret !== 'string' || configuredSecret.length < 32) {
    return { ok: false, status: 500, error: 'server configuration error' };
  }
  if (typeof suppliedSecret !== 'string' || !constantTimeEqual(suppliedSecret, configuredSecret)) {
    return { ok: false, status: 403, error: 'forbidden' };
  }
  return { ok: true, status: 200 };
}

function constantTimeEqual(left, right) {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

/**
 * @param {Record<string, unknown> | null | undefined} input
 * @returns {{ok: false, status: number, error: string} | {ok: true, value: ValidatedLead}}
 */
export function validateLeadPayload(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return invalid('body must be a JSON object');
  }

  const keys = Object.keys(input);
  const unknown = keys.find((key) => !PUBLIC_LEAD_FIELDS.has(key));
  if (unknown) return invalid(`unknown field: ${unknown}`);

  const businessName = cleanString(input.business_name);
  const leadName = cleanString(input.lead_name);
  const leadPhone = cleanString(input.lead_phone);
  const leadEmail = cleanString(input.lead_email).toLowerCase();
  const service = cleanString(input.service_requested) || 'General enquiry';
  const urgency = cleanString(input.urgency) || 'normal';
  const message = cleanString(input.message);

  if (businessName.length < 2 || businessName.length > 120) return invalid('invalid business_name');
  if (leadName.length < 2 || leadName.length > 100) return invalid('invalid lead_name');
  if (leadPhone.length < 7 || leadPhone.length > 32 || !/^[+()0-9 .-]+$/.test(leadPhone)) return invalid('invalid lead_phone');
  if (leadEmail && (leadEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadEmail))) return invalid('invalid lead_email');
  if (service.length > 100) return invalid('invalid service_requested');
  if (!['low', 'normal', 'high', 'emergency'].includes(urgency)) return invalid('invalid urgency');
  if (message.length > 2000) return invalid('invalid message');

  return {
    ok: true,
    value: {
      business_name: businessName,
      lead_name: leadName,
      lead_phone: leadPhone,
      lead_email: leadEmail || null,
      service_requested: service,
      urgency,
      message,
      source_channel: 'website-form',
      submission_status: 'new',
      inquiry_type: urgency === 'emergency' ? 'urgent-call' : 'standard',
    },
  };
}

/** @param {unknown} value */
function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * @param {string} error
 * @returns {{ok: false, status: number, error: string}}
 */
function invalid(error) {
  return { ok: false, status: 400, error };
}
