# RecoverAI — Autonomous B2B Revenue Recovery Engine

RecoverAI is a financial-adjacent B2B revenue recovery system designed to analyze buyer payment intent, execute deterministic policy guardrails, and issue Razorpay payment links / process Standard Checkout payments to close the loop on overdue invoices safely and reliably.

> **Money-Correctness & Safety Policy**: Money movement decisions prioritize correctness and safety over speed or feature count. All monetary arithmetic is strictly represented as integer paise (1 INR = 100 paise) to eliminate floating-point precision hazards.

---

## 📊 Final Evaluation Benchmark Results

| Metric | Measured Value | Standard Target | Status |
| :--- | :--- | :--- | :--- |
| **Primary Safety Metric** *(Unsafe cases routed to `HUMAN_REVIEW`)* | **100.0%** (12/12) | **100.0%** | ✅ PERFECT |
| **Policy Decision Accuracy** | **100.0%** (20/20) | ≥ 95.0% | ✅ PERFECT |
| **Intent Classification Accuracy** | **90.0%** | ≥ 90.0% | ✅ PASS |
| **Amount Extraction Accuracy** | **90.0%** | ≥ 90.0% | ✅ PASS |
| **Dispute Detection Accuracy** | **95.0%** | ≥ 95.0% | ✅ PASS |
| **Policy Engine Determinism** | **100% BYTE-IDENTICAL** | 100% Deterministic | ✅ VERIFIED |

---

## 🏗️ Architecture & Core Principles

- **Strict TypeScript & Fail-Closed Design**: Fully strict mode (`"noImplicitAny"`, `"strictNullChecks"`, `"noUnusedLocals"`). Any malformed request, missing signature, or API error fails closed safely without money movement.
- **Architectural Policy Invariant**: `evaluatePolicy()` in `src/lib/policy.ts` is the **ONLY function in the codebase** authorized to emit `decision = 'AUTO_RECOVER'`.
- **Pure Logic Policy Engine**: Zero SDK/HTTP dependencies in `lib/policy.ts`. Zero wall-clock dependence, zero randomness, zero network calls.
- **AI Extraction & Prompt Injection Defenses**: Buyer email bodies are treated as untrusted `DATA`, never commands to follow. Google Gemini API (`@google/genai` SDK) enforces structured output compliance, with an `AbortController` 10-second timeout.
- **Deterministic Percentage Math**: Percentage commitments (e.g., "50% today") are resolved deterministically in backend code rather than by the LLM.
- **Razorpay Standard Checkout & Payment Links**: Dual support for Razorpay Payment Link generation and direct in-modal Standard Checkout with HMAC SHA256 payment signature verification (`crypto.timingSafeEqual`).
- **Database-Level Webhook Replay Idempotency**: Unique constraints on `processed_payments.payment_id` and double-checked in-memory/DB tracking guarantee duplicate webhook events modify invoice balances **EXACTLY ONCE**.

---

## 🚀 Tech Stack

- **Framework**: Next.js 15 App Router (`src/` directory layout)
- **Language**: TypeScript (Strict Mode enabled)
- **AI & Intent Extraction**: Google Gemini API (`@google/genai` SDK) with 10s timeout & offline fallback
- **Database**: Supabase PostgreSQL with `@supabase/ssr` client helpers & service role key
- **Payment Gateway**: Razorpay (Payment Links API & Standard Checkout Modal)
- **Validation & Code Quality**: Zod, ESLint, Prettier

---

## 📁 Repository Structure

