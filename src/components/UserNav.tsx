'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { UserRole } from '@/lib/types';

interface CurrentUser {
  id: string;
  email: string;
  role: UserRole;
  companyId?: string;
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
    return <div className="h-8 w-28 rounded bg-[#202024] animate-pulse" />;
  }

  if (!user) {
    return (
      <a
        href="/login"
        className="px-3.5 py-1.5 rounded text-xs font-bold text-[#0D0D0E] bg-[#FAFAFA] border border-[#FFFFFF] shadow-[0_2px_4px_rgba(0,0,0,0.5)] active:translate-y-[1px] transition-all"
      >
        Sign In
      </a>
    );
  }

  const isAdmin = user.role === 'admin';

  return (
    <div className="flex items-center gap-3">
      {/* Operator Status Capsule */}
      <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded bg-[#18181B] border border-[#27272A]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#FAFAFA]" aria-hidden="true" />
        <span className="text-xs font-mono text-[#D4D4D8]">
          {user.email}
        </span>
        <span
          className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-sm border uppercase ${
            isAdmin
              ? 'bg-[#FAFAFA] text-[#0D0D0E] border-[#FFFFFF]'
              : 'bg-[#202024] text-[#A1A1AA] border-[#3F3F46]'
          }`}
        >
          {user.role}
        </span>
      </div>

      {/* Logout Action Button */}
      <button
        onClick={handleLogout}
        disabled={loggingOut}
        className="px-3 py-1 rounded text-xs font-semibold text-[#A1A1AA] hover:text-[#FAFAFA] bg-[#1E1E22] hover:bg-[#2A2A30] border border-[#383840] shadow-[0_1px_2px_rgba(0,0,0,0.5)] active:translate-y-[1px] transition-all disabled:opacity-50"
      >
        {loggingOut ? 'Exiting...' : 'Sign Out'}
      </button>
    </div>
  );
}
