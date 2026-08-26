# RecoverAI — Engineering Rules & Invariants

## 1. The Money Correctness Invariant (Paise Math)
Financial arithmetic in floating-point JavaScript (`Number`) is strictly prohibited for monetary transactions.
- **Rule 1.1**: All internal state, comparisons, database records, and payment payloads MUST use integer **paise** (`1 INR = 100 paise`).
- **Rule 1.2**: Floating-point conversions (e.g. `amountPaise / 100`) are permitted ONLY at the visual presentation layer (`.toFixed(2)` for UI display).
- **Rule 1.3**: When extracting promised percentages (e.g. "I will pay 50% now"), calculate `Math.round((percentage / 100) * outstandingPaise)` strictly against the database authoritative balance.

---

## 2. The Fail-Closed Policy Invariant ("Frozen Core")
The Policy Engine (`src/lib/policy.ts` -> `evaluatePolicy()`) is the **sole authority** for authorizing autonomous financial recovery actions (`AUTO_RECOVER`).
- **Rule 2.1**: AI outputs are strictly treated as **untrusted proposals**. The LLM never makes financial decisions or triggers API mutations directly.
- **Rule 2.2**: Any exception, unexpected payload structure, missing field, confidence score below 0.80, or dispute flag MUST immediately trigger `HUMAN_REVIEW`.
- **Rule 2.3**: `evaluatePolicy()` must remain a pure, deterministic TypeScript function with zero external network side-effects.

---

## 3. Cryptographic & Security Rules
- **Rule 3.1 (HMAC Webhook Verification)**: All inbound Razorpay webhooks (`/api/webhook/razorpay`) must verify the `X-Razorpay-Signature` header against `RAZORPAY_WEBHOOK_SECRET` using `crypto.timingSafeEqual()`. Requests with missing or invalid signatures return HTTP 400 immediately.
- **Rule 3.2 (PII Scrubbing)**: No raw buyer PII (Indian phone numbers, email addresses, credit card numbers, PAN, Aadhaar) may be written to console logs, server telemetry, or Sentry breadcrumbs. All logs must pass through `scrubPii()` (`src/lib/scrubber.ts`).
- **Rule 3.3 (Zero Secret Leakage)**: Server-side secrets (`SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_KEY_SECRET`, `UPSTASH_REDIS_REST_TOKEN`, `GEMINI_API_KEY`, `OPENAI_API_KEY`) must never be prefixed with `NEXT_PUBLIC_` or bundled in client builds.

---

## 4. Multi-Tenant Data Isolation
- **Rule 4.1**: Every database query touching invoices, email jobs, or audit logs MUST be explicitly filtered or scoped by `company_id`.
- **Rule 4.2**: API routes requiring authorization must authenticate the caller session and reject cross-tenant data access with HTTP 403 / 401.

---

## 5. Testing & Verification Standards
- **Rule 5.1 (Build Cleanliness)**: Every pull request and release commit must compile cleanly with `npm run build` and zero TypeScript errors.
- **Rule 5.2 (Test Invariant)**: All automated test suites (`npm test`), including unit, integration, dual-payment idempotency, and 100-case evaluation benchmarks, must pass with 100.0% primary safety metrics.
- **Rule 5.3 (Determinism Check)**: The policy engine suite must verify identical output byte-for-byte across consecutive runs.
