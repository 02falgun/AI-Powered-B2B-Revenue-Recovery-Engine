import { createBrowserClient } from '@supabase/ssr';

/**
 * Creates a browser-side Supabase client for client components.
 * Uses public environment variables only (NEXT_PUBLIC_SUPABASE_URL and publishable/anon key).
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createBrowserClient(supabaseUrl, supabaseKey);
}
