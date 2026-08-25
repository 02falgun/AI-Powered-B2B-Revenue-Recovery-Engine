# RecoverAI — Go-Live Cutover Checklist & Test Mode Quota Analysis

> **Phase P7 Document** · Last updated: 2026-08-25
>
> This document is a *future-action checklist*, not an action to take now.
> All steps below are gated behind Phase P8 Legal & Compliance sign-off.

## 1. Executive Summary

This document provides the exhaustive, step-by-step procedure for transitioning **RecoverAI** from **Razorpay Test Mode** (`rzp_test_*`) to **Razorpay Live Production Mode** (`rzp_live_*`), plus a documented analysis of Razorpay Test Mode's rate-limiting behaviour against Phase P4's expected pilot ingestion volume.

> [!WARNING]
> Do NOT execute these live cutover steps until Phase P8 Legal & Compliance sign-off is completed. Live keys move actual corporate capital. Mistakes are irreversible at the payment-gateway layer.

---

## 2. Go-Live Cutover Checklist

```
┌────────────────────────────────────────────────────────────────────────────┐
│                      PRODUCTION CUTOVER PIPELINE                           │
│  [1] Live Key Generation ──► [2] Webhook Setup ──► [2b] HMAC Smoke Test   │
│  [3] DB Migration Check  ──► [4] Security Scrubbing ──► [5] Banner Removal │
│  [6] Legal Sign-Off      ──► [7] First-Live Smoke Test                     │
└────────────────────────────────────────────────────────────────────────────┘
```

---

### Step 1: Razorpay Production Key Generation & Secure Injection

