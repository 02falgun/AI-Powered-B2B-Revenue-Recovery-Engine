'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center bg-[#060E1F] text-white p-6 font-sans">
        <div className="max-w-md w-full rounded-2xl border border-[#F04E3740] bg-[#0C1A35] p-8 text-center space-y-4 shadow-surface">
          <div className="h-12 w-12 rounded-full bg-[#F04E3720] text-[#F04E37] flex items-center justify-center mx-auto text-2xl">
            ⚠️
          </div>
          <h2 className="text-xl font-bold font-display">Something went wrong</h2>
          <p className="text-sm text-[#7EC8E3] font-mono">
            An unexpected application error occurred. Our team has been notified.
          </p>
          <button
            onClick={() => reset()}
            className="w-full py-2.5 px-4 rounded-xl text-white font-medium text-sm transition-all"
            style={{ background: '#3395FF' }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
