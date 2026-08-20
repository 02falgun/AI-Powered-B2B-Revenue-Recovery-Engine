# RecoverAI — Autonomous B2B Revenue Recovery Engine

RecoverAI is a financial-adjacent B2B revenue recovery system designed to analyze buyer payment intent, execute deterministic policy guardrails, and generate Razorpay payment links to close the loop on overdue invoices.

> **Money-Correctness & Safety Policy**: Money movement decisions prioritize correctness and safety over speed or feature count. All monetary arithmetic is strictly represented as integer paise (1 INR = 100 paise) to eliminate floating-point precision hazards.

---

## 🏗️ Architecture & Core Principles

- **Strict TypeScript & Fail-Closed Design**: Fully strict mode (`"noImplicitAny"`, `"strictNullChecks"`, `"noUnusedLocals"`). Any malformed request, missing signature, or API error fails closed safely without money movement.
- **Single Responsibility Modules**: Pure logic functions separated from external client SDKs.
- **Decoupled Result Type Pattern**: External integration functions return explicit `Result<T, AppError>` types instead of throwing uncaught exceptions.
- **Secure Webhook Verification**: Razorpay webhooks are validated using HMAC SHA256 signature verification with `crypto.timingSafeEqual` to prevent timing attacks.

---

## 🚀 Tech Stack

- **Framework**: Next.js 15 App Router (`src/` directory layout)
- **Language**: TypeScript (Strict Mode enabled)
- **Database**: Supabase PostgreSQL with `@supabase/ssr` client helpers
- **Payment Gateway**: Razorpay (Test Mode Payment Links API)
- **Validation & Code Quality**: Zod, ESLint, Prettier

---

## 📁 Repository Structure

```text
├── src/
│   ├── app/
│   │   └── api/
│   │       └── webhook/
│   │           └── razorpay/
│   │               └── route.ts         # HMAC signature verification endpoint (Phase 0)
│   ├── lib/
│   │   ├── types.ts                     # Shared domain types & Result<T, E> pattern
│   │   ├── razorpay.ts                  # Encapsulated Razorpay payment link module
│   │   └── razorpay-webhook.ts          # Pure HMAC signature verification helper
│   ├── utils/
│   │   └── supabase/
│   │       ├── client.ts                # Browser client helper (@supabase/ssr)
│   │       ├── server.ts                # Server Component client helper (@supabase/ssr)
│   │       └── middleware.ts            # Auth session refresh middleware helper
│   └── middleware.ts                    # Root Next.js middleware for session handling
├── supabase/
│   ├── schema.sql                       # DDL for invoices & audit_logs tables
│   └── seed.sql                         # Seed data: 5 realistic overdue invoices
├── scripts/
│   ├── test-razorpay.ts                 # Dev verification script for Razorpay credentials
│   └── test-webhook.ts                  # Unit test runner for HMAC signature verification
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
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret
```

---

## 🗄️ Database Setup (Supabase)

1. Open your Supabase Dashboard -> SQL Editor.
2. Run [`supabase/schema.sql`](file:///Users/kavyakumarthakur/KavTech/Projects/B2B-AI/supabase/schema.sql) to create `invoices` and `audit_logs` tables.
3. Run [`supabase/seed.sql`](file:///Users/kavyakumarthakur/KavTech/Projects/B2B-AI/supabase/seed.sql) to seed 5 overdue invoices with integer paise amounts.

---

## 🧪 Verification & Testing

### 1. Run Unit Tests
```bash
npm run test
```
Runs unit tests for HMAC SHA256 webhook signature verification and Razorpay module fail-closed error handling.

### 2. Run TypeScript Compilation Check
```bash
npx tsc --noEmit
```

### 3. Run Linting & Prettier Formatting
```bash
npm run lint
npx prettier --check "src/**/*.{ts,tsx}" "utils/**/*.{ts,tsx}"
```

### 4. Start Development Server
```bash
npm run dev
```

---

## 📌 Phase 0 Scope Summary

- [x] Next.js App Router scaffold + strict TypeScript + Prettier/ESLint.
- [x] `.env.example` and safe `.gitignore` setup.
- [x] Supabase DDL schema & seed data (integer paise money math).
- [x] `@supabase/ssr` client helpers & session refresh middleware.
- [x] `lib/razorpay.ts` payment link helper with `Result` error pattern.
- [x] `app/api/webhook/razorpay/route.ts` signature verification endpoint.
- [x] Unit test suite passing 100%.
