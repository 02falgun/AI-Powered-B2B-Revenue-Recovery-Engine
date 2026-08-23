-- RecoverAI Supabase Database Schema
-- SRS Section 4.3 Database Specification

-- Enable uuid-ossp extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL UNIQUE,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    total_amount_paise BIGINT NOT NULL CHECK (total_amount_paise >= 0),
    outstanding_amount_paise BIGINT NOT NULL CHECK (outstanding_amount_paise >= 0),
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL CHECK (status IN ('overdue', 'paid', 'partially_paid', 'in_recovery', 'human_review')),
    due_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT check_outstanding_lte_total CHECK (outstanding_amount_paise <= total_amount_paise)
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    actor TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Processed Payments Table (Phase 4 Idempotency Guardrail)
CREATE TABLE IF NOT EXISTS public.processed_payments (
    payment_id TEXT PRIMARY KEY,
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    payment_link_id TEXT,
    amount_paid_paise BIGINT NOT NULL CHECK (amount_paid_paise >= 0),
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance & query optimization
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_email ON public.invoices(customer_email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_invoice_id ON public.audit_logs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_processed_payments_invoice_id ON public.processed_payments(invoice_id);

-- Trigger to automatically update updated_at timestamp on invoices
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_invoices_updated_at ON public.invoices;
CREATE TRIGGER set_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Phase P1: User Profiles & Role-Based Access Control (RBAC)
-- ============================================================================

-- User Profiles Table (References auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'operator')) DEFAULT 'operator',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS: Authenticated users can view their own profile
CREATE POLICY "Users can view own profile"
    ON public.user_profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

-- RLS: Authenticated users can update their own profile
CREATE POLICY "Users can update own profile"
    ON public.user_profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Trigger: Automatically create user_profile upon user signup in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_role TEXT;
BEGIN
    default_role := COALESCE(NEW.raw_user_meta_data->>'role', 'operator');
    IF default_role NOT IN ('admin', 'operator') THEN
        default_role := 'operator';
    END IF;

    INSERT INTO public.user_profiles (id, role, created_at)
    VALUES (NEW.id, default_role, NOW())
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- Phase P4: Ingested Email Jobs & Queue Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ingested_email_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id TEXT UNIQUE NOT NULL,
    sender TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    invoice_id UUID NULL REFERENCES public.invoices(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'unmatched')),
    error_message TEXT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    processed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ingested_email_jobs_status ON public.ingested_email_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ingested_email_jobs_invoice_id ON public.ingested_email_jobs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_ingested_email_jobs_created_at ON public.ingested_email_jobs(created_at DESC);

ALTER TABLE public.ingested_email_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read on ingested_email_jobs"
    ON public.ingested_email_jobs
    FOR SELECT
    TO authenticated, service_role
    USING (true);

CREATE POLICY "Allow authenticated write on ingested_email_jobs"
    ON public.ingested_email_jobs
    FOR ALL
    TO authenticated, service_role
    USING (true)
    WITH CHECK (true);

