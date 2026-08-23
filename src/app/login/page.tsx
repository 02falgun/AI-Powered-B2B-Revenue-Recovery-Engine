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

  function handleDemoFill(demoEmail: string) {
    setEmail(demoEmail);
    setPassword('RecoverAI2026!');
    setError(null);
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

          {/* Preset Demo Access Buttons */}
          <div className="pt-4 border-t border-[#26262B] space-y-3">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#71717A] font-bold block text-center">
              DEMO CREDENTIAL INJECTION
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleDemoFill('admin@acmecorp.com')}
                className="btn-mechanical-secondary p-2.5 rounded text-left text-xs"
              >
                <div className="font-bold text-[#FAFAFA]">Admin Role</div>
                <div className="text-[10px] text-[#71717A] font-mono">admin@acmecorp.com</div>
              </button>
              <button
                type="button"
                onClick={() => handleDemoFill('operator@acmecorp.com')}
                className="btn-mechanical-secondary p-2.5 rounded text-left text-xs"
              >
                <div className="font-bold text-[#FAFAFA]">Operator Role</div>
                <div className="text-[10px] text-[#71717A] font-mono">operator@acmecorp.com</div>
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
