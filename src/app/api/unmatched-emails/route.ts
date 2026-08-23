import { NextResponse } from 'next/server';
import { getUnmatchedEmailJobs } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * Lists all emails in the Unmatched Review Queue.
 */
export async function GET(): Promise<NextResponse> {
  const authRes = await requireAuth();
  if (!authRes.ok) {
    return NextResponse.json(
      { success: false, error: authRes.error },
      { status: 401 },
    );
  }

  const jobsRes = await getUnmatchedEmailJobs();
  if (!jobsRes.ok) {
    return NextResponse.json(
      { success: false, error: jobsRes.error },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    data: jobsRes.data,
  });
}
