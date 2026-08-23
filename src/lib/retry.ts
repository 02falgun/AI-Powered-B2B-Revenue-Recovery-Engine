/**
 * Lightweight, resilient retry engine with exponential backoff and randomized jitter.
 * Hardened for Phase P3: Retry & Reliability Hardening.
 *
 * Rules:
 * - Only retries on clearly transient errors (timeouts, network drops, HTTP 5xx, temporary 429).
 * - NEVER retries on definitive client errors (HTTP 4xx validation errors, schema parsing failures, policy rejections).
 * - Fails closed if all retries are exhausted.
 */

export interface RetryOptions {
  readonly maxRetries?: number;
  readonly initialDelayMs?: number;
  readonly maxDelayMs?: number;
  readonly backoffFactor?: number;
  readonly isTransient?: (error: unknown) => boolean;
  readonly onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

const DEFAULT_MAX_RETRIES = 2; // 3 attempts total (1 initial + 2 retries)
const DEFAULT_INITIAL_DELAY_MS = 200;
const DEFAULT_MAX_DELAY_MS = 3000;
const DEFAULT_BACKOFF_FACTOR = 2;

/**
 * Determines whether an error is transient and safe to retry.
 */
export function isTransientError(err: unknown): boolean {
  if (!err) return false;

  const errString = String(err).toLowerCase();
  const errName = err instanceof Error ? err.name.toLowerCase() : '';
  const errMessage = err instanceof Error ? err.message.toLowerCase() : '';

  // 1. Timeouts & Abort signals
  if (
    errName === 'aborterror' ||
    errString.includes('aborterror') ||
    errString.includes('timeout') ||
    errMessage.includes('timeout') ||
    errString.includes('timed out') ||
    errString.includes('etimedout')
  ) {
    return true;
  }

  // 2. Network & Connection Resets / Drops
  if (
    errString.includes('econnreset') ||
    errString.includes('econnrefused') ||
    errString.includes('enotfound') ||
    errString.includes('socket hang up') ||
    errString.includes('network error') ||
    errString.includes('fetch failed') ||
    errString.includes('und_err_connect_timeout')
  ) {
    return true;
  }

  // 3. HTTP 5xx Server Errors & Rate Limit (429) Transient Quota
  const status =
    (err as { status?: number; statusCode?: number; httpStatus?: number })?.status ||
    (err as { statusCode?: number })?.statusCode ||
    (err as { httpStatus?: number })?.httpStatus;

  if (typeof status === 'number') {
    if (status >= 500 && status <= 599) return true;
    if (status === 429) return true; // Rate limit with backoff
    if (status >= 400 && status < 500) return false; // Client errors are NOT transient
  }

  // Check error object codes or descriptions
  const errorCode = (err as { code?: string })?.code?.toLowerCase() || '';
  if (errorCode.startsWith('5') || errorCode === 'internal_server_error' || errorCode === 'service_unavailable') {
    return true;
  }

  if (errorCode.startsWith('4') || errorCode === 'bad_request' || errorCode === 'validation_error') {
    return false;
  }

  // Gemini / OpenAI quota or resource exhausted errors
  if (errString.includes('resource_exhausted') || errString.includes('quota') || errString.includes('503') || errString.includes('500')) {
    return true;
  }

  return false;
}

/**
 * Calculates exponential backoff with full randomized jitter.
 */
function calculateJitteredDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffFactor: number,
): number {
  const calculatedDelay = Math.min(
    maxDelayMs,
    initialDelayMs * Math.pow(backoffFactor, attempt - 1),
  );
  // Full jitter: uniformly distributed between 0 and calculated delay, with a 50ms floor
  const jittered = Math.floor(Math.random() * calculatedDelay);
  return Math.max(50, jittered);
}

/**
 * Executes an async operation with bounded exponential backoff retries on transient errors.
 */
export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const envMaxRetries = process.env.MAX_TRANSIENT_RETRIES
    ? parseInt(process.env.MAX_TRANSIENT_RETRIES, 10)
    : undefined;
  const envInitialDelay = process.env.RETRY_INITIAL_DELAY_MS
    ? parseInt(process.env.RETRY_INITIAL_DELAY_MS, 10)
    : undefined;

  const maxRetries = options?.maxRetries ?? envMaxRetries ?? DEFAULT_MAX_RETRIES;
  const initialDelayMs = options?.initialDelayMs ?? envInitialDelay ?? DEFAULT_INITIAL_DELAY_MS;
  const maxDelayMs = options?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const backoffFactor = options?.backoffFactor ?? DEFAULT_BACKOFF_FACTOR;
  const isTransientFn = options?.isTransient ?? isTransientError;

  let attempt = 1;
  const totalAttempts = maxRetries + 1;

  while (true) {
    try {
      return await operation(attempt);
    } catch (err: unknown) {
      const isTransient = isTransientFn(err);

      // If error is not transient or we've exhausted all attempts, throw immediately
      if (!isTransient || attempt >= totalAttempts) {
        throw err;
      }

      const delayMs = calculateJitteredDelay(attempt, initialDelayMs, maxDelayMs, backoffFactor);

      if (options?.onRetry) {
        options.onRetry(attempt, err, delayMs);
      } else {
        console.warn(
          `[Transient Error - Attempt ${attempt}/${totalAttempts}] Retrying in ${delayMs}ms. Error: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
      attempt++;
    }
  }
}
