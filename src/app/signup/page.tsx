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
        router.push('/');
        router.refresh();
      } else {
        // Attempt automatic sign-in
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (!signInError) {
          router.push('/');
          router.refresh();
        } else {
          setSuccessMessage('Registration successful! Please sign in with your credentials.');
          setLoading(false);
        }
      }
    } catch {
      setError('Network failure during registration.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 sm:px-6 py-12 text-[#FAFAFA] font-sans bg-[#0D0D0E] texture-chassis">
      {/* Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-4 mb-6">
        <div className="flex justify-center">
          <Logo scale={1.2} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-[#FAFAFA] font-display">
            Tenant Account Enrollment
          </h2>
          <p className="text-xs text-[#A1A1AA] mt-1">
            Provision a new operator or admin credential in the RecoverAI tenant registry.
          </p>
        </div>
      </div>

      {/* Form Chassis */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="panel-raised p-8 rounded-xl space-y-6">
          <form onSubmit={handleSignup} className="space-y-4">
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

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#71717A] font-bold block">
                ORGANIZATION EMAIL IDENTIFIER
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="finance@yourorg.com"
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
                placeholder="Minimum 6 characters"
                className="w-full panel-recessed rounded p-3 text-xs font-mono text-[#FAFAFA] placeholder:text-[#52525B] focus:border-[#FAFAFA] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-[#71717A] font-bold block">
                ACCESS ROLE LEVEL
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('operator')}
                  className={`p-3 rounded text-left border transition-all ${
                    role === 'operator'
                      ? 'bg-[#FAFAFA] text-[#0D0D0E] border-[#FFFFFF] font-bold shadow-[0_2px_4px_rgba(0,0,0,0.5)]'
                      : 'panel-recessed text-[#A1A1AA] border-[#2A2A30]'
                  }`}
                >
                  <div className="text-xs">Finance Operator</div>
                  <div className="text-[10px] opacity-75 font-mono">Standard Processing</div>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('admin')}
                  className={`p-3 rounded text-left border transition-all ${
                    role === 'admin'
                      ? 'bg-[#FAFAFA] text-[#0D0D0E] border-[#FFFFFF] font-bold shadow-[0_2px_4px_rgba(0,0,0,0.5)]'
                      : 'panel-recessed text-[#A1A1AA] border-[#2A2A30]'
                  }`}
                >
                  <div className="text-xs">Administrator</div>
                  <div className="text-[10px] opacity-75 font-mono">Manual Overrides</div>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-mechanical-primary w-full py-3 px-4 rounded text-xs flex items-center justify-center gap-2 mt-2 disabled:opacity-40"
            >
              {loading ? (
                <>
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  <span>Registering Tenant Account...</span>
                </>
              ) : (
                <span>Enroll Account & Continue</span>
              )}
            </button>
          </form>

          <div className="text-center pt-2 border-t border-[#26262B]">
            <p className="text-xs text-[#71717A]">
              Already enrolled?{' '}
              <Link href="/login" className="text-[#FAFAFA] font-bold hover:underline">
                Sign In to Console →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