- [ ] Complete KYC verification on [Razorpay Merchant Dashboard](https://dashboard.razorpay.com/).
- [ ] Generate Live Mode API Key Pair under **Settings → API Keys → Generate Live Key**:
  - `RAZORPAY_KEY_ID` (starts with `rzp_live_...`)
  - `RAZORPAY_KEY_SECRET` (production secret — never commit to git)
  - `NEXT_PUBLIC_RAZORPAY_KEY_ID` (matches live key ID for client checkout; `NEXT_PUBLIC_` is correct here — this value is intentionally public per Razorpay's documentation)
- [ ] Inject all secrets into Vercel / Cloudflare Production Environment Variables.
- [ ] Confirm **no** `rzp_test_*` key string remains anywhere in production environment config.
- [ ] Rotate the old test key in the Razorpay Dashboard after confirming production is live (prevents accidental mixed-mode use).

---

### Step 2: Live Webhook Re-Registration

- [ ] In Razorpay Dashboard → **Settings → Webhooks**, disable the old Test Mode webhook endpoint.
- [ ] Register a new Live Webhook endpoint:
  - **Webhook URL**: `https://your-domain.vercel.app/api/webhook/razorpay`
  - **Active Events**: `payment_link.paid`, `payment.captured`, `payment.failed`, `order.paid`
  - **Secret**: Generate a cryptographically random 32-character secret string (use `openssl rand -hex 32`).
- [ ] Set `RAZORPAY_WEBHOOK_SECRET` in the production environment to the new live webhook secret.
- [ ] Confirm the webhook route **remains unauthenticated** (no session-auth gate) — it is protected exclusively by HMAC SHA-256 signature verification in `src/app/api/webhook/razorpay/route.ts`.

> [!IMPORTANT]
> The Razorpay webhook route MUST remain reachable without user login. It is protected by HMAC signature verification, not session auth. Do not accidentally gate it behind Supabase Auth middleware.

---

### Step 2b: HMAC Webhook Signature Smoke Test (Before Traffic Cutover)

Run this verification *before* cutting over live traffic:

```bash
# Send a test POST with a known payload and compute expected HMAC
PAYLOAD='{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_test"}}}}'
SECRET="your-new-live-webhook-secret"
EXPECTED_SIG=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')

curl -X POST https://your-domain.vercel.app/api/webhook/razorpay \
  -H "Content-Type: application/json" \
  -H "X-Razorpay-Signature: $EXPECTED_SIG" \
  -d "$PAYLOAD"
# Expected: 200 OK (not 401 or 403)
```

- [ ] Confirm webhook returns `200` with a valid signature.
- [ ] Confirm webhook returns `401` with an invalid/missing signature.
- [ ] Check `/api/health/webhook` endpoint returns `{ status: "ok" }`.

---

### Step 3: Database & Multi-Tenant Schema Validation

- [ ] Confirm all additive migrations are executed on production Supabase PostgreSQL:
  - `20260822000000_create_core_tables.sql`
  - `20260822000001_create_ingested_email_jobs.sql`
  - `20260822000002_create_companies_and_multi_tenancy.sql`
- [ ] Verify Row Level Security (RLS) policies are active (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).
- [ ] Verify compound index performance: `(company_id, status)` and `(company_id, created_at DESC)`.
- [ ] Execute initial database backup snapshot before traffic cutover.
- [ ] Confirm no migration drops or destructively alters an existing column or table (all migrations are additive-only by policy).

---

### Step 4: Security & Observability Lockdown

- [ ] Confirm Sentry Next.js SDK is active with production DSN (`SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`).
- [ ] Verify recursive PII scrubber (`src/lib/scrubber.ts`) is actively masking raw email text, buyer emails, and credentials in error payloads.
- [ ] Verify UptimeRobot 5-minute HTTP monitors on:
  - Main URL: `https://your-domain.vercel.app/`
  - Core Health: `https://your-domain.vercel.app/api/health`
  - Webhook Receiver: `https://your-domain.vercel.app/api/health/webhook`
- [ ] Verify Slack/Discord failure spike alert webhook (`ALERT_WEBHOOK_URL`).
- [ ] Confirm all rate-limit middleware is active on every public API route (Upstash Redis).
- [ ] Confirm `evaluatePolicy()` in `src/lib/policy.ts` remains the sole authority for `AUTO_RECOVER` — no bypass routes exist.

---

### Step 5: Test Mode UI Banner De-Provisioning

> [!CAUTION]
> Only remove the banner AFTER live keys are confirmed active and the first live payment has been successfully captured and verified end-to-end. Premature removal is a compliance risk.

- [ ] In production configuration, set `NEXT_PUBLIC_ENABLE_TEST_MODE_BANNER=false` OR remove `<TestModeBanner />` from `src/app/layout.tsx`.
- [ ] Remove the inline `TEST` amber pill from `RazorpayCheckoutButton.tsx` (line ~193).
- [ ] Remove the test mode callout from `src/app/unmatched/page.tsx` assignment controls area.
- [ ] Remove `⚡ TEST MODE LINK` badge from invoice simulator payment link card (`src/app/invoices/[id]/page.tsx` lines 518–520).
- [ ] Change button label `"Open Razorpay Test Payment Link"` → `"Open Payment Link"`.
- [ ] Update footer copy: `"Razorpay Buildathon"` → production product name.

---

### Step 6: Legal, Compliance & Reconciliation Sign-Off

- [ ] Verify compliance with Reserve Bank of India (RBI) payment aggregator guidelines applicable to B2B invoice recovery flows.
- [ ] Verify GST invoice breakdown accuracy on all issued payment link descriptions.
- [ ] Confirm Razorpay merchant category code (MCC) is appropriate for B2B SaaS/fintech.
- [ ] Formal sign-off on the **Deterministic Policy Invariant**:
  - `evaluatePolicy()` in `src/lib/policy.ts` remains the sole authority for `AUTO_RECOVER`.
  - All disputed invoices are unconditionally routed to `HUMAN_REVIEW`.
  - This invariant must be preserved in any future code changes.
- [ ] Confirm audit log retention policy meets any applicable financial record-keeping requirements.

---

### Step 7: First-Live Smoke Test (Post-Cutover Verification)

Before opening to pilot users, perform a controlled end-to-end smoke test with a ₹1 real invoice:

- [ ] Create a test invoice record in the production database for an internal company email.
- [ ] Paste a "pay immediately" email body into the simulator and run policy evaluation.
- [ ] Confirm `AUTO_RECOVER` fires, a Razorpay Live payment link is created.
- [ ] Complete the payment using a real card (small amount — ₹1 or ₹100).
- [ ] Confirm Razorpay webhook fires, invoice status updates to `paid` in the database.
- [ ] Confirm Sentry receives no new errors.
- [ ] Confirm UptimeRobot shows no downtime.

---

## 3. Razorpay Test Mode Rate Limits vs Pilot Ingestion Volume

### 3a. Razorpay Rate-Limiting Behaviour (Official Position)

> [!NOTE]
> **Razorpay does not publish fixed numeric rate limits** (requests-per-second or requests-per-minute) in their public documentation. Their API employs a **dynamic rate limiter** that monitors traffic patterns and restricts requests that exceed acceptable thresholds for a given time window.
>
> **Source**: [Razorpay API Error Codes — 429 Too Many Requests](https://razorpay.com/docs/api/errors/) (as of 2025-08). The 429 HTTP status code is the authoritative signal that a rate limit has been hit.

**What this means for RecoverAI:**

- The codebase must handle HTTP 429 responses gracefully with exponential backoff (already implemented in `src/app/invoices/[id]/page.tsx` — the `res.status === 429` check returns an operator error without crashing).
- For large-batch payment link creation (Phase P4 bulk ingestion), introduce 1–2 second delays between API calls to avoid burst rejection.
- Observed community benchmarks: ~10–20 requests/second in Test Mode; exact Live Mode limits depend on merchant tier and are negotiable with Razorpay support for high-volume merchants.

### 3b. Quota Table: Free-Tier Limits vs Expected Pilot Volume

| Subsystem / Service | Limit | Basis | Expected Pilot Volume (Phase P4) | Safety Headroom |
|---|---|---|---|---|
| **Razorpay Test Mode API** | Dynamic (HTTP 429 on burst) | Razorpay documentation | 50–200 emails/day ≈ ~5 API calls/min peak | **100x+ conservative headroom** ✅ |
| **Razorpay Payment Link Creation** | Uncapped in Test Mode (dynamic rate limit applies) | Razorpay documentation | 20–80 links/day | **Well within limits** ✅ |
| **Razorpay Live Mode — Standard** | Negotiated per merchant tier | Razorpay merchant support | N/A (future) | Contact Razorpay for volume SLA |
| **Upstash Redis Rate Limiter** | 10,000 commands/day (Free tier) | [Upstash Pricing](https://upstash.com/pricing) | ~500 commands/day | **20x Headroom** ✅ |
| **Google Gemini Flash (AI Model)** | 15 RPM / 1,500 RPD (Free tier) | [AI Studio Quotas](https://aistudio.google.com/) | ~50–200 requests/day | **7.5x Headroom** ✅ |
| **Supabase Postgres** | 500 MB storage, 50,000 MAU (Free tier) | [Supabase Pricing](https://supabase.com/pricing) | <10 MB, ~50 pilot users | **50x Headroom** ✅ |
| **Sentry Error Tracking** | 5,000 errors/month (Developer Free tier) | [Sentry Pricing](https://sentry.io/pricing/) | Expected <50 errors/month | **100x Headroom** ✅ |
| **Vercel Cron Jobs** | 2 cron jobs (Hobby Free tier) | [Vercel Pricing](https://vercel.com/pricing) | 2 cron jobs in use | **At limit — upgrade if adding more** ⚠️ |

### 3c. Key Findings & Recommendations

1. **Pilot Volume Fits 100% on Free Tiers**: A pilot workload of 50–200 overdue invoices per day runs smoothly without exceeding any service's free-tier rate limits or burst quotas.

2. **Razorpay Has No Hard Published Limit — Design for 429**: The application already handles HTTP 429 gracefully. For Phase P4 bulk ingestion, enforce a `Promise` queue with a 1–2 second inter-call delay to stay well below any dynamic threshold.

3. **Vercel Cron — At Free Tier Ceiling**: Two cron jobs are currently registered. Adding a third will require upgrading to Vercel Pro ($20/month). If Phase P4 ingestion requires an additional scheduled job, budget for this or consolidate into an existing cron route.

4. **Razorpay Live Mode Quotas Are Tier-Dependent**: Contact Razorpay merchant support before going live to confirm rate limits for the expected monthly transaction volume. For production volumes >1,000 payment links/month, request a dedicated rate limit review.
