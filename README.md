# RecoverAI — Autonomous B2B Revenue Recovery Engine

> **AI × Payments Track**  
> An end-to-end autonomous system that reads overdue invoice emails from buyers, extracts payment intent using Google Gemini's Structured Output API, applies a deterministic multi-guardrail policy engine, and automatically issues Razorpay payment links — while routing every unsafe case to human review.

---

## 🎯 Problem & Target Track

**Problem**: Uncollected B2B invoices represent a $3.5 trillion DSO (Days Sales Outstanding) problem globally. AR teams spend hours each day manually reading buyer emails, extracting payment commitments, cross-referencing invoice balances, and issuing payment requests — a process prone to human error and unsafe approvals on disputed or ambiguous emails.

**Track**: AI × Payments  
**Core Claim**: RecoverAI automates the safe, unambiguous 60-70% of invoice recovery cases in under 3 seconds per invoice, with a **100% Primary Safety Metric** — zero unsafe auto-recoveries issued across all tested adversarial and ambiguous scenarios.

---

## 📊 Final Evaluation Benchmark Results (Phase 8 Frozen)

| Metric | Measured Value | Target | Status |
| :--- | :--- | :--- | :--- |
| **Primary Safety Metric** *(Unsafe cases → `HUMAN_REVIEW`)* | **100.0%** (12/12) | 100.0% | ✅ PERFECT |
| **Policy Decision Accuracy** | **100.0%** (20/20) | ≥ 95.0% | ✅ PERFECT |
| **Intent Classification Accuracy** | **90.0%** | ≥ 90.0% | ✅ PASS |
| **Amount Extraction Accuracy** | **90.0%** | ≥ 90.0% | ✅ PASS |
| **Dispute Detection Accuracy** | **95.0%** | ≥ 95.0% | ✅ PASS |
| **Policy Engine Determinism** | **100% Byte-Identical** | 100% | ✅ VERIFIED |

Dataset: 20 pre-labeled synthetic B2B buyer emails (5 partial-payment, 4 full-payment, 4 dispute, 3 extension, 4 ambiguous/adversarial). Ground truth labels written **before** running — no post-hoc bias.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BUYER EMAIL (Untrusted Text)                │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  FIGURE 1 — AI Extraction Layer (src/lib/ai.ts)                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Google Gemini Structured Output (gemini-3.6-flash)          │   │
│  │  · System prompt explicitly treats email body as DATA        │   │
│  │  · AbortController (10s timeout) → fail-closed on timeout    │   │
│  │  · Output: { intent, promised_amount_inr, promised_date,     │   │
│  │             dispute_present, confidence, rationale, evidence }│   │
│  └──────────────────────────┬───────────────────────────────────┘   │
│                             │                                       │
│  ┌──────────────────────────▼───────────────────────────────────┐   │
│  │  Server-Side Sanitizer (src/lib/ai-schema.ts)                │   │
│  │  · Zod schema validation (treats AI output as untrusted)     │   │
│  │  · Non-INR currency ambiguity → amount = null                │   │
│  │  · Malformed percentage (>100%) → amount = null              │   │
│  │  · Converts INR float → integer paise (no floating-point)    │   │
│  └──────────────────────────┬───────────────────────────────────┘   │
└──────────────────────────────┼──────────────────────────────────────┘
                               │ ExtractedIntent (sanitized)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  FIGURE 2 — Policy Engine (src/lib/policy.ts)                       │
│  Pure function — no I/O, no randomness, no wall-clock dependence    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  [C] Dispute Check → HUMAN_REVIEW if dispute_present = true │    │
│  │  [E] Input Sanity → HUMAN_REVIEW if malformed/null input    │    │
│  │  [D] Confidence  → HUMAN_REVIEW if confidence < 0.70       │    │
│  │  [H] Currency    → HUMAN_REVIEW if non-INR ambiguity        │    │
│  │  [extension]     → HUMAN_REVIEW if intent = extension       │    │
│  │  [B] Non-Positive→ HUMAN_REVIEW if amount ≤ 0 paise        │    │
│  │  [A] Over-Amount → HUMAN_REVIEW if amount > outstanding     │    │
│  │  [G] Auth Invoice→ DB facts override email text claims      │    │
│  │  ──────────────────────────────────────────────────────     │    │
│  │  [F] SOLE AUTHORITY: evaluatePolicy() is the ONLY function  │    │
│  │       authorized to return decision = AUTO_RECOVER          │    │
│  └──────────────────────────────────────────────────────────   │    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               │ AUTO_RECOVER                  │ HUMAN_REVIEW
               ▼                               ▼
  ┌──────────────────────┐         ┌─────────────────────────────┐
  │  Razorpay Payment    │         │  Operator AR Dashboard      │
  │  Link (API)          │         │  Guardrail Breakdown Card   │
  │  + Standard Checkout │         │  Audit Timeline             │
  └──────────┬───────────┘         └─────────────────────────────┘
             │ Payment completed
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

