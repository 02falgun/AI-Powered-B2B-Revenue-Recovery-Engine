/**
 * PII and Secret Scrubbing Engine for RecoverAI Observability (Phase P6).
 *
 * Strict Compliance:
 * - Redacts raw buyer email body text and freeform message contents.
 * - Redacts API keys, bearer tokens, service role secrets, webhook secrets.
 * - Redacts customer email addresses, credit cards, CVVs, phone numbers.
 * - Preserves non-sensitive diagnostic metadata: invoiceId, companyId, errorType, httpStatus, guardrailTriggered, latencyMs.
 */

const REDACTED_BODY_MARKER = '[REDACTED_EMAIL_BODY]';
const REDACTED_SECRET_MARKER = '[REDACTED_SECRET]';
const REDACTED_CARD_MARKER = '[REDACTED_CARD]';
const REDACTED_EMAIL_MARKER = '[REDACTED_EMAIL]';
const REDACTED_PHONE_MARKER = '[REDACTED_PHONE]';

// Field names that contain untrusted or sensitive message bodies
const SENSITIVE_BODY_KEYS = new Set([
  'body',
  'email_body',
  'emailbody',
  'raw_text',
  'rawtext',
  'message_text',
  'content',
  'evidence',
  'rationale',
  'prompt',
]);

// Field names that contain secrets or credentials
const SENSITIVE_SECRET_KEYS = new Set([
  'password',
  'secret',
  'api_key',
  'apikey',
  'gemini_api_key',
  'token',
  'auth',
  'authorization',
  'service_role_key',
  'supabase_service_role_key',
  'razorpay_key_secret',
  'webhook_secret',
  'cookie',
  'set-cookie',
  'cvv',
]);

// Regex for detecting email addresses in freeform string values
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

// Regex for detecting 13-19 digit credit card numbers (including spaced/hyphenated)
const CARD_REGEX = /\b(?:\d[ -]*?){13,19}\b/g;

// Regex for detecting phone numbers
const PHONE_REGEX = /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;

// Field names that are known safe identifiers (preserve without regex masking)
const SAFE_ID_KEYS = new Set([
  'id',
  'invoiceid',
  'invoice_id',
  'companyid',
  'company_id',
  'invoicenumber',
  'invoice_number',
  'paymentid',
  'payment_id',
  'paymentlinkid',
  'payment_link_id',
  'messageid',
  'message_id',
]);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Sanitizes a primitive string value by masking embedded credit cards, emails, and phone numbers.
 */
export function scrubString(val: string): string {
  if (!val || typeof val !== 'string') return val;

  // If the string is a valid UUID, do not corrupt it
  if (UUID_REGEX.test(val.trim())) {
    return val;
  }

  let scrubbed = val;
  // Mask credit card patterns (13-19 digits, standard card lengths)
  scrubbed = scrubbed.replace(CARD_REGEX, (match) => {
    const digitsOnly = match.replace(/\D/g, '');
    if (digitsOnly.length >= 13 && digitsOnly.length <= 19 && !UUID_REGEX.test(match)) {
      return REDACTED_CARD_MARKER;
    }
    return match;
  });

  // Mask email addresses
  scrubbed = scrubbed.replace(EMAIL_REGEX, REDACTED_EMAIL_MARKER);

  // Mask phone numbers
  scrubbed = scrubbed.replace(PHONE_REGEX, REDACTED_PHONE_MARKER);

  return scrubbed;
}

/**
 * Recursively sanitizes any payload, object, error, or array, redacting sensitive keys and PII.
 */
export function scrubPiiAndSecrets<T>(input: T): T {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === 'string') {
    return scrubString(input) as unknown as T;
  }

  if (typeof input === 'number' || typeof input === 'boolean') {
    return input;
  }

  if (input instanceof Error) {
    const scrubbedError: Record<string, unknown> = {
      name: input.name,
      message: scrubString(input.message),
      stack: input.stack ? scrubString(input.stack) : undefined,
    };
    return scrubbedError as unknown as T;
  }

  if (Array.isArray(input)) {
    return input.map((item) => scrubPiiAndSecrets(item)) as unknown as T;
  }

  if (typeof input === 'object') {
    const scrubbedObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();

      // 0. Preserve safe ID keys
      if (SAFE_ID_KEYS.has(lowerKey) && typeof value === 'string') {
        scrubbedObj[key] = value;
        continue;
      }

      // 1. Redact body content fields
      if (SENSITIVE_BODY_KEYS.has(lowerKey)) {
        scrubbedObj[key] = REDACTED_BODY_MARKER;
        continue;
      }

      // 2. Redact secret fields
      if (
        SENSITIVE_SECRET_KEYS.has(lowerKey) ||
        lowerKey.includes('secret') ||
        lowerKey.includes('password') ||
        lowerKey.includes('token') ||
        lowerKey.includes('api_key')
      ) {
        scrubbedObj[key] = REDACTED_SECRET_MARKER;
        continue;
      }

      // 3. Customer email / sender fields
      if (lowerKey === 'customer_email' || lowerKey === 'customeremail' || lowerKey === 'sender') {
        scrubbedObj[key] = REDACTED_EMAIL_MARKER;
        continue;
      }

      // 4. Recursively scrub nested objects and values
      scrubbedObj[key] = scrubPiiAndSecrets(value);
    }
    return scrubbedObj as unknown as T;
  }

  return input;
}
