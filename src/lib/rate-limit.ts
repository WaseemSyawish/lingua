import type { NextApiRequest, NextApiResponse } from "next";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
  keyPrefix?: string;
}

export function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

export function rateLimit(options: RateLimitOptions = {}) {
  const { windowMs = 60 * 1000, maxRequests = 30, keyPrefix = "global" } = options;

  return function checkRateLimit(
    req: NextApiRequest,
    res: NextApiResponse
  ): boolean {
    const ip = getClientIp(req);
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();

    const entry = rateLimitMap.get(key);

    if (!entry || now > entry.resetTime) {
      rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
      res.setHeader("X-RateLimit-Limit", maxRequests);
      res.setHeader("X-RateLimit-Remaining", maxRequests - 1);
      return true;
    }

    entry.count++;
    const remaining = Math.max(0, maxRequests - entry.count);

    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetTime / 1000));

    if (entry.count > maxRequests) {
      res.status(429).json({
        error: "Too many requests",
        retryAfter: Math.ceil((entry.resetTime - now) / 1000),
      });
      return false;
    }

    return true;
  };
}

// Pre-configured rate limiters
export const chatRateLimit = rateLimit({
  windowMs: 60 * 1000,
  maxRequests: 20,
  keyPrefix: "chat",
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  keyPrefix: "auth",
});

export const analysisRateLimit = rateLimit({
  windowMs: 60 * 1000,
  maxRequests: 5,
  keyPrefix: "analysis",
});

export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  maxRequests: 60,
  keyPrefix: "api",
});
