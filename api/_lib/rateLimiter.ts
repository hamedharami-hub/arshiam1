/**
 * Rate Limiter & Brute Force Protection for AI Agent API.
 * Uses an in-memory sliding window counter per client / token.
 */

interface RateBucket {
  tokens: number[];
}

const windowMs = 60 * 1000; // 60 seconds
const maxRequestsPerWindow = 60; // 60 req/min default
const maxBuckets = 2000;

const buckets = new Map<string, RateBucket>();

function pruneBuckets(now: number): void {
  for (const [bucketKey, bucket] of buckets) {
    bucket.tokens = bucket.tokens.filter((ts) => now - ts < windowMs);
    if (bucket.tokens.length === 0) buckets.delete(bucketKey);
  }
  while (buckets.size >= maxBuckets) {
    const oldestKey = buckets.keys().next().value;
    if (!oldestKey) break;
    buckets.delete(oldestKey);
  }
}

export function checkRateLimit(key: string, limit = maxRequestsPerWindow): {
  allowed: boolean;
  remaining: number;
  resetInSeconds: number;
} {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket) {
    if (buckets.size >= maxBuckets) pruneBuckets(now);
    bucket = { tokens: [] };
    buckets.set(key, bucket);
  }

  // Filter out timestamps older than the sliding window
  bucket.tokens = bucket.tokens.filter((ts) => now - ts < windowMs);
  if (bucket.tokens.length >= limit) {
    const oldest = bucket.tokens[0] || now;
    const resetInSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return {
      allowed: false,
      remaining: 0,
      resetInSeconds,
    };
  }

  bucket.tokens.push(now);
  // Refresh LRU insertion order while keeping the active bucket non-empty.
  buckets.delete(key);
  buckets.set(key, bucket);
  const remaining = Math.max(0, limit - bucket.tokens.length);
  return {
    allowed: true,
    remaining,
    resetInSeconds: Math.ceil(windowMs / 1000),
  };
}

export function resetRateLimits(): void {
  buckets.clear();
}
