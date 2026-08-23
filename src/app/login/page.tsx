'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from '@/components/Logo';
import { createClient } from '@/lib/supabase/client';
import type { UserRole } from '@/lib/types';

function AuthSplitView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '/';
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login';

  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('operator');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
      const demoRole = email.startsWith('admin') ? 'admin' : 'operator';
      await handleInstantDemoLogin(demoRole);
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

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const supabase = createClient();
      const { data, error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role,
          },
        },
      });

      if (signupError) {
        setError(signupError.message || 'Failed to create user account.');
        setLoading(false);
        return;
      }

      // Explicitly persist role to user_profiles table via server endpoint
      if (data.user?.id) {
        await fetch('/api/auth/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: data.user.id,
            role,
            email,
          }),
        }).catch(() => {});
      }

      if (data.session) {
        router.push(redirectPath);
        router.refresh();
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (!signInError) {
          router.push(redirectPath);
          router.refresh();
        } else {
          setSuccessMessage('Registration successful! Please sign in with your credentials.');
          setMode('login');
          setLoading(false);
        }
      }
    } catch {
      setError('Network failure during registration.');
      setLoading(false);
    }
  }

  async function handleInstantDemoLogin(demoRole: 'admin' | 'operator') {
    setLoading(true);
    setError(null);
    setEmail(demoRole === 'admin' ? 'admin@acmecorp.com' : 'operator@acmecorp.com');
    setPassword('RecoverAI2026!');

    try {
      const res = await fetch('/api/auth/demo-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: demoRole }),
      });

      const data = await res.json();
      if (data.success) {
        const supabase = createClient();
        await supabase.auth
          .signInWithPassword({
            email: demoRole === 'admin' ? 'admin@acmecorp.com' : 'operator@acmecorp.com',
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
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-12 bg-[#0D0D0E] text-[#FAFAFA] font-sans">
      {/* ── Left Half: Full-Height Information & Platform Narrative ── */}
      <div className="lg:col-span-6 xl:col-span-7 flex flex-col justify-between p-8 sm:p-12 lg:p-16 xl:p-20 bg-[#121214] border-b lg:border-b-0 lg:border-r border-[#26262B] relative overflow-hidden">
        {/* Ambient chassis texture glow */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.03),transparent_60%)] pointer-events-none" />

        {/* Top Header */}
        <div className="relative z-10 space-y-8">
          <div className="flex items-center justify-between">
            <Logo scale={1.2} />
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-[#18181B] border border-[#27272A] text-[11px] font-mono text-[#A1A1AA]">
              <span className="w-2 h-2 rounded-full bg-[#FAFAFA] animate-pulse" />
              <span>TEST MODE SANDBOX</span>
            </div>
          </div>

          {/* Positioning & Core Narrative */}
          <div className="space-y-4 pt-4">
            <span className="text-xs font-mono uppercase tracking-widest text-[#71717A] font-bold block">
              AUTONOMOUS AR REVENUE RECOVERY ENGINE
            </span>
            <h1 className="text-2xl sm:text-3xl xl:text-4xl font-black font-display text-[#FAFAFA] tracking-tight leading-tight">
              AI interprets buyer intent. <br />
              Deterministic policy protects the ledger.
            </h1>
            <p className="text-sm text-[#A1A1AA] leading-relaxed max-w-2xl pt-2">
              RecoverAI monitors overdue accounts receivable by ingesting buyer communication emails, parsing payment promises and dispute intents with AI, and executing strict policy interlocks. If safe, it issues instantaneous Razorpay payment links; otherwise, it fail-closes safely to human review.
            </p>
          </div>

          {/* 3-Step Execution Pipeline */}
          <div className="space-y-3 pt-6">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#71717A] font-bold block">
              EXECUTION PIPELINE
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="panel-recessed p-4 rounded-lg space-y-1">
                <span className="text-xs font-mono font-bold text-[#FAFAFA] block">01. INGEST & EXTRACT</span>
                <p className="text-[11px] text-[#A1A1AA] leading-snug">
                  Zero-hallucination structured schema extracts payable sums and dispute flags.
                </p>
              </div>
              <div className="panel-recessed p-4 rounded-lg space-y-1">
                <span className="text-xs font-mono font-bold text-[#FAFAFA] block">02. 8 INTERLOCKS (A–H)</span>
                <p className="text-[11px] text-[#A1A1AA] leading-snug">
                  Pure paise deterministic policy engine evaluates authoritative caps and validity.
                </p>
              </div>
              <div className="panel-recessed p-4 rounded-lg space-y-1">
                <span className="text-xs font-mono font-bold text-[#FAFAFA] block">03. SETTLE OR ESCALATE</span>
                <p className="text-[11px] text-[#A1A1AA] leading-snug">
                  AUTO_RECOVER issues instant payment links; risky claims route to HUMAN_REVIEW.
                </p>
              </div>
            </div>
          </div>

          {/* System Integrity Metric Deck */}
          <div className="space-y-3 pt-6 border-t border-[#26262B]">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#71717A] font-bold block">
              BENCHMARK SAFETY GUARANTEES
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="panel-recessed p-3.5 rounded space-y-1">
                <span className="text-[10px] font-mono text-[#71717A] block font-bold uppercase">INTERLOCKS</span>
                <span className="font-mono font-black text-sm text-[#FAFAFA] block">8 Breakers</span>
                <span className="text-[10px] text-[#A1A1AA] font-mono block">Sole Authority</span>
              </div>
              <div className="panel-recessed p-3.5 rounded space-y-1">
                <span className="text-[10px] font-mono text-[#71717A] block font-bold uppercase">SAFETY RATE</span>
                <span className="font-mono font-black text-sm text-[#FAFAFA] block">100.0%</span>
                <span className="text-[10px] text-[#A1A1AA] font-mono block">12/12 High-Risk Blocked</span>
              </div>
              <div className="panel-recessed p-3.5 rounded space-y-1">
                <span className="text-[10px] font-mono text-[#71717A] block font-bold uppercase">DETERMINISM</span>
                <span className="font-mono font-black text-sm text-[#FAFAFA] block">Byte-Identical</span>
                <span className="text-[10px] text-[#A1A1AA] font-mono block">Zero Float Drift</span>
              </div>
              <div className="panel-recessed p-3.5 rounded space-y-1">
                <span className="text-[10px] font-mono text-[#71717A] block font-bold uppercase">SANDBOX</span>
                <span className="font-mono font-black text-sm text-[#FAFAFA] block">Test Mode</span>
                <span className="text-[10px] text-[#A1A1AA] font-mono block">No Real Funds Charged</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Hardware Annunciator Echo */}
        <div className="relative z-10 pt-8 mt-8 border-t border-[#26262B] flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-[#71717A]">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FAFAFA]" />
            <span className="text-[#A1A1AA]">CHASSIS: INDUSTRIAL RACK-08</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded bg-[#18181B] border border-[#27272A] text-[#FAFAFA] font-bold">[A: CAP ✓]</span>
            <span className="px-2 py-0.5 rounded bg-[#18181B] border border-[#27272A] text-[#FAFAFA] font-bold">[C: DISPUTE ✓]</span>
            <span className="px-2 py-0.5 rounded bg-[#18181B] border border-[#27272A] text-[#FAFAFA] font-bold">[D: CONF ≥70% ✓]</span>
            <span className="px-2 py-0.5 rounded bg-[#18181B] border border-[#27272A] text-[#FAFAFA] font-bold">[F: SOLE AUTH ✓]</span>
          </div>
        </div>
      </div>

      {/* ── Right Half: Full-Height Authentication Gateway ── */}
      <div className="lg:col-span-6 xl:col-span-5 flex flex-col justify-center p-8 sm:p-12 lg:p-16 xl:p-20 bg-[#0D0D0E] relative">
        <div className="max-w-md w-full mx-auto space-y-8">
          {/* Mode Switcher Tabs */}
          <div className="flex border-b border-[#26262B]">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-colors ${
                mode === 'login'
                  ? 'border-[#FAFAFA] text-[#FAFAFA]'
                  : 'border-transparent text-[#71717A] hover:text-[#A1A1AA]'
              }`}
            >
              Sign In to Console
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
                setSuccessMessage(null);
              }}
              className={`flex-1 pb-3 text-sm font-bold border-b-2 transition-colors ${
                mode === 'signup'
                  ? 'border-[#FAFAFA] text-[#FAFAFA]'
                  : 'border-transparent text-[#71717A] hover:text-[#A1A1AA]'
              }`}
            >
              Register New Tenant
            </button>
          </div>

          {/* Form Header */}
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#71717A] font-bold block">
              {mode === 'login' ? 'CONTROL CENTER AUTHORIZATION' : 'TENANT ENROLLMENT'}
            </span>
            <h2 className="text-xl font-black text-[#FAFAFA] font-display mt-1">
              {mode === 'login' ? 'Operator Access Gate' : 'Create Organization Workspace'}
            </h2>
            <p className="text-xs text-[#A1A1AA] mt-1 leading-relaxed">
              {mode === 'login'
                ? 'Enter authorized finance credentials to manage Accounts Receivable ledgers.'
                : 'Enroll a new tenant workspace partition in the multi-company recovery network.'}
            </p>
          </div>

          {/* Notifications */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="p-3.5 rounded bg-[#18181B] border-2 border-[#71717A] text-xs font-mono text-[#FAFAFA]"
                role="alert"
              >
                ▲ {error}
              </motion.div>
            )}
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="p-3.5 rounded bg-[#FAFAFA] text-[#0D0D0E] font-bold text-xs font-mono border border-[#FFFFFF]"
                role="status"
              >
                ✓ {successMessage}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Authentication Form */}
          <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#71717A] font-bold block">
                {mode === 'login' ? 'OPERATOR EMAIL IDENTIFIER' : 'ORGANIZATION EMAIL'}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={mode === 'login' ? 'operator@company.com' : 'finance@yourorg.com'}
                className="w-full panel-recessed rounded-lg p-3.5 text-sm font-mono text-[#FAFAFA] placeholder:text-[#52525B] focus:border-[#FAFAFA] focus:outline-none transition-colors"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#71717A] font-bold block">
                SECURITY PASSPHRASE
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full panel-recessed rounded-lg p-3.5 text-sm font-mono text-[#FAFAFA] placeholder:text-[#52525B] focus:border-[#FAFAFA] focus:outline-none transition-colors"
              />
            </div>

            {mode === 'signup' && (
              <div className="space-y-2">
                <label className="text-[10px] font-mono uppercase tracking-wider text-[#71717A] font-bold block">
                  ASSIGNED OPERATOR ROLE
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('operator')}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      role === 'operator'
                        ? 'border-[#FAFAFA] bg-[#18181B] text-[#FAFAFA]'
                        : 'border-[#26262B] bg-[#121214] text-[#71717A]'
                    }`}
                  >
                    <span className="text-xs font-bold block">Operator</span>
                    <span className="text-[10px] text-[#A1A1AA] block mt-0.5">Standard Processing</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('admin')}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      role === 'admin'
                        ? 'border-[#FAFAFA] bg-[#18181B] text-[#FAFAFA]'
                        : 'border-[#26262B] bg-[#121214] text-[#71717A]'
                    }`}
                  >
                    <span className="text-xs font-bold block">Administrator</span>
                    <span className="text-[10px] text-[#A1A1AA] block mt-0.5">Full Override Rights</span>
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-mechanical-primary w-full py-3.5 px-4 rounded-lg text-sm flex items-center justify-center gap-2 mt-4 disabled:opacity-40"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  <span>Authorizing Request...</span>
                </>
              ) : (
                <span>{mode === 'login' ? 'Authorize & Open Console' : 'Create Organization Account →'}</span>
              )}
            </button>
          </form>

          {/* Instant 1-Click Demo Logins (Active in Login Mode) */}
          {mode === 'login' && (
            <div className="pt-6 border-t border-[#26262B] space-y-3">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#71717A] font-bold block text-center">
                INSTANT DEMO AUTHENTICATION
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleInstantDemoLogin('admin')}
                  className="btn-mechanical-secondary p-3.5 rounded-lg text-left text-xs disabled:opacity-40 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#FAFAFA]">Admin Role</span>
                    <span className="text-[10px] text-[#71717A] group-hover:text-[#FAFAFA] font-mono">→</span>
                  </div>
                  <div className="text-[10px] text-[#71717A] font-mono mt-1">admin@acmecorp.com</div>
                  <div className="text-[10px] text-[#A1A1AA] mt-1 font-mono">Full Override Privileges</div>
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleInstantDemoLogin('operator')}
                  className="btn-mechanical-secondary p-3.5 rounded-lg text-left text-xs disabled:opacity-40 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#FAFAFA]">Operator Role</span>
                    <span className="text-[10px] text-[#71717A] group-hover:text-[#FAFAFA] font-mono">→</span>
                  </div>
                  <div className="text-[10px] text-[#71717A] font-mono mt-1">operator@acmecorp.com</div>
                  <div className="text-[10px] text-[#A1A1AA] mt-1 font-mono">Standard Processing</div>
                </button>
              </div>
            </div>
          )}

          {/* Footer Quick Switch */}
          <div className="text-center pt-2">
            <p className="text-xs text-[#71717A]">
              {mode === 'login' ? (
                <>
                  Need a new organization?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup');
                      setError(null);
                    }}
                    className="text-[#FAFAFA] font-bold hover:underline"
                  >
                    Register Tenant Account →
                  </button>
                </>
              ) : (
                <>
                  Already registered?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                    }}
                    className="text-[#FAFAFA] font-bold hover:underline"
                  >
                    Sign In to Existing Account →
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0D0D0E]" />}>
      <AuthSplitView />
    </Suspense>
  );
}
