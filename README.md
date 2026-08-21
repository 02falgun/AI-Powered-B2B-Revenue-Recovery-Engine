# RecoverAI — Autonomous B2B Revenue Recovery Engine

RecoverAI is a financial-adjacent B2B revenue recovery system designed to analyze buyer payment intent, execute deterministic policy guardrails, and issue Razorpay payment links / process Standard Checkout payments to close the loop on overdue invoices safely and reliably.

> **Money-Correctness & Safety Policy**: Money movement decisions prioritize correctness and safety over speed or feature count. All monetary arithmetic is strictly represented as integer paise (1 INR = 100 paise) to eliminate floating-point precision hazards.

---

## 🏗️ Architecture & Core Principles

- **Strict TypeScript & Fail-Closed Design**: Fully strict mode (`"noImplicitAny"`, `"strictNullChecks"`, `"noUnusedLocals"`). Any malformed request, missing signature, or API error fails closed safely without money movement.
- **Architectural Policy Invariant**: `evaluatePolicy()` in `src/lib/policy.ts` is the **ONLY function in the codebase** authorized to emit `decision = 'AUTO_RECOVER'`.
- **Pure Logic Policy Engine**: Zero SDK/HTTP dependencies in `lib/policy.ts`. Zero wall-clock dependence, zero randomness, zero network calls.
- **AI Extraction & Prompt Injection Defenses**: Buyer email bodies are treated as untrusted `DATA`, never commands to follow. OpenAI Structured Outputs (`gpt-4o-mini`) enforce schema compliance, with an `AbortController` 10-second timeout.
- **Deterministic Percentage Math**: Percentage commitments (e.g., "50% today") are resolved deterministically in backend code rather than by the LLM.
- **Razorpay Standard Checkout & Payment Links**: Dual support for Razorpay Payment Link generation and direct in-modal Standard Checkout with HMAC SHA256 payment signature verification (`crypto.timingSafeEqual`).
- **Database-Level Webhook Replay Idempotency**: Unique constraints on `processed_payments.payment_id` and double-checked in-memory/DB tracking guarantee duplicate webhook events modify invoice balances **EXACTLY ONCE**.

---

## 🚀 Tech Stack

- **Framework**: Next.js 15 App Router (`src/` directory layout)
- **Language**: TypeScript (Strict Mode enabled)
- **AI & Intent Extraction**: OpenAI `gpt-4o-mini` Structured Outputs (`zodResponseFormat`) with 10s timeout
- **Database**: Supabase PostgreSQL with `@supabase/ssr` client helpers & service role key
- **Payment Gateway**: Razorpay (Payment Links API & Standard Checkout Modal)
- **Validation & Code Quality**: Zod, ESLint, Prettier

---

## 📁 Repository Structure

```text
├── src/
│   ├── app/
│   │   ├── page.tsx                     # Invoices Dashboard page
│   │   ├── invoices/
│   │   │   └── [id]/
│   │   │       └── page.tsx             # Interactive email processing & checkout page
│   │   └── api/
│   │       ├── process-email/
│   │       │   └── route.ts             # Core Orchestration API endpoint
│   │       ├── create-order/
│   │       │   └── route.ts             # Razorpay Order creation endpoint
│   │       ├── verify-payment/
│   │       │   └── route.ts             # Razorpay payment signature verification endpoint
│   │       ├── invoices/
│   │       │   ├── route.ts             # Invoices list API route
│   │       │   └── [id]/route.ts        # Invoice detail & audit history API route
│   │       └── webhook/
│   │           └── razorpay/
│   │               └── route.ts         # Verified Razorpay webhook route (Idempotent)
│   ├── components/
│   │   └── RazorpayCheckoutButton.tsx   # Reusable Razorpay Standard Checkout client component
│   ├── lib/
│   │   ├── types.ts                     # Domain types & Result<T, E> error pattern
│   │   ├── db.ts                        # Supabase server database helper & idempotency store
│   │   ├── ai-prompt.ts                 # System prompt & prompt injection defenses
│   │   ├── ai-schema.ts                 # Zod extraction schema & server-side sanitizer
│   │   ├── ai.ts                        # OpenAI Structured Output extraction with 10s timeout
│   │   ├── policy.ts                    # Deterministic Policy Engine (Sole AUTO_RECOVER authority)
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
│   └── integration/
│       └── phase4-reliability.test.ts   # Phase 4 Negative Reliability Test Suite (5 Scenarios)
├── supabase/
│   ├── schema.sql                       # DDL for invoices, audit_logs & processed_payments
│   └── seed.sql                         # Seed data: 5 realistic overdue invoices
├── scripts/
│   ├── fixtures/
│   │   └── test-emails.ts               # 10 B2B buyer email evaluation test cases
│   ├── test-extraction.ts               # AI extraction evaluation runner
│   ├── test-policy.ts                   # Policy engine test runner
│   ├── test-razorpay.ts                 # Dev verification script for Razorpay credentials
│   ├── test-webhook.ts                  # Unit test runner for HMAC signature verification
│   ├── test-orchestration.ts            # Integration test for core orchestration loop
│   ├── test-razorpay-checkout.ts        # Order creation & signature verification test runner
│   └── test-phase4-reliability.ts       # 5 Negative Scenario integration test runner
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

# OpenAI Configuration
OPENAI_API_KEY=sk-proj-your-openai-api-key

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

### 1. Run Complete Test Suite
```bash
npm run test
```
Executes all unit and integration tests across HMAC signature verification, Razorpay link creation, AI extraction, Policy Decision Matrix, orchestration loop, Razorpay checkout, and Phase 4 negative scenarios.

### 2. Individual Test Runners
```bash
npm run test:policy        # Policy Decision Matrix (15/15 passed)
npm run test:ai            # AI Extraction Evaluation (10/10 passed)
npm run test:checkout      # Razorpay Standard Checkout Order & Verification (5/5 passed)
npm run test:phase4        # Phase 4 Reliability & Idempotency Negative Scenarios (5/5 passed)
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

## 📌 Phase Completion Summary

- [x] **Phase 0 — Foundation & Integrations**: Next.js 15 scaffold, strict tsconfig, Supabase schema & seeds, Razorpay link helper, HMAC webhook verification route.
- [x] **Phase 1 — AI Extraction Layer**: Structured outputs (`lib/ai.ts`), prompt injection defenses, Zod validation, percentage math resolution, 10 email fixtures runner.
- [x] **Phase 2 — Deterministic Policy Engine**: Policy engine (`lib/policy.ts`), named guardrail functions (Guardrails A-F), strict integer paise arithmetic, Policy Decision Matrix test suite (15/15 passed).
- [x] **Phase 3 — Core Orchestration Loop**: `/api/process-email` orchestrator, Razorpay link generation, extended webhook route, and functional Operator UI (`src/app/page.tsx` & `src/app/invoices/[id]/page.tsx`).
- [x] **Razorpay Standard Web Checkout**: `/api/create-order`, `/api/verify-payment`, and reusable `RazorpayCheckoutButton` modal component.
- [x] **Phase 4 — Reliability & Idempotency**: Webhook replay protection (`processed_payments` DB unique constraint + in-memory store), OpenAI 10s AbortController timeout, Razorpay API failure handling, and 5-scenario negative integration test suite (`npm run test:phase4`).
