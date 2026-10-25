import "server-only";

const g = globalThis as unknown as { __floHits?: Map<string, number[]> };
const hits: Map<string, number[]> = (g.__floHits ??= new Map());

/** Sliding-window limiter. In-memory is enough for a single instance; use Upstash for several. */
export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) return { ok: false, retryAfter: Math.ceil((windowMs - (now - recent[0]!)) / 1000) };
  recent.push(now);
  hits.set(key, recent);
  return { ok: true, retryAfter: 0 };
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
