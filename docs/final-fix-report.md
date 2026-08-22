# RecoverAI — Final Fix Report (Pre-Submission Hardening Pass)

**Date**: 2026-08-21  
**Version**: v1.0.0-frozen → hardening patch applied  
**Branch**: main

---

## Task 1 — PII / Local File Paths (BLOCKING) ✅ RESOLVED

- **Found:** Local machine absolute paths `file:///.../Projects/B2B-AI/` in `docs/judge-qa-prep.md` and `docs/phase6-adversarial-defenses.md`.

**Changed:** Stripped the full local path prefix from all `file://` links in both files, leaving clean relative paths (e.g. `src/lib/policy.ts`) as the link target text.

- **Verified:** `grep -ri "[local-user-path]" docs/ README.md` → **empty output**.

---

## Task 2 — Supabase Anon Key Lockdown (BLOCKING) ✅ RESOLVED

**Investigation findings:**
- `src/utils/supabase/client.ts` — `createBrowserClient()` using `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. **Not imported anywhere in pages or components** — confirmed dead code.
- `src/utils/supabase/server.ts` and `middleware.ts` — used `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` only for the auth session stub (no login system exists).
- All real DB operations in `src/lib/db.ts` already used `SUPABASE_SERVICE_ROLE_KEY` exclusively.

**Changes made:**
- **Deleted** `src/utils/supabase/client.ts` (dead code, no imports)
- **Deleted** `utils/supabase/client.ts` (root-level re-export pointing to deleted file)
- **Modified** `src/utils/supabase/server.ts` — `SUPABASE_SERVICE_ROLE_KEY` replaces `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- **Modified** `src/utils/supabase/middleware.ts` — same key replacement; documented no-op nature of `auth.getUser()` in the current build
- **Modified** `.env.example` — removed `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` line entirely
- **Modified** `README.md` Security Notes — replaced claim with what is actually true: anon key not issued/used; RLS not enabled (moot since service-role is server-only); verified `.env.local` never committed

**RLS decision:** Not enabled, and not required. The anon/publishable key has been fully removed — there is no credential that could reach the DB directly from the browser. Document confirms this is intentional.

**Verified:** `grep -rn "PUBLISHABLE_KEY\|supabase/client" src/` → **empty output**. `npx tsc --noEmit` → **0 errors**.

---

## Task 3 — Payment Flow Reconciliation (BLOCKING) ✅ RESOLVED

**Investigation findings:**
- The live demo "Click Pay" button → `RazorpayCheckoutButton` → Standard Checkout flow (`create-order` → `verify-payment`).
- `process-email` also provides `paymentLinkUrl` (Payment Links flow) shown as a direct `<a href>` link for the payment link itself.
- Both flows are intentionally reachable in the UI at different moments.
- The webhook handler already correctly processes BOTH `payment_link.paid` and `payment.captured` events (line 67 of `route.ts`).
- Both paths call `updateInvoiceAfterPayment()`, which calls `isPaymentAlreadyProcessed()` first using `razorpay_payment_id` — double-credit already architecturally blocked.

**Changes made:**
- **Created** `tests/integration/dual-payment-idempotency.test.ts` — proves same `payment_id` through both paths = balance updated exactly once (✅ PASS verified)
- **Added** `"test:idempotency"` script to `package.json`
- **Modified** `README.md` Setup (Razorpay step 4) — corrected from `payment.captured` only to subscribe to BOTH `payment_link.paid` AND `payment.captured`
- **Modified** `README.md` Security Notes — added Dual Payment Flow & Idempotency section documenting both flows, convergence point, and test verification

**Verified:** `npm run test:idempotency` → **✅ PASS — balance updated exactly once**.

---

## Task 4 — Gemini Model Identifier (BLOCKING) ✅ RESOLVED (with important note)

**Investigation:** `gemini-3.6-flash` was in the code and docs. Based on my training data, I initially believed this was invalid and changed it to `gemini-2.5-flash`. 

**Correction:** The Phase 4 test output produced an explicit API 404 error:
> *"This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.6-flash for the latest features and improvements."*

**Conclusion:** `gemini-3.6-flash` IS the correct, current, API-confirmed model ID. The previous eval runs that fell back to the offline mock were caused by free-tier **rate limiting (HTTP 429)**, not an invalid model ID. The model ID was never broken.

**Changes made:**
- Reverted `gemini-2.5-flash` back to `gemini-3.6-flash` in `src/lib/ai.ts` and all README occurrences.

**Note disclosed:** During earlier phases, eval benchmark runs hit the free-tier rate limit (20 requests/day) and fell back to the offline mock extractor. This is correct behavior (fail-closed with mock fallback). The model ID was valid throughout; the fallback was masking rate exhaustion, not a broken model.

**Verified:** Phase 4 test output confirms `gemini-3.6-flash` is the model ID returned by Google's own API error message.

---

## Task 5 — Guardrail Letter Unification (BLOCKING) ✅ RESOLVED

**Investigation:** Guardrail letters A-H are used correctly in `docs/phase6-adversarial-defenses.md` body text. No remapping was needed. The only issue was the `file:///` absolute paths (fixed by Task 1).

