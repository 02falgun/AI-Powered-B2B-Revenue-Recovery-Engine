-- RecoverAI Seed Script
-- 5 Realistic Overdue Invoices with Varied Amounts in Paise (1 INR = 100 Paise)

INSERT INTO public.invoices (
    invoice_number,
    customer_name,
    customer_email,
    total_amount_paise,
    outstanding_amount_paise,
    currency,
    status,
    due_date
) VALUES
(
    'INV-2026-001',
    'Acme Corporation',
    'finance@acmecorp.com',
    1500000, -- ₹15,000.00
    1500000, -- ₹15,000.00
    'INR',
    'overdue',
    NOW() - INTERVAL '20 days'
),
(
    'INV-2026-002',
    'TechFlow Solutions',
    'billing@techflow.io',
    4550050, -- ₹45,500.50
    4550050, -- ₹45,500.50
    'INR',
    'overdue',
    NOW() - INTERVAL '15 days'
),
(
    'INV-2026-003',
    'Global Logistics Ltd',
    'ap@globallogistics.com',
    12000000, -- ₹1,20,000.00
    6000000,  -- ₹60,000.00 (Partially paid remaining)
    'INR',
    'overdue',
    NOW() - INTERVAL '30 days'
),
(
    'INV-2026-004',
    'Vertex Digital',
    'accounts@vertexdigital.in',
    875000,  -- ₹8,750.00
    875000,  -- ₹8,750.00
    'INR',
    'overdue',
    NOW() - INTERVAL '10 days'
),
(
    'INV-2026-005',
    'Nexus Enterprise Systems',
    'payments@nexusenterprise.com',
    35000000, -- ₹3,50,000.00
    35000000, -- ₹3,50,000.00
    'INR',
    'overdue',
    NOW() - INTERVAL '35 days'
)
ON CONFLICT (invoice_number) DO NOTHING;
