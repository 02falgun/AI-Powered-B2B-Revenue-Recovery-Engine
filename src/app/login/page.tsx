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
        setError(authError.message || 'Invalid email or password.');
        setLoading(false);
        return;
      }

      router.push(redirectPath);
      router.refresh();
    } catch {
      setError('A network error occurred while connecting to auth service.');
      setLoading(false);
    }
  }

  function handleDemoFill(demoEmail: string) {
    setEmail(demoEmail);
    setPassword('RecoverAI2026!');
    setError(null);
  }

  return (
    <div
      className="min-h-screen flex flex-col justify-center items-center px-4 sm:px-6 py-12 text-slate-50 font-sans relative overflow-hidden"
      style={{ background: '#060E1F' }}
    >
      {/* Background Decorative Glow */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] pointer-events-none rounded-full opacity-20 blur-[120px]"
        style={{ background: 'radial-gradient(circle, #3395FF 0%, transparent 70%)' }}
        aria-hidden="true"
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-md space-y-8 relative z-10"
      >
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center space-y-3">
          <Logo scale={1.2} />
          <div className="space-y-1">
            <h1 className="text-xl font-bold font-display text-white tracking-tight">
              Sign in to RecoverAI
            </h1>
            <p className="text-xs text-[#7EC8E360]">
              Autonomous B2B Accounts Receivable Revenue Recovery
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div
          className="rounded-2xl border border-[#1A2F55] p-7 shadow-floating backdrop-blur-xl"
          style={{ background: 'linear-gradient(145deg, #0C1A35 0%, #0A162B 100%)' }}
        >
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Error Banner */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3.5 rounded-xl border border-[#F04E3740] text-[#F04E37] text-xs space-y-1"
                  style={{ background: '#F04E3710' }}
                  role="alert"
                >
                  <p className="font-semibold font-display">Authentication Failed</p>
                  <p className="opacity-90">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-xs font-semibold font-display text-[#C4D4EC]"
              >
                Work Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-3.5 py-2.5 rounded-xl text-sm font-mono text-white placeholder-[#7EC8E330] border border-[#1A2F55] bg-[#060E1F]/80 focus:border-[#3395FF] focus:ring-1 focus:ring-[#3395FF] transition-colors outline-none"
              />
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold font-display text-[#C4D4EC]"
                >
                  Password
                </label>
              </div>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl text-sm font-mono text-white placeholder-[#7EC8E330] border border-[#1A2F55] bg-[#060E1F]/80 focus:border-[#3395FF] focus:ring-1 focus:ring-[#3395FF] transition-colors outline-none"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl text-white font-bold text-sm font-display transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3395FF] motion-safe:hover:-translate-y-px"
              style={{
                background: loading ? '#0D5FBF' : '#3395FF',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15), 0 4px 16px rgba(51,149,255,0.3)',
              }}
            >
              {loading ? (
                <>
                  <span
                    className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white"
                    style={{ animation: 'spin-smooth 0.8s linear infinite' }}
                    aria-hidden="true"
                  />
                  <span>Signing In…</span>
                </>
              ) : (
                <span>Sign In to Dashboard</span>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Fill */}
          <div className="mt-6 pt-5 border-t border-[#1A2F5540] space-y-2.5">
            <p className="text-[11px] font-mono text-[#7EC8E360] uppercase tracking-wider text-center">
              Quick Test Credentials
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleDemoFill('admin@recoverai.local')}
                className="px-3 py-2 rounded-xl text-xs font-mono border border-[#3395FF40] text-[#3395FF] hover:bg-[#3395FF15] transition-colors flex items-center justify-center gap-1.5"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#3395FF]" />
                Admin Demo
              </button>
              <button
                type="button"
                onClick={() => handleDemoFill('operator@recoverai.local')}
                className="px-3 py-2 rounded-xl text-xs font-mono border border-[#7EC8E340] text-[#7EC8E3] hover:bg-[#7EC8E315] transition-colors flex items-center justify-center gap-1.5"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#7EC8E3]" />
                Operator Demo
              </button>
            </div>
          </div>
        </div>

        {/* Link to Signup */}
        <p className="text-center text-xs text-[#7EC8E360]">
          Don&apos;t have an account?{' '}
          <Link
            href="/signup"
            className="text-[#3395FF] hover:text-[#7EC8E3] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3395FF] rounded"
          >
            Create an Account →
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center font-mono text-xs text-[#7EC8E3]"
          style={{ background: '#060E1F' }}
        >
          Loading RecoverAI Sign In…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