**Changes made:**
- **Modified** `README.md` Guardrails section — added a callout block clarifying that Webhook Signature Verification and AI-Failure Fail-Closed are structural security controls enforced **outside** the 8-guardrail policy list (at transport layer and orchestration layer respectively), explaining why they don't appear as lettered guardrails.

**Verified:** `grep -rn "Guardrail [A-H]" docs/ README.md` — all occurrences use consistent A-H mapping with the same definitions.

---

## Task 6 — EVAL-04/EVAL-10 Prompt Refinement (NON-BLOCKING) ⏭️ DEFERRED

**Decision:** Both EVAL-04 and EVAL-10 produce incorrect `intent` classification (classified as `partial_payment`/`unknown` instead of `dispute`) but the **policy decision is correct in both cases** (different guardrails catch them — Guardrail C for EVAL-04, Guardrail D for EVAL-10). 

No prompt change was attempted. The frozen policy engine has 100% Policy Decision Accuracy and 100% Primary Safety Metric. Risking a prompt change this close to submission for an intent-field accuracy improvement that doesn't affect safety or policy-decision numbers violates the Phase 8 priority rule.

**Final metrics are unchanged:**
- Primary Safety Metric: **100.0%** (12/12) — unchanged ✅
- Policy Decision Accuracy: **100.0%** (20/20) — unchanged ✅
- Intent Classification Accuracy: **90.0%** — unchanged (EVAL-04, EVAL-10 remain misclassified, both safe)

---

## Task 7 — Freeze Hygiene (BLOCKING) ✅ RESOLVED

**Verified findings:**
- ✅ No dev smoke-test route (`/api/test-razorpay` or equivalent) found in `src/app/api/`
- ✅ `.env.local` never committed: `git log --all --full-history -- .env.local` → empty
- ⚠️ `.env.example` contained `RAZORPAY_KEY_ID=rzp_test_TSOJfqI5DSz59Z` (real-looking test key ID)
- ⚠️ `.env.example` contained `GEMINI_API_KEY=AIzaSy...` (partial real key prefix)
- ⚠️ `.env.example` contained `OPENAI_API_KEY=sk-proj-your-openai-api-key` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (both unused in the current build)

**Changes made:**
- **Rewrote** `.env.example` — replaced real-looking key IDs with clean placeholders (`rzp_test_xxxxxxxxxxxx`, `your-gemini-api-key`, `your-razorpay-key-secret`), removed unused `OPENAI_API_KEY` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` lines

**Verified:** `cat .env.example` contains only placeholder values matching `your-*` or `xxx` pattern.

---

## Final Verification Results

| Check | Command | Result |
| :--- | :--- | :--- |
| PII paths in docs | `grep -ri "[local-user-path]" docs/ README.md` | ✅ Empty |
| Anon key in source | `grep -rn "PUBLISHABLE_KEY" src/` | ✅ Empty |
| TypeScript strict | `npx tsc --noEmit` | ✅ 0 errors |
| Policy Decision Accuracy | `npm run test:eval` | ✅ 20/20 (100.0%) |
| Primary Safety Metric | `npm run test:eval` | ✅ 12/12 (100.0%) |
| Policy unit tests | `npm run test:policy` | ✅ 15/15 |
| Phase 4 reliability | `npm run test:phase4` | ✅ 5/5 |
| Phase 6 adversarial | `npm run test:phase6` | ✅ 12/12 |
| Demo rehearsal | `npm run demo:rehearse` | ✅ 4/4, determinism verified |
| Idempotency | `npm run test:idempotency` | ✅ PASS |

---

## Files Changed

| File | Task | Type |
| :--- | :--- | :--- |
| `docs/judge-qa-prep.md` | 1 | Modified — removed 7 absolute paths |
| `docs/phase6-adversarial-defenses.md` | 1 | Modified — removed 5 absolute paths |
| `src/utils/supabase/client.ts` | 2 | **Deleted** — dead code, no imports |
| `utils/supabase/client.ts` | 2 | **Deleted** — stale re-export of deleted file |
| `src/utils/supabase/server.ts` | 2 | Modified — switched to SUPABASE_SERVICE_ROLE_KEY |
| `src/utils/supabase/middleware.ts` | 2 | Modified — switched to SUPABASE_SERVICE_ROLE_KEY |
| `tests/integration/dual-payment-idempotency.test.ts` | 3 | **Created** — dual-path idempotency test |
| `package.json` | 3 | Modified — added `test:idempotency` script |
| `src/lib/ai.ts` | 4 | No net change — reverted after API confirmation |
| `.env.example` | 7 | Modified — clean placeholders only |
| `README.md` | 2/3/5/7 | Modified — env vars, webhook events, dual-flow, guardrail note, security section |
| `docs/final-fix-report.md` | Final | **Created** — this document |

---

## Items Left As-Is (With Reason)

| Item | Reason |
| :--- | :--- |
| RLS not enabled on Supabase tables | Anon key removed entirely — RLS is only needed when an unprivileged credential exists. Service-role key is server-only. |
| EVAL-04 / EVAL-10 intent misclassification | Policy decision is correct in both cases. Task 6 is non-blocking per Phase 8 priority. No prompt change attempted. |
| Retry / exponential backoff not implemented | PRD 3.5 Non-Goal. Offline mock fallback handles Gemini failures safely. |
| No auth / RBAC | PRD 3.5 Non-Goal. Deferred to v1.2. |
