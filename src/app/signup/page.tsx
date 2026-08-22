'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from '@/components/Logo';
import { createClient } from '@/lib/supabase/client';
import type { UserRole } from '@/lib/types';

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('operator');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

      if (data.session) {
        // Auto-logged in
        router.push('/');
        router.refresh();
      } else {
        // Check email confirmation or proceed to login
        setSuccessMessage('Account created successfully! Redirecting to sign in…');
        setTimeout(() => {
          router.push('/login');
        }, 1500);
      }
    } catch {
      setError('A network error occurred while connecting to auth service.');
      setLoading(false);
    }
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
              Create RecoverAI Account
            </h1>
            <p className="text-xs text-[#7EC8E360]">
              Register to access AR recovery queue & orchestration
            </p>
          </div>
        </div>

        {/* Signup Card */}
        <div
          className="rounded-2xl border border-[#1A2F55] p-7 shadow-floating backdrop-blur-xl"
          style={{ background: 'linear-gradient(145deg, #0C1A35 0%, #0A162B 100%)' }}
        >
          <form onSubmit={handleSignup} className="space-y-5">
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
                  <p className="font-semibold font-display">Registration Notice</p>
                  <p className="opacity-90">{error}</p>
                </motion.div>
              )}

              {successMessage && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3.5 rounded-xl border border-[#00C48C40] text-[#00C48C] text-xs space-y-1"
                  style={{ background: '#00C48C10' }}
                  role="status"
                >
                  <p className="font-semibold font-display">Success</p>
                  <p className="opacity-90">{successMessage}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email Field */}
            <div className="space-y-1.5">
              <label
                htmlFor="signup-email"
                className="block text-xs font-semibold font-display text-[#C4D4EC]"
              >
                Work Email
              </label>
              <input
                id="signup-email"
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
              <label
                htmlFor="signup-password"
                className="block text-xs font-semibold font-display text-[#C4D4EC]"
              >
                Password (min 6 characters)
              </label>
              <input
                id="signup-password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl text-sm font-mono text-white placeholder-[#7EC8E330] border border-[#1A2F55] bg-[#060E1F]/80 focus:border-[#3395FF] focus:ring-1 focus:ring-[#3395FF] transition-colors outline-none"
              />
            </div>

            {/* Role Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold font-display text-[#C4D4EC]">
                Account Role
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('operator')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    role === 'operator'
                      ? 'border-[#7EC8E3] bg-[#7EC8E315] shadow-sm'
                      : 'border-[#1A2F55] bg-[#060E1F]/60 opacity-60 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold font-display text-xs text-[#7EC8E3]">
                    <span>Operator</span>
                  </div>
                  <p className="text-[11px] text-[#C4D4EC]/70 mt-1 leading-snug">
                    View invoices and submit emails for AI policy recovery
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('admin')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    role === 'admin'
                      ? 'border-[#3395FF] bg-[#3395FF15] shadow-sm'
                      : 'border-[#1A2F55] bg-[#060E1F]/60 opacity-60 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold font-display text-xs text-[#3395FF]">
                    <span>Admin</span>
                  </div>
                  <p className="text-[11px] text-[#C4D4EC]/70 mt-1 leading-snug">
                    Full access + manual override of Human Review cases
                  </p>
                </button>
              </div>
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
                  <span>Creating Account…</span>
                </>
              ) : (
                <span>Register Account</span>
              )}
            </button>
          </form>
        </div>

        {/* Link to Login */}
        <p className="text-center text-xs text-[#7EC8E360]">
          Already have an account?{' '}
          <Link
            href="/login"
            className="text-[#3395FF] hover:text-[#7EC8E3] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3395FF] rounded"
          >
            Sign in here →
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
