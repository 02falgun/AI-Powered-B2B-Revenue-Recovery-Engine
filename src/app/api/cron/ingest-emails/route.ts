import { NextResponse } from 'next/server';
import { pollInboxAndEnqueue } from '@/lib/email-ingestion';
import { getCurrentUser } from '@/lib/auth';

/**
 * Cron / Ingestion API Endpoint.
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
        error: { code: 'unauthorized_error', message: 'Unauthorized cron/ingestion request.' },
      },
      { status: 401 },
    );
  }

  try {
    const result = await pollInboxAndEnqueue();
    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown ingestion error';
    return NextResponse.json(
      {
        success: false,
        error: { code: 'ai_error', message: `Ingestion failed: ${message}` },
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  return POST(request);
}
