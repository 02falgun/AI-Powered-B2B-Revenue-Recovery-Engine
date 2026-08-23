/**
 * Failure Spike Alerting Engine for RecoverAI Observability (Phase P6).
 *
 * Monitors failure events (AI extraction errors, consecutive guardrail rejections) in a sliding window.
 * Emits an immediate alert (via webhook / Slack / Discord) when failures spike above threshold.
 * Includes a 10-minute cooldown debounce to prevent notification fatigue.
 */

export interface FailureEvent {
  readonly type: 'ai_failure' | 'guardrail_rejection' | 'rate_limit';
  readonly timestamp: number;
  readonly invoiceId?: string;
  readonly companyId?: string;
  readonly reason?: string;
}

export interface AlertTriggerResult {
  readonly alertTriggered: boolean;
  readonly failureCount: number;
  readonly threshold: number;
  readonly windowMinutes: number;
  readonly message?: string;
}

const FAILURE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const FAILURE_THRESHOLD = 5; // 5 failures trigger an alert
const ALERT_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes debounce

// In-memory sliding window failure tracker
const recentFailures: FailureEvent[] = [];
let lastAlertDispatchedAt = 0;

/**
 * Records a failure event and evaluates whether the failure frequency warrants an alert.
 */
export async function recordFailureAndCheckAlert(
  failure: Omit<FailureEvent, 'timestamp'>,
): Promise<AlertTriggerResult> {
  const now = Date.now();
  const event: FailureEvent = {
    ...failure,
    timestamp: now,
  };

  recentFailures.push(event);

  // Prune failures older than the sliding window
  const windowStart = now - FAILURE_WINDOW_MS;
  while (recentFailures.length > 0 && recentFailures[0].timestamp < windowStart) {
    recentFailures.shift();
  }

  const failureCount = recentFailures.length;
  const isAboveThreshold = failureCount >= FAILURE_THRESHOLD;
  const isCooldownElapsed = now - lastAlertDispatchedAt >= ALERT_COOLDOWN_MS;

  if (isAboveThreshold && isCooldownElapsed) {
    lastAlertDispatchedAt = now;
    const alertMessage = `🚨 [RecoverAI Alert Spike] ${failureCount} failures detected in the last 5 minutes (Threshold: ${FAILURE_THRESHOLD}). Latest: ${failure.type} on Invoice ${failure.invoiceId || 'N/A'}`;

    await dispatchAlertWebhook({
      text: alertMessage,
      failureCount,
      windowMinutes: 5,
      latestType: failure.type,
      invoiceId: failure.invoiceId,
      companyId: failure.companyId,
      timestamp: new Date().toISOString(),
    });

    return {
      alertTriggered: true,
      failureCount,
      threshold: FAILURE_THRESHOLD,
      windowMinutes: 5,
      message: alertMessage,
    };
  }

  return {
    alertTriggered: false,
    failureCount,
    threshold: FAILURE_THRESHOLD,
    windowMinutes: 5,
  };
}

/**
 * Dispatches the alert to the configured webhook endpoint (Slack, Discord, or generic incoming webhook).
 */
async function dispatchAlertWebhook(payload: Record<string, unknown>): Promise<void> {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn(
      JSON.stringify({
        level: 'warn',
        event: 'ALERT_TRIGGERED_NO_WEBHOOK',
        payload,
      }),
    );
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('[Alert Webhook Dispatch Error]:', err);
  }
}

/**
 * Resets the alert tracking state (useful for unit testing).
 */
export function resetAlertTracker(): void {
  recentFailures.length = 0;
  lastAlertDispatchedAt = 0;
}
