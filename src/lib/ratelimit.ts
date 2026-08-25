import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export interface RateLimitCheckResult {
  readonly success: boolean;
  readonly limit: number;
  readonly remaining: number;
  readonly reset: number;
  readonly scope: 'user' | 'global';
  readonly retryAfterSeconds: number;
}

// In-memory sliding window timestamps for local dev / fallback
interface SlidingWindowRecord {
  timestamps: number[];
}

const memoryStore = new Map<string, SlidingWindowRecord>();

function checkMemorySlidingWindow(
  key: string,
  limit: number,
  windowMs: number,
): { success: boolean; limit: number; remaining: number; reset: number; retryAfterSeconds: number } {
  const now = Date.now();
  const windowStart = now - windowMs;

  let record = memoryStore.get(key);
  if (!record) {
    record = { timestamps: [] };
    memoryStore.set(key, record);
  }

  // Filter timestamps within current window
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

  if (record.timestamps.length >= limit) {
    const oldest = record.timestamps[0];
    const resetTime = oldest + windowMs;
    const retryAfter = Math.max(1, Math.ceil((resetTime - now) / 1000));
    return {
      success: false,
      limit,
      remaining: 0,
      reset: resetTime,
      retryAfterSeconds: retryAfter,
    };
  }

  record.timestamps.push(now);
  const remaining = limit - record.timestamps.length;
  return {
    success: true,
    limit,
    remaining,
    reset: now + windowMs,
    retryAfterSeconds: 0,
  };
}

/**
 * Initializes Upstash Redis ratelimiter if credentials are configured.
 */
function getUpstashRatelimiters(): {
  userLimiter: Ratelimit | null;
  globalLimiter: Ratelimit | null;
} {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token || url.includes('example') || token.includes('example')) {
    return { userLimiter: null, globalLimiter: null };
  }

  try {
    const redis = new Redis({ url, token });

    const userMax = parseInt(process.env.RATE_LIMIT_USER_MAX || '20', 10);
    const globalMax = parseInt(process.env.RATE_LIMIT_GLOBAL_MAX || '60', 10);

    const userLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(userMax, '1 h'),
      prefix: 'recoverai:rl:user',
    });

    const globalLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(globalMax, '1 m'),
      prefix: 'recoverai:rl:global',
    });

    return { userLimiter, globalLimiter };
  } catch (err) {
    console.warn('[RateLimit Upstash Init Warning]:', err);
    return { userLimiter: null, globalLimiter: null };
  }
}

/**
 * Evaluates both the global backstop limit and per-user sliding window limit
 * for the AI-calling endpoint (/api/process-email).
 */
export async function checkProcessEmailRateLimit(
  userId: string,
): Promise<RateLimitCheckResult> {
  const userMax = parseInt(process.env.RATE_LIMIT_USER_MAX || '20', 10);
  const userWindowMs = parseInt(process.env.RATE_LIMIT_USER_WINDOW_MS || '3600000', 10); // 1 hour

  const globalMax = parseInt(process.env.RATE_LIMIT_GLOBAL_MAX || '60', 10);
  const globalWindowMs = parseInt(process.env.RATE_LIMIT_GLOBAL_WINDOW_MS || '60000', 10); // 1 min

  const { userLimiter, globalLimiter } = getUpstashRatelimiters();

  // 1. Check Global Backstop Limit
  if (globalLimiter) {
    try {
      const globalRes = await globalLimiter.limit('global_process_email');
      if (!globalRes.success) {
        const retryAfter = Math.max(1, Math.ceil((globalRes.reset - Date.now()) / 1000));
        return {
          success: false,
          limit: globalRes.limit,
          remaining: globalRes.remaining,
          reset: globalRes.reset,
          scope: 'global',
          retryAfterSeconds: retryAfter,
        };
      }
    } catch {
      // Fallback to memory store if Redis network fails
      const fallbackGlobal = checkMemorySlidingWindow(
        'global_process_email',
        globalMax,
        globalWindowMs,
      );
      if (!fallbackGlobal.success) {
        return { ...fallbackGlobal, scope: 'global' };
      }
    }
  } else {
    const memGlobal = checkMemorySlidingWindow(
      'global_process_email',
      globalMax,
      globalWindowMs,
    );
    if (!memGlobal.success) {
      return { ...memGlobal, scope: 'global' };
    }
  }

  // 2. Check Per-User Sliding Window Limit
  const userKey = userId || 'anonymous_operator';

  if (userLimiter) {
    try {
      const userRes = await userLimiter.limit(userKey);
      if (!userRes.success) {
        const retryAfter = Math.max(1, Math.ceil((userRes.reset - Date.now()) / 1000));
        return {
          success: false,
          limit: userRes.limit,
          remaining: userRes.remaining,
          reset: userRes.reset,
          scope: 'user',
          retryAfterSeconds: retryAfter,
        };
      }

      return {
        success: true,
        limit: userRes.limit,
        remaining: userRes.remaining,
        reset: userRes.reset,
        scope: 'user',
        retryAfterSeconds: 0,
      };
    } catch {
      // Fallback to memory store if Redis network fails
      const fallbackUser = checkMemorySlidingWindow(
        `user_${userKey}`,
        userMax,
        userWindowMs,
      );
      return { ...fallbackUser, scope: 'user' };
    }
  }

  const memUser = checkMemorySlidingWindow(`user_${userKey}`, userMax, userWindowMs);
  return { ...memUser, scope: 'user' };
}

/**
 * Rate limiter for administrative data purge requests (/api/admin/purge-company).
 * Limits admin purge actions to 5 per hour per admin user.
 */
export async function checkAdminPurgeRateLimit(
  adminId: string,
): Promise<RateLimitCheckResult> {
  const limit = 5;
  const windowMs = 3600000; // 1 hour
  const key = `purge_${adminId || 'anonymous_admin'}`;

  const { userLimiter } = getUpstashRatelimiters();
  if (userLimiter) {
    try {
      const res = await userLimiter.limit(key);
      if (!res.success) {
        const retryAfter = Math.max(1, Math.ceil((res.reset - Date.now()) / 1000));
        return {
          success: false,
          limit: res.limit,
          remaining: res.remaining,
          reset: res.reset,
          scope: 'user',
          retryAfterSeconds: retryAfter,
        };
      }
      return {
        success: true,
        limit: res.limit,
        remaining: res.remaining,
        reset: res.reset,
        scope: 'user',
        retryAfterSeconds: 0,
      };
    } catch {
      // fallback
    }
  }

  const mem = checkMemorySlidingWindow(key, limit, windowMs);
  return { ...mem, scope: 'user' };
}

/**
 * Resets memory rate limit store (used in tests).
 */
export function resetMemoryRateLimitStore(): void {
  memoryStore.clear();
}

