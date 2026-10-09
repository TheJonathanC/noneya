/**
 * In-memory token bucket rate limiter for API requests.
 * Tracks client IP / user identifiers and enforces requests-per-window limits.
 */

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const ipRequestMap = new Map<string, RateLimitRecord>();

// Clean up stale entries periodically every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of ipRequestMap.entries()) {
      if (now > value.resetTime) {
        ipRequestMap.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitOptions {
  limit?: number; // max requests per window
  windowMs?: number; // duration of window in ms
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfterSeconds?: number;
}

/**
 * Checks whether an incoming request from an identifier is within permissible rate limits.
 * Default: 60 requests per 60 seconds per IP.
 */
export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const limit = options.limit || 60;
  const windowMs = options.windowMs || 60 * 1000;
  const now = Date.now();

  const record = ipRequestMap.get(identifier);

  if (!record || now > record.resetTime) {
    ipRequestMap.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      resetTime: now + windowMs,
    };
  }

  if (record.count >= limit) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    return {
      success: false,
      limit,
      remaining: 0,
      resetTime: record.resetTime,
      retryAfterSeconds: Math.max(retryAfter, 1),
    };
  }

  record.count += 1;
  return {
    success: true,
    limit,
    remaining: limit - record.count,
    resetTime: record.resetTime,
  };
}

/**
 * Helper to extract client IP from Next.js NextRequest headers.
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
}
