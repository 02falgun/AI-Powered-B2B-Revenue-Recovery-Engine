import { NextResponse } from 'next/server';
import { processNextEmailQueueBatch } from '@/lib/queue-worker';
import { getCurrentUser } from '@/lib/auth';

/**
 * Queue Processing Worker Endpoint.
 * Protected by CRON_SECRET or authenticated user session.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  const isCronAuthorized = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const userResult = await getCurrentUser();

  if (!isCronAuthorized && !userResult.ok) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'unauthorized_error', message: 'Unauthorized queue processing request.' },
      },
      { status: 401 },
    );
  }

  try {
    const result = await processNextEmailQueueBatch(10);
    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown queue processing error';
    return NextResponse.json(
      {
        success: false,
        error: { code: 'db_error', message: `Queue processing failed: ${message}` },
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  return POST(request);
}
