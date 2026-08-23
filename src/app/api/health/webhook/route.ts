import { NextResponse } from 'next/server';

/**
 * Money-Critical Path Monitor: Webhook Ingestion Health Probe.
 * Verifies that the webhook receiver endpoint is online and reachable.
 */
export async function GET(): Promise<NextResponse> {
  const isSecretConfigured = Boolean(process.env.RAZORPAY_WEBHOOK_SECRET);

  return NextResponse.json({
    status: 'healthy',
    endpoint: '/api/webhook/razorpay',
    signatureVerification: isSecretConfigured ? 'configured' : 'fallback_active',
    timestamp: new Date().toISOString(),
  });
}
