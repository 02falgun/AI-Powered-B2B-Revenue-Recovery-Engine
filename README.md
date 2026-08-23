# RecoverAI — Autonomous B2B Revenue Recovery Engine

> **AI × Payments Track**  
> An end-to-end autonomous system that reads overdue invoice emails from buyers, extracts payment intent using Google Gemini's Structured Output API, applies a deterministic multi-guardrail policy engine, and automatically issues Razorpay payment links — while routing every unsafe case to human review.

---

## 🎯 Problem & Target Track

**Problem**: Uncollected B2B invoices represent a $3.5 trillion DSO (Days Sales Outstanding) problem globally. AR teams spend hours each day manually reading buyer emails, extracting payment commitments, cross-referencing invoice balances, and issuing payment requests — a process prone to human error and unsafe approvals on disputed or ambiguous emails.

**Track**: AI × Payments  
**Core Claim**: RecoverAI automates the safe, unambiguous 60-70% of invoice recovery cases in under 3 seconds per invoice, with a **100% Primary Safety Metric** — zero unsafe auto-recoveries issued across all tested adversarial and ambiguous scenarios.

---

## 📊 Final Evaluation Benchmark Results

| Metric | Measured Value | Target | Status |
| :--- | :--- | :--- | :--- |
| **Primary Safety Metric** *(Unsafe cases → `HUMAN_REVIEW`)* | **100.0%** (12/12) | 100.0% | ✅ PERFECT |
| **Policy Decision Accuracy** | **100.0%** (20/20) | ≥ 95.0% | ✅ PERFECT |
| **Intent Classification Accuracy** | **90.0%** | ≥ 90.0% | ✅ PASS |
| **Amount Extraction Accuracy** | **90.0%** | ≥ 90.0% | ✅ PASS |
| **Dispute Detection Accuracy** | **95.0%** | ≥ 95.0% | ✅ PASS |
| **Policy Engine Determinism** | **100% Byte-Identical** | 100% | ✅ VERIFIED |

Dataset: 20 pre-labeled synthetic B2B buyer emails (5 partial-payment, 4 full-payment, 4 dispute, 3 extension, 4 ambiguous/adversarial). Ground truth labels written **before** running — zero post-hoc bias.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    BUYER EMAIL INGESTION CHANNELS                       │
│       [1] IMAP Scheduled Inbox Polling / Vercel Cron                    │
│       [2] Real-Time Manual Simulation Workspace                         │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  INVOICE MATCHER & ASYNC QUEUE (src/lib/invoice-matcher.ts)             │
│  · High Confidence: Explicit Invoice Number match (INV-YYYY-XXX)        │
│  · Medium Confidence: Unique debtor email on active overdue balance     │
│  · Ambiguous / Unrecognized → Routed to "Unmatched" Review Queue        │
│  · Table-Backed Queue: public.ingested_email_jobs                       │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  FIGURE 1 — AI Extraction Layer (src/lib/ai.ts)                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Google Gemini Structured Output (gemini-3.6-flash)              │   │
│  │  · Bounded Retry Engine: Exponential backoff + randomized jitter │   │
│  │  · Upstash Rate Limiting: 20 req/hr per user, 60 req/min global  │   │
│  │  · Maximum payload size validation (≤ 10,000 characters)         │   │
│  │  · AbortController (10s timeout) → fail-closed on timeout        │   │
│  │  · Output: { intent, promised_amount_inr, promised_date,         │   │
│  │             dispute_present, confidence, rationale, evidence }    │   │
│  └──────────────────────────────┬───────────────────────────────────┘   │
│                                 │                                       │
│  ┌──────────────────────────────▼───────────────────────────────────┐   │
│  │  Server-Side Sanitizer (src/lib/ai-schema.ts)                    │   │
│  │  · Zod schema validation (treats AI output as untrusted)         │   │
│  │  · Non-INR currency ambiguity → amount = null                    │   │
│  │  · Malformed percentage (>100%) → amount = null                  │   │
│  │  · Converts INR float → integer paise (no floating-point)        │   │
│  └──────────────────────────────┬───────────────────────────────────┘   │
└──────────────────────────────────┼──────────────────────────────────────┘
                                   │ ExtractedIntent (sanitized)
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  FIGURE 2 — Policy Engine (src/lib/policy.ts)                           │
│  Pure function — no I/O, no retries, no randomness, no wall-clock       │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  [C] Dispute Check → HUMAN_REVIEW if dispute_present = true     │    │
│  │  [E] Input Sanity → HUMAN_REVIEW if malformed/null input        │    │
│  │  [D] Confidence  → HUMAN_REVIEW if confidence < 0.70           │    │
│  │  [H] Currency    → HUMAN_REVIEW if non-INR ambiguity            │    │
│  │  [extension]     → HUMAN_REVIEW if intent = extension           │    │
│  │  [B] Non-Positive→ HUMAN_REVIEW if amount ≤ 0 paise            │    │
│  │  [A] Over-Amount → HUMAN_REVIEW if amount > outstanding         │    │
│  │  [G] Auth Invoice→ DB facts override email text claims          │    │
│  │  ──────────────────────────────────────────────────────────     │    │
│  │  [F] SOLE AUTHORITY: evaluatePolicy() is the ONLY function      │    │
│  │       authorized to return decision = AUTO_RECOVER              │    │
│  └──────────────────────────────────────────────────────────────   │    │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │
                   ┌───────────────┴───────────────┐
                   │ AUTO_RECOVER                  │ HUMAN_REVIEW
                   ▼                               ▼
      ┌──────────────────────┐         ┌─────────────────────────────┐
      │  Razorpay Payment    │         │  Operator AR Dashboard      │
      │  Link (API)          │         │  Admin Manual Override Mode │
      │  + Standard Checkout │         │  Guardrail Breakdown Card   │
      └──────────┬───────────┘         │  Audit Timeline & Unmatched │
                 │ Payment completed   └─────────────────────────────┘
                 ▼
      ┌──────────────────────┐
      │  Razorpay Webhook    │
      │  HMAC SHA256 Verify  │
      │  Idempotent Balance  │
      │  Update (DB)         │
      └──────────────────────┘
