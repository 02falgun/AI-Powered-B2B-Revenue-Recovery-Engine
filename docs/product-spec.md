# RecoverAI — Product Specification (PRD / SRS)

## 1. Problem Statement & Track Alignment
In B2B commerce, overdue invoices represent massive locked working capital. Traditional collections rely either on manual, slow accounts receivable (AR) teams or blunt, rigid automated email dunning sequences. When customers reply with partial payment commitments, dispute claims, or payment timeline promises, automated systems fail to interpret natural language commitments, resulting in lost recovery opportunities or erroneous collections.

**Razorpay Buildathon Track**: Agentic AI (Automated B2B Revenue Recovery).
RecoverAI bridges the gap between natural language buyer responses and Razorpay's financial settlement infrastructure, enabling autonomous, guardrailed revenue capture while enforcing absolute money correctness and zero hallucinated transactions.

---

## 2. Target Personas
1. **B2B Finance & AR Managers**: Need real-time visibility into collection velocity, dispute queues, and automated audit trails without risking erroneous overcharges.
2. **Operations & Compliance Officers**: Require deterministic safety bounds, complete PII scrubbing, immutable audit logging, and single-tenant data isolation.
3. **B2B Buyers / Debtors**: Experience frictionless, instant settlement via pre-filled Razorpay payment links and checkout flows when promising payment.

---

## 3. Core Functional Requirements

### FR-1: Natural Language Payment Extraction
- Accepts inbound customer emails (raw text/HTML).
- Extracts structured intent (`full_payment`, `partial_payment`, `dispute`, `extension`, `unknown`), promised amounts (INR and Paise), timeline dates, and dispute flags.
- Validates extractions strictly against a typed Zod schema with multi-model fallback (Gemini 2.5 Flash to OpenAI GPT-4o-mini).

### FR-2: Deterministic Policy Engine ("Frozen Core")
- Evaluates extracted intent against authoritative database ledger records.
- Enforces Guardrails A through H without exception.
- Fails closed to `HUMAN_REVIEW` on any anomaly, ambiguity, low confidence (< 80%), or dispute indicator.

### FR-3: Razorpay Test-Mode Payment Fulfillment
- Autonomously generates Razorpay Test Orders and Payment Links for approved `AUTO_RECOVER` decisions.
- Strictly performs integer arithmetic in **paise** (1 INR = 100 paise).
- Displays clear amber `TEST MODE` banners on all UI components to guarantee zero accidental live-money movement during staging.

### FR-4: Real-Time Annunciator & Dispute Ledger
- Visual annunciator telemetry dashboard highlighting active queue counts, pass rates, and security telemetry.
- Comprehensive invoice ledger displaying status tags (`DRAFT`, `SENT`, `OVERDUE`, `PROCESSING`, `AUTO_RECOVER`, `HUMAN_REVIEW`, `PARTIALLY_PAID`, `PAID`).
- Dispute resolution interface allowing manual override and audit annotation by authorized operators.

### FR-5: Multi-Tenancy & Data Privacy
- Tenant boundary enforcement using Supabase Row-Level Security (`company_id`).
- Automated PII scrubbing for logs and exception monitoring.
- Compliant with Indian DPDP and IT Act requirements, including hard-purge administrative endpoints.

---

## 4. Non-Functional Requirements (NFR)
- **Safety Invariant**: 0.0% Unsafe Auto-Recoveries on ambiguous or disputed communications (100% Primary Safety Metric on the 100-case evaluation suite).
- **Latency**: Sub-3-second end-to-end processing for single email extractions.
- **Availability & Resilience**: Automatic LLM provider fallback on 429 rate limits or timeouts, and dead-letter queue retries with exponential backoff.
- **Auditability**: 100% immutable audit logging for all policy decisions and payment actions.
