'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { UserRole } from '@/lib/types';

interface CurrentUser {
  id: string;
  email: string;
  role: UserRole;
}

export function UserNav() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loggingOut, setLoggingOut] = useState<boolean>(false);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.success && data.user) {
          setUser(data.user);
        }
      } catch {
        // Not logged in or guest
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      router.push('/login');
    } finally {
      setLoggingOut(false);
    }
  }

  if (loading) {
    return <div className="h-8 w-32 rounded-xl bg-[#1A2F5530] animate-pulse" />;
  }

  if (!user) {
    return (
      <a
        href="/login"
        className="px-3.5 py-1.5 rounded-xl text-xs font-semibold font-display border border-[#3395FF50] text-[#3395FF] hover:bg-[#3395FF15] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3395FF]"
      >
        Sign In
      </a>
    );
  }

  const isAdmin = user.role === 'admin';

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#1A2F55] bg-[#0C1A35]/80 backdrop-blur-sm">
        {/* User avatar dot */}
        <div
          className={`h-2 w-2 rounded-full ${
            isAdmin ? 'bg-[#3395FF]' : 'bg-[#7EC8E3]'
          }`}
          aria-hidden="true"
        />

        <span className="text-xs font-mono text-[#C4D4EC] max-w-[160px] truncate">
          {user.email}
        </span>

        {/* Role badge */}
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${
            isAdmin
              ? 'bg-[#3395FF20] text-[#3395FF] border-[#3395FF50]'
              : 'bg-[#7EC8E315] text-[#7EC8E3] border-[#7EC8E340]'
          }`}
        >
          {user.role}
        </span>
      </div>

      {/* Logout button */}
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        aria-label="Sign out"
        className="px-3 py-1.5 rounded-xl text-xs font-medium font-display text-[#7EC8E380] hover:text-[#F04E37] hover:border-[#F04E3740] border border-[#1A2F55] bg-[#0C1A35]/50 transition-all duration-150 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3395FF]"
      >
        {loggingOut ? 'Signing out…' : 'Sign Out'}
      </button>
    </div>
  );
}
