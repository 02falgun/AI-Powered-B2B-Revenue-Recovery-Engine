import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * Next.js Middleware Session Manager.
 * Refreshes auth tokens stored in cookies and enforces authentication on protected routes.
 *
 * Exemption rules:
 * - Public UI pages: /login, /signup, /auth/*
 * - Static assets: _next, favicon.ico, images, fonts
 * - Webhook route: /api/webhook/razorpay (MUST remain reachable without session; verified by HMAC signature)
 */
function loadEnvLocalIfMissing(): void {
  try {
    if (typeof process !== 'undefined' && process.env) {
      const fs = require('fs');
      const path = require('path');
      const envPath = path.resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8') as string;
        for (const line of envContent.split('\n')) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const [key, ...valParts] = trimmed.split('=');
            const k = key.trim();
            const v = valParts.join('=').trim();
            if (k && v && !process.env[k]) {
              process.env[k] = v;
            }
          }
        }
      }
    }
  } catch {}
}

export async function updateSession(request: NextRequest) {
  loadEnvLocalIfMissing();

  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const pathname = request.nextUrl.pathname;

  // 1. Explicit Whitelist: Razorpay Webhook is protected strictly by HMAC SHA256 signature, NOT session
  if (pathname === '/api/webhook/razorpay' || pathname.startsWith('/api/webhook/')) {
    return supabaseResponse;
  }

  // 2. Public UI routes & auth callback routes
  if (
    pathname === '/login' ||
    pathname === '/signup' ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/api/auth/')
  ) {
    // If user is already authenticated and visits login/signup, redirect to dashboard
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user && (pathname === '/login' || pathname === '/signup')) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  }

  // 3. Authenticate User for all protected routes (dashboard, invoices, protected API)
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!user || error) {
    // For API routes, return 401 JSON
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'unauthorized_error',
            message: 'Unauthorized: Authentication session required.',
          },
        },
        { status: 401 },
      );
    }

    // For web pages (/invoices/*, /app/*, /), redirect to /login
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