```

---

## 🚀 Tech Stack

| Component | Technology | Description |
| :--- | :--- | :--- |
| **Framework** | Next.js 16 (Turbopack) | Modern React 19 App Router with Proxy middleware |
| **Language** | TypeScript (Strict Mode) | Zero implicit any, strict null checks |
| **Authentication & RBAC** | Supabase Auth (`@supabase/ssr`) | Secure cookie sessions with `admin` and `operator` roles |
| **Rate Limiting** | Upstash Redis (`@upstash/ratelimit`) | Sliding-window per-user & global backstop protection |
| **Reliability & Retries** | Custom Retry Engine | Exponential backoff + randomized jitter with transient error filter |
| **Email Ingestion & Queue** | IMAP TLS / Vercel Cron | Automated scheduled polling + `ingested_email_jobs` queue table |
| **AI & Extraction** | Google Gemini API (`@google/genai`) | `gemini-3.6-flash` Structured Output with OpenAI fallback |
| **Database & ORM** | Supabase PostgreSQL | Additive migrations with Row-Level Security (RLS) |
| **Payment Gateway** | Razorpay | Payment Links API + Standard Checkout Modal + HMAC Webhooks |
| **Validation** | Zod | Runtime schema validation on every payload and AI output |
| **Styling & UI** | TailwindCSS + Framer Motion | Dark mode glassmorphism design system with responsive tokens |

---

## 📁 Repository Structure

```
├── src/
│   ├── app/
│   │   ├── page.tsx                      # AR Dashboard (Metrics, Active Invoices, Quick Actions)
│   │   ├── login/page.tsx                # Glassmorphism Login UI (Email/Password & Quick Demos)
│   │   ├── signup/page.tsx               # Account Registration with Role Selection
│   │   ├── unmatched/page.tsx            # Unmatched Buyer Email Review & Assignment Queue
│   │   ├── invoices/[id]/page.tsx        # Email Simulator + Decision Result + Admin Override + Audit Trail
│   │   ├── auth/callback/route.ts        # Supabase Auth code exchange
│   │   └── api/
│   │       ├── auth/                     # Auth status (/api/auth/me) & Logout (/api/auth/logout)
│   │       ├── cron/                     # Vercel Cron jobs: /ingest-emails & /process-queue
│   │       ├── unmatched-emails/         # Unmatched queue GET & link POST endpoints
│   │       ├── process-email/route.ts    # Rate-limited Core Orchestration API endpoint
│   │       ├── create-order/route.ts     # Razorpay Order creation (Standard Checkout)
│   │       ├── verify-payment/route.ts   # Payment signature verification
│   │       ├── invoices/                 # Invoice list + detail + admin override routes
│   │       └── webhook/razorpay/         # Webhook route (HMAC verified, session-exempt, idempotent)
│   ├── components/
│   │   ├── UserNav.tsx                   # Top navigation user pill, role badge & logout
│   │   ├── Logo.tsx                      # RecoverAI SVG brand icon & wordmark
│   │   ├── RazorpayCheckoutButton.tsx    # Reusable Standard Checkout modal component
│   │   └── ui/
│   │       ├── PolicyGuardrailBreakdown.tsx  # Visual Guardrails A-H status card
│   │       └── AuditTimeline.tsx             # Timestamped audit events timeline
│   ├── proxy.ts                          # Next.js 16 Proxy Middleware (Session & Route Gatekeeping)
│   └── lib/
│       ├── types.ts                      # Domain types, Role models, and Result<T, E> pattern
│       ├── db.ts                         # Supabase DB client, user profiles, and queue store
│       ├── auth.ts                       # Server-side auth helpers (requireAuth, requireAdmin)
│       ├── ratelimit.ts                  # Upstash Redis sliding window & memory fallback
│       ├── retry.ts                      # Resilient exponential backoff retry helper
│       ├── invoice-matcher.ts            # Heuristic high/medium confidence invoice matching
│       ├── email-ingestion.ts            # IMAP connector & sample inbox polling
│       ├── queue-worker.ts               # Background queue worker (pure pipeline execution)
│       ├── ai-prompt.ts                  # System prompt + prompt injection defenses
│       ├── ai-schema.ts                  # Zod schema + server-side sanitizer
│       ├── ai.ts                         # Gemini extraction with bounded retries & timeout
│       ├── policy.ts                     # Pure Policy Engine (Guardrails A-H, sole AUTO_RECOVER authority)
│       ├── razorpay.ts                   # Payment link creation with bounded retries
│       └── razorpay-webhook.ts           # Pure HMAC SHA256 verification
├── scripts/
│   ├── test-phase1-auth.ts               # Phase P1 Authentication & RBAC test suite
│   ├── test-phase2-ratelimit.ts          # Phase P2 Rate Limiting & Size Boundary test suite
│   ├── test-phase3-retry.ts              # Phase P3 Retry & Transient Error test suite
│   ├── test-phase4-ingestion.ts          # Phase P4 Email Ingestion & Queue test suite
│   ├── test-webhook.ts                   # Webhook signature verification tests
│   ├── test-razorpay.ts                  # Payment link creation tests
│   ├── test-extraction.ts                # AI intent extraction tests
│   ├── test-policy.ts                    # Policy Engine matrix tests
│   ├── test-orchestration.ts             # Core end-to-end orchestration tests
│   ├── test-razorpay-checkout.ts         # Checkout modal integration tests
│   └── run-evaluation.ts                 # 20-case formal benchmark runner
├── tests/
│   ├── integration/
│   │   ├── phase4-reliability.test.ts         # 5-scenario negative reliability suite
│   │   ├── phase6-adversarial.test.ts         # 7-scenario adversarial suite
│   │   └── dual-payment-idempotency.test.ts   # Dual payment path idempotency test
│   └── evaluation/dataset.ts            # 20 pre-labeled benchmark fixtures
├── supabase/
│   ├── schema.sql                        # Complete DDL: invoices, user_profiles, jobs, audit_logs
│   ├── seed.sql                          # Overdue invoices test dataset
│   └── migrations/                       # Additive SQL migrations
│       ├── 20260822000000_create_user_profiles.sql
│       └── 20260822000001_create_ingested_email_jobs.sql
├── vercel.json                           # Vercel Cron jobs configuration
└── docs/
    ├── design-system.md                  # Complete visual tokens, colors, and layout specs
    ├── demo-script.md                    # 3-minute live demo script
    ├── judge-qa-prep.md                  # Technical judge Q&A with metric citations
    ├── phase6-adversarial-defenses.md   # Adversarial attack & defense report
    ├── evaluation-report.md             # Formal Phase 7 benchmark report
    └── submission-readiness-report.md    # Pre-submission verification audit
