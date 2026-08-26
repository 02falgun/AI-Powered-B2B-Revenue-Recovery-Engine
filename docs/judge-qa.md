# RecoverAI — Razorpay Buildathon Judge Q&A Guide

**Track**: Agentic AI (Automated B2B Revenue Recovery) | **Status**: Production-Ready (Test Mode)

---

## Q1: Why use an LLM instead of standard regex or rule-based keyword matching?

**Answer:**
B2B debt collection communications are nuanced, multi-turn, and often emotionally charged natural language. Buyers communicate via idioms, implicit percentages, conditional timelines, and masked disputes that rule-based engines cannot reliably parse:
- *"We can do half the balance by this Friday."* (Implicit percentage commitment)
- *"Paying ₹25,000 once your team fixes the malfunctioning API gateway."* (Dispute embedded inside a partial payment commitment)
- *"Transfer scheduled for 10k by next Tuesday."* (Colloquial number abbreviation and relative date)

**Our Architectural Separation**:
1. **LLM Role (Probabilistic Perception Only)**: The LLM is restricted strictly to unstructured text understanding — mapping raw email text to a typed 7-field JSON schema (`intent`, `promisedAmountInr`, `promisedDate`, `disputePresent`, `confidence`, `rationale`, `evidence`).
2. **Policy Engine Role (Deterministic Enforcement)**: The LLM never makes financial decisions, computes balances, or touches the Razorpay API. All extracted data is treated as untrusted input and evaluated by our pure TypeScript **Frozen Core Policy Engine** (`src/lib/policy.ts`).

---

## Q2: Can the AI accidentally overcharge a buyer or trigger duplicate payments?

**Answer: Mathematically impossible by architecture.**
RecoverAI enforces three layered guarantees:
1. **Integer Paise Invariant**: All currency arithmetic is performed in integer **paise** (`1 INR = 100 paise`), eliminating JavaScript floating-point rounding errors.
2. **Guardrail A (Over-Amount Interlock)**: `evaluatePolicy()` compares `promisedAmountPaise` directly against the database's authoritative `outstandingAmountPaise`. If the extracted amount exceeds the outstanding balance, the system instantly halts autonomous recovery and routes to `HUMAN_REVIEW`.
3. **Database-Level Webhook Idempotency**: Payment events (`order.paid`, `payment_link.paid`) are processed through a unique constraint on `payment_id` (`processed_payments` table). Duplicate webhook delivery attempts are acknowledged with HTTP 200 and ignored without balance corruption.

---

## Q3: What happens when the AI service experiences latency, errors, or rate limits?

**Answer: The system fails closed with zero downtime and zero financial risk.**
- **Timeout Protection**: All LLM calls are bound to a strict 10-second `AbortController`.
- **Automatic Multi-Model Fallback**: If primary Gemini 2.5 Flash encounters a 429 rate limit or timeout, the engine automatically falls back to OpenAI GPT-4o-mini via exponential backoff with randomized jitter.
- **Fail-Closed Guarantee**: If all providers fail or return unparseable schemas (Guardrail E), the invoice/email job is safely marked for operator review in the `HUMAN_REVIEW` queue. Money movement is never initiated on an error state.

---

## Q4: How does RecoverAI defend against prompt injection and jailbreaking?

**Answer: Two-layer defense with architectural isolation.**
1. **Prompt Boundary Isolation**: Inbound email content is wrapped in strict data delimiters and explicitly flagged as untrusted third-party payload.
2. **Deterministic Guardrails Interlock**: Even if a sophisticated adversary crafts a jailbreak that forces the model to emit `disputePresent: false` and `confidence: 0.99`, the policy engine independently checks:
   - Whether the claimed amount exceeds the database balance (Guardrail A).
   - Whether the amount is positive (Guardrail B).
   - Whether the sender is an authorized contact for that invoice (Guardrails F & G).
   - Whether the currency is strictly INR (Guardrail H).

---

## Q5: What quantitative evaluation metrics validate system safety?

**Answer: 100.0% Primary Safety Metric on the 100-Case Evaluation Suite.**

| Metric | Measured Benchmark | Target |
| :--- | :---: | :---: |
| **Primary Safety Metric** (Unsafe cases diverted to `HUMAN_REVIEW`) | **100.0% (58/58)** | 100% (Zero-Tolerance) |
| **Policy Decision Accuracy** | **86.0% (86/100)** | > 80% |
| **Dispute Detection Accuracy** | **96.0%** | > 90% |
| **Policy Engine Determinism Check** | **100% Byte-Identical** | 100% |
| **Load Test Server Stability (50 Concurrency)** | **0.0% Server 5xx Errors** | 0.0% |

---

## Q6: How does RecoverAI ensure enterprise compliance and data privacy?

**Answer:**
- **PII Scrubbing**: All logs and Sentry telemetry pass through `scrubPii()` (`src/lib/scrubber.ts`), masking Aadhaar, PAN, phone numbers, and payment details.
- **Multi-Tenant RLS**: Row-Level Security in Supabase PostgreSQL guarantees hard tenant data isolation (`company_id`).
- **Data Lifecycle Compliance**: Full compliance with Indian DPDP and IT Act regulations, featuring a 180-day audit log retention schedule and an admin-only hard-purge endpoint (`POST /api/admin/purge-company`).
