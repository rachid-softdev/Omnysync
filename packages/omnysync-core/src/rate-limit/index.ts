// Generic in-memory rate limit store
// Framework-agnostic - use with any HTTP framework via adapters

export const RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const RATE_LIMIT_MAX = 30;

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

export function getClientIp(ip: string): string {
  return ip.split(",")[0].trim();
}

export function pruneRateLimitEntries(): number {
  const now = Date.now();
  let prunedCount = 0;
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(ip);
      prunedCount++;
    }
  }
  return prunedCount;
}

export function startRateLimitCleanup(): void {
  if (cleanupInterval) return;
  pruneRateLimitEntries();
  cleanupInterval = setInterval(
    () => {
      pruneRateLimitEntries();
    },
    5 * 60 * 1000,
  );
}

export function stopRateLimitCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

export function rateLimit(ip: string): {
  allowed: boolean;
  remainingTime?: number;
} {
  const clientIp = getClientIp(ip);
  const now = Date.now();
  startRateLimitCleanup();
  const record = rateLimitMap.get(clientIp);
  if (!record || now > record.resetTime) {
    rateLimitMap.set(clientIp, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    });
    return { allowed: true };
  }
  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remainingTime: record.resetTime - now };
  }
  record.count++;
  return { allowed: true };
}
