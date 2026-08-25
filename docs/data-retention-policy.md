# RecoverAI — Data Retention Policy

> **Version**: 1.0 — Phase P8  
> **Effective Date**: 2026-08-25  
> **Classification**: Internal Operations Document

---

## 1. Purpose

This policy defines how long RecoverAI retains different categories of data, when and how data is deleted or anonymised, and the procedure for fulfilling data deletion requests from operators.

It is a companion document to [`docs/privacy-policy.md`](privacy-policy.md).

---

## 2. Retention Schedule

### 2a. Core Data (Supabase PostgreSQL)

| Data Category | Table | Retention Period | Disposal Method |
|---|---|---|---|
| Invoice records | `invoices` | 7 years from invoice creation (financial record obligation) | Hard delete on operator purge request only |
| Ingested email bodies | `ingested_email_jobs.body` | **30 days** from `created_at` | Column scrubbed to `[PURGED — data-retention-policy §2a]` by scheduled job |
| Ingested email metadata (sender, subject, status) | `ingested_email_jobs` | 90 days from `created_at` | Hard delete on operator purge request; or by automated cleanup after 90 days |
| Audit logs | `audit_logs` | 7 years (financial audit trail requirement) | Hard delete on operator purge request only |
| User profiles | `user_profiles` | Until the user account is deleted | Hard delete on account closure |
| Company records | `companies` | Indefinite (tenant boundary anchor) | Preserved even after purge; manual removal requires Supabase admin access |
| Payment deduplication records | `processed_payments` | 7 years | Hard delete on operator purge request only |

### 2b. External Systems

| System | Data retained | Retention | Notes |
|---|---|---|---|
| **Sentry** | Error payloads (PII scrubbed before transmission) | 90 days (Sentry free-tier default) | PII scrubber (`src/lib/scrubber.ts`) runs before every Sentry capture |
| **Upstash Redis** | Rate-limit counters (user ID hashes, no PII) | Auto-expired by TTL (1 hour per window) | No action needed |
| **Razorpay** | Payment records, payment link records | Governed by Razorpay's own data retention policy | RecoverAI does not control retention of Razorpay-side records |
| **UptimeRobot** | HTTP status check logs | 6 months (UptimeRobot free-tier) | No PII transmitted |

---

## 3. Automated Retention Jobs

### 3a. Email Body Scrub (Recommended — not yet implemented as of P8)

A scheduled job should run daily to scrub `ingested_email_jobs.body` for records older than 30 days:

```sql
-- ADDITIVE ONLY — does not drop or alter the column, only updates its value
UPDATE ingested_email_jobs
SET body = '[PURGED — data-retention-policy §2a]',
    updated_at = NOW()
WHERE created_at < NOW() - INTERVAL '30 days'
  AND body != '[PURGED — data-retention-policy §2a]';
```

This can be scheduled as a Vercel Cron Job at `/api/cron/scrub-email-bodies` when ready.  
**Free-tier note**: Vercel Hobby tier supports 2 cron jobs. If both slots are already used, this scrub must be triggered manually or via an external cron service (e.g., GitHub Actions scheduled workflow — free tier supports this).

### 3b. Ingested Email Job Cleanup (Recommended — not yet implemented as of P8)

```sql
-- ADDITIVE ONLY — hard delete of old job records (not invoices or audit logs)
DELETE FROM ingested_email_jobs
WHERE created_at < NOW() - INTERVAL '90 days';
```

---

## 4. Admin Data Purge Procedure

### 4a. When to Use

Execute a company data purge when:
- An operator formally requests deletion of all their data ("right to erasure" request)
- A pilot company's engagement ends and they request data cleanup
- An error resulted in incorrect data being stored for a company

### 4b. How to Execute

The purge API is available to users with the `admin` role only:

```
POST /api/admin/purge-company
Content-Type: application/json
Authorization: Active admin session cookie (Supabase Auth)

{
  "company_id": "<company-uuid>",
  "confirm": true
}
```

**What is purged** (all scoped strictly to the provided `company_id`):
- All rows in `invoices` where `company_id` matches
- All rows in `ingested_email_jobs` where `company_id` matches *(Note: this table uses the invoice's `company_id` indirectly — see implementation notes)*
- All rows in `audit_logs` where `company_id` matches
- All rows in `processed_payments` where the referenced invoice's `company_id` matches

**What is NOT purged**:
- The `companies` table row (preserves the tenant boundary; prevents accidental recreation under the same ID)
- User profiles (must be managed separately via Supabase Auth console)
- Razorpay-side records (must be managed via Razorpay Dashboard)

### 4c. Confirmation & Audit Trail

- The `confirm: true` flag is mandatory — prevents accidental purge from a missing request body
- The purge action is logged **before** deletion executes, so the audit record survives even if the purge fails partway
- A purge is **irreversible** — there is no undo. Take a Supabase database backup before executing
- Rate-limited to 2 purge requests per hour per admin to prevent accidental re-runs

### 4d. Expected Response

```json
{
  "success": true,
  "purged": {
    "invoices": 42,
    "email_jobs": 183,
    "audit_logs": 621
  },
  "company_id": "<company-uuid>",
  "purged_at": "2026-08-25T12:00:00.000Z"
}
```

---

## 5. Deviation & Exception Handling

| Scenario | Policy |
|---|---|
| Supabase is unreachable during purge | The route returns HTTP 503. No partial purge occurs — the operation is atomic per table. Retry when DB is available. |
| Purge requested for a company with no data | Returns success with `purged: { invoices: 0, email_jobs: 0, audit_logs: 0 }` |
| Admin requests purge of another company's data | Route validates that the requesting admin's `company_id` matches, OR the admin has super-admin status. Mismatches return HTTP 403. |
| Data referenced by Razorpay payment links | Payment link IDs remain valid on Razorpay's side. Removing the invoice record from RecoverAI's DB does not invalidate outstanding payment links. Notify Razorpay separately if needed. |

---

## 6. Review Schedule

This policy should be reviewed:
- At least annually
- Before onboarding any paying customer
- After any significant change to what data is collected or how it is processed
- Before transitioning from Razorpay Test Mode to Live Mode (per [`docs/go-live-checklist.md`](go-live-checklist.md))