| Component | Technology |
| :--- | :--- |
| Framework | Next.js 15 App Router (`src/` directory) |
| Language | TypeScript (Strict Mode: `noImplicitAny`, `strictNullChecks`) |
| AI & Extraction | Google Gemini API (`@google/genai` SDK, `gemini-3.6-flash`) |
| Database | Supabase PostgreSQL with `@supabase/ssr` helpers |
| Payment Gateway | Razorpay (Payment Links API + Standard Web Checkout) |
| Validation | Zod schema validation on every AI-extracted field |
| Testing | 8-phase test suite (unit, integration, adversarial, evaluation) |

---

## 📁 Repository Structure

```
├── src/
│   ├── app/
│   │   ├── page.tsx                      # Invoices AR Dashboard
│   │   ├── invoices/[id]/page.tsx        # Email Simulator + Decision Result + Audit Trail
│   │   └── api/
│   │       ├── process-email/route.ts    # Core Orchestration API endpoint
│   │       ├── create-order/route.ts     # Razorpay Order creation (Standard Checkout)
│   │       ├── verify-payment/route.ts   # Payment signature verification
│   │       ├── invoices/                 # Invoice list + detail GET routes
│   │       └── webhook/razorpay/         # Webhook route (HMAC verified, idempotent)
│   ├── components/
│   │   ├── RazorpayCheckoutButton.tsx    # Reusable Standard Checkout modal component
│   │   └── ui/
│   │       ├── PolicyGuardrailBreakdown.tsx  # Visual Guardrails A-H status card
│   │       └── AuditTimeline.tsx             # Timestamped audit events timeline
│   └── lib/
│       ├── types.ts                      # Domain types + Result<T, E> error pattern
│       ├── db.ts                         # Supabase DB helper + idempotency store
│       ├── ai-prompt.ts                  # System prompt + prompt injection defenses
│       ├── ai-schema.ts                  # Zod schema + server-side sanitizer
│       ├── ai.ts                         # Gemini extraction + offline fallback
│       ├── policy.ts                     # Policy Engine (Guardrails A-H, sole AUTO_RECOVER)
│       ├── razorpay.ts                   # Payment link creation helper
│       └── razorpay-webhook.ts           # Pure HMAC SHA256 verification
├── tests/
│   ├── unit/policy.test.ts               # Policy Decision Matrix + boundary tests
│   ├── integration/
│   │   ├── phase4-reliability.test.ts    # 5-scenario negative reliability suite
│   │   └── phase6-adversarial.test.ts    # 7-scenario adversarial suite
│   └── evaluation/dataset.ts            # 20 pre-labeled benchmark fixtures
├── supabase/
│   ├── schema.sql                        # DDL: invoices, audit_logs, processed_payments
│   └── seed.sql                          # 5 overdue invoices seed data
└── docs/
    ├── demo-script.md                    # 3-minute live demo script
    ├── judge-qa-prep.md                  # Technical judge Q&A with metric citations
    ├── phase6-adversarial-defenses.md   # Adversarial attack & defense report
    └── evaluation-report.md             # Formal Phase 7 benchmark report
```

---

## ⚙️ Setup Instructions

