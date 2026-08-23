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
        // Also perform client-side sign-in to ensure browser client state is hydrated
        const supabase = createClient();
        await supabase.auth.signInWithPassword({
          email: role === 'admin' ? 'admin@acmecorp.com' : 'operator@acmecorp.com',
          password: 'RecoverAI2026!',
        }).catch(() => {});

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
    <div className="min-h-screen flex flex-col justify-center items-center px-4 sm:px-6 py-12 text-[#FAFAFA] font-sans bg-[#0D0D0E] texture-chassis">
      {/* Console Identification */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-4 mb-6">
        <div className="flex justify-center">
          <Logo scale={1.2} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#FAFAFA] font-display">
            Control Center Authorization
          </h2>
          <p className="text-xs text-[#A1A1AA] mt-1">
            Enter authorized finance credentials to access Accounts Receivable ledger.
          </p>
        </div>
      </div>

      {/* Main Authentication Chassis */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="panel-raised p-8 rounded-xl space-y-6">
          <form onSubmit={handleLogin} className="space-y-4">
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

          {/* Instant 1-Click Demo Login Buttons */}
          <div className="pt-4 border-t border-[#26262B] space-y-3">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#71717A] font-bold block text-center">
              INSTANT DEMO AUTHENTICATION
            </span>
            <div className="grid grid-cols-2 gap-2">
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
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0D0D0E]" />}>
      <LoginForm />
    </Suspense>
  );
}
