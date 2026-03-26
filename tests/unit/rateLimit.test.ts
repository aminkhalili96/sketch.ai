/**
 * @vitest-environment node
 */
import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
    checkRateLimit,
    getClientIdentifier,
    withRateLimit,
    type RateLimitConfig,
} from '@/backend/infra/rateLimit';

describe('checkRateLimit', () => {
    const config: RateLimitConfig = {
        windowMs: 60_000,
        maxRequests: 3,
        keyPrefix: 'test',
    };

    beforeEach(() => {
        // Use a unique key prefix per test to avoid cross-test contamination
    });

    it('allows requests under the limit', () => {
        const uniqueKey = `user-under-${Date.now()}-${Math.random()}`;
        const result = checkRateLimit(uniqueKey, config);
        expect(result.limited).toBe(false);
    });

    it('allows exactly maxRequests requests', () => {
        const uniqueKey = `user-exact-${Date.now()}-${Math.random()}`;
        for (let i = 0; i < config.maxRequests; i++) {
            const result = checkRateLimit(uniqueKey, config);
            expect(result.limited).toBe(false);
        }
    });

    it('blocks requests over the limit', () => {
        const uniqueKey = `user-over-${Date.now()}-${Math.random()}`;
        // Make maxRequests allowed calls
        for (let i = 0; i < config.maxRequests; i++) {
            checkRateLimit(uniqueKey, config);
        }
        // The next call should be blocked
        const result = checkRateLimit(uniqueKey, config);
        expect(result.limited).toBe(true);
        if (result.limited) {
            expect(result.retryAfter).toBeGreaterThan(0);
            expect(result.remaining).toBe(0);
        }
    });

    it('uses keyPrefix in the store key', () => {
        const uniqueKey = `user-prefix-${Date.now()}-${Math.random()}`;
        const configA: RateLimitConfig = { windowMs: 60_000, maxRequests: 1, keyPrefix: 'prefixA' };
        const configB: RateLimitConfig = { windowMs: 60_000, maxRequests: 1, keyPrefix: 'prefixB' };

        // Use up limit for prefixA
        checkRateLimit(uniqueKey, configA);
        const resultA = checkRateLimit(uniqueKey, configA);
        expect(resultA.limited).toBe(true);

        // prefixB should still allow
        const resultB = checkRateLimit(uniqueKey, configB);
        expect(resultB.limited).toBe(false);
    });
});

describe('getClientIdentifier', () => {
    function makeRequest(headers: Record<string, string> = {}): Request {
        return new Request('http://localhost:3000/api/test', {
            headers,
        });
    }

    it('extracts IP from X-Forwarded-For header', () => {
        const req = makeRequest({ 'X-Forwarded-For': '192.168.1.100, 10.0.0.1' });
        const id = getClientIdentifier(req);
        expect(id).toBe('ip:192.168.1.100');
    });

    it('extracts IP from X-Real-IP header', () => {
        const req = makeRequest({ 'X-Real-IP': '10.0.0.5' });
        const id = getClientIdentifier(req);
        expect(id).toBe('ip:10.0.0.5');
    });

    it('returns API key prefix when X-API-Key is set', () => {
        const req = makeRequest({ 'X-API-Key': 'sk-1234567890abcdef' });
        const id = getClientIdentifier(req);
        expect(id).toBe('key:sk-12345...');
    });

    it('prefers API key over IP headers', () => {
        const req = makeRequest({
            'X-API-Key': 'sk-abcdefgh12345678',
            'X-Forwarded-For': '192.168.1.100',
        });
        const id = getClientIdentifier(req);
        expect(id).toContain('key:');
    });

    it('returns unknown when no identifying headers', () => {
        const req = makeRequest({});
        const id = getClientIdentifier(req);
        expect(id).toBe('ip:unknown');
    });

    it('prefers X-Forwarded-For over X-Real-IP', () => {
        const req = makeRequest({
            'X-Forwarded-For': '1.2.3.4',
            'X-Real-IP': '5.6.7.8',
        });
        const id = getClientIdentifier(req);
        expect(id).toBe('ip:1.2.3.4');
    });
});

describe('withRateLimit', () => {
    it('returns null in test environment', () => {
        // vitest sets NODE_ENV=test by default
        const req = new Request('http://localhost:3000/api/test');
        const result = withRateLimit(req);
        expect(result).toBeNull();
    });
});