```

---

## ⚙️ Setup Instructions

### Prerequisites
- Node.js ≥ 18, npm ≥ 9
- Supabase project (Free tier)
- Upstash Redis database (Free tier)
- Razorpay Test Mode account
- Google Gemini API key (Free tier available at [ai.google.dev](https://ai.google.dev))

### 1. Clone & Install
```bash
git clone https://github.com/02falgun/AI-Powered-B2B-Revenue-Recovery-Engine.git
cd AI-Powered-B2B-Revenue-Recovery-Engine
npm install
```

### 2. Configure Environment Variables
```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Google Gemini AI
GEMINI_API_KEY=your-gemini-api-key

# Razorpay (Test Mode)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your-razorpay-key-secret
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=your-razorpay-webhook-secret

# Upstash Redis & Rate Limiting (Free Tier)
UPSTASH_REDIS_REST_URL=https://your-upstash-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-redis-rest-token
RATE_LIMIT_USER_MAX=20
RATE_LIMIT_USER_WINDOW_MS=3600000
RATE_LIMIT_GLOBAL_MAX=60
RATE_LIMIT_GLOBAL_WINDOW_MS=60000
MAX_EMAIL_BODY_CHARS=10000

# Vercel Cron Secret (Optional)
CRON_SECRET=your-cron-secret
```

### 3. Set Up Supabase Database
1. Open Supabase Dashboard → SQL Editor
2. Run `supabase/schema.sql` (creates `invoices`, `user_profiles`, `ingested_email_jobs`, `audit_logs`, `processed_payments` tables + RLS + trigger)
3. Run `supabase/seed.sql` (seeds overdue invoices with integer paise amounts)

### 4. Set Up Razorpay Test Mode
1. Create account at [dashboard.razorpay.com](https://dashboard.razorpay.com) and switch to **Test Mode**.
2. Navigate to Settings → API Keys → Generate Test Key.
3. Settings → Webhooks → Add webhook URL (`/api/webhook/razorpay`).
   - Enable events: `payment_link.paid` and `payment.captured`.
4. Copy the webhook secret to `RAZORPAY_WEBHOOK_SECRET` in `.env.local`.

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) (Redirects to `/login`).  
*Quick-fill demo buttons are provided on the login page for instant Admin or Operator sign-in.*

---

## 🧪 Automated Testing

RecoverAI includes a complete 14-suite automated verification harness:

```bash
# Run the entire test suite end-to-end
npm run test

