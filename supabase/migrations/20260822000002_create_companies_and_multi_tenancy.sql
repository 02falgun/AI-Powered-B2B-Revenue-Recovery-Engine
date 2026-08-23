-- ============================================================================
-- Phase P5 Migration: Multi-Company / Multi-Tenant Data Model (Additive Only)
-- ============================================================================

-- 1. Create Companies Table
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert Default Company (Preserving existing single-tenant data under this organization)
INSERT INTO public.companies (id, name, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Acme Global Services',
  now(),
  now()
)
ON CONFLICT (id) DO NOTHING;

-- 2. Add company_id to existing tables (Additive with default value)
ALTER TABLE public.invoices 
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) DEFAULT '00000000-0000-0000-0000-000000000001';

ALTER TABLE public.audit_logs 
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) DEFAULT '00000000-0000-0000-0000-000000000001';

ALTER TABLE public.user_profiles 
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) DEFAULT '00000000-0000-0000-0000-000000000001';

ALTER TABLE public.ingested_email_jobs 
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) DEFAULT '00000000-0000-0000-0000-000000000001';

-- 3. Backfill all existing rows to default company if NULL
UPDATE public.invoices SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.audit_logs SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.user_profiles SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
UPDATE public.ingested_email_jobs SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;

-- 4. Compound Indices for High Performance Multi-Tenant Querying & Pagination
CREATE INDEX IF NOT EXISTS idx_invoices_company_status ON public.invoices(company_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_company_created_at ON public.invoices(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_created_at ON public.audit_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_profiles_company ON public.user_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_ingested_email_jobs_company_status ON public.ingested_email_jobs(company_id, status);

-- 5. Multi-Tenant Row Level Security (RLS)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to read their own company"
  ON public.companies
  FOR SELECT
  TO authenticated, service_role
  USING (
    id IN (
      SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
    ) OR auth.jwt() ->> 'role' = 'service_role'
  );

-- Update RLS policies for invoices to enforce tenant boundary
DROP POLICY IF EXISTS "Allow authenticated read on invoices" ON public.invoices;
CREATE POLICY "Allow company users to read invoices"
  ON public.invoices
  FOR SELECT
  TO authenticated, service_role
  USING (
    company_id IN (
      SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
    ) OR auth.jwt() ->> 'role' = 'service_role'
  );

DROP POLICY IF EXISTS "Allow authenticated update on invoices" ON public.invoices;
CREATE POLICY "Allow company users to update invoices"
  ON public.invoices
  FOR UPDATE
  TO authenticated, service_role
  USING (
    company_id IN (
      SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
    ) OR auth.jwt() ->> 'role' = 'service_role'
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.user_profiles WHERE id = auth.uid()
    ) OR auth.jwt() ->> 'role' = 'service_role'
  );
