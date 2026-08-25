# RecoverAI — Privacy Policy

> **Version**: 1.0 — Phase P8  
> **Effective Date**: 2026-08-25  
> **Status**: Test Mode Only (Razorpay Test Mode — no real payments currently process)
>
> This document is written in plain language and is intended for operators, pilot customers, and evaluators of RecoverAI. It is not a substitute for legal counsel.

---

> [!CAUTION]
> **DPDP Act Notice** — See [Section 6](#6-india-dpdp-act-considerations) for considerations under the Digital Personal Data Protection Act 2023. This section is **informational only, not legal advice**. Obtain qualified legal review before onboarding real paying customers or processing real personal data at scale.

---

## 1. Who We Are

RecoverAI is an AI-powered B2B accounts-receivable recovery engine built for finance teams. It reads buyer emails about overdue invoices, extracts payment intent using Google Gemini, applies a deterministic policy engine, and (where safe) issues Razorpay payment links automatically.

**Operator**: The business entity (company) that deploys RecoverAI for its internal finance team.  
**Data subjects**: Buyer-side finance contacts whose email communications are ingested and processed.

---

## 2. What We Store

### 2a. Invoice Records

| Field | Why stored | Retention |
|---|---|---|
| Invoice number | Core business identifier | Life of the invoice + 7 years (financial records) |
| Customer name | Debtor identification | Same |
| Customer email address | Payment link delivery, email matching | Same |
| Total amount (paise) | Policy arithmetic | Same |
| Outstanding amount (paise) | Policy arithmetic | Same |
| Due date | Policy guardrail (overdue detection) | Same |
| Status (`overdue`, `paid`, etc.) | Recovery workflow state | Same |
| Company ID | Multi-tenant isolation | Same |

### 2b. Ingested Email Records

When real email ingestion (IMAP) is active, raw inbound buyer emails are stored:

| Field | Why stored | Retention |
|---|---|---|
| Message ID (RFC 2822) | Deduplication / idempotency | 90 days from ingestion |
| Sender email address | Invoice matching heuristic | 90 days from ingestion |
| Email subject line | Invoice matching heuristic | 90 days from ingestion |
| Email body (full text) | AI intent extraction input | **30 days** from ingestion (then scrubbed to `[PURGED]`) |
| Job status | Processing pipeline state | 90 days |
| Error message | Debugging only | 90 days |

> **Why email bodies are stored at all**: The AI model (Google Gemini) requires the full message body to extract payment intent, disputed amounts, and partial-payment commitments. Without the body, the extraction cannot occur. Bodies are scrubbed of PII before being forwarded to error-tracking systems (Sentry) via `src/lib/scrubber.ts`.

### 2c. Audit Logs

| Field | Why stored | Retention |
|---|---|---|
| Invoice ID | References the event subject | 7 years (financial audit trail) |
| Action type | What happened (e.g., `AUTO_RECOVER`, `ADMIN_MANUAL_OVERRIDE`) | 7 years |
| Actor (email or system) | Who or what triggered the action | 7 years |
| Metadata (JSON) | Context (amounts, guardrail results) | 7 years |
| Timestamp | Chronological ordering | 7 years |
| Company ID | Multi-tenant isolation | 7 years |

> Audit logs are **immutable by design**. They are never deleted by normal application operations. An admin data-purge (Section 4) removes audit logs for the requested company on explicit operator request only.

### 2d. User Profiles

| Field | Why stored | Retention |
|---|---|---|
| User ID (Supabase UUID) | Session binding | Until account deletion |
| Email address | Login identity | Until account deletion |
| Role (`admin` / `operator`) | Access control | Until account deletion |
| Company ID | Tenant assignment | Until account deletion |

### 2e. Razorpay Payment Records

Payment link IDs and order IDs are stored as metadata references (not full card data — Razorpay is the PCI-DSS compliant payment processor; RecoverAI never handles raw card numbers or CVVs).

---

## 3. Why We Process This Data

| Purpose | Legal basis (general) |
|---|---|
| Invoice recovery workflow | Legitimate interest of the operator / contractual necessity |
| AI intent extraction | Legitimate interest; necessary for the core service |
| Audit logging | Legal obligation (financial record-keeping) + security |
| Rate limiting / abuse prevention | Legitimate interest (system integrity) |
| Error tracking (Sentry) | Legitimate interest (service reliability) |

All processing is conducted on behalf of the **operator** (the business deploying RecoverAI). The operator is the data controller for their customers' data. RecoverAI acts as a data processor.

---

## 4. Data Purge & Deletion Mechanism

Operators with the **`admin` role** can request a full data purge for their company via the admin API:

```
POST /api/admin/purge-company
Authorization: requires active admin session
Body: { "company_id": "<uuid>", "confirm": true }
```

This action:
- Deletes all `invoices` rows where `company_id` matches
- Deletes all `ingested_email_jobs` rows where `company_id` matches
- Deletes all `audit_logs` rows where `company_id` matches
- Does **not** delete the company record itself (preserves the tenant boundary for the operator's own audit trail)
- Is **irreversible** — a confirmation flag (`"confirm": true`) is required
- Is **rate-limited** to 2 purge requests per hour per admin (prevents accidental re-runs)
- Is recorded in the system log before execution

See [`docs/data-retention-policy.md`](data-retention-policy.md) for the full retention schedule and purge procedure.

---

## 5. Data Sharing & Third-Party Processors

| Processor | Data shared | Purpose |
|---|---|---|
| **Supabase** (PostgreSQL) | All structured data listed above | Database storage |
| **Google Gemini** (via AI Studio API) | Email body text only (stripped of auth credentials by scrubber) | AI intent extraction |
| **Razorpay** | Invoice amount, customer name, customer email | Payment link creation, payment processing |
| **Upstash Redis** | Rate-limit counters (user ID hashes only, no PII) | Abuse prevention |
| **Sentry** | Error stack traces (PII scrubbed before transmission) | Error monitoring |
| **UptimeRobot** | HTTP status code responses only (no body content) | Availability monitoring |

No data is sold, licensed, or shared with any other third party for marketing or advertising purposes.

---

## 6. India DPDP Act Considerations

> [!WARNING]
> **INFORMATIONAL ONLY — NOT LEGAL ADVICE**
>
> The following is a high-level, plain-language summary of considerations under the **Digital Personal Data Protection Act, 2023 (India)**. This has **not** been reviewed by a qualified legal professional. You **must** obtain real legal review before onboarding real paying customers or processing personal data of Indian residents at scale.

The DPDP Act 2023 is India's primary data protection legislation. Given that RecoverAI:
- Processes buyer email addresses, names, and financial communications
- Operates in the B2B invoice recovery domain (financial data is involved)
- May process personal data of individuals at buyer organisations (e.g., a CFO's email)

The following considerations apply:

| Consideration | Relevance to RecoverAI |
|---|---|
| **Data Fiduciary obligations** | The operator deploying RecoverAI is likely the Data Fiduciary. RecoverAI acts as a Data Processor. A formal Data Processing Agreement (DPA) may be required. |
| **Purpose limitation** | Data collected for invoice recovery must not be used for other purposes. RecoverAI uses email body data solely for intent extraction and does not re-use it for marketing or profiling. |
| **Storage limitation** | DPDP requires data not be retained longer than necessary. See the 30-day email body retention and 90-day job record retention in Section 2. |
| **Data Principal rights** | Individuals (buyers) may have rights to access, correction, or erasure of their data. The operator (Data Fiduciary) is responsible for handling these requests. The admin purge API (Section 4) provides the mechanism. |
| **Security safeguards** | Appropriate technical and organisational measures must be in place. RecoverAI uses RLS, RBAC, HMAC webhook verification, and PII scrubbing. |
| **Cross-border transfer** | Google Gemini API calls may transfer email body text to Google's servers. Verify Google's data processing terms and sub-processor locations before production use. |
| **Significant Data Fiduciary** | If the operator processes large volumes of financial personal data, they may qualify as a Significant Data Fiduciary under the DPDP Act, triggering additional obligations (Data Protection Impact Assessment, Data Protection Officer appointment). |

**Next steps before production**: Engage a legal advisor familiar with the DPDP Act 2023 and its implementing rules to review the full data flow, prepare the required Privacy Notice for data principals, and confirm the basis for processing financial personal data.

---

## 7. Contact

For data-related requests or concerns, contact the operator administrator who deployed this instance of RecoverAI. The purge mechanism is described in Section 4.

---

*This document will be updated as the system evolves. Material changes will be documented with a version bump and effective date.*
