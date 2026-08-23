# RecoverAI — Go-Live Cutover Checklist & Test Mode Quota Analysis

## 1. Executive Summary
This document provides the exhaustive, step-by-step procedure for transitioning **RecoverAI** from **Razorpay Test Mode** (`rzp_test_*`) to **Razorpay Live Production Mode** (`rzp_live_*`).

> [!WARNING]
> Do NOT execute these live cutover steps until Phase P8 Legal & Compliance sign-off is completed. Live keys move actual corporate capital.

---

## 2. Go-Live Cutover Checklist

```
┌────────────────────────────────────────────────────────────────────────┐
│                   PRODUCTION CUTOVER PIPELINE                          │
│  [1] Live Key Generation ──► [2] Webhook Setup ──► [3] DB Migration    │
│  [4] Security Scrubbing  ──► [5] Banner Toggle ──► [6] Legal Sign-Off │
└────────────────────────────────────────────────────────────────────────┘
```

### Step 1: Razorpay Production Key Generation & Secure Injection
- [ ] Complete KYC verification on [Razorpay Merchant Dashboard](https://dashboard.razorpay.com/).
- [ ] Generate Live Mode API Key Pair under **Settings → API Keys → Generate Live Key**:
  - `RAZORPAY_KEY_ID` (starts with `rzp_live_...`)
  - `RAZORPAY_KEY_SECRET` (production secret)
  - `NEXT_PUBLIC_RAZORPAY_KEY_ID` (matches live key ID for client checkout)
- [ ] Inject secrets into Vercel / Cloudflare Production Environment Variables (strictly forbidden in git commits or `.env.local`).

---

### Step 2: Live Webhook Re-Registration & HMAC Signature Verification
- [ ] Register new Live Webhook endpoint in Razorpay Dashboard:
  - **Webhook URL**: `https://your-domain.vercel.app/api/webhook/razorpay`
  - **Active Events**: `payment_link.paid`, `payment.captured`, `payment.failed`, `order.paid`
  - **Secret**: Generate a cryptographically random 32-character secret string.
- [ ] Set `RAZORPAY_WEBHOOK_SECRET` in production environment.
- [ ] Verify timing-safe HMAC SHA-256 validation via health check `/api/health/webhook`.

---

### Step 3: Database & Multi-Tenant Schema Validation
- [ ] Confirm all additive migrations are executed on production Supabase PostgreSQL:
  - `20260822000000_create_core_tables.sql`
  - `20260822000001_create_ingested_email_jobs.sql`
  - `20260822000002_create_companies_and_multi_tenancy.sql`
- [ ] Verify Row Level Security (RLS) policies are active (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).
- [ ] Verify compound index performance: `(company_id, status)` and `(company_id, created_at DESC)`.
- [ ] Execute initial database backup snapshot before traffic cutover.

---

### Step 4: Security & Observability Lockdown
- [ ] Confirm Sentry Next.js SDK is active with production DSN (`SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`).
- [ ] Verify recursive PII scrubber (`src/lib/scrubber.ts`) is actively masking raw email text, buyer emails, and credentials in error payloads.
- [ ] Verify UptimeRobot 5-minute HTTP monitors on:
  - Main URL: `https://your-domain.vercel.app/`
  - Core Health: `https://your-domain.vercel.app/api/health`
  - Webhook Receiver: `https://your-domain.vercel.app/api/health/webhook`
- [ ] Verify Slack/Discord failure spike alert webhook (`ALERT_WEBHOOK_URL`).

---

### Step 5: Test Mode UI Banner De-Provisioning
- [ ] In production configuration, set `NEXT_PUBLIC_ENABLE_TEST_MODE_BANNER=false` or remove `<TestModeBanner />` from `src/app/layout.tsx` once live keys are active.
- [ ] Remove `[⚡ TEST MODE]` warning badges from `RazorpayCheckoutButton.tsx` and invoice simulator views.

---

### Step 6: Legal, Compliance & Reconciliation Sign-Off
- [ ] Verify compliance with Reserve Bank of India (RBI) payment aggregator guidelines.
- [ ] Verify GST invoice breakdown accuracy on all issued payment link descriptions.
- [ ] Formal sign-off on the **Deterministic Policy Invariant**:
  - `evaluatePolicy()` in `src/lib/policy.ts` remains the sole authority for `AUTO_RECOVER`.
  - All disputed invoices are unconditionally routed to `HUMAN_REVIEW`.

---

## 3. Razorpay Test Mode Rate Limits vs Pilot Ingestion Volume

| Subsystem / Service | Tested Free-Tier / Test Mode Limit | Expected Pilot Volume (Phase P4) | Safety Headroom |
|---|---|---|---|
| **Razorpay Test Mode API** | 10–20 requests/second (600–1200 req/min) | 50–200 emails / day (peak ~5 req/min) | **> 100x Headroom** ✅ |
| **Razorpay Payment Link Creation** | Uncapped in Test Mode (subject to standard rate limit) | 20–80 links / day | **Well within limits** ✅ |
| **Upstash Redis Rate Limiter** | 10,000 commands / day (Free tier) | ~500 commands / day | **20x Headroom** ✅ |
| **Gemini 3.6 Flash (AI Model)** | 15 RPM / 1,500 RPD (Free tier) | ~50–200 requests / day | **7.5x Headroom** ✅ |
| **Supabase Postgres (Database)** | 500 MB storage, 50,000 monthly active users | < 10 MB, ~50 pilot users | **50x Headroom** ✅ |
| **Sentry Error Tracking** | 5,000 errors / month (Developer Free tier) | Expected < 50 errors / month | **100x Headroom** ✅ |

### Key Findings & Recommendations:
1. **Pilot Volume Fits 100% on Free Tiers**: A pilot workload of 50–200 overdue invoices per day runs smoothly without exceeding any service's free-tier rate limits or burst quotas.
2. **Concurrency Safety**: Upstash rate limits (20 req/hr per user, 60 req/min global) protect against accidental API exhaustion while leaving ample bandwidth for regular invoice processing.
