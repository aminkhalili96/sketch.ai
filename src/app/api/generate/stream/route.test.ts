/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

describe('POST /api/generate/stream', () => {
    it('returns an error event on validation failure', async () => {
        const req = new NextRequest('http://localhost:3000/api/generate/stream', {
            method: 'POST',
            body: JSON.stringify({}),
        });

        const res = await POST(req);
        const text = await res.text();
        const firstLine = text.trim().split('\n')[0];
        const event = JSON.parse(firstLine) as { type: string; error?: string };

        expect(event.type).toBe('error');
        expect(event.error).toBeDefined();
    });
});
