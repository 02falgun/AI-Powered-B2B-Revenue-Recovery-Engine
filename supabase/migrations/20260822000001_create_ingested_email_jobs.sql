-- ============================================================================
-- Phase P4 Migration: Ingested Email Jobs & Queue Table (Additive Only)
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

-- Indices for rapid queue polling and invoice lookups
CREATE INDEX IF NOT EXISTS idx_ingested_email_jobs_status ON public.ingested_email_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ingested_email_jobs_invoice_id ON public.ingested_email_jobs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_ingested_email_jobs_created_at ON public.ingested_email_jobs(created_at DESC);

-- Enable RLS
ALTER TABLE public.ingested_email_jobs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users and service role full access to queue jobs
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
