# CHANGELOG — RecoverAI Engine

All notable changes, architectural guardrails, and release milestones for RecoverAI are documented in this file.

---

## [v1.0.0-frozen] - 2026-08-21

### 🚀 Production Freeze Release Highlights
- **100.0% Primary Safety Metric**: 12/12 high-risk unsafe cases (disputes, deadline extensions, evasive replies, prompt injection attacks, overpayment requests, non-INR currency ambiguity) correctly routed to `HUMAN_REVIEW`. Zero unsafe auto-recoveries issued.
- **100.0% Policy Decision Accuracy**: 20/20 benchmark evaluation test cases matched expected policy outcomes.
- **100% Policy Engine Determinism**: `evaluatePolicy()` in `src/lib/policy.ts` produces byte-identical decisions across independent execution runs.

### 🛡️ Guardrails & Safety Architecture Matrix
- **Guardrail A (`guardrailCheckOverAmount`)**: Rejects payment proposals exceeding outstanding invoice debt balance.
- **Guardrail B (`guardrailCheckNonPositiveAmount`)**: Rejects payment proposals <= 0 paise.
- **Guardrail C (`guardrailCheckDispute`)**: Unconditionally routes billing disputes or dispute intents to `HUMAN_REVIEW`.
- **Guardrail D (`guardrailCheckSanityAndCompleteness`)**: Requires extraction confidence score ≥ 0.70 and complete intent classification.
- **Guardrail E (`guardrailCheckSanityAndCompleteness`)**: Fail-closed safety net for malformed objects, unexpected parameters, or AI timeouts.
- **Guardrail F (`evaluatePolicy`)**: Architectural Invariant — `evaluatePolicy()` is the sole function authorized to issue `AUTO_RECOVER`.
- **Guardrail G (`guardrailCheckAuthoritativeInvoice`)**: Enforces DB-sourced invoice debt facts, ignoring external email text claims or fake invoice IDs.
- **Guardrail H (`guardrailCheckCurrencyAndPercentageAmbiguity`)**: Sanitizes non-INR currency ambiguity (`USD`, `EUR`, `$`) and malformed percentages > 100%, routing to `HUMAN_REVIEW`.

### 💳 Integrations & Idempotency
- **Razorpay Standard Web Checkout**: `/api/create-order` & `/api/verify-payment` endpoints with HMAC SHA256 signature verification (`crypto.timingSafeEqual`).
- **Webhook Replay Protection**: `processed_payments` DB table with primary key `payment_id` + double-checked in-memory store guarantees duplicate webhooks update invoice balances **EXACTLY ONCE**.

### 🧪 Evaluation & Test Coverage
- `tests/unit/policy.test.ts`: Policy Decision Matrix & boundary test suite (15/15 passed).
- `tests/integration/phase4-reliability.test.ts`: Phase 4 Negative Reliability suite (5/5 passed).
- `tests/integration/phase6-adversarial.test.ts`: Phase 6 Adversarial Integration suite (12/12 passed).
- `scripts/run-evaluation.ts`: Phase 7 Formal Evaluation Benchmark Harness (20 pre-labeled benchmark cases, 100% passing).
