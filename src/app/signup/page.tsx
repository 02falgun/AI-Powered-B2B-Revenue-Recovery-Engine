'use client';

import { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';

function SignupRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/login?mode=signup');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0D0D0E] flex items-center justify-center">
      <div className="h-6 w-6 rounded-full border-2 border-[#FAFAFA] border-t-transparent animate-spin" />
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0D0D0E]" />}>
      <SignupRedirect />
    </Suspense>
  );
}
