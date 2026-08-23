'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from '@/components/Logo';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setError(null);

    // If attempting demo accounts, route via demo provisioning endpoint to ensure user exists
    if (email === 'admin@acmecorp.com' || email === 'operator@acmecorp.com') {
      const role = email.startsWith('admin') ? 'admin' : 'operator';
      await handleInstantDemoLogin(role);
      return;
    }

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message || 'Invalid operator credentials.');
        setLoading(false);
        return;
      }

      router.push(redirectPath);
      router.refresh();
    } catch {
      setError('Network connection failure to authentication gateway.');
      setLoading(false);
    }
  }

  async function handleInstantDemoLogin(role: 'admin' | 'operator') {
    setLoading(true);
    setError(null);
    setEmail(role === 'admin' ? 'admin@acmecorp.com' : 'operator@acmecorp.com');
    setPassword('RecoverAI2026!');

    try {
      const res = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });

      const data = await res.json();
      if (data.success) {
        // Hydrate client-side Supabase auth state
        const supabase = createClient();
        await supabase.auth
          .signInWithPassword({
            email: role === 'admin' ? 'admin@acmecorp.com' : 'operator@acmecorp.com',
            password: 'RecoverAI2026!',
          })
          .catch(() => {});

        router.push(redirectPath);
        router.refresh();
      } else {
        setError(data.error?.message || 'Failed to initialize demo account.');
        setLoading(false);
      }
    } catch {
      setError('Network failure connecting to demo authorization.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-40px)] flex items-center justify-center p-4 sm:p-6 lg:p-12 text-[#FAFAFA] font-sans bg-[#0D0D0E] texture-chassis">
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
        {/* ── Left Half: Information & System Context Panel ── */}
        <div className="lg:col-span-6 flex flex-col justify-between space-y-8 panel-raised p-6 sm:p-8 rounded-xl border border-[#26262B]">
          {/* Logo & Product Positioning */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Logo scale={1.1} />
            </div>

            <div className="space-y-2 pt-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#71717A] font-bold block">
                AUTONOMOUS AR REVENUE RECOVERY
              </span>
              <h1 className="text-xl sm:text-2xl font-black font-display text-[#FAFAFA] tracking-tight leading-tight">
                AI interprets buyer intent. <br className="hidden sm:inline" />
                Deterministic policy protects the ledger.
              </h1>
            </div>

            <p className="text-xs text-[#A1A1AA] leading-relaxed">
              RecoverAI parses overdue accounts receivable email streams, extracting payment promises and
              dispute signals. Clean commitments within authorized boundaries automatically trigger Instant
              Settlement links, while ambiguous or high-risk cases fail-close safely to human review.
            </p>
          </div>

          {/* Real Trust & Safety Metrics (Source: Benchmark Evaluation Report) */}
          <div className="space-y-3 pt-4 border-t border-[#26262B]">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#71717A] font-bold block">
              SYSTEM INTEGRITY METRICS
            </span>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="panel-recessed p-3 rounded space-y-1">
                <span className="text-[10px] font-mono text-[#71717A] block font-bold uppercase">
                  POLICY INTERLOCKS
                </span>
                <span className="font-mono font-black text-sm text-[#FAFAFA] block">
                  8 Checks (A–H)
                </span>
                <span className="text-[10px] text-[#A1A1AA] font-mono block">
                  Sole Recovery Authority
                </span>
              </div>

              <div className="panel-recessed p-3 rounded space-y-1">
                <span className="text-[10px] font-mono text-[#71717A] block font-bold uppercase">
                  PRIMARY SAFETY
                </span>
                <span className="font-mono font-black text-sm text-[#FAFAFA] block">
                  100.0% Verified
                </span>
                <span className="text-[10px] text-[#A1A1AA] font-mono block">
                  Zero Unsafe Auto-Recovers
                </span>
              </div>

              <div className="panel-recessed p-3 rounded space-y-1">
                <span className="text-[10px] font-mono text-[#71717A] block font-bold uppercase">
                  DETERMINISM
                </span>
                <span className="font-mono font-black text-sm text-[#FAFAFA] block">
                  Byte-Identical
                </span>
                <span className="text-[10px] text-[#A1A1AA] font-mono block">
                  Integer Paise Arithmetic
                </span>
              </div>

              <div className="panel-recessed p-3 rounded space-y-1">
                <span className="text-[10px] font-mono text-[#71717A] block font-bold uppercase">
                  ENVIRONMENT
                </span>
                <span className="font-mono font-black text-sm text-[#FAFAFA] block">
                  Test Mode Sandbox
                </span>
                <span className="text-[10px] text-[#A1A1AA] font-mono block">
                  Non-Settling Simulation
                </span>
              </div>
            </div>
          </div>

          {/* Decorative Breaker Echo Mini-Rack */}
          <div className="pt-4 border-t border-[#26262B] flex items-center justify-between text-[10px] font-mono text-[#71717A]">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FAFAFA]" />
              <span className="font-bold text-[#A1A1AA]">CORE GUARDS:</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="px-1.5 py-0.5 rounded bg-[#18181B] border border-[#27272A] text-[#FAFAFA] font-bold">
                [A: CAP]
              </span>
              <span className="px-1.5 py-0.5 rounded bg-[#18181B] border border-[#27272A] text-[#FAFAFA] font-bold">
                [C: DISPUTE]
              </span>
              <span className="px-1.5 py-0.5 rounded bg-[#18181B] border border-[#27272A] text-[#FAFAFA] font-bold">
                [D: CONF ≥70%]
              </span>
              <span className="px-1.5 py-0.5 rounded bg-[#18181B] border border-[#27272A] text-[#FAFAFA] font-bold">
                [F: SOLE AUTH]
              </span>
            </div>
          </div>
        </div>

        {/* ── Right Half: Authentication Chassis ── */}
        <div className="lg:col-span-6 flex flex-col justify-center">
          <div className="panel-raised p-6 sm:p-8 rounded-xl space-y-6 border border-[#26262B]">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#71717A] font-bold block">
                CONSOLE ACCESS
              </span>
              <h2 className="text-lg font-black text-[#FAFAFA] font-display mt-0.5">
                Control Center Authorization
              </h2>
              <p className="text-xs text-[#A1A1AA] mt-1">
                Enter authorized finance credentials to access Accounts Receivable ledger.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="p-3 rounded bg-[#18181B] border-2 border-[#71717A] text-xs font-mono text-[#FAFAFA]"
                    role="alert"
                  >
                    ▲ {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-[#71717A] font-bold block">
                  OPERATOR EMAIL IDENTIFIER
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@company.com"
                  className="w-full panel-recessed rounded p-3 text-xs font-mono text-[#FAFAFA] placeholder:text-[#52525B] focus:border-[#FAFAFA] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono uppercase tracking-wider text-[#71717A] font-bold block">
                  SECURITY PASSPHRASE
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full panel-recessed rounded p-3 text-xs font-mono text-[#FAFAFA] placeholder:text-[#52525B] focus:border-[#FAFAFA] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-mechanical-primary w-full py-3 px-4 rounded text-xs flex items-center justify-center gap-2 mt-2 disabled:opacity-40"
              >
                {loading ? (
                  <>
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <span>Authorize & Open Console</span>
                )}
              </button>
            </form>

            {/* Instant 1-Click Demo Login Shortcuts */}
            <div className="pt-4 border-t border-[#26262B] space-y-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#71717A] font-bold block text-center">
                INSTANT DEMO AUTHENTICATION
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleInstantDemoLogin('admin')}
                  className="btn-mechanical-secondary p-3 rounded text-left text-xs disabled:opacity-40 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#FAFAFA]">Admin Role</span>
                    <span className="text-[10px] text-[#71717A] group-hover:text-[#FAFAFA] font-mono">→</span>
                  </div>
                  <div className="text-[10px] text-[#71717A] font-mono mt-0.5">admin@acmecorp.com</div>
                  <div className="text-[9px] text-[#A1A1AA] mt-1 font-mono">Full Override Privileges</div>
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleInstantDemoLogin('operator')}
                  className="btn-mechanical-secondary p-3 rounded text-left text-xs disabled:opacity-40 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#FAFAFA]">Operator Role</span>
                    <span className="text-[10px] text-[#71717A] group-hover:text-[#FAFAFA] font-mono">→</span>
                  </div>
                  <div className="text-[10px] text-[#71717A] font-mono mt-0.5">operator@acmecorp.com</div>
                  <div className="text-[9px] text-[#A1A1AA] mt-1 font-mono">Standard Processing</div>
                </button>
              </div>
            </div>

            <div className="text-center pt-2">
              <p className="text-xs text-[#71717A]">
                New organization?{' '}
                <Link href="/signup" className="text-[#FAFAFA] font-bold hover:underline">
                  Register Tenant Account →
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0D0D0E]" />}>
      <LoginForm />
    </Suspense>
  );
}
