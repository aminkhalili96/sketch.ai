import { NextResponse } from 'next/server';
import { createTimer, generateRequestId, logger } from '@/lib/logger';
import {
    RATE_LIMIT_CONFIGS,
    getClientIdentifier,
    getRateLimitStatus,
    withRateLimit,
    type RateLimitConfig,
} from '@/lib/rateLimit';
import { trackRequest, trackError } from '@/lib/metrics';

export type ApiContext = {
    requestId: string;
    path: string;
    rateLimitResponse: NextResponse | null;
    finalize: (response: NextResponse) => NextResponse;
    logError: (error: Error, status?: number) => void;
};

export function createApiContext(
    request: Request,
    config: RateLimitConfig = RATE_LIMIT_CONFIGS.general
): ApiContext {
    const requestId = request.headers.get('x-request-id') ?? generateRequestId();
    const path = new URL(request.url).pathname;
    const timer = createTimer();
    const rateLimitResponse = withRateLimit(request, config);
    const identifier = getClientIdentifier(request);
    const rateStatus = getRateLimitStatus(identifier, config);

    const finalize = (response: NextResponse) => {
        const duration = timer();
        response.headers.set('X-Request-ID', requestId);
        response.headers.set('X-RateLimit-Remaining', String(rateStatus.remaining));
        response.headers.set('X-RateLimit-Reset', String(Math.floor(rateStatus.resetAt / 1000)));

        trackRequest(request.method, path, response.status, duration);

        const log =
            response.status >= 500
                ? logger.error
                : response.status >= 400
                    ? logger.warn
                    : logger.info;
        log('API response', {
            requestId,
            method: request.method,
            path,
            status: response.status,
            durationMs: duration,
        });

        return response;
    };

    const logError = (error: Error, status = 500) => {
        logger.error('API error', { requestId, path, status }, error);
        trackError('api', path);
    };

    return { requestId, path, rateLimitResponse, finalize, logError };
}