```text
├── src/
│   ├── app/
│   │   ├── page.tsx                     # Invoices AR Dashboard page
│   │   ├── invoices/
│   │   │   └── [id]/
│   │   │       └── page.tsx             # Email Simulator, Decision Result & Audit Trail page
│   │   └── api/
│   │       ├── process-email/
│   │       │   └── route.ts             # Core Orchestration API endpoint
│   │       ├── create-order/
│   │       │   └── route.ts             # Razorpay Order creation endpoint
│   │       ├── verify-payment/
│   │       │   └── route.ts             # Razorpay payment signature verification endpoint
│   │       ├── invoices/
│   │       │   ├── route.ts             # Invoices list API route
│   │       │   └── [id]/
│   │       │       ├── route.ts         # Invoice detail API route
│   │       │       └── audit-logs/
│   │       │           └── route.ts     # Audit logs timeline GET endpoint
│   │       └── webhook/
│   │           └── razorpay/
│   │               └── route.ts         # Verified Razorpay webhook route (Idempotent)
│   ├── components/
│   │   ├── RazorpayCheckoutButton.tsx   # Reusable Razorpay Standard Checkout client component
│   │   └── ui/
│   │       ├── InvoiceStatusBadge.tsx   # Status badge component
│   │       ├── PolicyGuardrailBreakdown.tsx # Visual Guardrails A-H status card
│   │       └── AuditTimeline.tsx        # Audit trail timeline component
│   ├── lib/
│   │   ├── types.ts                     # Domain types & Result<T, E> error pattern
│   │   ├── db.ts                        # Supabase server database helper & idempotency store
│   │   ├── ai-prompt.ts                 # System prompt & prompt injection defenses
│   │   ├── ai-schema.ts                 # Zod extraction schema & server-side sanitizer
│   │   ├── ai.ts                        # Gemini Structured Output extraction module
│   │   ├── policy.ts                    # Policy Engine (Guardrails A-H, sole AUTO_RECOVER authority)
│   │   ├── razorpay.ts                  # Razorpay payment link creation helper
│   │   └── razorpay-webhook.ts          # Pure HMAC SHA256 signature verification helper
│   └── utils/
│       └── supabase/
│           ├── client.ts                # Browser client helper (@supabase/ssr)
│           ├── server.ts                # Server Component client helper (@supabase/ssr)
│           └── middleware.ts            # Auth session refresh middleware helper
├── tests/
│   ├── unit/
│   │   └── policy.test.ts               # Policy Decision Matrix & Boundary unit test suite
│   ├── integration/
│   │   ├── phase4-reliability.test.ts   # Phase 4 Negative Reliability Test Suite (5 Scenarios)
│   │   └── phase6-adversarial.test.ts   # Phase 6 Adversarial Integration Suite (7 Scenarios)
│   └── evaluation/
│       └── dataset.ts                   # 20 pre-labeled synthetic email benchmark fixtures
├── supabase/
│   ├── schema.sql                       # DDL for invoices, audit_logs & processed_payments
│   └── seed.sql                         # Seed data: 5 realistic overdue invoices
├── docs/
│   ├── phase6-adversarial-defenses.md   # Adversarial attack & defense report
│   └── evaluation-report.md             # Formal Phase 7 evaluation benchmark report
├── scripts/
│   ├── fixtures/
│   │   └── test-emails.ts               # 10 B2B buyer email evaluation test cases
│   ├── test-extraction.ts               # AI extraction evaluation runner
│   ├── test-policy.ts                   # Policy engine test runner
│   ├── test-razorpay.ts                 # Dev verification script for Razorpay credentials
│   ├── test-webhook.ts                  # Unit test runner for HMAC signature verification
│   ├── test-orchestration.ts            # Integration test for core orchestration loop
│   ├── test-razorpay-checkout.ts        # Order creation & signature verification test runner
│   ├── test-phase5-ui.ts                # UI & demo shortcut test runner
│   └── run-evaluation.ts                # Phase 7 evaluation benchmark & determinism harness
├── CHANGELOG.md                         # Release highlights & guardrails log
└── .env.example                         # Environment variable template
```

---

## ⚙️ Environment Setup

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in the environment variables in `.env.local`:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Gemini AI Configuration
GEMINI_API_KEY=your-gemini-api-key

