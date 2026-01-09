// Next.js Middleware - Security, rate limiting, and request logging
// 
// This middleware runs on EVERY request before it reaches your API routes.
// It provides:
// 1. Request logging with unique IDs
// 2. Optional API key authentication
// 3. CORS headers
// 4. Security headers

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Generate unique request ID
function generateRequestId(): string {
    return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
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