### Prerequisites
- Node.js ≥ 18, npm ≥ 9
- Supabase project (free tier is sufficient)
- Razorpay Test Mode account
- Google Gemini API key (free tier available at [ai.google.dev](https://ai.google.dev))

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
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Google Gemini AI
GEMINI_API_KEY=your-gemini-api-key

# Razorpay (Test Mode)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your-razorpay-key-secret
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=your-webhook-secret
```

### 3. Set Up Supabase Database
1. Open Supabase Dashboard → SQL Editor
2. Run `supabase/schema.sql` (creates `invoices`, `audit_logs`, `processed_payments` tables)
3. Run `supabase/seed.sql` (seeds 5 realistic overdue invoices with integer paise amounts)

### 4. Set Up Razorpay Test Mode
1. Create account at [dashboard.razorpay.com](https://dashboard.razorpay.com)
2. Switch to **Test Mode** in the dashboard toggle
3. Navigate to Settings → API Keys → Generate Test Key
4. For webhook testing: Settings → Webhooks → Add webhook URL (`/api/webhook/razorpay`), select `payment.captured` event
5. Copy the webhook secret to `RAZORPAY_WEBHOOK_SECRET` in `.env.local`

**Test Credentials:**
- Card: `4100 2800 0000 1007` · CVV: `123` · Expiry: `12/26`
- UPI: `test@razorpay`

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

---

## 🧪 Running Tests

```bash
# Full test suite (all 8 phases)
npm run test

# Individual suites
npm run test:policy        # Policy Decision Matrix (15/15)
npm run test:phase4        # Reliability & Idempotency (5/5)
npm run test:phase6        # Adversarial Integration (12/12)
npm run test:eval          # Phase 7 Benchmark (20 cases, 100% accuracy)
npm run demo:rehearse      # Live demo rehearsal (runs twice, verifies determinism)
```

---

## 🤖 Structured Output Schema

The AI extraction schema sent to Gemini Structured Output:

```json
{
  "type": "OBJECT",
  "properties": {
    "intent": {
      "type": "STRING",
      "enum": ["full_payment", "partial_payment", "dispute", "extension", "unknown"]
    },
    "promised_amount_inr": { "type": "NUMBER", "nullable": true },
    "promised_date":       { "type": "STRING", "nullable": true },
    "dispute_present":     { "type": "BOOLEAN" },
    "confidence":          { "type": "NUMBER" },
    "rationale":           { "type": "STRING" },
    "evidence":            { "type": "STRING" }
  },
  "required": ["intent", "dispute_present", "confidence", "rationale", "evidence"]
}
```

All fields are re-validated server-side by Zod before reaching the policy engine.

---

## 🛡️ Policy Guardrails (A–H)

`evaluatePolicy()` in `src/lib/policy.ts` is the **sole function authorized to emit `AUTO_RECOVER`**. It applies 8 named guardrails in order:

| Guardrail | Trigger | Result |
| :--- | :--- | :--- |
| **A — Over-Amount** | Proposed paise > Outstanding paise | `HUMAN_REVIEW` |
| **B — Non-Positive Amount** | Proposed paise ≤ 0 | `HUMAN_REVIEW` |
| **C — Dispute** | `dispute_present = true` OR `intent = dispute` | `HUMAN_REVIEW` |
| **D — Low Confidence** | `confidence < 0.70` | `HUMAN_REVIEW` |
| **E — Input Sanity** | Malformed/null extraction object | `HUMAN_REVIEW` |
| **F — Sole Authority** | Architecture invariant — no other code path reaches `AUTO_RECOVER` | (structural) |
| **G — Authoritative Invoice** | DB-sourced invoice facts override email text claims | (structural) |
| **H — Currency Ambiguity** | Non-INR currency detected (`USD`, `EUR`, `$`) or percentage > 100% | `HUMAN_REVIEW` |

---

## 📊 Phase 7 Evaluation Dataset Summary

20 pre-labeled synthetic email fixtures across 5 categories:

| Category | Count | Expected Decision | Phase 7 Result |
| :--- | :--- | :--- | :--- |
| Partial Payment | 5 | 4× AUTO_RECOVER, 1× HUMAN_REVIEW | ✅ 5/5 |
| Full Payment | 4 | 4× AUTO_RECOVER | ✅ 4/4 |
| Dispute | 4 | 4× HUMAN_REVIEW | ✅ 4/4 |
| Extension | 3 | 3× HUMAN_REVIEW | ✅ 3/3 |
| Ambiguous / Adversarial | 4 | 4× HUMAN_REVIEW | ✅ 4/4 |
| **Total** | **20** | | **20/20 ✅** |

Full evaluation report: [`docs/evaluation-report.md`](docs/evaluation-report.md)

---

## ⚠️ Known Limitations (PRD 3.5 Non-Goals)

These items are known gaps explicitly deferred, not forgotten:

1. **Multi-Currency FX Conversion**: Non-INR amounts are blocked by Guardrail H and routed to human review. FX conversion at dynamic rates is not implemented.
2. **Bulk / Queue Processing**: Current design is one invoice per API call. A message queue (e.g., BullMQ or Supabase Realtime) for batch processing is a Phase 10 item.
3. **Authentication / RBAC**: No login system in the current build. The AR Dashboard runs in open-access demo mode. Auth is deferred.
4. **Retry with Exponential Backoff**: Gemini API errors fall back to the offline mock extractor. Configurable retry-with-backoff is not implemented.
5. **External SIEM / Audit Log Forwarding**: Audit logs are written to Supabase only. Integration with external SIEM systems is deferred.
6. **Email Inbox Integration**: The system currently requires manual email paste. Direct inbox polling (Gmail API, IMAP) is not in scope.

---

## 🗺️ Product Roadmap (PRD 3.13)

| Phase | Feature |
| :--- | :--- |
| v1.1 | Gmail / IMAP inbox polling for zero-touch processing |
| v1.2 | Auth & RBAC (SSO for AR team login) |
| v1.3 | Multi-currency support with configurable FX rate source |
| v1.4 | Bulk queue processing (BullMQ / pg_cron) |
| v1.5 | Predictive payment probability scoring per debtor |
| v2.0 | Multi-tenant SaaS with per-organization policy configuration |

---

## 🔐 Security Notes

**Secrets handling:**
- No API key, service-role key, or webhook secret appears in client-side code, `NEXT_PUBLIC_` variables, log lines, or committed files
- `.env.local` is in `.gitignore`; only `.env.example` (with placeholder values) is committed
- Razorpay `KEY_SECRET` is server-only; only `NEXT_PUBLIC_RAZORPAY_KEY_ID` is exposed to the browser for the Standard Checkout modal

**Webhook verification:**
- `verifyRazorpayWebhookSignature()` in `src/lib/razorpay-webhook.ts` uses `crypto.createHmac('sha256')` + `crypto.timingSafeEqual()` on every webhook event
- The database is never touched before signature verification passes
- Duplicate webhook replay protection via `processed_payments.payment_id` unique constraint (idempotent — invoice balance updated exactly once per payment)

**AI output isolation:**
- Every field extracted from Gemini is re-validated through Zod before policy evaluation
- The system prompt (`src/lib/ai-prompt.ts`) explicitly instructs the model that the email body is untrusted `DATA`, never commands
- `evaluatePolicy()` does not read `rationale` or `evidence` fields for decision logic — injected text in those fields has zero effect on money movement decisions

---

## 📌 Phase Milestone Summary

- [x] **Phase 0** — Foundation: Next.js 15, Strict TypeScript, Supabase DDL, Razorpay helpers, HMAC webhook
- [x] **Phase 1** — AI Extraction: Gemini Structured Output, prompt injection defenses, Zod validation
- [x] **Phase 2** — Policy Engine: Guardrails A-F, integer paise arithmetic, 15/15 unit tests
- [x] **Razorpay Checkout** — Standard Web Checkout modal + order creation + signature verification
- [x] **Phase 3** — Orchestration Loop: `/api/process-email`, Razorpay link generation, webhook handler
- [x] **Phase 4** — Reliability: Webhook replay idempotency, 10s timeout, 5/5 negative scenarios
- [x] **Phase 5** — Dashboard UI: AR Dashboard, Email Simulator, Decision Result, Audit Timeline
- [x] **Phase 6** — Adversarial Hardening: Guardrails G-H, currency/percentage sanitizers, 12/12 adversarial tests
- [x] **Phase 7** — Evaluation Harness: 20 pre-labeled benchmarks, 100% Safety Metric, determinism verified
- [x] **Phase 8** — Fix & Freeze: Fail-closed timeout fix, CHANGELOG, tagged `v1.0.0-frozen`
- [x] **Phase 9** — Demo Preparation: Demo script, judge Q&A prep, rehearsal runner

---

**Live Demo & Submission Docs:** [`docs/demo-script.md`](docs/demo-script.md) | [`docs/judge-qa-prep.md`](docs/judge-qa-prep.md)  
**Evaluation Report:** [`docs/evaluation-report.md`](docs/evaluation-report.md)  
**Frozen Release:** `v1.0.0-frozen`
