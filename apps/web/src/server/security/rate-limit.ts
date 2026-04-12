type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

const buckets = new Map<string, RateLimitBucket>();

function now() {
  return Date.now();
}

function toSeconds(milliseconds: number) {
  return Math.max(1, Math.ceil(milliseconds / 1000));
}

export function getRequestClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  return "unknown";
}

export function checkRateLimit(
  key: string,
  options: {
    maxRequests: number;
    windowMs: number;
  },
): RateLimitResult {
  const currentTime = now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= currentTime) {
    buckets.set(key, {
      count: 1,
      resetAt: currentTime + options.windowMs,
    });

    return {
      allowed: true,
      remaining: options.maxRequests - 1,
      retryAfterSeconds: toSeconds(options.windowMs),
    };
  }

  if (existing.count >= options.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: toSeconds(existing.resetAt - currentTime),
    };
  }

  existing.count += 1;
  buckets.set(key, existing);

  return {
    allowed: true,
    remaining: Math.max(0, options.maxRequests - existing.count),
    retryAfterSeconds: toSeconds(existing.resetAt - currentTime),
  };
}
