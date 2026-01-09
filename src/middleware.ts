// Next.js Middleware - Security, rate limiting, and request logging
// 
// This middleware runs on EVERY request before it reaches your API routes.
// It provides:
// 1. Request logging with unique IDs
// 2. Rate limiting enforcement
// 3. Optional API key authentication
// 4. CORS headers
// 5. Security headers
//
// Note: For performance, rate limiting here uses a simplified check.
// Full rate limiting logic is in the API routes themselves.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Generate unique request ID
function generateRequestId(): string {
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// Simple in-memory rate limit check for middleware
// This is a quick check; full logic is in rateLimit.ts
const requestCounts = new Map<string, { count: number; resetAt: number }>();

function quickRateLimitCheck(ip: string, limit: number = 100): boolean {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute

    let record = requestCounts.get(ip);
    if (!record || record.resetAt < now) {
        record = { count: 0, resetAt: now + windowMs };
    }

    record.count++;
    requestCounts.set(ip, record);

    return record.count <= limit;
}

// Cleanup old entries periodically
if (typeof setInterval !== 'undefined') {
    setInterval(() => {
        const now = Date.now();
        for (const [key, record] of requestCounts.entries()) {
            if (record.resetAt < now) {
                requestCounts.delete(key);
            }
        }
    }, 60 * 1000);
}

export function middleware(request: NextRequest) {
    const requestId = generateRequestId();
    const start = Date.now();
    const url = request.nextUrl.pathname;

    // Skip middleware for static files and Next.js internals
    if (
        url.startsWith('/_next') ||
        url.startsWith('/favicon') ||
        url.includes('.')
    ) {
        return NextResponse.next();
    }

    // Get client IP
    const forwarded = request.headers.get('X-Forwarded-For');
    const ip = forwarded?.split(',')[0].trim() ||
        request.headers.get('X-Real-IP') ||
        'unknown';

    // Rate limiting (quick check)
    if (url.startsWith('/api/')) {
        // Stricter limit for AI endpoints
        const limit = url.includes('/analyze') || url.includes('/agents') || url.includes('/generate')
            ? 20  // 20 requests/minute for AI endpoints
            : 100; // 100 requests/minute for other endpoints

        if (!quickRateLimitCheck(ip, limit)) {
            console.warn(`[${requestId}] Rate limit exceeded for ${ip} on ${url}`);
            return new NextResponse(
                JSON.stringify({
                    success: false,
                    error: 'Too many requests. Please try again later.',
                    retryAfter: 60,
                }),
                {
                    status: 429,
                    headers: {
                        'Content-Type': 'application/json',
                        'Retry-After': '60',
                        'X-Request-ID': requestId,
                    },
                }
            );
        }
    }

    // Optional API key authentication
    // Uncomment to require API keys for all /api/ routes
    /*
    if (url.startsWith('/api/') && !url.startsWith('/api/health')) {
        const apiKey = request.headers.get('X-API-Key');
        const validKeys = (process.env.API_KEYS || '').split(',').filter(Boolean);

        if (validKeys.length > 0 && !validKeys.includes(apiKey || '')) {
            return new NextResponse(
                JSON.stringify({ 
                    success: false, 
                    error: 'Invalid or missing API key. Include X-API-Key header.',
                }),
                { 
                    status: 401,
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Request-ID': requestId,
                    },
                }
            );
        }
    }
    */

    // Add request headers
    const response = NextResponse.next();

    // Request ID for tracing
    response.headers.set('X-Request-ID', requestId);

    // Security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    // CORS headers (adjust origin for production)
    if (url.startsWith('/api/')) {
        response.headers.set('Access-Control-Allow-Origin', '*');
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, X-Request-ID');
    }

    // Log request (on completion)
    const duration = Date.now() - start;
    if (url.startsWith('/api/')) {
        console.log(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'info',
            message: 'API Request',
            requestId,
            method: request.method,
            path: url,
            ip,
            duration: `${duration}ms`,
        }));
    }

    return response;
}

// Configure which paths middleware runs on
export const config = {
    matcher: [
        // Match all API routes
        '/api/:path*',
        // Match all pages (for security headers)
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
