import { NextRequest, NextResponse } from "next/server";

// Simple in-memory rate limiter (works for single-instance deployments).
// For multi-instance, use Redis or a shared store.

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt < now) store.delete(key);
    }
  }, 5 * 60 * 1000).unref?.();
}

interface RateLimitOptions {
  windowMs: number;   // time window in milliseconds
  maxRequests: number; // max requests per window
  keyFn?: (req: NextRequest) => string; // custom key function
}

/// Returns null if allowed, or a NextResponse (429) if rate limited.
export function rateLimit(opts: RateLimitOptions) {
  return (req: NextRequest): NextResponse | null => {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown";
    const key = opts.keyFn ? opts.keyFn(req) : ip;
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || entry.resetAt < now) {
      store.set(key, { count: 1, resetAt: now + opts.windowMs });
      return null;
    }

    entry.count++;
    if (entry.count > opts.maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      return NextResponse.json(
        { error: "Too many requests. Please try again later.", retryAfter },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    return null;
  };
}

// Pre-configured rate limits for common use cases
export const authRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, maxRequests: 20 }); // 20 requests per 15 min
export const apiRateLimit = rateLimit({ windowMs: 60 * 1000, maxRequests: 100 }); // 100 requests per min
export const strictRateLimit = rateLimit({ windowMs: 60 * 1000, maxRequests: 5 }); // 5 requests per min (for AI identify etc)