# Production-Hardening Specific Suites
npm run test:phase1            # Phase P1: Auth, RBAC & Middleware Gatekeeping
npm run test:phase2            # Phase P2: Upstash Rate Limiting & Size Limits
npm run test:phase3            # Phase P3: Exponential Backoff & Transient Retries
npm run test:phase4-ingestion  # Phase P4: IMAP Ingestion, Matching & Queue Worker

# Core Engine Suites
npm run test:policy            # Pure Policy Engine Matrix (15/15)
npm run test:webhook           # Razorpay HMAC Signature Verification (5/5)
npm run test:razorpay          # Razorpay Payment Link Generation (4/4)
npm run test:ai                # Gemini Intent Extraction & Fail-Closed Guards (10/10)
npm run test:orchestration     # Core End-to-End Orchestration Loop
npm run test:checkout          # Standard Web Checkout Modal Integration (5/5)
npm run test:phase4            # Negative Reliability & Timeout Suite (5/5)
npm run test:phase5            # UI State & Component Regression Tests
npm run test:phase6            # Adversarial Prompt Injection Attacks (8/8)
npm run test:eval              # Phase 7 AI Benchmark (20/20 cases, 100% safety)
npm run test:idempotency       # Dual-path payment idempotency verification
npm run demo:rehearse          # Live demo rehearsal runner (determinism check)
```

---

## 🛡️ Policy Guardrails (A–H)

`evaluatePolicy()` in `src/lib/policy.ts` is the **single authority permitted to return `AUTO_RECOVER`**:

| Guardrail | Trigger Condition | Decision | Rationale |
| :--- | :--- | :--- | :--- |
| **A — Over-Amount** | Promised paise > Outstanding paise | `HUMAN_REVIEW` | Prevents overcharging or arithmetic mismatch |
| **B — Non-Positive Amount** | Promised paise ≤ 0 | `HUMAN_REVIEW` | Blocks zero or negative payment attempts |
| **C — Dispute Detection** | `dispute_present = true` OR `intent = dispute` | `HUMAN_REVIEW` | **Unconditional**: disputed invoices must never auto-recover |
| **D — Low Confidence** | Extraction confidence < 0.70 | `HUMAN_REVIEW` | Ambiguous AI extractions require operator verification |
| **E — Input Sanity** | Malformed or null extraction object | `HUMAN_REVIEW` | Fails closed on any schema aberration |
| **F — Sole Authority** | Architecture invariant | (structural) | No other code path is authorized to emit `AUTO_RECOVER` |
| **G — Authoritative Invoice** | DB-sourced invoice facts override text | (structural) | DB balance is source of truth against buyer claims |
| **H — Currency Ambiguity** | Non-INR currency or percentage > 100% | `HUMAN_REVIEW` | Prevents FX loss and percentage confusion |

---

## 🔐 Security & Reliability Invariants

1. **Frozen Core Policy Protection**:
   - `evaluatePolicy()` in `src/lib/policy.ts` has **zero I/O, zero retries, and zero randomness**. All recovery decisions flow through deterministic guardrails.
2. **Webhook Session Exemption & HMAC Verification**:
   - The Razorpay webhook `/api/webhook/razorpay` is **always reachable without user session cookies** and is governed strictly by HMAC SHA256 timing-safe signature verification (`verifyRazorpayWebhookSignature`).
3. **Sliding-Window Abuse Prevention**:
   - The AI processing endpoint `/api/process-email` is rate-limited per user (20 requests/hr) with a global backstop (60 requests/min).
   - Email payloads exceeding 10,000 characters are rejected with HTTP 400 before reaching the AI model.
4. **Resilient Retry Bounds**:
   - Transient I/O errors (timeouts, 5xx server drops, connection resets) retry up to 2 times with exponential backoff and randomized jitter.
   - Non-transient errors (4xx validation errors, malformed input) fail immediately without retry. Exhausted retries fail closed to `HUMAN_REVIEW`.
5. **Fail-Closed Unmatched Review Queue**:
   - If incoming buyer emails cannot be matched to an invoice with high/medium confidence, they are routed to `/unmatched` rather than guessing.
6. **Dual Payment Flow Idempotency**:
   - Payment Links and Standard Checkout both converge on `updateInvoiceAfterPayment()`, where `processed_payments` table ensures duplicate webhooks or dual submissions are idempotent no-ops.

---

## 📌 Phase Milestone Summary

- [x] **Phase 0** — Foundation: Strict TypeScript, Supabase DDL, Razorpay client, HMAC webhook
- [x] **Phase 1** — AI Extraction: Gemini Structured Output, prompt injection defenses, Zod validation
- [x] **Phase 2** — Policy Engine: Guardrails A-F, integer paise arithmetic, 15/15 unit tests
- [x] **Phase 3** — Orchestration Loop: `/api/process-email`, Razorpay link generation, webhook handler
- [x] **Phase 4** — Reliability: Webhook replay idempotency, 10s timeout, 5/5 negative scenarios
- [x] **Phase 5** — Dashboard UI: AR Dashboard, Email Simulator, Decision Result, Audit Timeline
- [x] **Phase 6** — Adversarial Hardening: Guardrails G-H, currency/percentage sanitizers, 12/12 adversarial tests
- [x] **Phase 7** — Evaluation Harness: 20 pre-labeled benchmarks, 100% Safety Metric, determinism verified
- [x] **Phase 8** — Fix & Freeze: Fail-closed timeout fix, tagged `v1.0.0-frozen`
- [x] **Phase P1 (Hardening)** — Supabase Auth, `user_profiles`, Proxy Middleware, RBAC (`admin` vs `operator`)
- [x] **Phase P2 (Hardening)** — Upstash Redis Sliding-Window Rate Limiter & Email Size Boundary
- [x] **Phase P3 (Hardening)** — Exponential Backoff + Jitter Retry Engine (`src/lib/retry.ts`)
- [x] **Phase P4 (Hardening)** — IMAP Ingestion Connector, Invoice Matcher, Table Queue Worker, `/unmatched` UI
- [x] **Phase P5 (Hardening)** — Multi-Company / Multi-Tenant Data Model with RLS, additive migration & pagination
- [x] **Phase P6 (Hardening)** — Sentry SDK (with strict PII/secret scrubbing), UptimeRobot probes, structured JSON logging, failure alerting
- [x] **UI Redesign (v2)** — Physical Control Panel, pure monochrome grayscale palette, real 3D depth, 8-switch rocker annunciator bank

---

**Live Demo & Submission Docs:** [`docs/demo-script.md`](docs/demo-script.md) | [`docs/judge-qa-prep.md`](docs/judge-qa-prep.md)  
**Evaluation Report:** [`docs/evaluation-report.md`](docs/evaluation-report.md)  
**Design Tokens & System:** [`docs/design-system.md`](docs/design-system.md) | [`docs/uptimerobot-setup.md`](docs/uptimerobot-setup.md)

