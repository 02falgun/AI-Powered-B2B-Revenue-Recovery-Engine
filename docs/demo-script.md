# RecoverAI — 3-Minute Live Demo Script

**Version**: v1.0.0-frozen | **Track**: AI × Payments  
**Target**: RecoverAI live walkthrough for technical judges

---

## Pre-Demo Checklist (5 min before)

- [ ] `npm run dev` is running at `http://localhost:3000`
- [ ] `.env.local` has valid `RAZORPAY_KEY_ID`, `GEMINI_API_KEY`
- [ ] Browser open to `http://localhost:3000` — AR Dashboard visible
- [ ] Test card ready: `4100 2800 0000 1007` · CVV: `123` · Expiry: `12/26`
- [ ] Test UPI ready: `test@razorpay`
- [ ] 4 demo email messages copied to clipboard (see below)

---

## Demo Flow (Total: 3:00)

---

### SEGMENT 1 — Problem (0:00 → 0:30) | 30 seconds

**SAY:**
> "Manual accounts receivable is a $3.5 trillion unsolved problem in B2B. When a buyer emails saying 'we can pay 50% today' — your AR team has to read it, extract the intent, check it against policy, and manually send a payment link. RecoverAI automates this entire loop using Gemini-powered intent extraction and a deterministic safety policy engine."

**DO:**
- Point to the dashboard showing 5 overdue invoices with total outstanding debt counter

---

### SEGMENT 2 — Happy Path: AI Auto-Recovery (0:30 → 1:30) | 60 seconds

**SAY:**
> "Let me show the happy path first. Acme Corporation owes ₹15,000 on invoice INV-2026-001."

**DO:**
1. Click invoice **INV-2026-001 — Acme Corporation** (₹15,000 outstanding)
2. Paste this email into the simulator:

```
Hi Accounts Team,

We received your reminder for INV-2026-001. Our Finance team has approved 
the full payment of Rs 15,000 to be transferred on August 25th, 2026.

Regards,
Acme Finance
```

3. Click **Analyze Email** button

**SAY:**
> "Gemini extracts the intent as `full_payment` with 95% confidence, promised ₹15,000 on August 25th. Now our deterministic policy engine — which is the ONLY code authorized to issue an auto-recovery — checks all 8 guardrails."

4. Point to the **Policy Decision** badge — `AUTO_RECOVER` in green

**SAY:**
> "Guardrails A through H all passed. The system issues a Razorpay payment link automatically. No human needed."

5. Click **Pay ₹15,000** → Razorpay modal opens → pay with test card `4100 2800 0000 1007`

---

### SEGMENT 3 — Safety: Overpayment Rejected (1:30 → 2:10) | 40 seconds

**SAY:**
> "Now let me break it. What if a buyer tries to overpay?"

**DO:**
1. Stay on INV-2026-001 (₹15,000 outstanding)
2. Paste this email:

```
Hi Team,

We will transfer 1,000,000 INR for invoice INV-2026-001 immediately. 
Please issue the payment link for 1,000,000 INR.

Regards,
Acme Finance
```

3. Click **Analyze Email**

**SAY:**
> "The AI correctly classifies this as `full_payment` at ₹10,00,000. But Guardrail A rejects it immediately — it compares the proposed amount in integer paise against the outstanding balance. 1,00,00,000 paise exceeds 15,00,000 paise. The system refuses to issue any payment link."

4. Point to **`HUMAN_REVIEW`** badge in amber and Guardrail A highlighted as triggered

---

### SEGMENT 4 — Safety: Dispute Blocked (2:10 → 2:40) | 30 seconds

**SAY:**
> "What about billing disputes?"

**DO:**
1. Paste this email:

```
We are disputing invoice INV-2026-001. The rate quoted was ₹10,000 
but you billed us ₹15,000. We will NOT pay until corrected.
```

2. Click **Analyze Email**

**SAY:**
> "Guardrail C is the first guardrail to run — it fires unconditionally on any dispute signal before even checking the amount. The system immediately routes to human review. There is no code path that could issue a payment link on a disputed invoice."

3. Point to `HUMAN_REVIEW` and Guardrail C highlighted

---

### SEGMENT 5 — Close the Loop + Metrics (2:40 → 3:00) | 20 seconds

**SAY:**
> "We ran the full system against 20 hand-labeled synthetic B2B emails across 5 categories. Primary Safety Metric — defined as unsafe cases correctly routed to human review — was **100%**. 12 of 12 high-risk cases blocked with zero unsafe auto-recoveries. Policy engine is provably deterministic: running the benchmark twice produces byte-identical decisions."

**DO:**
- Briefly show `docs/evaluation-report.md` or the console output from `npm run test:eval`

---

## Live Demo Email Messages (Copy-Paste Ready)

### Demo Email 1 — Full Payment (Happy Path)
```
Hi Accounts Team,

We received your reminder for INV-2026-001. Our Finance team has approved 
the full payment of Rs 15,000 to be transferred on August 25th, 2026.

Regards,
Acme Finance
```

### Demo Email 2 — Overpayment Attack
```
Hi Team,

We will transfer 1,000,000 INR for invoice INV-2026-001 immediately. 
Please issue the payment link for 1,000,000 INR.

Regards,
Acme Finance
```

### Demo Email 3 — Billing Dispute
```
We are disputing invoice INV-2026-001. The rate quoted was ₹10,000 
but you billed us ₹15,000. We will NOT pay until corrected.
```

### Demo Email 4 — Partial Payment (50%)
```
Hello, regarding invoice INV-2026-003, we can clear 50% of the balance today. 
Please send us the payment link for half the amount and we will process it immediately.
```

---

## Emergency Fallback Plan

If Gemini API is rate-limited during the live demo, the offline mock extractor in `src/lib/ai.ts` kicks in automatically — the system continues to function using the rule-based fallback and the identical policy engine. The demo flow is unaffected.
