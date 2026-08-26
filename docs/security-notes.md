# RecoverAI — Security & Threat Modeling Architecture

## 1. Threat Model & Security Posture
RecoverAI operates at the intersection of natural language processing and financial payment gateways. Its security architecture assumes:
1. **Untrusted Inputs**: All inbound emails, webhooks, and client payloads are treated as potentially malicious or adversarial.
2. **Untrusted AI Outputs**: LLMs are considered probabilistic text processors; they are never granted direct write access to ledgers or payment creation APIs without policy gating.
3. **Multi-Tenant Isolation**: No tenant may read or mutate another tenant's invoices, audit trails, or customer email jobs.

---

## 2. Cryptographic Webhook Validation (HMAC-SHA256)
All callbacks from Razorpay (`/api/webhook/razorpay`) are cryptographically validated before database processing:
```typescript
const expectedSignature = crypto
  .createHmac('sha256', webhookSecret)
  .update(rawBody)
  .digest('hex');

const isValid = crypto.timingSafeEqual(
  Buffer.from(signature, 'utf8'),
  Buffer.from(expectedSignature, 'utf8'),
);
```
- **Constant-Time Comparison**: Mitigates timing attacks on signature verification.
- **Fail-Closed Handling**: Missing secret or signature immediately returns HTTP 400.

---

## 3. PII Sanitization & Zero-Leakage Telemetry
The PII Scrubber (`src/lib/scrubber.ts`) strips sensitive personal and financial identifiers prior to logging, console printing, or forwarding to Sentry:
- **Aadhaar Numbers**: Masked as `[REDACTED_AADHAAR]` (12 digits with optional spaces/hyphens).
- **PAN Cards**: Masked as `[REDACTED_PAN]` (5 letters + 4 digits + 1 letter).
- **Credit/Debit Cards**: Masked as `[REDACTED_CARD]` (13–19 digits).
- **Phone Numbers**: Masked as `[REDACTED_PHONE]` (+91 / 10-digit formats).
- **Email Addresses**: Partially masked (e.g. `u***@domain.com`).

---

## 4. Rate Limiting & Denial-of-Service Interlocks
Powered by Upstash Redis sliding-window algorithms (`@upstash/ratelimit`):
- **Email Processing Endpoint** (`POST /api/process-email`): 30 requests per minute per IP/tenant.
- **Admin Purge Endpoint** (`POST /api/admin/purge-company`): 5 requests per minute per admin.
- **In-Memory Fail-Closed Fallback**: If Redis connectivity drops, the system falls back to a secure local memory store to prevent unrestricted API hammering.

---

## 5. Multi-Tenant Row-Level Security (RLS)
Supabase PostgreSQL enforces data segregation at the database engine level. Every table (`invoices`, `ingested_email_jobs`, `audit_logs`, `companies`) binds to `company_id`.
- User JWTs are stamped with `company_id` upon authentication.
- Direct SQL injections or cross-tenant query tampering fail automatically because RLS filters all rows matching `auth.jwt() ->> 'company_id'`.

---

## 6. Uptime & Endpoint Health Monitoring
A dedicated zero-auth health check endpoint is exposed for uptime monitoring:
- **Endpoint**: `GET /api/health`
- **Checks**: Supabase database connectivity, schema availability, and system clock drift.
- **UptimeRobot Integration**: Configured as HTTP GET check with 60-second intervals and 200 OK assertion.