# Razorpay Configuration (Test Mode)
RAZORPAY_KEY_ID=rzp_test_TSOJfqI5DSz59Z
RAZORPAY_KEY_SECRET=C1U75rq7SWn7rjE4xXDW3Fjn
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_TSOJfqI5DSz59Z
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret
```

---

## 🗄️ Database Setup (Supabase)

1. Open your Supabase Dashboard -> SQL Editor.
2. Run [`supabase/schema.sql`](file:///Users/kavyakumarthakur/KavTech/Projects/B2B-AI/supabase/schema.sql) to create `invoices`, `audit_logs`, and `processed_payments` tables.
3. Run [`supabase/seed.sql`](file:///Users/kavyakumarthakur/KavTech/Projects/B2B-AI/supabase/seed.sql) to seed 5 overdue invoices with integer paise amounts.

---

## 🧪 Verification & Testing

### 1. Run Complete Test Suite Across All 8 Phases
```bash
npm run test
```
Executes all unit, integration, checkout, reliability, UI, adversarial, and evaluation benchmark test runners (100% passing).

### 2. Individual Test Runners
```bash
npm run test:eval          # Phase 7 Benchmark Evaluation Harness (20 pre-labeled cases)
npm run test:phase6        # Phase 6 Adversarial Integration Suite (7 Scenarios)
npm run test:phase5        # Phase 5 UI & Demo Shortcuts Verification
npm run test:phase4        # Phase 4 Reliability & Idempotency Suite
npm run test:policy        # Policy Decision Matrix (15/15 passed)
npm run test:ai            # AI Intent Extraction Evaluation (10/10 passed)
npm run test:checkout      # Razorpay Standard Checkout Order & Verification (5/5 passed)
npm run test:orchestration # Core Orchestration Integration Loop
npm run test:webhook       # Razorpay HMAC Webhook Signature Verification
```

### 3. Run TypeScript Compilation Check
```bash
npx tsc --noEmit
```

### 4. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the Invoices Dashboard.

---

## 📌 Complete Phase Milestone Summary

- [x] **Phase 0 — Foundation & Integrations**: Next.js 15 scaffold, strict tsconfig, Supabase DDL & seeds, Razorpay link helper, HMAC webhook signature route.
- [x] **Phase 1 — AI Extraction Layer**: Structured outputs (`lib/ai.ts`), prompt injection defenses, Zod validation, percentage math resolution, 10 email fixtures runner.
- [x] **Phase 2 — Deterministic Policy Engine**: Policy engine (`lib/policy.ts`), named guardrail functions (Guardrails A-F), strict integer paise arithmetic, Policy Decision Matrix test suite (15/15 passed).
- [x] **Phase 3 — Core Orchestration Loop**: `/api/process-email` orchestrator, Razorpay link generation, extended webhook route, and functional Operator UI (`src/app/page.tsx` & `src/app/invoices/[id]/page.tsx`).
- [x] **Razorpay Standard Web Checkout**: `/api/create-order`, `/api/verify-payment`, and reusable `RazorpayCheckoutButton` modal component.
- [x] **Phase 4 — Reliability & Idempotency**: Webhook replay protection (`processed_payments` DB unique constraint + in-memory store), 10s AbortController timeout, Razorpay API failure handling, and 5-scenario negative integration test suite (`npm run test:phase4`).
- [x] **Phase 5 — Dashboard & Audit Trail UI**: AR Dashboard, Email Simulator with 3 demo shortcuts, Decision Result screen with Guardrails breakdown, and timestamped Audit Trail timeline.
- [x] **Phase 6 — Guardrail Breadth & Adversarial Hardening**: Guardrails G & H, currency ambiguity & malformed percentage sanitization, 7-scenario adversarial test suite, and defense report.
- [x] **Phase 7 — Evaluation Harness**: 20 pre-labeled synthetic email benchmarks, 100% Primary Safety Metric, 100% Policy Decision Accuracy, and byte-identical determinism verification.
- [x] **Phase 8 — Fix & Freeze**: Codebase frozen at release tag `v1.0.0-frozen`, CHANGELOG generated, README metrics synced.
