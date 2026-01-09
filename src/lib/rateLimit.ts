// Rate Limiter - In-memory rate limiting with sliding window
// 
// Why rate limiting matters:
// 1. Protects against abuse and DDoS
// 2. Controls API costs (OpenAI is expensive!)
// 3. Ensures fair usage across users
// 4. Required for production APIs
//
// This is an in-memory implementation. For production at scale,
// upgrade to Redis for distributed rate limiting.

import { NextResponse } from 'next/server';
import { logger } from './logger';

interface RateLimitWindow {
    count: number;
    resetAt: number;
}

export interface RateLimitConfig {
    windowMs: number;      // Time window in milliseconds
    maxRequests: number;   // Max requests per window
    keyPrefix?: string;    // Optional prefix for the key
}

// In-memory store (use Redis for production at scale)
const rateLimitStore = new Map<string, RateLimitWindow>();

// Cleanup old entries periodically (every 5 minutes)
setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, window] of rateLimitStore.entries()) {
        if (window.resetAt < now) {
            rateLimitStore.delete(key);
            cleaned++;
        }
    }
    if (cleaned > 0) {
        logger.debug(`Rate limit cleanup: removed ${cleaned} expired entries`, {
            remainingEntries: rateLimitStore.size,
        });
    }
}, 5 * 60 * 1000);

// Default configurations for different endpoint types
export const RATE_LIMIT_CONFIGS = {
    // General API endpoints (health, etc.)
    general: {
        windowMs: 60 * 1000,  // 1 minute
        maxRequests: 100,
        keyPrefix: 'general',
    },
    // AI-powered endpoints (expensive, rate limit more strictly)
    ai: {
        windowMs: 60 * 1000,  // 1 minute
        maxRequests: 10,
        keyPrefix: 'ai',
    },
    // Analyze endpoint (vision API, very expensive)
    analyze: {
        windowMs: 60 * 1000,  // 1 minute
        maxRequests: 5,
        keyPrefix: 'analyze',
    },
} as const;

/**
 * Check if a request is rate limited
 * Returns { limited: false } if allowed, or { limited: true, retryAfter } if blocked
 */
export function checkRateLimit(
    identifier: string,
    config: RateLimitConfig
): { limited: false } | { limited: true; retryAfter: number; remaining: number } {
    const key = config.keyPrefix ? `${config.keyPrefix}:${identifier}` : identifier;
    const now = Date.now();

    let window = rateLimitStore.get(key);

    // Create new window if doesn't exist or expired
    if (!window || window.resetAt < now) {
        window = {
            count: 0,
            resetAt: now + config.windowMs,
        };
    }

    // Increment count
    window.count++;
    rateLimitStore.set(key, window);

    // Check if over limit
    if (window.count > config.maxRequests) {
        const retryAfter = Math.ceil((window.resetAt - now) / 1000);
        const remaining = 0;

        logger.warn('Rate limit exceeded', {
            identifier,
            config: config.keyPrefix,
            count: window.count,
            maxRequests: config.maxRequests,
            retryAfter,
        });

        return { limited: true, retryAfter, remaining };
    }

    return { limited: false };
}

/**
 * Get client identifier from request (IP address or API key)
 */
export function getClientIdentifier(request: Request): string {
    // Try to get API key first (for authenticated requests)
    const apiKey = request.headers.get('X-API-Key');
    if (apiKey) {
        return `key:${apiKey.slice(0, 8)}...`; // Partial key for logging
    }

    // Fall back to IP address
    const forwarded = request.headers.get('X-Forwarded-For');
    if (forwarded) {
        return `ip:${forwarded.split(',')[0].trim()}`;
    }

    const realIp = request.headers.get('X-Real-IP');
    if (realIp) {
        return `ip:${realIp}`;
    }

    // Default fallback
    return 'ip:unknown';
}

/**
 * Create a rate limit error response
 */
export function rateLimitResponse(retryAfter: number): NextResponse {
    return NextResponse.json(
        {
            success: false,
            error: 'Too many requests. Please try again later.',
            retryAfter,
        },
        {
            status: 429,
            headers: {
                'Retry-After': String(retryAfter),
                'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + retryAfter),
            },
        }
    );
}

/**
 * Middleware-style rate limit check
 * Returns null if allowed, or a Response if rate limited
 */
export function withRateLimit(
    request: Request,
    config: RateLimitConfig = RATE_LIMIT_CONFIGS.general
): NextResponse | null {
    if (process.env.NODE_ENV === 'test') {
        return null;
    }
    const identifier = getClientIdentifier(request);
    const result = checkRateLimit(identifier, config);

    if (result.limited) {
        return rateLimitResponse(result.retryAfter);
    }

    return null;
}

/**
 * Get current rate limit status for a client
 * Useful for including X-RateLimit headers in responses
 */
export function getRateLimitStatus(
    identifier: string,
    config: RateLimitConfig
): { remaining: number; resetAt: number } {
    const key = config.keyPrefix ? `${config.keyPrefix}:${identifier}` : identifier;
    const window = rateLimitStore.get(key);

    if (!window || window.resetAt < Date.now()) {
        return {
            remaining: config.maxRequests,
            resetAt: Date.now() + config.windowMs,
        };
    }

    return {
        remaining: Math.max(0, config.maxRequests - window.count),
        resetAt: window.resetAt,
    };
}
