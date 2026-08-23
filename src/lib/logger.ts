/**
 * Structured JSON Logging Engine for RecoverAI Observability (Phase P6).
 *
 * Emits uniform, machine-readable single-line JSON log events to stdout/stderr.
 * Excludes email body text and credentials by design.
 */

export interface PolicyDecisionLogPayload {
  readonly invoiceId: string;
  readonly companyId: string;
  readonly decision: 'AUTO_RECOVER' | 'HUMAN_REVIEW';
  readonly guardrailTriggered?: string;
  readonly approvedPaise?: number | null;
  readonly durationMs?: number;
}

export interface AiExtractionLogPayload {
  readonly invoiceId: string;
  readonly companyId: string;
  readonly success: boolean;
  readonly intent?: string;
  readonly confidence?: number;
  readonly errorType?: string;
  readonly durationMs?: number;
}

export interface SecurityEventLogPayload {
  readonly event: 'RATE_LIMIT_EXCEEDED' | 'CROSS_TENANT_DENIAL' | 'WEBHOOK_INVALID_SIGNATURE' | 'UNAUTHORIZED_ACCESS';
  readonly actor: string;
  readonly companyId?: string;
  readonly invoiceId?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export const logger = {
  /**
   * Logs policy engine decision output (Zero email body content).
   */
  logPolicyDecision(payload: PolicyDecisionLogPayload): void {
    const entry = {
      level: 'info',
      event: 'POLICY_DECISION',
      timestamp: new Date().toISOString(),
      invoiceId: payload.invoiceId,
      companyId: payload.companyId,
      decision: payload.decision,
      guardrailTriggered: payload.guardrailTriggered || 'NONE',
      approvedPaise: payload.approvedPaise ?? null,
      durationMs: payload.durationMs,
    };
    console.log(JSON.stringify(entry));
  },

  /**
   * Logs AI extraction outcome and latency metrics.
   */
  logAiExtraction(payload: AiExtractionLogPayload): void {
    const entry = {
      level: payload.success ? 'info' : 'warn',
      event: 'AI_EXTRACTION',
      timestamp: new Date().toISOString(),
      invoiceId: payload.invoiceId,
      companyId: payload.companyId,
      success: payload.success,
      intent: payload.intent || 'unknown',
      confidence: payload.confidence ?? null,
      errorType: payload.errorType,
      durationMs: payload.durationMs,
    };
    if (payload.success) {
      console.log(JSON.stringify(entry));
    } else {
      console.warn(JSON.stringify(entry));
    }
  },

  /**
   * Logs security, rate-limiting, and tenant isolation rejections.
   */
  logSecurityEvent(payload: SecurityEventLogPayload): void {
    const entry = {
      level: 'warn',
      event: payload.event,
      timestamp: new Date().toISOString(),
      actor: payload.actor,
      companyId: payload.companyId,
      invoiceId: payload.invoiceId,
      details: payload.details,
    };
    console.warn(JSON.stringify(entry));
  },

  /**
   * General info log.
   */
  info(event: string, data?: Readonly<Record<string, unknown>>): void {
    console.log(
      JSON.stringify({
        level: 'info',
        event,
        timestamp: new Date().toISOString(),
        ...data,
      }),
    );
  },

  /**
   * General error log.
   */
  error(event: string, error?: unknown, data?: Readonly<Record<string, unknown>>): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      JSON.stringify({
        level: 'error',
        event,
        timestamp: new Date().toISOString(),
        errorMessage,
        ...data,
      }),
    );
  },
};
