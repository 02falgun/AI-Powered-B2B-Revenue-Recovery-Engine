import { NextResponse } from 'next/server';
import { getAllInvoices } from '@/lib/db';

const START_TIME = Date.now();

export async function GET(): Promise<NextResponse> {
  const uptimeSeconds = Math.floor((Date.now() - START_TIME) / 1000);

  // 1. Check Database connectivity
  let dbStatus = 'healthy';
  try {
    const dbCheck = await getAllInvoices();
    if (!dbCheck.ok) {
      dbStatus = 'degraded';
    }
  } catch {
    dbStatus = 'unhealthy';
  }

  // 2. Check Rate-Limiter service availability
  const hasRedisConfig = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  const ratelimitStatus = hasRedisConfig ? 'redis_active' : 'memory_fallback_active';

  // 3. Check AI Provider configuration
  const aiStatus = process.env.GEMINI_API_KEY ? 'gemini_configured' : 'mock_fallback_active';

  const isOverallHealthy = dbStatus !== 'unhealthy';

  return NextResponse.json(
    {
      status: isOverallHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds,
      environment: process.env.NODE_ENV || 'development',
      checks: {
        database: dbStatus,
        ratelimit: ratelimitStatus,
        aiProvider: aiStatus,
        policyEngine: 'active_frozen',
      },
    },
    { status: isOverallHealthy ? 200 : 503 },
  );
}
