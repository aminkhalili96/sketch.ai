// Health Check Endpoint - Kubernetes-compatible health/readiness probe
import { NextResponse } from 'next/server';

const startTime = Date.now();

interface HealthStatus {
    status: 'ok' | 'degraded' | 'error';
    version: string;
    uptime: number;
    timestamp: string;
    checks: {
        database?: 'ok' | 'error';
        openai?: 'ok' | 'error' | 'unchecked';
        memory?: 'ok' | 'warning';
    };
    details?: Record<string, unknown>;
}

/**
 * GET /api/health
 * 
 * Health check endpoint for Kubernetes liveness/readiness probes.
 * 
 * Usage:
 * - Liveness probe: GET /api/health
 * - Readiness probe: GET /api/health?deep=true (checks OpenAI connectivity)
 * 
 * Response:
 * - 200 OK: Service is healthy
 * - 503 Service Unavailable: Service is unhealthy
 */
export async function GET(request: Request) {
    const url = new URL(request.url);
    const deepCheck = url.searchParams.get('deep') === 'true';

    const health: HealthStatus = {
        status: 'ok',
        version: process.env.npm_package_version || '0.1.0',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        timestamp: new Date().toISOString(),
        checks: {},
    };

    // Memory check
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    health.checks.memory = heapUsedMB / heapTotalMB > 0.9 ? 'warning' : 'ok';
    health.details = {
        memory: {
            heapUsed: `${heapUsedMB}MB`,
            heapTotal: `${heapTotalMB}MB`,
            rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        },
    };

    // Deep check: verify OpenAI API connectivity
    if (deepCheck) {
        try {
            const apiKey = process.env.OPENAI_API_KEY;
            if (!apiKey) {
                health.checks.openai = 'error';
                health.status = 'degraded';
            } else {
                // Quick connectivity check (list models is fast)
                const response = await fetch('https://api.openai.com/v1/models', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                    },
                    signal: AbortSignal.timeout(5000), // 5s timeout
                });

                health.checks.openai = response.ok ? 'ok' : 'error';
                if (!response.ok) {
                    health.status = 'degraded';
                }
            }
        } catch {
            health.checks.openai = 'error';
            health.status = 'degraded';
        }
    } else {
        health.checks.openai = 'unchecked';
    }

    // Determine HTTP status
    const httpStatus = health.status === 'error' ? 503 : 200;

    return NextResponse.json(health, { status: httpStatus });
}
